import { defineConfig, env } from 'prisma/config';
import { config } from 'dotenv';

// Load .env file
config();

export default defineConfig({
  datasource: {
    // Use non-pooling connection for CLI commands (db push, migrate, etc.)
    // Pooler connection (POSTGRES_PRISMA_URL) is for runtime use only
    url: env('POSTGRES_URL_NON_POOLING') || env('DATABASE_URL') || env('POSTGRES_PRISMA_URL'),
  },
});

