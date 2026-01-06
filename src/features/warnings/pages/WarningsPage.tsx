import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useApiOrderStore } from '../../../core/store/apiOrderStore';
import { formatCurrency, formatDate, getOrderStatusTagFromOrder } from '../../../shared/utils/orderUtils';
import { differenceInDays } from 'date-fns';
import { logger } from '../../../shared/utils/logger';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { warningStatusService, WarningProcessStatus } from '../../../core/services/warningStatusService';
import { 
  AlertTriangle, 
  AlertCircle, 
  Eye, 
  CheckCircle, 
  X, 
  DollarSign,
  Filter,
  Search,
  Check,
  Copy,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Ban
} from 'lucide-react';
import { Order, OrderStatus } from '../../../shared/types/order';

type WarningType = 'yellow' | 'red';
type WarningFilter = 'all' | 'pending' | 'tracking' | 'compensated' | 'processed' | 'completed';

// Memoize table row để tránh re-render không cần thiết
const WarningRow = memo(({ 
  order, 
  daysDiff, 
  warningType, 
  onCopyTracking, 
  onViewDetails,
  copiedTrackingNumber 
}: {
  order: Order;
  daysDiff: number;
  warningType: WarningType;
  onCopyTracking: (tn: string) => void;
  onViewDetails: (order: Order) => void;
  copiedTrackingNumber: string | null;
}) => {
  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-gray-800 z-10">
        <div className="flex items-center gap-2">
          <span 
            className="cursor-pointer hover:text-primary-600 select-none"
            onDoubleClick={() => onCopyTracking(order.trackingNumber)}
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
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
        {formatDate(order.sendDate)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
        <span className={`font-semibold ${daysDiff >= 15 ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
          {daysDiff} ngày
        </span>
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
        {formatCurrency(order.shippingFee || 0)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {order.warningStatus === 'tracking' ? (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
            Đang theo dõi
          </span>
        ) : order.warningStatus === 'compensated' ? (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
            Đã đền bù
          </span>
        ) : (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
            Chưa xử lý
          </span>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap sticky right-0 bg-white dark:bg-gray-800 z-10">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onViewDetails(order)}
            className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300"
            title="Xem chi tiết"
          >
            <Eye size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
});

WarningRow.displayName = 'WarningRow';

const Warnings = () => {
  const { orders, fetchOrders } = useApiOrderStore();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [warningTypeFilter, setWarningTypeFilter] = useState<WarningType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<WarningFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [note, setNote] = useState('');
  const [copiedTrackingNumber, setCopiedTrackingNumber] = useState<string | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [copiedYellow, setCopiedYellow] = useState(false);
  const [copiedRed, setCopiedRed] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('warnings_items_per_page');
    return saved ? parseInt(saved, 10) : 100;
  });
  const [showProcessedOrders, setShowProcessedOrders] = useState(false);

  // Debounce search query để tối ưu performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  
  // Lưu itemsPerPage vào localStorage khi thay đổi
  useEffect(() => {
    localStorage.setItem('warnings_items_per_page', itemsPerPage.toString());
  }, [itemsPerPage]);

  useEffect(() => {
    // Chỉ fetch nếu chưa có data hoặc data đã cũ (không force để tránh lag khi chuyển tab)
    fetchOrders(false).catch((err) => {
      logger.error('Lỗi tải dữ liệu:', err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Chỉ fetch một lần khi mount

  // Tính toán cảnh báo từ orders (dựa vào Ngày đẩy đơn sang ĐVVC - sendDate)
  // QUAN TRỌNG: Chỉ lấy dữ liệu từ tab "Đã gửi hàng" (status === SENT)
  // KHÔNG lấy từ "Đã nhận" (DELIVERED) và "Đã hoàn" (RETURNED) vì đã được xử lý rồi
  const warnings = useMemo(() => {
    if (orders.length === 0) return { yellow: [], red: [], warningCount: 0 };
    
    const now = new Date();
    const yellow: Order[] = []; // 6-14 ngày
    const red: Order[] = []; // Trên 15 ngày

    // CHỈ tính đơn từ tab "Đã gửi hàng" (status === SENT)
    // Loại bỏ đơn "Đã nhận" (DELIVERED) và "Đã hoàn" (RETURNED) - không cần cảnh báo
    const inTransitOrders = orders.filter(o => {
      // Chỉ lấy đơn có status === SENT (Đã gửi hàng)
      // Loại bỏ DELIVERED (Đã nhận) và RETURNED (Đã hoàn)
      const isSent = o.status === OrderStatus.SENT;
      
      return isSent;
    });
    
    // SENT orders filtered

    inTransitOrders.forEach(order => {
      if (!order.sendDate) {
        red.push(order);
        return;
      }

      try {
        const shippedDate = new Date(order.sendDate);
        if (isNaN(shippedDate.getTime())) {
          red.push(order);
          return;
        }

        const daysSinceShipped = differenceInDays(now, shippedDate);
        
        if (daysSinceShipped > 14) {
          red.push(order);
        } else if (daysSinceShipped >= 6) {
          yellow.push(order);
        }
      } catch (error) {
        logger.error('Lỗi tính ngày cho đơn:', order.id, error);
        red.push(order);
      }
    });

    const result = { yellow, red, warningCount: yellow.length + red.length };
    
    // Warning orders calculated
    
    return result;
  }, [orders]);

  // Lọc cảnh báo theo type và status - sử dụng debouncedSearchQuery
  // Loại bỏ các đơn đã xử lý khỏi danh sách cảnh báo chính
  const filteredWarnings = useMemo(() => {
    let result: Order[] = [];
    
    if (warningTypeFilter === 'all') {
      result = [...warnings.yellow, ...warnings.red];
    } else if (warningTypeFilter === 'yellow') {
      result = warnings.yellow;
    } else {
      result = warnings.red;
    }

    // Loại bỏ các đơn đã xử lý (processed, completed, compensated) khỏi danh sách cảnh báo
    result = result.filter(order => {
      const statusData = warningStatusService.getStatus(order.id);
      return !statusData || statusData.status === null;
    });

    // Lọc theo trạng thái xử lý (chỉ áp dụng cho các trạng thái cũ)
    if (statusFilter !== 'all' && statusFilter !== 'processed' && statusFilter !== 'completed') {
      result = result.filter(order => order.warningStatus === statusFilter);
    } else if (statusFilter === 'all') {
      // Mặc định chỉ hiển thị chưa xử lý và đang theo dõi
      result = result.filter(order => 
        !order.warningStatus || 
        order.warningStatus === 'pending' || 
        order.warningStatus === 'tracking'
      );
    }

    // Tìm kiếm - sử dụng debouncedSearchQuery
    if (debouncedSearchQuery) {
      const lowerQuery = debouncedSearchQuery.toLowerCase();
      result = result.filter(order =>
        order.trackingNumber.toLowerCase().includes(lowerQuery) ||
        order.customerName.toLowerCase().includes(lowerQuery) ||
        order.customerPhone.includes(debouncedSearchQuery) ||
        order.customerAddress.toLowerCase().includes(lowerQuery)
      );
    }

    return result;
  }, [warnings, warningTypeFilter, statusFilter, debouncedSearchQuery]);

  // Lấy danh sách đơn đã xử lý
  const processedOrders = useMemo(() => {
    const allProcessed = warningStatusService.getAllProcessedOrders();
    return allProcessed
      .map(({ orderId, data }) => {
        const order = orders.find(o => o.id === orderId);
        if (!order) return null;
        return { order, statusData: data };
      })
      .filter((item): item is { order: Order; statusData: { status: WarningProcessStatus; note?: string; processedAt: string } } => item !== null)
      .sort((a, b) => new Date(b.statusData.processedAt).getTime() - new Date(a.statusData.processedAt).getTime());
  }, [orders]);

  // Pagination
  const totalPages = Math.ceil(filteredWarnings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedWarnings = useMemo(() => {
    return filteredWarnings.slice(startIndex, endIndex);
  }, [filteredWarnings, startIndex, endIndex, itemsPerPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, warningTypeFilter, statusFilter, itemsPerPage]);

  const getDaysDiff = useCallback((order: Order) => {
    const now = new Date();
    const sendDate = new Date(order.sendDate);
    return differenceInDays(now, sendDate);
  }, []);

  const getWarningType = useCallback((order: Order): WarningType => {
    const daysDiff = getDaysDiff(order);
    // Cảnh báo đỏ: >= 15 ngày, Cảnh báo vàng: 6-14 ngày
    return daysDiff >= 15 ? 'red' : 'yellow';
  }, [getDaysDiff]);

  // Hàm copy mã vận đơn khi double-click
  const handleCopyTrackingNumber = useCallback(async (trackingNumber: string) => {
    try {
      await navigator.clipboard.writeText(trackingNumber);
      setCopiedTrackingNumber(trackingNumber);
      setTimeout(() => {
        setCopiedTrackingNumber(null);
      }, 2000);
    } catch (err) {
      logger.error('Lỗi copy mã vận đơn:', err);
    }
  }, []);

  // Hàm copy toàn bộ thông tin đơn hàng
  const handleCopyAllInfo = useCallback(async (order: Order) => {
    try {
      const daysDiff = getDaysDiff(order);
      const info = [
        `Mã vận đơn: ${order.trackingNumber}`,
        `Ngày gửi: ${formatDate(order.sendDate)}`,
        `Số ngày: ${daysDiff} ngày`,
        `Khách hàng: ${order.customerName}`,
        `SĐT: ${order.customerPhone}`,
        `Địa chỉ: ${order.customerAddress}`,
        `COD: ${formatCurrency(order.cod)}`,
        `Cước phí: ${formatCurrency(order.shippingFee)}`,
        order.customerAddress ? `Địa chỉ hành chính: ${order.administrativeAddress || '-'}` : '',
        order.senderName ? `Người gửi: ${order.senderName}` : '',
        order.senderPhone ? `SĐT người gửi: ${order.senderPhone}` : '',
        order.senderAddress ? `Địa chỉ người gửi: ${order.senderAddress}` : '',
        order.goodsContent ? `Nội dung hàng hóa: ${order.goodsContent}` : '',
      ].filter(Boolean).join('\n');
      
      await navigator.clipboard.writeText(info);
      setCopiedOrderId(order.id);
      setTimeout(() => {
        setCopiedOrderId(null);
      }, 2000);
    } catch (err) {
      logger.error('Lỗi copy thông tin đơn hàng:', err);
    }
  }, [getDaysDiff]);


  // Với API, không cần update warningStatus vì dữ liệu từ API
  // Cảnh báo sẽ tự động tính toán dựa trên sendDate và status

  const totalCod = useMemo(() => {
    return filteredWarnings.reduce((sum, order) => sum + order.cod, 0);
  }, [filteredWarnings]);

  const totalShippingFee = useMemo(() => {
    return filteredWarnings.reduce((sum, order) => sum + order.shippingFee, 0);
  }, [filteredWarnings]);

  // Hàm copy mã vận đơn cảnh báo vàng (chỉ copy mã vận đơn)
  const handleCopyYellowWarnings = useCallback(async () => {
    try {
      const yellowOrders = warnings.yellow.filter(order => {
        const statusData = warningStatusService.getStatus(order.id);
        return !statusData || statusData.status === null;
      });

      if (yellowOrders.length === 0) {
        alert('Không có đơn cảnh báo vàng nào để copy!');
        return;
      }

      // Chỉ copy mã vận đơn, mỗi mã một dòng
      const trackingNumbers = yellowOrders.map(order => order.trackingNumber).join('\n');
      await navigator.clipboard.writeText(trackingNumbers);
      setCopiedYellow(true);
      setTimeout(() => {
        setCopiedYellow(false);
      }, 2000);
    } catch (err) {
      logger.error('Lỗi copy đơn cảnh báo vàng:', err);
      alert('Lỗi copy: ' + (err as Error).message);
    }
  }, [warnings.yellow]);

  // Hàm copy mã vận đơn cảnh báo đỏ (chỉ copy mã vận đơn)
  const handleCopyRedWarnings = useCallback(async () => {
    try {
      const redOrders = warnings.red.filter(order => {
        const statusData = warningStatusService.getStatus(order.id);
        return !statusData || statusData.status === null;
      });

      if (redOrders.length === 0) {
        alert('Không có đơn cảnh báo đỏ nào để copy!');
        return;
      }

      // Chỉ copy mã vận đơn, mỗi mã một dòng
      const trackingNumbers = redOrders.map(order => order.trackingNumber).join('\n');
      await navigator.clipboard.writeText(trackingNumbers);
      setCopiedRed(true);
      setTimeout(() => {
        setCopiedRed(false);
      }, 2000);
    } catch (err) {
      logger.error('Lỗi copy đơn cảnh báo đỏ:', err);
      alert('Lỗi copy: ' + (err as Error).message);
    }
  }, [warnings.red]);

  // Hàm xử lý trạng thái đơn hàng
  const handleProcessStatus = useCallback((orderId: string, status: WarningProcessStatus, note?: string) => {
    warningStatusService.setStatus(orderId, status, note);
    setSelectedOrder(null);
    setNote('');
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-gray-50 dark:bg-gray-900 pb-4 -mx-6 px-6 border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex items-center justify-between pt-4 gap-4 mb-3">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Quản lý cảnh báo đơn hàng</h1>
          {/* Summary Cards and Copy Buttons - Compact, inline with title */}
          <div className="flex items-center gap-3">
            {/* Summary Cards - Compact */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-2.5 flex items-center gap-2.5">
              <AlertTriangle className="text-yellow-600 dark:text-yellow-400" size={16} />
              <div>
                <p className="text-base font-bold text-yellow-600 dark:text-yellow-400">{warnings.yellow.length}</p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300">6-14 ngày</p>
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2.5 flex items-center gap-2.5">
              <AlertCircle className="text-red-600 dark:text-red-400" size={16} />
              <div>
                <p className="text-base font-bold text-red-600 dark:text-red-400">{warnings.red.length}</p>
                <p className="text-xs text-red-700 dark:text-red-300">Quá 15 ngày</p>
              </div>
            </div>
            {/* Copy Buttons - Compact */}
            {warnings.yellow.length > 0 && (
              <button
                onClick={handleCopyYellowWarnings}
                className="flex items-center gap-1.5 px-3 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-sm whitespace-nowrap"
                title="Copy mã vận đơn cảnh báo vàng"
              >
                {copiedYellow ? (
                  <>
                    <Check size={16} />
                    <span>Đã copy</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span>Copy vàng ({warnings.yellow.length})</span>
                  </>
                )}
              </button>
            )}
            {warnings.red.length > 0 && (
              <button
                onClick={handleCopyRedWarnings}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm whitespace-nowrap"
                title="Copy mã vận đơn cảnh báo đỏ"
              >
                {copiedRed ? (
                  <>
                    <Check size={16} />
                    <span>Đã copy</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span>Copy đỏ ({warnings.red.length})</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
        
        {/* Filters - Sát ngay dưới title */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Tìm kiếm theo mã vận đơn, tên KH, SĐT, địa chỉ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={20} className="text-gray-400" />
              <select
                value={warningTypeFilter}
                onChange={(e) => setWarningTypeFilter(e.target.value as WarningType | 'all')}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="all">Tất cả cảnh báo</option>
                <option value="yellow">Cảnh báo vàng</option>
                <option value="red">Cảnh báo đỏ</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as WarningFilter)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="pending">Chưa xử lý</option>
                <option value="tracking">Đang theo dõi</option>
                <option value="compensated">Đã đền bù</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Warnings Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)] relative">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-50 shadow-sm">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700 z-[60] shadow-sm">
                  Mã vận đơn
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700 z-50">
                  Thẻ
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700 z-50">
                  Loại cảnh báo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700 z-50">
                  Ngày gửi
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700 z-50">
                  Số ngày
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700 z-50">
                  Khách hàng
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700 z-50">
                  COD
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700 z-50">
                  Cước
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700 z-50">
                  Trạng thái xử lý
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky right-0 bg-gray-50 dark:bg-gray-700 z-[60] shadow-sm">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedWarnings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    Không có cảnh báo nào
                  </td>
                </tr>
              ) : (
                paginatedWarnings.map((order) => {
                  const daysDiff = getDaysDiff(order);
                  const warningType = getWarningType(order);
                  return (
                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-gray-800 z-20 shadow-sm">
                        <div className="flex items-center gap-2">
                          <span 
                            className="cursor-pointer hover:text-primary-600 select-none"
                            onDoubleClick={() => handleCopyTrackingNumber(order.trackingNumber)}
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
                      {/* Thẻ - Trạng thái đơn hàng */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {(() => {
                          const statusTag = getOrderStatusTagFromOrder(order);
                          return (
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${statusTag.dotColor}`} />
                              <span className={`text-xs font-medium ${statusTag.color}`}>
                                {statusTag.text}
                              </span>
                            </div>
                          );
                        })()}
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
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(order.sendDate)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <span className={`font-semibold ${daysDiff >= 15 ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                          {daysDiff} ngày
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        <div>
                          <div className="font-medium">{order.customerName}</div>
                          <div className="text-gray-500 dark:text-gray-400 text-xs">{order.customerPhone}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {formatCurrency(order.cod)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {formatCurrency(order.shippingFee)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {(() => {
                          const statusData = warningStatusService.getStatus(order.id);
                          if (statusData?.status === 'processed') {
                            return (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                                Đã xử lý
                              </span>
                            );
                          }
                          if (statusData?.status === 'completed') {
                            return (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300">
                                Đã kết thúc đơn
                              </span>
                            );
                          }
                          if (statusData?.status === 'compensated') {
                            return (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                                Đã đền bù
                              </span>
                            );
                          }
                          if (order.warningStatus === 'tracking') {
                            return (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                                Đang theo dõi
                              </span>
                            );
                          }
                          return (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                              Chưa xử lý
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap sticky right-0 bg-white dark:bg-gray-800 z-20 shadow-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCopyAllInfo(order)}
                            className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300"
                            title="Copy toàn bộ thông tin"
                          >
                            {copiedOrderId === order.id ? (
                              <Check size={16} className="text-green-600 dark:text-green-400" />
                            ) : (
                              <Copy size={16} />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              const statusData = warningStatusService.getStatus(order.id);
                              setNote(statusData?.note || '');
                            }}
                            className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300"
                            title="Xem chi tiết / Xử lý"
                          >
                            <Eye size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 px-6 py-3 flex items-center justify-between text-sm text-gray-700 dark:text-gray-300 border-t border-gray-200 dark:border-gray-700">
          <div>
            Tổng số: {filteredWarnings.length} đơn hàng cảnh báo
            {filteredWarnings.length > itemsPerPage && (
              <span className="ml-2">
                (Hiển thị {startIndex + 1}-{Math.min(endIndex, filteredWarnings.length)} / {itemsPerPage} đơn/trang)
              </span>
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value={50}>50 đơn/trang</option>
                <option value={100}>100 đơn/trang</option>
                <option value={200}>200 đơn/trang</option>
                <option value={500}>500 đơn/trang</option>
              </select>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-3 py-1 text-gray-700 dark:text-gray-300">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Action Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => {
          setSelectedOrder(null);
          setNote('');
        }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Xử lý cảnh báo đơn hàng</h2>
              <button
                onClick={() => {
                  setSelectedOrder(null);
                  setNote('');
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => handleCopyAllInfo(selectedOrder)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                  title="Copy toàn bộ thông tin đơn hàng"
                >
                  {copiedOrderId === selectedOrder.id ? (
                    <>
                      <Check size={18} />
                      Đã copy
                    </>
                  ) : (
                    <>
                      <Copy size={18} />
                      Copy toàn bộ thông tin
                    </>
                  )}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Mã vận đơn</label>
                  <div className="flex items-center gap-2">
                    <p 
                      className="text-lg font-semibold cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 select-none text-gray-900 dark:text-gray-100"
                      onDoubleClick={() => handleCopyTrackingNumber(selectedOrder.trackingNumber)}
                      title="Double-click để copy"
                    >
                      {selectedOrder.trackingNumber}
                    </p>
                    {copiedTrackingNumber === selectedOrder.trackingNumber && (
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs animate-fade-in">
                        <Check size={14} />
                        Đã copy
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Ngày gửi</label>
                  <p className="text-lg text-gray-900 dark:text-gray-100">{formatDate(selectedOrder.sendDate)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Số ngày</label>
                  <p className={`text-lg font-semibold ${getDaysDiff(selectedOrder) > 15 ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                    {getDaysDiff(selectedOrder)} ngày
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Khách hàng</label>
                  <p className="text-lg text-gray-900 dark:text-gray-100">{selectedOrder.customerName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">COD</label>
                  <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(selectedOrder.cod)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Cước phí</label>
                  <p className="text-lg font-semibold text-purple-600 dark:text-purple-400">{formatCurrency(selectedOrder.shippingFee)}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Ghi chú</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Nhập ghi chú về việc xử lý đơn hàng này..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  rows={3}
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => handleProcessStatus(selectedOrder.id, 'processed', note)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <CheckCircle2 size={18} />
                  Đã xử lý
                </button>
                <button
                  onClick={() => handleProcessStatus(selectedOrder.id, 'completed', note)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  <XCircle size={18} />
                  Đã kết thúc đơn
                </button>
                <button
                  onClick={() => handleProcessStatus(selectedOrder.id, 'compensated', note)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  <DollarSign size={18} />
                  Đã đền bù
                </button>
                <button
                  onClick={() => handleProcessStatus(selectedOrder.id, null)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  <Ban size={18} />
                  Hủy trạng thái
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bảng đơn đã xử lý */}
      {processedOrders.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
              Đơn đã xử lý ({processedOrders.length} đơn)
            </h2>
            <button
              onClick={() => setShowProcessedOrders(!showProcessedOrders)}
              className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300"
            >
              {showProcessedOrders ? 'Ẩn' : 'Hiển thị'}
            </button>
          </div>
          {showProcessedOrders && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Mã vận đơn</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Trạng thái</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ngày xử lý</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Khách hàng</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">COD</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {processedOrders.map(({ order, statusData }) => (
                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {order.trackingNumber}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {statusData.status === 'processed' ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                            Đã xử lý
                          </span>
                        ) : statusData.status === 'completed' ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300">
                            Đã kết thúc đơn
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                            Đã đền bù
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(new Date(statusData.processedAt))}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        <div>
                          <div className="font-medium">{order.customerName}</div>
                          <div className="text-gray-500 dark:text-gray-400 text-xs">{order.customerPhone}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {formatCurrency(order.cod || 0)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {statusData.note || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default Warnings;

