#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WebSocketsClient.h>

const char* WIFI_SSID = "Xonodevs";
const char* WIFI_PASSWORD = "karachi@285";
const char* API_BASE_URL = "https://helzion-server.onrender.com/api";
const char* WS_HOST = "helzion-server.onrender.com";
const uint16_t WS_PORT = 443;
const char* WS_PATH = "/ws";

// Set these to a real assigned helmet before flashing.
String espId = "HM-ESP32-001";
String secretKey = "REPLACE_WITH_REAL_SECRET";

WebSocketsClient webSocket;
String deviceToken;

bool socketAuthenticated = false;
bool helmetWorn = true;
bool gpsSignal = true;
bool charging = true;
bool ridingMode = true;

int batteryPercentage = 76;
unsigned long lastStatusPush = 0;
unsigned long lastSocketAttempt = 0;

const float FAKE_LAT = 24.8607f;
const float FAKE_LNG = 67.0011f;
const int FAKE_ACCURACY_METERS = 10;

String buildUrl(const char* path) {
  return String(API_BASE_URL) + path;
}

bool postJson(const char* path, JsonDocument& doc) {
  if (WiFi.status() != WL_CONNECTED || deviceToken.isEmpty()) return false;

  HTTPClient http;
  http.begin(buildUrl(path));
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-token", deviceToken);

  String body;
  serializeJson(doc, body);
  int code = http.POST(body);
  String response = http.getString();
  http.end();

  Serial.printf("[HTTP] POST %s -> %d\n", path, code);
  if (!response.isEmpty()) {
    Serial.println(response);
  }

  return code >= 200 && code < 300;
}

void printHelp() {
  Serial.println();
  Serial.println("Test keys:");
  Serial.println("  p = push live status");
  Serial.println("  a = send impact accident");
  Serial.println("  s = send manual SOS");
  Serial.println("  f = send false alarm");
  Serial.println("  w = toggle helmet worn");
  Serial.println("  g = toggle GPS signal");
  Serial.println("  c = toggle battery charging");
  Serial.println("  r = toggle riding mode");
  Serial.println("  + = increase battery");
  Serial.println("  - = decrease battery");
  Serial.println("  h = print help");
  Serial.println();
}

void tickBattery() {
  if (charging && batteryPercentage < 100) {
    batteryPercentage = min(100, batteryPercentage + 1);
    return;
  }

  if (!charging && batteryPercentage > 5) {
    batteryPercentage = max(5, batteryPercentage - 1);
  }
}

bool authenticateDevice() {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  http.begin(buildUrl("/device/login"));
  http.addHeader("Content-Type", "application/json");

  DynamicJsonDocument doc(256);
  doc["espId"] = espId;
  doc["secretKey"] = secretKey;

  String body;
  serializeJson(doc, body);
  int code = http.POST(body);
  String response = http.getString();
  http.end();

  Serial.printf("[HTTP] login -> %d\n", code);
  if (code != 200) {
    if (!response.isEmpty()) {
      Serial.println(response);
    }
    return false;
  }

  DynamicJsonDocument responseDoc(2048);
  if (deserializeJson(responseDoc, response)) {
    Serial.println("[HTTP] login response JSON parse failed");
    return false;
  }

  deviceToken = responseDoc["deviceToken"].as<String>();
  Serial.printf("[AUTH] helmet=%s token=%s\n", espId.c_str(), deviceToken.c_str());
  return !deviceToken.isEmpty();
}

void sendSocketAuth() {
  DynamicJsonDocument authDoc(256);
  authDoc["type"] = "auth:helmet";
  authDoc["espId"] = espId;
  authDoc["secretKey"] = secretKey;

  String body;
  serializeJson(authDoc, body);
  webSocket.sendTXT(body);
}

void sendLocationRequestAck(const String& requestId) {
  DynamicJsonDocument ackDoc(256);
  ackDoc["type"] = "location_request:ack";
  ackDoc["requestId"] = requestId;

  String body;
  serializeJson(ackDoc, body);
  webSocket.sendTXT(body);
}

void sendLocationResponse(const String& requestId) {
  DynamicJsonDocument responseDoc(512);
  responseDoc["type"] = "location_request:response";
  responseDoc["requestId"] = requestId;
  responseDoc["location"]["lat"] = FAKE_LAT;
  responseDoc["location"]["lng"] = FAKE_LNG;
  responseDoc["location"]["source"] = "test_key";
  responseDoc["location"]["accuracyMeters"] = FAKE_ACCURACY_METERS;
  responseDoc["metadata"]["batteryPercentage"] = batteryPercentage;
  responseDoc["metadata"]["helmetWorn"] = helmetWorn;
  responseDoc["metadata"]["charging"] = charging;

  String body;
  serializeJson(responseDoc, body);
  webSocket.sendTXT(body);
  Serial.printf("[WS] location response sent for request %s\n", requestId.c_str());
}

void handleSocketPayload(const String& payload) {
  DynamicJsonDocument doc(1024);
  if (deserializeJson(doc, payload)) return;

  const String type = doc["type"] | "";
  if (type == "socket:authenticated") {
    socketAuthenticated = true;
    Serial.println("[WS] socket authenticated");
    return;
  }

  if (type == "location_request:deliver") {
    String requestId = doc["request"]["id"] | "";
    if (requestId.isEmpty()) return;
    sendLocationRequestAck(requestId);
    sendLocationResponse(requestId);
  }
}

void onSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      socketAuthenticated = false;
      Serial.println("[WS] disconnected");
      break;
    case WStype_CONNECTED:
      socketAuthenticated = false;
      Serial.println("[WS] connected");
      sendSocketAuth();
      break;
    case WStype_TEXT:
      handleSocketPayload(String((char*)payload).substring(0, length));
      break;
    default:
      break;
  }
}

void ensureSocketConnected() {
  if (WiFi.status() != WL_CONNECTED || deviceToken.isEmpty()) return;
  if (millis() - lastSocketAttempt < 5000UL) return;

  lastSocketAttempt = millis();
  webSocket.beginSSL(WS_HOST, WS_PORT, WS_PATH);
  webSocket.setReconnectInterval(5000);
  webSocket.onEvent(onSocketEvent);
}

void pushStatus(bool force = false) {
  if (!force && millis() - lastStatusPush < 15000UL) return;
  lastStatusPush = millis();
  tickBattery();

  DynamicJsonDocument doc(512);
  doc["online"] = true;
  doc["batteryPercentage"] = batteryPercentage;
  doc["firmwareVersion"] = "test-keys-1.0.0";
  doc["gpsSignal"] = gpsSignal;
  doc["wifiStrength"] = WiFi.RSSI();
  doc["helmetWorn"] = helmetWorn;
  doc["ridingMode"] = ridingMode;
  doc["sensors"]["shock"] = false;
  doc["sensors"]["fsrRaw"] = helmetWorn ? 820 : 120;
  doc["sensors"]["charging"] = charging;
  doc["sensors"]["lat"] = FAKE_LAT;
  doc["sensors"]["lng"] = FAKE_LNG;
  doc["sensors"]["locationLabel"] = "Karachi Test";

  postJson("/device/status", doc);
}

void sendAccidentEvent(const char* type, const char* severity, bool canceledByButton = false) {
  tickBattery();

  DynamicJsonDocument doc(768);
  doc["type"] = type;
  doc["severity"] = severity;
  doc["batteryPercentage"] = batteryPercentage;
  doc["location"]["lat"] = FAKE_LAT;
  doc["location"]["lng"] = FAKE_LNG;
  doc["location"]["source"] = "test_key";
  doc["location"]["accuracyMeters"] = FAKE_ACCURACY_METERS;
  doc["metadata"]["helmetWorn"] = helmetWorn;
  doc["metadata"]["charging"] = charging;
  doc["metadata"]["gpsSignal"] = gpsSignal;
  doc["metadata"]["cancelledByButton"] = canceledByButton;
  doc["metadata"]["locationLabel"] = "Karachi Test";

  postJson("/device/accidents", doc);
}

void handleSerialInput() {
  while (Serial.available() > 0) {
    const char key = (char)Serial.read();

    switch (key) {
      case 'p':
      case 'P':
        pushStatus(true);
        break;
      case 'a':
      case 'A':
        sendAccidentEvent("impact", "severe");
        break;
      case 's':
      case 'S':
        sendAccidentEvent("manual_sos", "medium");
        break;
      case 'f':
      case 'F':
        sendAccidentEvent("false_alarm", "low", true);
        break;
      case 'w':
      case 'W':
        helmetWorn = !helmetWorn;
        Serial.printf("[STATE] helmetWorn=%s\n", helmetWorn ? "true" : "false");
        pushStatus(true);
        break;
      case 'g':
      case 'G':
        gpsSignal = !gpsSignal;
        Serial.printf("[STATE] gpsSignal=%s\n", gpsSignal ? "true" : "false");
        pushStatus(true);
        break;
      case 'c':
      case 'C':
        charging = !charging;
        Serial.printf("[STATE] charging=%s\n", charging ? "true" : "false");
        pushStatus(true);
        break;
      case 'r':
      case 'R':
        ridingMode = !ridingMode;
        Serial.printf("[STATE] ridingMode=%s\n", ridingMode ? "true" : "false");
        pushStatus(true);
        break;
      case '+':
        batteryPercentage = min(100, batteryPercentage + 5);
        Serial.printf("[STATE] battery=%d\n", batteryPercentage);
        pushStatus(true);
        break;
      case '-':
        batteryPercentage = max(1, batteryPercentage - 5);
        Serial.printf("[STATE] battery=%d\n", batteryPercentage);
        pushStatus(true);
        break;
      case 'h':
      case 'H':
        printHelp();
        break;
      case '\r':
      case '\n':
        break;
      default:
        Serial.printf("[KEY] unsupported=%c\n", key);
        printHelp();
        break;
    }
  }
}

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.printf("[WIFI] connecting to %s", WIFI_SSID);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[WIFI] connected ip=%s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("[WIFI] connection failed");
  }
}

void setup() {
  Serial.begin(115200);
  delay(1200);

  printHelp();
  connectWifi();
  if (WiFi.status() == WL_CONNECTED && authenticateDevice()) {
    ensureSocketConnected();
    pushStatus(true);
  }
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
    if (WiFi.status() == WL_CONNECTED && deviceToken.isEmpty()) {
      authenticateDevice();
    }
  }

  if (WiFi.status() == WL_CONNECTED && deviceToken.isEmpty()) {
    authenticateDevice();
  }

  if (WiFi.status() == WL_CONNECTED) {
    ensureSocketConnected();
    webSocket.loop();
    pushStatus(false);
  }

  handleSerialInput();
  delay(20);
}
