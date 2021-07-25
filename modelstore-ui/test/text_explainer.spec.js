const React = require('react');
const ReactDOM = require("react-dom");
const text_explanations_json = require('./fixtures/text_explanations.json')
import * as d3 from 'd3'

import Renderer from 'react-test-renderer';

import { configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16.3';

configure({ adapter: new Adapter() });

import {shallow, mount} from 'enzyme';

import TextExplainerVisualizer from '../src/visualizers/text-explainer';

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve(text_explanations_json),
  })
);

beforeEach(() => {
  fetch.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

const textDoc = 'The untempered inflammation can also overstimulate the immune system, and though doctors initially shied away from using steroids to globally suppress the immune system, a recent clinical trial has found that at least one steroid, dexamethasone, reduced deaths in ventilated patients by one-third. Randomized clinical trials are underway to target specific components of thromboinflammation and the immune system, such as interleukin-6 signaling.  "Scientists all over the world are working at an unprecedented rate towards understanding how this virus specifically hijacks the normally protective biological mechanisms. We hope that this would help in the development of more effective, precise, and safer treatments for COVID-19 in the near future," says Sehgal.';

describe("Text Explainer Visualization Module", () => {
  test('test explainer has max score selected', () => {

    jest.useFakeTimers();

    var component = shallow( <TextExplainerVisualizer
      targetClasses={text_explanations_json.textExplanation.targets}
      doc={textDoc}
      metrics={text_explanations_json.metrics}
      explainer={text_explanations_json.explainer}
      key={JSON.stringify(text_explanations_json.metrics)}
    />)

    const lastIndex = text_explanations_json.textExplanation.targets.length - 1;

    const menuTargetItem = component.find('#targetClsComponent-' + lastIndex);
    const weightedSpans = component.find('WeightedSpan');
    const classSelected = component.find('#classLabelSelect');

    console.log("total weighted spans", weightedSpans.length);
    console.log("Max scored class:", classSelected.prop('value'));
    const maxScoredCLass = 'sci.med';

    expect(menuTargetItem).not.toBeNull();

    expect(weightedSpans.length).toEqual(101);
    expect(classSelected.prop('value')).toEqual(maxScoredCLass);



  });

});
