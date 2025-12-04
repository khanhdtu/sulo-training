import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/middleware-auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { z } from 'zod';

const submitChapterSchema = z.object({
  exercises: z.record(z.string(), z.record(z.string(), z.string())), // { exerciseId: { questionId: "answer" } }
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

    const chapterId = parseInt(id);
    if (isNaN(chapterId)) {
      return errorResponse('ID chương không hợp lệ', 400);
    }

    const body = await request.json();
    
    // Log for debugging
    console.log('Received payload:', JSON.stringify(body, null, 2));
    
    let exercisesAnswers: Record<string, Record<string, string>>;
    try {
      const parsed = submitChapterSchema.parse(body);
      exercisesAnswers = parsed.exercises;
    } catch (error) {
      console.error('Validation error:', error);
      if (error instanceof z.ZodError) {
        return errorResponse('Dữ liệu không hợp lệ', 400, { 
          details: error.errors,
          received: body 
        });
      }
      throw error;
    }

    // Get chapter with all exercises
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
        sections: {
          include: {
            exercises: {
              include: {
                questions: {
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
        subject: {
          select: {
            id: true,
            gradeId: true,
          },
        },
      },
    });

    if (!chapter) {
      return errorResponse('Không tìm thấy chương', 404);
    }

    const results: Array<{
      exerciseId: number;
      correctCount: number;
      totalQuestions: number;
      score: number;
      isCompleted: boolean;
    }> = [];

    // Process each exercise
    for (const [exerciseIdStr, answers] of Object.entries(exercisesAnswers)) {
      const exerciseId = parseInt(exerciseIdStr);
      if (isNaN(exerciseId)) continue;

      // Find exercise in chapter
      let exercise: any = null;
      for (const section of chapter.sections) {
        exercise = section.exercises.find((e) => e.id === exerciseId);
        if (exercise) break;
      }

      if (!exercise || !exercise.questions || exercise.questions.length === 0) {
        continue;
      }

      // Calculate score and mark correct/incorrect for each question
      let correctCount = 0;
      let totalPoints = 0;
      let earnedPoints = 0;
      const questionResults: Record<string, { answer: string; isCorrect: boolean; points: number; earnedPoints: number }> = {};

      exercise.questions.forEach((question: any) => {
        totalPoints += question.points;
        const userAnswer = (answers as Record<string, string>)[question.id.toString()] || '';
        
        // For multiple choice, userAnswer is the option key (A, B, C, D)
        // Compare directly with question.answer (which should also be option key)
        let isCorrect = false;
        
        if (exercise.type === 'multiple_choice') {
          // Normalize option keys for comparison (A, B, C, D)
          const normalizedUserAnswer = userAnswer.trim().toUpperCase();
          const normalizedCorrectAnswer = question.answer.trim().toUpperCase();
          isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;
        } else {
          // For essay questions, compare text answers
          const normalizedUserAnswer = userAnswer.trim().toLowerCase();
          const normalizedCorrectAnswer = question.answer.trim().toLowerCase();
          isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;
        }
        
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
      Object.keys(answers as Record<string, string>).forEach((questionId) => {
        answersWithResults[questionId] = {
          answer: (answers as Record<string, string>)[questionId],
          isCorrect: questionResults[questionId]?.isCorrect || false,
        };
      });

      // Create or update exercise attempt
      const existingAttempt = await prisma.userExerciseAttempt.findFirst({
        where: {
          userId: user.id,
          exerciseId: exerciseId,
        },
      });

      if (existingAttempt) {
        await prisma.userExerciseAttempt.update({
          where: { id: existingAttempt.id },
          data: {
            answers: answersWithResults,
            score: score,
            totalPoints: totalPoints,
            isCompleted: isCompleted,
            completedAt: isCompleted ? new Date() : null,
          },
        });
      } else {
        await prisma.userExerciseAttempt.create({
          data: {
            userId: user.id,
            exerciseId: exerciseId,
            answers: answersWithResults,
            score: score,
            totalPoints: totalPoints,
            isCompleted: isCompleted,
            completedAt: isCompleted ? new Date() : null,
          },
        });
      }

      // Update section progress if exercise is completed
      if (isCompleted) {
        const section = chapter.sections.find((s) => 
          s.exercises.some((e) => e.id === exerciseId)
        );
        
        if (section) {
          await prisma.userSectionProgress.upsert({
            where: {
              userId_sectionId: {
                userId: user.id,
                sectionId: section.id,
              },
            },
            create: {
              userId: user.id,
              sectionId: section.id,
              status: 'in_progress',
              completedExercises: 1,
              totalExercises: 1,
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
      }

      results.push({
        exerciseId,
        correctCount,
        totalQuestions: exercise.questions.length,
        score,
        isCompleted,
      });
    }

    // Update or create UserChapterProgress
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
        subjectId: chapter.subject.id,
        gradeId: chapter.subject.gradeId,
        status: 'in_progress',
        lastAccessedAt: new Date(),
      },
      update: {
        lastAccessedAt: new Date(),
      },
    });

    const submittedCount = results.length;
    const completedCount = results.filter((r) => r.isCompleted).length;

    return successResponse(
      {
        submittedCount,
        completedCount,
        results,
      },
      `Đã nộp thành công ${submittedCount} bài tập${completedCount > 0 ? `, hoàn thành ${completedCount} bài` : ''}!`
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Dữ liệu không hợp lệ', 400, { details: error.errors });
    }

    console.error('Submit chapter error:', error);
    return errorResponse('Đã xảy ra lỗi. Vui lòng thử lại sau', 500);
  }
}

