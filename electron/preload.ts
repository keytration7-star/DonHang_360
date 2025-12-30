import { contextBridge, ipcRenderer } from 'electron';

// Lấy version từ main process qua IPC (đáng tin cậy hơn trong production)
// app.getVersion() tự động đọc từ package.json khi build
let appVersion = '1.0.1';
let appName = 'donhang-360';

// Lấy version ngay lập tức (sync) từ main process
// Nếu không có, sẽ dùng fallback
try {
  // Trong production, app.getVersion() sẽ trả về version từ package.json đã được build
  // Nhưng trong preload context, chúng ta cần gọi qua IPC
  // Tạm thời dùng fallback, sẽ được update khi renderer gọi getAppVersion()
} catch (error) {
  console.warn('Không thể khởi tạo version:', error);
}

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: appVersion, // Fallback value, sẽ được update
  appName: appName,
  // Expose IPC để gọi check update từ renderer
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getAppVersion: async () => {
    // Lấy version mới nhất từ main process mỗi lần gọi
    try {
      const version = await ipcRenderer.invoke('get-app-version');
      appVersion = version; // Update cached value
      return version;
    } catch (error) {
      console.warn('Không thể lấy version từ main process:', error);
      // Fallback: thử đọc từ package.json
      try {
        // @ts-ignore
        const packageJson = require('../package.json');
        appVersion = packageJson.version || appVersion;
        return appVersion;
      } catch (e) {
        return appVersion; // Return cached value
      }
    }
  },
  getAppName: async () => {
    try {
      const name = await ipcRenderer.invoke('get-app-name');
      appName = name;
      return name;
    } catch (error) {
      return appName;
    }
  },
});
