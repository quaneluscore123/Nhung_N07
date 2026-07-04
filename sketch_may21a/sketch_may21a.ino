#include <SPI.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Keypad.h>
#include <ESP32Servo.h> 
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WebSocketsClient.h>

#define SCREEN_WIDTH 128 
#define SCREEN_HEIGHT 64 
#define OLED_RESET     -1 
#define SCREEN_ADDRESS 0x3C 
#define OLED_SDA 21 
#define OLED_SCL 22 
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// const char* ssid = "realme C85 p5if";
// const char* password = "88888888";
// const String SERVER_URL = "http://10.212.238.220:3000"; 
// const char* WS_HOST = "10.212.238.220";
const char* ssid = "PSG";
const char* password = "123abc123";
const String SERVER_URL = "http://192.168.100.92:3000"; 
const char* WS_HOST = "192.168.100.92";
const int WS_PORT = 3000;

Servo servoBox1; 
Servo servoBox2; 
const int servo1Pin = 13; 
const int servo2Pin = 12; 

const int angleClosed = 10; 
const int angleOpen = 130;  

const byte ROWS = 4; 
const byte COLS = 4; 
char keys[ROWS][COLS] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};

byte rowPins[ROWS] = {25, 23, 19, 18};   
byte colPins[COLS] = {5, 4, 26, 32}; 

Keypad myKeypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

enum SmartLockerState {
  STATE_IDLE,
  STATE_DELIVERY_INPUT,
  STATE_PICKUP_INPUT,
  STATE_BOX_OPENING
};
SmartLockerState currentState = STATE_IDLE;
String inputBuffer = ""; 

WebSocketsClient webSocket;
bool wsConnected = false;

#define MAX_SYNC_ENTRIES 10
struct SyncEntry {
  int cabinetPin;
  String otpCode;
};
SyncEntry syncData[MAX_SYNC_ENTRIES];
int syncDataCount = 0;

#define MAX_LOG_QUEUE 10
struct LogEntry {
  int cabinetPin;
};
LogEntry logQueue[MAX_LOG_QUEUE];
int logQueueCount = 0;

String macAddress = "";

void displayMainMenu() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(10, 0);
  display.println(F("-- SMART LOCKER --")); 

  display.setTextSize(1);
  display.setCursor(0, 20);
  display.println(F("Phim A: Giao hang"));
  
  display.setCursor(0, 35);
  display.println(F("Phim B: Nhan hang"));
  
  if (WiFi.status() == WL_CONNECTED) {
    display.setCursor(0, 50);
    display.print(F("WiFi: OK"));
    if (wsConnected) {
      display.print(F(" | WS: OK"));
    }
  } else {
    display.setCursor(0, 50);
    display.println(F("WiFi: Khong ket noi!"));
  }
  
  display.display();
}

void displayInputScreen(String prompt, int len) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println(prompt);

  display.setTextSize(2); 
  display.setCursor(10, 25);
  
  for(int i=0; i<len; i++) {
    display.print("*");
  }
  
  display.setTextSize(1);
  display.setCursor(0, 55);
  display.println(F("[#] Xac nhan | [*] Xoa"));
  display.display();
}

void displayMessage(String title, String msg, int delayTime = 2000) {
  display.clearDisplay();
  display.setTextSize(2);
  display.setCursor(20, 10);
  display.println(title);
  
  display.setTextSize(1);
  display.setCursor(10, 35);
  display.println(msg);
  
  display.display();
  delay(delayTime);
}

void openBoxByPin(int pin) {
  displayMessage("MO TU", "DANG MO CUA...");
  Serial.print("[SERVO] Dang mo pin: ");
  Serial.println(pin);
  
  if (pin == servo1Pin) {
    servoBox1.attach(servo1Pin, 500, 2400); 
    delay(100);
    servoBox1.write(angleOpen); 
    delay(5000); 
    displayMessage("DONG CUA", "DANG KHOA TU...");
    servoBox1.write(angleClosed); 
    delay(1500); 
    servoBox1.detach();
    delay(100);
  } else if (pin == servo2Pin) {
    servoBox2.attach(servo2Pin, 500, 2400);
    delay(100);
    servoBox2.write(angleOpen);
    delay(5000);
    displayMessage("DONG CUA", "DANG KHOA TU...");
    servoBox2.write(angleClosed);
    delay(1500);
    servoBox2.detach();
    delay(100);
  } else {
    Serial.print("[SERVO] Pin khong hop le: ");
    Serial.println(pin);
  }
  
  currentState = STATE_IDLE; 
  displayMainMenu(); 
}

void openBox(int boxNumber) {
  if (boxNumber == 1) {
    openBoxByPin(servo1Pin);
  } else if (boxNumber == 2) {
    openBoxByPin(servo2Pin);
  }
}

void verifyDelivery(String code) {
  if (WiFi.status() != WL_CONNECTED) {
    displayMessage("LOI MANG", "Khong co WiFi!");
    currentState = STATE_IDLE;
    displayMainMenu();
    return;
  }

  displayMessage("DANG XU LY", "Kiem tra ma tren Server...");
  
  HTTPClient http;
  String url = SERVER_URL + "/api/locker/verify-delivery";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<200> doc;
  doc["code"] = code;
  doc["macAddress"] = macAddress;
  String requestBody;
  serializeJson(doc, requestBody);

  int httpResponseCode = http.POST(requestBody);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println(response);
    
    StaticJsonDocument<500> responseDoc;
    DeserializationError error = deserializeJson(responseDoc, response);
    
    if (!error && responseDoc["success"] == true) {
      int cabinetPin = responseDoc["cabinetPin"] | 0;
      int boxNumber = responseDoc["boxNumber"] | 0;
      displayMessage("THANH CONG", "Ma hop le!");
      
      if (cabinetPin > 0) {
        openBoxByPin(cabinetPin);
      } else if (boxNumber > 0) {
        openBox(boxNumber);
      }
      
      // Sau khi giao hàng, đồng bộ lại dữ liệu
      syncDataFromServer();
    } else {
      displayMessage("LOI", "MA KHONG HOP LE!");
      delay(2000);
      currentState = STATE_IDLE;
      displayMainMenu();
    }
  } else {
    displayMessage("LOI KET NOI", "Khong the toi Server");
    delay(2000);
    currentState = STATE_IDLE;
    displayMainMenu();
  }
  
  http.end();
}

void verifyPickup(String code) {
  if (WiFi.status() == WL_CONNECTED) {
    verifyPickupOnline(code);
    return;
  }
  
  for (int i = 0; i < syncDataCount; i++) {
    if (syncData[i].otpCode == code) {
      int pin = syncData[i].cabinetPin;
      displayMessage("THANH CONG", "Ma hop le! (Offline)");
      
      for (int j = i; j < syncDataCount - 1; j++) {
        syncData[j] = syncData[j + 1];
      }
      syncDataCount--;
      
      if (logQueueCount < MAX_LOG_QUEUE) {
        logQueue[logQueueCount].cabinetPin = pin;
        logQueueCount++;
      }
      
      openBoxByPin(pin);
      syncLogsToServer();
      return;
    }
  }
  
  displayMessage("LOI", "MA KHONG HOP LE!");
  delay(2000);
  currentState = STATE_IDLE;
  displayMainMenu();
}

void verifyPickupOnline(String code) {
  displayMessage("DANG XU LY", "Kiem tra ma tren Server...");
  
  HTTPClient http;
  String url = SERVER_URL + "/api/locker/verify-pickup";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<200> doc;
  doc["code"] = code;
  doc["macAddress"] = macAddress;
  String requestBody;
  serializeJson(doc, requestBody);

  int httpResponseCode = http.POST(requestBody);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println(response);
    
    StaticJsonDocument<500> responseDoc;
    DeserializationError error = deserializeJson(responseDoc, response);
    
    if (!error && responseDoc["success"] == true) {
      int cabinetPin = responseDoc["cabinetPin"] | 0;
      int boxNumber = responseDoc["boxNumber"] | 0;
      displayMessage("THANH CONG", "Ma hop le!");
      
      if (cabinetPin > 0) {
        openBoxByPin(cabinetPin);
      } else if (boxNumber > 0) {
        openBox(boxNumber);
      }
    } else {
      displayMessage("LOI", "MA KHONG HOP LE!");
      delay(2000);
      currentState = STATE_IDLE;
      displayMainMenu();
    }
  } else {
    displayMessage("LOI KET NOI", "Khong the toi Server");
    delay(2000);
    currentState = STATE_IDLE;
    displayMainMenu();
  }
  
  http.end();
}

void syncDataFromServer() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  String url = SERVER_URL + "/api/sync-data?macAddress=" + macAddress;
  http.begin(url);
  
  int httpResponseCode = http.GET();
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    
    StaticJsonDocument<1024> doc;
    DeserializationError error = deserializeJson(doc, response);
    
    if (!error) {
      JsonArray arr = doc.as<JsonArray>();
      syncDataCount = 0;
      
      for (JsonObject entry : arr) {
        if (syncDataCount < MAX_SYNC_ENTRIES) {
          syncData[syncDataCount].cabinetPin = entry["cabinetPin"];
          syncData[syncDataCount].otpCode = entry["otpCode"].as<String>();
          syncDataCount++;
        }
      }
      
      Serial.print("[SYNC] Received ");
      Serial.print(syncDataCount);
      Serial.println(" entries from server");
    }
  }
  
  http.end();
}

void syncLogsToServer() {
  if (WiFi.status() != WL_CONNECTED || logQueueCount == 0) return;
  
  for (int i = 0; i < logQueueCount; i++) {
    HTTPClient http;
    String url = SERVER_URL + "/api/sync-from-esp";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    
    StaticJsonDocument<200> doc;
    doc["macAddress"] = macAddress;
    doc["cabinetPin"] = logQueue[i].cabinetPin;
    String requestBody;
    serializeJson(doc, requestBody);
    
    int httpResponseCode = http.POST(requestBody);
    
    if (httpResponseCode > 0) {
      String response = http.getString();
      StaticJsonDocument<200> responseDoc;
      deserializeJson(responseDoc, response);
      
      if (responseDoc["success"] == true) {
        Serial.print("[SYNC-UP] Log synced for pin ");
        Serial.println(logQueue[i].cabinetPin);
      }
    }
    
    http.end();
  }
  
  logQueueCount = 0;
}

void handleServerMessage(String payload) {
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, payload);
  
  if (error) {
    Serial.print("[WS] JSON parse error: ");
    Serial.println(error.c_str());
    return;
  }
  
  if (doc.containsKey("cabinetPin")) {
    int cabinetPin = doc["cabinetPin"];
    Serial.print("[WS] Open cabinet command, pin: ");
    Serial.println(cabinetPin);
    openBoxByPin(cabinetPin);
  }
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      wsConnected = false;
      Serial.println("[WS] Disconnected!");
      break;
      
    case WStype_CONNECTED:
      wsConnected = true;
      Serial.println("[WS] Connected to server!");
      {
        String registerMsg = "{\"type\":\"register_device\",\"macAddress\":\"" + macAddress + "\"}";
        webSocket.sendTXT(registerMsg);
        Serial.println("[WS] Sent device registration");
      }
      syncDataFromServer();
      syncLogsToServer();
      break;
      
    case WStype_TEXT:
      {
        String message = String((char*)payload);
        Serial.print("[WS] Received: ");
        Serial.println(message);
        
        if (message.indexOf("open_cabinet") >= 0 || message.indexOf("cabinetPin") >= 0) {
          handleServerMessage(message);
        }
        if (message.indexOf("sync_request") >= 0) {
          syncDataFromServer();
        }
      }
      break;
      
    case WStype_PING:
      break;
    case WStype_PONG:
      break;
  }
}

void setup() {
  Serial.begin(115200);
  
  pinMode(servo1Pin, OUTPUT);
  pinMode(servo2Pin, OUTPUT);
  digitalWrite(servo1Pin, LOW);
  digitalWrite(servo2Pin, LOW);
  
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  servoBox1.setPeriodHertz(50); 
  servoBox2.setPeriodHertz(50);
  
  servoBox1.attach(servo1Pin, 500, 2400); 
  servoBox1.write(angleClosed);
  delay(1000);
  servoBox1.detach();
  delay(200);

  servoBox2.attach(servo2Pin, 500, 2400);
  servoBox2.write(angleClosed);
  delay(1000);
  servoBox2.detach();
  delay(200);

  // Khởi tạo OLED
  Wire.begin(OLED_SDA, OLED_SCL);

  if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println(F("Khong tim thay OLED SSD1306"));
    for(;;); 
  }
  
  display.setTextColor(SSD1306_WHITE);
  displayMessage("KHOI DONG", "Dang ket noi WiFi...");
  
  WiFi.begin(ssid, password);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  macAddress = WiFi.macAddress();
  macAddress.replace(":", "");  
  String formattedMac = "";
  for (int i = 0; i < macAddress.length(); i++) {
    formattedMac += macAddress[i];
    if (i % 2 == 1 && i < macAddress.length() - 1) {
      formattedMac += ":";
    }
  }
  macAddress = formattedMac; 
  Serial.print("MAC Address: ");
  Serial.println(macAddress);

  if (WiFi.status() == WL_CONNECTED) {
    webSocket.begin(WS_HOST, WS_PORT, "/socket.io/?EIO=4&transport=websocket");
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(5000);
    
    syncDataFromServer();
  }

  displayMainMenu(); 
  Serial.println(F("He thong tu do thong minh da san sang!"));
}

void loop() {
  webSocket.loop();
  
  char customKey = myKeypad.getKey();
  
  if (customKey) {
    Serial.print("Phim bam: "); Serial.println(customKey);
    
    switch (currentState) {
      
      case STATE_IDLE:
        if (customKey == 'A') {
          currentState = STATE_DELIVERY_INPUT;
          inputBuffer = ""; 
          displayInputScreen("MA GIAO HANG:", 0);
        } else if (customKey == 'B') {
          currentState = STATE_PICKUP_INPUT;
          inputBuffer = "";
          displayInputScreen("MA NHAN HANG:", 0);
        }
        break;

      case STATE_DELIVERY_INPUT:
        if (customKey >= '0' && customKey <= '9') {
          if (inputBuffer.length() < 6) { 
            inputBuffer += customKey;
            displayInputScreen("MA GIAO HANG:", inputBuffer.length());
          }
        } 
        else if (customKey == '#') {
          currentState = STATE_BOX_OPENING;
          verifyDelivery(inputBuffer);
          inputBuffer = ""; 
        }
        else if (customKey == '*') {
          inputBuffer = "";
          displayInputScreen("MA GIAO HANG:", 0);
        }
        else if (customKey == 'D') { 
          currentState = STATE_IDLE;
          inputBuffer = "";
          displayMainMenu();
        }
        break;

      case STATE_PICKUP_INPUT:
        if (customKey >= '0' && customKey <= '9') {
          if (inputBuffer.length() < 6) { 
            inputBuffer += customKey;
            displayInputScreen("MA NHAN HANG:", inputBuffer.length());
          }
        }
        else if (customKey == '#') {
          currentState = STATE_BOX_OPENING;
          verifyPickup(inputBuffer);
          inputBuffer = "";
        }
        else if (customKey == '*') {
          inputBuffer = "";
          displayInputScreen("MA NHAN HANG:", 0);
        }
        else if (customKey == 'D') { 
          currentState = STATE_IDLE;
          inputBuffer = "";
          displayMainMenu();
        }
        break;
        
      case STATE_BOX_OPENING:
        break;
    }
  }
}