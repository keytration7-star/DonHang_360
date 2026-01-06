/**
 * Personality Engine
 * Phân tích tính cách khách hàng từ messages
 */

import { CustomerPersonality, Message } from '../../../shared/types/aiChat';
import { logger } from '../../../shared/utils/logger';

class PersonalityEngine {
  /**
   * Phân tích personality từ conversation messages
   */
  analyzePersonality(messages: Message[]): CustomerPersonality {
    const userMessages = messages.filter(m => m.role === 'user');
    
    if (userMessages.length === 0) {
      return this.getDefaultPersonality();
    }

    const allText = userMessages.map(m => m.content.toLowerCase()).join(' ');

    // Analyze communication style
    const communicationStyle = this.analyzeCommunicationStyle(allText, userMessages);

    // Analyze tone
    const tone = this.analyzeTone(allText);

    // Analyze priorities
    const priorities = this.analyzePriorities(allText);

    // Analyze traits
    const traits = this.analyzeTraits(allText, userMessages);

    // Calculate confidence (càng nhiều messages, confidence càng cao)
    const confidence = Math.min(1, userMessages.length / 10);

    return {
      communicationStyle,
      tone,
      priorities,
      traits,
      confidence,
    };
  }

  /**
   * Update personality với message mới
   */
  updatePersonality(
    currentPersonality: CustomerPersonality,
    newMessage: Message
  ): CustomerPersonality {
    if (newMessage.role !== 'user') {
      return currentPersonality;
    }

    const newText = newMessage.content.toLowerCase();
    const allText = newText; // Có thể combine với previous messages nếu cần

    // Update communication style (weighted average)
    const newStyle = this.analyzeCommunicationStyle(allText, [newMessage]);
    const styleWeight = 0.3; // 30% weight cho message mới
    const currentStyleScore = this.getStyleScore(currentPersonality.communicationStyle);
    const newStyleScore = this.getStyleScore(newStyle);
    const updatedStyleScore = currentStyleScore * (1 - styleWeight) + newStyleScore * styleWeight;
    const updatedStyle = this.getStyleFromScore(updatedStyleScore);

    // Update tone
    const newTone = this.analyzeTone(allText);
    const toneWeight = 0.4;
    const updatedTone = this.mergeTone(currentPersonality.tone, newTone, toneWeight);

    // Update priorities
    const newPriorities = this.analyzePriorities(allText);
    const priorities = {
      price: currentPersonality.priorities.price * 0.7 + newPriorities.price * 0.3,
      quality: currentPersonality.priorities.quality * 0.7 + newPriorities.quality * 0.3,
      speed: currentPersonality.priorities.speed * 0.7 + newPriorities.speed * 0.3,
      service: currentPersonality.priorities.service * 0.7 + newPriorities.service * 0.3,
    };

    // Update traits
    const newTraits = this.analyzeTraits(allText, [newMessage]);
    const traits = {
      decisive: currentPersonality.traits.decisive * 0.7 + newTraits.decisive * 0.3,
      detailOriented: currentPersonality.traits.detailOriented * 0.7 + newTraits.detailOriented * 0.3,
      priceSensitive: currentPersonality.traits.priceSensitive * 0.7 + newTraits.priceSensitive * 0.3,
      brandLoyal: currentPersonality.traits.brandLoyal * 0.7 + newTraits.brandLoyal * 0.3,
    };

    // Update confidence
    const confidence = Math.min(1, currentPersonality.confidence + 0.1);

    return {
      communicationStyle: updatedStyle,
      tone: updatedTone,
      priorities,
      traits,
      confidence,
    };
  }

  private analyzeCommunicationStyle(text: string, messages: Message[]): CustomerPersonality['communicationStyle'] {
    // Direct: ngắn gọn, đi thẳng vào vấn đề
    const directKeywords = ['giá', 'bao nhiêu', 'có không', 'mua', 'đặt', 'giao', 'ship'];
    const directCount = directKeywords.filter(k => text.includes(k)).length;

    // Polite: dùng từ lịch sự
    const politeKeywords = ['xin chào', 'cảm ơn', 'vui lòng', 'xin lỗi', 'cho tôi', 'bạn có thể'];
    const politeCount = politeKeywords.filter(k => text.includes(k)).length;

    // Casual: dùng từ thân mật, emoji
    const casualKeywords = ['ok', 'oke', 'okay', 'đc', 'được', '👍', '😊', '❤️'];
    const casualCount = casualKeywords.filter(k => text.includes(k)).length;

    // Formal: dùng từ trang trọng
    const formalKeywords = ['quý khách', 'quý anh/chị', 'trân trọng', 'kính chào'];
    const formalCount = formalKeywords.filter(k => text.includes(k)).length;

    // Average message length
    const avgLength = messages.reduce((sum, m) => sum + m.content.length, 0) / messages.length;

    // Decision logic
    if (directCount > 3 && avgLength < 50) {
      return 'direct';
    } else if (politeCount > 2) {
      return 'polite';
    } else if (casualCount > 2) {
      return 'casual';
    } else if (formalCount > 1) {
      return 'formal';
    } else {
      return 'friendly'; // Default
    }
  }

  private analyzeTone(text: string): CustomerPersonality['tone'] {
    const positiveKeywords = ['tốt', 'đẹp', 'thích', 'ok', 'tuyệt', '👍', '❤️', '😊'];
    const negativeKeywords = ['không', 'chưa', 'sao', 'lỗi', 'hỏng', 'sai', 'kém'];
    const curiousKeywords = ['là gì', 'như thế nào', 'tại sao', 'có thể', 'có được không', '?'];
    const hesitantKeywords = ['có lẽ', 'có thể', 'suy nghĩ', 'để xem', 'chưa chắc'];

    const positiveCount = positiveKeywords.filter(k => text.includes(k)).length;
    const negativeCount = negativeKeywords.filter(k => text.includes(k)).length;
    const curiousCount = curiousKeywords.filter(k => text.includes(k)).length;
    const hesitantCount = hesitantKeywords.filter(k => text.includes(k)).length;

    if (negativeCount > 2) {
      return 'negative';
    } else if (curiousCount > 2) {
      return 'curious';
    } else if (hesitantCount > 1) {
      return 'hesitant';
    } else if (positiveCount > 1) {
      return 'positive';
    } else {
      return 'neutral';
    }
  }

  private analyzePriorities(text: string): CustomerPersonality['priorities'] {
    const priceKeywords = ['giá', 'rẻ', 'đắt', 'tiền', 'phí', 'giảm', 'sale', 'khuyến mãi'];
    const qualityKeywords = ['chất lượng', 'tốt', 'bền', 'đẹp', 'cao cấp', 'premium'];
    const speedKeywords = ['nhanh', 'giao', 'ship', 'vận chuyển', 'thời gian', 'khi nào'];
    const serviceKeywords = ['dịch vụ', 'hỗ trợ', 'tư vấn', 'chăm sóc', 'bảo hành'];

    return {
      price: this.countKeywords(text, priceKeywords) * 2,
      quality: this.countKeywords(text, qualityKeywords) * 2,
      speed: this.countKeywords(text, speedKeywords) * 2,
      service: this.countKeywords(text, serviceKeywords) * 2,
    };
  }

  private analyzeTraits(text: string, messages: Message[]): CustomerPersonality['traits'] {
    // Decisive: quyết đoán, đưa ra quyết định nhanh
    const decisiveKeywords = ['mua', 'đặt', 'ok', 'được', 'chốt', 'xác nhận'];
    const decisiveCount = this.countKeywords(text, decisiveKeywords);

    // Detail-oriented: hỏi nhiều chi tiết
    const detailKeywords = ['màu', 'size', 'kích thước', 'chất liệu', 'xuất xứ', 'bảo hành', 'đổi trả'];
    const detailCount = this.countKeywords(text, detailKeywords);

    // Price-sensitive: nhạy cảm về giá
    const priceKeywords = ['giá', 'rẻ', 'đắt', 'giảm', 'sale', 'khuyến mãi', 'ưu đãi'];
    const priceCount = this.countKeywords(text, priceKeywords);

    // Brand-loyal: hỏi về thương hiệu, uy tín
    const brandKeywords = ['thương hiệu', 'uy tín', 'độ tin cậy', 'review', 'đánh giá'];
    const brandCount = this.countKeywords(text, brandKeywords);

    return {
      decisive: Math.min(10, decisiveCount * 2),
      detailOriented: Math.min(10, detailCount * 1.5),
      priceSensitive: Math.min(10, priceCount * 2),
      brandLoyal: Math.min(10, brandCount * 2),
    };
  }

  private countKeywords(text: string, keywords: string[]): number {
    return keywords.filter(k => text.includes(k)).length;
  }

  private getStyleScore(style: CustomerPersonality['communicationStyle']): number {
    const scores: Record<string, number> = {
      direct: 1,
      polite: 2,
      casual: 3,
      formal: 4,
      friendly: 2.5,
    };
    return scores[style] || 2.5;
  }

  private getStyleFromScore(score: number): CustomerPersonality['communicationStyle'] {
    if (score < 1.5) return 'direct';
    if (score < 2.5) return 'polite';
    if (score < 3.5) return 'casual';
    if (score < 4.5) return 'formal';
    return 'friendly';
  }

  private mergeTone(current: string, newTone: string, weight: number): CustomerPersonality['tone'] {
    // Simple: nếu newTone khác neutral, ưu tiên newTone
    if (newTone !== 'neutral' && current === 'neutral') {
      return newTone as CustomerPersonality['tone'];
    }
    return current;
  }

  private getDefaultPersonality(): CustomerPersonality {
    return {
      communicationStyle: 'friendly',
      tone: 'neutral',
      priorities: {
        price: 5,
        quality: 5,
        speed: 5,
        service: 5,
      },
      traits: {
        decisive: 5,
        detailOriented: 5,
        priceSensitive: 5,
        brandLoyal: 5,
      },
      confidence: 0.1,
    };
  }
}

export const personalityEngine = new PersonalityEngine();

