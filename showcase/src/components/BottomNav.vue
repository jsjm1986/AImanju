<template>
  <nav class="bottom-nav" v-if="themeStore.isMobile">
    <router-link 
      v-for="item in navItems" 
      :key="item.path"
      :to="item.path"
      class="nav-item"
      :class="{ active: isActive(item.path) }"
    >
      <span class="nav-icon">{{ item.icon }}</span>
      <span class="nav-label">{{ item.label }}</span>
    </router-link>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';

const route = useRoute();
const themeStore = useThemeStore();
const authStore = useAuthStore();

const navItems = computed(() => {
  const items = [
    { path: '/', icon: '🏠', label: '首页' },
    { path: '/join', icon: '✨', label: '加入' },
  ];
  
  if (authStore.isAuthenticated) {
    items.push({ path: '/profile', icon: '👤', label: '我的' });
  } else {
    items.push({ path: '/login', icon: '🔑', label: '登录' });
  }
  
  return items;
});

function isActive(path: string) {
  if (path === '/') {
    return route.path === '/';
  }
  return route.path.startsWith(path);
}
</script>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: calc(var(--bottom-nav-height) + var(--safe-area-bottom));
  padding-bottom: var(--safe-area-bottom);
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid var(--glass-border);
  display: flex;
  align-items: stretch;
  z-index: var(--z-fixed);
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  color: var(--text-muted);
  text-decoration: none;
  transition: all var(--duration-fast);
  position: relative;
}

.nav-item.active {
  color: var(--primary);
}

.nav-item.active::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 32px;
  height: 3px;
  background: var(--gradient-primary);
  border-radius: 0 0 var(--radius-full) var(--radius-full);
}

.nav-icon {
  font-size: 22px;
  line-height: 1;
}

.nav-label {
  font-size: var(--text-xs);
  font-weight: 500;
}

/* 隐藏在 PC 端 */
@media (min-width: 769px) {
  .bottom-nav {
    display: none;
  }
}
</style>
