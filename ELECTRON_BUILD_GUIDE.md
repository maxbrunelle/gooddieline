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
npm install --legacy-peer-deps
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

### Fixing `Cannot create symbolic link : A required privilege is not held by the client`

This error occurs when Windows non-admin terminals extract macOS/Linux symlinks inside the default code-signing tool cache (`winCodeSign`). 

Here are the **2 quick ways to fix it**:

#### Option A: Run PowerShell / Terminal as Administrator (Fastest)
1. Close your current PowerShell/Command Prompt.
2. Search for **PowerShell** in the Windows Start menu, right-click, and choose **Run as administrator**.
3. Navigate back to your project directory:
   ```bash
   cd "C:\Users\brune\Documents\gooddieline-main"
   ```
4. Run:
   ```bash
   npm run electron:build:win
   ```

#### Option B: Enable Windows Developer Mode
1. Open Windows **Settings** (`Win + I`).
2. Go to **System** > **For developers** (or search **Developer settings**).
3. Toggle **Developer Mode** to **ON**.
4. This grants non-admin users permission to create symlinks without needing elevated administrator prompts.
5. Re-run `npm run electron:build:win`.

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
