const express = require('express');
// const multer = require('multer');
const fs = require('fs');
const path = require('path');
const imageRoutes = require('./router.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api', imageRoutes);

if (!fs.existsSync('uploads/original')) fs.mkdirSync('uploads/original', { recursive: true });
if (!fs.existsSync('uploads/versions')) fs.mkdirSync('uploads/versions', { recursive: true });
if (!fs.existsSync('data')) fs.mkdirSync('data');
if (!fs.existsSync('data/metadata.json')) fs.writeFileSync('data/metadata.json', '{}');

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
