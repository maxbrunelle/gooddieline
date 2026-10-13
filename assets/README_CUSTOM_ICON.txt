=======================================================
 DIELINEFORGE CAD - CUSTOM ICON & LOGO FOLDER GUIDE
=======================================================

To customize the app icon and logo across Windows, the installer,
the desktop title bar, and the in-app interface, place your custom
image files in this exact directory:

Folder:  /assets/   (or [project-root]\assets on Windows)

-------------------------------------------------------
RECOMMENDED FILES TO UPLOAD HERE:
-------------------------------------------------------

1. assets/icon.ico
   - Format: Windows Icon (.ico)
   - Recommended dimensions: Multi-size 256x256, 128x128, 64x64, 48x48, 32x32, 16x16
   - Used for:
     * Windows Setup Installer (.exe icon)
     * Windows Desktop & Start Menu shortcut icon
     * Windows Taskbar & System Tray icon
     * Native Windows Window Title Bar (top-left)

2. assets/icon.png
   - Format: PNG with transparent background (.png)
   - Recommended dimensions: 512x512 px or 256x256 px
   - Used for:
     * In-app header title bar icon (next to DIELINEFORGE brand)
     * Web browser favicon & high-DPI displays
     * Linux / cross-platform desktop icon fallback

3. assets/logo.png (Optional)
   - Format: PNG with transparent background (.png)
   - Recommended dimensions: Horizontal rectangular logo (e.g. 240x60 px)
   - Used for:
     * Custom studio/company branding in the top navigation header
     * (You can also upload this directly inside the app: Click "Settings" -> "Brand Logo")

-------------------------------------------------------
HOW TO CONVERT ANY IMAGE (PNG/JPG) TO .ICO:
-------------------------------------------------------
If you only have a PNG or JPG file:
- You can convert it using free online tools like:
  * https://cloudconvert.com/png-to-ico
  * https://convertio.co/png-ico/
  * https://icoconvert.com/
- Save the resulting file as:
  assets/icon.ico

Once placed in this folder, simply double-click:
  build-windows-installer.bat
to automatically build your custom-branded Windows installer!
=======================================================
