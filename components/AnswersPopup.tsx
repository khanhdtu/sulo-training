'use client';

import { useEffect, useState } from 'react';
import { renderTextWithLatex } from './LatexRenderer';

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
  sectionId?: number;
  sectionName?: string;
  chapterName?: string;
  userAnswers: Record<string, { answer: string; isCorrect: boolean }> | null;
}

interface AnswersData {
  type: 'subject' | 'ai';
  subject?: {
    id: number;
    name: string;
  };
  exercises?: Exercise[];
  messages?: Array<{
    id: number;
    content: string;
    createdAt: string;
    conversationTitle: string;
  }>;
}

interface AnswersPopupProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  subjectName?: string;
  date: string;
  isAI?: boolean;
}

export default function AnswersPopup({
  isOpen,
  onClose,
  username,
  subjectName,
  date,
  isAI = false,
}: AnswersPopupProps) {
  const [data, setData] = useState<AnswersData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setData(null);
      setError('');
      return;
    }

    const fetchAnswers = async () => {
      try {
        setLoading(true);
        setError('');

        const params = new URLSearchParams({
          username,
          date,
        });

        if (isAI) {
          params.append('ai', 'true');
        } else if (subjectName) {
          params.append('subject', subjectName);
        }

        const response = await fetch(`/api/daily-activity-stats/answers?${params.toString()}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Không thể tải đáp án');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
        console.error('Failed to fetch answers:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnswers();
  }, [isOpen, username, subjectName, date, isAI]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">
            {isAI
              ? 'Câu hỏi trợ lý AI'
              : data?.subject
              ? `Đáp án: ${data.subject.name}`
              : 'Đáp án'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-xl">Đang tải...</div>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-red-600 text-lg">{error}</p>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {data.type === 'ai' && data.messages ? (
                <div className="space-y-4">
                  {data.messages.map((message, index) => (
                    <div key={message.id} className="border-l-4 border-orange-500 pl-4">
                      <div className="mb-2">
                        <span className="text-sm font-medium text-gray-500">
                          Câu hỏi {index + 1}
                        </span>
                        {message.conversationTitle && (
                          <span className="text-xs text-gray-400 ml-2">
                            ({message.conversationTitle})
                          </span>
                        )}
                      </div>
                      <p className="text-gray-800">{renderTextWithLatex(message.content)}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(message.createdAt).toLocaleString('vi-VN')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : data.type === 'subject' && data.exercises ? (
                <div className="space-y-8">
                  {data.exercises.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-600">Chưa có bài tập nào trong môn học này.</p>
                    </div>
                  ) : (
                    data.exercises.map((exercise, exerciseIndex) => (
                      <div key={exercise.id} className="border border-gray-200 rounded-lg p-6">
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-xl font-semibold text-gray-800">
                              Bài {exerciseIndex + 1}: {renderTextWithLatex(exercise.title)}
                            </h3>
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
                          {exercise.chapterName && (
                            <p className="text-sm text-gray-500 mb-1">
                              {exercise.chapterName}
                            </p>
                          )}
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
                    ))
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

