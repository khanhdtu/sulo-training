import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/middleware-auth';
import { createConversationConfig } from '@/lib/conversation';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createConfigSchema = z.object({
  name: z.string().min(1),
  systemPrompt: z.string().min(1),
  responseFormat: z.any().optional(),
  metadata: z.any().optional(),
  isDefault: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const admin = await requireRole(request, ['admin', 'teacher']);
    const body = await request.json();
    const data = createConfigSchema.parse(body);

    const config = await createConversationConfig({
      name: data.name,
      systemPrompt: data.systemPrompt,
      responseFormat: data.responseFormat,
      metadata: data.metadata,
      isDefault: data.isDefault,
    });

    return NextResponse.json({ config });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      if (error.message === 'Forbidden') {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }
    }

    console.error('Create config error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const configs = await prisma.conversationConfig.findMany({
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({ configs });
  } catch (error) {
    console.error('Get configs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

