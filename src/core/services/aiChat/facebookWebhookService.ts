/**
 * Facebook Webhook Service
 * Xử lý webhook events từ Facebook (messages, postbacks, etc.)
 */

import { logger } from '../../../shared/utils/logger';
import { aiChatDatabaseService } from './aiChatDatabaseService';
import { facebookApiService, SendMessageParams } from './facebookApiService';
import { aiChatOrchestrator } from './aiChatOrchestrator';
import { AIModule } from '../../../shared/types/aiChat';

export interface WebhookEvent {
  object: 'page';
  entry: Array<{
    id: string;
    time: number;
    messaging: Array<{
      sender: { id: string };
      recipient: { id: string };
      timestamp: number;
      message?: {
        mid: string;
        text?: string;
        attachments?: Array<{
          type: 'image' | 'video' | 'audio' | 'file';
          payload: {
            url?: string;
          };
        }>;
      };
      postback?: {
        title: string;
        payload: string;
      };
      delivery?: {
        mids: string[];
        watermark: number;
      };
      read?: {
        watermark: number;
      };
    }>;
  }>;
}

export interface WebhookVerificationParams {
  'hub.mode': string;
  'hub.verify_token': string;
  'hub.challenge': string;
}

class FacebookWebhookService {
  private verifyToken: string = 'your_verify_token_here'; // Nên lưu trong config

  /**
   * Verify webhook (Facebook sẽ gọi khi setup webhook)
   */
  verifyWebhook(params: WebhookVerificationParams): string | null {
    const mode = params['hub.mode'];
    const token = params['hub.verify_token'];
    const challenge = params['hub.challenge'];

    if (mode === 'subscribe' && token === this.verifyToken) {
      logger.log('✅ Webhook verified successfully');
      return challenge;
    }

    logger.warn('❌ Webhook verification failed');
    return null;
  }

  /**
   * Xử lý webhook event từ Facebook
   */
  async handleWebhookEvent(event: WebhookEvent): Promise<void> {
    try {
      for (const entry of event.entry) {
        const pageId = entry.id;

        // Tìm module tương ứng với page này
        const module = await this.findModuleByPageId(pageId);
        if (!module) {
          logger.warn(`⚠️ Không tìm thấy module cho page ID: ${pageId}`);
          continue;
        }

        // Xử lý từng messaging event
        for (const messaging of entry.messaging) {
          const senderId = messaging.sender.id;
          const recipientId = messaging.recipient.id;

          // Xử lý message
          if (messaging.message) {
            await this.handleMessage(module, senderId, messaging.message);
          }

          // Xử lý postback (khi user click button)
          if (messaging.postback) {
            await this.handlePostback(module, senderId, messaging.postback);
          }

          // Xử lý delivery confirmation
          if (messaging.delivery) {
            logger.log(`✅ Message delivered: ${messaging.delivery.mids.join(', ')}`);
          }

          // Xử lý read receipt
          if (messaging.read) {
            logger.log(`✅ Message read at: ${new Date(messaging.read.watermark * 1000).toISOString()}`);
          }
        }
      }
    } catch (error) {
      logger.error('❌ Lỗi xử lý webhook event:', error);
    }
  }

  /**
   * Xử lý incoming message
   */
  private async handleMessage(module: AIModule, senderId: string, message: any): Promise<void> {
    try {
      // Khởi tạo Facebook API Service với module's access token
      if (module.facebookPageId && module.facebookPageAccessToken) {
        facebookApiService.initialize(module.facebookPageId, module.facebookPageAccessToken);
      } else {
        logger.error('❌ Module thiếu Facebook Page ID hoặc Access Token');
        return;
      }

      const messageText = message.text || '';
      const attachments = message.attachments || [];

      logger.log(`📨 Nhận message từ ${senderId}: ${messageText.substring(0, 50)}...`);

      // Xử lý qua AI Chat Orchestrator
      const chatResponse = await aiChatOrchestrator.handleMessage(
        module.id,
        senderId,
        messageText,
        module
      );

      // Gửi response
      const sendParams: SendMessageParams = {
        recipientId: senderId,
        message: chatResponse.text,
        mediaUrls: chatResponse.media || [],
      };

      const result = await facebookApiService.sendMessage(sendParams);

      if (result.success) {
        logger.log(`✅ Đã gửi response đến ${senderId}`);
      } else {
        logger.error(`❌ Lỗi gửi response: ${result.error}`);
      }
    } catch (error) {
      logger.error('❌ Lỗi xử lý message:', error);
      // Gửi thông báo lỗi cho user
      try {
        await facebookApiService.sendTextMessage(
          senderId,
          'Xin lỗi, đã xảy ra lỗi. Vui lòng thử lại sau.'
        );
      } catch (sendError) {
        logger.error('❌ Không thể gửi thông báo lỗi:', sendError);
      }
    }
  }

  /**
   * Xử lý postback (button click)
   */
  private async handlePostback(module: AIModule, senderId: string, postback: any): Promise<void> {
    logger.log(`🔘 Postback từ ${senderId}: ${postback.title} - ${postback.payload}`);

    // Xử lý postback dựa trên payload
    // VD: "GET_STARTED", "VIEW_PRODUCTS", etc.
    switch (postback.payload) {
      case 'GET_STARTED':
        // Gửi intro message (nếu có)
        // Intro sẽ được gửi tự động qua Conversation Manager khi xử lý message đầu tiên
        await this.handleMessage(module, senderId, { text: 'GET_STARTED' });
        break;
      default:
        // Xử lý như message thông thường
        await this.handleMessage(module, senderId, { text: postback.payload });
    }
  }

  /**
   * Tìm module theo Page ID
   */
  private async findModuleByPageId(pageId: string): Promise<AIModule | null> {
    try {
      const allModules = await aiChatDatabaseService.getAllModules();
      return allModules.find(m => m.facebookPageId === pageId && m.isActive) || null;
    } catch (error) {
      logger.error('❌ Lỗi tìm module:', error);
      return null;
    }
  }

  /**
   * Set verify token
   */
  setVerifyToken(token: string): void {
    this.verifyToken = token;
    logger.log('✅ Verify token đã được cập nhật');
  }
}

export const facebookWebhookService = new FacebookWebhookService();

