import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware-auth';
import { addMessageToConversation, getConversation } from '@/lib/conversation';
import { z } from 'zod';

const addMessageSchema = z.object({
  message: z.string(),
  imageUrls: z.array(z.string().url()).optional(),
}).refine(
  (data) => data.message.trim().length > 0 || (data.imageUrls && data.imageUrls.length > 0),
  {
    message: "Message is required or at least one image must be provided",
  }
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params (Next.js 15+ requires params to be awaited)
    const { id } = await params;
    
    const user = await requireAuth(request);
    const conversationId = parseInt(id);
    const body = await request.json();
    const { message, imageUrls } = addMessageSchema.parse(body);

    // Verify user owns the conversation
    const conversation = await getConversation(conversationId, user.id);
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Add message and get AI response
    const result = await addMessageToConversation(conversationId, message, imageUrls);

    return NextResponse.json({
      userMessage: result.userMessage,
      assistantMessage: result.assistantMessage,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Add message error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params (Next.js 15+ requires params to be awaited)
    const { id } = await params;
    
    const user = await requireAuth(request);
    const conversationId = parseInt(id);

    const conversation = await getConversation(conversationId, user.id);
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Type assertion: getConversation returns conversation with messages
    const conversationWithMessages = conversation as typeof conversation & {
      messages: Array<{
        id: number;
        role: string;
        content: string;
        order: number;
        createdAt: Date;
        conversationId: number;
      }>;
    };

    return NextResponse.json({
      conversation,
      messages: conversationWithMessages.messages || [],
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Get messages error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

