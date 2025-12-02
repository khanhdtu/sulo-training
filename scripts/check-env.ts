#!/usr/bin/env tsx
/**
 * Environment Variables Check Script
 * 
 * This script checks if all required environment variables are set.
 * Usage: npm run env:check
 */

import * as fs from 'fs';
import * as path from 'path';

// Load .env file manually (since tsx doesn't auto-load it)
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([A-Z_]+)=(.+)$/);
        if (match) {
          const key = match[1];
          let value = match[2];
          // Remove quotes if present
          value = value.replace(/^["']|["']$/g, '');
          // Only set if not already in process.env
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
  }
}

// Load .env file before checking
loadEnvFile();

// Required environment variables based on codebase
const requiredEnvVars = {
  // Database (support multiple formats)
  DATABASE_URL: {
    required: false,
    description: 'PostgreSQL connection string (fallback if POSTGRES_PRISMA_URL not set)',
    example: 'postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres',
  },
  POSTGRES_PRISMA_URL: {
    required: false,
    description: 'PostgreSQL Prisma connection string (from Supabase, preferred)',
    example: 'postgres://postgres.[PROJECT]:[PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true',
  },
  POSTGRES_URL_NON_POOLING: {
    required: false,
    description: 'PostgreSQL non-pooling connection string (from Supabase)',
    example: 'postgres://postgres.[PROJECT]:[PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require',
  },
  
  // Supabase (support multiple formats)
  NEXT_PUBLIC_SUPABASE_URL: {
    required: false,
    description: 'Supabase project URL (preferred for client-side)',
    example: 'https://your-project.supabase.co',
  },
  SUPABASE_URL: {
    required: false,
    description: 'Supabase project URL (fallback if NEXT_PUBLIC_SUPABASE_URL not set)',
    example: 'https://your-project.supabase.co',
  },
  NEXT_PUBLIC_SUPABASE_ANON_KEY: {
    required: false,
    description: 'Supabase anonymous key (preferred for client-side)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  },
  SUPABASE_ANON_KEY: {
    required: false,
    description: 'Supabase anonymous key (fallback if NEXT_PUBLIC_SUPABASE_ANON_KEY not set)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    required: true,
    description: 'Supabase service role key (admin access)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  },
  
  // Authentication (support multiple formats)
  JWT_SECRET: {
    required: false,
    description: 'Secret key for JWT tokens (preferred)',
    example: 'your-super-secret-jwt-key-change-in-production',
    generate: 'openssl rand -base64 32',
  },
  SUPABASE_JWT_SECRET: {
    required: false,
    description: 'Supabase JWT secret (fallback if JWT_SECRET not set)',
    example: 'H2QyEJi8KOSH2xrD2sgY2sN6MwOzYxVllvqnCdNW2SVyYUSgoXCB1NJhoyrcxob3D0pdkgnBgwOu5s+jSn4ZIw==',
  },
  
  // OpenAI
  OPENAI_API_KEY: {
    required: true,
    description: 'OpenAI API key for essay grading',
    example: 'sk-proj-...',
  },
  
  // Email (Resend)
  RESEND_API_KEY: {
    required: true,
    description: 'Resend API key for sending emails',
    example: 're_...',
  },
  RESEND_FROM_EMAIL: {
    required: true,
    description: 'Email address to send from (must be verified in Resend)',
    example: 'noreply@yourdomain.com',
  },
  
  // Cron Jobs
  CRON_SECRET: {
    required: true,
    description: 'Secret key for cron job authentication',
    example: 'your-cron-secret-key',
    generate: 'openssl rand -base64 32',
  },
  
  // App
  NEXT_PUBLIC_APP_URL: {
    required: false,
    description: 'Application URL (for development)',
    example: 'http://localhost:3000',
    default: 'http://localhost:3000',
  },
};

function checkEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), '.env.example');
  const envExampleTxtPath = path.join(process.cwd(), 'env.example.txt');
  
  console.log('🔍 Checking environment variables...\n');
  
  // Check if .env file exists
  if (!fs.existsSync(envPath)) {
    console.log('⚠️  .env file not found!\n');
    console.log('💡 Create .env file by copying from example:');
    if (fs.existsSync(envExamplePath)) {
      console.log(`   cp .env.example .env`);
    } else if (fs.existsSync(envExampleTxtPath)) {
      console.log(`   cp env.example.txt .env`);
    }
    console.log('');
  }
  
  // Read .env.example if exists
  let exampleContent = '';
  if (fs.existsSync(envExamplePath)) {
    exampleContent = fs.readFileSync(envExamplePath, 'utf-8');
  } else if (fs.existsSync(envExampleTxtPath)) {
    exampleContent = fs.readFileSync(envExampleTxtPath, 'utf-8');
  }
  
  // Parse example file
  const exampleVars: Record<string, string> = {};
  if (exampleContent) {
    exampleContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([A-Z_]+)=(.+)$/);
        if (match) {
          const key = match[1];
          const value = match[2].replace(/^["']|["']$/g, '');
          exampleVars[key] = value;
        }
      }
    });
  }
  
  // Check required variables
  console.log('📋 Required Environment Variables:\n');
  
  let allPresent = true;
  let missingRequired: string[] = [];
  let missingOptional: string[] = [];
  let extraInExample: string[] = [];
  
  // Check database URL (at least one must be set)
  const hasDatabaseUrl = 
    process.env.DATABASE_URL || 
    process.env.POSTGRES_PRISMA_URL || 
    process.env.POSTGRES_URL_NON_POOLING;
  
  if (!hasDatabaseUrl) {
    console.log('❌ DATABASE_URL / POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING MISSING');
    console.log('   At least one database URL must be set!\n');
    missingRequired.push('DATABASE_URL');
    allPresent = false;
  }
  
  // Check Supabase URL (at least one must be set)
  const hasSupabaseUrl = 
    process.env.NEXT_PUBLIC_SUPABASE_URL || 
    process.env.SUPABASE_URL;
  
  if (!hasSupabaseUrl) {
    console.log('❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL MISSING');
    console.log('   At least one Supabase URL must be set!\n');
    missingRequired.push('SUPABASE_URL');
    allPresent = false;
  }
  
  // Check Supabase Anon Key (at least one must be set)
  const hasSupabaseAnonKey = 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
    process.env.SUPABASE_ANON_KEY;
  
  if (!hasSupabaseAnonKey) {
    console.log('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY MISSING');
    console.log('   At least one Supabase Anon Key must be set!\n');
    missingRequired.push('SUPABASE_ANON_KEY');
    allPresent = false;
  }
  
  // Check each variable
  for (const [key, config] of Object.entries(requiredEnvVars)) {
    const isInExample = key in exampleVars;
    const isInEnv = key in process.env;
    const isRequired = config.required;
    
    // Skip if it's a fallback variable and primary is set
    if (key === 'SUPABASE_URL' && process.env.NEXT_PUBLIC_SUPABASE_URL) continue;
    if (key === 'SUPABASE_ANON_KEY' && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) continue;
    if (key === 'DATABASE_URL' && (process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING)) continue;
    if (key === 'SUPABASE_JWT_SECRET' && process.env.JWT_SECRET) continue;
    
    const status = isInEnv ? '✅' : (isRequired ? '❌' : '⚠️ ');
    const statusText = isInEnv 
      ? 'Set' 
      : (isRequired ? 'MISSING' : 'Optional');
    
    console.log(`${status} ${key.padEnd(35)} ${statusText}`);
    
    if (!isInEnv && isRequired) {
      missingRequired.push(key);
      allPresent = false;
    } else if (!isInEnv && !isRequired) {
      missingOptional.push(key);
    }
    
    if (!isInExample && isInEnv) {
      extraInExample.push(key);
    }
    
    if (!isInEnv) {
      console.log(`   Description: ${config.description}`);
      if (config.example) {
        console.log(`   Example: ${config.example}`);
      }
      if (config.generate) {
        console.log(`   Generate: ${config.generate}`);
      }
      if (config.default) {
        console.log(`   Default: ${config.default}`);
      }
      console.log('');
    }
  }
  
  // Check for extra variables in example file
  if (exampleContent) {
    console.log('\n📝 Variables in .env.example:\n');
    for (const key of Object.keys(exampleVars)) {
      if (!(key in requiredEnvVars)) {
        console.log(`⚠️  ${key.padEnd(35)} Not used in codebase`);
        extraInExample.push(key);
      }
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:\n');
  
  if (allPresent && missingRequired.length === 0) {
    console.log('✅ All required environment variables are set!');
  } else {
    if (missingRequired.length > 0) {
      console.log(`❌ Missing ${missingRequired.length} required variable(s):`);
      missingRequired.forEach((key) => {
        console.log(`   - ${key}`);
      });
      console.log('');
    }
    
    if (missingOptional.length > 0) {
      console.log(`⚠️  Missing ${missingOptional.length} optional variable(s):`);
      missingOptional.forEach((key) => {
        console.log(`   - ${key}`);
      });
      console.log('');
    }
  }
  
  if (extraInExample.length > 0) {
    console.log(`ℹ️  Found ${extraInExample.length} variable(s) in example file:`);
    extraInExample.forEach((key) => {
      if (key in requiredEnvVars) {
        console.log(`   - ${key} (should be in .env.example)`);
      } else {
        console.log(`   - ${key} (not used in codebase, can be removed)`);
      }
    });
    console.log('');
  }
  
  // Recommendations
  if (!allPresent) {
    console.log('💡 Recommendations:\n');
    console.log('1. Copy .env.example to .env:');
    console.log('   cp .env.example .env');
    console.log('');
    console.log('2. Fill in all required values in .env file');
    console.log('');
    console.log('3. Generate secrets:');
    console.log('   JWT_SECRET: openssl rand -base64 32');
    console.log('   CRON_SECRET: openssl rand -base64 32');
    console.log('');
  }
  
  return allPresent;
}

// Run check
const success = checkEnvFile();
process.exit(success ? 0 : 1);

