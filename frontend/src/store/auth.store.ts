import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '@/lib/api';

interface User {
  id: string;
  username: string;
  email?: string;
  fullName: string;
  fullNameAr?: string;
  role: 'ADMIN' | 'CASHIER' | 'WAREHOUSE' | 'BRANCH_MANAGER';
  status: string;
  branchId?: string;
  branch?: { id: string; code: string; name: string; nameAr?: string };
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadProfile: () => Promise<void>;
  setTokens: (access: string, refresh: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      setTokens: (access, refresh) => {
        localStorage.setItem('accessToken', access);
        localStorage.setItem('refreshToken', refresh);
        set({ accessToken: access, refreshToken: refresh, isAuthenticated: true });
      },

      login: async (username, password) => {
        set({ isLoading: true });
        try {
          const res = await authApi.login(username, password);
          const { accessToken, refreshToken } = res.data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);
          set({ accessToken, refreshToken, isAuthenticated: true });
          await get().loadProfile();
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        try {
          const refresh = localStorage.getItem('refreshToken');
          await authApi.logout(refresh || undefined);
        } catch {}
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },

      loadProfile: async () => {
        try {
          const res = await authApi.profile();
          const raw: any = (res as any).data;
          set({
            user: {
              ...raw,
              fullName: raw.fullName ?? raw.full_name,
              fullNameAr: raw.fullNameAr ?? raw.full_name_ar,
              branchId: raw.branchId ?? raw.branch_id,
              avatarUrl: raw.avatarUrl ?? raw.avatar_url,
            },
          });
        } catch {
          set({ user: null, isAuthenticated: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        user: state.user,
      }),
    },
  ),
);
