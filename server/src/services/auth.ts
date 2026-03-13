import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { userModel, sessionModel, type User } from '../db/models.js';

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export const authService = {
  async register(input: RegisterInput): Promise<{ user: Omit<User, 'password_hash'>; accessToken: string; refreshToken: string }> {
    logger.info({ email: input.email }, 'Starting register');
    const { email, password, name } = input;

    // Check if user exists
    logger.info('Checking if user exists...');
    const existing = await userModel.findByEmail(email);
    logger.info({ existing: !!existing }, 'User check complete');
    if (existing) {
      throw new Error('User already exists');
    }

    // Hash password (using 4 rounds for faster testing - use 12 in production)
    logger.info('Hashing password...');
    const passwordHash = await bcrypt.hash(password, 4);
    logger.info('Password hashed');

    // Create user
    const user = await userModel.create({
      email,
      name,
      passwordHash,
    });

    // Create tokens
    const accessToken = uuidv4();
    const refreshToken = uuidv4();

    // Create session (30 days expiry)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await sessionModel.create({
      userId: user.id,
      refreshToken,
      expiresAt,
    });

    logger.info({ userId: user.id }, 'User registered');

    const { password_hash: _, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  },

  async login(input: LoginInput): Promise<{ user: Omit<User, 'password_hash'>; accessToken: string; refreshToken: string }> {
    const { email, password } = input;

    // Find user
    const user = await userModel.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new Error('Invalid credentials');
    }

    // Create tokens
    const accessToken = uuidv4();
    const refreshToken = uuidv4();

    // Create session (30 days expiry) - store both tokens
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await sessionModel.create({
      userId: user.id,
      accessToken,
      refreshToken,
      expiresAt,
    });

    logger.info({ userId: user.id }, 'User logged in');

    const { password_hash: _, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  },

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const session = await sessionModel.findByRefreshToken(refreshToken);

    if (!session) {
      throw new Error('Invalid refresh token');
    }

    // Delete old session
    await sessionModel.delete(refreshToken);

    // Create new tokens
    const newAccessToken = uuidv4();
    const newRefreshToken = uuidv4();

    // Create new session
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await sessionModel.create({
      userId: session.user_id,
      refreshToken: newRefreshToken,
      expiresAt,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  },

  async logout(refreshToken: string): Promise<void> {
    await sessionModel.delete(refreshToken);
    logger.info('User logged out');
  },

  async validateRefreshToken(refreshToken: string): Promise<User | null> {
    const user = await sessionModel.findByRefreshToken(refreshToken);
    if (!user) {
      return null;
    }
    return user;
  },

  async validateToken(token: string): Promise<User | null> {
    // Try accessToken first, then refreshToken
    let user = await sessionModel.findByAccessToken(token);
    if (user) {
      return user;
    }
    user = await sessionModel.findByRefreshToken(token);
    return user;
  },
};
