<template>
  <div class="world-state-panel">
    <!-- 头部 -->
    <div class="panel-header">
      <h3 class="panel-title">
        <span class="icon">🌍</span>
        世界状态
        <span v-if="worldState" class="episode-badge">第{{ worldState.episodeNumber }}集</span>
      </h3>
      <button
        v-if="!initialized"
        class="btn-init"
        :disabled="loading"
        @click="handleInitialize"
      >
        {{ loading ? '初始化中...' : '初始化' }}
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- 未初始化状态 -->
    <div v-else-if="!initialized" class="empty-state">
      <div class="empty-icon">📭</div>
      <p>尚未初始化世界状态</p>
      <p class="hint">点击上方按钮初始化</p>
    </div>

    <!-- 主内容 -->
    <div v-else-if="worldState" class="panel-content">
      <!-- 统计概览 -->
      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-value">{{ characterStats.active }}</span>
          <span class="stat-label">角色</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ foreshadowingStats.planted }}</span>
          <span class="stat-label">伏笔</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ worldState.plotState.pendingConflicts.length }}</span>
          <span class="stat-label">冲突</span>
        </div>
      </div>

      <!-- 当前剧情弧 -->
      <div v-if="currentArcInfo?.name" class="arc-section">
        <div class="section-header">
          <span class="icon">📖</span>
          当前剧情弧
        </div>
        <div class="arc-card">
          <div class="arc-name">{{ currentArcInfo.name }}</div>
          <div class="arc-progress">
            <div
              class="progress-bar"
              :style="{ width: `${currentArcInfo.progress}%` }"
            ></div>
          </div>
          <div class="arc-percent">{{ currentArcInfo.progress }}%</div>
        </div>
      </div>

      <!-- 最新悬念 -->
      <div v-if="unresolvedCliffhangers.length > 0" class="cliffhanger-section">
        <div class="section-header">
          <span class="icon">🎯</span>
          最新悬念
        </div>
        <div class="cliffhanger-content">
          "{{ unresolvedCliffhangers[unresolvedCliffhangers.length - 1]?.content ?? '' }}"
        </div>
      </div>

      <!-- 待解决冲突 -->
      <div v-if="worldState.plotState.pendingConflicts.length > 0" class="conflicts-section">
        <div class="section-header">
          <span class="icon">⚡</span>
          待解决冲突
        </div>
        <ul class="conflict-list">
          <li
            v-for="(conflict, index) in worldState.plotState.pendingConflicts.slice(0, 3)"
            :key="index"
          >
            {{ conflict }}
          </li>
        </ul>
      </div>

      <!-- 近期事件 -->
      <div v-if="worldState.plotState.recentEvents.length > 0" class="events-section">
        <div class="section-header">
          <span class="icon">📅</span>
          近期事件
        </div>
        <div class="events-list">
          <div
            v-for="event in worldState.plotState.recentEvents.slice(-3).reverse()"
            :key="event.episode"
            class="event-item"
          >
            <span class="event-episode">第{{ event.episode }}集:</span>
            <span class="event-content">{{ event.event }}</span>
          </div>
        </div>
      </div>

      <!-- 超期伏笔警告 -->
      <div v-if="overdueForeshadowings.length > 0" class="warning-section">
        <div class="section-header warning">
          <span class="icon">⚠️</span>
          超期伏笔 ({{ overdueForeshadowings.length }})
        </div>
        <ul class="warning-list">
          <li v-for="f in overdueForeshadowings.slice(0, 2)" :key="f.id">
            {{ f.content }}
            <span class="age">(已{{ getForeshadowingAge(f) }}集)</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- 错误状态 -->
    <div v-if="error" class="error-state">
      <span class="error-icon">❌</span>
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useWorldStateStore } from '@/stores/worldStateStore';
import { storeToRefs } from 'pinia';

const props = defineProps<{
  projectId: string;
  currentEpisode?: number;
}>();

const emit = defineEmits<{
  (e: 'initialized'): void;
}>();

const worldStateStore = useWorldStateStore();
const {
  worldState,
  loading,
  error,
  initialized,
  characterStats,
  foreshadowingStats,
  overdueForeshadowings,
  unresolvedCliffhangers,
  currentArcInfo,
} = storeToRefs(worldStateStore);

const { fetchWorldState, initializeWorldState, getForeshadowingAge } = worldStateStore;

// 初始化
async function handleInitialize() {
  const success = await initializeWorldState(props.projectId);
  if (success) {
    emit('initialized');
  }
}

// 加载数据
onMounted(() => {
  if (props.projectId) {
    fetchWorldState(props.projectId, props.currentEpisode);
  }
});

// 监听项目变化
watch(() => props.projectId, (newId) => {
  if (newId) {
    fetchWorldState(newId, props.currentEpisode);
  }
});

// 监听集数变化
watch(() => props.currentEpisode, (newEpisode) => {
  if (props.projectId && newEpisode) {
    fetchWorldState(props.projectId, newEpisode);
  }
});
</script>

<style scoped>
.world-state-panel {
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-default);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 13px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.icon {
  font-size: 14px;
}

.episode-badge {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-secondary);
  background: var(--bg-hover);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
}

.btn-init {
  padding: var(--space-1) var(--space-3);
  font-size: 12px;
  background: var(--primary);
  color: var(--text-on-primary);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition-fast);
}

.btn-init:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn-init:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.panel-content {
  padding: var(--space-3);
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.stat-card {
  background: var(--bg-elevated);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  text-align: center;
  border: 1px solid var(--border-default);
}

.stat-value {
  display: block;
  font-size: 18px;
  font-weight: 700;
  color: var(--primary);
}

.stat-label {
  font-size: 10px;
  color: var(--text-secondary);
}

.section-header {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-header.warning {
  color: var(--warning);
}

.arc-section {
  margin-bottom: var(--space-3);
}

.arc-card {
  background: var(--bg-elevated);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
}

.arc-name {
  font-size: 12px;
  font-weight: 500;
  margin-bottom: var(--space-2);
  color: var(--text-primary);
}

.arc-progress {
  height: 4px;
  background: var(--bg-hover);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: var(--primary);
  border-radius: 2px;
  transition: var(--transition-normal);
}

.arc-percent {
  font-size: 10px;
  color: var(--text-secondary);
  text-align: right;
  margin-top: var(--space-1);
}

.cliffhanger-section {
  margin-bottom: var(--space-3);
}

.cliffhanger-content {
  background: var(--bg-elevated);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  font-size: 12px;
  font-style: italic;
  color: var(--text-primary);
}

.conflicts-section {
  margin-bottom: var(--space-3);
}

.conflict-list {
  background: var(--bg-elevated);
  padding: var(--space-2) var(--space-3) var(--space-2) var(--space-6);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  margin: 0;
}

.conflict-list li {
  font-size: 11px;
  margin-bottom: var(--space-1);
  color: var(--text-primary);
}

.events-section {
  margin-bottom: var(--space-3);
}

.events-list {
  background: var(--bg-elevated);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
}

.event-item {
  font-size: 11px;
  padding: var(--space-1) 0;
  border-bottom: 1px solid var(--border-default);
}

.event-item:last-child {
  border-bottom: none;
}

.event-episode {
  color: var(--text-secondary);
  margin-right: var(--space-1);
}

.event-content {
  color: var(--text-primary);
}

.warning-section {
  margin-bottom: var(--space-3);
}

.warning-list {
  background: var(--warning-muted);
  padding: var(--space-2) var(--space-3) var(--space-2) var(--space-6);
  border-radius: var(--radius-md);
  border: 1px solid var(--warning-border);
  margin: 0;
}

.warning-list li {
  font-size: 11px;
  margin-bottom: var(--space-1);
  color: var(--warning);
}

.age {
  color: var(--text-secondary);
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  color: var(--text-secondary);
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-default);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: var(--space-2);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon {
  font-size: 32px;
  margin-bottom: var(--space-2);
}

.hint {
  font-size: 11px;
  opacity: 0.7;
}

.error-state {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--error-muted);
  color: var(--error);
  font-size: 12px;
}
</style>
