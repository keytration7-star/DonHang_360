import * as XLSX from 'xlsx';
import { Order, OrderStatus } from '../types/order';

export interface ExcelRow {
  [key: string]: any;
}

export function parseExcelFile(file: File): Promise<ExcelRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Đảm bảo parse tất cả dòng, không giới hạn
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          defval: '', // Giá trị mặc định cho ô trống
          raw: false, // Parse tất cả dữ liệu
        });
        
        console.log(`📄 Đã đọc ${jsonData.length} dòng từ file Excel`);
        
        resolve(jsonData as ExcelRow[]);
      } catch (error) {
        console.error('Lỗi parse Excel:', error);
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Lỗi đọc file'));
    reader.readAsArrayBuffer(file);
  });
}

export function parseSentOrdersExcel(rows: ExcelRow[]): Order[] {
  const orders: Order[] = [];
  const now = new Date().toISOString();

  rows.forEach((row, index) => {
    // Tự động nhận diện các cột có thể có - hỗ trợ nhiều tên cột khác nhau
    const trackingNumber = 
      row['Mã vận đơn'] || row['Mã VĐ'] || row['Mã vận đơn'] || 
      row['Tracking'] || row['Mã'] || row['Mã đơn'] || '';
    
    // Ngày gửi - ưu tiên "Thời gian tạo đơn", sau đó "Thời gian lấy hàng", cuối cùng là "Ngày gửi"
    const sendDate = 
      row['Thời gian tạo đơn'] || row['Thời gian lấy hàng'] || 
      row['Ngày gửi'] || row['Ngày'] || row['Date'] || '';
    
    // COD - ưu tiên "Tiền thu hộ COD", sau đó "COD thực thu", "Giao một phần COD"
    const cod = parseFloat(
      row['Tiền thu hộ COD'] || row['COD thực thu'] || row['Giao một phần COD'] ||
      row['COD'] || row['Tiền COD'] || row['Cod'] || '0'
    ) || 0;
    
    // Cước phí
    const shippingFee = parseFloat(
      row['Cước phí'] || row['Cước'] || 
      row['Phí vận chuyển'] || row['Shipping'] || '0'
    ) || 0;
    
    // Tên khách hàng - ưu tiên "Tên người nhận"
    const customerName = 
      row['Tên người nhận'] || row['Tên KH'] || 
      row['Khách hàng'] || row['Customer'] || row['Tên'] || '';
    
    // SĐT khách hàng - ưu tiên "SĐT người nhận"
    const customerPhone = String(
      row['SĐT người nhận'] || row['SĐT'] || 
      row['Số điện thoại'] || row['Phone'] || row['SDT'] || ''
    );
    
    // Địa chỉ khách hàng - ưu tiên "Địa chỉ người nhận"
    const customerAddress = 
      row['Địa chỉ người nhận'] || row['Địa chỉ'] || 
      row['Address'] || row['Địa chỉ KH'] || '';

    if (trackingNumber) {
      // Xử lý ngày gửi - nếu có format ngày, chuyển đổi sang format chuẩn
      let processedSendDate = sendDate;
      if (sendDate) {
        // Xử lý các format ngày khác nhau
        const dateStr = String(sendDate).trim();
        
        // Nếu là Date object, chuyển sang string
        if (dateStr.includes('T') || dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Format ISO hoặc YYYY-MM-DD
          const dateMatch = dateStr.match(/(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            processedSendDate = dateMatch[1];
          }
        } else if (dateStr.includes('/')) {
          // Xử lý format có dấu / (DD/MM/YYYY hoặc MM/DD/YYYY)
          const parts = dateStr.split('/');
          if (parts.length >= 3) {
            // Giả sử format là DD/MM/YYYY
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2].substring(0, 4); // Lấy 4 số đầu của năm
            processedSendDate = `${year}-${month}-${day}`;
          }
        } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}\d/)) {
          // Format như "2025-11-301" - lấy 10 ký tự đầu
          processedSendDate = dateStr.substring(0, 10);
        } else {
          // Thử parse như Date object
          try {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              processedSendDate = date.toISOString().split('T')[0];
            }
          } catch {
            // Nếu không parse được, dùng ngày hiện tại
            processedSendDate = new Date().toISOString().split('T')[0];
          }
        }
      } else {
        processedSendDate = new Date().toISOString().split('T')[0];
      }

      // Xử lý ngày lấy hàng
      const pickupDateRaw = row['Thời gian lấy hàng'] || '';
      let processedPickupDate = '';
      if (pickupDateRaw) {
        const pickupDateStr = String(pickupDateRaw).trim();
        const dateMatch = pickupDateStr.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          processedPickupDate = dateMatch[1];
        } else if (pickupDateStr.includes('/')) {
          const parts = pickupDateStr.split('/');
          if (parts.length >= 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2].substring(0, 4);
            processedPickupDate = `${year}-${month}-${day}`;
          }
        } else {
          try {
            const date = new Date(pickupDateStr);
            if (!isNaN(date.getTime())) {
              processedPickupDate = date.toISOString().split('T')[0];
            }
          } catch {
            // Ignore
          }
        }
      }

      // Lấy các thông tin bổ sung
      const orderStatus = row['Trạng thái vận đơn'] || '';
      const administrativeAddress = row['Địa chỉ hành chính'] || '';
      const goodsContent = row['Nội dung hàng hóa'] || '';
      const goodsType = row['Loại hàng'] || '';
      const chargeableWeight = parseFloat(row['Trọng lượng tính phí'] || '0') || 0;
      const actualCod = parseFloat(row['COD thực thu'] || '0') || 0;
      const partialDelivery = parseFloat(row['Giao một phần'] || '0') || 0;
      const paymentMethod = row['Phương thức kết toán'] || '';
      const senderName = row['Tên người gửi'] || '';
      const senderPhone = row['Số điện thoại di động của người gửi hàng'] || '';
      const senderAddress = row['Địa chỉ người gửi'] || '';

      // Lưu tất cả dữ liệu gốc không được map
      const rawData: Record<string, any> = {};
      Object.keys(row).forEach(key => {
        // Chỉ lưu các cột không được map vào các trường chính
        const mappedKeys = [
          'Mã vận đơn', 'Mã VĐ', 'Tracking', 'Mã', 'Mã đơn',
          'Thời gian tạo đơn', 'Thời gian lấy hàng', 'Ngày gửi', 'Ngày', 'Date',
          'Tiền thu hộ COD', 'COD thực thu', 'Giao một phần COD', 'COD', 'Tiền COD', 'Cod', 'Giao một phần',
          'Cước phí', 'Cước', 'Phí vận chuyển', 'Shipping',
          'Tên người nhận', 'Tên KH', 'Khách hàng', 'Customer', 'Tên',
          'SĐT người nhận', 'SĐT', 'Số điện thoại', 'Phone', 'SDT',
          'Địa chỉ người nhận', 'Địa chỉ', 'Address', 'Địa chỉ KH',
          'Trạng thái vận đơn',
          'Địa chỉ hành chính',
          'Nội dung hàng hóa',
          'Loại hàng',
          'Trọng lượng tính phí',
          'Phương thức kết toán',
          'Tên người gửi',
          'Số điện thoại di động của người gửi hàng',
          'Địa chỉ người gửi'
        ];
        if (!mappedKeys.includes(key)) {
          rawData[key] = row[key];
        }
      });

      const order: Order = {
        id: `${Date.now()}-${index}`,
        // Thông tin cơ bản
        trackingNumber: String(trackingNumber).trim(),
        orderStatus: String(orderStatus).trim() || undefined,
        sendDate: processedSendDate,
        pickupDate: processedPickupDate || undefined,
        status: OrderStatus.SENT,
        
        // Thông tin người nhận
        customerName: String(customerName).trim(),
        customerPhone: String(customerPhone).trim(),
        customerAddress: String(customerAddress).trim(),
        administrativeAddress: String(administrativeAddress).trim() || undefined,
        
        // Thông tin người gửi
        senderName: String(senderName).trim() || undefined,
        senderPhone: String(senderPhone).trim() || undefined,
        senderAddress: String(senderAddress).trim() || undefined,
        
        // Thông tin hàng hóa
        goodsContent: String(goodsContent).trim() || undefined,
        goodsType: String(goodsType).trim() || undefined,
        chargeableWeight: chargeableWeight || undefined,
        
        // Thông tin tài chính
        cod,
        actualCod: actualCod || undefined,
        partialDelivery: partialDelivery || undefined,
        shippingFee,
        paymentMethod: String(paymentMethod).trim() || undefined,
        
        // Thông tin bổ sung
        region: extractRegion(customerAddress),
        createdAt: now,
        updatedAt: now,
        
        // Lưu dữ liệu gốc
        rawData: Object.keys(rawData).length > 0 ? rawData : undefined,
      };
      orders.push(order);
    }
  });

  console.log(`✅ Đã parse thành công ${orders.length} đơn hàng từ ${rows.length} dòng Excel`);
  
  if (orders.length < rows.length) {
    console.warn(`⚠️ Cảnh báo: Chỉ parse được ${orders.length}/${rows.length} đơn hàng. Có thể một số dòng thiếu mã vận đơn.`);
  }

  return orders;
}

export function parseTrackingNumbersExcel(rows: ExcelRow[]): string[] {
  const trackingNumbers: string[] = [];

  rows.forEach((row) => {
    // Tự động nhận diện cột mã vận đơn
    const trackingNumber = row['Mã vận đơn'] || row['Mã VĐ'] || row['Tracking'] || row['Mã'] || row[Object.keys(row)[0]] || '';
    if (trackingNumber) {
      trackingNumbers.push(String(trackingNumber).trim());
    }
  });

  return trackingNumbers.filter(tn => tn.length > 0);
}

import { extractRegion } from './regionExtractor';

