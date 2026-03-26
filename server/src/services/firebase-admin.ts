import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import bcrypt from 'bcryptjs';
import { userModel } from '../db/models.js';

const serviceAccount = {
  type: 'service_account',
  project_id: 'courtwatch-a4135',
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  // For development, you can use a test key - in production use proper service account
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