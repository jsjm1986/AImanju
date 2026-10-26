import axios from 'axios';
import { API_BASE } from './apiConfig';
const AGENT_TOKEN_KEY = 'comic-script-agent-token';

const agentHttp = axios.create({
    baseURL: API_BASE,
    timeout: 30000,
});

agentHttp.interceptors.request.use((config) => {
    const token = localStorage.getItem(AGENT_TOKEN_KEY);
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

agentHttp.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem(AGENT_TOKEN_KEY);
            localStorage.removeItem('comic-script-agent-auth');
            if (window.location.pathname.startsWith('/agent') && !window.location.pathname.includes('/agent/login')) {
                window.location.href = '/agent/login';
            }
        }
        return Promise.reject(error);
    }
);

export const agentAuthApi = {
    login: (username: string, password: string) =>
        agentHttp.post('/agent/login', { username, password }),

    getProfile: () =>
        agentHttp.get('/agent/profile'),

    updateProfile: (data: { email?: string; currentPassword?: string; newPassword?: string }) =>
        agentHttp.put('/agent/profile', data),
};

export const agentDashboardApi = {
    getStats: () =>
        agentHttp.get('/agent/dashboard/stats'),

    getCreators: (params: { page?: number; limit?: number; search?: string; tier?: string }) =>
        agentHttp.get('/agent/dashboard/creators', { params }),

    getCreatorDetail: (id: string) =>
        agentHttp.get(`/agent/dashboard/creators/${id}`),

    activateCreator: (id: string, projectCount: number) =>
        agentHttp.put(`/agent/dashboard/creators/${id}/activate`, { projectCount }),

    addQuota: (id: string, projectCount: number) =>
        agentHttp.put(`/agent/dashboard/creators/${id}/add-quota`, { projectCount }),

    getInvite: () =>
        agentHttp.get('/agent/dashboard/invite'),

    refreshInvite: () =>
        agentHttp.post('/agent/dashboard/invite/refresh'),

    getAllocations: (params: { page?: number; limit?: number; type?: string }) =>
        agentHttp.get('/agent/dashboard/allocations', { params }),
};

export default agentHttp;
