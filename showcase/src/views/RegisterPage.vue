<template>
  <div class="auth-page">
    <div class="auth-container">
      <!-- 左侧装饰 -->
      <div class="auth-decoration">
        <div class="decoration-content">
          <h2>加入我们</h2>
          <p>创建账号，开启精彩阅读之旅</p>
          <div class="decoration-features">
            <div class="feature">🎁 新用户赠送积分</div>
            <div class="feature">🏆 认证送积分奖励</div>
            <div class="feature">📖 前5集免费试读</div>
            <div class="feature">✅ 优质内容保障</div>
          </div>
        </div>
      </div>
      
      <!-- 右侧表单 -->
      <div class="auth-form-section">
        <div class="auth-card">
          <h1 class="auth-title">注册账号</h1>
          <p class="auth-subtitle">填写信息创建您的账号</p>
          
          <form @submit.prevent="handleRegister" class="auth-form">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">用户名</label>
                <input 
                  v-model="form.username" 
                  type="text" 
                  class="input"
                  placeholder="3-20个字符"
                  required
                  minlength="3"
                  maxlength="20"
                />
              </div>
              <div class="form-group">
                <label class="form-label">昵称</label>
                <input 
                  v-model="form.nickname" 
                  type="text" 
                  class="input"
                  placeholder="可选"
                />
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">邮箱</label>
              <input 
                v-model="form.email" 
                type="email" 
                class="input"
                placeholder="请输入邮箱"
                required
              />
            </div>
            
            <div class="form-group">
              <label class="form-label">密码</label>
              <input 
                v-model="form.password" 
                type="password" 
                class="input"
                placeholder="至少6个字符"
                required
                minlength="6"
              />
            </div>
            
            <div class="form-group">
              <label class="form-label">确认密码</label>
              <input 
                v-model="form.confirmPassword" 
                type="password" 
                class="input"
                placeholder="再次输入密码"
                required
              />
            </div>
            
            <div v-if="error" class="error-message">
              ⚠️ {{ error }}
            </div>
            
            <button type="submit" :disabled="loading" class="btn btn-primary btn-lg submit-btn">
              {{ loading ? '注册中...' : '注册' }}
            </button>
          </form>
          
          <div class="auth-footer">
            已有账号？
            <router-link to="/login" class="auth-link">立即登录</router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

const router = useRouter();
const authStore = useAuthStore();

const form = reactive({
  username: '',
  email: '',
  nickname: '',
  password: '',
  confirmPassword: '',
});
const loading = ref(false);
const error = ref('');

async function handleRegister() {
  error.value = '';
  
  if (form.password !== form.confirmPassword) {
    error.value = '两次输入的密码不一致';
    return;
  }
  
  loading.value = true;
  
  try {
    await authStore.register({
      username: form.username,
      email: form.email,
      password: form.password,
      nickname: form.nickname || undefined,
    });
    router.push('/');
  } catch (err: any) {
    error.value = err.error || '注册失败，请重试';
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
  min-height: 640px;
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
  max-width: 400px;
}

.auth-title {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.auth-subtitle {
  color: var(--text-muted);
  margin-bottom: var(--space-6);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

@media (max-width: 480px) {
  .form-row {
    grid-template-columns: 1fr;
  }
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
