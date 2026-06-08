import axios from 'axios';
import { useAuthStore } from '@/store/auth';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/training/api/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

apiClient.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    const url = original.url ?? '';
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/refresh');
    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise<typeof error.config>((resolve, reject) => {
          refreshQueue.push({
            resolve: (token) => {
              original.headers.Authorization = `Bearer ${token}`;
              resolve(apiClient(original));
            },
            reject,
          });
        });
      }
      original._retry = true;
      isRefreshing = true;
      try {
        const { data } = await axios.post(
          `${BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true },
        );
        const newToken: string = data.data.access;
        useAuthStore.setState({ accessToken: newToken });
        refreshQueue.forEach(({ resolve }) => resolve(newToken));
        refreshQueue = [];
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      } catch (e) {
        refreshQueue.forEach(({ reject }) => reject(e));
        refreshQueue = [];
        useAuthStore.getState().logout();
        window.location.href = '/training/login';
        throw e;
      } finally {
        isRefreshing = false;
      }
    }
    throw error;
  },
);
