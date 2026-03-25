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
  async register(input: RegisterInput) {
    const { email, password, name } = input;
    logger.info({ email }, 'Register: starting');

    try {
      // Check if user exists
      const existing = await userModel.findByEmail(email);
      if (existing) {
        throw new Error('User already exists');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 4);

      // Create user
      const user = await userModel.create({
        email,
        name,
        passwordHash,
      });

      // Create tokens
      const accessToken = uuidv4();
      const refreshToken = uuidv4();

      // Create session
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
    } catch (err) {
      logger.error({ err, email }, 'Register error');
      throw err;
    }
  },

  async login(input: LoginInput) {
    const { email, password } = input;
    logger.info({ email }, 'Login: starting');

    try {
      const user = await userModel.findByEmail(email);
      if (!user) {
        throw new Error('Invalid credentials');
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        throw new Error('Invalid credentials');
      }

      // Create tokens
      const accessToken = uuidv4();
      const refreshToken = uuidv4();

      // Create session
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await sessionModel.create({
        userId: user.id,
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
    } catch (err) {
      logger.error({ err, email }, 'Login error');
      throw err;
    }
  },
};
