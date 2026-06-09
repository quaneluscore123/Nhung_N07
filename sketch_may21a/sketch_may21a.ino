#include <SPI.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Keypad.h>
#include <ESP32Servo.h> 
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#define SCREEN_WIDTH 128 
#define SCREEN_HEIGHT 64 
#define OLED_RESET     -1 
#define SCREEN_ADDRESS 0x3C 
#define OLED_SDA 21 
#define OLED_SCL 22 
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// --- CẤU HÌNH WIFI & SERVER ---
const char* ssid = "PSG";
const char* password = "123abc123";
// Thay đổi IP này thành IP IPv4 máy tính của bạn khi chạy backend (VD: 192.168.1.100)
const String SERVER_URL = "http://192.168.100.92:3000"; 

// --- CẤU HÌNH SERVO ---
Servo servoBox1; 
Servo servoBox2; 
const int servo1Pin = 13; 
const int servo2Pin = 14; 

const int angleClosed = 10; 
const int angleOpen = 100;  

// --- CẤU HÌNH BÀN PHÍM KEYPAD 4x4 ---
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

// --- QUẢN LÝ TRẠNG THÁI ---
enum SmartLockerState {
  STATE_IDLE,
  STATE_DELIVERY_INPUT,
  STATE_PICKUP_INPUT,
  STATE_BOX_OPENING
};
SmartLockerState currentState = STATE_IDLE;
String inputBuffer = ""; 

// ==========================================
// CÁC HÀM TRỢ GIÚP
// ==========================================

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
    display.println(F("WiFi: OK"));
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

// Hàm mở khóa CẢI TIẾN: Chống giật Servo
void openBox(int boxNumber) {
  if (boxNumber == 1) {
    displayMessage("BOX 1", "DANG MO CUA...");
    servoBox1.attach(servo1Pin, 500, 2400); 
    servoBox1.write(angleOpen); 
    delay(5000); 
    
    displayMessage("DONG CUA", "DANG KHOA BOX 1...");
    servoBox1.write(angleClosed); 
    delay(1000); 
    servoBox1.detach(); 

  } else if (boxNumber == 2) {
    displayMessage("BOX 2", "DANG MO CUA...");
    servoBox2.attach(servo2Pin, 500, 2400);
    servoBox2.write(angleOpen);
    delay(5000);
    
    displayMessage("DONG CUA", "DANG KHOA BOX 2...");
    servoBox2.write(angleClosed);
    delay(1000);
    servoBox2.detach(); 
  }
  
  currentState = STATE_IDLE; 
  displayMainMenu(); 
}

void verifyCode(String type, String code) {
  if (WiFi.status() != WL_CONNECTED) {
    displayMessage("LOI MANG", "Khong co WiFi!");
    currentState = STATE_IDLE;
    displayMainMenu();
    return;
  }

  displayMessage("DANG XU LY", "Kiem tra ma tren Server...");
  
  HTTPClient http;
  String url = (type == "delivery") ? (SERVER_URL + "/api/locker/verify-delivery") : (SERVER_URL + "/api/locker/verify-pickup");
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  // Tạo JSON payload
  StaticJsonDocument<200> doc;
  doc["code"] = code;
  String requestBody;
  serializeJson(doc, requestBody);

  int httpResponseCode = http.POST(requestBody);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println(response);
    
    StaticJsonDocument<500> responseDoc;
    DeserializationError error = deserializeJson(responseDoc, response);
    
    if (!error && responseDoc["success"] == true) {
      int boxToOpen = responseDoc["boxNumber"];
      displayMessage("THANH CONG", "Ma hop le!");
      openBox(boxToOpen);
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

// ==========================================
// CÁC HÀM CHÍNH 
// ==========================================

void setup() {
  Serial.begin(115200);
  Wire.begin(OLED_SDA, OLED_SCL);

  if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println(F("Khong tim thay OLED SSD1306"));
    for(;;); 
  }
  
  display.setTextColor(SSD1306_WHITE); // FIX: Set text color before drawing anything
  displayMessage("KHOI DONG", "Dang ket noi WiFi...");
  
  WiFi.begin(ssid, password);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  displayMainMenu(); 

  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  servoBox1.setPeriodHertz(50); 
  servoBox2.setPeriodHertz(50);
  
  servoBox1.attach(servo1Pin, 500, 2400); 
  servoBox1.write(angleClosed);
  delay(500);
  servoBox1.detach();

  servoBox2.attach(servo2Pin, 500, 2400);
  servoBox2.write(angleClosed);
  delay(500);
  servoBox2.detach();

  Serial.println(F("He thong tu do thong minh da san sang!"));
}

void loop() {
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
          if (inputBuffer.length() < 4) { 
            inputBuffer += customKey;
            displayInputScreen("MA GIAO HANG:", inputBuffer.length());
          }
        } 
        else if (customKey == '#') {
          currentState = STATE_BOX_OPENING;
          verifyCode("delivery", inputBuffer);
          inputBuffer = ""; 
        }
        else if (customKey == '*') {
          inputBuffer = "";
          displayInputScreen("MA GIAO HANG:", 0);
        }
        break;

      case STATE_PICKUP_INPUT:
        if (customKey >= '0' && customKey <= '9') {
          if (inputBuffer.length() < 4) {
            inputBuffer += customKey;
            displayInputScreen("MA NHAN HANG:", inputBuffer.length());
          }
        }
        else if (customKey == '#') {
          currentState = STATE_BOX_OPENING;
          verifyCode("pickup", inputBuffer);
          inputBuffer = "";
        }
        else if (customKey == '*') {
          inputBuffer = "";
          displayInputScreen("MA NHAN HANG:", 0);
        }
        break;
        
      case STATE_BOX_OPENING:
        break;
    }
  }
}