import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/middleware-auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { mapLevelToDifficulty } from '@/lib/user-level';

export async function GET(
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

    if (!user.gradeId) {
      return errorResponse('Vui lòng cập nhật thông tin lớp học trước', 400);
    }

    if (!user.level) {
      return errorResponse('Vui lòng cập nhật thông tin trình độ học trước', 400);
    }

    const subjectId = parseInt(id);
    const userDifficulty = mapLevelToDifficulty(user.level);
    if (isNaN(subjectId)) {
      return errorResponse('ID môn học không hợp lệ', 400);
    }

    // Get subject with full curriculum structure
    // Verify that subject belongs to user's grade
    const subject = await prisma.subject.findFirst({
      where: { 
        id: subjectId,
        gradeId: user.gradeId, // Ensure subject belongs to user's grade
      },
      include: {
        grade: {
          select: {
            id: true,
            name: true,
            level: true,
          },
        },
        chapters: {
          orderBy: {
            order: 'asc',
          },
          include: {
            sections: {
              orderBy: {
                order: 'asc',
              },
              include: {
                lessons: {
                  orderBy: {
                    order: 'asc',
                  },
                  select: {
                    id: true,
                    title: true,
                    type: true,
                    mediaUrl: true,
                    order: true,
                  },
                },
                exercises: {
                  where: {
                    difficulty: userDifficulty, // Only show exercises matching user's level
                  },
                  orderBy: {
                    order: 'asc',
                  },
                  select: {
                    id: true,
                    title: true,
                    description: true,
                    difficulty: true,
                    type: true,
                    points: true,
                    timeLimit: true,
                    order: true,
                    questions: {
                      select: {
                        id: true, // Only need id to count
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!subject) {
      return errorResponse('Không tìm thấy môn học hoặc môn học không thuộc lớp của bạn', 404);
    }

    // Get user progress for lessons
    const lessonProgress = await prisma.userLessonProgress.findMany({
      where: {
        userId: user.id,
        lesson: {
          section: {
            chapter: {
              subjectId: subjectId,
            },
          },
        },
      },
      select: {
        lessonId: true,
        status: true,
        progress: true,
        lastAccessedAt: true,
        completedAt: true,
      },
    });

    // Get user exercise attempts (including answers to calculate correct questions)
    // IMPORTANT: Only get attempts for exercises matching user's difficulty level
    // This ensures chapter progress is calculated correctly for the user's level
    // Order by updatedAt desc to get the latest attempt for each exercise
    const exerciseAttemptsRaw = await prisma.userExerciseAttempt.findMany({
      where: {
        userId: user.id,
        exercise: {
          difficulty: userDifficulty, // Only get attempts for exercises matching user's level
          section: {
            chapter: {
              subjectId: subjectId,
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc', // Get latest attempt first
      },
    });
    
    // Map to include status field (which exists in DB but may not be in Prisma types yet)
    // Group by exerciseId to get only the latest attempt for each exercise
    const attemptMapByExercise = new Map<number, any>();
    exerciseAttemptsRaw.forEach((a: any) => {
      const exerciseId = a.exerciseId;
      // Only keep the first (latest) attempt for each exercise
      if (!attemptMapByExercise.has(exerciseId)) {
        attemptMapByExercise.set(exerciseId, {
          exerciseId: a.exerciseId,
          score: a.score,
          totalPoints: a.totalPoints,
          isCompleted: a.isCompleted,
          status: (a as any).status || 'draft', // Get status field from DB, default to 'draft' if not set
          completedAt: a.completedAt,
          answers: a.answers,
        });
      }
    });
    
    const exerciseAttempts = Array.from(attemptMapByExercise.values());

    // Get user chapter progress
    // NOTE: Chapter progress in DB may contain data from all difficulty levels
    // We will recalculate it based on exercises matching user's difficulty level
    // But we still fetch it to get lastAccessedAt and completedAt timestamps
    let chapterProgress: any[] = [];
    try {
      chapterProgress = await prisma.userChapterProgress.findMany({
        where: {
          userId: user.id,
          chapter: {
            subjectId: subjectId,
          },
        },
        select: {
          chapterId: true,
          status: true,
          progress: true,
          completedSections: true,
          totalSections: true,
          completedExercises: true, // Get this to compare with our calculation
          totalExercises: true, // Get this to compare with our calculation
          lastAccessedAt: true,
          completedAt: true,
        },
      });
    } catch (error: any) {
      // If table doesn't exist yet, continue without chapter progress
      if (error?.code === 'P2001' || error?.message?.includes('does not exist')) {
        console.warn('Chapter progress table not available yet');
      } else {
        console.error('Error fetching chapter progress:', error);
      }
    }

    // Create maps for quick lookup
    const progressMap = new Map(
      lessonProgress.map((p: any) => [p.lessonId, p])
    );
    const attemptMap = new Map(
      exerciseAttempts.map((a: any) => [a.exerciseId, a])
    );
    const chapterProgressMap = new Map(
      chapterProgress.map((p: any) => [p.chapterId, p])
    );

    // Add progress/status to chapters, lessons and exercises
    const subjectWithProgress = {
      ...subject,
      chapters: subject.chapters.map((chapter: any) => {
        const chapterProgressData = chapterProgressMap.get(chapter.id);

        // Collect all exercises from all sections (before deduplication)
        const allExercisesRaw: Array<{ id: number; title: string; difficulty: string; questions: any[] }> = [];
        chapter.sections.forEach((section: any) => {
          section.exercises.forEach((exercise: any) => {
            allExercisesRaw.push({
              id: exercise.id,
              title: exercise.title,
              difficulty: exercise.difficulty,
              questions: exercise.questions || [],
            });
          });
        });

        // Remove duplicates: keep only unique exercises (by ID and by title+difficulty)
        const seenExerciseIds = new Set<number>();
        const seenExerciseKeys = new Map<string, number>(); // key: "title|difficulty", value: exercise ID
        const uniqueExercises: typeof allExercisesRaw = [];
        
        for (let i = 0; i < allExercisesRaw.length; i++) {
          const exercise = allExercisesRaw[i];
          const key = `${exercise.title}|${exercise.difficulty}`;
          
          // Skip if we've already seen this exact exercise ID
          if (seenExerciseIds.has(exercise.id)) {
            continue;
          }
          
          // Skip if we've already seen an exercise with the same title+difficulty
          if (seenExerciseKeys.has(key)) {
            continue;
          }
          
          seenExerciseIds.add(exercise.id);
          seenExerciseKeys.set(key, exercise.id);
          uniqueExercises.push(exercise);
        }

        // Calculate progress based on exercises (not sections)
        // Count total exercises in chapter (after deduplication)
        const totalExercises = uniqueExercises.length;
        
        // Count total questions in chapter (for correct/total questions)
        // Only count questions from unique exercises of user's difficulty level
        let totalQuestions = 0;
        
        uniqueExercises.forEach((exercise) => {
          const questionCount = exercise.questions?.length || 0;
          totalQuestions += questionCount;
        });
        
        // Create set of unique exercise IDs for filtering sections
        const uniqueExerciseIds = new Set(uniqueExercises.map(ex => ex.id));
        
        // Check if there are any draft exercises or exercises with attempts
        let hasDraftExercises = false;
        let hasAnyAttempts = false;
        let completedExercises = 0;
        
        uniqueExercises.forEach((exercise) => {
          const attempt = attemptMap.get(exercise.id);
          if (attempt) {
            hasAnyAttempts = true;
            // Check if it's a draft
            if ((attempt as any).status === 'draft') {
              hasDraftExercises = true;
            }
            // Count as completed if isCompleted is true (submitted and completed)
            if ((attempt as any)?.isCompleted) {
              completedExercises++;
            }
          }
        });
        
        // Count correct questions from attempts - only count from unique exercises
        // IMPORTANT: Count all questions that were answered correctly across all attempts
        // For submitted attempts: answers format is { questionId: { answer: string, isCorrect: boolean, isAnswered: boolean } }
        // For draft attempts: answers format is { questionId: "answer" } - skip these (not graded yet)
        let correctQuestions = 0;
        uniqueExercises.forEach((exercise) => {
          const attempt = attemptMap.get(exercise.id) as any;
          if (attempt && attempt.answers && attempt.status !== 'draft') {
            // Only count from submitted/completed attempts (not draft)
            const answers = attempt.answers as Record<string, any>;
            Object.entries(answers).forEach(([questionId, answerData]: [string, any]) => {
              // For submitted, answerData is an object with isCorrect property
              // For draft, answerData is just a string - skip (not graded yet)
              if (typeof answerData === 'object' && answerData.isCorrect === true) {
                correctQuestions++;
              }
            });
          }
        });
        
        // Calculate progress percentage based on completed exercises (not draft)
        const progressPercentage = totalExercises > 0 
          ? Math.round((completedExercises / totalExercises) * 100)
          : 0;
        
        // Determine status based on exercises of user's difficulty level
        // Priority: 1. Check DB status (submitted/completed) - highest priority, 2. Check draft exercises, 3. Check completed exercises
        let status = 'not_started';
        
        // FIRST PRIORITY: Check DB status - if chapter is already submitted or completed, use DB status
        // This ensures that once a chapter is submitted, the status remains 'submitted' or 'completed'
        if (chapterProgressData && (chapterProgressData.status === 'submitted' || chapterProgressData.status === 'completed')) {
          status = chapterProgressData.status;
        }
        // Second priority: Check if there are draft exercises (for user's difficulty level)
        // If has draft exercises, always set to 'in_progress' (user is working on it)
        else if (hasDraftExercises) {
          status = 'in_progress';
        } 
        // Third priority: Check if all exercises of user's level are completed
        else if (totalExercises > 0 && completedExercises === totalExercises) {
          status = 'completed';
        }
        // Fourth priority: Check if there are any attempts (submitted exercises of user's level)
        else if (hasAnyAttempts) {
          status = 'in_progress';
        }
        // Fifth priority: Check chapterProgressData from DB (as fallback)
        // Only use DB status if we have no exercises of user's level and DB has data
        else if (totalExercises === 0 && chapterProgressData && (chapterProgressData.status === 'in_progress' || chapterProgressData.status === 'completed')) {
          // If no exercises of user's level exist, use DB status as fallback
          status = chapterProgressData.status;
        }
        // Sixth priority: Use DB status if available (for not_started or in_progress)
        else if (chapterProgressData && chapterProgressData.status) {
          status = chapterProgressData.status;
        }
        
        // Use calculated status (which respects DB status for submitted/completed chapters)
        const finalStatus = status;
        
        return {
          ...chapter,
          progress: chapterProgressData ? {
            ...chapterProgressData,
            // Override with exercise-based progress and calculated status
            progress: progressPercentage,
            completedExercises,
            totalExercises,
            correctQuestions,
            totalQuestions,
            status: finalStatus, // Always use calculated status (considers draft)
          } : (totalExercises > 0 ? {
            status: finalStatus, // Use calculated status
            progress: progressPercentage,
            completedExercises,
            totalExercises,
            correctQuestions,
            totalQuestions,
            completedSections: 0,
            totalSections: chapter.sections.length,
            lastAccessedAt: null,
            completedAt: null,
          } : null),
          sections: chapter.sections.map((section: any) => {
            // Filter exercises to only include unique ones (by ID)
            const uniqueSectionExercises = section.exercises.filter((exercise: any) => {
              return uniqueExerciseIds.has(exercise.id);
            });
            
            return {
              ...section,
              lessons: section.lessons.map((lesson: any) => ({
                ...lesson,
                progress: progressMap.get(lesson.id) || null,
                status: (progressMap.get(lesson.id) as any)?.status || 'not_started',
              })),
              exercises: uniqueSectionExercises.map((exercise: any) => {
                const attempt = attemptMap.get(exercise.id) as any;
                return {
                  ...exercise,
                  attempt: attempt || null,
                  status: attempt?.isCompleted
                    ? 'completed'
                    : attempt
                    ? 'in_progress'
                    : 'not_started',
                };
              }),
            };
          }),
        };
      }),
    };

    return successResponse({ subject: subjectWithProgress });
  } catch (error) {
    console.error('Get subject error:', error);
    return errorResponse('Đã xảy ra lỗi. Vui lòng thử lại sau', 500);
  }
}

