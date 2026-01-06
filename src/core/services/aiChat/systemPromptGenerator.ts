/**
 * System Prompt Generator
 * Tạo system prompt động từ training data và customer personality
 */

import { AIModule, TrainingData, CustomerPersonality } from '../../../shared/types/aiChat';
import { logger } from '../../../shared/utils/logger';

class SystemPromptGenerator {
  /**
   * Tạo system prompt cho AI
   */
  generateSystemPrompt(
    module: AIModule,
    customerPersonality?: CustomerPersonality
  ): string {
    const trainingData = module.trainingData;
    if (!trainingData) {
      return this.getDefaultPrompt();
    }

    let prompt = '';

    // 1. Role & Context
    prompt += `Bạn là một nhân viên bán hàng chuyên nghiệp cho sản phẩm "${module.name}".\n\n`;

    // 2. Product Information
    if (trainingData.productInfo) {
      prompt += `## THÔNG TIN SẢN PHẨM\n`;
      prompt += `Tên sản phẩm: ${trainingData.productInfo.name}\n`;
      if (trainingData.productInfo.description) {
        prompt += `Mô tả: ${trainingData.productInfo.description}\n`;
      }
      prompt += `Giá: ${trainingData.productInfo.price.toLocaleString('vi-VN')} ${trainingData.productInfo.currency}\n`;
      
      if (trainingData.productInfo.variants && trainingData.productInfo.variants.length > 0) {
        prompt += `Các biến thể: ${trainingData.productInfo.variants.join(', ')}\n`;
      }
      
      if (trainingData.productInfo.features && trainingData.productInfo.features.length > 0) {
        prompt += `Tính năng: ${trainingData.productInfo.features.join(', ')}\n`;
      }
      prompt += `\n`;
    }

    // 3. Communication Style
    if (trainingData.communicationStyle) {
      prompt += `## PHONG CÁCH GIAO TIẾP\n`;
      prompt += `- Giọng điệu: ${this.mapTone(trainingData.communicationStyle.tone)}\n`;
      prompt += `- Ngôn ngữ: ${this.mapLanguage(trainingData.communicationStyle.language)}\n`;
      prompt += `- Sử dụng emoji: ${trainingData.communicationStyle.useEmojis ? 'Có' : 'Không'}\n`;
      
      if (trainingData.communicationStyle.abbreviations && trainingData.communicationStyle.abbreviations.length > 0) {
        prompt += `- Các từ viết tắt thường dùng: ${trainingData.communicationStyle.abbreviations.join(', ')}\n`;
      }
      prompt += `\n`;
    }

    // 4. Sales Flow
    if (trainingData.salesFlow && trainingData.salesFlow.length > 0) {
      prompt += `## QUY TRÌNH BÁN HÀNG (8 BƯỚC)\n`;
      trainingData.salesFlow.forEach(step => {
        prompt += `Bước ${step.step}: ${step.name}\n`;
        prompt += `  - ${step.description}\n`;
        if (step.triggers && step.triggers.length > 0) {
          prompt += `  - Từ khóa chuyển bước: ${step.triggers.join(', ')}\n`;
        }
      });
      prompt += `\n`;
    }

    // 5. Common Questions
    if (trainingData.commonQuestions && trainingData.commonQuestions.length > 0) {
      prompt += `## CÂU HỎI THƯỜNG GẶP\n`;
      trainingData.commonQuestions.forEach((qa, index) => {
        prompt += `${index + 1}. Q: ${qa.question}\n`;
        prompt += `   A: ${qa.answer}\n`;
      });
      prompt += `\n`;
    }

    // 6. Customer Personality (nếu có)
    if (customerPersonality) {
      prompt += `## THÔNG TIN KHÁCH HÀNG\n`;
      prompt += `- Phong cách giao tiếp: ${this.mapCommunicationStyle(customerPersonality.communicationStyle)}\n`;
      prompt += `- Tone: ${this.mapToneValue(customerPersonality.tone)}\n`;
      prompt += `- Ưu tiên: `;
      const priorities = [];
      if (customerPersonality.priorities.price > 7) priorities.push('Giá cả');
      if (customerPersonality.priorities.quality > 7) priorities.push('Chất lượng');
      if (customerPersonality.priorities.speed > 7) priorities.push('Tốc độ giao hàng');
      if (customerPersonality.priorities.service > 7) priorities.push('Dịch vụ');
      prompt += priorities.length > 0 ? priorities.join(', ') : 'Chưa xác định';
      prompt += `\n`;
      prompt += `- Đặc điểm: `;
      const traits = [];
      if (customerPersonality.traits.decisive > 7) traits.push('Quyết đoán');
      if (customerPersonality.traits.detailOriented > 7) traits.push('Chú ý chi tiết');
      if (customerPersonality.traits.priceSensitive > 7) traits.push('Nhạy cảm về giá');
      if (customerPersonality.traits.brandLoyal > 7) traits.push('Trung thành thương hiệu');
      prompt += traits.length > 0 ? traits.join(', ') : 'Bình thường';
      prompt += `\n\n`;
      
      // Adapt communication based on personality
      prompt += `## HƯỚNG DẪN GIAO TIẾP\n`;
      if (customerPersonality.communicationStyle === 'direct') {
        prompt += `- Khách hàng thích giao tiếp trực tiếp, đi thẳng vào vấn đề. Tránh dài dòng.\n`;
      } else if (customerPersonality.communicationStyle === 'polite') {
        prompt += `- Khách hàng thích giao tiếp lịch sự. Sử dụng ngôn ngữ trang trọng hơn.\n`;
      } else if (customerPersonality.communicationStyle === 'casual') {
        prompt += `- Khách hàng thích giao tiếp thân mật. Có thể dùng ngôn ngữ tự nhiên hơn.\n`;
      }
      
      if (customerPersonality.traits.priceSensitive > 7) {
        prompt += `- Khách hàng nhạy cảm về giá. Nhấn mạnh giá trị và ưu đãi.\n`;
      }
      
      if (customerPersonality.traits.detailOriented > 7) {
        prompt += `- Khách hàng chú ý chi tiết. Cung cấp thông tin đầy đủ và chính xác.\n`;
      }
      prompt += `\n`;
    }

    // 7. Rules
    prompt += `## QUY TẮC QUAN TRỌNG\n`;
    prompt += `1. LUÔN gửi INTRO message đầy đủ (thông tin sản phẩm, hình ảnh, video) ở đầu mỗi cuộc trò chuyện mới, bất kể khách hàng nói gì.\n`;
    prompt += `2. Hiểu ngữ cảnh và lịch sử trò chuyện để trả lời phù hợp.\n`;
    prompt += `3. Nếu khách hỏi về màu sắc/sản phẩm cụ thể, tìm và gửi hình ảnh/video tương ứng.\n`;
    prompt += `4. Trả lời ngắn gọn, tự nhiên, như một người thật.\n`;
    prompt += `5. Hiểu được các từ viết tắt và lỗi chính tả tiếng Việt.\n`;
    prompt += `6. Theo dõi quy trình bán hàng 8 bước và chuyển bước khi phù hợp.\n`;
    prompt += `7. Không được tạo ra thông tin không có trong training data.\n`;
    prompt += `8. Nếu không chắc chắn, hỏi lại khách hàng thay vì đoán.\n`;

    logger.log('✅ Đã tạo system prompt');
    return prompt;
  }

  private mapTone(tone: string): string {
    const map: Record<string, string> = {
      professional: 'Chuyên nghiệp',
      friendly: 'Thân thiện',
      casual: 'Thân mật',
      formal: 'Trang trọng',
    };
    return map[tone] || tone;
  }

  private mapLanguage(language: string): string {
    const map: Record<string, string> = {
      vietnamese: 'Tiếng Việt',
      english: 'Tiếng Anh',
      mixed: 'Hỗn hợp (Việt + Anh)',
    };
    return map[language] || language;
  }

  private mapCommunicationStyle(style: string): string {
    const map: Record<string, string> = {
      direct: 'Trực tiếp',
      polite: 'Lịch sự',
      casual: 'Thân mật',
      formal: 'Trang trọng',
      friendly: 'Thân thiện',
    };
    return map[style] || style;
  }

  private mapToneValue(tone: string): string {
    const map: Record<string, string> = {
      positive: 'Tích cực',
      neutral: 'Trung tính',
      negative: 'Tiêu cực',
      curious: 'Tò mò',
      hesitant: 'Do dự',
    };
    return map[tone] || tone;
  }

  private getDefaultPrompt(): string {
    return `Bạn là một nhân viên bán hàng chuyên nghiệp. 
Hãy trả lời khách hàng một cách thân thiện, tự nhiên và chuyên nghiệp.
Luôn gửi INTRO message đầy đủ thông tin sản phẩm ở đầu mỗi cuộc trò chuyện mới.`;
  }
}

export const systemPromptGenerator = new SystemPromptGenerator();

