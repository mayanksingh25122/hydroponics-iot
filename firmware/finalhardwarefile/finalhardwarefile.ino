/*
  VERDA HYDROPONIC CONTROLLER - FINAL INTEGRATED FIRMWARE
  ======================================================

  This file is the reconciliation of two previously separate firmwares:

    (1) The VERDA IoT firmware that previously lived in this file -
        WiFi, authenticated telemetry, outbound command polling,
        safety-aware acknowledgement, and the dev/production TLS
        transport switch. Its NETWORK and COMMAND architecture is
        preserved here essentially unchanged.

    (2) Hydroponic_Controller_FINAL_EC.ino - the standalone firmware
        written against the ACTUAL final physical hardware. Its
        HARDWARE, SENSOR, DOSING, ALARM and DISPLAY architecture is
        authoritative here, because it describes the board that exists.

  Where the two disagreed, the physical hardware won. The single most
  important disagreement is documented under "PUMP SEMANTICS" below and
  is a genuine safety inversion - read it before changing anything.

  ------------------------------------------------------------------
  FINAL GPIO MAP (physical source of truth - do not reassign)
  ------------------------------------------------------------------
    GPIO4  -> DS18B20 DATA (4.7k pull-up to 3.3V required)
    GPIO5  -> HC-SR04 TRIG
    GPIO18 -> HC-SR04 ECHO, VIA 5V->3.3V DIVIDER
    GPIO19 -> Buzzer
    GPIO21 -> OLED SDA
    GPIO22 -> OLED SCL
    GPIO23 -> Relay 4 IN  (future Pump C - NOT INSTALLED)
    GPIO25 -> Relay 1 IN  (Nutrient Pump A, 12V)
    GPIO26 -> Relay 2 IN  (Nutrient Pump B, 12V)
    GPIO27 -> Relay 3 IN  (230V AC circulation pump)
    GPIO34 -> pH analog output      (input-only pin, ADC1)
    GPIO35 -> TDS/EC analog output  (input-only pin, ADC1)

  ------------------------------------------------------------------
  PUMP SEMANTICS - THE CRITICAL CHANGE FROM THE OLD VERDA FIRMWARE
  ------------------------------------------------------------------
  The old VERDA firmware controlled ONE pump on GPIO23 and treated it
  as a FILL pump:

      tank EMPTY -> pump ON   (refill)
      tank FULL  -> pump OFF  (stop, do not overflow)

  On the real hardware, GPIO23 is Relay 4 / future Pump C, and the
  remotely controllable pump is the 230V AC CIRCULATION pump on GPIO27.
  A circulation pump's safety rule is the exact OPPOSITE of a fill
  pump's:

      tank EMPTY   -> pump OFF  (dry-running destroys the pump)
      water present-> pump ON   (circulate)

  Carrying the old rule over verbatim would have run the circulation
  pump dry in an empty tank and stopped it when the tank was full. The
  safety gate below therefore refuses EMPTY and UNKNOWN, not FULL and
  UNKNOWN. The STRUCTURE of the old design (one authoritative writer,
  the gate running unconditionally for every caller, the real resulting
  state read back for the acknowledgement) is unchanged - only the
  condition it tests was corrected to match the physical actuator.

  ------------------------------------------------------------------
  CONTROL PRIORITY (highest first) - network is never above safety
  ------------------------------------------------------------------
    1. Electrical/physical safety   - relay idle states, Pump C lockout
    2. Local sensor validation      - NaN / no-echo / out-of-range
    3. Local automatic control      - water safety, dosing limits
    4. Network communication        - telemetry, polling
    5. Remote commands              - requests, never overrides

  Levels 1-3 run entirely on local sensor data and never consult WiFi,
  the backend, or any remote command. A remote command is a REQUEST;
  the local control layer decides whether it is allowed.

  ------------------------------------------------------------------
  LIBRARIES
  ------------------------------------------------------------------
    WiFi / HTTPClient / WiFiClientSecure   (arduino-esp32 core)
    ArduinoJson
    U8g2
    OneWire
    DallasTemperature
*/

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <U8g2lib.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <math.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>

// ======================================================
//  LAYER 0 - CONFIGURATION
// ======================================================

// ---------------- WiFi ----------------
const char* ssid     = "mayank";
const char* password = "";

// ---------------- Environment: development vs production transport ----------------
// ONE flag controls both which backend host this firmware targets AND
// which transport it uses to reach it - mirrors this file's existing
// DEBUG_SERIAL 0/1 toggle style below, for the same reason (immediately
// obvious which mode is active from a single grep, no risk of two
// contradictory flags being set at once).
//
//   1 = PRODUCTION MODE. HTTPS only, via WiFiClientSecure with
//       setCACert(ROOT_CA_CERT) - certificate validation enabled,
//       ZERO setInsecure(). Requires backendHost below (in the #if
//       branch for this mode) to be set to the real deployed backend
//       hostname before flashing (see B8's readiness audit: no
//       production hostname exists yet, so the placeholder there will
//       not resolve/connect until replaced).
//   0 = DEVELOPMENT MODE. Plain HTTP, no TLS client at all - not "HTTPS
//       with validation skipped", there is no TLS layer here to bypass,
//       so setInsecure() is neither used nor needed. Intended ONLY for
//       a trusted local/LAN test backend (backendHost below, in the
//       #else branch for this mode) during hardware bring-up/testing -
//       never point this mode at a backend reachable outside a trusted
//       local network. Existing backend authentication (X-API-Key)
//       still applies in both modes.
#define VERDA_USE_TLS 0

#if VERDA_USE_TLS
// NO scheme, NO trailing slash, NO path - just host[:port].
const char* backendHost = "REPLACE_WITH_YOUR_PRODUCTION_HOSTNAME";
const char* backendScheme = "https://";
#else
const char* backendHost = "10.51.96.87:8000";
const char* backendScheme = "http://";
#endif

// Every backend URL is derived from backendHost/backendScheme above, so
// there is exactly one place (the #if block) to update per mode instead
// of several that could drift out of sync. This part is identical
// regardless of VERDA_USE_TLS - only the scheme/host selection above
// differs between modes, everything else about how these URLs are used
// is shared, unconditional code (see the three request sites below).
const String serverUrl   = String(backendScheme) + String(backendHost) + "/sensor-data";
const String commandsUrl = String(backendScheme) + String(backendHost) + "/api/v1/devices/1/commands";

// Device credential for the backend's require_device_api_key dependency
// (backend/app/routers/sensor.py) - must match that server's
// BACKEND_API_KEY exactly, or every upload is rejected with 401.
// Replace this placeholder before flashing; never commit the real value.
const char* apiKey = "REPLACE_WITH_BACKEND_API_KEY";

// This device's id in the backend's devices table. Used in the
// telemetry payload; commandsUrl above embeds the same id in its path.
#define VERDA_DEVICE_ID 1

// ---------------- Debug ----------------
#define DEBUG_SERIAL 1   // set to 0 to silence printStatus()

// ---------------- Pins ----------------
constexpr uint8_t PIN_DS18B20   = 4;
constexpr uint8_t PIN_HCSR_TRIG = 5;
constexpr uint8_t PIN_HCSR_ECHO = 18;
constexpr uint8_t PIN_BUZZER    = 19;

constexpr uint8_t PIN_OLED_SDA  = 21;
constexpr uint8_t PIN_OLED_SCL  = 22;

constexpr uint8_t PIN_RELAY_C   = 23;  // Relay 4 - future Pump C (NOT installed)
constexpr uint8_t PIN_RELAY_A   = 25;  // Relay 1 - Nutrient Pump A
constexpr uint8_t PIN_RELAY_B   = 26;  // Relay 2 - Nutrient Pump B
constexpr uint8_t PIN_RELAY_AC  = 27;  // Relay 3 - 230V AC circulation pump

constexpr uint8_t PIN_PH        = 34;
constexpr uint8_t PIN_TDS       = 35;

// ---------------- Relay polarity ----------------
// !!! MUST BE VERIFIED DURING HARDWARE BRING-UP !!!
// Most (not all) ESP32 relay boards are active LOW. This value is a
// CONFIGURATION assumption inherited from the standalone hardware
// firmware, not a measured fact about the module actually fitted. If it
// is wrong, every relay in this system is inverted - including the
// 230V AC circulation pump and both nutrient pumps - which means the
// "safe" idle state written at boot would instead energize everything.
// Verify with the pumps physically disconnected before trusting any
// automatic or remote control. See writeRelayPin(), the single point
// where this value is applied.
constexpr bool RELAY_ACTIVE_LOW = true;

// ---------------- Pump C installation flag ----------------
// Relay 4 / GPIO23 is wired but no pump is fitted. While this is false,
// writeRelayPin() refuses to energize that relay at all - the lockout
// lives at the single write point rather than being re-checked by each
// caller, so no future call site can forget it.
constexpr bool PUMP_C_INSTALLED = false;

// ---------------- Automatic dosing gate (calibration safety) ----------------
// Every dosing constant below (pumpA/B_mL_per_sec, tdsRisePerML,
// PH_SLOPE/OFFSET, TDS_SLOPE/OFFSET, TDS_TO_EC_FACTOR, the TDS/pH
// limits) is an UNCALIBRATED placeholder - see their individual
// comments. Running automatic dosing against real pumps and a real
// nutrient reservoir before those values are measured would dose an
// unknown, unverified volume onto live plants. This flag exists so that
// CAN'T happen by accident: while false, doseNutrients() (LAYER 5)
// refuses to dose at all, on every single call, as its very first
// check, regardless of TDS reading. Every other subsystem - water
// safety, the circulation pump, sensors, telemetry, OLED, alarms - is
// completely unaffected and keeps running normally.
//
// HOW THE VERDA TEAM ENABLES AUTOMATIC DOSING AFTER CALIBRATION:
//   1. Measure pumpA_mL_per_sec / pumpB_mL_per_sec by running each pump
//      for a fixed time and weighing/measuring the dispensed volume.
//   2. Measure tdsRisePerML against the actual reservoir volume and
//      nutrient recipe.
//   3. Calibrate PH_SLOPE/PH_OFFSET and TDS_SLOPE/TDS_OFFSET against
//      the fitted probes using reference solutions.
//   4. Update those constants below with the measured values.
//   5. Change ONLY the line below to true - exactly how
//      PUMP_C_INSTALLED is flipped once Pump C is physically fitted, no
//      other code change required.
//   6. Recompile and reflash.
// Deliberately NOT remote- or serial-toggleable: enabling automatic
// nutrient dosing is a calibration sign-off, not a runtime setting.
// Keeping it a compile-time constant means it can never be flipped by a
// network command or a bench-testing serial command - the backend's
// command system has no dosing command type at all today (see LAYER 9),
// so there is no remote path to this flag to begin with.
constexpr bool AUTOMATIC_DOSING_ENABLED = false;

// ---------------- Water level limits ----------------
// HC-SR04 measures DISTANCE from the sensor down to the water surface,
// so a LARGER distance means LESS water.
constexpr float EMPTY_DISTANCE_CM           = 30.0f;  // > this -> tank empty
constexpr float VERY_HIGH_WATER_DISTANCE_CM = 3.0f;   // < this -> water very high

// ---------------- TDS / EC control ----------------
// CONFIGURABLE placeholders, not universal hydroponic values. The
// correct range depends entirely on crop, growth stage and nutrient
// recipe - calibrate before enabling automatic dosing on live plants.
constexpr float TDS_LOW_LIMIT_PPM  = 700.0f;
constexpr float TDS_HIGH_LIMIT_PPM = 1000.0f;

// Nutrient dosing ratio A:B:C. Current hardware has only A and B; C is
// included in the calculation only once PUMP_C_INSTALLED becomes true.
float nutrientRatioA = 2.0f;
float nutrientRatioB = 1.0f;
float nutrientRatioC = 1.0f;

// Dosing calibration: measured pump flow, mL per second.
float pumpA_mL_per_sec = 1.0f;
float pumpB_mL_per_sec = 1.0f;
float pumpC_mL_per_sec = 1.0f;

// TDS rise produced by 1 mL of total nutrient mixture. MUST be
// calibrated experimentally against the actual reservoir volume and
// nutrient recipe - the placeholder below is a guess, not a measurement.
float tdsRisePerML = 5.0f;

// Dosing safety limits.
constexpr float         MAX_DOSE_PER_CYCLE_ML = 10.0f;
constexpr unsigned long MAX_PUMP_RUNTIME_MS   = 15000UL;
constexpr unsigned long DOSE_COOLDOWN_MS      = 5UL * 60UL * 1000UL;
constexpr unsigned long MIX_TIME_MS           = 60UL * 1000UL;

// ---------------- pH alarm limits ----------------
// Configurable alarm thresholds, not universal crop values.
constexpr float PH_LOW_ALARM  = 5.0f;
constexpr float PH_HIGH_ALARM = 7.5f;

// ---------------- ADC calibration ----------------
// Starting values only. Replace after calibrating against the exact
// sensor modules fitted.
//    pH  = PH_SLOPE  * voltage + PH_OFFSET
//    TDS = TDS_SLOPE * voltage + TDS_OFFSET
float PH_SLOPE  = -5.70f;
float PH_OFFSET = 21.34f;

float TDS_SLOPE  = 500.0f;
float TDS_OFFSET = 0.0f;

// TDS-to-EC conversion. TDS (ppm) ~= EC (uS/cm) * factor. Common
// factors run 0.5 to 0.7 depending on the scale the module uses.
float TDS_TO_EC_FACTOR = 0.50f;

// ---------------- Timing ----------------
// Split deliberately: water level is a SAFETY input and is sampled
// fast, while the analog chemistry needs multi-sample averaging and is
// sampled slowly. The old VERDA firmware sampled everything at 100ms
// (too fast for averaged analog reads); the standalone hardware
// firmware sampled everything at 2000ms (too slow for a dry-run
// guard). Neither cadence was right for both jobs.
constexpr unsigned long WATER_INTERVAL_MS   = 250UL;   // ultrasonic + water safety + circulation policy
constexpr unsigned long CHEM_INTERVAL_MS    = 2000UL;  // pH + TDS/EC averaged reads
constexpr unsigned long DISPLAY_INTERVAL_MS = 500UL;
constexpr unsigned long TEMP_REQUEST_MS     = 2000UL;  // DS18B20 conversion kick-off
constexpr unsigned long TEMP_CONVERSION_MS  = 800UL;   // 12-bit conversion ~750ms, rounded up
constexpr unsigned long ULTRASONIC_TIMEOUT_US = 30000UL;

const unsigned long COMMAND_POLL_INTERVAL = 3000;   // ms between GET .../commands polls
const unsigned long UPLOAD_INTERVAL_MS    = 5000;   // ms between telemetry uploads (core 0)

// ---------------- TLS: pinned root CA (production mode only) ----------------
// In PRODUCTION MODE (VERDA_USE_TLS 1), every backend HTTP request goes
// through WiFiClientSecure with this root certificate (see
// configureSecureClient() below) - never through client.setInsecure().
// Unused in development mode, which has no TLS client at all - this
// constant is simply not referenced by any #else branch. Deliberately
// pins the ROOT CA that issues Render's TLS certificates (Let's
// Encrypt), not a specific leaf/host certificate: a leaf cert is host-
// and deployment-specific and rotates on Let's Encrypt's ~90-day
// renewal cycle, which would silently break this device every renewal
// until someone manually re-flashed a new fingerprint. The root is
// stable (valid until 2035, unaffected by backend redeploys or hostname
// changes), and validating against it still cryptographically verifies
// the full certificate chain - this is not weaker than leaf pinning,
// just far less operationally fragile.
//
// This is ISRG Root X1, Let's Encrypt's own root CA - a PUBLIC value,
// not a secret; safe to commit. VERIFIED against the canonical source
// (https://letsencrypt.org/certs/isrgrootx1.pem, fetched live and
// compared byte-for-byte during B7.1.1).
const char* ROOT_CA_CERT = R"EOF(
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
-----END CERTIFICATE-----
)EOF";

#if VERDA_USE_TLS
// Applies the pinned root CA to a freshly-constructed WiFiClientSecure,
// right before use. Called once per HTTP request (matching the existing
// per-call HTTPClient lifecycle below exactly) rather than sharing one
// WiFiClientSecure across calls, so there is no shared TLS state that
// could be corrupted by overlapping or back-to-back requests. Only
// exists in production mode - development mode has no TLS client to
// configure at all.
void configureSecureClient(WiFiClientSecure &client) {
  client.setCACert(ROOT_CA_CERT);
}
#endif

// ======================================================
//  HARDWARE OBJECTS
// ======================================================
OneWire oneWire(PIN_DS18B20);
DallasTemperature tempSensor(&oneWire);

// 1.3" I2C OLED modules are commonly SH1106. If the fitted panel turns
// out to be an SSD1306 (typical of 0.96" modules), change ONLY this
// constructor line to U8G2_SSD1306_128X64_NONAME_F_HW_I2C - the rest of
// the display layer is driver-independent. See the bring-up checklist.
U8G2_SH1106_128X64_NONAME_F_HW_I2C oled(U8G2_R0, U8X8_PIN_NONE);

// The OLED is a DIAGNOSTIC, not a dependency. If it fails to initialize
// the controller keeps running with full local safety - unlike the old
// VERDA firmware, which sat in `while (1);` forever if the display did
// not come up, taking every pump safety check down with it.
bool oledReady = false;

// ======================================================
//  MEASUREMENTS AND STATE
// ======================================================
float waterTempC      = NAN;   // NAN = sensor unavailable
float waterDistanceCm = NAN;   // NAN = no echo / out of range
float phValue         = NAN;
float tdsPpm          = NAN;
float ec_uScm         = NAN;

// Last DS18B20 reading that passed validation. The backend telemetry
// schema has no way to express "temperature sensor unavailable" (see
// the telemetry mapping notes in buildTelemetryJson), so the last known
// good value is what gets uploaded while the sensor is faulted.
float lastGoodTempC = 0.0f;

enum WaterState {
  WATER_EMPTY,
  WATER_NORMAL,
  WATER_VERY_HIGH,
  WATER_UNKNOWN
};
WaterState waterState = WATER_UNKNOWN;   // start pessimistic: nothing runs until measured

bool pHAlarm = false;

// The 230V AC circulation pump's current commanded state. Written ONLY
// by applyCirculationPumpDecision().
bool circulationPumpState = false;

// AUTO (false) vs MANUAL (true). In MANUAL the circulation pump holds
// whatever the last serial/remote command set it to; in AUTO the local
// policy drives it from the water state. Safety applies identically in
// both - see applyCirculationPumpDecision().
bool manualOverride = false;

bool dosingActive = false;

unsigned long lastWaterRead   = 0;
unsigned long lastChemRead    = 0;
unsigned long lastDisplayMs   = 0;
unsigned long lastTempRequest = 0;
unsigned long tempRequestTime = 0;
bool tempRequested = false;

unsigned long lastDoseMs = 0;

// ---------------- Alarm state machine ----------------
enum AlarmType {
  ALARM_NONE,
  ALARM_WATER_EMPTY,
  ALARM_WATER_HIGH,
  ALARM_PH
};
AlarmType activeAlarm = ALARM_NONE;

unsigned long buzzerStateMs = 0;
bool    buzzerOutput = false;   // instantaneous buzzer pin level
uint8_t buzzerStep   = 0;

// ======================================================
//  FORWARD DECLARATIONS
// ======================================================
void writeRelayPin(uint8_t pin, bool on);
void allRelaysOff();
void applyCirculationPumpDecision(bool requestedOn);
void updateCirculationPolicy();
bool waterAvailableForDosing();
void updateWaterState();
void updateBuzzer();
void publishSnapshot();
void readChemistry();
void doseNutrients();
void drawDisplay();
void printStatus();

void pollCommands();
void handleCommandResponse(const String &body);
void handleOneCommand(JsonObject cmd);
void processPendingCommands();

// ======================================================
//  CROSS-CORE HANDOFF STRUCTURES
// ======================================================
// Core 1 (loop) owns every sensor and every actuator. Core 0
// (uploadTask) owns every HTTP request. They exchange data ONLY through
// these mutex-protected structs - core 0 never touches a relay, and
// core 1 never opens a socket.

struct SensorSnapshot {
  float ph, tds, ec, temp, dist;
  bool  circulationPump;
  bool  alarmActive;
};
SensorSnapshot snapshot;
SemaphoreHandle_t dataMutex;

// Declared HERE, immediately after the struct, and not up with the other
// forward declarations: Arduino generates prototypes automatically for
// any function it does not already find declared, and inserts them just
// before the sketch's FIRST function definition. In production mode that
// first definition is configureSecureClient(), which sits above this
// struct - so an auto-generated prototype naming SensorSnapshot would
// land before SensorSnapshot exists and fail to compile in TLS mode
// only. Declaring it explicitly below the struct suppresses that.
// sendAckIfPending() is declared after PendingAck for the same reason.
String buildTelemetryJson(const SensorSnapshot &s);

// Core 0 (pollCommands/handleCommandResponse) discovers and STRICTLY
// VALIDATES a backend command, then only ever stores it here - it never
// calls applyCirculationPumpDecision() or touches manualOverride
// itself. Core 1 (processPendingCommands, called from loop) is the only
// code that drains these and acts on them, exclusively through the
// existing safety-arbited control path. pump_state and pump_mode are
// independent command types on the backend (each supersedes only its
// own kind), so they get two separate slots/ids here rather than one
// shared struct - a pending command of one kind is never blocked or
// overwritten by the other.
struct PendingBoolCommand {
  bool available;
  long id;
  bool value;
};
PendingBoolCommand pendingPumpState = { false, -1, false };
PendingBoolCommand pendingPumpMode  = { false, -1, false };   // value = requested manualOverride

// Duplicate-command protection: the backend keeps returning an active
// (pending/delivered) command on every poll until it is acknowledged.
// Read/written only by core 0, so no mutex is needed for these two.
long lastSeenPumpStateId = -1;
long lastSeenPumpModeId  = -1;

SemaphoreHandle_t commandMutex;

// Populated by processPendingCommands() (core 1) the moment a command's
// REAL outcome is known - strictly AFTER applyCirculationPumpDecision()
// has already run, or AFTER manualOverride has already been assigned,
// never before. Sent by sendPendingAcks() (core 0). Cleared only once
// the backend has actually confirmed receipt (HTTP 200) - a network
// failure must never cause the device to forget a result it already
// knows, and retrying only ever re-sends this same, already-computed
// report; it never re-runs the physical action.
struct PendingAck {
  bool available;
  long commandId;
  bool appliedValue;       // pump_state: the REAL resulting circulationPumpState (post-safety), never the raw request.
  bool wasSafetyRefused;
};
PendingAck ackPumpState = { false, -1, false, false };
PendingAck ackPumpMode  = { false, -1, false, false };   // wasSafetyRefused always false - mode switching has no safety gate

unsigned long lastCommandPoll = 0;

void sendPendingAcks();
void sendAckIfPending(PendingAck &ack, bool isPumpState);

// ======================================================
//  LAYER 1 - RELAY / ACTUATOR ABSTRACTION
// ======================================================
// THE ONLY function in this sketch permitted to call digitalWrite() on
// a relay pin. Every actuator decision - automatic, serial, or remote -
// funnels through here, so relay polarity and the Pump C lockout are
// each defined in exactly one place and cannot be forgotten by a caller.
void writeRelayPin(uint8_t pin, bool on) {
  // Pump C lockout. Relay 4 is wired but no pump is fitted; energizing
  // it would drive an unloaded relay for no reason and, once a pump IS
  // fitted, would dose an uncalibrated nutrient. Enforced here rather
  // than at each call site so it holds for every present and future
  // caller.
  if (pin == PIN_RELAY_C && !PUMP_C_INSTALLED) {
    on = false;
  }

  const uint8_t activeLevel   = RELAY_ACTIVE_LOW ? LOW  : HIGH;
  const uint8_t inactiveLevel = RELAY_ACTIVE_LOW ? HIGH : LOW;
  digitalWrite(pin, on ? activeLevel : inactiveLevel);
}

// Drives every relay - including Relay 4 - to its inactive level.
// Relay 4 is included deliberately: the standalone hardware firmware
// skipped it whenever PUMP_C_INSTALLED was false, which left GPIO23
// sitting at the ESP32's default LOW output level. With
// RELAY_ACTIVE_LOW that is the ACTIVE level, so the "not installed"
// relay was actually being energized at boot.
void allRelaysOff() {
  writeRelayPin(PIN_RELAY_A,  false);
  writeRelayPin(PIN_RELAY_B,  false);
  writeRelayPin(PIN_RELAY_AC, false);
  writeRelayPin(PIN_RELAY_C,  false);
  circulationPumpState = false;
}

// ======================================================
//  LAYER 2 - SENSORS
// ======================================================
void updateTemperature(unsigned long now) {
  // Asynchronous DS18B20: kick off a conversion, come back for the
  // result later. Never blocks the loop, so a slow or missing
  // temperature sensor cannot delay the water-level safety check.
  if (!tempRequested && (now - lastTempRequest >= TEMP_REQUEST_MS)) {
    tempSensor.requestTemperatures();
    tempRequested   = true;
    tempRequestTime = now;
    lastTempRequest = now;
  }

  if (tempRequested && (now - tempRequestTime >= TEMP_CONVERSION_MS)) {
    const float t = tempSensor.getTempCByIndex(0);

    if (t == DEVICE_DISCONNECTED_C || t < -20.0f || t > 100.0f) {
      waterTempC = NAN;
    } else {
      waterTempC    = t;
      lastGoodTempC = t;
    }

    tempRequested = false;
  }
}

float readWaterDistanceCm() {
  digitalWrite(PIN_HCSR_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_HCSR_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_HCSR_TRIG, LOW);

  const unsigned long duration = pulseIn(PIN_HCSR_ECHO, HIGH, ULTRASONIC_TIMEOUT_US);

  if (duration == 0) {
    return NAN;   // no echo - treated as WATER_UNKNOWN, never as "empty" or "full"
  }

  return duration * 0.0343f / 2.0f;
}

float readAverageVoltage(uint8_t pin, uint16_t samples = 20) {
  uint64_t sumMv = 0;

  for (uint16_t i = 0; i < samples; i++) {
    sumMv += analogReadMilliVolts(pin);
    delay(2);
  }

  return (sumMv / static_cast<float>(samples)) / 1000.0f;
}

void readChemistry() {
  const float phVolts = readAverageVoltage(PIN_PH);
  float ph = PH_SLOPE * phVolts + PH_OFFSET;

  // Clamp to the physically meaningful range. The backend's SensorData
  // schema rejects anything outside [0.0, 14.0] with a 422, so an
  // uncalibrated slope/offset producing an out-of-range value would
  // otherwise silently break every telemetry upload.
  if (ph < 0.0f)  ph = 0.0f;
  if (ph > 14.0f) ph = 14.0f;
  phValue = ph;

  const float tdsVolts = readAverageVoltage(PIN_TDS);
  float tds = TDS_SLOPE * tdsVolts + TDS_OFFSET;
  if (tds < 0.0f) tds = 0.0f;
  tdsPpm = tds;

  if (TDS_TO_EC_FACTOR > 0.0f) {
    ec_uScm = tdsPpm / TDS_TO_EC_FACTOR;
  } else {
    ec_uScm = NAN;
  }

  pHAlarm = !isnan(phValue) && (phValue < PH_LOW_ALARM || phValue > PH_HIGH_ALARM);
}

// ======================================================
//  LAYER 3 - WATER SAFETY
// ======================================================
void updateWaterState() {
  if (isnan(waterDistanceCm)) {
    waterState = WATER_UNKNOWN;
    return;
  }

  if (waterDistanceCm > EMPTY_DISTANCE_CM) {
    waterState = WATER_EMPTY;
  } else if (waterDistanceCm < VERY_HIGH_WATER_DISTANCE_CM) {
    waterState = WATER_VERY_HIGH;
  } else {
    waterState = WATER_NORMAL;
  }
}

// Water must be positively confirmed present. WATER_UNKNOWN is NOT
// treated as "probably fine" - a missing echo means the level is not
// known, and nothing that needs water is allowed to run.
bool waterAvailableForDosing() {
  return waterState == WATER_NORMAL || waterState == WATER_VERY_HIGH;
}

// ======================================================
//  LAYER 4 - CIRCULATION PUMP: SINGLE AUTHORITATIVE WRITER
// ======================================================
// The only function that assigns circulationPumpState or drives
// PIN_RELAY_AC. Every path that can change the circulation pump -
// startup, automatic policy, serial command, remote command, dosing
// mixer - goes through here, so the safety gate is enforced identically
// no matter who is asking.
//
// Safety precedence (highest first), re-evaluated against the CURRENT
// water state on every single request:
//   A. WATER_UNKNOWN - the level is not known (no echo / sensor fault).
//      Never run blind: force OFF. Overrides AUTO and MANUAL alike.
//   B. WATER_EMPTY   - no water to circulate. Running a circulation
//      pump dry damages it: force OFF. Overrides AUTO and MANUAL alike,
//      and overrides any remote command.
//   C. Otherwise honor the request - the caller (automatic policy, a
//      serial command, or a remote command) has already made that
//      decision.
//
// NOTE the inversion relative to the old VERDA firmware, which forced
// OFF on FULL and ran ON when EMPTY because it drove a FILL pump. See
// the PUMP SEMANTICS block at the top of this file.
void applyCirculationPumpDecision(bool requestedOn) {
  bool allowedOn = requestedOn;

  if (waterState == WATER_UNKNOWN || waterState == WATER_EMPTY) {
    allowedOn = false;
  }

  circulationPumpState = allowedOn;
  writeRelayPin(PIN_RELAY_AC, allowedOn);
}

// The automatic circulation policy, evaluated on every water-sampling
// tick. Runs entirely on local sensor data - it never consults WiFi,
// the backend, or any remote command.
void updateCirculationPolicy() {
  // Safety re-asserts OFF on every tick while the tank is unsafe, in
  // BOTH modes. This also self-heals a stale manual/remote ON the
  // instant the tank runs dry or the sensor drops out, without waiting
  // for a new command to arrive.
  if (waterState == WATER_UNKNOWN || waterState == WATER_EMPTY) {
    applyCirculationPumpDecision(false);
    return;
  }

  // MANUAL: hold exactly what the last serial/remote command set.
  if (manualOverride) {
    return;
  }

  // AUTO: circulate whenever water is present (NORMAL or VERY_HIGH).
  applyCirculationPumpDecision(true);
}

// Nutrient dosing pumps. Separate writer from the circulation pump
// because they carry a different safety gate: a dosing pump must never
// run into a tank whose water is absent or unverified, or the nutrient
// goes onto dry plastic and the dose is unrecoverable.
void writeDosingPump(uint8_t pin, bool on) {
  if (on && !waterAvailableForDosing()) {
    on = false;
  }
  writeRelayPin(pin, on);
}

// ======================================================
//  LAYER 5 - DOSING
// ======================================================
// Keeps the safety-critical work alive during a blocking dose/mix wait:
// re-measures the water level, re-evaluates the water state, refreshes
// the alarm output, and republishes the telemetry snapshot so core 0
// keeps uploading live data. Returns false the moment the tank stops
// being safe, so every caller can abort immediately.
bool doseWaitTick() {
  waterDistanceCm = readWaterDistanceCm();
  updateWaterState();
  updateBuzzer();
  publishSnapshot();
  return waterAvailableForDosing();
}

void runDosingPumpForMl(uint8_t relayPin, float ml, float flowMlPerSec) {
  if (ml <= 0.0f || flowMlPerSec <= 0.0f) return;
  if (!waterAvailableForDosing())         return;

  unsigned long runtime =
      static_cast<unsigned long>((ml / flowMlPerSec) * 1000.0f);

  // Hard runtime ceiling: even a wildly wrong flow calibration or dose
  // calculation can never run a nutrient pump longer than this.
  if (runtime > MAX_PUMP_RUNTIME_MS) {
    runtime = MAX_PUMP_RUNTIME_MS;
  }

  writeDosingPump(relayPin, true);

  const unsigned long start = millis();
  while (millis() - start < runtime) {
    if (!doseWaitTick()) break;   // tank went empty/unknown mid-dose - stop now
    delay(20);
  }

  writeDosingPump(relayPin, false);
}

void runCirculationForMixing() {
  // Routed through the safety gate like every other circulation
  // request - the mixer gets no privileged access to the relay.
  applyCirculationPumpDecision(true);

  const unsigned long start = millis();
  while (millis() - start < MIX_TIME_MS) {
    if (!doseWaitTick()) break;
    applyCirculationPumpDecision(true);   // re-assert under the current water state
    delay(50);
  }

  // Hand the pump back to whatever the normal policy wants, rather than
  // forcing it off - in AUTO with water present the policy wants it ON,
  // and an unconditional OFF here would just be undone on the next tick.
  updateCirculationPolicy();
}

void doseNutrients() {
  if (!AUTOMATIC_DOSING_ENABLED) return;   // calibration gate - see LAYER 0 config
  if (dosingActive) return;

  // Every guard below is a refusal to dose. None of them can be
  // bypassed by a remote command, because no remote command reaches
  // this function at all - see LAYER 9.
  if (!waterAvailableForDosing()) return;   // empty or unknown water level
  if (isnan(tdsPpm))              return;   // no valid TDS reading

  // Only dose BELOW the lower limit. Above the upper limit nothing is
  // added - this firmware has no way to dilute, so over-concentration
  // is a report-only condition.
  if (tdsPpm >= TDS_LOW_LIMIT_PPM) return;

  if (lastDoseMs != 0 && millis() - lastDoseMs < DOSE_COOLDOWN_MS) return;
  if (tdsRisePerML <= 0.0f) return;

  float requiredMl = (TDS_LOW_LIMIT_PPM - tdsPpm) / tdsRisePerML;

  if (requiredMl > MAX_DOSE_PER_CYCLE_ML) requiredMl = MAX_DOSE_PER_CYCLE_ML;
  if (requiredMl < 0.2f) return;   // too small to dose accurately

  const float activeRatioC = PUMP_C_INSTALLED ? nutrientRatioC : 0.0f;
  const float ratioSum = nutrientRatioA + nutrientRatioB + activeRatioC;
  if (ratioSum <= 0.0f) return;

  const float doseA = requiredMl * nutrientRatioA / ratioSum;
  const float doseB = requiredMl * nutrientRatioB / ratioSum;
  const float doseC = requiredMl * activeRatioC   / ratioSum;

  dosingActive = true;

  Serial.println(F("\n=== NUTRIENT DOSING ==="));
  Serial.printf("TDS before : %.1f ppm\n", tdsPpm);
  Serial.printf("Total dose : %.2f mL\n", requiredMl);
  Serial.printf("Pump A     : %.2f mL\n", doseA);
  Serial.printf("Pump B     : %.2f mL\n", doseB);

  runDosingPumpForMl(PIN_RELAY_A, doseA, pumpA_mL_per_sec);
  delay(500);
  runDosingPumpForMl(PIN_RELAY_B, doseB, pumpB_mL_per_sec);

  if (PUMP_C_INSTALLED) {
    delay(500);
    runDosingPumpForMl(PIN_RELAY_C, doseC, pumpC_mL_per_sec);
  }

  // Cooldown starts as soon as nutrient has been delivered, so a dose
  // is rate-limited even if the mixing stage aborts early.
  lastDoseMs = millis();

  runCirculationForMixing();

  readChemistry();
  Serial.printf("TDS after mixing: %.1f ppm\n", tdsPpm);

  dosingActive = false;
}

// ======================================================
//  LAYER 6 - ALARMS / BUZZER
// ======================================================
void updateBuzzer() {
  AlarmType requested = ALARM_NONE;

  // Priority: empty tank, then very high water, then pH.
  if (waterState == WATER_EMPTY) {
    requested = ALARM_WATER_EMPTY;
  } else if (waterState == WATER_VERY_HIGH) {
    requested = ALARM_WATER_HIGH;
  } else if (pHAlarm) {
    requested = ALARM_PH;
  }

  if (requested != activeAlarm) {
    activeAlarm   = requested;
    buzzerStep    = 0;
    buzzerStateMs = millis();
    buzzerOutput  = false;
    digitalWrite(PIN_BUZZER, LOW);
  }

  const unsigned long now = millis();

  switch (activeAlarm) {
    case ALARM_NONE:
      if (buzzerOutput) {
        buzzerOutput = false;
        digitalWrite(PIN_BUZZER, LOW);
      }
      break;

    case ALARM_WATER_EMPTY:
      // Continuous tone.
      if (!buzzerOutput) {
        buzzerOutput = true;
        digitalWrite(PIN_BUZZER, HIGH);
      }
      break;

    case ALARM_WATER_HIGH:
      // Repeating short beep: 150ms on, 850ms off.
      if (buzzerOutput) {
        if (now - buzzerStateMs >= 150) {
          buzzerOutput = false;
          digitalWrite(PIN_BUZZER, LOW);
          buzzerStateMs = now;
        }
      } else {
        if (now - buzzerStateMs >= 850) {
          buzzerOutput = true;
          digitalWrite(PIN_BUZZER, HIGH);
          buzzerStateMs = now;
        }
      }
      break;

    case ALARM_PH: {
      // Pattern: short, pause, long, pause - repeated.
      static const unsigned long durations[] = { 150, 350, 500, 600 };
      static const bool          levels[]    = { true, false, true, false };

      if (now - buzzerStateMs >= durations[buzzerStep]) {
        buzzerStep    = (buzzerStep + 1) % 4;
        buzzerStateMs = now;
      }

      const bool level = levels[buzzerStep];
      if (level != buzzerOutput) {
        buzzerOutput = level;
        digitalWrite(PIN_BUZZER, level ? HIGH : LOW);
      }
      break;
    }
  }
}

// ======================================================
//  LAYER 7 - DISPLAY
// ======================================================
const char* waterStateLabel() {
  switch (waterState) {
    case WATER_EMPTY:     return "EMPTY";
    case WATER_VERY_HIGH: return "HIGH";
    case WATER_NORMAL:    return "OK";
    default:              return "ERR";
  }
}

const char* statusLine() {
  if (waterState == WATER_EMPTY)     return "EMPTY - AC OFF";
  if (waterState == WATER_UNKNOWN)   return "LEVEL SENSOR ERR";
  if (waterState == WATER_VERY_HIGH) return "HIGH WATER";
  if (dosingActive)                  return "DOSING";
  if (pHAlarm)                       return "pH ALARM";
  if (!isnan(tdsPpm) && tdsPpm < TDS_LOW_LIMIT_PPM)  return "TDS LOW";
  if (!isnan(tdsPpm) && tdsPpm > TDS_HIGH_LIMIT_PPM) return "TDS HIGH";
  return "NORMAL";
}

void drawDisplay() {
  if (!oledReady) return;

  oled.clearBuffer();
  oled.setFont(u8g2_font_5x8_tf);

  char line[32];

  snprintf(line, sizeof(line), "TDS : %.0f ppm", tdsPpm);
  oled.drawStr(0, 8, line);

  snprintf(line, sizeof(line), "EC  : %.0f uS/cm", ec_uScm);
  oled.drawStr(0, 17, line);

  snprintf(line, sizeof(line), "pH  : %.2f", phValue);
  oled.drawStr(0, 26, line);

  snprintf(line, sizeof(line), "Temp: %.1f C", waterTempC);
  oled.drawStr(0, 35, line);

  snprintf(line, sizeof(line), "Lvl : %.1f cm %s",
           waterDistanceCm, waterStateLabel());
  oled.drawStr(0, 44, line);

  snprintf(line, sizeof(line), "AC:%s %s %s",
           circulationPumpState ? "ON " : "OFF",
           manualOverride ? "MAN" : "AUT",
           WiFi.status() == WL_CONNECTED ? "NET" : "---");
  oled.drawStr(0, 53, line);

  oled.drawStr(0, 62, statusLine());
  oled.sendBuffer();
}

// ======================================================
//  SERIAL STATUS
// ======================================================
#if DEBUG_SERIAL
void printStatus() {
  Serial.println(F("\n--- VERDA HYDROPONIC STATUS ---"));
  Serial.printf("Water distance : %.2f cm\n", waterDistanceCm);
  Serial.printf("Water state    : %s\n", waterStateLabel());
  Serial.printf("Temperature    : %.2f C\n", waterTempC);
  Serial.printf("pH             : %.2f\n", phValue);
  Serial.printf("TDS            : %.1f ppm\n", tdsPpm);
  Serial.printf("EC             : %.0f uS/cm\n", ec_uScm);
  Serial.printf("TDS range      : %.1f - %.1f ppm\n",
                TDS_LOW_LIMIT_PPM, TDS_HIGH_LIMIT_PPM);
  Serial.printf("AC circ. pump  : %s (%s)\n",
                circulationPumpState ? "ON" : "OFF",
                manualOverride ? "MANUAL" : "AUTO");
  Serial.printf("Dosing active  : %s\n", dosingActive ? "YES" : "NO");
  Serial.printf("Auto dosing    : %s\n",
                AUTOMATIC_DOSING_ENABLED ? "ENABLED" : "DISABLED (calibration mode)");
  Serial.printf("Pump C fitted  : %s\n", PUMP_C_INSTALLED ? "YES" : "NO");
  Serial.printf("pH alarm       : %s\n", pHAlarm ? "YES" : "NO");
  Serial.printf("WiFi           : %s\n",
                WiFi.status() == WL_CONNECTED ? "connected" : "disconnected");
}
#endif

// ======================================================
//  SERIAL COMMANDS (bench testing)
// ======================================================
// PUMP_ON / PUMP_OFF / PUMP_AUTO refer to the 230V AC CIRCULATION pump
// - the same actuator the backend's pump_state/pump_mode commands map
// onto. The nutrient dosing pumps are deliberately NOT exposed here:
// running a peristaltic dosing pump by hand for an arbitrary duration
// bypasses every dose limit and cooldown in LAYER 5.
void handleSerialCommands() {
  if (!Serial.available()) return;

  String cmd = Serial.readStringUntil('\n');
  cmd.trim();
  cmd.toUpperCase();

  if (cmd == "PUMP_ON") {
    manualOverride = true;
    applyCirculationPumpDecision(true);
    if (circulationPumpState) {
      Serial.println(F(">> Manual override: circulation pump ON"));
    } else {
      Serial.println(F(">> Manual override: ON REFUSED (safety: tank empty or level unknown)"));
    }
  } else if (cmd == "PUMP_OFF") {
    manualOverride = true;
    applyCirculationPumpDecision(false);
    Serial.println(F(">> Manual override: circulation pump OFF"));
  } else if (cmd == "PUMP_AUTO") {
    manualOverride = false;
    Serial.println(F(">> Back to AUTOMATIC water-level control"));
  } else if (cmd.length() > 0) {
    Serial.println(F(">> Unknown command. Use PUMP_ON / PUMP_OFF / PUMP_AUTO"));
  }
}

// ======================================================
//  LAYER 8 - NETWORK
// ======================================================
void connectWiFi() {
  WiFi.disconnect(true, true);
  delay(1000);

  WiFi.mode(WIFI_STA);
  delay(500);

  Serial.println(F("Connecting to WiFi..."));
  WiFi.begin(ssid, password);

  const unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    Serial.print('.');
    delay(500);
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print(F("Connected. ESP32 IP: "));
    Serial.println(WiFi.localIP());
  } else {
    Serial.print(F("WiFi failed, status = "));
    Serial.println(WiFi.status());
    Serial.println(F("Continuing in LOCAL-ONLY mode - all local safety remains active."));
  }
}

// ---------------- WiFi reconnection (core 0 only - never blocks core 1) ----------------
// setup()'s connectWiFi() above performs the ONE-TIME initial connection
// attempt, with its blocking 20s wait, before loop() ever starts - that
// startup delay is unchanged and accepted (see setup()'s LEVEL 4
// comment). maintainWiFi() instead handles WiFi dropping AFTER startup,
// called only from within uploadTask() on core 0. It is NOT a blocking
// retry: WiFi.begin() is asynchronous - the ESP32 WiFi stack connects in
// the background and this call returns immediately - and this function
// runs once per uploadTask iteration rather than looping until
// connected, so it never adds any wait beyond what already exists
// between iterations. Core 1 (loop - sensors, water safety, circulation
// pump, buzzer, OLED) is architecturally isolated from core 0 by design
// (see the CROSS-CORE HANDOFF STRUCTURES note above) and is completely
// unaffected by how long WiFi takes to come back, or whether it comes
// back at all.
unsigned long lastWifiAttempt = 0;
const unsigned long WIFI_RETRY_INTERVAL_MS = 15000;   // cooldown between attempts - avoids spamming WiFi.begin()

void maintainWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  const unsigned long now = millis();
  if (now - lastWifiAttempt < WIFI_RETRY_INTERVAL_MS) return;   // still cooling down since the last attempt
  lastWifiAttempt = now;

  Serial.println(F("WiFi reconnect attempt..."));
  WiFi.disconnect();           // clears any half-open state from the previous attempt
  WiFi.begin(ssid, password);  // asynchronous - returns immediately, connects in the background

  // No wait here. The next uploadTask iteration (UPLOAD_INTERVAL_MS
  // later) checks WiFi.status() again - if it now reports WL_CONNECTED,
  // telemetry upload and command polling resume on that very same
  // iteration with no further code needed, since both already run
  // inside uploadTask's existing "if (WiFi.status() == WL_CONNECTED)"
  // block below.
}

void publishSnapshot() {
  if (xSemaphoreTake(dataMutex, 0) == pdTRUE) {
    snapshot.ph              = phValue;
    snapshot.tds             = tdsPpm;
    snapshot.ec              = ec_uScm;
    snapshot.temp            = lastGoodTempC;
    snapshot.dist            = waterDistanceCm;
    snapshot.circulationPump = circulationPumpState;
    snapshot.alarmActive     = (activeAlarm != ALARM_NONE);
    xSemaphoreGive(dataMutex);
  }
}

// ======================================================
//  LAYER 10 - TELEMETRY
// ======================================================
// Replaces a non-finite reading with `fallback`. The backend's
// SensorData schema sets allow_inf_nan=False on every numeric field, so
// a NaN would be rejected with a 422 and the whole upload lost - taking
// the fields that WERE valid down with it.
float telemetrySafe(float v, float fallback) {
  return (isnan(v) || isinf(v)) ? fallback : v;
}

// Builds the exact eight-field payload backend/app/schema/sensor.py
// requires. Field mapping and its known limits:
//
//   ph                -> clamped [0,14] in readChemistry(). Fallback 0.0
//                        is deliberately an obviously-wrong value: the
//                        schema has no "sensor invalid" representation,
//                        and a fault that looks like a fault is far
//                        safer than one that reads as a healthy 7.0.
//   tds / ec          -> as measured; 0.0 fallback.
//   water_temperature -> lastGoodTempC. The schema cannot express
//                        "temperature sensor unavailable", so a faulted
//                        DS18B20 uploads the last valid reading.
//   water_level       -> distance in cm, or -1.0, which is the schema's
//                        own documented sentinel for "no echo / out of
//                        range" (water_level is bounded ge=-1.0).
//   pump_status       -> the AC CIRCULATION pump only. The schema has a
//                        single boolean and this hardware has four
//                        relays; nutrient pumps A/B and the reserved
//                        Pump C are NOT representable.
//   buzzer_status     -> "an audible alarm is active", not the
//                        instantaneous pin level. Two of the three
//                        alarm patterns are pulsed, so sampling the pin
//                        would report false most of the time during a
//                        real alarm.
//
// Not representable at all in the current schema: the water state enum,
// per-pump relay states, dosing activity, and the pH/TDS alarm flags.
String buildTelemetryJson(const SensorSnapshot &s) {
  float level = telemetrySafe(s.dist, -1.0f);
  if (level < 0.0f) level = -1.0f;

  String json = "{";
  json += "\"device_id\":" + String(VERDA_DEVICE_ID) + ",";
  json += "\"ph\":"                + String(telemetrySafe(s.ph,   0.0f), 2) + ",";
  json += "\"tds\":"               + String(telemetrySafe(s.tds,  0.0f), 2) + ",";
  json += "\"ec\":"                + String(telemetrySafe(s.ec,   0.0f), 2) + ",";
  json += "\"water_temperature\":" + String(telemetrySafe(s.temp, 0.0f), 2) + ",";
  json += "\"water_level\":"       + String(level, 2) + ",";
  json += "\"pump_status\":"       + String(s.circulationPump ? "true" : "false") + ",";
  json += "\"buzzer_status\":"     + String(s.alarmActive ? "true" : "false");
  json += "}";
  return json;
}

// ======================================================
//  UPLOAD TASK (core 0) - the ONLY place HTTP happens
// ======================================================
void uploadTask(void *param) {
  for (;;) {
    maintainWiFi();

    if (WiFi.status() == WL_CONNECTED) {

      SensorSnapshot local;
      if (xSemaphoreTake(dataMutex, portMAX_DELAY) == pdTRUE) {
        local = snapshot;
        xSemaphoreGive(dataMutex);
      }

      // Transport selection only - everything else about this request
      // (headers, JSON, response handling below) is identical in both
      // modes. See "Environment: development vs production transport".
#if VERDA_USE_TLS
      WiFiClientSecure client;
      configureSecureClient(client);
      HTTPClient http;
      http.begin(client, serverUrl);
#else
      HTTPClient http;
      http.begin(serverUrl);
#endif
      http.addHeader("Content-Type", "application/json");
      http.addHeader("X-API-Key", apiKey);
      http.setTimeout(3000);

      const String json = buildTelemetryJson(local);
      const int code = http.POST(json);

      if (code == 200) {
        Serial.println(F("Telemetry uploaded"));
      } else if (code == 401) {
        Serial.println(F("Telemetry rejected: authentication failed"));
      } else if (code == 422) {
        Serial.println(F("Telemetry rejected: payload failed backend validation"));
        Serial.println(json);
      } else if (code > 0) {
        Serial.print(F("Telemetry HTTP "));
        Serial.println(code);
      } else {
        Serial.print(F("Telemetry network error: "));
        Serial.println(http.errorToString(code));
      }

      http.end();

      pollCommands();
      sendPendingAcks();
    } else {
      Serial.println(F("WiFi disconnected - local control continues"));
    }

    vTaskDelay(pdMS_TO_TICKS(UPLOAD_INTERVAL_MS));
  }
}

// ======================================================
//  LAYER 9 - COMMANDS
// ======================================================
// GET .../commands, validate the response strictly, and hand any
// accepted command off to processPendingCommands() (core 1) via the
// pendingPumpState/pendingPumpMode structs. This function itself never
// calls applyCirculationPumpDecision() and never touches
// manualOverride or any relay pin.
void pollCommands() {
  const unsigned long now = millis();
  if (now - lastCommandPoll < COMMAND_POLL_INTERVAL) return;
  lastCommandPoll = now;

  // Transport selection only - see the telemetry request above.
#if VERDA_USE_TLS
  WiFiClientSecure client;
  configureSecureClient(client);
  HTTPClient http;
  http.begin(client, commandsUrl);
#else
  HTTPClient http;
  http.begin(commandsUrl);
#endif
  http.addHeader("X-API-Key", apiKey);
  http.setTimeout(3000);

  const int code = http.GET();

  if (code == 200) {
    handleCommandResponse(http.getString());
  } else if (code == 401) {
    Serial.println(F("Command polling authentication failed"));
  } else if (code > 0) {
    Serial.print(F("Command polling failed, HTTP "));
    Serial.println(code);
  } else {
    Serial.print(F("Command polling error: "));
    Serial.println(http.errorToString(code));
  }

  http.end();
}

// Parses {"commands":[...]} and validates each entry. An empty array is
// the normal "nothing pending" case and is deliberately not logged.
void handleCommandResponse(const String &body) {
  DynamicJsonDocument doc(1024);
  const DeserializationError err = deserializeJson(doc, body);

  if (err) {
    Serial.print(F("Command polling: malformed JSON ("));
    Serial.print(err.c_str());
    Serial.println(')');
    return;
  }

  JsonArray commands = doc["commands"].as<JsonArray>();
  if (commands.isNull()) {
    Serial.println(F("Command polling: malformed response (missing commands array)"));
    return;
  }

  for (JsonVariant v : commands) {
    handleOneCommand(v.as<JsonObject>());
  }
}

// Strict per-command validation. Any check that fails rejects just this
// one command safely - it never reaches pendingPumpState/pendingPumpMode,
// so it can never influence an actuator.
//
// The backend currently defines exactly two command types
// (backend/app/services/command_service.py): pump_state and pump_mode.
// Both are single booleans with no way to address a specific pump, so
// pump_state maps onto the AC CIRCULATION pump and nothing else. Any
// other command_type - including a future per-pump or dosing command -
// falls through to the rejection branch below rather than being guessed
// at.
void handleOneCommand(JsonObject cmd) {
  if (!cmd["id"].is<long>()) {
    Serial.println(F("Command rejected: missing/invalid id"));
    return;
  }
  const long id = cmd["id"];

  const char* type = cmd["command_type"].as<const char*>();
  if (type == nullptr) {
    Serial.println(F("Command rejected: missing command_type"));
    return;
  }
  const String commandType(type);

  if (commandType == "pump_state") {
    if (id == lastSeenPumpStateId) return;   // duplicate - already handled

    // An earlier pump_state command hasn't finished its own lifecycle
    // yet (not applied, or applied but its ACK not confirmed
    // delivered). Don't accept a new one on top of it, or a still-unsent
    // ACK could be silently overwritten and lost. Deliberately does NOT
    // update lastSeenPumpStateId, so this exact id is re-evaluated on a
    // later poll once the outstanding one clears - the backend's
    // at-least-once delivery guarantees it keeps being offered.
    bool inFlight = false;
    if (xSemaphoreTake(commandMutex, portMAX_DELAY) == pdTRUE) {
      inFlight = pendingPumpState.available || ackPumpState.available;
      xSemaphoreGive(commandMutex);
    }
    if (inFlight) return;

    lastSeenPumpStateId = id;

    if (!cmd["requested_pump_state"].is<bool>()) {
      Serial.println(F("Command rejected: invalid payload for pump_state"));
      return;
    }
    const bool value = cmd["requested_pump_state"].as<bool>();

    if (xSemaphoreTake(commandMutex, portMAX_DELAY) == pdTRUE) {
      pendingPumpState.available = true;
      pendingPumpState.id        = id;
      pendingPumpState.value     = value;
      xSemaphoreGive(commandMutex);
    }
    Serial.println(F("Command received: pump_state"));

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
      Serial.println(F("Command rejected: invalid payload for pump_mode"));
      return;
    }
    const bool value = cmd["requested_manual_override"].as<bool>();

    if (xSemaphoreTake(commandMutex, portMAX_DELAY) == pdTRUE) {
      pendingPumpMode.available = true;
      pendingPumpMode.id        = id;
      pendingPumpMode.value     = value;
      xSemaphoreGive(commandMutex);
    }
    Serial.println(F("Command received: pump_mode"));

  } else {
    Serial.print(F("Command rejected: unknown type '"));
    Serial.print(commandType);
    Serial.println('\'');
  }
}

// ======================================================
//  COMMAND RECEPTION (core 1, every loop pass)
// ======================================================
// Drains whatever pollCommands() (core 0) validated and stored, and
// routes it through the EXISTING control architecture only:
//   - pump_state calls applyCirculationPumpDecision() - the single
//     authoritative writer, whose WATER_UNKNOWN / WATER_EMPTY gate
//     still runs unconditionally and is NOT bypassed or duplicated here.
//   - pump_mode only ever assigns manualOverride, exactly like the
//     PUMP_AUTO serial command already does.
// Never writes a relay pin directly.
//
// REMOTE pump_state SEMANTICS. backend/app/routers/device.py::set_pump
// queues a pump_state command unconditionally - there is no
// manualOverride check there, and the frontend's MANUAL-mode gating is a
// UI convenience, not an enforced contract. A remote pump_state is
// therefore an unconditional "set the circulation pump now" request,
// safety-gated exactly like a serial PUMP_ON/PUMP_OFF, but - unlike the
// serial handler - it never itself changes manualOverride. Effect of a
// remote ON by current (mode, water state) at the moment it is applied:
//
//   WATER_UNKNOWN / WATER_EMPTY (either mode):
//       The gate forces it back OFF immediately, and
//       updateCirculationPolicy() re-asserts OFF on every subsequent
//       tick. Safety wins regardless of mode.
//   AUTO + water present:    turns ON; AUTO independently wants ON too.
//   MANUAL + water present:  turns ON; MANUAL holds it exactly as set.
//
// A remote OFF is symmetric and always permitted by the gate, with one
// asymmetry worth naming: in AUTO with water present, the automatic
// policy actively wants the pump ON and will turn it back on within
// WATER_INTERVAL_MS. A remote OFF sent without first switching to
// MANUAL is therefore transient by design - which is exactly why the
// frontend steers users through MANUAL mode first. Note this differs
// from the old VERDA firmware, whose AUTO policy merely HELD state at
// normal level rather than actively driving ON.
void processPendingCommands() {
  // Never apply a command in the middle of a dose. The dosing sequence
  // owns the nutrient pumps and the mixer's use of the circulation
  // pump; letting a remote command fight it mid-mix would put two
  // writers on the same relay. The command stays queued in its slot
  // (the in-flight guard above stops it being overwritten) and is
  // applied as soon as dosing finishes.
  if (dosingActive) return;

  bool haveManualOverride = false, manualOverrideValue = false;
  long manualOverrideId = -1;
  bool havePumpState = false, pumpStateValue = false;
  long pumpStateId = -1;

  if (xSemaphoreTake(commandMutex, 0) == pdTRUE) {
    if (pendingPumpMode.available) {
      haveManualOverride  = true;
      manualOverrideValue = pendingPumpMode.value;
      manualOverrideId    = pendingPumpMode.id;
      pendingPumpMode.available = false;
    }
    if (pendingPumpState.available) {
      havePumpState  = true;
      pumpStateValue = pendingPumpState.value;
      pumpStateId    = pendingPumpState.id;
      pendingPumpState.available = false;
    }
    xSemaphoreGive(commandMutex);
  }

  // Mode is applied before state so that if both arrive in the same
  // cycle, the state command takes effect under the mode that was just
  // requested - matching how a human issuing the same two actions in
  // order would expect it to behave.
  if (haveManualOverride) {
    manualOverride = manualOverrideValue;
    Serial.println(manualOverride ? F("Command applied: MANUAL mode")
                                  : F("Command applied: AUTO mode"));

    // Mode switching has no safety gate - it always succeeds exactly as
    // requested, so the outcome is known immediately.
    if (xSemaphoreTake(commandMutex, portMAX_DELAY) == pdTRUE) {
      ackPumpMode.available        = true;
      ackPumpMode.commandId        = manualOverrideId;
      ackPumpMode.appliedValue     = manualOverride;
      ackPumpMode.wasSafetyRefused = false;
      xSemaphoreGive(commandMutex);
    }
  }

  if (havePumpState) {
    applyCirculationPumpDecision(pumpStateValue);   // safety arbiter stays authoritative

    // The REAL outcome, read back from circulationPumpState AFTER the
    // safety arbiter has already run - never assumed from the raw
    // request. If the gate forced a different result, this already
    // reflects that.
    const bool refused = (circulationPumpState != pumpStateValue);

    Serial.println(pumpStateValue ? F("Command applied: circulation pump ON")
                                  : F("Command applied: circulation pump OFF"));
    if (refused) {
      Serial.println(F("Command outcome: safety refused the requested pump state"));
    }

    if (xSemaphoreTake(commandMutex, portMAX_DELAY) == pdTRUE) {
      ackPumpState.available        = true;
      ackPumpState.commandId        = pumpStateId;
      ackPumpState.appliedValue     = circulationPumpState;   // the real state, not the request
      ackPumpState.wasSafetyRefused = refused;
      xSemaphoreGive(commandMutex);
    }
  }
}

// ======================================================
//  COMMAND ACKNOWLEDGEMENT (core 0, from uploadTask)
// ======================================================
// Reports whatever processPendingCommands() (core 1) already computed.
// Never computes a result itself, never touches an actuator, and never
// retries by re-running a command - only the HTTP report is retried.
// Backend contract (acknowledge_command): an identical repeat of an
// already-acknowledged result is a safe 200 no-op, so resending the
// exact same stored values is always safe under retry.
void sendPendingAcks() {
  sendAckIfPending(ackPumpState, true);
  sendAckIfPending(ackPumpMode, false);
}

void sendAckIfPending(PendingAck &ack, bool isPumpState) {
  // Initialized at declaration: if the mutex take below ever failed,
  // these would otherwise be read uninitialized.
  bool have             = false;
  long id               = -1;
  bool appliedValue     = false;
  bool wasSafetyRefused = false;

  if (xSemaphoreTake(commandMutex, portMAX_DELAY) == pdTRUE) {
    have             = ack.available;
    id               = ack.commandId;
    appliedValue     = ack.appliedValue;
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

  const String url = commandsUrl + "/" + String(id) + "/ack";

  // Transport selection only - see the telemetry request above.
#if VERDA_USE_TLS
  WiFiClientSecure client;
  configureSecureClient(client);
  HTTPClient http;
  http.begin(client, url);
#else
  HTTPClient http;
  http.begin(url);
#endif
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", apiKey);
  http.setTimeout(3000);

  const int code = http.POST(json);

  if (code == 200) {
    Serial.print(F("Command acknowledged: id="));
    Serial.println(id);
    if (xSemaphoreTake(commandMutex, portMAX_DELAY) == pdTRUE) {
      ack.available = false;   // only ever cleared on confirmed backend success
      xSemaphoreGive(commandMutex);
    }
  } else if (code == 401) {
    Serial.println(F("Command ACK authentication failed"));
    // retained for retry
  } else if (code == 404) {
    Serial.print(F("Command ACK: command no longer exists, dropping id="));
    Serial.println(id);
    if (xSemaphoreTake(commandMutex, portMAX_DELAY) == pdTRUE) {
      ack.available = false;   // nothing left to retry against
      xSemaphoreGive(commandMutex);
    }
  } else if (code == 409) {
    Serial.print(F("Command ACK conflict (already recorded differently), dropping id="));
    Serial.println(id);
    if (xSemaphoreTake(commandMutex, portMAX_DELAY) == pdTRUE) {
      ack.available = false;   // retrying the same payload will never resolve a real conflict
      xSemaphoreGive(commandMutex);
    }
  } else if (code > 0) {
    Serial.print(F("Command ACK failed, HTTP "));
    Serial.println(code);
    // retained for retry - may be a transient server error
  } else {
    Serial.print(F("Command ACK network error: "));
    Serial.println(http.errorToString(code));
    // retained for retry
  }

  http.end();
}

// ======================================================
//                       SETUP
// ======================================================
void setup() {
  Serial.begin(115200);
  delay(100);

  // --- LEVEL 1: electrical safety first, before anything else ---
  // Write the INACTIVE level to the output latch BEFORE enabling the
  // output driver. Doing it the other way round drives the pin at its
  // reset-default LOW for the instant between the two calls, which with
  // RELAY_ACTIVE_LOW would briefly energize every relay - including the
  // 230V AC circulation pump - on every boot.
  writeRelayPin(PIN_RELAY_A,  false);
  writeRelayPin(PIN_RELAY_B,  false);
  writeRelayPin(PIN_RELAY_AC, false);
  writeRelayPin(PIN_RELAY_C,  false);

  pinMode(PIN_RELAY_A,  OUTPUT);
  pinMode(PIN_RELAY_B,  OUTPUT);
  pinMode(PIN_RELAY_AC, OUTPUT);
  pinMode(PIN_RELAY_C,  OUTPUT);

  allRelaysOff();

  digitalWrite(PIN_BUZZER, LOW);
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);

  pinMode(PIN_HCSR_TRIG, OUTPUT);
  pinMode(PIN_HCSR_ECHO, INPUT);

  // --- LEVEL 2: sensors ---
  analogReadResolution(12);
  analogSetPinAttenuation(PIN_PH,  ADC_11db);
  analogSetPinAttenuation(PIN_TDS, ADC_11db);

  tempSensor.begin();
  tempSensor.setResolution(12);
  tempSensor.setWaitForConversion(false);   // async - never blocks the safety loop

  Wire.begin(PIN_OLED_SDA, PIN_OLED_SCL);
  Wire.setClock(400000);

  oledReady = oled.begin();
  if (!oledReady) {
    // Diagnostic only. The controller deliberately continues without a
    // display - local safety must not depend on a peripheral that is
    // there to look at.
    Serial.println(F("OLED init failed - continuing without display"));
  } else {
    oled.clearBuffer();
    oled.setFont(u8g2_font_6x10_tf);
    oled.drawStr(0, 12, "VERDA");
    oled.drawStr(0, 26, "HYDROPONIC");
    oled.drawStr(0, 40, "Starting...");
    oled.sendBuffer();
  }

  // --- LEVEL 3: establish a real water state before anything can run ---
  // waterState starts at WATER_UNKNOWN, so nothing could have turned on
  // before this point even if it had tried.
  waterDistanceCm = readWaterDistanceCm();
  updateWaterState();
  readChemistry();
  updateCirculationPolicy();
  updateBuzzer();
  drawDisplay();
#if DEBUG_SERIAL
  printStatus();
#endif

  // --- LEVEL 4: network, last and optional ---
  // Everything above is already running safely by this point, so a
  // failing or absent WiFi network delays nothing that matters.
  dataMutex    = xSemaphoreCreateMutex();
  commandMutex = xSemaphoreCreateMutex();
  publishSnapshot();

  connectWiFi();

  xTaskCreatePinnedToCore(
    uploadTask,     // task function
    "uploadTask",   // name
    8192,           // stack size
    NULL,           // param
    1,              // priority
    NULL,           // task handle
    0               // pin to core 0 (main loop runs on core 1)
  );

  Serial.println(F("VERDA controller started."));
  Serial.println(F("Automatic circulation control is ACTIVE."));
  Serial.println(F("Type PUMP_ON / PUMP_OFF to override, PUMP_AUTO to return to automatic."));
}

// ======================================================
//                    LOOP (core 1)
// ======================================================
void loop() {
  const unsigned long now = millis();

  // Every loop pass - these must stay responsive.
  handleSerialCommands();
  processPendingCommands();   // cheap non-blocking mutex try-take
  updateBuzzer();
  updateTemperature(now);     // async, never blocks

  // Fast block: water level is a SAFETY input.
  if (now - lastWaterRead >= WATER_INTERVAL_MS) {
    lastWaterRead = now;

    waterDistanceCm = readWaterDistanceCm();
    updateWaterState();
    updateCirculationPolicy();
    publishSnapshot();
  }

  // Slow block: averaged analog chemistry, then automatic dosing.
  if (now - lastChemRead >= CHEM_INTERVAL_MS) {
    lastChemRead = now;

    readChemistry();
    publishSnapshot();

#if DEBUG_SERIAL
    printStatus();
#endif

    // Automatic dosing is evaluated only here, and only ever refuses -
    // every one of its guards is a reason NOT to dose.
    doseNutrients();
  }

  if (now - lastDisplayMs >= DISPLAY_INTERVAL_MS) {
    lastDisplayMs = now;
    drawDisplay();
  }

  delay(10);
}
