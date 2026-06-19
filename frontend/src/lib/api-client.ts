import axios from 'axios';
import { useAuthStore } from '@/store/auth';
import { queryClient } from '@/lib/query-client';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

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
        queryClient.clear();
        window.location.href = import.meta.env.BASE_URL + 'login';
        throw e;
      } finally {
        isRefreshing = false;
      }
    }
    // 403 on GET requests only: user was demoted or lost access — redirect to forbidden page.
    // Do NOT redirect for mutations (POST/PATCH/PUT/DELETE) — let onError handlers deal with those.
    if (error.response?.status === 403) {
      const reqUrl = error.config?.url ?? '';
      const method = (error.config?.method ?? 'get').toLowerCase();
      if (method === 'get' && !reqUrl.includes('/auth/')) {
        if (window.location.pathname !== '/403') {
          queryClient.clear();
          window.location.href = import.meta.env.BASE_URL + '403';
        }
      }
    }
    throw error;
  },
);
