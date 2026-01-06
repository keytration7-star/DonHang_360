/**
 * Keyboard Shortcuts Hook
 * Provides keyboard shortcuts for common actions
 */

import { useEffect } from 'react';
import { logger } from '../../shared/utils/logger';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean; // Cmd on Mac
  action: () => void;
  description?: string;
}

/**
 * Hook to register keyboard shortcuts
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      shortcuts.forEach((shortcut) => {
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey : !event.ctrlKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const metaMatch = shortcut.meta ? event.metaKey : !event.metaKey;
        
        // Check if modifier keys match
        if (!ctrlMatch || !shiftMatch || !altMatch || !metaMatch) {
          return;
        }

        // Check if key matches (case insensitive)
        if (event.key.toLowerCase() === shortcut.key.toLowerCase()) {
          event.preventDefault();
          event.stopPropagation();
          
          logger.log(`⌨️ Keyboard shortcut: ${shortcut.description || shortcut.key}`);
          shortcut.action();
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts]);
}

/**
 * Common keyboard shortcuts
 */
export const COMMON_SHORTCUTS = {
  REFRESH: { key: 'r', ctrl: true, description: 'Làm mới dữ liệu' },
  SEARCH: { key: 'f', ctrl: true, description: 'Tìm kiếm' },
  EXPORT: { key: 'e', ctrl: true, description: 'Xuất dữ liệu' },
  CLOSE: { key: 'Escape', description: 'Đóng modal/dialog' },
  COPY: { key: 'c', ctrl: true, description: 'Sao chép' },
  SELECT_ALL: { key: 'a', ctrl: true, description: 'Chọn tất cả' },
};

