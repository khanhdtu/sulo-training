import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mapLevelToDifficulty } from '@/lib/user-level';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const subjectName = searchParams.get('subject');
    const dateStr = searchParams.get('date');
    const isAI = searchParams.get('ai') === 'true';

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
        level: true,
        gradeId: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // If AI questions requested
    if (isAI) {
      if (!dateStr) {
        return NextResponse.json(
          { error: 'Date is required for AI questions' },
          { status: 400 }
        );
      }

      const date = new Date(dateStr);
      date.setHours(0, 0, 0, 0);
      const dateEnd = new Date(date);
      dateEnd.setHours(23, 59, 59, 999);

      // Get AI conversation messages from the specified date
      const aiMessages = await prisma.message.findMany({
        where: {
          conversation: {
            userId: user.id,
            type: 'free_chat',
          },
          role: 'user',
          createdAt: {
            gte: date,
            lte: dateEnd,
          },
        },
        include: {
          conversation: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      return NextResponse.json({
        type: 'ai',
        messages: aiMessages.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          createdAt: msg.createdAt,
          conversationTitle: msg.conversation.title,
        })),
      });
    }

    // Get exercises by subject and date
    if (!subjectName || !dateStr) {
      return NextResponse.json(
        { error: 'Subject and date are required' },
        { status: 400 }
      );
    }

    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    if (!user.gradeId || !user.level) {
      return NextResponse.json(
        { error: 'User grade and level information is incomplete' },
        { status: 400 }
      );
    }

    const userDifficulty = mapLevelToDifficulty(user.level);

    // Find subject
    const subject = await prisma.subject.findFirst({
      where: {
        name: subjectName,
        gradeId: user.gradeId,
      },
      include: {
        chapters: {
          include: {
            sections: {
              include: {
                exercises: {
                  where: {
                    difficulty: userDifficulty,
                  },
                  include: {
                    questions: {
                      orderBy: { order: 'asc' },
                      select: {
                        id: true,
                        question: true,
                        answer: true,
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
        },
      },
    });

    if (!subject) {
      return NextResponse.json(
        { error: 'Subject not found' },
        { status: 404 }
      );
    }

    // Get all exercises from all chapters
    const allExercises = subject.chapters.flatMap((chapter: any) =>
      chapter.sections.flatMap((section: any) =>
        section.exercises.map((exercise: any) => ({
          ...exercise,
          sectionId: section.id,
          sectionName: section.name,
          chapterId: chapter.id,
          chapterName: chapter.name,
        }))
      )
    );

    // Get exercise IDs
    const exerciseIds = allExercises.map((ex: any) => ex.id);

    // Get user attempts for exercises done on the specified date
    const userAttempts = await prisma.userExerciseAttempt.findMany({
      where: {
        userId: user.id,
        exerciseId: { in: exerciseIds },
        createdAt: {
          gte: date,
          lte: dateEnd,
        },
      },
      select: {
        exerciseId: true,
        answers: true,
      },
    });

    // Create attempt map
    const attemptMap = new Map<number, Record<string, any>>();
    userAttempts.forEach((attempt: any) => {
      attemptMap.set(attempt.exerciseId, attempt.answers as Record<string, any>);
    });

    // Filter exercises that have attempts and add user answers
    const exercisesWithAnswers = allExercises
      .filter((exercise: any) => attemptMap.has(exercise.id))
      .map((exercise: any) => ({
        id: exercise.id,
        title: exercise.title,
        description: exercise.description,
        difficulty: exercise.difficulty,
        type: exercise.type,
        points: exercise.points,
        questions: exercise.questions,
        sectionId: exercise.sectionId,
        sectionName: exercise.sectionName,
        chapterName: exercise.chapterName,
        userAnswers: attemptMap.get(exercise.id) || null,
      }));

    // Remove duplicates by exercise ID
    const uniqueExercisesMap = new Map<number, typeof exercisesWithAnswers[0]>();
    exercisesWithAnswers.forEach((ex: any) => {
      if (!uniqueExercisesMap.has(ex.id)) {
        uniqueExercisesMap.set(ex.id, ex);
      }
    });

    return NextResponse.json({
      type: 'subject',
      subject: {
        id: subject.id,
        name: subject.name,
      },
      exercises: Array.from(uniqueExercisesMap.values()),
    });
  } catch (error) {
    console.error('Get answers error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

