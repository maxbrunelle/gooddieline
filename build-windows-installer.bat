@echo off
setlocal enabledelayedexpansion
title DielineForge CAD - Windows Installer Builder
color 0B

echo ===============================================================================
echo                DIELINEFORGE CAD - WINDOWS INSTALLER BUILDER                    
echo ===============================================================================
echo.

:: 1. Check Node.js and npm
echo [*] Step 1/5: Checking prerequisites...
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    color 0C
    echo [ERROR] Node.js is not installed or not in your system PATH!
    echo Please download and install Node.js (LTS version recommended) from:
    echo   https://nodejs.org/
    echo.
    echo Once installed, reopen this script.
    echo.
    pause
    exit /b 1
)

where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    color 0C
    echo [ERROR] npm is not found in your system PATH!
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
for /f "tokens=*" %%v in ('npm -v') do set NPM_VER=%%v
echo     - Node.js version : %NODE_VER%
echo     - npm version     : %NPM_VER%
echo.

:: 2. Check and configure custom app icon
echo [*] Step 2/5: Checking custom app icons...
if not exist "assets" mkdir "assets"
if not exist "public" mkdir "public"

if exist "assets\icon.ico" (
    echo     [OK] Custom Windows Icon found: assets\icon.ico
) else if exist "public\favicon.ico" (
    echo     [INFO] No custom 'assets\icon.ico' detected.
    echo            Copying 'public\favicon.ico' to 'assets\icon.ico' as default.
    copy /Y "public\favicon.ico" "assets\icon.ico" >nul
) else (
    echo     [WARNING] No icon.ico found. A default icon will be generated if possible.
)

if exist "assets\icon.png" (
    echo     [OK] Custom App Icon PNG found: assets\icon.png
) else if exist "assets\icon.ico" (
    copy /Y "assets\icon.ico" "assets\icon.png" >nul 2>nul
)

echo.
echo     ^>^> ICON UPLOAD TIP:
echo     To change the app and title bar icon anytime, place your custom .ico or .png in:
echo     %~dp0assets\icon.ico   (Recommended: 256x256 ICO for Windows)
echo     %~dp0assets\icon.png   (Recommended: 512x512 PNG for Title Bar & App)
echo.

:: 3. Verify / Install Dependencies
echo [*] Step 3/5: Checking build tools & packaging dependencies...
if not exist "node_modules\@angular\cli" (
    echo     Installing project dependencies...
    call npm install --legacy-peer-deps
    if %ERRORLEVEL% neq 0 (
        color 0C
        echo [ERROR] Failed to install npm dependencies.
        pause
        exit /b 1
    )
)

if not exist "node_modules\electron" (
    echo     Installing Electron development runtime...
    call npm install --save-dev electron@^33.2.0 --legacy-peer-deps
)

if not exist "node_modules\electron-builder" (
    echo     Installing electron-builder packaging engine...
    call npm install --save-dev electron-builder@^25.1.8 --legacy-peer-deps
)
echo     [OK] Packaging dependencies are ready.
echo.

:: 4. Build Angular CAD Production Bundle
echo [*] Step 4/5: Compiling Angular CAD interface for desktop (relative base-href)...
call npx ng build --base-href ./
if %ERRORLEVEL% neq 0 (
    color 0C
    echo [ERROR] Angular compilation failed. Please review error messages above.
    pause
    exit /b 1
)

:: Run postbuild to ensure index.html exists
if exist "dist\app\browser\index.csr.html" (
    copy /Y "dist\app\browser\index.csr.html" "dist\app\browser\index.html" >nul
)
if exist "dist\browser\index.csr.html" (
    copy /Y "dist\browser\index.csr.html" "dist\browser\index.html" >nul
)
if exist "assets" (
    if not exist "dist\app\browser\assets" mkdir "dist\app\browser\assets" 2>nul
    xcopy /E /I /Y "assets" "dist\app\browser\assets" >nul 2>nul
)
echo     [OK] Angular CAD bundle successfully generated.
echo.

:: 5. Package Windows Installer & Portable Executable
echo [*] Step 5/5: Building Windows Installer (.exe) with electron-builder...
echo     (This may take 1 to 3 minutes on the first run while downloading Windows tools)
echo.

call npx electron-builder --win nsis portable

if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo ===============================================================================
    echo                       PACKAGING FAILED OR PERMISSION ERROR                     
    echo ===============================================================================
    echo If you see "Cannot create symbolic link: A required privilege is not held":
    echo.
    echo   FIX 1 (RECOMMENDED): Enable Developer Mode in Windows:
    echo     1. Open Windows Settings (Win + I)
    echo     2. Go to System ^> For developers
    echo     3. Toggle "Developer Mode" to ON
    echo     4. Re-run this build-windows-installer.bat script.
    echo.
    echo   FIX 2: Run as Administrator:
    echo     Right-click 'build-windows-installer.bat' and select 'Run as administrator'.
    echo ===============================================================================
    echo.
    pause
    exit /b 1
)

color 0A
cls
echo ===============================================================================
echo                BUILD COMPLETED SUCCESSFULLY! WINDOWS INSTALLER READY           
echo ===============================================================================
echo.
echo Your Windows executables have been generated in:
echo   %~dp0dist-electron\
echo.
echo Output Files:
echo   [1] Installer (.exe Setup Wizard):
echo       dist-electron\DielineForge CAD Setup 1.0.0.exe
echo       - Full Windows installation wizard with Desktop & Start Menu shortcuts.
echo.
echo   [2] Portable Standalone (.exe):
echo       dist-electron\DielineForge CAD 1.0.0.exe
echo       - Run immediately without installing.
echo.
echo Icon used:
echo   - %~dp0assets\icon.ico
echo.
echo ===============================================================================
echo.
echo Choose an option:
echo   [1] Open 'dist-electron' folder in Windows Explorer
echo   [2] Launch Portable App now
echo   [3] Exit
echo.
set /p USER_CHOICE="Enter selection [1, 2, or 3]: "

if "%USER_CHOICE%"=="1" (
    explorer "%~dp0dist-electron"
) else if "%USER_CHOICE%"=="2" (
    for %%f in ("dist-electron\*.exe") do (
        echo %%~nxf | findstr /i /v "Setup" >nul
        if !ERRORLEVEL! equ 0 (
            echo Launching %%f...
            start "" "%%f"
            goto done
        )
    )
    start "" "dist-electron"
)

:done
echo.
echo Done! Thank you for using DielineForge CAD.
pause
