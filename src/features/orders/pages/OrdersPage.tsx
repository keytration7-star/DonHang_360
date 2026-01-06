/**
 * API Orders Page - Hiển thị đơn hàng từ nhiều shop/API
 * Hiển thị 3 tab: "Đã gửi hàng", "Đã nhận", "Đã hoàn"
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ShopOrders } from '../../../core/services/multiShopApiService';
import { PancakeOrder } from '../../../shared/types/pancakeApi';
import { useApiOrderStore } from '../../../core/store/apiOrderStore';
import { logger } from '../../../shared/utils/logger';
import { formatCurrency, getOrderStatusTag } from '../../../shared/utils/orderUtils';
import { exportOrdersToExcel, exportOrdersToCSV } from '../../../shared/utils/exportUtils';
import { useKeyboardShortcuts, COMMON_SHORTCUTS } from '../../../shared/hooks/useKeyboardShortcuts';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { 
  RefreshCw, 
  Package,
  Store,
  Loader,
  Download,
  Search,
  Filter,
  AlertCircle,
  CheckCircle,
  XCircle,
  Send,
  CheckCircle2,
  RotateCcw,
  X,
  Check,
  FileSpreadsheet,
  FileText,
  ChevronDown
} from 'lucide-react';

type OrderStatusTab = 'sent' | 'received' | 'returned';

const ApiOrders = () => {
  const [loading, setLoading] = useState(false);
  const [shopOrders, setShopOrders] = useState<ShopOrders[]>([]);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300); // Debounce search 300ms để tránh lag
  const [selectedShop, setSelectedShop] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<OrderStatusTab>('sent');
  const [copiedTrackingNumber, setCopiedTrackingNumber] = useState<string | null>(null);
  const [copiedShipperPhone, setCopiedShipperPhone] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<PancakeOrder | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Load từ cache ngay lập tức, sau đó fetch mới nếu cần
  const { initializeFromCache, fetchOrders: fetchOrdersFromStore, shopOrders: cachedShopOrders, isInitialized, startPolling, stopPolling } = useApiOrderStore();
  
  // Deduplicate shops ngay từ đầu - normalize shopId và loại bỏ shop rỗng
  const uniqueShopOrders = useMemo(() => {
    if (shopOrders.length === 0) return [];
    
    const shopMap = new Map<string, ShopOrders>();
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
    
    return uniqueShops;
  }, [shopOrders]);
  
  // Load từ cache ngay khi mount - CHỈ MỘT LẦN
  useEffect(() => {
    let isMounted = true;
    
    initializeFromCache().then(() => {
      if (!isMounted) return;
      
      // Sau khi load cache, cập nhật state từ store
      const storeState = useApiOrderStore.getState();
      if (storeState.shopOrders.length > 0) {
        setShopOrders(storeState.shopOrders);
      }
    }).catch((err) => {
      logger.error('❌ ApiOrders - Lỗi load cache:', err);
    });
    
    return () => {
      isMounted = false;
    };
  }, []); // Chỉ chạy 1 lần khi mount
  
  // Lắng nghe event khi API config được thêm/cập nhật
  useEffect(() => {
    const handleApiConfigUpdated = async () => {
      // API config updated, fetching new data
      // Fetch dữ liệu mới khi có API config mới (force fetch để lấy đầy đủ)
      setLoading(true);
      try {
        await fetchOrdersFromStore(true, false, false);
        // Sau khi fetch xong, cập nhật shopOrders từ store
        const storeState = useApiOrderStore.getState();
        if (storeState.shopOrders.length > 0) {
          setShopOrders(storeState.shopOrders);
        }
      } catch (error) {
        logger.error('❌ ApiOrders: Lỗi fetch sau khi thêm API:', error);
      } finally {
        setLoading(false);
      }
    };

    window.addEventListener('apiConfigUpdated', handleApiConfigUpdated);
    
    return () => {
      window.removeEventListener('apiConfigUpdated', handleApiConfigUpdated);
    };
  }, [fetchOrdersFromStore]);
  
  // Sync với store khi store update - TỐI ƯU: Chỉ update khi thực sự cần
  const prevShopOrdersRef = useRef<string>('');
  useEffect(() => {
    // Tạo hash để so sánh nhanh hơn
    const shopOrdersHash = JSON.stringify(cachedShopOrders.map(s => ({ id: s.shopId, count: s.orders.length })));
    
    if (cachedShopOrders.length > 0 && shopOrdersHash !== prevShopOrdersRef.current) {
      const currentShopIds = new Set(shopOrders.map(s => String(s.shopId)));
      const newShopIds = new Set(cachedShopOrders.map(s => String(s.shopId)));
      
      // Chỉ update nếu có thay đổi (shop mới, shop bị xóa, hoặc số lượng orders thay đổi)
      const hasChanged = currentShopIds.size !== newShopIds.size ||
        Array.from(currentShopIds).some(id => !newShopIds.has(id)) ||
        Array.from(newShopIds).some(id => !currentShopIds.has(id)) ||
        cachedShopOrders.some(newShop => {
          const oldShop = shopOrders.find(s => String(s.shopId) === String(newShop.shopId));
          return !oldShop || oldShop.orders.length !== newShop.orders.length;
        });
      
      if (hasChanged || shopOrders.length === 0) {
        prevShopOrdersRef.current = shopOrdersHash;
        setShopOrders(cachedShopOrders);
      }
    }
  }, [cachedShopOrders, shopOrders]);
  
  // TẮT auto-fetch trong background để tránh lag

  // Listen for updates từ store - TỐI ƯU: Debounce để tránh quá nhiều updates
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    const handleDataUpdated = () => {
      // Debounce updates để tránh quá nhiều re-render
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      updateTimeoutRef.current = setTimeout(() => {
      const storeState = useApiOrderStore.getState();
      if (storeState.shopOrders.length > 0) {
        setShopOrders(storeState.shopOrders);
      }
      }, 100); // Debounce 100ms
    };
    
    const handleIncrementalUpdate = () => {
      // Debounce incremental updates
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      updateTimeoutRef.current = setTimeout(() => {
      const storeState = useApiOrderStore.getState();
      if (storeState.shopOrders.length > 0) {
        setShopOrders(storeState.shopOrders);
      }
      }, 100);
    };
    
    window.addEventListener('apiOrdersUpdated', handleDataUpdated);
    window.addEventListener('apiOrdersIncrementalUpdate', handleIncrementalUpdate);
    
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      window.removeEventListener('apiOrdersUpdated', handleDataUpdated);
      window.removeEventListener('apiOrdersIncrementalUpdate', handleIncrementalUpdate);
    };
  }, []);
  

  // Handler copy mã vận đơn - TỐI ƯU: useCallback
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

  // Handler copy SĐT shipper - TỐI ƯU: useCallback
  const handleCopyShipperPhone = useCallback(async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedShipperPhone(phone);
      setTimeout(() => {
        setCopiedShipperPhone(null);
      }, 2000);
    } catch (err) {
      logger.error('Lỗi copy SĐT shipper:', err);
    }
  }, []);

  // Handler click vào khách hàng để xem chi tiết đơn hàng - TỐI ƯU: useCallback
  const handleCustomerClick = useCallback((order: PancakeOrder, e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    setSelectedOrder(order);
  }, []);

  const handleFetchAll = useCallback(async () => {
    setLoading(true);
    try {
    await fetchOrdersFromStore(true, false, false);
      const storeState = useApiOrderStore.getState();
      if (storeState.shopOrders.length > 0) {
        setShopOrders(storeState.shopOrders);
      }
    } catch (error) {
      logger.error('❌ ApiOrders: Lỗi fetch:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchOrdersFromStore]);

  // Export handlers - TỐI ƯU: useCallback (sẽ được định nghĩa sau filteredOrders)

  // Filter orders theo status
  const filterOrdersByStatus = (orders: PancakeOrder[], status: OrderStatusTab): PancakeOrder[] => {
    return orders.filter(order => {
      // Xử lý trường hợp status có thể là string, number, object, hoặc undefined
      let orderStatus = '';
      let statusCode: number | undefined = undefined;
      let statusName = '';
      
      // Lấy status từ nhiều nguồn khác nhau
      if (order.status) {
        if (typeof order.status === 'string') {
          orderStatus = order.status.toLowerCase();
        } else if (typeof order.status === 'number') {
          statusCode = order.status;
          orderStatus = String(order.status);
        } else if (typeof order.status === 'object' && order.status !== null) {
          // Nếu status là object, thử lấy các field có thể chứa status text
          const statusObj = order.status as Record<string, unknown>;
          orderStatus = (typeof statusObj.name === 'string' ? statusObj.name.toLowerCase() : '') || 
                       (typeof statusObj.status === 'string' ? statusObj.status.toLowerCase() : '') || 
                       (typeof statusObj.text === 'string' ? statusObj.text.toLowerCase() : '') || 
                       JSON.stringify(order.status).toLowerCase();
          statusCode = (typeof statusObj.code === 'number' ? statusObj.code : undefined) || 
                      (typeof statusObj.id === 'number' ? statusObj.id : undefined);
        }
      }
      
      // Thử lấy từ status_name
      if (order.status_name) {
        statusName = String(order.status_name).toLowerCase();
      }
      
      // Thử lấy từ status_code
      if (order.status_code !== undefined) {
        statusCode = order.status_code;
      }
      
      // QUAN TRỌNG: Lấy sub_status (đây là field chính để phân loại)
      // Theo API docs: sub_status = 6 (Đã gửi hàng), 7 (Đã nhận), 8 (Đã hoàn)
      let subStatusCode: number | undefined = undefined;
      let subStatusName = '';
      
      if (order.sub_status !== undefined) {
        const subStatus = order.sub_status;
        if (typeof subStatus === 'number') {
          subStatusCode = subStatus;
        } else if (typeof subStatus === 'string') {
          // Nếu là string, thử parse thành number
          const parsed = parseInt(subStatus, 10);
          if (!isNaN(parsed)) {
            subStatusCode = parsed;
          } else {
            subStatusName = String(subStatus).toLowerCase();
          }
        } else if (typeof subStatus === 'object' && subStatus !== null) {
          const subStatusObj = subStatus as Record<string, unknown>;
          const nameValue = subStatusObj.name;
          subStatusName = (typeof nameValue === 'string' ? nameValue.toLowerCase() : '');
          subStatusCode = (typeof subStatusObj.code === 'number' ? subStatusObj.code : undefined) || 
                         (typeof subStatusObj.id === 'number' ? subStatusObj.id : undefined) ||
                         (typeof subStatusObj.value === 'number' ? subStatusObj.value : undefined);
        }
      }
      
      // Thử lấy từ sub_status_name nếu có
      if (order.sub_status_name) {
        subStatusName = String(order.sub_status_name).toLowerCase();
      }
      
      // Thử lấy từ status_code nếu sub_status không có
      if (subStatusCode === undefined && statusCode !== undefined) {
        // Nếu status_code = 6, 7, 8 thì có thể dùng luôn
        if (statusCode === 6 || statusCode === 7 || statusCode === 8) {
          subStatusCode = statusCode;
        }
      }
      
      // Kết hợp tất cả các giá trị để tìm kiếm
      const combinedStatus = `${orderStatus} ${statusName} ${subStatusName}`.trim();
      
      switch (status) {
        case 'sent':
          // Đã gửi hàng: 
          // Từ log thực tế: đơn ID 6 và 46 có sub_status = 1, status = 2, status_name = 'shipped'
          // - sub_status = 1 (thực tế từ API)
          // - hoặc status_name = 'shipped'
          // - hoặc status = 2 (nhưng cần cẩn thận)
          // QUAN TRỌNG: Loại bỏ đơn "Đã nhận" (7) và "Đã hoàn" (8)
          
          const statusNameValue = order.status_name || '';
          const statusNameLower = statusNameValue.toLowerCase();
          
          // Check theo thực tế từ API: sub_status = 1 HOẶC status_name = 'shipped'
          const isSent = (subStatusCode === 1 || statusNameLower === 'shipped') &&
                        // Đảm bảo không phải "Đã nhận" hoặc "Đã hoàn"
                        subStatusCode !== 7 && subStatusCode !== 8 &&
                        statusCode !== 7 && statusCode !== 8 &&
                        statusNameLower !== 'delivered' &&
                        statusNameLower !== 'returned' &&
                        statusNameLower !== 'received';
          
          return isSent;
        case 'received':
          // Đã nhận: GIỮ NGUYÊN LOGIC CŨ (đã đúng trước đó)
          // - sub_status = 7 (theo API docs: "Đã nhận")
          // - hoặc status code 7
          // - hoặc text chứa "đã nhận", "received", "nhận", "delivered"
          return subStatusCode === 7 ||
                 statusCode === 7 ||
                 combinedStatus.includes('đã nhận') || 
                 combinedStatus.includes('received') || 
                 combinedStatus.includes('nhận') ||
                 combinedStatus.includes('delivered') ||
                 combinedStatus.includes('đã nhận hàng');
        case 'returned':
          // Đã hoàn: GIỮ NGUYÊN LOGIC CŨ (đã đúng trước đó)
          // - sub_status = 8 (theo API docs: "Đã hoàn")
          // - hoặc status code 8
          // - hoặc text chứa "đã hoàn", "returned", "hoàn"
          // - hoặc từ endpoint /orders_returned
          return subStatusCode === 8 ||
                 statusCode === 8 ||
                 combinedStatus.includes('đã hoàn') || 
                 combinedStatus.includes('returned') || 
                 combinedStatus.includes('hoàn') ||
                 combinedStatus.includes('đã hoàn hàng') ||
                 order.from_returned_endpoint === true; // Đánh dấu từ /orders_returned
        default:
          return false;
      }
    });
  };

  // Get all orders from all shops (hoặc từ shop được chọn)
  const getAllOrders = (): PancakeOrder[] => {
    if (selectedShop === 'all') {
      return uniqueShopOrders.flatMap(shop => shop.orders);
    }
    // Filter theo shop được chọn - normalize shopId để so sánh
    const normalizedSelectedShop = String(selectedShop);
    const filteredShops = uniqueShopOrders.filter(shop => String(shop.shopId) === normalizedSelectedShop);
    
    return filteredShops.flatMap(shop => shop.orders);
  };

  // Get orders by active tab (đã tính đến selectedShop trong getAllOrders) - TỐI ƯU: useCallback
  const getOrdersByTab = useCallback((): PancakeOrder[] => {
    const allOrders = getAllOrders(); // getAllOrders đã filter theo selectedShop
    const filtered = filterOrdersByStatus(allOrders, activeTab);
    return filtered;
  }, [getAllOrders, activeTab, filterOrdersByStatus]);

  // Helper function to highlight search query in text - TỐI ƯU: useCallback
  const highlightText = useCallback((text: string, query: string): React.ReactNode => {
    if (!query.trim() || !text) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return (
      <>
        {parts.map((part, index) => 
          regex.test(part) ? (
            <span key={index} className="bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100 font-semibold">
              {part}
            </span>
          ) : (
            part
          )
        )}
      </>
    );
  }, []);

  // Filter orders by search query - Tìm kiếm trong TẤT CẢ 3 tab khi có searchQuery
  // getAllOrders() đã tính đến selectedShop, nên filteredOrders cũng sẽ theo shop được chọn
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) {
      // Nếu không có search query, chỉ hiển thị orders của tab đang active
      return getOrdersByTab();
    }
    
    // Nếu có search query, tìm kiếm trong TẤT CẢ orders (cả 3 tab)
    // getAllOrders() đã filter theo selectedShop rồi
    const allOrders = getAllOrders();
    const query = searchQuery.toLowerCase();
    
    return allOrders.filter(order => {
      // Tìm trong ID/order_code
      const orderId = String(order.order_id || order.id || order.code || order.order_code || '').toLowerCase();
      
      // Tìm trong mã vận đơn
      const partner = order.partner;
      let trackingNumber = '';
      if (partner?.extend_code) {
        trackingNumber = partner.extend_code;
      } else if (partner?.tracking_id) {
        trackingNumber = partner.tracking_id;
      } else {
        trackingNumber = order.tracking_number || order.tracking_code || order.tracking || order.tracking_id || '';
      }
      trackingNumber = trackingNumber.toLowerCase();
      
      // Tìm trong tên khách hàng
      const customerName = (order.bill_full_name ||
                           order.customer_name ||
                           order.receiver_name ||
                           order.receiver_fullname ||
                           order.customer_full_name ||
                           '').toLowerCase();
      
      // Tìm trong SĐT khách hàng
      const customerPhone = (order.bill_phone_number ||
                            order.customer_phone ||
                            order.receiver_phone ||
                            order.phone ||
                            order.customer_phone_number ||
                            order.receiver_phone_number ||
                            order.phone_number ||
                            '').toLowerCase();
      
      // Tìm trong SĐT shipper
      const shipperPhone = (partner?.delivery_tel ||
                           partner?.delivery_phone ||
                           (typeof order.shipper_phone === 'string' ? order.shipper_phone : '') ||
                           (typeof order.delivery_tel === 'string' ? order.delivery_tel : '') ||
                           '');
      const shipperPhoneLower = typeof shipperPhone === 'string' ? shipperPhone.toLowerCase() : '';
      
      // Tìm trong địa chỉ
      const shippingAddress = order.shipping_address;
      const address = (shippingAddress && (shippingAddress.full_address || shippingAddress.address)) ||
                     order.bill_address ||
                     order.delivery_address ||
                     order.receiver_address ||
                     (typeof order.address === 'string' ? order.address : '') ||
                     '';
      const addressLower = typeof address === 'string' ? address.toLowerCase() : '';
      
      // Tìm trong sản phẩm
      const items = order.items || [];
      const productNames = items.map((item) => {
        const itemName = item.variation_info?.name || item.product_name || item.name || '';
        return typeof itemName === 'string' ? itemName.toLowerCase() : '';
      }).join(' ');
      
      return orderId.includes(query) ||
             trackingNumber.includes(query) ||
             customerName.includes(query) ||
             customerPhone.includes(query) ||
             shipperPhoneLower.includes(query) ||
             addressLower.includes(query) ||
             productNames.includes(query);
    });
  }, [debouncedSearchQuery, getOrdersByTab, getAllOrders]);

  // Export handlers - TỐI ƯU: useCallback (sau filteredOrders để có thể sử dụng)
  const handleExportJSON = useCallback(() => {
    const data = {
      exportedAt: new Date().toISOString(),
      totalOrders: filteredOrders.length,
      status: activeTab,
      orders: filteredOrders,
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `don-hang-${activeTab}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, [filteredOrders, activeTab]);

  const handleExportExcel = useCallback(() => {
    exportOrdersToExcel(filteredOrders, `don-hang-${activeTab}`);
    setShowExportMenu(false);
  }, [filteredOrders, activeTab]);

  const handleExportCSV = useCallback(() => {
    exportOrdersToCSV(filteredOrders, `don-hang-${activeTab}`);
    setShowExportMenu(false);
  }, [filteredOrders, activeTab]);

  // Count orders by status (tính theo shop được chọn)
  const ordersByStatus = useMemo(() => {
    const allOrders = getAllOrders();
    const sent = filterOrdersByStatus(allOrders, 'sent').length;
    const received = filterOrdersByStatus(allOrders, 'received').length;
    const returned = filterOrdersByStatus(allOrders, 'returned').length;
    return {
      sent,
      received,
      returned,
      total: sent + received + returned, // Tổng đơn hàng = tổng của 3 tab
    };
  }, [getAllOrders, filterOrdersByStatus]);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      ...COMMON_SHORTCUTS.REFRESH,
      action: () => {
        if (!loading) {
          handleFetchAll();
        }
      },
    },
    {
      ...COMMON_SHORTCUTS.EXPORT,
      action: () => {
        if (filteredOrders.length > 0) {
          setShowExportMenu(!showExportMenu);
        }
      },
    },
    {
      key: 'Escape',
      action: () => {
        setShowExportMenu(false);
        setSelectedOrder(null);
      },
    },
  ]);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showExportMenu && !target.closest('.export-menu-container')) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  const uniqueShops = Array.from(new Set(uniqueShopOrders.map(s => s.shopId)));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Đơn hàng từ API</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Hiển thị đơn hàng từ tất cả các shop/API đã cấu hình
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative export-menu-container">
          <button
              onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={filteredOrders.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title="Xuất dữ liệu (Ctrl+E)"
          >
            <Download size={16} />
              Xuất dữ liệu
              <ChevronDown size={16} />
          </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                <button
                  onClick={handleExportExcel}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                >
                  <FileSpreadsheet size={16} />
                  Xuất Excel
                </button>
                <button
                  onClick={handleExportCSV}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                >
                  <FileText size={16} />
                  Xuất CSV
                </button>
                <button
                  onClick={handleExportJSON}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                >
                  <Download size={16} />
                  Xuất JSON
                </button>
              </div>
            )}
          </div>
          <button
            onClick={handleFetchAll}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            title="Làm mới dữ liệu (Ctrl+R)"
          >
            {loading ? <Loader className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            Làm mới
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Tổng đơn hàng</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{ordersByStatus.total.toLocaleString()}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Số shop</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {selectedShop === 'all' ? uniqueShopOrders.length : 1}
          </div>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('sent')}
            className={`flex-1 px-6 py-4 text-center font-semibold transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'sent'
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Send size={20} />
            <span>Đã gửi hàng</span>
            <span className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs">
              {ordersByStatus.sent.toLocaleString()}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('received')}
            className={`flex-1 px-6 py-4 text-center font-semibold transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'received'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-b-2 border-green-600'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <CheckCircle2 size={20} />
            <span>Đã nhận</span>
            <span className="ml-2 px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-xs">
              {ordersByStatus.received.toLocaleString()}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('returned')}
            className={`flex-1 px-6 py-4 text-center font-semibold transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'returned'
                ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-b-2 border-orange-600'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <RotateCcw size={20} />
            <span>Đã hoàn</span>
            <span className="ml-2 px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded-full text-xs">
              {ordersByStatus.returned.toLocaleString()}
            </span>
          </button>
        </div>

        {/* Search and Filter */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm theo mã đơn, mã vận đơn, tên khách hàng, số điện thoại..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            <div className="w-full md:w-64">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <select
                  value={selectedShop}
                  onChange={(e) => setSelectedShop(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white appearance-none"
                >
                  <option value="all">Tất cả shop</option>
                  {uniqueShops.map(shopId => {
                    const shop = uniqueShopOrders.find(s => s.shopId === shopId);
                    return shop ? (
                      <option key={shopId} value={shopId}>{shop.shopName}</option>
                    ) : null;
                  })}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader className="animate-spin text-blue-600 mr-3" size={24} />
              <span className="text-gray-900 dark:text-white">Đang tải dữ liệu...</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center p-8">
              <Package className="mx-auto text-gray-400 mb-4" size={48} />
              <p className="text-gray-600 dark:text-gray-400">
                {searchQuery.trim() 
                  ? `Không tìm thấy đơn hàng nào với từ khóa "${searchQuery}"`
                  : `Không có đơn hàng nào trong tab "${activeTab === 'sent' ? 'Đã gửi hàng' : activeTab === 'received' ? 'Đã nhận' : 'Đã hoàn'}"`}
              </p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[calc(100vh-300px)] border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="overflow-x-auto overflow-y-auto">
                <table className="text-sm" style={{ tableLayout: 'auto', width: 'auto', minWidth: '100%' }}>
                  <thead className="sticky top-0 bg-white dark:bg-gray-800 z-10">
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left p-2 font-semibold text-gray-900 dark:text-white whitespace-nowrap bg-white dark:bg-gray-800 min-w-[60px] sticky left-0 z-20 shadow-[2px_0_4px_rgba(0,0,0,0.1)]">ID</th>
                      <th className="text-left p-2 font-semibold text-gray-900 dark:text-white whitespace-nowrap bg-white dark:bg-gray-800 min-w-[150px]">Khách hàng</th>
                      <th className="text-left p-2 font-semibold text-gray-900 dark:text-white whitespace-nowrap bg-white dark:bg-gray-800 min-w-[130px]">SĐT</th>
                      <th className="text-left p-2 font-semibold text-gray-900 dark:text-white whitespace-nowrap bg-white dark:bg-gray-800 min-w-[140px]">Mã vận đơn</th>
                      <th className="text-left p-2 font-semibold text-gray-900 dark:text-white whitespace-nowrap bg-white dark:bg-gray-800 min-w-[150px]">Thẻ</th>
                      <th className="text-left p-2 font-semibold text-gray-900 dark:text-white whitespace-nowrap bg-white dark:bg-gray-800 min-w-[200px]">Nhận hàng</th>
                      <th className="text-left p-2 font-semibold text-gray-900 dark:text-white whitespace-nowrap bg-white dark:bg-gray-800 min-w-[100px]">COD</th>
                      <th className="text-left p-2 font-semibold text-gray-900 dark:text-white whitespace-nowrap bg-white dark:bg-gray-800 min-w-[150px]">Sản phẩm</th>
                      <th className="text-left p-2 font-semibold text-gray-900 dark:text-white whitespace-nowrap bg-white dark:bg-gray-800 min-w-[150px]">Ngày đẩy đơn sang ĐVVC</th>
                      <th className="text-left p-2 font-semibold text-gray-900 dark:text-white whitespace-nowrap bg-white dark:bg-gray-800 min-w-[80px]">VC</th>
                      <th className="text-left p-2 font-semibold text-gray-900 dark:text-white whitespace-nowrap bg-white dark:bg-gray-800 min-w-[110px]">SĐT shipper</th>
                      <th className="text-left p-2 font-semibold text-gray-900 dark:text-white whitespace-nowrap bg-white dark:bg-gray-800 min-w-[140px]">ĐVVC giao lần đầu</th>
                      <th className="text-left p-2 font-semibold text-gray-900 dark:text-white whitespace-nowrap bg-white dark:bg-gray-800 min-w-[150px]">Ghi chú nội bộ</th>
                      <th className="text-left p-2 font-semibold text-gray-900 dark:text-white whitespace-nowrap bg-white dark:bg-gray-800 min-w-[150px]">Ghi chú để in</th>
                      {searchQuery.trim() && (
                        <th className="text-left p-2 font-semibold text-gray-900 dark:text-white whitespace-nowrap bg-white dark:bg-gray-800 min-w-[120px]">Trạng thái</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders
                      .map((order) => (
                        <tr key={order.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 whitespace-nowrap">
                        {/* ID - Mã đơn hàng trong Pancake - CỐ ĐỊNH */}
                        <td className="p-2 text-gray-900 dark:text-white bg-white dark:bg-gray-800 sticky left-0 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                          {(() => {
                            // ID có thể là: id, order_id, code, order_code
                            const orderId = String(order.order_id || 
                                          order.id || 
                                          order.code || 
                                          order.order_code || 
                                          '-');
                            return highlightText(orderId, searchQuery);
                          })()}
                        </td>
                        {/* Khách hàng */}
                        <td className="p-2 text-gray-900 dark:text-white">
                          {(() => {
                            // Tìm field "Khách hàng" - tên khách hàng
                            // Từ api-1.yaml: bill_full_name = "Tên khách hàng"
                            const customerName = order.bill_full_name ||
                                                order.customer_name ||
                                                order.receiver_name ||
                                                order.receiver_fullname ||
                                                order.customer_full_name ||
                                                '-';
                            
                            return (
                              <div 
                                className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1 -mx-2 -my-1 transition-colors"
                                onClick={(e) => handleCustomerClick(order, e)}
                                title="Click để xem chi tiết đơn hàng"
                              >
                                {/* Avatar placeholder */}
                                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-semibold text-gray-600 dark:text-gray-400 flex-shrink-0">
                                  {(() => {
                                    if (!customerName || customerName === '-') return '?';
                                    // Lấy chữ cái đầu của từ cuối cùng
                                    const words = customerName.trim().split(/\s+/);
                                    const lastWord = words[words.length - 1];
                                    return lastWord.charAt(0).toUpperCase();
                                  })()}
                                </div>
                                <span className="font-medium">{highlightText(customerName, searchQuery)}</span>
                              </div>
                            );
                          })()}
                        </td>
                        {/* SĐT */}
                        <td className="p-2 text-gray-900 dark:text-white">
                          {(() => {
                            // Tìm field "SĐT" - số điện thoại khách hàng
                            // Từ api-1.yaml: bill_phone_number = "SĐT khách hàng"
                            const phone = order.bill_phone_number ||
                                         order.customer_phone ||
                                         order.receiver_phone ||
                                         order.phone ||
                                         order.customer_phone_number ||
                                         order.receiver_phone_number ||
                                         order.phone_number ||
                                         '-';
                            
                            if (!phone || phone === '-') return '-';
                            
                            // Hàm detect nhà mạng từ số điện thoại Việt Nam
                            const detectCarrier = (phoneNumber: string): { name: string; color: string } => {
                              const cleaned = phoneNumber.replace(/[\s-]/g, '');
                              const prefix = cleaned.substring(0, 3);
                              
                              // Viettel: 032, 033, 034, 035, 036, 037, 038, 039, 086, 096, 097, 098
                              if (['032', '033', '034', '035', '036', '037', '038', '039', '086', '096', '097', '098'].includes(prefix)) {
                                return { name: 'Viettel', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
                              }
                              // Vinaphone: 081, 082, 083, 084, 085, 088, 091, 094
                              if (['081', '082', '083', '084', '085', '088', '091', '094'].includes(prefix)) {
                                return { name: 'Vinaphone', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' };
                              }
                              // Mobifone: 070, 076, 077, 078, 079, 089, 090, 093
                              if (['070', '076', '077', '078', '079', '089', '090', '093'].includes(prefix)) {
                                return { name: 'Mobifone', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' };
                              }
                              // Vietnamobile: 052, 056, 058, 092
                              if (['052', '056', '058', '092'].includes(prefix)) {
                                return { name: 'Vietnamobile', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' };
                              }
                              // Gmobile: 059, 099
                              if (['059', '099'].includes(prefix)) {
                                return { name: 'Gmobile', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' };
                              }
                              
                              return { name: '', color: '' };
                            };
                            
                            const carrier = detectCarrier(phone);
                            
                            return (
                              <div className="flex items-center gap-2">
                                <span>{highlightText(phone, searchQuery)}</span>
                                {carrier.name && (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${carrier.color}`}>
                                    {carrier.name}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        {/* Mã vận đơn */}
                        <td className="p-2 text-gray-900 dark:text-white font-mono">
                          {(() => {
                            const partner = order.partner;
                            let trackingNumber = '';

                            if (partner && partner.extend_code) {
                              trackingNumber = partner.extend_code;
                            }
                            else if (partner && partner.extend_update && Array.isArray(partner.extend_update)) {
                              const trackingUpdate = partner.extend_update?.find(u => u.tracking_id);
                              if (trackingUpdate && trackingUpdate.tracking_id) {
                                trackingNumber = trackingUpdate.tracking_id;
                              }
                            }
                            else if (partner && partner.tracking_id) {
                              trackingNumber = partner.tracking_id;
                            }
                            else {
                              trackingNumber = order.tracking_number ||
                                            order.tracking_code ||
                                            order.tracking ||
                                            order.tracking_id ||
                                            '-';
                            }

                            if (!trackingNumber || trackingNumber === '-') return '-';

                            return (
                              <div className="flex items-center gap-2">
                                <span 
                                  className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 select-none"
                                  onDoubleClick={() => handleCopyTrackingNumber(trackingNumber)}
                                  title="Double-click để copy mã vận đơn"
                                >
                                  {highlightText(trackingNumber, searchQuery)}
                                </span>
                                {copiedTrackingNumber === trackingNumber && (
                                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs animate-fade-in">
                                    <Check size={14} />
                                    Đã copy
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        {/* Thẻ - Trạng thái đơn hàng */}
                        <td className="p-2 text-gray-900 dark:text-white">
                          {(() => {
                            // Debug: Log partner data để xem cấu trúc thực tế
                            const partner = order.partner;
                            if (partner && process.env.NODE_ENV === 'development') {
                              // Chỉ log một vài lần đầu để tránh spam console
                              const orderId = order.id || order.code || '';
                              if (!(window as any).__statusDebugged) {
                                (window as any).__statusDebugged = new Set();
                              }
                              // Log đơn hàng 226 hoặc bất kỳ đơn nào có partner (giới hạn 10 đơn đầu)
                              const orderIdStr = String(orderId || '');
                              const shouldLog = (orderIdStr === '226' || 
                                                orderIdStr.includes('226') ||
                                                (window as any).__statusDebugged.size < 10) &&
                                               !(window as any).__statusDebugged.has(orderIdStr);
                              
                              if (shouldLog) {
                                console.log('🔍 Status Debug - Order:', orderIdStr);
                                console.log('Partner object:', partner);
                                console.log('Partner keys:', Object.keys(partner || {}));
                                // Log tất cả các giá trị string trong partner
                                const partnerObj = partner as Record<string, unknown>;
                                console.log('All partner values:');
                                Object.keys(partnerObj).forEach(key => {
                                  const value = partnerObj[key];
                                  if (typeof value === 'string' && value.trim() && value.length < 200) {
                                    console.log(`  ${key}:`, value);
                                  }
                                });
                                // Đặc biệt log extend_update
                                if (partnerObj.extend_update && Array.isArray(partnerObj.extend_update)) {
                                  console.log('extend_update:', partnerObj.extend_update);
                                  partnerObj.extend_update.forEach((item: unknown, idx: number) => {
                                    if (typeof item === 'object' && item !== null) {
                                      const updateItem = item as Record<string, unknown>;
                                      console.log(`  extend_update[${idx}]:`, updateItem);
                                    }
                                  });
                                }
                                // Đặc biệt log các trường status
                                console.log('Status fields:');
                                console.log('  delivery_status_text:', partnerObj.delivery_status_text);
                                console.log('  tracking_status_text:', partnerObj.tracking_status_text);
                                console.log('  status_text:', partnerObj.status_text);
                                console.log('  delivery_status:', partnerObj.delivery_status);
                                console.log('  tracking_status:', partnerObj.tracking_status);
                                console.log('  status:', partnerObj.status);
                                (window as any).__statusDebugged.add(orderIdStr);
                              }
                            }
                            
                            const statusTag = getOrderStatusTag(order);
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
                        {/* Nhận hàng */}
                        <td className="p-2 text-gray-900 dark:text-white text-xs whitespace-normal" style={{ minWidth: '200px', maxWidth: '300px' }}>
                          {(() => {
                            // Tìm field "Nhận hàng" - địa chỉ giao hàng
                            // Từ api-1.yaml: shipping_address.full_address hoặc shipping_address.address
                            const shippingAddress = order.shipping_address;
                            let address = '';
                            
                            if (shippingAddress) {
                              // Ưu tiên full_address (địa chỉ đầy đủ)
                              address = shippingAddress.full_address || 
                                       shippingAddress.address ||
                                       '';
                            }
                            
                            // Fallback: các field khác
                            if (!address) {
                              address = order.bill_address ||
                                       order.delivery_address ||
                                       order.receiver_address ||
                                       (typeof order.address === 'string' ? order.address : '') ||
                                       order.delivery_address_full ||
                                       order.full_address ||
                                       order.customer_address ||
                                       (typeof order.receiver_full_address === 'string' ? order.receiver_full_address : '') ||
                                       (order.customer?.address || '') ||
                                       (order.customer?.full_address || '') ||
                                       '';
                            }
                            
                            if (!address || address === '') return '-';
                            
                            // Hiển thị địa chỉ đầy đủ - cho phép wrap để hiển thị đầy đủ
                            return <span className="text-xs break-words">{highlightText(address, searchQuery)}</span>;
                          })()}
                        </td>
                        {/* COD */}
                        <td className="p-2 text-gray-900 dark:text-white">
                          {order.cod ? formatCurrency(order.cod) : '-'}
                        </td>
                        {/* Sản phẩm */}
                        <td className="p-2 text-gray-900 dark:text-white text-xs">
                          {(() => {
                            // Tìm field "Sản phẩm" - danh sách sản phẩm trong đơn
                            // Từ api-1.yaml: items[] = "Danh sách sản phẩm"
                            // items[].variation_info.name = "Tên sản phẩm"
                            const items = order.items;
                            
                            if (!items || !Array.isArray(items) || items.length === 0) {
                              // Fallback: các field khác
                              const productName = (typeof order.product_name === 'string' ? order.product_name : '') ||
                                                (typeof order.goods_content === 'string' ? order.goods_content : '') ||
                                                (typeof order.product === 'string' ? order.product : '') ||
                                                (typeof order.goods === 'string' ? order.goods : '') ||
                                                '-';
                              return productName;
                            }
                            
                            // Lấy danh sách tên sản phẩm từ items[]
                            const productNames = items
                              .map((item) => {
                                // Ưu tiên: variation_info.name (tên sản phẩm từ biến thể)
                                let name = '';
                                if (item.variation_info && item.variation_info.name) {
                                  name = item.variation_info.name;
                                } else if (item.product_name) {
                                  name = item.product_name;
                                } else if (item.name) {
                                  name = typeof item.name === 'string' ? item.name : '';
                                } else if (item.title) {
                                  name = typeof item.title === 'string' ? item.title : '';
                                } else if (item.product_title) {
                                  name = typeof item.product_title === 'string' ? item.product_title : '';
                                } else if (item.variation_name) {
                                  name = typeof item.variation_name === 'string' ? item.variation_name : '';
                                }
                                
                                // Lấy số lượng nếu có
                                const quantity = item.quantity || item.qty || 1;
                                
                                if (name) {
                                  return quantity > 1 ? `${quantity}x ${name}` : name;
                                }
                                return null;
                              })
                              .filter((name: string | null) => name !== null);
                            
                            if (productNames.length === 0) return '-';
                            
                            // Hiển thị danh sách sản phẩm, cách nhau bằng dấu phẩy hoặc xuống dòng
                            return (
                              <div className="text-xs">
                                {productNames.map((name: string, idx: number) => (
                                  <div key={idx} className="mb-1 last:mb-0">
                                    {name}
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </td>
                        {/* Ngày đẩy đơn sang ĐVVC */}
                        <td className="p-2 text-gray-600 dark:text-gray-400 text-xs">
                          {(() => {
                            // Tìm field "Ngày đẩy đơn sang ĐVVC" 
                            // Từ api-1.yaml: partner_inserted_at = "Time sent to courier" / "Thời điểm gửi đơn vị vận chuyển"
                            // Hoặc partner.picked_up_at = "Courier picked up at" / "Thời điểm đơn vị vận chuyển lấy hàng"
                            const partner = order.partner;
                            const shippedDate = order.partner_inserted_at || // Ưu tiên: thời điểm gửi đơn vị vận chuyển (theo api-1.yaml)
                                              partner?.picked_up_at || // Thời điểm đơn vị vận chuyển lấy hàng
                                              order.logistics_shipped_at ||
                                              order.shipped_at || 
                                              order.sent_at || 
                                              (typeof order.shipped_date === 'string' ? order.shipped_date : '') ||
                                              (typeof order.sent_date === 'string' ? order.sent_date : '') ||
                                              (typeof order.time_assign_seller === 'string' ? order.time_assign_seller : '') || // Thời gian phân công người bán
                                              (typeof order.logistics_sent_at === 'string' ? order.logistics_sent_at : '') ||
                                              order.delivery_date ||
                                              (typeof order.inserted_at === 'string' ? order.inserted_at : ''); // Fallback: ngày tạo đơn
                            
                            if (!shippedDate) return '-';
                            
                            try {
                              // Format: "HH:mm DD/MM/YYYY" (ví dụ: "16:28 27/12/2025")
                              const date = new Date(shippedDate);
                              // Kiểm tra date hợp lệ
                              if (isNaN(date.getTime())) return '-';
                              
                              const hours = String(date.getHours()).padStart(2, '0');
                              const minutes = String(date.getMinutes()).padStart(2, '0');
                              const day = String(date.getDate()).padStart(2, '0');
                              const month = String(date.getMonth() + 1).padStart(2, '0');
                              const year = date.getFullYear();
                              return `${hours}:${minutes} ${day}/${month}/${year}`;
                            } catch (error) {
                              return '-';
                            }
                          })()}
                        </td>
                        {/* VC - Đơn vị vận chuyển */}
                        <td className="p-2">
                          {(() => {
                            // Tìm field đơn vị vận chuyển
                            // Từ api-1.json: có thể là partner.partner_name hoặc cần map từ partner.partner_id
                            // Hoặc các field: carrier, logistics_name, shipping_carrier, carrier_name
                            const partner = order.partner;
                            
                            // Map partner_id sang tên đơn vị vận chuyển
                            const partnerIdToName: Record<number, string> = {
                              1: 'VTP',
                              2: 'J&T',
                              3: 'GHN',
                              4: 'GHTK',
                              5: 'Ninja Van',
                              6: 'Best Express',
                              7: 'Shopee Express',
                              8: 'Lazada Express',
                              // Thêm các mapping khác nếu cần
                            };
                            
                            let carrier = '';
                            
                            // Ưu tiên: partner.partner_name hoặc map từ partner.partner_id
                            if (partner) {
                              const partnerName = typeof partner.partner_name === 'string' ? partner.partner_name : undefined;
                              const partnerNameEn = typeof partner.partner_name_en === 'string' ? partner.partner_name_en : undefined;
                              const carrierName = typeof partner.carrier_name === 'string' ? partner.carrier_name : undefined;
                              const logisticsName = typeof partner.logistics_name === 'string' ? partner.logistics_name : undefined;
                              const mappedName = partner.partner_id && typeof partner.partner_id === 'number' ? partnerIdToName[partner.partner_id] : undefined;
                              
                              carrier = partnerName || 
                                       partnerNameEn ||
                                       carrierName ||
                                       logisticsName ||
                                       mappedName ||
                                       '';
                            }
                            
                            // Fallback: các field ở root level
                            if (!carrier) {
                              carrier = (typeof order.carrier === 'string' ? order.carrier : '') || 
                                       (typeof order.carrier_name === 'string' ? order.carrier_name : '') ||
                                       (typeof order.logistics_name === 'string' ? order.logistics_name : '') ||
                                       (typeof order.shipping_carrier === 'string' ? order.shipping_carrier : '') ||
                                       (typeof order.logistics === 'string' ? order.logistics : '') ||
                                       (typeof order.shipping_company === 'string' ? order.shipping_company : '') ||
                                       (typeof order.delivery_company === 'string' ? order.delivery_company : '') ||
                                       '';
                            }
                            
                            if (!carrier) return '-';
                            
                            // Xác định màu sắc dựa trên tên đơn vị vận chuyển
                            const carrierLower = carrier.toLowerCase();
                            let bgColor = 'bg-green-100 dark:bg-green-900';
                            let textColor = 'text-green-800 dark:text-green-200';
                            
                            if (carrierLower.includes('vtp') || carrierLower.includes('viettel')) {
                              bgColor = 'bg-teal-100 dark:bg-teal-900';
                              textColor = 'text-teal-800 dark:text-teal-200';
                            } else if (carrierLower.includes('j&t') || carrierLower.includes('jnt')) {
                              bgColor = 'bg-red-100 dark:bg-red-900';
                              textColor = 'text-red-800 dark:text-red-200';
                            } else if (carrierLower.includes('ghn')) {
                              bgColor = 'bg-blue-100 dark:bg-blue-900';
                              textColor = 'text-blue-800 dark:text-blue-200';
                            }
                            
                            // Hiển thị với checkmark như trong ảnh: "VTP ✓", "J&T ✓"
                            return (
                              <span className={`px-2 py-1 rounded text-xs ${bgColor} ${textColor}`}>
                                {carrier} ✓
                              </span>
                            );
                          })()}
                        </td>
                        {/* SĐT shipper */}
                        <td className="p-2 text-gray-900 dark:text-white text-xs">
                          {(() => {
                            // Tìm field "SĐT shipper"
                            // Từ api-1.yaml: partner.delivery_tel = "Số điện thoại người giao hàng"
                            const partner = order.partner;
                            const shipperPhone = (partner && partner.delivery_tel) || 
                                                (partner && partner.delivery_phone) ||
                                                (typeof order.shipper_phone === 'string' ? order.shipper_phone : '') ||
                                                (typeof order.delivery_tel === 'string' ? order.delivery_tel : '') ||
                                                '-';
                            
                            if (!shipperPhone || shipperPhone === '-') return '-';

                            return (
                              <div className="flex items-center gap-2">
                                <span 
                                  className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 select-none"
                                  onDoubleClick={() => handleCopyShipperPhone(String(shipperPhone))}
                                  title="Double-click để copy SĐT shipper"
                                >
                                  {highlightText(String(shipperPhone), searchQuery)}
                                </span>
                                {copiedShipperPhone === shipperPhone && (
                                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs animate-fade-in">
                                    <Check size={14} />
                                    Đã copy
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        {/* ĐVVC giao lần đầu */}
                        <td className="p-2 text-gray-600 dark:text-gray-400 text-xs">
                          {(() => {
                            // Tìm field "ĐVVC giao lần đầu"
                            // Từ api-1.yaml: first_delivery_at = "Thời điểm giao hàng lần đầu"
                            const partner = order.partner;
                            const firstDeliveryDate = (typeof order.first_delivery_at === 'string' ? order.first_delivery_at : '') ||
                                                     (typeof partner?.first_delivery_at === 'string' ? partner.first_delivery_at : '') ||
                                                     (typeof order.first_delivery_date === 'string' ? order.first_delivery_date : '') ||
                                                     '-';
                            
                            if (!firstDeliveryDate || firstDeliveryDate === '-') return '-';
                            
                            try {
                              // Format: "HH:mm DD/MM" hoặc "HH:mm DD/MM/YYYY" (ví dụ: "09:07 30/12" hoặc "11:13 23/12/2025")
                              const date = new Date(firstDeliveryDate);
                              if (isNaN(date.getTime())) return '-';
                              
                              const hours = String(date.getHours()).padStart(2, '0');
                              const minutes = String(date.getMinutes()).padStart(2, '0');
                              const day = String(date.getDate()).padStart(2, '0');
                              const month = String(date.getMonth() + 1).padStart(2, '0');
                              const year = date.getFullYear();
                              const currentYear = new Date().getFullYear();
                              
                              // Nếu cùng năm thì không hiển thị năm, khác năm thì hiển thị năm
                              if (year === currentYear) {
                                return `${hours}:${minutes} ${day}/${month}`;
                              } else {
                                return `${hours}:${minutes} ${day}/${month}/${year}`;
                              }
                            } catch (error) {
                              return '-';
                            }
                          })()}
                        </td>
                        {/* Ghi chú nội bộ */}
                        <td className="p-2 text-gray-900 dark:text-white text-xs whitespace-normal" style={{ minWidth: '150px', maxWidth: '250px' }}>
                          {(() => {
                            // Tìm field "Ghi chú nội bộ"
                            // Từ api-1.yaml: note = "Internal note" / "Ghi chú nội bộ"
                            const note = order.note ||
                                         (typeof order.internal_note === 'string' ? order.internal_note : '') ||
                                         (typeof order.note_internal === 'string' ? order.note_internal : '') ||
                                         (typeof order.comment === 'string' ? order.comment : '') ||
                                         '-';
                            
                            if (!note || note === '-') return '-';
                            
                            // Hiển thị ghi chú, cho phép wrap
                            return <span className="text-xs break-words">{note}</span>;
                          })()}
                        </td>
                        {/* Ghi chú để in */}
                        <td className="p-2 text-gray-900 dark:text-white text-xs whitespace-normal" style={{ minWidth: '150px', maxWidth: '250px' }}>
                          {(() => {
                            // Tìm field "Ghi chú để in"
                            // Từ api-1.yaml: note_print = "Note for printing" / "Ghi chú đơn hàng"
                            const notePrint = order.note_print ||
                                           (typeof order.print_note === 'string' ? order.print_note : '') ||
                                           (typeof order.note_for_print === 'string' ? order.note_for_print : '') ||
                                           (typeof order.shipping_note === 'string' ? order.shipping_note : '') ||
                                           (typeof order.delivery_note === 'string' ? order.delivery_note : '') ||
                                           '-';
                            
                            if (!notePrint || notePrint === '-') return '-';
                            
                            // Hiển thị ghi chú để in, cho phép wrap
                            return <span className="text-xs break-words">{notePrint}</span>;
                          })()}
                        </td>
                        {/* Trạng thái - chỉ hiển thị khi có search query */}
                        {searchQuery.trim() && (
                          <td className="p-2">
                            {(() => {
                              // Xác định trạng thái của đơn hàng
                              const isSent = filterOrdersByStatus([order], 'sent').length > 0;
                              const isReceived = filterOrdersByStatus([order], 'received').length > 0;
                              const isReturned = filterOrdersByStatus([order], 'returned').length > 0;
                              
                              if (isReturned) {
                                return (
                                  <span className="px-2 py-1 rounded text-xs bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 font-medium">
                                    Đã hoàn
                                  </span>
                                );
                              } else if (isReceived) {
                                return (
                                  <span className="px-2 py-1 rounded text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 font-medium">
                                    Đã nhận
                                  </span>
                                );
                              } else if (isSent) {
                                return (
                                  <span className="px-2 py-1 rounded text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-medium">
                                    Đã gửi
                                  </span>
                                );
                              } else {
                                return (
                                  <span className="px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium">
                                    Khác
                                  </span>
                                );
                              }
                            })()}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 flex items-center gap-4">
            <Loader className="animate-spin text-blue-600" size={24} />
            <span className="text-gray-900 dark:text-white">Đang tải dữ liệu từ tất cả API...</span>
          </div>
        </div>
      )}

      {/* Modal Chi tiết đơn hàng */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedOrder(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Chi tiết đơn hàng</h2>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Thông tin cơ bản */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">ID đơn hàng</label>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedOrder.order_id || selectedOrder.id || selectedOrder.code || selectedOrder.order_code || '-'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Mã vận đơn</label>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white font-mono">
                    {(() => {
                      const partner = selectedOrder.partner;
                      if (partner?.extend_code) return partner.extend_code;
                      if (partner?.tracking_id) return partner.tracking_id;
                      return selectedOrder.tracking_number || selectedOrder.tracking_code || '-';
                    })()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Ngày đẩy đơn sang ĐVVC</label>
                  <p className="text-lg text-gray-900 dark:text-white">
                    {(() => {
                      const partner = selectedOrder.partner;
                      const shippedDate = selectedOrder.partner_inserted_at || 
                                        partner?.picked_up_at ||
                                        selectedOrder.logistics_shipped_at ||
                                        selectedOrder.shipped_at || '-';
                      if (!shippedDate || shippedDate === '-') return '-';
                      try {
                        const date = new Date(shippedDate);
                        if (isNaN(date.getTime())) return '-';
                        const hours = String(date.getHours()).padStart(2, '0');
                        const minutes = String(date.getMinutes()).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const year = date.getFullYear();
                        return `${hours}:${minutes} ${day}/${month}/${year}`;
                      } catch {
                        return '-';
                      }
                    })()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Đơn vị vận chuyển</label>
                  <p className="text-lg text-gray-900 dark:text-white">
                    {(() => {
                      const partner = selectedOrder.partner;
                      return partner?.partner_name || 
                             selectedOrder.carrier || 
                             selectedOrder.carrier_name || '-';
                    })()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Trạng thái (Thẻ)</label>
                  <p className="text-lg text-gray-900 dark:text-white">
                    {(() => {
                      const statusTag = getOrderStatusTag(selectedOrder);
                      return (
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${statusTag.dotColor}`} />
                          <span className={statusTag.color}>{statusTag.text}</span>
                        </div>
                      );
                    })()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Debug Partner Data</label>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-blue-600 dark:text-blue-400">Xem dữ liệu partner (debug)</summary>
                    <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-auto max-h-40">
                      {JSON.stringify(selectedOrder.partner, null, 2)}
                    </pre>
                  </details>
                </div>
              </div>

              {/* Thông tin người nhận */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Thông tin người nhận</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Tên người nhận</label>
                    <p className="text-base text-gray-900 dark:text-white">
                      {selectedOrder.bill_full_name ||
                       selectedOrder.customer_name ||
                       selectedOrder.receiver_name ||
                       selectedOrder.receiver_fullname ||
                       selectedOrder.customer_full_name ||
                       '-'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">SĐT người nhận</label>
                    <p className="text-base text-gray-900 dark:text-white">
                      {selectedOrder.bill_phone_number ||
                       selectedOrder.customer_phone ||
                       selectedOrder.receiver_phone ||
                       selectedOrder.phone ||
                       '-'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Địa chỉ người nhận</label>
                    <p className="text-base text-gray-900 dark:text-white">
                      {(() => {
                        const shippingAddress = selectedOrder.shipping_address;
                        if (shippingAddress) {
                          return shippingAddress.full_address || shippingAddress.address || '-';
                        }
                        return selectedOrder.bill_address ||
                               selectedOrder.delivery_address ||
                               selectedOrder.receiver_address ||
                               '-';
                      })()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Thông tin hàng hóa */}
              {(() => {
                const items = selectedOrder.items || [];
                if (items.length === 0) return null;
                
                return (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Thông tin hàng hóa</h3>
                    <div className="space-y-2">
                      {items.map((item, idx: number) => {
                        const name = item.variation_info?.name || item.product_name || item.name || 'Sản phẩm';
                        const quantity = item.quantity || item.qty || 1;
                        return (
                          <div key={idx} className="flex items-center gap-2 text-base text-gray-900 dark:text-white">
                            <span className="font-medium">{quantity}x</span>
                            <span>{name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Thông tin tài chính */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Thông tin tài chính</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Tiền thu hộ COD</label>
                    <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                      {selectedOrder.cod ? formatCurrency(selectedOrder.cod) : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Thông tin bổ sung */}
              {(selectedOrder.note || selectedOrder.note_print) && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Ghi chú</h3>
                  <div className="space-y-2">
                    {selectedOrder.note && (
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Ghi chú nội bộ</label>
                        <p className="text-base text-gray-900 dark:text-white">{selectedOrder.note}</p>
                      </div>
                    )}
                    {selectedOrder.note_print && (
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Ghi chú để in</label>
                        <p className="text-base text-gray-900 dark:text-white">{selectedOrder.note_print}</p>
                      </div>
                    )}
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

export default ApiOrders;
