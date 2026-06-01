<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAgentStore } from '@/stores/agentStore';

const router = useRouter();
const agentStore = useAgentStore();

const username = ref('');
const password = ref('');

const isLoading = computed(() => agentStore.loading);
const error = computed(() => agentStore.error);

const handleLogin = async () => {
  if (!username.value || !password.value) return;

  const success = await agentStore.login(username.value, password.value);
  if (success) {
    router.push('/agent/dashboard');
  }
};
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1>代理商后台</h1>
        <p>登录以管理您的创作者</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="username">用户名</label>
          <input
            id="username"
            v-model="username"
            type="text"
            placeholder="请输入用户名或邮箱"
            :disabled="isLoading"
            autocomplete="username"
          />
        </div>

        <div class="form-group">
          <label for="password">密码</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="请输入密码"
            :disabled="isLoading"
            autocomplete="current-password"
          />
        </div>

        <div v-if="error" class="error-message">{{ error }}</div>

        <button type="submit" class="login-btn" :disabled="isLoading">
          {{ isLoading ? '登录中...' : '登录' }}
        </button>
      </form>

      <div class="login-footer">
        <p>代理账号由管理员创建，如需开通请联系管理员</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-base);
  padding: 20px;
}
.login-card {
  background: var(--bg-surface);
  border-radius: 16px;
  padding: 40px;
  width: 100%;
  max-width: 420px;
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border-default);
}
.login-header { text-align: center; margin-bottom: 24px; }
.login-header h1 { color: var(--text-primary); font-size: 24px; margin-bottom: 8px; }
.login-header p { color: var(--text-tertiary); font-size: 14px; }
.login-form { display: flex; flex-direction: column; gap: 16px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label { color: var(--text-secondary); font-size: 14px; }
.form-group input {
  padding: 12px 16px; border-radius: 8px; border: 1px solid var(--border-default);
  background: var(--bg-elevated); color: var(--text-primary); font-size: 16px; transition: all 0.2s;
}
.form-group input:focus { outline: none; border-color: var(--primary); background: var(--bg-hover); }
.form-group input::placeholder { color: var(--text-muted); }
.form-group input:disabled { opacity: 0.6; cursor: not-allowed; }
.error-message {
  color: var(--error); font-size: 14px; text-align: center; padding: 8px;
  background: var(--error-muted); border-radius: 6px;
}
.login-btn {
  padding: 14px; border-radius: 8px; border: none; background: var(--primary);
  color: var(--text-on-primary); font-size: 16px; font-weight: 600; cursor: pointer;
  transition: all 0.2s; margin-top: 8px;
}
.login-btn:hover:not(:disabled) { background: var(--primary-hover); transform: translateY(-2px); box-shadow: var(--shadow-lg); }
.login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.login-footer { margin-top: 24px; text-align: center; }
.login-footer p { color: var(--text-tertiary); font-size: 13px; }
</style>
