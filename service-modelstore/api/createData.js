const { Client } = require('@elastic/elasticsearch')
const elastic = process.env.ES_ENDPOINT || 'http://docker.for.mac.localhost:9200';
const client = new Client({
  node: elastic,
  auth:{
    username:"elastic",
    password:process.env.ES_PASS
  },
  ssl: {
    ca: process.env.ES_CERT
  }
})
const { v4: uuidv4 } = require('uuid');
// uuidv4(); // ⇨ '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed'

const DATASET_TYPE = "dataset";
const DATAARTIFACT_TYPE = "dataArtifact";

const isValidDataset = (dataset) => {
  if(!dataset.canonicalName || dataset.canonicalName === "" ){
    return false
  }

  if(!dataset.application || dataset.application === "" ){
    return false
  }

  // there should not be any pipe infos here.
  if(dataset.pipelineName){
    return false
  }

  if(dataset.pipelineStage){
    return false
  }

  if(dataset.pipelineRunId){
    return false
  }

  // only data artifacts, not datasets should have dataset ref infos
  if(dataset.dataset){
    return false
  }

  if(!dataset.versionName || dataset.versionName === "" ){
    return false
  }

  if(!dataset.format || dataset.format === "" ){
    return false
  }

  if(dataset.schema && (!dataset.schema.ref || !dataset.schema.refType)){
    return false
  }

  return true;
};


const isValidDataArtifact = (dataArtifact) => {
  if(!dataArtifact.dataset || dataArtifact.dataset === "" ){
    return false
  }

  if(!dataArtifact.versionName || dataArtifact.versionName === "" ){
    return false
  }

  if(!dataArtifact.pipelineName || dataArtifact.pipelineName === "" ){
    return false
  }

  if(!dataArtifact.pipelineStage || dataArtifact.pipelineStage === "" ){
    return false
  }

  if(!dataArtifact.pipelineRunId || dataArtifact.pipelineRunId === "" ){
    return false
  }

  return true;
};


const onError = function(err, entityType, item, next){
  console.log("Elastic error on creating object: ", item, "error", JSON.stringify(err, null, 4))
  err.status = 500;
  err.message = 'error during storing of ' + entityType + ': ';
  return next(err);
}

const getDataset = function(datasetName, version, callback){
  const indexName = 'data-artifacts';

  client.search({
    index: indexName,
    body:{
      from : 0,
      size: 5,
      sort: {"created": {"order":"desc"}},
      query: { bool: { must: [
            {term: {"artifactType": DATASET_TYPE}},
            {term: {"canonicalName": datasetName}},
            {term: {"versionName": version}}
          ]
        }
      }
    }
  }, (err, result) => {
    if (err) {
      console.log("Elastic error on getting dataset with name: ", datasetName, "error", JSON.stringify(err, null, 4))
      err.status = 500;
      err.message = 'error during retrieval of dataset with provided name';
      return callback(err);
    }

    if (result.body.hits && result.body.hits.hits && result.body.hits.hits.length <= 0){
      console.log("Dataset with name: ", datasetName, "and version: ", version, "not found");
      var notFound = new Error('failed validation');
      notFound.status = 404;
      notFound.message = 'dataset with provided name: ' + datasetName + ' not found';
      return callback(notFound);

    }else{
      var dataset = result.body.hits.hits[0]._source;
      dataset.id = result.body.hits.hits[0]._id;
      return callback(null, dataset);
    }
  });
};


const create = function(req, res, next, artifactType){

  var isValid = false;
  var entityType = {
    "dataset":"dataset",
    "dataArtifact":"data",
  }[artifactType]

  if(artifactType === DATAARTIFACT_TYPE){
    isValid = isValidDataArtifact(req.body);
  }else if(artifactType === DATASET_TYPE){
    isValid = isValidDataset(req.body);
  }

  if(!isValid){
    var validationErr = new Error(entityType + ' failed validation');
    validationErr.status = 400
    validationErr.message = entityType + ' failed validation'
    console.log("validation failed for:", req.body)
    return next(validationErr);
  }

  var indexName = 'data-artifacts';
  var typeProperty = 'artifactType'

  const now = Date.now()

  req.body[typeProperty] = entityType
  req.body["created"] = now;
  req.body["artifactTime"] = req.body["artifactTime"] || now;

  if(req.body["artifactStartTime"]){
    req.body["artifactStartTime"] = req.body["artifactStartTime"] || now;
  }

  const artifactId = uuidv4();
  if(artifactType === DATAARTIFACT_TYPE){
    //if dataArtifact validate if associated dataset exists and populate dataset fields in artifact
    getDataset(req.body.dataset, req.body.versionName, (err, dataset) => {

      if(err){
        return onError(err, entityType, req.body, next)
      }


      var item = req.body
      if(dataset.application){item.application = dataset.application;}
      if(dataset.canonicalName){item.canonicalName = dataset.canonicalName;}
      if(dataset.format){item.format = dataset.format;}
      if(dataset.schema){item.schema = dataset.schema;}
      if(dataset.versionName){item.versionName = dataset.versionName;}

      client.index({
        index: indexName,
        id: artifactId,
        body: item
      }, (indexErr, result) => {
        if (indexErr) {
          return onError(indexErr, entityType, req.body, next)
        }
        return res.status(201).json({id: result.body._id});
      });

    });

  }else{

    //if dataset create doc in index
    client.index({
      index: indexName,
      id: artifactId,
      body: req.body
    }, (err, result) => {
      if (err) {
        return onError(err, entityType, req.body, next)
      }
      return res.status(201).json({id: result.body._id});
    });
  }
};


const createDataset = function(req, res, next){
  create(req, res, next, DATASET_TYPE);
}

const createDataArtifact = function(req, res, next){
  create(req, res, next, DATAARTIFACT_TYPE);
}


module.exports = {
  createDataArtifact: createDataArtifact,
  createDataset: createDataset
}
