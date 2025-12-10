#!/usr/bin/env tsx
/**
 * Script to fix exercise content by UUID
 * Usage: npx tsx scripts/fix-exercise-content.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

config();

// List of UUIDs to fix
const UUIDs_TO_FIX = [
  '7a37853c-34a2-468d-aab2-7812da7d6c7f',
  'ad079592-f481-4fad-81e1-78bfb9c2dbed',
  '2750a684-58e2-41bc-94c7-d46cc6f6d1b9',
  'b928a319-aeaf-4226-9651-30ea7da887a6',
  '2442b004-62a7-4659-a614-0df230df94a0',
  '15d9833c-afcb-4c42-9a88-7c22ea6dc344',
  'd2308ba9-843a-4be9-80af-be522ae1d368',
  '4c59bb71-3bef-4503-9588-a7c8e8c3f4a8',
  'd4d82e46-f933-4fda-92f2-238d14fb7f86',
  '77e236a5-d3a4-4897-926b-4f7a550772f6',
  '72201e00-0b3d-4598-aad6-1748c9ab5adb',
  '54a9fcdd-f7a6-4bc1-a5ca-2a9fdbd28cb0',
  'be018960-c8ab-4a0c-b53a-5dcc8a2a7257',
  '6a76ddc3-032a-459c-8ded-ec636c0fe679',
  'de0c8f5f-5c41-4dcd-bb9a-a3938f30fbda',
  'b6e91d8a-2f9a-4205-982b-3cc0e48d68f2',
  'a769d772-7504-441e-8403-d4828b6a44b3',
  'b5845127-5478-4a5c-8f81-be5627cc6279',
  'ec359857-0227-4f3b-9ea0-a3fa917bfb8c',
  '0314dfb3-0f51-4b0c-8c33-3f3268de68d3',
  '8deb4cab-3e1c-4438-a5f0-20c71235ed25',
  'a8df47d0-adfa-4ad5-9098-196ae6f43110',
  '6af1587a-9a9b-4663-b855-d38841a353cd',
  '39cc1c27-b9ed-4a19-9a04-7bcb1ccecb21',
  '8ffe945e-dae6-48d9-893c-ced52ab7004b',
  '89e5e559-97c2-46ec-99bd-3986e0dc4f6b',
  '48271e93-329c-4d61-9e1c-b60e6d7e0a2d',
  '03daea63-3649-40a2-83ec-07cff000da79',
];

// Correct content based on the image
const CORRECT_CONTENT = {
  title: 'Phân tích về sự sinh sản',
  question: 'Tại sao sự sinh sản lại quan trọng đối với các loài sinh vật?',
  options: {
    A: 'Vì giúp duy trì nòi giống và tạo ra thế hệ mới',
    B: 'Vì giúp sinh vật lớn lên',
    C: 'Vì giúp sinh vật ăn uống',
    D: 'Vì giúp sinh vật di chuyễn',
  },
  correctOption: 'A',
  hint: 'Sự sinh sản giúp duy trì nòi giống và tạo ra thế hệ mới, đảm bảo sự tồn tại của các loài.',
  answer: 'Sự sinh sản giúp duy trì nòi giống và tạo ra thế hệ mới, đảm bảo sự tồn tại của các loài.',
};

function loadJsonFile(filePath: string): any {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }
  const content = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(content);
}

function saveJsonFile(filePath: string, data: any): void {
  const fullPath = path.join(process.cwd(), filePath);
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf-8');
}

function findAndFixExercise(data: any, uuid: string, filePath: string): boolean {
  let found = false;

  function searchInExercises(exercises: any[]): boolean {
    for (const exercise of exercises) {
      if (exercise.uuid === uuid) {
        // Fix the exercise content
        exercise.title = CORRECT_CONTENT.title;
        exercise.question = CORRECT_CONTENT.question;
        if (exercise.type === 'multiple_choice') {
          exercise.options = CORRECT_CONTENT.options;
          exercise.correctOption = CORRECT_CONTENT.correctOption;
        }
        exercise.hint = CORRECT_CONTENT.hint;
        if (exercise.type === 'essay') {
          exercise.answer = CORRECT_CONTENT.answer;
        }
        found = true;
        console.log(`  ✓ Fixed exercise: ${uuid} in ${path.basename(filePath)}`);
        return true;
      }
    }
    return false;
  }

  // Search in chapters > lessons > exercises
  if (data.chapters && Array.isArray(data.chapters)) {
    for (const chapter of data.chapters) {
      if (chapter.lessons && Array.isArray(chapter.lessons)) {
        for (const lesson of chapter.lessons) {
          if (lesson.exercises && Array.isArray(lesson.exercises)) {
            if (searchInExercises(lesson.exercises)) {
              return true;
            }
          }
        }
      }
    }
  }

  // Search in lessons > exercises (flat structure)
  if (data.lessons && Array.isArray(data.lessons)) {
    for (const lesson of data.lessons) {
      if (lesson.exercises && Array.isArray(lesson.exercises)) {
        if (searchInExercises(lesson.exercises)) {
          return true;
        }
      }
    }
  }

  return found;
}

async function main() {
  console.log('🔧 Starting to fix exercise content...\n');

  const fixtureFiles = [
    'fixtures/science/grade5-2025-science-easy.json',
    'fixtures/science/grade5-2025-science-medium.json',
    'fixtures/science/grade5-2025-science-hard.json',
  ];

  let totalFixed = 0;

  for (const filePath of fixtureFiles) {
    try {
      const data = loadJsonFile(filePath);
      let fileFixed = false;

      console.log(`📄 Processing: ${path.basename(filePath)}`);

      for (const uuid of UUIDs_TO_FIX) {
        if (findAndFixExercise(data, uuid, filePath)) {
          fileFixed = true;
          totalFixed++;
        }
      }

      if (fileFixed) {
        saveJsonFile(filePath, data);
        console.log(`  ✅ Saved changes to ${path.basename(filePath)}\n`);
      } else {
        console.log(`  ⊘ No matching exercises found\n`);
      }
    } catch (error) {
      console.error(`  ❌ Error processing ${filePath}:`, error);
    }
  }

  console.log(`\n✅ Fixed ${totalFixed} exercises across ${fixtureFiles.length} files`);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

