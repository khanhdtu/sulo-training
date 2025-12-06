'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { subjectRepository, type Subject } from '@/repositories/subject.repository';
import { renderTextWithLatex } from '@/components/LatexRenderer';

// Types are imported from repository

export default function SubjectPage() {
  const router = useRouter();
  const params = useParams();
  const subjectId = params.id as string;

  const [subject, setSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestIdRef = useRef<number>(0);

  useEffect(() => {
    if (!subjectId) {
      return;
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
  }, [subjectId]);


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Đang tải...</div>
      </div>
    );
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
            className="btn btn-primary"
          >
            Quay lại Dashboard
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
              onClick={() => router.push('/dashboard')}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Quay lại
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
                      Chương {chapter.order}: {renderTextWithLatex(chapter.name)}
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
                    {chapter.progress && chapter.progress.status !== 'not_started' ? (
                      <>
                        {chapter.progress.status === 'in_progress' ? (
                          <>
                            <button
                              onClick={() => router.push(`/chapters/${chapter.id}`)}
                              className="btn btn-primary whitespace-nowrap"
                            >
                              Tiếp tục
                            </button>
                            <button
                              onClick={() => router.push(`/chapters/${chapter.id}/answers`)}
                              className="btn btn-outline whitespace-nowrap text-sm"
                            >
                              Xem đáp án
                            </button>
                          </>
                        ) : (
                          // Chapter completed (đã submit) - chỉ hiển thị nút "Xem đáp án"
                          <button
                            onClick={() => router.push(`/chapters/${chapter.id}/answers`)}
                            className="btn btn-outline whitespace-nowrap text-sm"
                          >
                            Xem đáp án
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push(`/chapters/${chapter.id}`);
                        }}
                        className="btn btn-primary whitespace-nowrap"
                      >
                        Bắt đầu học
                      </button>
                    )}
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

