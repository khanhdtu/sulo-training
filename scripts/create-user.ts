#!/usr/bin/env tsx
/**
 * Create User Script
 * 
 * This script creates a new user in the database.
 * Usage: tsx scripts/create-user.ts <username> <password> <displayName> [role]
 */

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
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
  console.error('❌ Missing DATABASE_URL. Please set one of: POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING, or DATABASE_URL');
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

async function createUser(
  username: string,
  password: string,
  displayName: string,
  role: string = 'student'
) {
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      console.error(`❌ User with username "${username}" already exists!`);
      process.exit(1);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        name: displayName, // Use displayName as name
        displayName, // Set displayName
        role,
      },
      select: {
        id: true,
        username: true,
        name: true,
        displayName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    console.log('✅ User created successfully!');
    console.log('\nUser Details:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Display Name: ${user.displayName || '(not set)'}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Active: ${user.isActive}`);
    console.log(`  Created At: ${user.createdAt}`);

    return user;
  } catch (error) {
    console.error('❌ Error creating user:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get arguments from command line
const args = process.argv.slice(2);

if (args.length < 3) {
  console.error('Usage: tsx scripts/create-user.ts <username> <password> <displayName> [role]');
  console.error('\nExample:');
  console.error('  tsx scripts/create-user.ts nhahan nhahan@123 "Trần Nhã Hân" student');
  process.exit(1);
}

const [username, password, displayName, role = 'student'] = args;

// Validate role
const validRoles = ['admin', 'teacher', 'student', 'parent'];
if (!validRoles.includes(role)) {
  console.error(`❌ Invalid role: ${role}`);
  console.error(`Valid roles: ${validRoles.join(', ')}`);
  process.exit(1);
}

// Create user
createUser(username, password, displayName, role)
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed to create user');
    process.exit(1);
  });

