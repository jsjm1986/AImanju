<template>
  <div class="fix-history-tab">
    <!-- 统计信息 -->
    <div v-if="stats" class="history-stats">
      <div class="stat-item">
        <span class="stat-value">{{ stats.totalFixes }}</span>
        <span class="stat-label">总修复数</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{ (stats.successRate * 100).toFixed(0) }}%</span>
        <span class="stat-label">成功率</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{ Object.keys(stats.byIssueType).length }}</span>
        <span class="stat-label">问题类型</span>
      </div>
    </div>

    <!-- 历史列表 -->
    <div class="history-list">
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>加载中...</p>
      </div>
      
      <div v-else-if="history.length === 0" class="empty-state">
        <p>暂无修复历史</p>
      </div>
      
      <div v-else class="timeline">
        <div 
          v-for="item in history" 
          :key="item.id" 
          class="timeline-item"
          :class="{ expanded: expandedId === item.id }"
        >
          <div class="timeline-marker"></div>
          <div class="timeline-content" @click="toggleExpand(item.id)">
            <div class="item-header">
              <span class="item-time">{{ formatTime(item.appliedAt) }}</span>
              <span :class="['item-type', `type-${item.issueType}`]">{{ item.issueType }}</span>
            </div>
            <div class="item-info">
              <span class="item-episode">第 {{ item.episodeNumber }} 集</span>
              <span class="item-plan">{{ item.planName }}</span>
            </div>
            <p class="item-description">{{ item.issueDescription }}</p>
            
            <!-- 展开详情 -->
            <div v-if="expandedId === item.id" class="item-details">
              <div class="diff-preview">
                <div class="diff-section">
                  <span class="diff-label">原文</span>
                  <pre class="diff-old">{{ truncate(item.originalContent, 200) }}</pre>
                </div>
                <div class="diff-section">
                  <span class="diff-label">修复后</span>
                  <pre class="diff-new">{{ truncate(item.fixedContent, 200) }}</pre>
                </div>
              </div>
              <div class="item-meta">
                <span :class="['word-diff', item.wordCountDiff > 0 ? 'increase' : 'decrease']">
                  {{ item.wordCountDiff > 0 ? '+' : '' }}{{ item.wordCountDiff }} 字
                </span>
                <button 
                  v-if="item.canRevert" 
                  class="btn btn-small btn-warning"
                  @click.stop="handleRevert(item.id)"
                >
                  回滚
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useFixStore } from '@/stores/fixStore';
import type { FixHistory, FixHistoryStats } from '@/types/fix';

const props = defineProps<{
  projectId: string;
}>();

const emit = defineEmits<{
  (e: 'revert', historyId: string): void;
}>();

const fixStore = useFixStore();
const loading = ref(false);
const expandedId = ref<string | null>(null);
const history = ref<FixHistory[]>([]);
const stats = ref<FixHistoryStats | null>(null);

onMounted(async () => {
  await loadHistory();
});

async function loadHistory() {
  loading.value = true;
  try {
    await fixStore.loadHistory(props.projectId);
    history.value = fixStore.history;
    stats.value = fixStore.historyStats;
  } finally {
    loading.value = false;
  }
}

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id;
}

function formatTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function truncate(text: string, maxLength: number): string {
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}

async function handleRevert(historyId: string) {
  if (confirm('确定要回滚此修复吗？')) {
    emit('revert', historyId);
  }
}
</script>

<style scoped>
.fix-history-tab {
  padding: var(--space-4);
}

.history-stats {
  display: flex;
  gap: var(--space-6);
  padding: var(--space-4);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-5);
  border: 1px solid var(--border-default);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: var(--text-3xl);
  font-weight: var(--font-semibold);
  color: var(--primary);
}

.stat-label {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin-top: 4px;
}

.loading-state, .empty-state {
  text-align: center;
  padding: var(--space-10);
  color: var(--text-secondary);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-default);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.timeline {
  position: relative;
  padding-left: 24px;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--border-default);
}

.timeline-item {
  position: relative;
  margin-bottom: var(--space-4);
}

.timeline-marker {
  position: absolute;
  left: -20px;
  top: 6px;
  width: 12px;
  height: 12px;
  background: var(--primary);
  border-radius: 50%;
  border: 2px solid var(--bg-surface);
}

.timeline-content {
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  padding: 14px;
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 1px solid transparent;
}

.timeline-content:hover {
  border-color: var(--border-hover);
}

.timeline-item.expanded .timeline-content {
  border-color: var(--primary);
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.item-time {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.item-type {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-weight: var(--font-medium);
}

.type-character_consistency { background: var(--info-muted); color: var(--info); }
.type-plot_logic { background: var(--warning-muted); color: var(--warning); }
.type-timeline { background: var(--purple-muted); color: var(--primary-hover); }
.type-foreshadowing { background: var(--success-muted); color: var(--success); }

.item-info {
  display: flex;
  gap: 12px;
  margin-bottom: 6px;
  font-size: var(--text-sm);
}

.item-episode {
  color: var(--text-secondary);
}

.item-plan {
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.item-description {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.5;
}

.item-details {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-default);
}

.diff-preview {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}

.diff-section {
  display: flex;
  flex-direction: column;
}

.diff-label {
  font-size: 11px;
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.diff-old, .diff-new {
  margin: 0;
  padding: 8px;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
}

.diff-old {
  background: var(--error-muted);
  border: 1px solid var(--error);
  color: var(--text-primary);
}

.diff-new {
  background: var(--success-muted);
  border: 1px solid var(--success);
  color: var(--text-primary);
}

.item-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.word-diff {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.word-diff.increase { color: var(--success); }
.word-diff.decrease { color: var(--error); }

.btn-small {
  padding: 6px 12px;
  font-size: var(--text-xs);
}

.btn-warning {
  background: var(--warning);
  border: none;
  color: var(--text-on-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-warning:hover {
  opacity: 0.9;
}
</style>
