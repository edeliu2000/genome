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

import dagreD3 from 'dagre-d3';
import * as d3 from 'd3'


class ModelVisualizer extends React.Component {

    state = {
      indexSelection: "",
      content: "",
      vizGraph: null
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
      var zoom = d3.zoom().on("zoom", function() {
          svgGroup.attr("transform", d3.event.transform);
        });
      svg.call(zoom);

      // Create the renderer
      var renderGraph = new dagreD3.render();

      // add a custom shape for classification leafs
      renderGraph.shapes().leaf_class = (parent, bbox, node) => {
        var w = bbox.width,
            h = bbox.height;

        var margin = {
          left: w * 0.13, right: 0,
          bottom: h * 0.07, top:h * 0.13
        };

        const color = d3.scaleOrdinal()
          .domain(node.legend)
          .range(d3.schemePaired);     //builtin range of colors

        var n_pts = node.count || 120,
        index = d3.range(n_pts),
        data = node.classes.map(function(cls) {
            return {label:cls.name, value:cls.count};
        });
        //min and max sizes related to node size for leaf charts
        const sizeBoundaries = [0.1, 2.3];
        const scaledCount = Math.min((node.count / 450), 1);
        const scaledSize = w * (sizeBoundaries[0] + ((sizeBoundaries[1]- sizeBoundaries[0]) * scaledCount));
        const size = Math.max(scaledSize, 45);
        const r = size / 2.5;


        var shapeSvg = parent
          .append("g")
          .attr("transform", "translate(" + ((-size) / 2) + ", " + ((-size) / 2) + ")")
          .append("svg")
          .attr("id", "svg-" + node.id)
          .attr("height", size + 5)
          .attr("width", size + 5);

        var arc = d3.arc()
  	      .outerRadius(r - 4)
  	      .innerRadius(0);


        var pie = d3.pie()
  	      .value(function(d) { return d.value; })(data);

        var arcs = shapeSvg
          .append("g")
          .attr("transform", "translate(" + ((size) / 2) + ", " + ((size) / 2) + ") "
            + "scale("+ (scaledSize/size) + ")")
          .selectAll("slice")     //this selects all <g> elements with class slice (there aren't any yet)
          .data(pie)                          //associate the generated pie data (an array of arcs, each having startAngle, endAngle and value properties)
          .enter()                            //this will create <g> elements for every "extra" data element that should be associated with a selection. The result is creating a <g> for every object in the data array
          .append("g")                //create a group to hold each slice (we will have a <path> and a <text> element associated with each slice)
          .attr("class", "slice");    //allow us to style things in the slices (like text)

        arcs.append("path")
          .attr("d", arc)
          .attr("fill", function(d, i){ return color(d.data.label); } )


        //add label for number counts
        shapeSvg
          .append("g")
          .attr("transform", "translate(" + (((size) / 2) + ((-size) / 4)) + ", " + (((size)) - 3) + ")")
          .append("text")
	        .text("n=" + node.count)
          .attr("class", "leaf_count")
	        .style("fill", "#666");





        console.log("classification shape node: ", w, h, r, node);
        node.intersect = function(point) {
          return dagreD3.intersect.rect({
            x: node.x, y: node.y,
            width: w, height: h
          }, point);
        };


        return shapeSvg;
      };


      // add a custom shape for regression leafs
      renderGraph.shapes().leaf_regr = (parent, bbox, node) => {
        var w = bbox.width,
            h = bbox.height;

        var margin = {
          left: w * 0.13, right: 0,
          bottom: h * 0.07, top:h * 0.13
        };

        const yNormal = d3.randomNormal(node.mean, node.std );
        const xNormal = d3.randomNormal(0.5, 0.13);
        const n_pts = d3.scaleLinear()
            .domain([node.countBounds.min, node.countBounds.max])
            .range([3, 500]);

        const index = d3.range(Math.round(n_pts(node.count))),
        data = index.map(function(i) {
            var x = xNormal();
            var y = yNormal();
            return {x:x, y:y};
        });

        var shapeSvg = parent
          .append("g")
          .attr("transform", "translate(" + ((-w ) / 2) + ", " + ((-h) / 2) + ")")
          .append("svg")
          .attr("id", "svg-" + node.label)
          .attr("height", h + 7)
          .attr("width", w)



        // Add Y axis
        const minMaxY = [Math.min(...data.map(d => {return d.y})), Math.max(...data.map(d => {return d.y}))];
        var y = d3.scaleLinear()
            .domain(minMaxY)
            .range([ h - margin.bottom, margin.top]);

        // Add X axis
        const minMax = [Math.min(...data.map(d => {return d.x})), Math.max(...data.map(d => {return d.x}))];
        var x = d3.scaleLinear()
                .domain(minMax)
                .range([margin.left, w - margin.right]);

        // y axis ticks (line is removed)
        shapeSvg.append("g")
            .attr("class", "regr-axis-y")
            .attr("transform", "translate("+ (margin.left - 2) +", "+ 0 +")")
            .call(d3.axisLeft(y).tickValues([minMaxY[0], node.mean, minMaxY[1]]))
            .call(g => g.select(".domain").remove())
            .call(g => g.selectAll(".tick text")
              .attr("x", 3)
              .attr("dy", -1));

        // x axis line, first tick is used as y axis
        shapeSvg.append("g")
            .attr("class", "regr-axis-x")
            .attr("transform", "translate(" + margin.left + ", "+ margin.top +")")
            .call(d3.axisBottom(x)
              .tickSize(h - margin.top - margin.bottom)
              .tickValues([minMax[0]]))
            .call(g => g.select(".domain").remove());

        shapeSvg.append("g")
          .attr("class", "mean-axis")
          .attr("transform", "translate(" + (margin.left - 2) + ", "+ 0 +")")
          .append("line")
          .attr("stroke", "#333")
          .attr("stroke-dasharray", "4,4")
          .attr("x1", x(minMax[0])).attr("x2", x(minMax[1]))
          .attr("y1", y(node.mean)).attr("y2", y(node.mean));


        //add label for number counts
        shapeSvg
          .append("g")
          .attr("transform", "translate(" + (((w) / 2) + ((-w) / 4)) + ", " + (((w)) + 5) + ")")
          .append("text")
          .text(node.mean.toFixed(3) + " (n=" + node.count + ")")
          .attr("class", "leaf_count_regr")
          .style("fill", "#444");


        shapeSvg.append('g')
          .attr("transform", "translate(" + margin.left + ", "+ 0 +")")
          .selectAll("dot")
          .data(data)
          .enter()
          .append("circle")
          .attr("cx", function(d) { return x(d.x); })
          .attr("cy", function(d) { return y(d.y); })
          .attr("class", function(d,i) { return "pt" + i; })
          .attr("r", 1.85)
          .attr("fill", "#60a2d1")

        node.intersect = function(point) {
          return dagreD3.intersect.rect({
            x: node.x, y: node.y,
            width: w, height: h
          }, point);
        };

        return shapeSvg;
      };

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
      svg.call(zoom.transform, d3.zoomIdentity.translate((svg.attr("width") - g.graph().width * initialScale) / 2, 20).scale(initialScale));

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
          rankdir: "TB",
          edgesep: 13,
          ranksep: 40,
          nodesep: 35,
          ranker: "tight-tree"
        }).
        setDefaultEdgeLabel(function() { return {}; });

        jsonGraph.pipeline.nodes.forEach((n, i) => {
          g.setNode(n.id, {
            label: n.label,
            shape: "circle"
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
        svg.call(zoom);

        // Create the renderer
        var renderGraph = new dagreD3.render();

        // Run the renderer. This is what draws the final graph.
        renderGraph(svgGroup, g);

        // Center the graph
        var initialScale = 0.75;
        svg.call(zoom.transform, d3.zoomIdentity.translate((svg.attr("width") - g.graph().width * initialScale) / 2, 20).scale(initialScale));

        svg.attr('height', g.graph().height * initialScale + 40);

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
        return response.json()
      }).then(function(respJSON){
        return self.setState({vizGraph: respJSON}, self._buildFancyTree);
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
                            width: 150px;
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
                            height: 180px;
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

                          .edgePath path {
                            stroke: #333;
                            fill: #333;
                            stroke-width: 1px;
                          }`
                        }} />
                      <div class="tree-graph-cont">
                      <svg width="650" className={"tree-graph"}>
                      </svg>
                      <div class="side-graph-cont">
                        <svg className={"graph-legend"}></svg>

                        { this.state.vizGraph && this.state.vizGraph.pipeline &&
                        <div style={{width:"100%"}}>
                        <Chip
                          style={{marginLeft:"auto", marginRight:"auto"}}
                          avatar={<Avatar>P</Avatar>}
                          label={"Pipeline"}
                          variant="outlined"
                        />
                        <svg className={"pipeline-graph"}></svg>
                        </div>
                        }
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
