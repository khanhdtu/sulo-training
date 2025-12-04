import { toast } from 'sonner';

/**
 * Decode base64 message from HTTP header (HTTP headers only support ASCII)
 * Browser compatible version using atob
 */
function decodeHeaderValue(value: string): string {
  try {
    // In browser, use atob to decode base64, then convert to UTF-8
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes);
  } catch (e) {
    // If decoding fails, return original value (might be plain ASCII)
    return value;
  }
}

/**
 * Show toast from API response headers
 * Middleware sets x-toast-type and x-toast-message headers
 * Messages are base64 encoded to support Unicode characters
 */
export function showToastFromHeaders(response: Response) {
  const toastType = response.headers.get('x-toast-type');
  const toastMessage = response.headers.get('x-toast-message');

  if (toastType && toastMessage) {
    // Decode base64 message
    const decodedMessage = decodeHeaderValue(toastMessage);
    
    if (toastType === 'success') {
      toast.success(decodedMessage);
    } else if (toastType === 'error') {
      toast.error(decodedMessage);
    } else if (toastType === 'info') {
      toast.info(decodedMessage);
    } else if (toastType === 'warning') {
      toast.warning(decodedMessage);
    }
  }
}

/**
 * Show toast from API response body
 * Checks for success/error in response data
 */
export async function showToastFromResponse(response: Response) {
  // First check headers (set by middleware or API routes)
  showToastFromHeaders(response);

  // Then check response body if it's JSON
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    try {
      const data = await response.clone().json();
      
      // If response has error, show error toast
      if (!response.ok && data.error) {
        toast.error(data.error);
      }
      // If response is successful and has message, show success toast
      else if (response.ok && data.message) {
        toast.success(data.message);
      }
    } catch (e) {
      // Not JSON or can't parse, ignore
    }
  }
}

/**
 * Wrapper for fetch that automatically shows toast
 */
export async function fetchWithToast(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const response = await fetch(url, options);
  await showToastFromResponse(response);
  return response;
}

