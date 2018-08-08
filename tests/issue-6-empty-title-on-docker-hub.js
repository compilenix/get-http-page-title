const http = require('http')
const os = require('os')

const { doesResponseBodyMatch } = require('./commonFunctions')

let config = require('../config.js')

http.get(`http://${os.hostname()}:${config.port}/https/hub.docker.com/r/appsvc/node/`, async res => {
  if (await doesResponseBodyMatch(res, 'appsvc/node - Docker Hub')) {
    console.log('everthing is fine')
  } else {
    console.error('test failed!')
  }
}).on('error', err => {
  console.error(err)
})

http.get(`http://${os.hostname()}:${config.port}/https/hub.docker.com/_/ubuntu/`, async res => {
  if (await doesResponseBodyMatch(res, 'library/ubuntu - Docker Hub')) {
    console.log('everthing is fine')
  } else {
    console.error('test failed!')
  }
}).on('error', err => {
  console.error(err)
})
