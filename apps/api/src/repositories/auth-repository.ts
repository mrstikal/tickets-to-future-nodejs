import type { PostgresRuntime } from '../types/runtime';
import type { User } from '../types/domain';

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};


function mapUserRow(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name || undefined,
    role: row.role,
    isActive: row.is_active,
    lastLoginAt: row.last_login_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createAuthRepository(postgresRuntime: PostgresRuntime | null) {
  if (!postgresRuntime) {
    return null;
  }

  return {
    async findByEmail(email: string): Promise<User | null> {
      // noinspection SqlResolve
      const result = await postgresRuntime.pool.query<UserRow>(
        `
          SELECT
            id,
            email,
            name,
            password_hash,
            role,
            is_active,
            last_login_at,
            created_at,
            updated_at
          FROM users
          WHERE email = $1 AND is_active = true
        `,
        [email]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return mapUserRow(result.rows[0]);
    },

    async findById(userId: string): Promise<User | null> {
      // noinspection SqlResolve
      const result = await postgresRuntime.pool.query<UserRow>(
        `
          SELECT
            id,
            email,
            name,
            password_hash,
            role,
            is_active,
            last_login_at,
            created_at,
            updated_at
          FROM users
          WHERE id = $1 AND is_active = true
        `,
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return mapUserRow(result.rows[0]);
    },

    async createUser(params: {
      email: string;
      passwordHash: string;
      name?: string;
      role?: string;
    }): Promise<User> {
      // noinspection SqlResolve
      const result = await postgresRuntime.pool.query<UserRow>(
        `
          INSERT INTO users (email, password_hash, name, role)
          VALUES ($1, $2, $3, $4)
          RETURNING
            id,
            email,
            name,
            password_hash,
            role,
            is_active,
            last_login_at,
            created_at,
            updated_at
        `,
        [params.email, params.passwordHash, params.name || null, params.role || 'user']
      );

      return mapUserRow(result.rows[0]);
    },

    async updateLastLogin(userId: string): Promise<void> {
      // noinspection SqlResolve
      await postgresRuntime.pool.query(
        `
          UPDATE users
          SET last_login_at = now(), updated_at = now()
          WHERE id = $1
        `,
        [userId]
      );
    },

    async getPasswordHash(userId: string): Promise<string | null> {
      // noinspection SqlResolve
      const result = await postgresRuntime.pool.query<{ password_hash: string }>(
        `
          SELECT password_hash
          FROM users
          WHERE id = $1 AND is_active = true
        `,
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].password_hash;
    },
  };
}