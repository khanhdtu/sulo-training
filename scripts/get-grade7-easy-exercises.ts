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

async function getGrade7EasyExercises() {
  console.log('🔍 Fetching Grade 7 Easy Exercises...\n');

  try {
    // Get Grade 7
    const grade = await prisma.grade.findFirst({
      where: { level: 7 },
    });

    if (!grade) {
      console.error('❌ Grade 7 not found');
      return;
    }

    console.log(`✓ Found Grade: ${grade.name} (Level ${grade.level})\n`);

    // Get all subjects for Grade 7
    const subjects = await prisma.subject.findMany({
      where: { gradeId: grade.id },
      include: {
        chapters: {
          include: {
            sections: {
              include: {
                lessons: {
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
                },
                exercises: {
                  where: {
                    difficulty: 'easy',
                  },
                  include: {
                    questions: {
                      orderBy: {
                        order: 'asc',
                      },
                    },
                  },
                  orderBy: {
                    order: 'asc',
                  },
                },
              },
              orderBy: {
                order: 'asc',
              },
            },
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
      orderBy: {
        order: 'asc',
      },
    });

    const output: any = {
      grade: {
        id: grade.id,
        name: grade.name,
        level: grade.level,
      },
      subjects: [],
    };

    for (const subject of subjects) {
      console.log(`📚 Processing Subject: ${subject.name}`);

      const subjectData: any = {
        id: subject.id,
        name: subject.name,
        description: subject.description,
        chapters: [],
      };

      for (const chapter of subject.chapters) {
        console.log(`  📖 Chapter: ${chapter.name}`);

        const chapterData: any = {
          id: chapter.id,
          name: chapter.name,
          description: chapter.description,
          order: chapter.order,
          sections: [],
        };

        for (const section of chapter.sections) {
          const sectionData: any = {
            id: section.id,
            name: section.name,
            description: section.description,
            order: section.order,
            lessons: [],
            exercises: [],
          };

          // Process lessons
          for (const lesson of section.lessons) {
            // Generate lesson code
            const lessonCode = `${subject.name === 'Toán' ? 'MATH7' : 'ENG7'}-CH${chapter.order}-L${lesson.order}`;
            
            sectionData.lessons.push({
              id: lesson.id,
              code: lessonCode,
              title: lesson.title,
              type: lesson.type,
              order: lesson.order,
            });
          }

          // Process easy exercises
          for (const exercise of section.exercises) {
            const exerciseData: any = {
              id: exercise.id,
              title: exercise.title,
              description: exercise.description,
              type: exercise.type,
              difficulty: exercise.difficulty,
              points: exercise.points,
              timeLimit: exercise.timeLimit,
              order: exercise.order,
              questions: [],
            };

            // Process questions
            for (const question of exercise.questions) {
              exerciseData.questions.push({
                id: question.id,
                question: question.question,
                answer: question.answer,
                options: question.options,
                points: question.points,
                order: question.order,
              });
            }

            sectionData.exercises.push(exerciseData);
          }

          chapterData.sections.push(sectionData);
        }

        subjectData.chapters.push(chapterData);
      }

      output.subjects.push(subjectData);
    }

    // Write to JSON file
    const outputPath = path.join(process.cwd(), 'output', 'grade7-easy-exercises.json');
    const outputDir = path.dirname(outputPath);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

    console.log(`\n✅ Successfully exported to: ${outputPath}`);
    console.log(`\n📊 Summary:`);
    console.log(`   - Subjects: ${output.subjects.length}`);
    console.log(`   - Total Chapters: ${output.subjects.reduce((sum: number, s: any) => sum + s.chapters.length, 0)}`);
    console.log(`   - Total Sections: ${output.subjects.reduce((sum: number, s: any) => sum + s.chapters.reduce((sum2: number, c: any) => sum2 + c.sections.length, 0), 0)}`);
    console.log(`   - Total Easy Exercises: ${output.subjects.reduce((sum: number, s: any) => sum + s.chapters.reduce((sum2: number, c: any) => sum2 + c.sections.reduce((sum3: number, sec: any) => sum3 + sec.exercises.length, 0), 0), 0)}`);
    console.log(`   - Total Questions: ${output.subjects.reduce((sum: number, s: any) => sum + s.chapters.reduce((sum2: number, c: any) => sum2 + c.sections.reduce((sum3: number, sec: any) => sum3 + sec.exercises.reduce((sum4: number, ex: any) => sum4 + ex.questions.length, 0), 0), 0), 0)}`);

  } catch (error) {
    console.error('❌ Error fetching exercises:', error);
    throw error;
  }
}

// Main execution
getGrade7EasyExercises()
  .catch((e) => {
    console.error('❌ Script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

