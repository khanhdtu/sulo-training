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
async function seedCurriculumTable(curriculumPath: string) {
  const data = loadJsonFile(curriculumPath);

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
async function createSubjectStructure(curriculumPath: string) {
  const data = loadJsonFile(curriculumPath);

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

  // Handle chapters > lessons > exercises structure
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
        // Update existing exercise
        exercise = await prisma.exercise.update({
          where: { id: exercise.id },
          data: {
            description: exerciseData.description || '',
            type: exerciseData.type,
            points: exerciseData.points || 10,
            timeLimit: exerciseData.timeLimit || null,
            order: exerciseOrder,
          },
        });
        console.log(`      ⊘ Updated existing exercise: ${exerciseData.title}`);
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
              createdAt: questionCreatedAt || new Date(),
            },
          });
          totalQuestions++;
          console.log(`      ✓ Created question: ${questionText.substring(0, 50)}...`);
        } else {
          // Update existing question
          await prisma.exerciseQuestion.update({
            where: { id: existingQuestion.id },
            data: {
              question: questionText,
              answer: exerciseData.answer || exerciseData.correctOption || existingQuestion.answer || answer,
              options: exerciseData.options !== undefined ? exerciseData.options : existingQuestion.options,
              hint: exerciseData.hint !== undefined ? exerciseData.hint : existingQuestion.hint,
              points: exerciseData.points || existingQuestion.points,
            },
          });
          console.log(`      ⊘ Updated existing question: ${questionText.substring(0, 50)}...`);
        }
      }

      exerciseOrder++;
    }
  }

  console.log(`    ✓ Created/Updated ${totalExercises} exercises, ${totalQuestions} questions`);
}

// Main seeding function
async function seedGrade5MathEasy() {
  console.log('🌱 Starting Grade 5 Math Easy seeding...\n');

  try {
    const curriculumPath = 'fixtures/curriculum/grade5-2025-2026-math.json';
    const exercisePath = 'fixtures/math/grade5-2025-math-easy.json';
    const difficulty = 'easy';

    // Step 1: Seed curriculum
    console.log('📚 Step 1: Seeding Curriculum...\n');
    if (fs.existsSync(path.join(process.cwd(), curriculumPath))) {
      await seedCurriculumTable(curriculumPath);
    } else {
      console.warn(`⚠️  Curriculum file not found: ${curriculumPath}`);
      console.log('   Proceeding with exercise file structure...');
    }

    // Step 2: Create Subject/Chapter/Section/Lesson structures
    console.log('\n📚 Step 2: Creating Subject/Chapter/Section/Lesson structures...\n');
    if (fs.existsSync(path.join(process.cwd(), curriculumPath))) {
      lessonCodeMap.clear();
      await createSubjectStructure(curriculumPath);
    } else {
      // If no curriculum file, try to build structure from exercise file
      const exerciseData = loadJsonFile(exercisePath);
      // Create a temporary curriculum structure from exercise data
      const tempCurriculum = {
        grade: exerciseData.grade,
        courseYear: '2025-2026',
        subject: exerciseData.subject,
        chapters: exerciseData.chapters.map((ch: any) => ({
          code: ch.code,
          name: ch.name,
          lessons: ch.lessons.map((l: any) => ({
            code: l.code,
            title: l.title,
          })),
        })),
      };
      // Write temp file and use it
      const tempPath = path.join(process.cwd(), 'temp-curriculum.json');
      fs.writeFileSync(tempPath, JSON.stringify(tempCurriculum, null, 2));
      await createSubjectStructure('temp-curriculum.json');
      fs.unlinkSync(tempPath); // Clean up
    }

    // Step 3: Seed exercises
    console.log('\n📚 Step 3: Seeding exercises...\n');
    if (fs.existsSync(path.join(process.cwd(), exercisePath))) {
      await seedExercisesFromFixture(exercisePath, difficulty);
    } else {
      throw new Error(`Exercise file not found: ${exercisePath}`);
    }

    console.log('\n✅ Grade 5 Math Easy seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  }
}

// Main execution
seedGrade5MathEasy()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

