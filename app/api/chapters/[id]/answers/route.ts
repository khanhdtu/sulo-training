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
    const { id } = await params;
    
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

    // Get chapter with sections and exercises including answers
    const chapter = await prisma.chapter.findFirst({
      where: {
        id: chapterId,
        subject: {
          gradeId: user.gradeId,
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
                difficulty: userDifficulty,
              },
              orderBy: { order: 'asc' },
              include: {
                questions: {
                  orderBy: { order: 'asc' },
                  select: {
                    id: true,
                    question: true,
                    answer: true, // Include answer for viewing
                    options: true,
                    points: true,
                    order: true,
                    hint: true,
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

    // Get user exercise attempts for this chapter
    const exerciseIds = chapter.sections.flatMap((section: { exercises: Array<{ id: number }> }) =>
      section.exercises.map((exercise) => exercise.id)
    );

    const userAttempts = await prisma.userExerciseAttempt.findMany({
      where: {
        userId: user.id,
        exerciseId: {
          in: exerciseIds,
        },
      },
      select: {
        exerciseId: true,
        answers: true, // { questionId: { answer: string, isCorrect: boolean } }
      },
    });

    // Create a map for quick lookup: exerciseId -> answers
    const attemptMap = new Map<number, Record<string, any>>();
    userAttempts.forEach((attempt: { exerciseId: number; answers: any }) => {
      attemptMap.set(attempt.exerciseId, attempt.answers as Record<string, any>);
    });

    // Flatten all exercises from all sections
    const allExercisesRaw = chapter.sections.flatMap((section: { id: number; name: string; exercises: Array<any> }) =>
      section.exercises.map((exercise) => ({
        ...exercise,
        sectionId: section.id,
        sectionName: section.name,
        userAnswers: attemptMap.get(exercise.id) || null, // Add user answers
      }))
    );

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

    return successResponse({
      chapter: {
        id: chapter.id,
        name: chapter.name,
        description: chapter.description,
        order: chapter.order,
        subject: chapter.subject,
      },
      exercises: uniqueExercises,
    });
  } catch (error) {
    console.error('Get chapter answers error:', error);
    return errorResponse('Đã xảy ra lỗi. Vui lòng thử lại sau', 500);
  }
}

