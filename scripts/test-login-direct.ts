#!/usr/bin/env tsx
/**
 * Test Login Direct Script (without API)
 * 
 * This script tests login functionality directly with Prisma.
 * Usage: npx tsx scripts/test-login-direct.ts <username> <password>
 */

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';
import { verifyPassword, generateToken } from '../lib/auth';

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

// Parse connection string
const url = new URL(databaseUrl.replace(/^postgres:\/\//, 'https://'));
const poolConfig: any = {
  host: url.hostname,
  port: parseInt(url.port) || 5432,
  database: url.pathname.slice(1) || 'postgres',
  user: url.username,
  password: url.password,
};

if (databaseUrl.includes('supabase.com')) {
  poolConfig.ssl = {
    rejectUnauthorized: false,
    require: true,
  };
}

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
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});

async function testLoginDirect(username: string, password: string) {
  try {
    console.log('🔐 Testing login (direct)...\n');
    console.log(`Username: ${username}`);
    console.log(`Password: ${'*'.repeat(password.length)}\n`);

    // Find user
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      console.log('❌ User not found!');
      return false;
    }

    console.log('✅ User found:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Display Name: ${user.displayName || '(not set)'}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Active: ${user.isActive}\n`);

    // Check if user is active
    if (!user.isActive) {
      console.log('❌ Account is deactivated!');
      return false;
    }

    // Verify password
    console.log('🔑 Verifying password...');
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    
    if (!isValidPassword) {
      console.log('❌ Invalid password!');
      return false;
    }

    console.log('✅ Password verified!\n');

    // Generate token
    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    console.log('✅ Login successful!\n');
    console.log('Token generated:');
    console.log(`  ${token.substring(0, 50)}...\n`);
    console.log('User data:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Display Name: ${user.displayName || '(not set)'}`);
    console.log(`  Email: ${user.email || '(not set)'}`);
    console.log(`  Role: ${user.role}`);

    return true;
  } catch (error: any) {
    console.error('❌ Error during login test:');
    if (error instanceof Error) {
      console.error(`  Message: ${error.message}`);
      console.error(`  Stack: ${error.stack}`);
    } else {
      console.error('  Error:', error);
    }
    return false;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

// Get arguments from command line
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: npx tsx scripts/test-login-direct.ts <username> <password>');
  console.error('\nExample:');
  console.error('  npx tsx scripts/test-login-direct.ts nhahan nhahan@123');
  process.exit(1);
}

const [username, password] = args;

// Test login
testLoginDirect(username, password)
  .then((success) => {
    if (success) {
      console.log('\n🎉 Login test completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Login test failed');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  });

