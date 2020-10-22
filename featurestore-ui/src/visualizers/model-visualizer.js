const React = require('react');
const ReactDOM = require("react-dom");

import Button from '@material-ui/core/Button';


import InputLabel from '@material-ui/core/InputLabel';
import CircularProgress from '@material-ui/core/CircularProgress';
import Badge from '@material-ui/core/Badge';
import Chip from '@material-ui/core/Chip'

import Paper from '@material-ui/core/Paper';

import GridList from '@material-ui/core/GridList';
import GridListTile from '@material-ui/core/GridListTile';
import GridListTileBar from '@material-ui/core/GridListTileBar';

import MenuItem from '@material-ui/core/MenuItem';
import FormHelperText from '@material-ui/core/FormHelperText';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';


import Icon from '@material-ui/core/Icon';
import IconButton from '@material-ui/core/IconButton';
import ShareIcon from '@material-ui/icons/Share';
import Avatar from '@material-ui/core/Avatar';
import {Tooltip as TooltipReact} from '@material-ui/core/Tooltip';


class ModelVisualizer extends React.Component {

    state = {
      indexSelection: "",
      content: ""
    }

    _createArray = (num) => {
      var arr = [];
      for(var i=0;i<num;i++){arr[i] = i;}
      return arr;
    }

    handleModelVisualization = (event) => {
      var canonicalName = this.props.canonicalName
      var application = this.props.application
      var accessToken = sessionStorage.getItem('accessToken');
      var index = event && event.target && event.target.value ? event.target.value : 0
      var vizPath = window.location.protocol
        + "//" + window.location.host
        + "/v1.0/genome/routing/visualization?scale=1"
        + "&index=" + index
        + "&canonicalName=" + encodeURIComponent(canonicalName)
        + "&application=" + encodeURIComponent(application);

      this.setState({indexSelection: index})


      var self = this;

      fetch(vizPath, {
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
          body: JSON.stringify({
            application: application,
            canonicalName: canonicalName
          }), // body data type must match "Content-Type" header
      }).then(function(response) {
        return response.text()
      }).then(function(respBlob){
        return self.setState({content: respBlob})
      }).catch(function(err){
        console.log("_fetchRaw mystery error: ", err)
        return callback({status: err.status, message: null},[]);
      })

    }

    render() {
      var self = this;

      return (

        <div id="model-vizualizer-cont" style={{"width":"100%", "marginTop":"1em"}}>

        {
            this.props.canonicalName &&
            <span style={{"width":"100%"}}>
            <GridList cellHeight={60} cols={1} style={{width:"85%", margin:"auto", marginTop:"0.5em"}}>
              <GridListTile style={{textAlign:"center"}} cols={1}>

                  <Button onClick={this.handleModelVisualization} variant="raised" component="span" >
                  <ShareIcon style={{transform:"rotate(90deg)"}}/>
                  <span style={{marginLeft:"0.45em"}}>Visualize Model</span>
                  </Button>

                  <Badge badgeContent={this.props.ensembleEstimators} max={999} color="primary">
                  <Chip
                    style={{marginLeft:"1em"}}
                    avatar={<Avatar>M</Avatar>}
                    label={this.props.estimatorClassName || this.props.estimatorCategory || "Unknown"}
                    variant="outlined"
                  />
                  </Badge>
                  { this.props.estimatorCategory === "ensemble" &&
                  <FormControl variant="outlined" style={{marginLeft:"1em", minWidth:130, maxWidth:150}}>
                    <InputLabel id="modelTreeIndex">Tree Index</InputLabel>
                    <Select
                      labelId="modelTreeIndex"
                      id="ensambleModelTreeIndex"
                      value={this.state.indexSelection}
                      onChange={this.handleModelVisualization}
                    >
                      {
                        this._createArray(this.props.ensembleEstimators).map((targetClass, i) => <MenuItem value={targetClass}>
                          {targetClass}
                        </MenuItem>)
                      }
                    </Select>
                  </FormControl>
                  }

              </GridListTile>
            </GridList>

            <GridList cellHeight={715} cols={1} style={{width:"85%", margin:"auto", marginTop:"0.5em"}}>
              <GridListTile style={{textAlign:"center"}} cols={1}>
                  <Paper style={{height:"700px", width:"97%", margin:"auto", marginTop:"0.3em"}} elevation={2}>
                    <iframe style={{width:"98%", height:"98%", overflow:"scroll", border:"none"}} id="visualization-image" srcDoc={this.state.content}></iframe>
                  </Paper>
              </GridListTile>
            </GridList>
            </span>
        }

        </div>
      )
    }

}


export default ModelVisualizer;
