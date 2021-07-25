import dagreD3 from 'dagre-d3';
import * as d3 from 'd3'


// add a custom shape for classification leafs
const classificationLeaf = (self) => {

  return (parent, bbox, node) => {
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
      .attr("width", size + 5)
      .on('mouseover', (d, i) => {
        self.setState({selectedLeaf: node.id})
      });

    var arc = d3.arc()
      .outerRadius(r - 4)
      .innerRadius(0);


    var pie = d3.pie()
      .value(function(d) { return d.value; })(data);

    var arcs = shapeSvg
      .append("g")
      .attr("transform", "translate(" + ((size) / 2) + ", " + ((size) / 2) + ") "
        + "scale("+ (scaledSize/size) + ")")
      .selectAll("slice")         //this selects all <g> elements with class slice (there aren't any yet)
      .data(pie)                  //associate the generated pie data (an array of arcs, each having startAngle, endAngle and value properties)
      .enter()                    //this will create <g> elements for every "extra" data element that should be associated with a selection. The result is creating a <g> for every object in the data array
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




    node.intersect = function(point) {
      return dagreD3.intersect.rect({
        x: node.x, y: node.y,
        width: w, height: h
      }, point);
    };


    return shapeSvg;
  }
};


export default classificationLeaf
