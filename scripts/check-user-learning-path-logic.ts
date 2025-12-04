#!/usr/bin/env tsx
/**
 * Check User Learning Path Logic Script
 * 
 * This script checks if the database logic matches the requirements:
 * 1. When user updates profile (grade + level), system should create learning path
 * 2. Assign gradeId + level to learning path
 * 3. Only show exercises matching user's level
 * 
 * Usage: tsx scripts/check-user-learning-path-logic.ts
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

/**
 * Map user level to exercise difficulty
 * Level 1-4: easy
 * Level 5-8: medium
 * Level 9-12: hard
 */
function mapLevelToDifficulty(level: number): string {
  if (level >= 1 && level <= 4) return 'easy';
  if (level >= 5 && level <= 8) return 'medium';
  if (level >= 9 && level <= 12) return 'hard';
  return 'easy'; // default
}

async function checkUserLearningPathLogic() {
  console.log('🔍 Checking User Learning Path Logic...\n');

  const issues: string[] = [];
  const recommendations: string[] = [];

  try {
    // 1. Check if update-profile API creates learning path
    console.log('1️⃣  Checking update-profile API logic...');
    const updateProfilePath = 'app/api/user/update-profile/route.ts';
    if (fs.existsSync(updateProfilePath)) {
      const content = fs.readFileSync(updateProfilePath, 'utf-8');
      
      // Check if it creates UserLevel records
      if (!content.includes('userLevel') && !content.includes('UserLevel')) {
        issues.push('❌ update-profile API does NOT create UserLevel records');
        recommendations.push('Add logic to create UserLevel for each subject in user\'s grade');
      } else {
        console.log('   ✅ update-profile API may create UserLevel records');
      }

      // Check if it creates progress records
      if (!content.includes('UserChapterProgress') && !content.includes('UserSectionProgress')) {
        issues.push('❌ update-profile API does NOT create progress records (UserChapterProgress, UserSectionProgress)');
        recommendations.push('Add logic to initialize progress records when user updates profile');
      } else {
        console.log('   ✅ update-profile API may create progress records');
      }
    } else {
      issues.push('❌ update-profile API file not found');
    }

    // 2. Check if subjects API filters exercises by level
    console.log('\n2️⃣  Checking subjects API filter logic...');
    const subjectsPath = 'app/api/subjects/[id]/route.ts';
    if (fs.existsSync(subjectsPath)) {
      const content = fs.readFileSync(subjectsPath, 'utf-8');
      
      // Check if it filters exercises by difficulty/level
      if (!content.includes('difficulty') || !content.includes('where')) {
        issues.push('❌ subjects API does NOT filter exercises by user level/difficulty');
        recommendations.push('Add filter to only show exercises matching user\'s level (map level to difficulty)');
      } else {
        // Check if it actually uses user.level
        if (!content.includes('user.level') && !content.includes('user?.level')) {
          issues.push('❌ subjects API does NOT use user.level to filter exercises');
          recommendations.push('Filter exercises: difficulty === mapLevelToDifficulty(user.level)');
        } else {
          console.log('   ✅ subjects API may filter exercises by level');
        }
      }
    } else {
      issues.push('❌ subjects API file not found');
    }

    // 3. Check if level-to-difficulty mapping exists
    console.log('\n3️⃣  Checking level-to-difficulty mapping...');
    const libFiles = fs.readdirSync('lib').filter(f => f.endsWith('.ts'));
    let hasMapping = false;
    
    for (const file of libFiles) {
      const content = fs.readFileSync(`lib/${file}`, 'utf-8');
      if (content.includes('mapLevelToDifficulty') || content.includes('levelToDifficulty')) {
        hasMapping = true;
        console.log(`   ✅ Found mapping function in lib/${file}`);
        break;
      }
    }

    if (!hasMapping) {
      issues.push('❌ No level-to-difficulty mapping function found');
      recommendations.push('Create helper function: mapLevelToDifficulty(level: number): "easy" | "medium" | "hard"');
    }

    // 4. Check database schema
    console.log('\n4️⃣  Checking database schema...');
    
    // Check User model has level field
    try {
      const result = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
        AND column_name = 'level';
      `);
      if (result.rows.length > 0) {
        console.log('   ✅ User model has level field');
      } else {
        issues.push('❌ User model does NOT have level field');
      }
    } catch (error) {
      issues.push('❌ Could not check User.level field');
    }

    // Check Exercise model has difficulty field
    try {
      const result = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'exercises'
        AND column_name = 'difficulty';
      `);
      if (result.rows.length > 0) {
        console.log('   ✅ Exercise model has difficulty field');
      } else {
        issues.push('❌ Exercise model does NOT have difficulty field');
      }
    } catch (error) {
      issues.push('❌ Could not check Exercise.difficulty field');
    }

    // Summary
    console.log('\n📊 Summary:');
    if (issues.length === 0) {
      console.log('✅ All checks passed! Database logic matches requirements.');
    } else {
      console.log(`⚠️  Found ${issues.length} issue(s):\n`);
      issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });

      if (recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        recommendations.forEach((rec, index) => {
          console.log(`   ${index + 1}. ${rec}`);
        });
      }
    }

    return { hasIssues: issues.length > 0, issues, recommendations };

  } catch (error) {
    console.error('❌ Error checking logic:', error);
    throw error;
  }
}

// Main execution
checkUserLearningPathLogic()
  .then((result) => {
    if (result.hasIssues) {
      console.log('\n❌ Database logic needs updates to match requirements.');
      process.exit(1);
    } else {
      console.log('\n✅ Database logic matches requirements!');
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

