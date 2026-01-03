import { ApiError } from '../services/apiClient';

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return (error as any).message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'حدث خطأ غير متوقع - An unexpected error occurred';
}

export function isPermissionError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 403 ||
           error.code === 'FORBIDDEN' ||
           error.message.includes('صلاحية') ||
           error.message.includes('permission');
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as any).message || '';
    return message.includes('صلاحية') || message.includes('permission');
  }

  return false;
}

export function isAuthenticationError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 401 || error.code === 'UNAUTHORIZED';
  }

  return false;
}

export function isNotFoundError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 404 || error.code === 'NOT_FOUND';
  }

  return false;
}

export function isServerError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status >= 500;
  }

  return false;
}
