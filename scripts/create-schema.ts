#!/usr/bin/env tsx
/**
 * Create Database Schema Script
 * 
 * This script automatically creates all database tables based on Prisma schema.
 * Usage: npx tsx scripts/create-schema.ts
 */

import { Pool } from 'pg';
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
  console.error('❌ Missing DATABASE_URL');
  process.exit(1);
}

if (databaseUrl.includes('supabase.com') && !databaseUrl.includes('sslmode')) {
  databaseUrl += (databaseUrl.includes('?') ? '&' : '?') + 'sslmode=require';
}

// Parse connection string to extract components
const url = new URL(databaseUrl.replace(/^postgres:\/\//, 'https://'));
const poolConfig: any = {
  host: url.hostname,
  port: parseInt(url.port) || 5432,
  database: url.pathname.slice(1) || 'postgres',
  user: url.username,
  password: url.password,
};

// Add SSL config for Supabase
if (databaseUrl.includes('supabase.com')) {
  poolConfig.ssl = {
    rejectUnauthorized: false,
    require: true,
  };
}

// Add query parameters
if (url.search) {
  const params = new URLSearchParams(url.search);
  if (params.get('sslmode') === 'require') {
    poolConfig.ssl = {
      rejectUnauthorized: false,
      require: true,
    };
  }
}

const pool = new Pool(poolConfig);

async function createSchema() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log('🔍 Checking database connection...');
    
    // Test connection
    await client.query('SELECT 1');
    console.log('✅ Database connection successful!\n');

    // Enable UUID extension if needed
    console.log('📦 Enabling UUID extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    console.log('✅ UUID extension enabled\n');

    // Create tables in order (respecting foreign key dependencies)
    const tables = [
      {
        name: 'users',
        sql: `
          CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            name VARCHAR(255) NOT NULL,
            display_name VARCHAR(255),
            role VARCHAR(50) DEFAULT 'student' NOT NULL,
            phone VARCHAR(50),
            parent_email VARCHAR(255),
            parent_phone VARCHAR(50),
            avatar_url TEXT,
            is_active BOOLEAN DEFAULT true NOT NULL,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
          )
        `,
      },
      {
        name: 'grades',
        sql: `
          CREATE TABLE IF NOT EXISTS grades (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            level INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
          )
        `,
      },
      {
        name: 'subjects',
        sql: `
          CREATE TABLE IF NOT EXISTS subjects (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            grade_id INTEGER NOT NULL REFERENCES grades(id),
            description TEXT,
            "order" INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
          )
        `,
      },
      {
        name: 'chapters',
        sql: `
          CREATE TABLE IF NOT EXISTS chapters (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            subject_id INTEGER NOT NULL REFERENCES subjects(id),
            description TEXT,
            "order" INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
          )
        `,
      },
      {
        name: 'sections',
        sql: `
          CREATE TABLE IF NOT EXISTS sections (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            chapter_id INTEGER NOT NULL REFERENCES chapters(id),
            description TEXT,
            "order" INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
          )
        `,
      },
      {
        name: 'lessons',
        sql: `
          CREATE TABLE IF NOT EXISTS lessons (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            section_id INTEGER NOT NULL REFERENCES sections(id),
            type VARCHAR(50) NOT NULL,
            media_url TEXT,
            attachments JSONB,
            "order" INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
          )
        `,
      },
      {
        name: 'exercises',
        sql: `
          CREATE TABLE IF NOT EXISTS exercises (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            section_id INTEGER NOT NULL REFERENCES sections(id),
            difficulty VARCHAR(50) NOT NULL,
            type VARCHAR(50) NOT NULL,
            points INTEGER DEFAULT 0,
            time_limit INTEGER,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
          )
        `,
      },
      {
        name: 'exercise_questions',
        sql: `
          CREATE TABLE IF NOT EXISTS exercise_questions (
            id SERIAL PRIMARY KEY,
            exercise_id INTEGER NOT NULL REFERENCES exercises(id),
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            options JSONB,
            "order" INTEGER DEFAULT 0,
            points INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
          )
        `,
      },
      {
        name: 'user_levels',
        sql: `
          CREATE TABLE IF NOT EXISTS user_levels (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            subject_id INTEGER NOT NULL REFERENCES subjects(id),
            level_score DECIMAL(5, 2) DEFAULT 0,
            total_exercises INTEGER DEFAULT 0,
            correct_exercises INTEGER DEFAULT 0,
            accuracy_rate DECIMAL(5, 2) DEFAULT 0,
            last_updated TIMESTAMP DEFAULT NOW(),
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            UNIQUE(user_id, subject_id)
          )
        `,
      },
      {
        name: 'classes',
        sql: `
          CREATE TABLE IF NOT EXISTS classes (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            grade_id INTEGER NOT NULL REFERENCES grades(id),
            subject_id INTEGER NOT NULL REFERENCES subjects(id),
            academic_year VARCHAR(50),
            description TEXT,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
          )
        `,
      },
      {
        name: 'class_students',
        sql: `
          CREATE TABLE IF NOT EXISTS class_students (
            id SERIAL PRIMARY KEY,
            class_id INTEGER NOT NULL REFERENCES classes(id),
            student_id INTEGER NOT NULL REFERENCES users(id),
            enrolled_at TIMESTAMP DEFAULT NOW(),
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            UNIQUE(class_id, student_id)
          )
        `,
      },
      {
        name: 'class_teachers',
        sql: `
          CREATE TABLE IF NOT EXISTS class_teachers (
            id SERIAL PRIMARY KEY,
            class_id INTEGER NOT NULL REFERENCES classes(id),
            teacher_id INTEGER NOT NULL REFERENCES users(id),
            is_main_teacher BOOLEAN DEFAULT false,
            assigned_at TIMESTAMP DEFAULT NOW(),
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            UNIQUE(class_id, teacher_id)
          )
        `,
      },
      {
        name: 'assignments',
        sql: `
          CREATE TABLE IF NOT EXISTS assignments (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            exercise_id INTEGER NOT NULL REFERENCES exercises(id),
            class_id INTEGER REFERENCES classes(id),
            user_id INTEGER REFERENCES users(id),
            assigned_by INTEGER NOT NULL REFERENCES users(id),
            deadline TIMESTAMP,
            min_score INTEGER,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
          )
        `,
      },
      {
        name: 'submissions',
        sql: `
          CREATE TABLE IF NOT EXISTS submissions (
            id SERIAL PRIMARY KEY,
            assignment_id INTEGER NOT NULL REFERENCES assignments(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            answers JSONB,
            images JSONB,
            ai_feedback TEXT,
            score DECIMAL(5, 2),
            status VARCHAR(50) DEFAULT 'pending',
            submitted_at TIMESTAMP,
            graded_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
          )
        `,
      },
      {
        name: 'conversation_configs',
        sql: `
          CREATE TABLE IF NOT EXISTS conversation_configs (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            system_prompt TEXT NOT NULL,
            response_format JSONB,
            metadata JSONB,
            is_default BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
          )
        `,
      },
      {
        name: 'conversations',
        sql: `
          CREATE TABLE IF NOT EXISTS conversations (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            submission_id INTEGER REFERENCES submissions(id),
            config_id INTEGER NOT NULL REFERENCES conversation_configs(id),
            type VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            status VARCHAR(50) DEFAULT 'active',
            metadata JSONB,
            last_message_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
          )
        `,
      },
      {
        name: 'messages',
        sql: `
          CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,
            conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            role VARCHAR(50) NOT NULL,
            content TEXT NOT NULL,
            metadata JSONB,
            "order" INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL
          )
        `,
      },
      {
        name: 'notifications',
        sql: `
          CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            type VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            channel VARCHAR(50),
            is_sent BOOLEAN DEFAULT false,
            sent_at TIMESTAMP,
            scheduled_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL
          )
        `,
      },
    ];

    console.log('📝 Creating tables...\n');

    for (const table of tables) {
      try {
        // Check if table exists (case-insensitive)
        const tableCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND LOWER(table_name) = LOWER($1)
          )
        `, [table.name]);

        if (tableCheck.rows[0].exists) {
          console.log(`⏭️  Table "${table.name}" already exists, skipping...`);
        } else {
          await client.query(table.sql);
          console.log(`✅ Table "${table.name}" created successfully`);
        }
      } catch (error: any) {
        // If error is about table already exists, skip it
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log(`⏭️  Table "${table.name}" already exists (detected via error), skipping...`);
        } else {
          console.error(`❌ Error creating table "${table.name}":`, error.message);
          throw error;
        }
      }
    }

    // Create indexes
    console.log('\n📊 Creating indexes...\n');

    const indexes = [
      {
        name: 'idx_users_username',
        sql: 'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
      },
      {
        name: 'idx_submissions_user_id',
        sql: 'CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id)',
      },
      {
        name: 'idx_submissions_assignment_id',
        sql: 'CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON submissions(assignment_id)',
      },
      {
        name: 'idx_messages_conversation_id_order',
        sql: 'CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_order ON messages(conversation_id, "order")',
      },
      {
        name: 'idx_notifications_user_id',
        sql: 'CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)',
      },
    ];

    for (const index of indexes) {
      try {
        await client.query(index.sql);
        console.log(`✅ Index "${index.name}" created`);
      } catch (error: any) {
        console.error(`❌ Error creating index "${index.name}":`, error.message);
        // Don't throw, indexes are optional
      }
    }

    await client.query('COMMIT');

    console.log('\n🎉 Schema created successfully!');
    console.log(`✅ Created ${tables.length} tables`);
    console.log(`✅ Created ${indexes.length} indexes\n`);

    // Show table list
    const tableList = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log('📋 Tables in database:');
    tableList.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.table_name}`);
    });

  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\n❌ Error creating schema:');
    if (error instanceof Error) {
      console.error(`  Message: ${error.message}`);
      console.error(`  Stack: ${error.stack}`);
    } else {
      console.error('  Error:', error);
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
createSchema()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error: any) => {
    console.error('\n❌ Failed to create schema');
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  });

