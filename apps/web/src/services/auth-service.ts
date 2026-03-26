import { apiPost, apiGet } from './api-client';
import type { LoginCredentials, SignUpCredentials, User } from '@/types/auth';
import { config } from '@/lib/config';

export interface LoginResponse {
  user: User;
}

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  return apiPost<LoginResponse, LoginCredentials>('/api/v1/auth/login', credentials);
}

export async function refreshToken(): Promise<void> {
  // backend reads refresh token from HttpOnly cookie, no body required
  await apiPost<void, void>('/api/v1/auth/refresh', undefined as unknown as void);
}

export async function logout(): Promise<void> {
  await apiPost<void, void>('/api/v1/auth/logout', undefined);
}

export async function signUp(credentials: SignUpCredentials): Promise<LoginResponse> {
  return apiPost<LoginResponse, SignUpCredentials>('/api/v1/auth/signup', credentials);
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    // Use direct fetch without auto‑refresh for /api/v1/auth/me
    // because 401 is a normal state for unauthenticated users
    const response = await fetch(`${config.apiBaseUrl}/api/v1/auth/me`, {
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      credentials: 'include',
    });

    if (response.ok) {
      return await response.json() as User;
    }

    // 401 is expected for unauthenticated users – return null
    if (response.status === 401) {
      return null;
    }

    // Any other error – treat as failure
    throw new Error(`API request failed: ${response.status}`);
  } catch {
    return null;
  }
}
