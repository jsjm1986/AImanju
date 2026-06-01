<template>
  <div class="episode-range-selector">
    <div class="selector-header">
      <h4>选择要改写的集数范围</h4>
      <p class="hint">点击选择起始集，再点击选择结束集</p>
    </div>
    <div class="range-display" v-if="selectedRange">
      <span class="range-label">已选择：</span>
      <span class="range-value">第 {{ selectedRange.start }} - {{ selectedRange.end }} 集</span>
      <button class="clear-btn" @click="clearSelection">清除</button>
    </div>
    <div class="episodes-grid">
      <div v-for="ep in episodes" :key="ep._id" class="episode-item"
        :class="{ 'in-range': isInRange(ep.episodeNumber), 'start-point': isStartPoint(ep.episodeNumber),
          'end-point': isEndPoint(ep.episodeNumber), disabled: !ep.content }"
        @click="handleEpisodeClick(ep)">
        <div class="episode-number">{{ ep.episodeNumber }}</div>
        <div class="episode-info">
          <span class="episode-title">{{ ep.title }}</span>
          <span class="episode-words">{{ getWordCount(ep) }} 字</span>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import type { Episode } from '@/types';
const props = defineProps<{ episodes: Episode[]; selectedRange: { start: number; end: number } | null }>();
const emit = defineEmits<{ (e: 'update:range', range: { start: number; end: number }): void }>();
const selectionState = ref<'start' | null>(null);
const tempStart = ref<number | null>(null);
function isInRange(n: number) { return props.selectedRange ? n >= props.selectedRange.start && n <= props.selectedRange.end : false; }
function isStartPoint(n: number) { return tempStart.value === n || props.selectedRange?.start === n; }
function isEndPoint(n: number) { return props.selectedRange?.end === n; }
function handleEpisodeClick(ep: Episode) {
  if (!ep.content) return;
  const n = ep.episodeNumber;
  if (!selectionState.value) { tempStart.value = n; selectionState.value = 'start'; emit('update:range', { start: n, end: n }); }
  else { const s = Math.min(tempStart.value!, n), e = Math.max(tempStart.value!, n); emit('update:range', { start: s, end: Math.min(e, s + 9) }); selectionState.value = null; tempStart.value = null; }
}
/**
 * 计算实际字数（去除空白字符）
 * 优先使用 content 动态计算，避免依赖可能过时的 wordCount 字段
 */
function getWordCount(ep: Episode): number {
  if (!ep.content) return 0;
  // 去除所有空白字符后计算长度（适合中文）
  return ep.content.replace(/\s/g, '').length;
}
function clearSelection() { selectionState.value = null; tempStart.value = null; emit('update:range', { start: 0, end: 0 }); }
</script>
<style scoped>
.episode-range-selector { display: flex; flex-direction: column; gap: var(--space-4); }
.selector-header { text-align: center; }
.selector-header h4 { margin: 0 0 var(--space-1) 0; font-size: var(--text-lg); font-weight: var(--font-semibold); color: var(--text-primary); }
.selector-header .hint { margin: 0; font-size: var(--text-sm); color: var(--text-tertiary); }
.range-display { display: flex; align-items: center; justify-content: center; gap: var(--space-2); padding: var(--space-3); background: var(--primary-muted); border-radius: var(--radius-md); border: 1px solid var(--primary); }
.range-label { font-size: var(--text-sm); color: var(--text-secondary); }
.range-value { font-size: var(--text-base); font-weight: var(--font-semibold); color: var(--primary); }
.clear-btn { margin-left: var(--space-2); padding: var(--space-1) var(--space-2); background: transparent; border: 1px solid var(--border-default); border-radius: var(--radius-sm); font-size: var(--text-xs); color: var(--text-secondary); cursor: pointer; }
.clear-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.episodes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: var(--space-2); max-height: 400px; overflow-y: auto; padding: var(--space-2); }
.episode-item { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); background: var(--bg-surface); border: 2px solid var(--border-default); border-radius: var(--radius-md); cursor: pointer; transition: all var(--duration-fast); }
.episode-item:hover:not(.disabled) { border-color: var(--primary); background: var(--bg-hover); }
.episode-item.in-range { background: var(--primary-muted); border-color: var(--primary); }
.episode-item.start-point, .episode-item.end-point { background: var(--primary); border-color: var(--primary); }
.episode-item.start-point .episode-number, .episode-item.end-point .episode-number, .episode-item.start-point .episode-title, .episode-item.end-point .episode-title { color: var(--text-on-primary); }
.episode-item.disabled { opacity: 0.4; cursor: not-allowed; }
.episode-number { width: 28px; height: 28px; border-radius: 50%; background: var(--bg-elevated); display: flex; align-items: center; justify-content: center; font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--text-secondary); flex-shrink: 0; }
.episode-info { display: flex; flex-direction: column; min-width: 0; }
.episode-title { font-size: var(--text-sm); color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.episode-words { font-size: 11px; color: var(--text-tertiary); }
</style>