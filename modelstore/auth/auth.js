const OktaJwtVerifier = require('@okta/jwt-verifier');
const config = require('./config')

function OktaProvider(cfg){
  this.okta = new OktaJwtVerifier({issuer:cfg.issuer});
}

OktaProvider.prototype.verify = function(token, scope){
  return this.okta.verifyAccessToken(token, "api://default");
}

function providerFactory(){
  if(config.provider === "okta"){
    return new OktaProvider({issuer: config.issuer})
  }
  throw {status: 401, message: "no auth provider found"}
}

function getScope(req){
  var mode = "." + (req.path.indexOf("search") >= 0 ? "read" : "manage");
  var app = ".app:" + (req.body.application || "*")
  var scope = req.path + app + mode;
  console.log("api scope requested:", scope);
  return scope;
}


function verifyToken(token, scope){
  var provider = providerFactory();
  return provider.verify(token, scope);
}


module.exports = {
  verifyToken: verifyToken,
  getScope:getScope
}
