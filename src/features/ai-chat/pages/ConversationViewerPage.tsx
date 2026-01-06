/**
 * Conversation Viewer Page
 * Xem và test conversations với AI
 */

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Loader, User, Bot, Image as ImageIcon } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { AIModule, Conversation, Message } from '../../../shared/types/aiChat';
import { aiChatDatabaseService } from '../../../core/services/aiChat/aiChatDatabaseService';
import { aiChatOrchestrator } from '../../../core/services/aiChat/aiChatOrchestrator';
import { logger } from '../../../shared/utils/logger';

const ConversationViewerPage = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [module, setModule] = useState<AIModule | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testCustomerId, setTestCustomerId] = useState(`test_${Date.now()}`);

  useEffect(() => {
    if (moduleId) {
      loadData();
    }
  }, [moduleId]);

  useEffect(() => {
    // Auto scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConversation?.messages]);

  const loadData = async () => {
    if (!moduleId) return;

    try {
      setLoading(true);
      const loadedModule = await aiChatDatabaseService.getModule(moduleId);
      if (!loadedModule) {
        alert('Module không tồn tại');
        navigate('/ai-chat');
        return;
      }
      setModule(loadedModule);

      // Load conversations
      const allConversations = await aiChatDatabaseService.getConversationsByModule(moduleId);
      setConversations(allConversations);
      
      // Select first conversation or create new test conversation
      if (allConversations.length > 0) {
        setSelectedConversation(allConversations[0]);
      } else {
        // Create a test conversation
        const testConversation = await aiChatDatabaseService.createConversation({
          moduleId,
          customerId: testCustomerId,
          customerName: 'Test User',
          messages: [],
          status: 'active',
          startedAt: new Date().toISOString(),
          lastMessageAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        setSelectedConversation(testConversation);
        setConversations([testConversation]);
      }
    } catch (error) {
      logger.error('Lỗi load data:', error);
      alert('Lỗi load data: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestMessage = async () => {
    if (!module || !testMessage.trim() || sending) return;

    try {
      setSending(true);

      // Add user message to conversation
      const userMessage: Message = {
        id: `msg_${Date.now()}`,
        conversationId: selectedConversation!.id,
        role: 'user',
        content: testMessage,
        timestamp: new Date().toISOString(),
        isRead: false,
      };

      await aiChatDatabaseService.addMessage(selectedConversation!.id, userMessage);

      // Get AI response
      const response = await aiChatOrchestrator.handleMessage(
        module.id,
        testCustomerId,
        testMessage,
        module
      );

      // Add AI response to conversation
      const aiMessage: Message = {
        id: `msg_${Date.now()}_ai`,
        conversationId: selectedConversation!.id,
        role: 'assistant',
        content: response.text,
        attachments: response.media.map(url => ({ type: 'image' as const, url })),
        timestamp: new Date().toISOString(),
        isRead: false,
      };

      await aiChatDatabaseService.addMessage(selectedConversation!.id, aiMessage);

      // Reload conversation
      const updatedConversation = await aiChatDatabaseService.getConversation(selectedConversation!.id);
      if (updatedConversation) {
        setSelectedConversation(updatedConversation);
        setConversations(prev => prev.map(c => c.id === updatedConversation.id ? updatedConversation : c));
      }

      setTestMessage('');
    } catch (error) {
      logger.error('Lỗi gửi message:', error);
      alert('Lỗi gửi message: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSending(false);
    }
  };

  const handleSelectConversation = async (conversationId: string) => {
    const conversation = await aiChatDatabaseService.getConversation(conversationId);
    if (conversation) {
      setSelectedConversation(conversation);
      setTestCustomerId(conversation.customerId);
    }
  };

  const handleCreateNewConversation = async () => {
    if (!module) return;

    try {
      const newCustomerId = `test_${Date.now()}`;
      const newConversation = await aiChatDatabaseService.createConversation({
        moduleId: module.id,
        customerId: newCustomerId,
        customerName: 'Test User',
        messages: [],
        status: 'active',
        startedAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setSelectedConversation(newConversation);
      setConversations(prev => [newConversation, ...prev]);
      setTestCustomerId(newCustomerId);
    } catch (error) {
      logger.error('Lỗi tạo conversation:', error);
      alert('Lỗi tạo conversation: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-600">Module không tồn tại</p>
          <button
            onClick={() => navigate('/ai-chat')}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/ai-chat')}
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Test Conversations - {module.name}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Test và xem conversations với AI
              </p>
            </div>
          </div>
          <button
            onClick={handleCreateNewConversation}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm"
          >
            Tạo Conversation Mới
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Conversations List */}
        <div className="w-64 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Conversations ({conversations.length})
            </h2>
            <div className="space-y-2">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={`w-full text-left p-3 rounded-md text-sm transition-colors ${
                    selectedConversation?.id === conv.id
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-900 dark:text-primary-200'
                      : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
                  }`}
                >
                  <div className="font-medium truncate">
                    {conv.customerName || conv.customerId}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {conv.messages.length} messages
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {new Date(conv.lastMessageAt).toLocaleString('vi-VN')}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedConversation.messages.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <Bot size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Chưa có messages nào. Hãy gửi message đầu tiên!</p>
                  </div>
                ) : (
                  selectedConversation.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {message.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                          <Bot size={16} className="text-primary-600 dark:text-primary-400" />
                        </div>
                      )}
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          message.role === 'user'
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {message.attachments.map((att, idx) => (
                              <div key={idx} className="rounded-md overflow-hidden">
                                {att.type === 'image' && (
                                  <img
                                    src={att.url}
                                    alt={`Attachment ${idx + 1}`}
                                    className="max-w-full h-auto"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className={`text-xs mt-2 ${
                          message.role === 'user'
                            ? 'text-primary-100'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {new Date(message.timestamp).toLocaleTimeString('vi-VN')}
                        </div>
                      </div>
                      {message.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                          <User size={16} className="text-gray-600 dark:text-gray-300" />
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendTestMessage()}
                    placeholder="Nhập message để test AI..."
                    disabled={sending}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                  />
                  <button
                    onClick={handleSendTestMessage}
                    disabled={sending || !testMessage.trim()}
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {sending ? (
                      <Loader size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                    Gửi
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
              <p>Chọn một conversation để xem messages</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConversationViewerPage;

