<template>
  <Modal :show="visible" title="改写详情" width="720px" @close="$emit('close')">
    <div v-if="loading" class="loading-state">
      <span class="loading-spinner"></span>
      <span>加载中...</span>
    </div>

    <template v-else-if="history">
      <div class="detail-section">
        <h4 class="section-title">基本信息</h4>
        <div class="info-grid">
          <div class="info-item">
            <label>改写类型</label>
            <span class="type-badge" :class="history.type">
              {{ typeIcon }} {{ typeLabel }}
            </span>
          </div>
          <div class="info-item">
            <label>改写时间</label>
            <span>{{ formatTime(history.createdAt) }}</span>
          </div>
          <div class="info-item">
            <label>应用状态</label>
            <span class="status-badge" :class="history.applied ? 'applied' : 'pending'">
              {{ history.applied ? '已应用' : '未应用' }}
            </span>
          </div>
          <div class="info-item">
            <label>所属集数</label>
            <span>第 {{ history.episodeNumber }} 集</span>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h4 class="section-title">用户改写指令</h4>
        <div class="instruction-content">{{ history.instruction }}</div>
      </div>

      <template v-if="history.type !== 'manual' && (history.systemPrompt || history.userPrompt)">
        <div v-if="history.systemPrompt" class="detail-section">
          <h4 class="section-title collapsible" @click="showSystemPrompt = !showSystemPrompt">
            <span class="collapse-icon">{{ showSystemPrompt ? '▼' : '▶' }}</span>
            AI 系统提示词
            <span class="prompt-hint">（点击展开/收起）</span>
          </h4>
          <Transition name="collapse">
            <div v-if="showSystemPrompt" class="prompt-content system-prompt">
              {{ history.systemPrompt }}
            </div>
          </Transition>
        </div>

        <div v-if="history.userPrompt" class="detail-section">
          <h4 class="section-title collapsible" @click="showUserPrompt = !showUserPrompt">
            <span class="collapse-icon">{{ showUserPrompt ? '▼' : '▶' }}</span>
            发送给 AI 的完整消息
            <span class="prompt-hint">（点击展开/收起）</span>
          </h4>
          <Transition name="collapse">
            <div v-if="showUserPrompt" class="prompt-content user-prompt">
              {{ history.userPrompt }}
            </div>
          </Transition>
        </div>
      </template>

      <div class="detail-section">
        <h4 class="section-title">字数统计</h4>
        <div class="stats-row">
          <span class="stat-item">
            <span class="stat-label">原文</span>
            <span class="stat-value">{{ history.originalWordCount || '—' }} 字</span>
          </span>
          <span class="stat-arrow">→</span>
          <span class="stat-item">
            <span class="stat-label">改写后</span>
            <span class="stat-value">{{ history.rewrittenWordCount || '—' }} 字</span>
          </span>
          <span class="stat-diff" :class="wordDiffClass">
            {{ wordDiffText }}
          </span>
        </div>
      </div>

      <div class="detail-section diff-section">
        <h4 class="section-title">内容对比</h4>
        <DiffViewer :diff="historyDetail!.diff" />
      </div>

      <div class="detail-footer">
        <button class="btn-secondary" @click="$emit('close')">关闭</button>
        <button
          v-if="history.applied"
          class="btn-warning"
          @click="handleRollback"
        >
          ↩️ 回滚到此版本
        </button>
      </div>
    </template>

    <div v-else-if="error" class="error-state">
      <span class="error-icon">⚠️</span>
      <span>{{ error }}</span>
    </div>

    <div v-else class="empty-state">
      <span class="empty-icon">📭</span>
      <span>暂无详情数据</span>
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

const props = defineProps<{
  visible: boolean;
  historyId: string;
  projectId: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'rollback', history: RewriteHistory): void;
}>();

const rewriteStore = useRewriteStore();

const loading = ref(false);
const error = ref<string | null>(null);
const historyDetail = ref<{ history: RewriteHistory; diff: DiffBlock[] } | null>(null);
const showSystemPrompt = ref(false);
const showUserPrompt = ref(false);

const history = computed(() => historyDetail.value?.history);

const typeInfo = computed(() => {
  if (!history.value) return { icon: '', label: '' };
  return TYPE_MAP[history.value.type] ?? { icon: '📝', label: '改写' };
});

const typeIcon = computed(() => typeInfo.value.icon);
const typeLabel = computed(() => typeInfo.value.label);

const wordDiff = computed(() => history.value?.wordCountDiff || 0);

const wordDiffClass = computed(() => {
  if (!history.value) return '';
  if (wordDiff.value > 0) return 'positive';
  if (wordDiff.value < 0) return 'negative';
  return 'neutral';
});

const wordDiffText = computed(() => {
  if (!history.value) return '';
  if (wordDiff.value > 0) return `+${wordDiff.value} 字`;
  if (wordDiff.value < 0) return `${wordDiff.value} 字`;
  return '无变化';
});

function formatTime(date: Date | string): string {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function loadDetail(): Promise<void> {
  if (!props.historyId || !props.projectId) return;

  loading.value = true;
  error.value = null;

  try {
    historyDetail.value = await rewriteStore.loadHistoryDetail(props.historyId, props.projectId);
  } catch (err) {
    error.value = (err as Error).message || '加载失败';
  } finally {
    loading.value = false;
  }
}

function handleRollback(): void {
  if (historyDetail.value) {
    emit('rollback', historyDetail.value.history);
  }
}

watch(
  () => [props.visible, props.historyId] as const,
  ([visible, id]) => {
    if (visible && id) loadDetail();
  },
  { immediate: true },
);
</script>

<style scoped>
/* 加载状态 */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-8);
  color: var(--text-tertiary);
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-default);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 错误状态 */
.error-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-8);
  color: var(--error);
}

.error-icon {
  font-size: 24px;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-8);
  color: var(--text-tertiary);
}

.empty-icon {
  font-size: 32px;
}

/* 详情区块 */
.detail-section {
  margin-bottom: var(--space-5);
}

.detail-section:last-of-type {
  margin-bottom: 0;
}

.section-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-3);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-default);
}

/* 信息网格 */
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.info-item label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.info-item span {
  font-size: var(--text-sm);
  color: var(--text-primary);
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

/* 状态标签 */
.status-badge {
  display: inline-flex;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
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

/* 改写指令 */
.instruction-content {
  padding: var(--space-3);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.6;
  white-space: pre-wrap;
}

/* 可折叠标题 */
.section-title.collapsible {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  user-select: none;
}

.section-title.collapsible:hover {
  color: var(--primary);
}

.collapse-icon {
  font-size: 10px;
  color: var(--text-tertiary);
  transition: transform var(--transition-fast);
}

.prompt-hint {
  font-size: var(--text-xs);
  font-weight: var(--font-normal);
  color: var(--text-muted);
  margin-left: auto;
}

/* 提示词内容 */
.prompt-content {
  padding: var(--space-3);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  color: var(--text-secondary);
  line-height: 1.6;
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--border-default);
}

.prompt-content.system-prompt {
  border-left: 3px solid var(--primary);
}

.prompt-content.user-prompt {
  border-left: 3px solid var(--success);
}

/* 折叠动画 */
.collapse-enter-active,
.collapse-leave-active {
  transition: all var(--transition-normal);
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
  margin-top: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  opacity: 1;
  max-height: 200px;
}

/* 统计行 */
.stats-row {
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

/* 差异区块 */
.diff-section {
  max-height: 300px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.diff-section .section-title {
  flex-shrink: 0;
}

/* 底部按钮 */
.detail-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-default);
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

.btn-secondary:hover {
  background: var(--bg-hover);
}

.btn-warning {
  padding: var(--space-2) var(--space-4);
  background: var(--warning);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-on-primary);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.btn-warning:hover {
  background: var(--warning-hover);
}
</style>
