import { useEffect, RefObject } from 'react';

/**
 * Hook để tự động focus input khi component mount hoặc khi điều kiện thay đổi
 * Đặc biệt hữu ích cho Electron apps nơi autoFocus có thể không hoạt động đúng
 */
export const useAutoFocus = (
  ref: RefObject<HTMLInputElement | HTMLTextAreaElement>,
  condition: boolean = true,
  delay: number = 150
) => {
  useEffect(() => {
    if (!condition || !ref.current) return;

    const focusInput = () => {
      if (ref.current) {
        try {
          ref.current.focus();
          // Chỉ select nếu là input (không phải textarea)
          if (ref.current instanceof HTMLInputElement) {
            ref.current.select();
          }
          // Kiểm tra xem có focus được không
          if (document.activeElement !== ref.current) {
            // Thử lại với requestAnimationFrame
            requestAnimationFrame(() => {
              if (ref.current) {
                ref.current.focus();
                if (ref.current instanceof HTMLInputElement) {
                  ref.current.select();
                }
              }
            });
          }
        } catch (e) {
          console.warn('Focus error:', e);
        }
      }
    };

    // Sử dụng requestAnimationFrame để đảm bảo DOM đã render
    let timer1: NodeJS.Timeout;
    let timer2: NodeJS.Timeout;
    
    requestAnimationFrame(() => {
      focusInput();
      // Thử lại sau delay
      timer1 = setTimeout(focusInput, delay);
      // Thử lại sau delay * 2 (cho Electron)
      timer2 = setTimeout(focusInput, delay * 2);
    });
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [ref, condition, delay]);
};
