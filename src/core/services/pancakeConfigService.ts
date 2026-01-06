/**
 * Service để quản lý cấu hình Pancake API (lưu/load nhiều API keys)
 */

import { PancakeApiConfig } from '../../shared/types/pancakeApi';
import { logger } from '../../shared/utils/logger';

const STORAGE_KEY = 'pancake_api_configs';
const ACTIVE_CONFIG_KEY = 'pancake_active_api_id';

class PancakeConfigService {
  /**
   * Lấy tất cả API configs
   */
  getAllConfigs(): PancakeApiConfig[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (error) {
      logger.error('❌ Lỗi đọc API configs:', error);
      return [];
    }
  }

  /**
   * Lưu tất cả API configs
   */
  saveConfigs(configs: PancakeApiConfig[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
      logger.log(`✅ Đã lưu ${configs.length} API config(s)`);
    } catch (error) {
      logger.error('❌ Lỗi lưu API configs:', error);
      throw new Error('Không thể lưu cấu hình API');
    }
  }

  /**
   * Thêm hoặc cập nhật một API config
   */
  saveConfig(config: PancakeApiConfig): void {
    const configs = this.getAllConfigs();
    const existingIndex = configs.findIndex((c) => c.id === config.id);

    if (existingIndex >= 0) {
      // Cập nhật
      configs[existingIndex] = config;
    } else {
      // Thêm mới
      configs.push(config);
    }

    this.saveConfigs(configs);
  }

  /**
   * Xóa một API config
   */
  deleteConfig(configId: string): void {
    const configs = this.getAllConfigs();
    const filtered = configs.filter((c) => c.id !== configId);
    this.saveConfigs(filtered);

    // Nếu xóa config đang active, clear active config
    const activeId = this.getActiveConfigId();
    if (activeId === configId) {
      this.clearActiveConfig();
    }
  }

  /**
   * Lấy API config theo ID
   */
  getConfigById(configId: string): PancakeApiConfig | null {
    const configs = this.getAllConfigs();
    return configs.find((c) => c.id === configId) || null;
  }

  /**
   * Lấy API config đang active
   */
  getActiveConfig(): PancakeApiConfig | null {
    const activeId = this.getActiveConfigId();
    if (!activeId) return null;
    return this.getConfigById(activeId);
  }

  /**
   * Set API config làm active
   */
  setActiveConfig(configId: string): void {
    try {
      localStorage.setItem(ACTIVE_CONFIG_KEY, configId);
      
      // Cập nhật isActive cho tất cả configs
      const configs = this.getAllConfigs();
      configs.forEach((c) => {
        c.isActive = c.id === configId;
      });
      this.saveConfigs(configs);

      logger.log(`✅ Đã set API config "${configId}" làm active`);
    } catch (error) {
      logger.error('❌ Lỗi set active config:', error);
    }
  }

  /**
   * Lấy ID của config đang active
   */
  getActiveConfigId(): string | null {
    try {
      return localStorage.getItem(ACTIVE_CONFIG_KEY);
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear active config
   */
  clearActiveConfig(): void {
    try {
      localStorage.removeItem(ACTIVE_CONFIG_KEY);
      
      // Cập nhật isActive cho tất cả configs
      const configs = this.getAllConfigs();
      configs.forEach((c) => {
        c.isActive = false;
      });
      this.saveConfigs(configs);
    } catch (error) {
      logger.error('❌ Lỗi clear active config:', error);
    }
  }

  /**
   * Tạo config mới với ID tự động
   */
  createNewConfig(data: Omit<PancakeApiConfig, 'id' | 'createdAt'>): PancakeApiConfig {
    const config: PancakeApiConfig = {
      ...data,
      id: `pancake_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };
    return config;
  }

  /**
   * Cập nhật lastUsedAt
   */
  updateLastUsed(configId: string): void {
    const config = this.getConfigById(configId);
    if (config) {
      config.lastUsedAt = new Date().toISOString();
      this.saveConfig(config);
    }
  }
}

export const pancakeConfigService = new PancakeConfigService();

