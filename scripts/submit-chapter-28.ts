#!/usr/bin/env tsx
/**
 * Submit Chapter 28 for user nhahan
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

    // Find first exercise with questions
    const firstExercise = allExercises.find(ex => ex.questions && ex.questions.length > 0);
    
    if (!firstExercise) {
      console.error('❌ No exercises with questions found in chapter 28!');
      process.exit(1);
    }

    console.log(`\n📝 Selected exercise: ${firstExercise.title} (ID: ${firstExercise.id})`);
    console.log(`   Type: ${firstExercise.type}`);
    console.log(`   Questions: ${firstExercise.questions.length}`);

    // Prepare answers for this exercise only
    const exercisesAnswers: Record<string, Record<string, string>> = {};
    const exerciseAnswers: Record<string, string> = {};
    
    for (const question of firstExercise.questions) {
      // For multiple choice, use the correct answer
      // For essay, use a sample answer
      if (firstExercise.type === 'multiple_choice' && question.options) {
        // Use the correct answer from question.answer
        exerciseAnswers[question.id.toString()] = question.answer;
      } else {
        // For essay, use a sample answer
        exerciseAnswers[question.id.toString()] = question.answer || 'Sample answer';
      }
    }
    
    exercisesAnswers[firstExercise.id.toString()] = exerciseAnswers;

    console.log(`\n📤 Submitting 1 exercise with ${Object.keys(exerciseAnswers).length} answers...`);

    // Use the API endpoint to submit
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    // First, login to get token
    console.log('\n🔐 Logging in...');
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'nhahan',
        password: process.env.TEST_USER_PASSWORD || 'nhahan@123',
      }),
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.json();
      console.error('❌ Login failed:', error);
      process.exit(1);
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;

    if (!token) {
      console.error('❌ No token received from login');
      process.exit(1);
    }

    console.log('✅ Login successful');

    // Submit chapter
    console.log('\n📤 Submitting chapter 28...');
    const submitResponse = await fetch(`${baseUrl}/api/chapters/28/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        chapterId: 28,
        exercises: exercisesAnswers,
        status: 'submitted',
      }),
    });

    const submitData = await submitResponse.json();

    console.log('\n📋 Response status:', submitResponse.status);
    console.log('📋 Response data:', JSON.stringify(submitData, null, 2));

    if (!submitResponse.ok) {
      console.error('❌ Submit failed:', submitData);
      process.exit(1);
    }

    console.log('\n✅ Chapter submitted successfully!');
    console.log(`   Submitted: ${submitData.submittedCount || 0} exercises`);
    console.log(`   Completed: ${submitData.completedCount || 0} exercises`);
    console.log(`   Chapter Status: ${submitData.chapterStatus || 'N/A'}`);
    if (submitData.results && submitData.results.length > 0) {
      console.log(`   Results: ${JSON.stringify(submitData.results, null, 2)}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    const { prisma } = await import('../lib/prisma');
    await prisma.$disconnect();
  }
}

main();

