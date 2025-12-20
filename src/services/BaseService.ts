import { DatabaseAdapter } from './DatabaseAdapter';
import { QueryOptions, PaginatedResponse } from './types';

export abstract class BaseService extends DatabaseAdapter {
  protected abstract tableName: string;

  protected async getAll<T>(options?: QueryOptions): Promise<T[]> {
    let query = this.db.from(this.tableName).select('*');

    if (options?.orderBy) {
      query = query.order(options.orderBy, {
        ascending: options.orderDirection === 'asc'
      });
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data } = await this.queryList<T>(() => query);
    return data;
  }

  protected async getById<T>(id: string, select = '*'): Promise<T | null> {
    const { data, error } = await this.db
      .from(this.tableName)
      .select(select)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      this.handleError(error, `Failed to get ${this.tableName} by ID`);
    }

    return data;
  }

  protected async create<T>(data: Partial<T>): Promise<T> {
    return this.query<T>(() =>
      this.db
        .from(this.tableName)
        .insert(data)
        .select()
        .single()
    );
  }

  protected async update<T>(id: string, data: Partial<T>): Promise<T> {
    return this.query<T>(() =>
      this.db
        .from(this.tableName)
        .update(data)
        .eq('id', id)
        .select()
        .single()
    );
  }

  protected async delete(id: string): Promise<void> {
    const { error } = await this.db
      .from(this.tableName)
      .delete()
      .eq('id', id);

    if (error) {
      this.handleError(error, `Failed to delete ${this.tableName}`);
    }
  }

  protected async getPaginated<T>(
    options: QueryOptions & { select?: string }
  ): Promise<PaginatedResponse<T>> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    let query = this.db
      .from(this.tableName)
      .select(options.select || '*', { count: 'exact' });

    if (options.orderBy) {
      query = query.order(options.orderBy, {
        ascending: options.orderDirection === 'asc'
      });
    }

    query = query.range(offset, offset + limit - 1);

    const { data, count } = await this.queryList<T>(() => query);

    return {
      data,
      count,
      hasMore: offset + limit < count
    };
  }
}
