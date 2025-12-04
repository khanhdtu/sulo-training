import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export interface ActivityLogData {
  userId?: number;
  action: string;
  endpoint: string;
  method: string;
  statusCode: number;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  duration?: number;
}

export async function POST(request: NextRequest) {
  try {
    const data: ActivityLogData = await request.json();

    // Log activity to database
    await prisma.activity.create({
      data: {
        userId: data.userId,
        action: data.action,
        endpoint: data.endpoint,
        method: data.method,
        statusCode: data.statusCode,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : null,
        duration: data.duration,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // Log error but don't throw - we don't want activity logging to break the app
    console.error('Failed to log activity:', error);
    return NextResponse.json({ success: false, error: 'Failed to log activity' }, { status: 500 });
  }
}

