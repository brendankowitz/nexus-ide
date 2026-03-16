import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';

import { registerIpcHandlers } from './ipc/handlers.js';
import { augmentPathFromSystem, detectDefaultShell, killAllSessions } from './ipc/terminal.js';

/* ─── Remote debugging (dev only) ─── */

if (process.env.ELECTRON_RENDERER_URL) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222');
}

/* ─── Single instance lock ─── */

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
}

/* ─── Window creation ─── */

let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#06060c',
      symbolColor: '#8b8ba0',
      height: 36,
    },
    backgroundColor: '#0a0a14',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload needs Node APIs (ipcRenderer, process.platform)
      preload: join(__dirname, '../preload/preload.js'),
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' } as const;
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../../dist/index.html'));
  }
};

/* ─── App lifecycle ─── */

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  augmentPathFromSystem();
  // Cache the detected shell once at startup so all modules share one result.
  detectDefaultShell();
  registerIpcHandlers();
  createWindow();
});

app.on('before-quit', () => {
  killAllSessions();
});

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
