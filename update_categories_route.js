const fs = require('fs');

let content = fs.readFileSync('routes/admin/categories.js', 'utf8');

const importsToAdd = `
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fsModule = require('fs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = process.env.NODE_ENV === 'production' ? '/tmp' : './public/uploads/categories';
    if (process.env.NODE_ENV !== 'production' && !fsModule.existsSync(dir)) {
      fsModule.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname).toLowerCase());
  }
});

const ALLOWED_IMAGE_EXT = /\\.(jpe?g|png|gif|webp|svg|bmp|tiff?|ico|avif|heic|heif)$/i;
const ALLOWED_IMAGE_MIME = /^image\\//i;

const upload = multer({
  storage: storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const extOk = ALLOWED_IMAGE_EXT.test(path.extname(file.originalname));
    const mimeOk = ALLOWED_IMAGE_MIME.test(file.mimetype);
    if (extOk || mimeOk) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed.'));
  }
});

function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    req.flash('error', \`Upload failed: \${err.message}\`);
    return res.redirect(req.headers.referer || '/admin/categories');
  }
  if (err) {
    req.flash('error', err.message || 'Invalid image upload.');
    return res.redirect(req.headers.referer || '/admin/categories');
  }
  next();
}

async function optimizeUploadedImage(file) {
  const ext = path.extname(file.filename).toLowerCase();
  if (ext === '.svg' || ext === '.gif') {
    return \`/uploads/categories/\${file.filename}\`;
  }
  const optimizedName = file.filename.slice(0, -ext.length) + '.webp';
  const optimizedPath = path.join(path.dirname(file.path), optimizedName);
  await sharp(file.path)
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(optimizedPath);
  fsModule.unlinkSync(file.path);
  return \`/uploads/categories/\${optimizedName}\`;
}
`;

// Insert the imports after const { escapeRegex } = ...
content = content.replace(/(const { escapeRegex } = require\('\.\.\/\.\.\/utils\/validation'\);)/, `$1\n${importsToAdd}`);

// Modify CREATE route
content = content.replace(/router\.post\('\/', async \(req, res\) => \{/, `router.post('/', upload.single('image'), handleUploadError, async (req, res) => {`);

// Within CREATE route, add image processing
const createBody = `
    let imagePath = '';
    if (req.file && req.body.type === 'service') {
      try {
        imagePath = await optimizeUploadedImage(req.file);
      } catch (e) {
        console.error('Image optimization failed:', e);
      }
    }
`;
content = content.replace(/(const features = \(req\.body\.features \|\| ''\)\s*\n\s*\.split\('\\n'\)\s*\n\s*\.map\(f => f\.trim\(\)\)\s*\n\s*\.filter\(f => f\.length > 0\);)/, `$1\n${createBody}`);

// Update Category.create call
content = content.replace(/await Category\.create\(\{([\s\S]*?)\}\);/, `await Category.create({$1, image: imagePath});`);


// Modify EDIT route
content = content.replace(/router\.post\('\/edit\/:id', async \(req, res\) => \{/, `router.post('/edit/:id', upload.single('image'), handleUploadError, async (req, res) => {`);

// Within EDIT route, add image processing
const editBody = `
    let imagePath = category.image;
    if (req.file && req.body.type === 'service') {
      try {
        imagePath = await optimizeUploadedImage(req.file);
      } catch (e) {
        console.error('Image optimization failed:', e);
      }
    }
`;
content = content.replace(/(const features = \(req\.body\.features \|\| ''\)\s*\n\s*\.split\('\\n'\)\s*\n\s*\.map\(f => f\.trim\(\)\)\s*\n\s*\.filter\(f => f\.length > 0\);)/, `$1\n${editBody}`);

// Update category.set call
content = content.replace(/category\.set\(\{([\s\S]*?)\}\);/, `category.set({$1, image: imagePath});`);


fs.writeFileSync('routes/admin/categories.js', content);
console.log('routes/admin/categories.js updated successfully.');
