#!/usr/bin/env tsx
/**
 * Test Submit Chapter Full Flow Script
 * 
 * This script tests the full flow of submitting a chapter and verifying the status.
 * Usage: npx tsx scripts/test-submit-chapter-full-flow.ts <username> <password> [chapterId] [level] [status]
 * 
 * Example:
 *   npx tsx scripts/test-submit-chapter-full-flow.ts nhahan nhahan@123 22 medium submitted
 */

import { config } from 'dotenv';

// Load .env file FIRST before any other imports
config();

async function login(username: string, password: string, port?: number): Promise<string | null> {
  const defaultUrl = port ? `http://localhost:${port}` : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
  const baseUrl = defaultUrl;
  const loginUrl = `${baseUrl}/api/auth/login`;

  console.log('🔐 Step 1: Logging in...\n');
  console.log(`Username: ${username}`);
  console.log(`URL: ${loginUrl}\n`);

  try {
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    const data = await response.json();

    if (response.ok && data.token) {
      console.log('✅ Login successful!\n');
      console.log(`  User: ${data.user?.username || 'N/A'}`);
      console.log(`  User ID: ${data.user?.id || 'N/A'}\n`);
      return data.token;
    } else {
      console.log('❌ Login failed!\n');
      console.log(`Status: ${response.status}`);
      console.log(`Response:`, JSON.stringify(data, null, 2));
      console.log(`Error: ${data.error || data.message || 'Unknown error'}`);
      return null;
    }
  } catch (error: unknown) {
    console.error('❌ Error during login:');
    if (error instanceof Error) {
      console.error(`  Message: ${error.message}`);
      if (error.message.includes('fetch')) {
        console.error('\n💡 Tip: Make sure the Next.js dev server is running:');
        console.error('   npm run dev');
      }
    } else {
      console.error('  Error:', error);
    }
    return null;
  }
}

async function getChapterData(chapterId: number) {
  console.log(`\n📚 Fetching chapter ${chapterId} data from database...\n`);

  try {
    // Dynamic import to ensure env is loaded first
    const { prisma } = await import('../lib/prisma');
    
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
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
      return null;
    }

    console.log(`✅ Chapter found: "${chapter.name}"`);
    console.log(`   Subject: ${chapter.subject.name} (ID: ${chapter.subject.id})`);
    console.log(`   Sections: ${chapter.sections.length}`);

    // Flatten all exercises
    const allExercises = chapter.sections.flatMap((section) =>
      section.exercises.map((exercise) => ({
        ...exercise,
        sectionId: section.id,
        sectionName: section.name,
      }))
    );

    console.log(`   Total exercises: ${allExercises.length}\n`);

    return {
      chapter,
      exercises: allExercises,
    };
  } catch (error: unknown) {
    console.error('❌ Error fetching chapter data:');
    if (error instanceof Error) {
      console.error(`  Message: ${error.message}`);
    } else {
      console.error('  Error:', error);
    }
    return null;
  }
}

function generateAnswers(exercises: any[]): Record<string, Record<string, string>> {
  console.log('📝 Generating answers...\n');

  const answers: Record<string, Record<string, string>> = {};

  exercises.forEach((exercise) => {
    const exerciseAnswers: Record<string, string> = {};

    exercise.questions.forEach((question: any) => {
      if (exercise.type === 'multiple_choice') {
        // For multiple choice, use the correct answer
        exerciseAnswers[question.id.toString()] = question.answer;
      } else {
        // For essay, use a sample answer
        exerciseAnswers[question.id.toString()] = `Sample answer for question ${question.id}`;
      }
    });

    answers[exercise.id.toString()] = exerciseAnswers;
  });

  console.log('✅ Answers generated:');
  Object.entries(answers).forEach(([exerciseId, exerciseAnswers]) => {
    console.log(`   Exercise ${exerciseId}: ${Object.keys(exerciseAnswers).length} answers`);
  });
  console.log('');

  return answers;
}

async function submitChapter(
  token: string,
  chapterId: number,
  exercises: Record<string, Record<string, string>>,
  status: 'draft' | 'submitted',
  level?: 'easy' | 'medium' | 'hard',
  port?: number
) {
  const defaultUrl = port ? `http://localhost:${port}` : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
  const baseUrl = defaultUrl;
  const submitUrl = `${baseUrl}/api/chapters/${chapterId}/submit`;

  console.log(`\n📤 Step 2: Submitting chapter ${chapterId}...\n`);
  console.log(`URL: ${submitUrl}`);
  console.log(`Status: ${status}`);
  if (level) {
    console.log(`Level: ${level}`);
  }
  console.log(`Exercises: ${Object.keys(exercises).length}\n`);

  try {
    const body: any = {
      chapterId,
      exercises,
      status,
    };
    if (level) {
      body.level = level;
    }

    const response = await fetch(submitUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    console.log(`Response Status: ${response.status}\n`);

    if (response.ok) {
      console.log('✅ Submit successful!\n');
      console.log('Response Data:');
      console.log(JSON.stringify(data, null, 2));
      return data;
    } else {
      console.log('❌ Submit failed!\n');
      console.log(`Error: ${data.message || data.error || 'Unknown error'}`);
      if (data.details) {
        console.log('Details:', JSON.stringify(data.details, null, 2));
      }
      return null;
    }
  } catch (error: unknown) {
    console.error('❌ Error during submit:');
    if (error instanceof Error) {
      console.error(`  Message: ${error.message}`);
    } else {
      console.error('  Error:', error);
    }
    return null;
  }
}

async function getChapterById(
  token: string,
  chapterId: number,
  port?: number
): Promise<any> {
  const defaultUrl = port ? `http://localhost:${port}` : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
  const baseUrl = defaultUrl;
  const getChapterUrl = `${baseUrl}/api/chapters/${chapterId}`;

  console.log(`\n📋 Step 3: Getting chapter ${chapterId} by ID...\n`);
  console.log(`URL: ${getChapterUrl}\n`);

  try {
    const response = await fetch(getChapterUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    console.log(`Response Status: ${response.status}\n`);

    if (response.ok) {
      console.log('✅ Get chapter successful!\n');
      return data;
    } else {
      console.log('❌ Get chapter failed!\n');
      console.log(`Error: ${data.message || data.error || 'Unknown error'}`);
      if (data.details) {
        console.log('Details:', JSON.stringify(data.details, null, 2));
      }
      return null;
    }
  } catch (error: unknown) {
    console.error('❌ Error during get chapter:');
    if (error instanceof Error) {
      console.error(`  Message: ${error.message}`);
    } else {
      console.error('  Error:', error);
    }
    return null;
  }
}

function checkChapterStatus(chapterData: any, expectedStatus: string) {
  console.log('\n🔍 Step 4: Checking chapter status...\n');

  if (!chapterData) {
    console.log('❌ Invalid chapter data');
    console.log('Response:', JSON.stringify(chapterData, null, 2));
    return false;
  }

  // Handle different response structures
  let chapterProgress = null;
  if (chapterData.data && chapterData.data.chapterProgress) {
    chapterProgress = chapterData.data.chapterProgress;
  } else if (chapterData.chapterProgress) {
    chapterProgress = chapterData.chapterProgress;
  } else if (chapterData.data) {
    // Try to find chapterProgress in data
    chapterProgress = chapterData.data.chapterProgress || null;
  }
  
  if (!chapterProgress) {
    console.log('⚠️  No chapter progress found');
    console.log('   Response structure:', JSON.stringify(chapterData, null, 2));
    console.log('   This might mean the chapter has not been started yet.');
    return false;
  }

  const actualStatus = chapterProgress.status;
  const expectedStatusLower = expectedStatus.toLowerCase();

  console.log(`Expected Status: ${expectedStatus}`);
  console.log(`Actual Status: ${actualStatus}\n`);

  if (actualStatus === expectedStatusLower) {
    console.log('✅ Status matches! Chapter status is correct.\n');
    console.log('Chapter Progress Details:');
    console.log(`  Status: ${chapterProgress.status}`);
    console.log(`  Progress: ${chapterProgress.progress || 0}%`);
    console.log(`  Completed Sections: ${chapterProgress.completedSections || 0} / ${chapterProgress.totalSections || 0}`);
    return true;
  } else {
    console.log('❌ Status mismatch!');
    console.log(`   Expected: ${expectedStatus}`);
    console.log(`   Actual: ${actualStatus}`);
    return false;
  }
}

async function main() {
  // Get arguments from command line
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: npx tsx scripts/test-submit-chapter-full-flow.ts <username> <password> [chapterId] [level] [status] [port]');
    console.error('\nExample:');
    console.error('  npx tsx scripts/test-submit-chapter-full-flow.ts nhahan nhahan@123 22 medium submitted 9999');
    process.exit(1);
  }

  const [username, password, chapterIdStr, levelStr, statusStr, portStr] = args;
  const port = portStr ? parseInt(portStr) : undefined;
  const chapterId = chapterIdStr ? parseInt(chapterIdStr) : 22;
  const level = levelStr ? (levelStr as 'easy' | 'medium' | 'hard') : undefined;
  const status = (statusStr as 'draft' | 'submitted') || 'submitted';

  if (isNaN(chapterId)) {
    console.error('❌ Invalid chapterId. Must be a number.');
    process.exit(1);
  }

  if (status !== 'draft' && status !== 'submitted') {
    console.error('❌ Invalid status. Must be "draft" or "submitted".');
    process.exit(1);
  }

  if (level && !['easy', 'medium', 'hard'].includes(level)) {
    console.error('❌ Invalid level. Must be "easy", "medium", or "hard".');
    process.exit(1);
  }

  console.log('🧪 Test Submit Chapter Full Flow\n');
  console.log('='.repeat(60));
  console.log(`Chapter ID: ${chapterId}`);
  console.log(`Status: ${status}`);
  if (level) {
    console.log(`Level: ${level}`);
  }
  if (port) {
    console.log(`Port: ${port}`);
  }
  console.log('='.repeat(60));
  console.log('');

  // Step 1: Login
  const token = await login(username, password, port);
  if (!token) {
    console.error('\n❌ Failed to login. Exiting...');
    process.exit(1);
  }

  // Step 2: Get chapter data
  const chapterData = await getChapterData(chapterId);
  if (!chapterData) {
    console.error('\n❌ Failed to fetch chapter data. Exiting...');
    process.exit(1);
  }

  // Step 3: Filter exercises by level if provided
  let exercisesToSubmit = chapterData.exercises;
  if (level) {
    exercisesToSubmit = chapterData.exercises.filter(ex => ex.difficulty === level);
    console.log(`\n📊 Filtered exercises by level "${level}": ${exercisesToSubmit.length} exercises\n`);
    if (exercisesToSubmit.length === 0) {
      console.error(`❌ No exercises found with difficulty "${level}" in chapter ${chapterId}`);
      process.exit(1);
    }
  }

  // Step 4: Generate answers
  const answers = generateAnswers(exercisesToSubmit);

  // Step 5: Submit chapter
  const submitResult = await submitChapter(token, chapterId, answers, status, level, port);
  if (!submitResult) {
    console.error('\n❌ Failed to submit chapter. Exiting...');
    process.exit(1);
  }

  // Step 6: Get chapter by ID to verify status
  const chapterResponse = await getChapterById(token, chapterId, port);
  if (!chapterResponse) {
    console.error('\n❌ Failed to get chapter. Exiting...');
    process.exit(1);
  }

  // Step 7: Check status
  const statusMatches = checkChapterStatus(chapterResponse, status);

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Login: Success`);
  console.log(`✅ Get Chapter Data: Success`);
  console.log(`✅ Submit Chapter: Success`);
  console.log(`✅ Get Chapter by ID: Success`);
  console.log(`${statusMatches ? '✅' : '❌'} Status Check: ${statusMatches ? 'PASSED' : 'FAILED'}`);
  console.log('='.repeat(60));

  if (statusMatches) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Status check failed');
    process.exit(1);
  }
}

// Run main function
main()
  .catch((error) => {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  })
  .finally(async () => {
    // Dynamic import to ensure env is loaded first
    const { prisma } = await import('../lib/prisma');
    await prisma.$disconnect();
  });

