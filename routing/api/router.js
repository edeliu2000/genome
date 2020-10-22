const modelStoreLocation = process.env.MODELSTORE || 'http://modelstore:3000';
const scoringLocation = process.env.SCORING || 'http://scoring:5000';
const visualizerLocation = process.env.VISUALIZER || 'http://visualizer:5000';
const axios = require('axios');
const NodeCache = require( "node-cache" );
const metaCache = new NodeCache();

const clusters = {
  "/v1.0/genome/explain": { "loc": scoringLocation, "format": "json"},
  "/v1.0/genome/explanation/samples": { "loc": scoringLocation, "format": "json"},
  "/v1.0/genome/visualization": {"loc": visualizerLocation, "format": "blob"}
};


const routeToExplainer = (req, res, next) => {

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

  var path = req.baseUrl + req.path
  var clusterLocation = clusters[path];

  promise
  .then(function (data) {
    var modelInfos = data
    if(modelInfos.length <=0) {
      return next({
        status:400,
        message: "no model found with: " + req.body.canonicalName
      });
    }

    console.log("scoring model: ", modelInfos);
    console.log("scoring model with format: " + modelInfos[0].framework);
    var payload = req.body
    payload.modelMeta = modelInfos[0];

    return axios.post(clusterLocation["loc"] + req.originalUrl.replace("/v1.0/genome", ""), payload)
  })
  .then(function(clusterResponse){
    console.log("scoring resp with format: ", clusterResponse);
    if(clusterLocation["format"] === "json"){
      return res.status(200).json(clusterResponse.data)
    }else{
      return res.status(200).send(clusterResponse.data)
    }
  })
  .catch(function (error) {
    console.log("error from scoring backend: ", error);
    return next(error);
  });
};


module.exports = {
  route: routeToExplainer
}
