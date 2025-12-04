import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';

// Load .env file
config();

// Support multiple DATABASE_URL formats
let databaseUrl =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error(
    '❌ Missing DATABASE_URL. Please set one of: POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING, or DATABASE_URL'
  );
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
const shouldAllowInsecureSsl =
  databaseUrl.includes('supabase.com') ||
  process.env.ALLOW_INSECURE_DB_SSL === 'true' ||
  process.env.NODE_ENV === 'development';

if (shouldAllowInsecureSsl) {
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

async function clearDatabase() {
  console.log('🗑️  Starting database cleanup...\n');

  try {
    // Helper function to safely delete
    async function safeDelete(modelName: string, deleteFn: () => Promise<any>) {
      try {
        await deleteFn();
        console.log(`  ✓ ${modelName} deleted`);
      } catch (error: any) {
        if (error.code === 'P2021' || error.message?.includes('does not exist')) {
          console.log(`  ⚠️  ${modelName} table does not exist, skipping...`);
        } else {
          throw error;
        }
      }
    }

    // Delete in order to respect foreign key constraints
    await safeDelete('Messages', () => prisma.message.deleteMany({}));
    await safeDelete('Conversations', () => prisma.conversation.deleteMany({}));
    await safeDelete('Notifications', () => prisma.notification.deleteMany({}));
    
    // Try new models (may not exist yet)
    await safeDelete('User exercise attempts', () => (prisma as any).userExerciseAttempt?.deleteMany({}) || Promise.resolve());
    await safeDelete('User lesson progress', () => (prisma as any).userLessonProgress?.deleteMany({}) || Promise.resolve());
    
    // Try old models (may still exist)
    await safeDelete('Submissions', () => (prisma as any).submission?.deleteMany({}) || Promise.resolve());
    await safeDelete('Assignments', () => (prisma as any).assignment?.deleteMany({}) || Promise.resolve());
    await safeDelete('Class students', () => (prisma as any).classStudent?.deleteMany({}) || Promise.resolve());
    await safeDelete('Class teachers', () => (prisma as any).classTeacher?.deleteMany({}) || Promise.resolve());
    await safeDelete('Classes', () => (prisma as any).class?.deleteMany({}) || Promise.resolve());
    
    await safeDelete('User levels', () => prisma.userLevel.deleteMany({}));
    await safeDelete('Users', () => prisma.user.deleteMany({}));
    await safeDelete('Exercise questions', () => prisma.exerciseQuestion.deleteMany({}));
    await safeDelete('Exercises', () => prisma.exercise.deleteMany({}));
    await safeDelete('Lessons', () => prisma.lesson.deleteMany({}));
    await safeDelete('Sections', () => prisma.section.deleteMany({}));
    await safeDelete('Chapters', () => prisma.chapter.deleteMany({}));
    await safeDelete('Subjects', () => prisma.subject.deleteMany({}));
    await safeDelete('Grades', () => prisma.grade.deleteMany({}));
    await safeDelete('Conversation configs', () => prisma.conversationConfig.deleteMany({}));

    console.log('\n✅ Database cleared successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Run: pnpm prisma db push (to apply schema changes)');
    console.log('   2. Run: pnpm run db:seed-curriculum (to seed curriculum data)');
    console.log('   3. Run: pnpm run db:seed (to seed conversation configs)');

  } catch (error) {
    console.error('❌ Error clearing database:', error);
    throw error;
  }
}

// Main execution
clearDatabase()
  .catch((e) => {
    console.error('❌ Script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

