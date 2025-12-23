# CloudLabs Setup Guide - Complete Instructions

This guide will walk you through setting up the CloudLabs application from scratch on Windows.

## Prerequisites

Before you begin, you'll need:
- A Windows operating system (Windows 10 or later recommended)
- Administrator privileges (for installing software)
- An internet connection

---

## Step 1: Install Node.js Version Manager (nvm-windows)

Since this project uses Node.js version 20.14.0, we'll use nvm-windows to manage Node.js versions.

1. **Download nvm-windows:**
   - Go to: https://github.com/coreybutler/nvm-windows/releases
   - Download the latest `nvm-setup.exe` installer (or `nvm-setup.zip` if you prefer)
   - The latest release is typically at the top of the releases page

2. **Install nvm-windows:**
   - Run the installer (`nvm-setup.exe`)
   - Follow the installation wizard (accept defaults or customize as needed)
   - **Important:** You may need to restart your terminal/PowerShell after installation

3. **Verify installation:**
   - Open a new PowerShell window (or restart your current one)
   - Run: `nvm version`
   - You should see the version number (e.g., `1.1.11`)

---

## Step 2: Install Node.js using nvm

1. **Install Node.js version 20.14.0:**
   ```powershell
   nvm install 20.14.0
   ```

2. **Set Node.js 20.14.0 as the active version:**
   ```powershell
   nvm use 20.14.0
   ```

3. **Verify Node.js installation:**
   ```powershell
   node -v
   ```
   You should see: `v20.14.0`

4. **Verify npm installation:**
   ```powershell
   npm -v
   ```
   You should see the npm version (npm comes bundled with Node.js)

---

## Step 3: Navigate to the Project Directory

1. **Open PowerShell** (if not already open)

2. **Navigate to the project folder:**
   ```powershell
   cd C:\Users\tansb\Documents\Arka\cloudlabs-main
   ```

   *Note: Adjust the path if your project is located elsewhere*

---

## Step 4: Configure PowerShell Environment (if needed)

If `nvm` commands are not recognized, you may need to add nvm to your PATH:

```powershell
$env:PATH = "$env:APPDATA\nvm;$env:LOCALAPPDATA\nodejs;$env:PATH"
```

You can add this to your PowerShell profile to make it permanent:
- Run: `notepad $PROFILE`
- Add the line above
- Save and close

---

## Step 5: Verify nvm and Node.js Setup

Before proceeding, verify everything is set up correctly:

```powershell
nvm version
nvm use 20.14.0
node -v
npm -v
```

All commands should execute without errors.

---

## Step 6: Install Project Dependencies

1. **Install base dependencies:**
   ```powershell
   npm install
   ```
   This installs all packages listed in `package.json` based on the `package-lock.json` file.

2. **Fix any security vulnerabilities (optional but recommended):**
   ```powershell
   npm audit fix --force
   ```
   *Note: `--force` may update packages to fix vulnerabilities. Review changes if needed.*

---

## Step 7: Upgrade to React 19 and Next.js Latest (Required for this project)

This project requires React 19 and the latest Next.js. Install them:

```powershell
npm i -E next@latest react@19 react-dom@19
```

This installs:
- Next.js (latest version)
- React 19
- React DOM 19

---

## Step 8: Install React Konva Dependencies

Install the required Konva libraries for the canvas functionality:

```powershell
npm i -E react-konva@19 konva@latest
```

This installs:
- react-konva version 19
- konva (latest version)

---

## Step 9: Final Verification

Verify your Node.js version one more time:

```powershell
node -v
```

Should show: `v20.14.0`

---

## Step 10: Run the Development Server

Start the Next.js development server:

```powershell
npm run dev
```

The application will:
- Compile and start the development server
- Display a URL (typically `http://localhost:3000`)
- Show compilation status in the terminal

---

## Step 11: Access the Application

1. Open your web browser
2. Navigate to: `http://localhost:3000`
3. The CloudLabs Personalizer application should load

---

## Troubleshooting

### Issue: `nvm` command not found
**Solution:** 
- Make sure you installed nvm-windows correctly
- Restart PowerShell/terminal
- Manually add nvm to PATH: `$env:PATH = "$env:APPDATA\nvm;$env:LOCALAPPDATA\nodejs;$env:PATH"`

### Issue: `npm install` fails
**Solutions:**
- Make sure you're using Node.js 20.14.0: `nvm use 20.14.0`
- Clear npm cache: `npm cache clean --force`
- Delete `node_modules` folder and `package-lock.json`, then run `npm install` again

### Issue: Port 3000 is already in use
**Solution:**
- Stop any other applications using port 3000
- Or run on a different port: `npm run dev -- -p 3001`

### Issue: Installation is slow
**Solution:**
- This is normal for first-time installations
- npm is downloading and installing hundreds of packages
- Ensure you have a stable internet connection

---

## Quick Reference: Complete Command Sequence

For experienced users, here's the complete sequence:

```powershell
# Navigate to project
cd C:\Users\tansb\Documents\Arka\cloudlabs-main

# Set PATH (if needed)
$env:PATH = "$env:APPDATA\nvm;$env:LOCALAPPDATA\nodejs;$env:PATH"

# Verify nvm
nvm version

# Use Node.js 20.14.0
nvm use 20.14.0

# Install dependencies
npm install

# Fix vulnerabilities (optional)
npm audit fix --force

# Install React 19 and Next.js latest
npm i -E next@latest react@19 react-dom@19

# Install Konva dependencies
npm i -E react-konva@19 konva@latest

# Verify Node.js version
node -v

# Run development server
npm run dev
```

---

## Additional Information

- **Development Server:** Runs on `http://localhost:3000` by default
- **Hot Reload:** Changes to files automatically refresh the browser
- **Stop Server:** Press `Ctrl + C` in the terminal
- **Production Build:** Run `npm run build` then `npm start`

---

## Need Help?

If you encounter issues:
1. Check that all prerequisites are installed correctly
2. Verify Node.js version is 20.14.0
3. Ensure you're in the correct project directory
4. Review error messages in the terminal for specific issues

