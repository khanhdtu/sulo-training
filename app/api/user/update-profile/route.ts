import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/middleware-auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { z } from 'zod';

const updateProfileSchema = z.object({
  gradeId: z.number().int().min(1).max(12),
  level: z.number().int().min(1).max(12).optional(),
  displayName: z.string().optional(),
  parentEmail: z.string().email().optional().or(z.literal('')),
});

export async function PATCH(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getAuthUser(request);
    if (!user) {
      return errorResponse('Không có quyền truy cập', 401);
    }

    const body = await request.json();
    const validatedData = updateProfileSchema.parse(body);

    // Note: validatedData.gradeId is actually the grade level (1-12), not the grade ID
    // Find or create grade with the specified level
    const requestedLevel = validatedData.gradeId;
    
    let grade = await prisma.grade.findFirst({
      where: { level: requestedLevel },
    });

    if (!grade) {
      // Create grade if it doesn't exist
      grade = await prisma.grade.create({
        data: {
          name: `Lớp ${requestedLevel}`,
          level: requestedLevel,
        },
      });
    }

    // Log for debugging
    console.log('Update profile:', {
      requestedLevel,
      foundGradeId: grade.id,
      foundGradeLevel: grade.level,
    });

    const userLevel = validatedData.level || validatedData.gradeId;

    // Update user profile - only update gradeId and level
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        gradeId: grade.id, // Use the grade ID from database
        level: userLevel, // Default to gradeId if not provided
        displayName: validatedData.displayName || null,
        parentEmail: validatedData.parentEmail || null,
      },
      include: {
        grade: {
          select: {
            id: true,
            name: true,
            level: true,
          },
        },
      },
    });

    // Return user with grade info
    const userResponse = {
      id: updatedUser.id,
      username: updatedUser.username,
      name: updatedUser.name,
      displayName: updatedUser.displayName,
      email: updatedUser.email,
      role: updatedUser.role,
      gradeId: updatedUser.gradeId,
      gradeLevel: updatedUser.grade?.level || null, // Include grade level for clarity
      level: updatedUser.level,
    };

    return successResponse(
      { user: userResponse },
      'Cập nhật thông tin thành công!'
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Dữ liệu không hợp lệ', 400, { details: error.issues });
    }

    console.error('Update profile error:', error);
    return errorResponse('Đã xảy ra lỗi. Vui lòng thử lại sau', 500);
  }
}

