import { jwtVerify } from 'jose';

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
 * Verify JWT token (Edge Runtime compatible)
 * Uses jose library which works in Edge Runtime
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    
    return {
      userId: payload.userId as number,
      username: payload.username as string,
      role: payload.role as string,
    };
  } catch (error) {
    return null;
  }
}

