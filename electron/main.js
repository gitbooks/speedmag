const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

const isDev = process.argv.includes('--dev');

// ── Profile & data paths ──────────────────────────────────────────────────────
const getProfilesPath   = () => path.join(app.getPath('userData'), 'profiles.json');
const getProfileDataPath = (id) => path.join(app.getPath('userData'), `profile-${id}.json`);
const getLegacyDataPath  = () => path.join(app.getPath('userData'), 'financial-data.json');

// In-memory active profile id (set on startup, updated on switch)
let activeProfileId = null;

function loadProfiles() {
  const p = getProfilesPath();
  if (!fs.existsSync(p)) return { profiles: [], activeProfileId: null };
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return { profiles: [], activeProfileId: null }; }
}

function saveProfiles(data) {
  fs.writeFileSync(getProfilesPath(), JSON.stringify(data, null, 2), 'utf-8');
}

function loadProfileData(id) {
  const p = getProfileDataPath(id);
  if (!fs.existsSync(p)) return { statements: [], transactions: [] };
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return { statements: [], transactions: [] }; }
}

function saveProfileData(id, data) {
  fs.writeFileSync(getProfileDataPath(id), JSON.stringify(data, null, 2), 'utf-8');
}

/** Load active profile's data (with legacy migration on first run) */
function loadData() {
  if (!activeProfileId) return { statements: [], transactions: [] };
  const profilePath = getProfileDataPath(activeProfileId);
  // One-time migration: if this profile file doesn't exist yet but the old file does, migrate it
  if (!fs.existsSync(profilePath) && fs.existsSync(getLegacyDataPath())) {
    try {
      const old = JSON.parse(fs.readFileSync(getLegacyDataPath(), 'utf-8'));
      fs.writeFileSync(profilePath, JSON.stringify(old, null, 2), 'utf-8');
      return old;
    } catch {}
  }
  return loadProfileData(activeProfileId);
}

function saveData(data) {
  if (!activeProfileId) return;
  saveProfileData(activeProfileId, data);
}

function makeId() {
  return `prof_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#F2F2F7',
    icon: path.join(__dirname, '..', 'icon', 'icon.icns'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // Init active profile from saved state
  const profilesData = loadProfiles();
  if (profilesData.profiles.length > 0) {
    activeProfileId = profilesData.activeProfileId || profilesData.profiles[0].id;
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // ── Auto-updater (skip in dev mode) ──
  if (!isDev) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
      console.log('Update available:', info.version);
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: `SpeedMag v${info.version} is available. It will be installed automatically.`,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('Update downloaded:', info.version);
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: `SpeedMag v${info.version} has been downloaded. Restart to apply the update.`,
        buttons: ['Restart Now', 'Later'],
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    });

    autoUpdater.on('error', (err) => {
      console.log('Auto-updater error:', err.message);
    });

    // Check for updates 3 seconds after launch
    setTimeout(() => autoUpdater.checkForUpdates(), 3000);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC: Profiles ─────────────────────────────────────────────────────────────
ipcMain.handle('profiles:load', async () => {
  const pd = loadProfiles();
  // Auto-migrate: if no profiles exist but legacy data does, create a default profile
  if (pd.profiles.length === 0 && fs.existsSync(getLegacyDataPath())) {
    const id = makeId();
    const profile = { id, name: 'My Business', color: '#007AFF', createdAt: new Date().toISOString() };
    pd.profiles.push(profile);
    pd.activeProfileId = id;
    activeProfileId = id;
    saveProfiles(pd);
    // Migration happens lazily in loadData() on first access
  }
  activeProfileId = pd.activeProfileId || (pd.profiles[0]?.id ?? null);
  return { profiles: pd.profiles, activeProfileId };
});

ipcMain.handle('profiles:create', async (_event, { name, color }) => {
  const pd = loadProfiles();
  const id = makeId();
  const profile = { id, name: name.trim(), color, createdAt: new Date().toISOString() };
  pd.profiles.push(profile);
  pd.activeProfileId = id;
  activeProfileId = id;
  saveProfiles(pd);
  return { profiles: pd.profiles, activeProfileId: id, data: { statements: [], transactions: [] } };
});

ipcMain.handle('profiles:update', async (_event, { id, name, color }) => {
  const pd = loadProfiles();
  pd.profiles = pd.profiles.map((p) => p.id === id ? { ...p, name: name.trim(), color } : p);
  saveProfiles(pd);
  return pd.profiles;
});

ipcMain.handle('profiles:delete', async (_event, id) => {
  const pd = loadProfiles();
  pd.profiles = pd.profiles.filter((p) => p.id !== id);
  // Delete profile data file
  const dataPath = getProfileDataPath(id);
  if (fs.existsSync(dataPath)) fs.unlinkSync(dataPath);
  // Switch active profile if needed
  if (pd.activeProfileId === id) {
    pd.activeProfileId = pd.profiles[0]?.id ?? null;
    activeProfileId = pd.activeProfileId;
  }
  saveProfiles(pd);
  const data = activeProfileId ? loadData() : { statements: [], transactions: [] };
  return { profiles: pd.profiles, activeProfileId: pd.activeProfileId, data };
});

ipcMain.handle('profiles:switch', async (_event, id) => {
  const pd = loadProfiles();
  pd.activeProfileId = id;
  activeProfileId = id;
  saveProfiles(pd);
  return { activeProfileId: id, data: loadData() };
});

// ── IPC: Data ─────────────────────────────────────────────────────────────────
ipcMain.handle('data:load', async () => loadData());
ipcMain.handle('data:save', async (_event, data) => { saveData(data); return true; });

// ── IPC: File dialog ──────────────────────────────────────────────────────────
ipcMain.handle('dialog:openFiles', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Bank Statements', extensions: ['pdf', 'csv'] },
      { name: 'PDF Statements', extensions: ['pdf'] },
      { name: 'CSV Statements', extensions: ['csv'] },
    ],
  });
  return result.canceled ? [] : result.filePaths;
});

// ── IPC: Import statements (PDF + CSV) ────────────────────────────────────────
ipcMain.handle('statements:import', async (_event, filePaths) => {
  const pdf = require('pdf-parse');
  const { parseNFCUStatement } = require('./pdfParser');
  const { parseCSVStatement } = require('./csvParser');
  const { autoCategorize } = require('./autoCategorizer');

  const data = loadData();
  const results = [];

  for (const filePath of filePaths) {
    const filename = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    if (data.statements.find((s) => s.filename === filename)) {
      results.push({ filename, skipped: true, reason: 'Already imported' });
      continue;
    }

    try {
      let transactions = [];
      let format = 'nfcu-pdf';

      if (ext === '.csv') {
        const text = fs.readFileSync(filePath, 'utf-8');
        const parsed = parseCSVStatement(text, filename);
        transactions = parsed.transactions.map(autoCategorize);
        format = `csv-${parsed.format}`;
      } else {
        const buffer = fs.readFileSync(filePath);
        const pdfData = await pdf(buffer);
        transactions = parseNFCUStatement(pdfData.text, filename).map(autoCategorize);
      }

      const statementId = `stmt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      data.statements.push({
        id: statementId, filename, filePath, format,
        uploadedAt: new Date().toISOString(),
        transactionCount: transactions.length,
      });
      data.transactions.push(...transactions.map((t) => ({ ...t, statementId })));
      saveData(data);
      results.push({ filename, success: true, count: transactions.length, format });
    } catch (err) {
      results.push({ filename, success: false, error: err.message });
    }
  }

  return { results, data };
});

// ── IPC: Update transactions ──────────────────────────────────────────────────
ipcMain.handle('transactions:update', async (_event, updated) => {
  const data = loadData();
  const updateMap = new Map(updated.map((u) => [u.id, u]));
  data.transactions = data.transactions.map((t) => {
    const u = updateMap.get(t.id);
    return u ? { ...t, category: u.category, businessCategory: u.businessCategory } : t;
  });
  saveData(data);
  return true;
});

// ── IPC: Delete statement ─────────────────────────────────────────────────────
ipcMain.handle('statements:delete', async (_event, statementId) => {
  const data = loadData();
  data.statements = data.statements.filter((s) => s.id !== statementId);
  data.transactions = data.transactions.filter((t) => t.statementId !== statementId);
  saveData(data);
  return data;
});

// ── IPC: Export CSV ───────────────────────────────────────────────────────────
ipcMain.handle('export:csv', async (_event, transactions) => {
  const { filePath, canceled } = await dialog.showSaveDialog({
    defaultPath: `speedmag-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (canceled || !filePath) return false;
  const headers = ['Date', 'Description', 'Amount', 'Type', 'Category', 'Business Category', 'Account'];
  const rows = transactions.map((t) => [
    t.date, `"${t.description.replace(/"/g, '""')}"`,
    t.amount.toFixed(2), t.type, t.category, t.businessCategory || '', t.accountNumber,
  ]);
  fs.writeFileSync(filePath, [headers.join(','), ...rows.map((r) => r.join(','))].join('\n'), 'utf-8');
  return true;
});

// ── IPC: Export P&L PDF ───────────────────────────────────────────────────────
ipcMain.handle('export:pdf', async (_event, { html, filename }) => {
  const { filePath, canceled } = await dialog.showSaveDialog({
    defaultPath: filename,
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return false;

  const win = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true },
  });

  // Load HTML via data URL
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

  // Small delay to allow rendering
  await new Promise((r) => setTimeout(r, 300));

  const pdfBuffer = await win.webContents.printToPDF({
    marginsType: 1,
    printBackground: true,
    pageSize: 'Letter',
  });
  win.close();
  fs.writeFileSync(filePath, pdfBuffer);
  return filePath;
});
