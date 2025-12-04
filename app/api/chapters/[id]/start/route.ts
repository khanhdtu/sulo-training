import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/middleware-auth';
import { errorResponse, successResponse } from '@/lib/api-response';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params (Next.js 15+ requires params to be awaited)
    const { id } = await params;
    
    // Get authenticated user
    const user = await getAuthUser(request);
    if (!user) {
      return errorResponse('Không có quyền truy cập', 401);
    }

    if (!user.gradeId) {
      return errorResponse('Vui lòng cập nhật thông tin lớp học trước', 400);
    }

    const chapterId = parseInt(id);
    if (isNaN(chapterId)) {
      return errorResponse('ID chương không hợp lệ', 400);
    }

    // Get chapter with subject and grade info
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
        subject: {
          select: {
            id: true,
            gradeId: true,
          },
        },
        sections: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!chapter) {
      return errorResponse('Không tìm thấy chương', 404);
    }

    // Verify chapter belongs to user's grade
    if (chapter.subject.gradeId !== user.gradeId) {
      return errorResponse('Chương không thuộc lớp của bạn', 403);
    }

    // Create or update chapter progress
    const chapterProgress = await prisma.userChapterProgress.upsert({
      where: {
        userId_chapterId: {
          userId: user.id,
          chapterId: chapterId,
        },
      },
      create: {
        userId: user.id,
        chapterId: chapterId,
        subjectId: chapter.subject.id,
        gradeId: user.gradeId,
        status: 'in_progress',
        progress: 0,
        totalSections: chapter.sections.length,
        completedSections: 0,
        lastAccessedAt: new Date(),
      },
      update: {
        status: 'in_progress',
        lastAccessedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        progress: true,
        completedSections: true,
        totalSections: true,
        lastAccessedAt: true,
      },
    });

    return successResponse(
      { progress: chapterProgress },
      'Đã bắt đầu học chương này!'
    );
  } catch (error) {
    console.error('Start chapter error:', error);
    return errorResponse('Đã xảy ra lỗi. Vui lòng thử lại sau', 500);
  }
}

