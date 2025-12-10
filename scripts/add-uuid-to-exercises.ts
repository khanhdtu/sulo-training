#!/usr/bin/env tsx
/**
 * Script to add UUID to all exercises in fixture files
 * 
 * This script scans all fixture JSON files and adds UUID to exercises that don't have one.
 * 
 * Usage: npm run add-uuid-exercises
 * Or: tsx scripts/add-uuid-to-exercises.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const FIXTURES_DIR = path.join(process.cwd(), 'fixtures');

interface Exercise {
  uuid?: string;
  title?: string;
  type?: string;
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
  [key: string]: unknown;
}

interface FixtureData {
  chapters?: Chapter[];
  [key: string]: unknown;
}

/**
 * Recursively find and add UUID to all exercises
 */
function addUUIDToExercises(data: FixtureData, filePath: string): { updated: number; total: number } {
  let updated = 0;
  let total = 0;

  if (!data.chapters || !Array.isArray(data.chapters)) {
    return { updated, total };
  }

  for (const chapter of data.chapters) {
    // Structure 1: chapters -> sections -> exercises
    if (chapter.sections && Array.isArray(chapter.sections)) {
      for (const section of chapter.sections) {
        if (section.exercises && Array.isArray(section.exercises)) {
          for (const exercise of section.exercises) {
            total++;
            if (!exercise.uuid) {
              exercise.uuid = randomUUID();
              updated++;
            }
          }
        }
      }
    }

    // Structure 2: chapters -> lessons -> exercises
    if (chapter.lessons && Array.isArray(chapter.lessons)) {
      for (const lesson of chapter.lessons) {
        if (lesson.exercises && Array.isArray(lesson.exercises)) {
          for (const exercise of lesson.exercises) {
            total++;
            if (!exercise.uuid) {
              exercise.uuid = randomUUID();
              updated++;
            }
          }
        }
      }
    }
  }

  return { updated, total };
}

/**
 * Process a single fixture file
 */
function processFixtureFile(filePath: string): { updated: number; total: number; skipped: boolean } {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data: FixtureData = JSON.parse(content);

    const result = addUUIDToExercises(data, filePath);

    if (result.updated > 0) {
      // Write back to file with proper formatting
      const updatedContent = JSON.stringify(data, null, 2);
      fs.writeFileSync(filePath, updatedContent + '\n', 'utf-8');
      return { ...result, skipped: false };
    }

    return { ...result, skipped: true };
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error instanceof Error ? error.message : error);
    return { updated: 0, total: 0, skipped: true };
  }
}

/**
 * Find all JSON files in fixtures directory
 */
function findAllFixtureFiles(dir: string): string[] {
  const files: string[] = [];

  function traverseDirectory(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and other common directories
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

/**
 * Main function
 */
async function main() {
  console.log('🔍 Scanning fixture files for exercises without UUID...\n');

  if (!fs.existsSync(FIXTURES_DIR)) {
    console.error(`❌ Fixtures directory not found: ${FIXTURES_DIR}`);
    process.exit(1);
  }

  const fixtureFiles = findAllFixtureFiles(FIXTURES_DIR);
  console.log(`📁 Found ${fixtureFiles.length} fixture files\n`);

  let totalUpdated = 0;
  let totalExercises = 0;
  let filesModified = 0;
  let filesSkipped = 0;

  for (const filePath of fixtureFiles) {
    const relativePath = path.relative(process.cwd(), filePath);
    const result = processFixtureFile(filePath);

    totalUpdated += result.updated;
    totalExercises += result.total;

    if (result.updated > 0) {
      filesModified++;
      console.log(`✅ ${relativePath}: Added ${result.updated} UUID(s) to ${result.total} exercise(s)`);
    } else if (result.total > 0) {
      filesSkipped++;
      console.log(`⏭️  ${relativePath}: All ${result.total} exercise(s) already have UUID`);
    } else {
      console.log(`ℹ️  ${relativePath}: No exercises found`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`   Files processed: ${fixtureFiles.length}`);
  console.log(`   Files modified: ${filesModified}`);
  console.log(`   Files skipped (already have UUIDs): ${filesSkipped}`);
  console.log(`   Total exercises found: ${totalExercises}`);
  console.log(`   UUIDs added: ${totalUpdated}`);
  console.log(`   Exercises that already had UUID: ${totalExercises - totalUpdated}`);
  console.log('='.repeat(60));

  if (totalUpdated > 0) {
    console.log('\n✅ Successfully added UUIDs to all exercises!');
  } else {
    console.log('\n✅ All exercises already have UUIDs!');
  }
}

// Run the script
main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
