const React = require('react');
const ReactDOM = require("react-dom");
const pipeline_json = require('./fixtures/pipeline_viz.json')
import * as d3 from 'd3'

import Renderer from 'react-test-renderer';

import { configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16.3';

configure({ adapter: new Adapter() });

import {shallow, mount} from 'enzyme';

import PipelineVisualizer from '../src/visualizers/pipeline';

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve(pipeline_json),
  })
);

beforeEach(() => {
  fetch.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});


describe("Pipeline Visualizer Module", () => {
  test('test fancy pipeline', () => {

    jest.useFakeTimers();

    var component = shallow( <PipelineVisualizer
      genomePipeline={pipeline_json}
      width={"100%"}
      height={"200"}
    />)

    var pipeline = component.find('#pipelineGraphVisualization')
    pipeline.simulate("click")

    expect(component.state('selectedStep')).not.toBeNull();
    expect(component.state('displayStepInfo')).toEqual("none");

    var selectedStep = {
      stepName: "step-1",
      stepParameters: {papa: 5},
      stepDatasets: [{ref:"dataset/5", refType:"lake"}],
      schedule: "",
      nextRun: 0,
      image: "ecr://image-docker",
      timeout: "",
      retry: 1

    };

    component.setState({'selectedStep': selectedStep, displayStepInfo:"block"}, ()=>{
      expect(component.find('#listOfNodeCard').children().length).toEqual(5)
    });

    //with schedule fitting
    selectedStep.schedule = "6h";
    component.setState({'selectedStep': selectedStep, displayStepInfo:"block"}, ()=>{
      expect(component.find('#listOfNodeCard').children().length).toEqual(6);
    });


    const button = component.find('#closeCardButton');
    button.simulate("click");

    expect(component.state('displayStepInfo')).toEqual("none");





  });

});
