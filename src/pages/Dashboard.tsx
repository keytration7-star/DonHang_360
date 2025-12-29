import { useEffect } from 'react';
import { useOrderStore } from '../store/orderStore';
import { calculateOrderStats, calculateRegionStats, getWarningOrders } from '../utils/orderUtils';
import { formatCurrency } from '../utils/orderUtils';
import { 
  Package, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  AlertTriangle,
  AlertCircle,
  DollarSign
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import ExpandableExplanation from '../components/ExpandableExplanation';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { orders, fetchOrders, loading, error } = useOrderStore();

  console.log('📊 Dashboard đang render');
  console.log('Orders count:', orders.length);
  console.log('Loading:', loading);
  console.log('Error:', error);

  useEffect(() => {
    console.log('🔄 Dashboard useEffect - đang fetch orders...');
    fetchOrders()
      .then(() => {
        console.log('✅ Dashboard - fetch orders thành công');
      })
      .catch((err) => {
        console.error('❌ Dashboard - Lỗi tải dữ liệu:', err);
      });
  }, [fetchOrders]);

  // Hiển thị loading state
  if (loading && orders.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  // Hiển thị error state
  if (error && orders.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-semibold mb-2">Lỗi tải dữ liệu</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={() => fetchOrders()}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  const stats = calculateOrderStats(orders);
  const regionStats = calculateRegionStats(orders);
  const warnings = getWarningOrders(orders);

  const statCards = [
    {
      title: 'Tổng đơn gửi',
      value: stats.totalSent,
      icon: Package,
      color: 'bg-blue-500',
    },
    {
      title: 'Giao thành công',
      value: stats.totalDelivered,
      icon: CheckCircle,
      color: 'bg-green-500',
    },
    {
      title: 'Đã hoàn',
      value: stats.totalReturned,
      icon: XCircle,
      color: 'bg-orange-500',
    },
    {
      title: 'Đã hủy',
      value: stats.totalCancelled,
      icon: XCircle,
      color: 'bg-red-500',
    },
    {
      title: 'Tỉ lệ ký nhận',
      value: `${stats.deliveryRate}%`,
      icon: TrendingUp,
      color: 'bg-purple-500',
    },
  ];

  const topRegions = regionStats.slice(0, 5);

  const pieData = [
    { name: 'Giao thành công', value: stats.totalDelivered, color: '#10b981' },
    { name: 'Đã hoàn', value: stats.totalReturned, color: '#f59e0b' },
    { name: 'Đang gửi', value: stats.totalSent - stats.totalDelivered - stats.totalReturned, color: '#3b82f6' },
    { name: 'Đã hủy', value: stats.totalCancelled, color: '#ef4444' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Tổng quan</h1>
      </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="text-white" size={24} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Financial Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <DollarSign size={24} className="text-primary-600" />
            Tổng hợp tài chính
          </h2>
          <ExpandableExplanation
            title="Giải thích"
            content={`Tổng hợp tài chính hiển thị số tiền COD và cước phí:

• Tổng COD gửi: Tổng tiền COD của các đơn đang gửi (chưa giao, chưa hoàn, chưa hủy)

• Tổng cước gửi: Tổng cước phí của các đơn đang gửi

• Số tiền còn lại: Tổng COD gửi - Tổng cước gửi
  - Đây là số tiền bạn còn phải thu từ các đơn đang gửi
  - Sau khi trừ đi cước phí đã phải trả cho đơn vị vận chuyển

Lưu ý: Chỉ tính các đơn đang trong quá trình gửi, không tính đơn đã giao thành công, đã hoàn hoặc đã hủy.`}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Tổng COD gửi</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(stats.totalCod)}</p>
            <p className="text-xs text-gray-500 mt-1">Đơn đang gửi</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Tổng cước gửi</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalShippingFee)}</p>
            <p className="text-xs text-gray-500 mt-1">Đơn đang gửi</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Số tiền còn lại</p>
            <p className="text-2xl font-bold text-purple-600">{formatCurrency(stats.remainingAmount)}</p>
            <p className="text-xs text-gray-500 mt-1">Cần thu</p>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {(warnings.yellow.length > 0 || warnings.red.length > 0) && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <AlertCircle size={24} className="text-red-600" />
              Cảnh báo đơn hàng
            </h2>
            <Link
              to="/warnings"
              className="text-primary-600 hover:text-primary-800 text-sm font-medium flex items-center gap-1"
            >
              Xem chi tiết →
            </Link>
          </div>
          <div className="space-y-4">
            {warnings.yellow.length > 0 && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="text-yellow-600" size={20} />
                  <span className="font-semibold text-yellow-800">
                    Cảnh báo vàng: {warnings.yellow.length} đơn gửi quá 10 ngày
                  </span>
                </div>
                <p className="text-sm text-yellow-700">
                  Các đơn hàng này đã gửi hơn 10 ngày nhưng chưa giao thành công hoặc hoàn.
                </p>
              </div>
            )}
            {warnings.red.length > 0 && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="text-red-600" size={20} />
                  <span className="font-semibold text-red-800">
                    Cảnh báo đỏ: {warnings.red.length} đơn gửi quá 15 ngày
                  </span>
                </div>
                <p className="text-sm text-red-700">
                  Các đơn hàng này có nguy cơ mất đơn cao, cần xử lý ngay!
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Region Stats */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Top khu vực đặt hàng</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topRegions}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="region" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="orderCount" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Pie Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Phân bổ trạng thái đơn hàng</h2>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="45%"
                labelLine={true}
                label={({ name, percent }) => {
                  // Chỉ hiển thị label nếu phần trăm >= 1% để tránh chồng chéo
                  if (percent < 0.01) return '';
                  return `${name}: ${(percent * 100).toFixed(0)}%`;
                }}
                outerRadius={100}
                innerRadius={30}
                fill="#8884d8"
                dataKey="value"
                paddingAngle={2}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke={entry.color} strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number, name: string) => [
                  `${value.toLocaleString()} đơn (${((value / pieData.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(1)}%)`,
                  name
                ]}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value) => {
                  const data = pieData.find(d => d.name === value);
                  const total = pieData.reduce((sum, item) => sum + item.value, 0);
                  const percent = data ? ((data.value / total) * 100).toFixed(1) : '0';
                  return `${value} (${percent}%)`;
                }}
                iconType="circle"
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

