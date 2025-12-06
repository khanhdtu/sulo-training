import { NextResponse } from 'next/server';

// Mock data for public preview
function getMockStats() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  return {
    subjectStats: [
      {
        subjectName: 'Toán',
        questionCount: 5,
        details: [
          {
            exerciseTitle: 'Bài tập về nhà - Phép cộng',
            chapterName: 'Chương 1: Số tự nhiên',
            questionCount: 3,
          },
          {
            exerciseTitle: 'Bài tập về nhà - Phép trừ',
            chapterName: 'Chương 1: Số tự nhiên',
            questionCount: 2,
          },
        ],
      },
      {
        subjectName: 'Tiếng Anh',
        questionCount: 3,
        details: [
          {
            exerciseTitle: 'Bài tập từ vựng',
            chapterName: 'Chương 1: Greetings',
            questionCount: 3,
          },
        ],
      },
      {
        subjectName: 'Tiếng Việt',
        questionCount: 5,
        details: [
          {
            exerciseTitle: 'Bài tập đọc hiểu',
            chapterName: 'Chương 1: Việt Nam - Tổ Quốc em',
            questionCount: 5,
          },
        ],
      },
      {
        subjectName: 'Lịch Sử',
        questionCount: 0,
        details: [],
      },
    ],
    aiQuestionCount: 10,
    date: yesterday.toISOString(),
    studentName: 'Học viên mẫu',
  };
}

export async function GET() {
  // Public route - return mock data for preview
  return NextResponse.json(getMockStats());
}

