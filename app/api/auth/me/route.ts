import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/middleware-auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return errorResponse('Không có quyền truy cập', 401);
    }

    // Get user with grade info to include gradeLevel
    const userWithGrade = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        username: true,
        name: true,
        displayName: true,
        email: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        gradeId: true,
        level: true,
        grade: {
          select: {
            id: true,
            name: true,
            level: true,
          },
        },
      },
    });

    if (!userWithGrade) {
      return errorResponse('Không tìm thấy thông tin người dùng', 404);
    }

    // Add gradeLevel to response
    const userResponse = {
      ...userWithGrade,
      gradeLevel: userWithGrade.grade?.level || null,
    };

    return successResponse({ user: userResponse });
  } catch (error) {
    console.error('Get user error:', error);
    return errorResponse('Đã xảy ra lỗi. Vui lòng thử lại sau', 500);
  }
}

