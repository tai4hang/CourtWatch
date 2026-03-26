import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import bcrypt from 'bcryptjs';
import { userModel } from '../db/models.js';

// Handle both plain and base64-encoded private key
let privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
if (!privateKey && process.env.FIREBASE_PRIVATE_KEY_B64) {
  privateKey = Buffer.from(process.env.FIREBASE_PRIVATE_KEY_B64, 'base64').toString('utf-8');
}

const serviceAccount = {
  type: 'service_account',
  project_id: 'courtwatch-a4135',
  private_key: privateKey,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
};

// Initialize Firebase Admin only once
if (getApps().length === 0) {
  try {
    if (serviceAccount.private_key && serviceAccount.client_email) {
      initializeApp({
        credential: cert(serviceAccount as any),
      });
    } else {
      console.warn('Firebase Admin: Missing credentials, googleLogin will not work');
    }
  } catch (err) {
    console.error('Firebase Admin init error:', err);
  }
}

export async function verifyGoogleToken(idToken: string) {
  try {
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (err) {
    console.error('Failed to verify Google token:', err);
    throw new Error('Invalid Google ID token');
  }
}

export async function getOrCreateUser(googleUser: {
  uid: string;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
}) {
  // Check if user exists by email
  const existingUser = await userModel.findByEmail(googleUser.email!);
  
  if (existingUser) {
    // Update with Google info if needed
    return existingUser;
  }
  
  // Create new user (password is random since they login with Google)
  const randomPassword = Math.random().toString(36).slice(-16) + Date.now().toString(36);
  const { passwordHash } = await bcrypt.hash(randomPassword, 4);
  
  const newUser = await userModel.create({
    email: googleUser.email!,
    name: googleUser.name || googleUser.email?.split('@')[0],
    passwordHash,
    // Store Google UID for reference
    role: 'user',
  } as any);
  
  return newUser;
}