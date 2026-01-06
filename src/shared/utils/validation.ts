/**
 * Validation utilities cho ứng dụng Đơn Hàng 360
 * Cung cấp các hàm validation cho tracking number, COD, dates, etc.
 */

/**
 * Validate tracking number format
 * Tracking number có thể là số hoặc số + suffix (VD: 802662729898 hoặc 802662729898-A)
 */
export function validateTrackingNumber(trackingNumber: string | null | undefined): boolean {
  if (!trackingNumber) return false;
  const trimmed = String(trackingNumber).trim();
  if (trimmed.length === 0) return false;
  
  // Tracking number phải có ít nhất 6 ký tự (số)
  // Có thể có format: số hoặc số-suffix hoặc số+suffix
  const trackingPattern = /^\d{6,}([-A-Za-z0-9]*)?$/;
  return trackingPattern.test(trimmed);
}

/**
 * Normalize tracking number (loại bỏ khoảng trắng, chuyển về lowercase)
 */
export function normalizeTrackingNumber(trackingNumber: string | null | undefined): string {
  if (!trackingNumber) return '';
  return String(trackingNumber).trim().toLowerCase();
}

/**
 * Validate COD value
 * COD phải là số >= 0 và không phải NaN
 */
export function validateCod(cod: number | null | undefined): boolean {
  if (cod === null || cod === undefined) return false;
  if (typeof cod !== 'number') return false;
  if (isNaN(cod)) return false;
  return cod >= 0;
}

/**
 * Validate date string (ISO format)
 */
export function validateDate(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Validate phone number (Vietnamese format)
 * Chấp nhận: 10-11 số, có thể có dấu cách hoặc dấu gạch ngang
 */
export function validatePhoneNumber(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const cleaned = String(phone).replace(/[\s-]/g, '');
  const phonePattern = /^(0|\+84)[0-9]{9,10}$/;
  return phonePattern.test(cleaned);
}

/**
 * Validate Order object
 * Kiểm tra các trường bắt buộc và format
 */
export function validateOrder(order: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!order) {
    return { valid: false, errors: ['Order object is required'] };
  }
  
  // Validate tracking number
  if (!validateTrackingNumber(order.trackingNumber)) {
    errors.push(`Invalid tracking number: ${order.trackingNumber}`);
  }
  
  // Validate COD
  if (!validateCod(order.cod)) {
    errors.push(`Invalid COD: ${order.cod}`);
  }
  
  // Validate shipping fee
  if (order.shippingFee !== undefined && !validateCod(order.shippingFee)) {
    errors.push(`Invalid shipping fee: ${order.shippingFee}`);
  }
  
  // Validate actualCod (nếu có)
  if (order.actualCod !== undefined && !validateCod(order.actualCod)) {
    errors.push(`Invalid actualCod: ${order.actualCod}`);
  }
  
  // Validate returnedCod (nếu có)
  if (order.returnedCod !== undefined && !validateCod(order.returnedCod)) {
    errors.push(`Invalid returnedCod: ${order.returnedCod}`);
  }
  
  // Validate dates
  if (!validateDate(order.sendDate)) {
    errors.push(`Invalid sendDate: ${order.sendDate}`);
  }
  
  if (order.createdAt && !validateDate(order.createdAt)) {
    errors.push(`Invalid createdAt: ${order.createdAt}`);
  }
  
  if (order.updatedAt && !validateDate(order.updatedAt)) {
    errors.push(`Invalid updatedAt: ${order.updatedAt}`);
  }
  
  // Validate status
  const validStatuses = ['sent', 'delivered', 'returned', 'pending', 'cancelled'];
  if (!order.status || !validStatuses.includes(String(order.status).toLowerCase())) {
    errors.push(`Invalid status: ${order.status}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize COD value (đảm bảo là số hợp lệ >= 0)
 */
export function sanitizeCod(cod: any): number {
  if (cod === null || cod === undefined) return 0;
  const num = Number(cod);
  if (isNaN(num)) return 0;
  return Math.max(0, num);
}

/**
 * Sanitize date string (đảm bảo là ISO format hợp lệ)
 */
export function sanitizeDate(dateString: any): string {
  if (!dateString) return new Date().toISOString();
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}
