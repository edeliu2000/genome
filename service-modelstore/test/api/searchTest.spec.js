
const mock = {
  implementation : (o, callback) => {
    console.log("noooo sucess")

    var length = o.body.query.bool.filter.length
    expect(o.body.query.bool.filter[length-1].range.created.lte).toEqual(expect.any(Number))
    expect(o.body.query.bool.filter[length-1].range.created.gte).toEqual(expect.any(Number))

    callback(null, {body:{
      hits:{
        hits:[{_id:"1234", _source:{}}]
      }
    }})
  },
  implementationByKeyword : (o, callback) => {
    console.log("search impl success keyword")


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


const { search, searchByKeywords } = require('../../api/searchValidation')


jest.mock( '@elastic/elasticsearch', () => ({
  Client: jest.fn(() => ({
    search: jest.fn(mock.implementation)
             .mockImplementationOnce(mock.implementation)
             .mockImplementationOnce(mock.implementation)
             .mockImplementationOnce(mock.implementationByKeyword)
             .mockImplementationOnce(mock.implementationByKeyword)
             .mockImplementationOnce(mock.implementationError)
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



describe('create validation functions', () => {

  test('test testRun search success', () => {

    const req = mockRequest(
      {},
      {
        artifactType: "testRun",
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


  test('search test (not testRun) success', () => {

    const req = mockRequest(
      {},
      {
        artifactType: "test",
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


  test('test testRun search keywords success', () => {

    const req = mockRequest(
      {},
      {
        artifactType: "testRun",
        query: "yada",
        application: "search"
      }
    );

    const res = mockResponse();
    const mockNext = jest.fn();


    searchByKeywords(req, res, mockNext)

    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
      {id: "1234"}
    ]));

  });


  test('search test (not testRun) keywords success', () => {

    const req = mockRequest(
      {},
      {
        artifactType: "test",
        query: "yada",
        application: "search"
      }
    );

    const res = mockResponse();
    const mockNext = jest.fn();


    searchByKeywords(req, res, mockNext)

    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
      {id: "1234"}
    ]));

  });


  test('test pipeline creation 500', () => {


    const req = mockRequest(
      {},
      {
        artifactType: "testRun",
        query: "yada",
        application: "search"
      }
    );

    const res = mockResponse();
    const mockNext = jest.fn();


    searchByKeywords(req, res, mockNext)

    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
      status: 500
    }));

  });


  test('test pipeline creation 500', () => {


    const req = mockRequest(
      {},
      {
        artifactType: "testRun",
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


  test('test pipeline creation 400', () => {

    const req = mockRequest(
      {},
      {}
    );

    const res = mockResponse();
    const mockNext = jest.fn();

    searchByKeywords(req, res, mockNext)

    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
      status: 400
    }));
  });




})
