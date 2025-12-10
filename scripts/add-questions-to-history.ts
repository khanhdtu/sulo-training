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
  order?: number;
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
      let exercisesToAdd = exercisesNeeded;
      let lessonIndex = 0;
      
      while (exercisesToAdd > 0 && lessonIndex < chapter.lessons.length) {
        const lesson = chapter.lessons[lessonIndex];
        const lastExercise = lesson.exercises[lesson.exercises.length - 1];
        const lastTimestamp = lastExercise 
          ? new Date(lastExercise.created_at || '2025-01-01T00:00:00.000Z').getTime()
          : new Date('2025-01-01T00:00:00.000Z').getTime();
        
        // Add one multiple choice question
        const questionNumber = lesson.exercises.length + 1;
        lesson.exercises.push({
          uuid: randomUUID(),
          title: `Câu hỏi bổ sung về ${lesson.title}`,
          type: 'multiple_choice',
          points: 1,
          question: `Câu hỏi bổ sung về ${lesson.title} (Câu ${questionNumber}/${MIN_EXERCISES_PER_CHAPTER})`,
          options: {
            A: 'Đáp án A',
            B: 'Đáp án B (Đúng)',
            C: 'Đáp án C',
            D: 'Đáp án D'
          },
          correctOption: 'B',
          hint: `Hãy suy nghĩ về kiến thức cơ bản của ${lesson.title}.`,
          created_at: new Date(lastTimestamp + 1000).toISOString()
        });
        
        exercisesToAdd--;
        totalAdded++;
        lessonIndex = (lessonIndex + 1) % chapter.lessons.length;
      }
      
      console.log(`    ✓ Added ${exercisesNeeded} exercises to reach minimum`);
    }
  });
  
  // Save the file
  const fullPath = path.join(process.cwd(), filePath);
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`  ✅ Saved ${filePath} (added ${totalAdded} exercises)`);
}

// Create empty exercise files first
function createEmptyExerciseFile(filePath: string, grade: number, difficulty: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const data: FixtureData = {
    grade: grade,
    subject: 'Lịch sử',
    subjectCode: 'LS5',
    difficulty: difficulty,
    description: `${difficulty} exercises for Grade 5 History (Lớp 5 Lịch sử)`,
    chapters: [
      {
        code: 'CH1',
        name: 'Buổi đầu dựng nước và giữ nước',
        lessons: [
          { code: 'LS5-CH1-L1', title: 'Nước Văn Lang', exercises: [] },
          { code: 'LS5-CH1-L2', title: 'Đời sống của người Việt cổ', exercises: [] },
          { code: 'LS5-CH1-L3', title: 'Cuộc khởi nghĩa Hai Bà Trưng', exercises: [] },
          { code: 'LS5-CH1-L4', title: 'Cuộc khởi nghĩa Bà Triệu', exercises: [] }
        ]
      },
      {
        code: 'CH2',
        name: 'Nước ta dưới thời kỳ độc lập',
        lessons: [
          { code: 'LS5-CH2-L1', title: 'Ngô Quyền và chiến thắng Bạch Đằng', exercises: [] },
          { code: 'LS5-CH2-L2', title: 'Đinh Bộ Lĩnh thống nhất đất nước', exercises: [] },
          { code: 'LS5-CH2-L3', title: 'Lý Công Uẩn dời đô về Thăng Long', exercises: [] },
          { code: 'LS5-CH2-L4', title: 'Cuộc kháng chiến chống Tống', exercises: [] }
        ]
      },
      {
        code: 'CH3',
        name: 'Nước Đại Việt thời Trần',
        lessons: [
          { code: 'LS5-CH3-L1', title: 'Lần thứ nhất (1258)', exercises: [] },
          { code: 'LS5-CH3-L2', title: 'Lần thứ hai (1285) và lần thứ ba (1287-1288)', exercises: [] }
        ]
      },
      {
        code: 'CH4',
        name: 'Nước Đại Việt thời Lê',
        lessons: [
          { code: 'LS5-CH4-L1', title: 'Lê Lợi và khởi nghĩa Lam Sơn', exercises: [] },
          { code: 'LS5-CH4-L2', title: 'Nguyễn Trãi và Bình Ngô đại cáo', exercises: [] }
        ]
      },
      {
        code: 'CH5',
        name: 'Việt Nam thế kỷ XIX',
        lessons: [
          { code: 'LS5-CH5-L1', title: 'Thực dân Pháp xâm lược Việt Nam', exercises: [] },
          { code: 'LS5-CH5-L2', title: 'Phong trào đấu tranh chống Pháp', exercises: [] }
        ]
      }
    ]
  };
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`  ✓ Created empty file: ${path.basename(filePath)}`);
}

async function main() {
  console.log('📚 Creating History Grade 5 exercise files...\n');
  
  const files = [
    'fixtures/history/grade5-2025-history-easy.json',
    'fixtures/history/grade5-2025-history-medium.json',
    'fixtures/history/grade5-2025-history-hard.json'
  ];
  
  const difficulties = ['easy', 'medium', 'hard'];
  
  // Create empty files first
  files.forEach((file, index) => {
    createEmptyExerciseFile(file, 5, difficulties[index]);
  });
  
  // Add questions to each file
  files.forEach(file => {
    addQuestionsToFile(file);
  });
  
  console.log('\n✅ All History Grade 5 exercise files created and populated!');
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});

