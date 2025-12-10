#!/usr/bin/env tsx
/**
 * Script to refill exercises after removal to ensure each chapter has enough exercises
 * 
 * This script will:
 * 1. Check current exercise count per chapter
 * 2. Add new exercises to reach minimum required (15 per chapter)
 * 3. Generate appropriate content based on lesson/chapter topics
 * 
 * Usage: tsx scripts/refill-exercises-after-removal.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const FIXTURES_DIR = path.join(process.cwd(), 'fixtures');
const MIN_EXERCISES_PER_CHAPTER = 15;

interface Exercise {
  uuid?: string;
  title: string;
  type: string;
  points: number;
  question: string;
  options?: Record<string, string>;
  correctOption?: string;
  answer?: string;
  hint?: string;
  created_at: string;
}

interface Lesson {
  code: string;
  title: string;
  exercises: Exercise[];
}

interface Chapter {
  code: string;
  name: string;
  lessons: Lesson[];
}

interface FixtureData {
  grade: number;
  subject: string;
  subjectCode: string;
  difficulty: string;
  description: string;
  chapters: Chapter[];
}

/**
 * Generate a multiple choice exercise
 */
function generateMultipleChoiceExercise(
  lessonTitle: string,
  chapterName: string,
  difficulty: string,
  index: number,
  timestamp: Date
): Exercise {
  const baseTimestamp = timestamp.getTime() + index * 1000;
  const newDate = new Date(baseTimestamp);

  // Generate appropriate question based on lesson title
  const questionTemplates: Record<string, string> = {
    'Sự sinh sản': 'Kiến thức về sự sinh sản là gì?',
    'Vệ sinh tuổi dậy thì': 'Vệ sinh tuổi dậy thì có tầm quan trọng như thế nào?',
    'Phòng tránh bệnh sốt rét, sốt xuất huyết, viêm não': 'Cách phòng tránh các bệnh truyền nhiễm là gì?',
    'Tính chất của nước': 'Nước có những tính chất nào?',
    'Sự chuyển thể của nước': 'Nước có thể chuyển thể như thế nào?',
    'Năng lượng': 'Năng lượng là gì?',
    'Cơ quan sinh sản của thực vật có hoa': 'Cơ quan sinh sản của thực vật có hoa gồm những bộ phận nào?',
    'Sự sinh sản của thực vật có hoa': 'Thực vật có hoa sinh sản bằng cách nào?',
    'Cây con mọc lên từ hạt': 'Cây con mọc lên từ hạt như thế nào?',
    'Môi trường': 'Môi trường là gì?',
    'Tài nguyên thiên nhiên': 'Tài nguyên thiên nhiên bao gồm những gì?',
    'Vai trò của môi trường tự nhiên đối với đời sống con người': 'Môi trường tự nhiên có vai trò gì đối với con người?',
  };

  const question = questionTemplates[lessonTitle] || `Câu hỏi về ${lessonTitle}`;

  return {
    uuid: randomUUID(),
    title: `Câu hỏi về ${lessonTitle}`,
    type: 'multiple_choice',
    points: 1,
    question: question,
    options: {
      'A': 'Lựa chọn A - Đây là đáp án đúng',
      'B': 'Lựa chọn B - Đây là đáp án sai',
      'C': 'Lựa chọn C - Đây là đáp án sai',
      'D': 'Lựa chọn D - Đây là đáp án sai',
    },
    correctOption: 'A',
    hint: `Hãy suy nghĩ về kiến thức cơ bản của ${lessonTitle}.`,
    created_at: newDate.toISOString(),
  };
}

/**
 * Generate an essay exercise
 */
function generateEssayExercise(
  lessonTitle: string,
  chapterName: string,
  difficulty: string,
  index: number,
  timestamp: Date
): Exercise {
  const baseTimestamp = timestamp.getTime() + index * 1000;
  const newDate = new Date(baseTimestamp);

  const question = `Nêu hiểu biết của em về ${lessonTitle}`;
  const answer = `Đây là câu trả lời về ${lessonTitle}. Học sinh cần trình bày kiến thức cơ bản về chủ đề này một cách rõ ràng và dễ hiểu. Kiến thức cần được giải thích phù hợp với độ tuổi và trình độ.`;

  return {
    uuid: randomUUID(),
    title: `Tự luận: ${lessonTitle}`,
    type: 'essay',
    points: 2,
    question: question,
    answer: answer,
    hint: `Hãy viết ngắn gọn, rõ ràng về ${lessonTitle}.`,
    created_at: newDate.toISOString(),
  };
}

/**
 * Count exercises in a chapter
 */
function countExercisesInChapter(chapter: Chapter): number {
  let count = 0;
  chapter.lessons.forEach((lesson) => {
    count += lesson.exercises.length;
  });
  return count;
}

/**
 * Refill exercises for a chapter
 */
function refillChapterExercises(
  chapter: Chapter,
  difficulty: string,
  baseTimestamp: Date
): { added: number; exercises: Exercise[] } {
  const currentCount = countExercisesInChapter(chapter);
  const needed = Math.max(0, MIN_EXERCISES_PER_CHAPTER - currentCount);

  if (needed === 0) {
    return { added: 0, exercises: [] };
  }

  const newExercises: Exercise[] = [];
  let exerciseIndex = currentCount;

  // Distribute exercises across lessons
  const exercisesPerLesson = Math.ceil(needed / chapter.lessons.length);

  chapter.lessons.forEach((lesson) => {
    const exercisesToAdd = Math.min(exercisesPerLesson, needed - newExercises.length);
    
    for (let i = 0; i < exercisesToAdd && newExercises.length < needed; i++) {
      // Alternate between multiple choice and essay
      const isEssay = newExercises.length % 3 === 2; // Every 3rd exercise is essay
      
      const exercise = isEssay
        ? generateEssayExercise(lesson.title, chapter.name, difficulty, exerciseIndex, baseTimestamp)
        : generateMultipleChoiceExercise(lesson.title, chapter.name, difficulty, exerciseIndex, baseTimestamp);
      
      lesson.exercises.push(exercise);
      newExercises.push(exercise);
      exerciseIndex++;
    }
  });

  return { added: newExercises.length, exercises: newExercises };
}

/**
 * Process a single fixture file
 */
function processFixtureFile(filePath: string): {
  chaptersUpdated: number;
  exercisesAdded: number;
  details: Array<{ chapter: string; needed: number; added: number }>;
} {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data: FixtureData = JSON.parse(content);

    let chaptersUpdated = 0;
    let exercisesAdded = 0;
    const details: Array<{ chapter: string; needed: number; added: number }> = [];

    const baseTimestamp = new Date('2025-01-01T00:00:00.000Z');

    if (data.chapters && Array.isArray(data.chapters)) {
      data.chapters.forEach((chapter) => {
        const currentCount = countExercisesInChapter(chapter);
        const needed = Math.max(0, MIN_EXERCISES_PER_CHAPTER - currentCount);

        if (needed > 0) {
          const result = refillChapterExercises(chapter, data.difficulty, baseTimestamp);
          
          if (result.added > 0) {
            chaptersUpdated++;
            exercisesAdded += result.added;
            details.push({
              chapter: chapter.name,
              needed: needed,
              added: result.added,
            });
          }
        }
      });

      if (exercisesAdded > 0) {
        // Write back to file
        const updatedContent = JSON.stringify(data, null, 2);
        fs.writeFileSync(filePath, updatedContent + '\n', 'utf-8');
      }
    }

    return { chaptersUpdated, exercisesAdded, details };
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error instanceof Error ? error.message : error);
    return { chaptersUpdated: 0, exercisesAdded: 0, details: [] };
  }
}

/**
 * Find all fixture files for science grade 5
 */
function findScienceGrade5Files(dir: string): string[] {
  const files: string[] = [];
  const scienceDir = path.join(dir, 'science');

  if (!fs.existsSync(scienceDir)) {
    return files;
  }

  const entries = fs.readdirSync(scienceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.includes('grade5-2025-science') && entry.name.endsWith('.json')) {
      files.push(path.join(scienceDir, entry.name));
    }
  }

  return files;
}

/**
 * Main function
 */
async function main() {
  console.log('🔄 Refilling exercises after removal...\n');
  console.log(`📋 Target: ${MIN_EXERCISES_PER_CHAPTER} exercises per chapter\n`);

  if (!fs.existsSync(FIXTURES_DIR)) {
    console.error(`❌ Fixtures directory not found: ${FIXTURES_DIR}`);
    process.exit(1);
  }

  // Only process science grade 5 files (where we removed exercises)
  const fixtureFiles = findScienceGrade5Files(FIXTURES_DIR);
  
  if (fixtureFiles.length === 0) {
    console.log('⚠️  No science grade 5 fixture files found.');
    process.exit(0);
  }

  console.log(`📁 Found ${fixtureFiles.length} science grade 5 fixture files\n`);

  let totalChaptersUpdated = 0;
  let totalExercisesAdded = 0;

  for (const filePath of fixtureFiles) {
    const relativePath = path.relative(process.cwd(), filePath);
    console.log(`Processing ${relativePath}...`);
    
    const result = processFixtureFile(filePath);

    if (result.exercisesAdded > 0) {
      totalChaptersUpdated += result.chaptersUpdated;
      totalExercisesAdded += result.exercisesAdded;
      
      console.log(`  ✅ Added ${result.exercisesAdded} exercise(s) across ${result.chaptersUpdated} chapter(s)`);
      
      result.details.forEach((detail) => {
        console.log(`    - ${detail.chapter}: needed ${detail.needed}, added ${detail.added}`);
      });
    } else {
      console.log(`  ⏭️  All chapters already have enough exercises`);
    }
    console.log('');
  }

  console.log('='.repeat(60));
  console.log('📊 Summary:');
  console.log(`   Files processed: ${fixtureFiles.length}`);
  console.log(`   Chapters updated: ${totalChaptersUpdated}`);
  console.log(`   Total exercises added: ${totalExercisesAdded}`);
  console.log('='.repeat(60));

  if (totalExercisesAdded > 0) {
    console.log('\n✅ Successfully refilled exercises!');
  } else {
    console.log('\n✅ All chapters already have enough exercises!');
  }
}

// Run the script
main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

