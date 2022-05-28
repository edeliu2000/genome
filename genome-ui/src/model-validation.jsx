const React = require('react');
const ReactDOM = require("react-dom");

import Button from '@material-ui/core/Button';




import ListSubheader from '@material-ui/core/ListSubheader';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';

import ExpansionPanel from '@material-ui/core/ExpansionPanel';
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary';
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails';
import Typography from '@material-ui/core/Typography';


import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import CardActions from '@material-ui/core/CardActions';

import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';

import MenuItem from '@material-ui/core/MenuItem';
import FormHelperText from '@material-ui/core/FormHelperText';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import Badge from '@material-ui/core/Badge';
import Chip from '@material-ui/core/Chip'

import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';

import Collapse from '@material-ui/core/Collapse';
import CircularProgress from '@material-ui/core/CircularProgress';
import OnlinePieChart from './visualizers/online-pie-chart'

import Icon from '@material-ui/core/Icon';
import IconButton from '@material-ui/core/IconButton';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';
import DoneIcon from '@material-ui/icons/Done';
import ErrorIcon from '@material-ui/icons/Error';

import Avatar from '@material-ui/core/Avatar';
import CancelIcon from '@material-ui/icons/Cancel';

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
  },

  root: {
    width: '100%',
  },

  clickableRow: {
    cursor: 'pointer'
  },

  heading: {
    fontSize: theme.typography.pxToRem(15),
    fontWeight: theme.typography.fontWeightRegular,
  }

});


class ModelValidation extends React.Component {

  state = {
    validations: [],
    showValidationTarget: false,
    openCollapsable: false,
    displayTaskInfo: null,
    displayValidation: null,
    content: "",
  };

  componentDidMount = () => {
      this._loadValidations()
  };


  _loadValidations = (testCallback) => {

    console.log("componentDidMount executed")

    var validationTarget = this.props.validationTarget;
    var application = this.props.application || "search";
    var artifactType = this.props.artifactType;


    var self = this;
    var accToken = sessionStorage.getItem('accessToken');

    //if validation is already provided don;t call API
    const validation = this.props.validation
    if(validation.validationTarget && validation.validationTarget.ref != null){
      this.setState({
        validations: [validation],
        showValidationTarget: true
      });
      return {};
    }

    // call validation store endpoint
    _fetchDataRaw({
      validationTarget:validationTarget,
      application: application,
      artifactType: artifactType
    }, (err, validations) => {

       if(err) {
         console.log("error on validations", err);
         this.props.errorCallback && this.props.errorCallback(err);
         return testCallback && testCallback()
       }

       if(validations && validations.length){
         this.setState({
           validations: validations
         });
         return testCallback && testCallback();
       }

    }, "/v1.0/genome/modelstore/search-validations",
      window.location.protocol + "//" + window.location.host,
      accToken || "");
  };

  closeTaskInfo = () => {
    this.setState(state => ({ displayValidation: null, displayTaskInfo: null }));
  };

  getArtifactTypeName = (artifactType) => {
    console.log("evaluation target ref type:", artifactType);
    return {
        "model": "model",
        "modelArtifact": "model",
        "dataArtifact": "dataset",
        "dataset": "dataset",
        "pipeline": "pipeline",
        "pipelineRun": "run",
        "deployment": "deployment"
      }[artifactType] || "";
  };

  displayTaskRow = (entry, task) => {
    return (
      <TableRow style={{cursor:'pointer'}} key={task.name} onClick={()=>{this.setState({displayValidation: entry, displayTaskInfo: task})}}>
        <TableCell align="left">{task.name}</TableCell>
        <TableCell align="left">
        <Chip
          label={task.prototypeRef ? "rec" : (task.segment ? "segment" : (task.dataRef ? "dataset" : ""))}
          avatar={<Avatar>{task.prototypeRef ? "R" : (task.segment ? "S" : (task.dataRef ? "D" : ""))}</Avatar>}
          variant="outlined"
          size="small" />
        {task.prototypeRef ? " " + task.prototypeRef.ref.substring(0, 50): ""}
        {task.segment ? " " + task.segment.substring(0, 50) : ""}
        {task.dataRef ? " " + task.dataRef.ref.substring(0, 50) : ""}
        </TableCell>
        <TableCell align="left">
        { task.status ? <DoneIcon style={{color:"#22a355"}}/> : <ErrorIcon style={{color:"#e5383b"}}/> }
        </TableCell>
      </TableRow>
    )
  }

  render(){

    return (
      <div style={{position:"relative", "width":"100%", "marginTop":"1em"}}>
      {
        this.state.validations.map((entry, i) => <ExpansionPanel>
          <ExpansionPanelSummary expandIcon={<ExpandMore />}>

            <Typography className={styles.heading}>
              <div style={{float:"left", margin: "0em 0.7em"}}>{entry.status ? <DoneIcon style={{color:"#22a355"}} /> : <ErrorIcon style={{color:"#e5383b"}} />}
              </div> {entry.canonicalName} ({entry.tasks.length} tasks)
            </Typography>
            <Chip
              avatar={<Avatar>{(entry.dimension || "").toUpperCase().substr(0,1)}</Avatar>}
              label={ entry.dimension || "dimension" }
              color="primary"
              style={{float:"right", left:"1em", position:"relative"}}
            />

            { this.state.showValidationTarget &&
              <Chip
                avatar={<Avatar>{(entry.validationTarget.refType || "").toUpperCase().substr(0,1)}</Avatar>}
                label={
                  this.getArtifactTypeName(entry.validationTarget.refType) + " | " + (entry.validationTarget.ref || "").substr(0, 10) + "..."
                }

                clickable

                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  this.setState({showValidationTarget: false}, () => {
                    this.props.loadArtifact({
                      artifactType: entry.validationTarget.refType === "model" ? "modelArtifact" : entry.validationTarget.refType,
                      application: this.props.application,
                      id: entry.validationTarget.ref
                    });
                  });
                }}

                style={{float:"right", left:"1.3em"}}
              />
            }

            { entry.tasks && entry.tasks.length > 0 &&
            <span style={{"position":"absolute", "right":"4.5em", "top":"-3.0em", }}>
              <OnlinePieChart data={[
                {"name":"pass", "fill":"#00C49F", "value": entry.tasks.filter(t => t.status).length || 0, "percent": ((entry.tasks.filter(t => t.status).length || 0) / entry.tasks.length ) },
                {"name":"fail", "fill":"#e5383b", "value": entry.tasks.filter(t => !t.status).length || 0, "percent": ((entry.tasks.filter(t => !t.status).length || 0) / entry.tasks.length ) },
              ]} width={160} height={160}/>
            </span>
            }

          </ExpansionPanelSummary>
          <ExpansionPanelDetails>

            <div style={{float:"left"}}>

            <TableContainer component={Paper}>
              <Table size="small" aria-label="dense test table">
                <TableHead>
                  <TableRow>
                    <TableCell align="left"><span style={{fontStyle: "italic"}}>task</span></TableCell>
                    <TableCell align="left"><span style={{fontStyle: "italic"}}>data coverage</span></TableCell>
                    <TableCell align="left"><span style={{fontStyle: "italic"}}>status</span></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>

                {
                  entry.tasks.filter(task => task.dataRef && !task.segment && !task.prototypeRef).map((task, j) => (
                    this.displayTaskRow(entry, task)
                  ))
                }

                {
                  entry.tasks.filter(task => task.segment && !task.prototypeRef).map((task, j) => (
                    this.displayTaskRow(entry, task)
                  ))
                }

                {
                  entry.tasks.filter(task => task.prototypeRef).map((task, j) => (
                    this.displayTaskRow(entry, task)
                  ))
                }

                </TableBody>
              </Table>
            </TableContainer>


          </div>
          </ExpansionPanelDetails>
        </ExpansionPanel>)
      }


      <Card style={{
          position:"absolute",
          display: this.state.displayTaskInfo ? "block" : "none",
          right:"0.5em",
          top:"0.3em",
          zIndex: "5",
        }}>

          <CardContent>
          <Typography variant="h5" component="h3" style={{
            fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
            color: '#666'
          }}>
            {this.state.displayTaskInfo && this.state.displayTaskInfo.name} { this.state.displayTaskInfo && this.state.displayTaskInfo.status ? <DoneIcon color="primary" style={{color:"#22a355"}}/> : <ErrorIcon color="secondary" style={{color:"#e5383b"}}/> }
          </Typography>
          <List style={{marginTop:"0.35em"}}>


          { this.state.displayTaskInfo && this.state.displayTaskInfo.prototypeRef &&
            <ListItem divider button>
              <ListItemIcon>
                <Icon>storage</Icon>
              </ListItemIcon>
              <ListItemText inset primary={this.state.displayTaskInfo.prototypeRef.ref}
                secondary={
                  "Record"
                }
              />
            </ListItem>
          }


          { this.state.displayTaskInfo &&
            <ListItem divider button >
              <ListItemIcon>
                <Icon>storage</Icon>
              </ListItemIcon>
              <ListItemText inset primary={this.state.displayTaskInfo.dataRef.ref}
                secondary={
                  "Dataset"
                }
              />
            </ListItem>
          }


          { this.state.displayTaskInfo && this.state.displayTaskInfo.segment && this.state.displayTaskInfo.segment.filters &&
            <ListItem divider button>
              <ListItemIcon>
                <Icon>storage</Icon>
              </ListItemIcon>
              <ListItemText inset primary={
                this.state.displayTaskInfo.segment.filters.map((filter, i) => <div style={{float:"left", width:"100%"}}>
                    <i> {filter.recipe ? filter.recipe : ""} </i>
                </div>)
              }
                secondary={
                  "Segment: " + this.state.displayTaskInfo.segment.name
                }
              />
            </ListItem>
          }


          { this.state.displayTaskInfo && this.state.displayTaskInfo.expectations &&
            <ListItem divider button style={{
              backgroundColor: !this.state.displayTaskInfo.status ? "rgb(233, 56, 21, 0.3)" : "transparent"
            }}>
              <ListItemIcon>
                <Icon>storage</Icon>
              </ListItemIcon>
              <ListItemText inset primary={
                this.state.displayTaskInfo.expectations.map((entry, i) => <div style={{float:"left", width:"100%"}}>
                    <i> {entry.recipe ? entry.recipe : ""} </i>
                </div>)
              }
                secondary={
                  "Expectation"
                }
              />
            </ListItem>
          }

          { this.state.displayTaskInfo &&
            <ListItem divider button>
              <ListItemIcon>
                <Icon>storage</Icon>
              </ListItemIcon>
              <ListItemText inset primary={"Code"}
                secondary={
                  Object.entries(this.state.displayValidation.code || {}).map((entry, i) => <div style={{float:"left", width:"100%"}}>
                    <i>{entry[0]}:</i> {entry[1]}
                  </div>)
                }
              />
            </ListItem>
          }


          { this.state.displayTaskInfo &&
            <ListItem divider button>
              <ListItemIcon>
                <Icon>storage</Icon>
              </ListItemIcon>
              <ListItemText inset primary={"Metrics"}
                secondary={
                  Object.entries(this.state.displayTaskInfo.metrics || {}).map((entry, i) => <div style={{float:"left", width:"100%"}}>
                    <i>{entry[0]}:</i> {entry[1]}
                  </div>)
                }
              />
            </ListItem>
          }


          { this.state.displayTaskInfo && this.state.displayTaskInfo.message &&
            <ListItem divider button>
              <ListItemIcon>
                <Icon>storage</Icon>
              </ListItemIcon>
              <ListItemText inset primary={this.state.displayTaskInfo.message}
                secondary={
                  "Message"
                }
              />
            </ListItem>
          }



          </List>
          </CardContent>
          <CardActions>
            <Button size="small" color="primary" onClick={this.closeTaskInfo}>Close</Button>
          </CardActions>
        </Card>
      </div>
    )
  }
}

ModelValidation.propTypes = {
  classes: PropTypes.object.isRequired,
};
const ModelValidationWithStyles = withStyles(styles)(ModelValidation)


export {
  ModelValidationWithStyles,
  ModelValidation
}
