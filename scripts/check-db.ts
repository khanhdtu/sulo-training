#!/usr/bin/env tsx
/**
 * Database Connection Check Script
 * 
 * This script checks the database connection and displays connection status.
 * Usage: npm run db:check
 */

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';

// Load .env file manually
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([A-Z_]+)=(.+)$/);
        if (match) {
          const key = match[1];
          let value = match[2];
          value = value.replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
  }
}

loadEnvFile();

// Support multiple DATABASE_URL formats
let databaseUrl = 
  process.env.POSTGRES_PRISMA_URL || 
  process.env.POSTGRES_URL_NON_POOLING || 
  process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Missing DATABASE_URL. Please set one of: POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING, or DATABASE_URL');
  process.exit(1);
}

// Ensure SSL is properly configured for Supabase
if (databaseUrl.includes('supabase.com') && !databaseUrl.includes('sslmode')) {
  databaseUrl += (databaseUrl.includes('?') ? '&' : '?') + 'sslmode=require';
}

// Create PostgreSQL connection pool
// Parse connection string to handle SSL properly for Supabase
const poolConfig: any = {
  connectionString: databaseUrl,
};

// Configure SSL for Supabase connections (always enable SSL for Supabase)
if (databaseUrl.includes('supabase.com')) {
  // Force SSL configuration for Supabase
  poolConfig.ssl = {
    rejectUnauthorized: false, // Allow self-signed certificates (for Supabase)
  };
}

const pool = new Pool(poolConfig);

// Create Prisma adapter
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});

async function checkDatabaseConnection() {
  console.log('🔍 Checking database connection...\n');

  try {
    // Test 1: Basic connection
    console.log('📡 Test 1: Basic Connection');
    await prisma.$connect();
    console.log('✅ Database connection successful!\n');

    // Test 2: Query test
    console.log('📊 Test 2: Query Test');
    const userCount = await prisma.user.count();
    console.log(`✅ Query successful! Found ${userCount} user(s) in database.\n`);

    // Test 3: Check tables exist
    console.log('🗄️  Test 3: Tables Check');
    const tables = [
      'User',
      'Grade',
      'Subject',
      'Chapter',
      'Section',
      'Lesson',
      'Exercise',
      'ExerciseQuestion',
      'Assignment',
      'Submission',
      'Conversation',
      'Message',
      'ConversationConfig',
      'Notification',
      'UserLevel',
      'Class',
      'ClassStudent',
      'ClassTeacher',
    ];

    const tableStatus: Record<string, boolean> = {};
    
    for (const table of tables) {
      try {
        // Try to query each table
        const model = (prisma as any)[table.toLowerCase()];
        if (model) {
          await model.count();
          tableStatus[table] = true;
        } else {
          tableStatus[table] = false;
        }
      } catch (error) {
        tableStatus[table] = false;
      }
    }

    console.log('Table Status:');
    for (const [table, exists] of Object.entries(tableStatus)) {
      console.log(`  ${exists ? '✅' : '❌'} ${table}`);
    }
    console.log('');

    // Test 4: Database info
    console.log('ℹ️  Test 4: Database Info');
    const dbInfo = await prisma.$queryRaw<Array<{ current_database: string }>>`
      SELECT current_database();
    `;
    console.log(`✅ Database: ${dbInfo[0]?.current_database || 'Unknown'}\n`);

    // Test 5: Connection pool
    console.log('🔌 Test 5: Connection Pool');
    const startTime = Date.now();
    await Promise.all([
      prisma.user.count(),
      prisma.grade.count(),
      prisma.subject.count(),
    ]);
    const endTime = Date.now();
    console.log(`✅ Concurrent queries successful! (${endTime - startTime}ms)\n`);

    console.log('🎉 All database checks passed!');
    console.log('✅ Database is ready to use.\n');

    return true;
  } catch (error) {
    console.error('❌ Database connection failed!\n');
    console.error('Error details:');
    
    if (error instanceof Error) {
      console.error(`  Message: ${error.message}`);
      console.error(`  Name: ${error.name}`);
      
      // Check for common connection errors
      if (error.message.includes('P1001')) {
        console.error('\n💡 Tip: Cannot reach database server.');
        console.error('   - Check if DATABASE_URL/POSTGRES_PRISMA_URL/POSTGRES_URL_NON_POOLING is correct in .env file');
        console.error('   - Check if database server is running');
        console.error('   - Check network/firewall settings');
      } else if (error.message.includes('P1000')) {
        console.error('\n💡 Tip: Authentication failed.');
        console.error('   - Check database credentials in DATABASE_URL');
        console.error('   - Verify username and password are correct');
      } else if (error.message.includes('P1003')) {
        console.error('\n💡 Tip: Database does not exist.');
        console.error('   - Create the database first');
        console.error('   - Or update DATABASE_URL with correct database name');
      } else if (error.message.includes('P1017')) {
        console.error('\n💡 Tip: Server closed the connection.');
        console.error('   - Database server might be restarting');
        console.error('   - Check database server logs');
      }
    } else {
      console.error('  Unknown error:', error);
    }
    
    console.error('\n');
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkDatabaseConnection()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });

