#include <SoftwareSerial.h>

// Connect HC-05 TX to Arduino Pin 10, HC-05 RX to Arduino Pin 11
SoftwareSerial BTSerial(10, 11); 

void setup() {
  Serial.begin(9600);
  BTSerial.begin(9600); // Default HC-05 baud rate
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.println("HC-05 Ready");
}

void loop() {
  if (BTSerial.available()) {
    String cmd = BTSerial.readStringUntil('\n');
    cmd.trim();
    Serial.print("Received: ");
    Serial.println(cmd);

    if (cmd == "L1") {
      digitalWrite(LED_BUILTIN, HIGH);
      BTSerial.println("LED ON");
    } else if (cmd == "F") {
      BTSerial.println("Moving Forward");
    } else if (cmd == "B") {
      BTSerial.println("Moving Backward");
    } else if (cmd == "L") {
      BTSerial.println("Turning Left");
    } else if (cmd == "R") {
      BTSerial.println("Turning Right");
    } else if (cmd == "S") {
      digitalWrite(LED_BUILTIN, LOW);
      BTSerial.println("Stopped");
    }
  }
}
