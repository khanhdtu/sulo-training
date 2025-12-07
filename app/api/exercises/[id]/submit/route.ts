import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/middleware-auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { z } from 'zod';

const submitExerciseSchema = z.object({
  answers: z.record(z.string(), z.any()), // { questionId: "answer" } for multiple choice or essay
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params (Next.js 15+ requires params to be awaited)
    const { id } = await params;
    
    // Get authenticated user
    const user = await getAuthUser(request);
    if (!user) {
      return errorResponse('Không có quyền truy cập', 401);
    }

    const exerciseId = parseInt(id);
    if (isNaN(exerciseId)) {
      return errorResponse('ID bài tập không hợp lệ', 400);
    }

    const body = await request.json();
    
    // Validate and extract answers
    if (!body || typeof body !== 'object' || !('answers' in body)) {
      return errorResponse('Dữ liệu không hợp lệ: thiếu answers', 400);
    }
    
    const answers = body.answers as Record<string, string>;
    if (!answers || typeof answers !== 'object') {
      return errorResponse('Dữ liệu không hợp lệ: answers phải là object', 400);
    }

    // Get exercise with questions
    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
        section: {
          include: {
            chapter: {
              include: {
                subject: {
                  select: {
                    id: true,
                    gradeId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!exercise) {
      return errorResponse('Không tìm thấy bài tập', 404);
    }

    // Calculate score and mark correct/incorrect for each question
    let correctCount = 0;
    let totalPoints = 0;
    let earnedPoints = 0;
    const questionResults: Record<string, { answer: string; isCorrect: boolean; points: number; earnedPoints: number }> = {};

    exercise.questions.forEach((question: any) => {
      totalPoints += question.points;
      const userAnswer = answers[question.id.toString()] || '';
      const normalizedUserAnswer = userAnswer.trim().toLowerCase();
      const normalizedCorrectAnswer = question.answer.trim().toLowerCase();
      const isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;
      
      const earnedPointsForQuestion = isCorrect ? question.points : 0;
      
      questionResults[question.id.toString()] = {
        answer: userAnswer,
        isCorrect,
        points: question.points,
        earnedPoints: earnedPointsForQuestion,
      };

      if (isCorrect) {
        correctCount++;
        earnedPoints += question.points;
      }
    });

    const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
    const isCompleted = correctCount === exercise.questions.length;

    // Prepare answers with results for storage
    const answersWithResults: Record<string, any> = {};
    Object.keys(answers).forEach((questionId) => {
      answersWithResults[questionId] = {
        answer: answers[questionId],
        isCorrect: questionResults[questionId]?.isCorrect || false,
      };
    });

    // Create or update exercise attempt
    // First, try to find existing attempt
    const existingAttempt = await prisma.userExerciseAttempt.findFirst({
      where: {
        userId: user.id,
        exerciseId: exerciseId,
      },
    });

    const attempt = existingAttempt
      ? await prisma.userExerciseAttempt.update({
          where: { id: existingAttempt.id },
          data: {
            answers: answersWithResults, // Store answers with isCorrect flag
            score: score,
            totalPoints: totalPoints,
            isCompleted: isCompleted,
            completedAt: isCompleted ? new Date() : null,
          },
          select: {
            id: true,
            score: true,
            totalPoints: true,
            isCompleted: true,
            completedAt: true,
          },
        })
      : await prisma.userExerciseAttempt.create({
          data: {
            userId: user.id,
            exerciseId: exerciseId,
            answers: answersWithResults, // Store answers with isCorrect flag
            score: score,
            totalPoints: totalPoints,
            isCompleted: isCompleted,
            completedAt: isCompleted ? new Date() : null,
          },
          select: {
            id: true,
            score: true,
            totalPoints: true,
            isCompleted: true,
            completedAt: true,
          },
        });

    // Get chapter info
    const chapterId = exercise.section.chapter.id;
    const subjectId = exercise.section.chapter.subject.id;
    const gradeId = exercise.section.chapter.subject.gradeId;

    // Update or create UserChapterProgress
    // Always update progress when submitting (not just when completed)
    await prisma.userChapterProgress.upsert({
      where: {
        userId_chapterId: {
          userId: user.id,
          chapterId: chapterId,
        },
      },
      create: {
        userId: user.id,
        chapterId: chapterId,
        subjectId: subjectId,
        gradeId: gradeId,
        status: 'in_progress',
        lastAccessedAt: new Date(),
      },
      update: {
        lastAccessedAt: new Date(),
        // Update status to completed if all exercises in chapter are completed
        // This will be calculated properly in a separate query if needed
      },
    });

    // Update section progress if exercise is completed
    if (isCompleted) {
      // Get or create section progress
      await prisma.userSectionProgress.upsert({
        where: {
          userId_sectionId: {
            userId: user.id,
            sectionId: exercise.sectionId,
          },
        },
        create: {
          userId: user.id,
          sectionId: exercise.sectionId,
          status: 'in_progress',
          completedExercises: 1,
          totalExercises: 1, // Will be updated properly later
          lastAccessedAt: new Date(),
        },
        update: {
          completedExercises: {
            increment: 1,
          },
          lastAccessedAt: new Date(),
        },
      });
    }

    return successResponse(
      {
        attempt,
        correctCount,
        totalQuestions: exercise.questions.length,
        score: score,
        isCompleted,
      },
      isCompleted ? 'Hoàn thành bài tập!' : 'Đã lưu câu trả lời'
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Dữ liệu không hợp lệ', 400, { details: error.issues });
    }

    console.error('Submit exercise error:', error);
    return errorResponse('Đã xảy ra lỗi. Vui lòng thử lại sau', 500);
  }
}

