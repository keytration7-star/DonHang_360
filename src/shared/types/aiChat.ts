/**
 * AI Chat Module - Types
 * Định nghĩa các types cho hệ thống AI Chat
 */

// ==================== AI Module Configuration ====================

export interface AIModule {
  id: string;
  name: string;
  description?: string;
  facebookPageId?: string;
  facebookPageName?: string;
  facebookPageAccessToken?: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  
  // Training data
  trainingData?: TrainingData;
  
  // AI Provider config
  aiProvider: AIProviderConfig;
  
  // Products & Media
  products: Product[];
  media: MediaItem[];
}

export interface TrainingData {
  // Parsed từ form
  productInfo?: {
    name: string;
    description: string;
    price: number;
    currency: string;
    variants?: string[];
    features?: string[];
  };
  
  salesFlow?: SalesFlowStep[];
  
  communicationStyle?: {
    tone: 'professional' | 'friendly' | 'casual' | 'formal';
    language: 'vietnamese' | 'english' | 'mixed';
    useEmojis: boolean;
    abbreviations: string[]; // Các từ viết tắt thường dùng
  };
  
  commonQuestions?: {
    question: string;
    answer: string;
  }[];
  
  // Raw form text (backup)
  rawFormText?: string;
}

export interface SalesFlowStep {
  step: number;
  name: string;
  description: string;
  triggers?: string[]; // Từ khóa để chuyển sang bước này
}

export interface AIProviderConfig {
  provider: 'deepseek' | 'gemini' | 'openai' | 'claude' | 'auto';
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  autoSelect?: boolean; // Tự động chọn provider (ưu tiên free)
  fallbackProvider?: 'deepseek' | 'gemini' | 'openai' | 'claude';
}

// ==================== Product & Media ====================

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  variants?: ProductVariant[];
  features?: string[];
  tags?: string[];
  category?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  name: string; // VD: "Màu xanh", "Size M"
  value: string; // VD: "blue", "M"
  price?: number; // Giá riêng (nếu khác)
  stock?: number;
}

export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  fileName: string;
  fileSize: number;
  
  // Metadata cho AI tìm kiếm
  metadata: MediaMetadata;
  
  createdAt: string;
  updatedAt: string;
}

export interface MediaMetadata {
  // Color mapping (cho tìm kiếm "áo xanh" -> gửi ảnh áo xanh)
  colors?: string[]; // ["blue", "xanh", "navy"]
  
  // Product mapping
  productIds?: string[]; // Liên kết với products
  
  // Variants
  variants?: string[]; // ["size-M", "color-blue"]
  
  // Features/Tags
  features?: string[]; // ["áo khoác", "chống nước"]
  tags?: string[]; // ["hot", "new", "sale"]
  
  // Description
  description?: string;
  
  // AI-generated tags (từ image recognition)
  aiTags?: string[];
}

// ==================== Conversation ====================

export interface Conversation {
  id: string;
  moduleId: string; // AI Module ID
  customerId: string; // Facebook User ID
  customerName?: string;
  customerProfile?: CustomerProfile;
  
  messages: Message[];
  
  // Status
  status: 'active' | 'closed' | 'archived';
  
  // Metadata
  startedAt: string;
  lastMessageAt: string;
  updatedAt: string;
  
  // Context
  currentSalesStep?: number;
  personality?: CustomerPersonality;
  
  // Summary (cho memory)
  summary?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  
  // Media attachments
  attachments?: MessageAttachment[];
  
  // Metadata
  timestamp: string;
  isRead: boolean;
  
  // AI metadata
  aiMetadata?: {
    provider?: string;
    model?: string;
    tokens?: number;
    reasoning?: string; // Lý do AI chọn response này
  };
}

export interface MessageAttachment {
  type: 'image' | 'video' | 'file';
  url: string;
  thumbnailUrl?: string;
  fileName?: string;
  fileSize?: number;
}

export interface CustomerProfile {
  facebookId: string;
  name?: string;
  profilePictureUrl?: string;
  locale?: string;
  timezone?: string;
  
  // Conversation history summary
  totalConversations: number;
  firstContactAt?: string;
  lastContactAt?: string;
  
  // Preferences (learned from conversations)
  preferences?: {
    preferredLanguage?: string;
    preferredCommunicationStyle?: string;
    interests?: string[];
  };
}

export interface CustomerPersonality {
  // Communication style
  communicationStyle: 'direct' | 'polite' | 'casual' | 'formal' | 'friendly';
  
  // Tone analysis
  tone: 'positive' | 'neutral' | 'negative' | 'curious' | 'hesitant';
  
  // Priorities (inferred from messages)
  priorities: {
    price: number; // 0-10
    quality: number;
    speed: number;
    service: number;
  };
  
  // Personality traits
  traits: {
    decisive: number; // 0-10
    detailOriented: number;
    priceSensitive: number;
    brandLoyal: number;
  };
  
  // Confidence level (how well we understand this customer)
  confidence: number; // 0-1
}

// ==================== Memory System ====================

export interface ConversationMemory {
  conversationId: string;
  
  // Immediate context (last N messages)
  immediateContext: Message[];
  
  // Summarized context (compressed history)
  summarizedContext: string;
  
  // Long-term memory (key facts)
  longTermMemory: {
    customerPreferences: string[];
    pastInteractions: string[];
    importantNotes: string[];
  };
  
  // Updated timestamp
  updatedAt: string;
}

// ==================== Form Parser ====================

export interface ParsedForm {
  productInfo?: {
    name: string;
    description: string;
    price: number;
    currency: string;
    variants?: string[];
    features?: string[];
  };
  
  salesFlow?: SalesFlowStep[];
  
  communicationStyle?: {
    tone: 'professional' | 'friendly' | 'casual' | 'formal';
    language: 'vietnamese' | 'english' | 'mixed';
    useEmojis: boolean;
    abbreviations: string[];
  };
  
  commonQuestions?: {
    question: string;
    answer: string;
  }[];
  
  // Raw sections (for reference)
  rawSections?: {
    [key: string]: string;
  };
}

// ==================== AI Response ====================

export interface AIResponse {
  content: string;
  attachments?: MessageAttachment[]; // Media to send
  reasoning?: string; // Why AI chose this response
  metadata?: {
    provider: string;
    model: string;
    tokens: number;
    temperature: number;
  };
}

// ==================== Facebook Integration ====================

export interface FacebookWebhookEvent {
  object: 'page';
  entry: FacebookWebhookEntry[];
}

export interface FacebookWebhookEntry {
  id: string; // Page ID
  time: number;
  messaging: FacebookMessagingEvent[];
}

export interface FacebookMessagingEvent {
  sender: {
    id: string; // User ID
  };
  recipient: {
    id: string; // Page ID
  };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    attachments?: {
      type: 'image' | 'video' | 'audio' | 'file';
      payload: {
        url?: string;
        sticker_id?: number;
      };
    }[];
  };
  postback?: {
    title: string;
    payload: string;
  };
}

export interface FacebookSendMessageRequest {
  recipient: {
    id: string; // User ID
  };
  message: {
    text?: string;
    attachment?: {
      type: 'image' | 'video' | 'audio' | 'file';
      payload: {
        url: string;
        is_reusable?: boolean;
      };
    };
  };
  messaging_type?: 'RESPONSE' | 'UPDATE' | 'MESSAGE_TAG';
  tag?: string;
}

