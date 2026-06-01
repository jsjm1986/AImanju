<template>
  <div class="context-preview-panel">
    <!-- 头部 -->
    <div class="panel-header">
      <h3 class="panel-title">
        <span class="icon">📋</span>
        上下文预览
        <span v-if="episodeNumber" class="episode-badge">第{{ episodeNumber }}集</span>
      </h3>
      <div class="header-actions">
        <button
          class="btn-refresh"
          :disabled="loading"
          @click="handleRefresh"
        >
          {{ loading ? '加载中...' : '刷新预览' }}
        </button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>加载上下文...</span>
    </div>

    <!-- 未加载状态 -->
    <div v-else-if="!contextPreview" class="empty-state">
      <div class="empty-icon">📭</div>
      <p>点击"刷新预览"加载上下文</p>
    </div>

    <!-- 内容区 -->
    <div v-else class="panel-content">
      <!-- WorldState 状态 -->
      <div class="status-bar" :class="{ active: contextPreview.hasWorldState }">
        <span class="status-icon">{{ contextPreview.hasWorldState ? '✅' : '⚠️' }}</span>
        <span class="status-text">
          {{ contextPreview.hasWorldState
            ? `WorldState 已加载 (第${contextPreview.worldStateEpisode}集快照)`
            : 'WorldState 未初始化'
          }}
        </span>
        <span class="status-stats">
          {{ contextPreview.characterCount }}角色 | {{ contextPreview.plantedForeshadowings }}伏笔
        </span>
      </div>

      <!-- 本集梗概 -->
      <div class="section episode-plan-section">
        <div class="section-header">
          <span class="icon">📖</span>
          本集梗概
        </div>
        <div class="plan-content">
          {{ contextPreview.episodePlan || '暂无梗概' }}
        </div>
      </div>

      <!-- 硬约束 -->
      <div v-if="hardConstraints.length > 0" class="section constraints-section">
        <div class="section-header">
          <span class="icon">🔒</span>
          硬约束 (必须满足)
        </div>
        <ul class="constraint-list hard">
          <li v-for="(constraint, index) in hardConstraints" :key="index">
            {{ constraint }}
          </li>
        </ul>
      </div>

      <!-- 节奏约束 -->
      <div v-if="rhythmConstraints.length > 0" class="section rhythm-section">
        <div class="section-header">
          <span class="icon">🎯</span>
          节奏约束
        </div>
        <ul class="constraint-list rhythm">
          <li v-for="(constraint, index) in rhythmConstraints" :key="index">
            {{ constraint }}
          </li>
        </ul>
      </div>

      <!-- 建议元素 -->
      <div v-if="suggestions.length > 0" class="section suggestions-section">
        <div class="section-header">
          <span class="icon">💡</span>
          建议元素
        </div>
        <ul class="suggestion-list">
          <li v-for="(suggestion, index) in suggestions" :key="index">
            {{ suggestion }}
          </li>
        </ul>
      </div>

      <!-- 完整上下文预览 (可折叠) -->
      <div class="section full-context-section">
        <div
          class="section-header clickable"
          @click="showFullContext = !showFullContext"
        >
          <span class="icon">📄</span>
          完整上下文
          <span class="expand-icon">{{ showFullContext ? '▼' : '▶' }}</span>
        </div>
        <div v-if="showFullContext" class="full-context">
          <pre>{{ contextPreview.context?.formattedContext || '无上下文' }}</pre>
        </div>
      </div>
    </div>

    <!-- 底部操作 -->
    <div class="panel-footer">
      <button
        class="btn-generate"
        :disabled="loading || isGenerating || !contextPreview"
        @click="handleGenerate"
      >
        <span class="btn-icon">🚀</span>
        开始生成
      </button>
    </div>

    <!-- 错误信息 -->
    <div v-if="error" class="error-state">
      <span class="error-icon">❌</span>
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useGenerationStore } from '@/stores/generationStore';
import { storeToRefs } from 'pinia';

const props = defineProps<{
  projectId: string;
  episodeNumber: number;
}>();

const emit = defineEmits<{
  (e: 'generate'): void;
}>();

const generationStore = useGenerationStore();
const {
  contextPreview,
  isGenerating,
  error,
} = storeToRefs(generationStore);

const { previewContext, startGeneration } = generationStore;

const loading = ref(false);
const showFullContext = ref(false);

// 硬约束
const hardConstraints = computed(() => {
  return contextPreview.value?.context?.constraints || [];
});

// 节奏约束
const rhythmConstraints = computed(() => {
  return contextPreview.value?.context?.rhythmConstraints || [];
});

// 建议
const suggestions = computed(() => {
  return contextPreview.value?.context?.suggestions || [];
});

// 刷新预览
async function handleRefresh() {
  loading.value = true;
  await previewContext(props.projectId, props.episodeNumber);
  loading.value = false;
}

// 开始生成
async function handleGenerate() {
  emit('generate');
  await startGeneration(props.projectId, props.episodeNumber);
}
</script>

<style scoped>
.context-preview-panel {
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  overflow: hidden;
  display: flex;
  flex-direction: column;
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

.btn-refresh {
  padding: var(--space-1) var(--space-3);
  font-size: 12px;
  background: var(--bg-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition-fast);
}

.btn-refresh:hover:not(:disabled) {
  background: var(--bg-hover);
}

.btn-refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-size: 12px;
  background: var(--warning-muted);
  border-bottom: 1px solid var(--warning-border);
}

.status-bar.active {
  background: var(--success-muted);
  border-color: var(--success-border);
}

.status-icon {
  font-size: 14px;
}

.status-text {
  flex: 1;
  color: var(--text-primary);
}

.status-stats {
  color: var(--text-secondary);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  max-height: 500px;
}

.section {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-default);
}

.section-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-header.clickable {
  cursor: pointer;
  user-select: none;
}

.section-header.clickable:hover {
  color: var(--primary);
}

.expand-icon {
  margin-left: auto;
  font-size: 10px;
}

.plan-content {
  background: var(--bg-elevated);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-primary);
}

.constraint-list {
  background: var(--bg-elevated);
  padding: var(--space-2) var(--space-3) var(--space-2) var(--space-6);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  margin: 0;
}

.constraint-list.hard {
  background: var(--error-muted);
  border-color: var(--error-border);
}

.constraint-list.hard li {
  color: var(--error);
}

.constraint-list.rhythm {
  background: var(--primary-muted);
  border-color: var(--primary-border);
}

.constraint-list.rhythm li {
  color: var(--primary);
}

.constraint-list li {
  font-size: 12px;
  padding: var(--space-1) 0;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-default);
}

.constraint-list li:last-child {
  border-bottom: none;
}

.suggestion-list {
  background: var(--success-muted);
  padding: var(--space-2) var(--space-3) var(--space-2) var(--space-6);
  border-radius: var(--radius-md);
  border: 1px solid var(--success-border);
  margin: 0;
}

.suggestion-list li {
  font-size: 12px;
  padding: var(--space-1) 0;
  color: var(--success);
  border-bottom: 1px solid var(--border-default);
}

.suggestion-list li:last-child {
  border-bottom: none;
}

.full-context {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.full-context pre {
  margin: 0;
  padding: var(--space-3);
  font-size: 11px;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 300px;
  overflow-y: auto;
  color: var(--text-secondary);
}

.panel-footer {
  padding: var(--space-3) var(--space-4);
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-default);
}

.btn-generate {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-size: 13px;
  font-weight: 500;
  background: var(--primary);
  color: var(--text-on-primary);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition-fast);
}

.btn-generate:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn-generate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  font-size: 14px;
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

.error-state {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--error-muted);
  color: var(--error);
  font-size: 12px;
}
</style>
