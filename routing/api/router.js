const modelStoreLocation = process.env.MODELSTORE || 'http://modelstore:3000';
const scoringLocation = process.env.SCORING || 'http://scoring:5000';
const axios = require('axios');
const NodeCache = require( "node-cache" );
const metaCache = new NodeCache();

var routeToExplainer = function(req, res, next){

  if(!req.body.canonicalName){
    var validationErr = new Error('canonicalName field missing');
    validationErr.status = 400
    validationErr.message = 'canonicalName field missing'
    return next(validationErr);
  }

  console.log("request to explain")

  var application = req.body.application || "search";

  var modelMeta = {
    application: application,
    canonicalName: req.body.canonicalName
  }

  var cacheName = req.body.canonicalName
  var modelInfoResp = metaCache.get(req.body.canonicalName);
  var promise = null;

  if(modelInfoResp == undefined){
    promise = axios.post( modelStoreLocation + "/v1.0/genome/search", modelMeta)
    .then(function(response){
      metaCache.set(cacheName, response.data, 120)
      return response.data
    });
  }else{
    promise = Promise.resolve(modelInfoResp)
  }

  promise
  .then(function (data) {
    var modelInfos = data
    if(modelInfos.length <=0) return next({
      status:400,
      message: "no model found with: " + req.body.canonicalName
    });
    console.log("scoring model with format: " + modelInfos[0].framework);
    var payload = req.body
    payload.modelMeta = modelInfos[0];
    return axios.post(scoringLocation + '/explain', payload)
  })
  .then(function(scoringResp){
    return res.status(200).json(scoringResp.data)
  })
  .catch(function (error) {
    return next(error);
  });
};


module.exports = {
  route: routeToExplainer
}
