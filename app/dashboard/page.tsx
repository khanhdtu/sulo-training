'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  username: string;
  name: string;
  email?: string;
  role: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Get user info
    fetch('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
        } else {
          router.push('/login');
        }
      })
      .catch(() => {
        router.push('/login');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Đang tải...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen relative">
      <nav className="bg-white shadow-colored">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gradient">Sulo Training</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-700">Xin chào, {user.name}</span>
            <button
              onClick={handleLogout}
              className="btn btn-primary"
              style={{ background: 'linear-gradient(135deg, #ef4444, #f87171)' }}
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 relative z-10">
        <div className="card mb-6">
          <h2 className="text-2xl font-semibold mb-4 text-gradient">Thông tin tài khoản</h2>
          <div className="space-y-2">
            <p><strong>Tên đăng nhập:</strong> {user.username}</p>
            <p><strong>Họ và tên:</strong> {user.name}</p>
            <p><strong>Email:</strong> {user.email || 'Chưa cập nhật'}</p>
            <p><strong>Vai trò:</strong> {user.role}</p>
          </div>
        </div>

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

