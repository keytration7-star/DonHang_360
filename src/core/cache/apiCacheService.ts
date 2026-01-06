/**
 * API Cache Service - Lưu cache dữ liệu API vào IndexedDB
 * Hỗ trợ:
 * - Lưu cache dữ liệu orders
 * - Kiểm tra và chỉ fetch dữ liệu mới
 * - Background refresh
 */

import { Order } from '../../shared/types/order';
import { PancakeOrder, PancakeApiConfig } from '../../shared/types/pancakeApi';
import { ShopOrders } from '../../core/services/multiShopApiService';
import { logger } from '../../shared/utils/logger';

const DB_NAME = 'DonHang360Cache';
const DB_VERSION = 1;
const STORE_ORDERS = 'apiOrders';
const STORE_SHOPS = 'apiShops';
const STORE_METADATA = 'metadata';

interface CacheMetadata {
  lastFetchTime: number;
  lastUpdateTime: number;
  totalOrders: number;
  shopCount: number;
  version: number;
}

class ApiCacheService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        logger.error('❌ Lỗi mở IndexedDB cache:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        logger.log('✅ Đã khởi tạo API Cache Service');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store cho orders
        if (!db.objectStoreNames.contains(STORE_ORDERS)) {
          const ordersStore = db.createObjectStore(STORE_ORDERS, { keyPath: 'id' });
          ordersStore.createIndex('shopId', 'shopId', { unique: false });
          ordersStore.createIndex('status', 'status', { unique: false });
          ordersStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // Store cho shops
        if (!db.objectStoreNames.contains(STORE_SHOPS)) {
          db.createObjectStore(STORE_SHOPS, { keyPath: 'shopId' });
        }

        // Store cho metadata
        if (!db.objectStoreNames.contains(STORE_METADATA)) {
          db.createObjectStore(STORE_METADATA, { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Lưu orders vào cache
   */
  async saveOrders(orders: Order[], shopOrders: ShopOrders[]): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database chưa được khởi tạo'));
        return;
      }

      const transaction = this.db.transaction([STORE_ORDERS, STORE_SHOPS, STORE_METADATA], 'readwrite');
      
      // Lưu orders
      const ordersStore = transaction.objectStore(STORE_ORDERS);
      const savePromises = orders.map(order => {
        return new Promise<void>((resolve, reject) => {
          const request = ordersStore.put(order);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      });

      // Lưu shops
      const shopsStore = transaction.objectStore(STORE_SHOPS);
      const shopPromises = shopOrders.map(shop => {
        return new Promise<void>((resolve, reject) => {
          const request = shopsStore.put({
            shopId: String(shop.shopId), // Normalize shopId khi lưu vào cache
            shopName: shop.shopName,
            apiConfig: shop.apiConfig,
            orderCount: shop.orders.length,
            lastUpdateTime: Date.now(),
          });
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      });

      // Lưu metadata
      const metadataStore = transaction.objectStore(STORE_METADATA);
      const metadata: CacheMetadata = {
        lastFetchTime: Date.now(),
        lastUpdateTime: Date.now(),
        totalOrders: orders.length,
        shopCount: shopOrders.length,
        version: 1,
      };
      const metadataRequest = metadataStore.put({ key: 'cache', ...metadata });

      transaction.oncomplete = () => {
        logger.log(`✅ Đã lưu ${orders.length} orders và ${shopOrders.length} shops vào cache`);
        resolve();
      };

      transaction.onerror = () => {
        logger.error('❌ Lỗi lưu cache:', transaction.error);
        reject(transaction.error);
      };

      Promise.all([...savePromises, ...shopPromises, new Promise((resolve) => {
        metadataRequest.onsuccess = () => resolve(undefined);
        metadataRequest.onerror = () => reject(metadataRequest.error);
      })]);
    });
  }

  /**
   * Lấy orders từ cache
   */
  async getCachedOrders(): Promise<{ orders: Order[]; shopOrders: ShopOrders[]; metadata: CacheMetadata | null }> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database chưa được khởi tạo'));
        return;
      }

      const transaction = this.db.transaction([STORE_ORDERS, STORE_SHOPS, STORE_METADATA], 'readonly');
      
      // Lấy orders
      const ordersStore = transaction.objectStore(STORE_ORDERS);
      const ordersRequest = ordersStore.getAll();
      
      // Lấy shops
      const shopsStore = transaction.objectStore(STORE_SHOPS);
      const shopsRequest = shopsStore.getAll();
      
      // Lấy metadata
      const metadataStore = transaction.objectStore(STORE_METADATA);
      const metadataRequest = metadataStore.get('cache');

      let orders: Order[] = [];
      let shopOrders: ShopOrders[] = [];
      let metadata: CacheMetadata | null = null;

      ordersRequest.onsuccess = () => {
        orders = ordersRequest.result || [];
      };

      shopsRequest.onsuccess = () => {
        interface CachedShop {
          shopId: string | number;
          shopName: string;
          apiConfig: PancakeApiConfig | unknown;
          [key: string]: unknown;
        }
        shopOrders = (shopsRequest.result || []).map((shop: CachedShop) => ({
          shopId: String(shop.shopId), // Normalize shopId khi restore từ cache
          shopName: shop.shopName,
          apiConfig: shop.apiConfig as PancakeApiConfig,
          orders: [], // Orders sẽ được map từ orders array
        }));
      };

      metadataRequest.onsuccess = () => {
        metadata = metadataRequest.result || null;
      };

      transaction.oncomplete = () => {
        // Map orders vào shops (orders là Order[], rawData có thể là PancakeOrder)
        shopOrders.forEach(shop => {
          // Lấy rawData từ orders và convert lại thành PancakeOrder
          // Normalize shopId để so sánh (string vs number)
          const normalizedShopId = String(shop.shopId);
          const shopOrdersData = orders
            .filter(o => {
              const rawData = o.rawData as PancakeOrder | undefined;
              const orderShopId = rawData?.shop_id;
              return orderShopId && String(orderShopId) === normalizedShopId;
            })
            .map(o => o.rawData as PancakeOrder | undefined)
            .filter((data): data is PancakeOrder => data !== undefined && data !== null);
          shop.orders = shopOrdersData;
        });

        logger.log(`✅ Đã lấy ${orders.length} orders và ${shopOrders.length} shops từ cache`);
        resolve({ orders, shopOrders, metadata });
      };

      transaction.onerror = () => {
        logger.error('❌ Lỗi đọc cache:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  /**
   * Kiểm tra cache có còn hợp lệ không
   */
  async isCacheValid(maxAge: number = 300000): Promise<boolean> {
    const { metadata } = await this.getCachedOrders();
    if (!metadata) return false;

    const age = Date.now() - metadata.lastFetchTime;
    return age < maxAge;
  }

  /**
   * Xóa cache cũ
   */
  async clearCache(): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database chưa được khởi tạo'));
        return;
      }

      const transaction = this.db.transaction([STORE_ORDERS, STORE_SHOPS, STORE_METADATA], 'readwrite');
      
      transaction.objectStore(STORE_ORDERS).clear();
      transaction.objectStore(STORE_SHOPS).clear();
      transaction.objectStore(STORE_METADATA).clear();

      transaction.oncomplete = () => {
        logger.log('✅ Đã xóa cache');
        resolve();
      };

      transaction.onerror = () => {
        logger.error('❌ Lỗi xóa cache:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  /**
   * Lấy thời gian cache cuối cùng
   */
  async getLastFetchTime(): Promise<number | null> {
    const { metadata } = await this.getCachedOrders();
    return metadata?.lastFetchTime || null;
  }
}

export const apiCacheService = new ApiCacheService();

