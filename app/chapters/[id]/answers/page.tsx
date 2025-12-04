'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { renderTextWithLatex } from '@/components/LatexRenderer';

interface ExerciseQuestion {
  id: number;
  question: string;
  answer: string;
  options: any;
  points: number;
  order: number;
  hint: string | null;
}

interface Exercise {
  id: number;
  title: string;
  description: string;
  difficulty: string;
  type: string;
  points: number;
  questions: ExerciseQuestion[];
  sectionId: number;
  sectionName: string;
  userAnswers: Record<string, { answer: string; isCorrect: boolean }> | null;
}

interface ChapterAnswersData {
  chapter: {
    id: number;
    name: string;
    description: string | null;
    order: number;
    subject: {
      id: number;
      name: string;
      gradeId: number;
      grade: {
        id: number;
        name: string;
        level: number;
      };
    };
  };
  exercises: Exercise[];
}

export default function ChapterAnswersPage() {
  const router = useRouter();
  const params = useParams();
  const chapterId = params.id as string;

  const [data, setData] = useState<ChapterAnswersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAnswers = async () => {
      if (!chapterId) return;

      try {
        setLoading(true);
        setError('');

        const response = await fetch(`/api/chapters/${chapterId}/answers`, {
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Không thể tải đáp án');
        }

        const result = await response.json();
        // API returns data directly, not wrapped in { data: ... }
        setData(result);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Không thể tải đáp án';
        setError(errorMessage);
        console.error('Failed to fetch answers:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnswers();
  }, [chapterId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Đang tải...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-red-600">
            {error || 'Không tìm thấy đáp án'}
          </h1>
          <button
            onClick={() => router.push(`/subjects/${data?.chapter.subject.id || ''}`)}
            className="btn btn-primary"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <nav className="bg-white shadow-colored">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/subjects/${data.chapter.subject.id}`)}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Quay lại
            </button>
            <h1 className="text-2xl font-bold text-gradient">
              Đáp án: {data.chapter.name}
            </h1>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {data.exercises.length === 0 ? (
          <div className="card">
            <p className="text-gray-600 text-center py-8">
              Chưa có bài tập nào trong chương này.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {data.exercises.map((exercise, exerciseIndex) => (
              <div key={exercise.id} className="card">
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-xl font-semibold text-gradient">
                      Bài {exerciseIndex + 1}: {renderTextWithLatex(exercise.title)}
                    </h2>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      exercise.difficulty === 'easy' 
                        ? 'bg-green-100 text-green-700' 
                        : exercise.difficulty === 'medium' 
                        ? 'bg-yellow-100 text-yellow-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {exercise.difficulty === 'easy' ? 'Dễ' : exercise.difficulty === 'medium' ? 'Vừa' : 'Khó'}
                    </span>
                  </div>
                  {exercise.description && (
                    <p className="text-gray-600 mb-2">
                      {renderTextWithLatex(exercise.description)}
                    </p>
                  )}
                  <div className="flex gap-2 text-sm text-gray-500">
                    <span>{exercise.type === 'multiple_choice' ? 'Trắc nghiệm' : 'Tự luận'}</span>
                    <span>•</span>
                    <span>{exercise.points} điểm</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {exercise.questions.map((question, questionIndex) => (
                    <div key={question.id} className="border-l-4 border-green-500 pl-4">
                      <div className="mb-2">
                        <span className="text-sm font-medium text-gray-500">
                          Câu {questionIndex + 1}
                        </span>
                        <p className="text-lg font-medium text-gray-800 mt-1">
                          {renderTextWithLatex(question.question)}
                        </p>
                      </div>

                      {exercise.type === 'multiple_choice' && question.options ? (
                        <div className="space-y-2 mb-3">
                          {Object.entries(question.options as Record<string, string>).map(([key, value]) => {
                            const isCorrect = key === question.answer;
                            const userAnswer = exercise.userAnswers?.[question.id.toString()];
                            const isUserAnswer = userAnswer && userAnswer.answer === key;
                            const userIsCorrect = userAnswer?.isCorrect === true;
                            
                            // Determine background color
                            let bgColor = 'bg-gray-50 border-gray-300';
                            if (isCorrect) {
                              bgColor = 'bg-green-50 border-green-500';
                            }
                            if (isUserAnswer && !userIsCorrect) {
                              bgColor = 'bg-red-50 border-red-500';
                            }
                            
                            return (
                              <div
                                key={key}
                                className={`p-3 border rounded-lg ${bgColor}`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{key}:</span>
                                  <span>{renderTextWithLatex(value)}</span>
                                  <div className="ml-auto flex items-center gap-2">
                                    {isUserAnswer && (
                                      <span className={`font-bold ${
                                        userIsCorrect ? 'text-green-600' : 'text-red-600'
                                      }`}>
                                        {userIsCorrect ? '✓' : '✗'} Lựa chọn của bạn
                                      </span>
                                    )}
                                    {isCorrect && (
                                      <span className="text-green-600 font-bold">
                                        {isUserAnswer ? '' : '✓ Đáp án đúng'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="space-y-2 mb-3">
                          {/* Correct answer */}
                          <div className="p-3 bg-green-50 border border-green-500 rounded-lg">
                            <div className="flex items-start gap-2">
                              <span className="text-green-600 font-bold">Đáp án đúng:</span>
                              <div className="flex-1">
                                <p className="text-gray-800">
                                  {renderTextWithLatex(question.answer)}
                                </p>
                              </div>
                            </div>
                          </div>
                          {/* User answer if exists */}
                          {exercise.userAnswers?.[question.id.toString()] && (
                            <div className={`p-3 border rounded-lg ${
                              exercise.userAnswers[question.id.toString()].isCorrect
                                ? 'bg-green-50 border-green-500'
                                : 'bg-red-50 border-red-500'
                            }`}>
                              <div className="flex items-start gap-2">
                                <span className={`font-bold ${
                                  exercise.userAnswers[question.id.toString()].isCorrect
                                    ? 'text-green-600'
                                    : 'text-red-600'
                                }`}>
                                  {exercise.userAnswers[question.id.toString()].isCorrect ? '✓' : '✗'} Lựa chọn của bạn:
                                </span>
                                <div className="flex-1">
                                  <p className="text-gray-800">
                                    {renderTextWithLatex(exercise.userAnswers[question.id.toString()].answer)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {question.hint && (
                        <div className="mt-2 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded-r">
                          <div className="flex items-start gap-2">
                            <span className="text-yellow-600 text-lg">💡</span>
                            <div className="flex-1">
                              <span className="text-sm font-medium text-yellow-800">Gợi ý:</span>
                              <p className="text-sm text-yellow-700 mt-1">
                                {renderTextWithLatex(question.hint)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

