/**
 * AI Chat Orchestrator
 * Điều phối toàn bộ flow: nhận message -> xử lý -> gửi response
 */

import { AIModule, ParsedForm, AIResponse, Conversation, Message } from '../../../shared/types/aiChat';
import { conversationManager } from './conversationManager';
import { aiProviderService } from './aiProviderService';
import { systemPromptGenerator } from './systemPromptGenerator';
import { mediaManager } from './mediaManager';
import { aiChatDatabaseService } from './aiChatDatabaseService';
import { logger } from '../../../shared/utils/logger';

export interface ChatResponse {
  text: string;
  media: string[]; // Media URLs
  shouldWait?: boolean; // Có cần delay trước khi gửi không
}

class AIChatOrchestrator {
  /**
   * Xử lý incoming message và tạo response
   */
  async handleMessage(
    moduleId: string,
    senderId: string,
    messageText: string,
    module: AIModule
  ): Promise<ChatResponse> {
    try {
      // Lấy hoặc tạo conversation
      const conversation = await conversationManager.getOrCreateConversation(
        moduleId,
        senderId
      );

      // Thêm user message vào conversation
      await conversationManager.addMessage(
        conversation.id,
        'user',
        messageText
      );

      // Kiểm tra INTRO logic (gửi intro message đầu tiên)
      if (conversation.messages.length === 1) {
        // Đây là message đầu tiên, gửi INTRO
        const introResponse = this.getIntroResponse(module);
        if (introResponse) {
          // Thêm intro message vào conversation
          await conversationManager.addMessage(
            conversation.id,
            'assistant',
            introResponse.text
          );
          return introResponse;
        }
      }

      // Lấy training data
      if (!module.trainingData) {
        logger.warn('⚠️ Module chưa có training data');
        return {
          text: 'Xin lỗi, hệ thống đang được cấu hình. Vui lòng thử lại sau.',
          media: [],
        };
      }

      // Convert TrainingData sang ParsedForm
      const parsedForm: ParsedForm = {
        productInfo: module.trainingData.productInfo,
        salesFlow: module.trainingData.salesFlow,
        communicationStyle: module.trainingData.communicationStyle,
        commonQuestions: module.trainingData.commonQuestions,
        rawSections: {},
      };

      // Lấy conversation memory
      const memory = await conversationManager.getConversationMemory(conversation.id);
      const messagesForAI = await conversationManager.getMessagesForAI(conversation.id);

      // Generate system prompt
      const systemPrompt = systemPromptGenerator.generateSystemPrompt(
        module,
        conversation.personality
      );

      // Tìm media nếu cần (dựa trên message text)
      const mediaUrls = this.findRelevantMedia(module, messageText, parsedForm);

      // Gọi AI để tạo response
      const aiResponse = await aiProviderService.sendMessage(
        module.aiProvider,
        systemPrompt,
        messagesForAI.map(m => ({ role: m.role, content: m.content }))
      );

      // Parse AI response
      const responseText = aiResponse.content || 'Xin lỗi, tôi không hiểu.';
      const responseMedia = mediaUrls;

      // Thêm assistant message vào conversation
      await conversationManager.addMessage(
        conversation.id,
        'assistant',
        responseText,
        responseMedia.map(url => ({ type: 'image' as const, url }))
      );

      return {
        text: responseText,
        media: responseMedia,
      };
    } catch (error) {
      logger.error('❌ Lỗi xử lý message:', error);
      return {
        text: 'Xin lỗi, đã xảy ra lỗi. Vui lòng thử lại sau.',
        media: [],
      };
    }
  }

  /**
   * Lấy INTRO response (nếu có)
   */
  private getIntroResponse(module: AIModule): ChatResponse | null {
    // Kiểm tra xem có intro trong training data không
    // Note: Intro có thể được parse từ form hoặc lưu riêng
    // Tạm thời, tạo intro từ product info
    if (module.trainingData?.productInfo) {
      const product = module.trainingData.productInfo;
      const introText = `Xin chào! 👋\n\nTôi là trợ lý bán hàng của ${product.name}.\n\n${product.description || ''}\n\nGiá: ${product.price.toLocaleString('vi-VN')} ${product.currency}\n\nBạn có muốn tìm hiểu thêm về sản phẩm không? 😊`;

      // Lấy intro media (nếu có) - lấy tất cả media của module
      const introMedia = (module.media || []).slice(0, 5).map(m => m.url); // Lấy 5 media đầu tiên

      return {
        text: introText,
        media: introMedia,
        shouldWait: false,
      };
    }

    return null;
  }

  /**
   * Tìm media liên quan dựa trên message text
   */
  private findRelevantMedia(
    module: AIModule,
    messageText: string,
    parsedForm: ParsedForm
  ): string[] {
    try {
      const mediaItems = module.media || [];
      if (mediaItems.length === 0) return [];

      const lowerText = messageText.toLowerCase();

      // Tìm màu sắc trong message
      const colorKeywords = ['xanh', 'đỏ', 'vàng', 'trắng', 'đen', 'hồng', 'tím', 'nâu', 'cam', 'xám'];
      const foundColor = colorKeywords.find(color => lowerText.includes(color));

      // Tìm media theo màu sắc
      if (foundColor) {
        const media = mediaManager.findMediaByColor(mediaItems, foundColor);
        if (media.length > 0) {
          return media.slice(0, 3).map(m => m.url); // Lấy tối đa 3 media
        }
      }

      // Tìm media theo query (general search)
      const media = mediaManager.findMediaByQuery(mediaItems, messageText);
      if (media.length > 0) {
        return media.slice(0, 3).map(m => m.url);
      }

      return [];
    } catch (error) {
      logger.error('❌ Lỗi tìm media:', error);
      return [];
    }
  }
}

export const aiChatOrchestrator = new AIChatOrchestrator();

