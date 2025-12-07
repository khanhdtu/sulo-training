import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth-edge';
import { logActivity, getClientIp, getUserAgent, extractSafeMetadata } from '@/lib/activity';

/**
 * Encode message to base64 for HTTP header (HTTP headers only support ASCII)
 * Edge Runtime compatible version using TextEncoder
 */
function encodeHeaderValue(value: string): string {
  try {
    // Use TextEncoder to convert Unicode string to bytes, then encode to base64
    const encoder = new TextEncoder();
    const bytes = encoder.encode(value);
    
    // Convert bytes array to base64 using btoa with binary string
    // btoa works with binary strings, so we convert bytes to binary string first
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    return btoa(binary);
  } catch (e) {
    // Fallback: return original value if encoding fails
    console.error('Failed to encode header value:', e);
    return value;
  }
}

// Public routes that don't require authentication
const publicRoutes = [
  '/',
  '/login',
  '/register',
  '/api/auth/login',
  '/api/auth/register',
];

// API routes that require authentication
const protectedApiRoutes = [
  '/api/auth/me',
  '/api/conversations',
  '/api/conversation-configs',
  '/api/user-levels',
  '/api/exercises',
  '/api/upload',
];

// Pages that require authentication
const protectedPages = [
  '/dashboard',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const startTime = Date.now();
  let userId: number | undefined;
  let statusCode = 200;

  // Skip logging for static assets, Next.js internal routes, and activity log endpoint
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname === '/api/activity/log' || // Don't log activity logging itself
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/)
  ) {
    return NextResponse.next();
  }

  // Helper function to check if we should log activity (skip GET requests)
  const shouldLogActivity = () => {
    return request.method !== 'GET';
  };

  // Try to get user ID from token
  const authHeader = request.headers.get('authorization');
  const tokenFromHeader = authHeader?.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : null;
  const tokenFromCookie = request.cookies.get('token')?.value;
  const token = tokenFromHeader || tokenFromCookie;

  // Note: verifyToken is async in Edge Runtime, but we'll verify it later when needed
  // For now, just check if token exists

  // Handle CORS for API routes
  if (pathname.startsWith('/api')) {
    const response = NextResponse.next();
    
    // Set CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Max-Age', '86400');

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      // Log preflight request (OPTIONS is not GET, so we log it)
      if (shouldLogActivity()) {
        logActivity(
          {
            userId,
            action: request.method,
            endpoint: pathname,
            method: request.method,
            statusCode: 200,
            ipAddress: getClientIp(request),
            userAgent: getUserAgent(request),
            metadata: extractSafeMetadata(request),
          },
          request
        );
      }
      
      return new NextResponse(null, {
        status: 200,
        headers: response.headers,
      });
    }

    // Check if API route requires authentication
    const isProtectedApi = protectedApiRoutes.some(route => pathname.startsWith(route));
    const isPublicApi = publicRoutes.some(route => pathname.startsWith(route));

    if (isProtectedApi && !isPublicApi) {
      if (!token) {
        statusCode = 401;
        const errorResponse = NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401, headers: response.headers }
        );
        errorResponse.headers.set('x-toast-type', 'error');
        errorResponse.headers.set('x-toast-message', encodeHeaderValue('Vui lòng đăng nhập để tiếp tục'));
        
        // Log activity (skip for GET requests)
        if (shouldLogActivity()) {
          const duration = Date.now() - startTime;
          logActivity(
            {
              userId,
              action: request.method,
              endpoint: pathname,
              method: request.method,
              statusCode,
              ipAddress: getClientIp(request),
              userAgent: getUserAgent(request),
              metadata: extractSafeMetadata(request),
              duration,
            },
            request
          );
        }
        
        return errorResponse;
      }

      // Verify token (async in Edge Runtime)
      const payload = await verifyToken(token);
      if (!payload) {
        statusCode = 401;
        const errorResponse = NextResponse.json(
          { error: 'Invalid or expired token' },
          { status: 401, headers: response.headers }
        );
        errorResponse.headers.set('x-toast-type', 'error');
        errorResponse.headers.set('x-toast-message', encodeHeaderValue('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại'));
        
        // Log activity (skip for GET requests)
        if (shouldLogActivity()) {
          const duration = Date.now() - startTime;
          logActivity(
            {
              userId,
              action: request.method,
              endpoint: pathname,
              method: request.method,
              statusCode,
              ipAddress: getClientIp(request),
              userAgent: getUserAgent(request),
              metadata: extractSafeMetadata(request),
              duration,
            },
            request
          );
        }
        
        return errorResponse;
      }

      userId = payload.userId;
      // Add user info to request headers for API routes to use
      response.headers.set('x-user-id', payload.userId.toString());
      response.headers.set('x-username', payload.username);
      response.headers.set('x-user-role', payload.role);
    }

    // Log API activity (async, don't block response) - skip for GET requests
    if (shouldLogActivity()) {
      const duration = Date.now() - startTime;
      logActivity(
        {
          userId,
          action: request.method,
          endpoint: pathname,
          method: request.method,
          statusCode: 200, // Will be updated by response interceptor if needed
          ipAddress: getClientIp(request),
          userAgent: getUserAgent(request),
          metadata: extractSafeMetadata(request),
          duration,
        },
        request
      );
    }

    return response;
  }

  // Handle page routes
  const isProtectedPage = protectedPages.some(route => pathname.startsWith(route));
  const isPublicPage = publicRoutes.includes(pathname);

  if (isProtectedPage && !isPublicPage) {
    if (!token) {
      // Redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      
      // Log activity (skip for GET requests)
      if (shouldLogActivity()) {
        const duration = Date.now() - startTime;
        logActivity(
          {
            userId,
            action: request.method,
            endpoint: pathname,
            method: request.method,
            statusCode: 302, // Redirect
            ipAddress: getClientIp(request),
            userAgent: getUserAgent(request),
            metadata: extractSafeMetadata(request),
            duration,
          },
          request
        );
      }
      
      return NextResponse.redirect(loginUrl);
    }

    // Verify token (async in Edge Runtime)
    const payload = await verifyToken(token);
    if (!payload) {
      // Invalid token, redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      const response = NextResponse.redirect(loginUrl);
      // Clear invalid token
      response.cookies.delete('token');
      
      // Log activity (skip for GET requests)
      if (shouldLogActivity()) {
        const duration = Date.now() - startTime;
        logActivity(
          {
            userId,
            action: request.method,
            endpoint: pathname,
            method: request.method,
            statusCode: 302,
            ipAddress: getClientIp(request),
            userAgent: getUserAgent(request),
            metadata: extractSafeMetadata(request),
            duration,
          },
          request
        );
      }
      
      return response;
    }

    userId = payload.userId;
    // Token is valid, allow access
    const response = NextResponse.next();
    // Optionally set user info in headers
    response.headers.set('x-user-id', payload.userId.toString());
    response.headers.set('x-username', payload.username);
    response.headers.set('x-user-role', payload.role);
    
    // Log activity (skip for GET requests)
    if (shouldLogActivity()) {
      const duration = Date.now() - startTime;
      logActivity(
        {
          userId,
          action: request.method,
          endpoint: pathname,
          method: request.method,
          statusCode: 200,
          ipAddress: getClientIp(request),
          userAgent: getUserAgent(request),
          metadata: extractSafeMetadata(request),
          duration,
        },
        request
      );
    }
    
    return response;
  }

  // Public routes - allow access and log activity (skip for GET requests)
  if (shouldLogActivity()) {
    const duration = Date.now() - startTime;
    logActivity(
      {
        userId,
        action: request.method,
        endpoint: pathname,
        method: request.method,
        statusCode: 200,
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        metadata: extractSafeMetadata(request),
        duration,
      },
      request
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
