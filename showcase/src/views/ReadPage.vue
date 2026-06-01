<template>
  <div class="read-page">
    <!-- 顶部导航 -->
    <header class="read-header">
      <div class="read-header-inner container">
        <button @click="goBack" class="back-btn">
          ← 返回
        </button>
        <h1 class="episode-title">第 {{ episodeNumber }} 集</h1>
        <div class="nav-btns">
          <button 
            @click="prevEpisode" 
            :disabled="!hasPrev"
            class="nav-btn"
          >
            ← 上一集
          </button>
          <button 
            @click="nextEpisode" 
            :disabled="!hasNext"
            class="nav-btn"
          >
            下一集 →
          </button>
        </div>
      </div>
    </header>

    <!-- 内容区 -->
    <main class="read-content">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <span>加载中...</span>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="error-state">
        <div class="error-icon">⚠️</div>
        <p>{{ error }}</p>
        <button @click="loadEpisode" class="btn btn-primary">重试</button>
      </div>

      <!-- 剧本内容 -->
      <div v-else class="content-wrapper container">
        <div class="content-card">
          <ScriptRenderer :content="episodeContent" />
        </div>
      </div>
    </main>

    <!-- 底部导航 -->
    <footer class="read-footer container">
      <button 
        @click="prevEpisode" 
        :disabled="!hasPrev"
        class="footer-btn prev"
      >
        ← 上一集
      </button>
      <router-link :to="`/projects/${projectId}`" class="footer-btn home">
        📚 目录
      </router-link>
      <button 
        @click="nextEpisode" 
        :disabled="!hasNext"
        class="footer-btn next"
      >
        下一集 →
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { buyerApi } from '@/services/api';
import ScriptRenderer from '@/components/ScriptRenderer.vue';

const route = useRoute();
const router = useRouter();

const projectId = computed(() => route.params.id as string);
const episodeNumber = computed(() => parseInt(route.params.episode as string, 10));

const loading = ref(true);
const error = ref('');
const episodeContent = ref('');
const totalEpisodes = ref(0);

const hasPrev = computed(() => episodeNumber.value > 1);
const hasNext = computed(() => totalEpisodes.value > 0 && episodeNumber.value < totalEpisodes.value);

onMounted(() => {
  loadEpisode();
});

watch(episodeNumber, () => {
  loadEpisode();
});

async function loadEpisode() {
  loading.value = true;
  error.value = '';
  
  try {
    const response = await buyerApi.getEpisodeContent(projectId.value, episodeNumber.value) as any;
    episodeContent.value = response.content || '';
    totalEpisodes.value = response.totalEpisodes || 0;
  } catch (err: any) {
    error.value = err.error || '加载失败';
  } finally {
    loading.value = false;
    // 滚动到顶部
    window.scrollTo(0, 0);
  }
}

function goBack() {
  router.push(`/projects/${projectId.value}`);
}

function prevEpisode() {
  if (hasPrev.value) {
    router.push(`/projects/${projectId.value}/read/${episodeNumber.value - 1}`);
  }
}

function nextEpisode() {
  if (hasNext.value) {
    router.push(`/projects/${projectId.value}/read/${episodeNumber.value + 1}`);
  }
}
</script>

<style scoped>
.read-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-page);
}

/* 顶部导航 */
.read-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--glass);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--glass-border);
}

.read-header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
}

.back-btn {
  padding: var(--space-2) var(--space-4);
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.back-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.episode-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
}

.nav-btns {
  display: none;
  gap: var(--space-2);
}

@media (min-width: 768px) {
  .nav-btns {
    display: flex;
  }
}

.nav-btn {
  padding: var(--space-2) var(--space-4);
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.nav-btn:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}

.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 内容区 */
.read-content {
  flex: 1;
  padding: var(--space-6) 0;
}

.content-wrapper {
  max-width: 800px;
}

.content-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

/* 加载/错误状态 */
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16);
  color: var(--text-muted);
  gap: var(--space-4);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-icon {
  font-size: 48px;
}

/* 底部导航 */
.read-footer {
  display: flex;
  justify-content: space-between;
  padding: var(--space-4) 0;
  border-top: 1px solid var(--border-color);
  background: var(--bg-card);
}

.footer-btn {
  padding: var(--space-3) var(--space-5);
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast);
  text-decoration: none;
}

.footer-btn:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}

.footer-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.footer-btn.home {
  background: var(--gradient-primary);
  border-color: transparent;
  color: white;
}

.footer-btn.home:hover {
  color: white;
  transform: scale(1.02);
}
</style>
