/**
 * AI Chat Database Service
 * Quản lý lưu trữ dữ liệu AI Chat trong IndexedDB
 * - AI Modules config
 * - Training data
 * - Products & Media metadata
 * - Conversations (có thể migrate sang SQLite sau)
 */

import { AIModule, Conversation, Message } from '../../../shared/types/aiChat';
import { logger } from '../../../shared/utils/logger';

const DB_NAME = 'DonHang360AIChat';
const DB_VERSION = 1;
const STORE_MODULES = 'aiModules';
const STORE_CONVERSATIONS = 'conversations';
const STORE_MESSAGES = 'messages';

class AIChatDatabaseService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        logger.error('❌ Lỗi mở IndexedDB AI Chat:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        logger.log('✅ Đã khởi tạo AI Chat Database Service');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store cho AI Modules
        if (!db.objectStoreNames.contains(STORE_MODULES)) {
          const modulesStore = db.createObjectStore(STORE_MODULES, { keyPath: 'id' });
          modulesStore.createIndex('isActive', 'isActive', { unique: false });
          modulesStore.createIndex('facebookPageId', 'facebookPageId', { unique: false });
        }

        // Store cho Conversations
        if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
          const conversationsStore = db.createObjectStore(STORE_CONVERSATIONS, { keyPath: 'id' });
          conversationsStore.createIndex('moduleId', 'moduleId', { unique: false });
          conversationsStore.createIndex('customerId', 'customerId', { unique: false });
          conversationsStore.createIndex('status', 'status', { unique: false });
          conversationsStore.createIndex('lastMessageAt', 'lastMessageAt', { unique: false });
        }

        // Store cho Messages
        if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
          const messagesStore = db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' });
          messagesStore.createIndex('conversationId', 'conversationId', { unique: false });
          messagesStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  // ==================== AI Modules ====================

  async saveModule(module: AIModule): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database chưa được khởi tạo'));
        return;
      }

      const transaction = this.db.transaction([STORE_MODULES], 'readwrite');
      const store = transaction.objectStore(STORE_MODULES);
      const request = store.put(module);

      request.onsuccess = () => {
        logger.log(`✅ Đã lưu AI Module: ${module.name}`);
        resolve();
      };

      request.onerror = () => {
        logger.error('❌ Lỗi lưu AI Module:', request.error);
        reject(request.error);
      };
    });
  }

  async getModule(moduleId: string): Promise<AIModule | null> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database chưa được khởi tạo'));
        return;
      }

      const transaction = this.db.transaction([STORE_MODULES], 'readonly');
      const store = transaction.objectStore(STORE_MODULES);
      const request = store.get(moduleId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        logger.error('❌ Lỗi lấy AI Module:', request.error);
        reject(request.error);
      };
    });
  }

  async getAllModules(): Promise<AIModule[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database chưa được khởi tạo'));
        return;
      }

      const transaction = this.db.transaction([STORE_MODULES], 'readonly');
      const store = transaction.objectStore(STORE_MODULES);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        logger.error('❌ Lỗi lấy tất cả AI Modules:', request.error);
        reject(request.error);
      };
    });
  }

  async deleteModule(moduleId: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database chưa được khởi tạo'));
        return;
      }

      const transaction = this.db.transaction([STORE_MODULES], 'readwrite');
      const store = transaction.objectStore(STORE_MODULES);
      const request = store.delete(moduleId);

      request.onsuccess = () => {
        logger.log(`✅ Đã xóa AI Module: ${moduleId}`);
        resolve();
      };

      request.onerror = () => {
        logger.error('❌ Lỗi xóa AI Module:', request.error);
        reject(request.error);
      };
    });
  }

  // ==================== Conversations ====================

  async createConversation(conversation: Conversation): Promise<Conversation> {
    await this.saveConversation(conversation);
    return conversation;
  }

  async saveConversation(conversation: Conversation): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database chưa được khởi tạo'));
        return;
      }

      const transaction = this.db.transaction([STORE_CONVERSATIONS, STORE_MESSAGES], 'readwrite');
      const conversationsStore = transaction.objectStore(STORE_CONVERSATIONS);
      const messagesStore = transaction.objectStore(STORE_MESSAGES);

      // Lưu conversation
      const convRequest = conversationsStore.put(conversation);

      // Lưu messages
      const messagePromises = conversation.messages.map(message => {
        return new Promise<void>((resolve, reject) => {
          const msgRequest = messagesStore.put(message);
          msgRequest.onsuccess = () => resolve();
          msgRequest.onerror = () => reject(msgRequest.error);
        });
      });

      convRequest.onsuccess = () => {
        Promise.all(messagePromises)
          .then(() => {
            logger.log(`✅ Đã lưu conversation: ${conversation.id}`);
            resolve();
          })
          .catch(reject);
      };

      convRequest.onerror = () => {
        logger.error('❌ Lỗi lưu conversation:', convRequest.error);
        reject(convRequest.error);
      };
    });
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database chưa được khởi tạo'));
        return;
      }

      const transaction = this.db.transaction([STORE_CONVERSATIONS, STORE_MESSAGES], 'readonly');
      const conversationsStore = transaction.objectStore(STORE_CONVERSATIONS);
      const messagesStore = transaction.objectStore(STORE_MESSAGES);

      const convRequest = conversationsStore.get(conversationId);

      convRequest.onsuccess = () => {
        const conversation = convRequest.result;
        if (!conversation) {
          resolve(null);
          return;
        }

        // Lấy messages
        const messagesIndex = messagesStore.index('conversationId');
        const messagesRequest = messagesIndex.getAll(conversationId);

        messagesRequest.onsuccess = () => {
          conversation.messages = messagesRequest.result || [];
          resolve(conversation);
        };

        messagesRequest.onerror = () => {
          logger.error('❌ Lỗi lấy messages:', messagesRequest.error);
          reject(messagesRequest.error);
        };
      };

      convRequest.onerror = () => {
        logger.error('❌ Lỗi lấy conversation:', convRequest.error);
        reject(convRequest.error);
      };
    });
  }

  async getConversationsByModule(moduleId: string): Promise<Conversation[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database chưa được khởi tạo'));
        return;
      }

      const transaction = this.db.transaction([STORE_CONVERSATIONS, STORE_MESSAGES], 'readonly');
      const conversationsStore = transaction.objectStore(STORE_CONVERSATIONS);
      const messagesStore = transaction.objectStore(STORE_MESSAGES);

      const index = conversationsStore.index('moduleId');
      const request = index.getAll(moduleId);

      request.onsuccess = () => {
        const conversations = request.result || [];

        // Lấy messages cho mỗi conversation
        const promises = conversations.map((conv: Conversation) => {
          return new Promise<void>((resolve) => {
            const messagesIndex = messagesStore.index('conversationId');
            const messagesRequest = messagesIndex.getAll(conv.id);

            messagesRequest.onsuccess = () => {
              conv.messages = messagesRequest.result || [];
              resolve();
            };

            messagesRequest.onerror = () => {
              conv.messages = [];
              resolve();
            };
          });
        });

        Promise.all(promises).then(() => {
          resolve(conversations);
        });
      };

      request.onerror = () => {
        logger.error('❌ Lỗi lấy conversations:', request.error);
        reject(request.error);
      };
    });
  }

  async addMessage(conversationId: string, message: Message): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database chưa được khởi tạo'));
        return;
      }

      const transaction = this.db.transaction([STORE_MESSAGES, STORE_CONVERSATIONS], 'readwrite');
      const messagesStore = transaction.objectStore(STORE_MESSAGES);
      const conversationsStore = transaction.objectStore(STORE_CONVERSATIONS);

      // Lưu message
      const msgRequest = messagesStore.put(message);

      // Cập nhật conversation (lastMessageAt)
      const convRequest = conversationsStore.get(conversationId);

      convRequest.onsuccess = () => {
        const conversation = convRequest.result;
        if (conversation) {
          conversation.lastMessageAt = message.timestamp;
          conversation.updatedAt = new Date().toISOString();
          conversation.messages.push(message);

          const updateRequest = conversationsStore.put(conversation);
          updateRequest.onsuccess = () => {
            logger.log(`✅ Đã thêm message vào conversation: ${conversationId}`);
            resolve();
          };
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };

      msgRequest.onerror = () => {
        logger.error('❌ Lỗi lưu message:', msgRequest.error);
        reject(msgRequest.error);
      };
    });
  }
}

export const aiChatDatabaseService = new AIChatDatabaseService();

