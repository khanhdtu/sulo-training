import { NextRequest } from 'next/server';
import { getUserFromToken } from './auth';

/**
 * Get authenticated user from request
 */
export async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
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

