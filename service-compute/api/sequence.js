const modelStoreLocation = process.env.MODELSTORE || 'http://modelstore:3000';
const axios = require('axios');
const NodeCache = require( "node-cache" );
const metaCache = new NodeCache();


const createError = (status, message, err) => {
  var error = err || new Error(message);
  error.status = status;
  error.message = message;
  return error;
};


const convertStep = (step, pipeline, templateName) => {

  if(!(step.image && step.stepName && step.stepType)){
    var validationErr = new Error('required fields missing');
    validationErr.status = 400
    validationErr.message = 'required fields missing on step: ' + JSON.stringify(step)
    throw validationErr;
  }

  var convertedStep = {
    "name": step.stepName,
    "template": templateName,
    "arguments":{
      "parameters":[{
        "name": "image", "value": step.image
      },{
        "name": "STEP_NAME", "value": step.stepName
      },{
        "name": "STEP_TYPE", "value": step.stepType
      },{
        "name": "PIPELINE_NAME", "value": pipeline.name
      },{
        "name": "PIPELINE_RUNID", "value": pipeline.runId
      },{
        "name": "APPLICATION", "value": pipeline.application
      }]
    }
  };

  if(step.datasets){
    convertedStep["arguments"]["parameters"].push({
      "name": "DATASETS", "value": JSON.stringify(step.datasets)
    })
  }

  if(step.parameters){
    convertedStep["arguments"]["parameters"].push({
      "name": "PARAMETERS", "value": JSON.stringify(step.parameters)
    })
  }

  if(step.timeout){
    convertedStep["arguments"]["parameters"].push({
      "name": "timeout", "value": step.timeout
    })
  }

  if(step.retry){
    convertedStep["arguments"]["parameters"].push({
      "name": "retry", "value": step.retry
    })
  }

  return convertedStep;
};


const calculateNextRun = (schedule, now) => {
    var period = schedule[schedule.length - 1];
    var periodMs = {
      "d": 1000 * 60 * 60 * 24, // 24hr
      "h": 1000 * 60 * 60, // 1hr
      "m": 1000 * 60 // 1m
    }[period] || 1000 * 60 * 60;

    var numeric = schedule.slice(0, schedule.length-1);

    return (now || Date.now()) + (periodMs * Number(numeric))
};



const scheduleSequence = (req, res, next) => {
  if(!req.body.pipelineName){
    return next(createError(400, 'pipelineName field missing'));
  }

  if(!(req.body.steps || req.body.dag)){
    return next(createError(400, 'pipeline missing steps'));
  }

  console.log("request to create sequence")
  const maxShards = 1

  var pipelineMeta = {
      "canonicalName": req.body.canonicalName,
      "application": req.body.application,
      "pipelineName": req.body.pipelineName,
      "recipeRef": {"ref": JSON.stringify(req.body.steps), "refType": "inline-pipeline"},
      "versionName": req.body.versionName || "1.2.3",
      "shard": "shard-" + 1
  }

  if(req.body.parameters){
    pipelineMeta["parameters"] = req.body.parameters
  }

  if(req.body.schedule){
    pipelineMeta["schedule"] = req.body.schedule
    pipelineMeta["nextRun"] = calculateNextRun(req.body.schedule)
  }

  // create a pipeline in ModelStore
  var promise = axios.post( modelStoreLocation + "/v1.0/genome/pipeline", pipelineMeta)
  .then(function(response){
    console.log("created pipeline: ", response.data);
    var pipelineId = response.data.id
    return res.status(200).json({id:pipelineId, nextRun: pipelineMeta["nextRun"]})
  }).catch((err) => {
    console.log("err on pipeline creation:", err);
    var error = createError(500, 'error on pipeline creation', err);
    console.log("error created: on pipeline creation:", error);
    return next(error);
  });

};


const runSequence = (req, res, next) => {

  if(!req.body.pipelineName){
    return next(createError(400, 'pipelineName field missing'));
  }

  if(!(req.body.steps || req.body.dag)){
    return next(createError(400, 'pipeline run missing steps'));
  }

  console.log("request to run sequence")

  var pipelineRunMeta = {
      "canonicalName": req.body.canonicalName,
      "application": req.body.application,
      "pipelineName": req.body.pipelineName,
      "recipeRef": {"ref": JSON.stringify(req.body.steps), "refType": "inline-pipeline"},
      "versionName": req.body.versionName || "0.0.1",
  }

  if(req.body.parameters){
    pipelineRunMeta["parameters"] = req.body.parameters
  }

  // create a pipelineRun in ModelStore
  // then trigger it in the workflow engine
  var pipelineRunId = ""
  var promise = axios.post( modelStoreLocation + "/v1.0/genome/pipelineRun", pipelineRunMeta)
  .then(function(response){

    console.log("created pipelineRun: ", response.data);
    pipelineRunId = response.data.id
    return pipelineRunId;

  }).then(function(pipelineRunId){

    const pipelineSteps = req.body.steps || []
    const convertedSteps = [];

    try{

      pipelineSteps.forEach((item) => {
        const pSteps = [];
        const parallelSteps = []

        if(Array.isArray(item)){
          item.forEach((it) => {
            pSteps.push(it);
          })
        }else{
          pSteps.push(item);
        }

        pSteps.forEach((item) => {
          parallelSteps.push(convertStep(item, {
            name: req.body.pipelineName,
            application: req.body.application,
            runId: pipelineRunId
          }, "compute-template"))
        });

        convertedSteps.push(parallelSteps);

      });
    }catch(e){
      console.log("error on conversion of steps: ", req.body.pipelineName, e)
      return next(e)
    }

    return {steps: convertedSteps, runId: pipelineRunId};

  }).then(function(pipeline){

    var workflow = {
      "apiVersion": "argoproj.io/v1alpha1",
      "kind": "Workflow",
      "metadata": {
        "generateName": "genome-pipeline-",
        "namespace": "argo",
        "labels": {
          "workflows.argoproj.io/completed": "false"
        }
      },
      "spec": {
        "entrypoint": "pipeline",
        "serviceAccountName": "workflow",
        "onExit": "exit-handler",
        "templates": [{
          "name": "pipeline",
          "steps": pipeline.steps
        },
        {
          "name": "exit-handler",
          "container": {
            "image": "curlimages/curl",
            "command": [ "sh", "-c"],
            "args": [ "curl -iX POST -H 'Content-Type: application/json' -k -d '{\"status\": \"{{workflow.status}}\"}' " +
              "'" + modelStoreLocation + "/v1.0/genome/pipelineRun/" + pipeline.runId + "/status" + "'"
            ]
          }
        },{
          "name": "compute-template",
          "inputs": {
            "parameters":[
              {"name": "APPLICATION"},
              {"name": "PIPELINE_NAME"},
              {"name": "PIPELINE_RUNID"},
              {"name": "STEP_NAME"},
              {"name": "STEP_TYPE", "value":"model"},
              {"name": "DATASETS", "value":"[]"},
              {"name": "PARAMETERS"},
              {"name": "image"},
              {"name": "timeout", "value": "600s"},
              {"name": "retry", "value": "3"}
          ]},
          "timeout": "{{inputs.parameters.timeout}}",
          "retryStrategy": {
            "limit": "{{inputs.parameters.retry}}",
            "retryPolicy": "Always",
            "backoff": {
              "duration": "2m",
              "factor": 2,
              "maxDuration": "30m"
            }
          },
          "container": {
            "name": "ensemble",
            "image": "{{inputs.parameters.image}}",
            "imagePullPolicy": "IfNotPresent",
            "env":[{
              "name": "MODELSTORE",
              "value": modelStoreLocation
            },{
              "name": "APPLICATION",
              "value": "{{inputs.parameters.APPLICATION}}"
            },{
              "name": "PIPELINE_NAME",
              "value": "{{inputs.parameters.PIPELINE_NAME}}"
            },{
              "name": "PIPELINE_RUNID",
              "value": "{{inputs.parameters.PIPELINE_RUNID}}"
            },{
              "name": "STEP_TYPE",
              "value": "{{inputs.parameters.STEP_TYPE}}"
            },{
              "name": "STEP_NAME",
              "value": "{{inputs.parameters.STEP_NAME}}"
            },{
              "name": "DATASETS",
              "value": "{{inputs.parameters.DATASETS}}"
            },{
              "name": "PARAMETERS",
              "value": "{{inputs.parameters.PARAMETERS}}"
            }]
          }
        }]
      }
    };

    return axios.post( "http://localhost:8001/" + "apis/argoproj.io/v1alpha1/namespaces/argo/workflows", workflow);

  }).then(function(response){
    console.log("created pipeline: ", response.data);
    return res.status(200).json(response.data)
  }).catch((err) => {
    console.log("err on pipelineRun creation:", err)
    return next(err);
  });
};


module.exports = {
  scheduleSequence: scheduleSequence,
  sequence: runSequence,
  calculateNextRun: calculateNextRun,
}
