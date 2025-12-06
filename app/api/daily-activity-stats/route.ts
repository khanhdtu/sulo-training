import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware-auth';

// Mock data for public preview
function getMockStats() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  return {
    subjectStats: [
      {
        subjectName: 'Toán',
        questionCount: 5,
        details: [
          {
            exerciseTitle: 'Bài tập về nhà - Phép cộng',
            chapterName: 'Chương 1: Số tự nhiên',
            questionCount: 3,
          },
          {
            exerciseTitle: 'Bài tập về nhà - Phép trừ',
            chapterName: 'Chương 1: Số tự nhiên',
            questionCount: 2,
          },
        ],
      },
      {
        subjectName: 'Tiếng Anh',
        questionCount: 3,
        details: [
          {
            exerciseTitle: 'Bài tập từ vựng',
            chapterName: 'Chương 1: Greetings',
            questionCount: 3,
          },
        ],
      },
      {
        subjectName: 'Tiếng Việt',
        questionCount: 5,
        details: [
          {
            exerciseTitle: 'Bài tập đọc hiểu',
            chapterName: 'Chương 1: Việt Nam - Tổ Quốc em',
            questionCount: 5,
          },
        ],
      },
      {
        subjectName: 'Lịch Sử',
        questionCount: 0,
        details: [],
      },
    ],
    aiQuestionCount: 10,
    date: yesterday.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    // Check if this is a public request (no auth header)
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      // Return mock data for public preview
      return NextResponse.json(getMockStats());
    }

    // Authenticated request - get real data
    const user = await requireAuth(request);
    
    // Calculate yesterday's date (start and end of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    // Get exercise attempts from yesterday
    const exerciseAttempts = await prisma.userExerciseAttempt.findMany({
      where: {
        userId: user.id,
        createdAt: {
          gte: yesterday,
          lte: yesterdayEnd,
        },
      },
      include: {
        exercise: {
          include: {
            section: {
              include: {
                chapter: {
                  include: {
                    subject: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
            questions: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    // Group by subject and count unique questions
    const subjectMap = new Map<string, {
      subjectName: string;
      questionCount: number;
      details: Array<{
        exerciseTitle: string;
        chapterName: string;
        questionCount: number;
      }>;
    }>();

    // Track unique questions per subject to avoid double counting
    const subjectQuestionSets = new Map<string, Set<number>>();
    // Track unique exercises to avoid duplicate details
    const processedExercises = new Set<number>();

    exerciseAttempts.forEach((attempt) => {
      const subject = attempt.exercise.section.chapter.subject;
      const subjectName = subject.name;
      const exerciseId = attempt.exerciseId;
      const questionIds = attempt.exercise.questions.map((q) => q.id);

      // Initialize subject map if needed
      if (!subjectMap.has(subjectName)) {
        subjectMap.set(subjectName, {
          subjectName,
          questionCount: 0,
          details: [],
        });
        subjectQuestionSets.set(subjectName, new Set());
      }

      const subjectData = subjectMap.get(subjectName)!;
      const subjectQuestionSet = subjectQuestionSets.get(subjectName)!;

      // Count unique questions for this subject
      questionIds.forEach((qId) => {
        if (!subjectQuestionSet.has(qId)) {
          subjectQuestionSet.add(qId);
          subjectData.questionCount++;
        }
      });

      // Add detail for this exercise (only once per exercise)
      if (!processedExercises.has(exerciseId)) {
        processedExercises.add(exerciseId);
        
        const exerciseTitle = attempt.exercise.title;
        const chapterName = attempt.exercise.section.chapter.name;
        const uniqueQuestionCount = questionIds.length;

        subjectData.details.push({
          exerciseTitle,
          chapterName,
          questionCount: uniqueQuestionCount,
        });
      }
    });

    // Get AI conversation messages from yesterday
    const aiMessages = await prisma.message.findMany({
      where: {
        conversation: {
          userId: user.id,
          type: 'free_chat',
        },
        role: 'user',
        createdAt: {
          gte: yesterday,
          lte: yesterdayEnd,
        },
      },
    });

    const aiQuestionCount = aiMessages.length;

    // Convert map to array and sort by subject name
    const subjectStats = Array.from(subjectMap.values()).sort((a, b) =>
      a.subjectName.localeCompare(b.subjectName)
    );

    return NextResponse.json({
      subjectStats,
      aiQuestionCount,
      date: yesterday.toISOString(),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Get daily activity stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

