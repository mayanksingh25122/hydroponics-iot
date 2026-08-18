#include <WiFi.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>

// ---------------- WiFi / Server ----------------
const char* ssid       = "FLOOR-1";
const char* password   = "12345678";
const char* serverUrl = "http://10.100.67.7:8000/sensor-data";

const unsigned long UPLOAD_INTERVAL = 5000;   // ms between HTTP uploads (runs on core 0)
WebServer server(80);

// ---------------- Debug ----------------
#define DEBUG_SERIAL 1   // set to 0 to silence printSerial() and speed up loop further

// ---------------- OLED (SH1106, 128x64 I2C) ----------------
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SH1106G display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

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

// ---------------- Cross-core snapshot for HTTP upload task ----------------
struct SensorSnapshot {
  float ph, tds, ec, temp, dist;
  bool pump, buzzer;
};
SensorSnapshot snapshot;
SemaphoreHandle_t dataMutex;

void updateWaterLevelAndPump();

// ======================================================
//                  HTTP SERVER HELPERS
// ======================================================
void sendInvalidRequest() {
  server.send(400, "application/json", "{\"success\":false,\"message\":\"Invalid request\"}");
}

// Keeps manual commands on the same pump state path as serial control.
// A full tank is always allowed to stop the pump, even in manual mode.
void setManualPumpState(bool requestedState) {
  manualOverride = true;

  if (requestedState && distance >= 0 && distance < TANK_FULL_DIST) {
    pumpState = false;
    digitalWrite(PUMP_PIN, LOW);
    Serial.println(">> Pump ON command blocked: tank is FULL");
    return;
  }

  pumpState = requestedState;
  digitalWrite(PUMP_PIN, requestedState ? HIGH : LOW);
}

void handlePumpCommand() {
  if (!server.hasArg("plain")) {
    sendInvalidRequest();
    return;
  }

  DynamicJsonDocument request(128);
  DeserializationError error = deserializeJson(request, server.arg("plain"));
  if (error || !request["state"].is<bool>()) {
    sendInvalidRequest();
    return;
  }

  bool requestedState = request["state"].as<bool>();
  Serial.print(">> HTTP pump command: ");
  Serial.println(requestedState ? "ON" : "OFF");
  setManualPumpState(requestedState);

  String response = String("{\"success\":true,\"state\":") +
                    (pumpState ? "true" : "false") + "}";
  server.send(200, "application/json", response);
}

void handleStatus() {
  String response = String("{\"pump\":") + (pumpState ? "true" : "false") +
                    ",\"manualOverride\":" + (manualOverride ? "true" : "false") +
                    ",\"wifi\":" + (WiFi.status() == WL_CONNECTED ? "true" : "false") + "}";
  server.send(200, "application/json", response);
}

void handlePumpModeCommand() {
  if (!server.hasArg("plain")) {
    sendInvalidRequest();
    return;
  }

  DynamicJsonDocument request(128);
  DeserializationError error = deserializeJson(request, server.arg("plain"));
  if (error || !request["manualOverride"].is<bool>()) {
    sendInvalidRequest();
    return;
  }

  manualOverride = request["manualOverride"].as<bool>();
  if (!manualOverride) updateWaterLevelAndPump();

  Serial.print(">> HTTP pump mode: ");
  Serial.println(manualOverride ? "MANUAL" : "AUTO");

  String response = String("{\"success\":true,\"pump\":") +
                    (pumpState ? "true" : "false") +
                    ",\"manualOverride\":" + (manualOverride ? "true" : "false") + "}";
  server.send(200, "application/json", response);
}

void startHttpServer() {
  server.on("/pump", HTTP_POST, handlePumpCommand);
  server.on("/pump/mode", HTTP_POST, handlePumpModeCommand);
  server.on("/status", HTTP_GET, handleStatus);
  server.begin();
  Serial.println("HTTP server started");
  Serial.print("HTTP server IP: http://");
  Serial.println(WiFi.localIP());
}

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
    startHttpServer();
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

      if (code > 0) {
        Serial.println("Server Response:");
        Serial.println(http.getString());
      } else {
        Serial.print("HTTP Error: ");
        Serial.println(http.errorToString(code));
      }

      http.end();
    }
    else {
      Serial.println("WiFi Disconnected!");
    }

    Serial.println("Sleeping 5 seconds...");
    vTaskDelay(pdMS_TO_TICKS(5000));
  }
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
      setManualPumpState(true);
      Serial.println(">> Manual override: Pump ON");
    } else if (cmd == "PUMP_OFF") {
      setManualPumpState(false);
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
  digitalWrite(PUMP_PIN, LOW);

  sensors.begin();
  sensors.setResolution(9);             // 9-bit = ~94ms conversion instead of ~750ms
  sensors.setWaitForConversion(false);  // don't block while DS18B20 converts

  Wire.begin(21, 22);
  Wire.setClock(400000);   // 400kHz I2C instead of default 100kHz -> faster OLED pushes

  // SH1106 modules commonly use either 0x3C or 0x3D.
  if (!display.begin(0x3C, true) && !display.begin(0x3D, true))
  {
    Serial.println("SH1106 OLED failed at 0x3C and 0x3D (check I2C wiring/power)");
    while (1);
  }

  display.clearDisplay();
  display.setTextColor(SH110X_WHITE);

  connectWiFi();

  dataMutex = xSemaphoreCreateMutex();
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

void updateWaterLevelAndPump() {
  if (distance < 0) {
    waterLevel = LEVEL_UNKNOWN;
    return;
  }

  if (distance < TANK_FULL_DIST) {
    waterLevel = LEVEL_FULL;
    pumpState = false;
    digitalWrite(PUMP_PIN, LOW);
  } else if (distance > TANK_EMPTY_DIST) {
    waterLevel = LEVEL_EMPTY;
    if (!manualOverride) { pumpState = true; digitalWrite(PUMP_PIN, HIGH); }
  } else {
    waterLevel = LEVEL_NORMAL;
    // hysteresis: keep pump as-is in the middle band
  }
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
  display.setTextColor(SH110X_WHITE);
  display.setTextSize(1);

  // Header
  display.fillRect(0, 0, SCREEN_WIDTH, 10, SH110X_WHITE);
  display.setTextColor(SH110X_BLACK);
  display.setCursor(3, 1);
  display.print("VERDA AGRI TECH");
  display.setTextColor(SH110X_WHITE);

  // Two-column live sensor values
  display.setCursor(0, 14);
  display.print("pH:  "); display.print(pHValue, 2);
  display.setCursor(66, 14);
  display.print("T: "); display.print(temperature, 1); display.print("C");

  display.setCursor(0, 26);
  display.print("TDS: "); display.print((int)tdsValue); display.print("ppm");
  display.setCursor(66, 26);
  display.print("EC: "); display.print((int)ecValue);

  display.setCursor(0, 38);
  display.print("Water: ");
  if (distance < 0) display.print("SENSOR ERR");
  else { display.print(distance, 1); display.print(" cm"); }

  // Footer: actual pump state, control mode, and water-level condition
  display.drawFastHLine(0, 49, SCREEN_WIDTH, SH110X_WHITE);
  display.setCursor(0, 53);
  display.print("Pump:"); display.print(pumpState ? "ON " : "OFF");
  display.print(manualOverride ? " MAN" : " AUTO");
  display.setCursor(75, 53);
  switch (waterLevel) {
    case LEVEL_FULL:    display.print("FULL"); break;
    case LEVEL_EMPTY:   display.print("LOW");  break;
    case LEVEL_UNKNOWN: display.print("ERR");  break;
    default:            display.print("OK");   break;
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
  server.handleClient();
  handleSerialCommands();
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
