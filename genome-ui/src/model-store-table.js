const React = require('react');
const ReactDOM = require("react-dom");


const _softDeleteESQuery = require("./elastic-queries")._softDeleteESQuery
const _createESQuery = require("./elastic-queries")._createESQuery
const _fetchData = require("./elastic-queries")._fetchData
const _fetchDataRaw = require("./elastic-queries")._fetchDataRaw


import MUIDataTable from "mui-datatables";
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

import getColumns from './data-table-columns'
import {getDetailArtifact, dateFormat} from './detail-dialog-artifact';


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
  ["Application", "PipelineName", "Stage", "RunId", "ArtifactId", "Status", "Version", "Created",
  {"mid":"no-mid", "application":"app", "schema":"no-schema", "url":"Chart", "artifactBlob":{}, "parameters":{}, "tags":{}}],
];

const testDATA = [["col-1", "col-2"]]

var CHART_DATA = [];
var SELECTED_DATES = {start: null, end:null, featureStart:null, featureEnd:null};
var ARTIFACT_TYPE = "modelArtifact";
var NUM_SEARCH = 0;


export default class ModelStoreTable extends React.Component {

  constructor(props){
    super(props);
  }

  state = {
    data: DATA,
    elements: [],
    artifactType: ARTIFACT_TYPE,
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


  _afterDeletedChangeUI(d){

    d = d.map(function(el){
      return el;
    })

    this.setState({data: d}, () => console.log("STATE update happened somehow"))

  }



  searchForValue(input, startVal, endVal, tags, accessToken){

    var self = this;

    var queryToES = _createESQuery(input.pipeline || "", false, startVal, endVal, tags);
    var from = startVal ? ("from=" + startVal) : "";
    var to = endVal ? ("to=" + endVal) : "";
    const timeRange = !from && !to ? "&" : (from + "&" + to + "&");

    var searchUrlQuery = "/modelstore/search?" + timeRange + "sortDesc=created&size=50";
    if(input.artifactType === "dataArtifact"){
      searchUrlQuery = "/modelstore/search-data?" + timeRange + "sortDesc=created&size=50";
    }else if(["evaluation", "evaluationRun"].includes(input.artifactType)){
      searchUrlQuery = "/modelstore/search-validations?" + timeRange + "sortDesc=created&size=50";
    }

    if(!accessToken){
      self.setState({snackbarOpen:true, snackbarMessage: "session not valid anymore" })
      return;
    }

    if(input.keyword){
      queryToES = {"query": input.keyword};
      searchUrlQuery = "/modelstore/searchkeywords?" + timeRange + "sortDesc=created&size=50";
      if(input.artifactType === "dataArtifact"){
        searchUrlQuery = "/modelstore/search-data-keywords?" + timeRange + "sortDesc=created&size=50";
      }else if(["evaluation", "evaluationRun"].includes(input.artifactType)){
        searchUrlQuery = "/modelstore/search-validations-keywords?" + timeRange + to + "sortDesc=created&size=50";
      }
    }

    if(input.artifactType){
      self.setState({artifactType: input.artifactType});
      if(["evaluation", "evaluationRun"].includes(input.artifactType)){
        queryToES["artifactType"] = input.artifactType;
      }else{
        searchUrlQuery += "&artifactType=" + decodeURIComponent(input.artifactType);
      }
    }

    _fetchData(queryToES, (err, hits) => {

      if(err){
        var errMsg = err.message || "an error happened";
        if( err.status === 403 || err.status === 401 ){
          errMsg = "session is not valid"
        }
        self.setState({snackbarOpen:true, snackbarMessage: errMsg })
        return;
      }


      DATA = hits.map(function(el){

        //pipelineRun column
        var pipelineRunId = input.artifactType === "pipelineRun" ? el["id"] : (el["pipelineRunId"] || "");

        //artifactId column
        var artifactId = input.artifactType === "modelArtifact" ? el["id"] : "";
        artifactId = input.artifactType === "pipeline" ? el["id"] : artifactId;
        artifactId = input.artifactType === "evaluation" ? el["id"] : artifactId;
        artifactId = input.artifactType === "evaluationRun" ? el["id"] : artifactId;
        artifactId = input.artifactType === "transform" ? el["id"] : artifactId;
        artifactId = input.artifactType === "deployment" ? el["id"] : artifactId;
        artifactId = input.artifactType === "dataArtifact" ? el["id"] : artifactId;

        //version column
        var versionSlot = el["versionName"] || ""
        versionSlot = input.artifactType === "deployment" ? el["deploymentType"] : versionSlot;

        //artifactName column
        var artifactName = input.artifactType === "pipeline" ? el["canonicalName"] : el["pipelineName"];
        artifactName = input.artifactType === "evaluation" ? el["canonicalName"] : artifactName;
        artifactName = input.artifactType === "transform" ? el["canonicalName"] : artifactName;
        artifactName = input.artifactType === "deployment" ? el["canonicalName"] : artifactName;

        //status column
        var status = el["status"] || el["online"] || "no";
        status = input.artifactType === "evaluationRun" ? el["status"] : status;




        return [el["application"] || "", artifactName, el["pipelineStage"] || "", pipelineRunId,
          artifactId, versionSlot, status,
          dateFormat(el["created"]), getDetailArtifact(el, input.artifactType)
        ]
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
                <Bar name="artifacts" dataKey="y" fill="#3f51b5" fillOpacity="0.85"/>

            </BarChart>,
            document.getElementById('chart-ctn'));

        //self.handleJobStateGraphData(inputVal);

      }, 500);
    }, searchUrlQuery, accessToken);
  }


  onKeyDown(self){

    self.onReturn = function(event){
      if (event.keyCode === 13) {

        var keywordSearch = document.querySelector('div[data-test-id="Search"] > input');
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
          window.history.replaceState( {} , "Genome UI", newLoc);


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
          window.history.replaceState( {} , "Genome UI", newLoc);

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
      responsive: 'vertical',
      searchAlwaysOpen: true,
      download: false
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
        columns={getColumns(this.state.artifactType)}
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
