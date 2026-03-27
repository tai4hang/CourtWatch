import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api } from '../services/api';

export type CourtStatus = 'available' | 'partial' | 'full' | 'unknown';

export interface Court {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  total_courts: number;
  court_type: 'indoor' | 'outdoor' | 'both';
  surface: 'hard' | 'clay' | 'grass' | 'carpet';
  has_lights: boolean;
  is_free: boolean;
  google_maps_url: string | null;
  notes: string | null;
  currentStatus: CourtStatus;
  availableCourts?: number;
  queueGroups?: number;
  waitTimeMinutes?: number;
  lastReported?: string;
  distance_km?: number;
  isFavorite: boolean;
}

export interface CourtReport {
  id: string;
  court_id: string;
  user_id: string;
  available_courts: number;
  queue_groups: number;
  wait_time_minutes: number | null;
  status: CourtStatus;
  report_type: 'availability' | 'queue';
  created_at: string;
}

interface CourtState {
  courts: Court[];
  favorites: Court[];
  currentCourt: Court | null;
  reports: CourtReport[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchCourts: (page?: number, limit?: number) => Promise<void>;
  fetchNearbyCourts: (lat: number, lng: number, radius?: number) => Promise<void>;
  fetchFavorites: () => Promise<void>;
  fetchCourtDetails: (courtId: string) => Promise<void>;
  fetchCourtReports: (courtId: string, limit?: number) => Promise<void>;
  addFavorite: (courtId: string) => Promise<void>;
  removeFavorite: (courtId: string) => Promise<void>;
  reportStatus: (courtId: string, data: {
    availableCourts: number;
    queueGroups: number;
    waitTimeMinutes?: number;
    status: CourtStatus;
    reportType: 'availability' | 'queue';
  }) => Promise<void>;
  clearError: () => void;
}

export const useCourtStore = create<CourtState>((set, get) => ({
  courts: [],
  favorites: [],
  currentCourt: null,
  reports: [],
  isLoading: false,
  error: null,

  fetchCourts: async (page = 1, limit = 20) => {
    set({ isLoading: true, error: null });
    try {
      const { courts } = await api.getCourts(page, limit);
      set({ courts, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch courts', isLoading: false });
    }
  },

  fetchNearbyCourts: async (lat: number, lng: number, radius = 10) => {
    set({ isLoading: true, error: null });
    try {
      const { courts } = await api.getNearbyCourts(lat, lng, radius);
      set({ courts, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch nearby courts', isLoading: false });
    }
  },

  fetchFavorites: async () => {
    set({ isLoading: true, error: null });
    try {
      const { favorites } = await api.getFavorites();
      const courts = favorites?.map((f: any) => f.court) || [];
      set({ favorites: courts, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch favorites', isLoading: false });
    }
  },

  fetchCourtDetails: async (courtId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { court } = await api.getCourt(courtId);
      set({ currentCourt: court, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch court details', isLoading: false });
    }
  },

  fetchCourtReports: async (courtId: string, limit = 20) => {
    try {
      // API doesn't have getCourtReports - return empty for now
      const reports: any[] = [];
      set({ reports });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch reports' });
    }
  },

  addFavorite: async (courtId: string) => {
    try {
      await api.addFavorite(courtId);
      // Update local state
      const courts = get().courts.map(c => 
        c.id === courtId ? { ...c, isFavorite: true } : c
      );
      const currentCourt = get().currentCourt;
      if (currentCourt?.id === courtId) {
        set({ currentCourt: { ...currentCourt, isFavorite: true } });
      }
      set({ courts });
      // Refresh favorites list
      get().fetchFavorites();
    } catch (error: any) {
      set({ error: error.message || 'Failed to add favorite' });
    }
  },

  removeFavorite: async (courtId: string) => {
    try {
      await api.removeFavorite(courtId);
      // Update local state
      const courts = get().courts.map(c => 
        c.id === courtId ? { ...c, isFavorite: false } : c
      );
      const currentCourt = get().currentCourt;
      if (currentCourt?.id === courtId) {
        set({ currentCourt: { ...currentCourt, isFavorite: false } });
      }
      set({ courts });
      // Refresh favorites list
      get().fetchFavorites();
    } catch (error: any) {
      set({ error: error.message || 'Failed to remove favorite' });
    }
  },

  reportStatus: async (courtId: string, data) => {
    set({ isLoading: true, error: null });
    try {
      await api.reportCourtStatus(courtId, data);
      // Refresh court details to get updated status
      await get().fetchCourtDetails(courtId);
      await get().fetchCourtReports(courtId);
      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to report status', isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));

// Helper function to get status color
export function getStatusColor(status: CourtStatus): string {
  switch (status) {
    case 'available':
      return '#22C55E'; // Green
    case 'partial':
      return '#EAB308'; // Yellow
    case 'full':
      return '#EF4444'; // Red
    default:
      return '#6B7280'; // Gray - unknown
  }
}

export function getStatusLabel(status: CourtStatus): string {
  switch (status) {
    case 'available':
      return 'Available';
    case 'partial':
      return 'Partially Available';
    case 'full':
      return 'Full';
    default:
      return 'Unknown';
  }
}