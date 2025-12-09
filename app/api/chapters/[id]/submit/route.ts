import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/middleware-auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { z } from 'zod';

const submitChapterSchema = z.object({
  chapterId: z.number().optional(), // Optional, can also get from URL params
  exercises: z.record(z.string(), z.record(z.string(), z.string())), // { exerciseId: { questionId: "answer" } }
  status: z.enum(['draft', 'submitted']).optional().default('submitted'), // draft or submitted
  level: z.enum(['easy', 'medium', 'hard']).optional(), // Độ khó: easy, medium, hard
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
    let level: 'easy' | 'medium' | 'hard' | undefined;
    try {
      const parsed = submitChapterSchema.parse(body);
      exercisesAnswers = parsed.exercises;
      submitStatus = parsed.status || 'submitted';
      level = parsed.level;
      
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
    // If level is provided, filter exercises by difficulty
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
        sections: {
          include: {
            exercises: {
              ...(level ? { where: { difficulty: level } } : {}), // Filter by level if provided
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
      answeredCount: number;
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
        exercise = section.exercises.find((e: any) => e.id === exerciseId);
        if (exercise) break;
      }

      if (!exercise || !exercise.questions || exercise.questions.length === 0) {
        continue;
      }

      // Validate exercise difficulty matches the specified level (if provided)
      if (level && exercise.difficulty !== level) {
        console.warn(`Exercise ${exerciseId} has difficulty ${exercise.difficulty}, but submission specifies level ${level}. Skipping.`);
        continue;
      }

      // Calculate score and mark correct/incorrect for each question
      // Only calculate for questions that user has answered
      let correctCount = 0;
      let answeredCount = 0;
      let totalPoints = 0; // Total points of ALL questions (for percentage calculation)
      let answeredPoints = 0; // Total points of answered questions only
      let earnedPoints = 0;
      const questionResults: Record<string, { answer: string; isCorrect: boolean; points: number; earnedPoints: number; isAnswered: boolean }> = {};

      exercise.questions.forEach((question: any) => {
        totalPoints += question.points; // Always add to total (for percentage)
        const questionId = question.id.toString();
        const userAnswer = (answers as Record<string, string>)[questionId];
        const hasAnswer = userAnswer !== undefined && userAnswer !== null && userAnswer.trim() !== '';
        
        // Only process if user has answered this question
        if (hasAnswer) {
          answeredCount++;
          answeredPoints += question.points;
          
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
          
          questionResults[questionId] = {
            answer: userAnswer,
            isCorrect,
            points: question.points,
            earnedPoints: earnedPointsForQuestion,
            isAnswered: true,
          };

          if (isCorrect) {
            correctCount++;
            earnedPoints += question.points;
          }
        } else {
          // Question not answered - mark as unanswered
          questionResults[questionId] = {
            answer: '',
            isCorrect: false,
            points: question.points,
            earnedPoints: 0,
            isAnswered: false,
          };
        }
      });

      // Calculate score based on answered questions only
      // Score = (earned points / total points of all questions) * 100
      // This gives percentage based on full exercise, not just answered questions
      const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
      // Exercise is completed only if ALL questions are answered AND ALL are correct
      const isCompleted = answeredCount === exercise.questions.length && correctCount === exercise.questions.length;

      // For draft status, don't calculate score or mark as completed
      // Only save answers without grading
      const finalStatus = submitStatus === 'draft' ? 'draft' : (isCompleted ? 'completed' : 'submitted');
      const finalScore = submitStatus === 'draft' ? null : score;
      const finalIsCompleted = submitStatus === 'draft' ? false : isCompleted;

      // Prepare answers with results for storage
      // Store ALL questions (answered and unanswered) for consistency
      // For draft, don't include isCorrect in answers
      const answersWithResults: Record<string, any> = {};
      exercise.questions.forEach((question: any) => {
        const questionId = question.id.toString();
        const questionResult = questionResults[questionId];
        
        if (submitStatus === 'draft') {
          // For draft, only save answered questions without correctness
          if (questionResult?.isAnswered) {
            answersWithResults[questionId] = (answers as Record<string, string>)[questionId];
          }
        } else {
          // For submitted, include all questions (answered and unanswered)
          // This allows tracking which questions were not answered
          if (questionResult?.isAnswered) {
            answersWithResults[questionId] = {
              answer: questionResult.answer,
              isCorrect: questionResult.isCorrect,
            };
          } else {
            // Mark unanswered questions explicitly
            answersWithResults[questionId] = {
              answer: '',
              isCorrect: false,
              isAnswered: false,
            };
          }
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
        const section = chapter.sections.find((s: any) =>
          s.exercises.some((e: any) => e.id === exerciseId)
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
        answeredCount,
        totalQuestions: exercise.questions.length,
        score,
        isCompleted,
      });
    }

    // Update or create UserChapterProgress
    // Determine chapter status based on submit status and completion of all exercises
    // Get all exercise IDs in this chapter
    const allExerciseIds = chapter.sections.flatMap((section: any) =>
      section.exercises.map((exercise: any) => exercise.id)
    );
    
    // Get all attempts for this chapter's exercises by this user
    // Include attempts that were just updated in this request
    // We need to merge the updated attempts with existing attempts
    const existingAttempts = await prisma.userExerciseAttempt.findMany({
      where: {
        userId: user.id,
        exerciseId: { in: allExerciseIds },
      },
    });
    
    // Create a map of updated attempts from this request
    const updatedAttemptsMap = new Map<number, any>();
    for (const exerciseId of submittedExerciseIds) {
      const updatedAttempt = await prisma.userExerciseAttempt.findFirst({
        where: {
          userId: user.id,
          exerciseId: exerciseId,
        },
      });
      if (updatedAttempt) {
        updatedAttemptsMap.set(exerciseId, updatedAttempt);
      }
    }
    
    // Merge existing attempts with updated attempts (updated ones take precedence)
    const allAttempts = existingAttempts.map((attempt: any) => {
      const updated = updatedAttemptsMap.get(attempt.exerciseId);
      return updated || attempt;
    });
    
    // Add any new attempts that weren't in existingAttempts
    for (const [exerciseId, attempt] of updatedAttemptsMap.entries()) {
      if (!allAttempts.some((a: any) => a.exerciseId === exerciseId)) {
        allAttempts.push(attempt);
      }
    }
    
    // Check if all exercises are submitted (status != 'draft')
    // An exercise is considered submitted if:
    // 1. There is an attempt for it
    // 2. The attempt status is not 'draft' (must be 'submitted' or 'completed')
    // Note: We don't require isCompleted = true, just that it's been submitted
    const submittedExercises = allAttempts.filter(
      (attempt: any) => attempt.status !== 'draft'
    );
    
    // Count exercises that are fully completed (all questions correct)
    const completedExercises = allAttempts.filter(
      (attempt: any) => attempt.isCompleted && attempt.status !== 'draft'
    );
    
    // Check if ALL exercises in the chapter have been submitted (not draft)
    // Each exercise must have an attempt with status != 'draft'
    // This means the user has submitted all exercises, even if not all are correct
    const allExercisesSubmitted = allExerciseIds.length > 0 && 
      allExerciseIds.every((exerciseId: number) => {
        const attempt = allAttempts.find((a: any) => a.exerciseId === exerciseId);
        const isSubmitted = attempt && attempt.status !== 'draft';
        return isSubmitted;
      });
    
    // Determine chapter status based on submitStatus from payload:
    // - If draft: always 'in_progress'
    // - If submitted: use 'submitted' status (as specified in payload)
    //   Note: 'completed' status should be set separately when all exercises are fully completed
    let chapterStatus: 'not_started' | 'in_progress' | 'submitted' | 'completed' = 'in_progress';
    if (submitStatus === 'draft') {
      chapterStatus = 'in_progress';
    } else if (submitStatus === 'submitted') {
      // When status = submitted in payload, set chapter status to 'submitted'
      chapterStatus = 'submitted';
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
        level: level || undefined, // Include level in response if provided
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

