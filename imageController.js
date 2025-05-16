const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

const metadataPath = path.join(__dirname, './data/metadata.json');

const loadMetadata = () => JSON.parse(fs.readFileSync(metadataPath));
const saveMetadata = (data) => fs.writeFileSync(metadataPath, JSON.stringify(data, null, 2));

exports.uploadImage = (req, res) => {
  const { filename } = req.file;
  const metadata = loadMetadata();
  metadata[filename] = {
    path: filename,
    versions: []
  };
  saveMetadata(metadata);
  res.json({ filename });
};

exports.listImages = (req, res) => {
  const dirPath = path.join(__dirname, './uploads/original');
  fs.readdir(dirPath, (err, files) => {
    if (err) {
      console.error('Failed to read image directory', err);
      return res.status(500).send('Error reading image directory');
    }

    const images = files.map(filename => ({
      id: filename,
      url: filename
    }));

    res.json(images);
  });
};

exports.deleteImage = (req, res) => {
  const { id } = req.params;
  const metadata = loadMetadata();
  if (!metadata[id]) return res.status(404).json({ error: 'Image not found' });

  fs.unlinkSync(path.join('uploads/original', id));
  metadata[id].versions.forEach(v => {
    fs.unlinkSync(path.join('uploads/versions', id, v.filename));
  });
  delete metadata[id];
  saveMetadata(metadata);
  res.json({ message: 'Image deleted' });
};

exports.transformImage = async (req, res) => {
  const filename = req.params.id;
  const inputPath = path.join(__dirname, './uploads/original', filename);
  const { resize, rotate, grayscale, flip, format  } = req.body;
  let finalExt;

  if (rotate && typeof rotate !== 'number') {
    return res.status(400).json({ error: 'rotate must be a number' });
  }

  if (resize && (isNaN(resize.width) || isNaN(resize.height))) {
    return res.status(400).json({ error: 'resize must include numeric width and height' });
  }

  if (flip && !['horizontal', 'vertical'].includes(flip)) {
    return res.status(400).json({ error: 'flip must be "horizontal" or "vertical"' });
  }

  if (!fs.existsSync(inputPath)) {
    return res.status(404).json({ error: 'Image not found' });
  }

  try {
    let image = sharp(inputPath);

    if (resize && (resize.width || resize.height)) {
      image = image.resize(resize.width || null, resize.height || null);
    }

    if (rotate) {
      image = image.rotate(rotate); // degrees
    }

    if (grayscale) {
      image = image.grayscale();
    }

    if (flip === 'horizontal') {
      image = image.flip(); // vertical axis
    } else if (flip === 'vertical') {
      image = image.flop(); // horizontal axis
    }

    if (format && ['jpeg', 'png', 'webp'].includes(format)) {
      image = image.toFormat(format);
      finalExt = `.${format}`;
    }

    // Create version path
    const versionId = uuidv4();
    const ext = finalExt || path.extname(filename);
    const versionDir = path.join(__dirname, './uploads/versions', filename);
    if (!fs.existsSync(versionDir)) {
      fs.mkdirSync(versionDir, { recursive: true });
    }

    const outputPath = path.join(versionDir, `${versionId}${ext}`);
    await image.toFile(outputPath);

    // Update metadata
    const metadata = loadMetadata();
    if (!metadata[filename]) {
      metadata[filename].versions = [];
    }
    metadata[filename].versions.push({
      versionId,
      path: `/uploads/versions/${filename}/${versionId}${ext}`
    });
    saveMetadata(metadata);

    res.status(200).json({
      message: 'Transformation applied',
      versionId,
      url: `/uploads/versions/${filename}/${versionId}${ext}`
    });
  } catch (err) {
    console.error('Error during transformation:', err);
    res.status(500).json({ error: 'Failed to transform image' });
  }
};

exports.getVersions = (req, res) => {
  const { id } = req.params;
  const metadata = loadMetadata();
  if (!metadata[id]) return res.status(404).json({ error: 'Image not found' });
  res.json(metadata[id].versions);
};

exports.revertVersion = (req, res) => {
  const { id, versionId } = req.params;
  const metadata = loadMetadata();

  if (!metadata[id]) {
    return res.status(404).json({ error: 'No version history found' });
  }

  // Check if the version exists
  const index = metadata[id].versions.findIndex(v => v.versionId === versionId);
  if (index === -1) {
    return res.status(404).json({ error: 'Version not found' });
  }

  // Keep versions up to and including the selected one
  const remainingVersions = metadata[id].versions.slice(0, index + 1);

  // Physically delete all later version files
  const removedVersions = metadata[id].versions.slice(index + 1);
  removedVersions.forEach(v => {
    const versionPath = path.join(__dirname, '.', v.path);
    if (fs.existsSync(versionPath)) {
      fs.unlinkSync(versionPath);
    }
  });

  // Update metadata
  metadata[id].versions = remainingVersions;
  saveMetadata(metadata);

  res.status(200).json({ message: 'Reverted to selected version and trimmed history' });
};

exports.getMetadata = async (req, res) => {
  const { id } = req.params;

  try {
    let filePath;
    filePath = path.join(__dirname, './uploads/original', id);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const info = await sharp(filePath).metadata();
    res.json(info);
  } catch (err) {
    console.error('Metadata error:', err);
    res.status(500).json({ error: 'Failed to extract metadata' });
  }
};


