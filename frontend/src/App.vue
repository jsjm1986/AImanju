<script setup lang="ts">
// 动态漫剧本生成系统 V2
import GenerationFloatingWidget from '@/components/common/GenerationFloatingWidget.vue';
</script>

<template>
  <div class="app">
    <router-view />
    <!-- 全局生成状态浮动窗口 -->
    <GenerationFloatingWidget />
  </div>
</template>

<style>
.app {
  min-height: 100vh;
  background: var(--bg-base);
}
</style>
