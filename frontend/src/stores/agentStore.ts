import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { agentAuthApi } from '../services/agentApi';

const AUTH_KEY = 'comic-script-agent-auth';
const TOKEN_KEY = 'comic-script-agent-token';

export interface AgentUser {
    id: string;
    username: string;
    email: string;
    status: 'active' | 'frozen';
    projectQuota: number;
    projectsAllocated: number;
    remainingQuota: number;
    inviteCode: string;
    note?: string;
}

export const useAgentStore = defineStore('agent', () => {
    const isAuthenticated = ref(false);
    const user = ref<AgentUser | null>(null);
    const token = ref<string | null>(null);
    const loading = ref(false);
    const error = ref<string | null>(null);

    const init = async () => {
        const savedToken = localStorage.getItem(TOKEN_KEY);
        const savedUser = localStorage.getItem(AUTH_KEY);

        if (savedToken && savedUser) {
            try {
                token.value = savedToken;
                user.value = JSON.parse(savedUser);
                isAuthenticated.value = true;
                await refreshProfile();
            } catch {
                logout();
            }
        }
    };

    const refreshProfile = async () => {
        try {
            const response = await agentAuthApi.getProfile();
            if (response.data.user) {
                user.value = response.data.user;
                localStorage.setItem(AUTH_KEY, JSON.stringify(response.data.user));
            }
        } catch (err: any) {
            if (err.response?.status === 401) {
                logout();
            }
            throw err;
        }
    };

    const login = async (username: string, password: string): Promise<boolean> => {
        loading.value = true;
        error.value = null;

        try {
            const response = await agentAuthApi.login(username, password);

            if (response.data.token && response.data.user) {
                token.value = response.data.token;
                user.value = response.data.user;
                isAuthenticated.value = true;

                localStorage.setItem(TOKEN_KEY, response.data.token);
                localStorage.setItem(AUTH_KEY, JSON.stringify(response.data.user));

                return true;
            }
            return false;
        } catch (err: any) {
            error.value = err.response?.data?.error || '登录失败，请检查用户名和密码';
            return false;
        } finally {
            loading.value = false;
        }
    };

    const logout = () => {
        isAuthenticated.value = false;
        user.value = null;
        token.value = null;
        error.value = null;
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(TOKEN_KEY);
    };

    init();

    return {
        isAuthenticated: computed(() => isAuthenticated.value),
        user: computed(() => user.value),
        loading: computed(() => loading.value),
        error: computed(() => error.value),
        login,
        logout,
        refreshProfile,
    };
});
