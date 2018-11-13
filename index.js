const http = require('http')
const https = require('https')
const os = require('os')
const { URL: Url } = require('url')

const fs = require('fs-extra')

// eslint-disable-next-line camelcase
const { getTitleFromIncomingMessage, handleDockerHub, handleOsquery_io } = require('./commonFunctions.js')

if (!fs.existsSync('./config.js')) {
  fs.copySync('./config.example.js', './config.js')
}

const config = require('./config.js')
// @ts-ignore
const packageJson = require('./package.json')

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
  switch (error.name) {
    case 'ENOTFOUND':
      res.end()
      return
    default:
      break
  }
  console.log(error)
  res.statusCode = 500
  res.statusMessage = error.message
  res.end(error.message)
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
      'User-Agent': `${packageJson.name}/${packageJson.version} (${packageJson.repository.url}) admin contact: ${config.adminContact}`,
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
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
function handleRequest (req, res) {
  try {
    if (req.url === '/health') {
      res.statusCode = 200
      res.statusMessage = 'OK'
      res.end('Healthy')
      return
    }

    res.statusCode = 400
    if (req.method !== 'GET' || !req.url || !req.url.startsWith('/http')) {
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

    let urlString = `${schema}://${hostPlusRest}`
    let url = new Url(urlString)

    if (handleDockerHub(urlString, res)) return
    if (handleOsquery_io(urlString, res)) return

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

    const argv = process.execArgv.join()
    const isDebug = argv.includes('inspect') || argv.includes('debug')
    if (isDebug) return

    setTimeout(() => {
      res.statusCode = 504
      res.statusMessage = 'Gateway Timeout'
      res.end('Gateway Timeout')
    }, 3000)
  } catch (error) {
    handleClientRequestError(res, error)
  }
}

/**
 * @param {http.IncomingMessage} request
 * @param {http.ServerResponse} response
 */
function handleApiRequestNextTick (request, response) {
  process.nextTick(() => handleRequest(request, response))
}

http.createServer(handleApiRequestNextTick).listen(config.port)
console.log(`http://${os.hostname()}:${config.port}/`)
