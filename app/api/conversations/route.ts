import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware-auth';
import {
  createConversation,
  getUserConversations,
  getConversation,
} from '@/lib/conversation';
import { z } from 'zod';

const createConversationSchema = z.object({
  type: z.enum(['essay_review', 'free_chat']),
  submissionId: z.number().optional(),
  configId: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const data = createConversationSchema.parse(body);

    const conversation = await createConversation(
      user.id,
      data.type,
      data.submissionId,
      data.configId
    );

    return NextResponse.json({ conversation });
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

    console.error('Create conversation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'essay_review' | 'free_chat' | null;
    const status = searchParams.get('status') as 'active' | 'completed' | 'archived' | null;
    const conversationId = searchParams.get('id');

    // Get single conversation
    if (conversationId) {
      const conversation = await getConversation(parseInt(conversationId), user.id);
      if (!conversation) {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ conversation });
    }

    // Get all conversations
    const conversations = await getUserConversations(user.id, type || undefined, status || undefined);

    return NextResponse.json({ conversations });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Get conversations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

