/**
 * Utility để validate và đảm bảo tính nhất quán dữ liệu
 */

import { Order, OrderStatus } from '../shared/types/order';
import { logger } from './logger';

/**
 * Validate và fix order để đảm bảo tính nhất quán
 */
export function validateAndFixOrder(order: Order): Order {
  const fixed = { ...order };
  
  // 1. Fix source nếu không khớp với status
  if (fixed.status === OrderStatus.DELIVERED) {
    // Nếu status='DELIVERED' nhưng source không phải 'delivered'
    if (fixed.source !== 'delivered') {
      // Trừ khi là đơn giao một phần (có isPartialDelivery=true)
      if (!fixed.isPartialDelivery) {
        fixed.source = 'delivered';
        logger.warn(`⚠️ Fixed order ${fixed.trackingNumber}: source='${order.source}' → 'delivered' (status='DELIVERED')`);
      }
    }
  } else if (fixed.status === OrderStatus.RETURNED) {
    // Nếu status='RETURNED' nhưng source không phải 'returned'
    // Trừ khi là đơn giao một phần (có isPartialDelivery=true)
    if (!fixed.isPartialDelivery && fixed.source !== 'returned') {
      fixed.source = 'returned';
      logger.warn(`⚠️ Fixed order ${fixed.trackingNumber}: source='${order.source}' → 'returned' (status='RETURNED')`);
    }
  } else if (fixed.status === OrderStatus.SENT || fixed.status === OrderStatus.PENDING) {
    // Nếu status='SENT' hoặc 'PENDING' và wasSent=true, source nên là 'sent'
    if (fixed.wasSent && fixed.source !== 'sent' && !fixed.source) {
      fixed.source = 'sent';
    }
  }
  
  // 2. Fix isPartialDelivery: Chỉ set true nếu COD thực sự khác nhau
  if (fixed.source === 'delivered' && fixed.status === OrderStatus.DELIVERED) {
    // Kiểm tra xem có chênh lệch COD thực sự không
    if (fixed.actualCod !== undefined && fixed.actualCod !== null && fixed.cod !== undefined && fixed.cod !== null) {
      const codDifference = Math.abs(fixed.cod - fixed.actualCod);
      
      if (codDifference < 0.01) {
        // COD bằng nhau → KHÔNG phải đơn hoàn 1 phần
        if (fixed.isPartialDelivery === true) {
          fixed.isPartialDelivery = false;
          logger.warn(`⚠️ Fixed order ${fixed.trackingNumber}: isPartialDelivery=false (COD bằng nhau: ${fixed.cod} = ${fixed.actualCod})`);
        }
        // Xóa returnedCod nếu có (vì COD bằng nhau, không có phần hoàn)
        if (fixed.returnedCod !== undefined && fixed.returnedCod !== null && fixed.returnedCod > 0) {
          fixed.returnedCod = 0;
          logger.warn(`⚠️ Fixed order ${fixed.trackingNumber}: returnedCod=0 (COD bằng nhau, không có phần hoàn)`);
        }
      } else {
        // COD khác nhau → là đơn hoàn 1 phần
        if (!fixed.isPartialDelivery) {
          fixed.isPartialDelivery = true;
          logger.warn(`⚠️ Fixed order ${fixed.trackingNumber}: isPartialDelivery=true (COD khác nhau: ${fixed.cod} ≠ ${fixed.actualCod})`);
        }
        // Tính lại returnedCod nếu chưa có hoặc sai
        const expectedReturnedCod = Math.max(0, fixed.cod - fixed.actualCod);
        if (fixed.returnedCod === undefined || fixed.returnedCod === null || Math.abs(fixed.returnedCod - expectedReturnedCod) >= 0.01) {
          fixed.returnedCod = expectedReturnedCod;
          logger.warn(`⚠️ Fixed order ${fixed.trackingNumber}: returnedCod=${expectedReturnedCod} (COD ban đầu: ${fixed.cod} - COD đối soát: ${fixed.actualCod})`);
        }
      }
    } else if (fixed.returnedCod !== undefined && fixed.returnedCod !== null && fixed.returnedCod > 0) {
      // Có returnedCod > 0 nhưng không có actualCod → có thể là đơn hoàn 1 phần
      if (!fixed.isPartialDelivery) {
        fixed.isPartialDelivery = true;
        logger.warn(`⚠️ Fixed order ${fixed.trackingNumber}: isPartialDelivery=true (có returnedCod=${fixed.returnedCod})`);
      }
    } else if (fixed.isPartialDelivery === true) {
      // Có isPartialDelivery=true nhưng không có chênh lệch COD → sửa lại
      fixed.isPartialDelivery = false;
      logger.warn(`⚠️ Fixed order ${fixed.trackingNumber}: isPartialDelivery=false (không có chênh lệch COD)`);
    }
  }
  
  // 3. Fix actualCod nếu không hợp lý
  if (fixed.actualCod !== undefined && fixed.actualCod !== null) {
    // actualCod chỉ hợp lệ khi có source='delivered' hoặc status='DELIVERED'
    if (fixed.source !== 'delivered' && fixed.status !== OrderStatus.DELIVERED) {
      logger.warn(`⚠️ Order ${fixed.trackingNumber}: actualCod=${fixed.actualCod} nhưng không có source='delivered'`);
      // Không xóa actualCod, chỉ cảnh báo (có thể là dữ liệu cũ)
    }
  }
  
  // 4. Fix returnedCod nếu không hợp lý
  if (fixed.returnedCod !== undefined && fixed.returnedCod !== null) {
    // returnedCod chỉ hợp lệ khi có trong file hoàn
    if (fixed.source !== 'returned' && fixed.status !== OrderStatus.RETURNED && !fixed.isPartialDelivery) {
      logger.warn(`⚠️ Order ${fixed.trackingNumber}: returnedCod=${fixed.returnedCod} nhưng không có trong file hoàn`);
      // Không xóa returnedCod, chỉ cảnh báo
    }
  }
  
  // 5. Đảm bảo updatedAt luôn có
  if (!fixed.updatedAt) {
    fixed.updatedAt = new Date().toISOString();
  }
  
  return fixed;
}

/**
 * Validate tất cả orders và fix tự động
 */
export function validateAllOrders(orders: Order[]): {
  valid: Order[];
  fixed: Order[];
  errors: Array<{ order: Order; error: string }>;
} {
  const valid: Order[] = [];
  const fixed: Order[] = [];
  const errors: Array<{ order: Order; error: string }> = [];
  
  orders.forEach(order => {
    try {
      // Validate cơ bản
      if (!order.trackingNumber || order.trackingNumber.trim().length === 0) {
        errors.push({ order, error: 'Thiếu tracking number' });
        return;
      }
      
      if (!order.id) {
        errors.push({ order, error: 'Thiếu ID' });
        return;
      }
      
      // Fix và validate
      const fixedOrder = validateAndFixOrder(order);
      
      // Kiểm tra xem có thay đổi không
      const hasChanges = 
        fixedOrder.source !== order.source ||
        fixedOrder.isPartialDelivery !== order.isPartialDelivery;
      
      if (hasChanges) {
        fixed.push(fixedOrder);
        valid.push(fixedOrder);
      } else {
        valid.push(order);
      }
    } catch (error: any) {
      errors.push({ order, error: error.message || 'Lỗi không xác định' });
    }
  });
  
  if (fixed.length > 0) {
    logger.log(`✅ Đã fix ${fixed.length} đơn hàng để đảm bảo tính nhất quán`);
  }
  
  if (errors.length > 0) {
    logger.error(`❌ Có ${errors.length} đơn hàng lỗi: ${errors.map(e => `${e.order.trackingNumber}: ${e.error}`).join(', ')}`);
  }
  
  return { valid, fixed, errors };
}

/**
 * Validate tính nhất quán của dữ liệu sau khi import
 */
export function validateDataConsistency(orders: Order[]): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 1. Kiểm tra duplicate tracking number
  const trackingMap = new Map<string, Order[]>();
  orders.forEach(order => {
    const tracking = order.trackingNumber?.toString().trim().toLowerCase();
    if (tracking) {
      if (!trackingMap.has(tracking)) {
        trackingMap.set(tracking, []);
      }
      trackingMap.get(tracking)!.push(order);
    }
  });
  
  trackingMap.forEach((ordersWithSameTracking, tracking) => {
    if (ordersWithSameTracking.length > 1) {
      errors.push(`Duplicate tracking number: ${tracking} (${ordersWithSameTracking.length} đơn)`);
    }
  });
  
  // 2. Kiểm tra source và status không khớp
  orders.forEach(order => {
    if (order.status === OrderStatus.DELIVERED && order.source !== 'delivered' && !order.isPartialDelivery) {
      warnings.push(`Order ${order.trackingNumber}: status='DELIVERED' nhưng source='${order.source}'`);
    }
    if (order.status === OrderStatus.RETURNED && order.source !== 'returned' && !order.isPartialDelivery) {
      warnings.push(`Order ${order.trackingNumber}: status='RETURNED' nhưng source='${order.source}'`);
    }
  });
  
  // 3. Kiểm tra actualCod chỉ có khi source='delivered'
  orders.forEach(order => {
    if (order.actualCod !== undefined && order.actualCod !== null && order.actualCod > 0) {
      if (order.source !== 'delivered' && order.status !== OrderStatus.DELIVERED) {
        warnings.push(`Order ${order.trackingNumber}: có actualCod nhưng không có source='delivered'`);
      }
    }
  });
  
  // 4. Kiểm tra returnedCod chỉ có khi có trong file hoàn
  orders.forEach(order => {
    if (order.returnedCod !== undefined && order.returnedCod !== null) {
      if (order.source !== 'returned' && order.status !== OrderStatus.RETURNED && !order.isPartialDelivery) {
        warnings.push(`Order ${order.trackingNumber}: có returnedCod nhưng không có trong file hoàn`);
      }
    }
  });
  
  // 5. Kiểm tra isPartialDelivery chỉ có khi source='delivered'
  orders.forEach(order => {
    if (order.isPartialDelivery && order.source !== 'delivered') {
      errors.push(`Order ${order.trackingNumber}: isPartialDelivery=true nhưng source='${order.source}'`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
