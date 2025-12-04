import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

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

// Helper function to load JSON file
function loadJsonFile(filePath: string): any {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }
  const content = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(content);
}

async function seedCurriculumTable() {
  console.log('🌱 Starting Curriculum table seeding...\n');

  try {
    // Seed Math curriculum
    console.log('📚 Seeding Math curriculum...');
    await seedCurriculumFromFile('fixtures/curriculum/grade7-2025-2026-math.json');

    // Seed English curriculum
    console.log('\n📚 Seeding English curriculum...');
    await seedCurriculumFromFile('fixtures/curriculum/grade7-2025-2026-english.json');

    console.log('\n✅ Curriculum table seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding curriculum table:', error);
    throw error;
  }
}

async function seedCurriculumFromFile(fixturePath: string) {
  const data = loadJsonFile(fixturePath);

  // Create or get Grade
  let grade = await prisma.grade.findFirst({
    where: { level: data.grade },
  });

  if (!grade) {
    grade = await prisma.grade.create({
      data: {
        name: `Lớp ${data.grade}`,
        level: data.grade,
      },
    });
    console.log(`  ✓ Created Grade: ${grade.name}`);
  } else {
    console.log(`  ✓ Found Grade: ${grade.name}`);
  }

  // Prepare lessons data (chapters > lessons structure)
  const lessonsData = {
    chapters: data.chapters.map((chapter: any) => ({
      code: chapter.code,
      name: chapter.name,
      lessons: chapter.lessons.map((lesson: any) => ({
        code: lesson.code,
        title: lesson.title,
      })),
    })),
  };

  // Create or update Curriculum
  const curriculum = await prisma.curriculum.upsert({
    where: {
      gradeId_courseYear_subject: {
        gradeId: grade.id,
        courseYear: data.courseYear,
        subject: data.subject,
      },
    },
    update: {
      lessons: lessonsData as any,
      updatedAt: new Date(),
    },
    create: {
      gradeId: grade.id,
      courseYear: data.courseYear,
      subject: data.subject,
      lessons: lessonsData as any,
      createdAt: data.created_at ? new Date(data.created_at) : new Date(),
    },
  });

  console.log(`  ✓ Curriculum: ${data.subject} (${data.courseYear})`);
  console.log(`    - Chapters: ${data.chapters.length}`);
  const totalLessons = data.chapters.reduce(
    (sum: number, ch: any) => sum + ch.lessons.length,
    0
  );
  console.log(`    - Total Lessons: ${totalLessons}`);
}

// Main execution
seedCurriculumTable()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

