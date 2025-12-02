import OpenAI from 'openai';
import { prisma } from './prisma';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  const conversation = await prisma.conversation.create({
    data: {
      userId,
      submissionId: submissionId || null,
      configId: finalConfigId,
      type,
      title,
      status: 'active',
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
  // Get conversation with config
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      config: true,
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

  // Prepare messages for OpenAI
  const messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  }> = [];

  // Add system message if exists
  const systemMessage = conversation.messages.find((m) => m.role === 'system');
  if (systemMessage) {
    messages.push({
      role: 'system',
      content: systemMessage.content,
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
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: userMessage },
        ...imageUrls.map((url) => ({
          type: 'image_url' as const,
          image_url: { url },
        })),
      ],
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

  // Call OpenAI
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o', // Using GPT-4o for better performance
    messages: messages as any,
    ...(responseFormat && { response_format: responseFormat }),
    max_tokens: 2000,
  });

  const assistantResponse = completion.choices[0].message.content || '';

  // Save assistant message
  const assistantMsg = await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: assistantResponse,
      order: messageCount + 1,
      metadata: {
        model: completion.model,
        usage: completion.usage,
        finishReason: completion.choices[0].finish_reason,
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
      submission: {
        include: {
          assignment: {
            include: {
              exercise: true,
            },
          },
        },
      },
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
      submission: {
        include: {
          assignment: {
            include: {
              exercise: true,
            },
          },
        },
      },
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

