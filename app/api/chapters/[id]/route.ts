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

    const chapterId = parseInt(id);
    if (isNaN(chapterId)) {
      return errorResponse('ID chương không hợp lệ', 400);
    }

    const userDifficulty = mapLevelToDifficulty(user.level || 1);

    // Get chapter with sections and exercises
    const chapter = await prisma.chapter.findFirst({
      where: {
        id: chapterId,
        subject: {
          gradeId: user.gradeId, // Ensure chapter belongs to user's grade
        },
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            gradeId: true,
            grade: {
              select: {
                id: true,
                name: true,
                level: true,
              },
            },
          },
        },
        sections: {
          orderBy: { order: 'asc' },
          include: {
            exercises: {
              where: {
                difficulty: userDifficulty, // Filter by user's difficulty level
              },
              orderBy: { order: 'asc' },
              include: {
                questions: {
                  orderBy: { order: 'asc' },
                  select: {
                    id: true,
                    question: true,
                    options: true,
                    points: true,
                    order: true,
                    hint: true,
                    // Don't include answer - will be sent separately after submission
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!chapter) {
      return errorResponse('Không tìm thấy chương hoặc chương không thuộc lớp của bạn', 404);
    }

    // Get user exercise attempts to check completion status
    const exerciseAttempts = await prisma.userExerciseAttempt.findMany({
      where: {
        userId: user.id,
        exercise: {
          section: {
            chapterId: chapterId,
          },
        },
      },
      select: {
        exerciseId: true,
        isCompleted: true,
        score: true,
        totalPoints: true,
        completedAt: true,
        answers: true, // Include answers to restore previous answers when viewing completed exercises
      },
    });

    // Create map for quick lookup
    const attemptMap = new Map(
      exerciseAttempts.map((a) => [a.exerciseId, a])
    );

    // Get chapter progress
    const chapterProgress = await prisma.userChapterProgress.findFirst({
      where: {
        userId: user.id,
        chapterId: chapterId,
      },
      select: {
        status: true,
        progress: true,
        completedSections: true,
        totalSections: true,
      },
    });

    // Debug: Log sections and exercises
    console.log(`\n🔍 Chapter ${chapterId} (${chapter.name}) - User difficulty: ${userDifficulty}`);
    console.log(`  Sections count: ${chapter.sections.length}`);
    chapter.sections.forEach((section, idx) => {
      console.log(`    Section ${idx + 1} (ID: ${section.id}, Name: ${section.name}): ${section.exercises.length} exercises`);
      section.exercises.forEach((ex, exIdx) => {
        console.log(`      Exercise ${exIdx + 1}: ID=${ex.id}, Title="${ex.title}", Difficulty=${ex.difficulty}`);
      });
    });

    // Flatten all exercises from all sections and add completion status
    const allExercisesRaw = chapter.sections.flatMap((section) =>
      section.exercises.map((exercise) => ({
        ...exercise,
        sectionId: section.id,
        sectionName: section.name,
        attempt: attemptMap.get(exercise.id) || null,
        isCompleted: attemptMap.get(exercise.id)?.isCompleted || false,
      }))
    );

    console.log(`  Total exercises after flattening (before dedupe): ${allExercisesRaw.length}`);
    console.log(`  Exercise IDs: [${allExercisesRaw.map(ex => ex.id).join(', ')}]`);

    // Remove duplicates: keep only the first occurrence of each exercise (by title and difficulty)
    // This handles cases where the same exercise exists in multiple sections
    // Use exercise ID as primary key, but also check for title+difficulty duplicates
    const seenExerciseIds = new Set<number>();
    const seenExerciseKeys = new Map<string, number>(); // key: "title|difficulty", value: exercise ID
    const allExercises: typeof allExercisesRaw = [];
    
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
      allExercises.push(exercise);
    }

    console.log(`  Total exercises after deduplication: ${allExercises.length}`);
    console.log(`  Unique Exercise IDs: [${allExercises.map(ex => ex.id).join(', ')}]\n`);

    // Find first incomplete exercise
    const currentExerciseIndex = allExercises.findIndex((ex) => !ex.isCompleted);
    const currentExercise = currentExerciseIndex >= 0 ? allExercises[currentExerciseIndex] : null;

    return successResponse({
      chapter: {
        id: chapter.id,
        name: chapter.name,
        description: chapter.description,
        order: chapter.order,
        subject: chapter.subject,
      },
      exercises: allExercises,
      currentExercise: currentExercise,
      currentExerciseIndex: currentExerciseIndex >= 0 ? currentExerciseIndex : null,
      totalExercises: allExercises.length,
      completedExercises: allExercises.filter((ex) => ex.isCompleted).length,
      chapterProgress: chapterProgress,
    });
  } catch (error) {
    console.error('Get chapter error:', error);
    return errorResponse('Đã xảy ra lỗi. Vui lòng thử lại sau', 500);
  }
}

