const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');

function findIndexHtml() {
  const possiblePaths = [
    path.join(__dirname, 'dist', 'app', 'browser', 'index.csr.html'),
    path.join(__dirname, 'dist', 'browser', 'index.csr.html'),
    path.join(__dirname, 'dist', 'dielineforge', 'browser', 'index.csr.html'),
    path.join(__dirname, 'dist', 'app', 'browser', 'index.html'),
    path.join(__dirname, 'dist', 'browser', 'index.html'),
    path.join(__dirname, 'dist', 'dielineforge', 'browser', 'index.html'),
    path.join(__dirname, 'dist', 'index.html')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, 'utf8');
        // If it is a cookie check / redirect script, skip it
        if (content.includes('Cookie check') || content.includes('verifyCanSetCookies')) {
          continue;
        }
        if (content.includes('<app-root') || content.includes('main')) {
          return p;
        }
      } catch (e) {
        return p;
      }
    }
  }

  // Direct fallback
  const csrPath = path.join(__dirname, 'dist', 'app', 'browser', 'index.csr.html');
  if (fs.existsSync(csrPath)) {
    return csrPath;
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
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true
    }
  });

  const indexPath = findIndexHtml();
  win.loadFile(indexPath);

  win.once('ready-to-show', () => {
    win.show();
  });

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load page:', errorCode, errorDescription);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Enable F12 / Ctrl+Shift+I for DevTools inspection
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
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

