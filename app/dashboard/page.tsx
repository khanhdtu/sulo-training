'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SubjectSelector from '@/components/SubjectSelector';
import UpdateProfileSection from '@/components/UpdateProfileSection';
import { useUser } from '@/contexts/UserContext';
import { authRepository } from '@/repositories/auth.repository';
import Loading from '@/components/Loading';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useUser();

  useEffect(() => {
    // Update localStorage when user data changes
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else if (!loading) {
      // Only redirect if we're done loading and no user
          router.push('/login');
        }
  }, [user, loading, router]);

  const handleLogout = async () => {
    try {
      await authRepository.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Clear localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
      // Redirect to login
    router.push('/login');
    }
  };

  if (loading) {
    return <Loading message="Đang tải thông tin..." />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen relative">
      <nav>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gradient">Sulo Training</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-700">Xin chào, {user.name}</span>
            <button
              onClick={handleLogout}
              className="btn btn-primary flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #ef4444, #f87171)' }}
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
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Đăng xuất
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Update Profile Section */}
        <div className="mb-6">
          <UpdateProfileSection />
        </div>

        {/* Show subject selector if user has grade */}
        {user.gradeId && (
          <div className="mb-6">
            <SubjectSelector gradeId={user.gradeId} />
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-xl font-semibold mb-4 text-gradient">Bài tập của tôi</h3>
            <p className="text-gray-600">Tính năng đang phát triển...</p>
          </div>

          <div className="card">
            <h3 className="text-xl font-semibold mb-4 text-gradient">Tiến độ học tập</h3>
            <p className="text-gray-600">Tính năng đang phát triển...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

