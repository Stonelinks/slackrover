/**
 * Created by ld on 2/8/16.
 */
var os = require('os')

var Botkit = require('botkit')

var SerialPort = require('serialport');
var radio = new SerialPort('/dev/ttyUSB0', {
  baudRate: 57600
})

// motors can go -255 to 255
const motorSpeedForward = 100
const motorSpeedForwardFast = 200
const motorSpeedStopped = 0
const motorSpeedBackward = -100
const motorDelay = 250
const motorTurnDelay = 150

const movements = [
  {
    desc: 'Move forward',
    char: 'w',
    // func: generateMoveFunc(startForward, motorDelay),
    func: startForward,
    delay: motorDelay,
  },
  {
    desc: 'Move backward',
    char: 's',
    // func: generateMoveFunc(startBackward, motorDelay),
    func: startBackward,
    delay: motorDelay,
  },
  {
    desc: 'Move left',
    char: 'a',
    // func: generateMoveFunc(startLeft, motorTurnDelay),
    func: startLeft,
    delay: motorTurnDelay
  },
  {
    desc: 'Move right',
    char: 'd',
    // func: generateMoveFunc(startRight, motorTurnDelay),
    func: startRight,
    delay: motorTurnDelay
  },
  {
    desc: 'Stop',
    char: 'k',
    func: stopMovement,
  },
]

// Expect a SLACK_TOKEN environment variable
var slackToken = process.env.SLACK_TOKEN
if (!slackToken) {
  console.error('SLACK_TOKEN is required!')
  process.exit(1)
}

var controller = Botkit.slackbot()

controller.setupWebserver(process.env.PORT || 8080)
var bot = controller.spawn({
  token: slackToken
})

bot.startRTM(function (err, bot, payload) {
  if (err) {
    throw new Error('Could not connect to Slack')
  }

  controller.hears(['uptime', 'stats',], ['direct_message', 'direct_mention', 'mention'], function (bot, message) {
    var hostname = os.hostname();
    var uptime = formatUptime(process.uptime());
    bot.reply(message, `:robot_face: I am a bot named <@${bot.identity.name}>. I have been running for ${uptime} on ${hostname}.`);
  })

  controller.hears('help.*', ['direct_message', 'direct_mention'], function (bot, message) {
    let msg = 'Send me sequences of the following commands to move:\n'
    movements.forEach(function (o) {
      msg += `- '${o.char}': ${o.desc}\n`
    })
    bot.reply(message, msg)
  })

  controller.hears(['fast'], ['direct_message', 'direct_mention', 'mention'], function (bot, message) {
    generateMoveFunc(function() {
      move(motorSpeedForwardFast, motorSpeedForwardFast)
    }, motorDelay * 5)()
  })

  controller.hears('.*', ['direct_message', 'direct_mention'], function (bot, message) {
    let delaysSoFar = 0
    message.text += 'k'
    for (var i = 0; i < message.text.length; i++) {
      const char = message.text[i].toLowerCase()
      movements.forEach(function (o) {
        if (o.char === char) {
          setTimeout(function () {
            o.func()
            // bot.reply(message, o.desc)
          }, delaysSoFar)
          if (o.delay) {
            delaysSoFar += o.delay
          }
        }
      })
    }
  })

  console.log('booted')
})

function formatUptime(uptime) {
  var unit = 'second'
  if (uptime > 60) {
    uptime = uptime / 60
    unit = 'minute'
  }
  if (uptime > 60) {
    uptime = uptime / 60
    unit = 'hour'
  }
  if (uptime != 1) {
    unit = unit + 's'
  }

  uptime = uptime + ' ' + unit
  return uptime
}

function move(motor1, motor2) {
  radio.write(`m${motor1},${motor2}\n`, function (err) {
    if (err) {
      return console.log('Error on write: ', err.message);
    }
    console.log(`sent move command: ${motor1}, ${motor2}`)
  })
}

function startForward() {
  move(motorSpeedForward, motorSpeedForward)
}

function startBackward() {
  move(motorSpeedBackward, motorSpeedBackward)
}

function startLeft() {
  move(motorSpeedStopped, motorSpeedForward)
}

function startRight() {
  move(motorSpeedForward, motorSpeedStopped)
}

function stopMovement() {
  move(motorSpeedStopped, motorSpeedStopped)
}

function generateMoveFunc(movementFunc, delay) {
  return function () {
    movementFunc()
    setTimeout(function () {
      stopMovement()
    }, delay)
  }
}

// TODO
// camera
// tween
// buzzer
