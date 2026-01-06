/**
 * Utility để match tracking numbers chính xác và ổn định
 * 
 * Nguyên tắc:
 * 1. Ưu tiên exact match (normalized)
 * 2. Chỉ dùng base match khi thực sự cần thiết và có độ tin cậy cao
 * 3. Tránh match sai do base tracking quá linh hoạt
 */

export interface TrackingMatchResult {
  matched: boolean;
  originalTracking?: string;
  matchType: 'exact' | 'base' | 'none';
  confidence: number; // 0-1, độ tin cậy của match
}

/**
 * Normalize tracking number: trim, lowercase, loại bỏ khoảng trắng
 */
export function normalizeTracking(tracking: string | null | undefined): string {
  if (!tracking) return '';
  return String(tracking).trim().toLowerCase().replace(/\s+/g, '');
}

/**
 * Extract base tracking number (chỉ lấy phần số, bỏ chữ cái)
 * Ví dụ: "802670008263A" -> "802670008263"
 */
export function extractBaseTracking(tracking: string): string {
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
 * Match tracking number với danh sách tracking numbers có sẵn
 * 
 * @param trackingNumber Tracking number cần match
 * @param availableTrackings Map hoặc Set các tracking numbers có sẵn (normalized)
 * @param originalTrackingMap Map từ normalized -> original tracking (để trả về tracking gốc)
 * @param baseTrackingMap Map từ base -> original tracking (để fallback)
 * @returns Kết quả match
 */
export function matchTrackingNumber(
  trackingNumber: string,
  availableTrackings: Set<string> | Map<string, any>,
  originalTrackingMap?: Map<string, string>,
  baseTrackingMap?: Map<string, string>
): TrackingMatchResult {
  const normalized = normalizeTracking(trackingNumber);
  const base = normalizeTracking(extractBaseTracking(trackingNumber));
  
  // 1. Ưu tiên exact match (normalized)
  if (availableTrackings instanceof Set) {
    if (availableTrackings.has(normalized)) {
      const original = originalTrackingMap?.get(normalized) || trackingNumber;
      return {
        matched: true,
        originalTracking: original,
        matchType: 'exact',
        confidence: 1.0
      };
    }
  } else {
    // Map
    if (availableTrackings.has(normalized)) {
      const original = originalTrackingMap?.get(normalized) || trackingNumber;
      return {
        matched: true,
        originalTracking: original,
        matchType: 'exact',
        confidence: 1.0
      };
    }
  }
  
  // 2. Base match (chỉ khi base có độ dài >= 10 và khác với normalized)
  // Điều kiện: base phải đủ dài để tránh match sai
  if (base.length >= 10 && base !== normalized && baseTrackingMap) {
    if (baseTrackingMap.has(base)) {
      const original = baseTrackingMap.get(base)!;
      return {
        matched: true,
        originalTracking: original,
        matchType: 'base',
        confidence: 0.8 // Base match có độ tin cậy thấp hơn
      };
    }
  }
  
  return {
    matched: false,
    matchType: 'none',
    confidence: 0
  };
}

/**
 * Tạo maps từ danh sách orders để match nhanh
 */
export function createTrackingMaps(orders: Array<{ trackingNumber: string }>): {
  normalizedSet: Set<string>;
  originalMap: Map<string, string>;
  baseMap: Map<string, string>;
} {
  const normalizedSet = new Set<string>();
  const originalMap = new Map<string, string>();
  const baseMap = new Map<string, string>();
  
  orders.forEach(order => {
    const normalized = normalizeTracking(order.trackingNumber);
    const base = normalizeTracking(extractBaseTracking(order.trackingNumber));
    
    normalizedSet.add(normalized);
    originalMap.set(normalized, order.trackingNumber);
    
    // Chỉ thêm base nếu khác với normalized và đủ dài
    if (base.length >= 10 && base !== normalized) {
      if (!baseMap.has(base)) {
        baseMap.set(base, order.trackingNumber);
      }
    }
  });
  
  return { normalizedSet, originalMap, baseMap };
}
