import { useState, useEffect, useRef } from 'react';
import { Save, Database, Trash2, Info, X, Settings as SettingsIcon, RefreshCw, CheckCircle, RotateCcw, Wifi, WifiOff, Moon, Sun, Lock, Unlock, BookOpen, Key } from 'lucide-react';
// ⚠️ DISABLED: Excel-based services - removed
// import { indexedDBService } from '../../../services/indexedDBService'; // REMOVED
// import { firebaseService } from '../../../services/firebaseService'; // TODO: Re-enable in future
import { backupService } from '../../../services/backupService';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import { useAutoFocus } from '../../../shared/hooks/useAutoFocus';
import ApiSettings from '../components/ApiSettings';

const Settings = () => {
  // Load Firebase config từ localStorage hoặc env vars (để hỗ trợ hardcode sẵn)
  const [firebaseConfig, setFirebaseConfig] = useState({
    apiKey: localStorage.getItem('firebase_apiKey') || import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: localStorage.getItem('firebase_authDomain') || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    databaseURL: localStorage.getItem('firebase_databaseURL') || import.meta.env.VITE_FIREBASE_DATABASE_URL || '',
    projectId: localStorage.getItem('firebase_projectId') || import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: localStorage.getItem('firebase_storageBucket') || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: localStorage.getItem('firebase_messagingSenderId') || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: localStorage.getItem('firebase_appId') || import.meta.env.VITE_FIREBASE_APP_ID || '',
  });

  const [storageInfo, setStorageInfo] = useState<{ count: number; estimatedSize: number } | null>(null);
  const [showFirebaseModal, setShowFirebaseModal] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('1.0.1');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string>('');
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloaded, setDownloaded] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showDataManagementModal, setShowDataManagementModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showAdminPasswordModal, setShowAdminPasswordModal] = useState(false);
  const [showApiSettingsModal, setShowApiSettingsModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [pendingAction, setPendingAction] = useState<'firebase' | 'data' | null>(null);
  const [lockPassword, setLockPassword] = useState('');
  const [lockPasswordConfirm, setLockPasswordConfirm] = useState('');
  const [appPassword, setAppPassword] = useState(() => {
    return localStorage.getItem('app_password') || '';
  });
  const [unlockPassword, setUnlockPassword] = useState('');
  // Removed useOrderStore - app now uses API only
  const syncEnabled = false;
  const syncStatus: 'idle' | 'syncing' | 'synced' | 'error' = 'idle';
  const syncError: string | null = null;
  const enableSync = () => {};
  const disableSync = () => {};
  const { theme, toggleTheme } = useTheme();
  
  
  // Refs cho các input password
  const unlockPasswordRef = useRef<HTMLInputElement>(null);
  const lockPasswordRef = useRef<HTMLInputElement>(null);
  const lockPasswordConfirmRef = useRef<HTMLInputElement>(null);
  const adminPasswordRef = useRef<HTMLInputElement>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastProgressRef = useRef<number>(0);
  const downloadingRef = useRef<boolean>(false);
  const downloadProgressRef = useRef<number>(0);

  useEffect(() => {
    loadStorageInfo();
    
    // Đảm bảo mặc định sync bị tắt khi app khởi động (nếu chưa từng được bật)
    // Chỉ bật sync khi user click nút "Kết nối"
    if (localStorage.getItem('firebase_sync_disabled') === null) {
      // Nếu chưa có flag, mặc định tắt sync
      localStorage.setItem('firebase_sync_disabled', 'true');
    }
    
    // Kiểm tra trạng thái sync từ localStorage khi component mount
    const syncDisabled = localStorage.getItem('firebase_sync_disabled') === 'true';
    if (syncDisabled && syncEnabled) {
      // Nếu localStorage nói đã tắt nhưng store vẫn bật, tắt lại
      disableSync();
    }
    // KHÔNG tự động bật sync - chỉ bật khi user click nút "Kết nối"
    
    // Lấy version từ Electron API nếu có
    if (window.electronAPI) {
      // Gọi async để lấy version mới nhất từ main process
      window.electronAPI.getAppVersion().then((version: string) => {
        if (typeof version === 'string') {
          setAppVersion(version);
        } else {
          setAppVersion('1.0.1');
        }
      }).catch(() => {
        // Fallback nếu không lấy được
        const fallbackVersion = window.electronAPI?.version;
        setAppVersion(typeof fallbackVersion === 'string' ? fallbackVersion : '1.0.1');
      });
      
      // Lắng nghe download progress events - ĐẢM BẢO LUÔN NHẬN ĐƯỢC
      const progressHandler = (progress: any) => {
        // Log an toàn - chỉ log các giá trị primitive
        console.log('📥 [Settings] Nhận được download progress event:', {
          percent: progress?.percent,
          transferred: progress?.transferred,
          total: progress?.total,
          bytesPerSecond: progress?.bytesPerSecond
        });
        setDownloading(true); // Đảm bảo downloading = true khi có progress
        downloadingRef.current = true; // Cập nhật ref
        
        let percent = 0;
        if (progress && typeof progress.percent === 'number') {
          percent = Math.max(0, Math.min(100, Math.round(progress.percent)));
        } else if (progress && progress.transferred && progress.total) {
          // Tính percent từ transferred/total nếu percent không có
          percent = Math.max(0, Math.min(100, Math.round((progress.transferred / progress.total) * 100)));
        }
        
        setDownloadProgress(percent);
        downloadProgressRef.current = percent; // Lưu progress vào ref
        lastProgressRef.current = percent; // Lưu progress mới nhất để so sánh
        console.log(`📊 [Settings] Cập nhật download progress: ${percent}%`);
      };
      
      window.electronAPI.onUpdateDownloadProgress(progressHandler);
      console.log('✅ [Settings] Đã đăng ký listener cho update-download-progress');
      
      // Thêm interval để force update progress nếu không nhận được event
      // Điều này đảm bảo UI luôn được cập nhật ngay cả khi event bị mất
      progressIntervalRef.current = setInterval(() => {
        // Sử dụng ref để truy cập state mới nhất mà không cần dependency
        if (downloadingRef.current && downloadProgressRef.current < 100) {
          const currentProgress = downloadProgressRef.current;
          // Nếu progress không thay đổi trong 2 giây, có thể event bị mất
          // Nhưng không force update vì có thể đang tải trong background
          if (currentProgress === lastProgressRef.current && currentProgress < 100) {
            // Progress không thay đổi - có thể đang tải trong background
          }
        }
      }, 2000); // Check mỗi 2 giây
      
      // Lắng nghe download completed event
      window.electronAPI.onUpdateDownloaded((info: any) => {
        console.log('✅ Nhận được update-downloaded event:', {
          version: info?.version || 'N/A',
          hasReleaseNotes: !!info?.releaseNotes
        });
        setDownloaded(true);
        setDownloading(false);
        downloadingRef.current = false;
        setDownloadProgress(100);
        downloadProgressRef.current = 100;
        setDownloadError(null); // Clear error khi download thành công
      });
      
      // Lắng nghe download error event
      window.electronAPI.onUpdateDownloadError((error: any) => {
        let errorMsg = 'Lỗi tải cập nhật';
        try {
          if (error?.error) {
            errorMsg = typeof error.error === 'string' ? error.error : String(error.error);
          } else if (error?.message) {
            errorMsg = typeof error.message === 'string' ? error.message : String(error.message);
          } else if (error) {
            errorMsg = typeof error === 'string' ? error : JSON.stringify(error);
          }
        } catch (e) {
          errorMsg = 'Lỗi tải cập nhật';
        }
        console.error('❌ Nhận được update-download-error event:', errorMsg);
        setDownloadError(errorMsg);
        setDownloading(false);
        downloadingRef.current = false;
        setDownloadProgress(0);
        downloadProgressRef.current = 0;
      });
      
      // Không cần onUpdateInstalling - app sẽ tự động đóng khi install
    }
    
    // Cleanup listeners khi component unmount
    return () => {
      if (window.electronAPI?.removeUpdateListeners) {
        window.electronAPI.removeUpdateListeners();
        console.log('🧹 [Settings] Đã cleanup update listeners');
      }
      // Clear interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, []); // Empty deps - chỉ chạy một lần khi mount

  const loadStorageInfo = async () => {
    try {
      // Storage info no longer needed - app uses API
      setStorageInfo({ count: 0, estimatedSize: 0 });
    } catch (error) {
      console.error('Lỗi lấy thông tin storage:', error);
    }
  };

  const handleSave = () => {
    Object.entries(firebaseConfig).forEach(([key, value]) => {
      localStorage.setItem(`firebase_${key}`, value);
    });
    alert('Đã lưu cấu hình Firebase! Vui lòng khởi động lại ứng dụng để áp dụng thay đổi.');
    setShowFirebaseModal(false);
  };

  // Kiểm tra xem Firebase đã được cấu hình chưa
  const isFirebaseConfigured = () => {
    return !!(firebaseConfig.apiKey && firebaseConfig.databaseURL);
  };

  // Xóa toàn bộ dữ liệu (TẠM THỜI: DISABLED - tính năng đang phát triển)
  const handleDeleteAll = async () => {
    alert('⚠️ Tính năng "Quản lý dữ liệu" đang phát triển và chưa kết nối với app.\n\nVui lòng sử dụng các tính năng khác trong app.');
    return;
    
    // CODE TẠM THỜI BỊ DISABLE - ĐỂ PHÁT TRIỂN SAU
    /*
    const confirmed = window.confirm(
      '⚠️ CẢNH BÁO: Bạn có CHẮC CHẮN muốn xóa TẤT CẢ dữ liệu?\n\n' +
      'Hành động này sẽ:\n' +
      '1. Xóa tất cả dữ liệu trên Firebase (tất cả máy tính sẽ tự động xóa)\n' +
      '2. Xóa tất cả dữ liệu trên máy tính này (IndexedDB)\n' +
      '3. Xóa file backup\n\n' +
      '⚠️ Hành động này KHÔNG THỂ hoàn tác!\n\n' +
      'Nhấn OK để tiếp tục, Cancel để hủy.'
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    try {
      // 1. Ngắt kết nối Firebase sync trước để tránh xung đột
      disableSync();
      console.log('🛑 Đã ngắt kết nối Firebase sync');

      // 2. Xóa Firebase trước (sẽ tự động sync đến tất cả máy)
      const isFirebaseConfigured = !!(localStorage.getItem('firebase_apiKey') && localStorage.getItem('firebase_databaseURL'));
      if (isFirebaseConfigured) {
        try {
          console.log('🗑️ Đang xóa dữ liệu trên Firebase...');
          await firebaseService.clearAllOrders();
          console.log('✅ Đã xóa dữ liệu trên Firebase thành công');
          
          // Đợi một chút để Firebase xử lý
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error('❌ Lỗi xóa Firebase:', error);
          // Vẫn tiếp tục xóa local data ngay cả khi Firebase lỗi
        }
      }

      // 3. Xóa IndexedDB
      console.log('🗑️ Đang xóa dữ liệu trên IndexedDB...');
      await indexedDBService.clearAll();
      console.log('✅ Đã xóa dữ liệu trên IndexedDB thành công');

      // 4. Xóa backup
      console.log('🗑️ Đang xóa file backup...');
      // backupService.clearBackup(); // Method không tồn tại
      console.log('✅ Đã xóa file backup thành công');

      // 5. Xóa localStorage orders (nếu có - legacy data)
      console.log('🗑️ Đang xóa dữ liệu trong localStorage...');
      try {
        localStorage.removeItem('donhang360_orders');
        console.log('✅ Đã xóa dữ liệu trong localStorage thành công');
      } catch (error) {
        console.warn('⚠️ Lỗi xóa localStorage (có thể không tồn tại):', error);
      }

      // 6. Clear store
      console.log('🗑️ Đang xóa dữ liệu trong store...');
      // Removed - app uses API store now
      console.log('✅ Đã xóa dữ liệu trong store thành công');

      alert('✅ Đã xóa toàn bộ dữ liệu thành công!\n\n' +
            'Tất cả máy tính đã kết nối Firebase sẽ tự động xóa dữ liệu.');

      setShowDeleteModal(false);
      await loadStorageInfo();
      
      // Reload sau 1 giây để đảm bảo tất cả đã được xóa
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Không xác định';
      alert('❌ Lỗi xóa dữ liệu: ' + errorMessage);
      console.error('❌ Lỗi xóa dữ liệu:', error);
    } finally {
      setDeleting(false);
    }
    */
  };

  // Khôi phục từ backup (TẠM THỜI: DISABLED - tính năng đang phát triển)
  const handleRestore = async () => {
    alert('⚠️ Tính năng "Quản lý dữ liệu" đang phát triển và chưa kết nối với app.\n\nVui lòng sử dụng các tính năng khác trong app.');
    return;
    
    // CODE TẠM THỜI BỊ DISABLE - ĐỂ PHÁT TRIỂN SAU
    /*
    if (!backupService.hasBackup()) {
      alert('Không tìm thấy file backup!');
      return;
    }

    const confirmed = window.confirm(
      '⚠️ Bạn có chắc muốn khôi phục dữ liệu từ backup?\n\n' +
      'Dữ liệu hiện tại sẽ bị thay thế hoàn toàn bằng dữ liệu từ backup.\n\n' +
      'Nhấn OK để tiếp tục, Cancel để hủy.'
    );

    if (!confirmed) {
      return;
    }

    setRestoring(true);
    try {
      // Lấy backup data trước
      const backupInfo = await backupService.getBackupInfo();
      if (!backupInfo) {
        alert('❌ Không tìm thấy backup nào!');
        setRestoring(false);
        return;
      }
      
      const backupData = await backupService.getBackupData(backupInfo.id);
      if (!backupData || !backupData.orders) {
        alert('❌ Không thể đọc dữ liệu backup!');
        setRestoring(false);
        return;
      }
      
      const orders = backupData.orders;
      
      // Xóa dữ liệu cũ
      await indexedDBService.clearAll();
      
      // Thêm dữ liệu từ backup
      await indexedDBService.addOrders(orders);
      
      // Đồng bộ lên Firebase nếu có
      const isFirebaseConfigured = !!(localStorage.getItem('firebase_apiKey') && localStorage.getItem('firebase_databaseURL'));
      if (isFirebaseConfigured) {
        try {
          await firebaseService.addOrders(orders);
          console.log('✅ Đã đồng bộ dữ liệu lên Firebase');
        } catch (error) {
          console.warn('⚠️ Lỗi đồng bộ Firebase:', error);
        }
      }

      alert(`✅ Đã khôi phục ${orders.length} đơn hàng từ backup thành công!`);

      setShowRestoreModal(false);
      // fetchOrders removed - app uses API
      await loadStorageInfo();
      window.location.reload();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Không xác định';
      alert('❌ Lỗi khôi phục backup: ' + errorMessage);
      console.error('❌ Lỗi khôi phục backup:', error);
    } finally {
      setRestoring(false);
    }
    */
  };

  const formatSize = (bytes: number): string => {
    if (typeof bytes !== 'number' || isNaN(bytes)) return '0 B';
    if (bytes < 1024) return String(bytes) + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-full transition-colors">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Cài đặt</h1>
      </div>

      {/* Storage Info - Compact */}
      {storageInfo && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info size={20} className="text-blue-600 dark:text-blue-400" />
              <span className="font-semibold text-blue-800 dark:text-blue-300">Thông tin lưu trữ</span>
            </div>
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <span className="font-medium">{typeof storageInfo.count === 'number' ? storageInfo.count.toLocaleString() : '0'}</span> đơn hàng • 
              <span className="font-medium ml-1">{formatSize(storageInfo.estimatedSize)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Settings Grid - Icon & Title Only */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Firebase Configuration */}
        <button
          onClick={() => {
            setPendingAction('firebase');
            setShowAdminPasswordModal(true);
          }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-all border-2 border-transparent hover:border-primary-500 flex flex-col items-center justify-center gap-3 min-h-[140px] text-gray-900 dark:text-gray-100"
        >
          <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
            <Database size={32} className="text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 text-center">Cấu hình Firebase</h3>
          {isFirebaseConfigured() && (
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">✓ Đã cấu hình</span>
          )}
        </button>

        {/* Data Management */}
        <button
          onClick={() => {
            setPendingAction('data');
            setShowAdminPasswordModal(true);
          }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-all border-2 border-transparent hover:border-primary-500 flex flex-col items-center justify-center gap-3 min-h-[140px] text-gray-900 dark:text-gray-100"
        >
          <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-full">
            <RotateCcw size={32} className="text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 text-center">Quản lý dữ liệu</h3>
          {backupService.hasBackup() && (
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
              {backupService.getBackupInfo()?.orderCount || 0} đơn backup
            </span>
          )}
        </button>

        {/* Dark Mode Toggle */}
        <button
          onClick={() => {
            toggleTheme();
          }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-all border-2 border-transparent hover:border-primary-500 flex flex-col items-center justify-center gap-3 min-h-[140px] text-gray-900 dark:text-gray-100"
        >
          <div className={`p-3 rounded-full ${theme === 'dark' ? 'bg-yellow-100 dark:bg-yellow-900' : 'bg-gray-100 dark:bg-gray-700'}`}>
            {theme === 'dark' ? (
              <Sun size={32} className="text-yellow-600 dark:text-yellow-400" />
            ) : (
              <Moon size={32} className="text-gray-600 dark:text-gray-400" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 text-center">
            {theme === 'dark' ? 'Giao diện tối' : 'Giao diện sáng'}
          </h3>
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {theme === 'dark' ? 'Đang bật' : 'Đang tắt'}
          </span>
        </button>

        {/* App Lock */}
        <button
          onClick={() => setShowLockModal(true)}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-all border-2 border-transparent hover:border-primary-500 flex flex-col items-center justify-center gap-3 min-h-[140px] text-gray-900 dark:text-gray-100"
        >
          <div className={`p-3 rounded-full ${appPassword ? 'bg-red-100 dark:bg-red-900' : 'bg-gray-100 dark:bg-gray-700'}`}>
            {appPassword ? (
              <Lock size={32} className="text-red-600 dark:text-red-400" />
            ) : (
              <Unlock size={32} className="text-gray-600 dark:text-gray-400" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 text-center">Khóa ứng dụng</h3>
          {appPassword ? (
            <span className="text-xs text-red-600 dark:text-red-400 font-medium">Đã bật</span>
          ) : (
            <span className="text-xs text-gray-600 dark:text-gray-400">Chưa bật</span>
          )}
        </button>

        {/* About App */}
        <button
          onClick={() => setShowAboutModal(true)}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-all border-2 border-transparent hover:border-primary-500 flex flex-col items-center justify-center gap-3 min-h-[140px] text-gray-900 dark:text-gray-100"
        >
          <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-full">
            <BookOpen size={32} className="text-orange-600 dark:text-orange-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 text-center">Giới thiệu</h3>
        </button>

        {/* API Settings */}
        <button
          onClick={() => setShowApiSettingsModal(true)}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-all border-2 border-transparent hover:border-primary-500 flex flex-col items-center justify-center gap-3 min-h-[140px] text-gray-900 dark:text-gray-100"
        >
          <div className="p-3 bg-indigo-100 dark:bg-indigo-900 rounded-full">
            <Key size={32} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 text-center">Cấu hình API</h3>
          <span className="text-xs text-gray-600 dark:text-gray-400">Pancake API</span>
        </button>

        {/* App Version */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-2 border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center gap-3 min-h-[140px]">
          <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-full">
            <Info size={32} className="text-orange-600 dark:text-orange-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 text-center">Phiên bản</h3>
          <span className="text-sm text-gray-600 dark:text-gray-400">v{appVersion}</span>
        </div>
      </div>

      {/* Data Management Modal */}
      {showDataManagementModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" 
          onClick={() => setShowDataManagementModal(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <RotateCcw size={24} className="text-primary-600" />
                <h2 className="text-2xl font-bold text-gray-800">Quản lý dữ liệu</h2>
              </div>
              <button
                onClick={() => setShowDataManagementModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Hệ thống tự động backup dữ liệu khi có thay đổi. Bạn có thể khôi phục từ backup hoặc xóa toàn bộ dữ liệu.
              </p>

              {/* Backup Info */}
              {backupService.hasBackup() && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>File backup có sẵn:</strong> {backupService.getBackupInfo()?.orderCount || 0} đơn hàng
                    <br />
                    <span className="text-xs text-blue-600">
                      Thời gian: {backupService.getBackupInfo()?.timestamp ? new Date(backupService.getBackupInfo()!.timestamp).toLocaleString('vi-VN') : 'Không xác định'}
                    </span>
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setShowDataManagementModal(false);
                    setShowRestoreModal(true);
                  }}
                  disabled={!backupService.hasBackup()}
                  className="bg-blue-500 text-white p-4 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <RotateCcw size={20} />
                  Khôi phục từ backup
                </button>

                <button
                  onClick={() => {
                    setShowDataManagementModal(false);
                    setShowDeleteModal(true);
                  }}
                  className="bg-red-500 text-white p-4 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Trash2 size={20} />
                  Xóa toàn bộ dữ liệu
                </button>
              </div>

              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Lưu ý:</strong> Hệ thống tự động backup khi có dữ liệu mới. 
                  Khi xóa dữ liệu, tất cả máy tính đã kết nối Firebase sẽ tự động xóa dữ liệu.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Firebase Configuration Modal */}
      {showFirebaseModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" 
          onClick={() => setShowFirebaseModal(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <Database size={24} className="text-primary-600" />
                <h2 className="text-2xl font-bold text-gray-800">Cấu hình Firebase</h2>
              </div>
              <button
                onClick={() => setShowFirebaseModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <p className="text-sm text-gray-600">
                Cấu hình Firebase để đồng bộ dữ liệu giữa các thiết bị. Nếu không cấu hình, dữ liệu sẽ chỉ lưu trên máy tính này.
              </p>

              {isFirebaseConfigured() && (
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      <strong>✓ Firebase đã được cấu hình</strong>
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      Database URL: {firebaseConfig.databaseURL.substring(0, 50)}...
                    </p>
                  </div>
                  
                  {/* Firebase Connection Status */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      {syncEnabled ? (
                        <>
                          <div className="flex items-center gap-2">
                            <Wifi size={20} className="text-green-600" />
                            <span className="text-sm font-medium text-gray-800">Đã kết nối Firebase</span>
                          </div>
                          {/* Sync status display removed - app uses API */}
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <WifiOff size={20} className="text-gray-400" />
                          <span className="text-sm font-medium text-gray-600">Đã ngắt kết nối Firebase</span>
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={() => {
                        if (syncEnabled) {
                          disableSync();
                          setTimeout(() => {
                            window.dispatchEvent(new Event('storage'));
                          }, 100);
                        } else {
                          enableSync();
                          setTimeout(() => {
                            window.dispatchEvent(new Event('storage'));
                          }, 100);
                        }
                      }}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm font-medium ${
                        syncEnabled
                          ? 'bg-red-500 text-white hover:bg-red-600'
                          : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                    >
                      {syncEnabled ? (
                        <>
                          <WifiOff size={16} />
                          Ngắt kết nối
                        </>
                      ) : (
                        <>
                          <Wifi size={16} />
                          Kết nối
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Hướng dẫn:</strong> Để lấy thông tin cấu hình Firebase, vào Firebase Console → Project Settings → General → Your apps → Web app.
                  Copy các thông tin tương ứng vào các ô bên dưới.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={firebaseConfig.apiKey}
                    onChange={(e) => setFirebaseConfig({ ...firebaseConfig, apiKey: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="AIza..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Auth Domain</label>
                  <input
                    type="text"
                    value={firebaseConfig.authDomain}
                    onChange={(e) => setFirebaseConfig({ ...firebaseConfig, authDomain: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="your-project.firebaseapp.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Database URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={firebaseConfig.databaseURL}
                    onChange={(e) => setFirebaseConfig({ ...firebaseConfig, databaseURL: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="https://your-project.firebaseio.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">URL của Firebase Realtime Database</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project ID</label>
                  <input
                    type="text"
                    value={firebaseConfig.projectId}
                    onChange={(e) => setFirebaseConfig({ ...firebaseConfig, projectId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="your-project-id"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Storage Bucket</label>
                  <input
                    type="text"
                    value={firebaseConfig.storageBucket}
                    onChange={(e) => setFirebaseConfig({ ...firebaseConfig, storageBucket: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="your-project.appspot.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Messaging Sender ID</label>
                  <input
                    type="text"
                    value={firebaseConfig.messagingSenderId}
                    onChange={(e) => setFirebaseConfig({ ...firebaseConfig, messagingSenderId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="123456789"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">App ID</label>
                  <input
                    type="text"
                    value={firebaseConfig.appId}
                    onChange={(e) => setFirebaseConfig({ ...firebaseConfig, appId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="1:123456789:web:abc123"
                  />
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Lưu ý:</strong> Chỉ cần điền <strong>API Key</strong> và <strong>Database URL</strong> là đủ để sử dụng Firebase Realtime Database.
                    Các trường khác là tùy chọn.
                  </p>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800 mb-2">
                    <strong>⚠️ Quan trọng - Cấu hình Database Rules:</strong>
                  </p>
                  <p className="text-xs text-red-700 mb-2">
                    Sau khi cấu hình Firebase, bạn <strong>PHẢI</strong> cấu hình Database Rules để app có thể đọc/ghi dữ liệu:
                  </p>
                  <ol className="text-xs text-red-700 list-decimal list-inside space-y-1 mb-2">
                    <li>Vào <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Firebase Console</a></li>
                    <li>Chọn project của bạn</li>
                    <li>Vào <strong>Realtime Database</strong> → <strong>Rules</strong></li>
                    <li>Đặt rules như sau:</li>
                  </ol>
                  <pre className="bg-red-100 p-2 rounded text-xs overflow-x-auto">
{`{
  "rules": {
    ".read": true,
    ".write": true
  }
}`}
                  </pre>
                  <p className="text-xs text-red-700 mt-2">
                    <strong>Lưu ý:</strong> Rules này cho phép tất cả người dùng đọc/ghi. Nếu muốn bảo mật hơn, hãy sử dụng Firebase Authentication.
                  </p>
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={handleSave}
                    disabled={!firebaseConfig.apiKey || !firebaseConfig.databaseURL}
                    className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Save size={20} />
                    Lưu cấu hình
                  </button>
                  <button
                    onClick={() => setShowFirebaseModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Firebase Data Modal */}
      {/* Delete All Data Modal */}
      {showDeleteModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" 
          onClick={() => {
            setShowDeleteModal(false);
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-md w-full" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-full">
                  <Trash2 size={24} className="text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800">Xóa toàn bộ dữ liệu</h2>
              </div>
              
                  <div className="mb-4">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                  <p className="text-sm text-red-800 dark:text-red-300 font-semibold mb-2">
                    ⚠️ Cảnh báo: Hành động này không thể hoàn tác!
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-400">
                    Tất cả dữ liệu trên Firebase và máy tính này sẽ bị xóa vĩnh viễn. 
                    Tất cả máy tính đã kết nối Firebase sẽ tự động xóa dữ liệu.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleDeleteAll}
                  disabled={deleting}
                  className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {deleting ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      Đang xóa...
                    </>
                  ) : (
                    <>
                      <Trash2 size={18} />
                      Xóa toàn bộ
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                  }}
                  disabled={deleting}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Restore Backup Modal */}
      {showRestoreModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" 
          onClick={() => {
            setShowRestoreModal(false);
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-md w-full" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-full">
                  <RotateCcw size={24} className="text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800">Khôi phục từ backup</h2>
              </div>
              
              <div className="mb-4">
                {backupService.hasBackup() ? (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-blue-800 font-semibold mb-2">
                        Thông tin backup:
                      </p>
                      <p className="text-sm text-blue-700">
                        Số đơn hàng: {backupService.getBackupInfo()?.orderCount || 0}
                        <br />
                        Thời gian: {backupService.getBackupInfo()?.timestamp ? new Date(backupService.getBackupInfo()!.timestamp).toLocaleString('vi-VN') : 'Không xác định'}
                      </p>
                    </div>
                    
                  </>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      Không tìm thấy file backup!
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleRestore}
                  disabled={!backupService.hasBackup() || restoring}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {restoring ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      Đang khôi phục...
                    </>
                  ) : (
                    <>
                      <RotateCcw size={18} />
                      Khôi phục
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowRestoreModal(false);
                  }}
                  disabled={restoring}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* App Version & Update - Compact */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-gray-600">Phiên bản:</span>
              <span className="text-sm font-medium text-gray-800">v{appVersion}</span>
              {updateStatus && !downloading && (
                <span className={`text-xs ${updateStatus.includes('mới nhất') ? 'text-green-600' : updateStatus.includes('Lỗi') ? 'text-red-600' : 'text-gray-600'}`}>
                  {updateStatus.includes('mới nhất') && <CheckCircle size={12} className="inline mr-1" />}
                  {updateStatus}
                </span>
              )}
            </div>
            
            {/* Progress bar khi đang tải */}
            {downloading && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600 flex items-center gap-1">
                    <RefreshCw size={12} className="animate-spin text-blue-600" />
                    Đang tải cập nhật...
                  </span>
                  <span className="text-xs font-semibold text-blue-600">{Math.round(downloadProgress || 0)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-2.5 rounded-full transition-all duration-300 ease-out bg-gradient-to-r from-blue-500 to-blue-600"
                    style={{ width: `${Math.min(100, Math.max(0, downloadProgress || 0))}%` }}
                  />
                </div>
                {(downloadProgress === 0 || !downloadProgress) && downloading ? (
                  <p className="text-xs text-gray-500">Đang khởi tạo tải xuống... Vui lòng đợi trong giây lát.</p>
                ) : downloadProgress > 0 && downloadProgress < 100 ? (
                  <p className="text-xs text-gray-500">Đang tải... ({Math.round(downloadProgress)}%) - Vui lòng không tắt ứng dụng.</p>
                ) : downloadProgress >= 100 ? (
                  <p className="text-xs text-green-600 font-medium">✅ Đã tải xong! Sẵn sàng cài đặt.</p>
                ) : null}
              </div>
            )}
            
            {/* Lỗi tải */}
            {downloadError && (
              <span className="text-xs text-red-600 block mt-1">
                {downloadError.length > 50 ? downloadError.substring(0, 50) + '...' : downloadError}
              </span>
            )}
            
            {/* Đã tải xong */}
            {downloaded && !downloading && (
              <span className="text-xs text-green-600 block mt-1 flex items-center gap-1">
                <CheckCircle size={12} />
                Đã tải xong, sẵn sàng cài đặt
              </span>
            )}
          </div>
          
          {window.electronAPI && (
            <div className="flex items-center gap-2">
              {!updateInfo ? (
                <button
                  onClick={async () => {
                    setCheckingUpdate(true);
                    setUpdateStatus('Đang kiểm tra...');
                    setUpdateInfo(null);
                    setDownloadError(null);
                    try {
                      const result = await window.electronAPI!.checkForUpdates();
                      
                      // Kiểm tra xem có update không
                      if (result.updateInfo) {
                        // Có phiên bản mới - lưu updateInfo để hiển thị nút tải về
                        setUpdateInfo(result.updateInfo);
                        setUpdateStatus(`Có cập nhật v${result.updateInfo.version}`);
                      } else if (result.success && !result.error) {
                        // Không có update mới (success nhưng không có updateInfo)
                        setUpdateStatus('Đây là phiên bản mới nhất');
                        setUpdateInfo(null);
                      } else if (result.error) {
                        // Có lỗi thực sự (network, 404, etc.)
                        // Chỉ hiển thị lỗi nếu không phải là "không có update"
                        if (result.error.includes('mới nhất') || result.message?.includes('mới nhất')) {
                          setUpdateStatus('Đây là phiên bản mới nhất');
                        } else {
                          setUpdateStatus(`Lỗi: ${result.error.substring(0, 50)}`);
                        }
                        setUpdateInfo(null);
                      } else {
                        // Trường hợp mặc định: không có update
                        setUpdateStatus('Đây là phiên bản mới nhất');
                        setUpdateInfo(null);
                      }
                    } catch (error) {
                      // Lỗi exception
                      setUpdateStatus(`Lỗi: ${error instanceof Error ? error.message.substring(0, 30) : 'Không thể kiểm tra'}`);
                      setUpdateInfo(null);
                    } finally {
                      setCheckingUpdate(false);
                    }
                  }}
                  disabled={checkingUpdate || downloading}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 px-3 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <RefreshCw size={12} className={checkingUpdate ? 'animate-spin' : ''} />
                  {checkingUpdate ? 'Đang kiểm tra...' : 'Kiểm tra cập nhật'}
                </button>
              ) : (
                <>
                  {!downloaded ? (
                    <button
                      onClick={async () => {
                        if (window.electronAPI) {
                          try {
                            // Đặt trạng thái tải ngay lập tức
                            setDownloading(true);
                            downloadingRef.current = true;
                            setDownloadProgress(0);
                            downloadProgressRef.current = 0;
                            lastProgressRef.current = 0;
                            setDownloadError(null);
                            setDownloaded(false);
                            
                            console.log('📥 [Settings] Bắt đầu tải cập nhật...');
                            console.log('📥 [Settings] Đã set downloading = true, progress = 0%');
                            
                            // Đảm bảo listener đã được setup (có thể gọi lại để chắc chắn)
                            console.log('✅ [Settings] Listener đã được setup trong useEffect');
                            
                            const result = await window.electronAPI.downloadUpdate();
                            console.log('📥 [Settings] Kết quả downloadUpdate():', {
                              success: result?.success,
                              error: result?.error || null
                            });
                            
                            if (result.error) {
                              console.error('❌ [Settings] Lỗi download:', result.error);
                              setDownloadError(result.error);
                              setDownloading(false);
                              setDownloadProgress(0);
                            } else {
                              // Nếu không có lỗi, giữ downloading = true để chờ progress events
                              console.log('✅ [Settings] Đã bắt đầu tải, chờ progress events...');
                              console.log('✅ [Settings] downloading = true, đang chờ update-download-progress events...');
                              
                              // Gửi một progress 0% ngay để đảm bảo UI hiển thị
                              setTimeout(() => {
                                if (downloadProgress === 0 && downloading) {
                                  console.log('⚠️ [Settings] Vẫn ở 0% sau 1s, thử force update...');
                                  setDownloadProgress(0); // Force re-render
                                }
                              }, 1000);
                            }
                            // Progress sẽ được cập nhật qua event
                          } catch (error) {
                            const errorMsg = error instanceof Error ? error.message : 'Không xác định';
                            setDownloadError(`Lỗi tải cập nhật: ${errorMsg}`);
                            setDownloading(false);
                            setDownloadProgress(0);
                            console.error('❌ Lỗi tải cập nhật:', error);
                          }
                        }
                      }}
                      disabled={downloading}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-3 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {downloading ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" />
                          Đang tải {downloadProgress > 0 ? `${Math.round(downloadProgress)}%` : '...'}
                        </>
                      ) : (
                        <>
                          <RefreshCw size={12} />
                          Tải về cập nhật
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        if (window.electronAPI) {
                          try {
                            // Hiển thị thông báo trước khi cài đặt
                            const confirmed = window.confirm(
                              '🔄 Cài đặt cập nhật\n\n' +
                              'Ứng dụng sẽ:\n' +
                              '1. Tự động đóng ngay bây giờ\n' +
                              '2. Hiển thị quá trình cài đặt trong cửa sổ installer\n' +
                              '3. Tự động khởi động lại với phiên bản mới sau khi cài xong\n\n' +
                              'Bạn có muốn tiếp tục?'
                            );
                            if (!confirmed) return;
                            
                            // Hiển thị thông báo đang cài đặt (trước khi app đóng)
                            setDownloading(true);
                            setDownloadProgress(100);
                            setDownloaded(true);
                            
                            // Đợi một chút để UI cập nhật
                            await new Promise(resolve => setTimeout(resolve, 300));
                            
                            // Gọi install update - app sẽ tự động quit và install
                            console.log('🔄 [Settings] Bắt đầu cài đặt cập nhật...');
                            console.log('🔄 [Settings] App sẽ tự động đóng và hiển thị installer...');
                            
                            try {
                              await window.electronAPI.installUpdate();
                              // Code sau dòng này sẽ không chạy vì app đã quit
                              console.log('✅ [Settings] Đã gọi installUpdate() - app sẽ đóng ngay');
                            } catch (error) {
                              // Nếu có lỗi (hiếm khi xảy ra vì app đã quit)
                              console.error('❌ [Settings] Lỗi install update:', error);
                              throw error;
                            }
                          } catch (error) {
                            alert('Lỗi cài đặt cập nhật. Vui lòng thử lại sau.');
                            console.error('Lỗi install update:', error);
                            setDownloading(false);
                          }
                        }
                      }}
                      className="text-xs bg-green-600 hover:bg-green-700 text-white py-1.5 px-3 rounded transition-colors flex items-center gap-1.5"
                    >
                      <RefreshCw size={12} />
                      Khởi động lại và cập nhật
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setUpdateInfo(null);
                      setDownloading(false);
                      setDownloadProgress(0);
                      setDownloaded(false);
                      setDownloadError(null);
                      setUpdateStatus('');
                    }}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 px-3 rounded transition-colors"
                  >
                    Hủy
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lock App Modal */}
      {showLockModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" 
          onClick={() => {
            setShowLockModal(false);
            setLockPassword('');
            setLockPasswordConfirm('');
            setUnlockPassword('');
          }}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full" 
            onClick={(e) => e.stopPropagation()}
          >
            <LockAppModalContent
              appPassword={appPassword}
              unlockPassword={unlockPassword}
              setUnlockPassword={setUnlockPassword}
              lockPassword={lockPassword}
              setLockPassword={setLockPassword}
              lockPasswordConfirm={lockPasswordConfirm}
              setLockPasswordConfirm={setLockPasswordConfirm}
              setAppPassword={setAppPassword}
              setShowLockModal={setShowLockModal}
              unlockPasswordRef={unlockPasswordRef}
              lockPasswordRef={lockPasswordRef}
              lockPasswordConfirmRef={lockPasswordConfirmRef}
            />
          </div>
        </div>
      )}

      {/* Admin Password Modal */}
      {showAdminPasswordModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" 
          onClick={() => {
            setShowAdminPasswordModal(false);
            setAdminPassword('');
            setPendingAction(null);
          }}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full" 
            onClick={(e) => e.stopPropagation()}
          >
            <AdminPasswordModalContent
              adminPassword={adminPassword}
              setAdminPassword={setAdminPassword}
              pendingAction={pendingAction}
              setShowAdminPasswordModal={setShowAdminPasswordModal}
              setShowFirebaseModal={setShowFirebaseModal}
              setShowDataManagementModal={setShowDataManagementModal}
              setPendingAction={setPendingAction}
              adminPasswordRef={adminPasswordRef}
            />
          </div>
        </div>
      )}

      {/* API Settings Modal */}
      {showApiSettingsModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" 
          onClick={() => setShowApiSettingsModal(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <Key size={24} className="text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Cấu hình Pancake API</h2>
              </div>
              <button
                onClick={() => setShowApiSettingsModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6">
              <ApiSettings />
            </div>
          </div>
        </div>
      )}

      {/* About App Modal */}
      {showAboutModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" 
          onClick={() => setShowAboutModal(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <BookOpen size={24} className="text-primary-600 dark:text-primary-400" />
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Giới thiệu ứng dụng</h2>
              </div>
              <button
                onClick={() => setShowAboutModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-3xl font-bold text-primary-600 dark:text-primary-400 mb-2">Đơn Hàng 360</h3>
                <p className="text-lg text-gray-600 dark:text-gray-400">Hệ thống quản lý đơn hàng chuyên nghiệp</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Phiên bản: v{appVersion}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Tính năng chính</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                    <li>Quản lý đơn hàng từ nhiều nguồn (file gửi, đối soát, hoàn)</li>
                    <li>Tự động phát hiện và cảnh báo đơn hàng quá hạn</li>
                    <li>Phân tích tài chính và báo cáo chi tiết</li>
                    <li>Đồng bộ dữ liệu đa thiết bị qua Firebase</li>
                    <li>Backup và khôi phục dữ liệu tự động</li>
                    <li>Phân tích khu vực giao hàng</li>
                    <li>Giao diện sáng/tối linh hoạt</li>
                    <li>Bảo mật bằng mật khẩu</li>
                  </ul>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-2">Thông tin bản quyền</h4>
                  <div className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
                    <p><strong>Bản quyền thuộc:</strong> Đức Anh</p>
                    <p><strong>Hotline hỗ trợ:</strong> 09368.333.19</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                      © 2024-2025 Đức Anh. Tất cả quyền được bảo lưu.
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Hướng dẫn sử dụng</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                    <li>Nhập file đơn gửi để tạo danh sách đơn hàng ban đầu</li>
                    <li>Nhập file đối soát để cập nhật trạng thái đơn hàng đã giao</li>
                    <li>Nhập file đơn hoàn để cập nhật đơn hàng đã trả lại</li>
                    <li>Theo dõi cảnh báo cho các đơn hàng quá hạn</li>
                    <li>Xem báo cáo và phân tích tài chính</li>
                    <li>Cấu hình Firebase để đồng bộ dữ liệu giữa các thiết bị</li>
                  </ol>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowAboutModal(false)}
                  className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Component riêng cho Lock App Modal để dễ quản lý focus
const LockAppModalContent = ({
  appPassword,
  unlockPassword,
  setUnlockPassword,
  lockPassword,
  setLockPassword,
  lockPasswordConfirm,
  setLockPasswordConfirm,
  setAppPassword,
  setShowLockModal,
  unlockPasswordRef,
  lockPasswordRef,
  lockPasswordConfirmRef,
}: any) => {
  // Tự động focus input đầu tiên khi modal mở
  useAutoFocus(appPassword ? unlockPasswordRef : lockPasswordRef, true, 150);

  return (
    <>
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                {appPassword ? (
                  <Lock size={24} className="text-primary-600 dark:text-primary-400" />
                ) : (
                  <Unlock size={24} className="text-primary-600 dark:text-primary-400" />
                )}
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                  {appPassword ? 'Thay đổi mật khẩu' : 'Thiết lập mật khẩu'}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowLockModal(false);
                  setLockPassword('');
                  setLockPasswordConfirm('');
                  setUnlockPassword('');
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {appPassword ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Mật khẩu hiện tại <span className="text-red-500">*</span>
                    </label>
                    <input
                      ref={unlockPasswordRef}
                      type="password"
                      value={unlockPassword}
                      onChange={(e) => setUnlockPassword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          // Chuyển focus sang input mật khẩu mới
                          if (lockPasswordRef.current) {
                            lockPasswordRef.current.focus();
                          }
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="Nhập mật khẩu hiện tại"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Mật khẩu mới <span className="text-red-500">*</span>
                    </label>
                    <input
                      ref={lockPasswordRef}
                      type="password"
                      value={lockPassword}
                      onChange={(e) => setLockPassword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          // Chuyển focus sang input xác nhận mật khẩu
                          if (lockPasswordConfirmRef.current) {
                            lockPasswordConfirmRef.current.focus();
                          }
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="Nhập mật khẩu mới"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Xác nhận mật khẩu mới <span className="text-red-500">*</span>
                    </label>
                    <input
                      ref={lockPasswordConfirmRef}
                      type="password"
                      value={lockPasswordConfirm}
                      onChange={(e) => setLockPasswordConfirm(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="Nhập lại mật khẩu mới"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      // Kiểm tra và thực thi thay đổi mật khẩu
                      if (unlockPassword !== appPassword) {
                        alert('Mật khẩu hiện tại không đúng!');
                        if (unlockPasswordRef.current) {
                          unlockPasswordRef.current.focus();
                        }
                        return;
                      }
                      if (!lockPassword || lockPassword.length < 4) {
                        alert('Mật khẩu phải có ít nhất 4 ký tự!');
                        if (lockPasswordRef.current) {
                          lockPasswordRef.current.focus();
                        }
                        return;
                      }
                      if (lockPassword !== lockPasswordConfirm) {
                        alert('Mật khẩu xác nhận không khớp!');
                        if (lockPasswordConfirmRef.current) {
                          lockPasswordConfirmRef.current.focus();
                        }
                        return;
                      }
                      // Thực thi thay đổi mật khẩu
                      setAppPassword(lockPassword);
                      localStorage.setItem('app_password', lockPassword);
                      localStorage.setItem('app_locked', 'true');
                      setShowLockModal(false);
                      setLockPassword('');
                      setLockPasswordConfirm('');
                      setUnlockPassword('');
                      alert('Đã thay đổi mật khẩu thành công! App sẽ tự động khóa.');
                      setTimeout(() => {
                        window.location.reload();
                      }, 1000);
                    }
                  }}
                    />
                  </div>
                  <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => {
                        if (unlockPassword !== appPassword) {
                          alert('Mật khẩu hiện tại không đúng!');
                          return;
                        }
                        if (!lockPassword || lockPassword.length < 4) {
                          alert('Mật khẩu phải có ít nhất 4 ký tự!');
                          return;
                        }
                        if (lockPassword !== lockPasswordConfirm) {
                          alert('Mật khẩu xác nhận không khớp!');
                          return;
                        }
                        setAppPassword(lockPassword);
                        localStorage.setItem('app_password', lockPassword);
                        localStorage.setItem('app_locked', 'true');
                        setShowLockModal(false);
                        setLockPassword('');
                        setLockPasswordConfirm('');
                        setUnlockPassword('');
                        alert('Đã thay đổi mật khẩu thành công! App sẽ tự động khóa.');
                        setTimeout(() => {
                          window.location.reload();
                        }, 1000);
                      }}
                      className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      Thay đổi
                    </button>
                    <button
                      onClick={() => {
                        if (unlockPassword !== appPassword) {
                          alert('Mật khẩu hiện tại không đúng!');
                          return;
                        }
                        const confirmed = window.confirm('Bạn có chắc muốn tắt khóa ứng dụng?');
                        if (confirmed) {
                          setAppPassword('');
                          localStorage.removeItem('app_password');
                          localStorage.setItem('app_locked', 'false');
                          setShowLockModal(false);
                          setLockPassword('');
                          setLockPasswordConfirm('');
                          setUnlockPassword('');
                          alert('Đã tắt khóa ứng dụng!');
                        }
                      }}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                    >
                      Tắt khóa
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Mật khẩu <span className="text-red-500">*</span>
                    </label>
                    <input
                      ref={lockPasswordRef}
                      type="password"
                      value={lockPassword}
                      onChange={(e) => setLockPassword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          // Chuyển focus sang input xác nhận mật khẩu
                          if (lockPasswordConfirmRef.current) {
                            lockPasswordConfirmRef.current.focus();
                          }
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="Nhập mật khẩu (tối thiểu 4 ký tự)"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Xác nhận mật khẩu <span className="text-red-500">*</span>
                    </label>
                    <input
                      ref={lockPasswordConfirmRef}
                      type="password"
                      value={lockPasswordConfirm}
                      onChange={(e) => setLockPasswordConfirm(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="Nhập lại mật khẩu"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          // Kiểm tra và thực thi thiết lập mật khẩu
                          if (!lockPassword || lockPassword.length < 4) {
                            alert('Mật khẩu phải có ít nhất 4 ký tự!');
                            if (lockPasswordRef.current) {
                              lockPasswordRef.current.focus();
                            }
                            return;
                          }
                          if (lockPassword !== lockPasswordConfirm) {
                            alert('Mật khẩu xác nhận không khớp!');
                            if (lockPasswordConfirmRef.current) {
                              lockPasswordConfirmRef.current.focus();
                            }
                            return;
                          }
                          // Thực thi thiết lập mật khẩu
                          setAppPassword(lockPassword);
                          localStorage.setItem('app_password', lockPassword);
                          localStorage.setItem('app_locked', 'true');
                          setShowLockModal(false);
                          setLockPassword('');
                          setLockPasswordConfirm('');
                          alert('Đã thiết lập mật khẩu thành công! App sẽ tự động khóa.');
                          setTimeout(() => {
                            window.location.reload();
                          }, 1000);
                        }
                      }}
                    />
                  </div>
                  <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => {
                        if (!lockPassword || lockPassword.length < 4) {
                          alert('Mật khẩu phải có ít nhất 4 ký tự!');
                          return;
                        }
                        if (lockPassword !== lockPasswordConfirm) {
                          alert('Mật khẩu xác nhận không khớp!');
                          return;
                        }
                        setAppPassword(lockPassword);
                        localStorage.setItem('app_password', lockPassword);
                        localStorage.setItem('app_locked', 'true');
                        setShowLockModal(false);
                        setLockPassword('');
                        setLockPasswordConfirm('');
                        alert('Đã thiết lập mật khẩu thành công! App sẽ tự động khóa.');
                        setTimeout(() => {
                          window.location.reload();
                        }, 1000);
                      }}
                      className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      Thiết lập
                    </button>
                  </div>
                </>
              )}
            </div>
    </>
  );
};

// Component riêng cho Admin Password Modal
const AdminPasswordModalContent = ({
  adminPassword,
  setAdminPassword,
  pendingAction,
  setShowAdminPasswordModal,
  setShowFirebaseModal,
  setShowDataManagementModal,
  setPendingAction,
  adminPasswordRef,
}: any) => {
  // Tự động focus input khi modal mở
  useAutoFocus(adminPasswordRef, true, 150);

  return (
    <>
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <Lock size={24} className="text-primary-600 dark:text-primary-400" />
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Mật khẩu quản trị viên</h2>
              </div>
              <button
                onClick={() => {
                  setShowAdminPasswordModal(false);
                  setAdminPassword('');
                  setPendingAction(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nhập mật khẩu quản trị viên <span className="text-red-500">*</span>
                </label>
                <input
                  ref={adminPasswordRef}
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Nhập mật khẩu quản trị viên"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (adminPassword !== '41276') {
                        alert('Mật khẩu không đúng!');
                        setAdminPassword('');
                        if (adminPasswordRef.current) {
                          adminPasswordRef.current.focus();
                        }
                        return;
                      }
                      // Mật khẩu đúng, thực thi hành động
                      if (pendingAction === 'firebase') {
                        setShowAdminPasswordModal(false);
                        setAdminPassword('');
                        setShowFirebaseModal(true);
                        setPendingAction(null);
                      } else if (pendingAction === 'data') {
                        setShowAdminPasswordModal(false);
                        setAdminPassword('');
                        setShowDataManagementModal(true);
                        setPendingAction(null);
                      }
                    }
                  }}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Chỉ quản trị viên mới có thể truy cập phần này
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    if (adminPassword !== '41276') {
                      alert('Mật khẩu không đúng!');
                      setAdminPassword('');
                      if (adminPasswordRef.current) {
                        adminPasswordRef.current.focus();
                      }
                      return;
                    }
                    if (pendingAction === 'firebase') {
                      setShowAdminPasswordModal(false);
                      setAdminPassword('');
                      setShowFirebaseModal(true);
                      setPendingAction(null);
                    } else if (pendingAction === 'data') {
                      setShowAdminPasswordModal(false);
                      setAdminPassword('');
                      setShowDataManagementModal(true);
                      setPendingAction(null);
                    }
                  }}
                  className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Xác nhận
                </button>
                <button
                  onClick={() => {
                    setShowAdminPasswordModal(false);
                    setAdminPassword('');
                    setPendingAction(null);
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                >
                  Hủy
                </button>
              </div>
            </div>
    </>
  );
};

export default Settings;
