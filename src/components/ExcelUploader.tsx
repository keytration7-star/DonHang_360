import { useState } from 'react';
import { Upload, FileSpreadsheet, X } from 'lucide-react';
import { parseExcelFile, parseSentOrdersExcel, parseTrackingNumbersExcel } from '../utils/excelParser';
import { useOrderStore } from '../store/orderStore';
import { OrderStatus } from '../types/order';
import { orderService } from '../services/orderService';

interface ExcelUploaderProps {
  type: 'sent' | 'delivered' | 'returned' | 'cancelled';
  onUploadComplete?: () => void;
}

const ExcelUploader = ({ type, onUploadComplete }: ExcelUploaderProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addOrders, updateOrdersStatus, orders, fetchOrders } = useOrderStore();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('Vui lòng chọn file Excel (.xlsx hoặc .xls)');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const rows = await parseExcelFile(file);

      if (type === 'sent') {
        const newOrders = parseSentOrdersExcel(rows);
        if (newOrders.length === 0) {
          setError('Không tìm thấy đơn hàng nào trong file. Vui lòng kiểm tra lại format file Excel.');
          setUploading(false);
          return;
        } else {
          console.log(`📊 Tổng số đơn hàng đã parse: ${newOrders.length}`);
          
          // Kiểm tra đơn trùng trước khi import
          const trackingNumbers = newOrders.map(o => o.trackingNumber);
          const duplicateCheck = await orderService.checkDuplicates(trackingNumbers);
          
          console.log(`🔍 Kiểm tra đơn trùng: ${duplicateCheck.existing.length} đơn đã tồn tại, ${duplicateCheck.new.length} đơn mới`);
          
          // Thông báo nếu có đơn trùng
          if (duplicateCheck.existing.length > 0) {
            const confirmMessage = `Phát hiện ${duplicateCheck.existing.length} đơn hàng đã tồn tại trong hệ thống (mã vận đơn trùng).\n\n` +
              `Bạn có muốn tiếp tục import?\n` +
              `- Các đơn trùng sẽ được cập nhật với dữ liệu mới\n` +
              `- Các đơn mới sẽ được thêm vào\n\n` +
              `Nhấn OK để tiếp tục, Cancel để hủy.`;
            
            const shouldContinue = window.confirm(confirmMessage);
            if (!shouldContinue) {
              setUploading(false);
              setFile(null);
              return;
            }
          }
          
          // Chia nhỏ thành các batch để xử lý không block UI
          const batchSize = 100; // Giảm batch size để đảm bảo không timeout
          let processed = 0;
          let totalSaved = 0;
          let totalUpdated = 0;
          let totalErrors = 0;
          let totalDuplicates = 0;
          const failedBatches: number[] = [];
          
          console.log(`🚀 Bắt đầu nhập ${newOrders.length} đơn hàng (batch size: ${batchSize})...`);
          
          // Xử lý từng batch với retry logic
          for (let i = 0; i < newOrders.length; i += batchSize) {
            const batch = newOrders.slice(i, i + batchSize);
            let retryCount = 0;
            const maxRetries = 3;
            let batchSuccess = false;
            
            while (retryCount < maxRetries && !batchSuccess) {
              try {
                const result = await addOrders(batch);
                totalSaved += result.saved;
                totalUpdated += result.updated;
                totalErrors += result.errors;
                totalDuplicates += result.duplicateCount;
                processed += batch.length;
                batchSuccess = true;
                
                // Log tiến độ
                if (processed % 200 === 0 || processed === newOrders.length) {
                  console.log(`✅ Đã xử lý: ${processed}/${newOrders.length} đơn hàng (${Math.round(processed / newOrders.length * 100)}%)`);
                  console.log(`   - Mới: ${totalSaved}, Cập nhật: ${totalUpdated}, Lỗi: ${totalErrors}`);
                }
              } catch (error) {
                retryCount++;
                console.error(`❌ Lỗi khi xử lý batch ${i}-${i + batch.length} (lần thử ${retryCount}/${maxRetries}):`, error);
                
                if (retryCount >= maxRetries) {
                  totalErrors += batch.length;
                  failedBatches.push(i);
                  console.error(`⚠️ Batch ${i}-${i + batch.length} thất bại sau ${maxRetries} lần thử`);
                } else {
                  // Đợi trước khi retry
                  await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
              }
            }
            
            // Yield để UI không bị block
            if (i + batchSize < newOrders.length) {
              await new Promise(resolve => setTimeout(resolve, 20));
            }
          }
          
          console.log(`📈 Hoàn thành xử lý: ${totalSaved} mới, ${totalUpdated} cập nhật, ${totalErrors} lỗi`);
          
          // Đợi một chút để đảm bảo IndexedDB đã lưu xong
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Fetch lại dữ liệu nhiều lần để đảm bảo lấy đủ
          for (let retry = 0; retry < 3; retry++) {
            await fetchOrders();
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          // Lấy số đơn từ store
          const storeState = useOrderStore.getState();
          const actualCount = storeState.orders.length;
          
          console.log(`📦 Số đơn trong hệ thống sau khi import: ${actualCount}`);
          console.log(`📥 Số đơn đã parse từ Excel: ${newOrders.length}`);
          console.log(`✅ Số đơn mới: ${totalSaved}, Cập nhật: ${totalUpdated}`);
          
          // Hiển thị thông báo chi tiết
          let message = `✅ Đã hoàn thành nhập đơn hàng!\n\n`;
          message += `📊 Thống kê:\n`;
          message += `- Số đơn trong file: ${newOrders.length}\n`;
          message += `- Đơn mới đã thêm: ${totalSaved}\n`;
          message += `- Đơn trùng đã cập nhật: ${totalUpdated}\n`;
          message += `- Tổng số đơn trong hệ thống: ${actualCount}\n`;
          
          if (totalDuplicates > 0) {
            message += `\n🔄 Đã phát hiện và xử lý ${totalDuplicates} đơn hàng trùng (đã cập nhật với dữ liệu mới).`;
          }
          
          if (totalErrors > 0) {
            message += `\n\n⚠️ Cảnh báo: ${totalErrors} đơn hàng không thể lưu.\n`;
            if (failedBatches.length > 0) {
              message += `Các batch bị lỗi: ${failedBatches.map(b => `batch ${b}`).join(', ')}\n`;
            }
            message += `Vui lòng kiểm tra console để biết chi tiết.`;
          }
          
          alert(message);
          
          setFile(null);
          onUploadComplete?.();
        }
      } else {
        const trackingNumbers = parseTrackingNumbersExcel(rows);
        let status: OrderStatus;
        
        if (type === 'delivered') {
          status = OrderStatus.DELIVERED;
        } else if (type === 'returned') {
          status = OrderStatus.RETURNED;
        } else if (type === 'cancelled') {
          status = OrderStatus.CANCELLED;
        } else {
          setError('Loại file không hợp lệ');
          setUploading(false);
          return;
        }
        
        // Cập nhật các đơn hàng có trong danh sách (không phân biệt trạng thái hiện tại)
        const existingTrackingNumbers = trackingNumbers.filter(tn =>
          orders.some(o => o.trackingNumber === tn)
        );
        
        if (existingTrackingNumbers.length > 0) {
          await updateOrdersStatus(existingTrackingNumbers, status);
          // Đảm bảo fetch lại dữ liệu
          await fetchOrders();
          const typeLabel = type === 'delivered' ? 'giao thành công' : type === 'returned' ? 'hoàn' : 'hủy';
          alert(`Đã cập nhật ${existingTrackingNumbers.length} đơn hàng thành ${typeLabel}!`);
        } else {
          setError('Không tìm thấy mã vận đơn nào trong danh sách đơn hàng');
        }
      }

      setFile(null);
      onUploadComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi xử lý file Excel');
    } finally {
      setUploading(false);
    }
  };

  const getTypeLabel = () => {
    switch (type) {
      case 'sent':
        return 'Đơn gửi';
      case 'delivered':
        return 'Đối soát (Giao thành công)';
      case 'returned':
        return 'Đơn hoàn';
      case 'cancelled':
        return 'Đơn hủy';
      default:
        return '';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Nhập file Excel - {getTypeLabel()}</h3>
      
      <div className="space-y-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-400 transition-colors">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            id={`file-input-${type}`}
            disabled={uploading}
          />
          <label
            htmlFor={`file-input-${type}`}
            className="cursor-pointer flex flex-col items-center gap-2"
          >
            <FileSpreadsheet size={48} className="text-gray-400" />
            <span className="text-sm text-gray-600">
              {file ? file.name : 'Chọn file Excel'}
            </span>
          </label>
        </div>

        {file && (
          <div className="flex items-center justify-between bg-gray-50 p-3 rounded">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={20} className="text-primary-600" />
              <span className="text-sm font-medium">{file.name}</span>
            </div>
            <button
              onClick={() => setFile(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Upload size={20} />
          {uploading ? 'Đang xử lý...' : 'Tải lên và xử lý'}
        </button>
      </div>
    </div>
  );
};

export default ExcelUploader;

