const http = require('http')
const os = require('os')

const { doesResponseBodyMatch } = require('./commonFunctions')

let config = require('../config.js')

http.get(`http://${os.hostname()}:${config.port}/http/neverssl.com`, async res => {
  if (await doesResponseBodyMatch(res, 'NeverSSL - helping you get online')) {
    console.log('everthing is fine')
  } else {
    console.error('test failed!')
  }
}).on('error', err => {
  console.error(err)
})
