<script setup lang="ts">
/**
 * 集数导航组件
 * 功能:
 * 1. 分组选择器 (每10集一组)
 * 2. 快速跳转输入框
 * 3. 集数列表
 * 4. 完成进度条
 */
import { ref, computed, watch } from 'vue';
import type { EpisodeStatus } from '@/types';

interface EpisodeNavItem {
  number: number;
  status: EpisodeStatus;
  hasContent: boolean;
}

interface Props {
  episodes: EpisodeNavItem[];
  currentEpisode: number;
  totalEpisodes: number;
  isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
});

const emit = defineEmits<{
  (e: 'select', number: number): void;
  (e: 'batch-generate'): void;
}>();

// 快速跳转输入值
const jumpValue = ref('');

// 当前选中的分组 (每10集一组)
const currentGroup = ref(0);

// 根据当前集数自动设置分组
watch(() => props.currentEpisode, (ep) => {
  currentGroup.value = Math.floor((ep - 1) / 10);
}, { immediate: true });

// 计算分组数量
const groupCount = computed(() => Math.ceil(props.totalEpisodes / 10));

// 计算分组标签
const groupLabels = computed(() => {
  const labels: { start: number; end: number; label: string }[] = [];
  for (let i = 0; i < groupCount.value; i++) {
    const start = i * 10 + 1;
    const end = Math.min((i + 1) * 10, props.totalEpisodes);
    labels.push({
      start,
      end,
      label: `${start}-${end}`,
    });
  }
  return labels;
});

// 当前分组内的集数
const currentGroupEpisodes = computed(() => {
  const start = currentGroup.value * 10 + 1;
  const end = Math.min((currentGroup.value + 1) * 10, props.totalEpisodes);
  return props.episodes.filter(ep => ep.number >= start && ep.number <= end);
});

// 已完成集数
const completedCount = computed(() => {
  return props.episodes.filter(ep => ep.status === 'completed').length;
});

// 完成进度百分比
const progressPercent = computed(() => {
  return Math.round((completedCount.value / props.totalEpisodes) * 100);
});

// 切换分组
const selectGroup = (index: number) => {
  currentGroup.value = index;
};

// 选择集数
const selectEpisode = (num: number) => {
  emit('select', num);
};

// 快速跳转
const handleJump = () => {
  const num = parseInt(jumpValue.value);
  if (num >= 1 && num <= props.totalEpisodes) {
    emit('select', num);
    jumpValue.value = '';
  }
};

// 获取状态样式类
const getStatusClass = (status: EpisodeStatus) => {
  return {
    pending: 'status-pending',
    generating: 'status-generating',
    completed: 'status-completed',
    failed: 'status-failed',
  }[status] || 'status-pending';
};
</script>

<template>
  <aside class="episode-nav">
    <!-- 标题和批量生成 -->
    <div class="nav-header">
      <h3>集数列表</h3>
      <button
        class="btn-batch"
        @click="emit('batch-generate')"
        :disabled="isLoading"
        title="批量生成"
      >
        批量
      </button>
    </div>

    <!-- 快速跳转 -->
    <div class="quick-jump">
      <input
        type="number"
        v-model="jumpValue"
        :min="1"
        :max="totalEpisodes"
        placeholder="跳转到..."
        @keyup.enter="handleJump"
      />
      <button class="btn-jump" @click="handleJump" :disabled="!jumpValue">
        Go
      </button>
    </div>

    <!-- 分组选择器 -->
    <div class="group-selector">
      <button
        v-for="(group, index) in groupLabels"
        :key="index"
        class="group-btn"
        :class="{ active: currentGroup === index }"
        @click="selectGroup(index)"
      >
        {{ group.label }}
      </button>
    </div>

    <!-- 集数列表 -->
    <div class="episode-list">
      <div
        v-for="ep in currentGroupEpisodes"
        :key="ep.number"
        class="episode-item"
        :class="{
          active: ep.number === currentEpisode,
          [getStatusClass(ep.status)]: true
        }"
        @click="selectEpisode(ep.number)"
      >
        <span class="ep-number">第{{ ep.number }}集</span>
        <span class="ep-status">
          <template v-if="ep.status === 'completed'">✓</template>
          <template v-else-if="ep.status === 'generating'">⟳</template>
          <template v-else-if="ep.status === 'failed'">✗</template>
          <template v-else>○</template>
        </span>
      </div>
    </div>

    <!-- 进度条 -->
    <div class="nav-footer">
      <div class="progress-info">
        <span>{{ completedCount }} / {{ totalEpisodes }}</span>
        <span>{{ progressPercent }}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.episode-nav {
  width: 180px;
  background: var(--bg-surface);
  border-right: 1px solid var(--border-default);
  display: flex;
  flex-direction: column;
}

.nav-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border-default);
}

.nav-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.btn-batch {
  padding: var(--space-1) var(--space-2);
  font-size: 11px;
  background: var(--primary);
  color: var(--text-on-primary);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition-fast);
}

.btn-batch:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn-batch:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.quick-jump {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-2);
  border-bottom: 1px solid var(--border-default);
}

.quick-jump input {
  flex: 1;
  min-width: 0;
  padding: var(--space-1) var(--space-2);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--text-primary);
  transition: var(--transition-fast);
}

.quick-jump input::placeholder {
  color: var(--text-muted);
}

.quick-jump input:focus {
  border-color: var(--border-focus);
  outline: none;
}

.btn-jump {
  padding: var(--space-1) var(--space-2);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 12px;
  color: var(--text-primary);
  transition: var(--transition-fast);
}

.btn-jump:hover:not(:disabled) {
  background: var(--bg-hover);
}

.btn-jump:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.group-selector {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  padding: var(--space-2);
  border-bottom: 1px solid var(--border-default);
}

.group-btn {
  flex: 1 0 calc(50% - 2px);
  padding: var(--space-1);
  font-size: 11px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition-fast);
}

.group-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.group-btn.active {
  background: var(--primary);
  color: var(--text-on-primary);
  border-color: var(--primary);
}

.episode-list {
  flex: 1;
  overflow-y: auto;
}

.episode-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  border-bottom: 1px solid var(--border-default);
  font-size: 12px;
  transition: var(--transition-fast);
}

.episode-item:hover {
  background: var(--bg-hover);
}

.episode-item.active {
  background: var(--primary-muted);
  border-left: 3px solid var(--primary);
}

.episode-item.status-completed {
  background: var(--success-muted);
}

.episode-item.status-completed.active {
  background: var(--primary-muted);
}

.episode-item.status-generating {
  background: var(--warning-muted);
}

.episode-item.status-failed {
  background: var(--error-muted);
}

.ep-number {
  color: var(--text-primary);
}

.ep-status {
  color: var(--text-muted);
}

.episode-item.status-completed .ep-status {
  color: var(--success);
}

.episode-item.status-generating .ep-status {
  color: var(--warning);
  animation: spin 1s linear infinite;
}

.episode-item.status-failed .ep-status {
  color: var(--error);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.nav-footer {
  padding: var(--space-2) var(--space-3);
  border-top: 1px solid var(--border-default);
  background: var(--bg-surface);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--space-1);
  font-size: 11px;
  color: var(--text-secondary);
}

.progress-bar {
  height: 4px;
  background: var(--bg-hover);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--success);
  border-radius: 2px;
  transition: var(--transition-normal);
}
</style>
