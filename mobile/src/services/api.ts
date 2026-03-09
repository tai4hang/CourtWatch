import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

class ApiClient {
  private client: AxiosInstance;
  private refreshPromise: Promise<string | null> | null = null;

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
    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const token = await SecureStore.getItemAsync('accessToken');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newToken = await this.refreshToken();
            if (newToken && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, logout user
            await this.logout();
            throw refreshError;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private async refreshToken(): Promise<string | null> {
    // Prevent multiple refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) return null;

        const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
          refreshToken,
        });

        const { accessToken } = response.data;
        await SecureStore.setItemAsync('accessToken', accessToken);
        return accessToken;
      } catch {
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  async logout() {
    try {
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
    } catch {
      // Ignore errors during logout
    }
  }

  // Auth endpoints
  async register(email: string, password: string, name?: string) {
    const response = await this.client.post('/auth/register', { email, password, name });
    return response.data;
  }

  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    return response.data;
  }

  async verifyToken() {
    const response = await this.client.get('/auth/verify');
    return response.data;
  }

  // User endpoints
  async getMe() {
    const response = await this.client.get('/users/me');
    return response.data;
  }

  async updateMe(data: { name?: string; avatarUrl?: string }) {
    const response = await this.client.put('/users/me', data);
    return response.data;
  }

  // Items endpoints
  async getItems(page = 1, limit = 20) {
    const response = await this.client.get('/items', { params: { page, limit } });
    return response.data;
  }

  async getItem(id: string) {
    const response = await this.client.get(`/items/${id}`);
    return response.data;
  }

  async createItem(data: { title: string; description?: string; metadata?: object }) {
    const response = await this.client.post('/items', data);
    return response.data;
  }

  async updateItem(id: string, data: { title?: string; description?: string; metadata?: object }) {
    const response = await this.client.put(`/items/${id}`, data);
    return response.data;
  }

  async deleteItem(id: string) {
    const response = await this.client.delete(`/items/${id}`);
    return response.data;
  }

  // Billing endpoints
  async createCheckoutSession() {
    const response = await this.client.post('/billing/create-checkout-session');
    return response.data;
  }

  async createPortalSession() {
    const response = await this.client.post('/billing/create-portal-session');
    return response.data;
  }

  async getSubscription() {
    const response = await this.client.get('/billing/subscription');
    return response.data;
  }

  // Notifications endpoints
  async getNotifications(limit = 20, read?: boolean) {
    const response = await this.client.get('/notifications', { params: { limit, read } });
    return response.data;
  }

  async markNotificationRead(id: string) {
    const response = await this.client.put(`/notifications/${id}/read`);
    return response.data;
  }

  async markAllNotificationsRead() {
    const response = await this.client.put('/notifications/read-all');
    return response.data;
  }
}

export const api = new ApiClient();
