<template>
  <div class="foreshadowing-update-panel">
    <div class="panel-header">
      <h4>关联伏笔</h4>
      <p class="hint">修复可能影响以下伏笔的状态，请确认是否需要更新</p>
    </div>

    <div class="foreshadowing-list">
      <div
        v-for="item in foreshadowings"
        :key="item.id"
        class="foreshadowing-item"
      >
        <div class="item-content">
          <span class="item-text">{{ item.content }}</span>
          <span class="item-episode">第{{ item.episodePlanted }}集埋下</span>
        </div>
        
        <div class="item-status">
          <span class="current-status" :class="item.currentStatus">
            {{ getStatusLabel(item.currentStatus) }}
          </span>
          <span class="arrow">→</span>
          <select
            v-model="statusUpdates[item.id]"
            class="status-select"
          >
            <option value="">不更新</option>
            <option value="progressing">推进中</option>
            <option value="resolved">已回收</option>
            <option value="planted">保持埋下</option>
          </select>
        </div>
      </div>
    </div>

    <div class="panel-actions">
      <button
        class="btn-update"
        :disabled="!hasUpdates"
        @click="handleUpdate"
      >
        更新伏笔状态
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { RelatedForeshadowing } from '@/types/fix';

const props = defineProps<{
  foreshadowings: RelatedForeshadowing[];
}>();

const emit = defineEmits<{
  (e: 'update', updates: Array<{ foreshadowingId: string; newStatus: string }>): void;
}>();

// 状态更新映射
const statusUpdates = ref<Record<string, string>>({});

// 初始化状态更新
watch(() => props.foreshadowings, (newVal) => {
  const updates: Record<string, string> = {};
  for (const f of newVal) {
    updates[f.id] = f.newStatus || '';
  }
  statusUpdates.value = updates;
}, { immediate: true });

const hasUpdates = computed(() => 
  Object.values(statusUpdates.value).some(v => v !== '')
);

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    planted: '已埋下',
    progressing: '推进中',
    resolved: '已回收',
    dormant: '休眠',
    abandoned: '已放弃',
  };
  return labels[status] || status;
}

function handleUpdate() {
  const updates = Object.entries(statusUpdates.value)
    .filter(([, status]) => status !== '')
    .map(([id, status]) => ({
      foreshadowingId: id,
      newStatus: status,
    }));
  
  if (updates.length > 0) {
    emit('update', updates);
  }
}
</script>

<style scoped>
.foreshadowing-update-panel {
  width: 100%;
  padding: 16px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  margin-top: 16px;
}

.panel-header {
  margin-bottom: 16px;
}

.panel-header h4 {
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.panel-header .hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.foreshadowing-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.foreshadowing-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--bg-primary);
  border-radius: 6px;
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-text {
  display: block;
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-episode {
  font-size: 11px;
  color: var(--text-tertiary);
}

.item-status {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.current-status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.current-status.planted {
  background: var(--info-bg);
  color: var(--info);
}

.current-status.progressing {
  background: var(--warning-bg);
  color: var(--warning);
}

.current-status.resolved {
  background: var(--success-bg);
  color: var(--success);
}

.arrow {
  color: var(--text-tertiary);
}

.status-select {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
}

.panel-actions {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.btn-update {
  padding: 8px 16px;
  background: var(--primary);
  color: var(--text-on-primary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.btn-update:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
