import { Routes, Route, HashRouter } from 'react-router-dom';
import { useState, useEffect, Suspense, lazy } from 'react';
import Layout from './shared/components/Layout';
import UpdateModal from './shared/components/UpdateModal';
import WelcomeModal from './shared/components/WelcomeModal';
import LockScreen from './shared/components/LockScreen';
import ToastContainer from './shared/components/ToastContainer';
import { ThemeProvider } from './shared/contexts/ThemeContext';
import { useApiOrderStore } from './core/store/apiOrderStore';
import { logger } from './shared/utils/logger';

// Lazy load các pages để giảm bundle size ban đầu và tăng tốc độ chuyển tab
const Dashboard = lazy(() => import('./features/dashboard/pages/DashboardPage'));
const Warnings = lazy(() => import('./features/warnings/pages/WarningsPage'));
const Reports = lazy(() => import('./features/reports/pages/ReportsPage'));
const Settings = lazy(() => import('./features/settings/pages/SettingsPage'));
const ApiOrders = lazy(() => import('./features/orders/pages/OrdersPage'));
const DailyProcessing = lazy(() => import('./features/daily-processing/pages/DailyProcessingPage'));
const AIModuleManager = lazy(() => import('./features/ai-chat/pages/AIModuleManagerPage'));
const TrainingPage = lazy(() => import('./features/ai-chat/pages/TrainingPage'));
const ProductManagerPage = lazy(() => import('./features/ai-chat/pages/ProductManagerPage'));
const MediaManagerPage = lazy(() => import('./features/ai-chat/pages/MediaManagerPage'));
const ConversationViewerPage = lazy(() => import('./features/ai-chat/pages/ConversationViewerPage'));

// Loading component cho lazy routes
const PageLoader = () => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Đang tải...</p>
    </div>
  </div>
);

function App() {
  const { initializeFromCache, startPolling } = useApiOrderStore();
  const [updateInfo, setUpdateInfo] = useState<{ version: string; releaseNotes?: string } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloaded, setDownloaded] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isLocked, setIsLocked] = useState(() => {
    const appPassword = localStorage.getItem('app_password');
    if (!appPassword) {
      return false; // Không có mật khẩu thì không khóa
    }
    // Kiểm tra xem đã unlock trong session này chưa
    const sessionUnlocked = sessionStorage.getItem('app_session_unlocked');
    if (sessionUnlocked === 'true') {
      return false; // Đã unlock trong session này, không khóa lại
    }
    // Chưa unlock trong session này, khóa app
    return true;
  });

  // Kiểm tra xem người dùng đã đồng ý điều khoản chưa
  useEffect(() => {
    const hasAcceptedTerms = localStorage.getItem('accepted_terms_v1');
    if (!hasAcceptedTerms) {
      setShowWelcome(true);
    }
  }, []);

  // Khởi tạo app: load cache và bắt đầu polling tự động
  useEffect(() => {
    if (isLocked || showWelcome) return; // Chỉ chạy khi app đã unlock và đã accept terms
    
    // Load cache ngay lập tức
    initializeFromCache().then(() => {
      // Sau khi load cache, bắt đầu polling tự động (30 giây/lần)
      startPolling(30000);
      logger.log('✅ App: Đã khởi tạo và bắt đầu polling tự động');
    }).catch((error) => {
      logger.error('❌ App: Lỗi khởi tạo:', error);
    });
  }, [isLocked, showWelcome, initializeFromCache, startPolling]);

  // Tự động kiểm tra cập nhật khi app khởi động
  useEffect(() => {
    if (!window.electronAPI) return;

    // Lắng nghe event từ main process khi có update
    window.electronAPI.onUpdateAvailable((info: any) => {
      // Update available
      setUpdateInfo({
        version: info.version,
        releaseNotes: info.releaseNotes || ''
      });
    });

    // Lắng nghe tiến độ download
    window.electronAPI.onUpdateDownloadProgress((progress: any) => {
      setDownloadProgress(progress.percent || 0);
      setDownloading(true);
      setDownloadError(null);
    });

    // Lắng nghe khi download xong
    window.electronAPI.onUpdateDownloaded(() => {
      setDownloaded(true);
      setDownloading(false);
      setDownloadProgress(100);
    });

    // Lắng nghe lỗi
    window.electronAPI.onUpdateDownloadError((error: any) => {
      setDownloadError(error.error || 'Lỗi không xác định');
      setDownloading(false);
    });

    return () => {
      window.electronAPI?.removeUpdateListeners();
    };
  }, []);

  const handleDownload = async () => {
    if (!window.electronAPI) return;
    
    setDownloading(true);
    setDownloadProgress(0);
    setDownloadError(null);
    
    try {
      const result = await window.electronAPI.downloadUpdate();
      if (result.error) {
        setDownloadError(result.error);
        setDownloading(false);
      }
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Lỗi không xác định');
      setDownloading(false);
    }
  };

  const handleInstall = async () => {
    if (!window.electronAPI) return;
    
    try {
      await window.electronAPI.installUpdate();
      // App sẽ tự động đóng và mở installer
      // Sau khi cài xong, app sẽ tự động khởi động lại (nhờ runAfterFinish: true)
    } catch (error) {
      alert('Lỗi cài đặt cập nhật. Vui lòng thử lại sau.');
    }
  };

  const handleAcceptTerms = () => {
    localStorage.setItem('accepted_terms_v1', 'true');
    localStorage.setItem('accepted_terms_date', new Date().toISOString());
    setShowWelcome(false);
      // Terms accepted
  };

  const handleUnlock = (password: string): boolean => {
    const appPassword = localStorage.getItem('app_password');
    if (password === appPassword) {
      setIsLocked(false);
      // Đánh dấu đã unlock trong session này
      // Session sẽ tự động xóa khi đóng tab/app, nên lần mở app tiếp theo sẽ yêu cầu mật khẩu lại
      sessionStorage.setItem('app_session_unlocked', 'true');
      return true;
    }
    return false;
  };

  const handleResetPassword = () => {
    // Xóa mật khẩu và mở khóa
    localStorage.removeItem('app_password');
    sessionStorage.removeItem('app_session_unlocked');
    setIsLocked(false);
  };

  // Luôn sử dụng HashRouter cho Electron để tránh vấn đề với file:// protocol
  // React Router yêu cầu chỉ có một child element
  // KHÔNG dùng conditional return để tránh lỗi hooks order trong production
  return (
    <ThemeProvider>
      <HashRouter>
        <div className="h-screen w-screen bg-gray-50 dark:bg-gray-900">
        {/* Lock Screen - Hiển thị khi app bị khóa */}
        {isLocked ? (
          <LockScreen onUnlock={handleUnlock} onResetPassword={handleResetPassword} />
        ) : (
          <>
            {/* Welcome Modal - Hiển thị khi chưa đồng ý điều khoản */}
            {showWelcome ? (
              <WelcomeModal onAccept={handleAcceptTerms} />
            ) : (
              <>
                <Layout>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/warnings" element={<Warnings />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="/api-orders" element={<ApiOrders />} />
                      <Route path="/daily-processing" element={<DailyProcessing />} />
                      <Route path="/ai-chat" element={<AIModuleManager />} />
                      <Route path="/ai-chat/:moduleId/training" element={<TrainingPage />} />
                      <Route path="/ai-chat/:moduleId/products" element={<ProductManagerPage />} />
                      <Route path="/ai-chat/:moduleId/media" element={<MediaManagerPage />} />
                      <Route path="/ai-chat/:moduleId/conversations" element={<ConversationViewerPage />} />
                      <Route path="/settings" element={<Settings />} />
                    </Routes>
                  </Suspense>
                </Layout>
                
                {/* Update Modal - Hiển thị khi có cập nhật */}
                {updateInfo && (
                  <UpdateModal
                    updateInfo={updateInfo}
                    onDownload={handleDownload}
                    downloading={downloading}
                    downloadProgress={downloadProgress}
                    downloaded={downloaded}
                    onInstall={handleInstall}
                    downloadError={downloadError}
                  />
                )}
                
                {/* Toast Notifications */}
                <ToastContainer />
              </>
            )}
          </>
        )}
        </div>
      </HashRouter>
    </ThemeProvider>
  );
}

export default App;

