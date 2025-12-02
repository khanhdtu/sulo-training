import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware-auth';
import { gradeEssayFromImage, gradeMultipleEssays } from '@/lib/openai';
import { createConversation } from '@/lib/conversation';
import { z } from 'zod';

const createSubmissionSchema = z.object({
  assignmentId: z.number(),
  answers: z.record(z.string()).optional(), // For multiple choice: { questionId: "answer" }
  images: z.array(z.string()).optional(), // Array of image URLs for essay
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { assignmentId, answers, images } = createSubmissionSchema.parse(body);

    // Get assignment
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        exercise: {
          include: {
            questions: true,
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    // Check if user is assigned to this assignment
    if (assignment.userId && assignment.userId !== user.id) {
      return NextResponse.json(
        { error: 'You are not assigned to this assignment' },
        { status: 403 }
      );
    }

    // Check if already submitted
    const existingSubmission = await prisma.submission.findFirst({
      where: {
        assignmentId,
        userId: user.id,
      },
    });

    if (existingSubmission && existingSubmission.status !== 'pending') {
      return NextResponse.json(
        { error: 'Already submitted' },
        { status: 400 }
      );
    }

    let score: number | null = null;
    let aiFeedback: string | null = null;
    let status = 'pending';

    // Grade multiple choice automatically
    if (assignment.exercise.type === 'multiple_choice' && answers) {
      let correctCount = 0;
      const totalQuestions = assignment.exercise.questions.length;

      for (const question of assignment.exercise.questions) {
        const userAnswer = answers[question.id.toString()];
        if (userAnswer === question.answer) {
          correctCount++;
        }
      }

      score = (correctCount / totalQuestions) * 100;
      status = 'graded';
    }

    // Grade essay using OpenAI
    if (assignment.exercise.type === 'essay' && images && images.length > 0) {
      try {
        const questions = assignment.exercise.questions.map((q) => ({
          question: q.question,
          answer: q.answer,
        }));

        const results = await gradeMultipleEssays(images, questions);
        const totalScore = results.reduce((sum, r) => sum + r.score, 0);
        score = totalScore / results.length;
        aiFeedback = results.map((r, i) => `Câu ${i + 1}: ${r.feedback}`).join('\n\n');
        status = 'graded';
      } catch (error) {
        console.error('OpenAI grading error:', error);
        // Keep as pending, can be graded manually later
      }
    }

    // Create or update submission
    const submission = existingSubmission
      ? await prisma.submission.update({
          where: { id: existingSubmission.id },
          data: {
            answers: answers || undefined,
            images: images || undefined,
            score: score !== null ? score : undefined,
            aiFeedback: aiFeedback || undefined,
            status,
            submittedAt: new Date(),
            gradedAt: status === 'graded' ? new Date() : undefined,
          },
          include: {
            assignment: {
              include: {
                exercise: true,
              },
            },
          },
        })
      : await prisma.submission.create({
          data: {
            assignmentId,
            userId: user.id,
            answers: answers || null,
            images: images || null,
            score: score ? score : null,
            aiFeedback,
            status,
            submittedAt: new Date(),
            gradedAt: status === 'graded' ? new Date() : null,
          },
          include: {
            assignment: {
              include: {
                exercise: true,
              },
            },
          },
        });
      create: {
        assignmentId,
        userId: user.id,
        answers: answers || null,
        images: images || null,
        score: score ? score : null,
        aiFeedback,
        status,
        submittedAt: new Date(),
        gradedAt: status === 'graded' ? new Date() : null,
      },
      update: {
        answers: answers || undefined,
        images: images || undefined,
        score: score !== null ? score : undefined,
        aiFeedback: aiFeedback || undefined,
        status,
        submittedAt: new Date(),
        gradedAt: status === 'graded' ? new Date() : undefined,
      },
      include: {
        assignment: {
          include: {
            exercise: true,
          },
        },
      },
    });

    return NextResponse.json({ submission });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Create submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('assignmentId');

    const submissions = await prisma.submission.findMany({
      where: {
        userId: user.id,
        ...(assignmentId && { assignmentId: parseInt(assignmentId) }),
      },
      include: {
        assignment: {
          include: {
            exercise: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ submissions });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Get submissions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

