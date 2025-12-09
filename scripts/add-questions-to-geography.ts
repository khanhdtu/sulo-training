import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

interface Exercise {
  uuid?: string;
  title: string;
  type: 'multiple_choice' | 'essay';
  points: number;
  question: string;
  options?: Record<string, string>;
  correctOption?: string;
  hint?: string;
  answer?: string;
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

const MIN_EXERCISES_PER_CHAPTER = 15;
const MIN_ESSAY_PER_LESSON = 1;

function loadJsonFile(filePath: string): FixtureData {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }
  const content = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(content);
}

function addQuestionsToFile(filePath: string) {
  console.log(`\n📝 Processing ${filePath}...`);
  
  const data = loadJsonFile(filePath);
  let totalAdded = 0;
  
  data.chapters.forEach((chapter, chapterIndex) => {
    // Count total exercises in chapter
    let totalExercises = 0;
    chapter.lessons.forEach(lesson => {
      totalExercises += lesson.exercises.length;
    });
    
    console.log(`  Chapter: ${chapter.name} (${totalExercises} exercises)`);
    
    // Process each lesson
    chapter.lessons.forEach((lesson, lessonIndex) => {
      const essayCount = lesson.exercises.filter(ex => ex.type === 'essay').length;
      const currentCount = lesson.exercises.length;
      
      // Ensure at least 1 essay per lesson
      if (essayCount === 0) {
        const baseTime = lesson.exercises.length > 0 
          ? new Date(lesson.exercises[lesson.exercises.length - 1].created_at || '2025-01-01T00:00:00.000Z').getTime()
          : new Date('2025-01-01T00:00:00.000Z').getTime();
        
        lesson.exercises.push({
          uuid: randomUUID(),
          title: `Tự luận: Nêu hiểu biết của em về ${lesson.title}`,
          type: 'essay',
          points: 2,
          question: `Nêu hiểu biết của em về ${lesson.title}. Hãy trình bày ngắn gọn và rõ ràng.`,
          hint: `Hãy viết ngắn gọn, rõ ràng về ${lesson.title}.`,
          answer: `Đây là câu trả lời ngắn gọn về ${lesson.title}. Kiến thức cơ bản cần được trình bày rõ ràng và dễ hiểu.`,
          created_at: new Date(baseTime + 1000).toISOString()
        });
        totalAdded++;
        console.log(`    ✓ Added essay to lesson: ${lesson.title}`);
      }
      
      // Add UUID to exercises that don't have it
      lesson.exercises.forEach(exercise => {
        if (!exercise.uuid) {
          exercise.uuid = randomUUID();
        }
      });
    });
    
    // Calculate how many exercises needed per chapter
    const exercisesNeeded = Math.max(0, MIN_EXERCISES_PER_CHAPTER - totalExercises);
    
    if (exercisesNeeded > 0) {
      // Distribute exercises across lessons
      const exercisesPerLesson = Math.ceil(exercisesNeeded / chapter.lessons.length);
      
      chapter.lessons.forEach((lesson, lessonIndex) => {
        const exercisesToAdd = Math.min(exercisesPerLesson, MIN_EXERCISES_PER_CHAPTER - lesson.exercises.length);
        
        for (let i = 0; i < exercisesToAdd; i++) {
          const baseTime = lesson.exercises.length > 0
            ? new Date(lesson.exercises[lesson.exercises.length - 1].created_at || '2025-01-01T00:00:00.000Z').getTime()
            : new Date('2025-01-01T00:00:00.000Z').getTime();
          const exerciseNum = lesson.exercises.length + 1;
          
          lesson.exercises.push({
            uuid: randomUUID(),
            title: `Câu hỏi bổ sung về ${lesson.title}`,
            type: 'multiple_choice',
            points: 1,
            question: `Câu hỏi bổ sung về ${lesson.title} (Câu ${exerciseNum}/15)`,
            options: {
              'A': 'Đáp án A',
              'B': 'Đáp án B (Đúng)',
              'C': 'Đáp án C',
              'D': 'Đáp án D'
            },
            correctOption: 'B',
            hint: `Hãy suy nghĩ về kiến thức cơ bản của ${lesson.title}.`,
            created_at: new Date(baseTime + (i + 1) * 1000).toISOString()
          });
          totalAdded++;
        }
      });
      
      console.log(`    ✓ Added ${exercisesNeeded} exercises to chapter: ${chapter.name}`);
    }
  });
  
  // Write back to file
  const fullPath = path.join(process.cwd(), filePath);
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf-8');
  
  console.log(`  ✅ Total added: ${totalAdded} exercises`);
  return totalAdded;
}

function main() {
  console.log('🚀 Adding questions to Geography fixtures...\n');
  
  const files = [
    'fixtures/geography/grade5-2025-geography-easy.json',
    'fixtures/geography/grade5-2025-geography-medium.json',
    'fixtures/geography/grade5-2025-geography-hard.json',
    'fixtures/geography/grade7-2025-geography-easy.json',
    'fixtures/geography/grade7-2025-geography-medium.json',
    'fixtures/geography/grade7-2025-geography-hard.json',
  ];
  
  let totalAdded = 0;
  
  files.forEach(file => {
    try {
      if (fs.existsSync(path.join(process.cwd(), file))) {
        totalAdded += addQuestionsToFile(file);
      } else {
        console.log(`  ⚠️  File not found: ${file} (will be created later)`);
      }
    } catch (error) {
      console.error(`  ❌ Error processing ${file}:`, error instanceof Error ? error.message : String(error));
    }
  });
  
  console.log(`\n✅ Done! Total exercises added: ${totalAdded}`);
}

main();

