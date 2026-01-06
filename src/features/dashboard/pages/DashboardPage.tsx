/**
 * Dashboard - Tổng quan đánh giá hiệu suất
 * - Tỉ lệ giao hàng chung và riêng từng shop
 * - Top khu vực đặt hàng và giao thành công cao
 * - Cảnh báo đơn quá 6-14 ngày và trên 15 ngày (dựa vào Ngày đẩy đơn sang ĐVVC)
 */

import { useEffect, useMemo, useState } from 'react';
import { useApiOrderStore } from '../../../core/store/apiOrderStore';
import { formatCurrency } from '../../../shared/utils/orderUtils';
import { calculateRegionStats } from '../../../shared/utils/orderUtils';
import { OrderStatus, Order } from '../../../shared/types/order';
import { PancakeOrder } from '../../../shared/types/pancakeApi';
import { logger } from '../../../shared/utils/logger';
import { differenceInDays } from 'date-fns';
import { 
  Store,
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Loader,
  MapPin,
  CheckCircle2,
  XCircle,
  Clock,
  Package
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { orders, shopOrders, fetchOrders, loading, error, initializeFromCache, isInitialized } = useApiOrderStore();
  const [isTabActive, setIsTabActive] = useState(true);

  // Load từ cache ngay lập tức khi mount
  useEffect(() => {
    initializeFromCache().catch((err) => {
      logger.error('❌ Dashboard - Lỗi load cache:', err);
    });
  }, [initializeFromCache]);

  // Lazy loading: Chỉ fetch khi tab được active và chưa có data hoặc data đã cũ
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabActive(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    setIsTabActive(!document.hidden);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Fetch khi tab được active và đã initialized
  useEffect(() => {
    if (isTabActive && isInitialized) {
      // Chỉ fetch nếu chưa có data hoặc data đã cũ (> 5 phút)
      const shouldFetch = orders.length === 0 || 
        (Date.now() - (useApiOrderStore.getState().lastFetchTime || 0)) > 300000;
      
      if (shouldFetch) {
        fetchOrders(false, true).catch((err) => {
          logger.error('❌ Dashboard - Lỗi tải dữ liệu:', err);
        });
      } else {
        // Nếu có data mới, chỉ refresh background
        fetchOrders(false, true).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTabActive, isInitialized]);
  
  // Listen for updates
  useEffect(() => {
    const handleDataUpdated = () => {
      // API orders updated event received
    };
    
    const handleIncrementalUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<any>;
      const { detail } = customEvent;
      // Incremental update received (detail chứa thông tin update)
    };
    
    window.addEventListener('apiOrdersUpdated', handleDataUpdated);
    window.addEventListener('apiOrdersIncrementalUpdate', handleIncrementalUpdate);
    
    return () => {
      window.removeEventListener('apiOrdersUpdated', handleDataUpdated);
      window.removeEventListener('apiOrdersIncrementalUpdate', handleIncrementalUpdate);
    };
  }, []);

  // Bắt đầu polling khi component mount
  const { startPolling, stopPolling } = useApiOrderStore();
  useEffect(() => {
    // Bắt đầu polling sau 5 giây (để app load xong)
    const timer = setTimeout(() => {
      startPolling(30000); // Poll mỗi 30 giây
    }, 5000);

    return () => {
      clearTimeout(timer);
      stopPolling();
    };
  }, [startPolling, stopPolling]);

  // Helper function để filter orders theo status (giống như trong ApiOrders.tsx)
  const filterOrdersByStatus = (orders: any[], status: 'sent' | 'received' | 'returned'): any[] => {
    return orders.filter(order => {
      // Lấy sub_status và status_code
      const subStatusCode = (order as any).sub_status;
      const statusCode = (order as any).status_code;
      const statusName = String((order as any).status_name || '').toLowerCase();
      const fromReturnedEndpoint = (order as any).from_returned_endpoint === true;
      
      switch (status) {
        case 'sent':
          // Đã gửi hàng: sub_status = 1 hoặc status_name = 'shipped'
          return (subStatusCode === 1 || statusName === 'shipped') &&
                 subStatusCode !== 7 && subStatusCode !== 8 &&
                 statusCode !== 7 && statusCode !== 8 &&
                 statusName !== 'delivered' &&
                 statusName !== 'returned' &&
                 statusName !== 'received';
        case 'received':
          // Đã nhận: sub_status = 7 hoặc status_code = 7
          return subStatusCode === 7 ||
                 statusCode === 7 ||
                 statusName.includes('đã nhận') || 
                 statusName.includes('received') || 
                 statusName.includes('nhận') ||
                 statusName.includes('delivered') ||
                 statusName.includes('đã nhận hàng');
        case 'returned':
          // Đã hoàn: sub_status = 8 hoặc status_code = 8 hoặc from_returned_endpoint
          return subStatusCode === 8 ||
                 statusCode === 8 ||
                 fromReturnedEndpoint ||
                 statusName.includes('đã hoàn') || 
                 statusName.includes('returned') || 
                 statusName.includes('hoàn') ||
                 statusName.includes('đã hoàn hàng');
        default:
          return false;
      }
    });
  };

  // Tính toán thống kê tổng quan chung (tất cả shop)
  // QUAN TRỌNG: Tính từ shopOrders (PancakeOrder[]) để đảm bảo khớp với shopStats
  const overallStats = useMemo(() => {
    if (shopOrders.length === 0) {
      return {
        totalSent: 0,
        totalDelivered: 0,
        totalReturned: 0,
        deliveryRate: 0,
      };
    }
    
    // Tính từ TẤT CẢ shop.orders (PancakeOrder[]) - giống như shopStats
    const allShopOrders: PancakeOrder[] = [];
    shopOrders.forEach(shop => {
      allShopOrders.push(...shop.orders);
    });
    
    // Filter theo status giống như trong shopStats
    const sent = filterOrdersByStatus(allShopOrders, 'sent');
    const received = filterOrdersByStatus(allShopOrders, 'received');
    const returned = filterOrdersByStatus(allShopOrders, 'returned');
    
    // Tổng đơn = Đã gửi hàng + Đã nhận + Đã hoàn (tổng 3 tab)
    const totalSent = sent.length + received.length + returned.length;
    
    // Đã nhận = từ tab "Đã nhận"
    const totalDelivered = received.length;
    
    // Đã hoàn = từ tab "Đã hoàn"
    const totalReturned = returned.length;
    
    // Tỉ lệ ký nhận = Đã nhận / Tổng đơn × 100%
    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
    
    // Overall stats calculated
    
    return {
      totalSent,
      totalDelivered,
      totalReturned,
      deliveryRate,
    };
  }, [shopOrders, filterOrdersByStatus]);
  
  // Tính toán tỉ lệ ký nhận chung (tất cả shop)
  // Công thức: Tỉ lệ ký nhận = Đã nhận (DELIVERED) / Tổng đơn gửi (SENT + DELIVERED + RETURNED) × 100%
  const overallDeliveryRate = useMemo(() => {
    return overallStats.deliveryRate;
  }, [overallStats]);

  // Tính toán thống kê theo shop - TÍNH TRỰC TIẾP TỪ shop.orders (PancakeOrder[])
  const shopStats = useMemo(() => {
    if (shopOrders.length === 0) return [];

    // Deduplicate shops theo shopId (normalize string)
    const shopMap = new Map<string, typeof shopOrders[0]>();
    shopOrders.forEach(shop => {
      const normalizedShopId = String(shop.shopId);
      const existingShop = shopMap.get(normalizedShopId);
      
      if (existingShop) {
        // Shop đã tồn tại - merge orders nếu shop mới có nhiều orders hơn
        if (shop.orders.length > existingShop.orders.length) {
          shopMap.set(normalizedShopId, shop);
        }
        // Nếu shop cũ có nhiều orders hơn, giữ nguyên
      } else {
        // Shop mới - thêm vào map
        shopMap.set(normalizedShopId, shop);
      }
    });
    
    // Chỉ lấy shops có orders > 0
    const uniqueShops = Array.from(shopMap.values()).filter(shop => shop.orders.length > 0);
    
    // Deduplicate shops completed

    return uniqueShops.map(shop => {
      // Tính trực tiếp từ shop.orders (PancakeOrder[]) - KHÔNG match với orders (Order[])
      const allShopOrders = shop.orders;
      
      // Filter theo status giống như trong ApiOrders.tsx
      const sent = filterOrdersByStatus(allShopOrders, 'sent');
      const received = filterOrdersByStatus(allShopOrders, 'received');
      const returned = filterOrdersByStatus(allShopOrders, 'returned');
      
      // Tổng đơn = Đã gửi hàng + Đã nhận + Đã hoàn (tổng 3 tab)
      const totalSent = sent.length + received.length + returned.length;
      
      // Đã nhận = từ tab "Đã nhận"
      const totalDelivered = received.length;
      
      // Đã hoàn = từ tab "Đã hoàn"
      const totalReturned = returned.length;
      
      // Tỉ lệ ký nhận = Đã nhận / Tổng đơn × 100%
      const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
      
      // Tỉ lệ hoàn = Đã hoàn / Tổng đơn × 100%
      const returnRate = totalSent > 0 ? (totalReturned / totalSent) * 100 : 0;

      return {
        shopId: shop.shopId,
        shopName: shop.shopName,
        totalSent,
        received: totalDelivered,
        returned: totalReturned,
        deliveryRate,
        returnRate,
      };
    }).sort((a, b) => b.totalSent - a.totalSent);
  }, [shopOrders, filterOrdersByStatus]);

  // Thống kê theo khu vực
  const regionStats = useMemo(() => {
    if (orders.length === 0) return [];
    return calculateRegionStats(orders);
  }, [orders]);
  
  // Top khu vực đặt hàng và giao thành công cao
  // State để lọc/sắp xếp
  const [regionSortBy, setRegionSortBy] = useState<'orderCount' | 'deliveryRate'>('orderCount');
  
  const topRegions = useMemo(() => {
    return regionStats
      .sort((a, b) => {
        if (regionSortBy === 'orderCount') {
          // Sắp xếp theo số đơn giảm dần
          return b.orderCount - a.orderCount;
        } else {
          // Sắp xếp theo tỉ lệ giao hàng giảm dần, sau đó theo số đơn giảm dần
          if (Math.abs(a.deliveryRate - b.deliveryRate) > 0.1) {
            return b.deliveryRate - a.deliveryRate;
          }
          return b.orderCount - a.orderCount;
        }
      });
  }, [regionStats, regionSortBy]);

  // Cảnh báo đơn dựa vào "Ngày đẩy đơn sang ĐVVC" (sendDate)
  // QUAN TRỌNG: Chỉ lấy dữ liệu từ tab "Đã gửi hàng" (status === SENT)
  // KHÔNG lấy từ "Đã nhận" (DELIVERED) và "Đã hoàn" (RETURNED) vì đã được xử lý rồi
  const warningOrders = useMemo(() => {
    const now = new Date();
    const warningYellow: Order[] = []; // 6-14 ngày
    const warningRed: Order[] = []; // Trên 15 ngày

    // CHỈ tính đơn từ tab "Đã gửi hàng" (status === SENT)
    // Loại bỏ đơn "Đã nhận" (DELIVERED) và "Đã hoàn" (RETURNED) - không cần cảnh báo
    const inTransitOrders = orders.filter(o => o.status === OrderStatus.SENT);

    inTransitOrders.forEach(order => {
      if (!order.sendDate) {
        // Không có ngày đẩy đơn → cảnh báo đỏ
        warningRed.push(order);
        return;
      }

      try {
        const shippedDate = new Date(order.sendDate);
        if (isNaN(shippedDate.getTime())) {
          warningRed.push(order);
          return;
        }

        const daysSinceShipped = differenceInDays(now, shippedDate);
        
        if (daysSinceShipped > 14) {
          // Trên 15 ngày (>= 15) → cảnh báo đỏ
          warningRed.push(order);
        } else if (daysSinceShipped >= 6) {
          // 6-14 ngày → cảnh báo vàng
          warningYellow.push(order);
        }
      } catch (error) {
        logger.error('Lỗi tính ngày cho đơn:', order.id, error);
        warningRed.push(order);
      }
    });

    const result = {
      yellow: warningYellow,
      red: warningRed,
      total: warningYellow.length + warningRed.length,
    };
    
    // Warning orders calculated
    
    return result;
  }, [orders]);

  // Dữ liệu cho bar chart - Tỉ lệ giao hàng theo shop
  const deliveryRateChartData = useMemo(() => {
    return shopStats
      .slice(0, 10)
      .map(shop => ({
        name: shop.shopName.length > 20 ? shop.shopName.substring(0, 20) + '...' : shop.shopName,
        fullName: shop.shopName,
        'Tỉ lệ giao hàng': Number(shop.deliveryRate.toFixed(2)),
        'Tỉ lệ hoàn': Number(shop.returnRate.toFixed(2)),
        'Tổng đơn': shop.totalSent,
      }));
  }, [shopStats]);

  // Dữ liệu cho bar chart - Tỉ lệ hoàn theo shop
  const returnRateChartData = useMemo(() => {
    return shopStats
      .slice(0, 10)
      .map(shop => ({
        name: shop.shopName.length > 20 ? shop.shopName.substring(0, 20) + '...' : shop.shopName,
        fullName: shop.shopName,
        'Tỉ lệ hoàn': Number(shop.returnRate.toFixed(2)),
        'Số đơn hoàn': shop.returned,
      }));
  }, [shopStats]);

    return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Tổng quan</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Đánh giá hiệu suất giao hàng và cảnh báo đơn hàng
          </p>
        </div>
          <button
            onClick={() => fetchOrders(true)}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
          {loading ? <Loader className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          Làm mới
          </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-300 font-semibold mb-2">Lỗi tải dữ liệu</p>
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                      </div>
                    )}

      {/* Loading State */}
      {loading && orders.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Đang tải dữ liệu...</p>
          </div>
        </div>
      )}

      {/* Cảnh báo đơn hàng */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cảnh báo vàng (6-14 ngày) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <AlertTriangle className="text-yellow-600 dark:text-yellow-400" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Cảnh báo vàng
          </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Đơn hàng 6-14 ngày chưa giao
                </p>
        </div>
          </div>
            <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
              {warningOrders.yellow.length}
          </div>
          </div>
          {warningOrders.yellow.length > 0 && (
            <Link
              to="/warnings"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Xem chi tiết →
            </Link>
          )}
        </div>
        
        {/* Cảnh báo đỏ (trên 15 ngày) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <AlertCircle className="text-red-600 dark:text-red-400" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Cảnh báo đỏ
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Đơn hàng trên 15 ngày chưa giao
                </p>
              </div>
            </div>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">
              {warningOrders.red.length}
            </div>
          </div>
          {warningOrders.red.length > 0 && (
              <Link 
              to="/warnings"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Xem chi tiết →
              </Link>
            )}
          </div>
        </div>
        
      {/* Thống kê tổng quan */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Tổng đơn</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {overallStats.totalSent.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                (Đã gửi + Đã nhận + Đã hoàn)
              </p>
            </div>
            <Package className="text-blue-600 dark:text-blue-400" size={32} />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Đã nhận</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {overallStats.totalDelivered.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                (Từ tab "Đã nhận")
              </p>
            </div>
            <CheckCircle2 className="text-green-600 dark:text-green-400" size={32} />
          </div>
              </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Đã hoàn</p>
              <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                {overallStats.totalReturned.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                (Từ tab "Đã hoàn")
              </p>
            </div>
            <XCircle className="text-orange-600 dark:text-orange-400" size={32} />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Tỉ lệ giao hàng</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {overallDeliveryRate.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Đã nhận / Tổng đơn × 100%
              </p>
            </div>
            <TrendingUp className="text-blue-600 dark:text-blue-400" size={32} />
          </div>
        </div>
      </div>

      {/* Tỉ lệ giao hàng và hoàn theo shop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - Tỉ lệ giao hàng theo shop */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Tỉ lệ giao hàng theo Shop (Top 10)
          </h2>
          {deliveryRateChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
              <BarChart data={deliveryRateChartData}>
              <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  domain={[0, 100]}
                  label={{ value: 'Tỉ lệ (%)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(2)}%`,
                    name
                  ]}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      return `Shop: ${payload[0].payload.fullName}`;
                    }
                    return label;
                  }}
                />
                <Legend />
                <Bar dataKey="Tỉ lệ giao hàng" fill="#10b981" />
                <Bar dataKey="Tỉ lệ hoàn" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-300 text-gray-500 dark:text-gray-400">
              Chưa có dữ liệu
            </div>
          )}
        </div>

        {/* Bar Chart - Tỉ lệ hoàn theo shop */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Tỉ lệ hoàn theo Shop (Top 10)
          </h2>
          {returnRateChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={returnRateChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  domain={[0, 100]}
                  label={{ value: 'Tỉ lệ (%)', angle: -90, position: 'insideLeft' }}
                />
              <Tooltip 
                formatter={(value: number, name: string) => [
                    name === 'Tỉ lệ hoàn' ? `${value.toFixed(2)}%` : `${value.toLocaleString()} đơn`,
                  name
                ]}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      return `Shop: ${payload[0].payload.fullName}`;
                    }
                    return label;
                  }}
                />
                <Legend />
                <Bar dataKey="Tỉ lệ hoàn" fill="#f59e0b" />
                <Bar dataKey="Số đơn hoàn" fill="#ef4444" />
              </BarChart>
          </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-300 text-gray-500 dark:text-gray-400">
              Chưa có dữ liệu
            </div>
          )}
        </div>
      </div>

      {/* Bảng thống kê shop */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          Thống kê theo Shop
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left p-3 font-semibold text-gray-900 dark:text-white">Shop</th>
                <th className="text-right p-3 font-semibold text-gray-900 dark:text-white">Tổng đơn</th>
                <th className="text-right p-3 font-semibold text-gray-900 dark:text-white">Đã nhận</th>
                <th className="text-right p-3 font-semibold text-gray-900 dark:text-white">Đã hoàn</th>
                <th className="text-right p-3 font-semibold text-gray-900 dark:text-white">Tỉ lệ giao hàng</th>
                <th className="text-right p-3 font-semibold text-gray-900 dark:text-white">Tỉ lệ hoàn</th>
              </tr>
            </thead>
            <tbody>
              {shopStats.map((shop) => (
                <tr
                  key={shop.shopId}
                  className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="p-3 text-gray-900 dark:text-white font-medium">
                    {shop.shopName}
                  </td>
                  <td className="p-3 text-right text-gray-900 dark:text-white">
                    {shop.totalSent.toLocaleString()}
                  </td>
                  <td className="p-3 text-right text-green-600 dark:text-green-400">
                    {shop.received.toLocaleString()}
                  </td>
                  <td className="p-3 text-right text-orange-600 dark:text-orange-400">
                    {shop.returned.toLocaleString()}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className={`font-semibold ${
                        shop.deliveryRate >= 80 ? 'text-green-600 dark:text-green-400' :
                        shop.deliveryRate >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {shop.deliveryRate.toFixed(2)}%
                      </span>
                      {shop.deliveryRate >= 80 ? (
                        <TrendingUp className="text-green-600 dark:text-green-400" size={16} />
                      ) : shop.deliveryRate < 60 ? (
                        <TrendingDown className="text-red-600 dark:text-red-400" size={16} />
                      ) : null}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <span className={`font-semibold ${
                      shop.returnRate <= 10 ? 'text-green-600 dark:text-green-400' :
                      shop.returnRate <= 20 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>
                      {shop.returnRate.toFixed(2)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top khu vực đặt hàng và giao thành công cao */}
      {topRegions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Top Khu vực đặt hàng và giao thành công cao
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Sắp xếp theo:</span>
              <select
                value={regionSortBy}
                onChange={(e) => setRegionSortBy(e.target.value as 'orderCount' | 'deliveryRate')}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="orderCount">Số đơn hàng</option>
                <option value="deliveryRate">Tỉ lệ nhận hàng</option>
              </select>
            </div>
          </div>
          <div className="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="overflow-y-auto max-h-[400px]">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Khu vực
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Số đơn
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Tỉ lệ giao hàng
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {topRegions.map((region, idx) => (
                    <tr
                      key={idx}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        idx >= 5 ? '' : 'bg-white dark:bg-gray-800'
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <MapPin className="text-blue-600 dark:text-blue-400" size={16} />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {region.region}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {region.orderCount.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <span className={`text-sm font-semibold ${
                          region.deliveryRate >= 80 ? 'text-green-600 dark:text-green-400' :
                          region.deliveryRate >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                          {region.deliveryRate.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {topRegions.length > 5 && (
              <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 text-center">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Hiển thị 5 khu vực đầu tiên. Cuộn để xem thêm {topRegions.length - 5} khu vực.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chi tiết cảnh báo đã chuyển sang tab "Các đơn cảnh báo" */}
    </div>
  );
};

export default Dashboard;
