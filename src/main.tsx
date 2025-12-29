import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Đảm bảo input hoạt động đúng trong Electron
document.addEventListener('DOMContentLoaded', () => {
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

