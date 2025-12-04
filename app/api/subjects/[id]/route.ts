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
    const exerciseAttempts = await prisma.userExerciseAttempt.findMany({
      where: {
        userId: user.id,
        exercise: {
          section: {
            chapter: {
              subjectId: subjectId,
            },
          },
        },
      },
      select: {
        exerciseId: true,
        score: true,
        totalPoints: true,
        isCompleted: true,
        completedAt: true,
        answers: true, // Include answers to count correct questions
      },
    });

    // Get user chapter progress
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
      lessonProgress.map((p) => [p.lessonId, p])
    );
    const attemptMap = new Map(
      exerciseAttempts.map((a) => [a.exerciseId, a])
    );
    const chapterProgressMap = new Map(
      chapterProgress.map((p) => [p.chapterId, p])
    );

    // Add progress/status to chapters, lessons and exercises
    const subjectWithProgress = {
      ...subject,
      chapters: subject.chapters.map((chapter) => {
        const chapterProgressData = chapterProgressMap.get(chapter.id);
        
        // Debug: Log sections and exercises
        console.log(`\n🔍 Subject ${subjectId} - Chapter ${chapter.id} (${chapter.name}) - User difficulty: ${userDifficulty}`);
        console.log(`  Sections count: ${chapter.sections.length}`);
        chapter.sections.forEach((section, idx) => {
          console.log(`    Section ${idx + 1} (ID: ${section.id}, Name: ${section.name}): ${section.exercises.length} exercises`);
          section.exercises.forEach((ex, exIdx) => {
            console.log(`      Exercise ${exIdx + 1}: ID=${ex.id}, Title="${ex.title}", Difficulty=${ex.difficulty}, Questions=${ex.questions?.length || 0}`);
          });
        });

        // Collect all exercises from all sections (before deduplication)
        const allExercisesRaw: Array<{ id: number; title: string; difficulty: string; questions: any[] }> = [];
        chapter.sections.forEach((section) => {
          section.exercises.forEach((exercise) => {
            allExercisesRaw.push({
              id: exercise.id,
              title: exercise.title,
              difficulty: exercise.difficulty,
              questions: exercise.questions || [],
            });
          });
        });

        console.log(`  Total exercises before deduplication: ${allExercisesRaw.length}`);
        console.log(`  Exercise IDs: [${allExercisesRaw.map(ex => ex.id).join(', ')}]`);

        // Remove duplicates: keep only unique exercises (by ID and by title+difficulty)
        const seenExerciseIds = new Set<number>();
        const seenExerciseKeys = new Map<string, number>(); // key: "title|difficulty", value: exercise ID
        const uniqueExercises: typeof allExercisesRaw = [];
        
        for (let i = 0; i < allExercisesRaw.length; i++) {
          const exercise = allExercisesRaw[i];
          const key = `${exercise.title}|${exercise.difficulty}`;
          
          // Skip if we've already seen this exact exercise ID
          if (seenExerciseIds.has(exercise.id)) {
            console.log(`  ⚠️  Duplicate exercise ID found: ${exercise.id} ("${exercise.title}"), skipping`);
            continue;
          }
          
          // Skip if we've already seen an exercise with the same title+difficulty
          if (seenExerciseKeys.has(key)) {
            const existingId = seenExerciseKeys.get(key);
            console.log(`  ⚠️  Duplicate exercise found: "${exercise.title}" (difficulty: ${exercise.difficulty}), ID: ${exercise.id}, already have ID: ${existingId}, skipping`);
            continue;
          }
          
          seenExerciseIds.add(exercise.id);
          seenExerciseKeys.set(key, exercise.id);
          uniqueExercises.push(exercise);
        }

        console.log(`  Total exercises after deduplication: ${uniqueExercises.length}`);
        console.log(`  Unique Exercise IDs: [${uniqueExercises.map(ex => ex.id).join(', ')}]\n`);

        // Calculate progress based on exercises (not sections)
        // Count total exercises in chapter (after deduplication)
        const totalExercises = uniqueExercises.length;
        
        // Count total questions in chapter (for correct/total questions)
        // Only count questions from unique exercises
        let totalQuestions = 0;
        let exercisesWithQuestions = 0;
        let exercisesWithoutQuestions = 0;
        
        uniqueExercises.forEach((exercise) => {
          const questionCount = exercise.questions?.length || 0;
          totalQuestions += questionCount;
          if (questionCount > 0) {
            exercisesWithQuestions++;
          } else {
            exercisesWithoutQuestions++;
          }
        });
        
        // Debug: Log if there's a mismatch
        if (totalExercises !== totalQuestions) {
          console.log(`Chapter ${chapter.id}: totalExercises=${totalExercises}, totalQuestions=${totalQuestions}, exercisesWithQuestions=${exercisesWithQuestions}, exercisesWithoutQuestions=${exercisesWithoutQuestions}`);
        }
        
        // Create set of unique exercise IDs for filtering sections
        const uniqueExerciseIds = new Set(uniqueExercises.map(ex => ex.id));
        
        // Count completed exercises (exercises with attempts) - only count unique exercises
        const completedExercises = uniqueExercises.filter((exercise) => {
          const attempt = attemptMap.get(exercise.id);
          return attempt && (attempt.isCompleted || (attempt as any).answers);
        }).length;
        
        // Count correct questions from attempts - only count from unique exercises
        let correctQuestions = 0;
        uniqueExercises.forEach((exercise) => {
          const attempt = attemptMap.get(exercise.id);
          if (attempt && attempt.answers) {
            // answers format: { questionId: { answer: string, isCorrect: boolean, ... } }
            const answers = attempt.answers as Record<string, any>;
            Object.values(answers).forEach((answerData: any) => {
              if (answerData.isCorrect === true) {
                correctQuestions++;
              }
            });
          }
        });
        
        // Calculate progress percentage
        const progressPercentage = totalExercises > 0 
          ? Math.round((completedExercises / totalExercises) * 100)
          : 0;
        
        // Determine status
        let status = 'not_started';
        if (completedExercises > 0) {
          status = completedExercises === totalExercises ? 'completed' : 'in_progress';
        }
        
        return {
          ...chapter,
          progress: chapterProgressData ? {
            ...chapterProgressData,
            // Override with exercise-based progress
            progress: progressPercentage,
            completedExercises,
            totalExercises,
            correctQuestions,
            totalQuestions,
            status,
          } : (totalExercises > 0 ? {
            status,
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
          sections: chapter.sections.map((section) => {
            // Filter exercises to only include unique ones (by ID)
            const uniqueSectionExercises = section.exercises.filter((exercise) => {
              return uniqueExerciseIds.has(exercise.id);
            });
            
            return {
              ...section,
              lessons: section.lessons.map((lesson) => ({
                ...lesson,
                progress: progressMap.get(lesson.id) || null,
                status: progressMap.get(lesson.id)?.status || 'not_started',
              })),
              exercises: uniqueSectionExercises.map((exercise) => ({
                ...exercise,
                attempt: attemptMap.get(exercise.id) || null,
                status: attemptMap.get(exercise.id)?.isCompleted
                  ? 'completed'
                  : attemptMap.get(exercise.id)
                  ? 'in_progress'
                  : 'not_started',
              })),
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

