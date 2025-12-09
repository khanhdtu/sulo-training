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

interface LessonData {
  code: string;
  title: string;
}

interface LessonCodeMap {
  [key: string]: {
    lessonId: number;
    sectionId: number;
  };
}

function loadJsonFile(filePath: string) {
  const fullPath = path.join(process.cwd(), filePath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(content);
}

async function seedSubject(fixturePath: string) {
  const data = loadJsonFile(fixturePath);
  console.log(`\n📚 Seeding subject: ${data.subject.name} (${data.subject.code})`);

  // Find or create grade
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
  }
  console.log(`  ✓ Grade: ${grade.name}`);

  // Find or create subject
  let subject = await prisma.subject.findFirst({
    where: {
      name: data.subject.name,
      gradeId: grade.id,
    },
  });

  if (!subject) {
    subject = await prisma.subject.create({
      data: {
        name: data.subject.name,
        gradeId: grade.id,
        description: data.subject.description,
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

async function buildLessonCodeMap(
  gradeId: number,
  subjectName: string,
  curriculumPath: string
): Promise<Map<string, { lessonId: number; sectionId: number }>> {
  let curriculum;
  try {
    curriculum = loadJsonFile(curriculumPath);
  } catch (error) {
    console.warn(`  ⚠️  Curriculum file not found: ${curriculumPath}`);
    return new Map();
  }
  
  const map = new Map<string, { lessonId: number; sectionId: number }>();

  // Find subject
  const subject = await prisma.subject.findFirst({
    where: {
      gradeId: gradeId,
      name: subjectName,
    },
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

  if (!subject) {
    console.warn(`  ⚠️  Subject not found: ${subjectName} (Grade ${gradeId})`);
    return map;
  }

  // Build map from curriculum
  for (const chapterData of curriculum.chapters) {
    const chapter = subject.chapters.find((c) => c.name === chapterData.name);
    if (!chapter) continue;

    for (const lessonData of chapterData.lessons) {
      // Find lesson in any section of this chapter
      for (const section of chapter.sections) {
        const lesson = section.lessons.find(
          (l) => l.title.toLowerCase().trim().replace(/\s+/g, ' ') ===
            lessonData.title.toLowerCase().trim().replace(/\s+/g, ' ')
        );

        if (lesson) {
          const normalizedTitle = lessonData.title
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ');
          map.set(normalizedTitle, {
            lessonId: lesson.id,
            sectionId: section.id,
          });
          break;
        }
      }
    }
  }

  return map;
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

  // Get grade and subject
  const grade = await prisma.grade.findFirst({
    where: { level: data.grade },
  });

  if (!grade) {
    console.warn(`    ⚠️  Grade not found: ${data.grade}`);
    return;
  }

  const subject = await prisma.subject.findFirst({
    where: {
      gradeId: grade.id,
      name: data.subject,
    },
  });

  if (!subject) {
    console.warn(`    ⚠️  Subject not found: ${data.subject} (Grade ${data.grade})`);
    return;
  }

  // Build lesson code map from curriculum
  // Use subjectCode from fixture data (e.g., GEO5 -> geography)
  const subjectCodeLower = (data.subjectCode || 'geography').toLowerCase();
  // Convert GEO5 -> geography, GEO7 -> geography
  const curriculumSubjectName = subjectCodeLower.startsWith('geo') ? 'geography' : subjectCodeLower;
  const curriculumPath = `fixtures/curriculum/grade${data.grade}-2025-2026-${curriculumSubjectName}.json`;
  const lessonCodeMap = await buildLessonCodeMap(grade.id, data.subject, curriculumPath);

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
          // Check if question already exists by UUID if provided
          let existingQuestion = null;
          if (exerciseData.uuid) {
            // For questions, we'll check by exerciseId and question text
            // since questions don't have UUID in the schema yet
            existingQuestion = await prisma.exerciseQuestion.findFirst({
              where: {
                exerciseId: exercise.id,
                question: questionText,
              },
            });
          } else {
            existingQuestion = await prisma.exerciseQuestion.findFirst({
              where: {
                exerciseId: exercise.id,
                question: questionText,
              },
            });
          }

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

async function seedCurriculumFromFile(curriculumPath: string) {
  const data = loadJsonFile(curriculumPath);
  console.log(`\n📋 Seeding curriculum: ${data.subject} (Grade ${data.grade})`);

  const grade = await prisma.grade.findFirst({
    where: { level: data.grade },
  });

  if (!grade) {
    console.warn(`  ⚠️  Grade not found: ${data.grade}`);
    return;
  }

  const subject = await prisma.subject.findFirst({
    where: {
      gradeId: grade.id,
      name: data.subject,
    },
  });

  if (!subject) {
    console.warn(`  ⚠️  Subject not found: ${data.subject}`);
    return;
  }

  // Check if curriculum already exists
  const existing = await prisma.curriculum.findFirst({
    where: {
      gradeId: grade.id,
      courseYear: data.courseYear,
      subject: data.subject,
    },
  });

  if (existing) {
    await prisma.curriculum.update({
      where: { id: existing.id },
      data: {
        lessons: data.chapters as any, // Prisma JSON type
      },
    });
    console.log(`  ✓ Updated curriculum`);
  } else {
    await prisma.curriculum.create({
      data: {
        gradeId: grade.id,
        courseYear: data.courseYear,
        subject: data.subject,
        lessons: data.chapters as any, // Prisma JSON type
      },
    });
    console.log(`  ✓ Created curriculum`);
  }
}

async function seedGeography() {
  console.log('🌍 Starting Geography data seeding...\n');

  try {
    // Seed subjects
    const grade5SubjectId = await seedSubject('fixtures/grade5-2025-geography.json');
    const grade7SubjectId = await seedSubject('fixtures/grade7-2025-geography.json');

    // Seed curriculum
    await seedCurriculumFromFile('fixtures/curriculum/grade5-2025-2026-geography.json');
    await seedCurriculumFromFile('fixtures/curriculum/grade7-2025-2026-geography.json');

    // Note: Lesson maps will be built inside seedExercisesFromFixture
    console.log(`\n  📊 Lesson maps will be built during exercise seeding...`);

    // Seed exercises for Grade 5
    console.log(`\n📚 Seeding Grade 5 exercises...`);
    await seedExercisesFromFixture('fixtures/geography/grade5-2025-geography-easy.json', 'easy');
    await seedExercisesFromFixture('fixtures/geography/grade5-2025-geography-medium.json', 'medium');
    await seedExercisesFromFixture('fixtures/geography/grade5-2025-geography-hard.json', 'hard');

    // Seed exercises for Grade 7
    console.log(`\n📚 Seeding Grade 7 exercises...`);
    await seedExercisesFromFixture('fixtures/geography/grade7-2025-geography-easy.json', 'easy');
    await seedExercisesFromFixture('fixtures/geography/grade7-2025-geography-medium.json', 'medium');
    await seedExercisesFromFixture('fixtures/geography/grade7-2025-geography-hard.json', 'hard');

    console.log('\n✅ Geography seeding completed!');
  } catch (error) {
    console.error('❌ Error seeding Geography:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

// Main execution
seedGeography()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

