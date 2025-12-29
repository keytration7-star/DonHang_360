import { useState, useEffect, useMemo, useCallback } from 'react';
import { useOrderStore } from '../store/orderStore';
import ExcelUploader from '../components/ExcelUploader';
import { Search, Filter, AlertTriangle, AlertCircle, Eye, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { OrderStatus, Order } from '../types/order';
import { formatCurrency, formatDate } from '../utils/orderUtils';
import { differenceInDays } from 'date-fns';
import { useDebounce } from '../hooks/useDebounce';

const ITEMS_PER_PAGE_OPTIONS = [50, 100, 150, 200, 250, 300, 400, 500, 750, 1000];

const Orders = () => {
  const { orders, fetchOrders, searchOrders, loading, error } = useOrderStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [showUploader, setShowUploader] = useState<'sent' | 'delivered' | 'returned' | 'cancelled' | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    // Lấy từ localStorage nếu có, mặc định 50
    const saved = localStorage.getItem('orders_items_per_page');
    return saved ? parseInt(saved, 10) : 50;
  });

  // Debounce search query để tối ưu performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    fetchOrders().catch((err) => {
      console.error('Lỗi tải dữ liệu:', err);
    });
  }, [fetchOrders]);

  // Memoize filtered orders để tránh tính toán lại không cần thiết
  const filteredOrders = useMemo(() => {
    let result = orders;
    
    if (debouncedSearchQuery) {
      result = searchOrders(debouncedSearchQuery);
    }
    
    if (statusFilter !== 'all') {
      result = result.filter(o => o.status === statusFilter);
    }
    
    return result;
  }, [orders, debouncedSearchQuery, statusFilter, searchOrders]);

  // Lưu itemsPerPage vào localStorage khi thay đổi
  useEffect(() => {
    localStorage.setItem('orders_items_per_page', itemsPerPage.toString());
  }, [itemsPerPage]);

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOrders = useMemo(() => {
    return filteredOrders.slice(startIndex, endIndex);
  }, [filteredOrders, startIndex, endIndex, itemsPerPage]);

  // Reset page when filters or itemsPerPage change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, statusFilter, itemsPerPage]);

  const getStatusBadge = (status: OrderStatus) => {
    const badges = {
      [OrderStatus.SENT]: 'bg-blue-100 text-blue-800',
      [OrderStatus.DELIVERED]: 'bg-green-100 text-green-800',
      [OrderStatus.RETURNED]: 'bg-orange-100 text-orange-800',
      [OrderStatus.PENDING]: 'bg-gray-100 text-gray-800',
      [OrderStatus.CANCELLED]: 'bg-red-100 text-red-800',
    };
    return badges[status] || badges[OrderStatus.PENDING];
  };

  const getStatusLabel = (status: OrderStatus) => {
    const labels = {
      [OrderStatus.SENT]: 'Đã gửi',
      [OrderStatus.DELIVERED]: 'Giao thành công',
      [OrderStatus.RETURNED]: 'Đã hoàn',
      [OrderStatus.PENDING]: 'Chờ xử lý',
      [OrderStatus.CANCELLED]: 'Đã hủy',
    };
    return labels[status] || 'Chờ xử lý';
  };

  const getWarningBadge = useCallback((order: Order) => {
    const now = new Date();
    const sendDate = new Date(order.sendDate);
    const daysDiff = differenceInDays(now, sendDate);

    if (daysDiff > 15 && (order.status === OrderStatus.SENT || order.status === OrderStatus.PENDING)) {
      return (
        <span className="flex items-center gap-1 text-red-600 text-xs">
          <AlertCircle size={14} />
          Quá 15 ngày
        </span>
      );
    } else if (daysDiff > 10 && (order.status === OrderStatus.SENT || order.status === OrderStatus.PENDING)) {
      return (
        <span className="flex items-center gap-1 text-yellow-600 text-xs">
          <AlertTriangle size={14} />
          Quá 10 ngày
        </span>
      );
    }
    return null;
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Quản lý đơn hàng</h1>
      </div>

      {/* Upload Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button
          onClick={() => setShowUploader(showUploader === 'sent' ? null : 'sent')}
          className="bg-blue-500 text-white p-4 rounded-lg hover:bg-blue-600 transition-colors"
        >
          Nhập đơn gửi
        </button>
        <button
          onClick={() => setShowUploader(showUploader === 'delivered' ? null : 'delivered')}
          className="bg-green-500 text-white p-4 rounded-lg hover:bg-green-600 transition-colors"
        >
          Nhập đối soát
        </button>
        <button
          onClick={() => setShowUploader(showUploader === 'returned' ? null : 'returned')}
          className="bg-orange-500 text-white p-4 rounded-lg hover:bg-orange-600 transition-colors"
        >
          Nhập đơn hoàn
        </button>
        <button
          onClick={() => setShowUploader(showUploader === 'cancelled' ? null : 'cancelled')}
          className="bg-red-500 text-white p-4 rounded-lg hover:bg-red-600 transition-colors"
        >
          Nhập đơn hủy
        </button>
      </div>

      {showUploader && (
        <ExcelUploader
          type={showUploader}
          onUploadComplete={() => {
            setShowUploader(null);
            fetchOrders();
          }}
        />
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-800 font-semibold mb-2">Lỗi tải dữ liệu</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={() => fetchOrders()}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && orders.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Đang tải dữ liệu...</p>
          </div>
        </div>
      )}

      {/* Search and Filter - Cố định */}
      <div className="bg-white rounded-lg shadow p-4 sticky top-0 z-10">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Tìm kiếm theo mã vận đơn, tên KH, SĐT, địa chỉ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={20} className="text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'all')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value={OrderStatus.SENT}>Đã gửi</option>
              <option value={OrderStatus.DELIVERED}>Giao thành công</option>
              <option value={OrderStatus.RETURNED}>Đã hoàn</option>
              <option value={OrderStatus.CANCELLED}>Đã hủy</option>
              <option value={OrderStatus.PENDING}>Chờ xử lý</option>
            </select>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(parseInt(e.target.value, 10))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              title="Số đơn hiển thị trên 1 trang"
            >
              {ITEMS_PER_PAGE_OPTIONS.map(option => (
                <option key={option} value={option}>
                  {option} đơn/trang
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-300px)]">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-20">
                  Mã vận đơn
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trạng thái VĐ
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ngày gửi
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Thời gian lấy hàng
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tên người nhận
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SĐT người nhận
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Địa chỉ người nhận
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Địa chỉ hành chính
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tên người gửi
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SĐT người gửi
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Địa chỉ người gửi
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nội dung hàng hóa
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Loại hàng
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trọng lượng
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tiền thu hộ COD
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  COD thực thu
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Giao một phần
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cước phí
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phương thức kết toán
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cảnh báo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-50 z-20">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={22} className="px-6 py-4 text-center text-gray-500">
                    Đang tải...
                  </td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={22} className="px-6 py-4 text-center text-gray-500">
                    Không có dữ liệu
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white z-10">
                      {order.trackingNumber}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {order.orderStatus || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(order.sendDate)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {order.pickupDate ? formatDate(order.pickupDate) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-[150px] truncate">
                      {order.customerName}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {order.customerPhone}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate" title={order.customerAddress}>
                      {order.customerAddress}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate" title={order.administrativeAddress}>
                      {order.administrativeAddress || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-[150px] truncate">
                      {order.senderName || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {order.senderPhone || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate" title={order.senderAddress}>
                      {order.senderAddress || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate" title={order.goodsContent}>
                      {order.goodsContent || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {order.goodsType || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {order.chargeableWeight ? `${order.chargeableWeight} kg` : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(order.cod)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {order.actualCod ? formatCurrency(order.actualCod) : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {order.partialDelivery ? formatCurrency(order.partialDelivery) : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(order.shippingFee)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {order.paymentMethod || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getWarningBadge(order)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap sticky right-0 bg-white z-10">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="text-primary-600 hover:text-primary-800 flex items-center gap-1 text-sm"
                      >
                        <Eye size={16} />
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 px-6 py-3 flex items-center justify-between text-sm text-gray-700">
          <div>
            Tổng số: {filteredOrders.length} đơn hàng
            {filteredOrders.length > itemsPerPage && (
              <span className="ml-2">
                (Hiển thị {startIndex + 1}-{Math.min(endIndex, filteredOrders.length)} / {itemsPerPage} đơn/trang)
              </span>
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-3 py-1">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedOrder(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">Chi tiết đơn hàng</h2>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Thông tin cơ bản */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Mã vận đơn</label>
                  <p className="text-lg font-semibold">{selectedOrder.trackingNumber}</p>
                </div>
                {selectedOrder.orderStatus && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Trạng thái vận đơn</label>
                    <p className="text-lg">{selectedOrder.orderStatus}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-500">Ngày gửi</label>
                  <p className="text-lg">{formatDate(selectedOrder.sendDate)}</p>
                </div>
                {selectedOrder.pickupDate && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Thời gian lấy hàng</label>
                    <p className="text-lg">{formatDate(selectedOrder.pickupDate)}</p>
                  </div>
                )}
              </div>

              {/* Thông tin người nhận */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-3">Thông tin người nhận</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Tên người nhận</label>
                    <p className="text-base">{selectedOrder.customerName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">SĐT người nhận</label>
                    <p className="text-base">{selectedOrder.customerPhone}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-500">Địa chỉ người nhận</label>
                    <p className="text-base">{selectedOrder.customerAddress}</p>
                  </div>
                  {selectedOrder.administrativeAddress && (
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-500">Địa chỉ hành chính</label>
                      <p className="text-base">{selectedOrder.administrativeAddress}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Thông tin người gửi */}
              {(selectedOrder.senderName || selectedOrder.senderPhone || selectedOrder.senderAddress) && (
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold mb-3">Thông tin người gửi</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedOrder.senderName && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Tên người gửi</label>
                        <p className="text-base">{selectedOrder.senderName}</p>
                      </div>
                    )}
                    {selectedOrder.senderPhone && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">SĐT người gửi</label>
                        <p className="text-base">{selectedOrder.senderPhone}</p>
                      </div>
                    )}
                    {selectedOrder.senderAddress && (
                      <div className="col-span-2">
                        <label className="text-sm font-medium text-gray-500">Địa chỉ người gửi</label>
                        <p className="text-base">{selectedOrder.senderAddress}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Thông tin hàng hóa */}
              {(selectedOrder.goodsContent || selectedOrder.goodsType || selectedOrder.chargeableWeight) && (
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold mb-3">Thông tin hàng hóa</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedOrder.goodsContent && (
                      <div className="col-span-2">
                        <label className="text-sm font-medium text-gray-500">Nội dung hàng hóa</label>
                        <p className="text-base">{selectedOrder.goodsContent}</p>
                      </div>
                    )}
                    {selectedOrder.goodsType && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Loại hàng</label>
                        <p className="text-base">{selectedOrder.goodsType}</p>
                      </div>
                    )}
                    {selectedOrder.chargeableWeight && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Trọng lượng tính phí</label>
                        <p className="text-base">{selectedOrder.chargeableWeight} kg</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Thông tin tài chính */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-3">Thông tin tài chính</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Tiền thu hộ COD</label>
                    <p className="text-lg font-semibold text-blue-600">{formatCurrency(selectedOrder.cod)}</p>
                  </div>
                  {selectedOrder.actualCod && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">COD thực thu</label>
                      <p className="text-lg font-semibold text-green-600">{formatCurrency(selectedOrder.actualCod)}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-500">Cước phí</label>
                    <p className="text-lg font-semibold text-purple-600">{formatCurrency(selectedOrder.shippingFee)}</p>
                  </div>
                  {selectedOrder.partialDelivery && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Giao một phần</label>
                      <p className="text-lg font-semibold">{formatCurrency(selectedOrder.partialDelivery)}</p>
                    </div>
                  )}
                  {selectedOrder.paymentMethod && (
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-500">Phương thức kết toán</label>
                      <p className="text-base">{selectedOrder.paymentMethod}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Dữ liệu gốc (nếu có) */}
              {selectedOrder.rawData && Object.keys(selectedOrder.rawData).length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold mb-3">Dữ liệu bổ sung</h3>
                  <div className="bg-gray-50 p-4 rounded">
                    <pre className="text-sm overflow-x-auto">
                      {JSON.stringify(selectedOrder.rawData, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
