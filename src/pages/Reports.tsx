import { useEffect } from 'react';
import { useOrderStore } from '../store/orderStore';
import { calculateOrderStats, calculateRegionStats } from '../utils/orderUtils';
import { formatCurrency } from '../utils/orderUtils';
import { FileText, Download, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ExpandableExplanation from '../components/ExpandableExplanation';
import { OrderStatus } from '../types/order';

const Reports = () => {
  const { orders, fetchOrders } = useOrderStore();

  useEffect(() => {
    fetchOrders().catch((err) => {
      console.error('Lỗi tải dữ liệu:', err);
    });
  }, [fetchOrders]);

  const stats = calculateOrderStats(orders);
  const regionStats = calculateRegionStats(orders);

  // Tính báo cáo tài chính tổng (trừ đơn hủy)
  const financialStats = {
    // Tổng COD của tất cả đơn (trừ hủy)
    totalCodAll: orders
      .filter(o => o.status !== OrderStatus.CANCELLED)
      .reduce((sum, order) => sum + order.cod, 0),
    
    // Tổng COD của đơn đã giao thành công
    totalCodDelivered: orders
      .filter(o => o.status === OrderStatus.DELIVERED)
      .reduce((sum, order) => sum + order.cod, 0),
    
    // Tổng COD của đơn đã hoàn
    totalCodReturned: orders
      .filter(o => o.status === OrderStatus.RETURNED)
      .reduce((sum, order) => sum + order.cod, 0),
    
    // Tổng COD của đơn đang gửi (chưa giao, chưa hoàn, chưa hủy)
    totalCodPending: orders
      .filter(o => o.status === OrderStatus.SENT || o.status === OrderStatus.PENDING)
      .reduce((sum, order) => sum + order.cod, 0),
    
    // Tổng cước của tất cả đơn (trừ hủy)
    totalShippingFeeAll: orders
      .filter(o => o.status !== OrderStatus.CANCELLED)
      .reduce((sum, order) => sum + order.shippingFee, 0),
    
    // Tổng cước của đơn đã giao thành công
    totalShippingFeeDelivered: orders
      .filter(o => o.status === OrderStatus.DELIVERED)
      .reduce((sum, order) => sum + order.shippingFee, 0),
    
    // Tổng cước của đơn đã hoàn
    totalShippingFeeReturned: orders
      .filter(o => o.status === OrderStatus.RETURNED)
      .reduce((sum, order) => sum + order.shippingFee, 0),
    
    // Tổng cước của đơn đang gửi
    totalShippingFeePending: orders
      .filter(o => o.status === OrderStatus.SENT || o.status === OrderStatus.PENDING)
      .reduce((sum, order) => sum + order.shippingFee, 0),
  };

  // Số tiền còn lại = COD đang gửi - Cước đang gửi
  const remainingAmount = financialStats.totalCodPending - financialStats.totalShippingFeePending;

  const exportToExcel = () => {
    // TODO: Implement Excel export
    alert('Tính năng xuất Excel đang được phát triển');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Báo cáo</h1>
        <button
          onClick={exportToExcel}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2"
        >
          <Download size={20} />
          Xuất Excel
        </button>
      </div>

      {/* Summary Report */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileText size={24} className="text-primary-600" />
            Báo cáo tổng hợp
          </h2>
          <ExpandableExplanation
            title="Giải thích cách tính"
            content={`Báo cáo tổng hợp hiển thị các số liệu chính về đơn hàng:

• Tổng đơn gửi: Tổng số đơn hàng đã nhập vào hệ thống (không tính đơn hủy)

• Giao thành công: Số đơn hàng đã được đánh dấu "Giao thành công" thông qua file đối soát

• Đã hoàn: Số đơn hàng đã được đánh dấu "Đã hoàn" thông qua file đơn hoàn

• Đã hủy: Số đơn hàng đã được đánh dấu "Đã hủy" thông qua file đơn hủy

• Tỉ lệ ký nhận: (Giao thành công / Tổng đơn gửi) × 100%
  - Chỉ tính các đơn không bị hủy
  - Phản ánh hiệu quả giao hàng của bạn`}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Tổng đơn gửi</p>
            <p className="text-2xl font-bold text-blue-600">{stats.totalSent}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Giao thành công</p>
            <p className="text-2xl font-bold text-green-600">{stats.totalDelivered}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Đã hoàn</p>
            <p className="text-2xl font-bold text-orange-600">{stats.totalReturned}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Đã hủy</p>
            <p className="text-2xl font-bold text-red-600">{stats.totalCancelled}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Tỉ lệ ký nhận</p>
            <p className="text-2xl font-bold text-purple-600">{stats.deliveryRate.toFixed(2)}%</p>
          </div>
        </div>
      </div>

      {/* Financial Report */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <DollarSign size={24} className="text-primary-600" />
            Báo cáo tài chính tổng hợp
          </h2>
          <ExpandableExplanation
            title="Giải thích cách tính"
            content={`Báo cáo tài chính tổng hợp hiển thị toàn bộ số tiền COD và cước phí (trừ đơn hủy):

• Tổng COD gửi: Tổng tiền COD của tất cả đơn hàng đã nhập (không tính đơn hủy)

• Tổng COD đã giao: Tổng tiền COD của các đơn đã giao thành công

• Tổng COD đã hoàn: Tổng tiền COD của các đơn đã hoàn

• Tổng COD đang gửi: Tổng tiền COD của các đơn đang trong quá trình gửi (chưa giao, chưa hoàn)

• Tổng cước gửi: Tổng cước phí của tất cả đơn hàng (không tính đơn hủy)

• Tổng cước đã giao: Tổng cước phí của các đơn đã giao thành công

• Tổng cước đã hoàn: Tổng cước phí của các đơn đã hoàn

• Tổng cước đang gửi: Tổng cước phí của các đơn đang gửi

• Số tiền còn lại: Tổng COD đang gửi - Tổng cước đang gửi
  - Đây là số tiền bạn còn phải thu từ các đơn đang gửi
  - Sau khi trừ đi cước phí đã phải trả cho đơn vị vận chuyển`}
          />
        </div>
        <div className="space-y-6">
          {/* COD Summary */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-gray-700">Tổng hợp COD (Tiền thu hộ)</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="border-l-4 border-blue-500 pl-4 bg-blue-50 p-3 rounded">
                <p className="text-sm text-gray-600 mb-1">Tổng COD gửi</p>
                <p className="text-xl font-bold text-gray-800">{formatCurrency(financialStats.totalCodAll)}</p>
                <p className="text-xs text-gray-500 mt-1">Tất cả đơn (trừ hủy)</p>
              </div>
              <div className="border-l-4 border-green-500 pl-4 bg-green-50 p-3 rounded">
                <p className="text-sm text-gray-600 mb-1">COD đã giao</p>
                <p className="text-xl font-bold text-gray-800">{formatCurrency(financialStats.totalCodDelivered)}</p>
                <p className="text-xs text-gray-500 mt-1">Đơn giao thành công</p>
              </div>
              <div className="border-l-4 border-orange-500 pl-4 bg-orange-50 p-3 rounded">
                <p className="text-sm text-gray-600 mb-1">COD đã hoàn</p>
                <p className="text-xl font-bold text-gray-800">{formatCurrency(financialStats.totalCodReturned)}</p>
                <p className="text-xs text-gray-500 mt-1">Đơn đã hoàn</p>
              </div>
              <div className="border-l-4 border-yellow-500 pl-4 bg-yellow-50 p-3 rounded">
                <p className="text-sm text-gray-600 mb-1">COD đang gửi</p>
                <p className="text-xl font-bold text-gray-800">{formatCurrency(financialStats.totalCodPending)}</p>
                <p className="text-xs text-gray-500 mt-1">Đơn đang gửi</p>
              </div>
            </div>
          </div>

          {/* Shipping Fee Summary */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-gray-700">Tổng hợp cước phí</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="border-l-4 border-blue-500 pl-4 bg-blue-50 p-3 rounded">
                <p className="text-sm text-gray-600 mb-1">Tổng cước gửi</p>
                <p className="text-xl font-bold text-gray-800">{formatCurrency(financialStats.totalShippingFeeAll)}</p>
                <p className="text-xs text-gray-500 mt-1">Tất cả đơn (trừ hủy)</p>
              </div>
              <div className="border-l-4 border-green-500 pl-4 bg-green-50 p-3 rounded">
                <p className="text-sm text-gray-600 mb-1">Cước đã giao</p>
                <p className="text-xl font-bold text-gray-800">{formatCurrency(financialStats.totalShippingFeeDelivered)}</p>
                <p className="text-xs text-gray-500 mt-1">Đơn giao thành công</p>
              </div>
              <div className="border-l-4 border-orange-500 pl-4 bg-orange-50 p-3 rounded">
                <p className="text-sm text-gray-600 mb-1">Cước đã hoàn</p>
                <p className="text-xl font-bold text-gray-800">{formatCurrency(financialStats.totalShippingFeeReturned)}</p>
                <p className="text-xs text-gray-500 mt-1">Đơn đã hoàn</p>
              </div>
              <div className="border-l-4 border-yellow-500 pl-4 bg-yellow-50 p-3 rounded">
                <p className="text-sm text-gray-600 mb-1">Cước đang gửi</p>
                <p className="text-xl font-bold text-gray-800">{formatCurrency(financialStats.totalShippingFeePending)}</p>
                <p className="text-xs text-gray-500 mt-1">Đơn đang gửi</p>
              </div>
            </div>
          </div>

          {/* Remaining Amount */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Số tiền còn lại (cần thu)</p>
                <p className="text-3xl font-bold text-purple-600">{formatCurrency(remainingAmount)}</p>
                <p className="text-xs text-gray-600 mt-2">
                  = COD đang gửi ({formatCurrency(financialStats.totalCodPending)}) - Cước đang gửi ({formatCurrency(financialStats.totalShippingFeePending)})
                </p>
              </div>
              <DollarSign size={48} className="text-purple-300" />
            </div>
          </div>
        </div>
      </div>

      {/* Region Analysis */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Phân tích khu vực</h2>
          <ExpandableExplanation
            title="Giải thích phân tích khu vực"
            content={`Phân tích khu vực hiển thị thống kê đơn hàng theo từng tỉnh/thành phố:

• Số đơn: Tổng số đơn hàng của khu vực đó (không tính đơn hủy)

• Tỉ lệ giao hàng: (Số đơn giao thành công / Tổng số đơn) × 100%

• Khu vực được nhận diện tự động từ địa chỉ người nhận
  - Hỗ trợ đầy đủ 63 tỉnh thành Việt Nam
  - Nhận diện cả tên viết tắt và tên đầy đủ

• Biểu đồ hiển thị top 10 khu vực có số đơn hàng cao nhất`}
          />
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

      {/* Region Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Chi tiết khu vực</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Khu vực
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Số đơn
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Tỉ lệ giao hàng
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {regionStats.map((region, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {region.region}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {region.orderCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {region.deliveryRate.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;
