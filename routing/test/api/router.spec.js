const axios = require('axios');

const { route } = require('../../api/router')

jest.mock('axios');




const mockRequest = (headers, path, body) => ({
  headers: headers,
  originalUrl: "http://url",
  baseUrl: "",
  path: path,
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

  test('test route scoring success', async () => {

    const req = mockRequest({}, "/v1.0/genome/explain", {
        application: 'app',
        canonicalName: 'canonical'
      })

    const data = {
      data: [{
        application: 'app',
        canonicalName: 'canonical',
        pipelineName: "pipe",
        versionName: "dag1.1.3.4",
        framework: "sklearn",
        recipeRef: {
          ref: "s3:automl/dag.1.3.3.jar",
          refType: "s3"
        }
      }]
    }

    const res = mockResponse()
    const mockNext = jest.fn();

    axios.post
       .mockImplementationOnce(() => Promise.resolve(data))
       .mockImplementationOnce(() => Promise.resolve({
         data: {
           expected: 1.2, shapley:[[1,2,3,4,5]]
         }
       }));


    let testFunc = async () => {
      await route(req, res, mockNext)
    }

    testFunc()
    .then(() => {
      expect(axios.post).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        canonicalName: 'canonical'
      }))
    })
    .then(() => {
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        expected: expect.any(Number)
      }));
    })

  });



  test('test route visualizer success', async () => {

    const req = mockRequest({}, "/v1.0/genome/visualization", {
        application: 'app',
        canonicalName: 'canonical'
      })

    const data = {
      data: [{
        application: 'app',
        canonicalName: 'canonical',
        pipelineName: "pipe",
        versionName: "dag1.1.3.4",
        framework: "sklearn",
        recipeRef: {
          ref: "s3:automl/dag.1.3.3.jar",
          refType: "s3"
        }
      }]
    }

    const res = mockResponse()
    const mockNext = jest.fn();

    axios.post
       .mockImplementationOnce(() => Promise.resolve(data))
       .mockImplementationOnce(() => Promise.resolve({
         data: "<svg>doc</svg>"
       }));


    let testFunc = async () => {
      await route(req, res, mockNext)
    }

    testFunc()
    .then(() => {
      expect(axios.post).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        canonicalName: 'canonical'
      }))
    })
    .then(() => {
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(expect.any(String));
    })

  });


})
