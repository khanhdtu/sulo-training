'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { subjectRepository, type Subject } from '@/repositories/subject.repository';
import { renderTextWithLatex } from '@/components/LatexRenderer';
import Loading from '@/components/Loading';
import { toast } from 'sonner';

// Types are imported from repository

export default function SubjectPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const subjectId = params.id as string;

  const [subject, setSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestIdRef = useRef<number>(0);

  useEffect(() => {
    if (!subjectId) {
      return;
    }
    
    // Check if redirected from draft save
    const draftParam = searchParams.get('draft');
    if (draftParam === 'true') {
      toast.success('Đã lưu nháp thành công! Bạn có thể tiếp tục làm bài sau.');
      // Remove query param from URL
      router.replace(`/subjects/${subjectId}`, { scroll: false });
    }
    
    // Generate unique request ID for this fetch attempt
    const currentRequestId = ++requestIdRef.current;
    const isCancelledRef = { current: false };
    
    const fetchSubject = async () => {
      try {
        setLoading(true);
        setError('');
        
        const data = await subjectRepository.getSubjectById(parseInt(subjectId));
        
        // Only update state if this request hasn't been cancelled
        if (!isCancelledRef.current && currentRequestId === requestIdRef.current) {
          setSubject(data.subject);
          setLoading(false);
        }
      } catch (err) {
        // Only update state if this request hasn't been cancelled
        if (!isCancelledRef.current && currentRequestId === requestIdRef.current) {
          const errorMessage = err instanceof Error ? err.message : 'Không thể tải thông tin môn học';
          if (errorMessage.includes('404') || errorMessage.includes('Không tìm thấy')) {
            setError('Không tìm thấy môn học');
          } else {
            setError(errorMessage);
          }
          setLoading(false);
          console.error('Failed to fetch subject:', err);
        }
      }
    };

    fetchSubject();
    
    // Cleanup function - mark this request as cancelled
    return () => {
      isCancelledRef.current = true;
    };
  }, [subjectId, searchParams, router]);


  if (loading) {
    return <Loading message="Đang tải thông tin môn học..." />;
  }

  if (error || !subject) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-red-600">
            {error || 'Không tìm thấy môn học'}
          </h1>
          <button
            onClick={() => router.push('/dashboard')}
            className="btn btn-primary flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Quay lại Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <nav>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Quay lại
            </button>
            <h1 className="text-2xl font-bold text-gradient">
              {subject.name} {subject.grade.level} (năm học 2025 - 2026)
            </h1>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Chapters */}
        {subject.chapters.length === 0 ? (
          <div className="card">
            <p className="text-gray-600 text-center py-8">
              Chưa có nội dung cho môn học này.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {subject.chapters.map((chapter) => (
              <div key={chapter.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2 text-gradient">
                      {chapter.name.toLowerCase().includes('chương') 
                        ? renderTextWithLatex(chapter.name)
                        : (
                            <>
                              Chương {chapter.order}: {renderTextWithLatex(chapter.name)}
                            </>
                          )}
                    </h3>
                    {chapter.description && (
                      <p className="text-gray-600 mb-3">
                        {renderTextWithLatex(chapter.description)}
                      </p>
                    )}
                    {/* Progress Bar - Show only for chapters that have started (not 'not_started') */}
                    {chapter.progress && chapter.progress.status !== 'not_started' && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                          <span>Tiến độ: {chapter.progress.progress}%</span>
                          <span>
                            {chapter.progress.completedExercises ?? chapter.progress.completedSections ?? 0} / {chapter.progress.totalExercises ?? chapter.progress.totalSections ?? 0} bài tập
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              chapter.progress.status === 'completed'
                                ? 'bg-green-500'
                                : 'bg-indigo-500'
                            }`}
                            style={{ width: `${chapter.progress.progress}%` }}
                          />
                        </div>
                        {/* Show correct/total questions if available */}
                        {chapter.progress.correctQuestions !== undefined && chapter.progress.totalQuestions !== undefined && (
                          <div className="text-sm text-gray-700 mt-2">
                            <span className="font-medium">
                              Số câu đúng: {chapter.progress.correctQuestions} / {chapter.progress.totalQuestions}
                            </span>
                            {chapter.progress.totalQuestions > 0 && (
                              <span className="text-gray-500 ml-2">
                                ({Math.round((chapter.progress.correctQuestions / chapter.progress.totalQuestions) * 100)}%)
                              </span>
                            )}
                          </div>
                        )}
                        {chapter.progress.status === 'completed' && (
                          <div className="text-xs text-green-600 mt-1 font-medium">
                            ✓ Đã hoàn thành
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="ml-4 flex-shrink-0 flex flex-col gap-2">
                    {(() => {
                      // Check if chapter has any draft exercises
                      const hasDraftExercises = chapter.sections.some((section) =>
                        section.exercises.some((exercise) => exercise.attempt?.status === 'draft')
                      );
                      
                      // If chapter has draft exercises, show "Tiếp tục" instead of "Bắt đầu học"
                      if (hasDraftExercises) {
                        return (
                          <button
                            onClick={() => router.push(`/chapters/${chapter.id}`)}
                            className="btn btn-primary whitespace-nowrap flex items-center gap-2"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            Tiếp tục
                          </button>
                        );
                      }
                      
                      // If chapter has progress and is in progress, show "Tiếp tục" only (no "Xem đáp án" until completed)
                      if (chapter.progress && chapter.progress.status !== 'not_started') {
                        return (
                          <>
                            {chapter.progress.status === 'in_progress' ? (
                              // Chapter in progress - only show "Tiếp tục", no "Xem đáp án"
                              <button
                                onClick={() => router.push(`/chapters/${chapter.id}`)}
                                className="btn btn-primary whitespace-nowrap flex items-center gap-2"
                              >
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                Tiếp tục
                              </button>
                            ) : chapter.progress.status === 'completed' ? (
                              // Chapter completed - only show "Xem đáp án"
                              <button
                                onClick={() => router.push(`/chapters/${chapter.id}/answers`)}
                                className="btn btn-outline whitespace-nowrap text-sm flex items-center gap-2"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                  />
                                </svg>
                                Xem đáp án
                              </button>
                            ) : null}
                          </>
                        );
                      }
                      
                      // Default: show "Bắt đầu học" for new chapters
                      return (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            router.push(`/chapters/${chapter.id}`);
                          }}
                          className="btn btn-primary whitespace-nowrap flex items-center gap-2"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          Bắt đầu học
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

