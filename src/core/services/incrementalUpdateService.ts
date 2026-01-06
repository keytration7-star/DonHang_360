/**
 * Incremental Update Service - Chỉ cập nhật những đơn hàng thay đổi
 * So sánh dữ liệu cũ và mới, chỉ update những đơn có thay đổi
 */

import { Order } from '../../shared/types/order';
import { PancakeOrder } from '../../shared/types/pancakeApi';
import { ShopOrders } from './multiShopApiService';
import { logger } from '../../shared/utils/logger';

interface OrderChange {
  orderId: string;
  oldStatus?: string;
  newStatus?: string;
  changedFields: string[];
  order: Order;
}

interface UpdateResult {
  updated: Order[];
  added: Order[];
  removed: Order[];
  unchanged: Order[];
  changes: OrderChange[];
}

class IncrementalUpdateService {
  /**
   * So sánh orders cũ và mới, chỉ trả về những đơn thay đổi
   */
  compareOrders(
    oldOrders: Order[],
    newOrders: Order[],
    _oldShopOrders: ShopOrders[],
    _newShopOrders: ShopOrders[]
  ): UpdateResult {
    const oldOrderMap = new Map<string, Order>();
    const newOrderMap = new Map<string, Order>();
    const changes: OrderChange[] = [];
    const updated: Order[] = [];
    const added: Order[] = [];
    const unchanged: Order[] = [];

    // Tạo map từ orders cũ
    oldOrders.forEach(order => {
      oldOrderMap.set(order.id, order);
    });

    // Tạo map từ orders mới
    newOrders.forEach(order => {
      newOrderMap.set(order.id, order);
    });

    // So sánh từng order
    newOrders.forEach(newOrder => {
      const oldOrder = oldOrderMap.get(newOrder.id);

      if (!oldOrder) {
        // Order mới
        added.push(newOrder);
        logger.log(`🆕 Đơn hàng mới: ${newOrder.id}`);
      } else {
        // Kiểm tra thay đổi
        const changedFields: string[] = [];
        let hasChanged = false;

        // So sánh các trường quan trọng
        if (oldOrder.status !== newOrder.status) {
          changedFields.push('status');
          hasChanged = true;
        }
        if (oldOrder.trackingNumber !== newOrder.trackingNumber) {
          changedFields.push('trackingNumber');
          hasChanged = true;
        }
        if (oldOrder.customerName !== newOrder.customerName) {
          changedFields.push('customerName');
          hasChanged = true;
        }
        if (oldOrder.customerPhone !== newOrder.customerPhone) {
          changedFields.push('customerPhone');
          hasChanged = true;
        }
        if (oldOrder.customerAddress !== newOrder.customerAddress) {
          changedFields.push('customerAddress');
          hasChanged = true;
        }
        if (oldOrder.cod !== newOrder.cod) {
          changedFields.push('cod');
          hasChanged = true;
        }
        if (oldOrder.shippingFee !== newOrder.shippingFee) {
          changedFields.push('shippingFee');
          hasChanged = true;
        }
        if (oldOrder.sendDate !== newOrder.sendDate) {
          changedFields.push('sendDate');
          hasChanged = true;
        }
        if (oldOrder.pickupDate !== newOrder.pickupDate) {
          changedFields.push('pickupDate');
          hasChanged = true;
        }

        // So sánh rawData (JSON) để phát hiện thay đổi khác
        const oldRawData = JSON.stringify(oldOrder.rawData || {});
        const newRawData = JSON.stringify(newOrder.rawData || {});
        if (oldRawData !== newRawData) {
          // Kiểm tra các trường cụ thể trong rawData
          const oldRaw = oldOrder.rawData as PancakeOrder | undefined;
          const newRaw = newOrder.rawData as PancakeOrder | undefined;
          
          if (oldRaw?.sub_status !== newRaw?.sub_status) {
            changedFields.push('sub_status');
            hasChanged = true;
          }
          if (oldRaw?.status_code !== newRaw?.status_code) {
            changedFields.push('status_code');
            hasChanged = true;
          }
          if (oldRaw?.status_name !== newRaw?.status_name) {
            changedFields.push('status_name');
            hasChanged = true;
          }
          if (oldRaw?.updated_at !== newRaw?.updated_at) {
            changedFields.push('updated_at');
            hasChanged = true;
          }
        }

        if (hasChanged) {
          updated.push(newOrder);
          changes.push({
            orderId: newOrder.id,
            oldStatus: oldOrder.status,
            newStatus: newOrder.status,
            changedFields,
            order: newOrder,
          });
          
          if (oldOrder.status !== newOrder.status) {
            logger.log(`🔄 Đơn hàng ${newOrder.id} thay đổi trạng thái: ${oldOrder.status} → ${newOrder.status}`);
          } else {
            logger.log(`🔄 Đơn hàng ${newOrder.id} thay đổi: ${changedFields.join(', ')}`);
          }
        } else {
          unchanged.push(newOrder);
        }
      }
    });

    // Tìm orders bị xóa (có trong cũ nhưng không có trong mới)
    // QUAN TRỌNG: Không nên xóa đơn chỉ vì không có trong response mới
    // Vì API có thể trả về không đầy đủ (pagination, filter, etc.)
    // Chỉ đánh dấu là "removed" nhưng KHÔNG xóa khỏi cache/store
    const removed: Order[] = [];
    // Tạm thời không xóa đơn - giữ lại trong cache
    // oldOrders.forEach(oldOrder => {
    //   if (!newOrderMap.has(oldOrder.id)) {
    //     removed.push(oldOrder);
    //     logger.log(`🗑️ Đơn hàng không có trong response mới: ${oldOrder.id} (giữ lại trong cache)`);
    //   }
    // });

    logger.log(`📊 So sánh: ${updated.length} cập nhật, ${added.length} mới, ${removed.length} xóa, ${unchanged.length} không đổi`);

    return {
      updated,
      added,
      removed,
      unchanged,
      changes,
    };
  }

  /**
   * Merge orders: Cập nhật orders cũ với orders mới (chỉ những đơn thay đổi)
   * QUAN TRỌNG: Giữ nguyên những đơn không thay đổi và không xóa đơn "removed"
   */
  mergeOrders(oldOrders: Order[], updateResult: UpdateResult): Order[] {
    const orderMap = new Map<string, Order>();

    // Thêm tất cả orders cũ (giữ nguyên những đơn không thay đổi)
    oldOrders.forEach(order => {
      orderMap.set(order.id, order);
    });

    // Cập nhật những đơn thay đổi (ghi đè lên đơn cũ)
    updateResult.updated.forEach(order => {
      orderMap.set(order.id, order);
    });

    // Thêm đơn mới
    updateResult.added.forEach(order => {
      orderMap.set(order.id, order);
    });

    // KHÔNG xóa đơn "removed" - giữ lại trong cache
    // Vì API có thể không trả về đầy đủ (pagination, filter, etc.)
    // updateResult.removed.forEach(order => {
    //   orderMap.delete(order.id);
    // });

    return Array.from(orderMap.values());
  }

  /**
   * Kiểm tra xem có thay đổi không (nhanh, không cần so sánh chi tiết)
   */
  hasChanges(oldOrders: Order[], newOrders: Order[]): boolean {
    if (oldOrders.length !== newOrders.length) {
      return true;
    }

    const oldIds = new Set(oldOrders.map(o => o.id));
    const newIds = new Set(newOrders.map(o => o.id));

    if (oldIds.size !== newIds.size) {
      return true;
    }

    // Kiểm tra nhanh: so sánh updated_at từ rawData
    const oldUpdatedMap = new Map<string, string>();
    oldOrders.forEach(order => {
      const rawData = order.rawData as PancakeOrder | undefined;
      oldUpdatedMap.set(order.id, rawData?.updated_at || '');
    });

    for (const newOrder of newOrders) {
      const rawData = newOrder.rawData as PancakeOrder | undefined;
      const newUpdatedAt = rawData?.updated_at || '';
      const oldUpdatedAt = oldUpdatedMap.get(newOrder.id) || '';

      if (newUpdatedAt !== oldUpdatedAt) {
        return true;
      }
    }

    return false;
  }
}

export const incrementalUpdateService = new IncrementalUpdateService();

