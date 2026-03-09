import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api } from '../services/api';

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
        await get().fetchUser();
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (email: string, password: string) => {
    const response = await api.login(email, password);
    
    await SecureStore.setItemAsync('accessToken', response.accessToken);
    await SecureStore.setItemAsync('refreshToken', response.refreshToken);
    
    set({
      user: response.user,
      isAuthenticated: true,
    });
  },

  register: async (email: string, password: string, name?: string) => {
    const response = await api.register(email, password, name);
    
    await SecureStore.setItemAsync('accessToken', response.accessToken);
    await SecureStore.setItemAsync('refreshToken', response.refreshToken);
    
    set({
      user: response.user,
      isAuthenticated: true,
    });
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
      const { user } = await api.getMe();
      const { subscription } = await api.getSubscription();
      
      set({
        user,
        subscription: subscription || null,
        isAuthenticated: true,
      });
    } catch (error) {
      console.error('Failed to fetch user:', error);
      await get().logout();
    }
  },
}));
