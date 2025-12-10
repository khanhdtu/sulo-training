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

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        displayName: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        gradeId: true,
        level: true,
      },
    });

    return user;
  } catch (error: unknown) {
    // Handle database connection errors gracefully
    if (error instanceof Error) {
      // Check if it's a Prisma connection error (P1001, P1000, P1017, etc.)
      const errorMessage = error.message || '';
      const isConnectionError = 
        errorMessage.includes('P1001') || // Can't reach database server
        errorMessage.includes('P1000') || // Authentication failed
        errorMessage.includes('P1017') || // Server closed the connection
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('ENOTFOUND');
      
      if (isConnectionError) {
        console.error('Database connection error:', errorMessage);
        console.error('Please check your DATABASE_URL, POSTGRES_PRISMA_URL, or POSTGRES_URL_NON_POOLING environment variable.');
        console.error('Run: npm run db:check to verify your database connection.');
        // Return null instead of throwing - allows app to continue but authentication will fail
        return null;
      }
    }
    
    // Re-throw other errors (data errors, etc.)
    throw error;
  }
}

