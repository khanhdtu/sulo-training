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

async function buildLessonCodeMap(
  gradeId: number,
  subjectName: string,
  curriculumPath: string
): Promise<Map<string, { lessonId: number; sectionId: number }>> {
  const curriculum = loadJsonFile(curriculumPath);
  const map = new Map<string, { lessonId: number; sectionId: number }>();

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
              lessons: true,
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

  for (const chapterData of curriculum.chapters) {
    // Try exact match first
    let chapter = subject.chapters.find((c) => c.name === chapterData.name);
    
    // If not found, try matching by name without prefix "Chương X: "
    if (!chapter) {
      const chapterNameWithoutPrefix = chapterData.name.replace(/^Chương \d+:\s*/, '');
      chapter = subject.chapters.find((c) => {
        const dbNameWithoutPrefix = c.name.replace(/^Chương \d+:\s*/, '');
        return dbNameWithoutPrefix === chapterNameWithoutPrefix || c.name.includes(chapterNameWithoutPrefix);
      });
    }
    
    // If still not found, try matching by name that contains the curriculum chapter name
    if (!chapter) {
      chapter = subject.chapters.find((c) => c.name.includes(chapterData.name) || chapterData.name.includes(c.name.replace(/^Chương \d+:\s*/, '')));
    }
    
    if (!chapter) {
      console.warn(`    ⚠️  Chapter not found: ${chapterData.name}`);
      continue;
    }

    for (const lessonData of chapterData.lessons) {
      let found = false;
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
          found = true;
          break;
        }
      }
      if (!found) {
        console.warn(`    ⚠️  Lesson not found: ${lessonData.title} in chapter ${chapterData.name}`);
      }
    }
  }
  console.log(`    ✓ Mapped ${map.size} lessons`);
  return map;
}

async function seedSubject(fixturePath: string, subjectName: string, gradeLevel: number): Promise<{ id: number; gradeId: number; name: string }> {
  const data = loadJsonFile(fixturePath);

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
  return subject;
}

async function seedCurriculumFromFile(filePath: string) {
  const curriculumData = loadJsonFile(filePath);
  console.log(`📋 Seeding curriculum: ${curriculumData.subject} (Grade ${curriculumData.grade})`);

  let grade = await prisma.grade.findFirst({
    where: { level: curriculumData.grade },
  });

  if (!grade) {
    console.warn(`  ⚠️  Grade ${curriculumData.grade} not found for curriculum seeding.`);
    return;
  }

  let subject = await prisma.subject.findFirst({
    where: {
      gradeId: grade.id,
      name: curriculumData.subject,
    },
  });

  if (!subject) {
    console.warn(`  ⚠️  Subject ${curriculumData.subject} not found for curriculum seeding.`);
    return;
  }

  // Prepare lessons data (chapters > lessons structure)
  const lessonsData = {
    chapters: curriculumData.chapters.map((chapter: any) => ({
      code: chapter.code,
      name: chapter.name,
      lessons: chapter.lessons.map((lesson: any) => ({
        code: lesson.code,
        title: lesson.title,
      })),
    })),
  };

  let curriculum = await prisma.curriculum.findFirst({
    where: {
      gradeId: grade.id,
      courseYear: curriculumData.courseYear,
      subject: curriculumData.subject,
    },
  });

  if (!curriculum) {
    curriculum = await prisma.curriculum.create({
      data: {
        gradeId: grade.id,
        courseYear: curriculumData.courseYear,
        subject: curriculumData.subject,
        lessons: lessonsData as any,
      },
    });
    console.log(`  ✓ Created curriculum`);
  } else {
    curriculum = await prisma.curriculum.update({
      where: { id: curriculum.id },
      data: {
        lessons: lessonsData as any,
        updatedAt: new Date(),
      },
    });
    console.log(`  ✓ Updated curriculum`);
  }
}

async function seedExercisesFromFixture(fixturePath: string, difficulty: string) {
  const data = loadJsonFile(fixturePath);
  console.log(`  📝 Seeding ${difficulty} exercises from ${path.basename(fixturePath)}...`);

  let totalExercises = 0;
  let totalQuestions = 0;

  if (!data.chapters || !Array.isArray(data.chapters)) {
    console.warn(`    ⚠️  Invalid structure in ${fixturePath}`);
    return;
  }

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

  // Build lesson code map from curriculum for this specific subject/grade
  // Map subject code to curriculum file name
  const subjectCodeMap: Record<string, string> = {
    'LS5': 'history',
    'GEO5': 'geography',
    'INFO5': 'informatics',
  };
  const curriculumFileName = subjectCodeMap[data.subjectCode] || data.subjectCode.toLowerCase();
  const curriculumFilePath = `fixtures/curriculum/grade${data.grade}-${data.academicYear || '2025-2026'}-${curriculumFileName}.json`;
  const lessonMap = await buildLessonCodeMap(grade.id, data.subject, curriculumFilePath);

  if (lessonMap.size === 0) {
    console.warn(`    ⚠️  No lessons mapped for ${data.subject} (Grade ${data.grade}). Skipping exercise seeding.`);
    return;
  }

  for (const chapterData of data.chapters) {
    for (const lessonData of chapterData.lessons) {
      const normalizedTitle = lessonData.title
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
      const lessonInfo = lessonMap.get(normalizedTitle);

      if (!lessonInfo) {
        console.warn(`    ⚠️  Lesson not found: ${lessonData.title}`);
        continue;
      }

      let exerciseOrder = 1;
      for (const exerciseData of lessonData.exercises) {
        let exercise = null;
        if (exerciseData.uuid) {
          exercise = await prisma.exercise.findFirst({
            where: {
              uuid: exerciseData.uuid,
            },
          });
        }

        if (!exercise) {
          exercise = await prisma.exercise.findFirst({
            where: {
              sectionId: lessonInfo.sectionId,
              difficulty: difficulty,
              title: exerciseData.title,
            },
          });
        }

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
          exercise = await prisma.exercise.update({
            where: { id: exercise.id },
            data: {
              uuid: exercise.uuid || exerciseUuid,
              description: exerciseData.description || '',
              type: exerciseData.type,
              points: exerciseData.points || 10,
              timeLimit: exerciseData.timeLimit || null,
              order: exerciseOrder,
            },
          });
          totalExercises++;
        }

        const questionText = exerciseData.question || exerciseData.title;

        if (questionText) {
          const existingQuestion = await prisma.exerciseQuestion.findFirst({
            where: {
              exerciseId: exercise.id,
              question: questionText,
            },
          });

          let answer = exerciseData.answer || '';
          if (!answer && exerciseData.correctOption) {
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

async function seedHistory() {
  console.log('📜 Starting History data seeding...\n');

  try {
    console.log('📚 Seeding subject: Lịch sử (LS5)');
    const grade5Subject = await seedSubject('fixtures/grade5-2025-history.json', 'Lịch sử', 5);

    console.log('\n📋 Seeding curriculum: Lịch sử (Grade 5)');
    await seedCurriculumFromFile('fixtures/curriculum/grade5-2025-2026-history.json');

    console.log('\n  📊 Lesson maps will be built during exercise seeding...');

    console.log('\n📚 Seeding Grade 5 exercises...');
    await seedExercisesFromFixture('fixtures/history/grade5-2025-history-easy.json', 'easy');
    await seedExercisesFromFixture('fixtures/history/grade5-2025-history-medium.json', 'medium');
    await seedExercisesFromFixture('fixtures/history/grade5-2025-history-hard.json', 'hard');

    console.log('\n✅ History seeding completed!');
  } catch (error) {
    console.error('❌ Error seeding History:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

seedHistory()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

