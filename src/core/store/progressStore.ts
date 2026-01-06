import { create } from 'zustand';

interface ProgressState {
  isActive: boolean;
  progress: number; // 0-100
  taskName: string;
  current?: number; // Số đơn đang xử lý
  total?: number; // Tổng số đơn
  detail?: string; // Thông tin chi tiết bổ sung
  showProgress: (taskName: string) => void;
  updateProgress: (progress: number, current?: number, total?: number, detail?: string) => void;
  hideProgress: () => void;
}

export const useProgressStore = create<ProgressState>((set) => ({
  isActive: false,
  progress: 0,
  taskName: '',
  current: undefined,
  total: undefined,
  detail: undefined,
  showProgress: (taskName: string) => set({ isActive: true, progress: 0, taskName, current: undefined, total: undefined, detail: undefined }),
  updateProgress: (progress: number, current?: number, total?: number, detail?: string) => set({ 
    progress: Math.min(100, Math.max(0, progress)),
    current,
    total,
    detail
  }),
  hideProgress: () => set({ isActive: false, progress: 0, taskName: '', current: undefined, total: undefined, detail: undefined }),
}));

