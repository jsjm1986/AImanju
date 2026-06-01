<template>
  <div 
    class="history-item" 
    :class="{ reverted: item.reverted }"
    @mouseenter="showActions = true" 
    @mouseleave="showActions = false"
  >
    <div class="item-header">
      <span class="type-icon">{{ typeIcon }}</span>
      <span class="type-label">{{ typeLabel }}</span>
      <span class="time">{{ relativeTime }}</span>
      <span class="status-badge" :class="statusClass">
        {{ statusLabel }}
      </span>
    </div>
    
    <div class="item-instruction">{{ truncatedInstruction }}</div>
    
    <div class="item-footer">
      <span v-if="showEpisode" class="episode-tag">第{{ item.episodeNumber }}集</span>
      <span class="word-diff" :class="wordDiffClass">
        {{ wordDiffText }}
      </span>
    </div>
    
    <Transition name="fade">
      <div v-if="showActions" class="item-actions">
        <button class="action-btn" @click.stop="$emit('view', item)" title="查看详情">
          👁
        </button>
        <button 
          v-if="item.applied && !item.reverted" 
          class="action-btn warning" 
          @click.stop="$emit('rollback', item)"
          title="回滚"
        >
          ↩️
        </button>
        <button 
          class="action-btn danger" 
          @click.stop="$emit('delete', item)"
          title="删除"
        >
          🗑️
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { RewriteHistory } from '@/types';

const props = defineProps<{
  item: RewriteHistory;
  showEpisode?: boolean;
}>();

defineEmits<{
  (e: 'view', item: RewriteHistory): void;
  (e: 'rollback', item: RewriteHistory): void;
  (e: 'delete', item: RewriteHistory): void;
}>();

const showActions = ref(false);

// 类型图标
const typeIcon = computed(() => {
  switch (props.item.type) {
    case 'selection': return '✂️';
    case 'instruction': return '🎯';
    case 'full': return '📄';
    case 'manual': return '✏️';
    default: return '📝';
  }
});

// 类型标签
const typeLabel = computed(() => {
  switch (props.item.type) {
    case 'selection': return '局部改写';
    case 'instruction': return '智能改写';
    case 'full': return '全文重写';
    case 'manual': return '手动编辑';
    default: return '改写';
  }
});

// 状态样式类
const statusClass = computed(() => {
  if (props.item.reverted) return 'reverted';
  if (props.item.applied) return 'applied';
  return 'pending';
});

// 状态标签
const statusLabel = computed(() => {
  if (props.item.reverted) return '已回滚';
  if (props.item.applied) return '已应用';
  return '未应用';
});

// 截断指令（最多50字）
const truncatedInstruction = computed(() => {
  const instruction = props.item.instruction || '';
  if (instruction.length <= 50) return instruction;
  return instruction.substring(0, 50) + '...';
});

// 相对时间
const relativeTime = computed(() => {
  const date = new Date(props.item.createdAt);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  
  return date.toLocaleDateString('zh-CN');
});

// 字数变化文本
const wordDiffText = computed(() => {
  const diff = props.item.wordCountDiff || 0;
  if (diff > 0) return `+${diff}字`;
  if (diff < 0) return `${diff}字`;
  return '无变化';
});

// 字数变化样式类
const wordDiffClass = computed(() => {
  const diff = props.item.wordCountDiff || 0;
  if (diff > 0) return 'positive';
  if (diff < 0) return 'negative';
  return 'neutral';
});
</script>


<style scoped>
.history-item {
  position: relative;
  padding: var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.history-item:hover {
  border-color: var(--border-hover);
  background: var(--bg-hover);
}

/* 已回滚状态 - 降低视觉优先级 */
.history-item.reverted {
  opacity: 0.7;
  border-style: dashed;
}

.history-item.reverted:hover {
  opacity: 0.85;
}

.item-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.type-icon {
  font-size: 14px;
}

.type-label {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.time {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-left: auto;
}

.status-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-weight: var(--font-medium);
}

.status-badge.applied {
  background: var(--success-muted);
  color: var(--success);
}

.status-badge.pending {
  background: var(--warning-muted);
  color: var(--warning);
}

.status-badge.reverted {
  background: var(--error-muted);
  color: var(--error);
}

.item-instruction {
  font-size: var(--text-sm);
  color: var(--text-primary);
  line-height: 1.5;
  margin-bottom: var(--space-2);
  word-break: break-word;
}

.item-footer {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.episode-tag {
  font-size: 10px;
  padding: 2px 6px;
  background: var(--primary-muted);
  color: var(--primary);
  border-radius: var(--radius-sm);
}

.word-diff {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  margin-left: auto;
}

.word-diff.positive {
  color: var(--success);
}

.word-diff.negative {
  color: var(--error);
}

.word-diff.neutral {
  color: var(--text-tertiary);
}

.item-actions {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  display: flex;
  gap: var(--space-1);
  background: var(--bg-elevated);
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
}

.action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 14px;
  transition: background var(--transition-fast);
}

.action-btn:hover {
  background: var(--bg-hover);
}

.action-btn.warning:hover {
  background: var(--warning-muted);
}

.action-btn.danger:hover {
  background: var(--error-muted);
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-fast);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
