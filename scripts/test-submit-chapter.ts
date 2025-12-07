#!/usr/bin/env tsx
/**
 * Test Submit Chapter API Script
 * 
 * This script tests the submit chapter API endpoint.
 * Usage: npx tsx scripts/test-submit-chapter.ts <username> <password> [chapterId] [status]
 * 
 * Example:
 *   npx tsx scripts/test-submit-chapter.ts nhahan nhahan@123 26 submitted
 */

import { config } from 'dotenv';

// Load .env file FIRST before any other imports
config();

async function login(username: string, password: string): Promise<string | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const loginUrl = `${baseUrl}/api/auth/login`;

  console.log('🔐 Logging in...\n');
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
  } catch (error: any) {
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

    // Log exercises details
    allExercises.forEach((exercise, idx) => {
      console.log(`   Exercise ${idx + 1}:`);
      console.log(`     ID: ${exercise.id}`);
      console.log(`     Title: ${exercise.title}`);
      console.log(`     Type: ${exercise.type}`);
      console.log(`     Difficulty: ${exercise.difficulty}`);
      console.log(`     Questions: ${exercise.questions.length}`);
      exercise.questions.forEach((q, qIdx) => {
        console.log(`       Q${qIdx + 1} (ID: ${q.id}): ${q.question.substring(0, 50)}...`);
        if (exercise.type === 'multiple_choice' && q.options) {
          const options = q.options as Record<string, string>;
          console.log(`         Options: ${Object.keys(options).join(', ')}`);
          console.log(`         Correct Answer: ${q.answer}`);
        }
      });
      console.log('');
    });

    return {
      chapter,
      exercises: allExercises,
    };
  } catch (error: any) {
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
  status: 'draft' | 'submitted'
) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const submitUrl = `${baseUrl}/api/chapters/${chapterId}/submit`;

  console.log(`\n📤 Submitting chapter ${chapterId}...\n`);
  console.log(`URL: ${submitUrl}`);
  console.log(`Status: ${status}`);
  console.log(`Exercises: ${Object.keys(exercises).length}\n`);

  try {
    const response = await fetch(submitUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        chapterId,
        exercises,
        status,
      }),
    });

    const data = await response.json();

    console.log(`Response Status: ${response.status}\n`);

    if (response.ok) {
      console.log('✅ Submit successful!\n');
      console.log('Response Data:');
      console.log(JSON.stringify(data, null, 2));
      return true;
    } else {
      console.log('❌ Submit failed!\n');
      console.log(`Error: ${data.message || data.error || 'Unknown error'}`);
      if (data.details) {
        console.log('Details:', JSON.stringify(data.details, null, 2));
      }
      return false;
    }
  } catch (error: any) {
    console.error('❌ Error during submit:');
    if (error instanceof Error) {
      console.error(`  Message: ${error.message}`);
    } else {
      console.error('  Error:', error);
    }
    return false;
  }
}

async function main() {
  // Get arguments from command line
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: npx tsx scripts/test-submit-chapter.ts <username> <password> [chapterId] [status]');
    console.error('\nExample:');
    console.error('  npx tsx scripts/test-submit-chapter.ts nhahan nhahan@123 26 submitted');
    process.exit(1);
  }

  const [username, password, chapterIdStr, statusStr] = args;
  const chapterId = chapterIdStr ? parseInt(chapterIdStr) : 26;
  const status = (statusStr as 'draft' | 'submitted') || 'submitted';

  if (isNaN(chapterId)) {
    console.error('❌ Invalid chapterId. Must be a number.');
    process.exit(1);
  }

  if (status !== 'draft' && status !== 'submitted') {
    console.error('❌ Invalid status. Must be "draft" or "submitted".');
    process.exit(1);
  }

  console.log('🧪 Test Submit Chapter API\n');
  console.log('='.repeat(50));
  console.log(`Chapter ID: ${chapterId}`);
  console.log(`Status: ${status}`);
  console.log('='.repeat(50));

  // Step 1: Login
  const token = await login(username, password);
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

  // Step 3: Generate answers
  const answers = generateAnswers(chapterData.exercises);

  // Step 4: Submit
  const success = await submitChapter(token, chapterId, answers, status);

  if (success) {
    console.log('\n🎉 Test completed successfully!');
    process.exit(0);
  } else {
    console.log('\n❌ Test failed');
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

