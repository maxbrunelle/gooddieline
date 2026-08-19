# DielineForge CAD - Windows Desktop Packaging Guide

This guide explains how to package DielineForge into a standalone Windows installer (`.exe`) and portable executable.

---

### Step 1: Export and Extract
1. Export / download the project ZIP from the **Settings / Export** menu (or clone from GitHub).
2. Extract the zip folder on your Windows computer.

---

### Step 2: Install Dependencies on Windows
Open PowerShell or Command Prompt inside the extracted project folder (`gooddieline-main`):

```bash
npm install
```

---

### Step 3: Build & Package Windows Executables

Run the packaging script (this compiles the Angular app with relative paths and builds the Windows executables):

```bash
npm run electron:build:win
```

Or for instant live desktop testing without packaging:
```bash
npm run electron:dev
```

---

### Step 4: Output Location
Once the build completes, find your executables in the **`dist-electron/`** folder:
- **`DielineForge Setup 1.0.0.exe`** (Installer)
- **`DielineForge 1.0.0.exe`** (Portable standalone executable, runs immediately)

---

### Troubleshooting: `ERR_FILE_NOT_FOUND`
If you encounter `ERR_FILE_NOT_FOUND` when launching the packaged `.exe`, it means the Angular client was not built prior to running electron-builder. Always use:
```bash
npm run electron:build:win
```
(which automatically runs `ng build --base-href ./` before running `electron-builder`).
