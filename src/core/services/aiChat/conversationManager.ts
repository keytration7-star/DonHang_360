/**
 * Conversation Manager
 * Quản lý conversations với Memory System (immediate, summarized, long-term)
 */

import {
  Conversation,
  Message,
  ConversationMemory,
  AIModule,
  CustomerPersonality,
} from '../../../shared/types/aiChat';
import { aiChatDatabaseService } from './aiChatDatabaseService';
import { personalityEngine } from './personalityEngine';
import { logger } from '../../../shared/utils/logger';

class ConversationManager {
  /**
   * Tạo conversation mới
   */
  async createConversation(
    moduleId: string,
    customerId: string,
    customerName?: string
  ): Promise<Conversation> {
    const conversation: Conversation = {
      id: `${moduleId}_${customerId}_${Date.now()}`,
      moduleId,
      customerId,
      customerName,
      messages: [],
      status: 'active',
      startedAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await aiChatDatabaseService.saveConversation(conversation);
    logger.log(`✅ Đã tạo conversation: ${conversation.id}`);
    return conversation;
  }

  /**
   * Lấy conversation (tạo mới nếu chưa có)
   */
  async getOrCreateConversation(
    moduleId: string,
    customerId: string,
    customerName?: string
  ): Promise<Conversation> {
    // Tìm conversation active gần nhất
    const conversations = await aiChatDatabaseService.getConversationsByModule(moduleId);
    const activeConversation = conversations
      .filter(c => c.customerId === customerId && c.status === 'active')
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())[0];

    if (activeConversation) {
      // Nếu conversation cũ hơn 24h, tạo mới
      const hoursSinceLastMessage = (Date.now() - new Date(activeConversation.lastMessageAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastMessage < 24) {
        return activeConversation;
      }
    }

    // Tạo conversation mới
    return await this.createConversation(moduleId, customerId, customerName);
  }

  /**
   * Thêm message vào conversation
   */
  async addMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    attachments?: Message['attachments']
  ): Promise<Message> {
    const message: Message = {
      id: `${conversationId}_${Date.now()}_${Math.random()}`,
      conversationId,
      role,
      content,
      attachments,
      timestamp: new Date().toISOString(),
      isRead: false,
    };

    await aiChatDatabaseService.addMessage(conversationId, message);

    // Update personality nếu là user message
    if (role === 'user') {
      const conversation = await aiChatDatabaseService.getConversation(conversationId);
      if (conversation) {
        const personality = personalityEngine.updatePersonality(
          conversation.personality || personalityEngine.analyzePersonality(conversation.messages),
          message
        );
        conversation.personality = personality;
        await aiChatDatabaseService.saveConversation(conversation);
      }
    }

    logger.log(`✅ Đã thêm ${role} message vào conversation: ${conversationId}`);
    return message;
  }

  /**
   * Lấy conversation memory (cho AI context)
   */
  async getConversationMemory(
    conversationId: string,
    immediateContextSize: number = 10
  ): Promise<ConversationMemory> {
    const conversation = await aiChatDatabaseService.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} không tồn tại`);
    }

    // Immediate context (last N messages)
    const immediateContext = conversation.messages.slice(-immediateContextSize);

    // Summarized context (compress old messages)
    const oldMessages = conversation.messages.slice(0, -immediateContextSize);
    const summarizedContext = this.summarizeMessages(oldMessages);

    // Long-term memory (extract key facts)
    const longTermMemory = this.extractLongTermMemory(conversation);

    return {
      conversationId,
      immediateContext,
      summarizedContext,
      longTermMemory,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Summarize old messages (simple compression)
   */
  private summarizeMessages(messages: Message[]): string {
    if (messages.length === 0) {
      return '';
    }

    // Group by role
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');

    const summary: string[] = [];

    if (userMessages.length > 0) {
      summary.push(`Khách hàng đã hỏi về: ${userMessages.map(m => m.content.substring(0, 50)).join('; ')}`);
    }

    if (assistantMessages.length > 0) {
      summary.push(`Đã trả lời về: ${assistantMessages.map(m => m.content.substring(0, 50)).join('; ')}`);
    }

    return summary.join('\n');
  }

  /**
   * Extract long-term memory (key facts)
   */
  private extractLongTermMemory(conversation: Conversation): ConversationMemory['longTermMemory'] {
    const userMessages = conversation.messages.filter(m => m.role === 'user');
    const allText = userMessages.map(m => m.content.toLowerCase()).join(' ');

    const preferences: string[] = [];
    const pastInteractions: string[] = [];
    const importantNotes: string[] = [];

    // Extract preferences
    if (allText.includes('thích') || allText.includes('muốn')) {
      const likeMatch = userMessages.find(m => m.content.toLowerCase().includes('thích') || m.content.toLowerCase().includes('muốn'));
      if (likeMatch) {
        preferences.push(likeMatch.content);
      }
    }

    // Extract past interactions
    if (allText.includes('đã') || allText.includes('trước')) {
      const pastMatch = userMessages.find(m => m.content.toLowerCase().includes('đã') || m.content.toLowerCase().includes('trước'));
      if (pastMatch) {
        pastInteractions.push(pastMatch.content);
      }
    }

    // Extract important notes (mentions of price, delivery, etc.)
    if (allText.includes('giá') || allText.includes('giao') || allText.includes('ship')) {
      importantNotes.push('Khách hàng quan tâm đến giá và giao hàng');
    }

    // Add personality insights
    if (conversation.personality) {
      const personality = conversation.personality;
      if (personality.traits.priceSensitive > 7) {
        importantNotes.push('Khách hàng nhạy cảm về giá');
      }
      if (personality.traits.detailOriented > 7) {
        importantNotes.push('Khách hàng chú ý chi tiết');
      }
    }

    return {
      customerPreferences: preferences,
      pastInteractions,
      importantNotes,
    };
  }

  /**
   * Get messages for AI (combine memory)
   */
  async getMessagesForAI(conversationId: string): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const memory = await this.getConversationMemory(conversationId);
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // Add summarized context as system message
    if (memory.summarizedContext) {
      messages.push({
        role: 'assistant',
        content: `[Tóm tắt cuộc trò chuyện trước]: ${memory.summarizedContext}`,
      });
    }

    // Add immediate context
    memory.immediateContext.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    });

    return messages;
  }

  /**
   * Close conversation
   */
  async closeConversation(conversationId: string): Promise<void> {
    const conversation = await aiChatDatabaseService.getConversation(conversationId);
    if (conversation) {
      conversation.status = 'closed';
      conversation.updatedAt = new Date().toISOString();
      await aiChatDatabaseService.saveConversation(conversation);
      logger.log(`✅ Đã đóng conversation: ${conversationId}`);
    }
  }
}

export const conversationManager = new ConversationManager();

