#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>

// ---------------- WiFi / Server ----------------
const char* ssid       = "mayank";
const char* password   = "";
const char* serverUrl = "http://10.51.96.87:8000/sensor-data";

// Device credential for the backend's require_device_api_key dependency
// (backend/app/routers/sensor.py) - must match that server's
// BACKEND_API_KEY exactly, or every upload is rejected with 401.
// Replace this placeholder before flashing; never commit the real value.
const char* apiKey = "REPLACE_WITH_BACKEND_API_KEY";

const unsigned long UPLOAD_INTERVAL = 5000;   // ms between HTTP uploads (runs on core 0)

// GET .../commands - same host/device as serverUrl above, same apiKey.
// See backend/app/api/v1/routes/device_commands.py::poll_commands.
const char* commandsUrl = "http://10.51.96.87:8000/api/v1/devices/1/commands";

// millis()-gated, independent of UPLOAD_INTERVAL above (checked once per
// uploadTask iteration; that loop's own 5s vTaskDelay currently bounds
// the realized polling rate to at most once per ~5s regardless of this
// value - kept as its own named constant so it documents intent and
// stays correct if the upload cadence is ever changed independently).
unsigned long lastCommandPoll = 0;
const unsigned long COMMAND_POLL_INTERVAL = 3000;   // ms between GET .../commands polls

// ---------------- Debug ----------------
#define DEBUG_SERIAL 1   // set to 0 to silence printSerial() and speed up loop further

// ---------------- OLED ----------------
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// ---------------- Pins ----------------
#define PH_PIN        34
#define TDS_PIN       35
#define TRIG_PIN      5
#define ECHO_PIN      18
#define BUZZER_PIN    19
#define ONE_WIRE_BUS  4
#define PUMP_PIN      23   // relay/MOSFET controlling the pump

// ---------------- DS18B20 ----------------
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

// ---------------- Water level thresholds ----------------
#define TANK_FULL_DIST   7    // distance < this  -> tank FULL
#define TANK_EMPTY_DIST  30   // distance > this  -> tank EMPTY/LOW

// ---------------- Timing (non-blocking) ----------------
#define SENSOR_INTERVAL_MS    100    // pH/TDS/distance/OLED/serial refresh (was 200)
#define PULSE_INTERVAL_MS     150    // buzzer pulse rate when low
#define TEMP_REQUEST_MS       400    // how often we kick off a new temp reading
#define TEMP_CONVERSION_MS    100    // wait time for 9-bit conversion (~94ms, rounded up)
#define ULTRASONIC_TIMEOUT_US 15000  // shorter timeout = faster loop on no-echo

unsigned long lastSensorRead   = 0;
unsigned long lastPulseToggle  = 0;
unsigned long lastTempRequest  = 0;
unsigned long tempRequestTime  = 0;
bool tempRequested = false;
bool pulseState    = false;

// ---------------- Variables ----------------
float temperature = 0;
float distance     = 0;

float pHVoltage = 0;
float pHValue   = 0;

float tdsVoltage = 0;
float tdsValue   = 0;   // ppm
float ecValue    = 0;   // uS/cm (derived from same probe)

bool pumpState   = false;
bool buzzerState = false;   // tracked explicitly instead of digitalRead-ing an OUTPUT pin

enum WaterLevel { LEVEL_NORMAL, LEVEL_FULL, LEVEL_EMPTY, LEVEL_UNKNOWN };
WaterLevel waterLevel = LEVEL_NORMAL;

// ---------------- Manual override (for bench testing only) ----------------
bool manualOverride = false;

// Single authoritative pump-relay writer - defined below in the
// SENSOR / LOGIC HELPERS section, forward-declared here so
// handleSerialCommands() and setup() can call it. This is the ONLY
// function in this sketch allowed to call digitalWrite(PUMP_PIN, ...)
// or assign pumpState.
void applyPumpDecision(bool requestedOn);

// Command polling (core 0, inside uploadTask) and reception (core 1,
// inside loop()) - forward-declared for the same reason as above.
void pollCommands();
void handleCommandResponse(const String &body);
void handleOneCommand(JsonObject cmd);
void processPendingCommands();

// ---------------- Cross-core snapshot for HTTP upload task ----------------
struct SensorSnapshot {
  float ph, tds, ec, temp, dist;
  bool pump, buzzer;
};
SensorSnapshot snapshot;
SemaphoreHandle_t dataMutex;

// ---------------- Cross-core command handoff ----------------
// Mirrors the pattern above in the opposite direction: core 0
// (pollCommands/handleCommandResponse, below) discovers and STRICTLY
// VALIDATES a backend command, then only ever stores it here - it never
// calls applyPumpDecision() or touches manualOverride itself. Core 1
// (processPendingCommands(), called from loop()) is the only code that
// drains these and acts on them, exclusively through the existing
// safety-arbited control path. pump_state and pump_mode are independent
// command types on the backend (each supersedes only its own kind), so
// they get two separate slots/ids here rather than one shared struct -
// a pending command of one kind is never blocked or overwritten by the
// other.
struct PendingBoolCommand {
  bool available;
  long id;
  bool value;
};
PendingBoolCommand pendingPumpState = { false, -1, false };
PendingBoolCommand pendingPumpMode  = { false, -1, false };   // value = requested manualOverride

// Duplicate-command protection (Part 10): the backend keeps returning an
// active (pending/delivered) command on every poll until it is
// acknowledged - which this task deliberately does not implement yet
// (see poll_commands' docstring). Without this, the same already-seen
// command would be re-validated, re-stored, and re-logged every single
// polling cycle. Read/written only by core 0 (pollCommands's call
// chain), so no mutex is needed for these two - they're never touched
// from core 1.
long lastSeenPumpStateId = -1;
long lastSeenPumpModeId  = -1;

SemaphoreHandle_t commandMutex;

// ---------------- Cross-core ACK handoff ----------------
// Populated by processPendingCommands() (core 1) the moment a command's
// REAL outcome is known - strictly AFTER applyPumpDecision() has already
// run, or AFTER manualOverride has already been assigned, never before
// (Part 2: no acknowledgement before the final result is known). Sent
// by sendPendingAcks() (core 0, inside uploadTask, below). Cleared only
// once the backend has actually confirmed receipt (HTTP 200) - a
// network failure must never cause the device to forget a result it
// already knows (Part 6), and retrying only ever re-sends this same,
// already-computed HTTP report - it never re-runs
// applyPumpDecision()/manualOverride, so a failed ACK can never cause a
// duplicate physical pump action.
struct PendingAck {
  bool available;
  long commandId;
  bool appliedValue;       // pump_state: the REAL resulting pumpState (post-safety), never the raw request. pump_mode: the resulting manualOverride (always equals the request - see processPendingCommands).
  bool wasSafetyRefused;
};
PendingAck ackPumpState = { false, -1, false, false };
PendingAck ackPumpMode  = { false, -1, false, false };   // wasSafetyRefused always false - mode switching has no safety gate in this firmware

void sendPendingAcks();
void sendAckIfPending(PendingAck &ack, bool isPumpState);

// ======================================================
//                     WIFI HELPERS
// ======================================================
void connectWiFi() {

  WiFi.disconnect(true, true);
  delay(1000);

  WiFi.mode(WIFI_STA);
  delay(500);

  Serial.println("Connecting to WiFi...");
  WiFi.begin(ssid, password);

  unsigned long start = millis();

  while (WiFi.status() != WL_CONNECTED &&
         millis() - start < 20000) {

    Serial.print(".");
    Serial.println(WiFi.status());
    delay(500);
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("Connected!");
    Serial.print("ESP32 IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.print("Failed. Status = ");
    Serial.println(WiFi.status());
  }
}

// ======================================================
//        UPLOAD TASK (runs on core 0, never blocks loop)
void uploadTask(void *param) {
  for (;;) {

    Serial.println("\n========== Upload Task ==========");

    Serial.print("WiFi Status: ");
    Serial.println(WiFi.status());

    if (WiFi.status() == WL_CONNECTED) {

      SensorSnapshot local;
      if (xSemaphoreTake(dataMutex, portMAX_DELAY) == pdTRUE) {
        local = snapshot;
        xSemaphoreGive(dataMutex);
      }

      HTTPClient http;

      Serial.print("Connecting to: ");
      Serial.println(serverUrl);

      http.begin(serverUrl);
      http.addHeader("Content-Type", "application/json");
      http.addHeader("X-API-Key", apiKey);
      http.setTimeout(3000);

      String json = "{";
      json += "\"device_id\":1,";
      json += "\"ph\":" + String(local.ph, 2) + ",";
      json += "\"tds\":" + String(local.tds, 2) + ",";
      json += "\"ec\":" + String(local.ec, 2) + ",";
      json += "\"water_temperature\":" + String(local.temp, 2) + ",";
      json += "\"water_level\":" + String(local.dist, 2) + ",";
      json += "\"pump_status\":" + String(local.pump ? "true" : "false") + ",";
      json += "\"buzzer_status\":" + String(local.buzzer ? "true" : "false");
      json += "}";

      Serial.println("JSON:");
      Serial.println(json);

      int code = http.POST(json);

      Serial.print("HTTP Code = ");
      Serial.println(code);

      if (code == 200) {
        Serial.println("Telemetry uploaded successfully");
      } else if (code == 401) {
        Serial.println("Telemetry rejected: authentication failed");
      } else if (code > 0) {
        Serial.println("Server Response:");
        Serial.println(http.getString());
      } else {
        Serial.print("HTTP Error: ");
        Serial.println(http.errorToString(code));
      }

      http.end();

      pollCommands();
      sendPendingAcks();
    }
    else {
      Serial.println("WiFi Disconnected!");
    }

    Serial.println("Sleeping 5 seconds...");
    vTaskDelay(pdMS_TO_TICKS(5000));
  }
}

// ======================================================
//   COMMAND POLLING (core 0, called from uploadTask above)
// ======================================================
// GET .../commands, validate the response strictly, and hand any
// accepted command off to processPendingCommands() (core 1, loop()) via
// the pendingPumpState/pendingPumpMode structs above. This function
// itself never calls applyPumpDecision() and never touches
// manualOverride/PUMP_PIN - see the "Cross-core command handoff" note.
void pollCommands() {
  unsigned long now = millis();
  if (now - lastCommandPoll < COMMAND_POLL_INTERVAL) {
    return;
  }
  lastCommandPoll = now;

  HTTPClient http;
  http.begin(commandsUrl);
  http.addHeader("X-API-Key", apiKey);
  http.setTimeout(3000);

  int code = http.GET();

  if (code == 200) {
    handleCommandResponse(http.getString());
  } else if (code == 401) {
    Serial.println("Command polling authentication failed");
  } else if (code > 0) {
    Serial.print("Command polling failed, HTTP code = ");
    Serial.println(code);
  } else {
    Serial.print("Command polling error: ");
    Serial.println(http.errorToString(code));
  }

  http.end();
}

// Parses {"commands":[...]} and validates each entry. An empty array is
// the normal "nothing pending" case and is deliberately not logged -
// see Part 13/Part 5.A of this task.
void handleCommandResponse(const String &body) {
  DynamicJsonDocument doc(1024);
  DeserializationError err = deserializeJson(doc, body);

  if (err) {
    Serial.print("Command polling: malformed JSON (");
    Serial.print(err.c_str());
    Serial.println(")");
    return;
  }

  JsonArray commands = doc["commands"].as<JsonArray>();
  if (commands.isNull()) {
    Serial.println("Command polling: malformed response (missing commands array)");
    return;
  }

  for (JsonVariant v : commands) {
    handleOneCommand(v.as<JsonObject>());
  }
}

// Strict per-command validation (Part 6). Any check that fails rejects
// just this one command safely - it never reaches
// pendingPumpState/pendingPumpMode, so it can never influence the pump.
void handleOneCommand(JsonObject cmd) {
  if (!cmd["id"].is<long>()) {
    Serial.println("Command rejected: missing/invalid id");
    return;
  }
  long id = cmd["id"];

  const char* type = cmd["command_type"].as<const char*>();
  if (type == nullptr) {
    Serial.println("Command rejected: missing command_type");
    return;
  }
  String commandType(type);

  if (commandType == "pump_state") {
    if (id == lastSeenPumpStateId) return;   // duplicate - already handled, stay quiet

    // An earlier pump_state command hasn't finished its own lifecycle
    // yet (not yet applied, or applied but its ACK hasn't been
    // confirmed delivered) - don't accept a new one on top of it, or a
    // still-unsent ACK could be silently overwritten and lost (Part 6/7).
    // Deliberately does NOT update lastSeenPumpStateId, so this exact id
    // is re-evaluated (and normally accepted) on a later poll once the
    // outstanding one clears - which the at-least-once delivery model
    // already guarantees will keep happening.
    bool inFlight = false;
    if (xSemaphoreTake(commandMutex, portMAX_DELAY) == pdTRUE) {
      inFlight = pendingPumpState.available || ackPumpState.available;
      xSemaphoreGive(commandMutex);
    }
    if (inFlight) return;

    lastSeenPumpStateId = id;

    if (!cmd["requested_pump_state"].is<bool>()) {
      Serial.println("Command rejected: invalid payload for pump_state");
      return;
    }
    bool value = cmd["requested_pump_state"].as<bool>();

    if (xSemaphoreTake(commandMutex, portMAX_DELAY) == pdTRUE) {
      pendingPumpState.available = true;
      pendingPumpState.id = id;
      pendingPumpState.value = value;
      xSemaphoreGive(commandMutex);
    }
    Serial.println("Command received: pump_state");

  } else if (commandType == "pump_mode") {
    if (id == lastSeenPumpModeId) return;

    bool inFlight = false;
    if (xSemaphoreTake(commandMutex, portMAX_DELAY) == pdTRUE) {
      inFlight = pendingPumpMode.available || ackPumpMode.available;
      xSemaphoreGive(commandMutex);
    }
    if (inFlight) return;

    lastSeenPumpModeId = id;

    if (!cmd["requested_manual_override"].is<bool>()) {
      Serial.println("Command rejected: invalid payload for pump_mode");
      return;
    }
    bool value = cmd["requested_manual_override"].as<bool>();

    if (xSemaphoreTake(commandMutex, portMAX_DELAY) == pdTRUE) {
      pendingPumpMode.available = true;
      pendingPumpMode.id = id;
      pendingPumpMode.value = value;
      xSemaphoreGive(commandMutex);
    }
    Serial.println("Command received: pump_mode");

  } else {
    Serial.print("Command rejected: unknown type '");
    Serial.print(commandType);
    Serial.println("'");
  }
}

// ======================================================
//   COMMAND ACKNOWLEDGEMENT (core 0, called from uploadTask)
// ======================================================
// Reports whatever processPendingCommands() (core 1) already computed
// and stored in ackPumpState/ackPumpMode. Never computes a result
// itself, never touches the pump, and never retries by re-running a
// command - only the HTTP report is retried. Backend contract
// (backend/app/api/v1/routes/device_commands.py::acknowledge_command):
// an identical repeat of an already-acknowledged result is a safe 200
// no-op, so resending the exact same stored values on every call here
// is always safe under retry.
void sendPendingAcks() {
  sendAckIfPending(ackPumpState, true);
  sendAckIfPending(ackPumpMode, false);
}

void sendAckIfPending(PendingAck &ack, bool isPumpState) {
  bool have;
  long id;
  bool appliedValue;
  bool wasSafetyRefused;

  if (xSemaphoreTake(commandMutex, portMAX_DELAY) == pdTRUE) {
    have = ack.available;
    id = ack.commandId;
    appliedValue = ack.appliedValue;
    wasSafetyRefused = ack.wasSafetyRefused;
    xSemaphoreGive(commandMutex);
  }

  if (!have) return;

  String json = "{";
  json += "\"applied_pump_state\":";
  json += isPumpState ? (appliedValue ? "true" : "false") : "null";
  json += ",\"applied_manual_override\":";
  json += isPumpState ? "null" : (appliedValue ? "true" : "false");
  json += ",\"was_safety_refused\":";
  json += wasSafetyRefused ? "true" : "false";
  json += "}";

  String url = String(commandsUrl) + "/" + String(id) + "/ack";

  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", apiKey);
  http.setTimeout(3000);

  int code = http.POST(json);

  if (code == 200) {
    Serial.print("Command acknowledged: id=");
    Serial.println(id);
    if (xSemaphoreTake(commandMutex, portMAX_DELAY) == pdTRUE) {
      ack.available = false;   // only ever cleared on confirmed backend success
      xSemaphoreGive(commandMutex);
    }
  } else if (code == 401) {
    Serial.println("Command ACK authentication failed");
    // retained for retry - see function header
  } else if (code == 404) {
    Serial.print("Command ACK: command no longer exists, dropping id=");
    Serial.println(id);
    if (xSemaphoreTake(commandMutex, portMAX_DELAY) == pdTRUE) {
      ack.available = false;   // nothing left to retry against
      xSemaphoreGive(commandMutex);
    }
  } else if (code == 409) {
    Serial.print("Command ACK conflict (already recorded differently), dropping id=");
    Serial.println(id);
    if (xSemaphoreTake(commandMutex, portMAX_DELAY) == pdTRUE) {
      ack.available = false;   // retrying the same payload will never resolve a genuine conflict
      xSemaphoreGive(commandMutex);
    }
  } else if (code > 0) {
    Serial.print("Command ACK failed, HTTP code = ");
    Serial.println(code);
    // retained for retry - may be a transient server error
  } else {
    Serial.print("Command ACK network error: ");
    Serial.println(http.errorToString(code));
    // retained for retry
  }

  http.end();
}

// ======================================================
//                  SERIAL COMMANDS
// ======================================================
void handleSerialCommands() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    cmd.toUpperCase();

    if (cmd == "PUMP_ON") {
      manualOverride = true;
      applyPumpDecision(true);   // D: honored unless A/B safety refuses it
      if (pumpState) {
        Serial.println(">> Manual override: Pump ON");
      } else {
        Serial.println(">> Manual override: Pump ON REFUSED (safety: tank full or level unknown)");
      }
    } else if (cmd == "PUMP_OFF") {
      manualOverride = true;
      applyPumpDecision(false);
      Serial.println(">> Manual override: Pump OFF");
    } else if (cmd == "PUMP_AUTO") {
      manualOverride = false;
      Serial.println(">> Back to AUTOMATIC water-level control");
    } else if (cmd.length() > 0) {
      Serial.println(">> Unknown command. Use PUMP_ON / PUMP_OFF / PUMP_AUTO");
    }
  }
}

// ======================================================
//                       SETUP
// ======================================================
void setup()
{
  Serial.begin(115200);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(PUMP_PIN, OUTPUT);

  digitalWrite(BUZZER_PIN, LOW);
  applyPumpDecision(false);   // E: startup always begins pump OFF

  sensors.begin();
  sensors.setResolution(9);             // 9-bit = ~94ms conversion instead of ~750ms
  sensors.setWaitForConversion(false);  // don't block while DS18B20 converts

  Wire.begin(21, 22);
  Wire.setClock(400000);   // 400kHz I2C instead of default 100kHz -> faster OLED pushes

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C))
  {
    Serial.println("OLED Failed");
    while (1);
  }

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  connectWiFi();

  dataMutex = xSemaphoreCreateMutex();
  commandMutex = xSemaphoreCreateMutex();
  xTaskCreatePinnedToCore(
    uploadTask,     // task function
    "uploadTask",   // name
    8192,           // stack size
    NULL,           // param
    1,              // priority
    NULL,           // task handle
    0               // pin to core 0 (main loop runs on core 1)
  );

  Serial.println("System Started (fast mode, dual-core upload)");
  Serial.println("Automatic water-level pump control is ACTIVE.");
  Serial.println("Type PUMP_ON / PUMP_OFF to override, PUMP_AUTO to return to automatic.");
}

// ======================================================
//                  SENSOR / LOGIC HELPERS
// ======================================================
void updateTemperature(unsigned long now) {
  // Kick off a new reading periodically
  if (!tempRequested && (now - lastTempRequest >= TEMP_REQUEST_MS)) {
    sensors.requestTemperatures();   // non-blocking (setWaitForConversion(false))
    tempRequested = true;
    tempRequestTime = now;
    lastTempRequest = now;
  }

  // Collect the result once conversion time has passed
  if (tempRequested && (now - tempRequestTime >= TEMP_CONVERSION_MS)) {
    float t = sensors.getTempCByIndex(0);
    if (t != DEVICE_DISCONNECTED_C) temperature = t;
    tempRequested = false;
  }
}

void readDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(5);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, ULTRASONIC_TIMEOUT_US);
  if (duration == 0)
      distance = -1;   // out of range / no echo
  else
      distance = duration * 0.0343 / 2.0;
}

// ======================================================
//         PUMP OUTPUT - SINGLE AUTHORITATIVE WRITER
// ======================================================
// The only function in this sketch that calls digitalWrite(PUMP_PIN, ...)
// or assigns pumpState. Every pump-changing path (startup, serial manual
// command, automatic water-level logic) must go through here instead of
// touching the pin directly, so safety precedence is enforced identically
// no matter who is asking.
//
// Safety precedence (highest first), evaluated against the CURRENT
// waterLevel every time a decision is requested:
//   A. LEVEL_UNKNOWN - invalid/missing ultrasonic reading -> never run
//      blind, force OFF. Overrides AUTO and MANUAL alike.
//   B. LEVEL_FULL    - tank full -> force OFF. Overrides AUTO and MANUAL
//      alike (a manual ON request cannot re-flood a full tank).
//   C/D. Otherwise, honor the requested state as-is - the caller (AUTO
//      logic or a manual command) has already made that decision.
void applyPumpDecision(bool requestedOn) {
  bool allowedOn = requestedOn;

  if (waterLevel == LEVEL_UNKNOWN || waterLevel == LEVEL_FULL) {
    allowedOn = false;
  }

  pumpState = allowedOn;
  digitalWrite(PUMP_PIN, allowedOn ? HIGH : LOW);
}

// ======================================================
//   COMMAND RECEPTION (core 1, called every loop() pass)
// ======================================================
// Drains whatever pollCommands() (core 0) validated and stored, and
// routes it through the EXISTING control architecture only:
//   - a pump_state command calls applyPumpDecision() - the single
//     authoritative pump writer above, whose A/B safety checks
//     (LEVEL_UNKNOWN / LEVEL_FULL -> force OFF) still run unconditionally
//     and are NOT bypassed or duplicated here.
//   - a pump_mode command only ever assigns manualOverride, exactly
//     like the PUMP_AUTO serial command already does.
// Never calls digitalWrite(PUMP_PIN, ...) directly. manualOverride is
// applied first so that if both arrive in the same cycle, the pump_state
// command takes effect under the mode that was just requested, matching
// how a human issuing the same two actions in order would expect it to
// behave. That internal ordering has no effect on the OUTCOME of the
// applyPumpDecision() call this tick either way, though - it consults
// only waterLevel, never manualOverride.
//
// REMOTE pump_state SEMANTICS (backend/app/routers/device.py::set_pump
// queues this unconditionally - no manualOverride check exists there,
// and the frontend's own MANUAL-mode gating is a UI convenience, not an
// enforced contract - see B6-8.1's report). A remote pump_state command
// is therefore an unconditional "set the output now" request, safety-
// gated exactly like a serial PUMP_ON/PUMP_OFF, but - unlike the serial
// handler - it never itself changes manualOverride. Full effect matrix
// for a remote ON, by current (mode, waterLevel) at the moment it's
// applied:
//   waterLevel == LEVEL_UNKNOWN or LEVEL_FULL (either mode):
//       applyPumpDecision's A/B check forces it back OFF immediately;
//       updateWaterLevelAndPump's own next tick reinforces OFF the same
//       way it already does for any other pump-on attempt. Safety wins
//       regardless of mode - Part 3's precedence holds.
//   AUTO + LEVEL_EMPTY:      turns ON; AUTO's own next-tick decision
//                            independently wants ON too - no conflict.
//   MANUAL + LEVEL_EMPTY:    turns ON; MANUAL leaves it exactly as set.
//   AUTO + LEVEL_NORMAL:     turns ON; AUTO's hysteresis only ever HOLDS
//                            the current state in NORMAL, never actively
//                            turns it back off - so it stays ON despite
//                            manualOverride still reading false, until
//                            the level changes or another command
//                            arrives. This is a real, deterministic
//                            consequence of hysteresis being passive,
//                            not a bug.
//   MANUAL + LEVEL_NORMAL:   turns ON; MANUAL leaves it exactly as set
//                            (same observable outcome as the AUTO case
//                            above, reached for a different reason).
// A remote OFF is symmetric and always safe (OFF never conflicts with
// A/B safety), with one asymmetry worth naming: AUTO + LEVEL_EMPTY will
// have AUTO's own next tick immediately turn it back ON again, since
// AUTO actively wants ON in EMPTY (unlike NORMAL's passive hysteresis).
// A remote OFF sent without first switching to MANUAL can therefore be
// transient in that specific combination - exactly why the frontend's
// UI steers users through MANUAL mode first, even though nothing here
// or in the backend requires it.
// mode (AUTO/MANUAL) has NO effect on how a fresh pump_state command
// itself resolves in any of the above cases - only on what the system
// does autonomously afterward.
void processPendingCommands() {
  bool haveManualOverride = false, manualOverrideValue = false;
  long manualOverrideId = -1;
  bool havePumpState = false, pumpStateValue = false;
  long pumpStateId = -1;

  if (xSemaphoreTake(commandMutex, 0) == pdTRUE) {
    if (pendingPumpMode.available) {
      haveManualOverride = true;
      manualOverrideValue = pendingPumpMode.value;
      manualOverrideId = pendingPumpMode.id;
      pendingPumpMode.available = false;
    }
    if (pendingPumpState.available) {
      havePumpState = true;
      pumpStateValue = pendingPumpState.value;
      pumpStateId = pendingPumpState.id;
      pendingPumpState.available = false;
    }
    xSemaphoreGive(commandMutex);
  }

  if (haveManualOverride) {
    manualOverride = manualOverrideValue;
    Serial.println(manualOverride ? "Command applied: MANUAL mode" : "Command applied: AUTO mode");

    // Mode switching has no safety gate in this firmware - it always
    // succeeds exactly as requested, so the outcome is known immediately.
    if (xSemaphoreTake(commandMutex, portMAX_DELAY) == pdTRUE) {
      ackPumpMode.available = true;
      ackPumpMode.commandId = manualOverrideId;
      ackPumpMode.appliedValue = manualOverride;
      ackPumpMode.wasSafetyRefused = false;
      xSemaphoreGive(commandMutex);
    }
  }

  if (havePumpState) {
    applyPumpDecision(pumpStateValue);   // safety arbiter remains authoritative

    // The REAL outcome, read back from pumpState after the safety
    // arbiter has already run (Part 2/4) - never assumed from the raw
    // request. If applyPumpDecision's A/B check (LEVEL_UNKNOWN/
    // LEVEL_FULL) forced a different result than requested, pumpState
    // will already reflect that here.
    bool refused = (pumpState != pumpStateValue);
    Serial.println(pumpStateValue ? "Command applied: Pump ON" : "Command applied: Pump OFF");
    if (refused) {
      Serial.println("Command outcome: safety refused the requested pump state");
    }

    if (xSemaphoreTake(commandMutex, portMAX_DELAY) == pdTRUE) {
      ackPumpState.available = true;
      ackPumpState.commandId = pumpStateId;
      ackPumpState.appliedValue = pumpState;   // the real resulting state, not the request
      ackPumpState.wasSafetyRefused = refused;
      xSemaphoreGive(commandMutex);
    }
  }
}

void updateWaterLevelAndPump() {
  if (distance < 0) {
    waterLevel = LEVEL_UNKNOWN;
  } else if (distance < TANK_FULL_DIST) {
    waterLevel = LEVEL_FULL;
  } else if (distance > TANK_EMPTY_DIST) {
    waterLevel = LEVEL_EMPTY;
  } else {
    waterLevel = LEVEL_NORMAL;
  }

  // A/B safety: re-assert OFF on every tick while unsafe, in BOTH modes.
  // (Also self-heals a stale manual ON the instant the tank reports full
  // or the sensor drops out, without waiting for a new command.)
  if (waterLevel == LEVEL_UNKNOWN || waterLevel == LEVEL_FULL) {
    applyPumpDecision(false);
    return;
  }

  // AUTO mode only below this point. MANUAL mode leaves the pump exactly
  // as the last PUMP_ON/PUMP_OFF command set it (unchanged from the
  // original behavior - just re-expressed through the single write path).
  if (manualOverride) {
    return;
  }

  if (waterLevel == LEVEL_EMPTY) {
    applyPumpDecision(true);
  }
  // LEVEL_NORMAL: hysteresis - hold current state, no decision needed.
}

void updateBuzzer(unsigned long now) {
  if (waterLevel == LEVEL_FULL) {
    buzzerState = true;
    digitalWrite(BUZZER_PIN, HIGH);   // continuous alert
  }
  else if (waterLevel == LEVEL_EMPTY) {
    if (now - lastPulseToggle >= PULSE_INTERVAL_MS) {
      lastPulseToggle = now;
      pulseState = !pulseState;
      buzzerState = pulseState;
      digitalWrite(BUZZER_PIN, pulseState ? HIGH : LOW);
    }
  }
  else {
    buzzerState = false;
    digitalWrite(BUZZER_PIN, LOW);
    pulseState = false;
  }
}

#if DEBUG_SERIAL
void printSerial() {
  Serial.println("--------------------------------");
  Serial.print("Temperature : "); Serial.print(temperature); Serial.println(" C");
  Serial.print("Distance    : "); Serial.print(distance);    Serial.println(" cm");
  Serial.print("pH          : "); Serial.println(pHValue, 2);
  Serial.print("TDS         : "); Serial.print(tdsValue);    Serial.println(" ppm");
  Serial.print("EC          : "); Serial.print(ecValue);     Serial.println(" uS/cm");

  Serial.print("Water Level : ");
  switch (waterLevel) {
    case LEVEL_FULL:    Serial.println("FULL (alert)");       break;
    case LEVEL_EMPTY:   Serial.println("LOW (alert)");        break;
    case LEVEL_UNKNOWN: Serial.println("UNKNOWN (bad read)"); break;
    default:             Serial.println("NORMAL");            break;
  }

  Serial.print("Pump        : "); Serial.print(pumpState ? "ON" : "OFF");
  Serial.println(manualOverride ? "  (MANUAL)" : "  (AUTO)");
}
#endif

void updateOLED() {
  display.clearDisplay();
  display.setTextSize(1);

  display.setCursor(0, 0);
  display.print("Temp: "); display.print(temperature, 1); display.println(" C");

  display.setCursor(0, 10);
  display.print("Dist: ");
  if (distance < 0) display.print("ERR"); else display.print(distance, 1);
  display.println(" cm");

  display.setCursor(0, 20);
  display.print("pH: "); display.print(pHValue, 2);

  display.setCursor(0, 30);
  display.print("TDS: "); display.print((int)tdsValue); display.print(" ppm");

  display.setCursor(0, 40);
  display.print("EC: "); display.print((int)ecValue); display.print(" uS/cm");

  display.setCursor(0, 50);
  display.print("Pump:"); display.print(pumpState ? "ON " : "OFF");
  display.print(" ");
  switch (waterLevel) {
    case LEVEL_FULL:  display.print("FULL");  break;
    case LEVEL_EMPTY: display.print("LOW");   break;
    default:          display.print("OK");    break;
  }

  display.display();
}

// ======================================================
//                        LOOP  (core 1)
// ======================================================
void loop()
{
  unsigned long now = millis();

  // Checked every loop pass - instant response
  handleSerialCommands();
  processPendingCommands();   // cheap, non-blocking mutex try-take - see above
  updateBuzzer(now);
  updateTemperature(now);   // async, never blocks

  // Fast-refreshing sensor block
  if (now - lastSensorRead >= SENSOR_INTERVAL_MS) {
    lastSensorRead = now;

    //---------------- Ultrasonic ----------------
    readDistance();

    //---------------- pH ----------------
    int phADC = analogRead(PH_PIN);
    pHVoltage = phADC * (3.3 / 4095.0);
    pHValue = 1.04167 * (2.0 + ((2.5 - pHVoltage) / 0.18)) - 1.125;
    if (pHValue < 0.0) pHValue = 0.0;
    if (pHValue > 14.0) pHValue = 14.0;

    //---------------- TDS & EC (same analog probe) ----------------
    int tdsADC = analogRead(TDS_PIN);
    tdsVoltage = tdsADC * (3.3 / 4095.0);

    float rawEC = (133.42 * pow(tdsVoltage, 3)
                 - 255.86 * pow(tdsVoltage, 2)
                 + 857.39 * tdsVoltage);

    tdsValue = rawEC * 0.5;      // ppm
    ecValue  = tdsValue * 2.0;   // uS/cm (approximation from same probe)

    //---------------- Water level -> pump logic ----------------
    updateWaterLevelAndPump();

    //---------------- Publish snapshot for the upload task (non-blocking take) ----------------
    if (xSemaphoreTake(dataMutex, 0) == pdTRUE) {
      snapshot.ph     = pHValue;
      snapshot.tds    = tdsValue;
      snapshot.ec     = ecValue;
      snapshot.temp   = temperature;
      snapshot.dist   = distance;
      snapshot.pump   = pumpState;
      snapshot.buzzer = buzzerState;
      xSemaphoreGive(dataMutex);
    }

    //---------------- Output ----------------
    #if DEBUG_SERIAL
      printSerial();
    #endif
    updateOLED();
  }

  // HTTP upload now runs entirely in uploadTask() on core 0 - nothing left to do here.
}
