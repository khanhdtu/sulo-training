#!/usr/bin/env tsx
/**
 * Debug script for chapter submit issue
 * Usage: npx tsx scripts/debug-submit-chapter.ts
 */

import { config } from 'dotenv';

// Load .env file FIRST before any other imports
config();

interface DebugInfo {
  user: any;
  chapter: any;
  exercises: any[];
  answersByExercise: Record<number, Record<string, string>>;
  exercisesAnswers: Record<string, Record<string, string>>;
}

async function debugChapterSubmit(username: string, chapterId: number) {
  console.log('🔍 Debug Chapter Submit\n');
  console.log('='.repeat(60));
  console.log(`Username: ${username}`);
  console.log(`Chapter ID: ${chapterId}`);
  console.log('='.repeat(60));
  console.log();

  // Dynamic import to ensure env is loaded first
  const { prisma } = await import('../lib/prisma');

  try {
    // 1. Get user
    console.log('📋 Step 1: Get user info...');
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        name: true,
        displayName: true,
        email: true,
        level: true,
        gradeId: true,
      },
    });

    if (!user) {
      console.error(`❌ User "${username}" not found!`);
      return;
    }

    console.log(`✅ User found:`, {
      id: user.id,
      username: user.username,
      name: user.name,
      level: user.level,
      gradeId: user.gradeId,
    });
    console.log();

    // 2. Get chapter with exercises
    console.log('📋 Step 2: Get chapter with exercises...');
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
        sections: {
          include: {
            exercises: {
              include: {
                questions: {
                  orderBy: { order: 'asc' },
                  select: {
                    id: true,
                    question: true,
                    options: true,
                    answer: true,
                    points: true,
                    order: true,
                  },
                },
              },
            },
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            gradeId: true,
          },
        },
      },
    });

    if (!chapter) {
      console.error(`❌ Chapter ${chapterId} not found!`);
      return;
    }

    console.log(`✅ Chapter found:`, {
      id: chapter.id,
      name: chapter.name,
      subjectId: chapter.subject.id,
      subjectName: chapter.subject.name,
      sectionsCount: chapter.sections.length,
    });
    console.log();

    // 3. Get all exercises in chapter
    const allExercises: any[] = [];
    chapter.sections.forEach((section: any) => {
      section.exercises.forEach((exercise: any) => {
        allExercises.push({
          id: exercise.id,
          title: exercise.title,
          type: exercise.type,
          sectionId: section.id,
          sectionName: section.name,
          questionsCount: exercise.questions.length,
        });
      });
    });

    console.log(`📋 Step 3: Exercises in chapter (${allExercises.length} total):`);
    allExercises.forEach((ex, idx) => {
      console.log(`  ${idx + 1}. Exercise ${ex.id}: ${ex.title} (${ex.type}, ${ex.questionsCount} questions)`);
    });
    console.log();

    // 4. Get user attempts for this chapter
    console.log('📋 Step 4: Get user attempts for this chapter...');
    const allExerciseIds = allExercises.map((ex) => ex.id);
    const attempts = await prisma.userExerciseAttempt.findMany({
      where: {
        userId: user.id,
        exerciseId: { in: allExerciseIds },
      },
      select: {
        id: true,
        exerciseId: true,
        status: true,
        isCompleted: true,
        answers: true,
        score: true,
      },
    });

    console.log(`✅ Found ${attempts.length} attempts:`);
    attempts.forEach((attempt: any) => {
      const exercise = allExercises.find((ex) => ex.id === attempt.exerciseId);
      const answersCount = attempt.answers ? Object.keys(attempt.answers as Record<string, any>).length : 0;
      console.log(`  - Exercise ${attempt.exerciseId} (${exercise?.title || 'Unknown'}):`);
      console.log(`    Status: ${attempt.status}`);
      console.log(`    IsCompleted: ${attempt.isCompleted}`);
      console.log(`    Answers count: ${answersCount}`);
      console.log(`    Score: ${attempt.score || 'N/A'}`);
    });
    console.log();

    // 5. Simulate the submit logic
    console.log('📋 Step 5: Simulate submit logic...');
    const answersByExercise: Record<number, Record<string, string>> = {};

    // Build answersByExercise from attempts
    attempts.forEach((attempt: any) => {
      if (attempt.answers) {
        const cleanAnswers: Record<string, string> = {};
        const answers = attempt.answers as Record<string, any>;
        
        Object.keys(answers).forEach((questionId) => {
          const answer = answers[questionId];
          if (typeof answer === 'string') {
            cleanAnswers[questionId] = answer;
          } else if (answer && typeof answer === 'object' && 'answer' in answer) {
            cleanAnswers[questionId] = answer.answer;
          }
        });

        if (Object.keys(cleanAnswers).length > 0) {
          answersByExercise[attempt.exerciseId] = cleanAnswers;
        }
      }
    });

    console.log(`✅ Answers by exercise (${Object.keys(answersByExercise).length} exercises):`);
    Object.keys(answersByExercise).forEach((exerciseIdStr) => {
      const exerciseId = parseInt(exerciseIdStr);
      const exercise = allExercises.find((ex) => ex.id === exerciseId);
      const answers = answersByExercise[exerciseId];
      console.log(`  - Exercise ${exerciseId} (${exercise?.title || 'Unknown'}): ${Object.keys(answers).length} answers`);
    });
    console.log();

    // 6. Simulate exercisesAnswers extraction
    console.log('📋 Step 6: Simulate exercisesAnswers extraction...');
    const exercisesAnswers: Record<string, Record<string, string>> = {};

    allExercises.forEach((exercise) => {
      const exerciseAnswers = answersByExercise[exercise.id];
      if (exerciseAnswers && Object.keys(exerciseAnswers).length > 0) {
        const cleanAnswers: Record<string, string> = {};

        // Get exercise details with questions
        const exerciseDetails = chapter.sections
          .flatMap((s: any) => s.exercises)
          .find((e: any) => e.id === exercise.id);

        if (exerciseDetails && exerciseDetails.questions) {
          exerciseDetails.questions.forEach((q: any) => {
            const rawAnswer = exerciseAnswers[q.id.toString()];
            if (rawAnswer !== undefined && rawAnswer !== null) {
              const answerValue = typeof rawAnswer === 'string' ? rawAnswer : (rawAnswer?.answer || '');
              if (answerValue && answerValue.trim() !== '') {
                if (exercise.type === 'multiple_choice' && q.options) {
                  const options = q.options as Record<string, string>;
                  if (/^[A-D]$/i.test(answerValue)) {
                    cleanAnswers[q.id.toString()] = answerValue.toUpperCase();
                  } else {
                    const matchingKey = Object.keys(options).find(
                      (key) => {
                        const optionValue = options[key];
                        return optionValue === answerValue ||
                          optionValue.trim().toLowerCase() === answerValue.trim().toLowerCase();
                      }
                    );
                    cleanAnswers[q.id.toString()] = matchingKey || answerValue;
                  }
                } else {
                  cleanAnswers[q.id.toString()] = answerValue;
                }
              }
            }
          });
        }

        if (Object.keys(cleanAnswers).length > 0) {
          exercisesAnswers[exercise.id.toString()] = cleanAnswers;
        }
      }
    });

    console.log(`✅ Exercises answers (${Object.keys(exercisesAnswers).length} exercises):`);
    Object.keys(exercisesAnswers).forEach((exerciseIdStr) => {
      const exerciseId = parseInt(exerciseIdStr);
      const exercise = allExercises.find((ex) => ex.id === exerciseId);
      const answers = exercisesAnswers[exerciseIdStr];
      console.log(`  - Exercise ${exerciseId} (${exercise?.title || 'Unknown'}): ${Object.keys(answers).length} answers`);
      Object.keys(answers).forEach((questionId) => {
        console.log(`    Q${questionId}: ${answers[questionId]}`);
      });
    });
    console.log();

    // 7. Check if exercisesAnswers is empty
    if (Object.keys(exercisesAnswers).length === 0) {
      console.error('❌ ERROR: exercisesAnswers is empty!');
      console.log('   This would cause "Không có bài tập nào để lưu" error');
      console.log();
      console.log('🔍 Debugging info:');
      console.log(`   - Total exercises in chapter: ${allExercises.length}`);
      console.log(`   - Attempts found: ${attempts.length}`);
      console.log(`   - AnswersByExercise keys: ${Object.keys(answersByExercise).length}`);
      console.log();
      
      // Check why exercisesAnswers is empty
      if (attempts.length === 0) {
        console.log('   ⚠️  No attempts found - user has not answered any questions');
      } else {
        console.log('   ⚠️  Attempts found but exercisesAnswers is empty');
        console.log('   Checking answers format...');
        attempts.forEach((attempt: any) => {
          if (attempt.answers) {
            const answers = attempt.answers as Record<string, any>;
            console.log(`   Exercise ${attempt.exerciseId} answers:`, JSON.stringify(answers, null, 2));
          }
        });
      }
    } else {
      console.log('✅ exercisesAnswers is NOT empty - submit should work');
      console.log(`   Total exercises with answers: ${Object.keys(exercisesAnswers).length}`);
    }

    // 8. Check chapter progress
    console.log();
    console.log('📋 Step 7: Check chapter progress...');
    const chapterProgress = await prisma.userChapterProgress.findUnique({
      where: {
        userId_chapterId: {
          userId: user.id,
          chapterId: chapterId,
        },
      },
    });

    if (chapterProgress) {
      console.log(`✅ Chapter progress found:`, {
        status: chapterProgress.status,
        completedExercises: chapterProgress.completedExercises,
        totalExercises: chapterProgress.totalExercises,
        lastAccessedAt: chapterProgress.lastAccessedAt,
        completedAt: chapterProgress.completedAt,
      });
    } else {
      console.log('⚠️  No chapter progress found');
    }

    // 9. Check all attempts status after potential submit
    console.log();
    console.log('📋 Step 8: Check all attempts status...');
    const allAttemptsAfter = await prisma.userExerciseAttempt.findMany({
      where: {
        userId: user.id,
        exerciseId: { in: allExerciseIds },
      },
      select: {
        exerciseId: true,
        status: true,
        isCompleted: true,
      },
      orderBy: {
        exerciseId: 'asc',
      },
    });

    const statusCounts = {
      draft: 0,
      submitted: 0,
      completed: 0,
    };

    allAttemptsAfter.forEach((attempt: any) => {
      if (attempt.status === 'draft') statusCounts.draft++;
      else if (attempt.status === 'submitted') statusCounts.submitted++;
      else if (attempt.status === 'completed') statusCounts.completed++;
    });

    console.log(`✅ Attempts status summary:`, statusCounts);
    console.log(`   Total attempts: ${allAttemptsAfter.length}`);
    console.log(`   Total exercises in chapter: ${allExerciseIds.length}`);
    
    // Check if all exercises are submitted
    const allExercisesSubmitted = allExerciseIds.length > 0 && 
      allExerciseIds.every((exerciseId: number) => {
        const attempt = allAttemptsAfter.find((a: any) => a.exerciseId === exerciseId);
        return attempt && attempt.status !== 'draft';
      });
    
    console.log(`   All exercises submitted (not draft): ${allExercisesSubmitted}`);
    
    if (allExercisesSubmitted && chapterProgress?.status !== 'completed') {
      console.log('⚠️  WARNING: All exercises are submitted but chapter status is not "completed"');
      console.log(`   Expected: completed, Actual: ${chapterProgress?.status}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
  } finally {
    const { prisma } = await import('../lib/prisma');
    await prisma.$disconnect();
  }
}

// Run debug
const username = 'nhahan';
const chapterId = 9;

console.log('🚀 Starting debug...\n');
debugChapterSubmit(username, chapterId)
  .then(() => {
    console.log('\n✅ Debug completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Debug failed:', error);
    process.exit(1);
  });

