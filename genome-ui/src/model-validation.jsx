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


import MenuItem from '@material-ui/core/MenuItem';
import FormHelperText from '@material-ui/core/FormHelperText';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import Badge from '@material-ui/core/Badge';
import Chip from '@material-ui/core/Chip'

import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';

import Collapse from '@material-ui/core/Collapse';

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

  heading: {
    fontSize: theme.typography.pxToRem(15),
    fontWeight: theme.typography.fontWeightRegular,
  }

});


class ModelValidation extends React.Component {

  state = {
    validations: [],
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

  render(){

    return (
      <div style={{position:"relative", "width":"100%", "marginTop":"1em"}}>
      {
        this.state.validations.map((entry, i) => <ExpansionPanel>
          <ExpansionPanelSummary expandIcon={<ExpandMore />}>

            <Typography className={styles.heading}>
              <div style={{float:"left", margin: "-0.2em 0.7em"}}>{entry.status ? <DoneIcon style={{color:"#22a355"}} /> : <ErrorIcon style={{color:"#e5383b"}} />}
              </div> {entry.canonicalName} ({entry.tasks.length} tasks)
            </Typography>
            <Chip
              avatar={<Avatar>{(entry.dimension || "").toUpperCase().substr(0,1)}</Avatar>}
              label={ entry.dimension || "dimension" }
              clickable
              color="primary"
              style={{float:"right", left:"1em", top:"-0.3em"}}
            />

          </ExpansionPanelSummary>
          <ExpansionPanelDetails>

            <div style={{float:"left"}}>
            {
              entry.tasks.map((task, j) => <div style={{float:"left", margin:"0.4em 0.4em"}}><Chip
                  avatar={<Avatar color="primary">T</Avatar>}
                  label={task.name}
                  variant="outlined"
                  onClick={()=>{this.setState({displayValidation: entry, displayTaskInfo: task})}}
                  onDelete={()=>{this.setState({displayValidation: entry, displayTaskInfo: task})}}
                  deleteIcon={ task.status ? <DoneIcon style={{color:"#22a355"}}/> : <ErrorIcon style={{color:"#e5383b"}}/> }
                /></div>)
            }
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
                  "Prototype"
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
