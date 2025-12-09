import * as fs from 'fs';
import * as path from 'path';

const MIN_EXERCISES_PER_CHAPTER = 15;
const MIN_ESSAY_PER_LESSON = 1;

interface Exercise {
  title: string;
  type: string;
  points: number;
  question: string;
  options?: Record<string, string>;
  correctOption?: string;
  hint?: string;
  answer?: string;
  created_at?: string;
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

function loadJsonFile(filePath: string): FixtureData {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }
  const content = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(content);
}

function validateFixture(
  filePath: string,
  allUuids?: Map<string, { file: string; exercise: string }>
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const data = loadJsonFile(filePath);
    
    data.chapters.forEach((chapter, chapterIndex) => {
      // Count total exercises in chapter
      let totalExercises = 0;
      chapter.lessons.forEach(lesson => {
        totalExercises += lesson.exercises.length;
      });

      // Check minimum exercises per chapter
      if (totalExercises < MIN_EXERCISES_PER_CHAPTER) {
        errors.push(
          `Chapter "${chapter.name}" (${chapter.code}) has only ${totalExercises} exercises. ` +
          `Required: at least ${MIN_EXERCISES_PER_CHAPTER} exercises per chapter.`
        );
      }

      // Check essay questions per lesson
      chapter.lessons.forEach((lesson, lessonIndex) => {
        const essayCount = lesson.exercises.filter(ex => ex.type === 'essay').length;
        
        if (essayCount < MIN_ESSAY_PER_LESSON) {
          errors.push(
            `Lesson "${lesson.title}" (${lesson.code}) in chapter "${chapter.name}" ` +
            `has only ${essayCount} essay question(s). ` +
            `Required: at least ${MIN_ESSAY_PER_LESSON} essay question per lesson.`
          );
        }

        // Validate exercise structure
        lesson.exercises.forEach((exercise, exerciseIndex) => {
          // Check required fields
          if (!exercise.uuid) {
            errors.push(
              `Exercise "${exercise.title || exerciseIndex + 1}" in lesson "${lesson.title}" missing uuid (REQUIRED to prevent duplicates)`
            );
          } else {
            // Validate UUID format (basic check for UUID v4 format)
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(exercise.uuid)) {
              errors.push(
                `Exercise "${exercise.title || exerciseIndex + 1}" in lesson "${lesson.title}" has invalid UUID format: ${exercise.uuid}`
              );
            } else {
              // Check for duplicate UUIDs across all files
              const existing = allUuids.get(exercise.uuid);
              if (existing) {
                errors.push(
                  `Duplicate UUID found: "${exercise.uuid}" in exercise "${exercise.title || exerciseIndex + 1}" (lesson "${lesson.title}") ` +
                  `already exists in "${existing.exercise}" (file: ${existing.file})`
                );
              } else {
                allUuids.set(exercise.uuid, {
                  file: filePath,
                  exercise: `"${exercise.title || exerciseIndex + 1}" in lesson "${lesson.title}"`
                });
              }
            }
          }
          if (!exercise.title) {
            errors.push(
              `Exercise ${exerciseIndex + 1} in lesson "${lesson.title}" missing title`
            );
          }
          if (!exercise.type) {
            errors.push(
              `Exercise "${exercise.title}" in lesson "${lesson.title}" missing type`
            );
          }
          if (!exercise.question) {
            errors.push(
              `Exercise "${exercise.title}" in lesson "${lesson.title}" missing question`
            );
          }
          if (!exercise.points && exercise.points !== 0) {
            errors.push(
              `Exercise "${exercise.title}" in lesson "${lesson.title}" missing points`
            );
          }

          // Validate multiple choice
          if (exercise.type === 'multiple_choice') {
            if (!exercise.options || Object.keys(exercise.options).length === 0) {
              errors.push(
                `Multiple choice exercise "${exercise.title}" in lesson "${lesson.title}" missing options`
              );
            }
            if (!exercise.correctOption) {
              errors.push(
                `Multiple choice exercise "${exercise.title}" in lesson "${lesson.title}" missing correctOption`
              );
            }
          }

          // Validate essay
          if (exercise.type === 'essay') {
            if (!exercise.answer) {
              warnings.push(
                `Essay exercise "${exercise.title}" in lesson "${lesson.title}" missing answer (recommended but not required)`
              );
            }
          }

          // Warn if no hint
          if (!exercise.hint) {
            warnings.push(
              `Exercise "${exercise.title}" in lesson "${lesson.title}" missing hint (recommended)`
            );
          }
        });
      });
    });
  } catch (error) {
    errors.push(`Failed to validate ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function main() {
  console.log('🔍 Validating fixtures data...\n');
  console.log(`Requirements:`);
  console.log(`  - Minimum ${MIN_EXERCISES_PER_CHAPTER} exercises per chapter`);
  console.log(`  - Minimum ${MIN_ESSAY_PER_LESSON} essay question per lesson`);
  console.log(`  - Every exercise MUST have a unique UUID (to prevent database duplicates)\n`);

  // Collect all UUIDs to check for duplicates across all files
  const allUuids = new Map<string, { file: string; exercise: string }>();

  const fixtureFiles = [
    'fixtures/informatics/grade5-2025-informatics-easy.json',
    'fixtures/informatics/grade5-2025-informatics-medium.json',
    'fixtures/informatics/grade5-2025-informatics-hard.json',
    'fixtures/informatics/grade7-2025-informatics-easy.json',
    'fixtures/informatics/grade7-2025-informatics-medium.json',
    'fixtures/informatics/grade7-2025-informatics-hard.json',
  ];

  let totalErrors = 0;
  let totalWarnings = 0;
  let validFiles = 0;

  fixtureFiles.forEach(file => {
    console.log(`📄 Validating ${file}...`);
    const result = validateFixture(file, allUuids);
    
    // Update allUuids map after validation (for duplicate checking across files)
    // This is done inside validateFixture, but we need to ensure it's passed correctly
    
    if (result.valid) {
      console.log(`  ✅ Valid`);
      validFiles++;
    } else {
      console.log(`  ❌ Invalid`);
    }

    if (result.errors.length > 0) {
      console.log(`  Errors (${result.errors.length}):`);
      result.errors.forEach(error => {
        console.log(`    - ${error}`);
      });
      totalErrors += result.errors.length;
    }

    if (result.warnings.length > 0) {
      console.log(`  Warnings (${result.warnings.length}):`);
      result.warnings.slice(0, 5).forEach(warning => {
        console.log(`    - ${warning}`);
      });
      if (result.warnings.length > 5) {
        console.log(`    ... and ${result.warnings.length - 5} more warnings`);
      }
      totalWarnings += result.warnings.length;
    }
    console.log('');
  });

  console.log('📊 Summary:');
  console.log(`  Valid files: ${validFiles}/${fixtureFiles.length}`);
  console.log(`  Total errors: ${totalErrors}`);
  console.log(`  Total warnings: ${totalWarnings}`);

  if (totalErrors > 0) {
    console.log('\n❌ Validation failed! Please fix the errors above.');
    process.exit(1);
  } else {
    console.log('\n✅ All fixtures are valid!');
    process.exit(0);
  }
}

main();

