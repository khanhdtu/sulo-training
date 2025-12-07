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
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex justify-end gap-1.5 sm:gap-2">
            <a
              href="/login"
              className="btn btn-secondary text-[10px] sm:text-xs px-2 py-1 sm:px-3 sm:py-1.5"
            >
              Đăng Nhập
            </a>
            <a
              href="/register"
              className="btn btn-outline text-[10px] sm:text-xs px-2 py-1 sm:px-3 sm:py-1.5"
            >
              Đăng Ký
            </a>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-3 sm:px-4 md:px-6 py-12 sm:py-16 md:py-20 relative z-10">
        <div className="text-center fade-in pt-16 sm:pt-20 md:pt-24">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <span className="badge text-[10px] sm:text-xs md:text-sm px-2 py-1 sm:px-3 sm:py-1.5">
              Hệ thống ôn tập trực tuyến
            </span>
            <span className="badge bg-green-500 text-white text-[10px] sm:text-xs md:text-sm px-2 py-1 sm:px-3 sm:py-1.5 font-semibold">
              🎁 Hoàn toàn miễn phí
            </span>
          </div>
          <h1 className="text-gradient mb-3 sm:mb-4 text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl px-2 sm:px-0">
            Ôn Tập Hiệu Quả Cho Học Sinh Từ Lớp 1 Đến Lớp 12
          </h1>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-700 mb-6 sm:mb-8 max-w-2xl mx-auto px-2 sm:px-0">
            Hệ thống ôn tập trực tuyến bám sát chương trình học của Bộ Giáo dục & Đào tạo. 
            Cung cấp bài tập phù hợp với trình độ của từng học sinh, giúp ôn tập hiệu quả và nâng cao kết quả học tập.
          </p>
          <div className="flex gap-3 sm:gap-4 justify-center flex-wrap px-2 sm:px-0">
            <button
              onClick={handleStartLearning}
              className="btn btn-primary text-sm sm:text-base px-4 py-2 sm:px-6 sm:py-3 w-full sm:w-auto"
            >
              Bắt đầu học ngay
            </button>
          </div>
        </div>

        <div className="mt-12 sm:mt-16 md:mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8 fade-in">
          <div className="card">
            <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">📝</div>
            <h3 className="text-xl sm:text-2xl font-semibold mb-2 sm:mb-3 text-gradient">
              Bài Tập Đa Dạng
            </h3>
            <p className="text-sm sm:text-base text-gray-600">
              Cung cấp đầy đủ bài tập trắc nghiệm và tự luận với các cấp độ khó (dễ, trung bình, khó) 
              tương ứng với trình độ của từng học sinh
            </p>
          </div>

          <div className="card">
            <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">🤖</div>
            <h3 className="text-xl sm:text-2xl font-semibold mb-2 sm:mb-3 text-gradient">
              Trợ Lý Học Tập AI
            </h3>
            <p className="text-sm sm:text-base text-gray-600">
              Trợ lý học tập thông minh sẵn sàng hướng dẫn và giải thích chi tiết, 
              giúp học sinh hiểu rõ từng bài tập và nắm vững kiến thức
            </p>
          </div>

          <div className="card">
            <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">📧</div>
            <h3 className="text-xl sm:text-2xl font-semibold mb-2 sm:mb-3 text-gradient">
              Email Hàng Tuần
            </h3>
            <p className="text-sm sm:text-base text-gray-600">
              Hàng tuần hệ thống sẽ gửi email hiển thị hoạt động học tập của học viên đến phụ huynh, 
              giúp phụ huynh theo dõi và hỗ trợ quá trình học tập của con em
            </p>
          </div>

          <div className="card sm:col-span-2 lg:col-span-1">
            <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">📊</div>
            <h3 className="text-xl sm:text-2xl font-semibold mb-2 sm:mb-3 text-gradient">
              Theo Dõi Tiến Độ
            </h3>
            <p className="text-sm sm:text-base text-gray-600">
              Tự động tính toán trình độ và đề xuất bài tập phù hợp, 
              giúp học sinh ôn tập hiệu quả và cải thiện kết quả học tập
            </p>
          </div>
        </div>

        <div className="mt-12 sm:mt-16 md:mt-20 text-center fade-in px-2 sm:px-0">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4">
            Hệ Thống Ôn Tập Toàn Diện và Miễn Phí
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-gray-700 max-w-3xl mx-auto mb-6 sm:mb-8">
            Hệ thống ôn tập trực tuyến hoàn toàn miễn phí, dành cho tất cả học sinh từ lớp 1 đến lớp 12. 
            Với nội dung bám sát chương trình học của Bộ Giáo dục & Đào tạo, 
            hệ thống giúp học sinh ôn tập hiệu quả và đạt kết quả học tập tốt nhất.
          </p>
          <div className="flex items-center justify-center gap-2 text-green-600 font-semibold text-lg sm:text-xl">
            <span className="text-2xl sm:text-3xl">🎁</span>
            <span>Hoàn toàn miễn phí - Không giới hạn sử dụng</span>
          </div>
        </div>
      </div>
    </div>
  );
}

