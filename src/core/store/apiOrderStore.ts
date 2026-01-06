/**
 * API Order Store - Quản lý đơn hàng từ Pancake API
 * Tương tự orderStore nhưng lấy dữ liệu từ API thay vì IndexedDB
 * Hỗ trợ caching và lazy loading để cải thiện hiệu suất
 */

import { create } from 'zustand';
import { Order } from '../../shared/types/order';
import { PancakeOrder } from '../../shared/types/pancakeApi';
import { multiShopApiService, ShopOrders } from '../../core/services/multiShopApiService';
import { pancakeOrdersToOrders } from '../../shared/utils/pancakeOrderMapper';
import { apiCacheService } from '../cache/apiCacheService';
import { incrementalUpdateService } from '../../core/services/incrementalUpdateService';
import { logger } from '../../shared/utils/logger';
import { useProgressStore } from './progressStore';

interface ApiOrderStore {
  orders: Order[];
  shopOrders: ShopOrders[]; // Lưu thông tin shop và orders gốc
  loading: boolean; // Loading chính (blocking)
  isFetching: boolean; // Background fetching (non-blocking)
  error: string | null;
  lastFetchTime: number | null;
  isInitialized: boolean; // Đánh dấu đã load cache lần đầu
  /** Fetch đơn hàng từ API. Nếu useCache=true, load từ cache trước rồi fetch mới trong background */
  fetchOrders: (force?: boolean, useCache?: boolean, incremental?: boolean) => Promise<void>;
  /** Refresh đơn hàng (force fetch, không dùng cache) */
  refreshOrders: () => Promise<void>;
  /** Tìm đơn hàng theo mã vận đơn */
  getOrderByTrackingNumber: (trackingNumber: string) => Order | undefined;
  /** Tìm kiếm đơn hàng theo query (tìm trong ID, tracking, tên, SĐT, địa chỉ) */
  searchOrders: (query: string) => Order[];
  /** Load từ cache ngay lập tức (không chờ API) */
  initializeFromCache: () => Promise<void>;
  /** Bắt đầu polling để tự động kiểm tra thay đổi */
  startPolling: (interval?: number) => void;
  /** Dừng polling */
  stopPolling: () => void;
  /** Trạng thái polling (đang chạy hay không) */
  isPolling: boolean;
}

// Polling interval (mặc định 30 giây)
let pollingInterval: NodeJS.Timeout | null = null;
const DEFAULT_POLLING_INTERVAL = 30000; // 30 giây

// Helper function để merge shopOrders (chỉ cập nhật những shop có thay đổi)
function mergeShopOrdersHelper(
  oldShops: ShopOrders[],
  newShops: ShopOrders[],
  updateResult: { updated: Order[]; added: Order[]; removed: Order[] }
): ShopOrders[] {
  const shopMap = new Map<string, ShopOrders>();
  
  // Thêm shops cũ
  oldShops.forEach(shop => {
    shopMap.set(shop.shopId, shop);
  });
  
  // Cập nhật shops mới (chỉ những shop có thay đổi)
  newShops.forEach(newShop => {
    const oldShop = shopMap.get(newShop.shopId);
    if (oldShop) {
      // Merge orders: giữ đơn không đổi, cập nhật đơn thay đổi
      const oldOrderMap = new Map<string, PancakeOrder>();
      oldShop.orders.forEach(order => {
        const orderKey = order.id || order.code || `${oldShop.shopId}-${order.id}`;
        oldOrderMap.set(orderKey, order);
      });
      
      // Cập nhật đơn thay đổi và thêm đơn mới
      const updatedOrders: PancakeOrder[] = [];
      newShop.orders.forEach(newOrder => {
        const orderKey = newOrder.id || newOrder.code || `${newShop.shopId}-${newOrder.id}`;
        const oldOrder = oldOrderMap.get(orderKey);
        
        // Kiểm tra xem đơn này có thay đổi không
        const hasChange = updateResult.updated.some(u => u.id === orderKey) ||
                         updateResult.added.some(a => a.id === orderKey);
        
        if (hasChange) {
          updatedOrders.push(newOrder); // Dùng dữ liệu mới
        } else if (oldOrder) {
          updatedOrders.push(oldOrder); // Giữ dữ liệu cũ (không tải lại)
        } else {
          updatedOrders.push(newOrder); // Đơn mới
        }
      });
      
      // Giữ đơn bị xóa nếu không có trong newShop
      oldShop.orders.forEach(oldOrder => {
        const orderKey = oldOrder.id || oldOrder.code || `${oldShop.shopId}-${oldOrder.id}`;
        const existsInNew = newShop.orders.some(newOrder => {
          const newOrderKey = newOrder.id || newOrder.code || `${newShop.shopId}-${newOrder.id}`;
          return newOrderKey === orderKey;
        });
        
        if (!existsInNew && !updateResult.removed.some(r => r.id === orderKey)) {
          // Không có trong newShop và không bị xóa - giữ nguyên
          if (!updatedOrders.some(o => (o.id || o.code) === orderKey)) {
            updatedOrders.push(oldOrder);
          }
        }
      });
      
      shopMap.set(newShop.shopId, {
        ...newShop,
        orders: updatedOrders,
      });
    } else {
      // Shop mới
      shopMap.set(newShop.shopId, newShop);
    }
  });
  
  return Array.from(shopMap.values());
}

export const useApiOrderStore = create<ApiOrderStore>((set, get) => ({
  orders: [],
  shopOrders: [],
  loading: false,
  isFetching: false, // Background fetching state
  error: null,
  lastFetchTime: null,
  isInitialized: false,
  isPolling: false,

  // Load từ cache ngay lập tức (không chờ API)
  initializeFromCache: async () => {
    try {
      await apiCacheService.init();
      const { orders, shopOrders, metadata } = await apiCacheService.getCachedOrders();
      
      if (orders.length > 0) {
        logger.log(`📦 API Order Store: Đã load ${orders.length} orders từ cache`);
        set({
          orders,
          shopOrders,
          lastFetchTime: metadata?.lastFetchTime || null,
          isInitialized: true,
        });
        // Dispatch event để UI cập nhật ngay
        window.dispatchEvent(new CustomEvent('apiOrdersUpdated'));
      } else {
        set({ isInitialized: true });
      }
    } catch (error: unknown) {
      logger.error('❌ API Order Store: Lỗi load cache:', error);
      set({ isInitialized: true });
    }
  },

  fetchOrders: async (force = false, useCache = true, incremental = true) => {
    const state = get();
    
    // Tránh fetch đồng thời - nếu đang loading thì không fetch lại
    // TRỪ KHI force = true (user click refresh)
    if (state.loading && !force) {
      logger.log('📦 API Order Store: Đang fetch, bỏ qua request mới');
      return;
    }
    
    // Nếu force = true, tắt incremental để lấy đầy đủ dữ liệu
    if (force) {
      incremental = false;
      useCache = false;
      logger.log('🔄 API Order Store: Force fetch - sẽ lấy đầy đủ dữ liệu (không dùng cache, không incremental)');
    }
    
    // Nếu không force và có cache hợp lệ, sử dụng cache và fetch background
    if (!force && useCache) {
      const cacheValid = await apiCacheService.isCacheValid(300000); // 5 phút
      if (cacheValid && state.orders.length > 0) {
        logger.log('📦 API Order Store: Cache hợp lệ, fetch background...');
        // Fetch background (không block UI) - gọi trực tiếp fetchOrders với delay
        setTimeout(() => {
          set({ isFetching: true });
          get().fetchOrders(true, false, true).catch(() => {
            set({ isFetching: false });
          }).finally(() => {
            set({ isFetching: false });
          });
        }, 100);
        return;
      }
      
      // Nếu có cache nhưng đã cũ, load cache trước rồi fetch background
      if (state.orders.length === 0) {
        const { orders, shopOrders } = await apiCacheService.getCachedOrders();
        if (orders.length > 0) {
          logger.log(`📦 API Order Store: Load ${orders.length} orders từ cache, đang fetch mới...`);
          set({ orders, shopOrders });
          window.dispatchEvent(new CustomEvent('apiOrdersUpdated'));
          // Tiếp tục fetch mới trong background
        }
      }
    }

    // Lưu biến incremental để dùng trong catch block
    const isIncremental = incremental;
    
    // Set loading state: blocking nếu không phải incremental, background nếu incremental
    if (isIncremental) {
      set({ isFetching: true, error: null });
    } else {
      set({ loading: true, isFetching: false, error: null });
      // Bắt đầu progress tracking cho full fetch
      useProgressStore.getState().showProgress('Đang tải đơn hàng...');
    }

    try {
      logger.log(`📡 API Order Store: Đang fetch đơn hàng từ API... (incremental: ${incremental})`);
      
      // Fetch từ multiShopApiService
      const result = await multiShopApiService.getAllShopsOrders();
      
      // Cập nhật progress: đã fetch xong shops
      if (!isIncremental) {
        useProgressStore.getState().updateProgress(50, result.shops.length, result.shops.length, `Đã lấy ${result.shops.length} shop(s)`);
      }
      
      // Convert PancakeOrder[] sang Order[]
      // Tránh duplicate orders bằng cách dùng Map với key là order ID
      const orderMap = new Map<string, any>();
      result.shops.forEach(shop => {
        shop.orders.forEach(order => {
          // Sử dụng order.id hoặc order.code làm key để tránh duplicate
          const orderKey = order.id || order.code || `${shop.shopId}-${order.id}`;
          if (!orderMap.has(orderKey)) {
            orderMap.set(orderKey, order);
          }
        });
      });
      
      const uniquePancakeOrders = Array.from(orderMap.values());
      
      // Cập nhật progress: đang convert orders
      if (!isIncremental) {
        useProgressStore.getState().updateProgress(60, uniquePancakeOrders.length, uniquePancakeOrders.length, `Đang xử lý ${uniquePancakeOrders.length} đơn hàng...`);
      }
      
      const newOrders = pancakeOrdersToOrders(uniquePancakeOrders);
      
      // Cập nhật progress: đã convert xong
      if (!isIncremental) {
        useProgressStore.getState().updateProgress(80, newOrders.length, newOrders.length, `Đã xử lý ${newOrders.length} đơn hàng`);
      }
      
      // INCREMENTAL UPDATE: Chỉ cập nhật những đơn thay đổi
      let finalOrders = newOrders;
      let finalShopOrders = result.shops;
      
      if (isIncremental && state.orders.length > 0) {
        // So sánh với orders cũ từ cache/store
        const updateResult = incrementalUpdateService.compareOrders(
          state.orders,
          newOrders,
          state.shopOrders,
          result.shops
        );

        if (updateResult.updated.length > 0 || updateResult.added.length > 0) {
          // Chỉ cập nhật khi có đơn thay đổi hoặc đơn mới
          // KHÔNG xóa đơn "removed" vì API có thể không trả về đầy đủ
          // Có thay đổi - merge chỉ những đơn thay đổi
          finalOrders = incrementalUpdateService.mergeOrders(state.orders, updateResult);
          
          // Cập nhật shopOrders - chỉ merge những shop có thay đổi
          // Giữ nguyên shopOrders cũ, chỉ cập nhật những shop có đơn thay đổi
          finalShopOrders = mergeShopOrdersHelper(state.shopOrders, result.shops, updateResult);
          
          logger.log(`🔄 API Order Store: Cập nhật ${updateResult.updated.length} đơn, thêm ${updateResult.added.length} đơn, xóa ${updateResult.removed.length} đơn`);
          logger.log(`📦 API Order Store: Giữ nguyên ${updateResult.unchanged.length} đơn không thay đổi từ cache`);
          
          // Dispatch event với thông tin thay đổi
          window.dispatchEvent(new CustomEvent('apiOrdersIncrementalUpdate', {
            detail: updateResult
          }));
        } else {
          // Không có thay đổi - giữ nguyên orders cũ từ cache
          logger.log(`✅ API Order Store: Không có thay đổi, giữ nguyên ${state.orders.length} đơn từ cache (không tải lại)`);
          finalOrders = state.orders;
          finalShopOrders = state.shopOrders;
          
          // Vẫn cập nhật lastFetchTime để biết đã check
          set({ lastFetchTime: Date.now() });
        }
      } else {
        // Full update (lần đầu hoặc force)
        logger.log(`✅ API Order Store: Đã fetch ${newOrders.length} đơn hàng từ ${result.shops.length} shop(s)`);
      }
      
      // Cập nhật progress: đang lưu cache
      if (!isIncremental) {
        useProgressStore.getState().updateProgress(90, finalOrders.length, finalOrders.length, 'Đang lưu cache...');
      }
      
      // Lưu vào cache
      try {
        await apiCacheService.saveOrders(finalOrders, finalShopOrders);
      } catch (cacheError) {
        logger.warn('⚠️ Lỗi lưu cache (không ảnh hưởng):', cacheError);
      }
      
      // Cập nhật progress: hoàn tất
      if (!isIncremental) {
        useProgressStore.getState().updateProgress(100, finalOrders.length, finalOrders.length, 'Hoàn tất');
        // Ẩn progress sau 500ms
        setTimeout(() => {
          useProgressStore.getState().hideProgress();
        }, 500);
      }
      
      set({
        orders: finalOrders,
        shopOrders: finalShopOrders,
        loading: false,
        isFetching: false,
        error: null,
        lastFetchTime: Date.now(),
        isInitialized: true,
      });

      // Dispatch event để các component khác biết data đã update
      window.dispatchEvent(new CustomEvent('apiOrdersUpdated'));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định';
      logger.error('❌ API Order Store: Lỗi fetch đơn hàng:', error);
      
      // Ẩn progress nếu có
      if (!isIncremental) {
        useProgressStore.getState().hideProgress();
      }
      
      set({
        loading: false,
        isFetching: false,
        error: errorMessage,
        isInitialized: true,
      });
    }
  },

  // Bắt đầu polling để tự động kiểm tra thay đổi
  startPolling: (interval = DEFAULT_POLLING_INTERVAL) => {
    const state = get();
    if (state.isPolling) {
      logger.log('📡 Polling đã chạy rồi');
      return;
    }

    logger.log(`🔄 Bắt đầu polling mỗi ${interval / 1000} giây...`);
    set({ isPolling: true });

    pollingInterval = setInterval(() => {
      const currentState = get();
      if (!currentState.loading) {
        // Fetch incremental update (chỉ cập nhật thay đổi)
        currentState.fetchOrders(false, false, true).catch((err) => {
          logger.error('❌ Lỗi polling:', err);
        });
      }
    }, interval);
  },

  // Dừng polling
  stopPolling: () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
      set({ isPolling: false });
      logger.log('⏹️ Đã dừng polling');
    }
  },

  // Fetch trong background (không block UI)
  fetchOrdersInBackground: async () => {
    const state = get();
    if (state.loading) return;

    try {
      logger.log('🔄 API Order Store: Đang fetch background...');
      const result = await multiShopApiService.getAllShopsOrders();
      
      const orderMap = new Map<string, any>();
      result.shops.forEach(shop => {
        shop.orders.forEach(order => {
          const orderKey = order.id || order.code || `${shop.shopId}-${order.id}`;
          if (!orderMap.has(orderKey)) {
            orderMap.set(orderKey, order);
          }
        });
      });
      
      const uniquePancakeOrders = Array.from(orderMap.values());
      const orders = pancakeOrdersToOrders(uniquePancakeOrders);
      
      // Lưu vào cache
      try {
        await apiCacheService.saveOrders(orders, result.shops);
      } catch (cacheError) {
        logger.warn('⚠️ Lỗi lưu cache:', cacheError);
      }
      
      // Cập nhật state (không set loading để không block UI)
      set({
        orders,
        shopOrders: result.shops,
        lastFetchTime: Date.now(),
      });

      logger.log(`✅ API Order Store: Đã cập nhật ${orders.length} đơn hàng (background)`);
      window.dispatchEvent(new CustomEvent('apiOrdersUpdated'));
    } catch (error: unknown) {
      logger.error('❌ API Order Store: Lỗi fetch background:', error);
    }
  },

  refreshOrders: async () => {
    await get().fetchOrders(true);
  },

  getOrderByTrackingNumber: (trackingNumber: string) => {
    const { orders } = get();
    const normalized = trackingNumber.trim().toLowerCase();
    return orders.find(
      o => o.trackingNumber?.toLowerCase() === normalized ||
           o.id?.toLowerCase() === normalized
    );
  },

  searchOrders: (query: string) => {
    const { orders } = get();
    if (!query.trim()) return orders;
    
    const lowerQuery = query.toLowerCase();
    return orders.filter(order => {
      return (
        order.trackingNumber?.toLowerCase().includes(lowerQuery) ||
        order.customerName?.toLowerCase().includes(lowerQuery) ||
        order.customerPhone?.toLowerCase().includes(lowerQuery) ||
        order.customerAddress?.toLowerCase().includes(lowerQuery) ||
        order.id?.toLowerCase().includes(lowerQuery) ||
        order.goodsContent?.toLowerCase().includes(lowerQuery)
      );
    });
  },
}));

