class Config {
  constructor () {
    this.port = 6643
    this.maxPayloadSize = 1e6 // ~ 1MB
    this.adminContact = 'someone@example.com' // See: https://tools.ietf.org/html/rfc7231#section-5.5.1
    this.preferredLanguage = 'en;q=0.9, de;q=0.5, *;q=0.3' // See https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language
  }
}

module.exports = new Config()
