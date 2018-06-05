const http = require('http')
const https = require('https')
const os = require('os')

const fs = require('fs-extra')
const cheerio = require('cheerio')

if (!fs.existsSync('./config.js')) {
  fs.copySync('./config.example.js', './config.js')
}

let config = require('./config.js')

/**
 * @param {http.IncomingMessage} clientRes
 * @param {http.ServerResponse} res
 * @returns {Promise<string>}
 */
async function getTitleFromIncomingMessage (clientRes, res) {
  return new Promise((resolve, reject) => {
    clientRes.setEncoding('utf8')
    if (!(clientRes.headers['content-type'].toLowerCase().startsWith('application/html') ||
    clientRes.headers['content-type'].toLowerCase().startsWith('text/html'))) {
      res.statusCode = 400
      clientRes.resume()
      clientRes.destroy()
      resolve('')
    }

    let rawData = ''
    clientRes.on('data', chunk => {
      if (chunk.length + rawData.length < config.maxPayloadSize) {
        rawData += chunk
      } else {
        res.statusCode = 413
        res.statusMessage = 'Response entity too large'
        clientRes.destroy()
        resolve('')
      }
    })
    clientRes.on('end', () => {
      try {
        const $ = cheerio.load(rawData)
        const title = $('title').text().trim().replace(/\n/, '').replace(/ {2}/g, '')
        res.statusCode = 200
        clientRes.destroy()
        resolve(title)
      } catch (e) {
        reject(e)
      }
    })
  })
}

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
function handleRequest (req, res) {
  res.statusCode = 400
  if (req.method !== 'GET') {
    res.end()
    return
  }
  const clientRequest = req.url.slice(1)
  console.dir(clientRequest)

  /**
  * @param {http.IncomingMessage} clientRes
  */
  async function handleClientRequest (clientRes) {
    title = await getTitleFromIncomingMessage(clientRes, res)
    if (!res.finished) {
      if (title === undefined) {
        res.statusCode = 500
      }
      res.end(title)
    }
  }

  /**
  * @param {Error} error
  */
  function handleClientRequestError (error) {
    console.log(error)
    res.statusCode = 500
    res.end()
  }

  let title = ''
  if (clientRequest.startsWith('http://')) {
    http.get(clientRequest, handleClientRequest).on('error', handleClientRequestError)
  } else if (clientRequest.startsWith('https://')) {
    https.get(clientRequest, handleClientRequest).on('error', handleClientRequestError)
  } else {
    res.statusCode = 400
    res.end()
  }
}

http.createServer(handleRequest).listen(config.port)
console.log(`http://${os.hostname()}:${config.port}/`)
