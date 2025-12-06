'use client';

import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  const handleStartLearning = async () => {
    // Check authentication by calling /me API (which uses cookie session)
    // HTTP-only cookies are automatically sent with credentials: 'include'
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include', // Include cookies
      });
      if (response.ok) {
        // User is authenticated (cookie exists and valid), redirect to dashboard
        router.push('/dashboard');
      } else {
        // Not authenticated, redirect to register
        router.push('/register');
      }
    } catch {
      // Not authenticated, redirect to register
      router.push('/register');
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Header with Login/Register buttons */}
      <header className="absolute top-0 left-0 right-0 z-20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-end gap-2">
            <a
              href="/login"
              className="btn btn-secondary text-xs px-3 py-1.5"
            >
              Đăng Nhập
            </a>
            <a
              href="/register"
              className="btn btn-outline text-xs px-3 py-1.5"
            >
              Đăng Ký
            </a>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-16 relative z-10">
        <div className="text-center fade-in">
          <span className="badge mb-4">GREATER LEARNING</span>
          <h1 className="text-gradient mb-4">
            Discover, Engage, Develop, and Enjoy!
          </h1>
          <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto">
            Hệ thống dạy học và quản lý việc học từ lớp 1 đến lớp 12. 
            Nơi học sinh khám phá kiến thức, phát triển kỹ năng và tận hưởng quá trình học tập.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={handleStartLearning}
              className="btn btn-primary"
            >
              Bắt đầu học
            </button>
          </div>
        </div>

        <div className="mt-20 grid md:grid-cols-3 gap-8 fade-in">
          <div className="card">
            <div className="text-4xl mb-4">📚</div>
            <h3 className="text-2xl font-semibold mb-3 text-gradient">Quản Lý Chương Trình</h3>
            <p className="text-gray-600">
              Tổ chức bài giảng và bài tập theo từng lớp, môn học, chương và mục một cách khoa học và dễ hiểu
            </p>
          </div>

          <div className="card">
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-2xl font-semibold mb-3 text-gradient">AI Chấm Bài</h3>
            <p className="text-gray-600">
              Sử dụng OpenAI để chấm điểm bài tự luận từ ảnh chụp bài làm, cung cấp feedback chi tiết và hỗ trợ học tập
            </p>
          </div>

          <div className="card">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-2xl font-semibold mb-3 text-gradient">Theo Dõi Tiến Độ</h3>
            <p className="text-gray-600">
              Tính toán level và đề xuất bài tập phù hợp với từng học sinh, giúp học tập hiệu quả hơn
            </p>
          </div>
        </div>

        <div className="mt-20 text-center fade-in">
          <h2 className="text-3xl font-bold mb-4">Globally Recognized Interactive Education</h2>
          <p className="text-lg text-gray-700 max-w-3xl mx-auto mb-8">
            Hệ thống giáo dục tương tác được công nhận toàn cầu, 
            mang đến trải nghiệm học tập tuyệt vời cho học sinh từ lớp 1 đến lớp 12.
          </p>
        </div>
      </div>
    </div>
  );
}

