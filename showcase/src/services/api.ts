import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8333/api';

// 创建 axios 实例
const http = axios.create({
    baseURL: API_BASE,
    timeout: 30000,
});

// 请求拦截器：添加 Token
http.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// 响应拦截器：处理错误
http.interceptors.response.use(
    (response) => response.data,
    (error) => {
        if (error.response?.status === 401) {
            // Token 过期，清除并跳转登录
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error.response?.data || error);
    }
);

// 认证 API
export const authApi = {
    login: (username: string, password: string) =>
        http.post('/auth/login', { username, password }),

    register: (data: { username: string; email: string; password: string; nickname?: string }) =>
        http.post('/auth/register', data),

    getMe: () => http.get('/auth/me'),

    updateMe: (data: { nickname?: string; avatar?: string }) =>
        http.put('/auth/me', data),

    changePassword: (oldPassword: string, newPassword: string) =>
        http.put('/auth/me/password', { oldPassword, newPassword }),
};

// 买家 API
export const buyerApi = {
    // 获取已上架项目列表
    getProjects: (params?: { page?: number; limit?: number; tag?: string }) =>
        http.get('/buyer/projects', { params }),

    // 获取项目详情
    getProject: (projectId: string) =>
        http.get(`/buyer/projects/${projectId}`),

    // 获取项目剧集列表
    getEpisodes: (projectId: string) =>
        http.get(`/buyer/projects/${projectId}/episodes`),

    // 获取剧集内容（通过项目ID和集数）
    getEpisodeContent: (projectId: string, episodeNumber: number) =>
        http.get(`/buyer/projects/${projectId}/episodes/${episodeNumber}/content`),

    // 购买单集
    purchaseEpisode: (episodeId: string) =>
        http.post(`/buyer/episodes/${episodeId}/purchase`),

    // 获取已购列表
    getPurchases: () =>
        http.get('/buyer/purchases'),

    // 获取积分流水
    getTransactions: (params?: { page?: number; limit?: number; type?: string }) =>
        http.get('/buyer/transactions', { params }),

    // 收藏项目
    addFavorite: (projectId: string) =>
        http.post(`/buyer/favorites/${projectId}`),

    // 取消收藏
    removeFavorite: (projectId: string) =>
        http.delete(`/buyer/favorites/${projectId}`),

    // 获取收藏列表
    getFavorites: () =>
        http.get('/buyer/favorites'),
};

export default http;
