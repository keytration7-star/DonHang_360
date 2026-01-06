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
  downloadUpdate: () => Promise<{ success?: boolean; error?: string }>;
  installUpdate: () => Promise<{ success?: boolean; error?: string }>;
  getAppVersion: () => Promise<string>;
  onUpdateAvailable: (callback: (info: any) => void) => void;
  onUpdateDownloadProgress: (callback: (progress: any) => void) => void;
  onUpdateDownloaded: (callback: (info: any) => void) => void;
  onUpdateDownloadError: (callback: (error: any) => void) => void;
  onUpdateError: (callback: (error: any) => void) => void;
  removeUpdateListeners: () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

