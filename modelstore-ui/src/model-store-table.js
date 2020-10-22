const React = require('react');
const ReactDOM = require("react-dom");
// const vis = require("vis");

const MUIDataTable = require("mui-datatables");

const _softDeleteESQuery = require("./elastic-queries")._softDeleteESQuery
const _createESQuery = require("./elastic-queries")._createESQuery
const _getFeatureJobAggregations = require("./elastic-queries")._getFeatureJobAggregations
const _getLastFeatureJobs = require("./elastic-queries")._getLastFeatureJobs
const _fetchData = require("./elastic-queries")._fetchData
const _fetchDataRaw = require("./elastic-queries")._fetchDataRaw

import {BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Label} from 'recharts';

import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Icon from '@material-ui/core/Icon';
import IconButton from '@material-ui/core/IconButton';
import ChartIcon from '@material-ui/icons/Timeline';
import CancelIcon from '@material-ui/icons/Cancel';
import OnlineIcon from '@material-ui/icons/CheckCircle';
import OfflineIcon from '@material-ui/icons/RadioButtonUnchecked';
import Snackbar from '@material-ui/core/Snackbar';
import Chip from '@material-ui/core/Chip'
import TextField from '@material-ui/core/TextField'

import EditIcon from '@material-ui/icons/Edit';

import ModelEditPicker from './model-edit-dialog'


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



var DATA = [
  ["PipelineName", "Stage", "RunId", "ModelID", "Online-State", "Version", "Created",
  {"mid":"no-mid", "schema":"no-schema", "url":"Chart", "artifactBlob":{}, "parameters":{}, "tags":{}}],
];

var CHART_DATA = [];
var SELECTED_DATES = {start: null, end:null, featureStart:null, featureEnd:null};
var ARTIFACT_TYPE = "model";

var GRAPH_INSTANCE = null;
//var GRAPH_DATA = {
//    nodes: new vis.DataSet([]),
//    edges: new vis.DataSet([])
//};

const GRAPH_CONFIG = {
  height:"250px",
  nodes:{
    color:{
      border: '#444444',
      background: 'rgba(181, 209, 255, 0.9)',
      highlight: {
        border: '#333333',
        background: 'rgba(118, 158, 224, 1)'
      },
    },
    shape:"dot",
    shadow: true,
    borderWidth: 2.5,
    borderWidthSelected: 4.5,
    font: {
      color: '#444444',
      size: 24
    }
  },
  edges: {
    width:2,
    selectionWidth: function (width) {return width*2;},
  }
};


//Used for enabling direct links to AWS Lambda logs from training and deployment stages of jobs
var LAMBDA_TO_GRAPH_STATES_MAPPING = {

  "schedule":{
    "training": "MLModel_Scheduled_Job_Handler",
    "trained": "MLModel_Framework_JobStatus_Updater",
    "error": "MLModel_Framework_JobStatus_Updater",
  },

  "subscriptions":{
    "training": "MLModel_Scheduled_Job_Handler",
    "trained": "MLModel_Framework_JobStatus_Updater",
    "error": "MLModel_Framework_JobStatus_Updater",
  },

  "manual": {
    "training": "MLModel_Framework_Job_Handler",
    "trained": "MLModel_Framework_JobStatus_Updater",
    "error": "MLModel_Framework_JobStatus_Updater"
  }

}


var NUM_SEARCH = 0

const columns = [
      {name:"PipelineName", options:{filter:true}},

      {name:"Stage", options:{
        filter:true,
        customRender: (value, tableMeta, updateValue) => {
           return (<div className={"cellSmall"}>{value}</div>)
        }
      }},
      {name:"RunId", options:{
        filter:true,
        customRender: (value, tableMeta, updateValue) => {
           return (<div className={"cellSmall"}>{value}</div>)
        }
      }},
      {name:"ModelId", options:{
        filter:true,
        customRender: (value, tableMeta, updateValue) => {
           return (<div className={"cellSmall"}>{value}</div>)
        }
      }},
      {name:"Status", options:{
        filter:true,
        customRender: (value, tableMeta, updateValue) => {
          const colorOfBtn = value === "deployed" ? "primary" : "disabled"
          const online = value === "deployed" || value === 1;
          const error = value === 2;
          var BtnType = online ? <OnlineIcon color="primary" className={styles.icon} style={{fontSize:"1.6em"}}/> : <OfflineIcon className={styles.icon} style={{fontSize:"1.6em"}}/>
          if(error){
            BtnType = <CancelIcon color="secondary" className={styles.icon} style={{fontSize:"1.6em"}}/>
          }

          return (
          <div style={{"width":"2em"}}>
              {BtnType}
          </div>
          );
        }
      }},

      {name:"Version", options:{
        filter:true,
        customRender: (value, tableMeta, updateValue) => {
           return (<div className={"cellSmall"}>{value}</div>)
        }
      }},

      {name:"Created", options:{
        filter:true,
        customRender: (value, tableMeta, updateValue) => {
           return (<div className={"cellSmall"}>{value}</div>)
        }
      }},

      {name:"Actions", options:{
        filter:false,
        sort:false,
        customRender: (value, tableMeta, updateValue) => {
          console.log("columnValue", value)
          var mid = value["mid"];
          var schemaColumnInput = value["schema"];

          return (
            <div style={{"float":"left", width:"8em"}}>
            <ModelEditPicker meta={value} />
            <div style={{"float":"left", "width":"45%", marginLeft:"-1em"}}>
            <Button variant="fab" mini color="primary" target="_blank" href={value["url"]} className={styles.button}>
              <Icon>poll</Icon>
            </Button>
            </div>
            </div>
          );
        }

      }}
    ];



export default class ModelStoreTable extends React.Component {

  constructor(props){
    super(props);
  }

  state = {
    data: DATA,
    elements: [],
    snackbarOpen: false,
    snackbarMessage: "",
    snackbarLambdaLink: "",
    snackbarSplunkLink: "",
    attachedSearchHandler: false
  }

  _constructInput(cls, placeholder){
    return (<TextField className={cls} label={placeholder || ""} style={{width:"8.5em", marginLeft:"1em"}}/>)
  }

  componentDidMount() {
    var self = this;
    document.addEventListener("keydown", this.onKeyDown(this), false);

    setTimeout(function(){
      document.querySelector('div[role="toolbar"] h2').textContent = '';
      ReactDOM.render(
        <TextField fullWidth className="mainSearch" label="search..." />,
        document.querySelector('div[role="toolbar"] h2'))
    },50);

    setTimeout(function(){
    document.querySelector('button[aria-label="Search"]').addEventListener("click", function(evt){
      setTimeout(function(){

        if(document.querySelector('div[aria-label="Search"] > span > div.addedInpt:nth-child(2)')) return;

        var container = document.querySelector('div[aria-label="Search"]')

        ReactDOM.render(
          <span>
          {self._constructInput("addedInpt", "pipeline")}
          {self._constructInput("addedInpt", "stage")}
          {self._constructInput("addedInpt", "run")}
          </span>,
          document.querySelector('div[aria-label="Search"]'))


        document.querySelector('div[role="toolbar"] > div:nth-child(1) > div > button')
          .addEventListener("click", function(e){
              setTimeout(function(){
                document.querySelector('div[role="toolbar"] h2').textContent = '';
                ReactDOM.render(
                  <TextField fullWidth className="mainSearch" label="search..." />,
                  document.querySelector('div[role="toolbar"] h2'))
              }, 50);
            });
      }, 50);
    }, false);
  }, 50);

    this.props.onRef(this)
  }


  componentWillUnmount() {
    document.removeEventListener("keydown", this.onReturn, false);
    this.props.onRef(undefined)
  }

  _fromutc(utcTime){
    var localTs = new Date(utcTime);
    var utcTs = Date.UTC(localTs.getFullYear(), localTs.getMonth(), localTs.getDate(), localTs.getHours(), localTs.getMinutes(), localTs.getSeconds())
    return new Date((utcTime - utcTs) + utcTime)
  }

  _printDate(utcTime){
    var dt = this._fromutc(utcTime)
    var month = dt.getMonth() + 1 <= 9 ? ("0" + (dt.getMonth() + 1)) : (dt.getMonth() + 1)
    var day = dt.getDate() <= 9 ? ("0" + (dt.getDate())) : (dt.getDate())
    var hours = dt.getHours() <= 9 ? ("0" + (dt.getHours())) : (dt.getHours())
    var minutes = dt.getMinutes() <= 9 ? ("0" + (dt.getMinutes())) : (dt.getMinutes())

    return dt.getFullYear() + "/" + month + "/" + day + " " + hours + ":" + minutes
  }

  _dataWithFillers(hits){

    var agg_chart = {}
    var index_xchart = []
    var displayed = {}
    var displayValuesFilled = []

    var self = this;

    hits.forEach(function(el, i){

        var currentDate = self._fromutc(el["created"])
        var x = currentDate.getFullYear() + "/" + (currentDate.getMonth() + 1) + "/" + currentDate.getDate();
        agg_chart[x] =  agg_chart[x] ? agg_chart[x] + 1 : 1;
        index_xchart[i] = x

        if(i == 0) agg_chart["last_event"] = x
        return {name:x, y:agg_chart[x]}
    })

    var totalElements = 0
    var reversedHits = hits.reverse()

    reversedHits.forEach(function(el, i){
        var currentDate = self._fromutc(el["created"])
        var x = currentDate.getFullYear() + "/" + (currentDate.getMonth() + 1) + "/" + currentDate.getDate();

        if(!displayed[x]){
          displayValuesFilled.push({name:x, y:agg_chart[x]})
          displayed[x] = 1
        }

        if(i == hits.length - 1 || x === index_xchart[i + 1] || x === agg_chart["last_event"]) return {}
        while(totalElements < 10000){
          totalElements++;
          currentDate.setTime(currentDate.getTime() + (1 * 24 * 60 * 60 * 1000))
          var m = currentDate.getFullYear() + "/" + (currentDate.getMonth() + 1) + "/" + currentDate.getDate();
          if(agg_chart[m]){
            break;
          }

          displayValuesFilled.push({name:m, y:0})
        }
        return {}
    })

    return displayValuesFilled
  }


  _getInputColumns(inputSchema){
    if(inputSchema && inputSchema.fields) {
      return inputSchema.fields.map(function(fieldSchema){
        return fieldSchema.name
      });
    }

    return []
  }


  _timeleonOutputChartURL(tenant, modelName, schema, columns){

    var link = "http://search-ml-model-manager-fntwapjhjdo4wvfvanrvkx2prq.us-west-2.es.amazonaws.com/_plugin/kibana/app/timelion#?_g=(refreshInterval:(display:Off,pause:!f,value:0),time:(from:now-7d,interval:'1d',mode:quick,timezone:America%2FLos_Angeles,to:now))&_a=(columns:2,interval:'1h',rows:2,selected:0,sheet:!('.es(index%3Dmodel-manager-index,%20q%3D!'_type:ml_model_feature%20AND%20tenant:"
                + encodeURIComponent(tenant)
                + "%20AND%20type:output%20AND%20modelName:"
                + encodeURIComponent(modelName)
                + "%20AND%20schema:"
                + encodeURIComponent(schema)
                + "!',%20timefield%3D!'created!').lines(fill%3D1.5).label(!'versions%2Fhr!')'"


                columns = columns || [];

                columns.push("_job_duration_m");
                columns.push("_job_container_num");
                columns.push("_job_cost_dollar");

                for(var i = 0; i < columns.length; i++){
                  link += ",'.es(index%3Dmodel-manager-index,%20q%3D!'_type:ml_model_feature_metric%20AND%20metric:count%20AND%20type:output%20AND%20name:"

                  + encodeURIComponent(modelName)
                  + "%20AND%20tenant:"
                  + encodeURIComponent(tenant)
                  + "%20AND%20column:"
                  + encodeURIComponent(columns[i])
                  + "!',%20timefield%3D!'created!',%20metric%3Davg:val.nd).lines(fill%3D2).title(!'"
                  + "%20column%20-%20" + columns[i] + "!').label(!'counts!')'"

                }

        link += "))"

    return link

  }


  _afterDeletedChangeUI(d){

    d = d.map(function(el){
      return el;
    })

    this.setState({data: d}, () => console.log("STATE update happened somehow"))

  }





  handleJobStateData(canonicalName, state){
    var self = this;
    var queryToES = _getLastFeatureJobs(canonicalName, state);

    var prependZero = function(num){ return num < 10 ? "0" + num : num}

    _fetchDataRaw(queryToES, function(resp){
      if(resp.hits && resp.hits.hits){
        var jobFound = resp.hits.hits[0]
        var isSchedule = jobFound["_source"]["schedule"] !== "@once"
        var isSubscription = jobFound["_source"]["subscriptions"]
        var isManual = jobFound["_source"]["schedule"] === "@once" && !jobFound["_source"]["backfill"] && !isSubscription

        var relevantLambdaName = "";
        if(isManual){
          relevantLambdaName = LAMBDA_TO_GRAPH_STATES_MAPPING["manual"][state]
        }else if(isSchedule){
          relevantLambdaName = LAMBDA_TO_GRAPH_STATES_MAPPING["schedule"][state]
        }else if(isSubscription){
          relevantLambdaName = LAMBDA_TO_GRAPH_STATES_MAPPING["subscriptions"][state]
        }

        var jobUpdated = new Date(Number(jobFound["_source"]["updated"]) || Date.now())
        var utcTimeStr = jobUpdated.getUTCFullYear() + "-" + prependZero(jobUpdated.getUTCMonth() + 1)
        + "-" + prependZero(jobUpdated.getUTCDate()) + "T" + prependZero(jobUpdated.getUTCHours()) + ":" + prependZero(jobUpdated.getUTCMinutes()) + ":"
        + jobUpdated.getUTCSeconds() + "Z"

        var lambdaLogsURL = "https://us-west-2.console.aws.amazon.com/cloudwatch/home?region=us-west-2#logEventViewer:group=/aws/lambda/"
        + relevantLambdaName + ";start=" + utcTimeStr

        var splunkLogsURL = "http://splunk.metrics.kmb.sonynei.net/en-US/app/search/search?q=search%20index%3Dservice%20svtype%3Demr%20clustername%3D%22kmj-ml-mastermind*%22%20type%3D%22emr-application%22%20"
        + encodeURIComponent(canonicalName) + "&display.page.search.mode=verbose&dispatch.sample_ratio=1&earliest=-24h%40h&latest=now&display.page.search.tab=events&display.general.type=events"


        self.setState({snackbarLambdaLink: lambdaLogsURL, snackbarSplunkLink:splunkLogsURL})

      }
    }, "ml_model/_search?sort=updated:desc");
  }


  handleJobStateGraphData(canonicalName){
    var self = this;
    var queryToES = _getFeatureJobAggregations(canonicalName);

    _fetchDataRaw(queryToES, function(resp){
      if(resp.aggregations){
        var tenants = resp.aggregations.tenants.buckets.map(function(tenant){
          return {"name": tenant.key, subElements: tenant.names.buckets.map(function(job){ return {
            name: job.key,
            count: job.doc_count,
            subElements: job.status.buckets.map(function(status){return {
              name : status.key,
              count: status.doc_count
            }})
          }})}
        });
        self.setState({elements: tenants}, self.updateJobStateGraphUI(canonicalName))
        console.log("tenants",tenants)
      }
    }, "ml_model/_search?sort=updated:desc");
  }


  updateJobStateGraphUI(canonicalName){


    var self = this;

    return function(){

      var nodes = [], edges =[];
      var nodeIds = {};

      var posY = -130
      var posX = -90

      for(var i = 0; i< self.state.elements.length; i++){
        var tenant = self.state.elements[i]
        for(var j=0;j<tenant.subElements.length;j++){
          var job = tenant.subElements[j]
          var jobName = tenant["name"] + "/" + job["name"]
          posY += 80
          posX = -90
          for(var k=0;k<job.subElements.length;k++){
            posX += 50
            var state = job.subElements[k]
            var cols = {"training": "#aaaaaa", "trained": "#3f9370", "error": "#f32222", "evaluated": "#ffa733"};
            var node = { x: posX, y: posY, size: 17, physics: false, fixed:true, id: jobName + " (" + state.name + ")", label:"" + state.count, font:"14px arial " + cols[state.name]};
            node.color = {border: cols[state.name], background:"rgba(253, 255, 254, 0.85)"}
            nodes.push(node);
          }
        }
      }

      //var legendNode = { x: -120, y:  -40, fixed:true, shape:"text", id: "legend-jobs", label:"Job Runs (" + canonicalName + ")", font:"18px arial #777777"};
      //legendNode.color = {background:"rgba(254, 255, 254, 0.85)"}
      //nodes.push(legendNode);

      ReactDOM.render(<Chip label={"Job Runs (" + canonicalName + ") | last 24h"} />, document.getElementById('chart-ctn-state-title'))

      //GRAPH_DATA = {nodes:new vis.DataSet(nodes)}

      //GRAPH_INSTANCE = new vis.Network(document.getElementById('chart-ctn-state'), GRAPH_DATA, GRAPH_CONFIG);
      //GRAPH_INSTANCE.on("click", function(evt){
      //  if(evt.nodes && evt.nodes.length){
      //    var message = evt.nodes[0]
      //    if(message != "legend-jobs"){
      //      var canonicalName = message.split(" ")[0];
      //      var state = message.split(" ")[1].replace("(", "").replace(")", "");

      //      self.handleJobStateData(canonicalName, state);
      //      self.setState({snackbarOpen:true, snackbarMessage: message })
      //    }
      //  }else{
      //    self.setState({snackbarOpen:false})
      //  }
      //})
    }

  }


  searchForValue(input, startVal, endVal, tags, accessToken){

    var self = this;

    var queryToES = _createESQuery(input.pipeline || "", false, startVal, endVal, tags);
    var from = startVal || Date.now() - (1000 * 60 * 60 * 24 * 7);
    var to = endVal || Date.now();
    var searchUrlQuery = "/modelstore/search?from=" + from + "+&to=" + to + "&sortDesc=created&size=50";

    if(!accessToken){
      self.setState({snackbarOpen:true, snackbarMessage: "session not valid anymore" })
      return;
    }

    if(input.keyword){
      queryToES = {"query": input.keyword};
      searchUrlQuery = "/modelstore/searchkeywords?from=" + from + "+&to=" + to + "&sortDesc=created&size=50";
    }

    if(input.artifactType){
      searchUrlQuery += "&artifactType=" + decodeURIComponent(input.artifactType)
    }

    _fetchData(queryToES, function(err, hits){

      if(err){
        var errMsg = err.message || "an error happened";
        if( err.status === 403 || err.status === 401 ){
          errMsg = "session is not valid"
        }
        self.setState({snackbarOpen:true, snackbarMessage: errMsg })
        return;
      }


      DATA = hits.map(function(el){
        var chartURL = self._timeleonOutputChartURL(el["pipelineName"], el["pipelineStage"], el["pipelineName"], self._getInputColumns(el["schemaMeta"]))
        var pipelineRunId = input.artifactType === "pipelineRun" ? el["id"] : (el["pipelineRunId"] || "");
        var modelId = input.artifactType === "model" ? el["id"] : "";
        var status = el["status"] || el["online"] || "no"

        return [el["pipelineName"], el["pipelineStage"] || "", pipelineRunId,
          modelId, status, el["versionName"] || "",
          self._printDate(el["created"]),
          {
            "mid":el["id"],
            "artifactType": el["artifactType"],
            "canonicalName": el["canonicalName"],
            "application": el["application"],
            "pipelineName": el["pipelineName"],
            "pipelineStage": el["pipelineStage"] || "",
            "pipelineRunId": el["pipelineRunId"] || "",
            "status": status,
            "framework": el["framework"] || "",
            "version": el["versionName"] || "",
            "parameters": el["parameters"] || {},
            "recipeRef": el["recipeRef"] || {},
            "artifactBlob": el["artifactBlob"] || {},
            "schedule": el["schedule"] || "",
            "nextRun": el["nextRun"] || 0,
            "featureImportance": el["featureImportance"] || [],
            "inputModality": el["inputModality"] || "",
            "start": self._printDate(el["created"]),
            "end": self._printDate(el["created"]),
            "updated": self._printDate(el["updated"]),
            "created": self._printDate(el["created"]),
            "duration": el["updated"] - el["created"],
            "schema":el["schema"],
            "schemaMeta":el["schemaMeta"],
            "title":el["title"],
            "description":el["description"],
            "howtouse":el["howtouse"],
            "path": el["path"],
            "pills": el["pills"],
            "tags":el["tags"],
            "inputs": el["dataRefs"] || [],
            "url":chartURL
          }]
      });

      var chartWidth = 900
      var padding = 50
      CHART_DATA = self._dataWithFillers(hits);


      self.setState({data: DATA});

      setTimeout(function(){

        //ReactDOM.render(React.createElement(App, null), document.getElementById("root"));


        ReactDOM.render(
            <BarChart
                data={CHART_DATA}
                width={chartWidth}
                height={200}
                margin={{top: 25, right: 30, left: 20, bottom: 5}}>

                <CartesianGrid strokeDasharray="3 3"/>
                <XAxis dataKey="name" tick={<CustomXTick />} fill="#888" />
                <YAxis/>
                <Tooltip/>
                <Legend verticalAlign="top" height={36}/>
                <Bar name="versions" dataKey="y" fill="#3f51b5" fillOpacity="0.85"/>

            </BarChart>,
            document.getElementById('chart-ctn'));

        //self.handleJobStateGraphData(inputVal);

      }, 500);
    }, searchUrlQuery, accessToken);
  }


  onKeyDown(self){

    self.onReturn = function(event){
      if (event.keyCode === 13) {

        var keywordSearch = document.querySelector('div.mainSearch input');
        var pipelineEl = document.querySelector('div[aria-label="Search"] > div.addedInpt:nth-child(1) input');
        var stageEl = document.querySelector('div[aria-label="Search"] > div.addedInpt:nth-child(2) input');
        var accessToken = sessionStorage.getItem("accessToken");

        //setting the address bar url
        if(keywordSearch && keywordSearch.value){
          console.log("getting return event - value of search", keywordSearch.value);
          var newLoc = document.location.protocol + "//" +
                   document.location.host +
                   document.location.pathname +
                   "?keyword=" + encodeURIComponent(keywordSearch.value) +
                   document.location.hash;

          self.searchForValue(
            {keyword: keywordSearch.value, artifactType: self.props.artifactType},
            SELECTED_DATES["start"],
            SELECTED_DATES["end"],
            null,
            accessToken);
          window.history.replaceState( {} , "ModelStore UI", newLoc);


          keywordSearch.value = "";
        } else if(pipelineEl){
          console.log("getting return event - value of search", pipelineEl.value);
          var newLoc = document.location.protocol + "//" +
                   document.location.host +
                   document.location.pathname +
                   "?pipelineName=" + encodeURIComponent(pipelineEl.value) +
                   document.location.hash;

          self.searchForValue(
            {pipeline: pipelineEl.value, artifactType: self.props.artifactType},
            SELECTED_DATES["start"],
            SELECTED_DATES["end"],
            null,
            accessToken);
          window.history.replaceState( {} , "ModelStore UI", newLoc);

          pipelineEl.value = "";
        }
      }
    }

    return self.onReturn

  }




  render() {

    this.now = null;

    console.log(this.now, DATA.length, DATA);

    const options = {
      filterType: 'dropdown',
      responsive: 'stacked',


      onRowsSelect: function(currentSeleted, rowsSelect){
        console.log("current, rows", currentSeleted, rowsSelect);
        var pickerDom = document.getElementById("chart-ctn");
        if(rowsSelect && rowsSelect.length){
          pickerDom.style.display = "none";
        }else if (rowsSelect && rowsSelect.length == 0){
          pickerDom.style.display = "block";
        }
      },


      onRowsDelete: function(self){ return function(rowsDeleted){
        console.log("rows deleted:", rowsDeleted)
        var midsToDelete = [];
        for(var i=0; i<rowsDeleted.data.length;i++){
          var tuple = [DATA[rowsDeleted.data[i].dataIndex][3], DATA[rowsDeleted.data[i].dataIndex][2]];
          midsToDelete.push(tuple);
          DATA.splice(rowsDeleted.data[i].dataIndex, 1);
        }

        console.log("row mid-s to delete:", midsToDelete);

        _fetchData(_softDeleteESQuery(midsToDelete), function(hits){
          console.log("completed soft delete - whatever hits means", hits);
        }, "ml_model_feature/_update_by_query");


        //now update the ui and rerender
        //var searchTerms = DATA[rowsDeleted.data[0].dataIndex][0] + "/" + DATA[rowsDeleted.data[0].dataIndex][1] + "/" + DATA[rowsDeleted.data[0].dataIndex][2]
        //self.searchForValue(searchTerms, SELECTED_DATES["start"], SELECTED_DATES["end"]);

        console.log("updating UI with new length: ", DATA.length)
        self._afterDeletedChangeUI(DATA)


        //setTimeout(function(){
        //  ReactDOM.render(React.createElement(App, null), document.getElementById("root"));
        //}, 500);

        document.getElementById("chart-ctn").style.display = "block"

        throw "no further deletions to send"

      }}(this),

      onSearchChange: function(self){ return function(searchString){
        console.log("new-search-string:", searchString);

        throw "no useful search";

      }}(this)
    };


    return (
      <div id="very-top">
      <div id="very-top-messages-lineage"></div>
      <div id="very-top-messages">
        <Snackbar
          anchorOrigin={{ vertical:"top", horizontal:"right"}}
          open={this.state.snackbarOpen}
          onClose={() => {
            this.setState({snackbarOpen:!this.state.snackbarOpen})
          }}
          ContentProps={{
            'aria-describedby': 'message-id',
          }}
          message={<span id="message-id">{this.state.snackbarMessage}</span>}
        />

      </div>
      <MUIDataTable
        title={"Search"}
        data={this.state.data}
        columns={columns}
        options={options}
      />
      </div>
    );
  }


};



class CustomXTick extends React.Component {

  render () {
    const {x, y, stroke, payload} = this.props;
    return (

      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={16} textAnchor="end" fill="#888" fontFamily="Arial" fontSize={8} transform="rotate(-20)">{payload.value}</text>
      </g>
    );
  }
};
