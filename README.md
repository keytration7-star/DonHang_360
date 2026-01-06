# Đơn Hàng 360

Ứng dụng quản lý đơn hàng desktop được xây dựng với Electron và React, tích hợp trực tiếp với Pancake POS Open API để quản lý và theo dõi đơn hàng từ nhiều shop.

## ✨ Tính năng chính

### 📊 Tổng quan (Dashboard)
- Thống kê tổng quan: Tổng đơn, Đã nhận, Đã hoàn, Tỉ lệ giao hàng
- Thống kê theo shop: Hiển thị số liệu riêng cho từng shop
- Thống kê theo khu vực: Top khu vực đặt hàng và giao thành công cao
- Cảnh báo đơn hàng: Đơn quá 6-14 ngày (cảnh báo vàng) và trên 15 ngày (cảnh báo đỏ)

### 📦 Đơn hàng API
- Hiển thị đơn hàng từ nhiều shop/API trong 3 tab:
  - **Đã gửi hàng**: Đơn đang trong quá trình vận chuyển
  - **Đã nhận**: Đơn đã giao thành công
  - **Đã hoàn**: Đơn đã hoàn về
- Tìm kiếm toàn cục: Tìm kiếm theo ID, mã vận đơn, tên khách hàng, SĐT, địa chỉ, sản phẩm
- Highlight kết quả tìm kiếm
- Lọc theo shop
- Double-click để copy mã vận đơn và SĐT shipper
- Click vào tên khách hàng để xem chi tiết đơn hàng
- Export dữ liệu: JSON, Excel, CSV
- Keyboard shortcuts: `Ctrl+R` (refresh), `Ctrl+E` (export menu), `Escape` (đóng modal)

### ⚠️ Các đơn cảnh báo
- Hiển thị đơn hàng cần chú ý:
  - Cảnh báo vàng: Đơn quá 6-14 ngày chưa nhận
  - Cảnh báo đỏ: Đơn quá 15 ngày chưa nhận
- Chỉ tính đơn từ tab "Đã gửi hàng" (status = SENT)

### 📈 Báo cáo
- Báo cáo tổng hợp dựa trên dữ liệu API
- Thống kê theo shop và khu vực
- Export báo cáo

### ⚙️ Cài đặt
- **Cấu hình Pancake API**: Quản lý nhiều API keys
  - Thêm, sửa, xóa API config
  - Test kết nối API
  - Set API active
- **Cấu hình Firebase**: (Đang phát triển)
- **Quản lý dữ liệu**: (Đang phát triển)

## 🚀 Cài đặt và Chạy

### Yêu cầu
- Node.js >= 18.x
- npm hoặc yarn

### Cài đặt dependencies
```bash
npm install
```

### Chạy development mode
```bash
npm run electron:dev
```

### Build production
```bash
npm run build
```

## 🏗️ Kiến trúc

### Cấu trúc thư mục
```
src/
├── core/              # Core business logic
│   ├── api/          # API services (Pancake API)
│   ├── cache/        # Caching layer (IndexedDB)
│   ├── services/     # Business services
│   └── store/        # Global state (Zustand)
├── features/          # Feature modules
│   ├── dashboard/    # Dashboard feature
│   ├── orders/       # Orders management
│   ├── reports/      # Reports feature
│   ├── settings/     # Settings feature
│   └── warnings/     # Warnings feature
└── shared/           # Shared utilities
    ├── components/   # Reusable components
    ├── hooks/        # Custom hooks
    ├── types/        # TypeScript types
    └── utils/         # Utility functions
```

### Công nghệ sử dụng
- **Electron**: Desktop app framework
- **React**: UI library
- **TypeScript**: Type safety
- **Zustand**: State management
- **Axios**: HTTP client
- **IndexedDB**: Local caching
- **TailwindCSS**: Styling
- **Lucide React**: Icons

## 📡 API Integration

App tích hợp với **Pancake POS Open API** để lấy dữ liệu đơn hàng:
- Hỗ trợ nhiều API keys (multi-shop)
- Tự động phát hiện endpoint hoạt động
- Pagination tự động
- Caching để tăng hiệu suất
- Incremental updates để tránh reload toàn bộ dữ liệu

### Cấu hình API
1. Vào tab **Cài đặt** → **Cấu hình Pancake API**
2. Thêm API key từ Pancake: Setting → Advance → Third-party connection → Webhook/API
3. Test kết nối và set active

## 🎯 Roadmap

Xem [TECHNOLOGY_ROADMAP.md](./TECHNOLOGY_ROADMAP.md) để biết các tính năng đang phát triển:
- Quản lý đơn hoàn
- Tích hợp thanh toán tự động
- Mobile app (scan mã vận đơn)
- Tích hợp trình duyệt web
- AI Assistant

## 📝 License

MIT
