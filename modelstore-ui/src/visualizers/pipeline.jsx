const React = require('react');
const ReactDOM = require("react-dom");

import Card from '@material-ui/core/Card';
import CardActions from '@material-ui/core/CardActions';
import CardContent from '@material-ui/core/CardContent';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';

import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';

import Collapse from '@material-ui/core/Collapse';

import Icon from '@material-ui/core/Icon';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';

import { curveBasis } from "d3-shape";



import DagreGraph from "dagre-d3-react"
class PipelineVisualizer extends React.Component {

  state = {
    selectedStep: {},
    displayStepInfo: "none",
    openCollapsableParams: false,
    openCollapsableDatasets: false
  }

  handleSelection = (e) => {
    //skip connector nodes
    if(e.original && !e.original.stepName) return;
    //for proper DAG node change state
    this.setState({
      selectedStep: e.original,
      displayStepInfo: "block"
    })
  }

  handleCollapsableParams = () => {
    this.setState(state => ({ openCollapsableParams: !state.openCollapsableParams }));
  }

  handleCollapsableDatasets = () => {
    this.setState(state => ({ openCollapsableDatasets: !state.openCollapsableDatasets }));
  }

  closeStepInfo = (e) => {
    this.setState({
      displayStepInfo: "none"
    })
  }

  modelIcon = () => {
    const svgNS = 'http://www.w3.org/2000/svg';
    var modelSVG = document.createElementNS(svgNS, 'g');
    var paths = [
      "M102.4,179.2v25.6c28.3,0.1,51.1,22.9,51.2,51.2c-0.1,28.3-22.9,51.1-51.2,51.2c-28.3-0.1-51.1-22.9-51.2-51.2c0.1-28.3,22.9-51.1,51.2-51.2V179.2v-25.6C45.8,153.6,0,199.4,0,256c0,56.6,45.8,102.4,102.4,102.4c56.6,0,102.4-45.8,102.4-102.4c0-56.6-45.8-102.4-102.4-102.4V179.2z",
      "M409.6,25.6v25.6c28.3,0.1,51.1,22.9,51.2,51.2c-0.1,28.3-22.9,51.1-51.2,51.2c-28.3-0.1-51.1-22.9-51.2-51.2c0.1-28.3,22.9-51.1,51.2-51.2V25.6V0C353,0,307.2,45.8,307.2,102.4c0,56.6,45.8,102.4,102.4,102.4c56.6,0,102.4-45.8,102.4-102.4C512,45.8,466.2,0,409.6,0V25.6z",
      "M409.6,332.8v25.6c28.3,0.1,51.1,22.9,51.2,51.2c-0.1,28.3-22.9,51.1-51.2,51.2c-28.3-0.1-51.1-22.9-51.2-51.2c0.1-28.3,22.9-51.1,51.2-51.2V332.8v-25.6c-56.6,0-102.4,45.8-102.4,102.4c0,56.6,45.8,102.4,102.4,102.4c56.6,0,102.4-45.8,102.4-102.4c0-56.6-45.8-102.4-102.4-102.4V332.8z",
      "M183.3,245.5l169-87.1c12.6-6.5,17.5-21.9,11-34.5c-6.5-12.6-21.9-17.5-34.5-11l-169,87.1c-12.6,6.5-17.5,21.9-11,34.5C155.2,247,170.7,252,183.3,245.5",
      "M159.8,312l169,87.1c12.6,6.5,28,1.5,34.5-11c6.5-12.6,1.5-28-11-34.5l-169-87.1c-12.6-6.5-28-1.5-34.5,11C142.3,290.1,147.2,305.6,159.8,312"
    ]

    paths.forEach((p)=>{
      var el = document.createElementNS(svgNS,'path');
      tspan.setAttribute('d', p);
      modelSVG.appendChild(el);
    })

    return modelSVG;
  }

  createGraph = (it, steps, group) => {
    var nodes = [];
    var edges = [];


    steps.forEach((item, i) => {
      var previous = i === 0 ? it : (group ? it : nodes[nodes.length - 1])

      // if current el to push is array, then recurse
      if(Array.isArray(item)){
        var subGraph = this.createGraph(previous, item, (group || 0) + 1);
        nodes = nodes.concat(subGraph.nodes);
        edges = edges.concat(subGraph.edges);


        if(steps.length > i + 1){
          var previousId = previous && previous.id || ""
          var join = {
            id: "join-" + previousId + "-" + i,
            label: ".",
            config: {
              width: -14,
              height: -14,
              labelStyle: "font-size: 0em",
            },
            group:(group || 0)
          }

          nodes.push(join);
          subGraph.nodes.filter((n) => {
            return n.group === (group || 0) + 1
          }).forEach((prev) => {
            edges.push({
              source: prev.id,
              target: join.id,
              config:{
                arrowhead: 'undirected',
			          curve: curveBasis,
              }
            })
          });
        }

      }else{

        var svgNS = "http://www.w3.org/2000/svg"
        var labelSVG = document.createElementNS(svgNS, 'text');
        var tspan = document.createElementNS(svgNS,'tspan');
        tspan.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
        tspan.setAttribute('dy', '2.45em');
        tspan.setAttribute('x', '1');
        tspan.textContent = item.stepType !== "metrics" ? item.stepType[0].toUpperCase():item.stepType[0];
        labelSVG.appendChild(tspan);

        var groupIcon, scheduleIcon = null;
        var isSchedule = item.stepType === "schedule";
        if(isSchedule){
          scheduleIcon = document.createElementNS(svgNS, 'path');
          scheduleIcon.setAttribute("d", "M13.5 2c-5.621 0-10.211 4.443-10.475 10h-3.025l5 6.625 5-6.625h-2.975c.257-3.351 3.06-6 6.475-6 3.584 0 6.5 2.916 6.5 6.5s-2.916 6.5-6.5 6.5c-1.863 0-3.542-.793-4.728-2.053l-2.427 3.216c1.877 1.754 4.389 2.837 7.155 2.837 5.79 0 10.5-4.71 10.5-10.5s-4.71-10.5-10.5-10.5z")
          scheduleIcon.setAttribute("transform", "translate(-8,-3) scale(0.85)")

          groupIcon = document.createElementNS(svgNS, 'g');
          groupIcon.setAttribute("transform", "translate(6.7, 10.2)")
          groupIcon.appendChild(scheduleIcon);
          groupIcon.appendChild(labelSVG);
        }


        var next = {
          id: item.stepName,
          label: isSchedule ? groupIcon : labelSVG,
          labelType: "svg",
          class: isSchedule ? "schedule" : "complete",
          config:{
            width:5,
            height:5,
            labelStyle: "font-size: 0.8em"
          },
          group: group || 0,
          stepName: item.stepName,
          stepParameters: item.parameters,
          stepDatasets: item.datasets,
          schedule: item.schedule || "",
          nextRun: item.nextRun || 0,
          image: item.image || "",
          timeout: item.timeout || "",
          retry: item.retry && Number(item.retry) || 0
        };

        nodes.push(next);
        if(previous && next){
          edges.push({
            source: previous.id,
            target: next.id,
            config:{
              curve: curveBasis,
            }
          })
        }
      }
    });

    return {nodes:nodes, edges:edges}
  }


  render() {

    const steps = this.props.genomePipeline || [];
    const graph = this.createGraph(null, steps);

    return (
    <div style={{position:"relative"}}>
      <style
      dangerouslySetInnerHTML={{
        __html: `
        .nodes {
	        fill: #98bcd6;
        }
        .node.complete {
	        fill: #85d6af;
        }
        .node.schedule {
	        fill: #e3b740;
        }
        .node.schedule path{
	        fill: white;
          stroke: #e3b740;
        }
        .node.hidden {
	        display: none;
        }
        .nodes text {
	        fill: #888;
        }
        .edgePath path {
	        stroke: #c2c1be;
	        fill: #c2c1be;
	        stroke-width: 1.5px;
        }`
      }}
      />

      <DagreGraph
            nodes={graph.nodes}
            links={graph.edges}
            config={{
                rankdir: 'LR',
                align: 'UL'
            }}
            width={this.props.width}
            height={this.props.height}
            animate={this.props.animate || 1500}
			      shape='circle'
			      fitBoundaries
		      	zoomable
            onNodeClick={this.handleSelection}
            onRelationshipClick={e => console.log(e)}
        />

      <Card style={{
        position:"absolute",
        display: this.state.displayStepInfo,
        right:"0.5em",
        top:"0.3em",
        zIndex: "5",
      }}>

        <CardContent>
        <Typography variant="h5" component="h3" style={{
          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
          color: '#666'
        }}>
          {this.state.selectedStep.stepName}
        </Typography>
        <List style={{marginTop:"0.35em"}}>

          { this.state.selectedStep.schedule &&
          <ListItem divider>
            <ListItemIcon>
              <Icon>access_time</Icon>
            </ListItemIcon>
            <ListItemText inset
              primary={this.state.selectedStep.schedule}
              secondary={
                "next: " + new Date(this.state.selectedStep.nextRun).toLocaleDateString("en-US", {
                  day:"2-digit", month:"2-digit", year:"2-digit",
                  hour:"2-digit", minute:"2-digit"})
              }
            />
          </ListItem>
          }


          <ListItem divider button onClick={this.handleCollapsableParams}>
            <ListItemIcon>
              <Icon>storage</Icon>
            </ListItemIcon>
            <ListItemText inset primary={
              "Parameters (" + (this.state.selectedStep.stepParameters ? Object.entries(this.state.selectedStep.stepParameters).length : 0) + ") "
            } />
            {this.state.openCollapsableParams ? <ExpandLess /> : <ExpandMore />}
          </ListItem>
          <Collapse in={this.state.openCollapsableParams} timeout="auto" unmountOnExit>
            <List component="div" disablePadding >
              {
                this.state.selectedStep.stepParameters ? Object.entries(this.state.selectedStep.stepParameters).map((entry, i) => <ListItem button>
                <ListItemIcon>
                  <Icon>arrow_right</Icon>
                </ListItemIcon>
                <ListItemText inset primary={"(" + (i + 1) + ") " + entry[0]} secondary={"" + entry[1]}/>
                </ListItem>
                ) : <ListItem button><ListItemIcon><Icon>arrow_right</Icon></ListItemIcon>
                <ListItemText inset primary={"no-params"}/>
                </ListItem>
              }
            </List>
          </Collapse>


          <ListItem divider button onClick={this.handleCollapsableDatasets}>
            <ListItemIcon>
              <Icon>storage</Icon>
            </ListItemIcon>
            <ListItemText inset primary={
              "Datasets (" + (this.state.selectedStep.stepDatasets ? this.state.selectedStep.stepDatasets.length : 0) + ") "
            } />
            {this.state.openCollapsableDatasets ? <ExpandLess /> : <ExpandMore />}
          </ListItem>
          <Collapse in={this.state.openCollapsableDatasets} timeout="auto" unmountOnExit>
            <List component="div" disablePadding >
              {
                this.state.selectedStep.stepDatasets ? this.state.selectedStep.stepDatasets.map((entry, i) => <ListItem button>
                <ListItemIcon>
                  <Icon>arrow_right</Icon>
                </ListItemIcon>
                <ListItemText inset primary={"(" + (i + 1) + ") " + entry.ref} secondary={"" + entry.refType}/>
                </ListItem>
                ) : <ListItem button><ListItemIcon><Icon>arrow_right</Icon></ListItemIcon>
                <ListItemText inset primary={"no-params"}/>
                </ListItem>
              }
            </List>
          </Collapse>


          <ListItem divider>
            <ListItemText inset
              primary={this.state.selectedStep.image}
              secondary={
                "timeout: " + this.state.selectedStep.timeout + " | retry: " + this.state.selectedStep.retry
              }
            />
          </ListItem>
        </List>
        </CardContent>
        <CardActions>
          <Button size="small" color="primary" onClick={this.closeStepInfo}>Close</Button>
        </CardActions>
      </Card>

    </div>
    )

  }

}

export default PipelineVisualizer;
