// node-runner-express.js (UPDATED FIX)
// Added: serve uploaded Node.js projects; show default message if no HTML output

const express = require('express');
const multer = require('multer');
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

fs.ensureDirSync(path.join(__dirname, 'sites'));
fs.ensureDirSync(path.join(__dirname, 'uploads'));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

app.use(express.urlencoded({ extended: true }));

// Home / upload
app.get('/', (req, res) => res.render('index'));

app.post('/upload', upload.single('projectZip'), async (req, res) => {
  const { webName, startCmd } = req.body;
  if (!req.file || !webName) return res.status(400).send('Missing file or webName');

  const id = uuidv4();
  const siteDir = path.join(__dirname, 'sites', `${webName}-${id}`);
  await fs.ensureDir(siteDir);

  const zip = new AdmZip(req.file.path);
  zip.extractAllTo(siteDir, true);

  const metadata = { id, webName, uploadedAt: new Date().toISOString(), startCmd: startCmd || '', running: false };
  await fs.writeJson(path.join(siteDir, 'metadata.json'), metadata, { spaces: 2 });

  // Optional: run the project in background if startCmd provided
  if (startCmd) {
    const child = spawn('sh', ['-c', startCmd], { cwd: siteDir, detached: true, stdio: 'ignore' });
    child.unref();
    metadata.running = true;
    await fs.writeJson(path.join(siteDir, 'metadata.json'), metadata, { spaces: 2 });
  }

  res.send(`Uploaded ${webName}. <a href='/sites'>View sites</a>`);
});

// List sites
app.get('/sites', async (req, res) => {
  const folders = await fs.readdir(path.join(__dirname, 'sites'));
  const list = [];
  for (const f of folders) {
    const metaPath = path.join(__dirname, 'sites', f, 'metadata.json');
    if (await fs.pathExists(metaPath)) list.push({ folder: f, meta: await fs.readJson(metaPath) });
  }
  res.render('sites', { list });
});

// Serve uploaded projects
app.get('/:webName/*?', async (req, res) => {
  const folder = req.params.webName;
  const siteFolder = path.join(__dirname, 'sites', folder);
  if (!await fs.pathExists(siteFolder)) return res.status(404).send('Not found');

  // Check for index.html
  const indexFile = path.join(siteFolder, 'index.html');
  if (await fs.pathExists(indexFile)) {
    return res.sendFile(indexFile);
  }

  res.send('<h1>This web doesn\'t need output</h1>');
});

app.listen(PORT, () => console.log(`Node Runner listening on http://localhost:${PORT}`));
