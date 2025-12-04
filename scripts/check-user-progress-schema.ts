#!/usr/bin/env tsx
/**
 * Check User Progress Schema Script
 * 
 * This script checks if the database schema supports individual user progress tracking
 * for all levels: lesson, exercise, section, chapter, and subject.
 * 
 * Usage: tsx scripts/check-user-progress-schema.ts
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

async function checkUserProgressSchema() {
  console.log('🔍 Checking User Progress Schema...\n');

  const checks = {
    lessonProgress: false,
    exerciseProgress: false,
    sectionProgress: false,
    chapterProgress: false,
    subjectProgress: false,
  };

  try {
    // Check if UserLessonProgress table exists
    try {
      const lessonProgressCount = await prisma.userLessonProgress.count();
      console.log('✅ UserLessonProgress: EXISTS');
      console.log(`   - Records: ${lessonProgressCount}`);
      checks.lessonProgress = true;
    } catch (error) {
      console.log('❌ UserLessonProgress: NOT FOUND');
    }

    // Check if UserExerciseAttempt table exists
    try {
      const exerciseAttemptCount = await prisma.userExerciseAttempt.count();
      console.log('✅ UserExerciseAttempt: EXISTS');
      console.log(`   - Records: ${exerciseAttemptCount}`);
      checks.exerciseProgress = true;
    } catch (error) {
      console.log('❌ UserExerciseAttempt: NOT FOUND');
    }

    // Check if UserSectionProgress table exists
    try {
      // Try to query using raw SQL to check if table exists
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'user_section_progress'
        );
      `);
      if (result.rows[0].exists) {
        console.log('✅ UserSectionProgress: EXISTS');
        checks.sectionProgress = true;
      } else {
        console.log('❌ UserSectionProgress: NOT FOUND');
      }
    } catch (error) {
      console.log('❌ UserSectionProgress: NOT FOUND');
    }

    // Check if UserChapterProgress table exists
    try {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'user_chapter_progress'
        );
      `);
      if (result.rows[0].exists) {
        console.log('✅ UserChapterProgress: EXISTS');
        checks.chapterProgress = true;
      } else {
        console.log('❌ UserChapterProgress: NOT FOUND');
      }
    } catch (error) {
      console.log('❌ UserChapterProgress: NOT FOUND');
    }

    // Check if UserSubjectProgress table exists (or if UserLevel can be used)
    try {
      const userLevelCount = await prisma.userLevel.count();
      console.log('✅ UserLevel: EXISTS (can track subject-level stats)');
      console.log(`   - Records: ${userLevelCount}`);
      // Check if UserLevel has progress field
      const result = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_levels'
        AND column_name = 'progress';
      `);
      if (result.rows.length > 0) {
        console.log('   - Has progress field: YES');
        checks.subjectProgress = true;
      } else {
        console.log('   - Has progress field: NO (only has levelScore, accuracyRate)');
        checks.subjectProgress = false;
      }
    } catch (error) {
      console.log('❌ UserLevel: NOT FOUND');
    }

    console.log('\n📊 Summary:');
    console.log(`   - Lesson Progress: ${checks.lessonProgress ? '✅' : '❌'}`);
    console.log(`   - Exercise Progress: ${checks.exerciseProgress ? '✅' : '❌'}`);
    console.log(`   - Section Progress: ${checks.sectionProgress ? '✅' : '❌'}`);
    console.log(`   - Chapter Progress: ${checks.chapterProgress ? '✅' : '❌'}`);
    console.log(`   - Subject Progress: ${checks.subjectProgress ? '✅' : '❌'}`);

    const allChecks = Object.values(checks).every(v => v === true);
    
    if (allChecks) {
      console.log('\n✅ Database schema fully supports individual user progress tracking!');
      return { needsUpdate: false, checks };
    } else {
      console.log('\n⚠️  Database schema needs updates to fully support individual user progress tracking.');
      console.log('\nMissing components:');
      if (!checks.sectionProgress) {
        console.log('   - UserSectionProgress model');
      }
      if (!checks.chapterProgress) {
        console.log('   - UserChapterProgress model');
      }
      if (!checks.subjectProgress) {
        console.log('   - UserSubjectProgress model or progress field in UserLevel');
      }
      return { needsUpdate: true, checks };
    }

  } catch (error) {
    console.error('❌ Error checking schema:', error);
    throw error;
  }
}

// Main execution
checkUserProgressSchema()
  .then((result) => {
    if (result.needsUpdate) {
      console.log('\n💡 Recommendation: Update schema to add missing progress tracking models.');
      process.exit(1);
    } else {
      process.exit(0);
    }
  })
  .catch((e) => {
    console.error('❌ Script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

