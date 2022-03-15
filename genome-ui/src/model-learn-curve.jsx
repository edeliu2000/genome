const React = require('react');
const ReactDOM = require("react-dom");

import {LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Label} from 'recharts';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';

import Snackbar from '@material-ui/core/Snackbar';
import Button from '@material-ui/core/Button';
import Icon from '@material-ui/core/Icon';
import IconButton from '@material-ui/core/IconButton';


export default class ModelLearningCurve extends React.Component{

  constructor(props) {
    super(props);

    this.lineColors = ["#8884d8", "#82ca9d", "#ad66a9", "#de934e", "#e8585f"]

    this.state = {
      open: false,
      openProps: false,
      snackbarOpen:false,
      snackbarMessage: "",

      data: [],
      lines: {},
    }
  }

  handleClickOpenProps = () => {
    this.setState({ openProps: true });
  }


  handleCloseProps = (event) => {
    this.setState({ openProps: false });
  }


  loadEpochs = () => {
    const canonicalName = this.props.meta.canonicalName;
    const application = this.props.meta.application;
    const pipelineName = this.props.meta.pipelineName;
    const pipelineStage = this.props.meta.pipelineStage;
    const pipelineRunId = this.props.meta.pipelineRunId;


    var self = this;
    var accToken = sessionStorage.getItem('accessToken');

    // call explain endpoint for shapley values
    _fetchDataRaw({
      canonicalName:canonicalName,
      application: application
    }, function(err, epochs){

      if(err) {
        console.log("error on learn curve", err);
        return self.props.handleError(err);
      }

      epochs = epochs ? epochs : [];
      const lines = {};
      const dataPoints = epochs.map((epoch, i) => {
        var p = {name: "" + epoch.epoch, created: epoch.created};
        Object.entries(epoch.metrics || {}).forEach((e, i) => {
          p[e[0]] = e[1];
          lines[e[0]] = "monotonic";
        });
        return p;
      })

      self.setState({
        data: dataPoints,
        lines: lines
      })

    }, "/v1.0/genome/routing/explanation/samples",
      window.location.protocol + "//" + window.location.host,
      accToken || "");
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


  render(){
    return (
      <div>

      <div style={{"float":"left", "width":"45%", marginLeft:"-1em"}}>
      <Button mini color="primary" onClick={this.handleClickOpenProps}>
        <Icon>poll</Icon>
      </Button>
      </div>

      <Dialog
          open={this.state.openProps}
          onClose={this.handleCloseProps}
          maxWidth={"lg"}
          fullWidth={true}
          aria-labelledby="dialog-title"
          scroll="body"
        >
        <DialogTitle id="dialog-title">Learning Curve</DialogTitle>
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


          <LineChart width={730} height={250} data={this.state.data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>

            <CartesianGrid strokeDasharray="3 3" />

            <XAxis dataKey="name" label={{value:"epochs", offset:0, position:"bottom"}} />
            <YAxis />
            <Tooltip />
            <Legend verticalAlign="top"/>
            {
              Object.entries(this.state.lines).map(
                (entry, i) => <Line
                               type="monotone"
                               dataKey={entry[0]}
                               stroke={this.lineColors[i % this.lineColors.length]}
                               />)
            }
          </LineChart>

        </div>
        </DialogContent >
        <DialogActions>
          <Button onClick={this.handleCloseProps} color="primary">
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
      </div>
    )
  }
}
