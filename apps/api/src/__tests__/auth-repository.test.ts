 import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as authRepositoryModule from '../repositories/auth-repository';
import type { Pool, QueryResult } from 'pg';
import type { PostgresRuntime } from '../types/runtime';

vi.mock('pg', () => ({
  Pool: vi.fn(),
}));

describe('auth-repository', () => {
  let mockPool: Pool;
  let mockPostgresRuntime: PostgresRuntime;

  beforeEach(() => {
    mockPool = {
      query: vi.fn(),
      connect: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    mockPostgresRuntime = {
      pool: mockPool,
    } as PostgresRuntime;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createAuthRepository', () => {
    it('returns null if postgresRuntime is null', () => {
      const result = authRepositoryModule.createAuthRepository(null);
      expect(result).toBeNull();
    });

    it('returns repository object if postgresRuntime provided', () => {
      const result = authRepositoryModule.createAuthRepository(mockPostgresRuntime);
      expect(result).toBeDefined();
      expect(result).toHaveProperty('findByEmail');
      expect(result).toHaveProperty('findById');
      expect(result).toHaveProperty('createUser');
      expect(result).toHaveProperty('updateLastLogin');
      expect(result).toHaveProperty('getPasswordHash');
    });
  });

  describe('findByEmail', () => {
    it('returns null if no user found', async () => {
      const repository = authRepositoryModule.createAuthRepository(mockPostgresRuntime)!;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockPool.query as any).mockResolvedValue({ rows: [] } as unknown as QueryResult);

      const result = await repository.findByEmail('nonexistent@example.com');
      expect(result).toBeNull();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['nonexistent@example.com']
      );
    });

    it('returns mapped user if found', async () => {
      const repository = authRepositoryModule.createAuthRepository(mockPostgresRuntime)!;
      const mockRow = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        password_hash: 'hashed-password',
        role: 'user',
        is_active: true,
        last_login_at: '2025-01-01T10:30:00Z',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (mockPool.query as any).mockResolvedValue({ rows: [mockRow] } as unknown as QueryResult);

      const result = await repository.findByEmail('test@example.com');
      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        isActive: true,
        lastLoginAt: '2025-01-01T10:30:00Z',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      });
    });

    it('maps null name to undefined', async () => {
      const repository = authRepositoryModule.createAuthRepository(mockPostgresRuntime)!;
      const mockRow = {
        id: 'user-2',
        email: 'admin@example.com',
        name: null,
        password_hash: 'hashed-password',
        role: 'admin',
        is_active: true,
        last_login_at: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (mockPool.query as any).mockResolvedValue({ rows: [mockRow] } as unknown as QueryResult);

      const result = await repository.findByEmail('admin@example.com');
      expect(result?.name).toBeUndefined();
      expect(result?.lastLoginAt).toBeUndefined();
    });
  });

  describe('findById', () => {
    it('returns null if no user found', async () => {
      const repository = authRepositoryModule.createAuthRepository(mockPostgresRuntime)!;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockPool.query as any).mockResolvedValue({ rows: [] } as unknown as QueryResult);

      const result = await repository.findById('nonexistent-id');
      expect(result).toBeNull();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['nonexistent-id']
      );
    });

    it('returns mapped user if found', async () => {
      const repository = authRepositoryModule.createAuthRepository(mockPostgresRuntime)!;
      const mockRow = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        password_hash: 'hashed-password',
        role: 'user',
        is_active: true,
        last_login_at: '2025-01-01T10:30:00Z',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (mockPool.query as any).mockResolvedValue({ rows: [mockRow] } as unknown as QueryResult);

      const result = await repository.findById('user-1');
      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        isActive: true,
        lastLoginAt: '2025-01-01T10:30:00Z',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      });
    });
  });

  describe('createUser', () => {
    it('creates user with default role "user"', async () => {
      const repository = authRepositoryModule.createAuthRepository(mockPostgresRuntime)!;
      const mockRow = {
        id: 'new-user-id',
        email: 'new@example.com',
        name: 'New User',
        password_hash: 'hashed-password',
        role: 'user',
        is_active: true,
        last_login_at: null,
        created_at: '2025-01-02T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
      };
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (mockPool.query as any).mockResolvedValue({ rows: [mockRow] } as unknown as QueryResult);

      const result = await repository.createUser({
        email: 'new@example.com',
        passwordHash: 'hashed-password',
        name: 'New User',
      });
      expect(result).toEqual({
        id: 'new-user-id',
        email: 'new@example.com',
        name: 'New User',
        role: 'user',
        isActive: true,
        lastLoginAt: undefined,
        createdAt: '2025-01-02T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        ['new@example.com', 'hashed-password', 'New User', 'user']
      );
    });

    it('creates user with explicit role', async () => {
      const repository = authRepositoryModule.createAuthRepository(mockPostgresRuntime)!;
      const mockRow = {
        id: 'admin-id',
        email: 'admin@example.com',
        name: 'Admin',
        password_hash: 'hashed-password',
        role: 'admin',
        is_active: true,
        last_login_at: null,
        created_at: '2025-01-02T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
      };
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (mockPool.query as any).mockResolvedValue({ rows: [mockRow] } as unknown as QueryResult);

      const result = await repository.createUser({
        email: 'admin@example.com',
        passwordHash: 'hashed-password',
        name: 'Admin',
        role: 'admin',
      });
      expect(result?.role).toBe('admin');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        ['admin@example.com', 'hashed-password', 'Admin', 'admin']
      );
    });

    it('maps null name to undefined', async () => {
      const repository = authRepositoryModule.createAuthRepository(mockPostgresRuntime)!;
      const mockRow = {
        id: 'user-no-name',
        email: 'noname@example.com',
        name: null,
        password_hash: 'hashed-password',
        role: 'user',
        is_active: true,
        last_login_at: null,
        created_at: '2025-01-02T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
      };
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (mockPool.query as any).mockResolvedValue({ rows: [mockRow] } as unknown as QueryResult);

      const result = await repository.createUser({
        email: 'noname@example.com',
        passwordHash: 'hashed-password',
      });
      expect(result?.name).toBeUndefined();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        ['noname@example.com', 'hashed-password', null, 'user']
      );
    });
  });

  describe('getPasswordHash', () => {
    it('returns null if user not found', async () => {
      const repository = authRepositoryModule.createAuthRepository(mockPostgresRuntime)!;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockPool.query as any).mockResolvedValue({ rows: [] } as unknown as QueryResult);

      const result = await repository.getPasswordHash('nonexistent-id');
      expect(result).toBeNull();
    });

    it('returns password hash if found', async () => {
      const repository = authRepositoryModule.createAuthRepository(mockPostgresRuntime)!;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockPool.query as any).mockResolvedValue({
        rows: [{ password_hash: 'hashed-password-123' }],
      } as unknown as QueryResult);

      const result = await repository.getPasswordHash('user-1');
      expect(result).toBe('hashed-password-123');
    });
  });

  describe('updateLastLogin', () => {
    it('calls update query', async () => {
      const repository = authRepositoryModule.createAuthRepository(mockPostgresRuntime)!;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (mockPool.query as any).mockResolvedValue({ rowCount: 1 } as unknown as QueryResult);

      await repository.updateLastLogin('user-1');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        ['user-1']
      );
    });
  });
});