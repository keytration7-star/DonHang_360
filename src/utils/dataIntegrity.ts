/**
 * Utility để kiểm tra và đảm bảo tính toàn vẹn dữ liệu
 */

import { Order, OrderStatus } from '../shared/types/order';
import { logger } from './logger';
import { calculateOrderStats } from './orderUtils';
import { getWarningOrders } from './orderUtils';
import { calculateOrdersFromOtherFiles } from './orderUtils';

function normalizeTracking(tracking: string | null | undefined): string {
  if (!tracking) return '';
  return String(tracking).trim().toLowerCase();
}

export interface DataIntegrityReport {
  isValid: boolean;
  totalOrders: number;
  stats: {
    totalSent: number;
    totalDelivered: number;
    totalReturned: number;
    partialDelivery: number;
    abnormal: number;
    inTransit: number;
    warning: number;
    lost: number;
  };
  validation: {
    formulaCheck: {
      isValid: boolean;
      leftSide: number;
      rightSide: number;
      difference: number;
    };
    duplicateTracking: number;
    inconsistentData: number;
  };
  errors: string[];
  warnings: string[];
}

/**
 * Kiểm tra tính toàn vẹn dữ liệu
 */
export function checkDataIntegrity(orders: Order[]): DataIntegrityReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 1. Tính toán thống kê
  const stats = calculateOrderStats(orders);
  const warningsData = getWarningOrders(orders);
  const abnormalData = calculateOrdersFromOtherFiles(orders);
  
  // 2. Kiểm tra duplicate tracking number
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
  
  let duplicateCount = 0;
  trackingMap.forEach((ordersWithSameTracking) => {
    if (ordersWithSameTracking.length > 1) {
      duplicateCount++;
      errors.push(`Duplicate tracking number: ${ordersWithSameTracking[0].trackingNumber} (${ordersWithSameTracking.length} đơn)`);
    }
  });
  
  // 3. Kiểm tra công thức: Tổng đơn gửi + Số đơn bất thường = Đã đối soát + Đơn đang giao + Đã hoàn + Đơn giao một phần + Đơn cảnh báo + Đơn thất lạc
  const abnormalCount = abnormalData.fromDeliveredFile.length + abnormalData.fromReturnedFile.length;
  const leftSide = stats.totalSent + abnormalCount;
  
  // Tính đơn đang giao và đơn giao một phần (cần tính lại vì OrderStats không có field này)
  const sentOrders = orders.filter(o => (o.wasSent === true || o.source === 'sent') && o.status !== OrderStatus.CANCELLED);
  const deliveredTrackingNumbers = new Set(
    orders
      .filter(o => o.source === 'delivered' || o.status === OrderStatus.DELIVERED)
      .map(o => o.trackingNumber?.toString().trim().toLowerCase())
      .filter(Boolean)
  );
  const returnedTrackingNumbers = new Set(
    orders
      .filter(o => o.source === 'returned' || o.status === OrderStatus.RETURNED || o.isPartialDelivery === true)
      .map(o => o.trackingNumber?.toString().trim().toLowerCase())
      .filter(Boolean)
  );
  const inTransitCount = sentOrders.filter(o => {
    const tracking = o.trackingNumber?.toString().trim().toLowerCase();
    return !deliveredTrackingNumbers.has(tracking || '') && !returnedTrackingNumbers.has(tracking || '');
  }).length;
  
  // Tính đơn giao một phần
  const partialDeliveryCount = orders.filter(o => {
    if (!o.isPartialDelivery) return false;
    const tracking = normalizeTracking(o.trackingNumber);
    const inDelivered = deliveredTrackingNumbers.has(tracking);
    const inReturned = returnedTrackingNumbers.has(tracking);
    return inDelivered && inReturned;
  }).length;
  
  const rightSide = stats.totalDelivered + inTransitCount + stats.totalReturned + partialDeliveryCount + warningsData.warningCount;
  const difference = Math.abs(leftSide - rightSide);
  
  const formulaCheck = {
    isValid: difference === 0,
    leftSide,
    rightSide,
    difference
  };
  
  if (!formulaCheck.isValid) {
    errors.push(`Công thức kiểm tra không khớp: Trái (${leftSide}) ≠ Phải (${rightSide}), chênh lệch: ${difference} đơn`);
  }
  
  // 4. Kiểm tra tính nhất quán dữ liệu
  let inconsistentCount = 0;
  orders.forEach(order => {
    // Kiểm tra source và status
    if (order.status === OrderStatus.DELIVERED && order.source !== 'delivered' && !order.isPartialDelivery) {
      inconsistentCount++;
      warnings.push(`Order ${order.trackingNumber}: status='DELIVERED' nhưng source='${order.source}'`);
    }
    if (order.status === OrderStatus.RETURNED && order.source !== 'returned' && !order.isPartialDelivery) {
      inconsistentCount++;
      warnings.push(`Order ${order.trackingNumber}: status='RETURNED' nhưng source='${order.source}'`);
    }
    
    // Kiểm tra actualCod
    if (order.actualCod !== undefined && order.actualCod !== null && order.actualCod > 0) {
      if (order.source !== 'delivered' && order.status !== OrderStatus.DELIVERED) {
        inconsistentCount++;
        warnings.push(`Order ${order.trackingNumber}: có actualCod nhưng không có source='delivered'`);
      }
    }
    
    // Kiểm tra isPartialDelivery
    if (order.isPartialDelivery && order.source !== 'delivered') {
      inconsistentCount++;
      errors.push(`Order ${order.trackingNumber}: isPartialDelivery=true nhưng source='${order.source}'`);
    }
  });
  
  return {
    isValid: errors.length === 0 && formulaCheck.isValid,
    totalOrders: orders.length,
    stats: {
      totalSent: stats.totalSent,
      totalDelivered: stats.totalDelivered,
      totalReturned: stats.totalReturned,
      partialDelivery: partialDeliveryCount,
      abnormal: abnormalCount,
      inTransit: inTransitCount,
      warning: warningsData.warningCount,
      lost: warningsData.red.length
    },
    validation: {
      formulaCheck,
      duplicateTracking: duplicateCount,
      inconsistentData: inconsistentCount
    },
    errors,
    warnings
  };
}

/**
 * Tự động fix các vấn đề phát hiện được
 */
export async function autoFixDataIntegrity(
  orders: Order[],
  onFix?: (fixedOrders: Order[]) => Promise<void>
): Promise<{ fixed: Order[]; errors: string[] }> {
  const fixed: Order[] = [];
  const errors: string[] = [];
  
  // 1. Fix duplicate tracking number (giữ đơn mới nhất)
  const trackingMap = new Map<string, Order>();
  orders.forEach(order => {
    const tracking = order.trackingNumber?.toString().trim().toLowerCase();
    if (tracking) {
      const existing = trackingMap.get(tracking);
      if (existing) {
        // So sánh updatedAt, giữ đơn mới hơn
        const existingDate = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        const newDate = order.updatedAt ? new Date(order.updatedAt).getTime() : 0;
        if (newDate >= existingDate) {
          trackingMap.set(tracking, order);
        }
      } else {
        trackingMap.set(tracking, order);
      }
    }
  });
  
  // 2. Fix tính nhất quán dữ liệu
  const fixedOrders = Array.from(trackingMap.values()).map(order => {
    // Fix source nếu không khớp với status
    if (order.status === OrderStatus.DELIVERED && order.source !== 'delivered' && !order.isPartialDelivery) {
      order.source = 'delivered';
    }
    if (order.status === OrderStatus.RETURNED && order.source !== 'returned' && !order.isPartialDelivery) {
      order.source = 'returned';
    }
    
    // Fix isPartialDelivery
    if (order.isPartialDelivery && order.source !== 'delivered') {
      order.source = 'delivered';
      order.status = OrderStatus.DELIVERED;
    }
    
    return order;
  });
  
  fixed.push(...fixedOrders);
  
  // 3. Gọi callback để lưu dữ liệu đã fix
  if (onFix && fixed.length > 0) {
    try {
      await onFix(fixedOrders);
      logger.log(`✅ Đã tự động fix ${fixedOrders.length} đơn hàng`);
    } catch (error: any) {
      errors.push(`Lỗi khi lưu dữ liệu đã fix: ${error.message}`);
    }
  }
  
  return { fixed: fixedOrders, errors };
}
