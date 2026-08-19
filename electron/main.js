const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: 'DielineForge CAD - Parametric Packaging & Zünd Nesting',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: false // Enables loading local SVGs and assets smoothly
    },
    autoHideMenuBar: false
  });

  // Candidate paths for Angular build output
  const possiblePaths = [
    path.join(__dirname, '../dist/app/browser/index.html'),
    path.join(__dirname, '../dist/browser/index.html'),
    path.join(__dirname, '../dist/index.html')
  ];

  let indexPath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];

  mainWindow.loadFile(indexPath).catch((err) => {
    console.error('Failed to load file:', err);
    // If not built yet, show instructions
    mainWindow.loadURL(`data:text/html;charset=utf-8,
      <html style="background:#121212;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
        <div style="text-align:center;padding:40px;background:#1e1e1e;border-radius:12px;border:1px solid #333;">
          <h2 style="color:#fbbf24;">DielineForge Desktop</h2>
          <p>Angular production build not found at <code>${indexPath}</code>.</p>
          <p>Please run <code>npm run build</code> or <code>npm run electron:build</code> first.</p>
        </div>
      </html>
    `);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
