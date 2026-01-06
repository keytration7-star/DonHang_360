import { Toast, ToastType } from '../components/Toast';

/**
 * Show a toast notification
 */
export function showToast(message: string, type: ToastType = 'info', duration?: number) {
  const event = new CustomEvent<Omit<Toast, 'id'>>('show-toast', {
    detail: { message, type, duration },
  });
  window.dispatchEvent(event);
}

/**
 * Helper functions for different toast types
 */
export const toast = {
  success: (message: string, duration?: number) => showToast(message, 'success', duration),
  error: (message: string, duration?: number) => showToast(message, 'error', duration ?? 5000),
  warning: (message: string, duration?: number) => showToast(message, 'warning', duration),
  info: (message: string, duration?: number) => showToast(message, 'info', duration),
};

