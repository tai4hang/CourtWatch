import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CourtNotification {
  courtId: string;
  courtName: string;
  enabledAt: string; // ISO timestamp
}

interface NotificationState {
  notifications: CourtNotification[];
  isLoading: boolean;
  
  // Actions
  loadNotifications: () => Promise<void>;
  addNotification: (courtId: string, courtName: string) => Promise<void>;
  removeNotification: (courtId: string) => Promise<void>;
  isNotificationEnabled: (courtId: string) => boolean;
}

const STORAGE_KEY = 'court_notifications';

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  isLoading: false,

  loadNotifications: async () => {
    set({ isLoading: true });
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const notifications = JSON.parse(stored) as CourtNotification[];
        set({ notifications, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
      set({ isLoading: false });
    }
  },

  addNotification: async (courtId: string, courtName: string) => {
    const { notifications } = get();
    // Don't add duplicates
    if (notifications.some(n => n.courtId === courtId)) {
      return;
    }
    const newNotification: CourtNotification = {
      courtId,
      courtName,
      enabledAt: new Date().toISOString(),
    };
    const updated = [...notifications, newNotification];
    set({ notifications: updated });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  removeNotification: async (courtId: string) => {
    const { notifications } = get();
    const updated = notifications.filter(n => n.courtId !== courtId);
    set({ notifications: updated });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  isNotificationEnabled: (courtId: string) => {
    const { notifications } = get();
    return notifications.some(n => n.courtId === courtId);
  },
}));