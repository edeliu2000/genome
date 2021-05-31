const axios = require('axios');

const { processSchedules } = require('../../api/processSchedules')

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
      data: [{
        deployment: "aaa",
        application: 'app',
        canonicalName: 'canonical',
        pipelineName: "pipe",
        id: "1234",
        versionName: "dag1.1.3.4",
        framework: "sklearn",
        schedule: "3h",
        nextRun: Date.now(),
        recipeRef: {
          ref: "[{}]",
          refType: "inline-pipeline"
        },
        context:{"__deploymentParameters__":{param1: 5}}
      }]
    }

    const dataPut = {
      data: {success: true}
    }

    const res = mockResponse()
    const mockNext = jest.fn();

    axios.post
       .mockImplementationOnce(() => Promise.resolve(data))
       .mockImplementationOnce(() => Promise.resolve(data));

    axios.put
      .mockImplementationOnce(() => Promise.resolve(dataPut))
      .mockImplementationOnce(() => Promise.resolve(dataPut));

    let testFunc = async () => {
      await processSchedules("http://modelstore", "http://compute", "shard-1")
    }

    testFunc().
    then(() => {
      expect(axios.post).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        nextRun: expect.any(Number),
        shard: "shard-1"
      }))
    })
    .then(() => {
      expect(axios.put).toHaveBeenCalledWith(expect.objectContaining({
        nextRun: expect.any(Number),
      }));
    })
    .then(() => {
      expect(axios.post).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        steps: expect.any(Array),
        deploymentParameters: expect.any(Object)
      }))
    })
  });

})
