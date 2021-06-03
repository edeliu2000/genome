const OktaJwtVerifier = require('@okta/jwt-verifier');


function OktaProvider(cfg){
  this.okta = new OktaJwtVerifier({issuer:cfg.issuer});
}
/**
 * auth providers needd to addhere to the verify interface
 * as in the OktaProvider below, verify(token, scope) is how we'll invoke
 * the provider for token verification
 */
OktaProvider.prototype.verify = function(token, scope){
  return this.okta.verifyAccessToken(token, "api://default");
}


module.exports = {
  OktaProvider: OktaProvider,
}
