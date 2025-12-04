#!/usr/bin/env tsx
/**
 * Get Subject Curriculum Script
 * 
 * This script fetches the complete curriculum for a specific subject by ID
 * and exports it to a JSON file.
 * Usage: tsx scripts/get-subject-curriculum.ts [subjectId]
 * Example: tsx scripts/get-subject-curriculum.ts 3
 */

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

async function getSubjectCurriculum(subjectId: number) {
  console.log(`🔍 Fetching Curriculum for Subject ID: ${subjectId}...\n`);

  try {
    // Get subject by ID
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        grade: {
          select: {
            id: true,
            name: true,
            level: true,
          },
        },
        chapters: {
          include: {
            sections: {
              include: {
                lessons: {
                  orderBy: {
                    order: 'asc',
                  },
                },
                exercises: {
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
    });

    if (!subject) {
      console.error(`❌ Subject with ID ${subjectId} not found`);
      return;
    }

    console.log(`✓ Found Subject: ${subject.name}`);
    console.log(`✓ Grade: ${subject.grade.name} (Level ${subject.grade.level})\n`);

    const output: any = {
      grade: {
        id: subject.grade.id,
        name: subject.grade.name,
        level: subject.grade.level,
      },
      subject: {
        id: subject.id,
        name: subject.name,
        description: subject.description,
        order: subject.order,
      },
      chapters: [],
    };

    // Track lesson order per chapter for generating lesson codes
    let totalLessons = 0;
    let totalExercises = 0;
    let totalQuestions = 0;

    // Generate subject code (e.g., MATH7, ENG7)
    const subjectCode = subject.name.toUpperCase().substring(0, 4) + subject.grade.level;

    for (const chapter of subject.chapters) {
      console.log(`  📖 Chapter ${chapter.order}: ${chapter.name}`);

      // Initialize lesson counter for this chapter
      let chapterLessonOrder = 1;

      const chapterData: any = {
        id: chapter.id,
        name: chapter.name,
        description: chapter.description,
        order: chapter.order,
        sections: [],
      };

      for (const section of chapter.sections) {
        console.log(`    📑 Section ${section.order}: ${section.name}`);

        const sectionData: any = {
          id: section.id,
          name: section.name,
          description: section.description,
          order: section.order,
          lessons: [],
          exercises: [],
        };

        // Process lessons and generate lesson codes
        for (const lesson of section.lessons) {
          // Generate lesson code: SUBJECTCODE-CH1-L1 format (L number is per chapter)
          const lessonCode = `${subjectCode}-CH${chapter.order}-L${chapterLessonOrder}`;
          
          sectionData.lessons.push({
            id: lesson.id,
            code: lessonCode,
            title: lesson.title,
            content: lesson.content,
            type: lesson.type,
            mediaUrl: lesson.mediaUrl,
            attachments: lesson.attachments,
            order: lesson.order,
          });

          chapterLessonOrder++;
          totalLessons++;
        }

        // Process all exercises (all difficulty levels)
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
              hint: question.hint,
              points: question.points,
              order: question.order,
            });
            totalQuestions++;
          }

          sectionData.exercises.push(exerciseData);
          totalExercises++;
        }

        chapterData.sections.push(sectionData);
      }

      output.chapters.push(chapterData);
    }

    // Write to JSON file
    const outputPath = path.join(process.cwd(), 'output', `subject-${subjectId}-curriculum.json`);
    const outputDir = path.dirname(outputPath);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

    console.log(`\n✅ Successfully exported to: ${outputPath}`);
    console.log(`\n📊 Summary:`);
    console.log(`   - Grade: ${output.grade.name} (Level ${output.grade.level})`);
    console.log(`   - Subject: ${output.subject.name} (ID: ${output.subject.id})`);
    console.log(`   - Total Chapters: ${output.chapters.length}`);
    console.log(`   - Total Sections: ${output.chapters.reduce((sum: number, c: any) => sum + c.sections.length, 0)}`);
    console.log(`   - Total Lessons: ${totalLessons}`);
    console.log(`   - Total Exercises: ${totalExercises}`);
    console.log(`   - Total Questions: ${totalQuestions}`);
    
    // Breakdown by difficulty
    const easyExercises = output.chapters.reduce((sum: number, c: any) => 
      sum + c.sections.reduce((sum2: number, s: any) => 
        sum2 + s.exercises.filter((ex: any) => ex.difficulty === 'easy').length, 0), 0);
    const mediumExercises = output.chapters.reduce((sum: number, c: any) => 
      sum + c.sections.reduce((sum2: number, s: any) => 
        sum2 + s.exercises.filter((ex: any) => ex.difficulty === 'medium').length, 0), 0);
    const hardExercises = output.chapters.reduce((sum: number, c: any) => 
      sum + c.sections.reduce((sum2: number, s: any) => 
        sum2 + s.exercises.filter((ex: any) => ex.difficulty === 'hard').length, 0), 0);
    
    console.log(`\n📈 Exercises by Difficulty:`);
    console.log(`   - Easy: ${easyExercises}`);
    console.log(`   - Medium: ${mediumExercises}`);
    console.log(`   - Hard: ${hardExercises}`);

  } catch (error) {
    console.error('❌ Error fetching curriculum:', error);
    throw error;
  }
}

// Main execution
const subjectId = process.argv[2] ? parseInt(process.argv[2]) : 3;

if (isNaN(subjectId)) {
  console.error('❌ Invalid subject ID. Please provide a valid number.');
  console.log('Usage: tsx scripts/get-subject-curriculum.ts [subjectId]');
  console.log('Example: tsx scripts/get-subject-curriculum.ts 3');
  process.exit(1);
}

getSubjectCurriculum(subjectId)
  .catch((e) => {
    console.error('❌ Script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

