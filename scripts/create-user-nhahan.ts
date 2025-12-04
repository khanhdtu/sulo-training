#!/usr/bin/env tsx
/**
 * Create User: nhahan
 * 
 * This script creates a user with:
 * - Username: nhahan
 * - Password: nhahan@123
 */

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import bcrypt from 'bcryptjs';

// Load .env file
config();

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
if (databaseUrl.includes('supabase.com') || process.env.NODE_ENV === 'development' || process.env.ALLOW_INSECURE_DB_SSL === 'true') {
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

async function createUserNhahan() {
  const username = 'nhahan';
  const password = 'nhahan@123';
  const displayName = 'Nhã Hân';

  try {
    console.log('🔍 Checking if user already exists...');
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      console.log(`⚠️  User with username "${username}" already exists!`);
      console.log('\nExisting User Details:');
      console.log(`  ID: ${existingUser.id}`);
      console.log(`  Username: ${existingUser.username}`);
      console.log(`  Name: ${existingUser.name}`);
      console.log(`  Display Name: ${existingUser.displayName || '(not set)'}`);
      console.log(`  Role: ${existingUser.role}`);
      console.log(`  Active: ${existingUser.isActive}`);
      console.log(`  Created At: ${existingUser.createdAt}`);
      
      // Ask if user wants to update password
      console.log('\n💡 To update password, delete the user first or use a different script.');
      await prisma.$disconnect();
      process.exit(0);
    }

    console.log('🔐 Hashing password...');
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    console.log('👤 Creating user...');
    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        name: displayName,
        displayName,
        role: 'student',
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

    console.log('\n✅ User created successfully!');
    console.log('\n📋 User Details:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Display Name: ${user.displayName || '(not set)'}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Active: ${user.isActive}`);
    console.log(`  Created At: ${user.createdAt}`);
    console.log('\n🔑 Login Credentials:');
    console.log(`  Username: ${username}`);
    console.log(`  Password: ${password}`);

    return user;
  } catch (error) {
    console.error('❌ Error creating user:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Create user
createUserNhahan()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed to create user');
    process.exit(1);
  });

