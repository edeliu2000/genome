const React = require('react');
const ReactDOM = require("react-dom");
const tree_json = require('./fixtures/decision_tree_viz.json')
import * as d3 from 'd3'

import Renderer from 'react-test-renderer';

import { configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16.3';

configure({ adapter: new Adapter() });

import {shallow} from 'enzyme';

import ModelVisualizer from '../src/visualizers/model-visualizer';
import TreeLeafChart from '../src/visualizers/model-leaf-chart';
import regressionLeaf from '../src/visualizers/model-leaf-chart-regr';
import classificationLeaf from '../src/visualizers/model-leaf-chart-class';


global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve(tree_json),
  })
);

beforeEach(() => {
  fetch.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});


describe("Model Visualizer Module", () => {
  test('test fancy model', () => {

    jest.useFakeTimers();

    var component = shallow(  <ModelVisualizer
        canonicalName = "canonical"
        application = "app"
        ensembleEstimators = { 5 }
        estimatorCategory={"RandomForest"}
        estimatorClassName={ "Random Forest" }
        framework={ "tensorflow" }
        errorCallBack={(e) => {console.log("mocked call to error")}}
        />)
    var button = component.find('#visualizerButton')
    button.simulate("click")

    setTimeout(() => expect(component.state('vizGraph')).not.toBeNull(), 250);
    setTimeout(() => expect(component.state('vizGraph')).toEqual(tree_json), 250);


  });

  test('test fancy pipeline', () => {

    jest.useFakeTimers();

    const component = shallow(  <ModelVisualizer
        canonicalName = "canonical"
        application = "app"
        ensembleEstimators = { 5 }
        estimatorCategory={"RandomForest"}
        estimatorClassName={ "Random Forest" }
        framework={ "tensorflow" }
        errorCallBack={(e) => {console.log("mocked call to error")}}
        />)

    const button = component.find('#visualizerButton')
    button.simulate("click")

    const pipelineSVG = component.find('.pipeline-graph')

    setTimeout(() => expect(pipelineSVG.text()).not.toBeNull(), 250);

  });

  test('test fancy classification model', () => {

    jest.useFakeTimers();

    const component = shallow(  <ModelVisualizer
        canonicalName = "canonical"
        application = "app"
        ensembleEstimators = { 5 }
        estimatorCategory={"RandomForest"}
        estimatorClassName={ "Random Forest" }
        framework={ "tensorflow" }
        errorCallBack={(e) => {console.log("mocked call to error")}}
        />)

    const button = component.find('#visualizerButton');
    button.simulate("click");

    const leaf19 = component.find('#svg-leaf19');
    const leafPieSlice = leaf19.find('.slice').at(3);

    setTimeout(() => expect(leaf19.text()).not.toBeNull(), 250);
    setTimeout(() => expect(leafPieSlice.text()).not.toBeNull(), 250);

  });


  test('test fancy error', () => {

    jest.useFakeTimers();
    const mockError = jest.fn()

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve(tree_json),
      })
    );

    const component = shallow(  <ModelVisualizer
        canonicalName = "canonical"
        application = "app"
        ensembleEstimators = { 5 }
        estimatorCategory={ "ensemble" }
        estimatorClassName={ "RandomForest" }
        framework={ "tensorflow" }
        errorCallBack={ mockError }
        />)

    const button = component.find('#visualizerButton');
    button.simulate("click");

    setTimeout(() => expect(mockError.mock.calls.length).toEqual(1), 250);

  });


  test('test fancy ensemble index selector', () => {

    jest.useFakeTimers();
    const mockError = jest.fn()

    const ensembleTreeNum = 5;

    const component = shallow(  <ModelVisualizer
        canonicalName = "canonical"
        application = "app"
        ensembleEstimators = { ensembleTreeNum }
        estimatorCategory={ "ensemble" }
        estimatorClassName={ "RandomForest" }
        framework={ "tensorflow" }
        errorCallBack={ mockError }
        />)

    const lastItem = component.find('#ensembleItemIndex-' + (ensembleTreeNum-1));
    lastItem.simulate('mouseover');
    console.log("ensemble select total rendered:", lastItem);



    expect(lastItem).not.toBeNull()

  });


  test('test fancy classification leaf', () => {

    jest.useFakeTimers();

    var mockSelf = jest.fn()
    var mockd3Element = {
        append: jest.fn(() => mockd3Element),
        attr: jest.fn(() => mockd3Element),
        text: jest.fn(() => mockd3Element),
        data: jest.fn(() => mockd3Element),
        selectAll: jest.fn(() => mockd3Element),
        enter: jest.fn(() => mockd3Element),
        style: jest.fn(() => mockd3Element),
        on: jest.fn(() => mockd3Element),
    }

    const leafNode = {
        "classes": [
            {
                "count": 0,
                "name": "alt.atheism"
            },
            {
                "count": 502,
                "name": "comp.graphics"
            },
            {
                "count": 18,
                "name": "sci.med"
            },
            {
                "count": 7,
                "name": "soc.religion.christian"
            }
        ],

        "legend": [
            "alt.atheism",
            "comp.graphics",
            "sci.med",
            "soc.religion.christian"
        ],
        "count": 323,
        "id": "leaf19",
        "label": "Node 19",
        "leaf": true
    };

    const component = classificationLeaf(mockSelf)

    component(mockd3Element, {width: 75, height:75}, leafNode);

    expect(mockd3Element.data.mock.calls[0][0].length).toEqual(leafNode.classes.length);


  });


  test('test fancy regression leaf', () => {

    jest.useFakeTimers();

    const calledDataFuncs = {
      "cx": null,
      "cy": null,
      "class": null,
    };

    const d3NodeFuncs = {

    }

    var mockSelf = jest.fn()
    var mockd3Element = {
        append: jest.fn(() => mockd3Element),
        attr: jest.fn((k,v) => {
          if(["cx", "cy"].indexOf(k) >= 0){
            calledDataFuncs[k] = v;
          }else if (k === "class" && typeof v === "function") {
            calledDataFuncs[k] = v;
          }
          return mockd3Element
        }),
        text: jest.fn(() => mockd3Element),
        data: jest.fn(() => mockd3Element),
        select: jest.fn(() => mockd3Element),
        selectAll: jest.fn(() => mockd3Element),
        enter: jest.fn(() => mockd3Element),
        remove: jest.fn(() => mockd3Element),
        call: jest.fn((g) => {
          return mockd3Element
        }),
        style: jest.fn(() => mockd3Element),
        on: jest.fn(() => mockd3Element),
    }

    const leafNode = {
      label: "",
      shape: "leaf_regr",
      width: 75,
      height: 75,
      count: 323,
      countBounds: {min:35, max:765},
      mean: 23,
      std: 0.67,
      classes: null,
      legend: null,
      id: "leaf34"
    };

    const component = regressionLeaf(mockSelf)

    component(mockd3Element, {width: 75, height:75}, leafNode);

    const num_pts = d3.scaleLinear()
        .domain([leafNode.countBounds.min, leafNode.countBounds.max])
        .range([3, 500]);

    const data = d3.range(Math.round(num_pts(leafNode.count)))

    console.log(data.length, "length")



    //check functions are called same as data points list size
    expect(mockd3Element.data.mock.calls[0][0].length).toEqual(data.length);

    //check functions are called
    expect(calledDataFuncs.cx).not.toBeNull();
    expect(calledDataFuncs.cy).not.toBeNull();
    expect(calledDataFuncs.class).not.toBeNull();

    //check result types
    expect(typeof calledDataFuncs.cx({x:5})).toEqual("number");
    expect(typeof calledDataFuncs.cy({y:5})).toEqual("number");
    expect(typeof calledDataFuncs.class(10, 25)).toEqual("string");

    //check functions are called same as data points list size
    expect(typeof mockd3Element.call.mock.calls[1][0]).toEqual("function");
    expect(mockd3Element.call.mock.calls[1][0](mockd3Element)).toEqual(mockd3Element);
    expect(mockd3Element.call.mock.calls[2][0](mockd3Element)).toEqual(mockd3Element);


  });


  test('test fancy leaf charts', () => {

    jest.useFakeTimers();

    const component = shallow( <TreeLeafChart
        data = {tree_json}
        selectedLeaf = {"leaf4"} />)

    const chart = component.find('BarChart').at(0)
    chart.simulate('mouseover');


    const cells = chart.find('Cell')
    //check we have 18 leafs
    expect(cells.length).toBe(18);

  });


  test('test fancy class charts', () => {

    jest.useFakeTimers();

    const component = shallow( <TreeLeafChart
        data = {tree_json}
        selectedLeaf = {"leaf4"} />)

    const chart = component.find('BarChart').at(1)
    chart.simulate('mouseover');


    const classBars = chart.find('Bar')
    //check we have 4 classes
    expect(classBars.length).toBe(4);

  });

});
