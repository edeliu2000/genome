const React = require('react');
const ReactDOM = require("react-dom");

import Avatar from '@material-ui/core/Avatar';
import Chip from '@material-ui/core/Chip'

import {BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, Label} from 'recharts';
import * as d3 from 'd3'



class TreeLeafChart extends React.Component {

  _getLeafData = (graph) => {

    console.log("visualizing leaf graphs", graph)

    var jsonGraph = graph
    if(!jsonGraph) return {leafs:[], classes:null};

    var classes = {}

    const leafNodes = jsonGraph.nodes
      .filter((e) => {return e.leaf})
      .map((e) => {

        var objClasses = null
        var obj = {
          count:e.count,
          name:e.id.replace("leaf", ""),
          std: e.std,
          classes: objClasses,
          id: e.id
        }

        if(e.classes){
          obj.classes = true;
          e.classes.forEach((cls) => {
            classes[cls.name] = 1
            obj[cls.name.replace(" ", "")] = cls.count
          })
        }

        return obj;
      });

    var allClasses = Object.keys(classes) || classes

    return {
      leafs: leafNodes,
      classes: allClasses.length ? allClasses : null
    };

  }


  render(){
    var chartData = this._getLeafData(this.props.data);
    const color = d3.scaleOrdinal()
      .domain(chartData.classes || [])
      .range(d3.schemePaired);     //builtin range of colors

    return (
      <div id="barTreeCharts" style={{width:"100%", marginTop:"0.3em"}}>
        { chartData && chartData.leafs && chartData.leafs.length &&
          <BarChart id="barTreeLeafCountChart"
            data={chartData.leafs}
            width={290}
            height={200}>

            <CartesianGrid strokeDasharray="2 2"/>
            <XAxis name="id" dataKey="name" fill="#888" />
            <YAxis label={{ value: 'counts', angle: -90, position: 'insideLeft' }}/>
            <Tooltip
                labelFormatter={function (label) {
                    return "leaf: " + label;
                }}
            />
            <Bar id="barcount-key" key="barCountKey" name="count" dataKey="count"  >
              {chartData.leafs.map((entry, index) => (
                <Cell
                  fill = { entry.id === this.props.selectedLeaf ? '#1c265c' : '#3f51b5' }
                  strokeWidth={ entry.id === this.props.selectedLeaf ? 1 : 0 }
                  stroke={ entry.id === this.props.selectedLeaf ? '#444' : '#3f51b5' }
                  fillOpacity={ entry.id === this.props.selectedLeaf ? "0.80" : "0.85" }
                />

              ))}
          </Bar>

          </BarChart> || ""
        }

        { chartData && chartData.leafs && chartData.leafs.length && !chartData.classes &&
          <BarChart
            data={chartData.leafs}
            width={290}
            height={200}>

            <CartesianGrid strokeDasharray="2 2"/>
            <XAxis name="id" dataKey="name" fill="#888" />
            <YAxis label={{ value: 'std.', angle: -90, position: 'insideLeft' }}/>
            <Tooltip
                labelFormatter={function (label) {
                    return "leaf: " + label;
                }}
            />
            <Bar name="std" dataKey="std" fill="#3f51b5" fillOpacity="0.85"/>

          </BarChart> || ""
        }

        { chartData && chartData.leafs && chartData.leafs.length && chartData.classes &&
          <BarChart
            id="classificationBarChart"
            data={chartData.leafs}
            width={290}
            height={200}>

            <CartesianGrid strokeDasharray="2 2"/>
            <XAxis name="id" dataKey="name" fill="#888" />
            <YAxis label={{ value: 'counts', angle: -90, position: 'insideLeft' }}/>
            <Tooltip
                labelFormatter={function (label) {
                    return "leaf: " + label;
                }}
            />
            { chartData.classes.map((cls, i) => (
              <Bar key={cls} dataKey={cls.replace(" ", "")} stackId="a" fill = { color(cls.replace(" ", "")) }/>
            ))}

          </BarChart> || ""
        }

        { chartData && chartData.leafs && chartData.leafs.length &&
          <Chip
            style={{marginTop:"0.3em", margin:"auto"}}
            avatar={<Avatar>L</Avatar>}
            label={"leaf id-s"}
            variant="outlined"
          /> || ""
        }

      </div>
    )
  }

}

export default TreeLeafChart;
