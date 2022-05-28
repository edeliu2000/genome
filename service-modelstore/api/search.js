const { Client } = require('@elastic/elasticsearch')
const elastic = process.env.ES_ENDPOINT || 'http://docker.for.mac.localhost:9200';
const client = new Client({
  node: elastic,
  auth: {
    username:"elastic",
    password:process.env.ES_PASS
  },
  ssl: {
    ca: process.env.ES_CERT
  }

})


const createError = (status, message, err) => {
  var error = err || new Error(message);
  error.status = status;
  error.message = message;
  return error;
};



const queryPipelinesToRun = function(req, res, next){

  if(!req.body.nextRun){
    return next(createError(400, 'nextRun field missing'));
  }

  var artifactTypeProperty = "pipeline";
  var sortPropertyDesc = "nextRun";
  var sortProperty = {};
  var sortList = [];


  sortProperty[sortPropertyDesc] = {"order":"desc"}
  sortList.push(sortProperty)


  var shard = req.body.shard || "shard-1";

  var query = {
    index: 'model-artifacts',
    body: {
      from : 0,
      size: 10,
      sort: sortList,
      query: { bool: { must: [
        {term: {"artifactType": artifactTypeProperty}},
        {term: {"shard": shard}},
        {range : {
          nextRun : {
            lte : Number(req.body.nextRun)
          }
        }}
        ]}
      }}
  };


  client.search(query, (err, result) => {
      if (err) {
        console.log(JSON.stringify(err, null, 4));
        return next(createError(500, 'error during storing of ' + artifactTypeProperty + ': ', err));
      }

      var arr = [];
      if(result.body.hits && result.body.hits.hits){
        result.body.hits.hits.forEach((item, i) => {
          item._source.id = item._id;
          arr.push(item._source);
        });
      }
      return res.json(arr);
  })
};



const searchByKeywords = function(req, res, next){

  if(!req.body.query){
    return next(createError(400, 'query field missing'));
  }

  var artifactTypeProperty = req.query.artifactType || "modelArtifact";
  var sortPropertyDesc = req.query.sortDesc || "created";
  var sortProperty = {};
  var sortList = [];
  var fieldsToSearch = ["canonicalName", "pipelineName", "pipelineRunId", "versionName", "framework" , "_id"];

  sortProperty[sortPropertyDesc] = {"order":"desc"}
  sortList.push(sortProperty)

  if(artifactTypeProperty === "model"){
    fieldsToSearch.push("pipelineStage")
  }

  var fromDate = Number(req.query.from || Date.now() - (1000 * 60 * 60 * 24 * 7));
  var toDate = Number(req.query.to || Date.now());

  var excludeTimeFilter = req.body.deployment && (artifactTypeProperty in {"pipeline":1, "deployment":1});
  excludeTimeFilter = req.query.to === undefined && req.query.from === undefined ? true : excludeTimeFilter;


  console.log("date range:", fromDate, toDate, req.query.from, req.query.to);

  var query = {
    index: 'model-artifacts',
    body: {
      from : 0,
      size: 10,
      sort: sortList,
      query: { bool: { must: [
        {term: {"artifactType": artifactTypeProperty}},
        {multi_match : {
            query : req.body.query,
            fields : fieldsToSearch
        }}
        ]}
      }}
  };

  //add time range
  !excludeTimeFilter && query.body.query.bool.must.push({range : {
    artifactTime : {
      gte : fromDate,
      lte : toDate
    }
  }});


  client.search(query, (err, result) => {
      if (err) {
        console.log(JSON.stringify(err, null, 4));
        return next(createError(
          500,
          'error during storing of ' + artifactTypeProperty + ': ',
          err));
      }

      var arr = [];
      if(result.body.hits && result.body.hits.hits){
        result.body.hits.hits.forEach((item, i) => {
          item._source.id = item._id;
          arr.push(item._source);
        });
      }
      return res.json(arr);
  })
};




const search = function(req, res, next){


  var artifactTypeProperty = req.query.artifactType || "modelArtifact";
  var entityType = {
    "deployment":"pipelineDeployment",
    "modelArtifact":"model",
    "dataArtifact":"data",
    "transform":"transform",
    "pipeline":"pipeline",
    "pipelineRun": "pipelineRun"
  }[artifactTypeProperty]

  var sortPropertyDesc = req.query.sortDesc || "created";
  var sortProperty = {};
  var sortList = [];
  sortProperty[sortPropertyDesc] = {"order":"desc"}
  sortList.push(sortProperty)

  var fromDate = Number(req.query.from || Date.now() - (1000 * 60 * 60 * 24 * 30));
  var toDate = Number(req.query.to || Date.now());

  if(!req.body.application){
    return next(createError(400, 'application field missing'));
  }

  console.log("query for search", req.body, fromDate, toDate);

  var indexName = 'model-artifacts';

  if(artifactTypeProperty === 'deployment'){
    indexName = 'deployments';
  }else if(artifactTypeProperty === 'dataArtifact'){
    indexName = 'data-artifacts';
  }

  var excludeTypeFilter = artifactTypeProperty === "deployment";
  var excludeTimeFilter = req.body.deployment && (artifactTypeProperty in {"pipeline":1, "deployment":1});
  excludeTimeFilter = req.query.to === undefined && req.query.from === undefined ? true : excludeTimeFilter;


  var query = {
    index: indexName,
    body: {
      from : 0,
      size: 10,
      sort: sortList,
      query: { bool: {
        filter: [
          {term: {"application": req.body.application}}
        ]},
    }}
  };


  if(!excludeTypeFilter){
    query.body.query.bool.filter.push({
      term: {"artifactType": entityType}
    });
  }

  if(req.body.id){
    query.body.query.bool.filter.push({
      term: {"_id": req.body.id}
    });
  }

  if(req.body.deployment){
    const deploymentTerm = artifactTypeProperty === "deployment" ? {'_id':req.body.deployment} : {'deployment':req.body.deployment}
    query.body.query.bool.filter.push({
      term: deploymentTerm
    });
  }

  if(req.body.pipelineName){
    query.body.query.bool.filter.push({
      term: {"pipelineName": req.body.pipelineName}
    });
  }

  if(req.body.canonicalName){
    query.body.query.bool.filter.push({
      term: {"canonicalName": req.body.canonicalName}
    });
  }

  if(req.body.parameters && req.body.parameters.__type__){
    query.body.query.bool.filter.push({
      term: {"parameters.__type__": req.body.parameters.__type__}
    });
  }

  if(req.body.versionName){
    query.body.query.bool.filter.push({
      term: {"versionName": req.body.versionName}
    });
  }

  if(entityType === "model" && req.body.pipelineStage){
    query.body.query.bool.filter.push({
      term: {"pipelineStage": req.body.pipelineStage}
    });
  }

  if(entityType === "model" && req.body.pipelineRunId){
    query.body.query.bool.filter.push({
      term: {"pipelineRunId": req.body.pipelineRunId}
    });
  }

  //add time range
  !excludeTimeFilter && query.body.query.bool.filter.push({range : {
    artifactTime : {
      gte : fromDate,
      lte : toDate
    }
  }});

  client.search(query, (err, result) => {

    if (err) {
      console.log("error on searching", JSON.stringify(err, null, 4));
      return next(createError(500, 'error during searching of ' + artifactTypeProperty + ': ', err));
    }

    var arr = [];
    if(result.body.hits && result.body.hits.hits){
      result.body.hits.hits.forEach((item, i) => {
        item._source.id = item._id;
        arr.push(item._source);
      });
    }

    console.log("search result: ", "query:", JSON.stringify(query, null, 4), "result:", JSON.stringify(arr, null, 4));
    return res.json(arr);
  })
};


module.exports = {
  search: search,
  searchByKeywords: searchByKeywords,
  queryPipelinesToRun: queryPipelinesToRun
}
