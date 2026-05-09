const { PassThrough } = require('stream');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET
});

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/xml',
  'text/xml',
  'image/jpeg',
  'image/png'
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.has(file.mimetype)) {
      return cb(null, true);
    }

    return cb(new Error('Unsupported file type'));
  }
});

function uploadBufferToCloudinary(file) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'projects',
        resource_type: 'auto',
        use_filename: true,
        unique_filename: true
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        return resolve(result);
      }
    );

    const bufferStream = new PassThrough();
    bufferStream.end(file.buffer);
    bufferStream.pipe(uploadStream);
  });
}

module.exports = {
  single(fieldName) {
    const multerMiddleware = upload.single(fieldName);

    return (req, res, next) => {
      multerMiddleware(req, res, async error => {
        if (error) {
          return next(error);
        }

        if (!req.file) {
          return next();
        }

        try {
          const result = await uploadBufferToCloudinary(req.file);

          req.file.path = result.secure_url;
          req.file.filename = result.public_id;
          req.file.cloudinary = result;

          return next();
        } catch (uploadError) {
          return next(uploadError);
        }
      });
    };
  }
};
