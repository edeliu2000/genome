
const mock = {
  implementation : (o, callback) => {
    console.log("noooo sucess")
    callback(null, {body:{_id:"1234"}})
  },
  implementationError: (o, callback) => {
    console.log("yay 500!")
    callback({status: 500}, {})
  }
};


const { createModel } = require('../../api/create')


jest.mock( '@elastic/elasticsearch', () => ({
  Client: jest.fn(() => ({
    index: jest.fn(mock.implementation)
             .mockImplementationOnce(mock.implementation)
             .mockImplementationOnce(mock.implementationError)
  }))
}))


const mockRequest = (headers, body) => ({
  headers: headers,
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


describe('max function', () => {
  it('max of two integers', () => {
    expect(Math.max(1,3)).toEqual(3);
  });
});



describe('create model functions', () => {

  test('test model creation success', () => {


    const req = mockRequest(
      {},
      {
        application: 'app',
        canonicalName: 'name',
        pipelineName: "pipe",
        pipelineStage: "stage",
        pipelineRunId: "run-id",
        versionName: "xgboost.1.3.4",
        framework: "xgboost",
        code: {
          ref: "s3:automl/ai.1.3.3.jar",
          refType: "s3"
        }
      }
    );

    const res = mockResponse();
    const mockNext = jest.fn();


    createModel(req, res, mockNext)

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.any(String)
    }));

  });


  test('test model creation 400', () => {

    const req = mockRequest(
      {},
      {
        application: 'app',
        canonicalName: 'name'
      }
    );

    const res = mockResponse();
    const mockNext = jest.fn();

    createModel(req, res, mockNext)

    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
      status: 400
    }));
  });


  test('test model creation 500', () => {

    const req = mockRequest(
      {},
      {
        application: 'app',
        canonicalName: 'name',
        pipelineName: "pipe",
        pipelineStage: "stage",
        pipelineRunId: "run-id",
        versionName: "xgboost.1.3.4",
        framework: "xgboost",
        code: {
          ref: "s3:automl/ai.1.3.3.jar",
          refType: "s3"
        }
      }
    );

    const res = mockResponse();
    const mockNext = jest.fn();

    createModel(req, res, mockNext)

    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
      status: 500
    }));
  });


})
