#!/usr/bin/env tsx
/**
 * Test submit chapter and check status
 * Usage: npx tsx scripts/test-submit-and-check-status.ts
 */

import { config } from 'dotenv';

// Load .env file FIRST before any other imports
config();

async function testSubmitAndCheckStatus(username: string, password: string, chapterId: number) {
  console.log('🧪 Test Submit Chapter and Check Status\n');
  console.log('='.repeat(60));
  console.log(`Username: ${username}`);
  console.log(`Chapter ID: ${chapterId}`);
  console.log('='.repeat(60));
  console.log();

  // Dynamic import to ensure env is loaded first
  const { prisma } = await import('../lib/prisma');
  const bcrypt = await import('bcryptjs');

  try {
    // 1. Get user
    console.log('📋 Step 1: Get user...');
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        name: true,
        passwordHash: true,
      },
    });

    if (!user) {
      console.error(`❌ User "${username}" not found!`);
      return;
    }

    // Verify password
    if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      console.error('❌ Invalid password!');
      return;
    }

    console.log(`✅ User found: ${user.username} (ID: ${user.id})`);
    console.log();

    // 2. Get chapter with exercises
    console.log('📋 Step 2: Get chapter with exercises...');
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
        sections: {
          include: {
            exercises: {
              include: {
                questions: {
                  select: {
                    id: true,
                    question: true,
                    options: true,
                    answer: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!chapter) {
      console.error(`❌ Chapter ${chapterId} not found!`);
      return;
    }

    console.log(`✅ Chapter found: ${chapter.name} (${chapter.sections.length} sections)`);
    console.log();

    // 3. Get all attempts for this chapter
    console.log('📋 Step 3: Get all attempts...');
    const allExerciseIds = chapter.sections.flatMap((section: any) =>
      section.exercises.map((exercise: any) => exercise.id)
    );

    const attempts = await prisma.userExerciseAttempt.findMany({
      where: {
        userId: user.id,
        exerciseId: { in: allExerciseIds },
      },
    });

    console.log(`✅ Found ${attempts.length} attempts out of ${allExerciseIds.length} exercises`);
    console.log();

    // 4. Check chapter status BEFORE submit
    console.log('📋 Step 4: Check chapter status BEFORE submit...');
    const chapterProgressBefore = await prisma.userChapterProgress.findUnique({
      where: {
        userId_chapterId: {
          userId: user.id,
          chapterId: chapterId,
        },
      },
    });

    if (chapterProgressBefore) {
      console.log(`✅ Chapter status BEFORE: ${chapterProgressBefore.status}`);
      console.log(`   Completed exercises: ${chapterProgressBefore.completedExercises}/${chapterProgressBefore.totalExercises}`);
    } else {
      console.log('⚠️  No chapter progress found');
    }
    console.log();

    // 5. Prepare submit data
    console.log('📋 Step 5: Prepare submit data...');
    const exercisesAnswers: Record<string, Record<string, string>> = {};

    attempts.forEach((attempt: any) => {
      if (attempt.answers && Object.keys(attempt.answers as Record<string, any>).length > 0) {
        const answers = attempt.answers as Record<string, any>;
        const cleanAnswers: Record<string, string> = {};

        Object.keys(answers).forEach((questionId) => {
          const answerValue = answers[questionId];
          if (answerValue !== undefined && answerValue !== null) {
            const answerStr = typeof answerValue === 'string' ? answerValue : String(answerValue);
            if (answerStr.trim() !== '') {
              cleanAnswers[questionId] = answerStr;
            }
          }
        });

        if (Object.keys(cleanAnswers).length > 0) {
          exercisesAnswers[attempt.exerciseId.toString()] = cleanAnswers;
        }
      }
    });

    console.log(`✅ Prepared ${Object.keys(exercisesAnswers).length} exercises for submission`);
    console.log();

    if (Object.keys(exercisesAnswers).length === 0) {
      console.error('❌ No exercises to submit!');
      return;
    }

    // 6. Call submit API
    console.log('📋 Step 6: Call submit API...');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const submitUrl = `${baseUrl}/api/chapters/${chapterId}/submit`;

    // Create a JWT token for authentication
    const jwt = (await import('jsonwebtoken')).default;
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1h' }
    );

    const submitResponse = await fetch(submitUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `token=${token}`,
      },
      body: JSON.stringify({
        exercisesAnswers,
        submitStatus: 'submitted',
      }),
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      console.error(`❌ Submit failed: ${submitResponse.status} ${submitResponse.statusText}`);
      console.error(`   Error: ${errorText}`);
      return;
    }

    const submitResult = await submitResponse.json();
    console.log(`✅ Submit successful!`);
    console.log(`   Submitted exercises: ${submitResult.submittedExercises?.length || 0}`);
    console.log(`   Chapter status: ${submitResult.chapterStatus}`);
    console.log();

    // 7. Check chapter status AFTER submit
    console.log('📋 Step 7: Check chapter status AFTER submit...');
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second for DB update

    const chapterProgressAfter = await prisma.userChapterProgress.findUnique({
      where: {
        userId_chapterId: {
          userId: user.id,
          chapterId: chapterId,
        },
      },
    });

    if (chapterProgressAfter) {
      console.log(`✅ Chapter status AFTER: ${chapterProgressAfter.status}`);
      console.log(`   Completed exercises: ${chapterProgressAfter.completedExercises}/${chapterProgressAfter.totalExercises}`);
      console.log(`   Completed at: ${chapterProgressAfter.completedAt || 'N/A'}`);
      console.log();

      if (chapterProgressBefore) {
        console.log('📊 Status Change:');
        console.log(`   BEFORE: ${chapterProgressBefore.status}`);
        console.log(`   AFTER:  ${chapterProgressAfter.status}`);
        if (chapterProgressBefore.status !== chapterProgressAfter.status) {
          console.log(`   ✅ Status changed from "${chapterProgressBefore.status}" to "${chapterProgressAfter.status}"`);
        } else {
          console.log(`   ⚠️  Status did not change`);
        }
      }
    } else {
      console.log('⚠️  No chapter progress found after submit');
    }
    console.log();

    // 8. Check attempts status
    console.log('📋 Step 8: Check attempts status...');
    const attemptsAfter = await prisma.userExerciseAttempt.findMany({
      where: {
        userId: user.id,
        exerciseId: { in: allExerciseIds },
      },
      select: {
        exerciseId: true,
        status: true,
        isCompleted: true,
      },
    });

    const statusCounts = {
      draft: 0,
      submitted: 0,
      completed: 0,
    };

    attemptsAfter.forEach((attempt: any) => {
      if (attempt.status === 'draft') statusCounts.draft++;
      else if (attempt.status === 'submitted') statusCounts.submitted++;
      else if (attempt.status === 'completed') statusCounts.completed++;
    });

    console.log(`✅ Attempts status:`, statusCounts);
    console.log(`   Total attempts: ${attemptsAfter.length}`);
    console.log(`   Total exercises in chapter: ${allExerciseIds.length}`);

    console.log();
    console.log('✅ Test completed!');
  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run with test credentials
const username = 'nhahan';
const password = 'nhahan@123';
const chapterId = 9;

testSubmitAndCheckStatus(username, password, chapterId).catch(console.error);

