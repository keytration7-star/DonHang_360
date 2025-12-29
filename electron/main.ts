import { app, BrowserWindow, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Import và cấu hình auto-updater (chỉ trong production)
let autoUpdater: any = null;

function initAutoUpdater() {
  if (isDev) return;
  
  try {
    // Sử dụng require cho CommonJS module (sẽ được build thành require trong output)
    // @ts-ignore - electron-updater là CommonJS module
    const electronUpdater = require('electron-updater');
    autoUpdater = electronUpdater.autoUpdater;
    
    // Cấu hình auto-updater
    autoUpdater.setAutoDownload(false);
    autoUpdater.setAutoInstallOnAppQuit(true);
    
    setupAutoUpdater();
  } catch (error) {
    console.error('Lỗi import electron-updater:', error);
  }
}

function setupAutoUpdater() {
  if (!autoUpdater) return;
  // Check for updates khi app khởi động
  app.whenReady().then(() => {
    autoUpdater.checkForUpdates().catch(err => {
      console.error('Lỗi kiểm tra cập nhật:', err);
    });
  });

  // Check for updates mỗi 4 giờ
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(err => {
      console.error('Lỗi kiểm tra cập nhật:', err);
    });
  }, 4 * 60 * 60 * 1000); // 4 giờ

  // Event handlers cho auto-updater
  autoUpdater.on('checking-for-update', () => {
    console.log('Đang kiểm tra cập nhật...');
  });

  autoUpdater.on('update-available', (info: any) => {
    console.log('Có bản cập nhật mới:', info.version);
    dialog.showMessageBox({
      type: 'info',
      title: 'Có bản cập nhật mới',
      message: `Phiên bản ${info.version} đã có sẵn. Bạn có muốn tải xuống ngay bây giờ?`,
      buttons: ['Tải xuống', 'Bỏ qua'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate().catch((err: Error) => {
          console.error('Lỗi tải cập nhật:', err);
          dialog.showErrorBox('Lỗi', 'Không thể tải cập nhật. Vui lòng thử lại sau.');
        });
      }
    });
  });

  autoUpdater.on('update-not-available', (info: any) => {
    console.log('Đã có phiên bản mới nhất:', info.version);
  });

  autoUpdater.on('error', (err: Error) => {
    console.error('Lỗi auto-updater:', err);
  });

  autoUpdater.on('download-progress', (progressObj: any) => {
    let log_message = `Tốc độ tải: ${progressObj.bytesPerSecond} - Đã tải: ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
    console.log(log_message);
  });

  autoUpdater.on('update-downloaded', (info: any) => {
    console.log('Đã tải xong cập nhật:', info.version);
    dialog.showMessageBox({
      type: 'info',
      title: 'Cập nhật đã sẵn sàng',
      message: `Phiên bản ${info.version} đã được tải xuống. Ứng dụng sẽ được cập nhật khi bạn khởi động lại.`,
      buttons: ['Khởi động lại ngay', 'Khởi động lại sau'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });
}

// Khởi tạo auto-updater
initAutoUpdater();

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: 'Đơn Hàng 360 - Quản Lý Đơn Hàng',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // Cải thiện xử lý input và focus
      spellcheck: false,
      enableWebSQL: false,
      // Đảm bảo input hoạt động tốt
      backgroundThrottling: false,
    },
    icon: path.join(__dirname, '../icon.ico'),
    titleBarStyle: 'default',
    frame: true,
    // Đảm bảo window có thể nhận focus
    focusable: true,
    show: false, // Ẩn window cho đến khi sẵn sàng
  });

  // Hiển thị window khi đã sẵn sàng để tránh vấn đề focus
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Xử lý focus để input hoạt động đúng
  mainWindow.webContents.on('did-finish-load', () => {
    // Đảm bảo window có focus sau khi load xong
    if (!mainWindow.isFocused()) {
      mainWindow.focus();
    }
  });

  // Xử lý khi window nhận focus
  mainWindow.on('focus', () => {
    mainWindow.webContents.focus();
  });

  if (isDev) {
    // Clear cache before loading to avoid old code (KHÔNG xóa IndexedDB - dữ liệu quan trọng!)
    mainWindow.webContents.session.clearCache();
    // KHÔNG gọi clearStorageData() vì nó sẽ xóa IndexedDB và mất dữ liệu!
    // mainWindow.webContents.session.clearStorageData(); // ĐÃ XÓA - giữ dữ liệu IndexedDB
    // Add timestamp to URL to bypass cache
    mainWindow.loadURL(`http://localhost:5173?t=${Date.now()}`, { 
      extraHeaders: 'pragma: no-cache\ncache-control: no-cache\n' 
    });
    // Chỉ mở DevTools khi có biến môi trường ENABLE_DEVTOOLS hoặc khi chạy với flag
    if (process.env.ENABLE_DEVTOOLS === 'true') {
      mainWindow.webContents.openDevTools();
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
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

