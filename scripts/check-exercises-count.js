const fs = require('fs');
const path = require('path');

// Get all exercise JSON files (exclude curriculum files)
const fixturesDir = path.join(__dirname, '..', 'fixtures');
const subjects = ['math', 'english', 'science', 'literature', 'history'];

const files = [];
subjects.forEach(subject => {
  const subjectDir = path.join(fixturesDir, subject);
  if (fs.existsSync(subjectDir)) {
    const subjectFiles = fs.readdirSync(subjectDir)
      .filter(f => f.endsWith('.json'))
      .map(f => path.join(subjectDir, f));
    files.push(...subjectFiles);
  }
});

console.log('Checking exercises count in all files...\n');

const results = [];

files.forEach(file => {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const fileName = path.basename(file);
    
    const chapterCounts = data.chapters.map((ch, i) => {
      const total = ch.lessons.reduce((sum, l) => sum + (l.exercises?.length || 0), 0);
      return { chapter: i + 1, name: ch.name, count: total };
    });
    
    const minCount = Math.min(...chapterCounts.map(c => c.count));
    const maxCount = Math.max(...chapterCounts.map(c => c.count));
    
    results.push({
      file: fileName,
      grade: data.grade,
      subject: data.subject,
      difficulty: data.difficulty,
      chapters: chapterCounts,
      minCount,
      maxCount,
      needsUpdate: minCount < 10
    });
  } catch (error) {
    console.error(`Error reading ${file}:`, error.message);
  }
});

// Sort by grade, subject, difficulty
results.sort((a, b) => {
  if (a.grade !== b.grade) return a.grade - b.grade;
  if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
  const diffOrder = { easy: 1, medium: 2, hard: 3 };
  return (diffOrder[a.difficulty] || 0) - (diffOrder[b.difficulty] || 0);
});

// Display results
results.forEach(result => {
  const status = result.needsUpdate ? '❌ NEEDS UPDATE' : '✅ OK';
  console.log(`${status} - ${result.file}`);
  console.log(`  Grade: ${result.grade}, Subject: ${result.subject}, Difficulty: ${result.difficulty}`);
  result.chapters.forEach(ch => {
    const statusIcon = ch.count >= 10 ? '✓' : '✗';
    console.log(`    ${statusIcon} Chapter ${ch.chapter} (${ch.name}): ${ch.count} exercises`);
  });
  console.log(`  Min: ${result.minCount}, Max: ${result.maxCount}\n`);
});

// Summary
const needsUpdate = results.filter(r => r.needsUpdate);
console.log('\n=== SUMMARY ===');
console.log(`Total files checked: ${results.length}`);
console.log(`Files OK: ${results.length - needsUpdate.length}`);
console.log(`Files need update: ${needsUpdate.length}`);

if (needsUpdate.length > 0) {
  console.log('\nFiles that need update:');
  needsUpdate.forEach(r => {
    console.log(`  - ${r.file} (min: ${r.minCount} exercises)`);
  });
}

