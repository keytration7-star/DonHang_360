import { Order, OrderStatus, OrderStats, RegionStats } from '../../shared/types/order';
import { PancakeOrder } from '../../shared/types/pancakeApi';
import { logger } from './logger';
import { differenceInDays } from 'date-fns';

/**
 * Format số tiền theo định dạng Việt Nam
 * @param amount Số tiền cần format
 * @returns Chuỗi đã format (ví dụ: "1.234.567₫")
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '0₫';
  }
  return `${amount.toLocaleString('vi-VN')}₫`;
}

/**
 * Format ngày tháng theo định dạng Việt Nam
 * @param dateString Chuỗi ngày tháng (ISO string hoặc date string)
 * @returns Chuỗi đã format (ví dụ: "01/01/2024")
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) {
    return '-';
  }
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString; // Trả về nguyên bản nếu không parse được
    }
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (error) {
    return dateString; // Trả về nguyên bản nếu có lỗi
  }
}

function normalizeTracking(tracking: string | null | undefined): string {
  if (!tracking) return '';
  return String(tracking).trim().toLowerCase();
}

function extractBaseTracking(tracking: string): string {
  const trimmed = tracking.trim();
  // Thử match pattern số + chữ cái (ví dụ: "802670008263A" -> "802670008263")
  const numberMatch = trimmed.match(/^(\d+)/);
  if (numberMatch) {
    return numberMatch[1];
  }
  // Thử match pattern chữ cái + số (ví dụ: "A802670008263" -> "802670008263")
  const letterMatch = trimmed.match(/^[A-Za-z]+(\d+)/);
  if (letterMatch) {
    return letterMatch[1];
  }
  return trimmed;
}

/**
 * Tính toán thống kê đơn hàng - LOGIC MỚI THEO ĐỊNH NGHĨA THỐNG NHẤT
 * 
 * Định nghĩa:
 * 1. Đơn gửi: Đơn có trong file đơn gửi (wasSent=true hoặc source='sent')
 * 2. Đã đối soát: Đơn có trong file đối soát (source='delivered' hoặc status='DELIVERED')
 * 3. Đã hoàn: Đơn hoàn bình thường, KHÔNG có chênh lệch COD (source='returned' hoặc status='RETURNED', nhưng KHÔNG phải đơn hoàn 1 phần)
 * 4. Đơn hoàn 1 phần: Đơn hoàn có chênh lệch COD (có trong file hoàn VÀ có chênh lệch COD: cod !== returnedCod hoặc cod !== actualCod)
 * 5. Đơn bất thường: Đơn có trong file đối soát HOẶC file hoàn nhưng KHÔNG có trong file đơn gửi (wasSent=false và (source='delivered' hoặc source='returned'))
 * 6. Đơn đang giao: Đơn có trong file đơn gửi nhưng KHÔNG có trong file hoàn VÀ KHÔNG có trong file đối soát (wasSent=true và không có source='delivered' và không có source='returned')
 * 
 * Công thức kiểm tra: Tổng đơn gửi + Số đơn bất thường = Đã đối soát + Đơn đang giao + Đã hoàn + Đơn hoàn 1 phần + Đơn cảnh báo + Đơn thất lạc
 * 
 * Tỉ lệ ký nhận: Đã đối soát/(Đã hoàn+Đơn hoàn 1 phần)*100
 * 
 * @param orders Danh sách tất cả đơn hàng
 * @returns OrderStats Thống kê đơn hàng
 */
export function calculateOrderStats(orders: Order[]): OrderStats {
  // Loại trừ đơn hủy
  const activeOrders = orders.filter(o => o.status !== OrderStatus.CANCELLED);
  const cancelledOrders = orders.filter(o => o.status === OrderStatus.CANCELLED);
  
  // ============================================
  // 1. XÁC ĐỊNH CÁC NHÓM ĐƠN
  // ============================================
  
  // 1.1. Đơn gửi: Đơn có trong file đơn gửi (wasSent=true hoặc source='sent')
  const sentOrders = activeOrders.filter(o => o.wasSent === true || o.source === 'sent');
  const sentTrackingNumbers = new Set(
    sentOrders.map(o => normalizeTracking(o.trackingNumber)).filter(Boolean)
  );
  const totalSent = sentOrders.length;
  
  // 1.2. Đã đối soát: Đơn có trong file đối soát (source='delivered' hoặc status='DELIVERED')
  // QUAN TRỌNG: KHÔNG bao gồm đơn hoàn 1 phần (sẽ được tính riêng)
  // Đơn đã đối soát = Đơn có COD sau ký nhận = COD ban đầu
  // KHÔNG cần kiểm tra có trong file gửi hay không
  const allDeliveredOrders = activeOrders.filter(o => 
    o.source === 'delivered' || o.status === OrderStatus.DELIVERED
  );
  
  // Loại bỏ đơn hoàn 1 phần khỏi "Đã đối soát" (sẽ tính riêng)
  // Đơn hoàn 1 phần có isPartialDelivery=true
  const deliveredOrders = allDeliveredOrders.filter(o => o.isPartialDelivery !== true);
  const deliveredTrackingNumbers = new Set(
    deliveredOrders.map(o => normalizeTracking(o.trackingNumber)).filter(Boolean)
  );
  const totalDelivered = deliveredOrders.length;
  
  const ordersWithActualCod = activeOrders.filter(o => 
    o.actualCod !== undefined && o.actualCod !== null && o.actualCod > 0
  );
  if (ordersWithActualCod.length > totalDelivered) {
    logger.warn(`⚠️ CẢNH BÁO: Có ${ordersWithActualCod.length} đơn có actualCod nhưng chỉ có ${totalDelivered} đơn có source='delivered'`);
    logger.warn(`   - Có thể có đơn bị thiếu source='delivered' hoặc status='DELIVERED'`);
    const missingOrders = ordersWithActualCod.filter(o => 
      o.source !== 'delivered' && o.status !== OrderStatus.DELIVERED
    );
    if (missingOrders.length > 0) {
      logger.warn(`   - Số đơn thiếu: ${missingOrders.length}`);
      const sample = missingOrders.slice(0, 5).map(o => 
        `${o.trackingNumber} (source=${o.source}, status=${o.status}, actualCod=${o.actualCod})`
      ).join(', ');
      logger.warn(`   - Mẫu đơn thiếu: ${sample}`);
    }
  }
  
  // 1.3. Đơn hoàn 1 phần: Đơn có trong file đối soát VÀ có chênh lệch COD
  // Đơn hoàn 1 phần có isPartialDelivery=true VÀ source='delivered'
  // Logic: Khi import file đối soát, nếu COD sau ký nhận ≠ COD ban đầu → đơn hoàn 1 phần
  const partialReturnedOrders = activeOrders.filter(o => {
    // Phải có isPartialDelivery=true (được set khi import file đối soát với COD khác nhau)
    if (o.isPartialDelivery !== true) return false;
    
    // Phải có source='delivered' (vì đã được đối soát)
    if (o.source !== 'delivered' && o.status !== OrderStatus.DELIVERED) return false;
    
    // Phải có chênh lệch COD: cod !== actualCod (COD ban đầu ≠ COD đối soát)
    if (o.actualCod !== undefined && o.actualCod !== null && o.cod !== undefined && o.cod !== null) {
      const hasCodDifference = Math.abs((o.cod || 0) - (o.actualCod || 0)) >= 0.01;
      return hasCodDifference;
    }
    
    // Nếu có returnedCod, đó cũng là đơn hoàn 1 phần
    if (o.returnedCod !== undefined && o.returnedCod !== null && o.returnedCod > 0) {
      return true;
    }
    
    return false;
  });
  const partialReturnedTrackingNumbers = new Set(
    partialReturnedOrders.map(o => normalizeTracking(o.trackingNumber)).filter(Boolean)
  );
  const partialReturnedCount = partialReturnedOrders.length;
  
  // 1.4. Đã hoàn: Đơn có trong file hoàn, KHÔNG có chênh lệch COD (đơn hoàn bình thường)
  // (source='returned' hoặc status='RETURNED') NHƯNG KHÔNG phải đơn hoàn 1 phần
  // QUAN TRỌNG: Đơn hoàn 1 phần có isPartialDelivery=true nhưng vẫn có source='delivered'
  // Nên cần loại bỏ đơn hoàn 1 phần bằng cách kiểm tra partialReturnedTrackingNumbers
  const returnedOrders = activeOrders.filter(o => {
    const inReturned = o.source === 'returned' || o.status === OrderStatus.RETURNED;
    if (!inReturned) return false;
    
    // Loại bỏ đơn hoàn 1 phần (có trong partialReturnedTrackingNumbers)
    const tracking = normalizeTracking(o.trackingNumber);
    return !partialReturnedTrackingNumbers.has(tracking);
  });
  const returnedTrackingNumbers = new Set(
    returnedOrders.map(o => normalizeTracking(o.trackingNumber)).filter(Boolean)
  );
  const totalReturned = returnedOrders.length;
  
  // 1.5. Đơn bất thường: Đơn có trong file đối soát HOẶC file hoàn nhưng KHÔNG có trong file đơn gửi
  // (wasSent=false và (source='delivered' hoặc source='returned'))
  const abnormalOrders = activeOrders.filter(o => {
    const tracking = normalizeTracking(o.trackingNumber);
    const inSent = sentTrackingNumbers.has(tracking);
    const inDelivered = deliveredTrackingNumbers.has(tracking);
    const inReturned = returnedTrackingNumbers.has(tracking);
    
    // Không có trong file gửi VÀ có trong file đối soát hoặc file hoàn
    return !inSent && (inDelivered || inReturned);
  });
  
  // 1.6. Đơn đang giao: Đơn có trong file đơn gửi nhưng KHÔNG có trong "Đã đối soát" VÀ KHÔNG có trong "Đã hoàn"
  // VÀ phải dưới 10 ngày kể từ ngày gửi hàng
  // (wasSent=true và không có source='delivered' và không có source='returned')
  // QUAN TRỌNG: Đơn đang giao = Đơn gửi - Đã đối soát - Đã hoàn - Đơn hoàn 1 phần - Đơn cảnh báo - Đơn nghi ngờ thất lạc
  const partialReturnedTrackingNumbersSet = new Set(
    partialReturnedOrders.map(o => normalizeTracking(o.trackingNumber)).filter(Boolean)
  );
  
  const now = new Date();
  const inTransitOrders = sentOrders.filter(o => {
    const tracking = normalizeTracking(o.trackingNumber);
    const inDelivered = deliveredTrackingNumbers.has(tracking);
    const inReturned = returnedTrackingNumbers.has(tracking);
    const inPartialReturned = partialReturnedTrackingNumbersSet.has(tracking);
    
    // Loại bỏ đơn đã đối soát, đơn đã hoàn, và đơn hoàn 1 phần
    if (inDelivered || inReturned || inPartialReturned) {
      return false;
    }
    
    // Chỉ tính đơn dưới 10 ngày kể từ ngày gửi hàng
    if (!o.sendDate) {
      return false; // Đơn không có ngày gửi → không tính vào đơn đang giao
    }
    
    const daysSinceSent = differenceInDays(now, new Date(o.sendDate));
    return daysSinceSent < 10; // Chỉ tính đơn dưới 10 ngày
  });
  
  // ============================================
  // 2. TÍNH TOÁN TIỀN
  // ============================================
  
  // 2.1. Tổng COD gửi: Tổng COD từ đơn gửi (wasSent=true)
  const totalCodFromSent = sentOrders.reduce((sum, o) => sum + (o.cod || 0), 0);
  
  // 2.2. COD đã đối soát: Tổng actualCod từ file đối soát
  // Chỉ tính từ đơn có actualCod (đã có dữ liệu từ file đối soát)
  const totalCodDelivered = deliveredOrders.reduce((sum, o) => {
    if (o.actualCod !== undefined && o.actualCod !== null) {
      return sum + o.actualCod;
    }
    return sum;
  }, 0);
  
  // 2.3. Tiền chênh lệch COD: Tổng COD chênh lệch của những đơn hoàn 1 phần
  // Công thức: Tổng (COD ban đầu - returnedCod) của đơn hoàn 1 phần
  // HOẶC Tổng (COD ban đầu - actualCod) nếu không có returnedCod
  const codDifference = partialReturnedOrders.reduce((sum, order) => {
    const originalCod = order.cod || 0;
    
    // Ưu tiên returnedCod (COD hoàn)
    if (order.returnedCod !== undefined && order.returnedCod !== null) {
      return sum + (originalCod - order.returnedCod);
    }
    
    // Nếu không có returnedCod, dùng actualCod (COD đối soát)
    if (order.actualCod !== undefined && order.actualCod !== null) {
      return sum + (originalCod - order.actualCod);
    }
    
    return sum;
  }, 0);
  
  // 2.4. COD đơn hoàn: COD đơn hoàn thông thường + COD đơn hoàn 1 phần
  // COD đơn hoàn thông thường = COD của đơn hoàn bình thường (không có chênh lệch COD)
  const codFromNormalReturned = returnedOrders.reduce((sum, o) => sum + (o.cod || 0), 0);
  
  // COD đơn hoàn 1 phần = COD hoàn (returnedCod) của đơn hoàn 1 phần
  // HOẶC COD ban đầu nếu không có returnedCod
  const codFromPartialReturned = partialReturnedOrders.reduce((sum, o) => {
    // Ưu tiên returnedCod (COD hoàn)
    if (o.returnedCod !== undefined && o.returnedCod !== null) {
      return sum + o.returnedCod;
    }
    // Nếu không có returnedCod, dùng COD ban đầu
    return sum + (o.cod || 0);
  }, 0);
  
  const totalCodReturned = codFromNormalReturned + codFromPartialReturned;
  
  // 2.5. Cước phí: Tổng cước từ đơn gửi
  const totalShippingFee = sentOrders.reduce((sum, o) => sum + (o.shippingFee || 0), 0);
  
  // 2.6. Cước phí hoàn (giả định mỗi đơn hoàn mất 10,000₫ cước)
  const returnShippingFeePerOrder = 10000;
  const totalReturnShippingFee = returnShippingFeePerOrder * totalReturned;
  
  // 2.7. Tiền còn lại = COD gửi (từ đơn gửi) - COD đối soát - COD hoàn - Cước gửi - Cước hoàn
  const remainingAmount = totalCodFromSent - totalCodDelivered - totalCodReturned - totalShippingFee - totalReturnShippingFee;
  
  // 2.8. Tính tiền còn lại cuối cùng (COD của các đơn chưa đối soát và chưa hoàn)
  const remainingOrders = inTransitOrders;
  const codFromRemainingOrders = remainingOrders.reduce((sum, order) => sum + (order.cod || 0), 0);
  const shippingFeeFromRemainingOrders = remainingOrders.reduce((sum, order) => sum + (order.shippingFee || 0), 0);
  const finalRemainingAmount = codFromRemainingOrders - shippingFeeFromRemainingOrders;
  
  // 2.9. COD từ đơn gửi cho đơn đã đối soát (COD ban đầu, không phải actualCod)
  const codFromSentForDelivered = deliveredOrders
    .filter(o => sentTrackingNumbers.has(normalizeTracking(o.trackingNumber)))
    .reduce((sum, order) => sum + (order.cod || 0), 0);
  
  // Tỉ lệ ký nhận: Đã đối soát/(Đã hoàn+Đơn hoàn 1 phần)*100
  // QUAN TRỌNG: Đơn hoàn 1 phần được tính riêng, không tính vào "Đã hoàn"
  const denominator = totalReturned + partialReturnedCount; // Đã hoàn + Đơn hoàn 1 phần
  const deliveryRate = denominator > 0 ? (totalDelivered / denominator) * 100 : 0;
  
  // Tổng COD từ TẤT CẢ đơn (cho tương thích với code cũ)
  const totalCod = activeOrders.reduce((sum, o) => sum + (o.cod || 0), 0);
  
  if (totalCodReturned > 0 && totalReturned === 0 && partialReturnedCount === 0) {
    logger.warn(`⚠️ CẢNH BÁO: Có COD hoàn (${totalCodReturned.toLocaleString('vi-VN')}₫) nhưng không có đơn hoàn nào!`);
    logger.warn(`   - COD đơn hoàn thông thường: ${codFromNormalReturned.toLocaleString('vi-VN')}₫`);
    logger.warn(`   - COD đơn hoàn 1 phần: ${codFromPartialReturned.toLocaleString('vi-VN')}₫`);
    logger.warn(`   - Số đơn hoàn thông thường: ${returnedOrders.length}`);
    logger.warn(`   - Số đơn hoàn 1 phần: ${partialReturnedOrders.length}`);
    
    // Tìm các đơn có returnedCod hoặc isPartialDelivery
    const ordersWithReturnedCod = activeOrders.filter(o => o.returnedCod !== undefined && o.returnedCod !== null && o.returnedCod > 0);
    const ordersWithPartialDelivery = activeOrders.filter(o => o.isPartialDelivery === true);
    logger.warn(`   - Số đơn có returnedCod > 0: ${ordersWithReturnedCod.length}`);
    logger.warn(`   - Số đơn có isPartialDelivery=true: ${ordersWithPartialDelivery.length}`);
    
    if (ordersWithReturnedCod.length > 0) {
      const sample = ordersWithReturnedCod.slice(0, 5).map(o => 
        `${o.trackingNumber} (source=${o.source}, status=${o.status}, returnedCod=${o.returnedCod}, isPartialDelivery=${o.isPartialDelivery})`
      ).join(', ');
      logger.warn(`   - Mẫu đơn có returnedCod: ${sample}`);
    }
  }
  
  return {
    totalSent,
    totalDelivered,
    totalReturned,
    totalCancelled: cancelledOrders.length,
    deliveryRate: Math.round(deliveryRate * 100) / 100,
    totalCod,
    totalShippingFee,
    partialDeliveryCount: partialReturnedCount, // Đổi tên để tương thích với interface
    totalCodDelivered,
    totalCodReturned,
    totalReturnShippingFee,
    remainingAmount,
    codDifference,
    finalRemainingAmount,
    totalCodDeliveredFromSent: codFromSentForDelivered,
    codFromRemainingOrders,
    shippingFeeFromRemainingOrders,
    codFromSentForDeliveredOnly: codFromSentForDelivered,
  };
}

/**
 * Tính toán đơn cảnh báo và đơn nghi ngờ thất lạc
 * - Đơn cảnh báo: Đơn đang giao từ 10-14 ngày
 * - Đơn nghi ngờ thất lạc: Đơn đang giao trên 14 ngày
 */
export function getWarningOrders(orders: Order[]): {
  yellow: Order[];
  red: Order[];
  warningCount: number;
} {
  const activeOrders = orders.filter(o => o.status !== OrderStatus.CANCELLED);
  const sentOrders = activeOrders.filter(o => o.wasSent === true || o.source === 'sent');
  
  // Đơn có trong file đối soát (loại bỏ đơn hoàn 1 phần)
  const deliveredOrders = activeOrders.filter(o => 
    (o.source === 'delivered' || o.status === OrderStatus.DELIVERED) && o.isPartialDelivery !== true
  );
  const deliveredTrackingNumbers = new Set(
    deliveredOrders.map(o => normalizeTracking(o.trackingNumber)).filter(Boolean)
  );
  
  // Đơn có trong file hoàn (loại bỏ đơn hoàn 1 phần)
  const returnedOrders = activeOrders.filter(o => 
    (o.source === 'returned' || o.status === OrderStatus.RETURNED) && o.isPartialDelivery !== true
  );
  const returnedTrackingNumbers = new Set(
    returnedOrders.map(o => normalizeTracking(o.trackingNumber)).filter(Boolean)
  );
  
  // Đơn hoàn 1 phần
  const partialReturnedTrackingNumbersForWarning = new Set(
    activeOrders
      .filter(o => o.isPartialDelivery === true)
      .map(o => normalizeTracking(o.trackingNumber))
      .filter(Boolean)
  );
  
  // Đơn đang giao: có trong file gửi nhưng không có trong file đối soát và không có trong file hoàn
  // QUAN TRỌNG: Loại bỏ cả đơn hoàn 1 phần (vì đã được đối soát)
  const inTransitOrders = sentOrders.filter(o => {
    const tracking = normalizeTracking(o.trackingNumber);
    const inDelivered = deliveredTrackingNumbers.has(tracking);
    const inReturned = returnedTrackingNumbers.has(tracking);
    const inPartialReturned = partialReturnedTrackingNumbersForWarning.has(tracking);
    return !inDelivered && !inReturned && !inPartialReturned;
  });
  
  const now = new Date();
  const yellow: Order[] = []; // Cảnh báo vàng: 10-14 ngày
  const red: Order[] = []; // Nghi ngờ thất lạc: > 14 ngày
  
  inTransitOrders.forEach(order => {
    if (!order.sendDate) {
      red.push(order); // Đơn không có ngày gửi → nghi ngờ thất lạc
      return;
    }
    const daysSinceSent = differenceInDays(now, new Date(order.sendDate));
    if (daysSinceSent > 14) {
      red.push(order); // Nghi ngờ thất lạc: > 14 ngày
    } else if (daysSinceSent >= 10) {
      yellow.push(order); // Cảnh báo vàng: 10-14 ngày
    }
    // Đơn dưới 10 ngày không được thêm vào yellow hoặc red (đó là đơn đang giao)
  });
  
  logger.log(`📊 [Warning] Tổng kết: ${yellow.length} cảnh báo vàng (10-14 ngày), ${red.length} nghi ngờ thất lạc (> 14 ngày), ${inTransitOrders.length - yellow.length - red.length} đơn dưới 10 ngày (đơn đang giao)`);
  return { yellow, red, warningCount: yellow.length + red.length };
}

/**
 * Tính toán thống kê về đơn được tạo từ file đối soát/hoàn MÀ KHÔNG CÓ trong file gửi (đơn bất thường)
 * @param orders Danh sách tất cả đơn hàng
 * @returns Object chứa danh sách đơn bất thường và tổng COD
 */
export function calculateOrdersFromOtherFiles(orders: Order[]): {
  fromDeliveredFile: Order[];
  fromReturnedFile: Order[];
  totalCodFromDeliveredFile: number;
  totalActualCodFromDeliveredFile: number;
} {
  const sentTrackingNumbers = new Set(
    orders
      .filter(o => (o.wasSent === true || o.source === 'sent') && o.status !== OrderStatus.CANCELLED && o.trackingNumber)
      .map(o => normalizeTracking(o.trackingNumber))
      .filter(t => t.length > 0)
  );
  
  // Đơn từ file đối soát nhưng không có trong file gửi (đơn bất thường)
  const fromDeliveredFile = orders.filter(o => 
    (o.source === 'delivered' || o.status === OrderStatus.DELIVERED) && 
    o.status !== OrderStatus.CANCELLED &&
    !sentTrackingNumbers.has(normalizeTracking(o.trackingNumber)) && 
    o.wasSent !== true
  );
  
  // Đơn từ file hoàn nhưng không có trong file gửi (đơn bất thường)
  const fromReturnedFile = orders.filter(o => 
    (o.source === 'returned' || o.status === OrderStatus.RETURNED) && 
    o.status !== OrderStatus.CANCELLED &&
    !sentTrackingNumbers.has(normalizeTracking(o.trackingNumber)) && 
    o.wasSent !== true
  );
  
  const totalCodFromDeliveredFile = fromDeliveredFile.reduce((sum, o) => sum + (o.cod || 0), 0);
  const totalActualCodFromDeliveredFile = fromDeliveredFile.reduce((sum, o) => sum + (o.actualCod || 0), 0);
  
  return {
    fromDeliveredFile,
    fromReturnedFile,
    totalCodFromDeliveredFile,
    totalActualCodFromDeliveredFile,
  };
}

export function calculateRegionStats(orders: Order[]): RegionStats[] {
  const regionMap = new Map<string, { total: number; delivered: number }>();
  
  // DEBUG: Log để kiểm tra
  let totalProcessed = 0;
  let totalSkipped = 0;
  
  orders.forEach(order => {
    totalProcessed++;
    
    // Chỉ tính đơn từ 3 tab: SENT, DELIVERED, RETURNED (loại bỏ CANCELLED và các status khác)
    if (order.status === OrderStatus.CANCELLED) {
      totalSkipped++;
      return;
    }
    
    // Chỉ tính đơn có status là SENT, DELIVERED, hoặc RETURNED
    if (order.status !== OrderStatus.SENT && 
        order.status !== OrderStatus.DELIVERED && 
        order.status !== OrderStatus.RETURNED) {
      totalSkipped++;
      return;
    }
    
    const region = order.region || 'Không xác định';
    const current = regionMap.get(region) || { total: 0, delivered: 0 };
    
    // Tổng đơn = Đã gửi hàng (SENT) + Đã nhận (DELIVERED) + Đã hoàn (RETURNED)
    // Từ 3 tab trong "Đơn hàng API": "Đã gửi hàng" + "Đã nhận" + "Đã hoàn"
    current.total++;
    
    // Đã nhận = Đã nhận (DELIVERED) từ tab "Đã nhận" trong "Đơn hàng API"
    if (order.status === OrderStatus.DELIVERED) {
      current.delivered++;
    }
    
    regionMap.set(region, current);
  });
  
  const result = Array.from(regionMap.entries())
    .map(([region, stats]) => {
      // Tỉ lệ giao hàng = Đã nhận / Tổng đơn × 100%
      const deliveryRate = stats.total > 0 ? (stats.delivered / stats.total) * 100 : 0;
      
      return {
        region,
        orderCount: stats.total,
        deliveryRate,
        totalOrders: stats.total,
      };
    })
    .sort((a, b) => b.orderCount - a.orderCount);
  
  return result;
}

/**
 * Lấy trạng thái đơn hàng từ PancakeOrder để hiển thị trong cột "Thẻ"
 * Ưu tiên lấy từ partner (đơn vị vận chuyển) vì đây là trạng thái thực tế khi ship
 * @param order Đơn hàng từ Pancake API
 * @returns Object chứa text và màu sắc để hiển thị
 */
export function getOrderStatusTag(order: PancakeOrder): { text: string; color: string; dotColor: string } {
  // QUAN TRỌNG: "Thẻ" là tags do hệ thống Pancake tự cập nhật/chọn, KHÔNG phải trạng thái vận chuyển
  // Tags nằm trong order.tags[] - array các object { id, name }
  // Ví dụ: tags: [{ id: 75, name: "Giao không thành" }]
  
  let statusText = '';
  
  // Ưu tiên 1: Lấy từ tags (tags do Pancake tự cập nhật)
  if (order.tags && Array.isArray(order.tags) && order.tags.length > 0) {
    // Tìm tag có name liên quan đến trạng thái giao hàng
    // Ưu tiên các tag như "Giao không thành", "Đổi hàng", "Hẹn gọi", etc.
    const importantTagNames = [
      'giao không thành',
      'giao thất bại',
      'đổi hàng',
      'hẹn gọi',
      'quá ngày giao hàng',
      'không nghe máy',
      'chênh cước',
    ];
    
    // Tìm tag quan trọng nhất
    let foundTag = null;
    for (const tag of order.tags) {
      if (tag && typeof tag === 'object' && tag.name) {
        const tagName = String(tag.name).toLowerCase();
        const isImportant = importantTagNames.some(important => tagName.includes(important));
        if (isImportant) {
          foundTag = tag;
          break; // Lấy tag quan trọng đầu tiên tìm được
        }
      }
    }
    
    // Nếu không tìm thấy tag quan trọng, lấy tag đầu tiên
    if (!foundTag && order.tags.length > 0) {
      foundTag = order.tags[0];
    }
    
    if (foundTag && foundTag.name) {
      statusText = String(foundTag.name).trim();
    }
  }
  
  // Ưu tiên 2: Nếu không có tags, lấy từ partner.extend_update (trạng thái từ đơn vị vận chuyển)
  const partner = order.partner;
  
  if (!statusText && partner?.extend_update && Array.isArray(partner.extend_update)) {
    // Tìm tất cả các item có key === "status"
    const statusUpdates = partner.extend_update.filter((item: unknown) => {
      if (typeof item === 'object' && item !== null) {
        const updateItem = item as Record<string, unknown>;
        return updateItem.key === 'status' && updateItem.status;
      }
      return false;
    });
    
    if (statusUpdates.length > 0) {
      // Ưu tiên tìm trạng thái "giao không thành công" hoặc các trạng thái lỗi trong TẤT CẢ các status
      // (không chỉ item cuối cùng, vì có thể có nhiều status updates)
      const failedStatus = statusUpdates.find((item: unknown) => {
        const updateItem = item as Record<string, unknown>;
        const status = String(updateItem.status || '').toLowerCase();
        return status.includes('failed') || 
               status.includes('thất bại') || 
               status.includes('không thành công') ||
               status.includes('giao không thành') ||
               status.includes('unsuccessful') ||
               status.includes('error') ||
               status.includes('fail');
      });
      
      if (failedStatus) {
        // Tìm thấy trạng thái lỗi - ưu tiên hiển thị
        const updateItem = failedStatus as Record<string, unknown>;
        statusText = String(updateItem.status || '').trim();
      } else {
        // Không có trạng thái lỗi - tìm status quan trọng khác (delivered, out_for_delivery, etc.)
        // Ưu tiên: delivered > out_for_delivery > shipped > others
        const priorityStatuses = [
          { keywords: ['delivered', 'đã giao', 'giao thành công'], priority: 1 },
          { keywords: ['out_for_delivery', 'out for delivery', 'delivering', 'đang giao'], priority: 2 },
          { keywords: ['shipped', 'đã gửi'], priority: 3 },
        ];
        
        let foundStatus: { item: Record<string, unknown>; priority: number } | null = null;
        
        for (const statusItem of statusUpdates) {
          const updateItem = statusItem as Record<string, unknown>;
          const status = String(updateItem.status || '').toLowerCase();
          
          for (const priorityStatus of priorityStatuses) {
            if (priorityStatus.keywords.some(keyword => status.includes(keyword))) {
              if (!foundStatus || priorityStatus.priority < foundStatus.priority) {
                foundStatus = { item: updateItem, priority: priorityStatus.priority };
              }
              break;
            }
          }
        }
        
        if (foundStatus) {
          statusText = String(foundStatus.item.status || '').trim();
        } else {
          // Lấy status mới nhất (item cuối cùng trong array)
          const latestStatus = statusUpdates[statusUpdates.length - 1] as Record<string, unknown>;
          statusText = String(latestStatus.status || '').trim();
        }
      }
    }
  }
  
  // Nếu không có trong extend_update, thử các trường khác
  if (!statusText && partner && typeof partner === 'object') {
    // Ưu tiên các trường _text (text hiển thị) - đây là text hiển thị từ đơn vị vận chuyển
    // Thử tất cả các biến thể có thể có của tên trường
    const possibleFields = [
      'delivery_status_text',
      'tracking_status_text', 
      'status_text',
      'delivery_status',
      'tracking_status',
      'status',
      'deliveryStatusText',
      'trackingStatusText',
      'statusText',
      'deliveryStatus',
      'trackingStatus',
    ];
    
    // Tìm trong các trường đã biết
    for (const field of possibleFields) {
      const value = (partner as Record<string, unknown>)[field];
      if (value && typeof value === 'string' && value.trim() && value !== 'null' && value !== 'undefined') {
        statusText = String(value).trim();
        break;
      }
    }
    
    // Nếu vẫn chưa có, tìm trong tất cả các keys của partner
    // Ưu tiên các giá trị string có chứa từ khóa liên quan đến trạng thái giao hàng
    if (!statusText) {
      const allKeys = Object.keys(partner);
      
      // Tìm các key có chứa "status", "delivery", "tracking", "state"
      const statusKeys = allKeys.filter(key => {
        const keyLower = key.toLowerCase();
        return (keyLower.includes('status') || 
                keyLower.includes('delivery') ||
                keyLower.includes('tracking') ||
                keyLower.includes('state')) &&
               // Loại bỏ các key không phải là status text
               !keyLower.includes('id') &&
               !keyLower.includes('code') &&
               !keyLower.includes('name') &&
               !keyLower.includes('at') && // Loại bỏ các trường date/time
               !keyLower.includes('date') &&
               !keyLower.includes('time');
      });
      
      // Lấy giá trị từ key đầu tiên tìm được có giá trị string hợp lệ
      for (const key of statusKeys) {
        const value = partner[key];
        if (value && typeof value === 'string' && value.trim() && 
            value !== 'null' && value !== 'undefined' &&
            value.length > 0 && value.length < 200) { // Giới hạn độ dài để tránh lấy nhầm
          statusText = String(value).trim();
          break;
        }
      }
      
      // Nếu vẫn chưa có, tìm trong TẤT CẢ các giá trị string của partner
      // để tìm giá trị có chứa từ khóa liên quan đến trạng thái giao hàng
      if (!statusText) {
        for (const key of allKeys) {
          const value = partner[key];
          if (value && typeof value === 'string' && value.trim() && 
              value !== 'null' && value !== 'undefined' &&
              value.length > 3 && value.length < 200) {
            const valueLower = value.toLowerCase();
            // Tìm giá trị có chứa từ khóa về trạng thái giao hàng
            if (valueLower.includes('giao') || 
                valueLower.includes('delivery') ||
                valueLower.includes('thành công') ||
                valueLower.includes('thất bại') ||
                valueLower.includes('đang') ||
                valueLower.includes('lấy') ||
                valueLower.includes('hoàn')) {
              statusText = String(value).trim();
              break;
            }
          }
        }
      }
    }
  }
  
  // Nếu không có từ partner, lấy từ order
  if (!statusText) {
    const subStatusName = typeof order.sub_status === 'object' && order.sub_status?.name 
      ? String(order.sub_status.name).trim()
      : (order.sub_status_name ? String(order.sub_status_name).trim() : '');
    
    const orderStatus = order.status_name || order.order_status || order.status;
    statusText = subStatusName || (orderStatus ? String(orderStatus).trim() : '');
  }
  
  // Nếu vẫn không có, trả về "Chưa xác định"
  if (!statusText || statusText === 'null' || statusText === 'undefined' || statusText === '') {
    return { text: 'Chưa xác định', color: 'text-gray-500 dark:text-gray-500', dotColor: 'bg-gray-400' };
  }
  
  const statusLower = statusText.toLowerCase();
  
  // Map các tags/trạng thái - ưu tiên tags từ Pancake (tiếng Việt)
  // Giao không thành / Giao thất bại (Tag từ Pancake)
  if (statusLower.includes('giao không thành') || 
      statusLower.includes('giao thất bại') || 
      statusLower.includes('delivery failed') ||
      statusLower.includes('delivery_failed') ||
      statusLower.includes('failed') ||
      statusLower.includes('không giao được') ||
      statusLower.includes('thất bại') ||
      statusLower.includes('giao hàng thất bại') ||
      statusLower.includes('không giao hàng được') ||
      statusLower.includes('unsuccessful')) {
    return { text: statusText, color: 'text-red-600 dark:text-red-400', dotColor: 'bg-red-500' };
  }
  
  // Đổi hàng (Tag từ Pancake)
  if (statusLower.includes('đổi hàng') || 
      statusLower.includes('exchange')) {
    return { text: statusText, color: 'text-purple-600 dark:text-purple-400', dotColor: 'bg-purple-500' };
  }
  
  // Hẹn gọi (Tag từ Pancake)
  if (statusLower.includes('hẹn gọi') || 
      statusLower.includes('call appointment')) {
    return { text: statusText, color: 'text-yellow-600 dark:text-yellow-400', dotColor: 'bg-yellow-500' };
  }
  
  // Quá ngày giao hàng (Tag từ Pancake)
  if (statusLower.includes('quá ngày giao hàng') || 
      statusLower.includes('overdue')) {
    return { text: statusText, color: 'text-orange-600 dark:text-orange-400', dotColor: 'bg-orange-500' };
  }
  
  // Không nghe máy (Tag từ Pancake)
  if (statusLower.includes('không nghe máy') || 
      statusLower.includes('no answer')) {
    return { text: statusText, color: 'text-pink-600 dark:text-pink-400', dotColor: 'bg-pink-500' };
  }
  
  // Chênh cước vận chuyển (Tag từ Pancake)
  if (statusLower.includes('chênh cước') || 
      statusLower.includes('shipping fee difference')) {
    return { text: statusText, color: 'text-indigo-600 dark:text-indigo-400', dotColor: 'bg-indigo-500' };
  }
  
  // Đang giao hàng / Đang vận chuyển / Out for delivery - Màu xanh dương (blue)
  if (statusLower.includes('đang giao hàng') || 
      statusLower.includes('delivering') ||
      statusLower.includes('out_for_delivery') ||
      statusLower.includes('out for delivery') ||
      statusLower.includes('đang giao') ||
      statusLower.includes('in transit') ||
      statusLower.includes('in_transit') ||
      statusLower.includes('đang vận chuyển') ||
      statusLower.includes('đang đi giao') ||
      statusLower.includes('on delivery') ||
      statusLower.includes('on_delivery')) {
    return { text: 'Đang giao hàng', color: 'text-blue-600 dark:text-blue-400', dotColor: 'bg-blue-500' };
  }
  
  // Không lấy được hàng / Pickup failed
  if (statusLower.includes('không lấy được hàng') || 
      statusLower.includes('không lấy được') ||
      statusLower.includes('could not pick up') ||
      statusLower.includes('pickup failed') ||
      statusLower.includes('pickup_failed') ||
      statusLower.includes('không nhận được hàng')) {
    return { text: 'Không lấy được hàng', color: 'text-green-600 dark:text-green-400', dotColor: 'bg-green-500' };
  }
  
  // Đã giao hàng / Giao thành công / Delivered
  if (statusLower.includes('đã giao hàng') || 
      statusLower.includes('giao thành công') ||
      statusLower.includes('delivered') ||
      statusLower.includes('đã nhận') ||
      statusLower.includes('giao hàng thành công') ||
      statusLower.includes('successfully delivered') ||
      statusLower.includes('success')) {
    return { text: 'Đã giao hàng', color: 'text-blue-600 dark:text-blue-400', dotColor: 'bg-blue-500' };
  }
  
  // Shipped / Đã gửi hàng
  if (statusLower.includes('shipped') ||
      statusLower.includes('đã gửi hàng') ||
      statusLower.includes('đã gửi')) {
    return { text: 'Đã gửi hàng', color: 'text-gray-600 dark:text-gray-400', dotColor: 'bg-gray-500' };
  }
  
  // Đã hoàn / Hoàn hàng / Returned
  if (statusLower.includes('đã hoàn') || 
      statusLower.includes('returned') ||
      statusLower.includes('hoàn hàng') ||
      statusLower.includes('đã hoàn trả')) {
    return { text: 'Đã hoàn', color: 'text-purple-600 dark:text-purple-400', dotColor: 'bg-purple-500' };
  }
  
  // Chờ lấy hàng / Chờ giao / Pending
  if (statusLower.includes('chờ lấy hàng') || 
      statusLower.includes('pending pickup') ||
      statusLower.includes('pending') ||
      statusLower.includes('chờ giao') ||
      statusLower.includes('chờ nhận hàng')) {
    return { text: 'Chờ lấy hàng', color: 'text-yellow-600 dark:text-yellow-400', dotColor: 'bg-yellow-500' };
  }
  
  // Mặc định: hiển thị status text gốc từ partner (có thể là tiếng Anh)
  // Map một số trạng thái tiếng Anh phổ biến
  if (statusLower === 'shipped') {
    return { text: 'Đã gửi hàng', color: 'text-gray-600 dark:text-gray-400', dotColor: 'bg-gray-500' };
  }
  if (statusLower === 'out_for_delivery' || statusLower === 'out for delivery') {
    return { text: 'Đang giao hàng', color: 'text-orange-600 dark:text-orange-400', dotColor: 'bg-orange-500' };
  }
  if (statusLower === 'delivered') {
    return { text: 'Đã giao hàng', color: 'text-blue-600 dark:text-blue-400', dotColor: 'bg-blue-500' };
  }
  
  return { text: statusText, color: 'text-gray-600 dark:text-gray-400', dotColor: 'bg-gray-500' };
}

/**
 * Lấy trạng thái đơn hàng từ Order để hiển thị trong cột "Thẻ"
 * Order.orderStatus đã được lưu từ partner (đơn vị vận chuyển) nên dùng trực tiếp
 * @param order Đơn hàng từ Order type
 * @returns Object chứa text và màu sắc để hiển thị
 */
export function getOrderStatusTagFromOrder(order: Order): { text: string; color: string; dotColor: string } {
  // orderStatus đã được lưu từ partner trong pancakeOrderMapper
  const statusText = order.orderStatus ? String(order.orderStatus).trim() : '';
  
  // Nếu không có, trả về "Chưa xác định"
  if (!statusText || statusText === 'null' || statusText === 'undefined' || statusText === '') {
    return { text: 'Chưa xác định', color: 'text-gray-500 dark:text-gray-500', dotColor: 'bg-gray-400' };
  }
  
  const statusLower = statusText.toLowerCase();
  
  // Map các trạng thái từ đơn vị vận chuyển - giống với getOrderStatusTag
  // Giao không thành / Giao thất bại
  if (statusLower.includes('giao không thành') || 
      statusLower.includes('giao thất bại') || 
      statusLower.includes('delivery failed') ||
      statusLower.includes('không giao được') ||
      statusLower.includes('thất bại') ||
      statusLower.includes('giao hàng thất bại') ||
      statusLower.includes('không giao hàng được')) {
    return { text: statusText, color: 'text-red-600 dark:text-red-400', dotColor: 'bg-red-500' };
  }
  
  // Đang giao hàng / Đang vận chuyển
  if (statusLower.includes('đang giao hàng') || 
      statusLower.includes('delivering') ||
      statusLower.includes('đang giao') ||
      statusLower.includes('in transit') ||
      statusLower.includes('đang vận chuyển') ||
      statusLower.includes('đang đi giao') ||
      statusLower.includes('on delivery')) {
    return { text: statusText, color: 'text-orange-600 dark:text-orange-400', dotColor: 'bg-orange-500' };
  }
  
  // Không lấy được hàng
  if (statusLower.includes('không lấy được hàng') || 
      statusLower.includes('không lấy được') ||
      statusLower.includes('could not pick up') ||
      statusLower.includes('pickup failed') ||
      statusLower.includes('không nhận được hàng')) {
    return { text: statusText, color: 'text-green-600 dark:text-green-400', dotColor: 'bg-green-500' };
  }
  
  // Đã giao hàng / Giao thành công
  if (statusLower.includes('đã giao hàng') || 
      statusLower.includes('giao thành công') ||
      statusLower.includes('delivered') ||
      statusLower.includes('đã nhận') ||
      statusLower.includes('giao hàng thành công') ||
      statusLower.includes('successfully delivered')) {
    return { text: statusText, color: 'text-blue-600 dark:text-blue-400', dotColor: 'bg-blue-500' };
  }
  
  // Đã hoàn / Hoàn hàng
  if (statusLower.includes('đã hoàn') || 
      statusLower.includes('returned') ||
      statusLower.includes('hoàn hàng') ||
      statusLower.includes('đã hoàn trả')) {
    return { text: statusText, color: 'text-purple-600 dark:text-purple-400', dotColor: 'bg-purple-500' };
  }
  
  // Chờ lấy hàng / Chờ giao
  if (statusLower.includes('chờ lấy hàng') || 
      statusLower.includes('pending pickup') ||
      statusLower.includes('chờ giao') ||
      statusLower.includes('chờ nhận hàng')) {
    return { text: statusText, color: 'text-yellow-600 dark:text-yellow-400', dotColor: 'bg-yellow-500' };
  }
  
  // Mặc định: hiển thị status text gốc
  return { text: statusText, color: 'text-gray-600 dark:text-gray-400', dotColor: 'bg-gray-500' };
}
