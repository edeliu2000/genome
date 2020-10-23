const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const fs = require("fs");

const BUCKET_NAME = process.env.bucket || "";
const ID = process.env.id || "";
const SECRET = process.env.secret || "";

const s3Client = new AWS.S3({
    accessKeyId: ID,
    secretAccessKey: SECRET
});


AWS.Request.prototype.forwardToExpress = function forwardToExpress(res, next) {
  this.on('httpHeaders', function (code, headers) {
    if (code < 300) {
      res.set(_.pick(headers, 'content-type', 'content-length', 'last-modified'));
    }
  }).createReadStream()
    .on('error', function(err){
      console.log("stream error on S3 object: ", id, err)
      err.status = 500
      err.message= "error reading stream for object: " + id
      return next(err)
    })
    .pipe(res);
};

const isValidBlob = (blob) => {

  if(!blob.application || blob.application === "" ){
    return false;
  }
  return true;
}


const uploadBlob = (req, res, next) => {

  const id = uuidv4()
  const application = req.params.application
  const blobContentType = req.header("Content-Type")
  console.log("content-type blob:" + blobContentType)

  if(!BUCKET_NAME){

    var writeStream = fs.createWriteStream( './models/' + id);

    // This pipes the POST data to the file
    req.pipe(writeStream);
    console.log("started writing the stream id:" + id);

    req.on('end', function () {
      console.log("finished multipart upload");
      fs.writeFile('./models/' + id + '.meta', blobContentType, function(err) {
        // If an error occurred, show it and return
        if(err) return next(err);
        return res.status(201).json({id: id});
      });
    });

  } else {
    const params = {
      Bucket: BUCKET_NAME,
      Key: application + "/" + id,
      Body: req,
      ContentType: blobContentType
    };

    s3Client.upload(params, function(err, data) {

      if (err) {
        console.log(err);
        err.status = 500;
        err.message = 'error during upload of blob to S3 ' + application + ' : ';
        return next(err);
      }

      return res.status(201).json({id: id});
    });
  }

}



const getBlob = (req, res, next) => {

  const id = req.params.id
  const application = req.params.application

  if(!BUCKET_NAME){

    var readStream = fs.createReadStream('./models/' + id)
     .on('error', function(err){
       console.log("error on blob fetch:", id, JSON.stringify(err, null, 4));
       err.status = 500;
       err.message = 'error during storing of blob: ';
       return next(err)
     })
    // This pipes the POST data to the file
    // This will wait until we know the readable stream is actually valid before piping
    readStream.on('open', function () {
      fs.readFile('./models/' + id + '.meta', 'utf8', function(err, contents) {
        res.setHeader("Content-Type", contents)
        readStream.pipe(res);
      });
    });
  } else {
    const params = {
      Bucket: BUCKET_NAME,
      Key: application + "/" + id,
    };

    s3Client.getObject(params).forwardToExpress(res, next);
  }

}


module.exports = {
  blob: uploadBlob,
  get: getBlob,
}
