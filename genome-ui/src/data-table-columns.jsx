const React = require('react');
const ReactDOM = require("react-dom");

import Button from '@material-ui/core/Button';
import Icon from '@material-ui/core/Icon';
import IconButton from '@material-ui/core/IconButton';
import ChartIcon from '@material-ui/icons/Timeline';
import CancelIcon from '@material-ui/icons/Cancel';
import OnlineIcon from '@material-ui/icons/CheckCircle';
import OfflineIcon from '@material-ui/icons/RadioButtonUnchecked';
import ErrorIcon from '@material-ui/icons/Error';

import Snackbar from '@material-ui/core/Snackbar';
import Chip from '@material-ui/core/Chip'
import TextField from '@material-ui/core/TextField';

import EditIcon from '@material-ui/icons/Edit';

import {getDetailArtifact} from './detail-dialog-artifact';
import ModelDetailPicker from './model-detail-dialog';
import ModelLearningCurve from './model-learn-curve';

const styles = theme => ({
  button: {
    margin: theme.spacing.unit,
    float:"left",
  },

  icon: {
    margin: theme.spacing.unit,
    fontSize: 8,
  }
});

function getColumns(artifactType){
  if(artifactType === "modelArtifact"){
    return getModelColumns();
  }else if(artifactType === "dataArtifact" || artifactType === "dataset"){
    return getDataColumns();
  }else if(artifactType === "transform"){
    return getTransformSpecColumns();
  }else if(artifactType === "pipeline"){
    return getPipelineSpecColumns();
  }else if(artifactType === "pipelineRun"){
    return getPipelineColumns();
  }else if(artifactType === "evaluation"){
    return getEvaluationColumns(false);
  }else if(artifactType === "evaluationRun"){
    return getEvaluationColumns();
  }else if(artifactType === "deployment"){
    return getDeploymentColumns();
  }
  return getModelColumns();
}


function getDeploymentColumns(){
  return _getColumns("deployment");
}

function getDataColumns(){
  return _getColumns("dataArtifact");
}

function getTransformSpecColumns(){
  return _getColumns("transform");
}

function getModelColumns(){
  return _getColumns("modelArtifact");
}

function getPipelineColumns(){
  return _getColumns("pipelineRun");
}

function getPipelineSpecColumns(){
  return _getColumns("pipeline");
}

function getEvaluationColumns(run=true){
  var evalCols = _getColumns(run ? "evaluationRun" : "evaluation");
  evalCols.splice(6, 1, {name:"Passed", options:{
    filter:true,
    customBodyRender: (value, tableMeta, updateValue) => {
      const success = value === 1;
      const error = value === 0;
      var BtnType = success ? <OnlineIcon color="primary" className={styles.icon} style={{fontSize:"1.6em"}}/> : <OfflineIcon className={styles.icon} style={{fontSize:"1.6em"}}/>
      if(error){
        BtnType = <ErrorIcon className={styles.icon} style={{color:"#e5383b", fontSize:"1.6em"}}/>
      }

      return (
      <div style={{"width":"2em"}}>
          {BtnType}
      </div>
      );
    }
  }});
  return evalCols;
}

function _getColumns(artifactType){

  var columnLabels = {
    "artifact": "ArtifactId",
    "name": "PipelineName",
    "time": "Created",
    "tag": "Version"
  };

  if(artifactType === "modelArtifact"){
    columnLabels["artifact"] = "ModelId";
  }else if(artifactType === "dataset"){
    columnLabels["artifact"] = "Dataset";
    columnLabels["time"] = "Start | End";
  }else if(artifactType === "dataArtifact"){
    columnLabels["artifact"] = "Dataset";
    columnLabels["time"] = "Start | End";
  }else if(artifactType === "transform"){
    columnLabels["artifact"] = "Transform Spec";
    columnLabels["name"] = "Name";
  }else if(artifactType === "evaluation"){
    columnLabels["artifact"] = "Evaluation Spec";
    columnLabels["name"] = "Name";
  }else if(artifactType === "evaluationRun"){
    columnLabels["artifact"] = "Evaluation";
    columnLabels["name"] = "Name";
  }else if(artifactType === "pipeline"){
    columnLabels["artifact"] = "Pipeline Spec";
  }else if(artifactType === "deployment"){
    columnLabels["artifact"] = "Deployment";
    columnLabels["name"] = "Name";
    columnLabels["tag"] = "Type";
  }

  var cols = [
    {name:"Application", options:{
      filter:true,
      customBodyRender: (value, tableMeta, updateValue) => {
         return (<div className={"cellSmall"}>{value}</div>)
      }
    }},

    {name: columnLabels["name"], options:{
      filter:true,
      customBodyRender: (value, tableMeta, updateValue) => {
         return (<div className={"cellSmall"}>{value}</div>)
      }
    }},

    {name:"Stage", options:{
      filter:true,
      customBodyRender: (value, tableMeta, updateValue) => {
         return (<div className={"cellSmall"}>{value}</div>)
      }
    }},

    {name:"RunId", options:{
      filter:true,
      customBodyRender: (value, tableMeta, updateValue) => {
         return (<div className={"cellSmall"}>{value}</div>)
      }
    }},

    {name: columnLabels["artifact"], options:{
      filter:true,
      customBodyRender: (value, tableMeta, updateValue) => {
         return (<div className={"cellSmall"}>{value}</div>)
      }
    }},

    {name: columnLabels["tag"], options:{
      filter:true,
      customBodyRender: (value, tableMeta, updateValue) => {
         return (<div className={"cellSmall"}>{value}</div>)
      }
    }},

    {name:"Status", options:{
      filter:true,
      customBodyRender: (value, tableMeta, updateValue) => {
        const colorOfBtn = value === "deployed" ? "primary" : "disabled"
        const online = value === "deployed" || value === 1;
        const error = value === 2;
        var BtnType = online ? <OnlineIcon color="primary" className={styles.icon} style={{fontSize:"1.6em"}}/> : <OfflineIcon className={styles.icon} style={{fontSize:"1.6em"}}/>
        if(error){
          BtnType = <ErrorIcon className={styles.icon} style={{color:"#e5383b", fontSize:"1.6em"}}/>
        }

        return (
        <div style={{"width":"2em"}}>
            {BtnType}
        </div>
        );
      }
    }},

    {name: columnLabels["time"], options:{
      filter:true,
      customBodyRender: (value, tableMeta, updateValue) => {
         return (<div className={"cellSmall"}>{value}</div>)
      }
    }},

    {name:"Actions", options:{
      filter:false,
      sort:false,
      customBodyRender: (value, tableMeta, updateValue) => {
        return (
          <div style={{"float":"left", width:"8em"}}>
          <ModelDetailPicker meta={value} artifactId={value["id"]} change={(artifact, artifactType) => { return updateValue(getDetailArtifact(artifact, artifactType))}} />
          <ModelLearningCurve meta={value} artifactId={value["id"]} />
          </div>
        );
      }

    }}
  ];

  return cols;
}

export default getColumns;
