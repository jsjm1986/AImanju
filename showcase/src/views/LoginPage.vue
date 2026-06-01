<template>
  <div class="auth-page">
    <div class="auth-container">
      <!-- 左侧装饰 -->
      <div class="auth-decoration">
        <div class="decoration-content">
          <h2>欢迎回来</h2>
          <p>登录账号，继续探索精彩剧本</p>
          <div class="decoration-features">
            <div class="feature">✨ 海量精品剧本</div>
            <div class="feature">免费试读体验</div>
            <div class="feature">积分灵活购买</div>
          </div>
        </div>
      </div>
      
      <!-- 右侧表单 -->
      <div class="auth-form-section">
        <div class="auth-card">
          <h1 class="auth-title">登录</h1>
          <p class="auth-subtitle">输入账号信息以继续</p>
          
          <form @submit.prevent="handleLogin" class="auth-form">
            <div class="form-group">
              <label class="form-label">用户名 / 邮箱</label>
              <input 
                v-model="form.username" 
                type="text" 
                class="input"
                placeholder="请输入用户名或邮箱"
                required
              />
            </div>
            
            <div class="form-group">
              <label class="form-label">密码</label>
              <input 
                v-model="form.password" 
                type="password" 
                class="input"
                placeholder="请输入密码"
                required
              />
            </div>
            
            <div v-if="error" class="error-message">
              ⚠️ {{ error }}
            </div>
            
            <button type="submit" :disabled="loading" class="btn btn-primary btn-lg submit-btn">
              {{ loading ? '登录中...' : '登录' }}
            </button>
          </form>
          
          <div class="auth-footer">
            还没有账号？
            <router-link to="/register" class="auth-link">立即注册</router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const form = reactive({
  username: '',
  password: '',
});
const loading = ref(false);
const error = ref('');

async function handleLogin() {
  error.value = '';
  loading.value = true;
  
  try {
    await authStore.login(form.username, form.password);
    const redirect = route.query.redirect as string || '/';
    router.push(redirect);
  } catch (err: any) {
    error.value = err.error || '登录失败，请重试';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.auth-page {
  min-height: calc(100vh - 64px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.auth-container {
  display: flex;
  width: 100%;
  max-width: 960px;
  min-height: 560px;
  background: var(--bg-card);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-color);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}

/* 左侧装饰区 */
.auth-decoration {
  display: none;
  flex: 1;
  background: var(--gradient-hero);
  padding: var(--space-10);
  position: relative;
  overflow: hidden;
}

@media (min-width: 768px) {
  .auth-decoration {
    display: flex;
    align-items: center;
  }
}

.auth-decoration::before {
  content: '';
  position: absolute;
  inset: 0;
  background: 
    radial-gradient(circle at 30% 70%, rgba(99, 102, 241, 0.4) 0%, transparent 50%),
    radial-gradient(circle at 70% 30%, rgba(236, 72, 153, 0.4) 0%, transparent 50%);
}

.decoration-content {
  position: relative;
  z-index: 1;
}

.decoration-content h2 {
  font-size: var(--text-3xl);
  font-weight: 700;
  color: white;
  margin-bottom: var(--space-3);
}

.decoration-content p {
  font-size: var(--text-lg);
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: var(--space-8);
}

.decoration-features {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.feature {
  padding: var(--space-3) var(--space-4);
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: var(--radius-md);
  color: white;
  font-size: var(--text-sm);
}

/* 右侧表单区 */
.auth-form-section {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
}

.auth-card {
  width: 100%;
  max-width: 360px;
}

.auth-title {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.auth-subtitle {
  color: var(--text-muted);
  margin-bottom: var(--space-8);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
}

.error-message {
  padding: var(--space-3) var(--space-4);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-md);
  color: var(--error);
  font-size: var(--text-sm);
}

.submit-btn {
  width: 100%;
  margin-top: var(--space-2);
}

.auth-footer {
  text-align: center;
  margin-top: var(--space-6);
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.auth-link {
  color: var(--primary);
  font-weight: 500;
  margin-left: var(--space-1);
}

.auth-link:hover {
  text-decoration: underline;
}
</style>
