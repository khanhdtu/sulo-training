import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

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
  max: 1,
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
const prisma = new PrismaClient({ adapter });

function loadJsonFile(filePath: string): any {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }
  const content = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(content);
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log('🔄 Reseeding exercise questions...\n');

  try {
    // Step 1: Delete all exercise questions
    console.log('🗑️  Deleting all exercise questions...');
    const deleteResult = await prisma.exerciseQuestion.deleteMany({});
    console.log(`   ✅ Deleted ${deleteResult.count} exercise questions\n`);

    // Step 2: Load lesson code map
    console.log('📚 Loading lessons...');
    const lessons = await prisma.lesson.findMany({
      include: {
        section: {
          include: {
            chapter: {
              include: {
                subject: true,
              },
            },
          },
        },
      },
      orderBy: [
        { section: { chapter: { order: 'asc' } } },
        { order: 'asc' },
      ],
    });

    // Create lesson code map: SUBJECT-CH{order}-L{order}
    const lessonCodeMap = new Map<string, number>();
    const chapterLessonCounts = new Map<number, number>(); // Track lesson order per chapter
    
    // Map subject names to codes (from JSON fixtures)
    const subjectCodeMap: Record<string, string> = {
      'Toán': 'MATH7',
      'Tiếng Anh': 'ENG7',
      'Math': 'MATH7',
      'English': 'ENG7',
    };

    lessons.forEach((lesson) => {
      const section = lesson.section;
      if (!section) return;
      
      const chapter = section.chapter;
      if (!chapter) return;
      
      const subject = chapter.subject;
      if (!subject) return;
      
      // Get subject code from mapping
      const subjectCode = subjectCodeMap[subject.name] || subject.name.toUpperCase().slice(0, 4) + '7';
      
      // Count lessons per chapter (not per section)
      const chapterId = chapter.id;
      const currentCount = chapterLessonCounts.get(chapterId) || 0;
      chapterLessonCounts.set(chapterId, currentCount + 1);
      const lessonOrder = currentCount + 1;
      
      // Construct lesson code: SUBJECT-CH{order}-L{order}
      const lessonCode = `${subjectCode}-CH${chapter.order}-L${lessonOrder}`;
      lessonCodeMap.set(lessonCode, lesson.id);
    });

    console.log(`   ✅ Loaded ${lessons.length} lessons\n`);

    // Step 3: Seed questions from JSON files
    const files = [
      { path: 'fixtures/exerciseQuestions/grade7-2025-math-easy.json', difficulty: 'easy' },
      { path: 'fixtures/exerciseQuestions/grade7-2025-math-medium.json', difficulty: 'medium' },
      { path: 'fixtures/exerciseQuestions/grade7-2025-math-hard.json', difficulty: 'hard' },
      { path: 'fixtures/exerciseQuestions/grade7-2025-english-easy.json', difficulty: 'easy' },
      { path: 'fixtures/exerciseQuestions/grade7-2025-english-medium.json', difficulty: 'medium' },
      { path: 'fixtures/exerciseQuestions/grade7-2025-english-hard.json', difficulty: 'hard' },
    ];

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const file of files) {
      await seedExerciseQuestions(file.path, file.difficulty, lessonCodeMap);
    }

    console.log('\n✨ Reseeding completed!');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function seedExerciseQuestions(
  fixturePath: string,
  difficulty: string,
  lessonCodeMap: Map<string, number>
) {
  const data = loadJsonFile(fixturePath);
  console.log(`  ❓ Seeding ${difficulty} exercise questions from ${path.basename(fixturePath)}...`);

  let createdCount = 0;
  let skippedCount = 0;

  for (const questionData of data.questions) {
    // Find exercise by lesson code and exercise title
    const lessonId = lessonCodeMap.get(questionData.lessonCode);
    if (!lessonId) {
      console.warn(`    ⚠️  Lesson code not found: ${questionData.lessonCode}`);
      skippedCount++;
      continue;
    }

    // Get lesson with section
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { section: true },
    });

    if (!lesson) {
      console.warn(`    ⚠️  Lesson not found: ${lessonId}`);
      skippedCount++;
      continue;
    }

    // Find exercise by title and difficulty in the same section
    const normalizedTitle = normalizeTitle(questionData.exerciseTitle);
    const exercises = await prisma.exercise.findMany({
      where: {
        sectionId: lesson.sectionId,
        difficulty: difficulty,
      },
    });

    // Find exercise with matching normalized title
    const matchedExercise = exercises.find(ex => 
      normalizeTitle(ex.title) === normalizedTitle
    );

    if (!matchedExercise) {
      console.warn(`    ⚠️  Exercise not found: ${questionData.lessonCode}-${questionData.exerciseTitle}-${difficulty}`);
      skippedCount++;
      continue;
    }

    const exerciseId = matchedExercise.id;

    // Check if question already exists by created_at (from JSON)
    if (questionData.created_at) {
      const existing = await prisma.exerciseQuestion.findFirst({
        where: {
          exerciseId: exerciseId,
          createdAt: new Date(questionData.created_at),
        },
      });

      if (existing) {
        skippedCount++;
        continue;
      }
    }

    // For multiple choice, use correctOption as answer if answer is not provided
    const answer = questionData.answer || questionData.correctOption || '';
    
    await prisma.exerciseQuestion.create({
      data: {
        exerciseId: exerciseId,
        question: questionData.question,
        answer: answer,
        options: questionData.options || null,
        hint: questionData.hint || null,
        order: questionData.order || 0,
        points: questionData.points || 1,
        createdAt: questionData.created_at ? new Date(questionData.created_at) : new Date(),
      },
    });
    createdCount++;
  }

  console.log(`    ✅ Created ${createdCount} questions, skipped ${skippedCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

