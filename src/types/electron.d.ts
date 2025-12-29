export interface ElectronAPI {
  platform: string;
  version: string;
  appName: string;
  checkForUpdates: () => Promise<{
    success?: boolean;
    error?: string;
    updateInfo?: any;
    message?: string;
  }>;
  getAppVersion: () => string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

