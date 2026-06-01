import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '@/services/api';

export interface User {
    id: string;
    username: string;
    email: string;
    nickname: string;
    avatar?: string;
    points: number;
    role: 'buyer' | 'admin';
}

export const useAuthStore = defineStore('auth', () => {
    const token = ref<string | null>(localStorage.getItem('token'));
    const user = ref<User | null>(null);
    const loading = ref(false);

    const isAuthenticated = computed(() => !!token.value && !!user.value);
    const isAdmin = computed(() => user.value?.role === 'admin');

    // 初始化：从 localStorage 恢复状态
    async function init() {
        if (token.value) {
            try {
                await fetchUser();
            } catch {
                // Token 无效，清除
                logout();
            }
        }
    }

    // 登录
    async function login(username: string, password: string) {
        loading.value = true;
        try {
            const response = await authApi.login(username, password) as any;
            token.value = response.token;
            user.value = response.user;
            localStorage.setItem('token', response.token);
            return response;
        } finally {
            loading.value = false;
        }
    }

    // 注册
    async function register(data: { username: string; email: string; password: string; nickname?: string }) {
        loading.value = true;
        try {
            const response = await authApi.register(data) as any;
            token.value = response.token;
            user.value = response.user;
            localStorage.setItem('token', response.token);
            return response;
        } finally {
            loading.value = false;
        }
    }

    // 获取当前用户信息
    async function fetchUser() {
        if (!token.value) return;
        const userData = await authApi.getMe() as any;
        user.value = userData;
    }

    // 登出
    function logout() {
        token.value = null;
        user.value = null;
        localStorage.removeItem('token');
    }

    // 更新积分（购买后调用）
    function updatePoints(newPoints: number) {
        if (user.value) {
            user.value.points = newPoints;
        }
    }

    return {
        token,
        user,
        loading,
        isAuthenticated,
        isAdmin,
        init,
        login,
        register,
        fetchUser,
        logout,
        updatePoints,
    };
});
