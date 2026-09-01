const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

function findIndexHtml() {
  const possiblePaths = [
    path.join(__dirname, 'dist', 'app', 'browser', 'index.html'),
    path.join(__dirname, 'dist', 'browser', 'index.html'),
    path.join(__dirname, 'dist', 'dielineforge', 'browser', 'index.html'),
    path.join(__dirname, 'dist', 'index.html')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return path.join(__dirname, 'dist', 'app', 'browser', 'index.html');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 700,
    title: 'DielineForge — Packaging CAD & Zünd Nesting',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const indexPath = findIndexHtml();
  if (fs.existsSync(indexPath)) {
    win.loadFile(indexPath);
  } else if (process.env.ELECTRON_START_URL) {
    win.loadURL(process.env.ELECTRON_START_URL);
  } else {
    win.loadFile(indexPath);
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    const { shell } = require('electron');
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
