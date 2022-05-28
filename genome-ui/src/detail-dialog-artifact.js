
function _fromutc(utcTime){
  const localTs = new Date(utcTime);
  const utcTs = Date.UTC(localTs.getFullYear(), localTs.getMonth(), localTs.getDate(), localTs.getHours(), localTs.getMinutes(), localTs.getSeconds())
  return new Date((utcTime - utcTs) + utcTime)
}


function dateFormat(utcTime){
  var dt = _fromutc(utcTime)
  var month = dt.getMonth() + 1 <= 9 ? ("0" + (dt.getMonth() + 1)) : (dt.getMonth() + 1)
  var day = dt.getDate() <= 9 ? ("0" + (dt.getDate())) : (dt.getDate())
  var hours = dt.getHours() <= 9 ? ("0" + (dt.getHours())) : (dt.getHours())
  var minutes = dt.getMinutes() <= 9 ? ("0" + (dt.getMinutes())) : (dt.getMinutes())

  return dt.getFullYear() + "/" + month + "/" + day + " " + hours + ":" + minutes
}

function getDetailArtifact(el, artifactQueryType){

  if(!artifactQueryType) {
    artifactQueryType = el["artifactType"]
  };

  if(el["detailArtifact"]) {
    return el;
  };

  return {
    "id":el["id"],
    "mid":el["id"],
    "detailArtifact": true,
    "artifactType": el["artifactType"] || artifactQueryType,
    "canonicalName": el["canonicalName"],
    "application": el["application"],
    "pipelineName": el["pipelineName"],
    "pipelineStage": el["pipelineStage"] || "",
    "pipelineRunId": el["pipelineRunId"] || "",
    "status": status,
    "framework": el["framework"] || "",
    "version": el["versionName"] || "",
    "parameters": el["parameters"] || {},
    "pipelineRef": el["pipelineRef"] || {},
    "recipeRef": el["recipeRef"] || {},
    "artifactBlob": el["artifactBlob"] || {},
    "schedule": el["schedule"] || "",
    "nextRun": el["nextRun"] || 0,
    "featureImportance": el["featureImportance"] || [],
    "inputModality": el["inputModality"] || "",
    "format": el["format"] || "",
    "dataset": el["dataset"] || "",
    "start": dateFormat(el["created"]),
    "end": dateFormat(el["created"]),
    "updated": dateFormat(el["artifactTime"]),
    "created": dateFormat(el["created"]),
    "duration": el["artifactTime"] - el["created"],
    "schema":el["schema"],
    "schemaMeta":el["schemaMeta"],
    "title":el["title"],
    "description":el["description"],
    "howtouse":el["howtouse"],
    "path": el["path"],
    "pills": el["pills"],
    "tags":el["tags"],
    "inputs": el["dataRefs"] || [],
    "dimension": el["dimension"],
    "tasks": el["tasks"],
    "metrics": el["metrics"],
    "targetRef": el["validationTarget"] ? el["validationTarget"]["ref"] : null,
    "targetRefType": el["validationTarget"] ? el["validationTarget"]["refType"] : null,
    "url":"#"
  };
}


export {getDetailArtifact, dateFormat};
