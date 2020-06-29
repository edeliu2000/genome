const { Client } = require('@elastic/elasticsearch')
const elastic = process.env.ES_ENDPOINT || 'http://docker.for.mac.localhost:9200';
const client = new Client({ node: elastic })
const { v4: uuidv4 } = require('uuid');
// uuidv4(); // ⇨ '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed'


const isValidModel = (model) => {
  if(!model.canonicalName || model.canonicalName === "" ){
    return false
  }

  if(!model.application || model.application === "" ){
    return false
  }

  if(!model.pipelineName || model.pipelineName === "" ){
    return false
  }

  if(!model.pipelineStage || model.pipelineStage === "" ){
    return false
  }

  if(!model.pipelineRunId || model.pipelineRunId === "" ){
    return false
  }

  if(!model.versionName || model.versionName === "" ){
    return false
  }

  if(model.code && (!model.code.ref || !model.code.refType)){
    return false
  }

  if(model.parameters && !model.parameters.__type__){
    return false
  }

  return true;
};


const isValidPipeline = (pipeline, isRun) => {
  if(!pipeline.canonicalName || pipeline.canonicalName === "" ){
    return false
  }

  if(!pipeline.application || pipeline.application === "" ){
    return false
  }

  if(!pipeline.pipelineName || pipeline.pipelineName === "" ){
    return false
  }

  if(!pipeline.versionName){
    return false
  }

  if(!pipeline.code){
    return false
  }

  if(pipeline.parameters && !pipeline.parameters.__type__){
    return false
  }

  if(!pipeline.recipeRef){
    return false
  }


  //disallowed properties
  if(pipeline.pipelineStage){
    return false
  }

  if(isRun && pipeline.pipelineRunId){
    return false
  }

  if(pipeline.artifactBlob){
    return false
  }

  if(pipeline.dataRefs){
    return false
  }

  if(pipeline.featureImportance){
    return false
  }

  return true;
};



var create = function(req, res, artifactType){

  var isValid = false;
  var entityType = {
    "model":"model",
    "pipeline":"pipeline",
    "pipelineRun": "pipelineRun"
  }[artifactType]

  if(artifactType === "model"){
    isValid = isValidModel(req.body);
  }else if(artifactType === "pipeline"){
    isValid = isValidPipeline(req.body);
  }else if(artifactType === "pipelineRun"){
    isValid = isValidPipeline(req.body, true);
  }

  if(!isValid){
    var validationErr = new Error(entityType + ' failed validation');
    validationErr.status = 400
    validationErr.message = entityType + ' failed validation'
    throw validationErr;
  }

  req.body["artifactType"] = entityType
  req.body["created"] = Date.now();
  req.body["updated"] = Date.now();

  client.index({
    index: 'model-artifacts',
    id: uuidv4(),
    // type: '_doc', // uncomment this line if you are using {es} ≤ 6
    body: req.body
  }, (err, result) => {
    if (err) {
      console.log(err);
      err.status = 500;
      err.message = 'error during storing of ' + entityType + ': ';
      throw err;
    }

    return res.status(201).json({id: result.body._id});
  })
};

var createModel = function(req, res){
  create(req, res, "model");
}

var createPipeline = function(req, res){
  create(req, res, "pipeline");
}

var createPipelineRun = function(req, res){
  create(req, res, "pipelineRun");
}

module.exports = {
  createModel: createModel,
  createPipeline: createPipeline,
  createPipelineRun: createPipelineRun
}
