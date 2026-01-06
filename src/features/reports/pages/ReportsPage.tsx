/**
 * Reports - Báo cáo tổng hợp
 * Dùng logic API giống Dashboard, không dùng Excel logic
 */

import { useEffect, useMemo, useState } from 'react';
import { useApiOrderStore } from '../../../core/store/apiOrderStore';
import { formatCurrency } from '../../../shared/utils/orderUtils';
import { calculateRegionStats } from '../../../shared/utils/orderUtils';
import { OrderStatus } from '../../../shared/types/order';
import { PancakeOrder } from '../../../shared/types/pancakeApi';
import { logger } from '../../../shared/utils/logger';
import { differenceInDays } from 'date-fns';
import { 
  Download, 
  DollarSign, 
  Package, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  TrendingUp,
  Store
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import ExpandableExplanation from '../../../shared/components/ExpandableExplanation';
import { Link } from 'react-router-dom';

const Reports = () => {
  const { orders, shopOrders, fetchOrders, initializeFromCache, isInitialized } = useApiOrderStore();

  useEffect(() => {
    initializeFromCache().catch((err) => {
      logger.error('❌ Reports - Lỗi load cache:', err);
    });
  }, [initializeFromCache]);

  useEffect(() => {
    if (isInitialized) {
      fetchOrders(false, true).catch((err) => {
        logger.error('Lỗi tải dữ liệu:', err);
      });
    }
  }, [isInitialized, fetchOrders]);

  // Helper function để filter orders theo status (giống Dashboard)
  const filterOrdersByStatus = (orders: PancakeOrder[], status: 'sent' | 'received' | 'returned'): PancakeOrder[] => {
    return orders.filter(order => {
      const subStatusRaw = order.sub_status;
      const subStatusCode = typeof subStatusRaw === 'number' ? subStatusRaw : 
                            (typeof subStatusRaw === 'object' && subStatusRaw !== null ? 
                             (subStatusRaw.code || subStatusRaw.id || subStatusRaw.value) : undefined);
      const statusCode = order.status_code;
      const statusName = String(order.status_name || '').toLowerCase();
      const fromReturnedEndpoint = order.from_returned_endpoint === true;
      
      switch (status) {
        case 'sent':
          return (subStatusCode === 1 || statusName === 'shipped') &&
                 subStatusCode !== 7 && subStatusCode !== 8 &&
                 statusCode !== 7 && statusCode !== 8 &&
                 statusName !== 'delivered' &&
                 statusName !== 'returned' &&
                 statusName !== 'received';
        case 'received':
          return subStatusCode === 7 ||
                 statusCode === 7 ||
                 statusName.includes('đã nhận') || 
                 statusName.includes('received') || 
                 statusName.includes('nhận') ||
                 statusName.includes('delivered') ||
                 statusName.includes('đã nhận hàng');
        case 'returned':
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

  // Tính toán thống kê tổng quan (giống Dashboard)
  const overallStats = useMemo(() => {
    if (shopOrders.length === 0) {
      return {
        totalSent: 0,
        totalDelivered: 0,
        totalReturned: 0,
        deliveryRate: 0,
      };
    }
    
    const allShopOrders: any[] = [];
    shopOrders.forEach(shop => {
      allShopOrders.push(...shop.orders);
    });
    
    const sent = filterOrdersByStatus(allShopOrders, 'sent');
    const received = filterOrdersByStatus(allShopOrders, 'received');
    const returned = filterOrdersByStatus(allShopOrders, 'returned');
    
    const totalSent = sent.length + received.length + returned.length;
    const totalDelivered = received.length;
    const totalReturned = returned.length;
    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
    
    return { 
      totalSent,
      totalDelivered,
      totalReturned,
      deliveryRate,
    };
  }, [shopOrders]);

  // Tính toán tài chính từ orders (Order[])
  const financialStats = useMemo(() => {
    const sentOrders = orders.filter(o => o.status === OrderStatus.SENT);
    const deliveredOrders = orders.filter(o => o.status === OrderStatus.DELIVERED);
    const returnedOrders = orders.filter(o => o.status === OrderStatus.RETURNED);

    const totalCodSent = sentOrders.reduce((sum, o) => sum + (o.cod || 0), 0) +
                         deliveredOrders.reduce((sum, o) => sum + (o.cod || 0), 0) +
                         returnedOrders.reduce((sum, o) => sum + (o.cod || 0), 0);
    
    const totalCodDelivered = deliveredOrders.reduce((sum, o) => sum + (o.cod || 0), 0);
    const totalCodReturned = returnedOrders.reduce((sum, o) => sum + (o.cod || 0), 0);
    const totalCodPending = totalCodSent - totalCodDelivered - totalCodReturned;
    
    const totalShippingFeeSent = sentOrders.reduce((sum, o) => sum + (o.shippingFee || 0), 0) +
                                 deliveredOrders.reduce((sum, o) => sum + (o.shippingFee || 0), 0) +
                                 returnedOrders.reduce((sum, o) => sum + (o.shippingFee || 0), 0);
    
    const totalShippingFeeDelivered = deliveredOrders.reduce((sum, o) => sum + (o.shippingFee || 0), 0);
    const totalShippingFeeReturned = returnedOrders.reduce((sum, o) => sum + (o.shippingFee || 0), 0);
    const totalShippingFeePending = totalShippingFeeSent - totalShippingFeeDelivered - totalShippingFeeReturned;
    
    return {
      totalCodSent,
      totalCodDelivered,
      totalCodReturned,
      totalCodPending,
      totalShippingFeeSent,
      totalShippingFeeDelivered,
      totalShippingFeeReturned,
      totalShippingFeePending,
    };
  }, [orders]);

  // Tính đơn cảnh báo (giống Dashboard - chỉ từ SENT)
  const warningOrders = useMemo(() => {
    const now = new Date();
    const sentOrders = orders.filter(o => o.status === OrderStatus.SENT);
    
    const yellow: typeof orders = [];
    const red: typeof orders = [];

    sentOrders.forEach(order => {
      if (!order.sendDate) return;
      
      const daysDiff = differenceInDays(now, new Date(order.sendDate));
      if (daysDiff >= 6 && daysDiff <= 14) {
        yellow.push(order);
      } else if (daysDiff > 14) {
        red.push(order);
      }
    });

    return {
      yellow,
      red,
      warningCount: yellow.length + red.length,
    };
  }, [orders]);

  // Thống kê theo khu vực
  const regionStats = useMemo(() => {
    if (orders.length === 0) return [];
    return calculateRegionStats(orders);
  }, [orders]);

  // Thống kê theo shop
  const shopStats = useMemo(() => {
    if (shopOrders.length === 0) return [];

    // Deduplicate shops theo shopId (normalize string) - giống Dashboard
    const shopMap = new Map<string, typeof shopOrders[0]>();
    shopOrders.forEach(shop => {
      const normalizedShopId = String(shop.shopId);
      const existingShop = shopMap.get(normalizedShopId);
      
      if (existingShop) {
        // Nếu shop đã tồn tại, merge orders (giữ shop có nhiều orders hơn)
        if (shop.orders.length > existingShop.orders.length) {
          shopMap.set(normalizedShopId, shop);
        }
      } else {
        shopMap.set(normalizedShopId, shop);
      }
    });
    
    // Lọc bỏ shops không có orders
    const uniqueShops = Array.from(shopMap.values()).filter(shop => shop.orders.length > 0);
    
    logger.log(`📊 Reports: Deduplicate shops: ${shopOrders.length} → ${uniqueShops.length} shops (theo shopId)`);

    return uniqueShops.map(shop => {
      const allShopOrders = shop.orders;
      const sent = filterOrdersByStatus(allShopOrders, 'sent');
      const received = filterOrdersByStatus(allShopOrders, 'received');
      const returned = filterOrdersByStatus(allShopOrders, 'returned');
      
      const totalSent = sent.length + received.length + returned.length;
      const totalDelivered = received.length;
      const totalReturned = returned.length;
      const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;

      // Tính COD và cước từ orders (Order[]) của shop này
      const shopOrderIds = new Set(allShopOrders.map(o => o.id || o.code));
      const shopOrdersData = orders.filter(o => {
        const rawData = o.rawData as PancakeOrder | undefined;
        const orderId = rawData?.id || rawData?.code;
        return shopOrderIds.has(orderId);
      });

      const totalCod = shopOrdersData.reduce((sum, o) => sum + (o.cod || 0), 0);
      const totalShippingFee = shopOrdersData.reduce((sum, o) => sum + (o.shippingFee || 0), 0);

      return {
        shopId: shop.shopId,
        shopName: shop.shopName,
        totalSent,
        received: totalDelivered,
        returned: totalReturned,
        deliveryRate,
        totalCod,
        totalShippingFee,
      };
    }).sort((a, b) => b.totalSent - a.totalSent);
  }, [shopOrders, orders]);

  const exportToJSON = () => {
    if (orders.length === 0) {
      alert('Không có dữ liệu để xuất');
      return;
    }
    
    const data = {
      exportedAt: new Date().toISOString(),
      overallStats,
      financialStats,
      warningOrders: {
        yellow: warningOrders.yellow.length,
        red: warningOrders.red.length,
        total: warningOrders.warningCount,
      },
      shopStats,
      regionStats,
      orders: orders.slice(0, 1000), // Limit để tránh file quá lớn
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao-cao-don-hang-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gray-50 dark:bg-gray-900 pb-4 -mx-6 px-6 border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex items-center justify-between pt-4">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Báo cáo</h1>
          <button
            onClick={exportToJSON}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2"
          >
            <Download size={20} />
            Xuất JSON
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Tổng đơn hàng</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">{overallStats.totalSent.toLocaleString()}</p>
            </div>
            <Package className="text-blue-500" size={32} />
          </div>
              <Link
            to="/api-orders"
            className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                Xem chi tiết →
              </Link>
          </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Đã nhận</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">{overallStats.totalDelivered.toLocaleString()}</p>
            </div>
            <CheckCircle className="text-green-500" size={32} />
          </div>
              <Link
            to="/api-orders?tab=received"
            className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                Xem chi tiết →
              </Link>
          </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Đã hoàn</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">{overallStats.totalReturned.toLocaleString()}</p>
            </div>
            <XCircle className="text-orange-500" size={32} />
          </div>
              <Link
            to="/api-orders?tab=returned"
            className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                Xem chi tiết →
              </Link>
          </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-2">
              <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Tỉ lệ giao hàng</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">{overallStats.deliveryRate.toFixed(2)}%</p>
            </div>
            <TrendingUp className="text-purple-500" size={32} />
          </div>
        </div>
      </div>

      {/* Warning Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between mb-2">
              <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Cảnh báo vàng (6-14 ngày)</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">{warningOrders.yellow.length}</p>
            </div>
            <AlertTriangle className="text-yellow-500" size={32} />
          </div>
          {warningOrders.yellow.length > 0 && (
              <Link
              to="/warnings"
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                Xem chi tiết →
              </Link>
            )}
          </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between mb-2">
              <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Cảnh báo đỏ (15+ ngày)</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">{warningOrders.red.length}</p>
            </div>
            <AlertTriangle className="text-red-500" size={32} />
          </div>
          {warningOrders.red.length > 0 && (
            <Link
              to="/warnings"
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
            >
              Xem chi tiết →
            </Link>
          )}
        </div>
      </div>

      {/* Financial Report */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-200">
            <DollarSign size={24} className="text-primary-600 dark:text-primary-400" />
            Báo cáo tài chính
          </h2>
        </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="border-l-4 border-blue-500 pl-4 bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Tổng COD</p>
                <p className="text-xl font-bold text-gray-800 dark:text-gray-200">{formatCurrency(financialStats.totalCodSent)}</p>
              </div>
          <div className="border-l-4 border-green-500 pl-4 bg-green-50 dark:bg-green-900/20 p-3 rounded">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">COD đã nhận</p>
                <p className="text-xl font-bold text-gray-800 dark:text-gray-200">{formatCurrency(financialStats.totalCodDelivered)}</p>
              </div>
          <div className="border-l-4 border-orange-500 pl-4 bg-orange-50 dark:bg-orange-900/20 p-3 rounded">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">COD đã hoàn</p>
                <p className="text-xl font-bold text-gray-800 dark:text-gray-200">{formatCurrency(financialStats.totalCodReturned)}</p>
              </div>
          <div className="border-l-4 border-yellow-500 pl-4 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">COD đang gửi</p>
                <p className="text-xl font-bold text-gray-800 dark:text-gray-200">{formatCurrency(financialStats.totalCodPending)}</p>
              </div>
            </div>
          </div>

      {/* Shop Stats */}
      {shopStats.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-200">
              <Store size={24} className="text-primary-600 dark:text-primary-400" />
              Thống kê theo shop
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Shop</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Tổng đơn</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Đã nhận</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Đã hoàn</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Tỉ lệ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Tổng COD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {shopStats.map((shop) => (
                  <tr key={shop.shopId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-200">{shop.shopName}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{shop.totalSent}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{shop.received}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{shop.returned}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{shop.deliveryRate.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatCurrency(shop.totalCod)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Region Stats */}
      {regionStats.length > 0 && (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Phân tích khu vực</h2>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={regionStats.slice(0, 10)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="region" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="orderCount" fill="#3b82f6" name="Số đơn" />
            <Bar dataKey="deliveryRate" fill="#10b981" name="Tỉ lệ giao hàng (%)" />
          </BarChart>
        </ResponsiveContainer>
          </div>
        )}
    </div>
  );
};

export default Reports;
