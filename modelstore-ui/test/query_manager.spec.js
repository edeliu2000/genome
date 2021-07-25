const React = require('react');
const ReactDOM = require("react-dom");

import Renderer from 'react-test-renderer';

import { configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16.3';

configure({ adapter: new Adapter() });

import {shallow, mount} from 'enzyme';

const _fetchData = require("../src/elastic-queries")._fetchData;
const _loginQuery = require("../src/elastic-queries")._loginQuery;
const _createESQuery = require("../src/elastic-queries")._createESQuery;
const _softDeleteESQuery = require("../src/elastic-queries")._softDeleteESQuery

const validResp = [{empty:"empty"}];

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve(validResp),
  })
);

beforeEach(() => {
  fetch.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("Query Module", () => {
  test('test fetchData', (done) => {

    jest.useFakeTimers();


    const query = {some: "things"};
    _fetchData(query, (err, response) => {

      expect(response).toEqual(validResp);

      done();

    }, "/path/soft", "access")

  });

  test('test fetchData error', (done) => {

    jest.useFakeTimers();

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({error:{message:"message"}}),
      })
    );


    const query = {some: "things"};
    _fetchData(query, (err, response) => {

      expect(err.status).toEqual(500);
      expect(err.message).toEqual("message");

      done();

    }, "/path/soft", "access")

  });



  test('test _loginQuery', () => {

    jest.useFakeTimers();



    const query = _loginQuery("user", "pass", "app");
    expect(query.user).toEqual("user");
    expect(query.pass).toEqual("pass");
    expect(query.application).toEqual("app");


  });


  test('test _createESQuery', () => {

    jest.useFakeTimers();

    const query = _createESQuery("pipe");
    expect(query.application).toEqual("search");
    expect(query.pipelineName).toEqual("pipe");

    const querySlice = _createESQuery("pipe/path");
    expect(querySlice.pipelineName).toEqual(null);

  });



  test('test _softDeleteESQuery', () => {

    jest.useFakeTimers();

    const deleteQuery = _softDeleteESQuery([[9,10], [9,10]]);
    expect(deleteQuery.query.bool.must[1].bool.should.length).toEqual(2);
    expect(deleteQuery.query.bool.must[2].bool.should.length).toEqual(2);

    expect(deleteQuery.query.bool.must[1].bool.should[0].term.mid).toEqual(9);
    expect(deleteQuery.query.bool.must[2].bool.should[0].match.schema).toEqual(10);

  });








});
