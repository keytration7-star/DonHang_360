/**
 * Facebook Graph API Service
 * Gửi/nhận messages, quản lý page info
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from '../../../shared/utils/logger';

export interface FacebookPageInfo {
  id: string;
  name: string;
  access_token: string;
}

export interface FacebookMessage {
  id: string;
  message?: string;
  from: {
    id: string;
    name?: string;
  };
  timestamp: string;
  attachments?: Array<{
    type: 'image' | 'video' | 'audio' | 'file';
    payload: {
      url?: string;
    };
  }>;
}

export interface SendMessageParams {
  recipientId: string;
  message: string;
  mediaUrls?: string[];
}

export interface SendMessageResponse {
  messageId: string;
  success: boolean;
  error?: string;
}

class FacebookApiService {
  private axiosInstance: AxiosInstance | null = null;
  private pageAccessToken: string | null = null;
  private pageId: string | null = null;

  /**
   * Khởi tạo với Page Access Token
   */
  initialize(pageId: string, accessToken: string): void {
    this.pageId = pageId;
    this.pageAccessToken = accessToken;

    this.axiosInstance = axios.create({
      baseURL: 'https://graph.facebook.com/v18.0',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        // Thêm access token vào params
        if (config.params) {
          config.params.access_token = this.pageAccessToken;
        } else {
          config.params = { access_token: this.pageAccessToken };
        }
        return config;
      },
      (error) => {
        logger.error('❌ Facebook API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        return response;
      },
      (error: AxiosError) => {
        const errorData = error.response?.data as any;
        logger.error('❌ Facebook API Response Error:', {
          status: error.response?.status,
          message: errorData?.error?.message || error.message,
          type: errorData?.error?.type,
          code: errorData?.error?.code,
        });
        return Promise.reject(error);
      }
    );

    logger.log('✅ Facebook API Service đã được khởi tạo');
  }

  /**
   * Kiểm tra kết nối với Facebook API
   */
  async testConnection(): Promise<{ success: boolean; message: string; pageInfo?: FacebookPageInfo }> {
    if (!this.axiosInstance || !this.pageId || !this.pageAccessToken) {
      return {
        success: false,
        message: 'Chưa khởi tạo Facebook API Service. Vui lòng cung cấp Page ID và Access Token.',
      };
    }

    try {
      // Lấy thông tin page
      const response = await this.axiosInstance.get(`/${this.pageId}`, {
        params: {
          fields: 'id,name,access_token',
        },
      });

      const pageInfo: FacebookPageInfo = {
        id: response.data.id,
        name: response.data.name,
        access_token: response.data.access_token || this.pageAccessToken!,
      };

      return {
        success: true,
        message: `Kết nối thành công với page "${pageInfo.name}"`,
        pageInfo,
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message || 'Lỗi không xác định';
      return {
        success: false,
        message: `Lỗi kết nối: ${errorMessage}`,
      };
    }
  }

  /**
   * Gửi text message
   */
  async sendTextMessage(recipientId: string, message: string): Promise<SendMessageResponse> {
    if (!this.axiosInstance || !this.pageAccessToken) {
      throw new Error('Facebook API Service chưa được khởi tạo');
    }

    try {
      const response = await this.axiosInstance.post(
        `/me/messages`,
        {
          recipient: {
            id: recipientId,
          },
          message: {
            text: message,
          },
        }
      );

      return {
        messageId: response.data.message_id,
        success: true,
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message || 'Lỗi không xác định';
      logger.error('❌ Lỗi gửi message:', errorMessage);
      return {
        messageId: '',
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Gửi message với media (image/video)
   */
  async sendMediaMessage(recipientId: string, mediaUrl: string, mediaType: 'image' | 'video' = 'image'): Promise<SendMessageResponse> {
    if (!this.axiosInstance || !this.pageAccessToken) {
      throw new Error('Facebook API Service chưa được khởi tạo');
    }

    try {
      const response = await this.axiosInstance.post(
        `/me/messages`,
        {
          recipient: {
            id: recipientId,
          },
          message: {
            attachment: {
              type: mediaType,
              payload: {
                url: mediaUrl,
                is_reusable: true,
              },
            },
          },
        }
      );

      return {
        messageId: response.data.message_id,
        success: true,
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message || 'Lỗi không xác định';
      logger.error('❌ Lỗi gửi media:', errorMessage);
      return {
        messageId: '',
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Gửi message với text + media
   */
  async sendMessage(params: SendMessageParams): Promise<SendMessageResponse> {
    const { recipientId, message, mediaUrls } = params;

    // Nếu có media, gửi media trước, sau đó gửi text
    if (mediaUrls && mediaUrls.length > 0) {
      // Gửi tất cả media
      const mediaPromises = mediaUrls.map((url) => {
        // Xác định loại media từ URL
        const isVideo = url.match(/\.(mp4|mov|avi|webm)$/i);
        const mediaType = isVideo ? 'video' : 'image';
        return this.sendMediaMessage(recipientId, url, mediaType);
      });

      await Promise.all(mediaPromises);

      // Sau đó gửi text message
      if (message) {
        return await this.sendTextMessage(recipientId, message);
      }

      return {
        messageId: 'media_sent',
        success: true,
      };
    }

    // Chỉ gửi text
    return await this.sendTextMessage(recipientId, message);
  }

  /**
   * Lấy thông tin user từ sender ID
   */
  async getUserInfo(userId: string): Promise<{ id: string; name?: string; profilePic?: string } | null> {
    if (!this.axiosInstance || !this.pageAccessToken) {
      throw new Error('Facebook API Service chưa được khởi tạo');
    }

    try {
      const response = await this.axiosInstance.get(`/${userId}`, {
        params: {
          fields: 'id,name,profile_pic',
        },
      });

      return {
        id: response.data.id,
        name: response.data.name,
        profilePic: response.data.profile_pic,
      };
    } catch (error: any) {
      logger.error('❌ Lỗi lấy user info:', error.response?.data?.error?.message || error.message);
      return null;
    }
  }

  /**
   * Lấy conversation messages (để xem lịch sử)
   */
  async getConversationMessages(conversationId: string, limit: number = 50): Promise<FacebookMessage[]> {
    if (!this.axiosInstance || !this.pageAccessToken) {
      throw new Error('Facebook API Service chưa được khởi tạo');
    }

    try {
      const response = await this.axiosInstance.get(`/${conversationId}/messages`, {
        params: {
          fields: 'id,message,from,created_time,attachments',
          limit,
        },
      });

      return (response.data.data || []).map((msg: any) => ({
        id: msg.id,
        message: msg.message,
        from: msg.from,
        timestamp: msg.created_time,
        attachments: msg.attachments?.data || [],
      }));
    } catch (error: any) {
      logger.error('❌ Lỗi lấy messages:', error.response?.data?.error?.message || error.message);
      return [];
    }
  }

  /**
   * Subscribe page để nhận webhooks
   * Note: Cần gọi từ backend hoặc qua Facebook Developer Console
   */
  async subscribeToPage(): Promise<{ success: boolean; message: string }> {
    if (!this.pageId || !this.pageAccessToken) {
      return {
        success: false,
        message: 'Chưa khởi tạo Page ID và Access Token',
      };
    }

    // Note: Subscription thường được setup qua Facebook Developer Console
    // hoặc qua backend server với webhook URL
    logger.log('ℹ️ Để subscribe webhook, vui lòng cấu hình trong Facebook Developer Console:');
    logger.log(`   - Webhook URL: [Your Webhook URL]`);
    logger.log(`   - Verify Token: [Your Verify Token]`);
    logger.log(`   - Page ID: ${this.pageId}`);

    return {
      success: true,
      message: 'Vui lòng cấu hình webhook trong Facebook Developer Console',
    };
  }
}

export const facebookApiService = new FacebookApiService();


