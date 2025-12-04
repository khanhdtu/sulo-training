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
// Parse connection string to handle SSL properly
const poolConfig: any = {
  connectionString: databaseUrl,
};

// Configure SSL for connections that require it.
// - For Supabase, always enable SSL and allow self-signed certificates.
// - For local/dev or custom hosts with self-signed certs, you can force this
//   behavior by setting ALLOW_INSECURE_DB_SSL=true in your .env file.
const shouldAllowInsecureSsl =
  databaseUrl.includes('supabase.com') ||
  process.env.ALLOW_INSECURE_DB_SSL === 'true' ||
  process.env.NODE_ENV === 'development';

if (shouldAllowInsecureSsl) {
  // NOTE: This is intended for development and trusted environments only.
  // Do not use rejectUnauthorized: false in production with untrusted networks.
  poolConfig.ssl = {
    rejectUnauthorized: false,
  };

  // Prisma's underlying engine may also open TLS connections based on
  // DATABASE_URL, so we additionally relax global TLS verification when
  // explicitly allowed. This should never be enabled in production.
  if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }
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

