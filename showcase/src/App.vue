<script setup lang="ts">
import AppHeader from './components/AppHeader.vue';
import BottomNav from './components/BottomNav.vue';
import { useThemeStore } from './stores/themeStore';

const themeStore = useThemeStore();
</script>

<template>
  <div class="app" :class="{ 'has-bottom-nav': themeStore.isMobile }">
    <AppHeader />
    <main class="main-content">
      <router-view />
    </main>
    <BottomNav />
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
}

.main-content {
  flex: 1;
}

/* 移动端底部导航留白 */
.has-bottom-nav .main-content {
  padding-bottom: calc(var(--bottom-nav-height) + var(--safe-area-bottom));
}
</style>
