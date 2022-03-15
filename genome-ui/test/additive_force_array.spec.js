const React = require('react');
const ReactDOM = require("react-dom");
//const jsdom = require("jsdom");

const shapley_explanations_json = require('./fixtures/shapley_explanations.json')
import * as d3 from 'd3'
import { scaleLinear } from "d3-scale";


import { renderer } from 'react-test-renderer';


import { configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16.3';

configure({ adapter: new Adapter() });

import {shallow, mount} from 'enzyme';

import AdditiveRemoteVisualizer from '../src/visualizers/additive-remote';
import AdditiveForceArrayVisualizer from '../src/visualizers/additive-force-array';

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve(shapley_explanations_json),
  })
);

beforeEach(() => {
  fetch.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

const singleExplanation = {
    "class": "",
    "expected": [
        2.0687099053657945
    ],
    "explainer": null,
    "image": "",
    "metrics": null,
    "number_labels": 1,
    "score": 0,
    "shapley": [
        [
            2.2778510473980127,
            -0.013823104971881963,
            -0.010883161177668115,
            0.002836589502690395,
            -0.5841349727347054,
            -0.09216248452939761,
            0.0065976083430462126,
            -0.07924940355782666,
            0,
            0,
            0,
            0
        ]
    ],
    "textExplanation": null
};

const singleInputToExplain = [5.000e+01, 6.000e+00, 1.300e+01, 2.000e+00, 4.000e+00, 4.000e+00, 4.000e+00, 1.000e+00, 0.000e+00, 0.000e+00, 1.300e+01, 3.900e+01];





describe("Additive Explainer Visualization Module", () => {

  test('additive explainer with batch array', () => {

    jest.useFakeTimers();

    const mockClick = jest.fn();


    var shapley = shapley_explanations_json.shap_values;
    var base = shapley_explanations_json.expected_value instanceof Array ? shapley_explanations_json.expected_value[0] : shapley_explanations_json.expected_value;

    var featureValues = shapley_explanations_json.feature_values;
    var num_labels = shapley_explanations_json.number_labels;
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

    const component = mount( <AdditiveForceArrayVisualizer
      onClick={mockClick}
      explanations={explanations}
      expected={base}
      featureNames={featureNames}
      baseValue={base}
      numClusters={5}
      outNames={[""]}
      link="identity"
    />, { disableLifecycleMethods: true });

    const numSamples = shapley_explanations_json.feature_values.length;

    jest.advanceTimersByTime(1000);

    const testInstance = component.instance();

    expect(testInstance.wrapper).not.toBeNull();
    expect(testInstance.svg).not.toBeNull();


    testInstance.draw();


    testInstance.handleXLabelSelection({target:{value:"f{1}"}});
    testInstance.wrapper.select('.additive-force-array-ylabel').node().value = 'f{1}';
    testInstance.wrapper.select(".additive-force-array-ylabel").node().onchange();


    var ev = document.createEvent("SVGEvents");
    ev.initEvent("click",true,true);
    testInstance.yaxisElement.node().dispatchEvent(ev)
    expect(mockClick).toHaveBeenCalledTimes(1);


    testInstance.mouseMoved(246);
    expect(testInstance.hoverGroup2.attr('display')).toEqual("");


    testInstance.mouseOut();
    expect(testInstance.hoverGroup2.attr('display')).toEqual("none");


    testInstance.internalDraw(true);

    const renderedComponent = component.render()



  });

});
