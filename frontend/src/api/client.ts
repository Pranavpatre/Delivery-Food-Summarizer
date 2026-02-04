import axios from 'axios';
import type { CalendarMonthResponse, User, SyncStatus, TokenResponse, SummaryResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  // Exchange Google OAuth code for our JWT token
  googleCallback: async (code: string): Promise<TokenResponse> => {
    const response = await api.get(`/auth/google/callback?code=${code}`);
    return response.data;
  },

  // Get Google OAuth login URL
  getGoogleLoginUrl: (): string => {
    return `${API_BASE_URL}/auth/google/login`;
  },

  // Get current user info
  getCurrentUser: async (): Promise<User> => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  // Logout
  logout: () => {
    localStorage.removeItem('auth_token');
  },
};

export const calendarApi = {
  // Get calendar data for a specific month
  getMonth: async (year: number, month: number): Promise<CalendarMonthResponse> => {
    const response = await api.get(`/api/calendar/${year}/${month}`);
    return response.data;
  },

  // Get summary stats for the last 2 months
  getSummary: async (): Promise<SummaryResponse> => {
    const response = await api.get('/api/summary');
    return response.data;
  },
};

export const syncApi = {
  // Trigger email sync
  triggerSync: async (): Promise<SyncStatus> => {
    const response = await api.post('/api/sync');
    return response.data;
  },

  // Get sync status
  getStatus: async (): Promise<SyncStatus> => {
    const response = await api.get('/api/sync/status');
    return response.data;
  },
};

export default api;
