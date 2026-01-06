/**
 * Backup Service - Tạm thời DISABLED
 * Excel-based functionality - sẽ refactor trong tương lai
 */

import { Order } from '../shared/types/order';
import { logger } from '../shared/utils/logger';

const BACKUP_KEY = 'donhang360_backups';
const MAX_BACKUPS = 10;

export interface BackupInfo {
  id: string;
  timestamp: string;
  orderCount: number;
  description?: string;
  fileSize?: number;
}

class BackupService {
  /**
   * ⚠️ DISABLED: Excel-based functionality
   */
  async createAutoBackup(_description?: string): Promise<string> {
    throw new Error('Backup service is temporarily disabled - Excel-based functionality');
  }

  /**
   * ⚠️ DISABLED: Excel-based functionality
   */
  async restoreBackup(_backupId: string, _confirmMessage?: string): Promise<void> {
    throw new Error('Backup service is temporarily disabled - Excel-based functionality');
  }

  /**
   * ⚠️ DISABLED: Excel-based functionality
   */
  async getBackupData(_backupId: string): Promise<any | null> {
    throw new Error('Backup service is temporarily disabled - Excel-based functionality');
  }

  /**
   * ⚠️ DISABLED: Excel-based functionality
   */
  deleteBackup(_backupId: string): void {
    throw new Error('Backup service is temporarily disabled - Excel-based functionality');
  }

  /**
   * ⚠️ DISABLED: Excel-based functionality
   */
  getAllBackups(): BackupInfo[] {
    return [];
  }

  /**
   * ⚠️ DISABLED: Excel-based functionality
   */
  hasBackup(): boolean {
    return false;
  }

  /**
   * ⚠️ DISABLED: Excel-based functionality
   */
  getBackupInfo(): BackupInfo | null {
    return null;
  }
}

export const backupService = new BackupService();
