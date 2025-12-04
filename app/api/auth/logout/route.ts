import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  const response = successResponse(
    { message: 'Logged out successfully' },
    'Đăng xuất thành công!'
  );
  
  // Clear token cookie
  response.cookies.delete('token');
  response.cookies.set('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return response;
}

