#!/usr/bin/env tsx
/**
 * Script to find exercises by UUID in fixture files
 */

import * as fs from 'fs';
import * as path from 'path';

const FIXTURES_DIR = path.join(process.cwd(), 'fixtures');

// UUIDs to find
const UUIDs_TO_FIND = [
  '0824e7df-c411-496b-ad17-a7df81113ba2',
  '4b3ef248-a8ac-47b7-9fd7-21fee815f3a8',
  '2c311629-03ca-43c1-8472-15ea756e591c',
  '7cca8677-93ca-4b04-b553-5253427398f1',
  '501c2365-7acb-49cf-af5b-71c991ed57ad',
  'c4304492-6582-4761-b426-c094e15a0b05',
  '924635c9-bec3-463a-8752-49774e76de1f',
  '3c0e8e48-3e17-4c9a-ad6c-4721635a9901',
  '632d72ba-13ca-4fc8-8a6b-c019d8372d2e',
  'b388da26-0366-4e3f-b6be-51840022fd04',
  '426ed513-6fed-4914-80c5-606f6386aff9',
  'fcb0c35b-999c-421b-b157-a49ca79c552d',
  'c9753039-05f5-4ce0-96f7-fb40987e191b',
  '2c411ee1-30e6-43f4-9e24-6b546c62eb89',
  'fec74a75-4855-472d-9fd2-b977e723fd40',
  'b47c57fe-e256-4004-82a1-142755e6531b',
  '3aed32ba-4016-4b31-93da-66d381f52b7c',
  '48165ebe-0aa1-438f-9030-a1d70e37f755',
  '04fe20e8-490c-457a-8663-3389a8edfac2',
  'd2499a9b-fa3a-4b9b-a6bc-4ee7d5379b70',
  '40679e18-e729-413d-9a47-b7c8504f7278',
  '8bc9a3ae-5d20-4b8d-966d-e1e6b2367e13',
  '19771fae-40d2-4773-b40a-63b29ecae24a',
  '785e2c74-5b1b-404c-b186-454279905174',
  '985e70db-c2fb-4b8c-9633-48e9a47ccec1',
  '7136fda0-f01c-4619-81e8-ccf6d3d7f787',
  '4a3b76d7-43a8-4f81-8276-63c38068ae0a',
  '084a6fac-5589-4358-8aae-78a941528f1c',
  '074593f3-2403-47d1-ac7e-d2ed9c08294a',
  '39d83b92-aba3-4456-80d0-8e7000dfbfa6',
  '85ec8469-cd6a-4605-98dd-a68815eec84c',
  'fdb5536f-b4ef-4fb1-ae21-697ab1fb4d4f',
  'cdeffd9f-6264-4986-bf7c-af6a874c0c18',
  '930e7886-f047-4ec4-92f9-9a31667762f6',
  '812dfede-a86a-43de-9d3b-21d1f8dd765b',
  'f399adc5-ebca-4d38-8f7f-98cbce1085b3',
  '395562fe-016c-4f05-b87f-736d6129cfbd',
  'b506551d-30cc-422c-b602-762ce88a2ee6',
  '571a1e11-99f7-4304-833f-362dc3bdcec5',
  '1855081d-2b1e-4c10-8de2-8e39767ef2b1',
];

interface Exercise {
  uuid?: string;
  title?: string;
  type?: string;
  question?: string;
  [key: string]: unknown;
}

interface Lesson {
  exercises?: Exercise[];
  [key: string]: unknown;
}

interface Section {
  exercises?: Exercise[];
  lessons?: Lesson[];
  [key: string]: unknown;
}

interface Chapter {
  sections?: Section[];
  lessons?: Lesson[];
  code?: string;
  name?: string;
  [key: string]: unknown;
}

interface FixtureData {
  chapters?: Chapter[];
  grade?: number;
  subject?: string;
  difficulty?: string;
  [key: string]: unknown;
}

const foundExercises: Array<{
  file: string;
  uuid: string;
  chapter?: string;
  lesson?: string;
  section?: string;
  exercise: Exercise;
}> = [];

function findExercisesInData(data: FixtureData, filePath: string): void {
  if (!data.chapters || !Array.isArray(data.chapters)) {
    return;
  }

  for (const chapter of data.chapters) {
    const chapterCode = (chapter as Chapter).code || '';
    const chapterName = (chapter as Chapter).name || '';

    // Structure 1: chapters -> sections -> exercises
    if ((chapter as Chapter).sections && Array.isArray((chapter as Chapter).sections)) {
      for (const section of (chapter as Chapter).sections as Section[]) {
        const sectionName = (section as any).name || '';
        if (section.exercises && Array.isArray(section.exercises)) {
          for (const exercise of section.exercises) {
            if (exercise.uuid && UUIDs_TO_FIND.includes(exercise.uuid)) {
              foundExercises.push({
                file: path.relative(process.cwd(), filePath),
                uuid: exercise.uuid,
                chapter: chapterName || chapterCode,
                section: sectionName,
                exercise: exercise,
              });
            }
          }
        }
      }
    }

    // Structure 2: chapters -> lessons -> exercises
    if ((chapter as Chapter).lessons && Array.isArray((chapter as Chapter).lessons)) {
      for (const lesson of (chapter as Chapter).lessons as Lesson[]) {
        const lessonTitle = (lesson as any).title || (lesson as any).code || '';
        if (lesson.exercises && Array.isArray(lesson.exercises)) {
          for (const exercise of lesson.exercises) {
            if (exercise.uuid && UUIDs_TO_FIND.includes(exercise.uuid)) {
              foundExercises.push({
                file: path.relative(process.cwd(), filePath),
                uuid: exercise.uuid,
                chapter: chapterName || chapterCode,
                lesson: lessonTitle,
                exercise: exercise,
              });
            }
          }
        }
      }
    }
  }
}

function findAllFixtureFiles(dir: string): string[] {
  const files: string[] = [];

  function traverseDirectory(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
          continue;
        }
        traverseDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        files.push(fullPath);
      }
    }
  }

  traverseDirectory(dir);
  return files;
}

async function main() {
  console.log(`🔍 Searching for ${UUIDs_TO_FIND.length} UUIDs in fixtures...\n`);

  if (!fs.existsSync(FIXTURES_DIR)) {
    console.error(`❌ Fixtures directory not found: ${FIXTURES_DIR}`);
    process.exit(1);
  }

  const fixtureFiles = findAllFixtureFiles(FIXTURES_DIR);

  for (const filePath of fixtureFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data: FixtureData = JSON.parse(content);
      findExercisesInData(data, filePath);
    } catch (error) {
      // Skip invalid files
    }
  }

  console.log(`📊 Found ${foundExercises.length} exercises:\n`);

  // Group by file
  const byFile = new Map<string, typeof foundExercises>();
  for (const item of foundExercises) {
    if (!byFile.has(item.file)) {
      byFile.set(item.file, []);
    }
    byFile.get(item.file)!.push(item);
  }

  for (const [file, exercises] of byFile.entries()) {
    console.log(`\n📁 ${file} (${exercises.length} exercises):`);
    exercises.forEach((item) => {
      console.log(`  - UUID: ${item.uuid}`);
      console.log(`    Chapter: ${item.chapter || 'N/A'}`);
      if (item.lesson) console.log(`    Lesson: ${item.lesson}`);
      if (item.section) console.log(`    Section: ${item.section}`);
      console.log(`    Title: ${item.exercise.title || 'N/A'}`);
      console.log(`    Type: ${item.exercise.type || 'N/A'}`);
      console.log(`    Question: ${(item.exercise.question || '').substring(0, 100)}...`);
      console.log('');
    });
  }

  // Check which UUIDs were not found
  const foundUuids = new Set(foundExercises.map(e => e.uuid));
  const notFound = UUIDs_TO_FIND.filter(uuid => !foundUuids.has(uuid));
  
  if (notFound.length > 0) {
    console.log(`\n⚠️  ${notFound.length} UUIDs not found:`);
    notFound.forEach(uuid => console.log(`  - ${uuid}`));
  }

  // Save results to JSON file
  const outputPath = path.join(process.cwd(), 'output', 'found-exercises.json');
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(foundExercises, null, 2), 'utf-8');
  console.log(`\n💾 Results saved to: ${path.relative(process.cwd(), outputPath)}`);
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

