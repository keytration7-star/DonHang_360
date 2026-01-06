/**
 * AI Provider Service
 * Quản lý nhiều AI providers (DeepSeek, Gemini, OpenAI, Claude)
 * Hỗ trợ auto-select (ưu tiên free) và fallback
 */

import { AIProviderConfig, AIResponse } from '../../../shared/types/aiChat';
import { logger } from '../../../shared/utils/logger';

interface AIProvider {
  name: string;
  isFree: boolean;
  sendMessage: (config: AIProviderConfig, systemPrompt: string, messages: Array<{ role: 'user' | 'assistant'; content: string }>) => Promise<AIResponse>;
}

class AIProviderService {
  private providers: Map<string, AIProvider> = new Map();

  constructor() {
    // Register providers
    this.registerProvider('deepseek', {
      name: 'DeepSeek',
      isFree: true,
      sendMessage: this.deepseekSendMessage.bind(this),
    });

    this.registerProvider('gemini', {
      name: 'Google Gemini',
      isFree: true,
      sendMessage: this.geminiSendMessage.bind(this),
    });

    this.registerProvider('openai', {
      name: 'OpenAI',
      isFree: false,
      sendMessage: this.openaiSendMessage.bind(this),
    });

    this.registerProvider('claude', {
      name: 'Claude',
      isFree: false,
      sendMessage: this.claudeSendMessage.bind(this),
    });
  }

  private registerProvider(name: string, provider: AIProvider): void {
    this.providers.set(name, provider);
  }

  /**
   * Gửi message đến AI provider
   */
  async sendMessage(
    config: AIProviderConfig,
    systemPrompt: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<AIResponse> {
    try {
      // Auto-select provider nếu cần
      const providerName = config.provider === 'auto' 
        ? this.selectProvider(config)
        : config.provider;

      const provider = this.providers.get(providerName);
      if (!provider) {
        throw new Error(`Provider ${providerName} không tồn tại`);
      }

      logger.log(`🤖 Đang gửi message đến ${provider.name}...`);

      try {
        const response = await provider.sendMessage(config, systemPrompt, messages);
        logger.log(`✅ Nhận response từ ${provider.name}`);
        return response;
      } catch (error) {
        // Fallback nếu có
        if (config.fallbackProvider && config.fallbackProvider !== providerName) {
          logger.warn(`⚠️ ${provider.name} lỗi, chuyển sang ${config.fallbackProvider}...`);
          const fallbackProvider = this.providers.get(config.fallbackProvider);
          if (fallbackProvider) {
            return await fallbackProvider.sendMessage(config, systemPrompt, messages);
          }
        }
        throw error;
      }
    } catch (error) {
      logger.error('❌ Lỗi gửi message đến AI:', error);
      throw error;
    }
  }

  /**
   * Tự động chọn provider (ưu tiên free)
   */
  private selectProvider(config: AIProviderConfig): string {
    if (config.autoSelect) {
      // Ưu tiên free providers
      const freeProviders = Array.from(this.providers.entries())
        .filter(([_, provider]) => provider.isFree)
        .map(([name]) => name);

      if (freeProviders.length > 0) {
        // Ưu tiên DeepSeek (thường free và tốt)
        if (freeProviders.includes('deepseek')) {
          return 'deepseek';
        }
        return freeProviders[0];
      }
    }

    // Fallback về DeepSeek
    return 'deepseek';
  }

  /**
   * DeepSeek API
   */
  private async deepseekSendMessage(
    config: AIProviderConfig,
    systemPrompt: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<AIResponse> {
    if (!config.apiKey) {
      throw new Error('DeepSeek API key chưa được cấu hình');
    }

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: config.temperature || 0.7,
        max_tokens: config.maxTokens || 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error: ${error}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content || '',
      metadata: {
        provider: 'deepseek',
        model: data.model || config.model || 'deepseek-chat',
        tokens: data.usage?.total_tokens || 0,
        temperature: config.temperature || 0.7,
      },
    };
  }

  /**
   * Gemini API
   */
  private async geminiSendMessage(
    config: AIProviderConfig,
    systemPrompt: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<AIResponse> {
    if (!config.apiKey) {
      throw new Error('Gemini API key chưa được cấu hình');
    }

    // Combine system prompt với messages
    const fullMessages = [
      { role: 'user', content: `${systemPrompt}\n\n${messages.map(m => `${m.role}: ${m.content}`).join('\n')}` },
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.model || 'gemini-pro'}:generateContent?key=${config.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: fullMessages.map(m => ({ text: m.content })),
            },
          ],
          generationConfig: {
            temperature: config.temperature || 0.7,
            maxOutputTokens: config.maxTokens || 2000,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${error}`);
    }

    const data = await response.json();
    return {
      content: data.candidates[0]?.content?.parts[0]?.text || '',
      metadata: {
        provider: 'gemini',
        model: data.model || config.model || 'gemini-pro',
        tokens: 0, // Gemini không trả về token count trong response này
        temperature: config.temperature || 0.7,
      },
    };
  }

  /**
   * OpenAI API
   */
  private async openaiSendMessage(
    config: AIProviderConfig,
    systemPrompt: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<AIResponse> {
    if (!config.apiKey) {
      throw new Error('OpenAI API key chưa được cấu hình');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: config.temperature || 0.7,
        max_tokens: config.maxTokens || 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content || '',
      metadata: {
        provider: 'openai',
        model: data.model || config.model || 'gpt-4',
        tokens: data.usage?.total_tokens || 0,
        temperature: config.temperature || 0.7,
      },
    };
  }

  /**
   * Claude API
   */
  private async claudeSendMessage(
    config: AIProviderConfig,
    systemPrompt: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<AIResponse> {
    if (!config.apiKey) {
      throw new Error('Claude API key chưa được cấu hình');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model || 'claude-3-sonnet-20240229',
        system: systemPrompt,
        messages: messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
        max_tokens: config.maxTokens || 2000,
        temperature: config.temperature || 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${error}`);
    }

    const data = await response.json();
    return {
      content: data.content[0]?.text || '',
      metadata: {
        provider: 'claude',
        model: data.model || config.model || 'claude-3-sonnet-20240229',
        tokens: data.usage?.input_tokens + data.usage?.output_tokens || 0,
        temperature: config.temperature || 0.7,
      },
    };
  }
}

export const aiProviderService = new AIProviderService();

