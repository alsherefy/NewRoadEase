import { supabase } from '../lib/supabase';
import { ServiceError } from './types';

export class DatabaseAdapter {
  protected handleError(error: unknown, context: string): never {
    if (error instanceof Error) {
      throw new ServiceError(
        `${context}: ${error.message}`,
        'DATABASE_ERROR',
        error
      );
    }
    throw new ServiceError(
      `${context}: Unknown error occurred`,
      'UNKNOWN_ERROR',
      error
    );
  }

  protected async query<T>(
    callback: () => Promise<{ data: T | null; error: unknown }>
  ): Promise<T> {
    const { data, error } = await callback();

    if (error) {
      this.handleError(error, 'Query failed');
    }

    if (!data) {
      throw new ServiceError('No data returned', 'NO_DATA');
    }

    return data;
  }

  protected async queryList<T>(
    callback: () => Promise<{ data: T[] | null; error: unknown; count?: number | null }>
  ): Promise<{ data: T[]; count: number }> {
    const { data, error, count } = await callback();

    if (error) {
      this.handleError(error, 'Query list failed');
    }

    return { data: data || [], count: count || 0 };
  }

  protected get db() {
    return supabase;
  }

  protected get auth() {
    return supabase.auth;
  }
}
