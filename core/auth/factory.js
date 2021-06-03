const config = require('./config')
const OktaProvider = require('./providers/okta').OktaProvider


function providerFactory(){
  if(config.provider === "okta"){
    return new OktaProvider({issuer: config.issuer})
  }
  throw {status: 401, message: "no auth provider found"}
}


module.exports = {
  providerFactory: providerFactory,
}
