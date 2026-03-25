import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import * as dependenciesRuntime from '../lib/dependencies-runtime';
import * as authRepositoryModule from '../repositories/auth-repository';
import * as authService from '../services/auth-service';
import type { PostgresRuntime } from '../types/runtime';
import type { User } from '../types/domain';

vi.mock('../lib/dependencies-runtime');
vi.mock('../repositories/auth-repository');
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
  hash: vi.fn(),
  compare: vi.fn(),
}));

vi.mock('jsonwebtoken', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sign: vi.fn(() => 'mock-token' as any),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  verify: vi.fn(() => ({ userId: 'user-1' } as any)),
}));

describe('auth-service', () => {
  let mockRepository: NonNullable<ReturnType<typeof authRepositoryModule.createAuthRepository>>;

  beforeEach(() => {
    mockRepository = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      createUser: vi.fn(),
      updateLastLogin: vi.fn(),
      getPasswordHash: vi.fn(),
    };
    vi.mocked(authRepositoryModule.createAuthRepository).mockReturnValue(mockRepository);
    vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (vi.mocked(jwt.sign) as any).mockReturnValue('mock-token');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (vi.mocked(jwt.verify) as any).mockReturnValue({ userId: 'user-1' } as jwt.JwtPayload);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('signUp', () => {
    it('returns error if postgres not available', async () => {
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: null, redis: null, rabbitmq: null });
      const result = await authService.signUp({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(500);
        expect(result.error?.code).toBe('SERVER_ERROR');
        expect(result.error?.message).toBe('Database not available');
      }
    });

    it('returns error if repository creation fails', async () => {
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });
      vi.mocked(authRepositoryModule.createAuthRepository).mockReturnValue(null);
      const result = await authService.signUp({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(500);
        expect(result.error?.code).toBe('SERVER_ERROR');
        expect(result.error?.message).toBe('Auth repository not available');
      }
    });

    it('returns 409 if user already exists', async () => {
      const existingUser: User = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Existing User',
        role: 'user',
        isActive: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };
      vi.mocked(mockRepository.findByEmail).mockResolvedValue(existingUser);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const result = await authService.signUp({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(409);
        expect(result.error?.code).toBe('USER_ALREADY_EXISTS');
        expect(result.error?.message).toBe('User with this email already exists.');
      }
      expect(mockRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('creates user, generates tokens and returns data', async () => {
      const newUser: User = {
        id: 'user-2',
        email: 'new@example.com',
        name: 'New User',
        role: 'user',
        isActive: true,
        createdAt: '2025-01-02T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      };
      vi.mocked(mockRepository.findByEmail).mockResolvedValue(null);
      vi.mocked(mockRepository.createUser).mockResolvedValue(newUser);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const result = await authService.signUp({
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
      });
      expect('data' in result).toBe(true);
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(mockRepository.createUser).toHaveBeenCalledWith({
        email: 'new@example.com',
        passwordHash: 'hashed-password',
        name: 'New User',
        role: 'user',
      });
      expect(jwt.sign).toHaveBeenCalledTimes(2);
      if ('data' in result) {
        expect(result.data.user).toEqual(newUser);
        expect(result.data.accessToken).toBe('mock-token');
        expect(result.data.refreshToken).toBe('mock-token');
      }
    });

    it('returns 500 on repository exception', async () => {
      vi.mocked(mockRepository.findByEmail).mockRejectedValue(new Error('DB error'));
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const result = await authService.signUp({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(500);
        expect(result.error?.code).toBe('SERVER_ERROR');
        expect(result.error?.message).toBe('Sign up failed');
      }
    });
  });

  describe('login', () => {
    it('returns error if postgres not available', async () => {
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: null, redis: null, rabbitmq: null });
      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(500);
        expect(result.error?.code).toBe('SERVER_ERROR');
        expect(result.error?.message).toBe('Database not available');
      }
    });

    it('returns 401 if user not found', async () => {
      vi.mocked(mockRepository.findByEmail).mockResolvedValue(null);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const result = await authService.login({
        email: 'nonexistent@example.com',
        password: 'password123',
      });
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(401);
        expect(result.error?.code).toBe('AUTHENTICATION_ERROR');
        expect(result.error?.message).toBe('Invalid email or password');
      }
    });

    it('returns 401 if password hash not found', async () => {
      const user: User = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        isActive: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };
      vi.mocked(mockRepository.findByEmail).mockResolvedValue(user);
      vi.mocked(mockRepository.getPasswordHash).mockResolvedValue(null);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(401);
        expect(result.error?.code).toBe('AUTHENTICATION_ERROR');
        expect(result.error?.message).toBe('Invalid email or password');
      }
    });

    it('returns 401 if password invalid', async () => {
      const user: User = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        isActive: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };
      vi.mocked(mockRepository.findByEmail).mockResolvedValue(user);
      vi.mocked(mockRepository.getPasswordHash).mockResolvedValue('hashed-password');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (bcrypt.compare as any).mockResolvedValue(false);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const result = await authService.login({
        email: 'test@example.com',
        password: 'wrong-password',
      });
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(401);
        expect(result.error?.code).toBe('AUTHENTICATION_ERROR');
        expect(result.error?.message).toBe('Invalid email or password');
      }
    });

    it('logs in successfully and returns tokens', async () => {
      const user: User = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        isActive: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };
      vi.mocked(mockRepository.findByEmail).mockResolvedValue(user);
      vi.mocked(mockRepository.getPasswordHash).mockResolvedValue('hashed-password');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (bcrypt.compare as any).mockResolvedValue(true);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });
      expect('data' in result).toBe(true);
      expect(mockRepository.updateLastLogin).toHaveBeenCalledWith('user-1');
      expect(jwt.sign).toHaveBeenCalledTimes(2);
      if ('data' in result) {
        expect(result.data.user).toEqual(user);
        expect(result.data.accessToken).toBe('mock-token');
        expect(result.data.refreshToken).toBe('mock-token');
      }
    });
  });

  describe('refreshToken', () => {
    it('returns 401 if refresh token invalid', async () => {
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('Invalid token');
      });
      const result = await authService.refreshToken('invalid-token');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(401);
        expect(result.error?.code).toBe('AUTHENTICATION_ERROR');
        expect(result.error?.message).toBe('Invalid refresh token');
      }
    });

    it('returns 401 if decoded token missing userId', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (vi.mocked(jwt.verify) as any).mockReturnValue({} as jwt.JwtPayload);
      const result = await authService.refreshToken('token-without-userid');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(401);
        expect(result.error?.code).toBe('AUTHENTICATION_ERROR');
        expect(result.error?.message).toBe('Invalid refresh token');
      }
    });

    it('returns new tokens if valid', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (vi.mocked(jwt.verify) as any).mockReturnValue({ userId: 'user-1' } as jwt.JwtPayload);
      const user: User = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        isActive: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };
      vi.mocked(mockRepository.findById).mockResolvedValue(user);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const result = await authService.refreshToken('valid-refresh-token');
      expect('data' in result).toBe(true);
      if ('data' in result) {
        expect(result.data.accessToken).toBe('mock-token');
        expect(result.data.refreshToken).toBe('mock-token');
      }
    });
  });

  describe('verifyToken', () => {
    it('returns 401 if token invalid', async () => {
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('Invalid token');
      });
      const result = await authService.verifyToken('invalid-token');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(401);
        expect(result.error?.code).toBe('AUTHENTICATION_ERROR');
        expect(result.error?.message).toBe('Invalid token');
      }
    });

    it('returns user if token valid', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (vi.mocked(jwt.verify) as any).mockReturnValue({ userId: 'user-1' } as jwt.JwtPayload);
      const user: User = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        isActive: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };
      vi.mocked(mockRepository.findById).mockResolvedValue(user);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const result = await authService.verifyToken('valid-token');
      expect('data' in result).toBe(true);
      if ('data' in result) {
        expect(result.data).toEqual(user);
      }
    });
  });
});