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

import TreeLeafChart from './model-leaf-chart'
import regressionLeaf from './model-leaf-chart-regr';
import classificationLeaf from './model-leaf-chart-class';


import dagreD3 from 'dagre-d3';
import * as d3 from 'd3'




class ModelVisualizer extends React.Component {

    state = {
      indexSelection: "",
      content: "some",
      vizGraph: null,
      selectedLeaf: null
    }

    componentDidMount(){
      this._buildFancyTree();
    }

    _createArray = (num) => {
      var arr = [];
      for(var i=0;i<num;i++){arr[i] = i;}
      return arr;
    }

    _buildFancyTree = () => {

      var jsonGraphClass = this.state.vizGraph


      if(!jsonGraphClass) return;


      var g = new dagreD3.graphlib.Graph().setGraph({
          rankdir: "TB",
          edgesep: 13,
          ranksep: 40,
          nodesep: 35,
          ranker: "tight-tree"
        }).
        setDefaultEdgeLabel(function() { return {}; });


      const leafSize = jsonGraphClass.classifier ? 50 : 85;
      const nodeCounts = jsonGraphClass.nodes
        .filter((e) => {return e.leaf})
        .map((e) => {return e.count});

      const countBounds = {
        min: Math.min(...nodeCounts),
        max: Math.max(...nodeCounts)
      }

      jsonGraphClass.nodes.forEach((n, i) => {
        if(n.leaf){
          g.setNode(n.id, {
            label: "",
            shape: jsonGraphClass.classifier ? "leaf_class" : "leaf_regr",
            width:leafSize,
            height:leafSize,
            count: n.count,
            countBounds: countBounds,
            mean: n.mean,
            std: n.std,
            classes: n.classes,
            legend: jsonGraphClass.legend,
            id: n.id
          })
        }else{
          g.setNode(n.id, {
            label: n.label,
            shape: "rect"
          })
        }
      });

      jsonGraphClass.edges.forEach((edge, i) => {
        g.setEdge(edge.start, edge.end, {
          weight: 3.2
        });
      });

      //clear everything that is there already
      d3.selectAll('svg.tree-graph > g').remove();

      var svg = d3.select("svg.tree-graph");
      var svgGroup = svg.append("g");

      // Set up zoom support
      var zoom = d3.zoom().on("zoom", () => {
          svgGroup.attr("transform", d3.event.transform);
        });
      svg.call(zoom);

      // Create the renderer
      var renderGraph = new dagreD3.render();

      // add a custom shape for classification leafs
      renderGraph.shapes().leaf_class = classificationLeaf(this);


      // add a custom shape for regression leafs
      renderGraph.shapes().leaf_regr = regressionLeaf(this);

      // add classification legends
      var legend_class = (parent, node) => {

        const color = d3.scaleOrdinal()
          .domain(node.classes)
          .range(d3.schemePaired);     //builtin range of colors

        var shapeSvg = parent
          .append("g")
          .attr("transform", "translate(" + 0 + ", " + 0 + ")");


        // Add one dot in the legend for each name.
        shapeSvg.selectAll("mydots")
            .data(node.classes)
            .enter()
            .append("circle")
              .attr("cx", 30)
              .attr("cy", function(d,i){ return 30 + i*25}) // 100 is where the first dot appears. 25 is the distance between dots
              .attr("r", 7)
              .style("fill", function(d){ return color(d)})

        // Add one dot in the legend for each name.
        shapeSvg.selectAll("mylabels")
            .data(node.classes)
            .enter()
            .append("text")
              .attr("x", 50)
              .attr("y", function(d,i){ return 30 + i*25}) // 100 is where the first dot appears. 25 is the distance between dots
              .style("fill", function(d){ return color(d)})
              .text(function(d){return d})
              .attr("text-anchor", "left")
              .style("alignment-baseline", "middle")


        return shapeSvg;

      };


      // Run the renderer. This is what draws the final graph.
      renderGraph(svgGroup, g);

      // Center the graph
      var initialScale = 0.75;
      var containerWidth = (() => {try { return svg.attr("width"); } catch(e){ return 600; }})() ;
      svg.call(zoom.transform, d3.zoomIdentity.translate((containerWidth - g.graph().width * initialScale) / 2, 20).scale(initialScale));

      svg.attr('height', g.graph().height * initialScale + 40);

      if(jsonGraphClass.legend){
        var svgLegend = d3.select("svg.graph-legend");
        legend_class(svgLegend, {
          classes: jsonGraphClass.legend,
          id: "graph-legend"
        })
      }

      this._buildFancyPipeline()

    }

    _buildFancyPipeline = () => {

      var jsonGraph = this.state.vizGraph

      if(!jsonGraph) return;

      if(!jsonGraph.pipeline) return;

      var g = new dagreD3.graphlib.Graph().setGraph({
          rankdir: "LR",
          edgesep: 13,
          ranksep: 40,
          nodesep: 35,
          ranker: "tight-tree"
        }).
        setDefaultEdgeLabel(function() { return {}; });

        jsonGraph.pipeline.nodes.forEach((n, i) => {
          g.setNode(n.id, {
            label: n.label,
            shape: "circle",
            width: 150,
            height:30
          })
        });

        jsonGraph.pipeline.edges.forEach((edge, i) => {
          g.setEdge(edge.start, edge.end, {
            weight: 3.2
          });
        });

        //clear everything that is there already
        d3.selectAll('svg.pipeline-graph > g').remove();

        var svg = d3.select("svg.pipeline-graph");
        var svgGroup = svg.append("g");

        // Set up zoom support
        var zoom = d3.zoom().on("zoom", function() {
          svgGroup.attr("transform", d3.event.transform);
        });

        // Create the renderer
        var renderGraph = new dagreD3.render();

        // Run the renderer. This is what draws the final graph.
        renderGraph(svgGroup, g);

        // Center the graph
        const initialScaleWidth = 0.75;
        const initialScaleHeight = 0.45;
        var containerWidth = () => {try { return svg.attr("width"); } catch(e){ return 600; }} ;
        svg.call(zoom.transform, d3.zoomIdentity.translate((containerWidth - g.graph().width * initialScaleWidth) / 2, 20).scale(initialScaleWidth));

        svg.attr('height', g.graph().height * initialScaleHeight + 40);

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
      }).then((response) => {
        if(!response.ok){throw response;}
        return response.json()
      }).then((respJSON) => {
        console.log("setting new graph state")
        return this.setState({vizGraph: respJSON}, this._buildFancyTree);
      }).catch((err) => {
        console.log("_fetchRaw mystery error: ", err)
        if (typeof err.json === 'function') {
          err.json().then(jsonErr => {
            var errStatus = jsonErr.status || (jsonErr.error && jsonErr.error.status)
            return this.props.errorCallBack({status: errStatus, message: null});
          })
        }else{
          var errStatus = err.status || (err.error && err.error.status)
          return this.props.errorCallBack({status: errStatus, message: null});
        }
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

                  <Button id="visualizerButton" onClick={this.handleModelVisualization}
                   variant="contained"
                   component="span"
                   style={{marginTop:"0.5em"}}
                  >
                  <ShareIcon style={{transform:"rotate(90deg)"}}/>
                  <span style={{marginLeft:"0.45em"}}>Visualize Model</span>
                  </Button>

                  <Badge
                    badgeContent={this.props.ensembleEstimators}
                    style={{marginTop:"0.5em"}}
                    max={999} color="primary">
                  <Chip
                    style={{marginLeft:"1em"}}
                    avatar={<Avatar>M</Avatar>}
                    label={this.props.estimatorClassName || this.props.estimatorCategory || "Unknown"}
                    variant="outlined"
                  />
                  </Badge>
                  { this.props.estimatorCategory === "ensemble" &&
                  <FormControl id="ensembleIndexMenu"
                  style={{marginTop:"-0.5em", marginLeft:"1.3em", minWidth:130, maxWidth:150}}>
                    <InputLabel id="modelTreeIndex">Tree Index</InputLabel>
                    <Select
                      labelId="modelTreeIndex"
                      id="ensambleModelTreeIndex"
                      value={this.state.indexSelection}
                      onChange={this.handleModelVisualization}
                      autoWidth
                    >
                      {
                        this._createArray(this.props.ensembleEstimators).map((targetClass, i) => <MenuItem id={"ensembleItemIndex-" + i} value={targetClass}>
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
                  <Paper style={{height:"700px", width:"97%", margin:"auto", marginTop:"0.3em"}} elevation={1}>

                      <style
                        dangerouslySetInnerHTML={{
                          __html: `
                          .tree-graph-cont{
                            float:left;
                            width:100%;
                          }

                          .tree-graph{
                            width: 650px;
                            height: 350px;
                            float:left;
                            margin-left:1em;
                          }

                          .side-graph-cont{
                            width: 290px;
                            min-height: 180px;
                            float:left;
                            margin-left:2em;
                          }

                          .graph-legend{
                            width: 100%;
                            height: 180px;
                            float:left;
                          }

                          .pipeline-graph {
                            width: 100%;
                            height: 100px;
                            float:left;
                          }


                          .tree-graph .node rect {
                            stroke: #333;
                            fill: #fff;
                            opacity: 0;
                          }

                          .pipeline-graph .node circle {
                            stroke: #333;
                            fill: #fff;
                            opacity: 0;
                          }


                          .regr-axis-y{
                            font: 7px sans-serif;
                            text-anchor:middle;
                          }

                          .regr-axis-y .tick text{
                            fill: #000;
                            opacity: 0.85;
                            font-size: 9px
                          }

                          text.leaf_count_regr{
                            font-size: 10px
                          }

                          .regr-axis-x .tick text{
                            fill: #000;
                            opacity: 0;
                            font-size: 6px
                          }

                          .regr-axis-y .tick line{
                            opacity: 0;
                          }

                          .regr_pt{
                            fill: rgba(55, 66, 128, 0.35);
                          }

                          .edgePath path {
                            stroke: #333;
                            fill: #333;
                            stroke-width: 1px;
                          }`
                        }} />
                      <div class="tree-graph-cont">
                      <div style={{width:"650px", float:"left"}}>
                      <svg width="650" className={"tree-graph"}>
                      </svg>

                      { this.state.vizGraph && this.state.vizGraph.pipeline &&
                      <div style={{width:"100%", marginLeft:"1em"}}>
                      <Chip
                        style={{marginLeft:"auto", marginRight:"auto", marginTop:"1em"}}
                        avatar={<Avatar>P</Avatar>}
                        label={"Pipeline"}
                        variant="outlined"
                      />
                      <svg width="650" className={"pipeline-graph"}></svg>
                      </div>
                      }
                      </div>



                      <div class="side-graph-cont">
                        <TreeLeafChart data={this.state.vizGraph} selectedLeaf={this.state.selectedLeaf}/>
                        <svg className={"graph-legend"}></svg>

                      </div>
                      </div>

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
