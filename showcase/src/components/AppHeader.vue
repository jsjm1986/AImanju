<template>
  <header class="header">
    <div class="header-inner container">
      <!-- Logo -->
      <router-link to="/" class="logo">
        <span class="logo-text">锦墨工作室</span>
      </router-link>

      <!-- 桌面端导航 -->
      <nav class="nav-desktop">
        <router-link to="/" class="nav-link">首页</router-link>
        <router-link to="/join" class="nav-link join-link">✨ 加入我们</router-link>
        
        <template v-if="authStore.isAuthenticated">
          <!-- 管理员入口 -->
          <router-link v-if="authStore.isAdmin" to="/admin" class="nav-link admin-link">
            管理后台
          </router-link>
          
          <div class="user-menu">
            <span class="points">
              <span class="points-icon">💰</span>
              <span class="points-value">{{ authStore.user?.points }}</span>
            </span>
            <router-link to="/profile" class="nav-link">
              {{ authStore.user?.nickname || authStore.user?.username }}
            </router-link>
            <button @click="handleLogout" class="btn-logout">退出</button>
          </div>
        </template>
        
        <template v-else>
          <router-link to="/login" class="nav-link">登录</router-link>
          <router-link to="/register" class="btn btn-primary">注册</router-link>
        </template>

        <!-- 皮肤选择器 -->
        <div class="skin-selector">
          <button 
            class="skin-trigger" 
            @click="skinMenuOpen = !skinMenuOpen"
            :style="{ '--skin-color': themeStore.currentSkin?.primaryColor }"
          >
            <span class="skin-dot"></span>
          </button>
          <div v-show="skinMenuOpen" class="skin-dropdown">
            <button 
              v-for="skin in themeStore.SKIN_PRESETS" 
              :key="skin.id"
              class="skin-option"
              :class="{ active: themeStore.skin === skin.id }"
              @click="selectSkin(skin.id)"
            >
              <span class="skin-preview" :style="{ background: skin.primaryColor }"></span>
              <span>{{ skin.name }}</span>
            </button>
          </div>
        </div>

        <!-- 主题切换 -->
        <button @click="themeStore.toggleMode" class="theme-toggle" :title="themeStore.isDark ? '切换亮色' : '切换暗色'">
          {{ themeStore.isDark ? '☀️' : '🌙' }}
        </button>
      </nav>

      <!-- 移动端菜单按钮已移除 - 使用底部导航栏 BottomNav 代替 -->
    </div>

    <!-- 移动端菜单 -->
    <div class="mobile-menu" :class="{ open: mobileMenuOpen }">
      <nav class="mobile-nav">
        <router-link to="/" class="mobile-link" @click="mobileMenuOpen = false">🏠 首页</router-link>
        
        <template v-if="authStore.isAuthenticated">
          <router-link v-if="authStore.isAdmin" to="/admin" class="mobile-link" @click="mobileMenuOpen = false">
            ⚙️ 管理后台
          </router-link>
          <router-link to="/profile" class="mobile-link" @click="mobileMenuOpen = false">
            👤 个人中心
          </router-link>
          <div class="mobile-points">
            💰 {{ authStore.user?.points }} 积分
          </div>
          <button @click="handleLogout" class="mobile-logout">退出登录</button>
        </template>
        
        <template v-else>
          <router-link to="/login" class="mobile-link" @click="mobileMenuOpen = false">🔑 登录</router-link>
          <router-link to="/register" class="mobile-link" @click="mobileMenuOpen = false">✨ 注册</router-link>
        </template>

        <!-- 移动端皮肤选择 -->
        <div class="mobile-skin-section">
          <span class="mobile-section-title">🎨 主题皮肤</span>
          <div class="mobile-skin-grid">
            <button
              v-for="skin in themeStore.SKIN_PRESETS"
              :key="skin.id"
              class="mobile-skin-btn"
              :class="{ active: themeStore.skin === skin.id }"
              :style="{ '--skin-bg': skin.primaryColor }"
              @click="selectSkin(skin.id)"
            >
              {{ skin.name }}
            </button>
          </div>
        </div>

        <button @click="themeStore.toggleMode" class="mobile-theme-toggle">
          {{ themeStore.isDark ? '☀️ 切换亮色模式' : '🌙 切换暗色模式' }}
        </button>
      </nav>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore, type SkinType } from '@/stores/themeStore';

const router = useRouter();
const authStore = useAuthStore();
const themeStore = useThemeStore();

const mobileMenuOpen = ref(false);
const skinMenuOpen = ref(false);

function handleLogout() {
  authStore.logout();
  mobileMenuOpen.value = false;
  router.push('/');
}

function selectSkin(skinId: SkinType) {
  themeStore.setSkin(skinId);
  skinMenuOpen.value = false;
}

// 点击外部关闭皮肤菜单
function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest('.skin-selector')) {
    skinMenuOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--glass-border);
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
}

/* Logo */
.logo {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--text-primary);
}

.logo-icon {
  font-size: 24px;
}

.logo-text {
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* 桌面导航 */
.nav-desktop {
  display: none;
  align-items: center;
  gap: var(--space-6);
}

@media (min-width: 768px) {
  .nav-desktop {
    display: flex;
  }
}

.nav-link {
  color: var(--text-secondary);
  font-weight: 500;
  transition: color var(--duration-fast);
}

.nav-link:hover {
  color: var(--primary);
}

.admin-link {
  color: var(--secondary);
}

.join-link {
  background: linear-gradient(135deg, var(--primary), #ec4899);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 600;
}

.join-link:hover {
  opacity: 0.8;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.points {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  background: var(--primary-light);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--primary);
}

.btn-logout {
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  transition: all var(--duration-fast);
}

.btn-logout:hover {
  border-color: var(--error);
  color: var(--error);
}

/* 主题切换 */
.theme-toggle {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 18px;
  transition: all var(--duration-fast);
}

.theme-toggle:hover {
  background: var(--bg-hover);
  border-color: var(--primary);
}

/* 移动端菜单按钮 */
.mobile-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: transparent;
  border: none;
}

@media (min-width: 768px) {
  .mobile-menu-btn {
    display: none;
  }
}

.hamburger {
  position: relative;
  width: 24px;
  height: 2px;
  background: var(--text-primary);
  transition: all var(--duration-fast);
}

.hamburger::before,
.hamburger::after {
  content: '';
  position: absolute;
  left: 0;
  width: 24px;
  height: 2px;
  background: var(--text-primary);
  transition: all var(--duration-fast);
}

.hamburger::before {
  top: -7px;
}

.hamburger::after {
  top: 7px;
}

.hamburger.open {
  background: transparent;
}

.hamburger.open::before {
  top: 0;
  transform: rotate(45deg);
}

.hamburger.open::after {
  top: 0;
  transform: rotate(-45deg);
}

/* 移动端菜单 */
.mobile-menu {
  display: none;
  position: fixed;
  top: var(--header-height-mobile);
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--bg-page);
  padding: var(--space-4);
  padding-bottom: calc(var(--safe-area-bottom) + var(--space-4));
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  transform: translateX(100%);
  transition: transform var(--duration-normal) var(--ease-out);
  z-index: 9999;
}

.mobile-menu.open {
  transform: translateX(0);
  display: block !important;
}

@media (max-width: 767px) {
  .mobile-menu {
    display: block;
  }
}

.mobile-nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.mobile-link {
  display: block;
  padding: var(--space-4);
  background: var(--bg-card);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-weight: 500;
  transition: all var(--duration-fast);
}

.mobile-link:hover {
  background: var(--bg-hover);
}

.mobile-points {
  padding: var(--space-4);
  background: var(--primary-light);
  border-radius: var(--radius-md);
  color: var(--primary);
  font-weight: 600;
  text-align: center;
}

.mobile-logout,
.mobile-theme-toggle {
  width: 100%;
  padding: var(--space-4);
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-base);
  font-weight: 500;
  text-align: center;
}

.mobile-logout {
  color: var(--error);
  border-color: var(--error);
}

/* ========================================
   皮肤选择器 - PC端
   ======================================== */
.skin-selector {
  position: relative;
}

.skin-trigger {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.skin-trigger:hover {
  border-color: var(--primary);
}

.skin-dot {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-full);
  background: var(--skin-color, var(--primary));
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.skin-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 140px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--space-2);
  box-shadow: var(--shadow-lg);
  z-index: 200;
  animation: fadeInDown var(--duration-fast) var(--ease-out);
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.skin-option {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.skin-option:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.skin-option.active {
  background: var(--primary-light);
  color: var(--primary);
}

.skin-preview {
  width: 16px;
  height: 16px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

/* ========================================
   皮肤选择器 - 移动端
   ======================================== */
.mobile-skin-section {
  padding: var(--space-4);
  background: var(--bg-card);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-2);
}

.mobile-section-title {
  display: block;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-3);
}

.mobile-skin-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--space-2);
}

.mobile-skin-btn {
  padding: var(--space-2);
  background: var(--bg-elevated);
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: 500;
  text-align: center;
  cursor: pointer;
  transition: all var(--duration-fast);
  position: relative;
}

.mobile-skin-btn::before {
  content: '';
  display: block;
  width: 24px;
  height: 24px;
  margin: 0 auto var(--space-1);
  border-radius: var(--radius-full);
  background: var(--skin-bg);
}

.mobile-skin-btn.active {
  border-color: var(--skin-bg);
  background: var(--bg-hover);
}
</style>

<!-- 非 scoped 样式确保移动端菜单在最顶层 -->
<style>
.mobile-menu {
  z-index: 99999 !important;
  position: fixed !important;
  top: 56px !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  background: var(--bg-page, #0f0d1a) !important;
}

.mobile-menu.open {
  display: block !important;
  transform: translateX(0) !important;
  visibility: visible !important;
  opacity: 1 !important;
}
</style>
