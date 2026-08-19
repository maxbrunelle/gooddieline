# DielineForge CAD - Windows Desktop Packaging Guide

This guide explains how to package DielineForge into a standalone Windows installer (`.exe`) and portable executable.

---

### Step 1: Export and Extract
1. Export / download the project ZIP from the **Settings / Export** menu.
2. Extract the zip folder on your Windows computer.

---

### Step 2: Install Dependencies & Electron on Windows
Open PowerShell or Command Prompt in the extracted project folder:

```bash
# 1. Install regular project dependencies
npm install

# 2. Install Electron & Builder locally on Windows
npm install --save-dev electron electron-builder
```

---

### Step 3: Build & Package Windows Executables

```bash
# Build the Angular app and package the Windows installer (.exe) and portable app:
npm run electron:build:win
```

Or for instant desktop testing without packaging:
```bash
npm run electron:dev
```

---

### Step 4: Output Location
Once the build completes, find your executables in:
`dist-electron/`
- **`DielineForge Setup 1.0.0.exe`** (Full installer)
- **`DielineForge 1.0.0.exe`** (Portable standalone executable, no install needed)
