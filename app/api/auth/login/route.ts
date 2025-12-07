import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, generateToken } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { z } from 'zod';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = loginSchema.parse(body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return errorResponse('Tên đăng nhập hoặc mật khẩu không đúng', 401);
    }

    // Check if user is active
    if (!user.isActive) {
      return errorResponse('Tài khoản đã bị vô hiệu hóa', 403);
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return errorResponse('Tên đăng nhập hoặc mật khẩu không đúng', 401);
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    // Create response with user data
    const response = successResponse(
      {
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          displayName: user.displayName,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl,
          gradeId: user.gradeId,
          level: user.level,
        },
        token,
      },
      'Đăng nhập thành công!'
    );

    // Set token in HTTP-only cookie for security
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Dữ liệu không hợp lệ', 400, { details: error.issues });
    }

    console.error('Login error:', error);
    return errorResponse('Đã xảy ra lỗi. Vui lòng thử lại sau', 500);
  }
}

