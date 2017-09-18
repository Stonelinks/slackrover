#include <OrangutanMotors.h>
#include <OrangutanLCD.h>
#include <OrangutanBuzzer.h>

#include <SoftwareSerial.h>

OrangutanLCD lcd;
OrangutanMotors motors;
OrangutanBuzzer buzzer;

// RX (PD1), TX (PD0)
// https://www.pololu.com/docs/0J17/all
SoftwareSerial radio(1, 0);

// motors can go -255 to 255
const int motorSpeedForward = 100;
const int motorSpeedStopped = 0;
const int motorSpeedBackward = -100;
const int motorDelay = 250;
const int motorTurnDelay = 200;

void moveMotors(int motor1Speed, int motor2Speed) {
  // avoid clearing the LCD to reduce flicker
  lcd.gotoXY(0, 0);
  lcd.print("m1=");
  lcd.print(motor1Speed);
  lcd.print("   ");

  lcd.gotoXY(0, 1);
  lcd.print("m2=");
  lcd.print(motor2Speed);
  lcd.print("    ");
  
  motors.setSpeeds(motor1Speed, motor2Speed);
}

void forward() {
  moveMotors(motorSpeedForward, motorSpeedForward);
  delay(motorDelay);
  stop();
}

void backward() {
  moveMotors(motorSpeedBackward, motorSpeedBackward);
  delay(motorDelay);
  stop();
}

void left() {
  moveMotors(motorSpeedBackward, motorSpeedForward);
  delay(motorTurnDelay);
  stop();
}

void right() {
  moveMotors(motorSpeedForward, motorSpeedBackward);
  delay(motorTurnDelay);
  stop();
}

void stop() {
  moveMotors(motorSpeedStopped, motorSpeedStopped);
}

void ack() {
  radio.println("ack");
}

void hello() {
  radio.println("hello");
}

void setup()
{
  radio.begin(57600);
  radio.setTimeout(-1);
  hello();
}

void loop()
{ 
  switch(radio.read()) {
    case 'w':
      forward();
      ack();
      break;
    case 's':
      backward();
      ack();
      break;
    case 'a':
      left();
      ack();
      break;
    case 'd':
      right();
      ack();
      break;
    case 'q':
      stop();
      ack();
      break;
    case 'm':
    {
      int motor1Speed = radio.parseInt();
      int motor2Speed = radio.parseInt();
      moveMotors(motor1Speed, motor2Speed);
      ack();
      break;
    }
    case 'b':
    {
      int freq = radio.parseInt();
      int duration = radio.parseInt();
      if (buzzer.isPlaying())
      {
        buzzer.stopPlaying();
      }
      buzzer.playFrequency(freq, duration, 15);
      ack();
      break;
    }
    case 'n':
    {
      if (buzzer.isPlaying())
      {
        buzzer.stopPlaying();
      }
      ack();
      break;
    }
    case -1:
    default:
      break;
  }
}
