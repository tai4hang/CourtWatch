import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api } from '../services/api';
import { GoogleAuthProvider, signInWithCredential, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../services/firebase';

interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  role: 'user' | 'admin';
  createdAt: string;
}

interface Subscription {
  id: string;
  status: string;
  plan: string;
  currentPeriodEnd?: string;
}

interface AuthState {
  user: User | null;
  subscription: Subscription | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  googleLogin: () => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  subscription: null,
  isLoading: true,
  isAuthenticated: false,

  initialize: async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (token) {
        try {
          await get().fetchUser();
        } catch (err: any) {
          // Token invalid/expired - clear and set unauthenticated
          console.warn('Token invalid, clearing auth state:', err.message);
          await SecureStore.deleteItemAsync('accessToken');
          await SecureStore.deleteItemAsync('refreshToken');
          set({ isAuthenticated: false });
        }
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (email: string, password: string) => {
    const response = await api.login(email, password);
    
    const accessToken = String(response.accessToken || '');
    const refreshToken = String(response.refreshToken || '');
    
    await SecureStore.setItemAsync('accessToken', accessToken);
    await SecureStore.setItemAsync('refreshToken', refreshToken);
    
    set({
      user: response.user,
      isAuthenticated: true,
    });
  },

  register: async (email: string, password: string, name?: string) => {
    const response = await api.register(email, password, name);
    
    const accessToken = String(response.accessToken || '');
    const refreshToken = String(response.refreshToken || '');
    
    await SecureStore.setItemAsync('accessToken', accessToken);
    await SecureStore.setItemAsync('refreshToken', refreshToken);
    
    set({
      user: response.user,
      isAuthenticated: true,
    });
  },

  googleLogin: async () => {
    // This will be triggered by the Google Sign-In button
    // The actual sign-in happens in the component using the Firebase SDK
    // Here we just store the tokens from the backend response
    throw new Error('Google login must be initiated from the UI component');
  },

  logout: async () => {
    await api.logout();
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    
    set({
      user: null,
      subscription: null,
      isAuthenticated: false,
    });
  },

  updateUser: (data: Partial<User>) => {
    const currentUser = get().user;
    if (currentUser) {
      set({ user: { ...currentUser, ...data } });
    }
  },

  fetchUser: async () => {
    try {
      console.log('fetchUser: calling api.getMe()...');
      const response = await api.getMe();
      console.log('fetchUser: received response:', JSON.stringify(response).substring(0, 200));
      
      const user = response.user;
      const subscription = response.subscription;
      
      console.log('fetchUser: parsed user:', user?.id, 'subscription:', subscription?.status);
      
      if (!user) {
        throw new Error('No user data in response');
      }
      
      set({
        user,
        subscription: subscription || null,
        isAuthenticated: true,
      });
      console.log('fetchUser: set state complete');
    } catch (error) {
      console.error('fetchUser error:', error);
      throw error;
    }
  },
}));
