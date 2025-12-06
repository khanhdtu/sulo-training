import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username },
      select: { 
        id: true,
        displayName: true,
        username: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

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
      studentName: user.displayName || user.username,
    });
  } catch (error) {
    console.error('Get daily activity stats by username error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

