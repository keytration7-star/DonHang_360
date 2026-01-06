import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';;
import ErrorBoundary from './shared/components/ErrorBoundary';

// Đảm bảo input hoạt động đúng trong Electron
document.addEventListener('DOMContentLoaded', () => {
  
  // Đảm bảo window có focus khi click vào input
  document.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      // Đảm bảo input nhận focus ngay lập tức
      (target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).focus();
    }
  }, true);
  
  // Xử lý khi click vào input (sau mousedown)
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      // Đảm bảo input nhận focus
      setTimeout(() => {
        (target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).focus();
        // Đảm bảo có thể nhập text
        (target as HTMLInputElement | HTMLTextAreaElement).select?.();
      }, 10);
    }
  }, true);

  // Xử lý khi window nhận focus
  window.addEventListener('focus', () => {
    // Đảm bảo input đang active vẫn có focus
    setTimeout(() => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
        (activeEl as HTMLElement).focus();
      }
    }, 10);
  });
  
  // Xử lý khi keydown - đảm bảo input có thể nhận keyboard input
  document.addEventListener('keydown', (e) => {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      // Cho phép tất cả keyboard input
      e.stopPropagation();
    }
  }, true);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  // Root element not found
  throw new Error('Root element không tồn tại');
}

try {
  // Tắt StrictMode trong production để tránh lỗi React #300
  // StrictMode có thể gây ra double rendering và lỗi trong production build
  const isDevelopment = import.meta.env.MODE === 'development';
  
  const appContent = (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
  
  if (isDevelopment) {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        {appContent}
      </React.StrictMode>
    );
  } else {
    ReactDOM.createRoot(rootElement).render(appContent);
  }
} catch (error) {
  // Error rendering app
  rootElement.innerHTML = `
    <div style="padding: 20px; font-family: Arial;">
      <h1 style="color: red;">Lỗi khởi động ứng dụng</h1>
      <p>${error instanceof Error ? error.message : 'Lỗi không xác định'}</p>
      <pre style="background: #f0f0f0; padding: 10px; overflow: auto;">${error instanceof Error ? error.stack : String(error)}</pre>
    </div>
  `;
}

