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


const isValidationRun = (model) => {
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

  if(!model.code || (model.code && (!model.code.ref || !model.code.refType))){
    return false
  }

  if(!model.dataRefs || !model.dataRefs.length){
    return false
  }

  if(!model.validationTarget || (model.validationTarget && (!model.validationTarget.ref || !model.validationTarget.refType))){
    return false
  }

  if((!model.status && model.status !== 0) || model.status === "" ){
    return false
  }

  return true;
};



const isValidation = (model, type = "evaluation") => {
  if(!model.canonicalName || model.canonicalName === "" ){
    return false
  }

  if(!model.application || model.application === "" ){
    return false
  }

  if(!model.versionName || model.versionName === "" ){
    return false
  }

  if(model.code && (!model.code.ref || !model.code.refType)){
    return false
  }

  if(type === "test" && (!model.dataRefs || !model.dataRefs.length)){
    return false
  }

  return true;
};




const create = function(req, res, next, artifactType){

  var isValid = false;
  var entityType = {
    "test":"test",
    "evaluation": "evaluation",
    "testRun":"testRun",
    "evaluationRun": "evaluationRun",
  }[artifactType]

  if(artifactType === "test"){
    isValid = isValidation(req.body, type="test");
  }else if(artifactType === "evaluation"){
    isValid = isValidation(req.body, type="evaluation");
  }else if(artifactType === "testRun"){
    isValid = isValidationRun(req.body, true);
  }else if(artifactType === "evaluationRun"){
    isValid = isValidationRun(req.body, true);
  }

  if(!isValid){
    var validationErr = new Error(entityType + ' failed validation');
    validationErr.status = 400
    validationErr.message = entityType + ' failed validation'
    console.log("validation failed for:", req.body)
    return next(validationErr);
  }

  req.body["artifactType"] = entityType
  req.body["created"] = Date.now();
  req.body["updated"] = Date.now();

  client.index({
    index: 'validation-artifacts',
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

const createTest = function(req, res, next){
  create(req, res, next, "test");
}

const createEvaluation = function(req, res, next){
  create(req, res, next, "evaluation");
}

const createTestRun = function(req, res, next){
  create(req, res, next, "testRun");
}

const createEvaluationRun = function(req, res, next){
  create(req, res, next, "evaluationRun");
}


module.exports = {
  createTest: createTest,
  createTestRun: createTestRun,
  createEvaluation: createEvaluation,
  createEvaluationRun: createEvaluationRun
}
