/**
 * Virtualized Table Component - Hiển thị danh sách lớn với virtual scrolling
 * Sử dụng react-window để tối ưu performance khi render nhiều rows
 */

// Virtual scrolling temporarily disabled - react-window not installed
import { ReactNode } from 'react';

interface VirtualizedTableProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight?: number;
  renderRow: (item: T, index: number) => ReactNode;
  emptyMessage?: string;
}

/**
 * Virtualized Table Component
 * @template T Type của items trong danh sách
 */
export function VirtualizedTable<T>({
  items,
  itemHeight,
  containerHeight = 600,
  renderRow,
  emptyMessage = 'Không có dữ liệu'
}: VirtualizedTableProps<T>) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  // TODO: Implement virtual scrolling when react-window is installed
  return (
    <div style={{ height: containerHeight, overflow: 'auto' }}>
      {items.map((item: T, index: number) => (
        <div key={index} style={{ height: itemHeight }}>
          {renderRow(item, index)}
        </div>
      ))}
    </div>
  );
}
