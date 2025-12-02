import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';

// Support multiple JWT Secret formats
// Priority: JWT_SECRET > SUPABASE_JWT_SECRET
const JWT_SECRET = 
  process.env.JWT_SECRET || 
  process.env.SUPABASE_JWT_SECRET || 
  'your-secret-key-change-in-production';

export interface JWTPayload {
  userId: number;
  username: string;
  role: string;
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify password
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * Generate JWT token
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Get user from token
 */
export async function getUserFromToken(token: string) {
  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      role: true,
      avatarUrl: true,
      isActive: true,
    },
  });

  return user;
}

