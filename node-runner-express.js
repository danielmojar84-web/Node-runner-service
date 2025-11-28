// node-runner-express.js
// Simple safe-ish Node.js app: upload a .zip (single project folder), extract to sites/, save metadata.
// WARNING: This example does NOT auto-run uploaded code. To deploy/run uploaded projects you must run them manually
// or extend this app with sandboxing (Docker) and authentication.
const express = require('express');
const multer = require('multer');
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

fs.ensureDirSync(path.join(__dirname, 'sites'));
fs.ensureDirSync(path.join(__dirname, 'uploads'));

// Multer with basic limits
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB max upload
});

app.use(express.urlencoded({ extended: true }));
app.use('/static', express.static(path.join(__dirname, 'static')));

app.get('/', (req, res) => {
  res.render('index');
});

// Main upload endpoint
app.post('/upload', upload.single('projectZip'), async (req, res) => {
  try {
    const { webName, buildCmd, startCmd, deploy } = req.body;
    if (!req.file) return res.status(400).send('No file uploaded. Use a .zip of your project.');
    if (!webName) return res.status(400).send('Web name is required.');

    const id = uuidv4();
    const safeName = webName.replace(/[^a-z0-9-_]/gi, '_').toLowerCase();
    const siteDir = path.join(__dirname, 'sites', `${safeName}-${id}`);
    await fs.ensureDir(siteDir);

    const zip = new AdmZip(req.file.path);
    zip.extractAllTo(siteDir, true);

    const metadata = {
      id,
      webName,
      uploadedAt: new Date().toISOString(),
      buildCmd: buildCmd || '',
      startCmd: startCmd || '',
      deployedRequested: !!deploy,
      sourceZip: req.file.filename
    };
    await fs.writeJson(path.join(siteDir, 'metadata.json'), metadata, { spaces: 2 });

    // Respond with success and link to site listing
    res.send(`Uploaded and extracted to <code>${siteDir}</code>.<br><a href="/sites">View sites</a>`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Upload failed: ' + err.message);
  }
});

// List uploaded sites with metadata summary
app.get('/sites', async (req, res) => {
  const sitesRoot = path.join(__dirname, 'sites');
  const names = await fs.readdir(sitesRoot).catch(() => []);
  const list = [];
  for (const name of names) {
    const metaPath = path.join(sitesRoot, name, 'metadata.json');
    if (await fs.pathExists(metaPath)) {
      const meta = await fs.readJson(metaPath).catch(() => null);
      if (meta) list.push({ folder: name, meta });
    }
  }
  res.render('sites', { list });
});

// Serve uploaded project's files (read-only) - basic, no auth
app.get('/site/:folder/*', async (req, res) => {
  const folder = req.params.folder;
  const rest = req.params[0] || '';
  const filePath = path.join(__dirname, 'sites', folder, rest);
  if (!filePath.startsWith(path.join(__dirname, 'sites'))) return res.status(400).send('Invalid path');
  if (!(await fs.pathExists(filePath))) return res.status(404).send('Not found');
  res.sendFile(filePath);
});

app.listen(PORT, () => console.log(`Node Runner app listening on http://localhost:${PORT}`));
