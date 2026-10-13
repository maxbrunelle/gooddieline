# DielineForge CAD - Windows Desktop Packaging & Custom Icon Guide

This guide explains how to package DielineForge into a standalone Windows installer (`.exe`) and portable executable using the included **`build-windows-installer.bat`** script, and how to upload your custom brand icon.

---

## 🎨 Where to Upload Your Custom Icon

To display your custom icon in the **Windows Title Bar**, the **Taskbar**, the **Desktop Shortcut**, the **Installer Wizard**, and **on the app itself**, place your icon files into this directory:

```
📁 assets/
   ├── icon.ico   <-- (Windows setup installer, .exe file icon, taskbar & window title bar)
   ├── icon.png   <-- (In-app top navigation header & high-DPI display)
   └── logo.png   <-- (Optional: wide horizontal brand logo)
```

### File Specifications:
1. **`assets/icon.ico`** (Required for Windows Executable):
   - **Format:** Windows Icon (`.ico`)
   - **Recommended size:** Multi-resolution (256x256, 128x128, 64x64, 48x48, 32x32, 16x16)
   - **Free online converter:** If you have a PNG, convert it at [cloudconvert.com/png-to-ico](https://cloudconvert.com/png-to-ico) or [convertio.co/png-ico](https://convertio.co/png-ico/) and save as `assets/icon.ico`.

2. **`assets/icon.png`** (For App Title Bar & Header):
   - **Format:** PNG with transparent background (`.png`)
   - **Recommended size:** 512x512 px or 256x256 px
   - **Where it appears:** Rendered directly in the CAD header next to your studio brand name.

3. **In-App Logo Customization (Live)**:
   - You can also upload a logo dynamically at any time inside the running app by clicking **Settings (gear icon) -> Brand Logo** to drag-and-drop your image directly.

---

## 🚀 How to Build the Windows Installer with `.bat`

### Method 1: One-Click Build Script (Easiest)
1. Download or extract the project on your Windows PC.
2. Ensure you have **Node.js** installed ([nodejs.org](https://nodejs.org/)).
3. Simply **double-click** the file:
   ```cmd
   build-windows-installer.bat
   ```
   *(or `build-installer.bat`)*

The script will automatically:
- Verify your Node.js and npm environment
- Detect your custom `assets/icon.ico` and `assets/icon.png`
- Check and install required packaging tools (`electron`, `electron-builder`)
- Compile the Angular CAD application with relative paths
- Build both the Windows **NSIS Setup Installer** and the **Portable Standalone Executable**
- Give you an option to immediately open the output folder or test the app!

---

### Method 2: Command Line (PowerShell or CMD)

```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Build the Angular app and package Windows executables
npm run electron:build:win
```

Or for instant live desktop testing without packaging:
```bash
npm run electron:dev
```

---

## 📦 Output Location

Once the script completes, find your executables in the **`dist-electron/`** folder:
- **`dist-electron/DielineForge CAD Setup 1.0.0.exe`**
  - Full Windows installation wizard with Desktop & Start Menu shortcuts with your custom icon.
- **`dist-electron/DielineForge CAD 1.0.0.exe`**
  - Portable standalone executable that runs immediately without installation.

---

## 🛠️ Troubleshooting: `Cannot create symbolic link: A required privilege is not held`

This is a known Windows security restriction when extracting symlinks inside the default `winCodeSign` cache.

### Fix A: Enable Windows Developer Mode (Recommended - Permanent Fix)
1. Open Windows **Settings** (`Win + I`).
2. Go to **System** > **For developers** (or search "Developer settings").
3. Toggle **Developer Mode** to **ON**.
4. Re-run `build-windows-installer.bat`.

### Fix B: Run as Administrator
1. Right-click **`build-windows-installer.bat`**.
2. Select **Run as administrator**.
