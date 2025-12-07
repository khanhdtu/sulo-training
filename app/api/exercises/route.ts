import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/middleware-auth';
import { z } from 'zod';

const createExerciseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  sectionId: z.number(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  type: z.enum(['multiple_choice', 'essay']),
  points: z.number().default(10),
  timeLimit: z.number().optional(),
  questions: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
      options: z.record(z.string(), z.string()).optional(), // For multiple choice
      points: z.number().default(1),
    })
  ),
});

export async function POST(request: NextRequest) {
  try {
    const teacher = await requireRole(request, ['teacher', 'admin']);
    const body = await request.json();
    const data = createExerciseSchema.parse(body);

    // Verify section exists
    const section = await prisma.section.findUnique({
      where: { id: data.sectionId },
    });

    if (!section) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      );
    }

    // Create exercise with questions
    const exercise = await prisma.exercise.create({
      data: {
        title: data.title,
        description: data.description || '',
        sectionId: data.sectionId,
        difficulty: data.difficulty,
        type: data.type,
        points: data.points,
        timeLimit: data.timeLimit,
        questions: {
          create: data.questions.map((q, index) => ({
            question: q.question,
            answer: q.answer,
            ...(q.options && { options: q.options }),
            order: index,
            points: q.points,
          })),
        },
      },
      include: {
        questions: true,
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
    });

    return NextResponse.json({ exercise });
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

    console.error('Create exercise error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sectionId = searchParams.get('sectionId');
    const difficulty = searchParams.get('difficulty');
    const type = searchParams.get('type');

    const exercises = await prisma.exercise.findMany({
      where: {
        ...(sectionId && { sectionId: parseInt(sectionId) }),
        ...(difficulty && { difficulty }),
        ...(type && { type }),
      },
      include: {
        questions: {
          orderBy: {
            order: 'asc',
          },
        },
        section: {
          include: {
            chapter: {
              include: {
                subject: {
                  include: {
                    grade: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ exercises });
  } catch (error) {
    console.error('Get exercises error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

