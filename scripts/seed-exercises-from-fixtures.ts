import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

// Load .env file
config();

// Support multiple DATABASE_URL formats
let databaseUrl =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error(
    '❌ Missing DATABASE_URL. Please set one of: POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING, or DATABASE_URL'
  );
  process.exit(1);
}

// Ensure SSL is properly configured for Supabase
if (databaseUrl.includes('supabase.com') && !databaseUrl.includes('sslmode')) {
  databaseUrl += (databaseUrl.includes('?') ? '&' : '?') + 'sslmode=require';
}

// Create PostgreSQL connection pool
const poolConfig: any = {
  connectionString: databaseUrl,
};

// Configure SSL for Supabase connections
const shouldAllowInsecureSsl =
  databaseUrl.includes('supabase.com') ||
  process.env.ALLOW_INSECURE_DB_SSL === 'true' ||
  process.env.NODE_ENV === 'development';

if (shouldAllowInsecureSsl) {
  poolConfig.ssl = {
    rejectUnauthorized: false,
  };
  if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }
}

const pool = new Pool(poolConfig);
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});

// Helper function to load JSON file
function loadJsonFile(filePath: string): any {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }
  const content = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(content);
}

// Map lesson codes to lesson IDs and section IDs
const lessonCodeMap = new Map<string, { lessonId: number; sectionId: number }>();

// Build lesson code map from curriculum and existing lessons
async function buildLessonCodeMap(gradeId: number, subject: string) {
  console.log(`  🔍 Building lesson code map for ${subject}...`);
  
  // Get curriculum to extract lesson codes
  const curriculum = await prisma.curriculum.findFirst({
    where: {
      gradeId: gradeId,
      subject: subject,
    },
  });

  if (!curriculum) {
    console.warn(`    ⚠️  Curriculum not found for ${subject}`);
    return;
  }

  const lessonsData = curriculum.lessons as any;
  if (!lessonsData.chapters) {
    console.warn(`    ⚠️  Invalid curriculum structure for ${subject}`);
    return;
  }

  // Get subject
  const subjectRecord = await prisma.subject.findFirst({
    where: {
      gradeId: gradeId,
      name: subject,
    },
  });

  if (!subjectRecord) {
    console.warn(`    ⚠️  Subject not found: ${subject}`);
    return;
  }

  // Process chapters and lessons
  for (const chapterData of lessonsData.chapters) {
    const chapter = await prisma.chapter.findFirst({
      where: {
        subjectId: subjectRecord.id,
        name: chapterData.name,
      },
    });

    if (!chapter) {
      console.warn(`    ⚠️  Chapter not found: ${chapterData.name}`);
      continue;
    }

    // Get or create sections for this chapter
    // For now, we'll create one section per chapter if it doesn't exist
    let section = await prisma.section.findFirst({
      where: {
        chapterId: chapter.id,
        name: chapterData.name,
      },
    });

    if (!section) {
      section = await prisma.section.create({
        data: {
          name: chapterData.name,
          chapterId: chapter.id,
          description: `Section for ${chapterData.name}`,
          order: 0,
        },
      });
    }

    // Process lessons
    for (const lessonData of chapterData.lessons) {
      // Check if lesson exists
      let lesson = await prisma.lesson.findFirst({
        where: {
          sectionId: section.id,
          title: lessonData.title,
        },
      });

      if (!lesson) {
        // Create lesson if it doesn't exist
        lesson = await prisma.lesson.create({
          data: {
            title: lessonData.title,
            content: `Content for ${lessonData.title}`,
            sectionId: section.id,
            type: 'text',
            order: 0,
          },
        });
      }

      // Map lesson code to lesson and section IDs
      lessonCodeMap.set(lessonData.code, {
        lessonId: lesson.id,
        sectionId: section.id,
      });
    }
  }

  console.log(`    ✓ Mapped ${lessonCodeMap.size} lessons`);
}

async function seedExercisesFromFixture(fixturePath: string, difficulty: string) {
  const data = loadJsonFile(fixturePath);
  console.log(`  📝 Seeding ${difficulty} exercises from ${path.basename(fixturePath)}...`);

  let totalExercises = 0;
  let totalQuestions = 0;

  // Handle two different structures:
  // 1. Math: chapters > lessons > exercises
  // 2. English: lessons (flat array)
  let lessonsToProcess: any[] = [];

  if (data.chapters && Array.isArray(data.chapters)) {
    // Math structure: chapters > lessons > exercises
    for (const chapterData of data.chapters) {
      for (const lessonData of chapterData.lessons) {
        lessonsToProcess.push(lessonData);
      }
    }
  } else if (data.lessons && Array.isArray(data.lessons)) {
    // English structure: flat lessons array
    lessonsToProcess = data.lessons;
  } else {
    console.warn(`    ⚠️  Unknown structure in ${fixturePath}`);
    return;
  }

  // Process lessons > exercises
  for (const lessonData of lessonsToProcess) {
    const lessonInfo = lessonCodeMap.get(lessonData.code);
    
    if (!lessonInfo) {
      console.warn(`    ⚠️  Lesson code not found: ${lessonData.code}`);
      continue;
    }

    // Process exercises for this lesson
    let exerciseOrder = 1;
    for (const exerciseData of lessonData.exercises) {
        // Check if exercise already exists by UUID first (to prevent duplicates)
        let exercise = null;
        if (exerciseData.uuid) {
          exercise = await prisma.exercise.findFirst({
            where: {
              uuid: exerciseData.uuid,
            },
          });
        }
        
        // Fallback: check by title and difficulty if no UUID
        if (!exercise) {
          exercise = await prisma.exercise.findFirst({
            where: {
              sectionId: lessonInfo.sectionId,
              difficulty: difficulty,
              title: exerciseData.title,
            },
          });
        }

        // Generate UUID if not provided
        const exerciseUuid = exerciseData.uuid || randomUUID();

        if (!exercise) {
          exercise = await prisma.exercise.create({
            data: {
              uuid: exerciseUuid,
              title: exerciseData.title,
              description: exerciseData.description || '',
              sectionId: lessonInfo.sectionId,
              difficulty: difficulty,
              type: exerciseData.type,
              points: exerciseData.points || 10,
              timeLimit: exerciseData.timeLimit || null,
              order: exerciseOrder,
            },
          });
          totalExercises++;
        } else {
          // Update existing exercise (preserve UUID if exists, otherwise set new one)
          exercise = await prisma.exercise.update({
            where: { id: exercise.id },
            data: {
              uuid: exercise.uuid || exerciseUuid, // Keep existing UUID or set new one
              description: exerciseData.description || '',
              type: exerciseData.type,
              points: exerciseData.points || 10,
              timeLimit: exerciseData.timeLimit || null,
              order: exerciseOrder,
            },
          });
          // Count as updated even if already exists
          totalExercises++;
        }

        // Process exercise questions
        // Use question field if exists, otherwise use title as question
        const questionText = exerciseData.question || exerciseData.title;
        
        if (questionText) {
          // Check if question already exists
          const existingQuestion = await prisma.exerciseQuestion.findFirst({
            where: {
              exerciseId: exercise.id,
              question: questionText,
            },
          });

          // Determine answer
          let answer = exerciseData.answer || '';
          if (!answer && exerciseData.correctOption) {
            answer = exerciseData.correctOption;
          }
          if (!answer && exerciseData.options) {
            // For multiple choice, use the correct option
            answer = exerciseData.correctOption || '';
          }
          // If still no answer, use empty string (for essay questions)
          if (!answer) {
            answer = '';
          }

          if (!existingQuestion) {
            await prisma.exerciseQuestion.create({
              data: {
                exerciseId: exercise.id,
                question: questionText,
                answer: answer,
                options: exerciseData.options || null,
                hint: exerciseData.hint || null,
                order: 0,
                points: exerciseData.points || 1,
              },
            });
            totalQuestions++;
          } else {
            // Update existing question to ensure it has all fields
            await prisma.exerciseQuestion.update({
              where: { id: existingQuestion.id },
              data: {
                question: questionText, // Update question text in case it changed
                answer: exerciseData.answer || exerciseData.correctOption || existingQuestion.answer || answer,
                options: exerciseData.options !== undefined ? exerciseData.options : existingQuestion.options,
                hint: exerciseData.hint !== undefined ? exerciseData.hint : existingQuestion.hint,
                points: exerciseData.points || existingQuestion.points,
              },
            });
            totalQuestions++; // Count updates too
          }
        }

        exerciseOrder++;
      }
    }

  console.log(`    ✓ Created/Updated ${totalExercises} exercises, ${totalQuestions} questions`);
}

async function seedAllExercises() {
  console.log('🌱 Starting exercises seeding from fixtures...\n');

  try {
    // Get Grade 7
    const grade = await prisma.grade.findFirst({
      where: { level: 7 },
    });

    if (!grade) {
      throw new Error('Grade 7 not found. Please seed curriculum first.');
    }

    // Seed Math exercises
    console.log('📚 Seeding Math exercises...');
    await buildLessonCodeMap(grade.id, 'Toán');
    
    await seedExercisesFromFixture('fixtures/math/grade7-2025-math-easy.json', 'easy');
    await seedExercisesFromFixture('fixtures/math/grade7-2025-math-medium.json', 'medium');
    await seedExercisesFromFixture('fixtures/math/grade7-2025-math-hard.json', 'hard');

    // Clear lesson code map and seed English exercises
    lessonCodeMap.clear();
    console.log('\n📚 Seeding English exercises...');
    await buildLessonCodeMap(grade.id, 'Tiếng Anh');
    
    await seedExercisesFromFixture('fixtures/english/grade7-2025-english-easy.json', 'easy');
    await seedExercisesFromFixture('fixtures/english/grade7-2025-english-medium.json', 'medium');
    await seedExercisesFromFixture('fixtures/english/grade7-2025-english-hard.json', 'hard');

    console.log('\n✅ Exercises seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding exercises:', error);
    throw error;
  }
}

// Main execution
seedAllExercises()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

