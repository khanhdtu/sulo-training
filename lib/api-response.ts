import { NextResponse } from 'next/server';

/**
 * Encode message to base64 for HTTP header (HTTP headers only support ASCII)
 */
function encodeHeaderValue(value: string): string {
  return Buffer.from(value, 'utf-8').toString('base64');
}

/**
 * Create a success response with toast message
 */
export function successResponse(
  data: any,
  message?: string,
  status: number = 200
): NextResponse {
  const response = NextResponse.json(data, { status });
  
  if (message) {
    response.headers.set('x-toast-type', 'success');
    // Encode message to base64 to support Unicode characters
    response.headers.set('x-toast-message', encodeHeaderValue(message));
  }
  
  return response;
}

/**
 * Create an error response with toast message
 */
export function errorResponse(
  error: string,
  status: number = 400,
  details?: any
): NextResponse {
  const response = NextResponse.json(
    { error, ...(details && { details }) },
    { status }
  );
  
  response.headers.set('x-toast-type', 'error');
  // Encode message to base64 to support Unicode characters
  response.headers.set('x-toast-message', encodeHeaderValue(error));
  
  return response;
}

/**
 * Create an info response with toast message
 */
export function infoResponse(
  data: any,
  message: string,
  status: number = 200
): NextResponse {
  const response = NextResponse.json(data, { status });
  
  response.headers.set('x-toast-type', 'info');
  // Encode message to base64 to support Unicode characters
  response.headers.set('x-toast-message', encodeHeaderValue(message));
  
  return response;
}

/**
 * Create a warning response with toast message
 */
export function warningResponse(
  data: any,
  message: string,
  status: number = 200
): NextResponse {
  const response = NextResponse.json(data, { status });
  
  response.headers.set('x-toast-type', 'warning');
  // Encode message to base64 to support Unicode characters
  response.headers.set('x-toast-message', encodeHeaderValue(message));
  
  return response;
}

