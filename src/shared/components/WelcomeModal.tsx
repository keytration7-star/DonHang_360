import { useState } from 'react';
import { CheckCircle, Shield, Cloud, Phone, Copyright, AlertTriangle } from 'lucide-react';

interface WelcomeModalProps {
  onAccept: () => void;
}

const WelcomeModal = ({ onAccept }: WelcomeModalProps) => {
  const [showFullTerms, setShowFullTerms] = useState(false);
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 dark:from-primary-700 dark:to-primary-800 text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white bg-opacity-20 p-2 rounded-lg">
                <CheckCircle size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Chào mừng đến với Đơn Hàng 360</h2>
                <p className="text-primary-100 text-sm mt-1">Phiên bản nội bộ - Quản lý đơn hàng chuyên nghiệp</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Giới thiệu tính năng */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 dark:border-blue-400 p-4 rounded">
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
              <CheckCircle size={20} className="text-blue-600 dark:text-blue-400" />
              Tính năng chính của ứng dụng:
            </h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-blue-800 dark:text-blue-300 ml-6">
              <li>Quản lý đơn hàng toàn diện: Nhập đơn gửi, đối soát, đơn hoàn</li>
              <li>Đồng bộ dữ liệu đám mây giữa các máy tính</li>
              <li>Báo cáo và thống kê chi tiết</li>
              <li>Cảnh báo đơn hàng quá hạn</li>
              <li>Tự động cập nhật phiên bản mới</li>
            </ul>
          </div>

          {/* Thông báo phiên bản nội bộ */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 dark:border-yellow-400 p-4 rounded">
            <h3 className="font-semibold text-yellow-900 dark:text-yellow-300 mb-2 flex items-center gap-2">
              <AlertTriangle size={20} className="text-yellow-600 dark:text-yellow-400" />
              Thông báo quan trọng:
            </h3>
            <div className="text-sm text-yellow-800 dark:text-yellow-300 space-y-2">
              <p>• <strong>Đây là phiên bản nội bộ</strong> - Chỉ dành cho sử dụng nội bộ</p>
              <p>• <strong>Chỉ quản trị viên</strong> mới có thể cập nhật ứng dụng</p>
              <p>• <strong>Gói đồng bộ đám mây</strong> giúp đồng bộ dữ liệu giữa các máy tính được cấp phép</p>
            </div>
          </div>

          {/* Thông tin bản quyền và hỗ trợ */}
          <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 p-4 rounded">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Copyright size={20} className="text-gray-600 dark:text-gray-400 mt-1" />
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">Bản quyền</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Thuộc về: <strong>DucAnh</strong></p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone size={20} className="text-gray-600 dark:text-gray-400 mt-1" />
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">Hỗ trợ kỹ thuật</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Hotline: <strong className="text-primary-600 dark:text-primary-400">09368.333.19</strong></p>
                </div>
              </div>
            </div>
          </div>

          {/* Điều khoản dịch vụ */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Shield size={20} className="text-primary-600 dark:text-primary-400" />
              Điều khoản dịch vụ và cam kết
            </h3>
            
            {!showFullTerms ? (
              <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <p>Bằng việc sử dụng ứng dụng này, bạn đồng ý với các điều khoản sau:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Ứng dụng không thu thập hoặc lấy dữ liệu cá nhân của người dùng</li>
                  <li>Đảm bảo bảo mật dữ liệu cá nhân và thông tin đơn hàng</li>
                  <li>Chịu trách nhiệm hoàn toàn khi sử dụng ứng dụng trong mục đích xấu</li>
                  <li>Không được tìm cách bẻ khóa hoặc sao chép ứng dụng dưới mọi hình thức</li>
                </ul>
                <button
                  onClick={() => setShowFullTerms(true)}
                  className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm font-medium mt-2"
                >
                  Xem chi tiết điều khoản →
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300 max-h-60 overflow-y-auto">
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">1. Bảo mật dữ liệu</h4>
                  <p className="ml-4">
                    Ứng dụng Đơn Hàng 360 cam kết không thu thập, lưu trữ hoặc chia sẻ bất kỳ dữ liệu cá nhân nào của người dùng. 
                    Tất cả dữ liệu được lưu trữ cục bộ trên máy tính của bạn hoặc trên dịch vụ đám mây mà bạn tự cấu hình (Firebase).
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">2. Trách nhiệm sử dụng</h4>
                  <p className="ml-4">
                    Người dùng chịu trách nhiệm hoàn toàn về việc sử dụng ứng dụng. Bạn cam kết không sử dụng ứng dụng 
                    cho bất kỳ mục đích bất hợp pháp, gian lận, hoặc vi phạm pháp luật nào. Bạn sẽ chịu trách nhiệm pháp lý 
                    đầy đủ nếu vi phạm các quy định này.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">3. Bảo vệ bản quyền</h4>
                  <p className="ml-4">
                    Ứng dụng này là tài sản độc quyền của DucAnh. Bạn không được phép:
                  </p>
                  <ul className="list-disc list-inside ml-8 space-y-1">
                    <li>Bẻ khóa, reverse engineer, hoặc phân tích mã nguồn của ứng dụng</li>
                    <li>Sao chép, phân phối, hoặc chia sẻ ứng dụng dưới bất kỳ hình thức nào</li>
                    <li>Tạo các bản sao hoặc biến thể của ứng dụng</li>
                    <li>Sử dụng ứng dụng cho mục đích thương mại mà không có sự cho phép</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">4. Đồng bộ đám mây</h4>
                  <p className="ml-4">
                    Tính năng đồng bộ đám mây sử dụng dịch vụ Firebase mà bạn tự cấu hình. Bạn chịu trách nhiệm về 
                    cấu hình và bảo mật tài khoản Firebase của mình. Ứng dụng không lưu trữ hoặc truy cập thông tin đăng nhập Firebase của bạn.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">5. Cập nhật và hỗ trợ</h4>
                  <p className="ml-4">
                    Chỉ quản trị viên được ủy quyền mới có thể cập nhật ứng dụng. Nếu bạn gặp vấn đề kỹ thuật, 
                    vui lòng liên hệ hotline hỗ trợ: <strong>09368.333.19</strong>
                  </p>
                </div>

                <button
                  onClick={() => setShowFullTerms(false)}
                  className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm font-medium mt-2"
                >
                  ← Thu gọn
                </button>
              </div>
            )}

            {/* Checkbox đồng ý */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-1 w-5 h-5 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500 dark:bg-gray-700 dark:checked:bg-primary-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Tôi đã đọc và <strong className="text-gray-900 dark:text-gray-100">đồng ý</strong> với tất cả các điều khoản dịch vụ trên. 
                  Tôi hiểu rằng vi phạm các điều khoản này có thể dẫn đến hậu quả pháp lý.
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-4 rounded-b-lg flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Cloud size={16} />
            <span>Đồng bộ đám mây giữa các máy được cấp phép</span>
          </div>
          <button
            onClick={onAccept}
            disabled={!accepted}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              accepted
                ? 'bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            Đồng ý và tiếp tục
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;

