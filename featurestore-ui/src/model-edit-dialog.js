const React = require('react');
const ReactDOM = require("react-dom");

import Button from '@material-ui/core/Button';

import DateFnsUtils from 'material-ui-pickers/utils/date-fns-utils';
import MuiPickersUtilsProvider from 'material-ui-pickers/utils/MuiPickersUtilsProvider';
import DateTimePicker from 'material-ui-pickers/DateTimePicker';


import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import TextField from '@material-ui/core/TextField';
import InputLabel from '@material-ui/core/InputLabel';
import CircularProgress from '@material-ui/core/CircularProgress';
import Badge from '@material-ui/core/Badge';
import Chip from '@material-ui/core/Chip'
import Snackbar from '@material-ui/core/Snackbar';

import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import CardMedia from '@material-ui/core/CardMedia';
import Divider from '@material-ui/core/Divider';

import GridList from '@material-ui/core/GridList';
import GridListTile from '@material-ui/core/GridListTile';
import GridListTileBar from '@material-ui/core/GridListTileBar';

import ListSubheader from '@material-ui/core/ListSubheader';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';

import Collapse from '@material-ui/core/Collapse';


import Icon from '@material-ui/core/Icon';
import IconButton from '@material-ui/core/IconButton';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';
import PhotoCamera from '@material-ui/icons/PhotoCamera';

import { withStyles } from '@material-ui/core/styles';


import DataLineageViewer from './feature-lineage-viewer'

import {PieChart, Pie, Legend, Tooltip, Cell, Sector} from 'recharts'
import {BarChart, Bar, ReferenceLine, XAxis, YAxis, CartesianGrid} from 'recharts'
import AdditiveForceVisualizer from './visualizers/additive-force'
import TextExplainerVisualizer from './visualizers/text-explainer'

const _fetchData = require("./elastic-queries")._fetchData
const _fetchDataRaw = require("./elastic-queries")._fetchDataRaw


const styles = theme => ({
  button: {
    margin: theme.spacing.unit,
    float:"left",
  },

  icon: {
    margin: theme.spacing.unit,
    fontSize: 8,
  },

  progress: {
    margin: theme.spacing.unit * 2,
  }
});

function _fromutc(utcTime){
    var localTs = new Date(utcTime);
    var utcTs = Date.UTC(localTs.getFullYear(), localTs.getMonth(), localTs.getDate(), localTs.getHours(), localTs.getMinutes(), localTs.getSeconds())
    return new Date(utcTs)
  }


function round(value, decimals) {
    return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
}



const renderActiveShape = (props) => {
  const RADIAN = Math.PI / 180;
  const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle,
    payload, percent, value } = props;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 4) * cos;
  const sy = cy + (outerRadius + 4) * sin;
  const mx = cx + (outerRadius + 12) * cos;
  const my = cy + (outerRadius + 12) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 5;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';
  const fill = "#00C49F"

  return (
    <g>
      <text x={cx} y={cy - 7} dy={12} textAnchor="middle" style={{fontSize:"0.6em"}} fill={"#333"}>{payload.name}</text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 4}
        outerRadius={outerRadius + 8}
        fill={fill}
      />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none"/>
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none"/>
      <text x={ex + (cos >= 0 ? 1 : -1) * 6} y={ey} style={{fontSize:"0.8em"}} textAnchor={textAnchor} fill="#333">{`reported`}</text>
      <text x={ex + (cos >= 0 ? 1 : -1) * 6} y={ey} dy={18} textAnchor={textAnchor} fill="#999">
        {`(${(percent * 100).toFixed(2)}%)`}
      </text>
    </g>
  );
};


class OnlinePieChart extends React.Component {

  state = {
    activeIndex: 0,
  }

  onPieEnter = (data, index) => {
    this.setState({
      activeIndex: index,
    });
  }

  render () {
    return (
      <PieChart width={300} height={300}>
        <Pie
          activeIndex={this.state.activeIndex}
          activeShape={renderActiveShape}
          data={this.props.data}
          cx={120}
          cy={120}
          innerRadius={20}
          outerRadius={35}
          fill="#0088FE"
          onMouseEnter={this.onPieEnter}
        />
       </PieChart>
    );
  }
}



export default class ModelEditPicker extends React.Component {


  state = {
    startDate: null,
    endDate: null,
    clearedDate: null,

    title: "",
    description: "",
    tags: "",
    howtouse: "",

    inputs:[],
    numInputs: "fetching...",

    inputsModelMeta:[],

    duration:"0m",
    cost:"0$",
    release:"",

    schedule: "",

    entryToExplain: "",
    textToExplain: "",
    imageExplanationTitle : "",
    imageExplanationScore: "",

    forceBaseValue: 0,
    forceFeatures: {},
    forceFeatureNames: {},

    targetExplainerClasses: [],
    explainerMetrics:null,
    explainer:null,

    open: false,
    openProps: false,
    openCollapsable: false,
    openCollapsableHyper: false,
    openCollapsableTags: false,
    openCollapsableSchema: false,
    snackbarOpen: false,
    snackbarMessage: "",
  }

  componentWillUnmount = () => {
      this.setState({imageExplanationTitle:"", imageExplanationScore:""})
  }

  _onChange = (event) => {
    var tmpState = {}
    tmpState[event.target.id] = event.target.value
    this.setState(tmpState)
  }

  handleClickOpen = () => {
    const { startDate, endDate } = this.state;
    console.log("feature picker date opening", this.props.meta);
    this.setState({ open: true });
  }

  handleCollapsable = () => {
    this.setState(state => ({ openCollapsable: !state.openCollapsable }));
  };

  handleCollapsableTags = () => {
    this.setState(state => ({ openCollapsableTags: !state.openCollapsableTags }));
  };

  handleCollapsableHyper = () => {
    this.setState(state => ({ openCollapsableHyper: !state.openCollapsableHyper }));
  };

  handleClickOpenProps = () => {
    this.setState({ numInputs: "fetching..." });
    //this.getExtraFeatureMeta();
    this.setState({ openProps: true });
  }

  handleClose = (event) => {
    this.setState({ open: false });
  }

  handleCloseProps = (event) => {
    this.setState({ openProps: false });
  }

  _handleInputClick(input){
    return function(event){
      console.log("click on input", input.tenant)
      setTimeout(function(){
      if(input.modelid){
        var searchUrl = "?pipelineName=" + encodeURIComponent(input.path.replace("modelStore://", ""))
        document.location.search = searchUrl;
      }}, 1000)
    }
  }

  onExplainClick = () => {
    var canonicalName = this.props.meta["canonicalName"];
    const { entryToExplain, textToExplain } = this.state;
    var entries = JSON.parse("[" + entryToExplain + "]");

    var self = this;
    var accToken = sessionStorage.getItem('accessToken');

    // call explain endpoint for shapley values
    _fetchDataRaw({
      canonicalName:canonicalName,
      application: "search",
      entries: entries,
      text: textToExplain || ""
    }, function(err, explanations){

       if(err) {
         console.log("error on explanation", err);
         return self.handleError(err);
       }

       if(explanations && explanations.textExplanation){
         self.setState({
           targetExplainerClasses: explanations.textExplanation.targets,
           explainerMetrics: explanations.metrics,
           explainer: explanations.explainer
         });
         return;
       }

       var base = explanations.expected instanceof Array ? explanations.expected[0] :explanations.expected;
       var shapley = explanations.shapley[0];
       var features = {};
       var featureNames = {};
       shapley.forEach((el, i) => {
         featureNames["" + (i+1)] = "feat-" + (i+1);
         features["" + (i+1)] = {value:entries[0][i], effect: el};
       })

       self.setState({
         forceBaseValue: base,
         forceFeatures: features,
         forceFeatureNames: featureNames
       })

    }, "/v1.0/genome/routing/explain",
      window.location.protocol + "//" + window.location.host,
      accToken || "");
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


  handleStartDate = (date) => {
    console.log("feature picker date", date);
    this.setState({ startDate: date });
  }

  handleEndDate = (date) => {
    console.log("feature picker date", date);
    this.setState({ endDate: date });
  }

  handleError = (err) => {
    if(err){

      var errMsg = err.message || "an error happened";
      if( err.status === 403 || err.status === 401 ){
        errMsg = "session is not valid"
      }
      console.log("error to show snack")
      this.setState({snackbarOpen:true, snackbarMessage: errMsg })
      return;
    }
  }

  handleImage = (event) => {
    var canonicalName = this.props.meta["canonicalName"]
    var self = this;

    if (event.target.files && event.target.files[0]) {
      var reader = new FileReader();
      reader.addEventListener("load", function(e) {
        document.getElementById("image-to-upload").src = e.target.result;
        var reg = RegExp('^data:image/.+;base64,')
        var accToken = sessionStorage.getItem('accessToken');

        _fetchDataRaw({
          canonicalName: canonicalName,
          image: e.target.result.replace(reg, "")
        }, function(err, explanations){
           if(err) return self.handleError(err);
           var imageExplanation = 'data:image/png;base64,' + explanations.image
           var imageClass = explanations.class
           var classScore = explanations.score
           self.setState({imageExplanationTitle: imageClass, imageExplanationScore: classScore})
           document.getElementById("explanation-image").src = imageExplanation;
        }, "/v1.0/genome/routing/explain",
          window.location.protocol + "//" + window.location.host,
        accToken || "");

      });
      reader.readAsDataURL( event.target.files[0] );
    }
  }

  render(){

    const { startDate, endDate } = this.state;

    return (
      <div style={{"float":"left", "width":"50%", "marginRight":"1.3em", "marginLeft":"-1em", "marginTop":"0.8em"}}>

      <span style={{"float":"left", "marginRight":".3em"}}>
      <IconButton mini color="primary" onClick={this.handleClickOpenProps} style={{fontSize: "1em", width:"0.8em", height:"0.8em"}}>
          <Icon style={{fontSize:"2em"}}>art_track</Icon>
      </IconButton>
      </span>

      <Dialog
          open={this.state.openProps}
          onClose={this.handleCloseProps}
          maxWidth={"lg"}
          fullWidth={true}
          aria-labelledby="dialog-title"
          scroll="body"
        >
        <DialogTitle id="dialog-title">{ this.props.meta.artifactType == "model" ? "Model" : "Pipeline" } Properties</DialogTitle>
        <DialogContent >
        <div>

        <span>
        <Snackbar
          anchorOrigin={{ vertical:"top", horizontal:"right"}}
          open={this.state.snackbarOpen}
          onClose={() => {
            this.setState({snackbarOpen:!this.state.snackbarOpen})
          }}
          ContentProps={{
            'aria-describedby': 'message-dialog-id',
          }}
          message={<span id="message-dialog-id">{this.state.snackbarMessage}</span>}
        />
        </span>

        { this.props.meta.pills && this.props.meta.pills >= 0 &&
        <span style={{"position":"absolute", "left":"4em", "top":"-4.5em", }}>
          <OnlinePieChart data={[
            {"name":"Online", "value": this.props.meta.pills || 0, "percent": ((this.props.meta.pills || 0) / 1000 ) },
            {"name":"Remaining", "value":1000 - (this.props.meta.pills || 0), "percent": 1 - ((this.props.meta.pills || 0) / 1000 ) },
          ]} />
        </span>
        }

        { this.props.meta.featureImportance && this.props.meta.featureImportance.length > 0 &&
        <div style={{"float":"left", "width":"100%", "marginTop":"3em"}}>
          <BarChart width={500} height={300} data={this.props.meta.featureImportance} layout="vertical"
            margin={{top: 5, right: 30, left: 20, bottom: 5}}>
            <CartesianGrid strokeDasharray="3 3"/>
            <XAxis type="number"/>
            <YAxis dataKey="feature" type="category"/>
            <Tooltip/>
            <Legend label="importance"/>
            <ReferenceLine x={0} stroke='#000'/>
            <Bar dataKey="importance" fill="#82ca9d" name="importance" />
          </BarChart>
        </div>
        }


        { this.props.meta.inputModality && this.props.meta.inputModality === "tabular" &&
          <div id="shap-vizualizer" style={{"float":"left", "width":"100%", "marginTop":"3em"}}>
          <AdditiveForceVisualizer
            baseValue={this.state.forceBaseValue}
            outNames={["score"]}
            link={"identity"}
            features={this.state.forceFeatures}
            featureNames={this.state.forceFeatureNames}
          />
          <TextField
            id="entryToExplain"
            label="Entry to Explain from Model"
            style={{ marginTop: "1.5em"}}
            placeholder="[1.0,2.0,1.5, ...]"
            helperText="json list"
            fullWidth
            margin="normal"
            onChange={this._onChange}
            InputLabelProps={{
              shrink: true,
            }}
          />

          <Button onClick={this.onExplainClick} size="small" variant="contained" color="primary">
            explain
          </Button>

          </div>
        }

        { this.props.meta.inputModality && this.props.meta.inputModality === "text" &&
          <div id="lime-vizualizer" style={{"float":"left", "width":"100%", "marginTop":"3em"}}>
          <TextExplainerVisualizer
            targetClasses={this.state.targetExplainerClasses}
            doc={this.state.textToExplain}
            metrics={this.state.explainerMetrics}
            explainer={this.state.explainer}
            key={JSON.stringify(this.state.explainerMetrics)}
          />

          <TextField
            id="textToExplain"
            label="Text Entry"
            style={{ marginTop: "1.5em"}}
            fullWidth
            margin="normal"
            onChange={this._onChange}
            InputLabelProps={{
              shrink: true,
            }}
          />

          <Button onClick={this.onExplainClick} size="small" variant="contained" color="primary">
            explain
          </Button>

          </div>

        }


        { this.props.meta.inputModality && this.props.meta.inputModality === "image" &&
          <div id="gradcam-vizualizer" style={{"float":"left", "width":"100%", "marginTop":"3em"}}>

          <input
            accept="image/*"
            style={{ display: 'none' }}
            id="raised-button-file"
            onChange={this.handleImage}
            multiple
            type="file"
          />

          <InputLabel htmlFor="raised-button-file">
            <Button variant="raised" component="span" style={{marginTop:"1em"}}>
              <PhotoCamera />
            </Button>
          </InputLabel>


          <GridList cellHeight={200} cols={2} style={{marginTop:"0.5em"}}>
            <GridListTile style={{textAlign:"center"}} cols={1}>
              <img height="190" style={{width:"auto"}} id="image-to-upload" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgDTD2qgAAAAASUVORK5CYII=" />
            </GridListTile>
            <GridListTile style={{textAlign:"center"}} cols={1}>
              <img height="190" style={{width:"auto"}} id="explanation-image" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgDTD2qgAAAAASUVORK5CYII=" />
              <GridListTileBar style={{width:"40%", height:"2.5em", opacity:0.9, marginLeft:"auto", marginRight:"auto"}}
                title={this.state.imageExplanationTitle}
                subtitle={<span>score: {this.state.imageExplanationScore}</span>}
              />
            </GridListTile>
          </GridList>

          </div>
        }

        <List style={{marginTop:"2em"}}>
          <ListItem divider>
            <ListItemIcon>
              <Icon>arrow_right</Icon>
            </ListItemIcon>
            <ListItemText inset
              primary={
                this.props.meta.pipelineName +
                (this.props.meta.pipelineStage ? " | " : "") +
                this.props.meta.pipelineStage} secondary={this.props.meta.pipelineId}

              secondary={this.props.meta.canonicalName || ""}

              />
          </ListItem>


          <ListItem button onClick={this.handleCollapsableHyper} style={{minWidth:"35em"}}>
            <ListItemIcon>
              <Icon>storage</Icon>
            </ListItemIcon>
            <ListItemText inset primary={
              (this.props.meta.artifactType == "model" ? "(Hyper)" : "") +
              "Parameters (" +
              (this.props.meta.parameters ? Object.entries(this.props.meta.parameters).length : 0) + ") "
            } />
            {this.state.openCollapsableHyper ? <ExpandLess /> : <ExpandMore />}
          </ListItem>
          <Collapse in={this.state.openCollapsableHyper} timeout="auto" unmountOnExit>
            <List component="div" disablePadding >
              {
                this.props.meta.parameters ? Object.entries(this.props.meta.parameters).map((entry, i) => <ListItem button className={styles.nested}>
                <ListItemIcon>
                  <Icon>arrow_right</Icon>
                </ListItemIcon>
                <ListItemText inset primary={"(" + (i + 1) + ") " + entry[0]} secondary={"" + entry[1]}/>
                </ListItem>
                ) : <ListItem button className={styles.nested}><ListItemIcon><Icon>arrow_right</Icon></ListItemIcon>
                <ListItemText inset primary={"no-hyper"}/>
                </ListItem>
              }
            </List>
          </Collapse>

          { this.props.meta.recipeRef && this.props.meta.recipeRef.ref &&
          <ListItem divider>
          <ListItemIcon>
              <Icon>arrow_right</Icon>
            </ListItemIcon>
            <ListItemText inset primary={"recipeRef"} secondary={
              (this.props.meta.recipeRef ? this.props.meta.recipeRef.refType : "")
              + " | "
              + (this.props.meta.recipeRef ? this.props.meta.recipeRef.ref : "")
            } />
          </ListItem>
          }

          { this.props.meta.artifactBlob && this.props.meta.artifactBlob.ref &&
          <ListItem divider>
            <ListItemIcon>
              <Icon>arrow_right</Icon>
            </ListItemIcon>
            <ListItemText inset primary={"artifactBlob"} secondary={
              (this.props.meta.artifactBlob ? this.props.meta.artifactBlob.refType : "")
              + " | "
              + (this.props.meta.artifactBlob ? this.props.meta.artifactBlob.ref : "")
            } />
          </ListItem>
          }

          { this.props.meta.inputs && this.props.meta.inputs.length > 0 &&
          <ListItem button onClick={this.handleCollapsable} style={{minWidth:"35em"}}>
            <ListItemIcon>
              <Icon>storage</Icon>
            </ListItemIcon>
            <ListItemText inset primary={ "Inputs (" + (this.props.meta.inputs || []).length + ") "} />
            {this.state.openCollapsable ? <ExpandLess /> : <ExpandMore />}
          </ListItem>
          }
          { this.props.meta.inputs && this.props.meta.inputs.length > 0 &&
          <Collapse in={this.state.openCollapsable} timeout="auto" unmountOnExit>
            <List component="div" disablePadding >
              {
                this.props.meta.inputs ? this.props.meta.inputs.map((input, i) => <ListItem button className={styles.nested}>
                <ListItemIcon>
                  <Icon>arrow_right</Icon>
                </ListItemIcon>
                <ListItemText inset primary={"(" + (i + 1) + ") " + input.ref} secondary={input.refType}/>
                <ListItemSecondaryAction>
                  <Button variant="fab" mini color="primary" target="_blank" href={
                    "/vizualize?input=" + i
                  } className={styles.button}>
                    <Icon>timeline</Icon>
                  </Button>
                </ListItemSecondaryAction>
                </ListItem>
                ) : <ListItem button className={styles.nested}><ListItemIcon><Icon>arrow_right</Icon></ListItemIcon>
                <ListItemText inset primary={"no-input"}/>
                </ListItem>
              }
            </List>
          </Collapse>
          }


          <ListItem button onClick={this.handleCollapsableTags} style={{minWidth:"35em"}}>
          <ListItemIcon>
              <Icon>storage</Icon>
            </ListItemIcon>
            <ListItemText inset primary={"Tags (" + Object.entries(this.props.meta.tags || {}).length + ") "} />
            {this.state.openCollapsableTags ? <ExpandLess /> : <ExpandMore />}
          </ListItem>
          <Collapse in={this.state.openCollapsableTags} timeout="auto" unmountOnExit>
            <List component="div" disablePadding >
              {
                this.props.meta.tags ? Object.entries(this.props.meta.tags).map((entry, i) => <ListItem button className={styles.nested}>
                <ListItemIcon>
                  <Icon>arrow_right</Icon>
                </ListItemIcon>
                <ListItemText inset primary={"(" + (i + 1) + ") " + entry[0] + ":"} secondary={entry[1]}/>
                </ListItem>
                ) : <ListItem button className={styles.nested}><ListItemIcon><Icon>arrow_right</Icon></ListItemIcon>
                <ListItemText inset primary={"no-tags"}/>
                </ListItem>
              }
            </List>
          </Collapse>


          <ListItem divider>
            <ListItemIcon>
              <Icon>arrow_right</Icon>
            </ListItemIcon>
            <ListItemText inset primary="Release Version" secondary={this.props.meta.version} />
          </ListItem>

          <ListItem divider>
            <ListItemIcon>
              <Icon>arrow_right</Icon>
            </ListItemIcon>
            <ListItemText inset primary="Framework" secondary={this.props.meta.framework} />
          </ListItem>
        </List>

        <div style={{marginTop:"0.5em"}}><Chip color="secondary" label={"id: " + this.props.meta.mid}/></div>

        <div style={{marginTop:"0.5em"}}><Chip label={"updated: " + this.props.meta.created}/></div>


        </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={this.handleCloseProps} color="primary">
            Cancel
          </Button>
        </DialogActions>
        </Dialog>


      </div>



    );
  }
}
