const React = require('react');

import PropTypes from 'prop-types';

import DateFnsUtils from 'material-ui-pickers/utils/date-fns-utils';
import MuiPickersUtilsProvider from 'material-ui-pickers/utils/MuiPickersUtilsProvider';
import DateTimePicker from 'material-ui-pickers/DateTimePicker';

import classNames from 'classnames';
import { withStyles } from '@material-ui/core/styles';

import Icon from '@material-ui/core/Icon';
import IconButton from '@material-ui/core/IconButton';
import MenuIcon from '@material-ui/icons/Menu';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';

import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import FormHelperText from '@material-ui/core/FormHelperText';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';

import ProfileMenu from './profile-menu'
import ModelNavigationDrawer from './model-navigation-drawer'
import ModelStoreTable from './model-store-table'

const drawerWidth = 240;

const styles = theme => ({
  menuButton: {
    marginLeft: 12,
    marginRight: 20,
    marginTop:"0.3em",
    float:'left',

  },
  hide: {
    display: 'none',
  },

  appBar: {
    position: 'absolute',
    transition: theme.transitions.create(['margin', 'width'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },

  appBarShift: {
    width: `calc(100% + ${drawerWidth}px)`,
    transition: theme.transitions.create(['margin', 'width'], {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
  'appBarShift-left': {
    marginLeft: drawerWidth,
  },

  'appBarShift-right': {
    marginRight: drawerWidth,
  },


});


class ModelStorePicker extends React.Component {

  state = {
    startDate: null,
    endDate: null,
    artifactType: "model",
    artifactTypeName: "models",
    clearedDate: null,
    openDrawer: false,
    anchor: 'left',

  }

  componentDidMount = () => {
    this.handleURLQuery()
  }

  handleArtifactType = (evt) => {
    console.log("picker artifact type:", evt.target.value, evt.target.name);
    var self = this;
    this.setState({ artifactType: evt.target.value, artifactTypeName:evt.target.value }, function(){
      var params = self.getURLQueryParams();
      self.handleSearch(
        {
          keyword: params["keyword"] || "",
          pipelineName: params["pipelineName"] || "",
          artifactType: self.state.artifactType
        },
        null,
        self.state.startDate ? self.state.startDate.getTime() : null,
        self.state.endDate ? self.state.endDate.getTime() : null
      )
    });
  }

  handleStartDate = (date) => {
    console.log("picker date", date);
    var self = this;
    this.setState({ startDate: date }, function(){
      if(self.state.startDate && self.state.endDate){
        var params = self.getURLQueryParams();
        self.handleSearch(
          {
            keyword: params["keyword"] || "",
            pipelineName: params["pipelineName"] || "",
            artifactType: self.state.artifactType
          },
          null,
          self.state.startDate.getTime(),
          self.state.endDate.getTime()
        )
      }
    });
  }

  handleEndDate = (date) => {
    console.log("picker date", date);
    var self = this;
    this.setState({ endDate: date }, function(){
      if(self.state.startDate && self.state.endDate){
        console.log("searching...", self.state.startDate, self.state.endDate);
        var params = self.getURLQueryParams();
        self.handleSearch(
          {
            keyword: params["keyword"] || "",
            pipelineName: params["pipelineName"] || "",
            artifactType: self.state.artifactType
          },
          null,
          self.state.startDate.getTime(),
          self.state.endDate.getTime()
        )
      }
    });
  }


  handleDrawerOpen = () =>{
    if(!this.state.openDrawer){
      this.child.handleDrawerOpen()
    }
    else{
      this.child.handleDrawerClose()
    }

    this.setState({openDrawer: !this.state.openDrawer})

  }


  handleSearch = (pipelineName, tags, from, to) => {
    console.log("model pipelineName:", pipelineName, tags);
    var accessToken = sessionStorage.getItem("accessToken");
    this.tableChild.searchForValue(pipelineName, from, to, tags, accessToken);
  }

  getURLQueryParams = () => {
    var paramMap = {};
    var pipelineNameQuery = document.location.search.replace("?", "");
    if(pipelineNameQuery){
      var paramKeyValues = pipelineNameQuery.split("&");
      paramKeyValues.forEach(function(el, i){
        var param = el.split("=");
        if(param.length === 2){
          paramMap[param[0]] = param[1];
        }
      })
    }
    return paramMap;
  }

  handleURLQuery = () => {
    var paramMap = this.getURLQueryParams();
    console.log("URL query map: ", paramMap);
    if(paramMap["keyword"]){
        var keyword = paramMap["keyword"] ? decodeURIComponent(paramMap["keyword"]) : "";
        this.handleSearch({keyword: keyword}, null);
    }else if(paramMap["tags"] || paramMap["pipelineName"]){
        var pipelineName = paramMap["pipelineName"] ? decodeURIComponent(paramMap["pipelineName"]) : "";
        var tags = paramMap["tags"] ? decodeURIComponent(paramMap["tags"]) : null;
        this.handleSearch({pipeline: pipelineName}, tags);
    }
  }

  getChildState = () => {

  }

  render(){

    const { startDate, endDate, openDrawer, anchor} = this.state;
    const { classes, theme } = this.props;

    /* left menu drawer
    <IconButton
              color="inherit"
              aria-label="Open drawer"
              onClick={this.handleDrawerOpen}
              className={classNames(classes.menuButton)}
            >
              {openDrawer ? <ChevronLeftIcon /> : <MenuIcon /> }
    </IconButton>
    */


    return (
      <div style={{float:"left", width:"100%"}}>
      <div style={{top:"1em", left:"0.3em", position:"absolute"}}>


      <ModelNavigationDrawer handleClickDrawer={this.handleSearch} onRef={ref => (this.child = ref)} />
      </div>

      <div className={classNames(classes.appBar, {
              [classes.appBarShift]: openDrawer,
              [classes[`appBarShift-${anchor}`]]: openDrawer,
            })}>

      <div style={{float:"left", width:"100%"}}>

      <MuiPickersUtilsProvider utils={DateFnsUtils}>

        <div style={{marginLeft:"1em"}} className="picker">
          <DateTimePicker
            value={startDate}
            onChange={this.handleStartDate}
            clearable={true}
            label="Start Date"
            format="YYYY/MM/DD hh:mm A"
            keyboard
          />
        </div>

        <div className="picker">
          <DateTimePicker
            value={endDate}
            onChange={this.handleEndDate}
            clearable={true}
            label="End Date"
            format="YYYY/MM/DD hh:mm A"
            keyboard
          />
        </div>

      </MuiPickersUtilsProvider>

      <FormControl variant="outlined" style={{marginLeft:"1em", minWidth:120}}>
        <InputLabel id="artifactTypeLabel">Type</InputLabel>
        <Select
          labelId="artifactTypeLabel"
          id="artifactTypeSelect"
          value={this.state.artifactType}
          onChange={this.handleArtifactType}
        >
          <MenuItem value={"model"}>Models</MenuItem>
          <MenuItem value={"pipeline"}>Pipelines</MenuItem>
          <MenuItem value={"pipelineRun"}>PipelineRuns</MenuItem>
        </Select>
      </FormControl>
      <ProfileMenu />
      </div>

      <div id="chart-ctn"></div>
      <div id="chart-ctn-state-title" style={{float:"left", width:"400px", textAlign:"center"}}></div>
      <div id="chart-ctn-state"></div>
      <div style={{float:"left", width:"100%"}}>
      <div style={{marginTop:"0.2em"}} id="root"><ModelStoreTable yada="yada" artifactType={this.state.artifactType} onRef={ref => (this.tableChild = ref)} /></div>
      </div>
      </div>
      </div>


    );
  }
}

ModelStorePicker.propTypes = {
  classes: PropTypes.object.isRequired,
  theme: PropTypes.object.isRequired,
};

export default withStyles(styles, { withTheme: true })(ModelStorePicker);
