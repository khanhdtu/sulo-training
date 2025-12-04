#!/usr/bin/env tsx
/**
 * Get Grade 7 Math Curriculum Script
 * 
 * This script fetches the complete curriculum for Grade 7 Math from the database
 * and exports it to a JSON file.
 * Usage: tsx scripts/get-grade7-math-curriculum.ts
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

async function getGrade7MathCurriculum() {
  console.log('🔍 Fetching Grade 7 Math Curriculum...\n');

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

    // Get Math subject for Grade 7
    const subject = await prisma.subject.findFirst({
      where: {
        gradeId: grade.id,
        name: 'Toán',
      },
      include: {
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
      console.error('❌ Math subject not found for Grade 7');
      return;
    }

    console.log(`📚 Processing Subject: ${subject.name}\n`);

    const output: any = {
      grade: {
        id: grade.id,
        name: grade.name,
        level: grade.level,
      },
      subject: {
        id: subject.id,
        name: subject.name,
        code: 'MATH7',
        description: subject.description,
        order: subject.order,
      },
      chapters: [],
    };

    // Track lesson order per chapter for generating lesson codes
    let totalLessons = 0;
    let totalExercises = 0;
    let totalQuestions = 0;

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
          // Generate lesson code: MATH7-CH1-L1 format (L number is per chapter)
          const lessonCode = `MATH7-CH${chapter.order}-L${chapterLessonOrder}`;
          
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
    const outputPath = path.join(process.cwd(), 'output', 'grade7-math-curriculum.json');
    const outputDir = path.dirname(outputPath);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

    console.log(`\n✅ Successfully exported to: ${outputPath}`);
    console.log(`\n📊 Summary:`);
    console.log(`   - Grade: ${output.grade.name} (Level ${output.grade.level})`);
    console.log(`   - Subject: ${output.subject.name} (${output.subject.code})`);
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
getGrade7MathCurriculum()
  .catch((e) => {
    console.error('❌ Script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });


