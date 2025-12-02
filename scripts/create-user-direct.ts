#!/usr/bin/env tsx
/**
 * Create User Script (Direct SQL approach)
 * 
 * This script creates a new user using direct SQL to avoid SSL issues.
 * Usage: npx tsx scripts/create-user-direct.ts
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import bcrypt from 'bcryptjs';

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

async function createUser(
  username: string,
  password: string,
  displayName: string,
  role: string = 'student'
) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Check if column exists, if not add it
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'display_name'
    `);

    if (columnCheck.rows.length === 0) {
      console.log('📝 Adding display_name column...');
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN display_name VARCHAR(255) NULL
      `);
      console.log('✅ Column display_name added!');
    } else {
      console.log('✅ Column display_name already exists');
    }

    // Check if user exists
    const userCheck = await client.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (userCheck.rows.length > 0) {
      console.error(`❌ User with username "${username}" already exists!`);
      await client.query('ROLLBACK');
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await client.query(
      `INSERT INTO users (
        username, 
        password_hash, 
        name, 
        display_name, 
        role, 
        is_active,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, username, name, display_name, role, is_active, created_at`,
      [username, passwordHash, displayName, displayName, role, true]
    );

    await client.query('COMMIT');

    const user = result.rows[0];
    console.log('✅ User created successfully!');
    console.log('\nUser Details:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Display Name: ${user.display_name || '(not set)'}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Active: ${user.is_active}`);
    console.log(`  Created At: ${user.created_at}`);

    return user;
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Error creating user:');
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

// Create user
createUser('nhahan', 'nhahan@123', 'Trần Nhã Hân', 'student')
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error: any) => {
    console.error('\n❌ Failed to create user');
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  });

