import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import api from '../services/api';

// 存储 key
const AUTH_KEY = 'comic-script-creator-auth';
const TOKEN_KEY = 'comic-script-creator-token';

// 用户类型
export interface CreatorUser {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'creator';
  tier: 'trial' | 'paid';
  projectQuota: number;
  projectsUsed: number;
  trialEpisodesUsed: number;
  remainingTrialEpisodes: number;
  remainingProjectQuota: number;
}

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false);
  const user = ref<CreatorUser | null>(null);
  const token = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 初始化时检查 localStorage
  const init = async () => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(AUTH_KEY);

    if (savedToken && savedUser) {
      try {
        token.value = savedToken;
        user.value = JSON.parse(savedUser);
        isAuthenticated.value = true;

        // 验证 token 是否有效并刷新用户信息
        await refreshProfile();
      } catch {
        // Token 无效，清除本地存储
        logout();
      }
    }
  };

  // 刷新用户信息
  const refreshProfile = async () => {
    try {
      const response = await api.get('/creator/profile');
      if (response.data.user) {
        user.value = response.data.user;
        localStorage.setItem(AUTH_KEY, JSON.stringify(response.data.user));
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        // Token 过期
        logout();
      }
      throw err;
    }
  };

  // 刷新配额信息
  const refreshQuota = async () => {
    try {
      const response = await api.get('/creator/quota');
      if (response.data && user.value) {
        user.value = {
          ...user.value,
          tier: response.data.tier,
          projectQuota: response.data.projectQuota,
          projectsUsed: response.data.projectsUsed,
          trialEpisodesUsed: response.data.trialEpisodesUsed,
          remainingTrialEpisodes: response.data.remainingTrialEpisodes,
          remainingProjectQuota: response.data.remainingProjects,
        };
        localStorage.setItem(AUTH_KEY, JSON.stringify(user.value));
      }
      return response.data;
    } catch (err) {
      console.error('Failed to refresh quota:', err);
      throw err;
    }
  };

  // 注册
  const register = async (username: string, email: string, password: string, inviteCode?: string): Promise<boolean> => {
    loading.value = true;
    error.value = null;

    try {
      const payload: any = { username, email, password };
      if (inviteCode) payload.inviteCode = inviteCode;

      const response = await api.post('/creator/register', payload);

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
      error.value = err.response?.data?.error || '注册失败，请稍后重试';
      return false;
    } finally {
      loading.value = false;
    }
  };

  // 登录
  const login = async (username: string, password: string): Promise<boolean> => {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.post('/creator/login', {
        username,
        password,
      });

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

  // 登出
  const logout = () => {
    isAuthenticated.value = false;
    user.value = null;
    token.value = null;
    error.value = null;
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(TOKEN_KEY);
  };

  // 检查是否可以创建项目
  const canCreateProject = computed(() => {
    if (!user.value) return false;
    if (user.value.role === 'admin') return true;
    if (user.value.tier === 'trial') return user.value.projectsUsed < 1;
    return user.value.projectsUsed < user.value.projectQuota;
  });

  // 检查是否可以生成剧集
  const canGenerateEpisode = computed(() => {
    if (!user.value) return false;
    if (user.value.role === 'admin') return true;
    if (user.value.tier === 'paid') return true;
    return user.value.remainingTrialEpisodes > 0;
  });

  // 是否是管理员
  const isAdmin = computed(() => user.value?.role === 'admin');

  // 是否是试用用户
  const isTrial = computed(() => user.value?.tier === 'trial');

  // 获取 token（供 API 拦截器使用）
  const getToken = () => token.value;

  // 初始化
  init();

  return {
    // 状态
    isAuthenticated: computed(() => isAuthenticated.value),
    user: computed(() => user.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),

    // 计算属性
    canCreateProject,
    canGenerateEpisode,
    isAdmin,
    isTrial,

    // 方法
    login,
    register,
    logout,
    refreshProfile,
    refreshQuota,
    getToken,
  };
});
