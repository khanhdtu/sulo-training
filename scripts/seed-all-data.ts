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

// Seed curriculum into Curriculum table
async function seedCurriculumTable(fixturePath: string) {
  const data = loadJsonFile(fixturePath);

  // Create or get Grade
  let grade = await prisma.grade.findFirst({
    where: { level: data.grade },
  });

  if (!grade) {
    grade = await prisma.grade.create({
      data: {
        name: `Lớp ${data.grade}`,
        level: data.grade,
      },
    });
    console.log(`  ✓ Created Grade: ${grade.name}`);
  } else {
    console.log(`  ✓ Found Grade: ${grade.name}`);
  }

  // Prepare lessons data (chapters > lessons structure)
  const lessonsData = {
    chapters: data.chapters.map((chapter: any) => ({
      code: chapter.code,
      name: chapter.name,
      lessons: chapter.lessons.map((lesson: any) => ({
        code: lesson.code,
        title: lesson.title,
      })),
    })),
  };

  // Create or update Curriculum
  const curriculum = await prisma.curriculum.upsert({
    where: {
      gradeId_courseYear_subject: {
        gradeId: grade.id,
        courseYear: data.courseYear,
        subject: data.subject,
      },
    },
    update: {
      lessons: lessonsData as any,
      updatedAt: new Date(),
    },
    create: {
      gradeId: grade.id,
      courseYear: data.courseYear,
      subject: data.subject,
      lessons: lessonsData as any,
      createdAt: data.created_at ? new Date(data.created_at) : new Date(),
    },
  });

  console.log(`  ✓ Curriculum: ${data.subject} (${data.courseYear})`);
  console.log(`    - Chapters: ${data.chapters.length}`);
  const totalLessons = data.chapters.reduce(
    (sum: number, ch: any) => sum + ch.lessons.length,
    0
  );
  console.log(`    - Total Lessons: ${totalLessons}`);

  return { grade, curriculum };
}

// Create Subject, Chapter, Section, Lesson from curriculum
async function createSubjectStructure(fixturePath: string) {
  const data = loadJsonFile(fixturePath);

  // Get Grade
  const grade = await prisma.grade.findFirst({
    where: { level: data.grade },
  });

  if (!grade) {
    throw new Error(`Grade ${data.grade} not found`);
  }

  // Create or get Subject
  let subject = await prisma.subject.findFirst({
    where: {
      gradeId: grade.id,
      name: data.subject,
    },
  });

  if (!subject) {
    subject = await prisma.subject.create({
      data: {
        name: data.subject,
        gradeId: grade.id,
        description: `${data.subject} - Lớp ${data.grade}`,
        order: 0,
      },
    });
    console.log(`  ✓ Created Subject: ${subject.name}`);
  } else {
    console.log(`  ✓ Found Subject: ${subject.name}`);
  }

  // Process chapters
  let chapterOrder = 1;
  for (const chapterData of data.chapters) {
    let chapter = await prisma.chapter.findFirst({
      where: {
        subjectId: subject.id,
        name: chapterData.name,
      },
    });

    if (!chapter) {
      chapter = await prisma.chapter.create({
        data: {
          name: chapterData.name,
          subjectId: subject.id,
          description: chapterData.name,
          order: chapterOrder,
        },
      });
      console.log(`    ✓ Created Chapter: ${chapter.name}`);
    } else {
      console.log(`    ✓ Found Chapter: ${chapter.name}`);
    }

    // Create one section per chapter
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
    let lessonOrder = 1;
    for (const lessonData of chapterData.lessons) {
      let lesson = await prisma.lesson.findFirst({
        where: {
          sectionId: section.id,
          title: lessonData.title,
        },
      });

      if (!lesson) {
        lesson = await prisma.lesson.create({
          data: {
            title: lessonData.title,
            content: `Content for ${lessonData.title}`,
            sectionId: section.id,
            type: 'text',
            order: lessonOrder,
          },
        });
      }

      // Map lesson code to lesson and section IDs
      lessonCodeMap.set(lessonData.code, {
        lessonId: lesson.id,
        sectionId: section.id,
      });

      lessonOrder++;
    }

    chapterOrder++;
  }

  console.log(`    ✓ Mapped ${lessonCodeMap.size} lessons`);
  return { grade, subject };
}

// Seed exercises from fixture file
async function seedExercisesFromFixture(fixturePath: string, difficulty: string) {
  const data = loadJsonFile(fixturePath);
  console.log(`  📝 Seeding ${difficulty} exercises from ${path.basename(fixturePath)}...`);

  let totalExercises = 0;
  let totalQuestions = 0;

  // Handle different structures: chapters > lessons > exercises OR lessons (flat array)
  let lessonsToProcess: any[] = [];

  if (data.chapters && Array.isArray(data.chapters)) {
    // Structure: chapters > lessons > exercises
    for (const chapterData of data.chapters) {
      for (const lessonData of chapterData.lessons) {
        lessonsToProcess.push(lessonData);
      }
    }
  } else if (data.lessons && Array.isArray(data.lessons)) {
    // Structure: flat lessons array
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
      // Check if exercise already exists by created_at (if provided) or by title
      const exerciseCreatedAt = exerciseData.created_at ? new Date(exerciseData.created_at) : null;
      
      let exercise = null;
      
      // First, try to find by title and section (most reliable)
      exercise = await prisma.exercise.findFirst({
        where: {
          sectionId: lessonInfo.sectionId,
          difficulty: difficulty,
          title: exerciseData.title,
        },
      });
      
      // If found by title, check if created_at matches (if provided)
      if (exercise && exerciseCreatedAt) {
        if (exercise.createdAt) {
          const diff = Math.abs(exercise.createdAt.getTime() - exerciseCreatedAt.getTime());
          // If created_at doesn't match (more than 1 second difference), treat as different exercise
          if (diff > 1000) {
            exercise = null; // Don't use this exercise, will create new one
          }
        }
      }

      if (!exercise) {
        exercise = await prisma.exercise.create({
          data: {
            title: exerciseData.title,
            description: exerciseData.description || '',
            sectionId: lessonInfo.sectionId,
            difficulty: difficulty,
            type: exerciseData.type,
            points: exerciseData.points || 10,
            timeLimit: exerciseData.timeLimit || null,
            order: exerciseOrder,
            createdAt: exerciseCreatedAt || new Date(),
          },
        });
        totalExercises++;
        console.log(`      ✓ Created exercise: ${exerciseData.title}`);
      } else {
        // Skip if already exists (don't update to avoid overwriting)
        console.log(`      ⊘ Skipped existing exercise: ${exerciseData.title}`);
      }

      // Process exercise questions
      const questionText = exerciseData.question || exerciseData.title;
      
      if (questionText) {
        // Check if question already exists by created_at (if provided) or by question text
        const questionCreatedAt = exerciseData.created_at ? new Date(exerciseData.created_at) : null;
        
        // First, try to find by question text
        let existingQuestion = await prisma.exerciseQuestion.findFirst({
          where: {
            exerciseId: exercise.id,
            question: questionText,
          },
        });
        
        // If found by question text, check if created_at matches (if provided)
        if (existingQuestion && questionCreatedAt) {
          if (existingQuestion.createdAt) {
            const diff = Math.abs(existingQuestion.createdAt.getTime() - questionCreatedAt.getTime());
            // If created_at doesn't match (more than 1 second difference), treat as different question
            if (diff > 1000) {
              existingQuestion = null; // Don't use this question, will create new one
            }
          }
        }

        // Determine answer
        let answer = exerciseData.answer || '';
        if (!answer && exerciseData.correctOption) {
          answer = exerciseData.correctOption;
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
              createdAt: exerciseCreatedAt || new Date(),
            },
          });
          totalQuestions++;
          console.log(`      ✓ Created question: ${questionText.substring(0, 50)}...`);
        } else {
          // Skip if already exists (don't update to avoid overwriting)
          console.log(`      ⊘ Skipped existing question: ${questionText.substring(0, 50)}...`);
        }
      }

      exerciseOrder++;
    }
  }

  console.log(`    ✓ Created/Updated ${totalExercises} exercises, ${totalQuestions} questions`);
}

// Main seeding function
async function seedAllData() {
  console.log('🌱 Starting comprehensive data seeding...\n');

  try {
    // Define all curriculum files to seed
    const curriculumFiles = [
      // Grade 7
      { path: 'fixtures/curriculum/grade7-2025-2026-math.json', subject: 'Toán', grade: 7 },
      { path: 'fixtures/curriculum/grade7-2025-2026-english.json', subject: 'Tiếng Anh', grade: 7 },
      { path: 'fixtures/curriculum/grade7-2025-2026-science.json', subject: 'Khoa học tự nhiên', grade: 7 },
      { path: 'fixtures/curriculum/grade7-2025-2026-history.json', subject: 'Lịch sử', grade: 7 },
      // Grade 5
      { path: 'fixtures/curriculum/grade5-2025-2026-math.json', subject: 'Toán', grade: 5 },
      { path: 'fixtures/curriculum/grade5-2025-2026-english.json', subject: 'Tiếng Anh', grade: 5 },
      { path: 'fixtures/curriculum/grade5-2025-2026-science.json', subject: 'Khoa học', grade: 5 },
      { path: 'fixtures/curriculum/grade5-2025-2026-literature.json', subject: 'Tiếng Việt', grade: 5 },
    ];

    // Step 1: Seed all curricula into Curriculum table
    console.log('📚 Step 1: Seeding Curriculum table...\n');
    for (const file of curriculumFiles) {
      if (fs.existsSync(path.join(process.cwd(), file.path))) {
        console.log(`📖 Processing ${file.subject} (Grade ${file.grade})...`);
        await seedCurriculumTable(file.path);
      } else {
        console.warn(`⚠️  File not found: ${file.path}`);
      }
    }

    // Step 2: Create Subject, Chapter, Section, Lesson structures
    console.log('\n📚 Step 2: Creating Subject/Chapter/Section/Lesson structures...\n');
    for (const file of curriculumFiles) {
      if (fs.existsSync(path.join(process.cwd(), file.path))) {
        console.log(`📖 Processing ${file.subject} (Grade ${file.grade})...`);
        lessonCodeMap.clear(); // Clear map for each subject
        await createSubjectStructure(file.path);
      }
    }

    // Step 3: Seed exercises
    console.log('\n📚 Step 3: Seeding exercises...\n');
    
    // Grade 7 exercises
    const grade7Exercises = [
      { path: 'fixtures/math/grade7-2025-math-easy.json', difficulty: 'easy', subject: 'Toán', grade: 7 },
      { path: 'fixtures/math/grade7-2025-math-medium.json', difficulty: 'medium', subject: 'Toán', grade: 7 },
      { path: 'fixtures/math/grade7-2025-math-hard.json', difficulty: 'hard', subject: 'Toán', grade: 7 },
      { path: 'fixtures/english/grade7-2025-english-easy.json', difficulty: 'easy', subject: 'Tiếng Anh', grade: 7 },
      { path: 'fixtures/english/grade7-2025-english-medium.json', difficulty: 'medium', subject: 'Tiếng Anh', grade: 7 },
      { path: 'fixtures/english/grade7-2025-english-hard.json', difficulty: 'hard', subject: 'Tiếng Anh', grade: 7 },
      { path: 'fixtures/science/grade7-2025-science-easy.json', difficulty: 'easy', subject: 'Khoa học tự nhiên', grade: 7 },
      { path: 'fixtures/science/grade7-2025-science-medium.json', difficulty: 'medium', subject: 'Khoa học tự nhiên', grade: 7 },
      { path: 'fixtures/science/grade7-2025-science-hard.json', difficulty: 'hard', subject: 'Khoa học tự nhiên', grade: 7 },
      { path: 'fixtures/history/grade7-2025-history-easy.json', difficulty: 'easy', subject: 'Lịch sử', grade: 7 },
      { path: 'fixtures/history/grade7-2025-history-medium.json', difficulty: 'medium', subject: 'Lịch sử', grade: 7 },
      { path: 'fixtures/history/grade7-2025-history-hard.json', difficulty: 'hard', subject: 'Lịch sử', grade: 7 },
    ];

    // Grade 5 exercises
    const grade5Exercises = [
      { path: 'fixtures/math/grade5-2025-math-easy.json', difficulty: 'easy', subject: 'Toán', grade: 5 },
      { path: 'fixtures/math/grade5-2025-math-medium.json', difficulty: 'medium', subject: 'Toán', grade: 5 },
      { path: 'fixtures/math/grade5-2025-math-hard.json', difficulty: 'hard', subject: 'Toán', grade: 5 },
      { path: 'fixtures/english/grade5-2025-english-easy.json', difficulty: 'easy', subject: 'Tiếng Anh', grade: 5 },
      { path: 'fixtures/english/grade5-2025-english-medium.json', difficulty: 'medium', subject: 'Tiếng Anh', grade: 5 },
      { path: 'fixtures/english/grade5-2025-english-hard.json', difficulty: 'hard', subject: 'Tiếng Anh', grade: 5 },
      { path: 'fixtures/science/grade5-2025-science-easy.json', difficulty: 'easy', subject: 'Khoa học', grade: 5 },
      { path: 'fixtures/science/grade5-2025-science-medium.json', difficulty: 'medium', subject: 'Khoa học', grade: 5 },
      { path: 'fixtures/science/grade5-2025-science-hard.json', difficulty: 'hard', subject: 'Khoa học', grade: 5 },
      { path: 'fixtures/literature/grade5-2025-literature-easy.json', difficulty: 'easy', subject: 'Tiếng Việt', grade: 5 },
      { path: 'fixtures/literature/grade5-2025-literature-medium.json', difficulty: 'medium', subject: 'Tiếng Việt', grade: 5 },
      { path: 'fixtures/literature/grade5-2025-literature-hard.json', difficulty: 'hard', subject: 'Tiếng Việt', grade: 5 },
    ];

    const allExercises = [...grade7Exercises, ...grade5Exercises];

    // Group by subject to rebuild lesson code map
    const exercisesBySubject = new Map<string, typeof allExercises>();
    for (const ex of allExercises) {
      const key = `${ex.grade}-${ex.subject}`;
      if (!exercisesBySubject.has(key)) {
        exercisesBySubject.set(key, []);
      }
      exercisesBySubject.get(key)!.push(ex);
    }

    // Seed exercises for each subject
    for (const [key, exercises] of exercisesBySubject.entries()) {
      const [gradeStr, subject] = key.split('-');
      const grade = parseInt(gradeStr);
      
      // Find curriculum file for this subject and grade
      const curriculumFile = curriculumFiles.find(
        f => f.grade === grade && f.subject === subject
      );

      if (curriculumFile && fs.existsSync(path.join(process.cwd(), curriculumFile.path))) {
        console.log(`\n📖 Seeding exercises for ${subject} (Grade ${grade})...`);
        lessonCodeMap.clear();
        await createSubjectStructure(curriculumFile.path);

        // Seed all difficulty levels for this subject
        for (const ex of exercises) {
          if (fs.existsSync(path.join(process.cwd(), ex.path))) {
            await seedExercisesFromFixture(ex.path, ex.difficulty);
          } else {
            console.warn(`    ⚠️  File not found: ${ex.path}`);
          }
        }
      } else {
        console.warn(`⚠️  Curriculum not found for ${subject} (Grade ${grade})`);
      }
    }

    console.log('\n✅ All data seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  }
}

// Main execution
seedAllData()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

