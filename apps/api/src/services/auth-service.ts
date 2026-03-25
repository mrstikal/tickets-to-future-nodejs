import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { getDependenciesRuntime } from '../lib/dependencies-runtime';
import { createAuthRepository } from '../repositories/auth-repository';
import { logger } from '../lib/logger';
import { env } from '../config/env';
import type { User, LoginInput, AuthTokens, ServiceResult } from '../types/domain';


function createAuthError(message: string) {
  return {
    error: {
      statusCode: 401,
      code: 'AUTHENTICATION_ERROR',
      message,
    },
  };
}

function createServerError(message: string) {
  return {
    error: {
      statusCode: 500,
      code: 'SERVER_ERROR',
      message,
    },
  };
}

export async function login(input: LoginInput): Promise<ServiceResult<AuthTokens & { user: User }>> {
  const runtime = getDependenciesRuntime();

  if (!runtime.postgres) {
    return createServerError('Database not available');
  }

  try {
    const repository = createAuthRepository(runtime.postgres);

    if (!repository) {
      return createServerError('Auth repository not available');
    }

    // Find user by email
    const user = await repository.findByEmail(input.email);

    if (!user) {
      return createAuthError('Invalid email or password');
    }

    // Get password hash
    const passwordHash = await repository.getPasswordHash(user.id);

    if (!passwordHash) {
      return createAuthError('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(input.password, passwordHash);

    if (!isValidPassword) {
      return createAuthError('Invalid email or password');
    }

    // Update last login
    await repository.updateLastLogin(user.id);

    // Generate tokens
    const tokens = generateTokens(user);

    return {
      data: {
        ...tokens,
        user,
      },
    };
  } catch (error) {
    logger.error('Login failed', error);
    return createServerError('Login failed');
  }
}

export async function refreshToken(refreshToken: string): Promise<ServiceResult<AuthTokens>> {
  try {
    const decoded = jwt.verify(refreshToken, env.jwtRefreshSecret) as jwt.JwtPayload;

    if (!decoded.userId) {
      return createAuthError('Invalid refresh token');
    }

    const runtime = getDependenciesRuntime();

    if (!runtime.postgres) {
      return createServerError('Database not available');
    }

    const repository = createAuthRepository(runtime.postgres);

    if (!repository) {
      return createServerError('Auth repository not available');
    }

    const user = await repository.findById(decoded.userId);

    if (!user) {
      return createAuthError('User not found');
    }

    const tokens = generateTokens(user);

    return {
      data: tokens,
    };
  } catch (error) {
    logger.error('Token refresh failed', error);
    return createAuthError('Invalid refresh token');
  }
}

export async function verifyToken(token: string): Promise<ServiceResult<User>> {
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;

    if (!decoded.userId) {
      return createAuthError('Invalid token');
    }

    const runtime = getDependenciesRuntime();

    if (!runtime.postgres) {
      return createServerError('Database not available');
    }

    const repository = createAuthRepository(runtime.postgres);

    if (!repository) {
      return createServerError('Auth repository not available');
    }

    const user = await repository.findById(decoded.userId);

    if (!user) {
      return createAuthError('User not found');
    }

    return {
      data: user,
    };
  } catch (error) {
    logger.error('Token verification failed', error);
    return createAuthError('Invalid token');
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function signUp(input: { email: string; password: string; name: string }): Promise<ServiceResult<AuthTokens & { user: User }>> {
  const runtime = getDependenciesRuntime();

  if (!runtime.postgres) {
    return createServerError('Database not available');
  }

  try {
    const repository = createAuthRepository(runtime.postgres);

    if (!repository) {
      return createServerError('Auth repository not available');
    }

    // Check if user already exists
    const existingUser = await repository.findByEmail(input.email);
    if (existingUser) {
      return {
        error: {
          statusCode: 409,
          code: 'USER_ALREADY_EXISTS',
          message: 'User with this email already exists.',
        },
      };
    }

    // Hash password
    const passwordHash = await hashPassword(input.password);

    // Create user with role 'user'
    const user = await repository.createUser({
      email: input.email,
      passwordHash,
      name: input.name,
      role: 'user',
    });

    // Generate tokens
    const tokens = generateTokens(user);

    return {
      data: {
        ...tokens,
        user,
      },
    };
  } catch (error) {
    logger.error('Sign up failed', error);
    return createServerError('Sign up failed');
  }
}

function generateTokens(user: User): AuthTokens {
  const accessToken = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn,
    } as jwt.SignOptions
  );

  const refreshToken = jwt.sign(
    {
      userId: user.id,
    },
    env.jwtRefreshSecret,
    {
      expiresIn: env.jwtRefreshExpiresIn,
    } as jwt.SignOptions
  );

  return {
    accessToken,
    refreshToken,
  };
}
