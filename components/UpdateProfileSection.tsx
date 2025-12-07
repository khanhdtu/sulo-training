'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { userRepository } from '@/repositories/user.repository';

interface UpdateProfileSectionProps {
  onUpdate?: () => void;
}

export default function UpdateProfileSection({ onUpdate }: UpdateProfileSectionProps) {
  const { user, refreshUser } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    gradeId: user?.gradeLevel || user?.gradeId || 7, // Use gradeLevel (level) for dropdown, fallback to gradeId
    difficulty: user?.level 
      ? (user.level <= 4 ? 'easy' : user.level <= 8 ? 'medium' : 'hard')
      : 'easy',
    displayName: user?.displayName || '',
  });

  // Update formData when user changes (but not when editing)
  useEffect(() => {
    if (!isEditing && user) {
      setFormData({
        gradeId: user.gradeLevel || user.gradeId || 7,
        difficulty: user.level 
          ? (user.level <= 4 ? 'easy' : user.level <= 8 ? 'medium' : 'hard')
          : 'easy',
        displayName: user.displayName || '',
      });
    }
  }, [user, isEditing]);

  if (!user) return null;

  const handleEdit = () => {
    setFormData({
      gradeId: user.gradeLevel || user.gradeId || 7, // Use gradeLevel (level) for dropdown, fallback to gradeId
      difficulty: user.level 
        ? (user.level <= 4 ? 'easy' : user.level <= 8 ? 'medium' : 'hard')
        : 'easy',
      displayName: user.displayName || '',
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      });

      // Toast is already handled by the request wrapper in lib/request.ts
      // Refresh user data
      await refreshUser();
      
      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      console.error('Update profile error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyLabel = (level?: number | null) => {
    if (!level) return 'Chưa cập nhật';
    if (level <= 4) return 'Dễ';
    if (level <= 8) return 'Vừa';
    return 'Khó';
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-gradient">Cập nhật hồ sơ học tập</h3>
        {!isEditing && (
          <button
            onClick={handleEdit}
            className="btn btn-secondary flex items-center gap-2"
            aria-label="Chỉnh sửa"
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
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            <span className="hidden sm:inline">Chỉnh sửa</span>
          </button>
        )}
      </div>

      {isEditing ? (
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
              className="w-full"
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
              className="w-full"
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
              className="w-full"
              placeholder="Nhập tên hiển thị (tùy chọn)"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="btn btn-secondary flex-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Đang cập nhật...
                </>
              ) : (
                <>
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
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Lưu thay đổi
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-600">Lớp:</span>
            <span className="text-sm text-gray-900">
              {user.gradeLevel ? `Lớp ${user.gradeLevel}` : user.gradeId ? `Lớp ${user.gradeId}` : 'Chưa cập nhật'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-600">Mức học:</span>
            <span className="text-sm text-gray-900">
              {getDifficultyLabel(user.level)}
            </span>
          </div>
          <div className="pt-2">
            <p className="text-xs text-gray-500">
              Cập nhật thông tin để hệ thống đề xuất bài tập phù hợp với bạn.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

