'use client';

import { useEffect, useState } from 'react';
import { renderTextWithLatex } from '@/components/LatexRenderer';
import Loading from '@/components/Loading';

interface ExerciseItem {
  uuid?: string;
  id?: number;
  title: string;
  type: string;
  points: number;
  question: string;
  options?: Record<string, string>;
  correctOption?: string;
  answer?: string;
  hint?: string;
  created_at?: string;
}

interface Lesson {
  code: string;
  title: string;
  exercises: ExerciseItem[];
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

interface TableRow {
  id: string; // uuid or id or "NONE"
  chapterName: string;
  lessonTitle: string;
  exerciseItems: ExerciseItem[];
  answer: string;
  difficulty: string;
}

export default function DataPreviewerPage() {
  const [grades, setGrades] = useState<number[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<number | ''>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [tableData, setTableData] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Load available grades and subjects from fixtures
  useEffect(() => {
    const getSubjectNameFromFolder = (folder: string): string => {
      const map: Record<string, string> = {
        'math': 'Toán',
        'english': 'Tiếng Anh',
        'geography': 'Địa lý',
        'informatics': 'Tin học',
        'science': 'Khoa học',
        'history': 'Lịch sử',
        'literature': 'Ngữ văn',
      };
      return map[folder] || folder;
    };

    const loadAvailableOptions = async () => {
      try {
        // Get all fixture files from math, english, etc. folders
        const fixtureFolders = ['math', 'english', 'geography', 'informatics', 'science', 'history', 'literature'];
        const allGrades = new Set<number>();
        const allSubjects = new Set<string>();

        for (const folder of fixtureFolders) {
          try {
            // Try to load one file to get grade and subject info
            const subjectName = getSubjectNameFromFolder(folder);
            const response = await fetch(`/api/fixtures?grade=7&subject=${encodeURIComponent(subjectName)}&difficulty=easy`);
            if (response.ok) {
              const data: FixtureData = await response.json();
              allGrades.add(data.grade);
              allSubjects.add(data.subject);
            }
          } catch {
            // Skip if file doesn't exist
          }
        }

        // Also check grade5 files
        for (const folder of fixtureFolders) {
          try {
            const subjectName = getSubjectNameFromFolder(folder);
            const response = await fetch(`/api/fixtures?grade=5&subject=${encodeURIComponent(subjectName)}&difficulty=easy`);
            if (response.ok) {
              const data: FixtureData = await response.json();
              allGrades.add(data.grade);
              allSubjects.add(data.subject);
            }
          } catch {
            // Skip if file doesn't exist
          }
        }

        setGrades(Array.from(allGrades).sort((a, b) => a - b));
        setSubjects(Array.from(allSubjects).sort());
      } catch (err) {
        console.error('Error loading available options:', err);
      }
    };

    loadAvailableOptions();
  }, []);

  // Load fixture data when grade, subject, or difficulty are selected
  useEffect(() => {
    if (!selectedGrade || !selectedSubject) {
      setTableData([]);
      return;
    }

    const loadFixtureData = async () => {
      setLoading(true);
      setError('');
      
      try {
        // Map subject name to folder name
        const subjectMap: Record<string, string> = {
          'Toán': 'math',
          'Tiếng Anh': 'english',
          'Địa lý': 'geography',
          'Tin học': 'informatics',
          'Khoa học': 'science',
          'Lịch sử': 'history',
          'Ngữ văn': 'literature',
        };

        // Determine which difficulties to load
        const difficultiesToLoad = selectedDifficulty === 'all' 
          ? ['easy', 'medium', 'hard'] 
          : [selectedDifficulty];
        
        const allData: FixtureData[] = [];

        // Load selected difficulty level(s)
        for (const difficulty of difficultiesToLoad) {
          try {
            const response = await fetch(
              `/api/fixtures?grade=${selectedGrade}&subject=${encodeURIComponent(selectedSubject)}&difficulty=${difficulty}`
            );
            if (response.ok) {
              const data: FixtureData = await response.json();
              allData.push(data);
            }
          } catch {
            // Skip if file doesn't exist
          }
        }

        if (allData.length === 0) {
          setError(`Không tìm thấy dữ liệu cho ${selectedSubject} lớp ${selectedGrade}`);
          setTableData([]);
          setLoading(false);
          return;
        }

        // Merge all difficulty levels and create table rows
        const rows: TableRow[] = [];
        
        // Use the first data file as base (they should have same structure)
        const baseData = allData[0];
        
        // Collect all exercises from all difficulty levels
        const exerciseMap = new Map<string, ExerciseItem[]>();
        
        allData.forEach((data) => {
          data.chapters.forEach((chapter) => {
            chapter.lessons.forEach((lesson) => {
              const key = `${chapter.code}-${lesson.code}`;
              if (!exerciseMap.has(key)) {
                exerciseMap.set(key, []);
              }
              // Add exercises with difficulty info
              const exercisesWithDifficulty = lesson.exercises.map(ex => ({
                ...ex,
                difficulty: data.difficulty,
              }));
              exerciseMap.get(key)!.push(...exercisesWithDifficulty);
            });
          });
        });

        // Create table rows
        baseData.chapters.forEach((chapter) => {
          chapter.lessons.forEach((lesson) => {
            const key = `${chapter.code}-${lesson.code}`;
            const exercises = exerciseMap.get(key) || [];
            
            exercises.forEach((exercise) => {
              // Get answer
              let answer = '';
              if (exercise.type === 'multiple_choice' && exercise.correctOption) {
                answer = exercise.correctOption;
                if (exercise.options && exercise.options[exercise.correctOption]) {
                  answer = `${exercise.correctOption}: ${exercise.options[exercise.correctOption]}`;
                }
              } else if (exercise.answer) {
                answer = exercise.answer;
              }

              // Get ID (uuid or id)
              const exerciseId = exercise.uuid || exercise.id?.toString() || 'NONE';

              rows.push({
                id: exerciseId,
                chapterName: chapter.name,
                lessonTitle: lesson.title,
                exerciseItems: [exercise],
                answer: answer,
                difficulty: exercise.difficulty || 'unknown',
              });
            });
          });
        });

        setTableData(rows);
        // Clear selected rows when data changes
        setSelectedRows(new Set());
      } catch (err) {
        console.error('Error loading fixture data:', err);
        setError('Không thể tải dữ liệu. Vui lòng thử lại.');
        setTableData([]);
      } finally {
        setLoading(false);
      }
    };

    loadFixtureData();
  }, [selectedGrade, selectedSubject, selectedDifficulty]);

  return (
    <div className="min-h-screen relative">
      <nav className="bg-white shadow-colored">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gradient">
            Data Previewer - Xem dữ liệu từ Fixtures
          </h1>
        </div>
      </nav>

      <div className="w-full px-4 py-8">
        {/* Dropdowns */}
        <div className="card mb-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chọn lớp
              </label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value ? parseInt(e.target.value) : '')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Chọn lớp --</option>
                {grades.map((grade) => (
                  <option key={grade} value={grade}>
                    Lớp {grade}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chọn môn học
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={!selectedGrade}
              >
                <option value="">-- Chọn môn học --</option>
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chọn độ khó
              </label>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={!selectedGrade || !selectedSubject}
              >
                <option value="all">Tất cả</option>
                <option value="easy">Dễ</option>
                <option value="medium">Vừa</option>
                <option value="hard">Khó</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="card mb-6 bg-red-50 border-red-200">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && <Loading message="Đang tải dữ liệu..." />}

        {/* Table */}
        {!loading && tableData.length > 0 && (
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse min-w-full">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 min-w-[50px]">
                    <input
                      type="checkbox"
                      checked={tableData.length > 0 && selectedRows.size === tableData.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          // Select all
                          setSelectedRows(new Set(tableData.map((_, index) => index)));
                        } else {
                          // Deselect all
                          setSelectedRows(new Set());
                        }
                      }}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[150px]">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[200px]">
                    Tên chương
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[200px]">
                    Tên bài học
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[400px]">
                    Câu hỏi và các lựa chọn
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[200px]">
                    Đáp án
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[100px]">
                    Độ khó
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, index) => {
                  // Determine background color based on difficulty
                  let rowBgColor = '';
                  if (row.difficulty === 'easy') {
                    rowBgColor = 'bg-green-50 hover:bg-green-100';
                  } else if (row.difficulty === 'medium') {
                    rowBgColor = 'bg-yellow-50 hover:bg-yellow-100';
                  } else if (row.difficulty === 'hard') {
                    rowBgColor = 'bg-red-50 hover:bg-red-100';
                  } else {
                    rowBgColor = 'bg-gray-50 hover:bg-gray-100';
                  }

                  return (
                  <tr
                    key={index}
                    className={`border-b border-gray-200 ${rowBgColor} transition-colors`}
                  >
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(index)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedRows);
                          if (e.target.checked) {
                            newSelected.add(index);
                          } else {
                            newSelected.delete(index);
                          }
                          setSelectedRows(newSelected);
                        }}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800 font-mono">
                      {row.id}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      {renderTextWithLatex(row.chapterName)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      {renderTextWithLatex(row.lessonTitle)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {row.exerciseItems.map((exercise, exIndex) => (
                        <div key={exIndex} className="mb-4 last:mb-0">
                          <div className="font-medium text-gray-800 mb-2">
                            {renderTextWithLatex(exercise.title || exercise.question)}
                          </div>
                          {exercise.question && exercise.title && (
                            <div className="text-gray-700 mb-2">
                              {renderTextWithLatex(exercise.question)}
                            </div>
                          )}
                          {exercise.options && (
                            <div className="space-y-1 ml-4">
                              {Object.entries(exercise.options).map(([key, value]) => (
                                <div key={key} className="text-gray-600">
                                  <span className="font-medium">{key}:</span>{' '}
                                  {renderTextWithLatex(value)}
                                </div>
                              ))}
                            </div>
                          )}
                          {exercise.hint && (
                            <div className="mt-2 text-xs text-gray-500 italic">
                              💡 {renderTextWithLatex(exercise.hint)}
                            </div>
                          )}
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      {renderTextWithLatex(row.answer)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          row.difficulty === 'easy'
                            ? 'bg-green-100 text-green-700'
                            : row.difficulty === 'medium'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {row.difficulty === 'easy'
                          ? 'Dễ'
                          : row.difficulty === 'medium'
                          ? 'Vừa'
                          : row.difficulty === 'hard'
                          ? 'Khó'
                          : row.difficulty}
                      </span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && selectedGrade && selectedSubject && tableData.length === 0 && (
          <div className="card">
            <p className="text-gray-600 text-center py-8">
              Không có dữ liệu cho {selectedSubject} lớp {selectedGrade}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

