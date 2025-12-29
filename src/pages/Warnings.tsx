import { useState, useEffect, useMemo, useCallback } from 'react';
import { useOrderStore } from '../store/orderStore';
import { getWarningOrders } from '../utils/orderUtils';
import { formatCurrency, formatDate } from '../utils/orderUtils';
import { differenceInDays } from 'date-fns';
import { 
  AlertTriangle, 
  AlertCircle, 
  Eye, 
  CheckCircle, 
  X, 
  DollarSign,
  Filter,
  Search
} from 'lucide-react';
import { Order, OrderStatus } from '../types/order';
import { orderService } from '../services/orderService';

type WarningType = 'yellow' | 'red';
type WarningFilter = 'all' | 'pending' | 'tracking' | 'compensated';

const Warnings = () => {
  const { orders, fetchOrders } = useOrderStore();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [warningTypeFilter, setWarningTypeFilter] = useState<WarningType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<WarningFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const warnings = useMemo(() => getWarningOrders(orders), [orders]);

  // Lọc cảnh báo theo type và status
  const filteredWarnings = useMemo(() => {
    let result: Order[] = [];
    
    if (warningTypeFilter === 'all') {
      result = [...warnings.yellow, ...warnings.red];
    } else if (warningTypeFilter === 'yellow') {
      result = warnings.yellow;
    } else {
      result = warnings.red;
    }

    // Lọc theo trạng thái xử lý
    if (statusFilter !== 'all') {
      result = result.filter(order => order.warningStatus === statusFilter);
    } else {
      // Mặc định chỉ hiển thị chưa xử lý và đang theo dõi
      result = result.filter(order => 
        !order.warningStatus || 
        order.warningStatus === 'pending' || 
        order.warningStatus === 'tracking'
      );
    }

    // Tìm kiếm
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(order =>
        order.trackingNumber.toLowerCase().includes(lowerQuery) ||
        order.customerName.toLowerCase().includes(lowerQuery) ||
        order.customerPhone.includes(searchQuery) ||
        order.customerAddress.toLowerCase().includes(lowerQuery)
      );
    }

    return result;
  }, [warnings, warningTypeFilter, statusFilter, searchQuery]);

  const getDaysDiff = useCallback((order: Order) => {
    const now = new Date();
    const sendDate = new Date(order.sendDate);
    return differenceInDays(now, sendDate);
  }, []);

  const getWarningType = useCallback((order: Order): WarningType => {
    const daysDiff = getDaysDiff(order);
    return daysDiff > 15 ? 'red' : 'yellow';
  }, [getDaysDiff]);

  const handleMarkTracking = async (order: Order) => {
    try {
      const allOrders = await orderService.getAllOrders();
      const updatedOrder = allOrders.find(o => o.trackingNumber === order.trackingNumber);
      if (updatedOrder) {
        updatedOrder.warningStatus = 'tracking';
        updatedOrder.warningNote = note || undefined;
        updatedOrder.updatedAt = new Date().toISOString();
        await orderService.addOrders([updatedOrder]);
        await fetchOrders();
        setNote('');
        setSelectedOrder(null);
        alert('Đã đánh dấu đang theo dõi!');
      }
    } catch (error) {
      alert('Lỗi cập nhật: ' + (error as Error).message);
    }
  };

  const handleMarkCompensated = async (order: Order) => {
    const confirm = window.confirm('Bạn có chắc muốn đánh dấu đơn này đã được đền bù? Đơn sẽ được xóa khỏi danh sách cảnh báo.');
    if (!confirm) return;

    try {
      const allOrders = await orderService.getAllOrders();
      const updatedOrder = allOrders.find(o => o.trackingNumber === order.trackingNumber);
      if (updatedOrder) {
        updatedOrder.warningStatus = 'compensated';
        updatedOrder.warningNote = note || 'Đã được đền bù';
        updatedOrder.updatedAt = new Date().toISOString();
        await orderService.addOrders([updatedOrder]);
        await fetchOrders();
        setNote('');
        setSelectedOrder(null);
        alert('Đã đánh dấu đã đền bù!');
      }
    } catch (error) {
      alert('Lỗi cập nhật: ' + (error as Error).message);
    }
  };

  // Tự động xóa cảnh báo khi đơn được cập nhật thành công/hoàn
  useEffect(() => {
    const checkAndClearWarnings = async () => {
      const allOrders = await orderService.getAllOrders();
      const ordersToUpdate: Order[] = [];

      allOrders.forEach(order => {
        if (order.warningStatus && order.warningStatus !== 'compensated' && order.warningStatus !== 'none') {
          if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.RETURNED) {
            order.warningStatus = 'none';
            order.updatedAt = new Date().toISOString();
            ordersToUpdate.push(order);
          }
        }
      });

      if (ordersToUpdate.length > 0) {
        await orderService.addOrders(ordersToUpdate);
        await fetchOrders();
      }
    };

    if (orders.length > 0) {
      checkAndClearWarnings();
    }
  }, [orders.length]); // Chỉ chạy khi số lượng đơn thay đổi

  const totalCod = useMemo(() => {
    return filteredWarnings.reduce((sum, order) => sum + order.cod, 0);
  }, [filteredWarnings]);

  const totalShippingFee = useMemo(() => {
    return filteredWarnings.reduce((sum, order) => sum + order.shippingFee, 0);
  }, [filteredWarnings]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Quản lý cảnh báo đơn hàng</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="text-yellow-600" size={20} />
            <span className="text-sm font-medium text-yellow-800">Cảnh báo vàng</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{warnings.yellow.length}</p>
          <p className="text-xs text-yellow-700 mt-1">Quá 10 ngày</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="text-red-600" size={20} />
            <span className="text-sm font-medium text-red-800">Cảnh báo đỏ</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{warnings.red.length}</p>
          <p className="text-xs text-red-700 mt-1">Quá 15 ngày</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="text-blue-600" size={20} />
            <span className="text-sm font-medium text-blue-800">Tổng COD</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalCod)}</p>
          <p className="text-xs text-blue-700 mt-1">Của đơn cảnh báo</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="text-purple-600" size={20} />
            <span className="text-sm font-medium text-purple-800">Tổng cước</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">{formatCurrency(totalShippingFee)}</p>
          <p className="text-xs text-purple-700 mt-1">Của đơn cảnh báo</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
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
              value={warningTypeFilter}
              onChange={(e) => setWarningTypeFilter(e.target.value as WarningType | 'all')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">Tất cả cảnh báo</option>
              <option value="yellow">Cảnh báo vàng (10+ ngày)</option>
              <option value="red">Cảnh báo đỏ (15+ ngày)</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as WarningFilter)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">Chưa xử lý</option>
              <option value="tracking">Đang theo dõi</option>
              <option value="compensated">Đã đền bù</option>
            </select>
          </div>
        </div>
      </div>

      {/* Warnings Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-20">
                  Mã vận đơn
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Loại cảnh báo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ngày gửi
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Số ngày
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Khách hàng
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  COD
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cước
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trạng thái xử lý
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-50 z-20">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredWarnings.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                    Không có cảnh báo nào
                  </td>
                </tr>
              ) : (
                filteredWarnings.map((order) => {
                  const daysDiff = getDaysDiff(order);
                  const warningType = getWarningType(order);
                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white z-10">
                        {order.trackingNumber}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {warningType === 'red' ? (
                          <span className="flex items-center gap-1 text-red-600 text-xs">
                            <AlertCircle size={14} />
                            Cảnh báo đỏ
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-yellow-600 text-xs">
                            <AlertTriangle size={14} />
                            Cảnh báo vàng
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(order.sendDate)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        <span className={`font-semibold ${daysDiff > 15 ? 'text-red-600' : 'text-yellow-600'}`}>
                          {daysDiff} ngày
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div>
                          <div className="font-medium">{order.customerName}</div>
                          <div className="text-gray-500 text-xs">{order.customerPhone}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(order.cod)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(order.shippingFee)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {order.warningStatus === 'tracking' ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            Đang theo dõi
                          </span>
                        ) : order.warningStatus === 'compensated' ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            Đã đền bù
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            Chưa xử lý
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap sticky right-0 bg-white z-10">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="text-primary-600 hover:text-primary-800"
                            title="Xem chi tiết"
                          >
                            <Eye size={16} />
                          </button>
                          {order.warningStatus !== 'compensated' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setNote(order.warningNote || '');
                                }}
                                className="text-blue-600 hover:text-blue-800"
                                title="Đánh dấu đang theo dõi"
                              >
                                <CheckCircle size={16} />
                              </button>
                              <button
                                onClick={() => handleMarkCompensated(order)}
                                className="text-green-600 hover:text-green-800"
                                title="Đánh dấu đã đền bù"
                              >
                                <DollarSign size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 px-6 py-3 text-sm text-gray-700">
          Tổng số: {filteredWarnings.length} đơn hàng cảnh báo
        </div>
      </div>

      {/* Action Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => {
          setSelectedOrder(null);
          setNote('');
        }}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">Xử lý cảnh báo đơn hàng</h2>
              <button
                onClick={() => {
                  setSelectedOrder(null);
                  setNote('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Mã vận đơn</label>
                  <p className="text-lg font-semibold">{selectedOrder.trackingNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Ngày gửi</label>
                  <p className="text-lg">{formatDate(selectedOrder.sendDate)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Số ngày</label>
                  <p className={`text-lg font-semibold ${getDaysDiff(selectedOrder) > 15 ? 'text-red-600' : 'text-yellow-600'}`}>
                    {getDaysDiff(selectedOrder)} ngày
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Khách hàng</label>
                  <p className="text-lg">{selectedOrder.customerName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">COD</label>
                  <p className="text-lg font-semibold text-blue-600">{formatCurrency(selectedOrder.cod)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Cước phí</label>
                  <p className="text-lg font-semibold text-purple-600">{formatCurrency(selectedOrder.shippingFee)}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ghi chú</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Nhập ghi chú về việc xử lý đơn hàng này..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => handleMarkTracking(selectedOrder)}
                  className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 flex items-center justify-center gap-2"
                >
                  <CheckCircle size={20} />
                  Đánh dấu đang theo dõi
                </button>
                <button
                  onClick={() => handleMarkCompensated(selectedOrder)}
                  className="flex-1 bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 flex items-center justify-center gap-2"
                >
                  <DollarSign size={20} />
                  Đánh dấu đã đền bù
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Warnings;

