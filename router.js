const express = require('express');
const router = express.Router();
const multer = require('multer');
const imageController = require('./imageController');

const storage = multer.diskStorage({
  destination: 'uploads/original',
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, and WEBP images are allowed'), false);
    }
    cb(null, true);
  }
});

// router.post('/upload', upload.single('image'), imageController.uploadImage);
router.post('/upload', (req, res, next) => {
  upload.single('image')(req, res, function (err) {
    if (err) return res.status(400).json({ error: err.message });
    imageController.uploadImage(req, res);
  });
});
router.get('/images', imageController.listImages);
router.delete('/images/:id', imageController.deleteImage);
router.post('/transform/:id', imageController.transformImage);
router.get('/versions/:id', imageController.getVersions);
router.post('/revert/:id/:versionId', imageController.revertVersion);
router.get('/metadata/:id', imageController.getMetadata);

module.exports = router;
