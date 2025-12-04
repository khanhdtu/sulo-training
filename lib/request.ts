import { showToastFromResponse } from './toast';

export interface RequestOptions extends RequestInit {
  showToast?: boolean; // Whether to automatically show toast from response
}

/**
 * Base fetch wrapper with error handling and toast support
 */
export async function request<T = any>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  const { showToast = true, ...fetchOptions } = options;

  const response = await fetch(url, {
    ...fetchOptions,
    credentials: 'include', // Always include cookies
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  });

  // Show toast if enabled
  if (showToast) {
    await showToastFromResponse(response);
  }

  // Handle non-JSON responses
  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return response as unknown as T;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data;
}

/**
 * GET request
 */
export async function get<T = any>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  return request<T>(url, {
    ...options,
    method: 'GET',
  });
}

/**
 * POST request
 */
export async function post<T = any>(
  url: string,
  data?: any,
  options: RequestOptions = {}
): Promise<T> {
  return request<T>(url, {
    ...options,
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PATCH request
 */
export async function patch<T = any>(
  url: string,
  data?: any,
  options: RequestOptions = {}
): Promise<T> {
  return request<T>(url, {
    ...options,
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PUT request
 */
export async function put<T = any>(
  url: string,
  data?: any,
  options: RequestOptions = {}
): Promise<T> {
  return request<T>(url, {
    ...options,
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * DELETE request
 */
export async function del<T = any>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  return request<T>(url, {
    ...options,
    method: 'DELETE',
  });
}

