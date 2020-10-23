const axios = require('axios');

const { scheduleSequence } = require('../../api/sequence')

jest.mock('axios');




const mockRequest = (headers, body) => ({
  headers: headers,
  originalUrl: "http://url",
  body: body,
});

const mockResponse = () => {
  const res = {};
  // replace the following () => res
  // with your function stub/mock of choice
  // making sure they still return `res`
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};


describe('route functions', () => {

  test('test schedule success', async () => {

    const req = mockRequest({}, {
        application: 'app',
        canonicalName: 'canonical',
        pipelineName: "name",
        schedule: "6h",
        steps: [
          {
            "stepName": "step-1",
            "stepType": "model",
            "parameters":{
              "CA_TRAIN": true
            },
            "datasets":[],
            "image": "ensemble-training:local.3",
            "timeout": "360s",
            "retry": "3"
          }
        ]
      })

    const data = {
      data: {
        application: 'app',
        canonicalName: 'canonical',
        pipelineName: "pipe",
        id: "1234",
        versionName: "dag1.1.3.4",
        framework: "sklearn",
        recipeRef: {
          ref: "s3:automl/dag.1.3.3.jar",
          refType: "s3"
        }
      }
    }

    const res = mockResponse()
    const mockNext = jest.fn();

    axios.post
       .mockImplementationOnce(() => Promise.resolve(data));


    await scheduleSequence(req, res, mockNext)

    expect(axios.post).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      canonicalName: 'canonical'
    }))

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      id: "1234",
      nextRun: expect.any(Number)
    }));

  });


  test('test schedule 500 failure', async () => {

    const req = mockRequest({}, {
      application: 'app',
      canonicalName: 'canonical',
      pipelineName: "name",
      schedule: "6h",
      steps: [
        {
          "stepName": "step-1",
          "stepType": "model",
          "parameters":{
            "CA_TRAIN": true
          },
          "datasets":[],
          "image": "ensemble-training:local.3",
          "timeout": "360s",
          "retry": "3"
        }
      ]
    })

    const err = {
      data: {
        application: 'app',
        canonicalName: 'canonical',
        pipelineName: "pipe",
        id: "1234"
      }
    };

    const res = mockResponse()
    const mockNext = jest.fn();

    axios.post
       .mockImplementationOnce(() => Promise.reject(err));

    let testFunc = async () => {
      await scheduleSequence(req, res, mockNext)
    }

    testFunc()
    .then(() => {
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        status: 500
      }));
    })

  });



  test('test schedule 400 failure', async () => {

    const req = mockRequest({}, {})

    const data = {
      data: {}
    }

    const res = mockResponse()
    const mockNext = jest.fn();

    axios.post
       .mockImplementationOnce(() => Promise.resolve(data));


    await scheduleSequence(req, res, mockNext)

    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
      status: 400
    }));

  });



})
