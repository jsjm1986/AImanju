<template>
  <Modal :show="visible" title="确认回滚" width="95vw" maxWidth="1400px" @close="$emit('cancel')">
    <div class="rollback-modal-content">
      <div class="info-section">
        <div class="rollback-warning">
          <div class="warning-icon">⚠️</div>
          <div class="warning-content">
            <h4>回滚操作说明</h4>
            <p>回滚将把剧本内容恢复到此次改写<strong>之前</strong>的状态。</p>
            <p v-if="affectedRecords > 1" class="affected-info">
              此操作将影响 <strong>{{ affectedRecords }}</strong> 条记录（包括此记录之后的所有已应用记录将被标记为"已回滚"）
            </p>
          </div>
        </div>

        <div class="rollback-info">
          <div class="info-row">
            <span class="info-label">改写类型</span>
            <span class="type-badge" :class="history?.type">
              {{ typeIcon }} {{ typeLabel }}
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">改写时间</span>
            <span class="info-value">{{ formatTime(history?.createdAt) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">改写指令</span>
            <span class="info-value instruction">{{ history?.instruction || '—' }}</span>
          </div>
        </div>

        <div v-if="history" class="word-count-change">
          <span class="stat-item">
            <span class="stat-label">回滚后字数</span>
            <span class="stat-value">{{ history.originalWordCount }} 字</span>
          </span>
          <span class="stat-arrow">←</span>
          <span class="stat-item">
            <span class="stat-label">当前字数</span>
            <span class="stat-value">{{ history.rewrittenWordCount }} 字</span>
          </span>
          <span class="stat-diff" :class="wordDiffClass">
            {{ wordDiffText }}
          </span>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" @click="$emit('cancel')" :disabled="confirming">
            取消
          </button>
          <button class="btn-danger" @click="handleConfirm" :disabled="confirming">
            <span v-if="confirming" class="loading-spinner small"></span>
            {{ confirming ? '回滚中...' : '确认回滚' }}
          </button>
        </div>
      </div>

      <div class="diff-section">
        <div class="section-header">
          <h4 class="section-title">
            <span>内容变化预览</span>
            <span class="preview-hint">（回滚后将恢复为左侧内容）</span>
          </h4>
        </div>
        
        <div v-if="loading" class="loading-state">
          <span class="loading-spinner"></span>
          <span>加载差异对比...</span>
        </div>
        
        <div v-else-if="diff && diff.length > 0" class="diff-container">
          <DiffViewer :diff="diff" :collapsible="true" />
        </div>
        
        <div v-else class="no-diff">
          <span>无法加载差异对比</span>
        </div>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRewriteStore } from '@/stores/rewriteStore';
import Modal from '@/components/common/Modal.vue';
import DiffViewer from './DiffViewer.vue';
import type { RewriteHistory, DiffBlock } from '@/types';

const TYPE_MAP: Record<string, { icon: string; label: string }> = {
  selection: { icon: '✂️', label: '局部改写' },
  instruction: { icon: '🎯', label: '智能改写' },
  full: { icon: '📄', label: '全文重写' },
  manual: { icon: '✏️', label: '手动编辑' },
};
const DEFAULT_TYPE = { icon: '📝', label: '改写' };

const props = defineProps<{
  visible: boolean;
  history: RewriteHistory | null;
  projectId: string;
}>();

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

const rewriteStore = useRewriteStore();

const loading = ref(false);
const confirming = ref(false);
const diff = ref<DiffBlock[]>([]);
const affectedRecords = ref(1);

const typeInfo = computed(() => {
  if (!props.history) return DEFAULT_TYPE;
  return TYPE_MAP[props.history.type] || DEFAULT_TYPE;
});

const typeIcon = computed(() => typeInfo.value.icon);
const typeLabel = computed(() => typeInfo.value.label);

const wordDiffClass = computed(() => {
  const d = props.history?.wordCountDiff || 0;
  if (d > 0) return 'negative';
  if (d < 0) return 'positive';
  return 'neutral';
});

const wordDiffText = computed(() => {
  const d = -(props.history?.wordCountDiff || 0);
  if (d > 0) return `+${d} 字`;
  if (d < 0) return `${d} 字`;
  return '无变化';
});

function formatTime(date: Date | string | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function loadDiff(): Promise<void> {
  if (!props.history || !props.projectId) return;
  loading.value = true;
  try {
    const detail = await rewriteStore.loadHistoryDetail(props.history._id, props.projectId);
    if (detail) diff.value = detail.diff;
  } catch (err) {
    console.error('加载差异失败:', err);
  } finally {
    loading.value = false;
  }
}

function handleConfirm(): void {
  confirming.value = true;
  emit('confirm');
}

watch(() => props.visible, (val) => {
  if (val && props.history) {
    loadDiff();
    confirming.value = false;
  } else {
    diff.value = [];
    confirming.value = false;
  }
}, { immediate: true });

watch(() => props.history, (val) => {
  if (props.visible && val) loadDiff();
});
</script>

<style scoped>
/* 主布局 - 左右分栏 */
.rollback-modal-content {
  display: flex;
  gap: var(--space-6);
  min-height: 70vh;
  max-height: 80vh;
}

/* 左侧信息区域 */
.info-section {
  flex: 0 0 360px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* 右侧差异预览区域 */
.diff-section {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  overflow: hidden;
}

.section-header {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-elevated);
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.preview-hint {
  font-size: var(--text-xs);
  font-weight: var(--font-normal);
  color: var(--text-muted);
}

.diff-container {
  flex: 1;
  overflow: auto;
}

.diff-container :deep(.diff-viewer) {
  border: none;
  border-radius: 0;
  height: 100%;
}

.diff-container :deep(.diff-content) {
  max-height: none;
  height: calc(100% - 80px);
}

/* 警告信息 */
.rollback-warning {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--warning-muted);
  border: 1px solid var(--warning-border);
  border-radius: var(--radius-md);
}

.warning-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.warning-content h4 {
  margin: 0 0 var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--warning);
}

.warning-content p {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.5;
}

.warning-content p + p {
  margin-top: var(--space-2);
}

.affected-info {
  color: var(--warning) !important;
}

.affected-info strong {
  color: var(--error);
}

/* 改写信息 */
.rollback-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
}

.info-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.info-label {
  flex: 0 0 80px;
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.info-value {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.info-value.instruction {
  color: var(--text-secondary);
  font-style: italic;
}

/* 类型标签 */
.type-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.type-badge.selection {
  background: var(--info-muted);
  color: var(--info);
}

.type-badge.instruction {
  background: var(--purple-muted);
  color: var(--primary-hover);
}

.type-badge.full {
  background: var(--success-muted);
  color: var(--success);
}

.type-badge.manual {
  background: var(--bg-hover);
  color: var(--text-muted);
}

/* 加载状态 */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-6);
  color: var(--text-tertiary);
  flex: 1;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-default);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-spinner.small {
  width: 14px;
  height: 14px;
  border-width: 2px;
  border-color: rgba(255, 255, 255, 0.3);
  border-top-color: var(--text-on-primary);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.no-diff {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  color: var(--text-tertiary);
  font-size: var(--text-sm);
  flex: 1;
}

/* 字数变化 */
.word-count-change {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.stat-value {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.stat-arrow {
  color: var(--text-muted);
  font-size: var(--text-lg);
}

.stat-diff {
  margin-left: auto;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.stat-diff.positive {
  background: var(--success-muted);
  color: var(--success);
}

.stat-diff.negative {
  background: var(--error-muted);
  color: var(--error);
}

.stat-diff.neutral {
  background: var(--bg-hover);
  color: var(--text-tertiary);
}

/* 底部按钮 */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-default);
  margin-top: auto;
}

.btn-secondary {
  padding: var(--space-2) var(--space-4);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-hover);
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-danger {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--error);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-on-primary);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.btn-danger:hover:not(:disabled) {
  background: var(--error);
}

.btn-danger:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* 响应式：小屏幕时改为上下布局 */
@media (max-width: 900px) {
  .rollback-modal-content {
    flex-direction: column;
    min-height: auto;
    max-height: none;
  }
  
  .info-section {
    flex: none;
  }
  
  .diff-section {
    min-height: 400px;
  }
}
</style>
