import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Support multiple DATABASE_URL formats from Supabase
// Priority: POSTGRES_PRISMA_URL > POSTGRES_URL_NON_POOLING > DATABASE_URL
let databaseUrl = 
  process.env.POSTGRES_PRISMA_URL || 
  process.env.POSTGRES_URL_NON_POOLING || 
  process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'Missing DATABASE_URL. Please set one of: POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING, or DATABASE_URL'
  );
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

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

