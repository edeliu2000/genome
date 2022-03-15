const React = require('react');
const ReactDOM = require("react-dom");
//const jsdom = require("jsdom");

const model_evaluations_json = require('./fixtures/evaluations.json')
import * as d3 from 'd3'
import { scaleLinear } from "d3-scale";


import { renderer } from 'react-test-renderer';


import { configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16.3';

configure({ adapter: new Adapter() });

import {shallow, mount} from 'enzyme';

import {ModelValidation} from '../src/model-validation';


global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve(model_evaluations_json),
  })
);

beforeEach(() => {
  fetch.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});


describe("Model Validation Module", () => {

  test('validation with remote validation status', (done) => {

    //jest.useFakeTimers();

    const mockErrorCallback = jest.fn();


    const component = mount( <ModelValidation
      canonicalName={ "/search/canonical" }
      artifactType="evaluationRun"
      validationTarget={{
        ref:"id-123",
        refType: "model" }}
      application={ "search" }
      errorCallBack={mockErrorCallback}
    />);

    const numSamples = model_evaluations_json.length;


    const compInstance = component.instance();

    compInstance._loadValidations(() => {

      component.setProps({})
      console.log("running async test");

      expect(component.state('validations').length).toEqual(numSamples);
      //expect(component.find('ExpansionPanel').length).toEqual(numSamples);

      done();

    });


  });

});
