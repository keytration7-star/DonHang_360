/**
 * Form Parser Service
 * Parse training form text thành structured data
 */

import { ParsedForm, SalesFlowStep } from '../../../shared/types/aiChat';
import { logger } from '../../../shared/utils/logger';

class FormParserService {
  /**
   * Parse form text thành structured data
   */
  parseForm(formText: string): ParsedForm {
    try {
      const parsed: ParsedForm = {
        rawSections: {},
      };

      // Normalize text
      const normalizedText = formText.trim();

      // Parse product info
      parsed.productInfo = this.parseProductInfo(normalizedText);

      // Parse sales flow
      parsed.salesFlow = this.parseSalesFlow(normalizedText);

      // Parse communication style
      parsed.communicationStyle = this.parseCommunicationStyle(normalizedText);

      // Parse common questions
      parsed.commonQuestions = this.parseCommonQuestions(normalizedText);

      logger.log('✅ Đã parse form thành công');
      return parsed;
    } catch (error) {
      logger.error('❌ Lỗi parse form:', error);
      throw error;
    }
  }

  /**
   * Parse product information
   */
  private parseProductInfo(text: string): ParsedForm['productInfo'] {
    const productInfo: ParsedForm['productInfo'] = {
      name: '',
      description: '',
      price: 0,
      currency: 'VND',
      variants: [],
      features: [],
    };

    // Tìm tên sản phẩm
    const nameMatch = text.match(/(?:tên|sản phẩm|product|name)[\s:]+([^\n]+)/i);
    if (nameMatch) {
      productInfo.name = nameMatch[1].trim();
    }

    // Tìm mô tả
    const descMatch = text.match(/(?:mô tả|description|giới thiệu)[\s:]+([^\n]+(?:\n[^\n]+)*?)(?=\n\n|\n(?:giá|price|variant|features)|$)/is);
    if (descMatch) {
      productInfo.description = descMatch[1].trim();
    }

    // Tìm giá
    const priceMatch = text.match(/(?:giá|price|giá bán)[\s:]+([\d.,]+)\s*([a-z]{3})?/i);
    if (priceMatch) {
      productInfo.price = parseFloat(priceMatch[1].replace(/,/g, ''));
      if (priceMatch[2]) {
        productInfo.currency = priceMatch[2].toUpperCase();
      }
    }

    // Tìm variants (màu sắc, size, etc.)
    const variantSection = text.match(/(?:variant|biến thể|màu sắc|size|kích thước)[\s:]+([^\n]+(?:\n[^\n]+)*?)(?=\n\n|$)/is);
    if (variantSection) {
      const variants = variantSection[1]
        .split(/[,\n]/)
        .map(v => v.trim())
        .filter(v => v.length > 0);
      productInfo.variants = variants;
    }

    // Tìm features
    const featureSection = text.match(/(?:features|tính năng|đặc điểm)[\s:]+([^\n]+(?:\n[^\n]+)*?)(?=\n\n|$)/is);
    if (featureSection) {
      const features = featureSection[1]
        .split(/[,\n•\-]/)
        .map(f => f.trim())
        .filter(f => f.length > 0);
      productInfo.features = features;
    }

    return productInfo;
  }

  /**
   * Parse sales flow (8 bước bán hàng)
   */
  private parseSalesFlow(text: string): SalesFlowStep[] {
    const steps: SalesFlowStep[] = [];

    // Tìm các bước (Bước 1, Bước 2, Step 1, etc.)
    const stepPattern = /(?:bước|step)\s*(\d+)[\s:]+([^\n]+(?:\n(?!bước|step)[^\n]+)*)/gi;
    let match;

    while ((match = stepPattern.exec(text)) !== null) {
      const stepNumber = parseInt(match[1], 10);
      const stepContent = match[2].trim();

      // Tách tên và mô tả
      const lines = stepContent.split('\n');
      const name = lines[0].trim();
      const description = lines.slice(1).join('\n').trim() || name;

      // Tìm triggers (từ khóa)
      const triggers: string[] = [];
      const triggerMatch = stepContent.match(/(?:trigger|từ khóa|keyword)[\s:]+([^\n]+)/i);
      if (triggerMatch) {
        triggers.push(...triggerMatch[1].split(',').map(t => t.trim()));
      }

      steps.push({
        step: stepNumber,
        name,
        description,
        triggers: triggers.length > 0 ? triggers : undefined,
      });
    }

    // Nếu không tìm thấy, tạo default 8 bước
    if (steps.length === 0) {
      steps.push(
        { step: 1, name: 'Chào hỏi', description: 'Chào hỏi khách hàng một cách thân thiện' },
        { step: 2, name: 'Tìm hiểu nhu cầu', description: 'Hỏi khách hàng về nhu cầu và sở thích' },
        { step: 3, name: 'Giới thiệu sản phẩm', description: 'Giới thiệu sản phẩm phù hợp' },
        { step: 4, name: 'Trả lời câu hỏi', description: 'Trả lời các câu hỏi của khách hàng' },
        { step: 5, name: 'Xử lý phản đối', description: 'Xử lý các phản đối và lo ngại' },
        { step: 6, name: 'Tạo động lực mua', description: 'Tạo động lực và sự cấp thiết' },
        { step: 7, name: 'Đề xuất đặt hàng', description: 'Đề xuất khách hàng đặt hàng' },
        { step: 8, name: 'Hoàn tất đơn hàng', description: 'Hướng dẫn hoàn tất đơn hàng' }
      );
    }

    return steps.sort((a, b) => a.step - b.step);
  }

  /**
   * Parse communication style
   */
  private parseCommunicationStyle(text: string): ParsedForm['communicationStyle'] {
    const style: ParsedForm['communicationStyle'] = {
      tone: 'friendly',
      language: 'vietnamese',
      useEmojis: true,
      abbreviations: [],
    };

    // Tìm tone
    const toneMatch = text.match(/(?:tone|giọng điệu|phong cách)[\s:]+(professional|friendly|casual|formal|chuyên nghiệp|thân thiện|thân mật|trang trọng)/i);
    if (toneMatch) {
      const tone = toneMatch[1].toLowerCase();
      if (tone.includes('professional') || tone.includes('chuyên nghiệp')) {
        style.tone = 'professional';
      } else if (tone.includes('casual') || tone.includes('thân mật')) {
        style.tone = 'casual';
      } else if (tone.includes('formal') || tone.includes('trang trọng')) {
        style.tone = 'formal';
      } else {
        style.tone = 'friendly';
      }
    }

    // Tìm language
    const langMatch = text.match(/(?:language|ngôn ngữ)[\s:]+(vietnamese|english|mixed|tiếng việt|tiếng anh|hỗn hợp)/i);
    if (langMatch) {
      const lang = langMatch[1].toLowerCase();
      if (lang.includes('english') || lang.includes('anh')) {
        style.language = 'english';
      } else if (lang.includes('mixed') || lang.includes('hỗn hợp')) {
        style.language = 'mixed';
      } else {
        style.language = 'vietnamese';
      }
    }

    // Tìm useEmojis
    const emojiMatch = text.match(/(?:emoji|biểu tượng)[\s:]+(yes|no|true|false|có|không)/i);
    if (emojiMatch) {
      const emoji = emojiMatch[1].toLowerCase();
      style.useEmojis = emoji.includes('yes') || emoji.includes('true') || emoji.includes('có');
    }

    // Tìm abbreviations
    const abbrevMatch = text.match(/(?:abbreviation|viết tắt|từ viết tắt)[\s:]+([^\n]+)/i);
    if (abbrevMatch) {
      style.abbreviations = abbrevMatch[1]
        .split(',')
        .map(a => a.trim())
        .filter(a => a.length > 0);
    }

    return style;
  }

  /**
   * Parse common questions
   */
  private parseCommonQuestions(text: string): ParsedForm['commonQuestions'] {
    const questions: ParsedForm['commonQuestions'] = [];

    // Tìm Q&A section
    const qaPattern = /(?:Q|Câu hỏi|Hỏi)[\s:]+([^\n?]+)\?[\s\n]+(?:A|Trả lời|Đáp)[\s:]+([^\n]+(?:\n(?!Q|Câu hỏi|Hỏi)[^\n]+)*)/gi;
    let match;

    while ((match = qaPattern.exec(text)) !== null) {
      questions.push({
        question: match[1].trim(),
        answer: match[2].trim(),
      });
    }

    return questions.length > 0 ? questions : undefined;
  }
}

export const formParserService = new FormParserService();

