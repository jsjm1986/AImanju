<template>
  <div class="fix-progress-panel">
    <div class="progress-header">
      <h4>🔄 正在修复</h4>
      <button class="cancel-btn" @click="handleCancel">取消</button>
    </div>
    
    <div class="progress-bar-container">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
      </div>
      <span class="progress-text">{{ progress }}%</span>
    </div>
    
    <div class="progress-stats">
      <span>已生成 {{ wordCount }} 字</span>
      <span v-if="estimatedTime">预计剩余 {{ estimatedTime }}</span>
    </div>
    
    <div ref="streamContentRef" class="stream-content">
      <pre>{{ content || '等待生成...' }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';

const props = defineProps<{
  progress: number;
  content: string;
}>();

const emit = defineEmits<{
  (e: 'cancel'): void;
}>();

const streamContentRef = ref<HTMLElement | null>(null);

const wordCount = computed(() => {
  return props.content?.replace(/\s/g, '').length || 0;
});

const estimatedTime = computed(() => {
  if (props.progress <= 0 || props.progress >= 100) return '';
  const remaining = Math.ceil((100 - props.progress) / 10);
  return `${remaining}秒`;
});

// 监听内容变化，自动滚动到底部
watch(() => props.content, async () => {
  await nextTick();
  if (streamContentRef.value) {
    streamContentRef.value.scrollTop = streamContentRef.value.scrollHeight;
  }
});

function handleCancel() {
  emit('cancel');
}
</script>

<style scoped>
.fix-progress-panel {
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  border: 1px solid var(--border-default);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.progress-header h4 {
  margin: 0;
  font-size: var(--text-md);
  color: var(--text-primary);
}

.cancel-btn {
  padding: 6px 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  cursor: pointer;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.cancel-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

.progress-bar-container {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: var(--bg-hover);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--success));
  border-radius: var(--radius-sm);
  transition: width 0.3s;
}

.progress-text {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--primary);
  min-width: 40px;
}

.progress-stats {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.stream-content {
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  padding: 12px;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--border-default);
}

.stream-content pre {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  color: var(--text-primary);
}
</style>
