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

// Map to store lesson codes to lesson IDs
const lessonCodeMap = new Map<string, number>();
const exerciseMap = new Map<string, number>(); // key: "lessonCode-exerciseTitle-difficulty", value: exerciseId

// Helper function to normalize exercise titles for matching
// Removes LaTeX syntax, normalizes spaces, and handles special characters
function normalizeTitle(title: string): string {
  if (!title) return '';
  
  // Remove LaTeX math delimiters and commands
  let normalized = title
    // Handle escaped backslashes (\\\\frac -> \frac, \\frac -> \frac)
    .replace(/\\\\+/g, '\\')
    // Handle \frac{a}{b} or $\\frac{a}{b}$ or $\frac{a}{b}$ -> a/b
    .replace(/\$?\\*frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
    // Handle \sqrt{a} or $\\sqrt{a}$ -> sqrt(a)
    .replace(/\$?\\*sqrt\{([^}]+)\}/g, 'sqrt($1)')
    // Handle negative signs: -a or $-a$ -> -a
    .replace(/\$?(-?)([0-9]+)\$?/g, '$1$2')
    // Remove remaining $ and backslashes
    .replace(/\$/g, '')
    .replace(/\\/g, '')
    // Remove braces
    .replace(/\{([^}]+)\}/g, '$1')
    // Normalize parentheses: (a) -> a
    .replace(/\(([^)]+)\)/g, '$1')
    // Normalize spaces (multiple spaces to single space)
    .replace(/\s+/g, ' ')
    // Remove leading/trailing spaces
    .trim();
  
  return normalized.toLowerCase();
}

async function seedCurriculum() {
  console.log('🌱 Starting curriculum seeding...\n');

  try {
    // Seed Math curriculum
    console.log('📚 Seeding Math curriculum...');
    await seedSubject('fixtures/grade7-2025-math.json', 'Toán');
    await seedExercises('fixtures/math/grade7-2025-math-easy.json', 'easy');
    await seedExercises('fixtures/math/grade7-2025-math-medium.json', 'medium');
    await seedExercises('fixtures/math/grade7-2025-math-hard.json', 'hard');
    await seedExerciseQuestions('fixtures/exerciseQuestions/grade7-2025-math-easy.json', 'easy');
    await seedExerciseQuestions('fixtures/exerciseQuestions/grade7-2025-math-medium.json', 'medium');
    await seedExerciseQuestions('fixtures/exerciseQuestions/grade7-2025-math-hard.json', 'hard');

    // Seed English curriculum
    console.log('\n📚 Seeding English curriculum...');
    await seedSubject('fixtures/grade7-2025-english.json', 'Tiếng Anh');
    await seedExercises('fixtures/english/grade7-2025-english-easy.json', 'easy');
    await seedExercises('fixtures/english/grade7-2025-english-medium.json', 'medium');
    await seedExercises('fixtures/english/grade7-2025-english-hard.json', 'hard');
    await seedExerciseQuestions('fixtures/exerciseQuestions/grade7-2025-english-easy.json', 'easy');
    await seedExerciseQuestions('fixtures/exerciseQuestions/grade7-2025-english-medium.json', 'medium');
    await seedExerciseQuestions('fixtures/exerciseQuestions/grade7-2025-english-hard.json', 'hard');

    console.log('\n✅ Curriculum seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding curriculum:', error);
    throw error;
  }
}

async function seedSubject(fixturePath: string, subjectName: string) {
  const data = loadJsonFile(fixturePath);

  // Create or get Grade
  let grade = await prisma.grade.findFirst({
    where: { level: data.grade.level },
  });

  if (!grade) {
    grade = await prisma.grade.create({
      data: {
        name: data.grade.name,
        level: data.grade.level,
      },
    });
  } else {
    grade = await prisma.grade.update({
      where: { id: grade.id },
      data: { name: data.grade.name },
    });
  }
  console.log(`  ✓ Grade: ${grade.name}`);

  // Create or get Subject
  let subject = await prisma.subject.findFirst({
    where: {
      gradeId: grade.id,
      name: data.subject.name,
    },
  });

  if (!subject) {
    subject = await prisma.subject.create({
      data: {
        name: data.subject.name,
        gradeId: grade.id,
        description: data.subject.description,
        order: 0,
      },
    });
  } else {
    subject = await prisma.subject.update({
      where: { id: subject.id },
      data: {
        description: data.subject.description,
      },
    });
  }
  console.log(`  ✓ Subject: ${subject.name}`);

    // Process chapters
    for (const chapterData of data.chapters) {
      let chapter = await prisma.chapter.findFirst({
        where: {
          subjectId: subject.id,
          order: chapterData.order,
        },
      });

      if (!chapter) {
        chapter = await prisma.chapter.create({
          data: {
            name: chapterData.name,
            subjectId: subject.id,
            description: chapterData.description,
            order: chapterData.order,
          },
        });
      } else {
        chapter = await prisma.chapter.update({
          where: { id: chapter.id },
          data: {
            name: chapterData.name,
            description: chapterData.description,
          },
        });
      }
    console.log(`    ✓ Chapter: ${chapter.name}`);

      // Count lessons per chapter (not per section) for lesson code generation
      let chapterLessonOrder = 1;

      // Process sections
      for (const sectionData of chapterData.sections) {
        let section = await prisma.section.findFirst({
          where: {
            chapterId: chapter.id,
            order: sectionData.order,
          },
        });

        if (!section) {
          section = await prisma.section.create({
            data: {
              name: sectionData.name,
              chapterId: chapter.id,
              description: sectionData.description,
              order: sectionData.order,
            },
          });
        } else {
          section = await prisma.section.update({
            where: { id: section.id },
            data: {
              name: sectionData.name,
              description: sectionData.description,
            },
          });
        }

      // Process lessons
      let sectionLessonOrder = 1;
      for (const lessonData of sectionData.lessons) {
        const order = lessonData.order || sectionLessonOrder;
        let lesson = await prisma.lesson.findFirst({
          where: {
            sectionId: section.id,
            order: order,
          },
        });

        if (!lesson) {
          lesson = await prisma.lesson.create({
            data: {
              title: lessonData.title,
              content: lessonData.content,
              sectionId: section.id,
              type: lessonData.type,
              mediaUrl: lessonData.mediaUrl || null,
              attachments: lessonData.attachments || null,
              order: order,
            },
          });
        } else {
          lesson = await prisma.lesson.update({
            where: { id: lesson.id },
            data: {
              title: lessonData.title,
              content: lessonData.content,
              type: lessonData.type,
              mediaUrl: lessonData.mediaUrl || null,
              attachments: lessonData.attachments || null,
            },
          });
        }

        // Generate lesson code: MATH7-CH1-L1 format (L number is per chapter, not per section)
        const lessonCode = `${data.subject.code}-CH${chapterData.order}-L${chapterLessonOrder}`;
        lessonCodeMap.set(lessonCode, lesson.id);
        chapterLessonOrder++;
        sectionLessonOrder++;
      }

      // Process exercises from curriculum file
      for (const exerciseData of sectionData.exercises) {
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
              sectionId: section.id,
              difficulty: exerciseData.difficulty,
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
              sectionId: section.id,
              difficulty: exerciseData.difficulty,
              type: exerciseData.type,
              points: exerciseData.points || 10,
              timeLimit: exerciseData.timeLimit || null,
              order: exerciseData.order,
            },
          });
        } else {
          // Update existing exercise (preserve UUID if exists, otherwise set new one)
          exercise = await prisma.exercise.update({
            where: { id: exercise.id },
            data: {
              uuid: exercise.uuid || exerciseUuid, // Keep existing UUID or set new one
              title: exerciseData.title,
              description: exerciseData.description || '',
              type: exerciseData.type,
              points: exerciseData.points || 10,
              timeLimit: exerciseData.timeLimit || null,
              order: exerciseData.order,
            },
          });
        }
      }
    }
  }
}

async function seedExercises(fixturePath: string, difficulty: string) {
  const data = loadJsonFile(fixturePath);
  console.log(`  📝 Seeding ${difficulty} exercises...`);

  for (const lessonData of data.lessons) {
    const lessonId = lessonCodeMap.get(lessonData.code);
    if (!lessonId) {
      console.warn(`    ⚠️  Lesson code not found: ${lessonData.code}`);
      continue;
    }

    // Get section from lesson
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { section: true },
    });

    if (!lesson) {
      console.warn(`    ⚠️  Lesson not found: ${lessonData.code}`);
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
            sectionId: lesson.sectionId,
            difficulty: difficulty,
            title: exerciseData.title,
          },
        });
      }

      // Generate UUID if not provided
      const exerciseUuid = exerciseData.uuid || randomUUID();
      const order = exerciseData.order || exerciseOrder;

      if (!exercise) {
        exercise = await prisma.exercise.create({
          data: {
            uuid: exerciseUuid,
            title: exerciseData.title,
            description: exerciseData.description || '',
            sectionId: lesson.sectionId,
            difficulty: difficulty,
            type: exerciseData.type,
            points: exerciseData.points || 10,
            order: order,
          },
        });
      } else {
        // Update existing exercise (preserve UUID if exists, otherwise set new one)
        exercise = await prisma.exercise.update({
          where: { id: exercise.id },
          data: {
            uuid: exercise.uuid || exerciseUuid, // Keep existing UUID or set new one
            title: exerciseData.title,
            type: exerciseData.type,
            points: exerciseData.points || 10,
            order: order,
          },
        });
      }

      // Store exercise mapping (use both original and normalized title for matching)
      // Keep original title with LaTeX in database, but also index by normalized for matching
      const key = `${lessonData.code}-${exerciseData.title}-${difficulty}`;
      const normalizedKey = `${lessonData.code}-${normalizeTitle(exerciseData.title)}-${difficulty}`;
      exerciseMap.set(key, exercise.id);
      exerciseMap.set(normalizedKey, exercise.id); // Also store normalized version for matching
      exerciseOrder++;
    }
  }
}

async function seedExerciseQuestions(fixturePath: string, difficulty: string) {
  const data = loadJsonFile(fixturePath);
  console.log(`  ❓ Seeding ${difficulty} exercise questions...`);

  let createdCount = 0;
  for (const questionData of data.questions) {
    // Try exact match first
    let key = `${questionData.lessonCode}-${questionData.exerciseTitle}-${difficulty}`;
    let exerciseId = exerciseMap.get(key);

    // If not found, try normalized match
    if (!exerciseId) {
      const normalizedTitle = normalizeTitle(questionData.exerciseTitle);
      const normalizedKey = `${questionData.lessonCode}-${normalizedTitle}-${difficulty}`;
      exerciseId = exerciseMap.get(normalizedKey);
      
      if (!exerciseId) {
        // Try to find exercise by matching normalized title in database
        const lessonId = lessonCodeMap.get(questionData.lessonCode);
        if (lessonId) {
          const lesson = await prisma.lesson.findUnique({
            where: { id: lessonId },
            include: { section: true },
          });
          
          if (lesson) {
            // Get all exercises for this section and difficulty, find by normalized title
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
            
            if (matchedExercise) {
              exerciseId = matchedExercise.id;
              // Cache it for future lookups
              exerciseMap.set(key, exerciseId);
              exerciseMap.set(normalizedKey, exerciseId);
            }
          }
        }
      }
    }

    if (!exerciseId) {
      console.warn(`    ⚠️  Exercise not found: ${key}`);
      continue;
    }

    // Check if question already exists (by question text)
    const existing = await prisma.exerciseQuestion.findFirst({
      where: {
        exerciseId: exerciseId,
        question: questionData.question,
      },
    });

    if (!existing) {
      // For multiple choice, use correctOption as answer if answer is not provided
      const answer = questionData.answer || questionData.correctOption || '';
      
      await prisma.exerciseQuestion.create({
        data: {
          exerciseId: exerciseId,
          question: questionData.question,
          answer: answer,
          options: questionData.options || null,
          order: questionData.order || 0,
          points: questionData.points || 1,
        },
      });
      createdCount++;
    }
  }
  console.log(`    ✓ Created ${createdCount} questions (${data.questions.length} total in file)`);
}

// Main execution
seedCurriculum()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

