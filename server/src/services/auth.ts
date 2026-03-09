import { PrismaClient, User, Session } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

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
  async register(input: RegisterInput): Promise<{ user: Omit<User, 'password'>; accessToken: string; refreshToken: string }> {
    const { email, password, name } = input;

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new Error('User already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: 'user',
      },
    });

    // Create tokens
    const accessToken = uuidv4();
    const refreshToken = uuidv4();

    // Create session
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    logger.info({ userId: user.id }, 'User registered');

    const { passwordHash: _, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  },

  async login(input: LoginInput): Promise<{ user: Omit<User, 'password'>; accessToken: string; refreshToken: string }> {
    const { email, password } = input;

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new Error('Invalid credentials');
    }

    // Create tokens
    const accessToken = uuidv4();
    const refreshToken = uuidv4();

    // Create session
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    logger.info({ userId: user.id }, 'User logged in');

    const { passwordHash: _, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  },

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const session = await prisma.session.findFirst({
      where: { refreshToken, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    if (!session) {
      throw new Error('Invalid refresh token');
    }

    // Delete old session
    await prisma.session.delete({ where: { id: session.id } });

    // Create new tokens
    const newAccessToken = uuidv4();
    const newRefreshToken = uuidv4();

    // Create new session
    await prisma.session.create({
      data: {
        userId: session.userId,
        refreshToken: newRefreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  },

  async logout(refreshToken: string): Promise<void> {
    await prisma.session.deleteMany({ where: { refreshToken } });
    logger.info('User logged out');
  },

  async validateAccessToken(accessToken: string): Promise<User | null> {
    const session = await prisma.session.findFirst({
      where: { refreshToken: accessToken }, // Using refresh token as access token for simplicity
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    return session.user;
  },
};
