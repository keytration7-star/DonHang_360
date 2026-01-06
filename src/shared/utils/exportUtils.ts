/**
 * Export Utilities - Export data to Excel/CSV
 */

import * as XLSX from 'xlsx';
import { PancakeOrder } from '../../shared/types/pancakeApi';
import { Order } from '../../shared/types/order';
import { formatCurrency } from './orderUtils';
import { logger } from './logger';
import { showToast } from './toast';

/**
 * Export orders to Excel file
 */
export function exportOrdersToExcel(
  orders: PancakeOrder[] | Order[],
  filename: string = 'don-hang'
): void {
  try {
    if (orders.length === 0) {
      showToast('Không có dữ liệu để xuất', 'warning');
      return;
    }

    // Convert orders to Excel format
    const excelData = orders.map((order: any) => {
      const partner = order.partner || {};
      const shippingAddress = order.shipping_address || {};
      
      return {
        'ID': order.id || order.code || order.order_id || '',
        'Mã đơn': order.code || '',
        'Ngày đẩy đơn sang ĐVVC': order.partner_inserted_at || 
                                  partner.picked_up_at || 
                                  order.inserted_at || 
                                  '',
        'Mã vận đơn': partner.extend_code || 
                     (partner.extend_update && partner.extend_update.length > 0 
                       ? partner.extend_update[partner.extend_update.length - 1].tracking_id 
                       : '') || 
                     partner.tracking_id || 
                     '',
        'VC': partner.partner_name || 
              partner.partner_name_en || 
              '',
        'SĐT shipper': partner.shipper_phone || 
                     partner.phone || 
                     '',
        'ĐVVC giao lần đầu': partner.partner_name || 
                           partner.partner_name_en || 
                           '',
        'Khách hàng': order.bill_full_name || 
                     order.customer_name || 
                     order.receiver_name || 
                     '',
        'SĐT': order.bill_phone_number || 
              order.customer_phone || 
              order.receiver_phone || 
              '',
        'Nhận hàng': shippingAddress.full_address || 
                   order.shipping_address || 
                   order.delivery_address || 
                   '',
        'Sản phẩm': order.items?.map((item: any) => 
          item.variation_info?.name || 
          item.product_name || 
          item.name || 
          ''
        ).join(', ') || '',
        'COD': order.cod || 0,
        'Cước': order.shipping_fee || order.fee || 0,
        'Ghi chú nội bộ': order.internal_note || 
                        order.note || 
                        '',
        'Ghi chú để in': order.print_note || 
                       order.note || 
                       '',
        'Trạng thái': order.status_name || 
                    order.status || 
                    '',
        'Ngày tạo': order.created_at || 
                  order.inserted_at || 
                  '',
        'Ngày cập nhật': order.updated_at || 
                       order.updated_at || 
                       '',
      };
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    const colWidths = [
      { wch: 10 }, // ID
      { wch: 15 }, // Mã đơn
      { wch: 20 }, // Ngày đẩy đơn
      { wch: 20 }, // Mã vận đơn
      { wch: 15 }, // VC
      { wch: 15 }, // SĐT shipper
      { wch: 20 }, // ĐVVC giao lần đầu
      { wch: 25 }, // Khách hàng
      { wch: 15 }, // SĐT
      { wch: 40 }, // Nhận hàng
      { wch: 30 }, // Sản phẩm
      { wch: 12 }, // COD
      { wch: 12 }, // Cước
      { wch: 30 }, // Ghi chú nội bộ
      { wch: 30 }, // Ghi chú để in
      { wch: 15 }, // Trạng thái
      { wch: 20 }, // Ngày tạo
      { wch: 20 }, // Ngày cập nhật
    ];
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Đơn hàng');

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const fullFilename = `${filename}-${timestamp}.xlsx`;

    // Write file
    XLSX.writeFile(wb, fullFilename);

    showToast(`Đã xuất ${orders.length} đơn hàng ra file ${fullFilename}`, 'success');
    logger.log(`✅ Đã xuất ${orders.length} đơn hàng ra Excel: ${fullFilename}`);
  } catch (error) {
    logger.error('❌ Lỗi xuất Excel:', error);
    showToast('Lỗi xuất file Excel. Vui lòng thử lại.', 'error');
  }
}

/**
 * Export orders to CSV file
 */
export function exportOrdersToCSV(
  orders: PancakeOrder[] | Order[],
  filename: string = 'don-hang'
): void {
  try {
    if (orders.length === 0) {
      showToast('Không có dữ liệu để xuất', 'warning');
      return;
    }

    // Convert orders to CSV format
    const csvRows: string[] = [];
    
    // Header row
    const headers = [
      'ID', 'Mã đơn', 'Ngày đẩy đơn sang ĐVVC', 'Mã vận đơn', 'VC', 
      'SĐT shipper', 'ĐVVC giao lần đầu', 'Khách hàng', 'SĐT', 
      'Nhận hàng', 'Sản phẩm', 'COD', 'Cước', 
      'Ghi chú nội bộ', 'Ghi chú để in', 'Trạng thái', 
      'Ngày tạo', 'Ngày cập nhật'
    ];
    csvRows.push(headers.join(','));

    // Data rows
    orders.forEach((order: any) => {
      const partner = order.partner || {};
      const shippingAddress = order.shipping_address || {};
      
      const row = [
        order.id || order.code || order.order_id || '',
        order.code || '',
        order.partner_inserted_at || partner.picked_up_at || order.inserted_at || '',
        partner.extend_code || (partner.extend_update && partner.extend_update.length > 0 ? partner.extend_update[partner.extend_update.length - 1].tracking_id : '') || partner.tracking_id || '',
        partner.partner_name || partner.partner_name_en || '',
        partner.shipper_phone || partner.phone || '',
        partner.partner_name || partner.partner_name_en || '',
        order.bill_full_name || order.customer_name || order.receiver_name || '',
        order.bill_phone_number || order.customer_phone || order.receiver_phone || '',
        `"${(shippingAddress.full_address || order.shipping_address || order.delivery_address || '').replace(/"/g, '""')}"`,
        `"${(order.items?.map((item: any) => item.variation_info?.name || item.product_name || item.name || '').join(', ') || '').replace(/"/g, '""')}"`,
        order.cod || 0,
        order.shipping_fee || order.fee || 0,
        `"${(order.internal_note || order.note || '').replace(/"/g, '""')}"`,
        `"${(order.print_note || order.note || '').replace(/"/g, '""')}"`,
        order.status_name || order.status || '',
        order.created_at || order.inserted_at || '',
        order.updated_at || order.updated_at || '',
      ];
      csvRows.push(row.join(','));
    });

    // Create CSV content
    const csvContent = csvRows.join('\n');
    
    // Create blob and download
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel UTF-8
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const fullFilename = `${filename}-${timestamp}.csv`;
    
    link.href = URL.createObjectURL(blob);
    link.download = fullFilename;
    link.click();
    
    URL.revokeObjectURL(link.href);

    showToast(`Đã xuất ${orders.length} đơn hàng ra file ${fullFilename}`, 'success');
    logger.log(`✅ Đã xuất ${orders.length} đơn hàng ra CSV: ${fullFilename}`);
  } catch (error) {
    logger.error('❌ Lỗi xuất CSV:', error);
    showToast('Lỗi xuất file CSV. Vui lòng thử lại.', 'error');
  }
}

/**
 * Export statistics to Excel
 */
export function exportStatsToExcel(
  stats: any,
  filename: string = 'thong-ke'
): void {
  try {
    const wb = XLSX.utils.book_new();
    
    // Add each sheet
    Object.keys(stats).forEach((sheetName) => {
      const data = stats[sheetName];
      if (Array.isArray(data) && data.length > 0) {
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }
    });

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const fullFilename = `${filename}-${timestamp}.xlsx`;
    XLSX.writeFile(wb, fullFilename);

    showToast(`Đã xuất thống kê ra file ${fullFilename}`, 'success');
  } catch (error) {
    logger.error('❌ Lỗi xuất thống kê:', error);
    showToast('Lỗi xuất file thống kê. Vui lòng thử lại.', 'error');
  }
}

