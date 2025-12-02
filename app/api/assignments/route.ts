import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/middleware-auth';
import { z } from 'zod';

const createAssignmentSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  exerciseId: z.number(),
  classId: z.number().optional(),
  userId: z.number().optional(),
  deadline: z.string().datetime(),
  minScore: z.number().min(0).max(100).default(0),
});

export async function POST(request: NextRequest) {
  try {
    const teacher = await requireRole(request, ['teacher', 'admin']);
    const body = await request.json();
    const data = createAssignmentSchema.parse(body);

    // Verify exercise exists
    const exercise = await prisma.exercise.findUnique({
      where: { id: data.exerciseId },
    });

    if (!exercise) {
      return NextResponse.json(
        { error: 'Exercise not found' },
        { status: 404 }
      );
    }

    // Create assignment
    const assignment = await prisma.assignment.create({
      data: {
        title: data.title,
        description: data.description,
        exerciseId: data.exerciseId,
        classId: data.classId || null,
        userId: data.userId || null,
        assignedBy: teacher.id,
        deadline: new Date(data.deadline),
        minScore: data.minScore,
      },
      include: {
        exercise: true,
        class: true,
        student: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });

    return NextResponse.json({ assignment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
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

    console.error('Create assignment error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(request, ['student', 'teacher', 'admin', 'parent']);
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const userId = searchParams.get('userId');

    const assignments = await prisma.assignment.findMany({
      where: {
        isActive: true,
        ...(user.role === 'student' && { userId: user.id }),
        ...(classId && { classId: parseInt(classId) }),
        ...(userId && { userId: parseInt(userId) }),
      },
      include: {
        exercise: {
          include: {
            section: {
              include: {
                chapter: {
                  include: {
                    subject: true,
                  },
                },
              },
            },
          },
        },
        student: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
        class: true,
        submissions: {
          where: user.role === 'student' ? { userId: user.id } : undefined,
        },
      },
      orderBy: {
        deadline: 'asc',
      },
    });

    return NextResponse.json({ assignments });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.error('Get assignments error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

