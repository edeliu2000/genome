const React = require('react');
const ReactDOM = require("react-dom");

import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip'

import MenuItem from '@material-ui/core/MenuItem';
import FormHelperText from '@material-ui/core/FormHelperText';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import InputLabel from '@material-ui/core/InputLabel';
import TextField from '@material-ui/core/TextField';


import Icon from '@material-ui/core/Icon';
import IconButton from '@material-ui/core/IconButton';
import ShareIcon from '@material-ui/icons/Share';
import Avatar from '@material-ui/core/Avatar';
import {Tooltip as TooltipReact} from '@material-ui/core/Tooltip';


import AdditiveForceArrayVisualizer from './additive-force-array'
import AdditiveForceVisualizer from './additive-force'


const _fetchData = require("../elastic-queries")._fetchData
const _fetchDataRaw = require("../elastic-queries")._fetchDataRaw


class AdditiveRemoteVisualizer extends React.Component {

  constructor(props) {
    super(props);

    this.handleForceArrayClick = this.handleForceArrayClick.bind(this)

    this.state = {

      expected: null,
      explanations: null,
      shownExplanations: null,

      featureNames: null,

      numSamples: null,
      numShownSamples: 250,
      numClusters:5,
      clusterSizes: [3,5,7,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25],

      force: null,
      forceBaseValue: 0,
      forceFeatures: {},
      forceFeatureNames: {},

      entryToExplain: "",


      snackbarOpen: false,
      snackbarMessage: ""
    }
  }

  componentDidMount() {
    this.onBatchExplain()
    this.setState({
      force: null,
      forceBaseValue: 0,
      forceFeatures: {},
      forceFeatureNames: {},
      entryToExplain: "",
    })
  }


  handleForceArrayClick = (elIndex) => {
    this.setState(prevState => ({
      force: true,
      forceBaseValue: prevState.expected,
      forceFeatures: prevState.explanations[elIndex].features,
      forceFeatureNames: prevState.featureNames,
      entryToExplain: "",
    }))
  }


  _onChange = (event) => {
    var tmpState = {}
    tmpState[event.target.id] = event.target.value
    this.setState(tmpState)
  }


  handleNumSamplesSelection = (event) => {
    var self = this;
    this.setState(prevState => ({
      shownExplanations: prevState.explanations.slice(0, Number(event.target.value)),
      numShownSamples: Number(event.target.value)
    }))
  }

  handleNumClustersSelection = (event) => {
    var self = this;
    this.setState({
      numClusters: Number(event.target.value)
    })
  }



  onBatchExplain = () => {
    var canonicalName = this.props.canonicalName;

    var self = this;
    var accToken = sessionStorage.getItem('accessToken');

    // call explain endpoint for shapley values
    _fetchDataRaw({
      canonicalName:canonicalName,
      application: "search"
    }, function(err, explanations){

       if(err) {
         console.log("error on explanation", err);
         return self.props.handleError(err);
       }

       var base = explanations.expected_value instanceof Array ? explanations.expected_value[0] :explanations.expected_value;
       var shapley = explanations.shap_values;
       var featureValues = explanations.feature_values;
       var num_labels = explanations.number_labels;
       var explanations = [];
       var featureNames = {};
       var fVal = null;
       shapley.forEach((sample, i) => {
        explanations[i] = {features:{}, outValue:base}
         sample.forEach((el, j) => {
           featureNames["" + (j+1)] = "f{" + (j+1) + "}";
           fVal = featureValues ? featureValues[i][j] : null;
           explanations[i].features["" + (j+1)] = {value:fVal, effect: el};
           explanations[i].outValue += el;
         });

       })

       self.setState({
         expected: base,
         explanations: explanations,
         shownExplanations: explanations.slice(0, self.state.numShownSamples),
         featureNames: featureNames,
         numSamples: explanations ? explanations.length : 0
       })

    }, "/v1.0/genome/routing/explanation/samples",
      window.location.protocol + "//" + window.location.host,
      accToken || "");
  }


  onExplainClick = () => {
    var canonicalName = this.props.canonicalName;
    const { entryToExplain } = this.state;
    var entries = JSON.parse("[" + entryToExplain + "]");

    var self = this;
    var accToken = sessionStorage.getItem('accessToken');

    // call explain endpoint for shapley values
    _fetchDataRaw({
      canonicalName:canonicalName,
      application: "search",
      entries: entries,
    }, function(err, explanations){

       if(err) {
         console.log("error on explanation", err);
         return self.props.handleError(err);
       }

       var base = explanations.expected instanceof Array ? explanations.expected[0] :explanations.expected;
       var shapley = explanations && explanations.shapley ? explanations.shapley[0] : [];
       var features = {};
       var featureNames = {};
       var outVal = base
       shapley.forEach((el, i) => {
         featureNames["" + (i+1)] = "f{" + (i+1) + "}";
         features["" + (i+1)] = {value:entries[0][i], effect: el};
         outVal += el;
       })

       self.setState({
         forceBaseValue: base,
         forceFeatures: features,
         forceFeatureNames: featureNames,
         force: true
       })

       if(self.state.explanations){
         self.setState(prevState => ({
           explanations: [{features:features, outValue: outVal}, ...prevState.explanations],
           shownExplanations: [
             {features:features, outValue: outVal}, ...prevState.explanations
           ].slice(0, prevState.numShownSamples),
           numSamples: prevState.numSamples + 1

         }))
       }



    }, "/v1.0/genome/routing/explain",
      window.location.protocol + "//" + window.location.host,
      accToken || "");
  }





  render() {
    return [(

      ( this.state.explanations && this.state.explanations.length &&

        <div id="shap-array-vizualizer" style={{"width":"100%", "marginTop":"0.5em"}}>

        <Chip
          style={{textAlign:"center", marginLeft:"auto", marginRight:"auto"}}
          avatar={<Avatar>S</Avatar>}
          label={"Shapley Explanations"}
          variant="outlined"
        />

        <FormControl variant="outlined" style={{marginLeft:"1em", minWidth:130, maxWidth:150}}>
          <InputLabel id="numShapSamples">Num Samples</InputLabel>
          <Select
            labelId="numShapSamples"
            id="numShapSamplesSelect"
            value={this.state.numShownSamples}
            onChange={this.handleNumSamplesSelection}
          >
              <MenuItem value={100}>{100}</MenuItem>
              <MenuItem value={250}>{250}</MenuItem>
              <MenuItem value={500}>{500}</MenuItem>
              <MenuItem value={this.state.numSamples}>{this.state.numSamples}</MenuItem>
          </Select>
        </FormControl>

        <FormControl variant="outlined" style={{marginLeft:"3em", minWidth:130, maxWidth:150}}>
          <InputLabel id="numSimClusters">Clusters</InputLabel>
          <Select
            labelId="numSimClusters"
            id="numClustersSelect"
            value={this.state.numClusters}
            onChange={this.handleNumClustersSelection}
          >
          {
           this.state.clusterSizes.map((v, i) => <MenuItem value={v}>{v}</MenuItem>)
          }
          </Select>
        </FormControl>


        <AdditiveForceArrayVisualizer
          onClick={this.handleForceArrayClick}
          explanations={this.state.shownExplanations}
          expected={this.state.expected}
          featureNames={this.state.featureNames}
          baseValue={this.state.expected}
          numClusters={this.state.numClusters}
          outNames={[""]}
          link="identity"
        />

        </div>
      ) || null ),

      (
        <div id="shap-vizualizer" style={{"width":"100%", "marginTop":"0.5em"}}>

        <AdditiveForceVisualizer
          forceActive={this.state.force}
          baseValue={this.state.forceBaseValue}
          outNames={["score"]}
          link={"identity"}
          features={this.state.forceFeatures}
          featureNames={this.state.forceFeatureNames}
        />

        <TextField
          id="entryToExplain"
          style={{ marginTop: "0.5em", paddingLeft: "30px", width: "calc(100% - 1.8em)" }}
          placeholder="[1,2,1.5, ...]"
          helperText="JSON Entry "
          fullWidth
          margin="normal"
          onChange={this._onChange}
          InputLabelProps={{
            shrink: true,
          }}
        />

        <Button onClick={this.onExplainClick} style={{ marginLeft: "30px" }} size="small" variant="contained" color="primary">
          explain
        </Button>

        </div>

      )];
  }

}


export default AdditiveRemoteVisualizer;
