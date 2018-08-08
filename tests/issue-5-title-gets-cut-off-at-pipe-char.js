const http = require('http')
const os = require('os')

const { doesResponseBodyMatch } = require('./commonFunctions')

let config = require('../config.js')

http.get(`http://${os.hostname()}:${config.port}/https/osquery.io`, async res => {
  if (await doesResponseBodyMatch(res, 'osquery | Easily ask questions about your Linux, Windows, and macOS infrastructure')) {
    console.log('everthing is fine')
  } else {
    console.error('test failed!')
  }
}).on('error', err => {
  console.error(err)
})

http.get(`http://${os.hostname()}:${config.port}/https/osquery.io/schema`, async res => {
  if (await doesResponseBodyMatch(res, 'osquery | Schema')) {
    console.log('everthing is fine')
  } else {
    console.error('test failed!')
  }
}).on('error', err => {
  console.error(err)
})

http.get(`http://${os.hostname()}:${config.port}/https/osquery.io/blog/official-news/`, async res => {
  if (await doesResponseBodyMatch(res, 'osquery | Official News')) {
    console.log('everthing is fine')
  } else {
    console.error('test failed!')
  }
}).on('error', err => {
  console.error(err)
})

http.get(`http://${os.hostname()}:${config.port}/https/osquery.io/blog/osquery-324-released`, async res => {
  if (await doesResponseBodyMatch(res, 'osquery | Blog')) {
    console.log('everthing is fine')
  } else {
    console.error('test failed!')
  }
}).on('error', err => {
  console.error(err)
})
