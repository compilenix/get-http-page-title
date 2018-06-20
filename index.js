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
 * @param {http.ServerResponse} res
 * @param {http.IncomingMessage} clientRes
 */
async function handleClientRequest (res, clientRes) {
  clientRes = await tryFollowRedirects(res, clientRes)
  if (!clientRes) return
  const title = await getTitleFromIncomingMessage(clientRes, res)
  if (title === undefined) {
    res.statusCode = 500
  }
  console.dir(title)
  res.end(title)
}

/**
 * @param {http.ServerResponse} res
 * @param {Error} error
 */
function handleClientRequestError (res, error) {
  console.log(error)
  res.statusCode = 500
  res.end()
}

/**
 * @param {URL} url
 * @returns {http.RequestOptions}
 */
function generateClientRequestOptions (url) {
  return {
    timeout: 3000,
    protocol: url.protocol,
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
    path: `${url.pathname}${url.search}`
  }
}

/**
 * @param {http.ServerResponse} response
 * @param {http.IncomingMessage} clientRes
 * @returns {Promise<http.IncomingMessage>}
 */
async function tryFollowRedirects (response, clientRes, levelOfRecursion = 0) {
  return new Promise((resolve, reject) => {
    if (clientRes.statusCode < 300 || clientRes.statusCode >= 400) return resolve(clientRes)
    if (!clientRes.headers || !clientRes.headers['location']) return resolve(clientRes)
    if (levelOfRecursion >= config.maxRedirects) return resolve(clientRes)

    const url = new URL(clientRes.headers['location'])
    if (url.protocol === 'http:') {
      http.get(generateClientRequestOptions(new URL(clientRes.headers['location'])), async res => {
        resolve(await tryFollowRedirects(response, res, ++levelOfRecursion))
      })
        .on('error', err => {
          handleClientRequestError(response, err)
          resolve()
        })
    } else if (url.protocol === 'https:') {
      https.get(generateClientRequestOptions(new URL(clientRes.headers['location'])), async res => {
        resolve(await tryFollowRedirects(response, res, ++levelOfRecursion))
      })
        .on('error', err => {
          handleClientRequestError(response, err)
          resolve()
        })
    } else {
      console.log(`Unsupported protocol in redirect to ${clientRes.headers['location']}`)
      response.statusCode = 500
      response.end()
      resolve()
    }
  })
}

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
    if (clientRes.statusCode >= 300 || clientRes.statusCode < 400) return resolve(`Reached max redirects of ${config.maxRedirects}`)

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
  let requestOptions = generateClientRequestOptions(url)

  if (schema === 'http') {
    http.get(requestOptions, async clientRes => {
      await handleClientRequest(res, clientRes)
    }).on('error', err => handleClientRequestError(res, err))
  } else if (schema === 'https') {
    https.get(requestOptions, async clientRes => {
      await handleClientRequest(res, clientRes)
    }).on('error', err => handleClientRequestError(res, err))
  } else {
    res.statusCode = 400
    res.end()
  }
}

http.createServer(handleRequest).listen(config.port)
console.log(`http://${os.hostname()}:${config.port}/`)
