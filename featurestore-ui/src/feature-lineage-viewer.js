
const React = require('react');
const ReactDOM = require("react-dom");
const vis = require("vis");

import Button from '@material-ui/core/Button';



import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import TextField from '@material-ui/core/TextField';
import ListSubheader from '@material-ui/core/ListSubheader';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';

import Chip from '@material-ui/core/Chip'
import Snackbar from '@material-ui/core/Snackbar';


import Collapse from '@material-ui/core/Collapse';

import Icon from '@material-ui/core/Icon';
import IconButton from '@material-ui/core/IconButton';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';


import { withStyles } from '@material-ui/core/styles';

//const _updateTimeContextESQuery = require("./elastic-queries")._updateTimeContextESQuery
const _fetchData = require("./elastic-queries")._fetchData
const _fetchDataRaw = require("./elastic-queries")._fetchDataRaw
const _updateSchedule = require("./elastic-queries")._updateSchedule
const _updateModelMeta = require("./elastic-queries")._updateModelMeta
const _queryOfAvailableCustomMetrics = require("./elastic-queries")._queryOfAvailableCustomMetrics

const _getExtraModelMetaESQuery = require("./elastic-queries")._getExtraModelMetaESQuery
const _getExtraModelContextESQuery = require("./elastic-queries")._getExtraModelContextESQuery
const _getInputMetaESQuery = require("./elastic-queries")._getInputMetaESQuery



const FEATURE_STORE_UI = "https://s3-us-west-2.amazonaws.com/sie-cloud-kmj-mlmodel-builds/featurestore-admin/index.html"
const MODEL_STORE_UI = "https://s3-us-west-2.amazonaws.com/sie-cloud-kmj-mlmodel-builds/modelstore-admin/index.html"




const styles = theme => ({
  button: {
    float:"left",
    fontSize: 9,
    margin: "3em 5em",
    padding: "3em 5em"
  },

  icon: {
    margin: theme.spacing.unit,
    fontSize: 9,
    width:"18px",
    height:"18px"
  },

  nested: {
    paddingLeft: theme.spacing.unit * 4,
  },

  dialogPaper: {
        minWidth: '80vw',
        maxWidth: '80vw',
    },
});



var GRAPH_INSTANCE = null;
var GRAPH_DATA = {
    nodes: new vis.DataSet([]),
    edges: new vis.DataSet([])
};

const GRAPH_CONFIG = {
  height:"250px",
  layout:{hierarchical: {enabled:true, nodeSpacing:40, levelSeparation:90}},
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


function _fromutc(utcTime){
    var localTs = new Date(utcTime);
    var utcTs = Date.UTC(localTs.getFullYear(), localTs.getMonth(), localTs.getDate(), localTs.getHours(), localTs.getMinutes(), localTs.getSeconds())
    return new Date(utcTs)
}



export default class DataLineageViewer extends React.Component {

  constructor(props){
    super(props);
  }

  componentWillReceiveProps(newProps) {
    console.log("handling lineage viewer load", newProps.mid, newProps.rid, newProps.nodeMeta)
    GRAPH_INSTANCE = null;
  	this.getNodeInputMeta(newProps.mid, newProps.rid, newProps.nodeMeta, true)
  }


  state = {
    open: true,
    user: "",
    pass: "",
    snackbarOpen: false,
    snackbarMessage: "",
    snackbarMetricsLink: "",

    rootCanonicalName: "",
    rootVersion: "",
    rootStartTime:"",
    rootEndTime:"",
    isRootModel: true,

    currentNode: null,
    currentInputs: [],
    currentStartTime: "",
    currentEndTime: "",
    currentVersion: "",
    currentLastUpdated: "",

    firstNodeDisplayed: false,
    graphVisited: {},
    edges:[],
    nodes:[],
    nodesMeta:{}
  };



  _printDate(utcTime){
    var dt = _fromutc(utcTime)
    var month = dt.getMonth() + 1 <= 9 ? ("0" + (dt.getMonth() + 1)) : (dt.getMonth() + 1)
    var day = dt.getDate() <= 9 ? ("0" + (dt.getDate())) : (dt.getDate())
    var hours = dt.getHours() <= 9 ? ("0" + (dt.getHours())) : (dt.getHours())
    var minutes = dt.getMinutes() <= 9 ? ("0" + (dt.getMinutes())) : (dt.getMinutes())

    return dt.getFullYear() + "/" + month + "/" + day + " " + hours + ":" + minutes
  }


  _timeleonFeatureChartURL(tenant, modelName, schema, columns){

    var link = "http://search-ml-model-manager-fntwapjhjdo4wvfvanrvkx2prq.us-west-2.es.amazonaws.com/_plugin/kibana/app/timelion#?_g=(refreshInterval:(display:Off,pause:!f,value:0),time:(from:now-7d,interval:'1d',mode:quick,timezone:America%2FLos_Angeles,to:now))&_a=(columns:2,interval:'1d',rows:2,selected:0,sheet:!('.es(index%3Dmodel-manager-index,%20q%3D!'_type:ml_model_feature%20AND%20tenant:"
          + encodeURIComponent(tenant)
          + "%20AND%20modelName:"
          + encodeURIComponent(modelName)
          + "%20AND%20schema:"
          + encodeURIComponent(schema)
          + "!',%20timefield%3D!'created!').lines(fill%3D1.5).label(!'versions%2Fhr!')'"


          //adding default cost and container metrics
          columns = columns || [];

          columns.push("_job_duration_m");
          columns.push("_job_container_num");
          columns.push("_job_cost_dollar");


          for(var i = 0; i < columns.length; i++){
              link += ",'.es(index%3Dmodel-manager-index,%20q%3D!'_type:ml_model_feature_metric%20AND%20metric:count%20AND%20name:"

              + encodeURIComponent(modelName)
              + "%20AND%20tenant:"
              + encodeURIComponent(tenant)
              + "%20AND%20column:"
              + encodeURIComponent(columns[i])
              + "!',%20timefield%3D!'created!',%20metric%3Davg:val.nd).lines(fill%3D2).title(!'"
              + "%20column%20-%20" + columns[i] + "!').label(!'counts!')'"

          }

    link += "))";

    return link;
  }


  _timeleonChartURL(tenant, modelName, metricNames){

    var link = "http://search-ml-model-manager-fntwapjhjdo4wvfvanrvkx2prq.us-west-2.es.amazonaws.com/_plugin/kibana/app/timelion#?_g=(refreshInterval:(display:Off,pause:!f,value:0),time:(from:now-7d,interval:'1h',mode:quick,timezone:America%2FLos_Angeles,to:now))&_a=(columns:2,interval:'1h',rows:2,selected:0,sheet:!('.es(index%3Dmodel-manager-index,%20q%3D!'_type:ml_model%20AND%20tenant:"
                + encodeURIComponent(tenant)
                + "%20AND%20type:model%20AND%20status:trained%20AND%20name:"
                + encodeURIComponent(modelName)
                + "!',%20timefield%3D!'updated!').lines(fill%3D1.5).label(!'versions%2Fhr!')'"


    for(var i=0;i<metricNames.length;i++){
      link += ",'.es(index%3Dmodel-manager-index,%20q%3D!'_type:ml_model_feature_metric%20AND%20type:model%20AND%20"

      + "tenant:" + encodeURIComponent(tenant)
      + "%20AND%20name:" + encodeURIComponent(modelName)
      + "%20AND%20metric:" + encodeURIComponent(metricNames[i])
      + "%20AND%20type:model!',%20timefield%3D!'created!',%20metric%3Dmax:val.nd).lines(fill%3D2).title(!'"
      + "%20metric%20-%20" + metricNames[i] + "!').label(!'" + metricNames[i] + "!')'"

    }

    link += "))"

    console.log(link);

    return link

  }


  _getColumns(inputSchema){
    if(inputSchema && inputSchema.fields) {
      return inputSchema.fields.map(function(fieldSchema){
        return fieldSchema.name
      });
    }

    return []
  }


  handleModelChart(tenant, name){
    return function(e){
      _fetchDataRaw(_queryOfAvailableCustomMetrics(tenant, name), function(resp){
        if(resp.aggregations){
          var metrics = resp.aggregations.uniq_columns.buckets.map(function(el){
            return el.key
          });
          var location = _timeleonChartURL(tenant, name, metrics);
          var redirectWindow = window.open(location, '_blank');
          redirectWindow.location;
        }
      }, "ml_model_feature_metric/_search?sort=created:desc")
    }
  }








  getNodeInputMeta = (mid, rid, nodeMeta, isRoot) => {
    console.log("path from meta on graph: ", nodeMeta["path"])

    if(isRoot){
    	this.setState({
    		rootCanonicalName: nodeMeta["path"],
    		rootVersion:mid + (rid === 1 ? "" : "-" + rid),
    		rootStartTime: nodeMeta["start"],
    		rootEndTime: nodeMeta["end"],
    		currentLastUpdated: nodeMeta["updated"],
    	})
    }


    var dataFrameName = (nodeMeta["path"] ? this._getDataFrameName(nodeMeta["path"]) + ":" : "")
    var tmpMID = dataFrameName + mid + (rid === 1 ? "" : "-" + rid)
    var nodesMeta = this.state.nodesMeta
    nodesMeta[tmpMID] = nodeMeta
    this.setState({nodesMeta: nodesMeta})

    console.log("tmpMID:", tmpMID)
    console.log("tmpId in nodeMeta:", nodeMeta)

    var self = this;

    if(nodeMeta["inputType"] !== "featureStore" &&
    	(nodeMeta["path"].startsWith("s3p:") || nodeMeta["path"].startsWith("s3:") || nodeMeta["path"].startsWith("s3a:"))){
    	self.setState({currentNode: tmpMID, currentInputs: []});
    	return
    }

    _fetchDataRaw(_getInputMetaESQuery(mid, rid === 1 ? "" : rid), function(resp){

        var inputs = []
        var hits = resp.hits.hits

        if(hits && hits.length){
          inputs = hits.map(function(el){

          	var isStoreInput = el["_source"]["path"].startsWith("featureStore://") || el["_source"]["path"].startsWith("modelStore://")
          	var originalTenant = isStoreInput ? el["_source"]["path"].replace("featureStore://", "").replace("modelStore://", "").split("/")[0] : el["_source"]["tenant"]

            return {
              "path": el["_source"]["path"],
              "formatType":  el["_source"]["formatType"],
              "inputType":  el["_source"]["inputType"],
              name: el["_source"]["modelName"],
              tenant: el["_source"]["tenant"],
              start: self._printDate(el["_source"]["timeRangeStart"]),
              end: self._printDate(el["_source"]["timeRangeEnd"]),
              schemaMeta: el["_source"]["schemaMeta"],
              schema: el["_source"]["schema"],
              "modelid": el["_source"]["modelid"],
              "updated": self._printDate(el["_source"]["updated"]),
              "originalTenant": originalTenant

            }
          })

          self.setState({currentNode: tmpMID, currentInputs: inputs}, self.addGraphNodeDependencies(isRoot));
        }
        console.log("Completed feature meta fetch data lineage", tmpMID, "- whatever hits means", hits);
    }, "ml_model_feature/_search");

  }


  addGraphNodeDependencies(isRoot){

  	var self = this;
  	return function(){

	  	if(self.state.currentNode === null) return

	  	var currentNode = self.state.currentNode
	    var currentInputs = self.state.currentInputs

	  	var visited = self.state.graphVisited
	  	if(visited[currentNode]) return


	    visited[currentNode] = currentInputs
	    self.setState({graphVisited:visited});

	    var nodeMeta = self.state.nodesMeta[currentNode]
	  	var edges = self.state.edges
	    var nodes = self.state.nodes
	    var nodesMeta = self.state.nodesMeta

	    if(isRoot) nodes.push({id:currentNode, label:self._getNodeLabel(nodeMeta)})

	    for(var i=0; i<currentInputs.length;i++){
	      var input = currentInputs[i]
	      console.log("processing inputs:", input)
	      if(!input["path"] && !input["name"]) continue

	      var inputId = this._getDataFrameName(input["path"], input["start"], input["end"]) + ":" + (input["modelid"] ? input["modelid"] : currentNode)
	      edges.push({id:currentNode + ":" + inputId, to:currentNode, from:inputId, arrows:{to:true}, font:{align:"middle"}});
	      nodes.push({id:inputId, label:self._getNodeLabel(input)})
	      nodesMeta[inputId] = input
	    }

	    self.setState({nodes:nodes, edges:edges, nodesMeta: nodesMeta}, self.refreshGraphView)

    }
  }


  refreshGraphView(){
  	var self = this;
    console.log("refresh graph ...")
  	GRAPH_DATA = {nodes:new vis.DataSet(this.state.nodes), edges:new vis.DataSet(this.state.edges)}
  	GRAPH_INSTANCE = new vis.Network(document.getElementById('graph-datalineage'), GRAPH_DATA, GRAPH_CONFIG);
    GRAPH_INSTANCE.on("click", function(evt){
	  if(evt.nodes && evt.nodes.length){
	    var message = evt.nodes[0]
	    var nodeIdParts = message.split(":")
	    var nodeId = nodeIdParts.length > 1 ? nodeIdParts[nodeIdParts.length - 1] : nodeIdParts[0]
	    var mid = nodeId.split("-")[0]
	    var rid = nodeId.split("-").length > 1 ? Number(nodeId.split("-")[1]) : Number(1)

	    var nodeMeta = self.state.nodesMeta[message]
	    var isRawInput = !(nodeMeta["path"].startsWith("featureStore://") || nodeMeta["path"].startsWith("modelStore://"))
	    var fullVersion = mid + (rid === 1 ? "" : "-" + rid)


	    console.log("click on node:", message, nodeMeta)

	    self.getNodeInputMeta(mid, rid, nodeMeta, false)
	    self.setState({
	    	snackbarOpen:true,
	    	snackbarMessage: nodeMeta["path"],
	    	currentStartTime: nodeMeta["start"],
	    	currentEndTime: nodeMeta["end"],
	    	currentVersion: isRawInput ? "raw-input" : fullVersion,
	    	currentLastUpdated: nodeMeta["updated"],
	    })

	    setTimeout(function(){
	      ReactDOM.render(
	        <Snackbar
	          anchorOrigin={{ vertical:"top", horizontal:"right"}}
	          open={self.state.snackbarOpen}
	          onClose={() => {
	            self.setState({snackbarOpen:!self.state.snackbarOpen})
	          }}
	          ContentProps={{
	            'aria-describedby': 'message-id',
	          }}
	          message={<span id="message-id"><span id="data-lineage-link-canonical"><Button color="secondary" target="_blank" href={
	          	(self.state.snackbarMessage.startsWith("featureStore") ? FEATURE_STORE_UI : MODEL_STORE_UI) + "?canonicalName="
	          	+ encodeURIComponent(self.state.snackbarMessage.replace("featureStore:\/\/", "").replace("modelStore:\/\/", ""))
	            + (self.state.snackbarMessage.startsWith("featureStore") ? "" : "&queryType=2")}>{self.state.snackbarMessage}</Button></span>

	          { nodeMeta["path"].startsWith("modelStore") ?
	          	<Button variant="fab" mini color="primary" target="_blank" onClick={self.handleModelChart(nodeMeta["originalTenant"], nodeMeta["name"])} className={styles.button}>
                 <Icon>timeline</Icon>
                </Button> : <Button variant="fab" mini color="primary" target="_blank" href={
                 self._timeleonFeatureChartURL(nodeMeta["originalTenant"], nodeMeta["name"], nodeMeta["schema"], self._getColumns(nodeMeta["schemaMeta"]))} className={styles.button}>
                 <Icon>timeline</Icon>
                </Button>
              }
	          </span>}
	        />
	      , document.getElementById('very-top-messages-lineage'))
	    }, 500)
	  }else{
	  	self.setState({snackbarOpen:false})
	  }
	})
  }

  _getNodeLabel(nodeMeta){
    var label = "F"
	if(nodeMeta["path"].startsWith("featureStore://")) label = "F"
	else if(nodeMeta["path"].startsWith("modelStore://")) label = "M"
	else label = "Inp"

    return label
  }

  _getDataFrameName(canonicalName, start, end){
  	var canonical = canonicalName.replace("featureStore:\/\/", "")
  	canonical = canonical.replace("modelStore:\/\/", "")

  	if(canonical.startsWith("s3p://") || canonical.startsWith("s3a://") || canonical.startsWith("s3://")){
  		return canonical + (start ? "|" + start + "|" + end : "")
  	}

  	var parts = canonical.split("/")
  	if (parts.length >= 3) return parts[2]

  	return ""
  }



  render(){
  	return(
  		<div style={{marginTop:"1em"}}>
  		  <div id="lineage-graph-title"><Chip label={<span>Data Lineage (<span style={{fontSize:'0.7em'}}>
  		  {this.state.snackbarMessage || this.state.rootCanonicalName}</span>)</span>} /></div>
  		  <div id="lineage-graph-title-2" style={{marginTop:"0.5em"}}><Chip label={(this.state.currentVersion || this.state.rootVersion) + " | " +
  		  ((this.state.currentStartTime || this.state.rootStartTime) ? (this.state.currentStartTime || this.state.rootStartTime) : "") + " - " +
  		  ((this.state.currentEndTime || this.state.rootEndTime) ? (this.state.currentEndTime || this.state.rootEndTime) : "")} /></div>
  		  <div id="graph-datalineage"></div>
  		</div>
  	)
  }


}
