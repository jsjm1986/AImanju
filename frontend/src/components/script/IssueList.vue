<template>
  <div class="issue-list">
    <!-- 筛选器 -->
    <div class="issue-filters">
      <button
        v-for="filter in filters"
        :key="filter.value"
        class="filter-btn"
        :class="{ active: currentFilter === filter.value }"
        @click="currentFilter = filter.value"
      >
        {{ filter.label }}
        <span class="count" :class="filter.value">{{ getCount(filter.value) }}</span>
      </button>
    </div>

    <!-- 问题列表 -->
    <div class="issues-container">
      <div v-if="filteredIssues.length === 0" class="empty-state">
        <span class="empty-icon">✓</span>
        <p>{{ currentFilter === 'all' ? '暂无问题' : `没有${getFilterLabel(currentFilter)}类型的问题` }}</p>
      </div>

      <div
        v-else
        v-for="(issue, index) in filteredIssues"
        :key="index"
        class="issue-item"
        :class="issue.type"
      >
        <div class="issue-icon">
          <span v-if="issue.type === 'error'">✕</span>
          <span v-else-if="issue.type === 'warning'">⚠</span>
          <span v-else>ℹ</span>
        </div>

        <div class="issue-content">
          <div class="issue-header">
            <span class="issue-category">{{ issue.category }}</span>
            <span v-if="issue.episode" class="issue-episode">第{{ issue.episode }}集</span>
          </div>
          <div class="issue-message">{{ issue.message }}</div>
          <div v-if="issue.details" class="issue-details">{{ issue.details }}</div>
        </div>

        <button
          v-if="showFixButton && issue.type !== 'info'"
          class="fix-btn"
          @click="$emit('fix', issue)"
        >
          修复
        </button>
      </div>
    </div>

    <!-- 分页或加载更多 -->
    <div v-if="hasMore" class="load-more">
      <button class="load-more-btn" @click="$emit('loadMore')">
        加载更多
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface Issue {
  type: 'error' | 'warning' | 'info';
  category: string;
  episode?: number;
  message: string;
  details?: string;
}

const props = withDefaults(defineProps<{
  issues: Issue[];
  showFixButton?: boolean;
  hasMore?: boolean;
}>(), {
  showFixButton: false,
  hasMore: false,
});

defineEmits<{
  (e: 'fix', issue: Issue): void;
  (e: 'loadMore'): void;
}>();

const currentFilter = ref<'all' | 'error' | 'warning' | 'info'>('all');

const filters = [
  { value: 'all' as const, label: '全部' },
  { value: 'error' as const, label: '错误' },
  { value: 'warning' as const, label: '警告' },
  { value: 'info' as const, label: '建议' },
];

const filteredIssues = computed(() => {
  if (currentFilter.value === 'all') {
    return props.issues;
  }
  return props.issues.filter(i => i.type === currentFilter.value);
});

const getCount = (filter: string) => {
  if (filter === 'all') {
    return props.issues.length;
  }
  return props.issues.filter(i => i.type === filter).length;
};

const getFilterLabel = (filter: string) => {
  const found = filters.find(f => f.value === filter);
  return found?.label || filter;
};
</script>

<style scoped>
.issue-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.issue-filters {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.filter-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  transition: var(--transition-fast);
}

.filter-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.filter-btn.active {
  background: var(--primary);
  color: var(--text-on-primary);
  border-color: var(--primary);
}

.count {
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 600;
}

.filter-btn:not(.active) .count.error {
  background: var(--error-muted);
  color: var(--error);
}

.filter-btn:not(.active) .count.warning {
  background: var(--warning-muted);
  color: var(--warning);
}

.filter-btn:not(.active) .count.info {
  background: var(--primary-muted);
  color: var(--primary);
}

.filter-btn.active .count {
  background: rgba(255, 255, 255, 0.2);
  color: var(--text-on-primary);
}

.issues-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-10) var(--space-5);
  color: var(--text-muted);
}

.empty-icon {
  font-size: 40px;
  color: var(--success);
  margin-bottom: var(--space-3);
}

.issue-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
}

.issue-item.error {
  border-left: 4px solid var(--error);
  background: var(--error-muted);
}

.issue-item.warning {
  border-left: 4px solid var(--warning);
  background: rgba(245, 158, 11, 0.05);
}

.issue-item.info {
  border-left: 4px solid var(--primary);
  background: var(--primary-muted);
}

.issue-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
}

.error .issue-icon {
  background: var(--error-muted);
  color: var(--error);
}

.warning .issue-icon {
  background: var(--warning-muted);
  color: var(--warning);
}

.info .issue-icon {
  background: var(--primary-muted);
  color: var(--primary);
}

.issue-content {
  flex: 1;
  min-width: 0;
}

.issue-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.issue-category {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-hover);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
}

.issue-episode {
  font-size: 12px;
  color: var(--text-muted);
}

.issue-message {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.5;
}

.issue-details {
  margin-top: var(--space-2);
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--bg-surface);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  white-space: pre-wrap;
}

.fix-btn {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--primary);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--primary);
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
  transition: var(--transition-fast);
}

.fix-btn:hover {
  background: var(--primary-muted);
}

.load-more {
  display: flex;
  justify-content: center;
  padding: var(--space-4);
}

.load-more-btn {
  padding: var(--space-3) var(--space-6);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
  transition: var(--transition-fast);
}

.load-more-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
</style>
