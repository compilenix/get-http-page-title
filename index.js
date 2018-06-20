const http = require('http')
const https = require('https')
const os = require('os')

const fs = require('fs-extra')
const cheerio = require('cheerio')

const contentEncoding = require('./src/http-content-encoding')

if (!fs.existsSync('./config.js')) {
  fs.copySync('./config.example.js', './config.js')
}

const config = require('./config.js')
const package_json = require('./package.json')

/**
 * @param {http.IncomingMessage} clientRes
 * @param {http.ServerResponse} res
 * @returns {Promise<string>}
 */
async function getTitleFromIncomingMessage (clientRes, res) {
  return new Promise((resolve, reject) => {
    const contentType = clientRes.headers['content-type'] ? clientRes.headers['content-type'].toLowerCase() : undefined
    if (!contentType || !(contentType.startsWith('application/html') || contentType.startsWith('text/html'))) {
      res.statusCode = 400
      clientRes.resume()
      clientRes.destroy()
      resolve('no title')
    }

    let rawData = Buffer.alloc(0)
    clientRes.on('data', chunk => {
      if (chunk.length + rawData.length < config.maxPayloadSize) {
        rawData = Buffer.concat([rawData, Buffer.from(chunk)])
      } else {
        res.statusCode = 413
        res.statusMessage = 'Response entity too large'
        clientRes.destroy()
        resolve('')
      }
    })

    clientRes.on('end', async () => {
      try {
        const decoded = await contentEncoding.tryDecodeHttpResponse(clientRes, rawData)
        const decodedBodyAsString = decoded.body.toString('utf8')
        const $ = cheerio.load(decodedBodyAsString)
        const firstTitleElement = $('title').first()
        let title = ''

        clientRes.destroy()
        res.setHeader('content-type', 'text/plain')
        res.setHeader('cache-control', 'no-cache')
        res.setHeader('access-control-allow-origin', '*')
        res.statusCode = 200

        if (firstTitleElement.length === 0) {
          title = 'no title'
        } else {
          title = firstTitleElement.text().trim().replace(/\n/, '').replace(/ {2}/g, '')
        }

        resolve(title)
      } catch (e) {
        resolve()
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
    if (title === undefined) {
      res.statusCode = 500
    }
    console.dir(title)
    res.end(title)
  }

  /**
  * @param {Error} error
  */
  function handleClientRequestError (error) {
    console.log(error)
    res.statusCode = 500
    res.end()
  }

  let schema = clientRequest.slice(0, 5)
  let hostPlusRest = ''
  if (schema === 'http/') {
    hostPlusRest = clientRequest.slice(5)
    schema = 'http'
  } else if (schema === 'https') {
    hostPlusRest = clientRequest.slice(6)
    schema = 'https'
  }

  let url = new URL(`${schema}://${hostPlusRest}`)
  let requestOptions = {
    timeout: 3000,
    protocol: url.protocol,
    href: url.href,
    method: 'GET',
    host: url.host,
    headers: {
      'User-Agent': `${package_json.name}/${package_json.version} (${package_json.repository.url})`,
      'Accept': 'text/html, application/xhtml+xml, application/xml;q=0.9, */*;q=0.1',
      'Accept-Language': config.preferredLanguage,
      'Accept-Encoding': 'gzip, deflate, identity;q=0.2, *;q=0',
      'From': config.adminContact // See: https://tools.ietf.org/html/rfc7231#section-5.5.1
    },
    hostname: url.hostname,
    pathname: url.pathname,
    path: `${url.pathname}${url.search}`,
    search: url.search,
    hash: url.hash
  }

  let title = ''
  if (schema === 'http') {
    http.get(requestOptions, handleClientRequest).on('error', handleClientRequestError)
  } else if (schema === 'https') {
    https.get(requestOptions, handleClientRequest).on('error', handleClientRequestError)
  } else {
    res.statusCode = 400
    res.end()
  }
}

http.createServer(handleRequest).listen(config.port)
console.log(`http://${os.hostname()}:${config.port}/`)
