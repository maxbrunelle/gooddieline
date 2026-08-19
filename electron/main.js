const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Global error handlers to prevent silent crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  dialog.showErrorBox(
    'DielineForge Startup Error',
    `An unexpected error occurred during application startup:\n\n${error.stack || error.message || error}`
  );
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

let mainWindow = null;

// Ensure single instance on Windows
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);
}

function resolveIndexPath() {
  const appPath = app.getAppPath();
  const candidates = [
    path.join(appPath, 'dist/app/browser/index.html'),
    path.join(appPath, 'dist/browser/index.html'),
    path.join(appPath, 'dist/index.html'),
    path.join(__dirname, '../dist/app/browser/index.html'),
    path.join(__dirname, '../dist/browser/index.html'),
    path.join(__dirname, '../dist/index.html')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Default fallback
  return path.join(appPath, 'dist/app/browser/index.html');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: 'DielineForge CAD - Parametric Packaging & Zünd Production',
    backgroundColor: '#0a0a0a',
    show: false, // Show gracefully once content is ready
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false // Necessary for local file:// protocol and svg generation
    },
    autoHideMenuBar: false
  });

  const indexPath = resolveIndexPath();

  // Show window once ready to prevent flickering
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle load failure with a clear native dialog
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', errorCode, errorDescription, validatedURL);
    if (errorCode !== -3) { // -3 is ABORTED (e.g. redirected or hash navigation)
      dialog.showErrorBox(
        'Failed to Load Application',
        `Unable to load DielineForge CAD interface.\n\nFile: ${indexPath}\nError: ${errorDescription} (${errorCode})\n\nPlease ensure 'npm run build' was executed prior to packaging.`
      );
    }
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Render process gone:', details);
    dialog.showErrorBox(
      'Renderer Crash',
      `The CAD UI process crashed: ${details.reason} (exit code: ${details.exitCode})`
    );
  });

  mainWindow.loadFile(indexPath).catch((err) => {
    console.error('loadFile caught error:', err);
    dialog.showErrorBox(
      'Startup File Missing',
      `Could not find or open ${indexPath}.\n\nError: ${err.message}`
    );
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
