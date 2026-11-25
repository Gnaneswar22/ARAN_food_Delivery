const { v2: cloudinary } = require('cloudinary');
const multer = require('multer');
const config = require('../config');
const { ApiError } = require('../utils');

const configured = !!(config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret);
if (configured) cloudinary.config({ cloud_name: config.cloudinary.cloudName, api_key: config.cloudinary.apiKey, api_secret: config.cloudinary.apiSecret, secure: true });

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => (ALLOWED.includes(file.mimetype) ? cb(null, true) : cb(new ApiError(415, 'Only JPEG, PNG, WebP or AVIF images up to 5MB are allowed'))),
});

// Verify magic bytes so a spoofed Content-Type cannot sneak a non-image through.
function looksLikeImage(buf) {
  const h = buf.subarray(0, 12);
  return (h[0] === 0xff && h[1] === 0xd8) || h.subarray(1, 4).toString() === 'PNG' || (h.subarray(0, 4).toString() === 'RIFF' && h.subarray(8, 12).toString() === 'WEBP') || h.subarray(4, 12).toString().startsWith('ftypavif');
}

function uploadImage(buffer, folder = 'aran') {
  if (!configured) throw new ApiError(503, 'Image uploads are not configured (Cloudinary credentials missing)');
  if (!looksLikeImage(buffer)) throw new ApiError(415, 'File is not a valid image');
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream({ folder, resource_type: 'image', quality: 'auto', fetch_format: 'auto' }, (err, r) => (err ? reject(new ApiError(502, 'Image upload failed')) : resolve({ url: r.secure_url, publicId: r.public_id })))
      .end(buffer);
  });
}

const destroyImage = (publicId) => (configured && publicId ? cloudinary.uploader.destroy(publicId).catch(() => {}) : Promise.resolve());

module.exports = { upload, uploadImage, destroyImage, configured };
