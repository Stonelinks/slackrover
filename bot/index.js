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
    func: takeAndSendPicture
  }
]

let commandMap = {}
for (var i = 0; i < commands.length; i++) {
  command = commands[i]
  commandMap[command.char] = command
}

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

  controller.hears('eval', listen, function (bot, message) {
    var matches = message.text.match(/eval (.*)/i);
    if (!matches) {
      bot.reply(message, 'http://i0.kym-cdn.com/photos/images/facebook/000/057/035/NOPE.jpg')
    } else {
      try {
        bot.reply(message, eval(matches[1]))
      } catch (e) {
        console.log(e)
        bot.reply(message, e.stack)
      }
    }
  })

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

  controller.hears('beep', listen, function (bot, message) {
    var matches = message.text.match(/beep\s+(.*)/i)
    if (!matches) {
      beep(600, 50)
    }

    var tonesText = matches[1]
    let durationSoFar = 0
    while (tonesText) {
      matches = tonesText.match(/(\d+\.?\d*)\s+(\d+\.?\d*)(?:\s+(.*))?/i)
      if (!matches) {
        return
      }
      let frequency = matches[1]
      let duration = matches[2]
      tonesText = matches[3]
      durationSoFar += parseInt(duration)
      setTimeout(function () {
        if (parseInt(frequency)) {
          beep(frequency, duration)
        }
      }, durationSoFar)
    }
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
    let hasValidCommand = false
    for (var i = 0; i < message.text.length; i++) {
      const char = message.text[i].toLowerCase()
      if (commandMap[char]) {
        hasValidCommand = true
      }
    }

    if (hasValidCommand) {
      if (message.text[message.text.length - 1] !== 'p') {
        message.text += 'p'
      }
      message.text += 'k'
    }

    let delaysSoFar = 0
    var text = message.text
    while (text) {
      var matches = text.match(/(\w)(\d+)?(.*)/i)
      if (!matches) {
        return
      }
      let command = commandMap[matches[1].toLowerCase()]
      let multiplier = Math.min(parseInt(matches[2]) || 1, 20)
      text = matches[3]
      if (command) {
        for (var i = 0; i < multiplier; i++) {
          setTimeout(function () {
            command.func(message)
          }, delaysSoFar)
          delaysSoFar += command.delay || 0
        }
      }
    }
  })

  init()
})

function init() {
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
  if (uptime !== 1) {
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

let isCapturing = false
const _takeAndSendPicture = _.throttle(function (message) {
  const _sendFile = _.throttle(function () {
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
  }, 1000)

  if (!isCapturing) {
    isCapturing = true
    Webcam.capture(imageLocation, function (err, location) {
      if (err) {
        console.error(err)
      }
      isCapturing = false
      _sendFile()
    })
  } else {
    _sendFile()
  }
}, 1000)

function takeAndSendPicture(message) {
  setTimeout(function () {
    _takeAndSendPicture(message)
  }, motorDelay)
}