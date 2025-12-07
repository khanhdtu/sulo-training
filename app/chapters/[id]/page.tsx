'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { chapterRepository, type ChapterExercise } from '@/repositories/chapter.repository';
import { toast } from 'sonner';
import { renderTextWithLatex } from '@/components/LatexRenderer';
import Loading from '@/components/Loading';

export default function ChapterPage() {
  const router = useRouter();
  const params = useParams();
  const chapterId = params.id as string;

  const [chapter, setChapter] = useState<any>(null);
  const [exercises, setExercises] = useState<ChapterExercise[]>([]);
  const [currentExercise, setCurrentExercise] = useState<ChapterExercise | null>(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answersByExercise, setAnswersByExercise] = useState<Record<number, Record<string, string>>>({}); // Store answers by exercise ID
  const [answerImages, setAnswerImages] = useState<Record<string, File | null>>({}); // Store images for each question
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({}); // Store image preview URLs
  const [showHints, setShowHints] = useState<Set<number>>(new Set());
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [error, setError] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [missingQuestions, setMissingQuestions] = useState<number[]>([]);
  const fetchingRef = useRef<string | null>(null);
  const requestIdRef = useRef<number>(0);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!chapterId) {
      return;
    }
    
    // Prevent duplicate calls - check if already fetching this chapterId
    if (fetchingRef.current === chapterId) {
      return;
    }
    
    // Generate unique request ID for this fetch attempt
    const currentRequestId = ++requestIdRef.current;
    const isCancelledRef = { current: false };
    
    fetchingRef.current = chapterId;

    const fetchChapter = async () => {
      try {
        setLoading(true);
        setError('');

        const data = await chapterRepository.getChapterById(parseInt(chapterId));
        
        // Only update state if this request hasn't been cancelled
        if (!isCancelledRef.current && currentRequestId === requestIdRef.current) {
        setChapter(data.chapter);
        setExercises(data.exercises);
        setCurrentExercise(data.currentExercise);
        setCurrentExerciseIndex(data.currentExerciseIndex);

        // Initialize answers for current exercise
        if (data.currentExercise) {
          const initialAnswers: Record<string, string> = {};
          
          // Load previous answers if available
          if (data.currentExercise.attempt?.answers) {
            const savedAnswers = data.currentExercise.attempt.answers as Record<string, any>;
            // Convert answers to option keys if needed (for multiple choice)
            data.currentExercise.questions.forEach((q) => {
              const savedAnswer = savedAnswers[q.id.toString()];
              if (savedAnswer) {
                const answerValue = getAnswerValue(savedAnswer);
                // If it's a value (not a key), try to find the matching option key
                if (data.currentExercise && data.currentExercise.type === 'multiple_choice' && q.options) {
                  const options = q.options as Record<string, string>;
                  // Check if answerValue matches any option value
                  const matchingKey = Object.keys(options).find(
                    (key) => options[key] === answerValue || getAnswerValue(options[key]) === answerValue
                  );
                  initialAnswers[q.id.toString()] = matchingKey || answerValue;
                } else {
                  initialAnswers[q.id.toString()] = answerValue;
                }
              }
            });
            console.log('Loaded saved answers:', initialAnswers);
          }
          
          // Initialize empty answers for questions that don't have answers yet
          data.currentExercise.questions.forEach((q) => {
            if (!initialAnswers[q.id.toString()]) {
              initialAnswers[q.id.toString()] = '';
            }
          });
          
          // Save to answersByExercise
          setAnswersByExercise((prev) => ({
            ...prev,
            [data.currentExercise!.id]: initialAnswers,
          }));
          
          console.log('Initial answers:', initialAnswers);
          console.log('Current exercise questions:', data.currentExercise.questions.map(q => ({ id: q.id, question: q.question })));
          setAnswers(initialAnswers);
          setCurrentQuestionIndex(0); // Reset to first question
        }
          setLoading(false);
        }
      } catch (err) {
        // Only update state if this request hasn't been cancelled
        if (!isCancelledRef.current && currentRequestId === requestIdRef.current) {
          const errorMessage = err instanceof Error ? err.message : 'Không thể tải thông tin chương';
          setError(errorMessage);
          setLoading(false);
          console.error('Failed to fetch chapter:', err);
        }
      }
    };

    fetchChapter();
    
    // Cleanup function - mark this request as cancelled
    return () => {
      isCancelledRef.current = true;
      if (fetchingRef.current === chapterId) {
        fetchingRef.current = null;
      }
    };

    return () => {
      fetchingRef.current = null;
    };
  }, [chapterId]);

  // Cleanup image preview URLs when component unmounts
  useEffect(() => {
    return () => {
      Object.values(imagePreviews).forEach((url) => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, []);

  // Helper function to normalize answer values for comparison
  const normalizeAnswer = (value: string): string => {
    if (!value) return '';
    // Remove extra whitespace and normalize LaTeX formatting
    return value.trim().replace(/\s+/g, ' ').replace(/\\+/g, '\\');
  };

  // Helper function to get answer value (handles both string and object format)
  const getAnswerValue = (answer: string | { answer: string; isCorrect?: boolean } | undefined): string => {
    if (!answer) return '';
    if (typeof answer === 'string') return answer;
    if (typeof answer === 'object' && 'answer' in answer) return answer.answer;
    return '';
  };

  // Check if chapter has any draft exercises
  const hasDraftExercises = exercises.some((exercise) => {
    return exercise.attempt?.status === 'draft';
  });

  // Check if current exercise is draft
  const isCurrentExerciseDraft = currentExercise?.attempt?.status === 'draft';

  const handleAnswerChange = (questionId: number, answer: string) => {
    setAnswers((prev) => {
      const newAnswers = {
        ...prev,
        [questionId.toString()]: answer,
      };
      
      // Also save to answersByExercise for persistence across exercise switches
      if (currentExercise) {
        setAnswersByExercise((prevByExercise) => ({
          ...prevByExercise,
          [currentExercise.id]: newAnswers,
        }));
      }
      
      return newAnswers;
    });
  };

  // Check if all exercises have at least one answer
  const checkAllAnswers = (): { allAnswered: boolean; missing: number[] } => {
    if (!exercises || exercises.length === 0) {
      return { allAnswered: false, missing: [] };
    }

    const missing: number[] = [];
    
    exercises.forEach((exercise, exerciseIndex) => {
      // Check if exercise is completed
      const isCompleted = exercise.attempt?.isCompleted || false;
      
      // Check if exercise has answers from database
      const hasDbAnswers = exercise.attempt?.answers && 
        Object.keys(exercise.attempt.answers as Record<string, string>).length > 0;
      
      // Check if exercise has answers in memory (answersByExercise)
      const savedAnswers = answersByExercise[exercise.id];
      const hasMemoryAnswers = savedAnswers && 
        Object.values(savedAnswers).some((answer) => {
          const answerValue = getAnswerValue(answer);
          return answerValue && answerValue.trim() !== '';
        });
      
      // Check if current exercise has answers in current state
      let hasCurrentAnswers = false;
      if (exerciseIndex === currentExerciseIndex && currentExercise) {
        hasCurrentAnswers = currentExercise.questions.some((q) => {
          const answerValue = getAnswerValue(answers[q.id.toString()]);
          return answerValue && answerValue.trim() !== '';
        });
      }
      
      // If exercise doesn't have any answers, add to missing list
      if (!isCompleted && !hasDbAnswers && !hasMemoryAnswers && !hasCurrentAnswers) {
        missing.push(exerciseIndex + 1); // Exercise number (1-indexed)
      }
    });

    return {
      allAnswered: missing.length === 0,
      missing,
    };
  };

  const handleSubmitClick = () => {
    if (!currentExercise) return;

    const { allAnswered, missing } = checkAllAnswers();
    
    if (!allAnswered) {
      setMissingQuestions(missing);
      setShowSubmitModal(true);
    } else {
      // All answered, show confirmation
      setMissingQuestions([]);
      setShowSubmitModal(true);
    }
  };

  const handleConfirmSubmit = async () => {
    setShowSubmitModal(false);
    await handleSubmit();
  };

  const handleSubmit = async (isDraft: boolean = false) => {
    if (!currentExercise || !exercises || exercises.length === 0 || !chapter) return;

    setSubmitting(true);
    try {
      // Save current answers to answersByExercise before submitting
      const updatedAnswersByExercise = {
        ...answersByExercise,
        [currentExercise.id]: answers,
      };
      setAnswersByExercise(updatedAnswersByExercise);

      // Collect all exercises that have answers
      const exercisesAnswers: Record<string, Record<string, string>> = {};
      
      exercises.forEach((exercise) => {
        const exerciseAnswers = updatedAnswersByExercise[exercise.id];
        if (exerciseAnswers && Object.keys(exerciseAnswers).length > 0) {
            // Check if there's at least one non-empty answer
            const hasNonEmptyAnswer = Object.values(exerciseAnswers).some(
              (answer) => {
                const answerValue = getAnswerValue(answer);
                return answerValue && answerValue.trim() !== '';
              }
            );
            if (hasNonEmptyAnswer) {
              // Extract only answer strings for submission (not objects)
              // For multiple choice, ensure we send option keys (A, B, C, D) not values
              const cleanAnswers: Record<string, string> = {};
              
              exercise.questions.forEach((q) => {
                const answerValue = getAnswerValue(exerciseAnswers[q.id.toString()]);
                if (answerValue && answerValue.trim() !== '') {
                  if (exercise.type === 'multiple_choice' && q.options) {
                    const options = q.options as Record<string, string>;
                    // If answerValue is already a key (A, B, C, D), use it directly
                    if (/^[A-D]$/i.test(answerValue)) {
                      cleanAnswers[q.id.toString()] = answerValue.toUpperCase();
                    } else {
                      // If answerValue is a value, find the matching key
                      const matchingKey = Object.keys(options).find(
                        (key) => {
                          const optionValue = options[key];
                          return optionValue === answerValue || 
                                 optionValue.trim().toLowerCase() === answerValue.trim().toLowerCase() ||
                                 getAnswerValue(optionValue) === answerValue;
                        }
                      );
                      cleanAnswers[q.id.toString()] = matchingKey || answerValue;
                    }
                  } else {
                    // For essay questions, use the answer value as is
                    cleanAnswers[q.id.toString()] = answerValue;
                  }
                }
              });
              
              exercisesAnswers[exercise.id.toString()] = cleanAnswers;
            }
        }
      });

      if (Object.keys(exercisesAnswers).length === 0) {
        toast.error('Không có bài tập nào để lưu');
        setSubmitting(false);
        return;
      }

      // Submit all exercises in one request
      const response = await fetch(`/api/chapters/${chapterId}/submit`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chapterId: parseInt(chapterId), // Include chapterId in request body
          exercises: exercisesAnswers,
          status: isDraft ? 'draft' : 'submitted',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Có lỗi xảy ra');
      }

      if (isDraft) {
        toast.success('Đã lưu nháp thành công!');
        // Redirect to subjects page after saving draft
        if (chapter && chapter.subject) {
          router.push(`/subjects/${chapter.subject.id}?draft=true`);
        } else {
          router.push('/dashboard');
        }
      } else {
      toast.success(data.message || 'Đã nộp bài thành công!');

      // Redirect to chapters list page after successful submission
      if (chapter && chapter.subject) {
        router.push(`/subjects/${chapter.subject.id}`);
      } else {
        // Fallback to dashboard if chapter info is not available
        router.push('/dashboard');
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Có lỗi xảy ra. Vui lòng thử lại.';
      toast.error(errorMessage);
      console.error('Failed to submit chapter:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    await handleSubmit(true);
  };

  if (loading) {
    return <Loading message="Đang tải nội dung chương..." />;
  }

  if (error || !chapter) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-red-600">
            {error || 'Không tìm thấy chương'}
          </h1>
          <button
            onClick={() => router.push('/dashboard')}
            className="btn btn-primary"
          >
            Quay lại Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!currentExercise) {
    return (
      <div className="min-h-screen relative">
        <nav>
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(`/subjects/${chapter.subject.id}`)}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Quay lại
              </button>
              <h1 className="text-2xl font-bold text-gradient">{chapter.name}</h1>
            </div>
          </div>
        </nav>

        <div className="container mx-auto px-4 py-8">
          <div className="card text-center">
            <h2 className="text-2xl font-bold mb-4 text-green-600">
              Chúc mừng! 🎉
            </h2>
            <p className="text-gray-600 mb-6">
              Bạn đã hoàn thành tất cả bài tập trong chương này.
            </p>
            <button
              onClick={() => router.push(`/subjects/${chapter.subject.id}`)}
              className="btn btn-primary"
            >
              Quay lại môn học
            </button>
          </div>
        </div>
      </div>
    );
  }

  const progress = currentExerciseIndex !== null 
    ? Math.round(((currentExerciseIndex + 1) / exercises.length) * 100)
    : 0;

  return (
    <div className="min-h-screen relative">
      <nav>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/subjects/${chapter.subject.id}`)}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Quay lại
            </button>
            <h1 className="text-2xl font-bold text-gradient">{chapter.name}</h1>
            {currentExercise && (
              <span className={`px-3 py-1 text-xs rounded-full ${
                currentExercise.difficulty === 'easy' 
                  ? 'bg-green-100 text-green-700' 
                  : currentExercise.difficulty === 'medium' 
                  ? 'bg-yellow-100 text-yellow-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                Độ khó: {currentExercise.difficulty === 'easy' ? 'Dễ' : currentExercise.difficulty === 'medium' ? 'Vừa' : 'Khó'}
              </span>
            )}
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Tiến độ: {progress}%</span>
            <span>{currentExerciseIndex !== null ? currentExerciseIndex + 1 : 0} / {exercises.length}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Exercise Card */}
        <div className="card mb-6">
          {/* Draft Status Warning */}
          {isCurrentExerciseDraft && (
            <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded-r">
              <div className="flex items-start gap-2">
                <span className="text-yellow-600 text-lg">⚠️</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-800">Bài tập đang ở trạng thái nháp</p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Bạn cần nộp bài để xem đáp án và kết quả chấm điểm.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="mb-4">
            <h2 className="text-2xl font-semibold mb-2 text-gradient">
              {renderTextWithLatex(currentExercise.title)}
            </h2>
            {currentExercise.description && (
              <p className="text-gray-600 mb-4">
                {renderTextWithLatex(currentExercise.description)}
              </p>
            )}
            <div className="relative flex gap-2 mb-4 items-center">
              <div className="flex gap-2">
              <span className="px-3 py-1 text-xs rounded-full bg-indigo-100 text-indigo-700">
                {currentExercise.type === 'multiple_choice' ? 'Trắc nghiệm' : 'Tự luận'}
              </span>
            </div>
              {/* Buttons for hint and AI assistant - only show if there's a current question */}
              {currentExercise.questions && currentExercise.questions.length > 0 && (() => {
                const question = currentExercise.questions[currentQuestionIndex];
                if (!question) return null;

                return (
                  <div className="absolute right-0 flex gap-2">
                      {question.hint && (
                        <button
                          onClick={() => {
                            setShowHints(prev => {
                              const newSet = new Set(prev);
                              if (newSet.has(question.id)) {
                                newSet.delete(question.id);
                              } else {
                                newSet.add(question.id);
                              }
                              return newSet;
                            });
                          }}
                        className="px-3 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {showHints.has(question.id) ? 'Ẩn gợi ý' : 'Xem gợi ý'}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          // Send question to chat widget
                          const questionText = `Câu hỏi: ${question.question}\n\nTôi cần hỗ trợ giải thích về câu hỏi này.`;
                          const event = new CustomEvent('chatWidget:sendMessage', {
                            detail: { message: questionText },
                          });
                          window.dispatchEvent(event);
                        }}
                      className="px-3 py-1 text-xs rounded-full bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Hỏi trợ lý AI
                      </button>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Questions - Only show current question */}
          {!currentExercise.questions || currentExercise.questions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Bài tập này chưa có câu hỏi.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {(() => {
                const question = currentExercise.questions[currentQuestionIndex];
                if (!question) {
                  return (
                    <div className="text-center py-4 text-gray-500">
                      <p>Không tìm thấy câu hỏi.</p>
                    </div>
                  );
                }

                const answerValue = getAnswerValue(answers[question.id.toString()]);
                const hasAnswer = answerValue && answerValue.trim() !== '';

                return (
                  <div key={question.id} className="border-l-4 border-indigo-500 pl-4 relative">
                    <div className="mb-3">
                      <span className="text-sm font-medium text-gray-500">
                        Câu {currentQuestionIndex + 1} / {currentExercise.questions.length}
                      </span>
                      <div className="text-lg font-medium mt-1" style={{ color: '#000' }}>
                        {renderTextWithLatex(question.question)}
                      </div>
                    </div>

                    {currentExercise.type === 'multiple_choice' && question.options ? (
                      <div className="space-y-2">
                        {Object.entries(question.options as Record<string, string>).map(([key, value], optIndex) => {
                          const savedAnswer = getAnswerValue(answers[question.id.toString()]);
                          // Compare option keys (A, B, C, D) instead of values
                          const isChecked = savedAnswer === key;
                          
                          return (
                            <label
                              key={optIndex}
                              className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                            >
                              <input
                                type="radio"
                                name={`question-${question.id}`}
                                value={key}
                                checked={isChecked}
                                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                className="mr-3"
                              />
                              <span className="font-medium mr-2">{key}:</span>
                              <span>{renderTextWithLatex(value)}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="relative">
                          <textarea
                            value={getAnswerValue(answers[question.id.toString()])}
                            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                            placeholder="Nhập câu trả lời của bạn..."
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent pr-12"
                            rows={4}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const input = fileInputRefs.current[question.id.toString()];
                              if (input) {
                                input.click();
                              }
                            }}
                            className="absolute right-2 top-2 p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Chụp ảnh hoặc chọn ảnh"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-6 w-6"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                            </svg>
                          </button>
                          <input
                            ref={(el) => {
                              fileInputRefs.current[question.id.toString()] = el;
                            }}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const questionId = question.id.toString();
                                
                                // Validate file size (max 5MB)
                                if (file.size > 5 * 1024 * 1024) {
                                  toast.error('Kích thước ảnh không được vượt quá 5MB');
                                  return;
                                }
                                
                                // Validate file type
                                if (!file.type.startsWith('image/')) {
                                  toast.error('Vui lòng chọn file ảnh');
                                  return;
                                }
                                
                                // Store file
                                setAnswerImages((prev) => ({
                                  ...prev,
                                  [questionId]: file,
                                }));
                                
                                // Create preview URL
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setImagePreviews((prev) => ({
                                    ...prev,
                                    [questionId]: reader.result as string,
                                  }));
                                };
                                reader.readAsDataURL(file);
                                
                                toast.success('Đã chọn ảnh thành công');
                              }
                            }}
                          />
                        </div>
                        
                        {/* Image Preview */}
                        {imagePreviews[question.id.toString()] && (
                          <div className="relative inline-block">
                            <img
                              src={imagePreviews[question.id.toString()]}
                              alt="Preview"
                              className="max-w-full h-auto max-h-64 rounded-lg border border-gray-300"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const questionId = question.id.toString();
                                setAnswerImages((prev) => {
                                  const newState = { ...prev };
                                  delete newState[questionId];
                                  return newState;
                                });
                                setImagePreviews((prev) => {
                                  const newState = { ...prev };
                                  delete newState[questionId];
                                  return newState;
                                });
                                // Reset file input
                                const input = fileInputRefs.current[questionId];
                                if (input) {
                                  input.value = '';
                                }
                                toast.success('Đã xóa ảnh');
                              }}
                              className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                              title="Xóa ảnh"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {question.hint && showHints.has(question.id) && (
                      <div className="mt-3 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded-r">
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
                );
              })()}
            </div>
          )}

          {/* Pagination - Exercise Navigation (above submit button) */}
          {exercises.length > 0 && (
            <div className="mt-6 pt-6 border-t mb-4">
              <p className="text-sm font-medium text-gray-700 text-center mb-3">
                Bài tập: {currentExerciseIndex !== null ? currentExerciseIndex + 1 : 0} / {exercises.length}
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {exercises.map((exercise, index) => {
                  const isCompleted = exercise.attempt?.isCompleted || false;
                  const hasAnswers = exercise.attempt?.answers && 
                    Object.keys(exercise.attempt.answers as Record<string, string>).length > 0;
                  const isCurrent = index === currentExerciseIndex;
                  
                  // Check if exercise has answers in state (for real-time updates)
                  let hasCurrentAnswers = false;
                  
                  if (isCurrent && currentExercise) {
                    // If exercise is current, check if it has at least one answer in current state
                    hasCurrentAnswers = currentExercise.questions.some((q) => {
                      const answerValue = getAnswerValue(answers[q.id.toString()]);
                      return answerValue && answerValue.trim() !== '';
                    });
                  } else {
                    // If exercise is not current, check answersByExercise for saved answers
                    const savedAnswers = answersByExercise[exercise.id];
                    if (savedAnswers) {
                      // Check if at least one question has an answer in saved state
                      hasCurrentAnswers = Object.values(savedAnswers).some((answer) => {
                        const answerValue = getAnswerValue(answer);
                        return answerValue && answerValue.trim() !== '';
                      });
                    }
                  }
                  
                  // Allow clicking on any exercise - no restrictions
                  const canClick = true;

                  const handleExerciseClick = (e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Use existing data from state, no API call needed
                    const targetExercise = exercises[index];
                    
                    if (!targetExercise) {
                      toast.error(`Không tìm thấy bài tập số ${index + 1}.`);
                      return;
                    }

                    // Check if exercise has questions
                    if (!targetExercise.questions || targetExercise.questions.length === 0) {
                      toast.warning('Bài tập này chưa có câu hỏi.');
                      return;
                    }

                    // Save current exercise answers before switching
                    if (currentExercise) {
                      setAnswersByExercise((prev) => ({
                        ...prev,
                        [currentExercise.id]: answers,
                      }));
                    }

                    // Set the selected exercise as current
                    setCurrentExercise(targetExercise);
                    setCurrentExerciseIndex(index);
                    
                    // Initialize answers - check multiple sources in priority order:
                    // 1. answersByExercise (in-memory state from current session)
                    // 2. attempt.answers (saved from database)
                    // 3. Empty answers
                    let initialAnswers: Record<string, string> = {};
                    
                    // First, check if we have answers in memory for this exercise
                    if (answersByExercise[targetExercise.id]) {
                      initialAnswers = { ...answersByExercise[targetExercise.id] };
                    } else if (targetExercise.attempt?.answers) {
                      // Load previous answers from database if available
                      const savedAnswers = targetExercise.attempt.answers as Record<string, any>;
                      // Convert answers to option keys if needed (for multiple choice)
                      targetExercise.questions.forEach((q) => {
                        const savedAnswer = savedAnswers[q.id.toString()];
                        if (savedAnswer) {
                          const answerValue = getAnswerValue(savedAnswer);
                          // If it's a value (not a key), try to find the matching option key
                          if (targetExercise.type === 'multiple_choice' && q.options) {
                            const options = q.options as Record<string, string>;
                            // Check if answerValue matches any option value
                            const matchingKey = Object.keys(options).find(
                              (key) => options[key] === answerValue || getAnswerValue(options[key]) === answerValue
                            );
                            initialAnswers[q.id.toString()] = matchingKey || answerValue;
                          } else {
                            initialAnswers[q.id.toString()] = answerValue;
                          }
                        }
                      });
                    }
                    
                    // Ensure all questions have an entry (even if empty)
                    targetExercise.questions.forEach((q) => {
                      if (!initialAnswers[q.id.toString()]) {
                        initialAnswers[q.id.toString()] = '';
                      }
                    });
                    
                    // Save to answersByExercise for future reference
                    setAnswersByExercise((prev) => ({
                      ...prev,
                      [targetExercise.id]: initialAnswers,
                    }));
                    
                    setAnswers(initialAnswers);
                    setCurrentQuestionIndex(0);
                    setShowHints(new Set());
                    
                    // Reset image states when switching exercises
                    setAnswerImages({});
                    setImagePreviews({});
                    
                    // Scroll to top of exercise card
                    setTimeout(() => {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }, 100);
                  };

                  // Determine if exercise has answers (from attempt, database, or current state)
                  // Include hasCurrentAnswers for both current and non-current exercises
                  const exerciseHasAnswers = isCompleted || hasAnswers || hasCurrentAnswers;

                  return (
                    <button
                      key={exercise.id}
                      onClick={handleExerciseClick}
                      className={`w-10 h-10 rounded-lg font-medium transition-all flex items-center justify-center cursor-pointer ${
                        isCurrent
                          ? 'text-white ring-2 scale-110 shadow-lg'
                          : exerciseHasAnswers
                          ? 'bg-green-500 text-white hover:bg-green-600'
                          : 'text-white'
                      }`}
                      style={
                        isCurrent && hasCurrentAnswers
                          ? {
                              background: 'linear-gradient(135deg, #10b981, #059669)',
                              boxShadow: '0 0 0 2px #10b981, 0 4px 15px rgba(16, 185, 129, 0.4)',
                            }
                          : isCurrent
                          ? {
                              background: 'linear-gradient(135deg, var(--color-primary-orange), var(--color-primary-orange-light))',
                              boxShadow: '0 0 0 2px var(--color-primary-orange), 0 4px 15px rgba(255, 107, 53, 0.4)',
                            }
                          : !exerciseHasAnswers
                          ? {
                              background: 'linear-gradient(135deg, var(--color-primary-orange), var(--color-primary-orange-light))',
                            }
                          : undefined
                      }
                      onMouseEnter={(e) => {
                        if (isCurrent && hasCurrentAnswers) {
                          e.currentTarget.style.background = 'linear-gradient(135deg, #059669, #10b981)';
                        } else if (!isCurrent && !exerciseHasAnswers) {
                          e.currentTarget.style.background = 'linear-gradient(135deg, var(--color-primary-orange-light), var(--color-primary-orange))';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (isCurrent && hasCurrentAnswers) {
                          e.currentTarget.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                        } else if (!isCurrent && !exerciseHasAnswers) {
                          e.currentTarget.style.background = 'linear-gradient(135deg, var(--color-primary-orange), var(--color-primary-orange-light))';
                        }
                      }}
                      title={`Bài ${index + 1}${isCompleted ? ' (đã hoàn thành)' : exerciseHasAnswers ? ' (đã có câu trả lời)' : isCurrent ? ' (đang làm)' : ' (chưa làm)'}`}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="mt-6 pt-6 border-t">
            <div className="flex gap-3">
              <button
                onClick={() => {
                  // Redirect to subjects page without saving anything
                  if (chapter && chapter.subject) {
                    router.push(`/subjects/${chapter.subject.id}`);
                  } else {
                    router.push('/subjects');
                  }
                }}
                disabled={submitting}
                className="flex-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg px-4 py-2 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Hủy</span>
              </button>
              <button
                onClick={handleSaveDraft}
                disabled={submitting}
                className="btn btn-secondary flex-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    <span>Lưu nháp</span>
                  </>
                )}
              </button>
            <button
              onClick={handleSubmitClick}
              disabled={submitting}
                className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Đang nộp...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Nộp bài</span>
                  </>
                )}
            </button>
            </div>
          </div>
        </div>

        {/* Submit Confirmation Modal */}
        {showSubmitModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <h3 className="text-xl font-bold mb-4">
                {missingQuestions.length > 0 ? '⚠️ Cảnh báo' : '✅ Xác nhận nộp bài'}
              </h3>
              
              {missingQuestions.length > 0 ? (
                <div>
                  <p className="text-gray-700 mb-4">
                    Bạn chưa làm đủ tất cả các bài tập. Các bài tập còn thiếu:
                  </p>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <p className="font-medium text-yellow-800 mb-2">
                      Bài tập số: {missingQuestions.join(', ')}
                    </p>
                    <p className="text-sm text-yellow-700">
                      Bạn có muốn tiếp tục nộp bài không?
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-700 mb-4">
                  Bạn đã làm đầy đủ tất cả các bài tập. Bạn có chắc chắn muốn nộp bài không?
                </p>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleConfirmSubmit}
                  className={`px-4 py-2 rounded-lg text-white transition-colors ${
                    missingQuestions.length > 0
                      ? 'bg-yellow-500 hover:bg-yellow-600'
                      : 'bg-green-500 hover:bg-green-600'
                  }`}
                >
                  {missingQuestions.length > 0 ? 'Vẫn nộp bài' : 'Xác nhận nộp bài'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

