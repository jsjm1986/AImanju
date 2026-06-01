import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

// 访问账号配置
// 推荐通过 Vite 环境变量配置（.env: VITE_AUTH_USERNAME / VITE_AUTH_PASSWORD）
// 注意：前端鉴权仅适用于内部低风险场景，公网部署请使用后端 JWT 鉴权
const VALID_USERNAME = import.meta.env.VITE_AUTH_USERNAME || 'admin';
const VALID_PASSWORD = import.meta.env.VITE_AUTH_PASSWORD || 'change-me-please';
const AUTH_KEY = 'comic-script-auth';

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false);
  const username = ref('');

  // 初始化时检查 localStorage
  const init = () => {
    const saved = localStorage.getItem(AUTH_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.isAuthenticated && data.username === VALID_USERNAME) {
          isAuthenticated.value = true;
          username.value = data.username;
        }
      } catch {
        localStorage.removeItem(AUTH_KEY);
      }
    }
  };

  // 登录
  const login = (inputUsername: string, inputPassword: string): boolean => {
    if (inputUsername === VALID_USERNAME && inputPassword === VALID_PASSWORD) {
      isAuthenticated.value = true;
      username.value = inputUsername;
      localStorage.setItem(AUTH_KEY, JSON.stringify({
        isAuthenticated: true,
        username: inputUsername
      }));
      return true;
    }
    return false;
  };

  // 登出
  const logout = () => {
    isAuthenticated.value = false;
    username.value = '';
    localStorage.removeItem(AUTH_KEY);
  };

  // 初始化
  init();

  return {
    isAuthenticated: computed(() => isAuthenticated.value),
    username: computed(() => username.value),
    login,
    logout
  };
});
