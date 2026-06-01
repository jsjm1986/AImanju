<template>
  <div class="diff-viewer" :class="{ collapsible }">
    <div class="diff-stats">
      <span class="stat added">
        <span class="stat-icon">+</span>
        <span class="stat-value">{{ stats.added }}</span>
        <span class="stat-label">新增</span>
      </span>
      <span class="stat removed">
        <span class="stat-icon">−</span>
        <span class="stat-value">{{ stats.removed }}</span>
        <span class="stat-label">删除</span>
      </span>
      <span class="stat unchanged">
        <span class="stat-value">{{ stats.unchanged }}</span>
        <span class="stat-label">未变</span>
      </span>
      <span class="stat word-count">
        <span class="stat-icon">📝</span>
        <span class="stat-value">{{ currentWordCount }} 字</span>
        <span
          class="stat-change"
          :class="{
            positive: wordCountChange > 0,
            negative: wordCountChange < 0,
            neutral: wordCountChange === 0
          }"
        >
          ({{ wordCountChange > 0 ? '+' : '' }}{{ wordCountChange }})
        </span>
      </span>
    </div>

    <div class="diff-controls">
      <div class="view-toggle">
        <button
          class="toggle-btn"
          :class="{ active: mode === 'unified' }"
          @click="mode = 'unified'"
        >
          统一视图
        </button>
        <button
          class="toggle-btn"
          :class="{ active: mode === 'side-by-side' }"
          @click="mode = 'side-by-side'"
        >
          并排视图
        </button>
      </div>
      <div class="controls-right">
        <label v-if="collapsible" class="collapse-toggle">
          <input type="checkbox" v-model="autoCollapse" />
          <span>折叠未修改</span>
        </label>
        <label class="line-numbers-toggle">
          <input type="checkbox" v-model="showLineNumbers" />
          <span>行号</span>
        </label>
      </div>
    </div>

    <div class="diff-content" :class="{ 'side-by-side': mode === 'side-by-side' }">
      <template v-if="mode === 'side-by-side'">
        <div class="diff-pane original">
          <div class="pane-header">
            <span class="pane-icon">📄</span>
            <span>原文</span>
          </div>
          <div class="pane-content">
            <div
              v-for="(block, index) in originalBlocks"
              :key="'orig-' + index"
              class="diff-line"
              :class="block.type"
            >
              <span v-if="showLineNumbers" class="line-number">{{ block.lineNumber || '' }}</span>
              <span class="line-content">{{ block.content }}</span>
            </div>
          </div>
        </div>
        <div class="diff-pane modified">
          <div class="pane-header">
            <span class="pane-icon">✨</span>
            <span>改写后</span>
          </div>
          <div class="pane-content">
            <div
              v-for="(block, index) in modifiedBlocks"
              :key="'mod-' + index"
              class="diff-line"
              :class="block.type"
            >
              <span v-if="showLineNumbers" class="line-number">{{ block.lineNumber || '' }}</span>
              <span class="line-content">{{ block.content }}</span>
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="diff-unified">
          <template v-for="(block, index) in processedBlocks" :key="index">
            <div
              v-if="block.collapsed"
              class="collapsed-block"
              @click="expandBlock(index)"
            >
              <span class="collapse-icon">▶</span>
              <span class="collapse-text">{{ block.collapsedLines }} 行未修改内容</span>
              <span class="collapse-hint">点击展开</span>
            </div>
            <div
              v-else
              class="diff-line"
              :class="block.type"
            >
              <span v-if="showLineNumbers" class="line-marker">
                {{ block.type === 'added' ? '+' : block.type === 'removed' ? '−' : ' ' }}
              </span>
              <span class="line-content">{{ block.content }}</span>
            </div>
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { DiffBlock } from '@/types';
import { WordCountService } from '@/utils/wordCount';

const props = withDefaults(defineProps<{
  diff: DiffBlock[];
  originalContent?: string;
  modifiedContent?: string;
  collapsible?: boolean;
}>(), {
  diff: () => [],
  collapsible: false,
});

const safeDiff = computed(() => Array.isArray(props.diff) ? props.diff : []);

const mode = ref<'unified' | 'side-by-side'>('unified');
const showLineNumbers = ref(true);
const autoCollapse = ref(true);
const expandedBlocks = ref(new Set<number>());

const COLLAPSE_THRESHOLD = 3;

interface ProcessedBlock {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  collapsed: boolean;
  collapsedLines?: number;
  originalIndex: number;
}

function splitLines(content: string, filterEmpty = false): string[] {
  const lines = content.split('\n');
  return filterEmpty ? lines.filter(l => l.length > 0) : lines;
}

const processedBlocks = computed<ProcessedBlock[]>(() => {
  if (!props.collapsible || !autoCollapse.value) {
    return safeDiff.value.map((block, index) => ({
      ...block,
      collapsed: false,
      originalIndex: index,
    }));
  }

  const result: ProcessedBlock[] = [];

  for (let i = 0; i < safeDiff.value.length; i++) {
    const block = safeDiff.value[i];
    if (!block) continue;

    if (block.type === 'unchanged') {
      const lines = splitLines(block.content, true);

      if (lines.length > COLLAPSE_THRESHOLD && !expandedBlocks.value.has(i)) {
        result.push({
          type: 'unchanged',
          content: block.content,
          collapsed: true,
          collapsedLines: lines.length,
          originalIndex: i,
        });
      } else {
        for (const line of lines) {
          result.push({ type: 'unchanged', content: line, collapsed: false, originalIndex: i });
        }
      }
    } else {
      for (const line of splitLines(block.content)) {
        result.push({ type: block.type, content: line, collapsed: false, originalIndex: i });
      }
    }
  }

  return result;
});

function expandBlock(processedIndex: number): void {
  const block = processedBlocks.value[processedIndex];
  if (block?.collapsed) {
    expandedBlocks.value.add(block.originalIndex);
  }
}

const stats = computed(() => {
  const counts = { added: 0, removed: 0, unchanged: 0 };
  for (const block of safeDiff.value) {
    const lines = block.content.split('\n').filter(l => l).length || 1;
    counts[block.type] += lines;
  }
  return counts;
});

const currentWordCount = computed(() => WordCountService.count(props.modifiedContent || ''));

const wordCountChange = computed(() => {
  return WordCountService.count(props.modifiedContent || '') - WordCountService.count(props.originalContent || '');
});

type LineBlock = { type: string; content: string; lineNumber: number };

function buildSideBlocks(excludeType: 'added' | 'removed'): LineBlock[] {
  const blocks: LineBlock[] = [];
  let lineNum = 1;

  for (const block of safeDiff.value) {
    const lines = splitLines(block.content);
    if (block.type !== excludeType) {
      for (const line of lines) {
        blocks.push({ type: block.type, content: line, lineNumber: lineNum++ });
      }
    } else {
      for (let i = 0; i < lines.length; i++) {
        blocks.push({ type: 'placeholder', content: '', lineNumber: 0 });
      }
    }
  }

  return blocks;
}

const originalBlocks = computed(() => buildSideBlocks('added'));
const modifiedBlocks = computed(() => buildSideBlocks('removed'));
</script>

<style scoped>
.diff-viewer {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-elevated);
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.diff-stats {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-default);
}

.stat {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
}

.stat-icon {
  width: 18px;
  height: 18px;
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
.stat.unchanged .stat-value { color: var(--text-tertiary); }

.stat.word-count .stat-icon {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.stat-change {
  font-size: 11px;
  margin-left: 2px;
  font-weight: var(--font-medium);
}

.stat-change.positive { color: var(--success); }
.stat-change.negative { color: var(--error); }
.stat-change.neutral { color: var(--text-tertiary); }

.diff-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-4);
  background: var(--bg-hover);
  border-bottom: 1px solid var(--border-default);
}

.view-toggle {
  display: flex;
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  padding: 2px;
}

.toggle-btn {
  padding: var(--space-1) var(--space-3);
  background: transparent;
  border: none;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-xs);
  transition: all var(--transition-fast);
}

.toggle-btn:hover {
  color: var(--text-primary);
}

.toggle-btn.active {
  background: var(--primary);
  color: var(--text-on-primary);
}

.line-numbers-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
}

.line-numbers-toggle input {
  cursor: pointer;
  accent-color: var(--primary);
}

.diff-content {
  flex: 1;
  min-height: 400px;
  overflow: auto;
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
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-default);
  font-size: 12px;
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
  font-family: 'SF Mono', Monaco, 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.6;
}

.diff-line {
  display: flex;
  padding: 2px var(--space-3);
  min-height: 22px;
}

.diff-line.added {
  background: var(--success-muted);
}

.diff-line.removed {
  background: var(--error-muted);
}

.diff-line.placeholder {
  background: var(--bg-hover);
}

.line-number,
.line-marker {
  flex-shrink: 0;
  width: 28px;
  text-align: right;
  padding-right: var(--space-2);
  color: var(--text-muted);
  user-select: none;
}

.line-marker {
  width: 20px;
  text-align: center;
  font-weight: var(--font-bold);
}

.diff-line.added .line-marker { color: var(--success); }
.diff-line.removed .line-marker { color: var(--error); }

.line-content {
  flex: 1;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-primary);
}

.controls-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.collapse-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
}

.collapse-toggle input {
  cursor: pointer;
  accent-color: var(--primary);
}

.collapsed-block {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-hover);
  border: 1px dashed var(--border-default);
  border-radius: var(--radius-sm);
  margin: var(--space-1) var(--space-2);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.collapsed-block:hover {
  background: var(--bg-elevated);
  border-color: var(--primary);
}

.collapse-icon {
  font-size: 10px;
  color: var(--text-tertiary);
  transition: transform var(--transition-fast);
}

.collapsed-block:hover .collapse-icon {
  color: var(--primary);
}

.collapse-text {
  font-size: 12px;
  color: var(--text-secondary);
}

.collapse-hint {
  font-size: 11px;
  color: var(--text-muted);
  margin-left: auto;
}

.collapsed-block:hover .collapse-hint {
  color: var(--primary);
}
</style>
