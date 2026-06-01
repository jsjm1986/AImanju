<template>
  <div class="batch-progress">
    <div class="progress-header">
      <h4>批量改写进度</h4>
      <div class="progress-stats">
        <span class="stat-item">{{ currentEpisode }} / {{ totalEpisodes }}</span>
        <span class="stat-percent">{{ progress }}%</span>
      </div>
    </div>

    <div class="progress-bar-container">
      <div class="progress-bar" :style="{ width: `${progress}%` }"></div>
    </div>

    <div class="status-indicator" :class="status">
      <span class="status-icon">{{ getStatusIcon(status) }}</span>
      <span class="status-text">{{ getStatusText(status) }}</span>
    </div>

    <!-- 准备阶段 -->
    <div v-if="executionStage === 'preparing'" class="preparing-info">
      <div class="preparing-header">
        <span class="streaming-dots"><span></span><span></span><span></span></span>
        <span>{{ executionMessage || '正在准备改写上下文...' }}</span>
      </div>
      <div class="preparing-detail">
        <p>正在加载角色状态、伏笔信息和剧情上下文，请稍候...</p>
      </div>
    </div>

    <!-- 当前正在改写的集数 -->
    <div v-else-if="currentEpisode > 0 && status === 'in_progress'" class="current-episode-info">
      <div class="current-header">
        <span class="streaming-dots"><span></span><span></span><span></span></span>
        <span>{{ executionMessage || `正在改写第 ${currentEpisode} 集...` }}</span>
      </div>
      <div v-if="streamingContent[currentEpisode]" class="streaming-preview">
        <div class="streaming-content">{{ getPreviewContent(currentEpisode) }}</div>
        <div class="streaming-stats">
          <span>已生成 {{ getWordCount(currentEpisode) }} 字</span>
        </div>
      </div>
      <div v-else class="waiting-content">
        <span>等待 AI 响应中...</span>
      </div>
    </div>

    <!-- 已完成的集数列表 -->
    <div class="episodes-progress">
      <div v-for="result in episodeResults" :key="result.episodeNumber" class="episode-progress-item" :class="result.status">
        <div class="ep-status-icon">{{ getEpisodeStatusIcon(result.status) }}</div>
        <div class="ep-info">
          <span class="ep-number">第 {{ result.episodeNumber }} 集</span>
          <span v-if="result.status === 'completed'" class="ep-change">
            {{ result.wordCountChange >= 0 ? '+' : '' }}{{ result.wordCountChange }} 字
          </span>
          <span v-if="result.error" class="ep-error">{{ result.error }}</span>
        </div>
        <div v-if="result.status === 'completed'" class="ep-check">✓</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { BatchRewriteStatus, EpisodeRewriteResult } from '@/types';
import type { ExecutionStage } from '@/stores/batchRewriteStore';

const props = defineProps<{
  status: BatchRewriteStatus;
  currentEpisode: number;
  totalEpisodes: number;
  progress: number;
  streamingContent: Record<number, string>;
  episodeResults: EpisodeRewriteResult[];
  executionStage?: ExecutionStage | null;
  executionMessage?: string;
}>();

function getStatusIcon(status: BatchRewriteStatus): string {
  const icons: Record<string, string> = { pending: '⏳', in_progress: '🔄', completed: '✅', failed: '❌', partial: '⚠️' };
  return icons[status] || '⏳';
}

function getStatusText(status: BatchRewriteStatus): string {
  const texts: Record<string, string> = { pending: '等待开始', in_progress: '改写中...', completed: '改写完成', failed: '改写失败', partial: '部分完成' };
  return texts[status] || '未知状态';
}

function getEpisodeStatusIcon(status: string): string {
  const icons: Record<string, string> = { pending: '○', in_progress: '◐', completed: '●', failed: '✗' };
  return icons[status] || '○';
}

function getPreviewContent(episodeNumber: number): string {
  const content = props.streamingContent[episodeNumber] || '';
  // 显示最后500个字符
  return content.length > 500 ? '...' + content.slice(-500) : content;
}

function getWordCount(episodeNumber: number): number {
  const content = props.streamingContent[episodeNumber] || '';
  return content.replace(/\s/g, '').length;
}
</script>

<style scoped>
.batch-progress { display: flex; flex-direction: column; gap: var(--space-4); }
.progress-header { display: flex; justify-content: space-between; align-items: center; }
.progress-header h4 { margin: 0; font-size: var(--text-base); font-weight: var(--font-semibold); color: var(--text-primary); }
.progress-stats { display: flex; gap: var(--space-3); }
.stat-item { font-size: var(--text-sm); color: var(--text-secondary); }
.stat-percent { font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--primary); }
.progress-bar-container { height: 8px; background: var(--bg-elevated); border-radius: var(--radius-full); overflow: hidden; }
.progress-bar { height: 100%; background: var(--primary); border-radius: var(--radius-full); transition: width 0.3s ease; }
.status-indicator { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); background: var(--bg-elevated); border-radius: var(--radius-md); }
.status-indicator.in_progress { background: var(--primary-muted); }
.status-indicator.completed { background: var(--success-muted); }
.status-indicator.failed { background: var(--error-muted); }
.status-icon { font-size: 16px; }
.status-text { font-size: var(--text-sm); color: var(--text-primary); }

/* 准备阶段 */
.preparing-info {
  background: var(--bg-elevated);
  border: 1px solid var(--warning, var(--warning));
  border-radius: var(--radius-md);
  overflow: hidden;
}
.preparing-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--warning-muted);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--warning, var(--warning));
}
.preparing-detail {
  padding: var(--space-3);
}
.preparing-detail p {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

/* 当前改写集数信息 */
.current-episode-info {
  background: var(--bg-elevated);
  border: 1px solid var(--primary);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.current-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--primary-muted);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--primary);
}
.streaming-dots {
  display: flex;
  gap: 3px;
}
.streaming-dots span {
  width: 6px;
  height: 6px;
  background: currentColor;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}
.streaming-dots span:nth-child(1) { animation-delay: -0.32s; }
.streaming-dots span:nth-child(2) { animation-delay: -0.16s; }
@keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }

.streaming-preview {
  padding: var(--space-3);
}
.streaming-content {
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
  color: var(--text-secondary);
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  background: var(--bg-surface);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
}
.streaming-stats {
  margin-top: var(--space-2);
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: right;
}
.waiting-content {
  padding: var(--space-3);
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  text-align: center;
}

/* 已完成集数列表 */
.episodes-progress { display: flex; flex-direction: column; gap: var(--space-2); max-height: 200px; overflow-y: auto; }
.episode-progress-item { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); background: var(--bg-elevated); border-radius: var(--radius-md); }
.episode-progress-item.completed { background: var(--success-muted); }
.episode-progress-item.failed { background: var(--error-muted); }
.ep-status-icon { font-size: 14px; color: var(--text-tertiary); }
.episode-progress-item.completed .ep-status-icon { color: var(--success); }
.episode-progress-item.failed .ep-status-icon { color: var(--error); }
.ep-info { display: flex; align-items: center; gap: var(--space-2); flex: 1; }
.ep-number { font-size: var(--text-sm); color: var(--text-primary); }
.ep-change { font-size: 12px; color: var(--text-tertiary); }
.ep-error { font-size: 12px; color: var(--error); }
.ep-check { color: var(--success); font-weight: bold; }
</style>
