#!/usr/bin/env tsx
/**
 * Update Fixtures to 15 Exercises per Chapter
 * 
 * This script updates all fixture files to ensure each chapter has exactly 15 exercises.
 * - If a chapter has multiple lessons, exercises are distributed evenly
 * - If a chapter has only 1 lesson, that lesson must have 15 exercises
 * - Applies to all difficulty levels (easy, medium, hard)
 * - Applies to all subjects and grades
 * 
 * Usage: npx tsx scripts/update-fixtures-to-15-exercises.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface Exercise {
  title: string;
  type: 'multiple_choice' | 'essay';
  points: number;
  question: string;
  options?: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctOption?: string;
  hint: string;
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
  difficulty: 'easy' | 'medium' | 'hard';
  description: string;
  chapters?: Chapter[];
  lessons?: Array<{
    code: string;
    chapter: string;
    lessonTitle: string;
    exercises: Exercise[];
  }>;
}

// Generate exercise based on difficulty, subject, chapter, and lesson
function generateExercise(
  difficulty: 'easy' | 'medium' | 'hard',
  subject: string,
  subjectCode: string,
  chapterName: string,
  chapterCode: string,
  lessonTitle: string,
  lessonCode: string,
  exerciseIndex: number,
  totalExercises: number
): Exercise {
  const isMultipleChoice = exerciseIndex % 2 === 0; // Alternate between multiple choice and essay
  const baseTimestamp = new Date('2025-01-01T00:00:00.000Z').getTime();
  const timestamp = baseTimestamp + (exerciseIndex * 1000);

  if (isMultipleChoice) {
    // Generate multiple choice question
    const questionTemplates = {
      easy: [
        `Câu hỏi cơ bản về ${lessonTitle}`,
        `Nhận biết kiến thức về ${lessonTitle}`,
        `Hiểu biết cơ bản về ${lessonTitle}`,
        `Kiến thức cơ bản: ${lessonTitle}`,
        `Câu hỏi đơn giản về ${lessonTitle}`,
      ],
      medium: [
        `Câu hỏi vận dụng về ${lessonTitle}`,
        `Áp dụng kiến thức: ${lessonTitle}`,
        `Vận dụng hiểu biết về ${lessonTitle}`,
        `Câu hỏi nâng cao về ${lessonTitle}`,
        `Phân tích về ${lessonTitle}`,
      ],
      hard: [
        `Câu hỏi phân tích sâu về ${lessonTitle}`,
        `Vận dụng nâng cao: ${lessonTitle}`,
        `Câu hỏi tổng hợp về ${lessonTitle}`,
        `Phân tích phức tạp: ${lessonTitle}`,
        `Câu hỏi đánh giá về ${lessonTitle}`,
      ],
    };

    const hintTemplates = {
      easy: `Hãy suy nghĩ về kiến thức cơ bản của ${lessonTitle}.`,
      medium: `Vận dụng kiến thức đã học về ${lessonTitle} để trả lời.`,
      hard: `Phân tích kỹ các khái niệm và mối quan hệ trong ${lessonTitle}.`,
    };

    const title = questionTemplates[difficulty][exerciseIndex % questionTemplates[difficulty].length];
    const question = `${title} (Câu ${exerciseIndex + 1}/${totalExercises})`;
    const hint = hintTemplates[difficulty];

    // Generate options based on subject
    let options: { A: string; B: string; C: string; D: string };
    if (subject.includes('Toán') || subject.includes('Math')) {
      options = {
        A: 'Đáp án A',
        B: 'Đáp án B (Đúng)',
        C: 'Đáp án C',
        D: 'Đáp án D',
      };
    } else if (subject.includes('Khoa học') || subject.includes('Science')) {
      options = {
        A: 'Lựa chọn A',
        B: 'Lựa chọn B (Đúng)',
        C: 'Lựa chọn C',
        D: 'Lựa chọn D',
      };
    } else if (subject.includes('Tiếng Anh') || subject.includes('English')) {
      options = {
        A: 'Option A',
        B: 'Option B (Correct)',
        C: 'Option C',
        D: 'Option D',
      };
    } else {
      options = {
        A: 'Phương án A',
        B: 'Phương án B (Đúng)',
        C: 'Phương án C',
        D: 'Phương án D',
      };
    }

    return {
      title,
      type: 'multiple_choice',
      points: difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3,
      question,
      options,
      correctOption: 'B',
      hint,
      created_at: new Date(timestamp).toISOString(),
    };
  } else {
    // Generate essay question
    const essayTemplates = {
      easy: [
        `Viết 2-3 câu về ${lessonTitle}`,
        `Trình bày ngắn gọn về ${lessonTitle}`,
        `Nêu hiểu biết của em về ${lessonTitle}`,
      ],
      medium: [
        `Viết đoạn văn ngắn về ${lessonTitle}`,
        `Phân tích ngắn gọn về ${lessonTitle}`,
        `Trình bày quan điểm về ${lessonTitle}`,
      ],
      hard: [
        `Viết bài phân tích về ${lessonTitle}`,
        `Trình bày và đánh giá về ${lessonTitle}`,
        `Phân tích chi tiết và đưa ra nhận xét về ${lessonTitle}`,
      ],
    };

    const answerTemplates = {
      easy: `Đây là câu trả lời ngắn gọn về ${lessonTitle}. Kiến thức cơ bản cần được trình bày rõ ràng và dễ hiểu.`,
      medium: `Đây là câu trả lời vận dụng về ${lessonTitle}. Cần áp dụng kiến thức đã học để giải thích và phân tích. Câu trả lời cần có tính logic và mạch lạc.`,
      hard: `Đây là câu trả lời phân tích sâu về ${lessonTitle}. Cần vận dụng nhiều kiến thức, phân tích đa chiều và đưa ra đánh giá. Câu trả lời cần thể hiện tư duy phản biện và khả năng tổng hợp.`,
    };

    const hintTemplates = {
      easy: `Hãy viết ngắn gọn, rõ ràng về ${lessonTitle}.`,
      medium: `Vận dụng kiến thức đã học, phân tích và giải thích về ${lessonTitle}.`,
      hard: `Phân tích sâu, đa chiều và đưa ra đánh giá về ${lessonTitle}.`,
    };

    const templateIndex = exerciseIndex % essayTemplates[difficulty].length;
    const title = essayTemplates[difficulty][templateIndex];
    const question = `${title} (Câu ${exerciseIndex + 1}/${totalExercises})`;
    const hint = hintTemplates[difficulty];
    const answer = answerTemplates[difficulty];

    return {
      title,
      type: 'essay',
      points: difficulty === 'easy' ? 2 : difficulty === 'medium' ? 3 : 4,
      question,
      hint,
      answer,
      created_at: new Date(timestamp).toISOString(),
    };
  }
}

// Update chapter to have exactly 15 exercises
function updateChapter(chapter: Chapter, difficulty: 'easy' | 'medium' | 'hard', subject: string, subjectCode: string): Chapter {
  const totalExercisesNeeded = 15;
  
  // Count current exercises
  let currentExerciseCount = 0;
  chapter.lessons.forEach(lesson => {
    currentExerciseCount += lesson.exercises.length;
  });

  if (currentExerciseCount === totalExercisesNeeded) {
    return chapter;
  }

  if (currentExerciseCount > totalExercisesNeeded) {
    // Too many exercises, remove excess
    const excess = currentExerciseCount - totalExercisesNeeded;
    let removed = 0;
    for (let i = chapter.lessons.length - 1; i >= 0 && removed < excess; i--) {
      const lesson = chapter.lessons[i];
      while (lesson.exercises.length > 0 && removed < excess) {
        lesson.exercises.pop();
        removed++;
      }
    }
    return chapter;
  }

  const exercisesToAdd = totalExercisesNeeded - currentExerciseCount;

  if (chapter.lessons.length === 1) {
    // Single lesson: add all exercises to this lesson
    const lesson = chapter.lessons[0];
    for (let i = 0; i < exercisesToAdd; i++) {
      const exerciseIndex = currentExerciseCount + i;
      const newExercise = generateExercise(
        difficulty,
        subject,
        subjectCode,
        chapter.name,
        chapter.code,
        lesson.title,
        lesson.code,
        exerciseIndex,
        totalExercisesNeeded
      );
      lesson.exercises.push(newExercise);
    }
  } else {
    // Multiple lessons: distribute exercises evenly
    const exercisesPerLesson = Math.ceil(exercisesToAdd / chapter.lessons.length);
    let addedCount = 0;

    for (const lesson of chapter.lessons) {
      if (addedCount >= exercisesToAdd) break;

      const exercisesForThisLesson = Math.min(
        exercisesPerLesson,
        exercisesToAdd - addedCount
      );

      for (let i = 0; i < exercisesForThisLesson; i++) {
        const exerciseIndex = currentExerciseCount + addedCount;
        const newExercise = generateExercise(
          difficulty,
          subject,
          subjectCode,
          chapter.name,
          chapter.code,
          lesson.title,
          lesson.code,
          exerciseIndex,
          totalExercisesNeeded
        );
        lesson.exercises.push(newExercise);
        addedCount++;
      }
    }
  }

  return chapter;
}

// Normalize exercise to have all required fields
function normalizeExercise(
  exercise: any,
  difficulty: 'easy' | 'medium' | 'hard',
  lessonTitle: string,
  exerciseIndex: number
): Exercise {
  const baseTimestamp = new Date('2025-01-01T00:00:00.000Z').getTime();
  const timestamp = baseTimestamp + (exerciseIndex * 1000);

  if (exercise.type === 'multiple_choice') {
    return {
      title: exercise.title || `Câu hỏi ${exerciseIndex + 1}`,
      type: 'multiple_choice',
      points: exercise.points || (difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3),
      question: exercise.question || exercise.title || `Câu hỏi về ${lessonTitle}`,
      options: exercise.options || {
        A: 'Đáp án A',
        B: 'Đáp án B (Đúng)',
        C: 'Đáp án C',
        D: 'Đáp án D',
      },
      correctOption: exercise.correctOption || 'B',
      hint: exercise.hint || `Hãy suy nghĩ về ${lessonTitle}.`,
      created_at: exercise.created_at || new Date(timestamp).toISOString(),
    };
  } else {
    return {
      title: exercise.title || `Tự luận: ${lessonTitle}`,
      type: 'essay',
      points: exercise.points || (difficulty === 'easy' ? 2 : difficulty === 'medium' ? 3 : 4),
      question: exercise.question || exercise.title || `Viết về ${lessonTitle}`,
      hint: exercise.hint || `Hãy viết về ${lessonTitle}.`,
      answer: exercise.answer || `Đây là câu trả lời mẫu về ${lessonTitle}.`,
      created_at: exercise.created_at || new Date(timestamp).toISOString(),
    };
  }
}

// Update fixture file with chapters structure
function updateFixtureWithChapters(
  data: FixtureData,
  filePath: string
): { updated: boolean; chapterCounts: { [key: string]: { before: number; after: number } } } {
  const chapterCounts: { [key: string]: { before: number; after: number } } = {};

  if (!data.chapters) {
    return { updated: false, chapterCounts };
  }

  // Update each chapter
  data.chapters = data.chapters.map((chapter) => {
    const beforeCount = chapter.lessons.reduce((sum, lesson) => sum + lesson.exercises.length, 0);
    
    const updatedChapter = updateChapter(
      chapter,
      data.difficulty,
      data.subject,
      data.subjectCode
    );

    const afterCount = updatedChapter.lessons.reduce((sum, lesson) => sum + lesson.exercises.length, 0);
    chapterCounts[chapter.name] = { before: beforeCount, after: afterCount };

    if (beforeCount !== afterCount) {
      console.log(`  ✅ Chapter "${chapter.name}": ${beforeCount} → ${afterCount} exercises`);
    } else if (afterCount !== 15) {
      console.log(`  ⚠️  Chapter "${chapter.name}": ${afterCount} exercises (expected 15)`);
    } else {
      console.log(`  ✓ Chapter "${chapter.name}": ${afterCount} exercises (already correct)`);
    }

    return updatedChapter;
  });

  return { updated: true, chapterCounts };
}

// Update fixture file with lessons structure (no chapters)
function updateFixtureWithLessons(
  data: FixtureData,
  filePath: string
): { updated: boolean; chapterCounts: { [key: string]: { before: number; after: number } } } {
  const chapterCounts: { [key: string]: { before: number; after: number } } = {};

  if (!data.lessons) {
    return { updated: false, chapterCounts };
  }

  // Group lessons by chapter
  const chapterMap = new Map<string, typeof data.lessons>();
  data.lessons.forEach(lesson => {
    const chapterName = lesson.chapter;
    if (!chapterMap.has(chapterName)) {
      chapterMap.set(chapterName, []);
    }
    chapterMap.get(chapterName)!.push(lesson);
  });

  // Update each chapter group
  chapterMap.forEach((lessons, chapterName) => {
    // Count current exercises
    let beforeCount = 0;
    lessons.forEach(lesson => {
      // Normalize exercises first
      lesson.exercises = lesson.exercises.map((ex, idx) => 
        normalizeExercise(ex, data.difficulty, lesson.lessonTitle, idx)
      );
      beforeCount += lesson.exercises.length;
    });

    const exercisesNeeded = 15 - beforeCount;

    if (exercisesNeeded < 0) {
      // Too many exercises, remove excess
      const excess = -exercisesNeeded;
      let removed = 0;
      for (let i = lessons.length - 1; i >= 0 && removed < excess; i--) {
        const lesson = lessons[i];
        while (lesson.exercises.length > 0 && removed < excess) {
          lesson.exercises.pop();
          removed++;
        }
      }
    } else if (exercisesNeeded > 0) {
      // Distribute exercises evenly across lessons
      if (lessons.length === 1) {
        // Single lesson: add all exercises to this lesson
        const lesson = lessons[0];
        for (let i = 0; i < exercisesNeeded; i++) {
          const exerciseIndex = beforeCount + i;
          const newExercise = generateExercise(
            data.difficulty,
            data.subject,
            data.subjectCode,
            chapterName,
            lesson.code.split('-')[0] + '-' + lesson.code.split('-')[1], // Extract chapter code
            lesson.lessonTitle,
            lesson.code,
            exerciseIndex,
            15
          );
          lesson.exercises.push(newExercise);
        }
      } else {
        // Multiple lessons: distribute evenly
        const exercisesPerLesson = Math.ceil(exercisesNeeded / lessons.length);
        let addedCount = 0;

        for (const lesson of lessons) {
          if (addedCount >= exercisesNeeded) break;

          const exercisesForThisLesson = Math.min(
            exercisesPerLesson,
            exercisesNeeded - addedCount
          );

          for (let i = 0; i < exercisesForThisLesson; i++) {
            const exerciseIndex = beforeCount + addedCount;
            const newExercise = generateExercise(
              data.difficulty,
              data.subject,
              data.subjectCode,
              chapterName,
              lesson.code.split('-')[0] + '-' + lesson.code.split('-')[1],
              lesson.lessonTitle,
              lesson.code,
              exerciseIndex,
              15
            );
            lesson.exercises.push(newExercise);
            addedCount++;
          }
        }
      }
    }

    const afterCount = lessons.reduce((sum, lesson) => sum + lesson.exercises.length, 0);
    chapterCounts[chapterName] = { before: beforeCount, after: afterCount };

    if (beforeCount !== afterCount) {
      console.log(`  ✅ Chapter "${chapterName}": ${beforeCount} → ${afterCount} exercises`);
    } else if (afterCount !== 15) {
      console.log(`  ⚠️  Chapter "${chapterName}": ${afterCount} exercises (expected 15)`);
    } else {
      console.log(`  ✓ Chapter "${chapterName}": ${afterCount} exercises (already correct)`);
    }
  });

  return { updated: true, chapterCounts };
}

// Update fixture file
function updateFixtureFile(filePath: string): { updated: boolean; chapterCounts: { [key: string]: { before: number; after: number } } } {
  console.log(`\n📝 Processing: ${filePath}`);

  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data: FixtureData = JSON.parse(fileContent);

    let result: { updated: boolean; chapterCounts: { [key: string]: { before: number; after: number } } };

    if (data.chapters) {
      // Structure with chapters
      result = updateFixtureWithChapters(data, filePath);
    } else if (data.lessons) {
      // Structure with lessons (no chapters)
      result = updateFixtureWithLessons(data, filePath);
    } else {
      console.log(`  ⚠️  Unknown structure, skipping...`);
      return { updated: false, chapterCounts: {} };
    }

    // Write updated data back to file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');

    return result;
  } catch (error) {
    console.error(`  ❌ Error processing ${filePath}:`, error);
    return { updated: false, chapterCounts: {} };
  }
}

// Main function
function main() {
  console.log('🔄 Updating fixtures to ensure 15 exercises per chapter...\n');
  console.log('='.repeat(70));

  const fixturesDir = path.join(process.cwd(), 'fixtures');
  const subjectDirs = ['math', 'science', 'english', 'literature', 'history'];

  let totalFiles = 0;
  let updatedFiles = 0;
  let skippedFiles = 0;

  for (const subjectDir of subjectDirs) {
    const subjectPath = path.join(fixturesDir, subjectDir);
    
    if (!fs.existsSync(subjectPath)) {
      console.log(`⚠️  Directory not found: ${subjectPath}`);
      continue;
    }

    const files = fs.readdirSync(subjectPath)
      .filter(file => file.endsWith('.json'))
      .filter(file => {
        // Only process files with difficulty levels (easy, medium, hard)
        return file.includes('-easy.json') || 
               file.includes('-medium.json') || 
               file.includes('-hard.json');
      });

    for (const file of files) {
      totalFiles++;
      const filePath = path.join(subjectPath, file);
      const result = updateFixtureFile(filePath);
      
      if (result.updated) {
        updatedFiles++;
      } else {
        skippedFiles++;
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n📊 Summary:');
  console.log(`   Total files processed: ${totalFiles}`);
  console.log(`   ✅ Updated: ${updatedFiles}`);
  console.log(`   ⚠️  Skipped: ${skippedFiles}`);
  console.log('\n✨ Done!\n');
}

// Run main function
main();

