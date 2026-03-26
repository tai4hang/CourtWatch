import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { userModel, sessionModel, type User } from '../db/models.js';
import { verifyGoogleToken } from './firebase-admin.js';

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
        accessToken,
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
    } catch (err) {
      logger.error({ err, email }, 'Login error');
      throw err;
    }
  },

  async googleLogin(idToken: string) {
    logger.info({}, 'Google login: starting');
    
    try {
      // Verify Google token
      const googleUser = await verifyGoogleToken(idToken);
      
      if (!googleUser.email) {
        throw new Error('Google account has no email');
      }
      
      // Check if user exists
      let user = await userModel.findByEmail(googleUser.email);
      
      if (!user) {
        // Create new user with random password
        const randomPassword = Math.random().toString(36).slice(-16) + Date.now().toString(36);
        const passwordHash = await bcrypt.hash(randomPassword, 4);
        
        user = await userModel.create({
          email: googleUser.email,
          name: googleUser.name || googleUser.email.split('@')[0],
          passwordHash,
        });
      }
      
      // Create tokens
      const accessToken = uuidv4();
      const refreshToken = uuidv4();
      
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await sessionModel.create({
        userId: user.id,
        accessToken,
        refreshToken,
        expiresAt,
      });
      
      logger.info({ userId: user.id }, 'User logged in via Google');
      
      const { password_hash: _, ...userWithoutPassword } = user;
      return {
        user: userWithoutPassword,
        accessToken,
        refreshToken,
      };
    } catch (err) {
      logger.error({ err }, 'Google login error');
      throw err;
    }
  },

  async validateToken(token: string) {
    try {
      // Check if it's a refresh token (stored in session)
      const userFromRefresh = await sessionModel.findByRefreshToken(token);
      if (userFromRefresh) {
        return {
          id: userFromRefresh.id,
          email: userFromRefresh.email,
          role: userFromRefresh.role,
        };
      }

      // Check if it's an access token (stored in session)
      const userFromAccess = await sessionModel.findByAccessToken(token);
      if (userFromAccess) {
        return {
          id: userFromAccess.id,
          email: userFromAccess.email,
          role: userFromAccess.role,
        };
      }

      return null;
    } catch (err) {
      logger.error({ err, token }, 'Validate token error');
      return null;
    }
  },

  async logout(token: string) {
    try {
      // Delete session if it's a refresh token
      const session = await sessionModel.findByRefreshToken(token);
      if (session) {
        await sessionModel.delete(session.id);
      }
      // For access tokens, we could invalidate them by removing from user record
      // For now just return success
      return true;
    } catch (err) {
      logger.error({ err }, 'Logout error');
      return false;
    }
  },
};
