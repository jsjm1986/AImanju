<template>
  <div class="attention-heads-panel">
    <!-- 头部 -->
    <div class="panel-header">
      <h3 class="panel-title">
        <span class="icon">🧠</span>
        注意力系统
        <span v-if="currentGenre !== 'custom'" class="genre-badge">
          {{ GenreTypeLabels[currentGenre] }}
        </span>
      </h3>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- 注意力头列表 -->
    <div v-else class="heads-container">
      <div
        v-for="[category, heads] in headsByCategory"
        :key="category"
        class="category-section"
      >
        <div class="category-header" :style="{ color: getCategoryColor(category) }">
          {{ AttentionHeadCategoryLabels[category] }}
          <span v-if="category === 'base'" class="required-badge">必选</span>
        </div>
        <div class="heads-list">
          <div
            v-for="head in heads"
            :key="head.type"
            class="head-item"
          >
            <div class="head-info">
              <span class="head-name">{{ head.name || head.type }}</span>
            </div>
            <div class="head-weight">
              <div class="weight-bar-container">
                <div
                  class="weight-bar"
                  :style="{
                    width: `${head.weight * 100}%`,
                    backgroundColor: getCategoryColor(category)
                  }"
                ></div>
              </div>
              <span class="weight-value">{{ head.weight.toFixed(2) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="enabledHeads.length === 0" class="empty-state">
        <p>暂无注意力头配置</p>
        <p class="hint">请选择题材类型</p>
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
import { useAttentionStore } from '@/stores/attentionStore';
import { storeToRefs } from 'pinia';
import {
  GenreTypeLabels,
  AttentionHeadCategoryLabels,
  AttentionHeadCategoryColors,
  type AttentionHeadCategory,
  type GenreType,
} from '@/types';

const props = defineProps<{
  genre?: GenreType;
}>();

const attentionStore = useAttentionStore();
const {
  enabledHeads,
  currentGenre,
  headsByCategory,
  loading,
  error,
} = storeToRefs(attentionStore);

const { fetchAttentionHeads } = attentionStore;

// 获取类别颜色
function getCategoryColor(category: AttentionHeadCategory): string {
  return AttentionHeadCategoryColors[category] || 'var(--text-tertiary)';
}

// 加载数据
onMounted(() => {
  fetchAttentionHeads(props.genre);
});

// 监听题材变化
watch(() => props.genre, (newGenre) => {
  fetchAttentionHeads(newGenre);
});
</script>

<style scoped>
.attention-heads-panel {
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  overflow: hidden;
}

.panel-header {
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

.genre-badge {
  font-size: 10px;
  font-weight: 400;
  color: var(--text-secondary);
  background: var(--bg-hover);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
}

.heads-container {
  padding: var(--space-3);
}

.category-section {
  margin-bottom: var(--space-4);
}

.category-section:last-child {
  margin-bottom: 0;
}

.category-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 11px;
  font-weight: 600;
  margin-bottom: var(--space-2);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.required-badge {
  font-size: 9px;
  font-weight: 400;
  background: var(--bg-hover);
  color: var(--text-secondary);
  padding: 1px var(--space-1);
  border-radius: var(--radius-sm);
}

.heads-list {
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  overflow: hidden;
}

.head-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border-default);
}

.head-item:last-child {
  border-bottom: none;
}

.head-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.head-name {
  font-size: 11px;
  color: var(--text-primary);
}

.head-weight {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100px;
}

.weight-bar-container {
  flex: 1;
  height: 4px;
  background: var(--bg-hover);
  border-radius: 2px;
  overflow: hidden;
}

.weight-bar {
  height: 100%;
  border-radius: 2px;
  transition: var(--transition-normal);
}

.weight-value {
  font-size: 10px;
  color: var(--text-secondary);
  min-width: 28px;
  text-align: right;
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
