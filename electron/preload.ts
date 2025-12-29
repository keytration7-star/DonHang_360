import { contextBridge, ipcRenderer } from 'electron';

// Đọc version từ package.json - sử dụng require vì preload chạy trong Node context
let appVersion = '1.0.1';
let appName = 'donhang-360';

try {
  // Sử dụng require để đọc package.json (CommonJS)
  // @ts-ignore - require có sẵn trong Node context
  const packageJson = require('../package.json');
  appVersion = packageJson.version || appVersion;
  appName = packageJson.name || appName;
} catch (error) {
  console.warn('Không thể đọc package.json:', error);
}

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: appVersion,
  appName: appName,
  // Expose IPC để gọi check update từ renderer
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getAppVersion: () => appVersion,
});
