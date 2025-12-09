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

// Map to store lesson codes to lesson info
const lessonCodeMap = new Map<string, { lessonId: number; sectionId: number }>();

async function buildLessonCodeMap(subjectId: number) {
  lessonCodeMap.clear();
  console.log(`  🔍 Building lesson code map...`);

  const subjectData = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: {
      chapters: {
        include: {
          sections: {
            include: {
              lessons: {
                orderBy: { order: 'asc' },
              },
            },
          },
        },
      },
    },
  });

  if (!subjectData) {
    console.warn(`    ⚠️  Subject not found: ${subjectId}`);
    return;
  }

  for (const chapter of subjectData.chapters) {
    for (const section of chapter.sections) {
      for (const lesson of section.lessons) {
        // Match by title (normalized - remove extra spaces, lowercase)
        const normalizedTitle = lesson.title
          .toLowerCase()
          .trim()
          .replace(/\s+/g, ' ');
        lessonCodeMap.set(normalizedTitle, {
          lessonId: lesson.id,
          sectionId: section.id,
        });
      }
    }
  }

  console.log(`    ✓ Mapped ${lessonCodeMap.size} lessons`);
}

async function seedInformatics() {
  console.log('🌱 Starting Informatics seeding...\n');

  try {
    // Seed Grade 5 Informatics
    console.log('📚 Seeding Grade 5 Informatics...');
    const grade5SubjectId = await seedSubject('fixtures/grade5-2025-informatics.json', 'Tin học', 5);
    await buildLessonCodeMap(grade5SubjectId);
    await seedExercisesFromFixture('fixtures/informatics/grade5-2025-informatics-easy.json', 'easy');
    await seedExercisesFromFixture('fixtures/informatics/grade5-2025-informatics-medium.json', 'medium');
    await seedExercisesFromFixture('fixtures/informatics/grade5-2025-informatics-hard.json', 'hard');

    // Seed Grade 7 Informatics
    console.log('\n📚 Seeding Grade 7 Informatics...');
    const grade7SubjectId = await seedSubject('fixtures/grade7-2025-informatics.json', 'Tin học', 7);
    await buildLessonCodeMap(grade7SubjectId);
    await seedExercisesFromFixture('fixtures/informatics/grade7-2025-informatics-easy.json', 'easy');
    await seedExercisesFromFixture('fixtures/informatics/grade7-2025-informatics-medium.json', 'medium');
    await seedExercisesFromFixture('fixtures/informatics/grade7-2025-informatics-hard.json', 'hard');

    console.log('\n✅ Informatics seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding informatics:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function seedSubject(fixturePath: string, subjectName: string, gradeLevel: number): Promise<number> {
  const data = loadJsonFile(fixturePath);

  // Create or get Grade
  let grade = await prisma.grade.findFirst({
    where: { level: gradeLevel },
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
              content: lessonData.content || '',
              sectionId: section.id,
              type: lessonData.type || 'text',
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
              content: lessonData.content || '',
              type: lessonData.type || 'text',
              mediaUrl: lessonData.mediaUrl || null,
              attachments: lessonData.attachments || null,
            },
          });
        }
        sectionLessonOrder++;
      }
    }
  }

  return subject.id;
}

async function seedExercisesFromFixture(fixturePath: string, difficulty: string) {
  const data = loadJsonFile(fixturePath);
  console.log(`  📝 Seeding ${difficulty} exercises from ${path.basename(fixturePath)}...`);

  let totalExercises = 0;
  let totalQuestions = 0;

  // Handle chapters > lessons > exercises structure
  if (!data.chapters || !Array.isArray(data.chapters)) {
    console.warn(`    ⚠️  Invalid structure in ${fixturePath}`);
    return;
  }

  // Process chapters > lessons > exercises
  for (const chapterData of data.chapters) {
    for (const lessonData of chapterData.lessons) {
      // Find lesson by matching title (normalized - remove extra spaces)
      const normalizedTitle = lessonData.title
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
      const lessonInfo = lessonCodeMap.get(normalizedTitle);
      
      if (!lessonInfo) {
        console.warn(`    ⚠️  Lesson not found: ${lessonData.title}`);
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
          totalExercises++;
        }

        // Process exercise questions
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
            // For multiple choice, answer is the option text
            const optionText = exerciseData.options?.[exerciseData.correctOption];
            answer = optionText || exerciseData.correctOption;
          }

          if (!existingQuestion) {
            await prisma.exerciseQuestion.create({
              data: {
                exerciseId: exercise.id,
                question: questionText,
                answer: answer,
                options: exerciseData.options || null,
                hint: exerciseData.hint || null,
                order: exerciseData.order || 1,
                points: exerciseData.points || 1,
              },
            });
            totalQuestions++;
          } else {
            // Update existing question
            await prisma.exerciseQuestion.update({
              where: { id: existingQuestion.id },
              data: {
                answer: answer,
                options: exerciseData.options || null,
                hint: exerciseData.hint || null,
                points: exerciseData.points || 1,
              },
            });
            totalQuestions++;
          }
        }

        exerciseOrder++;
      }
    }
  }

  console.log(`    ✓ Created/Updated ${totalExercises} exercises, ${totalQuestions} questions`);
}

// Main execution
seedInformatics()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

