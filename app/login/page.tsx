'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authRepository } from '@/repositories/auth.repository';

// Disable static generation for this page
export const dynamic = 'force-dynamic';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Removed auto-check for authentication to avoid calling /me API on login page

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await authRepository.login(formData);

      // Store token in localStorage for backward compatibility (optional)
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }

      // Redirect to dashboard or the redirect URL
      // Use window.location.href for more reliable redirect after cookie is set
      const redirect = searchParams.get('redirect') || '/dashboard';
      
      // Small delay to ensure cookie is set before redirect
      setTimeout(() => {
        window.location.href = redirect;
      }, 100);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Có lỗi xảy ra. Vui lòng thử lại.';
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="card w-full max-w-md relative z-10">
        <h1 className="text-4xl font-bold text-center mb-6 text-gradient">Đăng Nhập</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Tên đăng nhập
            </label>
            <input
              id="username"
              type="text"
              required
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Nhập tên đăng nhập"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Mật khẩu
            </label>
            <input
              id="password"
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Nhập mật khẩu"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng Nhập'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Chưa có tài khoản?{' '}
          <a href="/register" className="text-indigo-600 hover:underline">
            Đăng ký ngay
          </a>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card w-full max-w-md">
          <h1 className="text-4xl font-bold text-center mb-6 text-gradient">Đăng Nhập</h1>
          <p className="text-center text-gray-600">Đang tải...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

