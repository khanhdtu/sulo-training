#!/usr/bin/env tsx
/**
 * Submit Chapter 28 for user nhahan directly to database
 */

import { config } from 'dotenv';
config();

async function main() {
  const { prisma } = await import('../lib/prisma');
  
  try {
    // Check chapter 28
    const chapter = await prisma.chapter.findUnique({
      where: { id: 28 },
      include: {
        subject: true,
        sections: {
          include: {
            exercises: {
              include: {
                questions: {
                  orderBy: { order: 'asc' },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!chapter) {
      console.error('❌ Chapter 28 not found!');
      process.exit(1);
    }

    console.log(`📚 Chapter: ${chapter.name}`);
    console.log(`📖 Subject ID: ${chapter.subjectId}`);
    console.log(`📖 Subject: ${chapter.subject.name}`);
    
    if (chapter.subjectId !== 7) {
      console.error(`❌ Chapter 28 belongs to subject ${chapter.subjectId}, not subject 7!`);
      process.exit(1);
    }

    // Get user nhahan
    const user = await prisma.user.findUnique({
      where: { username: 'nhahan' },
    });

    if (!user) {
      console.error('❌ User "nhahan" not found!');
      process.exit(1);
    }

    console.log(`\n👤 User: ${user.username} (ID: ${user.id})`);

    // Get all exercises in chapter
    const allExercises = chapter.sections.flatMap(section => section.exercises);
    console.log(`\n📝 Found ${allExercises.length} exercises in chapter 28`);

    let submittedCount = 0;
    let completedCount = 0;

    // Process each exercise
    for (const exercise of allExercises) {
      // Calculate answers
      let correctCount = 0;
      let answeredCount = 0;
      let totalPoints = 0;
      let earnedPoints = 0;
      const answersWithResults: Record<string, any> = {};

      for (const question of exercise.questions) {
        totalPoints += question.points;
        const questionId = question.id.toString();
        
        // Use correct answer
        const userAnswer = question.answer;
        const hasAnswer = userAnswer !== undefined && userAnswer !== null && userAnswer.trim() !== '';
        
        if (hasAnswer) {
          answeredCount++;
          
          let isCorrect = false;
          if (exercise.type === 'multiple_choice') {
            const normalizedUserAnswer = userAnswer.trim().toUpperCase();
            const normalizedCorrectAnswer = question.answer.trim().toUpperCase();
            isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;
          } else {
            const normalizedUserAnswer = userAnswer.trim().toLowerCase();
            const normalizedCorrectAnswer = question.answer.trim().toLowerCase();
            isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;
          }
          
          const earnedPointsForQuestion = isCorrect ? question.points : 0;
          
          answersWithResults[questionId] = {
            answer: userAnswer,
            isCorrect,
          };

          if (isCorrect) {
            correctCount++;
            earnedPoints += question.points;
          }
        } else {
          answersWithResults[questionId] = {
            answer: '',
            isCorrect: false,
            isAnswered: false,
          };
        }
      }

      const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
      const isCompleted = answeredCount === exercise.questions.length && correctCount === exercise.questions.length;

      // Create or update exercise attempt
      const existingAttempt = await prisma.userExerciseAttempt.findFirst({
        where: {
          userId: user.id,
          exerciseId: exercise.id,
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
            status: 'submitted',
            completedAt: isCompleted ? new Date() : null,
          },
        });
      } else {
        await prisma.userExerciseAttempt.create({
          data: {
            userId: user.id,
            exerciseId: exercise.id,
            answers: answersWithResults,
            score: score,
            totalPoints: totalPoints,
            isCompleted: isCompleted,
            status: 'submitted',
            completedAt: isCompleted ? new Date() : null,
          },
        });
      }

      submittedCount++;
      if (isCompleted) {
        completedCount++;
      }
    }

    // Update chapter progress
    const allExerciseIds = allExercises.map(e => e.id);
    const allAttempts = await prisma.userExerciseAttempt.findMany({
      where: {
        userId: user.id,
        exerciseId: { in: allExerciseIds },
      },
    });

    const completedExercises = allAttempts.filter(a => a.isCompleted && a.status !== 'draft');

    await prisma.userChapterProgress.upsert({
      where: {
        userId_chapterId: {
          userId: user.id,
          chapterId: 28,
        },
      },
      create: {
        userId: user.id,
        chapterId: 28,
        subjectId: chapter.subject.id,
        gradeId: chapter.subject.gradeId,
        status: 'completed',
        completedExercises: completedExercises.length,
        totalExercises: allExerciseIds.length,
        lastAccessedAt: new Date(),
        completedAt: new Date(),
      },
      update: {
        status: 'completed',
        completedExercises: completedExercises.length,
        totalExercises: allExerciseIds.length,
        lastAccessedAt: new Date(),
        completedAt: new Date(),
      },
    });

    console.log(`\n✅ Chapter submitted successfully!`);
    console.log(`   Submitted: ${submittedCount} exercises`);
    console.log(`   Completed: ${completedCount} exercises`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

