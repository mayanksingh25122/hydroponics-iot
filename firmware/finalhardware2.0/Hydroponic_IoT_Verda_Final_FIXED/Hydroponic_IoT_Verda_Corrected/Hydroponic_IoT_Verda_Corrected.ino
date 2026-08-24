#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <math.h>

// ============================================================
// NETWORK / FASTAPI SERVER
// ============================================================
const char* WIFI_SSID = "mayank";  // Open Wi-Fi network
const char* API_URL = "http://10.150.5.87:8000/sensor-data";

constexpr unsigned long TELEMETRY_INTERVAL_MS = 5000;
constexpr unsigned long WIFI_RETRY_INTERVAL_MS = 10000;

WebServer server(80);
unsigned long lastTelemetryUpload = 0;
unsigned long lastWiFiRetry = 0;

// ============================================================
// VERDA AGRITECH LOGO - 128x64 monochrome bitmap
// Generated from the supplied logo image.
// ============================================================
const uint8_t VERDA_LOGO[] PROGMEM = {
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF0, 0x7F, 0x1C, 0xFF, 0x07, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF0, 0x7F, 0x1C, 0xFF, 0x07, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF0, 0xFF, 0x9C, 0xFF, 0x07, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF0, 0xFD, 0x9C, 0xDF, 0x07, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF0, 0xFB, 0xDD, 0xE7, 0x07, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF0, 0xE3, 0xFD, 0xF3, 0x07, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF0, 0xC7, 0xFF, 0xF1, 0x07, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF0, 0x8F, 0xFF, 0xF8, 0x07, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF0, 0x1F, 0x3F, 0xFC, 0x07, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xE0, 0x3F, 0x1C, 0xFE, 0x03, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80, 0x3F, 0x1C, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x7F, 0x1C, 0x7F, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFE, 0x9C, 0x1F, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF8, 0xDD, 0x0F, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF0, 0xFF, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xC0, 0xFF, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80, 0x7F, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x3E, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1C, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1C, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xE0, 0x9C, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF0, 0xDD, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF0, 0xDD, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF0, 0xDD, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF0, 0x9C, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF8, 0x1C, 0x0F, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xEC, 0x1C, 0x19, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xE6, 0x1C, 0x31, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xE0, 0xE3, 0x1C, 0xE1, 0x01, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xE0, 0xE3, 0x1C, 0xE1, 0x03, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF0, 0xE3, 0x1C, 0x61, 0x03, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xE0, 0xE1, 0x1C, 0xE3, 0x03, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xE0, 0x71, 0x1C, 0xE7, 0x03, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x38, 0x1C, 0x3E, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFC, 0x1F, 0x3E, 0x1C, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFE, 0x0F, 0x7F, 0xFC, 0x3F, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0x87, 0xF7, 0xF7, 0x78, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80, 0xC7, 0xC3, 0xE3, 0xE3, 0xE0, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xC0, 0xE3, 0xE1, 0xC3, 0xC3, 0xC1, 0x01, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xE0, 0xF1, 0xF0, 0xF7, 0x87, 0x83, 0x03, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xE0, 0x70, 0x78, 0x7E, 0x0F, 0x07, 0x03, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x30, 0x3C, 0x7C, 0x1E, 0x07, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x78, 0x7C, 0x7C, 0x1E, 0x0F, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x78, 0xFC, 0x38, 0x1F, 0x0F, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x78, 0xEC, 0xC1, 0x1D, 0x0F, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x30, 0xCE, 0xE3, 0x1C, 0x06, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x8E, 0x63, 0x1C, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x8E, 0x63, 0x1C, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x8C, 0x63, 0x1C, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x88, 0x63, 0x0C, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80, 0x63, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80, 0x63, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x63, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0xE0, 0x03, 0x78, 0xFC, 0x7F, 0xF8, 0x7F, 0xE0, 0xFF, 0x01, 0xE0, 0x03, 0x00,
0x00, 0x00, 0x00, 0xC0, 0x03, 0x78, 0xFC, 0x7F, 0xF8, 0xFF, 0xE0, 0xFF, 0x07, 0xE0, 0x07, 0x00,
0x00, 0x00, 0x00, 0xC0, 0x07, 0x3C, 0xFC, 0x7F, 0xF8, 0xFF, 0xE1, 0xFF, 0x0F, 0xF0, 0x07, 0x00,
0x00, 0x00, 0x00, 0x80, 0x07, 0x3E, 0x3C, 0x00, 0x78, 0xE0, 0xE1, 0x81, 0x1F, 0xF0, 0x0F, 0x00,
0x00, 0x00, 0x00, 0x80, 0x0F, 0x1E, 0x3C, 0x00, 0x78, 0xE0, 0xE3, 0x01, 0x1E, 0x78, 0x0F, 0x00,
0x00, 0x00, 0x00, 0x00, 0x0F, 0x1E, 0xBC, 0x10, 0x78, 0xC0, 0xE3, 0x01, 0x1E, 0x78, 0x1E, 0x00
};


// ============================================================
// OLED
// ============================================================
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// ============================================================
// ESP32 PIN ASSIGNMENTS - FINAL
// ============================================================
#define PH_PIN              34
#define TDS_PIN             35

#define TRIG_PIN            5
#define ECHO_PIN            18

#define BUZZER_PIN          19
#define ONE_WIRE_BUS        4

// NEW RELAY MODULE
#define PERISTALTIC_RELAY_PIN 25   // Relay IN1 -> CH1 -> 12V DC peristaltic pump
#define WATER_RELAY_PIN       26   // Relay IN2 -> CH2 -> AC water pump

// ============================================================
// RELAY LOGIC
// ============================================================
// Many 5V relay modules are ACTIVE-LOW.
// If your relay turns ON when GPIO goes LOW, leave this as LOW.
// If your relay turns ON when GPIO goes HIGH, change to HIGH.
#define RELAY_ON  LOW
#define RELAY_OFF HIGH

// ============================================================
// DS18B20
// ============================================================
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

// ============================================================
// WATER LEVEL THRESHOLDS
// ============================================================
#define TANK_FULL_DIST   7
#define TANK_EMPTY_DIST  30

// ============================================================
// TDS DOSING SETTINGS
// ============================================================
// Set this to the TDS you want in the reservoir.
#define TDS_TARGET_PPM       800.0

// Dosing stops once TDS is at/above target.
// This prevents rapid ON/OFF around the target.
#define TDS_LOW_MARGIN_PPM   20.0

// Peristaltic pump runs in short pulses.
// CALIBRATE THIS after measuring how much solution one pulse adds.
#define DOSE_PULSE_MS        1000

// Wait for the solution to mix before taking another dosing decision.
#define DOSE_MIX_WAIT_MS     10000

// Safety limit: maximum continuous dosing time per hour.
// This is a software safety limit, not a substitute for hardware protection.
#define MAX_DOSE_TIME_MS_PER_HOUR 120000UL

// ============================================================
// TIMING
// ============================================================
#define SENSOR_INTERVAL_MS       1000
#define PULSE_INTERVAL_MS         150
#define TEMP_REQUEST_MS            400
#define TEMP_CONVERSION_MS         100
#define ULTRASONIC_TIMEOUT_US   15000

unsigned long lastSensorRead  = 0;
unsigned long lastPulseToggle = 0;
unsigned long lastTempRequest = 0;
unsigned long tempRequestTime = 0;

unsigned long doseStartTime = 0;
unsigned long lastDoseTime = 0;
unsigned long doseTimeThisHour = 0;
unsigned long doseHourStart = 0;

bool tempRequested = false;
bool pulseState = false;

// ============================================================
// VARIABLES
// ============================================================
float temperature = 0;
float distance = 0;

float pHVoltage = 0;
float pHValue = 0;

float tdsVoltage = 0;
float tdsValue = 0;
float ecValue = 0;

bool peristalticState = false;
bool waterPumpState = false;

enum WaterLevel {
  LEVEL_NORMAL,
  LEVEL_FULL,
  LEVEL_EMPTY,
  LEVEL_UNKNOWN
};

WaterLevel waterLevel = LEVEL_NORMAL;

// ============================================================
// OPERATING MODES
// ============================================================
bool manualWaterPumpOverride = false;
bool manualPeristalticOverride = false;
bool tdsAutoDoseEnabled = true;


// ============================================================
// OLED DISPLAY SETTINGS
// ============================================================
#define DISPLAY_PAGE_INTERVAL_MS 3000
#define LOGO_SPLASH_MS            2500

unsigned long logoStartTime = 0;
unsigned long lastDisplayPage = 0;
uint8_t displayPage = 0;

float previousWaterPercent = -1.0;
int waterTrend = 0;  // +1 filling, -1 emptying, 0 stable/unknown

void setWaterPump(bool on);
void updateWaterLevelAndPump();

// ============================================================
// HTTP DEVICE API (used by the FastAPI dashboard)
// ============================================================
void sendInvalidRequest() {
  server.send(400, "application/json", "{\"success\":false,\"message\":\"Invalid request\"}");
}

void handlePumpCommand() {
  if (!server.hasArg("plain")) {
    sendInvalidRequest();
    return;
  }

  StaticJsonDocument<128> request;
  if (deserializeJson(request, server.arg("plain")) || !request["state"].is<bool>()) {
    sendInvalidRequest();
    return;
  }

  bool requestedState = request["state"].as<bool>();
  manualWaterPumpOverride = true;

  // A full tank may always stop the water pump, including in manual mode.
  if (requestedState && distance >= 0 && distance < TANK_FULL_DIST) {
    setWaterPump(false);
    server.send(200, "application/json", "{\"success\":true,\"state\":false}");
    return;
  }

  setWaterPump(requestedState);
  String response = String("{\"success\":true,\"state\":") +
                    (waterPumpState ? "true" : "false") + "}";
  server.send(200, "application/json", response);
}

void handlePumpModeCommand() {
  if (!server.hasArg("plain")) {
    sendInvalidRequest();
    return;
  }

  StaticJsonDocument<128> request;
  if (deserializeJson(request, server.arg("plain")) || !request["manualOverride"].is<bool>()) {
    sendInvalidRequest();
    return;
  }

  manualWaterPumpOverride = request["manualOverride"].as<bool>();
  if (!manualWaterPumpOverride) {
    updateWaterLevelAndPump();
  }

  String response = String("{\"success\":true,\"pump\":") +
                    (waterPumpState ? "true" : "false") +
                    ",\"manualOverride\":" +
                    (manualWaterPumpOverride ? "true" : "false") + "}";
  server.send(200, "application/json", response);
}

void handleStatus() {
  String response = String("{\"pump\":") +
                    (waterPumpState ? "true" : "false") +
                    ",\"manualOverride\":" +
                    (manualWaterPumpOverride ? "true" : "false") +
                    ",\"wifi\":" +
                    (WiFi.status() == WL_CONNECTED ? "true" : "false") + "}";
  server.send(200, "application/json", response);
}

void startHttpServer() {
  server.on("/pump", HTTP_POST, handlePumpCommand);
  server.on("/pump/mode", HTTP_POST, handlePumpModeCommand);
  server.on("/status", HTTP_GET, handleStatus);
  server.begin();
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID);
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(WIFI_SSID);
}

void uploadTelemetry(unsigned long now) {
  if (WiFi.status() != WL_CONNECTED || now - lastTelemetryUpload < TELEMETRY_INTERVAL_MS) {
    return;
  }

  lastTelemetryUpload = now;

  StaticJsonDocument<256> telemetry;
  telemetry["device_id"] = 1;
  telemetry["ph"] = pHValue;
  telemetry["tds"] = tdsValue;
  telemetry["ec"] = ecValue;
  telemetry["water_temperature"] = temperature;
  telemetry["water_level"] = distance;
  telemetry["pump_status"] = waterPumpState;
  telemetry["buzzer_status"] = waterLevel == LEVEL_FULL || (waterLevel == LEVEL_EMPTY && pulseState);

  String payload;
  serializeJson(telemetry, payload);

  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(3000);
  int statusCode = http.POST(payload);
  Serial.print("Telemetry HTTP status: ");
  Serial.println(statusCode);
  http.end();
}

// Draw supplied VERDA AGRITECH logo at startup.
void showLogoSplash() {
  display.clearDisplay();
  display.drawBitmap(0, 0, VERDA_LOGO, 128, 64, SSD1306_WHITE);
  display.display();
}

// Convert ultrasonic distance into tank fill percentage.
// 7 cm = 100% (full), 30 cm = 0% (empty).
float getWaterPercent() {
  if (distance < 0) return -1;

  float pct = (TANK_EMPTY_DIST - distance) * 100.0 /
              (TANK_EMPTY_DIST - TANK_FULL_DIST);

  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;

  return pct;
}

// Draw an animated tank. The water height is based on the actual
// ultrasonic reading and the surface moves slightly to create a
// filling/emptying animation.
void drawTankAnimation(int x, int y, int w, int h, unsigned long now) {
  display.drawRect(x, y, w, h, SSD1306_WHITE);

  float pct = getWaterPercent();

  if (pct < 0) {
    display.setCursor(x + 4, y + h / 2 - 3);
    display.print("NO ECHO");
    return;
  }

  int waterHeight = (int)((h - 2) * pct / 100.0);
  int waterTop = y + h - 1 - waterHeight;

  // Small animated wave.
  int wave = ((now / 180) % 2) ? 1 : 0;

  // Fill the water area line-by-line.
  for (int yy = waterTop; yy < y + h - 1; yy++) {
    int startX = x + 2;
    int endX = x + w - 3;

    if (yy == waterTop) {
      startX += wave;
      endX -= wave;
    }

    display.drawFastHLine(startX, yy, endX - startX + 1, SSD1306_WHITE);
  }

  // Animated surface.
  display.drawPixel(x + 3 + wave, waterTop, SSD1306_WHITE);
  display.drawPixel(x + 5 + wave, waterTop + 1, SSD1306_WHITE);
  display.drawPixel(x + 7 + wave, waterTop, SSD1306_WHITE);

  // Trend indicator.
  display.setCursor(x + w + 3, y + 2);
  if (waterTrend > 0) {
    display.print("^");
  } else if (waterTrend < 0) {
    display.print("v");
  } else {
    display.print("-");
  }

  display.setCursor(x + w + 3, y + 12);
  display.print((int)pct);
  display.print("%");
}

bool tdsLowAlert() {
  return tdsValue < (TDS_TARGET_PPM - TDS_LOW_MARGIN_PPM);
}

bool tdsHighAlert() {
  return tdsValue > (TDS_TARGET_PPM + 100.0);
}

bool phAlert() {
  return pHValue < 5.5 || pHValue > 6.5;
}

bool anyAlert() {
  return waterLevel == LEVEL_FULL ||
         waterLevel == LEVEL_EMPTY ||
         waterLevel == LEVEL_UNKNOWN ||
         tdsLowAlert() ||
         tdsHighAlert() ||
         phAlert();
}

// Small top status bar shown on every reading screen.
void drawAlertBar() {
  display.setTextSize(1);
  display.setCursor(0, 0);

  if (waterLevel == LEVEL_FULL) {
    display.print("ALERT: TANK FULL");
  } else if (waterLevel == LEVEL_EMPTY) {
    display.print("ALERT: TANK LOW");
  } else if (waterLevel == LEVEL_UNKNOWN) {
    display.print("ALERT: LEVEL ERR");
  } else if (tdsHighAlert()) {
    display.print("ALERT: TDS HIGH");
  } else if (tdsLowAlert()) {
    display.print("TDS LOW: DOSING");
  } else if (phAlert()) {
    display.print("ALERT: pH RANGE");
  } else {
    display.print("VERDA AGRITECH");
  }

  display.drawFastHLine(0, 9, 128, SSD1306_WHITE);
}

// Page 0: temperature + pH
void displayPageTemperaturePH() {
  display.clearDisplay();
  drawAlertBar();

  display.setCursor(0, 16);
  display.setTextSize(1);
  display.print("TEMPERATURE");

  display.setTextSize(2);
  display.setCursor(0, 27);
  display.print(temperature, 1);
  display.print(" C");

  display.setTextSize(1);
  display.setCursor(0, 51);
  display.print("pH: ");
  display.print(pHValue, 2);

  display.setCursor(72, 51);
  if (phAlert())
    display.print("CHECK");
  else
    display.print("OK");

  display.display();
}

// Page 1: TDS + EC
void displayPageTDS() {
  display.clearDisplay();
  drawAlertBar();

  display.setTextSize(1);
  display.setCursor(0, 15);
  display.print("TDS");

  display.setTextSize(2);
  display.setCursor(0, 26);
  display.print((int)tdsValue);
  display.print(" ppm");

  display.setTextSize(1);
  display.setCursor(0, 48);
  display.print("Target: ");
  display.print((int)TDS_TARGET_PPM);

  display.setCursor(0, 56);
  display.print("EC: ");
  display.print((int)ecValue);
  display.print(" uS/cm");

  display.display();
}

// Page 2: animated water tank + pump states
void displayPageTank(unsigned long now) {
  display.clearDisplay();
  drawAlertBar();

  display.setTextSize(1);
  display.setCursor(0, 12);
  display.print("WATER LEVEL");

  drawTankAnimation(4, 22, 55, 38, now);

  display.setCursor(70, 24);
  display.print("AC:");
  display.print(waterPumpState ? "ON" : "OFF");

  display.setCursor(70, 36);
  display.print("DOSE:");
  display.print(peristalticState ? "ON" : "OFF");

  display.setCursor(70, 48);
  if (waterLevel == LEVEL_FULL)
    display.print("FULL");
  else if (waterLevel == LEVEL_EMPTY)
    display.print("LOW");
  else if (waterLevel == LEVEL_UNKNOWN)
    display.print("ERROR");
  else
    display.print("NORMAL");

  display.display();
}

// Page 3: compact system status
void displayPageSystem() {
  display.clearDisplay();
  drawAlertBar();

  display.setTextSize(1);

  display.setCursor(0, 15);
  display.print("VERDA AGRITECH");

  display.setCursor(0, 27);
  display.print("Water Pump: ");
  display.print(waterPumpState ? "ON" : "OFF");

  display.setCursor(0, 38);
  display.print("Dose Pump : ");
  display.print(peristalticState ? "ON" : "OFF");

  display.setCursor(0, 49);
  display.print("Target TDS: ");
  display.print((int)TDS_TARGET_PPM);

  display.setCursor(0, 59);
  display.print("Alerts: ");
  display.print(anyAlert() ? "ACTIVE" : "NONE");

  display.display();
}

// Updates water level trend used by the tank animation.
void updateWaterTrend() {
  float pct = getWaterPercent();

  if (pct < 0) {
    waterTrend = 0;
    return;
  }

  if (previousWaterPercent >= 0) {
    if (pct > previousWaterPercent + 0.5) {
      waterTrend = 1;
    } else if (pct < previousWaterPercent - 0.5) {
      waterTrend = -1;
    } else {
      waterTrend = 0;
    }
  }

  previousWaterPercent = pct;
}

// Main OLED update. Pages rotate so all readings remain visible.
void updateOLED(unsigned long now) {

  if (now - lastDisplayPage >= DISPLAY_PAGE_INTERVAL_MS) {
    lastDisplayPage = now;
    displayPage = (displayPage + 1) % 4;
  }

  switch (displayPage) {
    case 0:
      displayPageTemperaturePH();
      break;

    case 1:
      displayPageTDS();
      break;

    case 2:
      displayPageTank(now);
      break;

    case 3:
      displayPageSystem();
      break;
  }
}


// ============================================================
// RELAY CONTROL FUNCTIONS
// ============================================================
void setPeristalticPump(bool on) {
  peristalticState = on;
  digitalWrite(PERISTALTIC_RELAY_PIN, on ? RELAY_ON : RELAY_OFF);
}

void setWaterPump(bool on) {
  waterPumpState = on;
  digitalWrite(WATER_RELAY_PIN, on ? RELAY_ON : RELAY_OFF);
}

// ============================================================
// SERIAL COMMANDS
// ============================================================
// These are for bench testing before the cloud webpage is connected.
//
// PERISTALTIC_ON
// PERISTALTIC_OFF
// PERISTALTIC_AUTO
// WATER_ON
// WATER_OFF
// WATER_AUTO
// TDS_AUTO_ON
// TDS_AUTO_OFF
// STATUS
// ============================================================
void handleSerialCommands() {
  if (!Serial.available()) return;

  String cmd = Serial.readStringUntil('\n');
  cmd.trim();
  cmd.toUpperCase();

  if (cmd == "PERISTALTIC_ON") {
    manualPeristalticOverride = true;
    setPeristalticPump(true);
    Serial.println(">> Manual: PERISTALTIC pump ON");

  } else if (cmd == "PERISTALTIC_OFF") {
    manualPeristalticOverride = true;
    setPeristalticPump(false);
    Serial.println(">> Manual: PERISTALTIC pump OFF");

  } else if (cmd == "PERISTALTIC_AUTO") {
    manualPeristalticOverride = false;
    Serial.println(">> Peristaltic pump returned to TDS AUTO");

  } else if (cmd == "WATER_ON") {
    manualWaterPumpOverride = true;
    setWaterPump(true);
    Serial.println(">> Manual: AC WATER pump ON");

  } else if (cmd == "WATER_OFF") {
    manualWaterPumpOverride = true;
    setWaterPump(false);
    Serial.println(">> Manual: AC WATER pump OFF");

  } else if (cmd == "WATER_AUTO") {
    manualWaterPumpOverride = false;
    Serial.println(">> AC WATER pump returned to water-level AUTO");

  } else if (cmd == "TDS_AUTO_ON") {
    tdsAutoDoseEnabled = true;
    manualPeristalticOverride = false;
    Serial.println(">> TDS automatic dosing ENABLED");

  } else if (cmd == "TDS_AUTO_OFF") {
    tdsAutoDoseEnabled = false;
    setPeristalticPump(false);
    Serial.println(">> TDS automatic dosing DISABLED");

  } else if (cmd == "STATUS") {
    printSerial();

  } else if (cmd.length() > 0) {
    Serial.println(">> Unknown command.");
    Serial.println("Commands: PERISTALTIC_ON/OFF/AUTO, WATER_ON/OFF/AUTO,");
    Serial.println("          TDS_AUTO_ON/OFF, STATUS");
  }
}

// ============================================================
// TEMPERATURE
// ============================================================
void updateTemperature(unsigned long now) {
  if (!tempRequested && (now - lastTempRequest >= TEMP_REQUEST_MS)) {
    sensors.requestTemperatures();
    tempRequested = true;
    tempRequestTime = now;
    lastTempRequest = now;
  }

  if (tempRequested && (now - tempRequestTime >= TEMP_CONVERSION_MS)) {
    float t = sensors.getTempCByIndex(0);

    if (t != DEVICE_DISCONNECTED_C) {
      temperature = t;
    }

    tempRequested = false;
  }
}

// ============================================================
// ULTRASONIC
// ============================================================
void readDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(5);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  unsigned long duration =
      pulseIn(ECHO_PIN, HIGH, ULTRASONIC_TIMEOUT_US);

  if (duration == 0) {
    distance = -1;
  } else {
    distance = duration * 0.0343 / 2.0;
  }
}

// ============================================================
// WATER LEVEL -> AC WATER PUMP
// ============================================================
void updateWaterLevelAndPump() {
  if (distance < 0) {
    waterLevel = LEVEL_UNKNOWN;

    // Safety: don't automatically start the AC pump if level reading failed.
    if (!manualWaterPumpOverride) {
      setWaterPump(false);
    }
    return;
  }

  if (distance < TANK_FULL_DIST) {
    waterLevel = LEVEL_FULL;

    // Tank is full -> stop AC water pump.
    if (!manualWaterPumpOverride) {
      setWaterPump(false);
    }

  } else if (distance > TANK_EMPTY_DIST) {
    waterLevel = LEVEL_EMPTY;

    // Tank is low -> start AC water pump.
    if (!manualWaterPumpOverride) {
      setWaterPump(true);
    }

  } else {
    waterLevel = LEVEL_NORMAL;
    // Hysteresis: keep the existing AC pump state.
  }
}

// ============================================================
// TDS -> PERISTALTIC PUMP
// ============================================================
void updateTDSDosing(unsigned long now) {

  // Manual override has priority.
  if (manualPeristalticOverride) {
    return;
  }

  // Automatic dosing disabled.
  if (!tdsAutoDoseEnabled) {
    setPeristalticPump(false);
    return;
  }

  // Safety: don't dose if TDS reading is invalid.
  if (tdsValue < 0 || tdsValue > 5000) {
    setPeristalticPump(false);
    return;
  }

  // Reset hourly dosing timer.
  if (now - doseHourStart >= 3600000UL) {
    doseHourStart = now;
    doseTimeThisHour = 0;
  }

  // Pump currently running: stop after one pulse.
  if (peristalticState) {
    if (now - doseStartTime >= DOSE_PULSE_MS) {
      setPeristalticPump(false);

      doseTimeThisHour += DOSE_PULSE_MS;
      lastDoseTime = now;
    }
    return;
  }

  // Safety maximum.
  if (doseTimeThisHour >= MAX_DOSE_TIME_MS_PER_HOUR) {
    setPeristalticPump(false);
    return;
  }

  // Wait for reservoir mixing after the previous dose.
  if (now - lastDoseTime < DOSE_MIX_WAIT_MS) {
    return;
  }

  // TDS too low -> dose prepared solution.
  if (tdsValue < (TDS_TARGET_PPM - TDS_LOW_MARGIN_PPM)) {
    doseStartTime = now;
    setPeristalticPump(true);

    Serial.println(">> TDS LOW: Peristaltic dosing pulse START");
  }

  // At/above target -> pump stays OFF.
}

// ============================================================
// BUZZER
// ============================================================
void updateBuzzer(unsigned long now) {

  if (waterLevel == LEVEL_FULL) {

    digitalWrite(BUZZER_PIN, HIGH);

  } else if (waterLevel == LEVEL_EMPTY) {

    if (now - lastPulseToggle >= PULSE_INTERVAL_MS) {
      lastPulseToggle = now;
      pulseState = !pulseState;

      digitalWrite(
        BUZZER_PIN,
        pulseState ? HIGH : LOW
      );
    }

  } else {

    digitalWrite(BUZZER_PIN, LOW);
    pulseState = false;
  }
}

// ============================================================
// SERIAL OUTPUT
// ============================================================
void printSerial() {

  Serial.println("--------------------------------");

  Serial.print("Temperature : ");
  Serial.print(temperature);
  Serial.println(" C");

  Serial.print("Distance    : ");
  Serial.print(distance);
  Serial.println(" cm");

  Serial.print("pH          : ");
  Serial.println(pHValue, 2);

  Serial.print("TDS         : ");
  Serial.print(tdsValue);
  Serial.println(" ppm");

  Serial.print("EC          : ");
  Serial.print(ecValue);
  Serial.println(" uS/cm");

  Serial.print("TDS Target  : ");
  Serial.print(TDS_TARGET_PPM);
  Serial.println(" ppm");

  Serial.print("Water Level : ");

  switch (waterLevel) {
    case LEVEL_FULL:
      Serial.println("FULL");
      break;

    case LEVEL_EMPTY:
      Serial.println("LOW");
      break;

    case LEVEL_UNKNOWN:
      Serial.println("UNKNOWN");
      break;

    default:
      Serial.println("NORMAL");
      break;
  }

  Serial.print("AC Water Pump : ");
  Serial.print(waterPumpState ? "ON" : "OFF");
  Serial.println(manualWaterPumpOverride ? " (MANUAL)" : " (AUTO)");

  Serial.print("Peristaltic   : ");
  Serial.print(peristalticState ? "ON" : "OFF");

  if (manualPeristalticOverride) {
    Serial.println(" (MANUAL)");
  } else if (tdsAutoDoseEnabled) {
    Serial.println(" (TDS AUTO)");
  } else {
    Serial.println(" (OFF)");
  }
}

// ============================================================
// SETUP
// ============================================================
void setup() {

  Serial.begin(115200);

  // Relay outputs
  pinMode(PERISTALTIC_RELAY_PIN, OUTPUT);
  pinMode(WATER_RELAY_PIN, OUTPUT);

  // Sensors / outputs
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  // IMPORTANT: initialize pumps OFF.
  digitalWrite(PERISTALTIC_RELAY_PIN, RELAY_OFF);
  digitalWrite(WATER_RELAY_PIN, RELAY_OFF);
  digitalWrite(BUZZER_PIN, LOW);

  setPeristalticPump(false);
  setWaterPump(false);

  sensors.begin();
  sensors.setResolution(9);
  sensors.setWaitForConversion(false);

  Wire.begin(21, 22);
  // Keep the OLED bus at the standard, breadboard-safe I2C speed.
  Wire.setClock(100000);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED Failed");
    while (1);
  }

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  connectWiFi();
  startHttpServer();

  doseHourStart = millis();

  // VERDA AGRITECH startup logo
  logoStartTime = millis();
  showLogoSplash();
  delay(LOGO_SPLASH_MS);

  lastDisplayPage = millis();
  displayPage = 0;

  // The splash is startup-only. Clear its bitmap before drawing the normal
  // dashboard so no logo pixels remain on subsequent display pages.
  display.clearDisplay();
  display.display();
  updateOLED(lastDisplayPage);

  Serial.println();
  Serial.println("================================");
  Serial.println("Hydroponic IoT System Started");
  Serial.println("================================");
  Serial.println("GPIO25 -> Relay IN1 -> 12V DC peristaltic pump");
  Serial.println("GPIO26 -> Relay IN2 -> AC water pump");
  Serial.println("GPIO19 -> buzzer");
  Serial.println("TDS automatic dosing: ACTIVE");
  Serial.println("Water-level automatic pump control: ACTIVE");
  Serial.println();
  Serial.println("Bench-test commands:");
  Serial.println("PERISTALTIC_ON");
  Serial.println("PERISTALTIC_OFF");
  Serial.println("PERISTALTIC_AUTO");
  Serial.println("WATER_ON");
  Serial.println("WATER_OFF");
  Serial.println("WATER_AUTO");
  Serial.println("TDS_AUTO_ON");
  Serial.println("TDS_AUTO_OFF");
  Serial.println("STATUS");
}

// ============================================================
// LOOP
// ============================================================
void loop() {

  unsigned long now = millis();

  if (WiFi.status() == WL_CONNECTED) {
    server.handleClient();
  } else if (now - lastWiFiRetry >= WIFI_RETRY_INTERVAL_MS) {
    lastWiFiRetry = now;
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID);
    Serial.println("Retrying Wi-Fi connection...");
  }

  // Commands / controls
  handleSerialCommands();

  // Non-blocking temperature
  updateTemperature(now);

  // Buzzer
  updateBuzzer(now);

  // Sensor refresh
  if (now - lastSensorRead >= SENSOR_INTERVAL_MS) {

    lastSensorRead = now;

    // ---------------- Ultrasonic ----------------
    readDistance();

    // ---------------- pH ----------------
    int phADC = analogRead(PH_PIN);

    pHVoltage =
        phADC * (3.3 / 4095.0);

    pHValue =
        1.04167 *
        (2.0 + ((2.5 - pHVoltage) / 0.18))
        - 1.125;

    if (pHValue < 0.0)
      pHValue = 0.0;

    if (pHValue > 14.0)
      pHValue = 14.0;

    // ---------------- TDS & EC ----------------
    int tdsADC = analogRead(TDS_PIN);

    tdsVoltage =
        tdsADC * (3.3 / 4095.0);

    float rawEC =
        133.42 * pow(tdsVoltage, 3)
        - 255.86 * pow(tdsVoltage, 2)
        + 857.39 * tdsVoltage;

    tdsValue = rawEC * 0.5;
    ecValue = tdsValue * 2.0;

    // ---------------- Water-level control ----------------
    updateWaterLevelAndPump();

    // ---------------- TDS dosing control ----------------
    updateTDSDosing(now);

    // ---------------- Display trend ----------------
    updateWaterTrend();

    // ---------------- Output ----------------
    printSerial();
    updateOLED(now);
  }

  uploadTelemetry(now);
}
