import { apiPost, apiGet } from './api-client';
import type { LoginCredentials, SignUpCredentials, User } from '@/types/auth';

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
    return await apiGet<User>('/api/v1/auth/me');
  } catch {
    return null;
  }
}
