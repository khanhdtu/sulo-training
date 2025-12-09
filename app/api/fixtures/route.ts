import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const grade = searchParams.get('grade');
    const subject = searchParams.get('subject');
    const difficulty = searchParams.get('difficulty') || 'easy';

    if (!grade || !subject) {
      return NextResponse.json(
        { error: 'Grade and subject are required' },
        { status: 400 }
      );
    }

    // Map subject name to folder name
    const subjectMap: Record<string, string> = {
      'Toán': 'math',
      'Tiếng Anh': 'english',
      'Địa lý': 'geography',
      'Tin học': 'informatics',
      'Khoa học': 'science',
      'Lịch sử': 'history',
      'Ngữ văn': 'literature',
    };

    const folderName = subjectMap[subject] || subject.toLowerCase().replace(/\s+/g, '-');
    const filePath = path.join(
      process.cwd(),
      'fixtures',
      folderName,
      `grade${grade}-2025-${folderName}-${difficulty}.json`
    );

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Fixture file not found' },
        { status: 404 }
      );
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error loading fixture:', error);
    return NextResponse.json(
      { error: 'Failed to load fixture data' },
      { status: 500 }
    );
  }
}

