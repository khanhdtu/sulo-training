'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AnswersPopup from '@/components/AnswersPopup';

interface DailyActivityStats {
  subjectStats: {
    subjectName: string;
    questionCount: number;
    details: Array<{
      exerciseTitle: string;
      chapterName: string;
      questionCount: number;
    }>;
  }[];
  aiQuestionCount: number;
  date: string;
  studentName?: string;
}

export default function EmailTemplatePreviewPage() {
  const searchParams = useSearchParams();
  const username = searchParams.get('username');
  const [stats, setStats] = useState<DailyActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [popupData, setPopupData] = useState<{
    isOpen: boolean;
    subjectName?: string;
    isAI?: boolean;
  }>({
    isOpen: false,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        let url = '/api/daily-activity-stats/public';
        if (username) {
          url = `/api/daily-activity-stats/by-username?username=${encodeURIComponent(username)}`;
        }

        const response = await fetch(url);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Không thể tải dữ liệu');
        }

        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [username]);

  // Auto-open popup if query params are present
  useEffect(() => {
    if (stats && username) {
      const subjectParam = searchParams.get('subject');
      const aiParam = searchParams.get('ai');
      
      if (subjectParam) {
        setPopupData({
          isOpen: true,
          subjectName: subjectParam,
          isAI: false,
        });
      } else if (aiParam === 'true') {
        setPopupData({
          isOpen: true,
          isAI: true,
        });
      }
    }
  }, [stats, username, searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Đang tải...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-red-600">
            {error || 'Không tìm thấy dữ liệu'}
          </h1>
        </div>
      </div>
    );
  }

  // Format date
  const date = new Date(stats.date);
  const formattedDate = date.toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
            Email Template Preview
          </h1>
          
          <div className="border border-gray-300 rounded-lg p-6 bg-white">
            {/* Email Header */}
            <div className="border-b border-gray-200 pb-4 mb-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                Báo cáo hoạt động học tập
              </h2>
              {stats.studentName && (
                <p className="text-gray-700 font-medium mb-1">
                  Học viên: {stats.studentName}
                </p>
              )}
              <p className="text-gray-600">
                Ngày {formattedDate}
              </p>
            </div>

            {/* Email Content */}
            <div className="space-y-4 mb-6">
              <p className="text-gray-700">
                Kính gửi Quý phụ huynh,
              </p>
              <p className="text-gray-700">
                Dưới đây là báo cáo hoạt động học tập của con bạn trong ngày hôm qua:
              </p>
            </div>

            {/* Activity Stats */}
            <div className="space-y-3 mb-6">
              {stats.subjectStats.map((subject, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition cursor-pointer"
                  onClick={() => {
                    if (username) {
                      setPopupData({
                        isOpen: true,
                        subjectName: subject.subjectName,
                        isAI: false,
                      });
                    }
                  }}
                >
                  <div className="flex items-center justify-between text-gray-800 hover:text-orange-600 transition">
                    <span className="font-semibold text-lg">
                      {subject.subjectName}
                    </span>
                    <span className="text-gray-600">
                      ({subject.questionCount} câu)
                    </span>
                  </div>
                </div>
              ))}
              
              {/* AI Questions */}
              <div 
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition cursor-pointer"
                onClick={() => {
                  if (username) {
                    setPopupData({
                      isOpen: true,
                      isAI: true,
                    });
                  }
                }}
              >
                <div className="flex items-center justify-between text-gray-800 hover:text-orange-600 transition">
                  <span className="font-semibold text-lg">
                    Hỏi trợ lý AI
                  </span>
                  <span className="text-gray-600">
                    ({stats.aiQuestionCount} câu)
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 pt-4 mt-6">
              <p className="text-gray-600 text-sm">
                Trân trọng,<br />
                Hệ thống Sulo Training
              </p>
            </div>
          </div>

          {/* Raw HTML Preview */}
          <div className="mt-8">
            <h3 className="text-xl font-semibold mb-4">HTML Email Template:</h3>
            <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
              {generateEmailHTML(stats, username)}
            </pre>
          </div>
        </div>
      </div>

      {/* Answers Popup */}
      {username && (
        <AnswersPopup
          isOpen={popupData.isOpen}
          onClose={() => setPopupData({ isOpen: false })}
          username={username}
          subjectName={popupData.subjectName}
          date={stats.date}
          isAI={popupData.isAI}
        />
      )}
    </div>
  );
}

function generateEmailHTML(stats: DailyActivityStats, usernameParam?: string | null): string {
  const date = new Date(stats.date);
  const formattedDate = date.toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const username = usernameParam || '';
  
  const subjectItems = stats.subjectStats.map((subject) => {
    const detailUrl = username 
      ? `${baseUrl}/emailTemplatePreview?username=${encodeURIComponent(username)}&subject=${encodeURIComponent(subject.subjectName)}&date=${stats.date}`
      : `${baseUrl}/emailTemplatePreview?subject=${encodeURIComponent(subject.subjectName)}&date=${stats.date}`;
    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <a href="${detailUrl}" style="color: #1f2937; text-decoration: none; font-weight: 600; font-size: 16px;">
            ${subject.subjectName}
          </a>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #6b7280;">
          (${subject.questionCount} câu)
        </td>
      </tr>
    `;
  }).join('');

  const aiDetailUrl = username
    ? `${baseUrl}/emailTemplatePreview?username=${encodeURIComponent(username)}&ai=true&date=${stats.date}`
    : `${baseUrl}/emailTemplatePreview?ai=true&date=${stats.date}`;
  const studentName = stats.studentName || '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Báo cáo hoạt động học tập</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px;">
    <!-- Header -->
    <div style="border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 30px;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #1f2937;">
        Báo cáo hoạt động học tập
      </h1>
      ${studentName ? `<p style="margin: 8px 0 0 0; color: #374151; font-size: 16px; font-weight: 500;">
        Học viên: ${studentName}
      </p>` : ''}
      <p style="margin: ${studentName ? '8px' : '8px'} 0 0 0; color: #6b7280; font-size: 14px;">
        Ngày ${formattedDate}
      </p>
    </div>

    <!-- Content -->
    <div style="margin-bottom: 30px;">
      <p style="margin: 0 0 16px 0; color: #374151; line-height: 1.6;">
        Kính gửi Quý phụ huynh,
      </p>
      <p style="margin: 0 0 16px 0; color: #374151; line-height: 1.6;">
        Dưới đây là báo cáo hoạt động học tập của con bạn trong ngày hôm qua:
      </p>
    </div>

    <!-- Activity Stats Table -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
      ${subjectItems}
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <a href="${aiDetailUrl}" style="color: #1f2937; text-decoration: none; font-weight: 600; font-size: 16px;">
            Hỏi trợ lý AI
          </a>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #6b7280;">
          (${stats.aiQuestionCount} câu)
        </td>
      </tr>
    </table>

    <!-- Footer -->
    <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
      <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
        Trân trọng,<br />
        Hệ thống Sulo Training
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

