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
import AdditiveForceVisualizer from '../src/visualizers/additive-force';

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

  test('additive explainer with remote call', (done) => {

    jest.useFakeTimers();

    const mockError = jest.fn();

    const component = shallow( <AdditiveRemoteVisualizer
      handleError={mockError}
      canonicalName={"/search/canonicalName"}
    />, { disableLifecycleMethods: true });

    const numSamples = shapley_explanations_json.feature_values.length;


    component.instance().initialBatchExplain(() => {

      component.setProps({});

      const menuSamplesItem = component.find('#itemSamples-3');
      console.log("itemSamples: ", menuSamplesItem.props())

      expect(menuSamplesItem).not.toBeNull();
      expect(menuSamplesItem.prop('value')).toEqual(numSamples);

      console.log("numSamples vs rendered: ", menuSamplesItem.prop('value'), numSamples)

      expect(component.state('explanations')).not.toBeNull();
      expect(component.state('explanations').length).toEqual(numSamples);

      console.log("explanations vs rendered: ", menuSamplesItem.prop('value'), numSamples)

      done();
    });


  });



  test('additive explainer onChange', () => {

    jest.useFakeTimers();

    const mockError = jest.fn();


    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(singleExplanation),
      })
    );

    const component = shallow( <AdditiveRemoteVisualizer
      handleError={mockError}
      canonicalName={"/search/canonicalName"}
    />, { disableLifecycleMethods: true });

    component.setState({'entryToExplain': singleInputToExplain})



    component.instance()._onChange({target:{id:'entryToExplain', value:"abc"}});

    expect(component.state('entryToExplain')).toEqual('abc')




  });



  test('additive explainer with single explainer remote call', (done) => {

    jest.useFakeTimers();

    const mockError = jest.fn();


    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(singleExplanation),
      })
    );

    const component = shallow( <AdditiveRemoteVisualizer
      handleError={mockError}
      canonicalName={"/search/canonicalName"}
    />, { disableLifecycleMethods: true });

    component.setState({'entryToExplain': singleInputToExplain})



    component.instance().onExplainClick(() => {

      component.setProps({});

      console.log("entry field:",component.state('entryToExplain'))

      expect(component.state('force')).not.toBeNull();
      expect(component.state('force')).toEqual(true);

      done();

    });


  });



  test('additive explainer with single explainer chart', () => {

    jest.useFakeTimers();

    const mockError = jest.fn();


    const component = mount( <AdditiveForceVisualizer
      forceActive={true}
      baseValue={2.0687099053657945}
      outNames={["score"]}
      link={"identity"}
      features={{
        "1":{value:0, effect:2.2778510473980127}, "2":{value:0, effect:-0.013823104971881963}, "3":{value:0, effect:-0.010883161177668115},
        "4":{value:0, effect: 0.002836589502690395}, "5":{value:0, effect: -0.5841349727347054},
        "6":{value:0, effect:-0.09216248452939761}, "7":{value:0, effect: -0.07924940355782666},
        "8":{value:0, effect: 0}, "9":{value:0, effect: 0},
        "10":{value:0, effect: 0}, "11":{value:0, effect: 0}, "12":{value:0, effect: 0}
      }}
      featureNames={{
        "1":"f{1}", "2":"f{2}", "3":"f{3}", "4":"f{4}", "5":"f{5}",
        "6":"f{6}", "7":"f{7}", "8":"f{8}", "9":"f{9}", "10":"f{10}",
        "11":"f{11}", "12": "f{12}"
      }}

      test={true}
    />);

    jest.advanceTimersByTime(1000);

    const testInstance = component.instance();

    expect(testInstance.svg).not.toBeNull();


    testInstance.draw();

    const renderedComponent = component.render()

    expect(renderedComponent.find('.force-bar-blocks')).toHaveLength(12);

    expect(renderedComponent.find('.force-bar-labels')).toHaveLength(3);
    //expect(component.render().find('.force-bar-blocks')).toHaveLength(12);


  });




  test('additive explainer with single explainer chart', () => {

    jest.useFakeTimers();

    const mockError = jest.fn();


    const component = mount( <AdditiveForceVisualizer
      forceActive={true}
      baseValue={2.0687099053657945}
      outNames={["score"]}
      link={"identity"}
      features={{
        "1":{value:0, effect:2.2778510473980127}, "2":{value:0, effect:-0.013823104971881963}, "3":{value:0, effect:-0.010883161177668115},
        "4":{value:0, effect: 0.002836589502690395}, "5":{value:0, effect: -0.5841349727347054},
        "6":{value:0, effect:-0.09216248452939761}, "7":{value:0, effect: -0.07924940355782666},
        "8":{value:0, effect: 0}, "9":{value:0, effect: 0},
        "10":{value:0, effect: 0}, "11":{value:0, effect: 0}, "12":{value:0, effect: 0}
      }}
      featureNames={{
        "1":"f{1}", "2":"f{2}", "3":"f{3}", "4":"f{4}", "5":"f{5}",
        "6":"f{6}", "7":"f{7}", "8":"f{8}", "9":"f{9}", "10":"f{10}",
        "11":"f{11}", "12": "f{12}"
      }}

      test={true}
    />);

    jest.advanceTimersByTime(1000);

    const testInstance = component.instance();
    expect(testInstance.svg).not.toBeNull();


    expect(testInstance._getEffectLabel({effect: 1.23, name:"f{1}"})).toEqual("f{1} (effect: 1.23)")
    expect(testInstance._getEffectLabel({effect: "1.23", name:"f{1}"})).toEqual("f{1} (effect: 1.23)")
    expect(testInstance._getEffectLabel({name:"f{1}"})).toEqual("f{1}")


    let scale = scaleLinear()
      .domain([0, 10])
      .range([0, 750]);

    let totalEffect = 2.83;
    let topOffset = 50;
    let scaleOffset = 750 / 2 - scale(0.82);


    const onOver = testInstance._onMouseOver(totalEffect, scaleOffset, topOffset, scale);
    onOver({effect: 1.23, x:10});
    expect(testInstance.hoverLabel.attr('y')).toEqual("50.5");
    expect(testInstance.hoverLabel.attr('x')).toEqual("1109.625");

    const fill = testInstance.hoverLabel.attr('fill').replace("rgb(", "")
    expect(Math.round(fill.split(",")[0])).toEqual(Math.round(d3.rgb(testInstance.colors[0]).r));
    expect(Math.round(fill.split(",")[1])).toEqual(Math.round(d3.rgb(testInstance.colors[0]).g));

  });




  test('additive explainer with error on call', (done) => {

    jest.useFakeTimers();

    const mockError = jest.fn();


    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({error:{message:"yada"}}),
      })
    );

    const component = shallow( <AdditiveRemoteVisualizer
      handleError={mockError}
      canonicalName={"/search/canonicalName"}
    />, { disableLifecycleMethods: true });

    component.instance().onExplainClick(() => {
      expect(mockError).toHaveBeenCalledTimes(1);
      done();

    });


  });



  test('additive explainer with error on batch call', (done) => {

    jest.useFakeTimers();

    const mockError = jest.fn();


    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({error:{message:"yada"}}),
      })
    );

    const component = shallow( <AdditiveRemoteVisualizer
      handleError={mockError}
      canonicalName={"/search/canonicalName"}
    />, { disableLifecycleMethods: true });

    component.instance().initialBatchExplain(() => {
      expect(mockError).toHaveBeenCalledTimes(1);
      done();

    });


  });



});
