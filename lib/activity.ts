import { NextRequest } from 'next/server';

export interface ActivityLogData {
  userId?: number;
  action: string;
  endpoint: string;
  method: string;
  statusCode: number;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  duration?: number;
}

/**
 * Log user activity to database via API route
 * This is called asynchronously to avoid blocking the request
 * Uses API route because middleware runs on Edge Runtime which doesn't support Prisma
 * 
 * @param data Activity data to log
 * @param request Optional NextRequest to extract base URL from
 */
export async function logActivity(
  data: ActivityLogData,
  request?: NextRequest
): Promise<void> {
  try {
    // Determine base URL
    let baseUrl: string;
    if (request) {
      // Extract base URL from request
      const url = new URL(request.url);
      baseUrl = `${url.protocol}//${url.host}`;
    } else {
      // Fallback to environment variable or default
      baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';
    }
    
    const url = `${baseUrl}/api/activity/log`;
    
    // Fire and forget - don't await to avoid blocking
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }).catch((err) => {
      // Silently fail - don't break the app if activity logging fails
      console.error('Failed to send activity log:', err);
    });
  } catch (error) {
    // Log error but don't throw - we don't want activity logging to break the app
    console.error('Failed to log activity:', error);
  }
}

/**
 * Get client IP address from request
 */
export function getClientIp(request: NextRequest): string | undefined {
  // Try various headers that might contain the real IP
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to connection remote address (if available)
  return undefined;
}

/**
 * Get user agent from request
 */
export function getUserAgent(request: NextRequest): string | undefined {
  return request.headers.get('user-agent') || undefined;
}

/**
 * Extract safe metadata from request (exclude sensitive data)
 */
export function extractSafeMetadata(
  request: NextRequest,
  response?: { statusCode: number }
): Record<string, any> {
  const metadata: Record<string, any> = {};

  // Add query parameters (sanitized)
  const searchParams = request.nextUrl.searchParams;
  if (searchParams.toString()) {
    const query: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      // Don't log sensitive query params
      if (!['password', 'token', 'secret', 'key'].some(sensitive => 
        key.toLowerCase().includes(sensitive)
      )) {
        query[key] = value;
      }
    });
    if (Object.keys(query).length > 0) {
      metadata.query = query;
    }
  }

  // Add response status if available
  if (response?.statusCode) {
    metadata.statusCode = response.statusCode;
  }

  return metadata;
}

