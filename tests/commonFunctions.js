const http = require('http') // eslint-disable-line no-unused-vars

let config = require('../config.js')

/**
 * @param {http.IncomingMessage} res
 * @param {string} exactMatchString
 * @returns {Promise<boolean>}
 */
async function doesResponseBodyMatch (res, exactMatchString) {
  return new Promise((resolve, reject) => {
    res.setEncoding('utf8')
    if (res.statusCode !== 200) {
      console.error(`Status code wasn't 200, got ${res.statusCode}`)
      resolve(false)
    }

    let rawData = ''
    res.on('data', chunk => {
      if (chunk.length + rawData.length < config.maxPayloadSize) {
        rawData += chunk
      } else {
        console.error('Response entity too large')
        res.destroy()
        resolve(false)
      }
    })

    res.on('end', () => {
      try {
        if (rawData !== exactMatchString) {
          console.error(`Response did not match "${exactMatchString}", got "${rawData}"`)
          res.destroy()
          resolve(false)
        }
      } catch (e) {
        console.error(e)
        res.destroy()
        resolve(false)
      }

      resolve(true)
    })
  })
}

module.exports.doesResponseBodyMatch = doesResponseBodyMatch
