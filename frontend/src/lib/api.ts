import axios, { AxiosError, AxiosInstance } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private instance: AxiosInstance;
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    this.instance = axios.create({ baseURL: BASE_URL, headers: { 'Content-Type': 'application/json' }, timeout: 30000 });
    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.instance.interceptors.request.use((config) => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
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
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            if (typeof window !== 'undefined') window.location.href = '/login';
            return Promise.reject(error);
          }
        }
        const message = (error.response?.data as any)?.message || error.message || 'An error occurred';
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
      const { accessToken, refreshToken: newRefresh } = (response.data as any).data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', newRefresh);
      return accessToken;
    })().finally(() => { this.refreshPromise = null; });
    return this.refreshPromise;
  }

  get<T = any>(url: string, params?: any): Promise<T> { return this.instance.get(url, { params }) as any; }
  post<T = any>(url: string, data?: any): Promise<T> { return this.instance.post(url, data) as any; }
  put<T = any>(url: string, data?: any): Promise<T> { return this.instance.put(url, data) as any; }
  patch<T = any>(url: string, data?: any): Promise<T> { return this.instance.patch(url, data) as any; }
  delete<T = any>(url: string): Promise<T> { return this.instance.delete(url) as any; }
  postForm<T = any>(url: string, data: FormData): Promise<T> {
    return this.instance.post(url, data, { headers: { 'Content-Type': 'multipart/form-data' } }) as any;
  }
}

export const api = new ApiClient();

export const authApi = {
  login: (username: string, password: string) => api.post('/v1/auth/login', { username, password }),
  logout: (refreshToken?: string) => api.post('/v1/auth/logout', { refreshToken }),
  profile: () => api.get('/v1/auth/profile'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch('/v1/auth/change-password', { currentPassword, newPassword }),
};

export const productsApi = {
  list: (params?: any) => api.get('/v1/products', params),
  byBarcode: (barcode: string) => api.get(`/v1/products/barcode/${encodeURIComponent(barcode)}`),
  byId: (id: string) => api.get(`/v1/products/${id}`),
  create: (data: any) => api.post('/v1/products', data),
  update: (id: string, data: any) => api.put(`/v1/products/${id}`, data),
  delete: (id: string) => api.delete(`/v1/products/${id}`),
  lowStock: (branchId?: string) => api.get('/v1/products/low-stock', branchId ? { branchId } : {}),
  categories: () => api.get('/v1/products/categories'),
  brands: () => api.get('/v1/products/brands'),
  suppliers: () => api.get('/v1/products/suppliers'),
  exportExcel: () => `${BASE_URL}/v1/products/export/excel`,
  importExcel: (file: File) => { const f = new FormData(); f.append('file', file); return api.postForm('/v1/products/import/excel', f); },
};

export const salesApi = {
  list: (params?: any) => api.get('/v1/sales', params),
  byId: (id: string) => api.get(`/v1/sales/${id}`),
  create: (data: any) => api.post('/v1/sales', data),
  refund: (id: string, data: any) => api.post(`/v1/sales/${id}/refund`, data),
  dailySummary: (branchId: string, date?: string) => api.get('/v1/sales/daily-summary', { branchId, ...(date && { date }) }),
};

export const inventoryApi = {
  stock: (params?: any) => api.get('/v1/inventory', params),
  movements: (params?: any) => api.get('/v1/inventory/movements', params),
  adjust: (data: any) => api.post('/v1/inventory/adjust', data),
  count: (data: any) => api.post('/v1/inventory/count', data),
};

export const purchasesApi = {
  list: (params?: any) => api.get('/v1/purchases', params),
  byId: (id: string) => api.get(`/v1/purchases/${id}`),
  create: (data: any) => api.post('/v1/purchases', data),
  report: (params: any) => api.get('/v1/purchases/report', params),
  suppliers: (params?: any) => api.get('/v1/purchases/suppliers', params),
  createSupplier: (data: any) => api.post('/v1/purchases/suppliers', data),
  updateSupplier: (id: string, data: any) => api.put(`/v1/purchases/suppliers/${id}`, data),
};

export const transfersApi = {
  list: (params?: any) => api.get('/v1/transfers', params),
  byId: (id: string) => api.get(`/v1/transfers/${id}`),
  create: (data: any) => api.post('/v1/transfers', data),
  updateStatus: (id: string, status: string) => api.patch(`/v1/transfers/${id}/status`, { status }),
};

export const shiftsApi = {
  list: (params?: any) => api.get('/v1/shifts', params),
  active: () => api.get('/v1/shifts/active'),
  open: (data: any) => api.post('/v1/shifts/open', data),
  close: (id: string, data: any) => api.patch(`/v1/shifts/${id}/close`, data),
  report: (id: string) => api.get(`/v1/shifts/${id}/report`),
};

export const reportsApi = {
  dashboard: (branchId?: string) => api.get('/v1/reports/dashboard', branchId ? { branchId } : {}),
  sales: (params: any) => api.get('/v1/reports/sales', params),
  profit: (params: any) => api.get('/v1/reports/profit', params),
  exportSales: (params: any) => `${BASE_URL}/v1/reports/sales/export?${new URLSearchParams(params)}`,
};

export const usersApi = {
  list: (params?: any) => api.get('/v1/users', params),
  byId: (id: string) => api.get(`/v1/users/${id}`),
  create: (data: any) => api.post('/v1/users', data),
  update: (id: string, data: any) => api.put(`/v1/users/${id}`, data),
  resetPassword: (id: string, data: any) => api.patch(`/v1/users/${id}/reset-password`, data),
  deactivate: (id: string) => api.patch(`/v1/users/${id}/deactivate`),
  branches: () => api.get('/v1/users/branches'),
  createBranch: (data: any) => api.post('/v1/users/branches', data),
};

export const categoriesApi = {
  list: (params?: any) => api.get('/v1/categories', params),
  create: (data: any) => api.post('/v1/categories', data),
  update: (id: string, data: any) => api.put(`/v1/categories/${id}`, data),
  delete: (id: string) => api.delete(`/v1/categories/${id}`),
  brands: (params?: any) => api.get('/v1/categories/brands', params),
  createBrand: (data: any) => api.post('/v1/categories/brands', data),
  updateBrand: (id: string, data: any) => api.put(`/v1/categories/brands/${id}`, data),
};

export const notificationsApi = {
  list: (unreadOnly?: boolean) => api.get('/v1/notifications', unreadOnly ? { unreadOnly } : {}),
  unreadCount: () => api.get('/v1/notifications/unread-count'),
  markRead: (id: string) => api.patch(`/v1/notifications/${id}/read`),
  markAllRead: () => api.patch('/v1/notifications/read-all'),
};
