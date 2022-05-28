const React = require('react');
const ReactDOM = require("react-dom");
import {PieChart, Pie, Legend, Tooltip, Cell, Sector} from 'recharts'



export default class OnlinePieChart extends React.Component {

  state = {
    activeIndex: 0,
  }

  onPieEnter = (data, index) => {
    this.setState({
      activeIndex: index,
    });
  }

  renderActiveShape = (props) => {
    const RADIAN = Math.PI / 180;
    const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle,
      payload, percent, value } = props;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + (outerRadius + 4) * cos;
    const sy = cy + (outerRadius + 4) * sin;
    const mx = cx + (outerRadius + 12) * cos;
    const my = cy + (outerRadius + 12) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 5;
    const ey = my;
    const textAnchor = cos >= 0 ? 'start' : 'end';
    const fill = "#00C49F";

    return (
      <g>
        <text x={cx} y={cy - 7} dy={12} textAnchor="middle" style={{fontSize:"0.6em"}} fill={"#333"}>{payload.name}</text>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={payload.fill || fill}
        />
        <Sector
          cx={cx}
          cy={cy}
          startAngle={startAngle}
          endAngle={endAngle}
          innerRadius={outerRadius + 4}
          outerRadius={outerRadius + 8}
          fill={payload.fill || fill}
        />
        <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none"/>
        <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none"/>
        <text x={ex + (cos >= 0 ? 1 : -1) * 6} y={ey} style={{fontSize:"0.7em"}} textAnchor={textAnchor} fill="#888">
          {`${(percent * 100).toFixed(1)}%`}
        </text>
      </g>
    );
  };

  render () {
    return (
      <PieChart width={this.props.width || 300} height={this.props.height || 300}>
        <Pie
          activeIndex={this.state.activeIndex}
          activeShape={this.renderActiveShape}
          data={this.props.data}
          cx="50%"
          cy="50%"
          innerRadius={12}
          outerRadius={19}
          fill={this.props.fill || "#e5383b"}
          onMouseEnter={this.onPieEnter}
        />
       </PieChart>
    );
  }
}
