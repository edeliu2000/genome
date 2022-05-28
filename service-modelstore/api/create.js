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


const isValidDeployment = (deployment) => {
  if(!deployment.canonicalName || deployment.canonicalName === "" ){
    return false
  }

  if(!deployment.application || deployment.application === "" ){
    return false
  }

  return true;
};


const isValidTransform = (transformation) => {
  if(!transformation.canonicalName || transformation.canonicalName === "" ){
    return false
  }

  if(!transformation.application || transformation.application === "" ){
    return false
  }

  if(!transformation.versionName || transformation.versionName === "" ){
    return false
  }

  if(!transformation.code || (transformation.code && (!transformation.code.ref || !transformation.code.refType))){
    return false
  }


  // disallowed properties
  if(transformation.pipelineName){
    return false
  }

  if(transformation.pipelineStage){
    return false
  }

  if(transformation.pipelineRunId){
    return false
  }



  return true;
};


const isValidModelArtifact = (model) => {
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

  return true;
};



const isValidPipeline = (pipeline, isRun) => {
  if(!pipeline.canonicalName || pipeline.canonicalName === "" ){
    return false
  }

  if(!pipeline.application || pipeline.application === "" ){
    return false
  }


  if(!pipeline.versionName){
    return false
  }

  // pipelineName should also be provided for pipeline specs,
  // the combination of pipelineName and versionName should be unique,
  // canonicalName should be used for user defined grouping/tagging
  if(!pipeline.pipelineName || pipeline.pipelineName === ""){
    return false
  }

  // checks for pipe specs props
  if(!isRun && !pipeline.recipeRef){
    return false
  }

  //checks for pipeRun properties
  if(isRun && !pipeline.deployment){
    return false
  }

  if(isRun && !pipeline.pipelineRef){
    return false
  }


  // disallowed properties
  // pipelineRunId is the id created

  if(pipeline.pipelineRunId){
    return false
  }

  if(pipeline.pipelineStage){
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



const create = function(req, res, next, artifactType){

  var isValid = false;
  var entityType = {
    "deployment":"pipelineDeployment",
    "modelArtifact":"model",
    "transform":"transform",
    "pipeline":"pipeline",
    "pipelineRun": "pipelineRun"
  }[artifactType]

  if(artifactType === "modelArtifact"){
    isValid = isValidModelArtifact(req.body);
  }else if(artifactType === "transform"){
    isValid = isValidTransform(req.body);
  }else if(artifactType === "pipeline"){
    isValid = isValidPipeline(req.body);
  }else if(artifactType === "pipelineRun"){
    isValid = isValidPipeline(req.body, true);
  }else if(artifactType === "deployment"){
    isValid = isValidDeployment(req.body);
  }

  if(!isValid){
    var validationErr = new Error(entityType + ' failed validation');
    validationErr.status = 400
    validationErr.message = entityType + ' failed validation'
    console.log("validation failed for:", req.body)
    return next(validationErr);
  }

  var indexName = 'model-artifacts';
  var typeProperty = artifactType === 'deployment' ? 'deploymentType' : 'artifactType'

  if(artifactType === 'deployment'){
    indexName = 'deployments';
  }else if(artifactType === 'dataArtifact'){
    indexName = 'data-artifacts';
  }

  const now = Date.now()

  req.body[typeProperty] = entityType
  req.body["created"] = now;
  req.body["artifactTime"] = req.body["artifactTime"] || now;

  if(req.body["artifactStartTime"]){
    req.body["artifactStartTime"] = req.body["artifactStartTime"] || now;
  }


  client.index({
    index: indexName,
    id: uuidv4(),
    // type: '_doc', // uncomment this line if you are using {es} ≤ 6
    body: req.body
  }, (err, result) => {
    if (err) {
      console.log("Elastic error on creating object: ", req.body, "error", JSON.stringify(err, null, 4))
      err.status = 500;
      err.message = 'error during storing of ' + entityType + ': ';
      return next(err);
    }

    return res.status(201).json({id: result.body._id});
  })
};

const createDeployment = function(req, res, next){
  create(req, res, next, "deployment");
}

const createModelArtifact = function(req, res, next){
  create(req, res, next, "modelArtifact");
}

const createDataArtifact = function(req, res, next){
  create(req, res, next, "dataArtifact");
}

const createTransform = function(req, res, next){
  create(req, res, next, "transform");
}

const createPipeline = function(req, res, next){
  // assign a shard if there is a schedule involved
  if(req.body && req.body.schedule){
    req.body["shard"] = "shard-1";
  }

  create(req, res, next, "pipeline");
}

const createPipelineRun = function(req, res, next){
  create(req, res, next, "pipelineRun");
}


const createPipelineRunStatus = function(req, res, next){
  if(!req.body.status){
    var validationErr = new Error('status object failed validation');
    validationErr.status = 400
    validationErr.message = 'status object failed validation'
    console.log("validation failed for:", req.body)
    return next(validationErr);
  }

  var status = req.body.status.toLowerCase() === "succeeded" ? 1 : 2

  client.update({
    index: 'model-artifacts',
    id: req.params.runId,
    // type: '_doc', // uncomment this line if you are using {es} ≤ 6
    body: {
      script: {
        source: 'ctx._source.status = params.status; ctx._source.artifactTime = params.artifactTime;',
        params:{
          status: status,
          artifactTime: Date.now(),
        }
      }
    }
  }, (err, result) => {
    if (err) {
      console.log("Elastic error on creation of pipelineRunStatus with runId: ", req.params.runId, req.body, "error:", JSON.stringify(err, null, 4))
      err.status = 500;
      err.message = 'error during creation of pipelineRunStatus';
      return next(err);
    }

    return res.status(200).json({success: true});
  })
}


const updatePipelineNextRun = function(req, res, next){
  if(!req.body.nextRun){
    var validationErr = new Error('nextRun object failed validation');
    validationErr.status = 400
    validationErr.message = 'nextRun object failed validation'
    console.log("validation failed for:", req.body)
    return next(validationErr);
  }

  var nextRun = req.body.nextRun

  client.update({
    index: 'model-artifacts',
    id: req.params.pipelineId,
    // type: '_doc', // uncomment this line if you are using {es} ≤ 6
    body: {
      script: {
        source: 'ctx._source.nextRun = params.nextRun',
        params:{
          nextRun: nextRun
        }
      }
    }
  }, (err, result) => {
    if (err) {
      console.log("Elastic error on creation of pipelineNextRun with runId: ", req.params.runId, req.body, "error:", JSON.stringify(err, null, 4))
      err.status = 500;
      err.message = 'error during creation of pipelineNextRun';
      return next(err);
    }

    return res.status(200).json({success: true});
  })
}

module.exports = {
  createDeployment: createDeployment,
  createTransform: createTransform,
  createModelArtifact: createModelArtifact,
  createPipeline: createPipeline,
  createPipelineRun: createPipelineRun,
  createPipelineRunStatus: createPipelineRunStatus,
  updatePipelineNextRun: updatePipelineNextRun
}
