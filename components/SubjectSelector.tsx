'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { subjectRepository, type SubjectListItem } from '@/repositories/subject.repository';
import { useUser } from '@/contexts/UserContext';

interface SubjectSelectorProps {
  gradeId: number;
}

export default function SubjectSelector({ gradeId }: SubjectSelectorProps) {
  const router = useRouter();
  const { user } = useUser();
  const [subjects, setSubjects] = useState<SubjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const fetchingRef = useRef(false);
  const lastGradeIdRef = useRef<number | null>(null);

  const getDifficultyLabel = (level?: number | null) => {
    if (!level) return null;
    if (level <= 4) return 'Dễ';
    if (level <= 8) return 'Vừa';
    return 'Khó';
  };

  const difficultyLabel = getDifficultyLabel(user?.level);

  useEffect(() => {
    // Prevent duplicate calls for the same gradeId
    if (!gradeId || fetchingRef.current || lastGradeIdRef.current === gradeId) {
      return;
    }

    const fetchSubjects = async () => {
      fetchingRef.current = true;
      lastGradeIdRef.current = gradeId;
      
      try {
        setLoading(true);
        setError('');
        
        const data = await subjectRepository.getSubjects(gradeId);
        setSubjects(data.subjects);
      } catch (err) {
        setError('Không thể tải danh sách môn học');
        console.error('Failed to fetch subjects:', err);
        lastGradeIdRef.current = null; // Reset on error to allow retry
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    };

    fetchSubjects();
    
    // Cleanup function
    return () => {
      fetchingRef.current = false;
    };
  }, [gradeId]);

  const handleSubjectClick = (subject: SubjectListItem) => {
    // Navigate to subject page with gradeId and subjectId
    router.push(`/subjects/${subject.id}?gradeId=${subject.gradeId}`);
  };

  if (loading) {
    return (
      <div className="card">
        <h2 className="text-2xl font-semibold mb-4 text-gradient">Chọn môn học</h2>
        <div className="text-center py-8">
          <div className="text-gray-600">Đang tải danh sách môn học...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2 className="text-2xl font-semibold mb-4 text-gradient">Chọn môn học</h2>
        <div className="text-center py-8">
          <div className="text-red-600">{error}</div>
        </div>
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="card">
        <h2 className="text-2xl font-semibold mb-4 text-gradient">Chọn môn học</h2>
        <div className="text-center py-8">
          <p className="text-gray-600">Chưa có môn học nào cho lớp này.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card mb-6">
      <h2 className="text-2xl font-semibold mb-4 text-gradient">Chọn môn học</h2>
      <p className="text-gray-600 mb-6">
        Chọn môn học bạn muốn học để xem chương trình và bài tập.
      </p>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjects.map((subject) => (
          <button
            key={subject.id}
            onClick={() => handleSubjectClick(subject)}
            className="relative p-6 bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:shadow-lg transition-all text-left group"
          >
            {difficultyLabel && (
              <span 
                className="absolute bottom-2 right-2 px-2 py-1 text-xs font-medium rounded-full"
                style={{
                  backgroundColor: 'rgba(255, 107, 53, 0.1)',
                  color: 'var(--color-primary-orange)'
                }}
              >
                Cấp độ: {difficultyLabel}
              </span>
            )}
            <h3 className="text-xl font-semibold mb-2 text-gray-800 group-hover:text-indigo-600 transition-colors">
              {subject.name}
            </h3>
            {subject.description && (
              <p className="text-sm text-gray-600 line-clamp-2">
                {subject.description}
              </p>
            )}
            <div className="mt-4 flex items-center text-green-600 font-medium">
              <span>Bắt đầu học</span>
              <svg
                className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

