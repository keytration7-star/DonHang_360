import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

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
    icon: path.join(__dirname, '../assets/icon.png'),
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
    mainWindow.webContents.openDevTools();
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

