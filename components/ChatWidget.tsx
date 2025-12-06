'use client';

import { useState, useEffect, useRef } from 'react';
import { renderTextWithLatex } from './LatexRenderer';

interface Message {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  imageUrls?: string[];
}

interface Conversation {
  id: number;
  title: string;
  type: 'essay_review' | 'free_chat';
  lastMessageAt: string | null;
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Auto-create conversation if none exists
      if (!currentConversationId) {
        createNewConversation();
      } else {
        loadMessages(currentConversationId);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (currentConversationId) {
      loadMessages(currentConversationId);
    }
  }, [currentConversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Cleanup image preview URLs when component unmounts
  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, []);

  // Listen for external messages (from other components)
  useEffect(() => {
    const handleExternalMessage = async (event: CustomEvent<{ message: string }>) => {
      const { message } = event.detail;
      if (!message || !message.trim()) return;

      // Open chat widget if not already open
      setIsOpen(true);

      // Wait a bit for widget to open
      await new Promise(resolve => setTimeout(resolve, 300));

      // Ensure we have a conversation
      let convId = currentConversationId;
      if (!convId) {
        try {
          const token = localStorage.getItem('token');
          if (!token) return;

          const response = await fetch('/api/conversations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              type: 'free_chat',
            }),
          });

          const data = await response.json();
          if (data.conversation) {
            convId = data.conversation.id;
            setCurrentConversationId(convId);
            setMessages([]);
          }
        } catch (error) {
          console.error('Failed to create conversation:', error);
          return;
        }
      }

      // Wait a bit more for conversation to be set
      await new Promise(resolve => setTimeout(resolve, 200));

      // Send message
      if (convId) {
        setLoading(true);

        const tempUserMessage: Message = {
          id: Date.now(),
          role: 'user',
          content: message,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, tempUserMessage]);

        try {
          const token = localStorage.getItem('token');
          if (!token) return;

          const response = await fetch(`/api/conversations/${convId}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              message: message,
            }),
          });

          const data = await response.json();
          if (data.assistantMessage) {
            setMessages((prev) => [...prev, data.assistantMessage]);
          }
        } catch (error) {
          console.error('Failed to send external message:', error);
          setMessages((prev) => prev.filter((m) => m.id !== tempUserMessage.id));
          
          // Show error message
          const errorMessage: Message = {
            id: Date.now(),
            role: 'assistant',
            content: error instanceof Error 
              ? `Xin lỗi, đã có lỗi xảy ra: ${error.message}` 
              : 'Xin lỗi, đã có lỗi xảy ra khi gửi tin nhắn. Vui lòng thử lại.',
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, errorMessage]);
        } finally {
          setLoading(false);
        }
      }
    };

    const eventType = 'chatWidget:sendMessage';
    window.addEventListener(eventType, handleExternalMessage as unknown as EventListener);

    return () => {
      const eventType = 'chatWidget:sendMessage';
      window.removeEventListener(eventType, handleExternalMessage as unknown as EventListener);
    };
  }, [currentConversationId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/conversations', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.conversations) {
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const loadMessages = async (conversationId: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const createNewConversation = async (): Promise<Conversation | null> => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No token found when creating conversation');
        return null;
      }

      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'free_chat',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create conversation');
      }

      const data = await response.json();
      if (data.conversation && data.conversation.id) {
        setConversations([data.conversation, ...conversations]);
        setCurrentConversationId(data.conversation.id);
        setMessages([]);
        return data.conversation;
      } else {
        console.error('Invalid conversation data:', data);
        return null;
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw error; // Re-throw to handle in calling function
    }
  };

  const uploadImages = async (files: File[]): Promise<string[]> => {
    const token = localStorage.getItem('token');
    if (!token) return [];

    const uploadedUrls: string[] = [];

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        const data = await response.json();
        if (data.url) {
          uploadedUrls.push(data.url);
        }
      } catch (error) {
        console.error('Failed to upload image:', error);
      }
    }

    return uploadedUrls;
  };

  const sendMessage = async () => {
    console.log('sendMessage called', { input: input.trim(), selectedImages: selectedImages.length, loading });
    
    if ((!input.trim() && selectedImages.length === 0) || loading) {
      console.log('sendMessage blocked: no input/images or loading');
      return;
    }

    // Ensure we have a conversation
    let convId = currentConversationId;
    console.log('Current conversation ID:', convId);
    if (!convId) {
      console.log('Creating new conversation...');
      try {
        const newConv = await createNewConversation();
        console.log('New conversation created:', newConv);
        if (newConv && newConv.id) {
          convId = newConv.id;
          setCurrentConversationId(convId);
        } else {
          console.error('Failed to create conversation: no ID returned');
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error('Failed to create conversation:', error);
        setLoading(false);
        // Show error message
        const errorMessage: Message = {
          id: Date.now(),
          role: 'assistant',
          content: 'Không thể tạo cuộc trò chuyện mới. Vui lòng thử lại.',
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        return;
      }
    }
    
    if (!convId) {
      console.error('No conversation ID available');
      setLoading(false);
      return;
    }
    
    console.log('Using conversation ID:', convId);

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // Upload images first
    let imageUrls: string[] = [];
    if (selectedImages.length > 0) {
      imageUrls = await uploadImages(selectedImages);
      setSelectedImages([]);
      setImagePreviews([]);
    }

    // Add user message to UI immediately
    const tempUserMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: userMessage || (imageUrls.length > 0 ? '[Ảnh]' : ''),
      createdAt: new Date().toISOString(),
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Ensure message is never empty
      const finalMessage = userMessage.trim() || (imageUrls.length > 0 ? 'Xem ảnh' : 'Nhắn tin');
      
      const response = await fetch(`/api/conversations/${convId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: finalMessage,
          ...(imageUrls.length > 0 && { imageUrls }),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      const data = await response.json();
      
      // Remove temp message and add real messages from API
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== tempUserMessage.id);
        if (data.userMessage) {
          filtered.push({
            id: data.userMessage.id,
            role: data.userMessage.role,
            content: data.userMessage.content,
            createdAt: data.userMessage.createdAt,
            imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
          });
        }
        if (data.assistantMessage) {
          filtered.push({
            id: data.assistantMessage.id,
            role: data.assistantMessage.role,
            content: data.assistantMessage.content,
            createdAt: data.assistantMessage.createdAt,
          });
        }
        return filtered;
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove temp message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMessage.id));
      
      // Show error message to user
      const errorMessage: Message = {
        id: Date.now(),
        role: 'assistant',
        content: error instanceof Error 
          ? `Xin lỗi, đã có lỗi xảy ra: ${error.message}` 
          : 'Xin lỗi, đã có lỗi xảy ra khi gửi tin nhắn. Vui lòng thử lại.',
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Chat Button - Fixed at bottom right */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 transition flex items-center justify-center z-[9999] bg-transparent border-none p-0 cursor-pointer"
        style={{ 
          position: 'fixed', 
          bottom: '1.5rem', 
          right: '1.5rem',
        }}
        aria-label="Open chat"
      >
        <svg
          className="w-8 h-8"
          style={{ width: '32px', height: '32px', color: 'var(--color-primary-orange)' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
          <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor"/>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 13h6"
          />
        </svg>
      </button>

      {/* Chat Widget */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[600px] bg-white rounded-lg shadow-2xl flex flex-col z-50 border border-gray-200">
          {/* Header */}
          <div 
            className="text-white rounded-t-lg flex justify-between items-center pt-4 pl-4"
            style={{ background: 'linear-gradient(135deg, var(--color-primary-orange), var(--color-primary-orange-light))' }}
          >
            <h3 className="font-semibold !text-white">Trợ lý học tập AI</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:opacity-80 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-4 max-w-[80%]">
                  <p className="text-sm text-gray-700">
                    Hãy hỏi mình bất cứ câu hỏi thuộc bất cứ môn học / chủ đề nào mà bạn đang thắc mắc. Mình sẽ giải đáp tận tình, giúp bạn hiểu rõ vấn đề.
                  </p>
                </div>
              </div>
            )}
            {messages
              .filter((m) => m.role !== 'system')
              .map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                    style={message.role === 'user' ? {
                      background: 'linear-gradient(135deg, var(--color-primary-orange), var(--color-primary-orange-light))',
                    } : {}}
                  >
                    {message.content && (
                      <div className="text-sm whitespace-pre-wrap mb-2">
                        {renderTextWithLatex(message.content)}
                      </div>
                    )}
                    {message.imageUrls && message.imageUrls.length > 0 && (
                      <div className="space-y-2">
                        {message.imageUrls.map((url, idx) => (
                          <img
                            key={idx}
                            src={url}
                            alt={`Uploaded image ${idx + 1}`}
                            className="max-w-full h-auto rounded-lg"
                            style={{ maxHeight: '200px' }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Image Previews */}
          {imagePreviews.length > 0 && (
            <div className="border-t border-gray-200 p-4">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {imagePreviews.map((preview, idx) => (
                  <div key={idx} className="relative flex-shrink-0">
                    <img
                      src={preview}
                      alt={`Preview ${idx + 1}`}
                      className="w-20 h-20 object-cover rounded-lg border border-gray-300"
                    />
                    <button
                      onClick={() => {
                        setSelectedImages((prev) => prev.filter((_, i) => i !== idx));
                        setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Input Area - Fixed at bottom */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition"
                title="Chọn ảnh"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length === 0) return;

                  // Validate file size (max 5MB each)
                  const maxSize = 5 * 1024 * 1024;
                  const validFiles = files.filter((file) => {
                    if (file.size > maxSize) {
                      alert(`File ${file.name} quá lớn. Kích thước tối đa là 5MB.`);
                      return false;
                    }
                    return true;
                  });

                  setSelectedImages((prev) => [...prev, ...validFiles]);

                  // Create previews
                  validFiles.forEach((file) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setImagePreviews((prev) => [...prev, reader.result as string]);
                    };
                    reader.readAsDataURL(file);
                  });

                  // Reset input
                  e.target.value = '';
                }}
              />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none transition"
                style={{
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary-orange)';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(255, 107, 53, 0.2)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#d1d5db';
                  e.currentTarget.style.boxShadow = '';
                }}
                disabled={loading}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Send button clicked', {
                    input: input,
                    inputTrimmed: input.trim(),
                    selectedImages: selectedImages.length,
                    loading,
                    disabled: loading || (!input.trim() && selectedImages.length === 0)
                  });
                  sendMessage();
                }}
                disabled={loading || (!input.trim() && selectedImages.length === 0)}
                className="px-4 py-2 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                title={loading ? 'Đang gửi...' : (!input.trim() && selectedImages.length === 0) ? 'Vui lòng nhập tin nhắn hoặc chọn ảnh' : 'Gửi tin nhắn'}
                style={{ 
                  background: 'linear-gradient(135deg, var(--color-primary-orange), var(--color-primary-orange-light))',
                }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, var(--color-primary-orange-light), var(--color-primary-orange))';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, var(--color-primary-orange), var(--color-primary-orange-light))';
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

