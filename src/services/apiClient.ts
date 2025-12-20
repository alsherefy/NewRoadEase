import { supabase } from '../lib/supabase';

const API_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
  };

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.error || `HTTP error ${response.status}`,
      response.status,
      errorData.code
    );
  }
  return response.json();
}

export const apiClient = {
  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${API_BASE_URL}/${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value);
        }
      });
    }

    const headers = await getAuthHeaders();
    const response = await fetch(url.toString(), { method: 'GET', headers });
    return handleResponse<T>(response);
  },

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
    return handleResponse<T>(response);
  },

  async put<T>(endpoint: string, data: unknown): Promise<T> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse<T>(response);
  },

  async delete<T>(endpoint: string): Promise<T> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
      method: 'DELETE',
      headers,
    });
    return handleResponse<T>(response);
  },
};
