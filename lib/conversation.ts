import OpenAI from 'openai';
import { prisma } from './prisma';
import { getCachedResponse, saveCachedResponse } from './conversation-cache';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key',
});

// Model pricing per 1M tokens (approximate)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
};

// Configuration
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const CHEAP_MODEL = process.env.OPENAI_CHEAP_MODEL || 'gpt-3.5-turbo';
const MONITORING_ENABLED = process.env.OPENAI_MONITORING_ENABLED !== 'false';

/**
 * Select appropriate model based on question complexity
 */
function selectModel(
  question: string,
  imageUrls?: string[],
  responseFormat?: { type: string } | null
): string {
  // Always use GPT-4o for images (better vision)
  if (imageUrls && imageUrls.length > 0) {
    return DEFAULT_MODEL;
  }

  // Use GPT-4o if response format is JSON (needs more precision)
  if (responseFormat?.type === 'json_object') {
    return DEFAULT_MODEL;
  }

  // Check question complexity
  const questionLength = question.length;
  const hasComplexKeywords = /(calculate|solve|prove|derive|analyze|explain in detail|giải|chứng minh|phân tích|tính toán)/i.test(question);

  // Use cheaper model for simple questions
  if (questionLength < 100 && !hasComplexKeywords) {
    return CHEAP_MODEL;
  }

  // Default to expensive model for complex questions
  return DEFAULT_MODEL;
}

/**
 * Calculate optimal max_tokens based on response format and complexity
 */
function calculateMaxTokens(responseFormat?: { type: string } | null, question?: string): number {
  let baseTokens = 1000; // Base answer length

  if (responseFormat?.type === 'json_object') {
    baseTokens = 1500; // JSON responses might be longer
  }

  // Increase for complex questions
  if (question) {
    const hasComplexKeywords = /(explain in detail|phân tích chi tiết|giải thích đầy đủ)/i.test(question);
    if (hasComplexKeywords) {
      baseTokens = 2000;
    }
  }

  // Cap at reasonable maximum
  return Math.min(baseTokens, 3000);
}

/**
 * Calculate estimated cost based on model and tokens
 */
function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-3.5-turbo'];
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Build enhanced prompt based on user and config (enhanced version based on thamkhao.ts)
 */
function buildEnhancedPrompt(
  systemPrompt: string,
  userLevel?: number | null,
  userGrade?: number | null,
  userMessage?: string
): string {
  let prompt = systemPrompt;

  // Add grade level context if available
  const grade = userGrade || (userLevel ? Math.floor((userLevel - 1) / 3) + 1 : null);
  if (grade) {
    prompt = `Bạn là một người bạn học tập thân thiện và nhiệt tình cho học sinh lớp ${grade}. Luôn trả lời bằng tiếng Việt (Tiếng Việt). ` + prompt;
  } else {
    prompt = `Bạn là một người bạn học tập thân thiện và nhiệt tình. Luôn trả lời bằng tiếng Việt (Tiếng Việt). ` + prompt;
  }
  
  // Add instructions about addressing and response style
  prompt += `\n\nQUAN TRỌNG VỀ CÁCH XƯNG HÔ:\n` +
    `- Luôn xưng "mình" và gọi học viên là "bạn"\n` +
    `- Sử dụng cách xưng hô tự nhiên, thân thiện như những người bạn thân với nhau\n` +
    `- Tránh xưng "cô", "thầy", "em" hoặc các cách xưng hô trang trọng khác\n\n` +
    `QUAN TRỌNG VỀ CÁCH TRẢ LỜI:\n` +
    `- TUYỆT ĐỐI KHÔNG trực tiếp đưa ra kết quả cuối cùng hoặc đáp án của câu hỏi mà học viên đang hỏi\n` +
    `- Thay vì đưa ra đáp án, hãy TẠO RA MỘT VÍ DỤ TƯƠNG TỰ để minh họa\n` +
    `- Giải thích cách làm thông qua ví dụ tương tự đó, từng bước một\n` +
    `- Sau khi giải thích ví dụ, khuyến khích học viên áp dụng cách làm tương tự vào câu hỏi của họ\n` +
    `- CHỈ hướng dẫn phương pháp, cách tiếp cận, và các bước giải quyết vấn đề\n` +
    `- Gợi ý từng bước, khuyến khích học viên tự suy nghĩ và tự tìm ra đáp án\n` +
    `- Nếu học viên hỏi đáp án, hãy tạo ví dụ tương tự và hướng dẫn cách làm, sau đó khuyến khích họ tự áp dụng\n\n` +
    `VÍ DỤ CÁCH TRẢ LỜI ĐÚNG:\n` +
    `Nếu học viên hỏi: "Một số thập phân có phần nguyên là 5, phần thập phân là 25. Số đó là gì?"\n` +
    `KHÔNG được trả lời: "Số đó là 5,25" hoặc "Đáp án là 5,25"\n` +
    `MÀ phải trả lời: "Mình sẽ giúp bạn hiểu cách làm nhé! Hãy xem ví dụ tương tự này: Một số thập phân có phần nguyên là 3, phần thập phân là 14. Để tìm số đó, mình ghép phần nguyên và phần thập phân lại với nhau, đặt dấu phẩy ở giữa. Vậy số đó sẽ là 3,14. Bây giờ bạn hãy áp dụng cách làm tương tự vào câu hỏi của bạn nhé!"`;

  // Enhance for math/physics/chemistry based on user message
  if (userMessage) {
    const lowerQuestion = userMessage.toLowerCase();
    const isMath =
      /toán|math|phép cộng|phép trừ|phép nhân|phép chia|phương trình|hình học|đại số|giải hệ|tích phân|đạo hàm|logarit|logarithm/.test(
        lowerQuestion,
      );
    const isPhysics =
      /vật lý|vật li|physics|lực|vận tốc|gia tốc|điện trường|từ trường|cơ học|quang học|nhiệt học/.test(
        lowerQuestion,
      );
    const isChemistry =
      /hóa học|hoa hoc|chemistry|phương trình hóa học|cân bằng phương trình|oxi hoá|khử|axit|bazơ|muối|hợp chất/.test(
        lowerQuestion,
      );

    if (isMath || isPhysics || isChemistry) {
      prompt +=
        '\n\nKhi học sinh hỏi về Toán/Vật lý/Hóa học, bạn cần:\n' +
        '- Luôn sử dụng ký hiệu Unicode toán học và khoa học khi có thể (ví dụ: √16 = 4, √2, x², x³, ½, ¾, H₂O, CO₂).\n' +
        '- Trình bày rõ ràng mỗi công thức quan trọng trên một dòng riêng để dễ đọc (ví dụ:\n' +
        '  ⭐ Ví dụ: √25 = 5\n' +
        '  ⭐ Ví dụ: x² + y² = z²\n' +
        '  ⭐ Ví dụ: v = s / t\n' +
        ').\n' +
        '- Luôn cung cấp 1-2 ví dụ ngắn sử dụng các ký hiệu này, và khi thích hợp cũng hiển thị dạng LaTeX trong ngoặc đơn, ví dụ: ⭐ Ví dụ: √25 = 5 (\\(\\sqrt{25} = 5\\)), ⭐ Ví dụ: x² + y² = z² (\\(x^2 + y^2 = z^2\\)).\n';
      
      if (isChemistry) {
        prompt +=
          '- Với hóa học, luôn viết đầy đủ phương trình hóa học sử dụng chỉ số dưới và mũi tên đúng trong Unicode, mỗi phương trình trên một dòng riêng, và khi thích hợp cũng hiển thị dạng LaTeX trong ngoặc đơn, ví dụ:\n' +
          '  2H₂ + O₂ → 2H₂O (\\(2H_2 + O_2 \\rightarrow 2H_2O\\))\n' +
          '  CaCO₃ → CaO + CO₂ (\\(CaCO_3 \\rightarrow CaO + CO_2\\)).\n';
      }
    }
  }

  prompt +=
    '\n\nKhi trả lời câu hỏi:\n' +
    '- Luôn trả lời bằng tiếng Việt (Tiếng Việt)\n' +
    '- Hãy khuyến khích và hỗ trợ\n' +
    '- Giải thích khái niệm một cách rõ ràng\n' +
    '- Giúp bạn hiểu lý do đằng sau các giải pháp\n' +
    '- Sử dụng ngôn ngữ phù hợp với lứa tuổi\n' +
    '- Kiên nhẫn và chu đáo\n' +
    '- Nhớ luôn xưng "mình" và gọi học viên là "bạn"';

  return prompt;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Create a new conversation
 */
export async function createConversation(
  userId: number,
  type: 'essay_review' | 'free_chat',
  submissionId?: number,
  configId?: number
) {
  // Get default config if not provided
  let finalConfigId = configId;
  if (!finalConfigId) {
    const defaultConfig = await prisma.conversationConfig.findFirst({
      where: { isDefault: true },
    });
    if (!defaultConfig) {
      throw new Error('No default conversation config found');
    }
    finalConfigId = defaultConfig.id;
  }

  // Get config
  const config = await prisma.conversationConfig.findUnique({
    where: { id: finalConfigId },
  });

  if (!config) {
    throw new Error('Conversation config not found');
  }

  // Generate title based on type
  let title = '';
  if (type === 'essay_review' && submissionId) {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: {
          include: {
            exercise: true,
          },
        },
      },
    });
    title = submission
      ? `Review: ${submission.assignment.exercise.title}`
      : 'Essay Review';
  } else {
    title = 'New Chat';
  }

  // Create conversation
  // Store submissionId in metadata if provided (since submissionId field doesn't exist in schema)
  const metadata = submissionId ? { submissionId } : null;
  
  const conversation = await prisma.conversation.create({
    data: {
      userId,
      configId: finalConfigId,
      type,
      title,
      status: 'active',
      metadata: metadata as any,
    },
    include: {
      config: true,
    },
  });

  // Add system message if config has system prompt
  if (config.systemPrompt) {
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'system',
        content: config.systemPrompt,
        order: 0,
      },
    });
  }

  return conversation;
}

/**
 * Add message to conversation and get AI response
 */
export async function addMessageToConversation(
  conversationId: number,
  userMessage: string,
  imageUrls?: string[]
) {
  // Check API key
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured');
  }

  // Get conversation with config and user info
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      config: true,
      user: {
        select: {
          id: true,
          level: true,
          gradeId: true,
          grade: {
            select: {
              level: true,
            },
          },
        },
      },
      messages: {
        orderBy: {
          order: 'asc',
        },
      },
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Get current message count for ordering
  const messageCount = conversation.messages.length;

  // Add user message
  const userMsg = await prisma.message.create({
    data: {
      conversationId,
      role: 'user',
      content: userMessage,
      order: messageCount,
    },
  });

  // Check cache first (only if no images, as image-based queries are context-dependent)
  let assistantResponse: string;
  let completion: OpenAI.Chat.Completions.ChatCompletion | null = null;
  let isFromCache = false;

  if (!imageUrls || imageUrls.length === 0) {
    const cached = await getCachedResponse(userMessage);
    if (cached) {
      assistantResponse = cached.response;
      isFromCache = true;
      console.log('✅ Using cached response for question');
    }
  }

  // If not from cache, call OpenAI
  if (!isFromCache) {
    // Prepare messages for OpenAI
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Add system message with enhancements (include user message for better context)
    const systemMessage = conversation.messages.find((m) => m.role === 'system');
    if (systemMessage) {
      const enhancedPrompt = buildEnhancedPrompt(
        systemMessage.content,
        conversation.user.level,
        conversation.user.grade?.level || null,
        userMessage
      );
      messages.push({
        role: 'system',
        content: enhancedPrompt,
      });
    }

    // Add conversation history (excluding system message)
    const historyMessages = conversation.messages.filter((m) => m.role !== 'system');
    for (const msg of historyMessages) {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }

    // Add current user message with images if provided
    if (imageUrls && imageUrls.length > 0) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_URL || 'http://localhost:3000';
      
      // Support multiple images (OpenAI supports multiple images in one message)
      const content: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }> = [
        { type: 'text', text: userMessage },
      ];
      
      // Add all images
      for (const imageUrl of imageUrls) {
        const fullImageUrl = imageUrl.startsWith('http') ? imageUrl : `${baseUrl}${imageUrl}`;
        content.push({
          type: 'image_url',
          image_url: { url: fullImageUrl },
        });
      }
      
      messages.push({
        role: 'user',
        content: content as any, // OpenAI supports array of text and image_url
      });
    } else {
      messages.push({
        role: 'user',
        content: userMessage,
      });
    }

    // Get response format from config
    const responseFormat = conversation.config.responseFormat as
      | { type: string }
      | undefined;

    // Select model based on complexity (always use GPT-4o for images)
    const model = selectModel(userMessage, imageUrls, responseFormat);
    const maxTokens = calculateMaxTokens(responseFormat, userMessage);

    // Set temperature based on task type
    // Lower temperature (0.3-0.5) for factual/educational content, higher (0.7-0.9) for creative
    const temperature = responseFormat?.type === 'json_object' ? 0.3 : 0.7;

    // Call OpenAI
    try {
      completion = await openai.chat.completions.create({
        model,
        messages,
        temperature,
        ...(responseFormat && { response_format: responseFormat }),
        max_tokens: maxTokens,
      });
    } catch (error: any) {
      console.error('OpenAI API error:', error);
      throw new Error(`Failed to generate response: ${error.message || 'Unknown error'}`);
    }

    assistantResponse = completion.choices[0]?.message?.content || '';

    // Calculate cost
    const usage = completion.usage;
    const estimatedCost = usage
      ? calculateCost(model, usage.prompt_tokens || 0, usage.completion_tokens || 0)
      : 0;

    // Log usage
    if (MONITORING_ENABLED && usage) {
      console.log(
        `OpenAI usage - Model: ${model}, Tokens: ${usage.total_tokens} (prompt: ${usage.prompt_tokens}, completion: ${usage.completion_tokens}), Estimated cost: $${estimatedCost.toFixed(6)}`
      );
    }

    // Save to cache (only if no images)
    if (!imageUrls || imageUrls.length === 0) {
      await saveCachedResponse(
        userMessage,
        assistantResponse,
        {
          model: completion.model,
          usage: usage ? {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
          } : undefined,
          finishReason: completion.choices[0]?.finish_reason,
          estimatedCost,
        }
      );
    }
  }

  // Save assistant message with metadata
  const usage = completion?.usage;
  const estimatedCost = usage
    ? calculateCost(completion?.model || 'unknown', usage.prompt_tokens || 0, usage.completion_tokens || 0)
    : 0;

  const assistantMsg = await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: assistantResponse,
      order: messageCount + 1,
      metadata: {
        isFromCache,
        model: completion?.model || null,
        usage: usage ? {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        } : null,
        finishReason: completion?.choices[0]?.finish_reason || null,
        estimatedCost: isFromCache ? 0 : estimatedCost, // Cache hits have no cost
      },
    },
  });

  // Update conversation last message time
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return {
    userMessage: userMsg,
    assistantMessage: assistantMsg,
  };
}

/**
 * Get conversation with messages
 */
export async function getConversation(conversationId: number, userId: number) {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      userId, // Ensure user owns the conversation
    },
    include: {
      messages: {
        orderBy: {
          order: 'asc',
        },
      },
      config: true,
      // Note: submissionId is stored in metadata, not as a relation
    },
  });

  return conversation;
}

/**
 * Get all conversations for a user
 */
export async function getUserConversations(
  userId: number,
  type?: 'essay_review' | 'free_chat',
  status?: 'active' | 'completed' | 'archived'
) {
  const conversations = await prisma.conversation.findMany({
    where: {
      userId,
      ...(type && { type }),
      ...(status && { status }),
    },
    include: {
      messages: {
        orderBy: {
          order: 'desc',
        },
        take: 1, // Get last message for preview
      },
      config: true,
      // Note: submissionId is stored in metadata, not as a relation
    },
    orderBy: {
      lastMessageAt: 'desc',
    },
  });

  return conversations;
}

/**
 * Create conversation config
 */
export async function createConversationConfig(data: {
  name: string;
  systemPrompt: string;
  responseFormat?: any;
  metadata?: any;
  isDefault?: boolean;
}) {
  // If setting as default, unset other defaults
  if (data.isDefault) {
    await prisma.conversationConfig.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  const config = await prisma.conversationConfig.create({
    data: {
      name: data.name,
      systemPrompt: data.systemPrompt,
      responseFormat: data.responseFormat || null,
      metadata: data.metadata || null,
      isDefault: data.isDefault || false,
    },
  });

  return config;
}

