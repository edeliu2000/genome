const providerFactory = require('./factory').providerFactory
const NodeCache = require( "node-cache" );
const authCache = new NodeCache();


function getScope(req, requestedOp){
  var mode = "." + (req.path.indexOf(requestedOp) >= 0 ? "read" : "manage");
  var app = ".app:" + (req.body.application || "*")
  var scope = req.path + app + mode;
  return scope;
}


function verifyToken(token, scope){
  var provider = providerFactory();
  cachedJWT = authCache.get(token);
  if(cachedJWT == undefined){
    verification = provider.verify(token, scope);
    verification.then((jwt) => {
      authCache.set(token, verification, 120);
    });
    return verification;
  }
  console.log("using cached auth token")
  return Promise.resolve(cachedJWT);
}


module.exports = {
  verifyToken: verifyToken,
  getScope: getScope
}
