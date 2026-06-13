import axios, { AxiosError, AxiosInstance } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private instance: AxiosInstance;
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    this.instance = axios.create({
      baseURL: BASE_URL,
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request - attach token
    this.instance.interceptors.request.use((config) => {
      const token = this.getAccessToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
      const lang = document.documentElement.lang || 'ar';
      config.headers['Accept-Language'] = lang;
      return config;
    });

    // Response - handle 401 and refresh
    this.instance.interceptors.response.use(
      (response) => response.data,
      async (error: AxiosError) => {
        const original = error.config as any;

        if (error.response?.status === 401 && !original._retry) {
          original._retry = true;
          try {
            const newToken = await this.refreshAccessToken();
            original.headers.Authorization = `Bearer ${newToken}`;
            return this.instance(original);
          } catch {
            this.logout();
            window.location.href = '/login';
            return Promise.reject(error);
          }
        }

        const message =
          (error.response?.data as any)?.message ||
          error.message ||
          'An unexpected error occurred';

        return Promise.reject(new Error(Array.isArray(message) ? message.join(', ') : message));
      },
    );
  }

  private async refreshAccessToken(): Promise<string> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) throw new Error('No refresh token');

      const response = await axios.post(`${BASE_URL}/v1/auth/refresh`, { refreshToken });
      const { accessToken, refreshToken: newRefresh } = response.data.data;

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', newRefresh);
      return accessToken;
    })().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  private getAccessToken(): string | null {
    return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  }

  logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  // HTTP methods
  get<T = any>(url: string, params?: any): Promise<T> {
    return this.instance.get(url, { params }) as unknown as Promise<T>;
  }

  post<T = any>(url: string, data?: any): Promise<T> {
    return this.instance.post(url, data) as unknown as Promise<T>;
  }

  put<T = any>(url: string, data?: any): Promise<T> {
    return this.instance.put(url, data) as unknown as Promise<T>;
  }

  patch<T = any>(url: string, data?: any): Promise<T> {
    return this.instance.patch(url, data) as unknown as Promise<T>;
  }

  delete<T = any>(url: string): Promise<T> {
    return this.instance.delete(url) as unknown as Promise<T>;
  }

  postForm<T = any>(url: string, data: FormData): Promise<T> {
    return this.instance.post(url, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }) as unknown as Promise<T>;
  }
}

export const api = new ApiClient();

// Typed API functions
export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ data: { accessToken: string; refreshToken: string; expiresIn: number } }>(
      '/v1/auth/login',
      { username, password },
    ),
  logout: (refreshToken?: string) => api.post('/v1/auth/logout', { refreshToken }),
  profile: () => api.get('/v1/auth/profile'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch('/v1/auth/change-password', { currentPassword, newPassword }),
};

export const productsApi = {
  list: (params?: any) => api.get('/v1/products', params),
  byBarcode: (barcode: string) => api.get(`/v1/products/barcode/${barcode}`),
  byId: (id: string) => api.get(`/v1/products/${id}`),
  create: (data: any) => api.post('/v1/products', data),
  update: (id: string, data: any) => api.put(`/v1/products/${id}`, data),
  delete: (id: string) => api.delete(`/v1/products/${id}`),
  lowStock: (branchId?: string) => api.get('/v1/products/low-stock', { branchId }),
  exportExcel: () => `${BASE_URL}/v1/products/export/excel`,
  importExcel: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.postForm('/v1/products/import/excel', form);
  },
};

export const salesApi = {
  list: (params?: any) => api.get('/v1/sales', params),
  byId: (id: string) => api.get(`/v1/sales/${id}`),
  create: (data: any) => api.post('/v1/sales', data),
  refund: (id: string, data: any) => api.post(`/v1/sales/${id}/refund`, data),
  dailySummary: (branchId: string, date?: string) =>
    api.get('/v1/sales/daily-summary', { branchId, date }),
};

export const inventoryApi = {
  stock: (params?: any) => api.get('/v1/inventory', params),
  movements: (params?: any) => api.get('/v1/inventory/movements', params),
  adjust: (data: any) => api.post('/v1/inventory/adjust', data),
  count: (data: any) => api.post('/v1/inventory/count', data),
};

export const reportsApi = {
  dashboard: (branchId?: string) => api.get('/v1/reports/dashboard', { branchId }),
  sales: (params: any) => api.get('/v1/reports/sales', params),
  profit: (params: any) => api.get('/v1/reports/profit', params),
};

export const notificationsApi = {
  list: (unreadOnly?: boolean) => api.get('/v1/notifications', { unreadOnly }),
  unreadCount: () => api.get('/v1/notifications/unread-count'),
  markRead: (id: string) => api.patch(`/v1/notifications/${id}/read`),
  markAllRead: () => api.patch('/v1/notifications/read-all'),
};
