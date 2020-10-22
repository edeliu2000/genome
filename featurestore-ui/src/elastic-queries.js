

  var ES_URL = window.location.protocol + "//"
    + window.location.host + "/v1.0/genome";
  var EXPLAIN_URL = window.location.protocol + "//"
    + window.location.host + "/v1.0/genome";


  function _loginQuery(user, pass, app){

    var query = {
      "application": app || "",
      "user": user,
      "pass": pass
    }

    return query
  }


  function _softDeleteESQuery(selectedIds, isModel){

    if (selectedIds && !selectedIds.length) throw "no id-s selected for deletion"

    var query = {
      "script": {
        "inline": "ctx._source.deleted = \"true\"",
        "lang": "painless"
      },

      "query": {
        "bool": {
          "must":[
            {"term":{"type":"output"}},
            {
              "bool":{
                "should":[]
              }
            },
            {
              "bool":{
                "should":[]
              }
            }
          ]
        }
      }
    };


    for(var i=0; i<selectedIds.length;i++){
      query["query"]["bool"]["must"][1]["bool"]["should"].push({
        "term": {"mid": selectedIds[i][0]}
      })

      query["query"]["bool"]["must"][2]["bool"]["should"].push({
        "match": {"schema": selectedIds[i][1]}
      })
    }

    return query
  }


  function _updateTimeContextESQuery(mid, schema, startTime, endTime, extraMeta){

    var extraUpdates = "";

    extraUpdates += extraMeta["title"] ? "ctx._source.title= \"" + extraMeta["title"] + "\";" : ""
    extraUpdates += extraMeta["tags"] ? "ctx._source.tags= \"" + extraMeta["tags"] + "\";" : ""
    extraUpdates += extraMeta["description"] ? "ctx._source.description= \"" + extraMeta["description"] + "\";" : ""

    var timeUpdates = startTime && endTime ? "ctx._source.timeRangeStart= " + startTime.getTime() + "L; ctx._source.timeRangeEnd= " + endTime.getTime() + "L;" : ""


    var query = {
      "script": {
        "inline": timeUpdates + extraUpdates,
        "lang": "painless"
      },

      "query": {
        "bool": {
          "must":[
            {"term":{"type":"output"}},
            {"term":{"mid": mid}},
            {"term":{"schema.raw": schema}}
          ]
        }
      }
    };

    return query
  }


  function _getExtraFeatureMetaESQuery(mid, rid){

    var query = {
      "query": {
        "bool": {
          "must":[
            {"term":{"type":"features"}},
            {"term":{"status":"trained"}},
            {"term":{"mid": mid}},
            {"term":{"rid": rid}},
          ]
        }
      }
    };

    return query
  }



  function _getLastFeatureJobs(canonicalName, state){

    var parts = canonicalName.split("/")
    var tenant = parts.length > 0 ? parts[0] : parts[0]
    var name = parts.length > 1 ? parts[1] : parts[0]
    var query = {
      "size": 20,
      "query": {
        "bool": {
          "must":[
            {"term":{"type":"features"}},
            {"term":{"tenant.raw": tenant}},
            {"term":{"name.raw": name}},
            {"term":{"status.raw": state}},
            {"range": {
              "updated":{
                "gte" : Date.now() - (1000 * 60 * 60 * 24),
                "lte" : Date.now()
              }
            }}
          ]
        }
      }
    }

    return query
  }



  function _getFeatureJobAggregations(canonicalName){
    var query = {

      "size": 0,
      "query": {
        "bool": {
          "must":[
            {"term":{"type":"features"}},
            {"match":{"name":canonicalName}},
            {"range": {
              "updated":{
                "gte" : Date.now() - (1000 * 60 * 60 * 24),
                "lte" : Date.now()
              }
            }}
          ]
        }
      },

      "aggs": {
        "tenants": {
          "terms": {
            "field": "tenant.raw",
            "size": 20
          },

          "aggregations": {
            "names": {
              "terms": {
                "field": "name.raw",
                "size": 50
              },

              "aggregations": {
                "status": {
                  "terms": {
                    "field": "status.raw",
                    "size": 10
                  }
                }
              }
            }
          }
        }
      }
    }

    return query;
  }


  function _getFeatureAggregations(){
    var query = {
      "size": 0,
      "query": {
        "bool": {
          "must":[
            {"term":{"type":"output"}}
          ]
        }
      },

      "aggs": {
        "tenants": {
          "terms": {
            "field": "tenant.keyword",
            "size": 20
          },

          "aggregations": {
            "names": {
              "terms": {
                "field": "modelName.keyword",
                "size": 50
              },

              "aggregations": {
                "schemas": {
                  "terms": {
                    "field": "schema.raw",
                    "size": 20
                  }
                }
              }
            }
          }
        }
      }
    }

    return query;
  }


  function _getExtraFeatureContextESQuery(mid, rid){

    var query = {
      "query": {
        "bool": {
          "must":[
            {"bool":{"should":[{"term":{"status": "trained"}}, {"term":{"status": "training"}}]}},
            {"term":{"type":"features"}},
            {"term":{"mid": mid}},
            {"term":{"rid": rid}},
          ]
        }
      }
    };

    return query
  }



  function _getInputMetaESQuery(mid, rid){

    var query = {
      "query": {
        "bool": {
          "must":[
            {"term":{"type":"input"}},
            {"term":{"mid": mid + (rid ? "-" + rid : "")}},
          ]
        }
      }
    };

    return query
  }


  function _createESQuery(searchString, isModel, startDate, endDate, tags){

    var attributePaths = searchString.split("/");
    var generalSearchTerm = null;

    if(attributePaths.length <= 1){
        generalSearchTerm = attributePaths[0];
    }

    var query = {
      "application": "search",
      "pipelineName": generalSearchTerm,
    };

    return query
  };


  function _fetchData(queryObj, callback, path, accessToken){


    var ES_FeatureStore = path || ""
    //var body = this._createESQuery(searchString, false);
    var body = queryObj

    fetch(ES_URL + ES_FeatureStore, {
        method: "POST", // *GET, POST, PUT, DELETE, etc.
        mode: "cors", // no-cors, cors, *same-origin
        cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
        credentials: "same-origin", // include, same-origin, *omit
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Authorization": "Bearer " + accessToken
          // "Content-Type": "application/x-www-form-urlencoded",
        },
        redirect: "follow", // manual, *follow, error
        referrer: "no-referrer", // no-referrer, *client
        body: JSON.stringify(body), // body data type must match "Content-Type" header
    }).then(function(response) {
      if(!response.ok){
        throw response;
      }
      var respJSON = response.json();
      return respJSON
    }).then(function(respJSON){
      var hits = respJSON && respJSON.length ? respJSON : [
        {"canonicalName": "canonical", "pipelineName":"Pipeline", "pipelineRunId":"pipelineRunId", "pipelineStage":"Stage", "id":"MID", "version":"version", "created":0, "updated":0, "artifactBlob":"", "tags":{}, "parameters":{}}
      ]
      return callback(null, hits);
    }).catch(function(err){
      if(err.json){
        err.json().then(errJson => {
          return callback({status: err.status, message: errJson.error.message},[])
        });
      }else{
        return callback({status: err.status, message: null},[]);
      }
    })

  };


  function _fetchDataRaw(queryObj, callback, path, explainURL, accessToken){

    var baseURL = explainURL ? explainURL : ES_URL;
    var ES_ModelStorePath = path || ""
    //var body = this._createESQuery(searchString, false);
    var body = queryObj

    fetch(baseURL + ES_ModelStorePath, {
        method: "POST", // *GET, POST, PUT, DELETE, etc.
        mode: "cors", // no-cors, cors, *same-origin
        cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
        credentials: "same-origin", // include, same-origin, *omit
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Authorization": "Bearer " + accessToken
          // "Content-Type": "application/x-www-form-urlencoded",
        },
        redirect: "follow", // manual, *follow, error
        referrer: "no-referrer", // no-referrer, *client
        body: JSON.stringify(body), // body data type must match "Content-Type" header
    }).then(function(response) {
      var respJSON = response.json()
      return respJSON
    }).then(function(respJSON){
      return callback(null, respJSON)
    }).catch(function(err){
      console.log("_fetchRaw mystery error: ", err)
      if(err.json){
        err.json().then(errJson => {
          return callback({status: err.status, message: errJson.error.message},[])
        });
      }else{
        return callback({status: err.status, message: null},[]);
      }
    })

    //TODO add error handler here

  }




module.exports = {
  _createESQuery: _createESQuery,
  _softDeleteESQuery: _softDeleteESQuery,
  _updateTimeContextESQuery: _updateTimeContextESQuery,
  _getExtraFeatureMetaESQuery: _getExtraFeatureMetaESQuery,
  _getInputMetaESQuery:_getInputMetaESQuery,
  _getExtraFeatureContextESQuery: _getExtraFeatureContextESQuery,
  _getFeatureAggregations:_getFeatureAggregations,
  _getFeatureJobAggregations: _getFeatureJobAggregations,
  _getLastFeatureJobs: _getLastFeatureJobs,
  _loginQuery: _loginQuery,
  _fetchData: _fetchData,
  _fetchDataRaw:_fetchDataRaw
};
