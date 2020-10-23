
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


const { updatePipelineNextRun } = require('../../api/create')


jest.mock( '@elastic/elasticsearch', () => ({
  Client: jest.fn(() => ({
    update: jest.fn(mock.implementation)
             .mockImplementationOnce(mock.implementation)
             .mockImplementationOnce(mock.implementationError)
  }))
}))


const mockRequest = (headers, body) => ({
  headers: headers,
  body: body,
  params: {
    pipelineId: "uuid-pipelineid-123"
  }
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



describe('create pipeline functions', () => {

  test('test pipelineRun status creation success', () => {

    const req = mockRequest(
      {},
      {
        nextRun: 12345
      }
    );

    const res = mockResponse();
    const mockNext = jest.fn();


    updatePipelineNextRun(req, res, mockNext)

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true
    }));

  });



  test('test pipeline creation 500', () => {


    const req = mockRequest(
      {},
      {
        nextRun: 12345
      }
    );

    const res = mockResponse();
    const mockNext = jest.fn();


    updatePipelineNextRun(req, res, mockNext)

    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
      status: 500
    }));

  });


  test('test pipeline creation 400', () => {

    const req = mockRequest(
      {},
      {}
    );

    const res = mockResponse();
    const mockNext = jest.fn();

    updatePipelineNextRun(req, res, mockNext)

    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
      status: 400
    }));
  });




})
