import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { GoogleAuthProvider, signInWithCredential, User } from 'firebase/auth';
import { auth } from './firebase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

// Mock data
const MOCK_COURTS = [
  {
    id: '1',
    name: 'Central Park Tennis Center',
    address: '100 Central Park West, New York, NY 10023',
    city: 'New York',
    latitude: 40.7812,
    longitude: -73.9745,
    totalCourts: 12,
    courtType: 'outdoor',
    surface: 'hard',
    hasLights: true,
    isFree: true,
    status: 'green',
    lastReported: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago
  },
  {
    id: '2',
    name: 'Riverside Park Tennis',
    address: 'Riverside Park, New York, NY 10025',
    city: 'New York',
    latitude: 40.8024,
    longitude: -73.9711,
    totalCourts: 6,
    courtType: 'outdoor',
    surface: 'hard',
    hasLights: false,
    isFree: true,
    status: 'amber',
  },
  {
    id: '3',
    name: 'Midtown Tennis Center',
    address: '341 E 43rd St, New York, NY 10017',
    city: 'New York',
    latitude: 40.7489,
    longitude: -73.968,
    totalCourts: 8,
    courtType: 'indoor',
    surface: 'hard',
    hasLights: true,
    isFree: true,
    status: 'amber',
  },
  {
    id: '4',
    name: 'Brooklyn Bridge Park Courts',
    address: 'Brooklyn Bridge Park, Brooklyn, NY 11201',
    city: 'Brooklyn',
    latitude: 40.7024,
    longitude: -73.9969,
    totalCourts: 4,
    courtType: 'outdoor',
    surface: 'clay',
    hasLights: true,
    isFree: true,
    status: 'red',
  },
];

const MOCK_USER = {
  id: 'mock-user-1',
  email: 'demo@courtwatch.app',
  name: 'Demo User',
  avatar_url: null,
  role: 'USER',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

class ApiClient {
  private client: AxiosInstance;
  private refreshPromise: Promise<string | null> | null = null;
  private mockToken: string = 'mock-token-123';

  constructor() {
    this.client = axios.create({
      baseURL: `${API_BASE_URL}/api`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.client.interceptors.request.use(
      async (config) => {
        try {
          const token = await SecureStore.getItemAsync('accessToken') || this.mockToken;
          if (token && config.headers) {
            config.headers.set('Authorization', `Bearer ${token}`, false);
          }
        } catch (e) {}
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      (error) => Promise.reject(error)
    );
  }

  private async refreshToken(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    this.refreshPromise = (async () => {
      try {
        const response = await this.client.post('/auth/refresh');
        return response.data.accessToken;
      } catch {
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();
    return this.refreshPromise;
  }

  // Auth methods
  async login(email: string, password: string) {
    if (USE_MOCK) {
      return { user: MOCK_USER, accessToken: this.mockToken };
    }
    const response = await this.client.post('/auth/login', { email, password });
    return response.data;
  }

  async register(email: string, password: string, name: string) {
    if (USE_MOCK) {
      return { user: { ...MOCK_USER, email, name }, accessToken: this.mockToken };
    }
    const response = await this.client.post('/auth/register', { email, password, name });
    return response.data;
  }

  async getProfile() {
    if (USE_MOCK) {
      return { user: MOCK_USER };
    }
    const response = await this.client.get('/users/me');
    return response.data;
  }

  async getMe() {
    if (USE_MOCK) {
      return { user: MOCK_USER };
    }
    console.log('API: calling GET /users/me');
    const response = await this.client.get('/users/me');
    console.log('API: got response status:', response.status);
    return response.data;
  }

  async getSubscription() {
    if (USE_MOCK) {
      return { subscription: null };
    }
    // Use /users/me which already includes subscription data
    const response = await this.client.get('/users/me');
    return { subscription: response.data.subscription };
  }

  // Courts methods
  async getCourts(page = 1, limit = 500, search = '', status?: string, city?: string) {
    if (USE_MOCK) {
      let courts = [...MOCK_COURTS];
      if (search) {
        const s = search.toLowerCase();
        courts = courts.filter(c => 
          c.name.toLowerCase().includes(s) || 
          c.address.toLowerCase().includes(s)
        );
      }
      if (status) {
        courts = courts.filter(c => c.status === status);
      }
      if (city && city !== 'all') {
        courts = courts.filter(c => c.city === city);
      }
      return { courts, total: courts.length, page, limit };
    }
    const response = await this.client.get('/courts', { params: { page, limit, search, status, city } });
    return response.data;
  }

  async getCourt(id: string) {
    if (USE_MOCK) {
      const court = MOCK_COURTS.find(c => c.id === id);
      return { court };
    }
    const response = await this.client.get(`/courts/${id}`);
    return response.data;
  }

  async getNearbyCourts(lat: number, lng: number, radius = 10, limit = 20) {
    if (USE_MOCK) {
      return { courts: MOCK_COURTS };
    }
    const response = await this.client.get('/courts/nearby', { params: { lat, lng, radius, limit } });
    return response.data;
  }

  async getFavorites() {
    if (USE_MOCK) {
      return { 
        favorites: MOCK_COURTS.slice(0, 2).map(court => ({
          id: `fav-${court.id}`,
          court,
          addedAt: new Date().toISOString(),
        })) 
      };
    }
    const response = await this.client.get('/courts/favorites/me');
    return response.data;
  }

  async addFavorite(courtId: string) {
    if (USE_MOCK) {
      return { success: true };
    }
    const response = await this.client.post('/courts/favorites', { courtId });
    return response.data;
  }

  async removeFavorite(courtId: string) {
    if (USE_MOCK) {
      return { success: true };
    }
    const response = await this.client.delete(`/courts/favorites/${courtId}`);
    return response.data;
  }

  async checkFavorite(courtId: string) {
    if (USE_MOCK) {
      return { isFavorite: false };
    }
    const response = await this.client.get(`/courts/favorites/check/${courtId}`);
    return response.data;
  }

  async reportCourtStatus(courtId: string, data: any) {
    if (USE_MOCK) {
      return { success: true };
    }
    // Backend expects POST /courts/report with courtId in body
    const response = await this.client.post('/courts/report', { courtId, ...data });
    return response.data;
  }

  async reportCourt(data: any) {
    if (USE_MOCK) {
      return { success: true };
    }
    const response = await this.client.post('/courts/report', data);
    return response.data;
  }

  // Items methods
  async getItems(page = 1, limit = 20) {
    if (USE_MOCK) {
      return { items: [], total: 0, page, limit };
    }
    const response = await this.client.get('/items', { params: { page, limit } });
    return response.data;
  }

  async getItem(id: string) {
    if (USE_MOCK) {
      return { item: null };
    }
    const response = await this.client.get(`/items/${id}`);
    return response.data;
  }

  async createItem(data: any) {
    if (USE_MOCK) {
      return { item: { ...data, id: 'mock-item-' + Date.now() } };
    }
    const response = await this.client.post('/items', data);
    return response.data;
  }

  async logout() {
    if (USE_MOCK) {
      return { success: true };
    }
    const response = await this.client.post('/auth/logout');
    return response.data;
  }

  async googleLogin(idToken: string) {
    if (USE_MOCK) {
      return { user: MOCK_USER, accessToken: this.mockToken };
    }
    // Send the Google ID token to backend for verification and creating/getting user
    const response = await this.client.post('/auth/google', { idToken });
    return response.data;
  }

  async firebaseLogin(idToken: string) {
    if (USE_MOCK) {
      return { user: MOCK_USER, accessToken: this.mockToken };
    }
    // Send the Firebase ID token to backend for verification
    const response = await this.client.post('/auth/firebase', { idToken });
    return response.data;
  }

  async firebaseRegister(idToken: string, name: string) {
    if (USE_MOCK) {
      return { user: { ...MOCK_USER, name }, accessToken: this.mockToken };
    }
    // Send the Firebase ID token + name to backend to create user
    const response = await this.client.post('/auth/firebase/register', { idToken, name });
    return response.data;
  }

  async registerPushToken(token: string) {
    if (USE_MOCK) {
      return { success: true };
    }
    const response = await this.client.post('/notifications/register', { token });
    return response.data;
  }

  async subscribeToCourt(courtId: string) {
    if (USE_MOCK) {
      return { success: true };
    }
    const response = await this.client.post('/notifications/subscribe', { courtId });
    return response.data;
  }

  async unsubscribeFromCourt(courtId: string) {
    if (USE_MOCK) {
      return { success: true };
    }
    const response = await this.client.delete(`/notifications/subscribe/${courtId}`);
    return response.data;
  }

  async getCourtSubscriptions() {
    if (USE_MOCK) {
      return { subscriptions: [] };
    }
    const response = await this.client.get('/notifications/subscriptions');
    return response.data;
  }

  async deleteNotification(id: string) {
    if (USE_MOCK) {
      return { success: true };
    }
    const response = await this.client.delete(`/notifications/${id}`);
    return response.data;
  }
}

export const api = new ApiClient();