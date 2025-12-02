import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware-auth';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subjectId');

    const userLevels = await prisma.userLevel.findMany({
      where: {
        userId: user.id,
        ...(subjectId && { subjectId: parseInt(subjectId) }),
      },
      include: {
        subject: {
          include: {
            grade: true,
          },
        },
      },
      orderBy: {
        lastUpdated: 'desc',
      },
    });

    return NextResponse.json({ userLevels });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Get user levels error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

