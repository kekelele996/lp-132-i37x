import axios from 'axios';
import { useAuthStore } from '../store/auth';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  register: (data: any) => api.post('/auth/register', data),
  login: (data: any) => api.post('/auth/login', data),
};

export const userApi = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data: any) => api.put('/users/profile', data),
  getWorkers: (params?: any) => api.get('/users/workers', { params }),
  getWorkerDetail: (id: string) => api.get(`/users/workers/${id}`),
  getIncomeRanking: () => api.get('/users/income-ranking'),
};

export const elderlyApi = {
  getList: () => api.get('/elderly'),
  getDetail: (id: string) => api.get(`/elderly/${id}`),
  create: (data: any) => api.post('/elderly', data),
  update: (id: string, data: any) => api.put(`/elderly/${id}`, data),
  delete: (id: string) => api.delete(`/elderly/${id}`),
};

export const careNeedsApi = {
  getList: (params?: any) => api.get('/care-needs', { params }),
  getDetail: (id: string) => api.get(`/care-needs/${id}`),
  create: (data: any) => api.post('/care-needs', data),
  accept: (id: string) => api.post(`/care-needs/${id}/accept`),
  start: (id: string) => api.post(`/care-needs/${id}/start`),
  complete: (id: string) => api.post(`/care-needs/${id}/complete`),
  cancel: (id: string) => api.post(`/care-needs/${id}/cancel`),
};

export const reviewApi = {
  create: (data: any) => api.post('/reviews', data),
  getByOrder: (orderId: string) => api.get(`/reviews/order/${orderId}`),
};

export const messageApi = {
  getConversations: () => api.get('/messages/conversations'),
  getConversation: (userId: string, params?: any) => api.get(`/messages/conversation/${userId}`, { params }),
  send: (data: any) => api.post('/messages', data),
  getUnreadCount: () => api.get('/messages/unread-count'),
  markRead: (id: string) => api.post(`/messages/mark-read/${id}`),
};

export const favoriteApi = {
  getList: () => api.get('/favorites'),
  add: (workerId: string) => api.post(`/favorites/${workerId}`),
  remove: (workerId: string) => api.delete(`/favorites/${workerId}`),
};

export const scheduleApi = {
  getMySchedules: (params?: any) => api.get('/schedules/my', { params }),
  create: (data: any) => api.post('/schedules', data),
  update: (id: string, data: any) => api.put(`/schedules/${id}`, data),
  delete: (id: string) => api.delete(`/schedules/${id}`),
  getIncome: (params?: any) => api.get('/schedules/income', { params }),
};

export default api;
