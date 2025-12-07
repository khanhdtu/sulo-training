import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/middleware-auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { z } from 'zod';

const submitChapterSchema = z.object({
  chapterId: z.number().optional(), // Optional, can also get from URL params
  exercises: z.record(z.string(), z.record(z.string(), z.string())), // { exerciseId: { questionId: "answer" } }
  status: z.enum(['draft', 'submitted']).optional().default('submitted'), // draft or submitted
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

    // Get chapterId from URL params first
    let chapterId = parseInt(id);
    if (isNaN(chapterId)) {
      return errorResponse('ID chương không hợp lệ', 400);
    }

    const body = await request.json();
    
    let exercisesAnswers: Record<string, Record<string, string>>;
    let submitStatus: 'draft' | 'submitted' = 'submitted';
    try {
      const parsed = submitChapterSchema.parse(body);
      exercisesAnswers = parsed.exercises;
      submitStatus = parsed.status || 'submitted';
      
      // Use chapterId from body if provided, otherwise use from URL params
      if (parsed.chapterId) {
        chapterId = parsed.chapterId;
      }
    } catch (error) {
      console.error('Validation error:', error);
      if (error instanceof z.ZodError) {
        return errorResponse('Dữ liệu không hợp lệ', 400, { 
          details: error.issues,
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

    // Track which exercises were just submitted in this request
    const submittedExerciseIds = new Set<number>();

    // Process each exercise
    for (const [exerciseIdStr, answers] of Object.entries(exercisesAnswers)) {
      const exerciseId = parseInt(exerciseIdStr);
      if (isNaN(exerciseId)) continue;
      
      // Track this exercise as submitted
      submittedExerciseIds.add(exerciseId);

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

      // For draft status, don't calculate score or mark as completed
      // Only save answers without grading
      const finalStatus = submitStatus === 'draft' ? 'draft' : (isCompleted ? 'completed' : 'submitted');
      const finalScore = submitStatus === 'draft' ? null : score;
      const finalIsCompleted = submitStatus === 'draft' ? false : isCompleted;

      // Prepare answers with results for storage
      // For draft, don't include isCorrect in answers
      const answersWithResults: Record<string, any> = {};
      Object.keys(answers as Record<string, string>).forEach((questionId) => {
        if (submitStatus === 'draft') {
          // For draft, just save the answer without correctness
          answersWithResults[questionId] = (answers as Record<string, string>)[questionId];
        } else {
          // For submitted, include correctness
          answersWithResults[questionId] = {
            answer: (answers as Record<string, string>)[questionId],
            isCorrect: questionResults[questionId]?.isCorrect || false,
          };
        }
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
            score: finalScore,
            totalPoints: totalPoints,
            isCompleted: finalIsCompleted,
            status: finalStatus,
            completedAt: finalIsCompleted ? new Date() : null,
          },
        });
      } else {
        await prisma.userExerciseAttempt.create({
          data: {
            userId: user.id,
            exerciseId: exerciseId,
            answers: answersWithResults,
            score: finalScore,
            totalPoints: totalPoints,
            isCompleted: finalIsCompleted,
            status: finalStatus,
            completedAt: finalIsCompleted ? new Date() : null,
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
    // Determine chapter status based on submit status and completion of all exercises
    // Get all exercise IDs in this chapter
    const allExerciseIds = chapter.sections.flatMap(section => 
      section.exercises.map(exercise => exercise.id)
    );
    
    // Get all attempts for this chapter's exercises by this user (AFTER all updates)
    // This ensures we get the latest status after all exercise attempts have been updated
    const allAttempts = await prisma.userExerciseAttempt.findMany({
      where: {
        userId: user.id,
        exerciseId: { in: allExerciseIds },
      },
    });
    
    // Check if all exercises are submitted (status != 'draft')
    // An exercise is considered submitted if:
    // 1. There is an attempt for it
    // 2. The attempt status is not 'draft' (must be 'submitted' or 'completed')
    // Note: We don't require isCompleted = true, just that it's been submitted
    const submittedExercises = allAttempts.filter(
      attempt => attempt.status !== 'draft'
    );
    
    // Count exercises that are fully completed (all questions correct)
    const completedExercises = allAttempts.filter(
      attempt => attempt.isCompleted && attempt.status !== 'draft'
    );
    
    // Check if ALL exercises in the chapter have been submitted (not draft)
    // Each exercise must have an attempt with status != 'draft'
    // This means the user has submitted all exercises, even if not all are correct
    const allExercisesSubmitted = allExerciseIds.length > 0 && 
      allExerciseIds.every(exerciseId => {
        const attempt = allAttempts.find(a => a.exerciseId === exerciseId);
        const isSubmitted = attempt && attempt.status !== 'draft';
        return isSubmitted;
      });
    
    // Determine chapter status:
    // - If draft: always 'in_progress'
    // - If submitted and all exercises submitted (not draft): 'completed'
    //   (Note: We check if all exercises are submitted, not if all are correct)
    // - If submitted but not all exercises submitted: 'in_progress'
    let chapterStatus: 'not_started' | 'in_progress' | 'completed' = 'in_progress';
    if (submitStatus === 'draft') {
      chapterStatus = 'in_progress';
    } else if (submitStatus === 'submitted' && allExercisesSubmitted) {
      chapterStatus = 'completed';
    } else if (submitStatus === 'submitted') {
      chapterStatus = 'in_progress';
    } else {
      chapterStatus = 'in_progress';
    }
    
    const chapterProgressResult = await prisma.userChapterProgress.upsert({
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
        status: chapterStatus,
        completedExercises: completedExercises.length, // Exercises with all questions correct
        totalExercises: allExerciseIds.length,
        lastAccessedAt: new Date(),
        completedAt: chapterStatus === 'completed' ? new Date() : null,
      },
      update: {
        status: chapterStatus,
        completedExercises: completedExercises.length, // Exercises with all questions correct
        totalExercises: allExerciseIds.length,
        lastAccessedAt: new Date(),
        completedAt: chapterStatus === 'completed' ? new Date() : null,
      },
    });

    const submittedCount = results.length;
    const completedCount = results.filter((r) => r.isCompleted).length;

    // Return response with chapterId to confirm update
    return successResponse(
      {
        submittedCount,
        completedCount,
        results,
        chapterId: chapterId, // Include chapterId in response
        chapterStatus: chapterProgressResult.status, // Include updated chapter status
      },
      submitStatus === 'draft' 
        ? `Đã lưu nháp ${submittedCount} bài tập!`
        : `Đã nộp thành công ${submittedCount} bài tập${completedCount > 0 ? `, hoàn thành ${completedCount} bài` : ''}!`
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Dữ liệu không hợp lệ', 400, { details: error.issues });
    }

    console.error('Submit chapter error:', error);
    return errorResponse('Đã xảy ra lỗi. Vui lòng thử lại sau', 500);
  }
}

