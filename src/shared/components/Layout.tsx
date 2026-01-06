import { ReactNode, useState, useMemo, useCallback, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package, 
  FileText, 
  Settings,
  AlertCircle,
  RefreshCw,
  Copyright,
  Phone,
  Clock,
  MessageSquare
} from 'lucide-react';
import { useProgressStore } from '../../core/store/progressStore';
import { useTheme } from '../../shared/contexts/ThemeContext';
import { useApiOrderStore } from '../../core/store/apiOrderStore';
import { getOrderStatusTagFromOrder, getWarningOrders, getOrderStatusTag } from '../../shared/utils/orderUtils';
import { dailyProcessingService } from '../../core/services/dailyProcessingService';
import { logger } from '../../shared/utils/logger';
import { PancakeOrder } from '../../shared/types/pancakeApi';
import LoadingIndicator from './LoadingIndicator';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const { isActive, progress, taskName, current, total, detail, showProgress, updateProgress, hideProgress } = useProgressStore();
  const { theme } = useTheme();
  const { orders, shopOrders } = useApiOrderStore();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [pendingCount, setPendingCount] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  
  // Cập nhật thời gian mỗi giây
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Tính số đơn cần xử lý trong ngày - sử dụng logic giống DailyProcessingPage
  useEffect(() => {
    const calculatePendingCount = () => {
      if (orders.length === 0) {
        setPendingCount(0);
        return;
      }
      
      // Tạo map từ order.id/trackingNumber -> PancakeOrder để truy cập dữ liệu gốc
      const pancakeOrderMap = new Map<string, PancakeOrder>();
      shopOrders.forEach(shop => {
        shop.orders.forEach(pancakeOrder => {
          const possibleKeys = [
            String(pancakeOrder.id || ''),
            String(pancakeOrder.code || ''),
            String(pancakeOrder.order_id || ''),
            String(pancakeOrder.tracking_number || pancakeOrder.tracking_code || pancakeOrder.tracking || ''),
          ].filter(Boolean);
          
          possibleKeys.forEach(key => {
            if (key && !pancakeOrderMap.has(key)) {
              pancakeOrderMap.set(key, pancakeOrder);
            }
          });
        });
      });
      
      const failedOrders = orders.filter(order => {
        // Tìm PancakeOrder tương ứng
        let pancakeOrder = pancakeOrderMap.get(order.id) || 
                          pancakeOrderMap.get(order.trackingNumber) ||
                          pancakeOrderMap.get(String(order.id)) ||
                          pancakeOrderMap.get(String(order.trackingNumber));
        
        // Nếu không tìm thấy, tìm trong shopOrders trực tiếp
        if (!pancakeOrder) {
          for (const shop of shopOrders) {
            for (const po of shop.orders) {
              const poId = String(po.order_id || po.id || po.code || '');
              const poTracking = String(po.tracking_number || po.tracking_code || po.tracking || '');
              if (poId === order.id || poTracking === order.trackingNumber) {
                pancakeOrder = po;
                break;
              }
            }
            if (pancakeOrder) break;
          }
        }
        
        // Sử dụng getOrderStatusTag với PancakeOrder - giống OrdersPage và DailyProcessingPage
        const statusTag = pancakeOrder ? getOrderStatusTag(pancakeOrder) : getOrderStatusTagFromOrder(order);
        const statusText = statusTag.text.toLowerCase();
        const isFailed = statusText === 'giao không thành' || 
                        statusText.includes('giao không thành') || 
                        statusText.includes('giao thất bại') ||
                        statusText.includes('delivery failed') ||
                        statusText.includes('failed') ||
                        statusText.includes('không giao được') ||
                        statusText.includes('thất bại') ||
                        statusText.includes('giao hàng thất bại') ||
                        statusText.includes('không giao hàng được');
        
        if (!isFailed) return false;
        
        // Loại bỏ những đơn đã xử lý trong ngày hôm nay
        return !dailyProcessingService.isProcessedToday(order.id);
      });
      
      setPendingCount(failedOrders.length);
    };

    calculatePendingCount();

    // Lắng nghe sự kiện storage để cập nhật khi có thay đổi
    const handleStorageChange = () => {
      calculatePendingCount();
    };
    
    window.addEventListener('storage', handleStorageChange);
    // Cũng lắng nghe custom event từ dailyProcessingService
    window.addEventListener('dailyProcessingUpdated', handleStorageChange);
    // Lắng nghe event khi orders được cập nhật
    window.addEventListener('apiOrdersUpdated', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('dailyProcessingUpdated', handleStorageChange);
      window.removeEventListener('apiOrdersUpdated', handleStorageChange);
    };
  }, [orders, shopOrders]);

  // Tính số đơn cảnh báo (vàng + đỏ)
  useEffect(() => {
    const calculateWarningCount = () => {
      try {
        if (orders.length === 0) {
          setWarningCount(0);
          return;
        }
        
        // Đảm bảo orders có đủ thông tin để tính cảnh báo
        // Orders từ API đã được set wasSent=true và source='sent' trong pancakeOrderMapper
        const { warningCount: count, yellow, red } = getWarningOrders(orders);
        setWarningCount(count);
        
        // Debug log để kiểm tra
        if (process.env.NODE_ENV === 'development') {
          const sentOrders = orders.filter(o => o.wasSent === true || o.source === 'sent');
          logger.log(`📊 Layout Warning Debug: Tổng orders: ${orders.length}, Sent orders: ${sentOrders.length}, Cảnh báo: Vàng=${yellow.length}, Đỏ=${red.length}, Tổng=${count}`);
        }
      } catch (error) {
        logger.error('Lỗi tính số đơn cảnh báo:', error);
        setWarningCount(0);
      }
    };

    calculateWarningCount();

    // Lắng nghe sự kiện storage để cập nhật khi có thay đổi
    const handleStorageChange = () => {
      calculateWarningCount();
    };
    
    // Lắng nghe event khi orders được cập nhật
    const handleOrdersUpdate = () => {
      calculateWarningCount();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('apiOrdersUpdated', handleOrdersUpdate);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('apiOrdersUpdated', handleOrdersUpdate);
    };
  }, [orders]);

  // Tạo menuItems với badge counts
  const menuItems = useMemo(() => [
    { path: '/', icon: LayoutDashboard, label: 'Tổng quan' },
    { path: '/api-orders', icon: Package, label: 'Đơn hàng API' },
    { path: '/warnings', icon: AlertCircle, label: 'Các đơn cảnh báo', badgeCount: warningCount },
    { path: '/daily-processing', icon: Clock, label: 'Đơn cần xử lý', badgeCount: pendingCount },
    { path: '/ai-chat', icon: MessageSquare, label: 'AI Chat' },
    { path: '/reports', icon: FileText, label: 'Báo cáo' },
    { path: '/settings', icon: Settings, label: 'Cài đặt' },
  ], [warningCount, pendingCount]);

  const formatDateTime = (date: Date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

  useEffect(() => {
  }, [theme]);

  return (
    <div className={`flex h-screen bg-gray-50 dark:bg-gray-900 flex-col transition-colors`}>
      {/* Header với ngày giờ và bản quyền */}
      <div className="w-full bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm z-40 px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Copyright size={16} className="text-gray-600 dark:text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Bản quyền thuộc: <strong className="text-primary-600 dark:text-primary-400">Đức Anh</strong>
          </span>
          <span className="text-gray-400 dark:text-gray-500">•</span>
          <div className="flex items-center gap-1">
            <Phone size={14} className="text-gray-600 dark:text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Hotline: <strong>09368.333.19</strong></span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Loading Indicator - Inline trong header */}
          <LoadingIndicator variant="inline" />
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {formatDateTime(currentTime)}
          </div>
        </div>
      </div>

      {/* Progress Bar - Top of App */}
      {isActive && (
        <div className="w-full bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm z-50">
          <div className="px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <RefreshCw size={16} className="animate-spin text-primary-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-700 block truncate">{taskName}</span>
                {(current !== undefined && total !== undefined) && (
                  <span className="text-xs text-gray-500">
                    Đang xử lý: <strong className="text-primary-600">{current.toLocaleString()}</strong> / <strong>{total.toLocaleString()}</strong>
                    {detail && <span className="ml-2 text-gray-400">({detail})</span>}
                  </span>
                )}
                {detail && !(current !== undefined && total !== undefined) && (
                  <span className="text-xs text-gray-500">{detail}</span>
                )}
              </div>
            </div>
            <span className="text-sm font-medium text-primary-600 ml-2 flex-shrink-0">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 h-1.5">
            <div 
              className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-300 ease-out" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}
      
      <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-800 shadow-lg flex flex-col transition-colors">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-primary-600 dark:text-primary-400">Đơn Hàng 360</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Quản lý đơn hàng</p>
        </div>
        
        <nav className="flex-1 p-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const badgeCount = 'badgeCount' in item ? item.badgeCount : undefined;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={20} />
                  <span>{item.label}</span>
                </div>
                {badgeCount !== undefined && badgeCount > 0 && (
                  <div className="relative flex-shrink-0">
                    {/* Hiệu ứng nhấp nháy */}
                    <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75"></div>
                    {/* Badge chính - giống hộp thư/tin nhắn */}
                    <div className="relative bg-gradient-to-br from-red-600 to-red-700 text-white text-xs font-bold rounded-full min-w-[24px] h-6 px-2 flex items-center justify-center shadow-lg border-2 border-white dark:border-gray-800 ring-2 ring-red-300 dark:ring-red-800 animate-pulse">
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          {/* Footer info - có thể thêm thông tin khác nếu cần */}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 transition-colors">
        {children}
      </main>
      </div>
    </div>
  );
};

export default Layout;

