'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  login as apiLogin,
  signUp as apiSignUp,
  getCurrentUser,
  logout as logoutApi,
} from '@/services/auth-service';
import type { AuthContextType, AuthState, LoginCredentials, SignUpCredentials, User } from '@/types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  initialUser?: User | null;
}

export function AuthProvider({ children, initialUser }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: initialUser || null,
    isAuthenticated: !!initialUser,
    isLoading: initialUser === undefined, // true if initialUser not provided (client-side only)
    error: null,
    discount: initialUser ? 10 : 0,
  });

  // Initialize auth state on mount
  useEffect(() => {
    // Skip auth initialization on /login page to avoid requiring auth token cookie
    if (typeof window !== 'undefined' && window.location.pathname === '/login') {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        discount: 0,
      });
      return;
    }

    // initialUser === undefined → server didn't provide any info, need to fetch client-side
    // initialUser is User → server provided authenticated user, no need to fetch
    // initialUser === null → server said "no cookie", but we still want to check client-side
    // because the cookie could have been set after SSR (e.g., login via Playwright mock)
    if (initialUser === undefined) {
      // Server gave us no info → fetch client-side
      initializeAuth();
      return;
    }

    if (initialUser) {
      // Server gave us authenticated user → set state with discount
      setState({
        user: initialUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        discount: 10,
      });
      return;
    }

    // initialUser === null → server said "no cookie", no need to fetch client-side
    // Playwright mocks should use initialUser === undefined to trigger client-side fetch
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      discount: 0,
    });
  }, [initialUser]);

  const initializeAuth = async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      // Get current user
      const user = await getCurrentUser();

      if (user) {
        setState({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          discount: 10,
        });
      } else {
        // User is not authenticated (401) – normal state
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
          discount: 0,
        });
      }
    } catch (error) {
      // Unexpected error (network, server down, etc.)
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
        discount: 0,
      });
    }
  };

  const login = async (credentials: LoginCredentials): Promise<void> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await apiLogin(credentials);

      setState({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        discount: 10,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Login failed',
      }));
      throw error;
    }
  };

  const logout = async () => {
    const currentUser = state.user; // capture before resetting state
    try {
      await logoutApi();
      // Redirect based on user role
      if (currentUser?.role === 'admin') {
        window.location.href = '/login'; // admin login page
      } else {
        window.location.href = '/'; // homepage for regular users
      }
    } catch (error) {
      // Optionally handle error
      console.error('Logout failed', error);
    } finally {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        discount: 0,
      });
    }
  };

  const signUp = async (credentials: SignUpCredentials): Promise<void> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await apiSignUp(credentials);

      setState({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        discount: 10,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Sign up failed',
      }));
      throw error;
    }
  };

  const refreshToken = async () => {
    try {
      // Attempt silent refresh using HttpOnly refresh cookie via api-client
      // The api-client will call the refresh endpoint when it receives 401s,
      // but expose an explicit method here to allow manual refresh attempts.
      // We call a lightweight endpoint to validate refresh — `/api/v1/auth/refresh` returns 200 on success.
      // Use auth-service directly to keep concerns separated.
      // Note: auth-service.refreshToken returns void and will throw on failure
      // which we propagate to caller.
      const { refreshToken: refresh } = await import('@/services/auth-service');
      await refresh();
      // After successful refresh, reload current user
      const user = await getCurrentUser();
      if (user) {
        setState(prev => ({ ...prev, user, isAuthenticated: true, isLoading: false, error: null, discount: 10 }));
      }
    } catch (error) {
      logout();
      throw error;
    }
  };

  const value: AuthContextType = {
    ...state,
    login,
    signUp,
    logout,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
