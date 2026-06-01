<template>
  <div class="fix-result-preview">
    <div class="result-header">
      <h4>✅ 修复完成</h4>
      <div class="word-count-change">
        <span :class="wordCountClass">
          {{ wordCountDiff > 0 ? '+' : '' }}{{ wordCountDiff }} 字
        </span>
      </div>
    </div>

    <div class="diff-viewer">
      <div class="diff-tabs">
        <button
          :class="['tab', { active: viewMode === 'diff' }]"
          @click="viewMode = 'diff'"
        >对比视图</button>
        <button
          :class="['tab', { active: viewMode === 'inline' }]"
          @click="viewMode = 'inline'"
        >差异高亮</button>
        <button
          :class="['tab', { active: viewMode === 'result' }]"
          @click="viewMode = 'result'"
        >修复结果</button>
        <span class="diff-nav" v-if="viewMode === 'diff' || viewMode === 'inline'">
          <span class="diff-count">{{ diffCount }} 处差异</span>
          <button class="nav-btn" @click="goToDiff(-1)" title="上一处差异">▲</button>
          <button class="nav-btn" @click="goToDiff(1)" title="下一处差异">▼</button>
        </span>
      </div>
      
      <div v-if="viewMode === 'diff'" class="diff-content">
        <div class="diff-column">
          <div class="diff-label">原文</div>
          <div class="diff-text original" ref="originalScrollRef" @scroll="onScrollOriginal" v-html="originalDiffHtml"></div>
        </div>
        <div class="diff-column">
          <div class="diff-label">修复后</div>
          <div class="diff-text fixed" ref="fixedScrollRef" @scroll="onScrollFixed" v-html="fixedDiffHtml"></div>
        </div>
      </div>
      
      <div v-else-if="viewMode === 'inline'" class="inline-diff-content">
        <div class="diff-legend">
          <span class="legend-item"><span class="legend-color removed"></span>删除</span>
          <span class="legend-item"><span class="legend-color added"></span>新增</span>
        </div>
        <div class="inline-diff-text" v-html="inlineDiffHtml"></div>
      </div>
      
      <div v-else class="result-content">
        <div class="result-text" v-html="resultHtml"></div>
      </div>
    </div>

    <div v-if="validationResult" class="validation-comparison">
      <div class="comparison-header">
        <span class="comparison-icon">📊</span>
        <span>验证结果</span>
      </div>
      <div class="comparison-content">
        <div class="comparison-item">
          <span class="item-label">问题状态:</span>
          <span :class="['item-value', validationResult.resolved ? 'resolved' : 'unresolved']">
            {{ validationResult.resolved ? '✅ 已解决' : '⚠️ 未解决' }}
          </span>
        </div>
        <div v-if="validationResult.message" class="comparison-item">
          <span class="item-label">说明:</span>
          <span class="item-value">{{ validationResult.message }}</span>
        </div>
      </div>
      
      <div v-if="!validationResult.resolved" class="continue-fix-section">
        <p class="continue-hint">问题可能未完全解决，您可以：</p>
        <div class="continue-actions">
          <button class="btn btn-outline" @click="emit('retryFix')">
            🔄 重新修复
          </button>
          <button class="btn btn-outline" @click="emit('customFix')">
            ✏️ 自定义指令修复
          </button>
        </div>
      </div>
    </div>

    <div v-if="!validationResult && !validating && !canUndo" class="quick-validate">
      <p class="validate-hint">💡 建议：先应用修复，完成所有问题修复后再统一验证</p>
    </div>
    
    <div v-if="validating" class="validating-hint">
      <span class="spinner-small"></span>
      <span>正在验证修复效果...</span>
    </div>

    <div class="result-actions">
      <div v-if="canUndo" class="undo-section">
        <span class="applied-hint">✅ 已应用修复</span>
        <div class="undo-hint">
          <span class="countdown">{{ undoCountdown }}s</span>
          <button class="btn btn-warning" @click="emit('undo')">撤销修复</button>
        </div>
        <button class="btn btn-secondary" @click="emit('confirm')">确定</button>
      </div>
      <template v-else>
        <button class="btn btn-secondary" @click="emit('discard')">放弃</button>
        <button class="btn btn-primary" :disabled="applying" @click="emit('apply')">
          {{ applying ? '应用中...' : '应用修复' }}
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';

interface ValidationResult {
  resolved: boolean;
  message?: string;
  scoreBefore?: number;
  scoreAfter?: number;
  remainingIssues?: number;
}

const props = defineProps<{
  originalContent: string;
  fixedContent: string;
  wordCountDiff: number;
  canUndo: boolean;
  undoCountdown: number;
  applying: boolean;
  validationResult?: ValidationResult;
  validating?: boolean;
}>();

const emit = defineEmits<{
  (e: 'apply'): void;
  (e: 'discard'): void;
  (e: 'undo'): void;
  (e: 'confirm'): void;
  (e: 'quickValidate'): void;
  (e: 'retryFix'): void;
  (e: 'customFix'): void;
}>();

const viewMode = ref<'diff' | 'inline' | 'result'>('diff');

const originalScrollRef = ref<HTMLElement | null>(null);
const fixedScrollRef = ref<HTMLElement | null>(null);
let isSyncingScroll = false;

function syncScroll(src: HTMLElement | null, dst: HTMLElement | null) {
  if (isSyncingScroll) return;
  isSyncingScroll = true;
  if (src && dst) {
    const ratio = src.scrollTop / (src.scrollHeight - src.clientHeight || 1);
    dst.scrollTop = ratio * (dst.scrollHeight - dst.clientHeight || 1);
  }
  requestAnimationFrame(() => { isSyncingScroll = false; });
}

function onScrollOriginal() { syncScroll(originalScrollRef.value, fixedScrollRef.value); }
function onScrollFixed() { syncScroll(fixedScrollRef.value, originalScrollRef.value); }

const lineDiffOps = computed(() => {
  if (!props.originalContent || !props.fixedContent) return [];
  if (props.originalContent === props.fixedContent) return [];
  return computeLineDiff(props.originalContent, props.fixedContent);
});

const currentDiffIdx = ref(-1);

const diffCount = computed(() => {
  return lineDiffOps.value.filter(op => op.type !== 'keep').length;
});

function goToDiff(direction: number) {
  const container = viewMode.value === 'diff'
    ? originalScrollRef.value
    : document.querySelector('.inline-diff-text') as HTMLElement;
  if (!container) return;

  const selector = '.diff-line-highlight, .diff-line-modified, .diff-line.removed, .diff-line.added, .diff-line.modified';
  const marks = container.querySelectorAll(selector);
  if (marks.length === 0) return;

  let next = currentDiffIdx.value + direction;
  if (next < 0) next = marks.length - 1;
  if (next >= marks.length) next = 0;
  currentDiffIdx.value = next;

  const el = marks[next] as HTMLElement;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

watch([viewMode, () => props.fixedContent], () => {
  currentDiffIdx.value = -1;
  nextTick(() => {
    setTimeout(() => goToDiff(1), 100);
  });
});

const wordCountClass = computed(() => {
  if (props.wordCountDiff > 0) return 'increase';
  if (props.wordCountDiff < 0) return 'decrease';
  return 'neutral';
});

const originalDiffHtml = computed(() => {
  if (!props.originalContent) return '<span class="no-content">无内容</span>';
  if (props.originalContent === props.fixedContent) {
    return escapeHtml(props.originalContent).replace(/\n/g, '<br>');
  }
  return lineDiffOps.value.map(op => {
    switch (op.type) {
      case 'keep':
        return `<div class="diff-line-normal">${escapeHtml(op.origLine!) || '&nbsp;'}</div>`;
      case 'modify':
        return `<div class="diff-line-modified">${highlightSideWords(op.origLine!, op.fixedLine!, 'remove')}</div>`;
      case 'remove':
        return `<div class="diff-line-highlight removed">${escapeHtml(op.origLine!) || '&nbsp;'}</div>`;
      case 'add':
        return `<div class="diff-line-spacer">&nbsp;</div>`;
    }
  }).join('');
});

const fixedDiffHtml = computed(() => {
  if (!props.fixedContent) return '<span class="no-content">无内容</span>';
  if (props.originalContent === props.fixedContent) {
    return escapeHtml(props.fixedContent).replace(/\n/g, '<br>');
  }
  return lineDiffOps.value.map(op => {
    switch (op.type) {
      case 'keep':
        return `<div class="diff-line-normal">${escapeHtml(op.fixedLine!) || '&nbsp;'}</div>`;
      case 'modify':
        return `<div class="diff-line-modified">${highlightSideWords(op.origLine!, op.fixedLine!, 'add')}</div>`;
      case 'add':
        return `<div class="diff-line-highlight added">${escapeHtml(op.fixedLine!) || '&nbsp;'}</div>`;
      case 'remove':
        return `<div class="diff-line-spacer">&nbsp;</div>`;
    }
  }).join('');
});

const resultHtml = computed(() => {
  if (!props.fixedContent) return '<div class="result-line">无内容</div>';
  if (props.originalContent === props.fixedContent) {
    return props.fixedContent.split('\n')
      .map(line => `<div class="result-line">${escapeHtml(line) || '&nbsp;'}</div>`)
      .join('');
  }
  return lineDiffOps.value
    .filter(op => op.type !== 'remove')
    .map(op => {
      const line = op.fixedLine ?? '';
      const cls = op.type === 'keep' ? 'result-line' : 'result-line changed';
      return `<div class="${cls}">${escapeHtml(line) || '&nbsp;'}</div>`;
    }).join('');
});

function lcsBacktrack(a: string, b: string): Array<{ type: 'keep' | 'remove' | 'add'; char: string }> {
  const m = a.length, n = b.length;
  // 性能保护：超长行降级为整行替换，避免 O(m*n) 卡顿
  if (m * n > 250000) {
    const ops: Array<{ type: 'keep' | 'remove' | 'add'; char: string }> = [];
    for (const c of a) ops.push({ type: 'remove', char: c });
    for (const c of b) ops.push({ type: 'add', char: c });
    return ops;
  }
  // 构建 DP 表
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }
  // 回溯
  const ops: Array<{ type: 'keep' | 'remove' | 'add'; char: string }> = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({ type: 'keep', char: a[i - 1]! });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      ops.push({ type: 'add', char: b[j - 1]! });
      j--;
    } else {
      ops.push({ type: 'remove', char: a[i - 1]! });
      i--;
    }
  }
  return ops.reverse();
}

function highlightSideWords(original: string, modified: string, side: 'remove' | 'add'): string {
  const ops = lcsBacktrack(original, modified);
  const cls = side === 'remove' ? 'word-removed' : 'word-added';
  let html = '';
  let buf = '';
  for (const op of ops) {
    if (op.type === side) {
      buf += op.char;
    } else {
      if (buf) {
        html += `<span class="${cls}">${escapeHtml(buf)}</span>`;
        buf = '';
      }
      if (op.type === 'keep') html += escapeHtml(op.char);
    }
  }
  if (buf) html += `<span class="${cls}">${escapeHtml(buf)}</span>`;
  return html;
}

const inlineDiffHtml = computed(() => {
  if (!props.originalContent || !props.fixedContent) {
    return '<div class="diff-line unchanged">无内容</div>';
  }
  if (props.originalContent === props.fixedContent) {
    return '<div class="diff-line unchanged" style="color: var(--text-tertiary);">内容无变化</div>';
  }

  const result: string[] = [];
  for (const op of lineDiffOps.value) {
    switch (op.type) {
      case 'keep':
        result.push(`<div class="diff-line unchanged"><span class="diff-prefix"> </span>${escapeHtml(op.origLine ?? '')}</div>`);
        break;
      case 'modify':
        result.push(`<div class="diff-line modified"><span class="diff-prefix">~</span>${highlightWordDiff(op.origLine ?? '', op.fixedLine ?? '')}</div>`);
        break;
      case 'remove':
        result.push(`<div class="diff-line removed"><span class="diff-prefix">-</span>${escapeHtml(op.origLine ?? '')}</div>`);
        break;
      case 'add':
        result.push(`<div class="diff-line added"><span class="diff-prefix">+</span>${escapeHtml(op.fixedLine ?? '')}</div>`);
        break;
    }
  }
  return result.join('') || '<div class="diff-line unchanged">无差异</div>';
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function calculateLineSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const cleanA = a.trim();
  const cleanB = b.trim();
  if (cleanA === cleanB) return 0.95;

  const maxLen = Math.max(cleanA.length, cleanB.length);
  if (maxLen === 0) return 1;

  const lcs = lcsLength(cleanA, cleanB);
  return lcs / maxLen;
}

function lcsLength(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0 || n === 0) return 0;

  let prev = new Array(n + 1).fill(0);
  let curr = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }
  return prev[n];
}

function findBestMatch(target: string, lines: string[], startIdx: number, maxLookAhead: number): number {
  const cleanTarget = target.trim();
  let bestMatch = -1;
  let bestSimilarity = 0.7; // 最低相似度阈值
  
  for (let i = startIdx; i < Math.min(startIdx + maxLookAhead, lines.length); i++) {
    const similarity = calculateLineSimilarity(cleanTarget, lines[i] ?? '');
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = i;
    }
  }
  
  return bestMatch;
}

interface DiffOp {
  type: 'keep' | 'remove' | 'add' | 'modify';
  origLine?: string;
  fixedLine?: string;
}

function computeLineDiff(original: string, fixed: string): DiffOp[] {
  const origLines = original.split('\n');
  const fixedLines = fixed.split('\n');
  const ops: DiffOp[] = [];

  let i = 0, j = 0;
  while (i < origLines.length || j < fixedLines.length) {
    if (i >= origLines.length) {
      ops.push({ type: 'add', fixedLine: fixedLines[j] });
      j++;
    } else if (j >= fixedLines.length) {
      ops.push({ type: 'remove', origLine: origLines[i] });
      i++;
    } else if (origLines[i] === fixedLines[j]) {
      ops.push({ type: 'keep', origLine: origLines[i], fixedLine: fixedLines[j] });
      i++; j++;
    } else {
      const sim = calculateLineSimilarity(origLines[i]!, fixedLines[j]!);
      if (sim > 0.3) {
        ops.push({ type: 'modify', origLine: origLines[i], fixedLine: fixedLines[j] });
        i++; j++;
      } else {
        const matchInFixed = findBestMatch(origLines[i]!, fixedLines, j, 5);
        const matchInOrig = findBestMatch(fixedLines[j]!, origLines, i, 5);
        if (matchInFixed !== -1 && (matchInOrig === -1 || matchInFixed - j < matchInOrig - i)) {
          ops.push({ type: 'add', fixedLine: fixedLines[j] });
          j++;
        } else if (matchInOrig !== -1) {
          ops.push({ type: 'remove', origLine: origLines[i] });
          i++;
        } else {
          ops.push({ type: 'remove', origLine: origLines[i] });
          ops.push({ type: 'add', fixedLine: fixedLines[j] });
          i++; j++;
        }
      }
    }
  }
  return ops;
}

function highlightWordDiff(original: string, modified: string): string {
  const ops = lcsBacktrack(original, modified);
  let html = '';
  let removedBuf = '';
  let addedBuf = '';

  function flushBuffers() {
    if (removedBuf) {
      html += `<span class="inline-removed">${escapeHtml(removedBuf)}</span>`;
      removedBuf = '';
    }
    if (addedBuf) {
      html += `<span class="inline-added">${escapeHtml(addedBuf)}</span>`;
      addedBuf = '';
    }
  }

  for (const op of ops) {
    if (op.type === 'keep') {
      flushBuffers();
      html += escapeHtml(op.char);
    } else if (op.type === 'remove') {
      if (addedBuf) { flushBuffers(); }
      removedBuf += op.char;
    } else {
      addedBuf += op.char;
    }
  }
  flushBuffers();
  return html;
}

</script>

<style scoped>
.fix-result-preview {
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  overflow: hidden;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-elevated);
}

.result-header h4 {
  margin: 0;
  font-size: var(--text-md);
  color: var(--text-primary);
}

.word-count-change span {
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.word-count-change .increase {
  background: var(--success-muted);
  color: var(--success);
}

.word-count-change .decrease {
  background: var(--error-muted);
  color: var(--error);
}

.word-count-change .neutral {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.diff-viewer {
  padding: var(--space-4);
}

.diff-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.tab {
  padding: 8px 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  cursor: pointer;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.tab:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

.tab.active {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--text-on-primary);
}

.diff-nav {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.diff-count {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  white-space: nowrap;
}

.nav-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  font-size: 12px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  padding: 0;
}

.nav-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.diff-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.diff-column {
  display: flex;
  flex-direction: column;
}

.diff-label {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.diff-text {
  flex: 1;
  margin: 0;
  padding: 12px;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  max-height: 500px;
  overflow-y: auto;
}

.diff-text.original,
.diff-text.fixed {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
}

.diff-line-spacer {
  padding: 2px 0;
  background: var(--bg-hover);
  opacity: 0.4;
  min-height: 1.6em;
}

.diff-line-normal,
.diff-line-modified {
  padding: 2px 0;
}

.diff-line-highlight {
  padding: 2px 4px;
  margin: 1px 0;
  border-radius: 2px;
}

.diff-line-highlight.removed {
  background: var(--error-muted);
  text-decoration: line-through;
  color: var(--error);
}

.diff-line-highlight.added {
  background: var(--success-muted);
  color: var(--success);
}

.word-removed {
  background: rgba(239, 68, 68, 0.3);
  color: var(--error);
  text-decoration: line-through;
  padding: 0 2px;
  border-radius: 2px;
}

.word-added {
  background: rgba(34, 197, 94, 0.3);
  color: var(--success);
  padding: 0 2px;
  border-radius: 2px;
  font-weight: var(--font-medium);
}

.no-content {
  color: var(--text-tertiary);
  font-style: italic;
}

.inline-diff-content {
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  overflow: hidden;
}

.diff-legend {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-hover);
  border-bottom: 1px solid var(--border-default);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.legend-color.removed {
  background: var(--error-muted);
  border: 1px solid var(--error);
}

.legend-color.added {
  background: var(--success-muted);
  border: 1px solid var(--success);
}

.inline-diff-text {
  padding: var(--space-3);
  max-height: 500px;
  overflow-y: auto;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  line-height: 1.6;
}

.diff-line {
  padding: 2px 8px;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--font-mono);
  display: flex;
  align-items: flex-start;
}

.diff-prefix {
  display: inline-block;
  width: 20px;
  flex-shrink: 0;
  font-weight: var(--font-medium);
  margin-right: 8px;
}

.diff-line.unchanged {
  color: var(--text-secondary);
}

.diff-line.unchanged .diff-prefix {
  color: var(--text-muted);
}

.diff-line.removed {
  background: var(--error-muted);
  color: var(--error);
}

.diff-line.removed .diff-prefix {
  color: var(--error);
}

.diff-line.added {
  background: var(--success-muted);
  color: var(--success);
}

.diff-line.added .diff-prefix {
  color: var(--success);
}

.diff-line.modified {
  background: var(--bg-hover);
  border-left: 3px solid var(--warning);
}

.diff-line.modified .diff-prefix {
  color: var(--warning);
}

.inline-removed {
  background: var(--error-border);
  color: var(--error);
  text-decoration: line-through;
  padding: 0 2px;
  border-radius: 2px;
}

.inline-added {
  background: var(--success-border);
  color: var(--success);
  padding: 0 2px;
  border-radius: 2px;
}

.result-text {
  margin: 0;
  padding: 12px;
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  line-height: 1.6;
  font-family: inherit;
  max-height: 500px;
  overflow-y: auto;
  color: var(--text-primary);
}

.result-line {
  padding: 1px 4px;
  white-space: pre-wrap;
  word-break: break-word;
}

.result-line.changed {
  background: rgba(59, 130, 246, 0.1);
  border-left: 3px solid var(--primary);
  padding-left: 8px;
}

.result-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-top: 1px solid var(--border-default);
  background: var(--bg-elevated);
}

.undo-section {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  justify-content: space-between;
}

.applied-hint {
  font-size: var(--text-sm);
  color: var(--success);
  font-weight: var(--font-medium);
}

.undo-hint {
  display: flex;
  align-items: center;
  gap: 12px;
}

.countdown {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--warning);
}

.btn {
  padding: 10px 20px;
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-secondary {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

.btn-primary {
  background: var(--primary);
  border: none;
  color: var(--text-on-primary);
}

.btn-primary:hover {
  background: var(--primary-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-warning {
  background: var(--warning);
  border: none;
  color: var(--text-on-primary);
}

.btn-warning:hover {
  opacity: 0.9;
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--primary);
  color: var(--primary);
}

.btn-outline:hover {
  background: var(--primary-muted);
}

.validation-comparison {
  margin: var(--space-4);
  padding: var(--space-4);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
}

.comparison-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: var(--font-medium);
  margin-bottom: 12px;
  color: var(--text-primary);
}

.comparison-icon {
  font-size: 16px;
}

.comparison-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.comparison-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: var(--text-base);
}

.item-label {
  color: var(--text-secondary);
  min-width: 80px;
}

.item-value {
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.item-value.resolved {
  color: var(--success);
}

.item-value.unresolved {
  color: var(--warning);
}

.continue-fix-section {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-default);
}

.continue-hint {
  margin: 0 0 12px;
  font-size: var(--text-base);
  color: var(--text-secondary);
}

.continue-actions {
  display: flex;
  gap: 12px;
}

.quick-validate {
  padding: 0 var(--space-4) var(--space-4);
}

.validate-hint {
  margin: 0;
  padding: var(--space-3);
  background: var(--info-muted);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--info);
}

.validating-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 var(--space-4) var(--space-4);
  font-size: var(--text-base);
  color: var(--text-secondary);
}

.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-default);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
