/**
 * Error Utility Functions
 * Safely extract error messages without using 'as any'
 */

/**
 * Safely get error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Lỗi không xác định';
}

/**
 * Type guard to check if value is an Error-like object
 */
export function isErrorLike(value: unknown): value is { message: string } {
  return (
    value !== null &&
    typeof value === 'object' &&
    'message' in value &&
    typeof (value as { message: unknown }).message === 'string'
  );
}

/**
 * Wrap async function with error handling
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/**
 * Type for Supabase error responses
 */
export interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * Check if error is a Supabase error
 */
export function isSupabaseError(error: unknown): error is SupabaseError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'message' in error
  );
}
