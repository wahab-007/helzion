#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <WebSocketsClient.h>

const char* AP_SSID = "SmartHelmet-Setup";
const char* AP_PASSWORD = "12345678";
const char* API_BASE_URL = "https://helzion-server.onrender.com/api";
const char* WS_HOST = "helzion-server.onrender.com";
const uint16_t WS_PORT = 443;
const char* WS_PATH = "/ws";

struct RuntimeSettings {
  int accidentCountdownSeconds = 15;
  int sosHoldSeconds = 5;
  int impactDebounceMs = 500;
  int helmetWearThreshold = 500;
  bool bluetoothCallSupport = true;
  bool deepSleepEnabled = true;
};

RuntimeSettings settings;
WebServer server(80);
WebSocketsClient webSocket;
Preferences preferences;
String savedSsid;
String savedPassword;
String deviceToken;
String espId = "HM-ESP32-001";
String secretKey = "REPLACE_FROM_PROVISIONING";
bool helmetWorn = false;
bool countdownActive = false;
bool socketAuthenticated = false;
unsigned long countdownStart = 0;
unsigned long sosPressStart = 0;
unsigned long lastStatusPush = 0;
unsigned long lastSettingsSync = 0;
unsigned long lastSocketReconnect = 0;

const int SHOCK_PIN = 13;
const int FSR_PIN = 34;
const int BUTTON_CANCEL_PIN = 26;
const int BUTTON_SOS_PIN = 27;
const int BUZZER_PIN = 25;
const int LED_PIN = 2;

String buildUrl(const char* path) {
  return String(API_BASE_URL) + path;
}

void applySettingsFromJson(JsonVariant settingsJson) {
  settings.accidentCountdownSeconds = settingsJson["accident"]["countdownSeconds"] | 15;
  settings.sosHoldSeconds = settingsJson["sos"]["holdSeconds"] | 5;
  settings.impactDebounceMs = settingsJson["firmware"]["thresholds"]["impactDebounceMs"] | 500;
  settings.helmetWearThreshold = settingsJson["firmware"]["thresholds"]["helmetWearThreshold"] | 500;
  settings.bluetoothCallSupport = settingsJson["features"]["bluetoothCallSupport"] | true;
  settings.deepSleepEnabled = settingsJson["firmware"]["deepSleepEnabled"] | true;
}

void loadWifiCredentials() {
  preferences.begin("wifi", true);
  savedSsid = preferences.getString("ssid", "");
  savedPassword = preferences.getString("password", "");
  preferences.end();
}

void saveWifiCredentials(const String& ssid, const String& password) {
  preferences.begin("wifi", false);
  preferences.putString("ssid", ssid);
  preferences.putString("password", password);
  preferences.end();
  savedSsid = ssid;
  savedPassword = password;
}

void setupCaptivePortal() {
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASSWORD);
  server.on("/", []() {
    server.send(200, "text/html", "<html><body><h2>Smart Helmet Setup</h2><form method='post' action='/save'><input name='ssid' placeholder='WiFi name'/><br/><input name='password' placeholder='WiFi password' type='password'/><br/><button>Save</button></form></body></html>");
  });
  server.on("/save", HTTP_POST, []() {
    String ssid = server.arg("ssid");
    String password = server.arg("password");
    saveWifiCredentials(ssid, password);
    server.send(200, "text/plain", "Saved. Rebooting...");
    delay(1500);
    ESP.restart();
  });
  server.begin();
}

bool connectToSavedWifi() {
  if (savedSsid.isEmpty()) return false;
  WiFi.mode(WIFI_STA);
  WiFi.begin(savedSsid.c_str(), savedPassword.c_str());
  for (int i = 0; i < 20; i++) {
    if (WiFi.status() == WL_CONNECTED) return true;
    delay(500);
  }
  return false;
}

bool syncSettings() {
  if (WiFi.status() != WL_CONNECTED || deviceToken.isEmpty()) return false;

  HTTPClient http;
  http.begin(buildUrl("/device/settings"));
  http.addHeader("x-device-token", deviceToken);
  int code = http.GET();
  if (code != 200) {
    http.end();
    return false;
  }

  DynamicJsonDocument responseDoc(2048);
  deserializeJson(responseDoc, http.getString());
  applySettingsFromJson(responseDoc["settings"]);
  http.end();
  lastSettingsSync = millis();
  return true;
}

bool authenticateDevice() {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  http.begin(buildUrl("/device/login"));
  http.addHeader("Content-Type", "application/json");

  DynamicJsonDocument requestDoc(256);
  requestDoc["espId"] = espId;
  requestDoc["secretKey"] = secretKey;
  String body;
  serializeJson(requestDoc, body);

  int code = http.POST(body);
  if (code != 200) {
    http.end();
    return false;
  }

  DynamicJsonDocument responseDoc(2048);
  deserializeJson(responseDoc, http.getString());
  deviceToken = responseDoc["deviceToken"].as<String>();
  applySettingsFromJson(responseDoc["settings"]);
  http.end();
  lastSettingsSync = millis();
  return true;
}

int readBatteryPercentage() {
  return 90;
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
  http.end();
  return code >= 200 && code < 300;
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
  responseDoc["location"]["lat"] = 24.8607;
  responseDoc["location"]["lng"] = 67.0011;
  responseDoc["location"]["source"] = "gps";
  responseDoc["location"]["accuracyMeters"] = 12;
  responseDoc["metadata"]["batteryPercentage"] = readBatteryPercentage();
  responseDoc["metadata"]["helmetWorn"] = helmetWorn;
  String body;
  serializeJson(responseDoc, body);
  webSocket.sendTXT(body);
}

void handleSocketPayload(const String& payload) {
  DynamicJsonDocument doc(1024);
  if (deserializeJson(doc, payload)) return;
  const char* type = doc["type"] | "";

  if (String(type) == "socket:authenticated") {
    socketAuthenticated = true;
    return;
  }

  if (String(type) == "location_request:deliver") {
    String requestId = doc["request"]["id"] | "";
    if (requestId.isEmpty()) return;
    sendLocationRequestAck(requestId);
    sendLocationResponse(requestId);
  }
}

void onSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      socketAuthenticated = false;
      break;
    case WStype_CONNECTED:
      socketAuthenticated = false;
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
  if (WiFi.status() != WL_CONNECTED) return;
  if (millis() - lastSocketReconnect < 5000UL) return;
  lastSocketReconnect = millis();
  webSocket.begin(WS_HOST, WS_PORT, WS_PATH);
  webSocket.setReconnectInterval(5000);
  webSocket.onEvent(onSocketEvent);
}

void pushStatus() {
  if (millis() - lastStatusPush < 30000UL) return;
  lastStatusPush = millis();

  DynamicJsonDocument doc(512);
  doc["online"] = true;
  doc["batteryPercentage"] = readBatteryPercentage();
  doc["firmwareVersion"] = "1.0.0";
  doc["gpsSignal"] = false;
  doc["wifiStrength"] = WiFi.RSSI();
  doc["helmetWorn"] = helmetWorn;
  doc["ridingMode"] = helmetWorn;
  doc["sensors"]["shock"] = digitalRead(SHOCK_PIN) == LOW;
  doc["sensors"]["fsrRaw"] = analogRead(FSR_PIN);
  postJson("/device/status", doc);
}

void startAccidentCountdown() {
  countdownActive = true;
  countdownStart = millis();
  digitalWrite(LED_PIN, HIGH);
  tone(BUZZER_PIN, 2000);
}

void sendFalseAlarmEvent() {
  DynamicJsonDocument doc(512);
  doc["type"] = "false_alarm";
  doc["severity"] = "low";
  doc["batteryPercentage"] = readBatteryPercentage();
  doc["location"]["lat"] = 0.0;
  doc["location"]["lng"] = 0.0;
  doc["location"]["source"] = "unknown";
  doc["metadata"]["cancelledByButton"] = true;
  postJson("/device/accidents", doc);
}

void cancelCountdown() {
  countdownActive = false;
  digitalWrite(LED_PIN, LOW);
  noTone(BUZZER_PIN);
  sendFalseAlarmEvent();
}

void sendEmergencyAlert(const char* type) {
  DynamicJsonDocument doc(768);
  doc["type"] = type;
  doc["severity"] = String(type) == "manual_sos" ? "medium" : "severe";
  doc["batteryPercentage"] = readBatteryPercentage();
  doc["location"]["lat"] = 24.8607;
  doc["location"]["lng"] = 67.0011;
  doc["location"]["source"] = "gps";
  doc["metadata"]["helmetWorn"] = helmetWorn;
  doc["metadata"]["bluetoothCallSupport"] = settings.bluetoothCallSupport;
  postJson("/device/accidents", doc);
}

void handleButtons() {
  if (digitalRead(BUTTON_CANCEL_PIN) == LOW && countdownActive) {
    cancelCountdown();
    delay(250);
  }

  if (digitalRead(BUTTON_SOS_PIN) == LOW) {
    if (sosPressStart == 0) sosPressStart = millis();
    if ((millis() - sosPressStart) >= (unsigned long)settings.sosHoldSeconds * 1000UL) {
      sendEmergencyAlert("manual_sos");
      sosPressStart = 0;
      delay(500);
    }
  } else {
    sosPressStart = 0;
  }
}

void handleImpact() {
  if (!helmetWorn || countdownActive) return;
  if (digitalRead(SHOCK_PIN) == LOW) {
    startAccidentCountdown();
    delay(settings.impactDebounceMs);
  }
}

void updateHelmetWearState() {
  helmetWorn = analogRead(FSR_PIN) >= settings.helmetWearThreshold;
}

void setup() {
  pinMode(SHOCK_PIN, INPUT);
  pinMode(BUTTON_CANCEL_PIN, INPUT_PULLUP);
  pinMode(BUTTON_SOS_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);

  loadWifiCredentials();
  if (!connectToSavedWifi()) {
    setupCaptivePortal();
  } else {
    authenticateDevice();
    ensureSocketConnected();
  }
}

void loop() {
  updateHelmetWearState();
  handleButtons();
  handleImpact();
  pushStatus();

  if (WiFi.status() == WL_CONNECTED) {
    webSocket.loop();
    if (!socketAuthenticated) ensureSocketConnected();
  }

  if (WiFi.status() == WL_CONNECTED && !deviceToken.isEmpty() && millis() - lastSettingsSync > 300000UL) {
    syncSettings();
  }

  if (countdownActive) {
    unsigned long elapsed = millis() - countdownStart;
    if (elapsed >= (unsigned long)settings.accidentCountdownSeconds * 1000UL) {
      countdownActive = false;
      noTone(BUZZER_PIN);
      sendEmergencyAlert("impact");
    }
    digitalWrite(LED_PIN, (millis() / 300) % 2);
  }

  if (WiFi.getMode() == WIFI_AP) {
    server.handleClient();
  }

  if (WiFi.status() != WL_CONNECTED && !savedSsid.isEmpty()) {
    connectToSavedWifi();
    if (WiFi.status() == WL_CONNECTED) {
      if (deviceToken.isEmpty()) authenticateDevice();
      ensureSocketConnected();
    }
  }
}
