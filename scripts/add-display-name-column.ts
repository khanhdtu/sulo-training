#!/usr/bin/env tsx
/**
 * Add display_name column to users table
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
  console.error('❌ Missing DATABASE_URL');
  process.exit(1);
}

if (databaseUrl.includes('supabase.com') && !databaseUrl.includes('sslmode')) {
  databaseUrl += (databaseUrl.includes('?') ? '&' : '?') + 'sslmode=require';
}

const poolConfig: any = {
  connectionString: databaseUrl,
};

if (databaseUrl.includes('supabase.com')) {
  poolConfig.ssl = {
    rejectUnauthorized: false,
  };
}

const pool = new Pool(poolConfig);
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});

async function addDisplayNameColumn() {
  try {
    console.log('🔍 Checking if display_name column exists...');
    
    // Check if column exists
    const result = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'display_name'
    `;

    if (result.length > 0) {
      console.log('✅ Column display_name already exists!');
      return;
    }

    console.log('📝 Adding display_name column...');
    
    // Add column
    await prisma.$executeRaw`
      ALTER TABLE users 
      ADD COLUMN display_name VARCHAR(255) NULL
    `;

    console.log('✅ Column display_name added successfully!');
  } catch (error) {
    console.error('❌ Error adding column:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addDisplayNameColumn()
  .then(() => {
    console.log('🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed');
    process.exit(1);
  });

