class Config {
  constructor () {
    this.port = 6643
    this.maxPayloadSize = 1e6 // ~ 1MB
  }
}

module.exports = new Config()
