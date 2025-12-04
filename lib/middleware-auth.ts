import { NextRequest } from 'next/server';
import { getUserFromToken } from './auth';

/**
 * Get authenticated user from request
 * First tries to get from middleware headers (set by middleware.ts)
 * Falls back to extracting token from Authorization header or cookie
 */
export async function getAuthUser(request: NextRequest) {
  // Try to get user ID from middleware headers (fastest path)
  const userIdFromHeader = request.headers.get('x-user-id');
  if (userIdFromHeader) {
    // Middleware already verified the token, just get user from DB
    const token = 
      request.headers.get('authorization')?.substring(7) || 
      request.cookies.get('token')?.value;
    
    if (token) {
      return getUserFromToken(token);
    }
  }

  // Fallback: extract token from Authorization header or cookie
  const authHeader = request.headers.get('authorization');
  const tokenFromHeader = authHeader?.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : null;
  
  const tokenFromCookie = request.cookies.get('token')?.value;
  const token = tokenFromHeader || tokenFromCookie;

  if (!token) {
    return null;
  }

  return getUserFromToken(token);
}

/**
 * Require authentication middleware
 */
export async function requireAuth(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

/**
 * Require specific role
 */
export async function requireRole(request: NextRequest, roles: string[]) {
  const user = await requireAuth(request);
  if (!roles.includes(user.role)) {
    throw new Error('Forbidden');
  }
  return user;
}

