const http = require('http')
const os = require('os')

const { doesResponseBodyMatch } = require('./commonFunctions')

let config = require('../config.js')

http.get(`http://${os.hostname()}:${config.port}/https/developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy`, async res => {
  if (await doesResponseBodyMatch(res, 'Referrer-Policy - HTTP | MDN')) {
    console.log('everthing is fine')
  } else {
    console.error('test failed!')
  }
}).on('error', err => {
  console.error(err)
})
