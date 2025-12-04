import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/middleware-auth';
import { errorResponse, successResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getAuthUser(request);
    if (!user) {
      return errorResponse('Không có quyền truy cập', 401);
    }

    // Get gradeId from query params or user's gradeId
    const { searchParams } = new URL(request.url);
    const gradeId = searchParams.get('gradeId') 
      ? parseInt(searchParams.get('gradeId')!) 
      : user.gradeId;

    if (!gradeId) {
      return errorResponse('Vui lòng cập nhật thông tin lớp học trước', 400);
    }

    // Get subjects for the grade
    const subjects = await prisma.subject.findMany({
      where: {
        gradeId: gradeId,
      },
      orderBy: {
        order: 'asc',
      },
      select: {
        id: true,
        name: true,
        description: true,
        order: true,
        gradeId: true,
      },
    });

    return successResponse({ subjects });
  } catch (error) {
    console.error('Get subjects error:', error);
    return errorResponse('Đã xảy ra lỗi. Vui lòng thử lại sau', 500);
  }
}

