import React from "react";

import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import FormHelperText from '@material-ui/core/FormHelperText';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';

import Avatar from '@material-ui/core/Avatar';
import Chip from '@material-ui/core/Chip';
import Paper from '@material-ui/core/Paper';

import Tooltip from '@material-ui/core/Tooltip';

class NormalSpan extends React.Component{
  render(){
    return (
      <span class="word">
        {this.props.text}
      </span>
    );
  }
}


class WeightedSpan extends React.Component{
  render(){
    return (
      <Tooltip title={"score: " + this.props.weight.toFixed(4)}>
      <span class="weightedWord" style={{
        backgroundColor:this.props.color,
        opacity:this.props.opacity
      }}>
        {this.props.text}
      </span>
      </Tooltip>
    );
  }
}

class TextExplainerVisualizer extends React.Component {
  state = {
    classSelection: "",
    classScore: 0,
    classProbability: 0
  }

  componentDidMount = () => {
    console.log("calling on remote api finish");
    this.handleClassSelection({
      target:{
        value: this.props.targetClasses &&
               this.props.targetClasses.length &&
               this.props.targetClasses[0].target
      }
    });
  }


  handleClassSelection = (evt) => {

    var score = 0;
    var proba = 0;

    this.props.targetClasses.forEach((item) => {
      if(evt.target.value === item.target){
        score = item.score;
        proba = item.proba;
      }
    });

    this.setState({
      classSelection: evt.target.value,
      classScore: score,
      classProbability: proba,
    });
  }

  _getColor(weight, maxWeight){
    var hue = weight > 0 ? 120 : 0;
    var saturation = 1;
    var relWeight = Math.pow((Math.abs(weight) / maxWeight), 0.7);
    var lightness = 1.0 - (1 - 0.6) * relWeight;
    return {
      color: "hsl("+ hue +"," + (saturation * 100) + "%, " + (lightness * 100).toFixed(2) + "% )",
      opacity: (0.8 + ((Math.abs(weight)/maxWeight) * 0.2)).toFixed(2)
    }
  }


  _getMaxWeight(doc_spans){
    var maxWeight = doc_spans
      .map((a) => {return a[2]})
      .reduce((a,b) => { return Math.max(Math.abs(a), Math.abs(b));});

    return maxWeight;
  }


  _getCharWeights(doc_spans){
    //weights for each char in doc,
    //init array of doc length with zeros
    var charWeights = Array.from(Array(this.props.doc.length), (_, i) => 0);
    var docCount = {};

    doc_spans.forEach((item, i) => {
      if(docCount[item[0]]){
        docCount[item[0]] += 1;
      }else{
        docCount[item[0]] = 1;
      }
    })


    doc_spans.forEach((item, i) => {
      item[1].forEach((span, j) => {
        for(var ind = span[0]; ind < span[1]; ind++){
          charWeights[ind] = charWeights[ind] + (item[2]/docCount[item[0]]);
        }
      })
    });
    console.log(charWeights.length, "same length", charWeights.length === this.props.doc.length);
    return charWeights;
  }


  _getProcessedSpans(charWeights){
    var spans = [];
    var prevWeight = 0;
    charWeights.forEach((weight, i) => {
      if(weight !== 0 && prevWeight === 0){
        //open span
        spans.push([[i], weight]);
      }else if(weight === 0 && prevWeight !== 0){
        //close span
        spans[spans.length - 1] = [ [spans[spans.length - 1][0][0], i], spans[spans.length - 1][1]]
      }

      //close the last span if open
      if(i === charWeights.length && spans[spans.length - 1][0].length < 2){
        spans[spans.length - 1] = [ [spans[spans.length - 1][0][0], i], spans[spans.length - 1][1]]
      }

      prevWeight = weight;
    })
    return spans;
  }

  render(){

    var defaultSelection = this.props.targetClasses &&
      this.props.targetClasses.length &&
      this.props.targetClasses.sort((a,b)=>{return b.score - a.score})[0];

    var metrics = this.props.metrics;
    console.log("explainer metrics", metrics)

    var classScore = this.state.classScore || defaultSelection.score || 0;
    var classProbability = this.state.classProbability || defaultSelection.proba || 0;
    var classSelection = this.state.classSelection || defaultSelection.target || "";

    var currentTarget = this.props.targetClasses &&
        this.props.targetClasses.length &&
        this.props.targetClasses.filter((item) => {return item.target === classSelection})[0];

    var currentSpans = currentTarget && currentTarget.weighted_spans.docs_weighted_spans[0].spans;

    //set colors depending on feature weights on proper words
    var docWithWeights = currentTarget ? "" : this.props.doc;
    var prevEnd = 0;

    var maxWeight = currentSpans && this._getMaxWeight(currentSpans);
    var charWeights = currentSpans && this._getCharWeights(currentSpans);
    var processedSpans = charWeights && this._getProcessedSpans(charWeights);

    var spanChildren = []


    processedSpans && processedSpans.forEach((item, i) => {
        const colStyle = this._getColor(item[1], maxWeight);

        var span = item[0];

        if(prevEnd !== span[0]){
          spanChildren.push(<NormalSpan text={this.props.doc.slice(prevEnd, span[0])} />)
        }

        spanChildren.push(
          <WeightedSpan
            text={this.props.doc.slice(span[0], span[1])}
            weight={item[1]}
            color={colStyle.color}
            opacity={colStyle.opacity}
          />
        );

        prevEnd = span[1];

        // on last item, append remaining text section
        if(i === processedSpans.length - 1){
          spanChildren.push(<NormalSpan text={ this.props.doc.slice(prevEnd, this.props.doc.length)} />);
        }
    })

    console.log("text to render with weighted span num:", spanChildren.length)

    return (

      <div style={{marginLeft:"auto", marginRight:"auto", width:"70%"}}>
      <FormControl variant="outlined" style={{marginLeft:"1em", minWidth:130, maxWidth:150}}>
        <InputLabel id="classLabel">Label Class</InputLabel>
        <Select
          labelId="classLabel"
          id="classLabelSelect"
          value={classSelection}
          onChange={this.handleClassSelection}
        >
          {
            this.props.targetClasses.map((targetClass, i) => <MenuItem value={targetClass.target}>
              {targetClass.target}
            </MenuItem>)
          }
        </Select>
      </FormControl>
      <span style={{marginLeft:"1.5em"}}>

      <Chip
        avatar={<Avatar>S</Avatar>}
        label={"score( " + classScore.toFixed(4) + " )"}
        variant="outlined"
      />
      <Chip
        style={{marginLeft:"0.5em"}}
        avatar={<Avatar>P</Avatar>}
        label={"probability( " + classProbability.toFixed(4) + " )"}
        variant="outlined"
      />

      </span>

      <Paper
        style={{
          width: "100%", height:"4.5em", overflow:"auto", padding:"0.3em",
          marginTop:"0.3em"
        }}
        elevation={2}
      >
        <div>
        {spanChildren}
        </div>
      </Paper>

      {
        metrics && <div style={{marginTop:"0.3em"}}>
        <Tooltip title={
          "Whitebox (" +
          "classifier: " + (this.props.explainer && this.props.explainer.classifier) + " " +
          "vectorizer: " + (this.props.explainer && JSON.stringify(this.props.explainer.vectorizer)) + ")"
        }>
          <Chip style={{marginLeft:"0.5em"}} label="LIME"/>
        </Tooltip>
        <Tooltip title="Whitebox vs Blackbox. Lower is better">
          <Chip
            style={{marginLeft:"0.5em"}}
            label={"KL divergence: " + (metrics.mean_KL_divergence.toFixed(5))}
          />
        </Tooltip>
        <Chip style={{marginLeft:"0.5em"}} label={"score: " + (metrics.score.toFixed(5))}/>
        </div>
      }
      </div>
  )}

}

export default TextExplainerVisualizer;
