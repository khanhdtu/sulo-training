'use client';

import { useState, useEffect } from 'react';
import { userRepository } from '@/repositories/user.repository';

interface UpdateProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentGradeId?: number | null;
  currentLevel?: number | null;
  currentName?: string | null;
  currentParentEmail?: string | null;
}

export default function UpdateProfileModal({
  isOpen,
  onClose,
  onSuccess,
  currentGradeId,
  currentLevel,
  currentName,
  currentParentEmail,
}: UpdateProfileModalProps) {
  const [formData, setFormData] = useState({
    gradeId: currentGradeId || 7,
    difficulty: currentLevel ? (currentLevel <= 4 ? 'easy' : currentLevel <= 8 ? 'medium' : 'hard') : 'easy',
    displayName: currentName || '',
    parentEmail: currentParentEmail || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Always update formData when modal opens or when currentName/currentParentEmail changes
      // This ensures the fields show the current values
      setFormData((prev) => ({
        gradeId: currentGradeId || prev.gradeId || 7,
        difficulty: currentLevel 
          ? (currentLevel <= 4 ? 'easy' : currentLevel <= 8 ? 'medium' : 'hard') 
          : prev.difficulty || 'easy',
        displayName: currentName ?? prev.displayName ?? '', // Preserve existing value if currentName is null/undefined
        parentEmail: currentParentEmail ?? prev.parentEmail ?? '', // Preserve existing value if currentParentEmail is null/undefined
      }));
      setError('');
    }
  }, [isOpen, currentGradeId, currentLevel, currentName, currentParentEmail]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Map difficulty to level (1-4: easy, 5-8: medium, 9-12: hard)
      const levelMap: Record<string, number> = {
        easy: 1,
        medium: 5,
        hard: 9,
      };
      const level = levelMap[formData.difficulty] || 1;

      await userRepository.updateProfile({
        gradeId: formData.gradeId,
        level: level,
        displayName: formData.displayName || null,
        parentEmail: formData.parentEmail || null,
      });

      // Success
      onSuccess();
      onClose();
    } catch {
      setError('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay background - không cho phép click để đóng */}
      <div className="absolute inset-0 z-40 bg-black opacity-70"></div>
      
      {/* Modal content */}
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4 relative z-50">
        <h2 className="text-2xl font-bold mb-4 text-gradient">
          Cập nhật thông tin
        </h2>
        <p className="text-gray-600 mb-6">
          Vui lòng cập nhật thông tin Lớp học và Mức học để hệ thống đề xuất bài tập phù hợp.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Grade Selection */}
          <div>
            <label htmlFor="gradeId" className="block text-sm font-medium text-gray-700 mb-1">
              Lớp <span className="text-red-500">*</span>
            </label>
            <select
              id="gradeId"
              required
              value={formData.gradeId}
              onChange={(e) => setFormData({ ...formData, gradeId: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((grade) => (
                <option key={grade} value={grade}>
                  Lớp {grade}
                </option>
              ))}
            </select>
          </div>

          {/* Difficulty Selection */}
          <div>
            <label htmlFor="difficulty" className="block text-sm font-medium text-gray-700 mb-1">
              Mức học
            </label>
            <select
              id="difficulty"
              value={formData.difficulty}
              onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="easy">Dễ</option>
              <option value="medium">Vừa</option>
              <option value="hard">Khó</option>
            </select>
          </div>

          {/* Display Name */}
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
              Tên hiển thị
            </label>
            <input
              id="displayName"
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Nhập tên hiển thị (tùy chọn)"
            />
          </div>

          {/* Parent Email */}
          <div>
            <label htmlFor="parentEmail" className="block text-sm font-medium text-gray-700 mb-1">
              Email của phụ huynh (tùy chọn)
            </label>
            <input
              id="parentEmail"
              type="email"
              value={formData.parentEmail}
              onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Nhập email của phụ huynh (nếu có)"
            />
          </div>

          <div className="flex gap-3 pt-4">
            {/* Không có nút Hủy - chỉ có nút Cập nhật */}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Đang cập nhật...' : 'Cập nhật'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

