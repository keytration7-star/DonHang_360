import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Helper để lấy path đúng trong production
function getResourcePath(relativePath: string): string {
  if (isDev) {
    return path.join(__dirname, '..', relativePath);
  }
  const appPath = app.getAppPath();
  console.log('App path:', appPath);
  return path.join(appPath, 'dist', relativePath);
}

function getIconPath(): string {
  if (isDev) {
    return path.join(__dirname, '../icon.ico');
  }
  const appPath = app.getAppPath();
  const iconInApp = path.join(appPath, 'icon.ico');
  const iconInResources = process.resourcesPath 
    ? path.join(process.resourcesPath, '..', 'icon.ico')
    : null;
  return iconInResources || iconInApp;
}

// Auto-updater - Logic đơn giản
let autoUpdater: any = null;
let mainWindow: BrowserWindow | null = null;

function initAutoUpdater() {
  if (isDev) {
    console.log('⚠️ Auto-updater bị tắt trong development mode');
    return;
  }
  
  try {
    const electronUpdater = require('electron-updater');
    autoUpdater = electronUpdater.autoUpdater;
    console.log('✅ Electron-updater đã được load');
    
    // Cấu hình GitHub
    const githubToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    const feedConfig: any = {
      provider: 'github',
      owner: 'keytration7-star',
      repo: 'DonHang_360',
    };
    
    if (githubToken) {
      feedConfig.token = githubToken;
    }
    
    autoUpdater.setFeedURL(feedConfig);
    autoUpdater.setAutoDownload(false); // Không tự động tải
    autoUpdater.setAutoInstallOnAppQuit(false); // Không tự động cài
    
    console.log('✅ Đã cấu hình auto-updater');
    setupAutoUpdater();
  } catch (error) {
    console.error('❌ Lỗi import electron-updater:', error);
  }
}

function setupAutoUpdater() {
  if (!autoUpdater || !mainWindow) return;
  
  // KHÔNG tự động check update - chỉ check thủ công qua Settings
  console.log('ℹ️ Auto-updater đã sẵn sàng. Người dùng có thể kiểm tra cập nhật thủ công trong Settings.');
  
  // Event: Có update mới
  autoUpdater.on('update-available', (info: any) => {
    const currentVersion = app.getVersion();
    const newVersion = info.version;
    
    if (newVersion && newVersion !== currentVersion) {
      console.log('✅ Có bản cập nhật mới:', newVersion);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-available', {
          version: newVersion,
          releaseNotes: info.releaseNotes || ''
        });
      }
    }
  });
  
  // Event: Không có update
  autoUpdater.on('update-not-available', () => {
    console.log('✅ Đã là phiên bản mới nhất');
  });
  
  // Event: Lỗi
  autoUpdater.on('error', (err: Error) => {
    console.error('❌ Lỗi auto-updater:', err.message);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-error', {
        error: err.message
      });
    }
  });
  
  // Event: Tiến độ download
  autoUpdater.on('download-progress', (progressObj: any) => {
    const percent = Math.round(progressObj.percent || 0);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-download-progress', {
        percent,
        bytesPerSecond: progressObj.bytesPerSecond || 0,
        transferred: progressObj.transferred || 0,
        total: progressObj.total || 0
      });
    }
  });
  
  // Event: Đã tải xong
  autoUpdater.on('update-downloaded', (info: any) => {
    console.log('✅ Đã tải xong cập nhật:', info.version);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-downloaded', {
        version: info.version
      });
    }
  });
}

// Khởi tạo auto-updater
initAutoUpdater();

// IPC handlers
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-app-name', () => app.getName());

// Check for updates
ipcMain.handle('check-for-updates', async () => {
  if (!autoUpdater || isDev) {
    return { error: 'Auto-updater không khả dụng' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    const updateInfo = result?.updateInfo;
    const currentVersion = app.getVersion();
    
    if (updateInfo && updateInfo.version !== currentVersion) {
      return {
        success: true,
        updateInfo: {
          version: updateInfo.version,
          releaseNotes: updateInfo.releaseNotes || ''
        }
      };
    }
    
    return {
      success: true,
      updateInfo: null,
      message: 'Bạn đang sử dụng phiên bản mới nhất'
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Lỗi không xác định'
    };
  }
});

// Download update
ipcMain.handle('download-update', async () => {
  if (!autoUpdater || isDev) {
    return { error: 'Auto-updater không khả dụng' };
  }
  try {
    // Check update trước
    await autoUpdater.checkForUpdates();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Download
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Lỗi tải cập nhật'
    };
  }
});

// Install update - App sẽ đóng và mở installer
ipcMain.handle('install-update', async () => {
  if (!autoUpdater || isDev) {
    return { error: 'Auto-updater không khả dụng' };
  }
  try {
    console.log('🔄 Đóng app và cài đặt cập nhật...');
    // quitAndInstall(false, true):
    // - false: Hiển thị installer dialog
    // - true: Tự động chạy lại app sau khi cài xong
    autoUpdater.quitAndInstall(false, true);
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Lỗi cài đặt cập nhật'
    };
  }
});

// Tạo window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
    show: false,
    focusable: true,
  });

  // Load app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = getResourcePath('index.html');
    console.log('Loading index.html from:', indexPath);
    mainWindow.loadFile(indexPath).catch((err) => {
      console.error('Error loading file:', err);
      // Fallback
      const fallbackPath = path.join(app.getAppPath(), 'dist', 'index.html');
      console.log('Trying fallback path:', fallbackPath);
      mainWindow?.loadFile(fallbackPath);
    });
  }

  // Focus handling
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ Page loaded successfully');
    mainWindow?.focus();
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('❌ Failed to load:', errorCode, errorDescription);
  });

  mainWindow.on('focus', () => {
    mainWindow?.focus();
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      mainWindow?.focus();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
