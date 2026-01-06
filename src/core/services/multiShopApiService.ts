/**
 * Service để lấy đơn hàng từ nhiều shop/API
 */

import { pancakeConfigService } from './pancakeConfigService';
import { PancakeApiService } from '../api/pancakeApiService';
import { PancakeApiConfig, PancakeOrder, PancakeShop } from '../../shared/types/pancakeApi';
import { logger } from '../../shared/utils/logger';

export interface ShopOrders {
  shopId: string;
  shopName: string;
  apiConfig: PancakeApiConfig;
  orders: PancakeOrder[];
  error?: string;
}

export interface MultiShopOrdersResult {
  shops: ShopOrders[];
  totalOrders: number;
  successCount: number;
  errorCount: number;
}

class MultiShopApiService {
  /**
   * Lấy đơn hàng từ tất cả các API configs đã cấu hình
   * Fetch song song từ nhiều API để tăng tốc độ
   * @returns Kết quả tổng hợp với danh sách shops, tổng số đơn, số thành công/lỗi
   * @throws Error nếu chưa có API config nào
   */
  async getAllShopsOrders(): Promise<MultiShopOrdersResult> {
    const configs = pancakeConfigService.getAllConfigs();
    
    if (configs.length === 0) {
      throw new Error('Chưa có API config nào. Vui lòng cấu hình API trong Settings.');
    }

    let totalOrders = 0;
    let successCount = 0;
    let errorCount = 0;

    // Fetch từ nhiều API song song để tăng tốc độ
    const configPromises = configs.map(async (config): Promise<ShopOrders[]> => {
      try {
        logger.log(`📡 Đang lấy đơn hàng từ "${config.name}"...`);
        
        // Tạo instance riêng cho mỗi config để tránh race condition
        const apiService = PancakeApiService.createInstance(config);
        pancakeConfigService.updateLastUsed(config.id);

        // Lấy shops
        let shops: PancakeShop[] = [];
        try {
          shops = await apiService.getShops();
          logger.log(`✅ Tìm thấy ${shops.length} shop(s) từ "${config.name}"`);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định';
          logger.warn(`⚠️ Không thể lấy shops từ "${config.name}":`, errorMessage);
        }

        // Lấy orders - thử với shop_id nếu có shops
        const shopResults: ShopOrders[] = [];
        
        if (shops.length > 0) {
          // Fetch từ nhiều shop song song để tăng tốc độ
          const shopPromises = shops.map(async (shop) => {
            try {
              logger.log(`🔄 Thử lấy đơn hàng từ shop "${shop.name}" (ID: ${shop.id})...`);
              
              // QUAN TRỌNG: Lấy TẤT CẢ đơn hàng từ /orders endpoint (không filter)
              let allShopOrders: PancakeOrder[] = [];
              
              try {
                const allOrders = await apiService.getAllOrders({ 
                  shop_id: shop.id
                });
                allShopOrders = [...allShopOrders, ...allOrders];
              } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định';
                logger.warn(`  ⚠️ Không thể lấy đơn hàng từ shop "${shop.name}":`, errorMessage);
              }
              
              // Lấy đơn hoàn từ endpoint /orders_returned riêng
              try {
                const returnedOrders = await apiService.getReturnedOrders(shop.id);
                // Merge với allShopOrders, tránh duplicate
                const existingIds = new Set(allShopOrders.map(o => o.id));
                const newReturnedOrders = returnedOrders.filter(o => !existingIds.has(o.id));
                allShopOrders = [...allShopOrders, ...newReturnedOrders];
              } catch (error: unknown) {
                // 404 là bình thường, không log
              }
              
              return {
                shopId: String(shop.id), // Normalize shopId ngay từ đầu
                shopName: shop.name,
                apiConfig: config,
                orders: allShopOrders,
              };
            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định';
              logger.warn(`⚠️ Không thể lấy đơn hàng từ shop "${shop.name}":`, errorMessage);
              
              return {
                shopId: String(shop.id), // Normalize shopId ngay từ đầu
                shopName: shop.name,
                apiConfig: config,
                orders: [],
                error: errorMessage,
              };
            }
          });
          
          // Đợi tất cả shops fetch xong và return array
          const shopResults = await Promise.all(shopPromises);
          return shopResults;
        } else {
          // Không có shops, thử lấy orders chung
          try {
            const orders = await apiService.getAllOrders();
            
            // Gom tất cả orders vào một shop với tên API config
            return [{
              shopId: config.id,
              shopName: config.name,
              apiConfig: config,
              orders: orders,
            }];
            
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định';
            logger.error(`❌ Lỗi lấy đơn hàng từ "${config.name}":`, errorMessage);
            
            // Tạo entry với error
            return [{
              shopId: String(config.id), // Normalize shopId ngay từ đầu
              shopName: config.name,
              apiConfig: config,
              orders: [],
              error: errorMessage,
            }];
          }
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định';
        logger.error(`❌ Lỗi xử lý API "${config.name}":`, error);
        return [{
          shopId: String(config.id), // Normalize shopId ngay từ đầu
          shopName: config.name,
          apiConfig: config,
          orders: [],
          error: errorMessage,
        }];
      }
    });
    
    // Đợi tất cả configs fetch xong (song song)
    const allResults = await Promise.all(configPromises);
    
    // Flatten results (tất cả đều là arrays) và deduplicate shops theo shopId
    const shopMap = new Map<string, ShopOrders>();
    let totalShopsBeforeDedup = 0;
    
    allResults.forEach((configShopResults) => {
      if (!configShopResults || configShopResults.length === 0) return;
      
      totalShopsBeforeDedup += configShopResults.length;
      
      configShopResults.forEach(shopResult => {
        // Normalize shopId để so sánh (string vs number)
        const normalizedShopId = String(shopResult.shopId);
        const existingShop = shopMap.get(normalizedShopId);
        
        if (existingShop) {
          // Shop đã tồn tại - merge orders (tránh duplicate orders)
          logger.log(`⚠️ Shop trùng: "${shopResult.shopName}" (ID: ${normalizedShopId}) - Existing: ${existingShop.orders.length} orders, New: ${shopResult.orders.length} orders`);
          
          const existingOrderIds = new Set(existingShop.orders.map(o => String(o.id || o.code)));
          const newOrders = shopResult.orders.filter(o => {
            const orderId = String(o.id || o.code);
            return orderId && !existingOrderIds.has(orderId);
          });
          
          // Merge orders: giữ shop có nhiều orders hơn làm base
          if (shopResult.orders.length > existingShop.orders.length) {
            // Shop mới có nhiều orders hơn - dùng shop mới làm base
            const mergedOrderIds = new Set(shopResult.orders.map(o => String(o.id || o.code)));
            const additionalOrders = existingShop.orders.filter(o => {
              const orderId = String(o.id || o.code);
              return orderId && !mergedOrderIds.has(orderId);
            });
            shopMap.set(normalizedShopId, {
              ...shopResult,
              shopId: normalizedShopId, // Normalize shopId
              orders: [...shopResult.orders, ...additionalOrders],
            });
            logger.log(`✅ Đã merge: Giữ shop mới "${shopResult.shopName}" với ${shopResult.orders.length + additionalOrders.length} orders`);
          } else {
            // Shop cũ có nhiều orders hơn - merge vào shop cũ
            existingShop.orders = [...existingShop.orders, ...newOrders];
            logger.log(`✅ Đã merge: Giữ shop cũ "${existingShop.shopName}" với ${existingShop.orders.length} orders`);
          }
        } else {
          // Shop mới - thêm vào map
          shopMap.set(normalizedShopId, {
            ...shopResult,
            shopId: normalizedShopId, // Normalize shopId
          });
          logger.log(`✅ Thêm shop mới: "${shopResult.shopName}" (ID: ${normalizedShopId}) với ${shopResult.orders.length} orders`);
        }
      });
    });
    
    logger.log(`📊 Trước deduplicate: ${totalShopsBeforeDedup} shops, Sau deduplicate: ${shopMap.size} shops (theo shopId)`);
    
    // Convert map thành array, loại bỏ shop rỗng (0 orders và không có error)
    const finalShops = Array.from(shopMap.values()).filter(shop => {
      // Giữ shop có orders hoặc có error (để hiển thị lỗi)
      const shouldKeep = shop.orders.length > 0 || shop.error;
      if (!shouldKeep) {
        logger.log(`🗑️ Loại bỏ shop rỗng: "${shop.shopName}" (ID: ${shop.shopId}) - 0 orders, không có error`);
      }
      return shouldKeep;
    });
    
    // Cập nhật counters
    finalShops.forEach(shop => {
      totalOrders += shop.orders.length;
      if (shop.orders.length > 0) {
        successCount++;
      } else if (shop.error) {
        errorCount++;
      }
    });

    logger.log(`✅ Kết quả cuối cùng: ${finalShops.length} shop(s) unique (đã deduplicate và loại bỏ shop rỗng) từ ${allResults.length} API config(s)`);
    logger.log(`📋 Danh sách shop cuối cùng:`, finalShops.map(s => ({ id: s.shopId, name: s.shopName, orders: s.orders.length })));

    return {
      shops: finalShops,
      totalOrders,
      successCount,
      errorCount,
    };
  }

  /**
   * Lấy đơn hàng từ một API config cụ thể
   */
  async getOrdersFromConfig(configId: string): Promise<ShopOrders[]> {
    const config = pancakeConfigService.getConfigById(configId);
    if (!config) {
      throw new Error(`Không tìm thấy API config với ID: ${configId}`);
    }

    const apiService = PancakeApiService.createInstance(config);
    pancakeConfigService.updateLastUsed(config.id);

    const shops: PancakeShop[] = [];
    try {
      const shopsData = await apiService.getShops();
      shops.push(...shopsData);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định';
      logger.warn(`⚠️ Không thể lấy shops:`, errorMessage);
    }

    const orders = await apiService.getAllOrders();

    const results: ShopOrders[] = [];

    if (shops.length > 0) {
      shops.forEach(shop => {
        const shopOrders = orders.filter((o: PancakeOrder) => o.shop_id === shop.id);
        results.push({
          shopId: shop.id,
          shopName: shop.name,
          apiConfig: config,
          orders: shopOrders,
        });
      });
    } else {
      results.push({
        shopId: String(config.id), // Normalize shopId ngay từ đầu
        shopName: config.name,
        apiConfig: config,
        orders: orders,
      });
    }

    return results;
  }
}

export const multiShopApiService = new MultiShopApiService();

