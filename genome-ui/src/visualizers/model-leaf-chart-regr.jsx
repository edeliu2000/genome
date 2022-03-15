import dagreD3 from 'dagre-d3';
import * as d3 from 'd3'



// add a custom shape for regression leafs
const regressionLeaf = (self) => {

  return (parent, bbox, node) => {
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
      .on('mouseover', (d, i) => {
        self.setState({selectedLeaf: node.id})
      });




    // Add Y axis
    const minMaxY = [Math.min(...data.map(d => {return d.y})), Math.max(...data.map(d => {return d.y}))];
    var y = d3.scaleLinear()
        .domain(minMaxY)
        .range([ h - margin.bottom, margin.top]);

    // Add X axis
    const minMax = [Math.min(...data.map(d => {return d.x})), Math.max(...data.map(d => {return d.x}))];
    const mxRange = w - (margin.right + margin.left);

    var x = d3.scaleLinear()
            .domain(minMax)
            .range([margin.left + (0.27 * mxRange), w - margin.right - (0.27 * mxRange)]);

    var xScaled = d3.scaleLinear()
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
        .attr("transform", "translate(" + (margin.left - 1) + ", "+ margin.top +")")
        .call(d3.axisBottom(xScaled)
          .tickSize(h - margin.top - margin.bottom)
          .tickValues([minMax[0]]))
        .call(g => g.select(".domain").remove());

    shapeSvg.append("g")
      .attr("class", "mean-axis")
      .attr("transform", "translate(" + (margin.left - 1) + ", "+ 0 +")")
      .append("line")
      .attr("stroke", "#333")
      .attr("stroke-dasharray", "4,4")
      .attr("x1", xScaled(minMax[0])).attr("x2", xScaled(minMax[1]))
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
      .attr("class", function(d,i) { return "regr_pt pt" + i; })
      .attr("r", 1.85)

    node.intersect = function(point) {
      return dagreD3.intersect.rect({
        x: node.x, y: node.y,
        width: w, height: h
      }, point);
    };

    return shapeSvg;
  }
};


export default regressionLeaf
