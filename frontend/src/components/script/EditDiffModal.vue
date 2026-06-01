<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="diff-overlay" @click.self="$emit('close')">
        <div class="diff-modal">
          <div class="modal-header">
            <div class="header-left">
              <span class="header-icon">📝</span>
              <h3>确认修改</h3>
            </div>
            <button class="close-btn" @click="$emit('close')">×</button>
          </div>

          <div class="diff-stats">
            <span class="stat added">
              <span class="stat-icon">+</span>
              <span class="stat-value">{{ stats.addedChars }}</span>
              <span class="stat-label">字新增</span>
            </span>
            <span class="stat removed">
              <span class="stat-icon">−</span>
              <span class="stat-value">{{ stats.removedChars }}</span>
              <span class="stat-label">字删除</span>
            </span>
            <span class="stat lines">
              <span class="stat-value">{{ stats.changedLines }}</span>
              <span class="stat-label">行变更</span>
            </span>
          </div>

          <!-- 视图切换 -->
          <div class="diff-controls">
            <div class="view-toggle">
              <button
                class="toggle-btn"
                :class="{ active: viewMode === 'unified' }"
                @click="viewMode = 'unified'"
              >
                统一视图
              </button>
              <button
                class="toggle-btn"
                :class="{ active: viewMode === 'side-by-side' }"
                @click="viewMode = 'side-by-side'"
              >
                并排对比
              </button>
            </div>
          </div>

          <!-- 差异内容 -->
          <div class="diff-content" :class="{ 'side-by-side': viewMode === 'side-by-side' }">
            <!-- 并排模式 -->
            <template v-if="viewMode === 'side-by-side'">
              <div class="diff-pane original">
                <div class="pane-header">
                  <span class="pane-icon">📄</span>
                  <span>修改前</span>
                </div>
                <div class="pane-content">
                  <div
                    v-for="(line, index) in originalLines"
                    :key="'orig-' + index"
                    class="diff-line"
                    :class="line.type"
                  >
                    <span class="line-number">{{ line.lineNum }}</span>
                    <span class="line-content">{{ line.content }}</span>
                  </div>
                </div>
              </div>
              <div class="diff-pane modified">
                <div class="pane-header">
                  <span class="pane-icon">✨</span>
                  <span>修改后</span>
                </div>
                <div class="pane-content">
                  <div
                    v-for="(line, index) in modifiedLines"
                    :key="'mod-' + index"
                    class="diff-line"
                    :class="line.type"
                  >
                    <span class="line-number">{{ line.lineNum }}</span>
                    <span class="line-content">{{ line.content }}</span>
                  </div>
                </div>
              </div>
            </template>

            <!-- 统一模式 -->
            <template v-else>
              <div class="diff-unified">
                <div
                  v-for="(line, index) in unifiedLines"
                  :key="index"
                  class="diff-line"
                  :class="line.type"
                >
                  <span class="line-marker">{{ line.marker }}</span>
                  <span class="line-content">{{ line.content }}</span>
                </div>
              </div>
            </template>
          </div>

          <!-- 底部操作 -->
          <div class="modal-footer">
            <button class="btn-cancel" @click="$emit('close')">继续编辑</button>
            <button class="btn-discard" @click="$emit('discard')">放弃修改</button>
            <button class="btn-confirm" @click="$emit('confirm')">
              <span>✓</span> 确认保存
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  visible: boolean;
  originalContent: string;
  modifiedContent: string;
}>();

defineEmits<{
  (e: 'close'): void;
  (e: 'confirm'): void;
  (e: 'discard'): void;
}>();

const viewMode = ref<'unified' | 'side-by-side'>('unified');

// 计算差异统计
const stats = computed(() => {
  const origLen = props.originalContent.length;
  const modLen = props.modifiedContent.length;
  const origLines = props.originalContent.split('\n');
  const modLines = props.modifiedContent.split('\n');
  
  let changedLines = 0;
  const maxLines = Math.max(origLines.length, modLines.length);
  for (let i = 0; i < maxLines; i++) {
    if (origLines[i] !== modLines[i]) changedLines++;
  }

  return {
    addedChars: Math.max(0, modLen - origLen),
    removedChars: Math.max(0, origLen - modLen),
    changedLines,
  };
});

// 简单的行级别差异计算
const diffResult = computed(() => {
  const origLines = props.originalContent.split('\n');
  const modLines = props.modifiedContent.split('\n');
  
  const result: Array<{
    type: 'unchanged' | 'added' | 'removed';
    origLine?: string;
    modLine?: string;
    origNum?: number;
    modNum?: number;
  }> = [];

  // 使用简单的 LCS 思路进行差异计算
  let i = 0, j = 0;
  let origNum = 1, modNum = 1;

  while (i < origLines.length || j < modLines.length) {
    if (i >= origLines.length) {
      // 原文已结束，剩余都是新增
      result.push({ type: 'added', modLine: modLines[j], modNum: modNum++ });
      j++;
    } else if (j >= modLines.length) {
      // 新文已结束，剩余都是删除
      result.push({ type: 'removed', origLine: origLines[i], origNum: origNum++ });
      i++;
    } else if (origLines[i] === modLines[j]) {
      // 相同行
      result.push({ type: 'unchanged', origLine: origLines[i], modLine: modLines[j], origNum: origNum++, modNum: modNum++ });
      i++;
      j++;
    } else {
      // 不同，先检查是否能在后面找到匹配
      const lookAhead = 3;
      let foundOrig = -1, foundMod = -1;
      
      for (let k = 1; k <= lookAhead && j + k < modLines.length; k++) {
        if (origLines[i] === modLines[j + k]) {
          foundMod = k;
          break;
        }
      }
      
      for (let k = 1; k <= lookAhead && i + k < origLines.length; k++) {
        if (origLines[i + k] === modLines[j]) {
          foundOrig = k;
          break;
        }
      }

      if (foundMod > 0 && (foundOrig < 0 || foundMod <= foundOrig)) {
        // 新增了几行
        for (let k = 0; k < foundMod; k++) {
          result.push({ type: 'added', modLine: modLines[j + k], modNum: modNum++ });
        }
        j += foundMod;
      } else if (foundOrig > 0) {
        // 删除了几行
        for (let k = 0; k < foundOrig; k++) {
          result.push({ type: 'removed', origLine: origLines[i + k], origNum: origNum++ });
        }
        i += foundOrig;
      } else {
        // 修改：先删后增
        result.push({ type: 'removed', origLine: origLines[i], origNum: origNum++ });
        result.push({ type: 'added', modLine: modLines[j], modNum: modNum++ });
        i++;
        j++;
      }
    }
  }

  return result;
});

// 原文行（用于并排视图）
const originalLines = computed(() => {
  return diffResult.value
    .filter(d => d.type !== 'added')
    .map(d => ({
      type: d.type,
      content: d.origLine || '',
      lineNum: d.origNum || '',
    }));
});

// 修改后行（用于并排视图）
const modifiedLines = computed(() => {
  return diffResult.value
    .filter(d => d.type !== 'removed')
    .map(d => ({
      type: d.type,
      content: d.modLine || '',
      lineNum: d.modNum || '',
    }));
});

// 统一视图行
const unifiedLines = computed(() => {
  return diffResult.value.map(d => ({
    type: d.type,
    content: d.type === 'removed' ? d.origLine : d.modLine,
    marker: d.type === 'added' ? '+' : d.type === 'removed' ? '−' : ' ',
  }));
});
</script>

<style scoped>
/* 弹窗动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .diff-modal,
.modal-leave-active .diff-modal {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .diff-modal,
.modal-leave-to .diff-modal {
  transform: scale(0.95) translateY(-10px);
  opacity: 0;
}

/* 遮罩层 */
.diff-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-5);
}

/* 弹窗容器 */
.diff-modal {
  background: var(--bg-surface);
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 900px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-default);
  box-shadow: 0 24px 48px var(--overlay-bg);
  overflow: hidden;
}

/* 头部 */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  background: linear-gradient(135deg, var(--primary-muted) 0%, transparent 100%);
  border-bottom: 1px solid var(--border-default);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.header-icon {
  font-size: 20px;
}

.modal-header h3 {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--bg-elevated);
  font-size: 20px;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast);
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* 统计信息 */
.diff-stats {
  display: flex;
  gap: var(--space-5);
  padding: var(--space-3) var(--space-5);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-default);
}

.stat {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
}

.stat-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  font-weight: var(--font-bold);
  font-size: 12px;
}

.stat.added .stat-icon {
  background: var(--success-border);
  color: var(--success);
}

.stat.removed .stat-icon {
  background: rgba(239, 68, 68, 0.2);
  color: var(--error);
}

.stat-value {
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.stat-label {
  color: var(--text-tertiary);
}

.stat.added .stat-value { color: var(--success); }
.stat.removed .stat-value { color: var(--error); }

/* 控制栏 */
.diff-controls {
  display: flex;
  justify-content: center;
  padding: var(--space-2) var(--space-5);
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-default);
}

.view-toggle {
  display: flex;
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  padding: 3px;
}

.toggle-btn {
  padding: var(--space-2) var(--space-4);
  background: transparent;
  border: none;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--duration-fast);
}

.toggle-btn:hover {
  color: var(--text-primary);
}

.toggle-btn.active {
  background: var(--primary);
  color: var(--text-on-primary);
}

/* 差异内容 */
.diff-content {
  flex: 1;
  overflow: auto;
  min-height: 200px;
}

.diff-content.side-by-side {
  display: flex;
}

.diff-pane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.diff-pane.original {
  border-right: 1px solid var(--border-default);
}

.pane-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-default);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  position: sticky;
  top: 0;
  z-index: 1;
}

.pane-icon {
  font-size: 14px;
}

.pane-content,
.diff-unified {
  font-family: inherit;
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
}

.diff-line {
  display: flex;
  padding: var(--space-1) var(--space-3);
  min-height: 24px;
}

.diff-line.added {
  background: rgba(34, 197, 94, 0.12);
}

.diff-line.removed {
  background: rgba(239, 68, 68, 0.12);
}

.line-number {
  flex-shrink: 0;
  width: 32px;
  text-align: right;
  padding-right: var(--space-2);
  color: var(--text-muted);
  user-select: none;
  font-size: var(--text-xs);
}

.line-marker {
  flex-shrink: 0;
  width: 24px;
  text-align: center;
  font-weight: var(--font-bold);
  color: var(--text-muted);
}

.diff-line.added .line-marker { color: var(--success); }
.diff-line.removed .line-marker { color: var(--error); }

.line-content {
  flex: 1;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-primary);
}

/* 底部 */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5);
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-default);
}

.btn-cancel,
.btn-discard,
.btn-confirm {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.btn-cancel {
  background: transparent;
  border: 1px solid var(--border-default);
  color: var(--text-secondary);
}

.btn-cancel:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.btn-discard {
  background: transparent;
  border: 1px solid var(--error);
  color: var(--error);
}

.btn-discard:hover {
  background: var(--error-muted);
}

.btn-confirm {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--success);
  border: none;
  color: var(--text-on-primary);
}

.btn-confirm:hover {
  background: var(--success);
}
</style>
