
const mock = {
  implementation : (o, callback) => {

    var length = o.body.query.bool.filter.length
    expect(o.body.query.bool.filter[length-1].range.created.lte).toEqual(expect.any(Number))
    expect(o.body.query.bool.filter[length-1].range.created.gte).toEqual(expect.any(Number))

    callback(null, {body:{
      hits:{
        hits:[{_id:"1234", _source:{}}]
      }
    }})
  },
  implementationDeployment : (o, callback) => {

    var length = o.body.query.bool.filter.length
    expect(length).toEqual(2)

    callback(null, {body:{
      hits:{
        hits:[{_id:"1234", _source:{}}]
      }
    }})
  },
  implementationPipeline : (o, callback) => {

    var length = o.body.query.bool.filter.length
    expect(length).toEqual(3)

    callback(null, {body:{
      hits:{
        hits:[{_id:"1234", _source:{}}]
      }
    }})
  },
  implementationError: (o, callback) => {
    console.log("yay 500!")
    callback({status: 500}, {})
  }
};


const { search } = require('../../api/search')


jest.mock( '@elastic/elasticsearch', () => ({
  Client: jest.fn(() => ({
    search: jest.fn(mock.implementation)
             .mockImplementationOnce(mock.implementation)
             .mockImplementationOnce(mock.implementationDeployment)
             .mockImplementationOnce(mock.implementationPipeline)
             .mockImplementationOnce(mock.implementationError)
  }))
}))


const mockRequest = (headers, body) => ({
  headers: headers,
  body: body,
  query: { artifactType: "model" },
  params: {
    pipelineId: "uuid-pipelineid-123"
  }
});

const mockRequestDeployment = (headers, body) => ({
  headers: headers,
  body: body,
  query: { artifactType: "deployment" },
  params: {
    pipelineId: "uuid-pipelineid-123"
  }
});

const mockRequestPipeline = (headers, body) => ({
  headers: headers,
  body: body,
  query: { artifactType: "pipeline" },
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



describe('test search model or pipeline or deployment', () => {

  test('test search model success', () => {

    const req = mockRequest(
      {},
      {
        application: "search"
      }
    );

    const res = mockResponse();
    const mockNext = jest.fn();


    search(req, res, mockNext)

    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
      {id: "1234"}
    ]));

  });

  test('test search deployment success', () => {

    const req = mockRequestDeployment(
      {},
      {
        application: "search",
        deployment: "aaa"
      }
    );

    const res = mockResponse();
    const mockNext = jest.fn();


    search(req, res, mockNext)

    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
      {id: "1234"}
    ]));

  });


  test('test search pipeline with deployment success', () => {

    const req = mockRequestPipeline(
      {},
      {
        application: "search",
        deployment: "aaa"
      }
    );

    const res = mockResponse();
    const mockNext = jest.fn();


    search(req, res, mockNext)

    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
      {id: "1234"}
    ]));

  });



  test('test pipeline creation 500', () => {


    const req = mockRequest(
      {},
      {
        application: "search"
      }
    );

    const res = mockResponse();
    const mockNext = jest.fn();


    search(req, res, mockNext)

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

    search(req, res, mockNext)

    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
      status: 400
    }));
  });




})
