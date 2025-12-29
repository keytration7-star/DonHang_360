import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';

// Debug: Log khi app khởi động
console.log('🚀 App đang khởi động...');
console.log('Environment:', import.meta.env.MODE);
console.log('Root element:', document.getElementById('root'));

// Đảm bảo input hoạt động đúng trong Electron
document.addEventListener('DOMContentLoaded', () => {
  console.log('📄 DOM đã load xong');
  // Đảm bảo window có focus khi click vào input
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      // Đảm bảo input nhận focus
      setTimeout(() => {
        (target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).focus();
      }, 0);
    }
  }, true);

  // Xử lý khi window nhận focus
  window.addEventListener('focus', () => {
    // Đảm bảo input đang active vẫn có focus
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT')) {
      (activeElement as HTMLElement).focus();
    }
  });
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('❌ Không tìm thấy root element!');
  throw new Error('Root element không tồn tại');
}

console.log('🎨 Đang render React app...');
try {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
  console.log('✅ React app đã được render');
} catch (error) {
  console.error('❌ Lỗi khi render React app:', error);
  rootElement.innerHTML = `
    <div style="padding: 20px; font-family: Arial;">
      <h1 style="color: red;">Lỗi khởi động ứng dụng</h1>
      <p>${error instanceof Error ? error.message : 'Lỗi không xác định'}</p>
      <pre style="background: #f0f0f0; padding: 10px; overflow: auto;">${error instanceof Error ? error.stack : String(error)}</pre>
    </div>
  `;
}

