import axios from 'axios';
import { STORAGE_KEYS, ROUTES } from '../constants';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request interceptor: attach JWT token automatically ──────────────────────
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: redirect to login on 401 ───────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // Clear stale auth state and redirect
      Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
      window.location.href = ROUTES.LOGIN;
    }
    return Promise.reject(error);
  }
);

export default apiClient;
