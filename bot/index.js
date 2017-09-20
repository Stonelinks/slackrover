var os = require('os')
var fs = require('fs')
var _ = require('underscore')

var Botkit = require('botkit')

var NodeWebcam = require("node-webcam")

var Webcam = NodeWebcam.create({

  // width: 1280,
  width: 640,
  // height: 720,
  height: 480,

  quality: 50,

  // Save shots in memory 
  saveShots: false,

  // [jpeg, png] support varies 
  // Webcam.OutputTypes 
  output: "jpeg",

  // Which camera to use 
  // Use Webcam.list() for results 
  // false for default device 
  device: false,

  // [location, buffer, base64] 
  // Webcam.CallbackReturnTypes 
  callbackReturn: "location",
  verbose: true
})

const imageLocation = './latest.jpg'

var SerialPort = require('serialport')
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

const commands = [
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
  {
    desc: 'Send picture',
    char: 'p',
    func: sendPicture
  }
]

// Expect a SLACK_TOKEN environment variable
var slackToken = process.env.SLACK_TOKEN
if (!slackToken) {
  console.error('SLACK_TOKEN is required!')
  process.exit(1)
}

const listen = ['ambient']

var controller = Botkit.slackbot()

controller.setupWebserver(process.env.PORT || 8080)
var bot = controller.spawn({
  token: slackToken
})

var SlackUpload = require('node-slack-upload')
var slackUpload = new SlackUpload(slackToken)

bot.startRTM(function (err, bot, payload) {
  if (err) {
    throw new Error('Could not connect to Slack')
  }

  controller.hears(['uptime', 'stats'], listen, function (bot, message) {
    var hostname = os.hostname()
    var uptime = formatUptime(process.uptime())
    bot.reply(message, `:robot_face: I am a bot named <@${bot.identity.name}>. I have been running for ${uptime} on ${hostname}.`)
  })

  controller.hears('help.*', listen, function (bot, message) {
    let msg = 'Send me sequences of the following commands to do stuff:\n'
    commands.forEach(function (o) {
      msg += `- '${o.char}': ${o.desc}\n`
    })
    bot.reply(message, msg)
  })

  controller.hears(['beep'], listen, function (bot, message) {
    beep(600, 50)
  })

  controller.hears(['fast'], listen, function (bot, message) {
    generateMoveFunc(function () {
      move(motorSpeedForwardFast, motorSpeedForwardFast)
    }, motorDelay * 5)()
  })

  controller.hears('.*', ['direct_message', 'direct_mention'], function (bot, message) {
    let msg = 'I don\'t respond to this. Please go on the #rover channel to use me'
    bot.reply(message, msg)
  })

  controller.hears('.*', listen, function (bot, message) {
    let delaysSoFar = 0
    if (message.text[message.text.length - 1] !== 'p') {
      message.text += 'p'
    }
    message.text += 'k'
    for (var i = 0; i < message.text.length; i++) {
      const char = message.text[i].toLowerCase()
      commands.forEach(function (o) {
        if (o.char === char) {
          setTimeout(function () {
            o.func(message)
          }, delaysSoFar)
          if (o.delay) {
            delaysSoFar += o.delay
          }
        }
      })
    }
  })

  init()
})

function init () {
  stopMovement()
  beep(600, 30)
  console.log('booted')
}

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

function beep(freq, duration) {
  radio.write(`b${freq},${duration}\n`, function (err) {
    if (err) {
      return console.log('Error on write: ', err.message)
    }
    console.log(`sent beep command: ${freq}, ${duration}`)
  })
}

function move(motor1, motor2) {
  radio.write(`m${motor1},${motor2}\n`, function (err) {
    if (err) {
      return console.log('Error on write: ', err.message)
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

const _takePicture = _.throttle(function (message) {
  Webcam.capture(imageLocation, function (err, location) {
    if (err) {
      console.error(err)
    }
  })
}, 1000)

function sendPicture(message) {
  _takePicture(message)
  setTimeout(function () {
    slackUpload.uploadFile({
      file: fs.createReadStream(imageLocation),
      filetype: 'image',
      // title: 'README',
      // initialComment: 'my comment',
      channels: message.channel
    }, function (err, data) {
      if (err) {
        console.error(err)
      } else {
        console.log('uploaded picture')
      }
    })
  })
}