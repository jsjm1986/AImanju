<template>
  <div class="multi-episode-preview">
    <div class="episode-tabs-container">
      <div class="episode-tabs">
        <div
          v-for="result in results"
          :key="result.episodeNumber"
          class="episode-tab"
          :class="{
            active: activeEpisode === result.episodeNumber,
            excluded: isExcluded(result.episodeNumber),
          }"
          @click="activeEpisode = result.episodeNumber"
        >
          <span class="ep-number">第{{ result.episodeNumber }}集</span>
          <span class="ep-role">{{ getEpisodeRole(result.episodeNumber) }}</span>
        </div>
      </div>
      <div class="exclude-controls">
        <span
          v-for="result in results"
          :key="'exclude-' + result.episodeNumber"
          class="exclude-btn"
          :class="{ excluded: isExcluded(result.episodeNumber), active: activeEpisode === result.episodeNumber }"
          :title="isExcluded(result.episodeNumber) ? '包含第' + result.episodeNumber + '集' : '排除第' + result.episodeNumber + '集'"
          @click="toggleExclude(result.episodeNumber)"
        >
          {{ isExcluded(result.episodeNumber) ? '✓ 已排除' : '✕ 排除' }}
        </span>
      </div>
    </div>

    <div class="view-controls">
      <div class="view-toggle">
        <span
          class="toggle-btn"
          :class="{ active: viewMode === 'side-by-side' }"
          @click="viewMode = 'side-by-side'"
        >
          并排对比
        </span>
        <span
          class="toggle-btn"
          :class="{ active: viewMode === 'unified' }"
          @click="viewMode = 'unified'"
        >
          统一视图
        </span>
      </div>
      <div class="current-episode-info" v-if="activeResult">
        <span class="info-label">当前查看:</span>
        <span class="info-value">第{{ activeEpisode }}集 - {{ getEpisodeRole(activeEpisode) }}</span>
      </div>
    </div>

    <div class="preview-content">
      <div v-if="activeResult" class="diff-container" :class="viewMode">
        <template v-if="viewMode === 'side-by-side'">
          <div class="diff-panel original">
            <div class="panel-header">
              <span class="panel-icon">📄</span>
              <span class="panel-title">原文</span>
              <span class="word-count">{{ getWordCount(activeResult.original) }} 字</span>
            </div>
            <div class="panel-content" ref="originalPanel" @scroll="syncScroll('original')">
              <div class="content-wrapper">
                <template v-for="(line, idx) in diffLines" :key="'orig-' + idx">
                  <div 
                    class="diff-line" 
                    :class="{ 
                      removed: line.type === 'removed',
                      unchanged: line.type === 'unchanged',
                      placeholder: line.type === 'added'
                    }"
                  >
                    <span class="line-number">{{ line.type !== 'added' ? line.originalLineNum : '' }}</span>
                    <span class="line-content">{{ line.type !== 'added' ? line.original : '' }}</span>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <div class="diff-panel modified">
            <div class="panel-header">
              <span class="panel-icon">✨</span>
              <span class="panel-title">修改后</span>
              <span class="word-count">{{ getWordCount(activeResult.fixed) }} 字</span>
              <span class="word-diff" :class="wordDiffClass">
                {{ wordDiffText }}
              </span>
            </div>
            <div class="panel-content" ref="modifiedPanel" @scroll="syncScroll('modified')">
              <div class="content-wrapper">
                <template v-for="(line, idx) in diffLines" :key="'mod-' + idx">
                  <div 
                    class="diff-line" 
                    :class="{ 
                      added: line.type === 'added',
                      unchanged: line.type === 'unchanged',
                      placeholder: line.type === 'removed'
                    }"
                  >
                    <span class="line-number">{{ line.type !== 'removed' ? line.modifiedLineNum : '' }}</span>
                    <span class="line-content">{{ line.type !== 'removed' ? line.modified : '' }}</span>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="diff-unified">
            <div class="unified-header">
              <span class="panel-icon">📝</span>
              <span class="panel-title">差异对比</span>
              <div class="diff-legend">
                <span class="legend-item removed">
                  <span class="legend-marker">−</span> 删除
                </span>
                <span class="legend-item added">
                  <span class="legend-marker">+</span> 新增
                </span>
              </div>
            </div>
            <div class="unified-content">
              <template v-for="(line, idx) in diffLines" :key="'unified-' + idx">
                <div 
                  class="diff-line" 
                  :class="line.type"
                >
                  <span class="line-marker">
                    {{ line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' ' }}
                  </span>
                  <span class="line-content">{{ line.type === 'removed' ? line.original : line.modified || line.original }}</span>
                </div>
              </template>
            </div>
          </div>
        </template>
      </div>
    </div>

    <div class="preview-stats">
      <div class="stat-item">
        <span class="stat-icon">📊</span>
        <span class="stat-label">总计修改</span>
        <span class="stat-value">{{ results.length }} 集</span>
      </div>
      <div class="stat-item success">
        <span class="stat-icon">✓</span>
        <span class="stat-label">将应用</span>
        <span class="stat-value">{{ appliedCount }} 集</span>
      </div>
      <div v-if="excludedEpisodes.length > 0" class="stat-item warning">
        <span class="stat-icon">⚠</span>
        <span class="stat-label">已排除</span>
        <span class="stat-value">{{ excludedEpisodes.length }} 集</span>
      </div>
      <div class="stat-item diff-stats" v-if="activeResult">
        <span class="stat-added">+{{ diffStats.added }}</span>
        <span class="stat-removed">−{{ diffStats.removed }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { MultiEpisodeFixResult, AffectedEpisode } from '@/types/fix';

const props = defineProps<{
  results: MultiEpisodeFixResult[];
  affectedEpisodes: AffectedEpisode[];
  excludedEpisodes: number[];
}>();

const emit = defineEmits<{
  (e: 'update:excludedEpisodes', value: number[]): void;
}>();

const activeEpisode = ref<number>(props.results[0]?.episodeNumber || 0);
const viewMode = ref<'side-by-side' | 'unified'>('side-by-side');
const originalPanel = ref<HTMLElement | null>(null);
const modifiedPanel = ref<HTMLElement | null>(null);
let isScrolling = false;

watch(() => props.results, (newResults) => {
  if (newResults.length > 0 && !newResults.find(r => r.episodeNumber === activeEpisode.value)) {
    activeEpisode.value = newResults[0]?.episodeNumber ?? 0;
  }
}, { immediate: true });

const activeResult = computed(() =>
  props.results.find(r => r.episodeNumber === activeEpisode.value)
);

const appliedCount = computed(() =>
  props.results.length - props.excludedEpisodes.length
);

const wordDiff = computed(() => {
  if (!activeResult.value) return 0;
  return getWordCount(activeResult.value.fixed) - getWordCount(activeResult.value.original);
});

const wordDiffClass = computed(() =>
  wordDiff.value > 0 ? 'positive' : wordDiff.value < 0 ? 'negative' : ''
);

const wordDiffText = computed(() =>
  wordDiff.value > 0 ? `+${wordDiff.value}` : wordDiff.value < 0 ? `${wordDiff.value}` : '±0'
);

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  original: string;
  modified: string;
  originalLineNum: number;
  modifiedLineNum: number;
}

function makeDiffLine(
  type: DiffLine['type'],
  original: string,
  modified: string,
  originalLineNum: number,
  modifiedLineNum: number,
): DiffLine {
  return { type, original, modified, originalLineNum, modifiedLineNum };
}

const diffLines = computed<DiffLine[]>(() => {
  if (!activeResult.value) return [];

  const originalContent = activeResult.value.original || '';
  const fixedContent = activeResult.value.fixed || '';

  if (!fixedContent.trim()) {
    return originalContent.split('\n').map((line, idx) =>
      makeDiffLine('unchanged', line, line, idx + 1, idx + 1)
    );
  }

  const originalLines = originalContent.split('\n');
  const modifiedLines = fixedContent.split('\n');
  const lcs = computeLCS(originalLines, modifiedLines);
  const result: DiffLine[] = [];

  let origIdx = 0, modIdx = 0, lcsIdx = 0;
  let origLineNum = 1, modLineNum = 1;

  while (origIdx < originalLines.length || modIdx < modifiedLines.length) {
    if (lcsIdx < lcs.length && origIdx < originalLines.length && modIdx < modifiedLines.length) {
      if (originalLines[origIdx] === lcs[lcsIdx] && modifiedLines[modIdx] === lcs[lcsIdx]) {
        result.push(makeDiffLine('unchanged', originalLines[origIdx]!, modifiedLines[modIdx]!, origLineNum++, modLineNum++));
        origIdx++; modIdx++; lcsIdx++;
      } else if (originalLines[origIdx] !== lcs[lcsIdx]) {
        result.push(makeDiffLine('removed', originalLines[origIdx]!, '', origLineNum++, 0));
        origIdx++;
      } else {
        result.push(makeDiffLine('added', '', modifiedLines[modIdx]!, 0, modLineNum++));
        modIdx++;
      }
    } else if (origIdx < originalLines.length) {
      result.push(makeDiffLine('removed', originalLines[origIdx]!, '', origLineNum++, 0));
      origIdx++;
    } else if (modIdx < modifiedLines.length) {
      result.push(makeDiffLine('added', '', modifiedLines[modIdx]!, 0, modLineNum++));
      modIdx++;
    }
  }

  return result;
});

const diffStats = computed(() => {
  let added = 0, removed = 0;
  for (const line of diffLines.value) {
    if (line.type === 'added') added++;
    else if (line.type === 'removed') removed++;
  }
  return { added, removed };
});

function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length, n = b.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = a[i - 1] === b[j - 1]
        ? dp[i - 1]![j - 1]! + 1
        : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    }
  }

  const lcs: string[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]!);
      i--; j--;
    } else if (dp[i - 1]![j]! > dp[i]![j - 1]!) {
      i--;
    } else {
      j--;
    }
  }
  return lcs;
}

function syncScroll(source: 'original' | 'modified'): void {
  if (isScrolling) return;
  isScrolling = true;

  const sourcePanel = source === 'original' ? originalPanel.value : modifiedPanel.value;
  const targetPanel = source === 'original' ? modifiedPanel.value : originalPanel.value;

  if (sourcePanel && targetPanel) {
    targetPanel.scrollTop = sourcePanel.scrollTop;
  }
  setTimeout(() => { isScrolling = false; }, 50);
}

function getWordCount(text: string): number {
  return text.replace(/\s/g, '').length;
}

const ROLE_LABELS: Record<string, string> = {
  source: '源头',
  bridge: '铺垫',
  resolution: '回收',
};

function getEpisodeRole(episodeNumber: number): string {
  const ep = props.affectedEpisodes.find(e => e.episodeNumber === episodeNumber);
  return ep ? ROLE_LABELS[ep.role] ?? '' : '';
}

function isExcluded(episodeNumber: number): boolean {
  return props.excludedEpisodes.includes(episodeNumber);
}

function toggleExclude(episodeNumber: number): void {
  const newExcluded = isExcluded(episodeNumber)
    ? props.excludedEpisodes.filter(n => n !== episodeNumber)
    : [...props.excludedEpisodes, episodeNumber];
  emit('update:excludedEpisodes', newExcluded);
}
</script>

<style scoped>
.multi-episode-preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  height: 100%;
}

.episode-tabs-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.episode-tabs {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.episode-tab {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--bg-elevated);
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.episode-tab:hover {
  border-color: var(--border-hover);
  transform: translateY(-1px);
}

.episode-tab.active {
  border-color: var(--primary);
  background: var(--primary-muted);
  box-shadow: 0 2px 8px var(--primary-border);
}

.episode-tab.excluded {
  opacity: 0.5;
}

.episode-tab.excluded .ep-number {
  text-decoration: line-through;
}

.ep-number {
  font-weight: var(--font-semibold);
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.ep-role {
  font-size: var(--text-xs);
  padding: 2px var(--space-2);
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
}

.exclude-controls {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  padding-left: var(--space-1);
}

.exclude-btn {
  padding: var(--space-1) var(--space-2);
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  transition: all var(--transition-fast);
  display: none;
}

.exclude-btn.active {
  display: inline-flex;
}

.exclude-btn:hover {
  background: var(--error-muted);
  color: var(--error);
  border-color: var(--error);
}

.exclude-btn.excluded {
  background: var(--success-muted);
  color: var(--success);
  border-color: var(--success);
}

.view-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
}

.view-toggle {
  display: flex;
  background: var(--bg-surface);
  border-radius: var(--radius-sm);
  padding: 2px;
}

.toggle-btn {
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: none;
  font-size: var(--text-xs);
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.toggle-btn:hover {
  color: var(--text-primary);
}

.toggle-btn.active {
  background: var(--primary);
  color: var(--text-on-primary);
}

.current-episode-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
}

.info-label {
  color: var(--text-tertiary);
}

.info-value {
  color: var(--text-primary);
  font-weight: var(--font-medium);
}

.preview-content {
  flex: 1;
  min-height: 350px;
}

.diff-container {
  height: 100%;
}

.diff-container.side-by-side {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.diff-panel {
  display: flex;
  flex-direction: column;
  background: var(--bg-base);
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--border-default);
}

.panel-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-default);
}

.panel-icon {
  font-size: var(--text-lg);
}

.panel-title {
  font-weight: var(--font-semibold);
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.word-count {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin-left: auto;
}

.word-diff {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
}

.word-diff.positive {
  color: var(--success);
  background: var(--success-muted);
}

.word-diff.negative {
  color: var(--error);
  background: var(--error-muted);
}

.panel-content {
  flex: 1;
  overflow: auto;
  max-height: 380px;
}

.content-wrapper {
  min-height: 100%;
}

.diff-panel.original .panel-header {
  background: var(--error-muted);
}

.diff-panel.modified .panel-header {
  background: var(--success-muted);
}

.diff-line {
  display: flex;
  padding: 3px var(--space-3);
  min-height: 24px;
  font-size: var(--text-sm);
  line-height: 1.6;
  border-left: 3px solid transparent;
}

.diff-line.added {
  background: var(--success-muted);
  border-left-color: var(--success);
}

.diff-line.removed {
  background: var(--error-muted);
  border-left-color: var(--error);
}

.diff-line.placeholder {
  background: var(--bg-elevated);
  opacity: 0.5;
}

.line-number {
  flex-shrink: 0;
  width: 36px;
  text-align: right;
  padding-right: var(--space-3);
  color: var(--text-muted);
  font-size: var(--text-xs);
  user-select: none;
  font-family: var(--font-mono);
}

.line-marker {
  flex-shrink: 0;
  width: 24px;
  text-align: center;
  font-weight: var(--font-semibold);
  user-select: none;
}

.diff-line.added .line-marker {
  color: var(--success);
}

.diff-line.removed .line-marker {
  color: var(--error);
}

.line-content {
  flex: 1;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-primary);
}

.diff-unified {
  background: var(--bg-base);
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--border-default);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.unified-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-default);
}

.diff-legend {
  display: flex;
  gap: var(--space-4);
  margin-left: auto;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.legend-marker {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  font-weight: var(--font-semibold);
  font-size: var(--text-xs);
}

.legend-item.added .legend-marker {
  background: var(--success-muted);
  color: var(--success);
}

.legend-item.removed .legend-marker {
  background: var(--error-muted);
  color: var(--error);
}

.unified-content {
  flex: 1;
  overflow: auto;
  max-height: 380px;
}

.preview-stats {
  display: flex;
  gap: var(--space-5);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.stat-icon {
  font-size: var(--text-sm);
}

.stat-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.stat-value {
  font-weight: var(--font-semibold);
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.stat-item.success .stat-value {
  color: var(--success);
}

.stat-item.warning .stat-value {
  color: var(--warning);
}

.diff-stats {
  margin-left: auto;
  display: flex;
  gap: var(--space-3);
}

.stat-added {
  color: var(--success);
  font-weight: var(--font-semibold);
  font-size: var(--text-sm);
}

.stat-removed {
  color: var(--error);
  font-weight: var(--font-semibold);
  font-size: var(--text-sm);
}
</style>
