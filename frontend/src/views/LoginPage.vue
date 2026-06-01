<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const mode = ref<'login' | 'register'>('login');

const username = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const inviteCode = ref('');

const isLoading = computed(() => authStore.loading);
const error = computed(() => authStore.error);

onMounted(() => {
  const invite = route.query.invite as string;
  if (invite) {
    inviteCode.value = invite.toUpperCase();
    mode.value = 'register';
  }
});

const handleLogin = async () => {
  if (!username.value || !password.value) return;

  const success = await authStore.login(username.value, password.value);
  if (success) {
    const redirect = route.query.redirect as string || '/';
    router.push(redirect);
  }
};

const handleRegister = async () => {
  if (!username.value || !email.value || !password.value) return;
  if (password.value !== confirmPassword.value) return;

  const success = await authStore.register(username.value, email.value, password.value, inviteCode.value || undefined);
  if (success) {
    const redirect = route.query.redirect as string || '/';
    router.push(redirect);
  }
};

const handleSubmit = () => {
  if (mode.value === 'login') {
    handleLogin();
  } else {
    handleRegister();
  }
};
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1>剧本生成系统</h1>
        <p>{{ mode === 'login' ? '登录以使用完整功能' : '注册新账户' }}</p>
      </div>

      <!-- 模式切换 -->
      <div class="mode-tabs">
        <button 
          :class="['tab-btn', { active: mode === 'login' }]"
          @click="mode = 'login'"
        >
          登录
        </button>
        <button 
          :class="['tab-btn', { active: mode === 'register' }]"
          @click="mode = 'register'"
        >
          注册
        </button>
      </div>
      
      <form @submit.prevent="handleSubmit" class="login-form">
        <div class="form-group">
          <label for="username">用户名</label>
          <input
            id="username"
            v-model="username"
            type="text"
            placeholder="请输入用户名"
            :disabled="isLoading"
            autocomplete="username"
          />
        </div>

        <!-- 注册时显示邮箱 -->
        <div v-if="mode === 'register'" class="form-group">
          <label for="email">邮箱</label>
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="请输入邮箱"
            :disabled="isLoading"
            autocomplete="email"
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

        <!-- 注册时显示确认密码 -->
        <div v-if="mode === 'register'" class="form-group">
          <label for="confirmPassword">确认密码</label>
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            :disabled="isLoading"
            autocomplete="new-password"
          />
          <p v-if="password && confirmPassword && password !== confirmPassword" class="field-error">
            两次输入的密码不一致
          </p>
        </div>

        <!-- 注册时显示邀请码 -->
        <div v-if="mode === 'register'" class="form-group">
          <label for="inviteCode">邀请码 <span class="optional">(选填)</span></label>
          <input
            id="inviteCode"
            v-model="inviteCode"
            type="text"
            placeholder="如有邀请码请填写"
            :disabled="isLoading"
            maxlength="20"
            style="text-transform: uppercase"
          />
        </div>
        
        <div v-if="error" class="error-message">
          {{ error }}
        </div>
        
        <button type="submit" class="login-btn" :disabled="isLoading">
          {{ isLoading ? (mode === 'login' ? '登录中...' : '注册中...') : (mode === 'login' ? '登录' : '注册') }}
        </button>
      </form>

      <!-- 试用提示 -->
      <div v-if="mode === 'register'" class="trial-info">
        <p>注册即可获得试用资格：</p>
        <ul>
          <li>1 个项目</li>
          <li>最多 10 集内容生成</li>
          <li>完整功能体验</li>
        </ul>
      </div>
      
      <div class="login-footer">
        <p>未登录用户可访问 <router-link to="/docs">项目说明</router-link></p>
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
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 40px;
  width: 100%;
  max-width: 420px;
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border-default);
}

.login-header {
  text-align: center;
  margin-bottom: 24px;
}

.login-header h1 {
  color: var(--text-primary);
  font-size: 24px;
  margin-bottom: 8px;
}

.login-header p {
  color: var(--text-tertiary);
  font-size: 14px;
}

.mode-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  background: var(--bg-elevated);
  padding: 4px;
  border-radius: 10px;
}

.tab-btn {
  flex: 1;
  padding: 10px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: var(--text-primary);
}

.tab-btn.active {
  background: var(--primary);
  color: white;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  color: var(--text-secondary);
  font-size: 14px;
}

.form-group input {
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 16px;
  transition: all 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: var(--primary);
  background: var(--bg-hover);
}

.form-group input::placeholder {
  color: var(--text-muted);
}

.form-group input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.field-error {
  color: var(--error);
  font-size: 12px;
  margin: 0;
}

.optional {
  color: var(--text-muted);
  font-weight: 400;
  font-size: 12px;
}

.error-message {
  color: var(--error);
  font-size: 14px;
  text-align: center;
  padding: 8px;
  background: var(--error-muted);
  border-radius: 6px;
}

.login-btn {
  padding: 14px;
  border-radius: 8px;
  border: none;
  background: var(--primary);
  color: var(--text-on-primary);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 8px;
}

.login-btn:hover:not(:disabled) {
  background: var(--primary-hover);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.trial-info {
  margin-top: 20px;
  padding: 16px;
  background: var(--bg-elevated);
  border-radius: 10px;
  border: 1px solid var(--border-default);
}

.trial-info p {
  color: var(--text-secondary);
  font-size: 13px;
  margin: 0 0 8px 0;
}

.trial-info ul {
  margin: 0;
  padding-left: 20px;
  color: var(--text-tertiary);
  font-size: 13px;
}

.trial-info li {
  margin: 4px 0;
}

.login-footer {
  margin-top: 24px;
  text-align: center;
}

.login-footer p {
  color: var(--text-tertiary);
  font-size: 13px;
}

.login-footer a {
  color: var(--primary-hover);
  text-decoration: none;
}

.login-footer a:hover {
  text-decoration: underline;
}
</style>
