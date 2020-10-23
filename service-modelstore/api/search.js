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

  var artifactTypeProperty = req.query.artifactType || "model";
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

  console.log("date range:", fromDate, toDate)

  var query = {
    index: 'model-artifacts',
    body: {
      from : 0,
      size: 10,
      sort: sortList,
      query: { bool: { must: [
        {term: {"artifactType": artifactTypeProperty}},
        {range : {
          created : {
            gte : fromDate,
            lte : toDate
          }
        }},
        {multi_match : {
            query : req.body.query,
            fields : fieldsToSearch
        }}
        ]}
      }}
  };


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


  var artifactTypeProperty = req.query.artifactType || "model";
  var sortPropertyDesc = req.query.sortDesc || "created";
  var sortProperty = {};
  var sortList = [];
  sortProperty[sortPropertyDesc] = {"order":"desc"}
  sortList.push(sortProperty)

  var fromDate = Number(req.query.from || Date.now() - (1000 * 60 * 60 * 24 * 7));
  var toDate = Number(req.query.to || Date.now());

  if(!req.body.application){
    return next(createError(400, 'application field missing'));
  }

  console.log("query for search", req.body, fromDate, toDate);

  var query = {
    index: 'model-artifacts',
    body: {
      from : 0,
      size: 10,
      sort: sortList,
      query: { bool: {
        filter: [
          {term: {"artifactType": artifactTypeProperty}},
          {term: {"application": req.body.application}}
        ]},
    }}
  };

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

  if(artifactTypeProperty === "model" && req.body.pipelineStage){
    query.body.query.bool.filter.push({
      term: {"pipelineStage": req.body.pipelineStage}
    });
  }

  if(artifactTypeProperty === "model" && req.body.pipelineRunId){
    query.body.query.bool.filter.push({
      term: {"pipelineRunId": req.body.pipelineRunId}
    });
  }

  //add time range
  query.body.query.bool.filter.push({range : {
    created : {
      gte : fromDate,
      lte : toDate
    }
  }});

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


module.exports = {
  search: search,
  searchByKeywords: searchByKeywords,
  queryPipelinesToRun: queryPipelinesToRun
}
