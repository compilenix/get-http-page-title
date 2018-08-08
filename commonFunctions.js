const http = require('http')

const fs = require('fs-extra')
const cheerio = require('cheerio')

const contentEncoding = require('./src/http-content-encoding')

if (!fs.existsSync('./config.js')) {
  fs.copySync('./config.example.js', './config.js')
}

const config = require('./config.js')

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
    if (clientRes.statusCode >= 300 && clientRes.statusCode < 400) return resolve(`Reached max redirects of ${config.maxRedirects}`)

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
 * @param {string} url
 * @param {http.ServerResponse} res
 * @returns {boolean}
 */
function handleDockerHub (url, res) {
  if (url.length <= 5) return false

  const officialImage = url.match(/^https?:\/\/hub\.docker\.com\/_\/(?<imageName>[\w\d]+)\/?$/i)
  const unofficialImage = url.match(/^https?:\/\/hub\.docker\.com\/r\/(?<author>[\w\d]+)\/(?<imageName>[\w\d]+)\/?$/i)

  if (officialImage === null && unofficialImage === null ) return false

  if (officialImage !== null && officialImage.groups &&
    officialImage.groups.imageName && officialImage.groups.imageName.length >= 1
  ) {
    res.setHeader('content-type', 'text/plain')
    res.setHeader('cache-control', 'public, must-revalidate')
    res.setHeader('access-control-allow-origin', '*')
    res.statusMessage = `OK`
    res.statusCode = 200
    res.end(`library/${officialImage.groups.imageName} - Docker Hub`)
    return true
  }

  if (unofficialImage !== null && unofficialImage.groups &&
    unofficialImage.groups.author && unofficialImage.groups.author.length >= 1 &&
    unofficialImage.groups.imageName && unofficialImage.groups.imageName.length >= 1
  ) {
    res.setHeader('content-type', 'text/plain')
    res.setHeader('cache-control', 'public, must-revalidate')
    res.setHeader('access-control-allow-origin', '*')
    res.statusMessage = `OK`
    res.statusCode = 200
    res.end(`${unofficialImage.groups.author}/${unofficialImage.groups.imageName} - Docker Hub`)
    return true
  }

  return false
}

/**
 * @param {string} url
 * @param {http.ServerResponse} res
 * @returns {boolean}
 */
function handleOsquery_io (url, res) {
  if (url.length <= 5) return false

  const isHomePage = url.match(/^https?:\/\/osquery\.io\/?$/i)
  const isSchemaPage = url.match(/^https?:\/\/osquery\.io\/schema\/?$/i)
  const isOfficialNewsPage = url.match(/^https?:\/\/osquery\.io\/blog\/official-news\/?$/i)
  const isBlogPage = url.match(/^https?:\/\/osquery\.io\/blog\/?/i)

  if (
    isHomePage === null &&
    isSchemaPage === null &&
    isOfficialNewsPage === null &&
    isBlogPage === null
  ) return false

  if (isHomePage !== null) {
    res.setHeader('content-type', 'text/plain')
    res.setHeader('cache-control', 'public, must-revalidate')
    res.setHeader('access-control-allow-origin', '*')
    res.statusMessage = `OK`
    res.statusCode = 200
    res.end(`osquery | Easily ask questions about your Linux, Windows, and macOS infrastructure`)
    return true
  }

  if (isSchemaPage !== null) {
    res.setHeader('content-type', 'text/plain')
    res.setHeader('cache-control', 'public, must-revalidate')
    res.setHeader('access-control-allow-origin', '*')
    res.statusMessage = `OK`
    res.statusCode = 200
    res.end(`osquery | Schema`)
    return true
  }

  if (isOfficialNewsPage !== null) {
    res.setHeader('content-type', 'text/plain')
    res.setHeader('cache-control', 'public, must-revalidate')
    res.setHeader('access-control-allow-origin', '*')
    res.statusMessage = `OK`
    res.statusCode = 200
    res.end(`osquery | Official News`)
    return true
  }

  if (isBlogPage !== null) {
    res.setHeader('content-type', 'text/plain')
    res.setHeader('cache-control', 'public, must-revalidate')
    res.setHeader('access-control-allow-origin', '*')
    res.statusMessage = `OK`
    res.statusCode = 200
    res.end(`osquery | Blog`)
    return true
  }

  return false
}

module.exports.getTitleFromIncomingMessage = getTitleFromIncomingMessage
module.exports.handleDockerHub = handleDockerHub
module.exports.handleOsquery_io = handleOsquery_io
