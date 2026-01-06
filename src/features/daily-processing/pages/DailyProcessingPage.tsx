import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApiOrderStore } from '../../../core/store/apiOrderStore';
import { formatCurrency, formatDate, getOrderStatusTag, getOrderStatusTagFromOrder } from '../../../shared/utils/orderUtils';
import { logger } from '../../../shared/utils/logger';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { dailyProcessingService, ProcessingHistory } from '../../../core/services/dailyProcessingService';
import { PancakeOrder } from '../../../shared/types/pancakeApi';
import { 
  AlertCircle, 
  Eye, 
  CheckCircle, 
  X, 
  Search,
  Check,
  Copy,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  MessageSquare
} from 'lucide-react';
import { Order } from '../../../shared/types/order';

const ITEMS_PER_PAGE = 50;

function DailyProcessingPage() {
  const { orders, shopOrders } = useApiOrderStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [copiedTrackingNumber, setCopiedTrackingNumber] = useState<string | null>(null);
  const [processingNote, setProcessingNote] = useState('');
  
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Tạo map từ order.id/trackingNumber -> PancakeOrder để truy cập dữ liệu gốc
  const pancakeOrderMap = useMemo(() => {
    const map = new Map<string, PancakeOrder>();
    shopOrders.forEach(shop => {
      shop.orders.forEach(pancakeOrder => {
        // Thử nhiều cách để map: id, code, order_id, tracking_number
        const possibleKeys = [
          String(pancakeOrder.id || ''),
          String(pancakeOrder.code || ''),
          String(pancakeOrder.order_id || ''),
          String(pancakeOrder.tracking_number || pancakeOrder.tracking_code || pancakeOrder.tracking || ''),
        ].filter(Boolean);
        
        possibleKeys.forEach(key => {
          if (key && !map.has(key)) {
            map.set(key, pancakeOrder);
          }
        });
      });
    });
    return map;
  }, [shopOrders]);

  // Lọc đơn hàng "Giao không thành công" và chưa xử lý trong ngày hôm nay
  // Logic này giống hệt với cột "Thẻ" trong tab "Đơn hàng API"
  const failedOrders = useMemo(() => {
    const failed: Order[] = [];
    
    orders.forEach(order => {
      // Tìm PancakeOrder gốc từ shopOrders để lấy dữ liệu chính xác nhất
      // Thử nhiều cách mapping: order.id, order.trackingNumber, order.code
      let pancakeOrder: PancakeOrder | undefined;
      
      // Tìm theo order.id (được tạo từ pancakeOrder.order_id || pancakeOrder.id || pancakeOrder.code)
      pancakeOrder = pancakeOrderMap.get(order.id) || 
                     pancakeOrderMap.get(String(order.id));
      
      // Nếu không tìm thấy, thử tìm theo trackingNumber
      if (!pancakeOrder) {
        pancakeOrder = pancakeOrderMap.get(order.trackingNumber) ||
                      pancakeOrderMap.get(String(order.trackingNumber));
      }
      
      // Nếu vẫn không tìm thấy, tìm trong shopOrders trực tiếp
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
      
      // Lấy statusTag - giống hệt logic trong tab "Đơn hàng API"
      let statusTag;
      if (pancakeOrder) {
        // Sử dụng dữ liệu gốc từ API (chính xác nhất)
        statusTag = getOrderStatusTag(pancakeOrder);
      } else {
        // Fallback: sử dụng order.orderStatus (đã được lưu từ pancakeOrderMapper)
        statusTag = getOrderStatusTagFromOrder(order);
      }
      
      // Kiểm tra xem có phải "Giao không thành công" không
      // Text chính xác từ getOrderStatusTag là "Giao không thành" (không có "công")
      const statusText = statusTag.text.toLowerCase();
      const isFailed = statusText === 'giao không thành' || // Text chính xác
                      statusText.includes('giao không thành') || 
                      statusText.includes('giao thất bại') ||
                      statusText.includes('delivery failed') ||
                      statusText.includes('failed') ||
                      statusText.includes('không giao được') ||
                      statusText.includes('thất bại') ||
                      statusText.includes('giao hàng thất bại') ||
                      statusText.includes('không giao hàng được');
      
      if (!isFailed) return;
      
      // Loại bỏ những đơn đã xử lý trong ngày hôm nay
      if (!dailyProcessingService.isProcessedToday(order.id)) {
        failed.push(order);
      }
    });
    
    // Debug log để kiểm tra
    if (typeof window !== 'undefined' && (window as any).__debugDailyProcessing) {
      logger.log(`🔍 Daily Processing Debug:`);
      logger.log(`  - Tổng orders: ${orders.length}`);
      logger.log(`  - Tổng shopOrders: ${shopOrders.length}`);
      logger.log(`  - PancakeOrderMap size: ${pancakeOrderMap.size}`);
      logger.log(`  - Tìm thấy ${failed.length} đơn giao không thành công`);
      
      if (failed.length > 0) {
        failed.slice(0, 5).forEach(order => {
          const pancakeOrder = pancakeOrderMap.get(order.id) || pancakeOrderMap.get(order.trackingNumber);
          const statusTag = pancakeOrder ? getOrderStatusTag(pancakeOrder) : getOrderStatusTagFromOrder(order);
          logger.log(`  - Order ${order.id}: ${order.trackingNumber} - Thẻ: "${statusTag.text}"`);
        });
      } else {
        // Log một vài đơn để debug
        orders.slice(0, 10).forEach(order => {
          const pancakeOrder = pancakeOrderMap.get(order.id) || pancakeOrderMap.get(order.trackingNumber);
          const statusTag = pancakeOrder ? getOrderStatusTag(pancakeOrder) : getOrderStatusTagFromOrder(order);
          logger.log(`  - Order ${order.id}: ${order.trackingNumber} - Thẻ: "${statusTag.text}"`);
        });
      }
    }
    
    return failed;
  }, [orders, shopOrders, pancakeOrderMap]);

  // Lọc theo search query
  const filteredOrders = useMemo(() => {
    if (!debouncedSearch.trim()) {
      return failedOrders;
    }

    const query = debouncedSearch.toLowerCase();
    return failedOrders.filter(order => {
      const trackingNumber = (order.trackingNumber || '').toLowerCase();
      const customerName = (order.customerName || '').toLowerCase();
      const customerPhone = (order.customerPhone || '').toLowerCase();
      const customerAddress = (order.customerAddress || '').toLowerCase();
      const orderId = String(order.id || '').toLowerCase();
      
      return trackingNumber.includes(query) ||
             customerName.includes(query) ||
             customerPhone.includes(query) ||
             customerAddress.includes(query) ||
             orderId.includes(query);
    });
  }, [failedOrders, debouncedSearch]);

  // Phân trang
  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredOrders.slice(start, end);
  }, [filteredOrders, currentPage]);

  // Reset page khi search thay đổi
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const handleCopyTracking = useCallback((trackingNumber: string) => {
    navigator.clipboard.writeText(trackingNumber).then(() => {
      setCopiedTrackingNumber(trackingNumber);
      setTimeout(() => setCopiedTrackingNumber(null), 2000);
      logger.log(`✅ Đã copy mã vận đơn: ${trackingNumber}`);
    }).catch(err => {
      logger.error('Lỗi copy mã vận đơn:', err);
    });
  }, []);

  const handleViewDetails = useCallback((order: Order) => {
    setSelectedOrder(order);
    const history = dailyProcessingService.getProcessingHistory(order.id);
    if (history?.notes) {
      setProcessingNote(history.notes);
    } else {
      setProcessingNote('');
    }
  }, []);

  const handleMarkAsProcessed = useCallback(() => {
    if (!selectedOrder) return;
    
    dailyProcessingService.markAsProcessed(
      selectedOrder.id,
      selectedOrder.trackingNumber,
      processingNote.trim() || undefined
    );
    
    // Đóng modal và refresh
    setSelectedOrder(null);
    setProcessingNote('');
    
    // Dispatch event để Layout cập nhật badge
    window.dispatchEvent(new Event('dailyProcessingUpdated'));
  }, [selectedOrder, processingNote]);

  const handleCloseModal = useCallback(() => {
    setSelectedOrder(null);
    setProcessingNote('');
  }, []);

  // Lấy lịch sử xử lý của đơn hàng
  const getProcessingHistory = useCallback((orderId: string): ProcessingHistory | undefined => {
    return dailyProcessingService.getProcessingHistory(orderId);
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Đơn hàng cần xử lý trong ngày
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Các đơn hàng giao không thành công cần xử lý hôm nay
          </p>
          {/* Debug info - chỉ hiển thị trong development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Debug: Tổng orders: {orders.length}, ShopOrders: {shopOrders.length}, PancakeOrderMap: {pancakeOrderMap.size}
              <button
                onClick={() => {
                  (window as any).__debugDailyProcessing = true;
                  logger.log('🔍 Debug mode enabled. Check console for details.');
                }}
                className="ml-2 px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs"
              >
                Enable Debug
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">
            <div className="text-sm text-red-600 dark:text-red-400 font-medium">
              Tổng số đơn cần xử lý
            </div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {failedOrders.length}
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Tìm kiếm theo mã vận đơn, tên, SĐT, địa chỉ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700 z-[60] shadow-sm">
                  Mã vận đơn
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700 z-50">
                  Thẻ
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700 z-50">
                  Ngày gửi
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700 z-50">
                  Người nhận
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700 z-50">
                  COD
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700 z-50">
                  Số lần xử lý
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky right-0 bg-gray-50 dark:bg-gray-700 z-[60] shadow-sm">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    {searchQuery ? 'Không tìm thấy đơn hàng nào' : 'Không có đơn hàng cần xử lý'}
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => {
                  const history = getProcessingHistory(order.id);
                  
                  // Tìm PancakeOrder tương ứng - giống logic trong OrdersPage
                  let pancakeOrder: PancakeOrder | undefined;
                  
                  // Tìm theo order.id
                  pancakeOrder = pancakeOrderMap.get(order.id) || 
                                pancakeOrderMap.get(String(order.id));
                  
                  // Nếu không tìm thấy, thử tìm theo trackingNumber
                  if (!pancakeOrder) {
                    pancakeOrder = pancakeOrderMap.get(order.trackingNumber) ||
                                  pancakeOrderMap.get(String(order.trackingNumber));
                  }
                  
                  // Nếu vẫn không tìm thấy, tìm trong shopOrders trực tiếp
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
                  
                  // Sử dụng getOrderStatusTag với PancakeOrder - giống OrdersPage
                  const statusTag = pancakeOrder ? getOrderStatusTag(pancakeOrder) : { text: 'Chưa xác định', color: 'text-gray-500 dark:text-gray-500', dotColor: 'bg-gray-400' };
                  
                  return (
                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-gray-800 z-20 shadow-sm">
                        <div className="flex items-center gap-2">
                          <span 
                            className="cursor-pointer hover:text-primary-600 select-none"
                            onDoubleClick={() => handleCopyTracking(order.trackingNumber)}
                            title="Double-click để copy mã vận đơn"
                          >
                            {order.trackingNumber}
                          </span>
                          {copiedTrackingNumber === order.trackingNumber && (
                            <span className="flex items-center gap-1 text-green-600 text-xs animate-fade-in">
                              <Check size={14} />
                              Đã copy
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Thẻ - Trạng thái đơn hàng - giống OrdersPage */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${statusTag.dotColor}`} />
                          <span className={`text-xs font-medium ${statusTag.color}`}>
                            {statusTag.text}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(order.sendDate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        <div>
                          <div className="font-medium">{order.customerName}</div>
                          <div className="text-gray-500 dark:text-gray-400 text-xs">{order.customerPhone}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {formatCurrency(order.cod || 0)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {history ? (
                          <div className="flex items-center gap-1">
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                              {history.processCount}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400 text-xs">lần</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">0 lần</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm sticky right-0 bg-white dark:bg-gray-800 z-20 shadow-sm">
                        <button
                          onClick={() => handleViewDetails(order)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors text-xs font-medium"
                        >
                          <Eye size={14} />
                          Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Hiển thị {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredOrders.length)} / {filteredOrders.length} đơn hàng
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} className="inline" />
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} className="inline" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={handleCloseModal}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Chi tiết đơn hàng
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Thông tin cơ bản */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Thông tin đơn hàng</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Mã vận đơn</label>
                    <div className="mt-1 text-gray-900 dark:text-white font-mono">{selectedOrder.trackingNumber}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Ngày gửi</label>
                    <div className="mt-1 text-gray-900 dark:text-white">{formatDate(selectedOrder.sendDate)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">COD</label>
                    <div className="mt-1 text-gray-900 dark:text-white font-semibold">{formatCurrency(selectedOrder.cod || 0)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Cước phí</label>
                    <div className="mt-1 text-gray-900 dark:text-white">{formatCurrency(selectedOrder.shippingFee || 0)}</div>
                  </div>
                </div>
              </div>

              {/* Thông tin người nhận */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Thông tin người nhận</h3>
                <div className="space-y-2">
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Tên</label>
                    <div className="mt-1 text-gray-900 dark:text-white">{selectedOrder.customerName}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">SĐT</label>
                    <div className="mt-1 text-gray-900 dark:text-white">{selectedOrder.customerPhone}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Địa chỉ</label>
                    <div className="mt-1 text-gray-900 dark:text-white">{selectedOrder.customerAddress}</div>
                  </div>
                </div>
              </div>

              {/* Trạng thái */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Trạng thái</h3>
                <div className="flex items-center gap-2">
                  {(() => {
                    // Tìm PancakeOrder tương ứng - giống logic trong table
                    let pancakeOrder: PancakeOrder | undefined;
                    pancakeOrder = pancakeOrderMap.get(selectedOrder.id) || 
                                  pancakeOrderMap.get(selectedOrder.trackingNumber);
                    if (!pancakeOrder) {
                      for (const shop of shopOrders) {
                        for (const po of shop.orders) {
                          const poId = String(po.order_id || po.id || po.code || '');
                          const poTracking = String(po.tracking_number || po.tracking_code || po.tracking || '');
                          if (poId === selectedOrder.id || poTracking === selectedOrder.trackingNumber) {
                            pancakeOrder = po;
                            break;
                          }
                        }
                        if (pancakeOrder) break;
                      }
                    }
                    // Sử dụng getOrderStatusTag với PancakeOrder - giống OrdersPage
                    const statusTag = pancakeOrder ? getOrderStatusTag(pancakeOrder) : { text: 'Chưa xác định', color: 'text-gray-500 dark:text-gray-500', dotColor: 'bg-gray-400' };
                    return (
                      <>
                        <div className={`w-3 h-3 rounded-full ${statusTag.dotColor}`} />
                        <span className={`text-sm font-medium ${statusTag.color}`}>
                          {statusTag.text}
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Lịch sử xử lý */}
              {(() => {
                const history = getProcessingHistory(selectedOrder.id);
                if (history && history.processCount > 0) {
                  return (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Lịch sử xử lý</h3>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <Clock size={16} className="text-gray-500 dark:text-gray-400" />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Đã xử lý {history.processCount} lần
                          </span>
                        </div>
                        {history.lastProcessedDate && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Lần xử lý gần nhất: {formatDate(history.lastProcessedDate)}
                          </div>
                        )}
                        {history.notes && (
                          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Ghi chú:</div>
                            <div className="text-sm text-gray-700 dark:text-gray-300">{history.notes}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Ghi chú xử lý */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Ghi chú xử lý (tùy chọn)</h3>
                <textarea
                  value={processingNote}
                  onChange={(e) => setProcessingNote(e.target.value)}
                  placeholder="Nhập ghi chú về việc xử lý đơn hàng này..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[100px]"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleMarkAsProcessed}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
                >
                  <CheckCircle size={20} />
                  Đánh dấu đã xử lý
                </button>
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DailyProcessingPage;

