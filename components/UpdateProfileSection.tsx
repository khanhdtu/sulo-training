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
            className="btn btn-secondary"
          >
            Chỉnh sửa
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
              className="btn btn-secondary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Đang cập nhật...' : 'Lưu thay đổi'}
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
          {user.displayName && (
            <div className="flex items-center justify-between py-2 border-b border-gray-200">
              <span className="text-sm font-medium text-gray-600">Tên hiển thị:</span>
              <span className="text-sm text-gray-900">{user.displayName}</span>
            </div>
          )}
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

