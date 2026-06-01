<template>
  <div class="plan-preview">
    <!-- 流式生成中状态 -->
    <div v-if="loading || isGenerating" class="generating-state">
      <div class="generating-header">
        <div class="loading-spinner"></div>
        <div class="generating-info">
          <span class="generating-title">{{ getStageTitle(stage) }}</span>
          <span class="generating-detail">{{ stageDetail }}</span>
        </div>
      </div>
      
      <!-- 流式输出内容 -->
      <div v-if="streamingContent" class="streaming-section">
        <div class="streaming-header">
          <span class="streaming-icon"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>
          <span>AI 正在分析...</span>
        </div>
        <div class="streaming-content">{{ streamingContent.slice(-800) }}</div>
      </div>
    </div>

    <!-- 计划预览 -->
    <template v-else-if="plan">
      <div class="plan-header">
        <h4>改写计划预览</h4>
        <div class="plan-meta">
          <span class="meta-item">📚 {{ plan.episodes.length }} 集</span>
          <span class="meta-item">📝 {{ plan.totalWordCount }} 字</span>
          <span class="meta-item">⏱️ 预计 {{ formatTime(plan.estimatedTime) }}</span>
        </div>
      </div>

      <div class="plan-instruction">
        <span class="label">改写指令：</span>
        <span class="value">{{ plan.instruction }}</span>
      </div>

      <div class="episodes-plan">
        <div v-for="ep in plan.episodes" :key="ep.episodeNumber" class="episode-plan-item">
          <div class="ep-header">
            <span class="ep-number">第 {{ ep.episodeNumber }} 集</span>
            <span class="ep-words">{{ ep.currentWordCount }} 字</span>
          </div>
          <div class="ep-changes">{{ ep.plannedChanges }}</div>
          <div v-if="ep.keyElements.length" class="ep-elements">
            <span class="elements-label">关键元素：</span>
            <span v-for="el in ep.keyElements" :key="el" class="element-tag">{{ el }}</span>
          </div>
        </div>
      </div>

      <div v-if="plan.coherencePoints.length" class="coherence-section">
        <h5>连贯性处理点</h5>
        <div v-for="(point, idx) in plan.coherencePoints" :key="idx" class="coherence-item">
          <span class="coherence-type">{{ getCoherenceTypeLabel(point.type) }}</span>
          <span class="coherence-desc">{{ point.description }}</span>
        </div>
      </div>

      <button class="regenerate-btn" @click="$emit('regenerate')">🔄 重新生成计划</button>
    </template>

    <div v-else class="empty-state">
      <span>点击"生成计划"按钮开始</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RewritePlan } from '@/types';

defineProps<{ 
  plan: RewritePlan | null; 
  loading: boolean;
  isGenerating?: boolean;
  stage?: string | null;
  stageDetail?: string;
  streamingContent?: string;
}>();
defineEmits<{ (e: 'regenerate'): void }>();

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}分${secs}秒` : `${mins}分钟`;
}

function getCoherenceTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    character_state: '角色状态',
    foreshadowing: '伏笔处理',
    plot_thread: '剧情线索',
    timeline: '时间线',
  };
  return labels[type] || type;
}

function getStageTitle(stage: string | null | undefined): string {
  const titles: Record<string, string> = {
    validating: '验证参数',
    loading: '加载剧集',
    context: '构建上下文',
    generating: 'AI 分析中',
    parsing: '解析结果',
    done: '完成',
  };
  return titles[stage || ''] || '正在生成改写计划...';
}
</script>

<style scoped>
.plan-preview { display: flex; flex-direction: column; gap: var(--space-4); }

/* 生成中状态 */
.generating-state { display: flex; flex-direction: column; gap: var(--space-4); }
.generating-header { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4); background: var(--primary-muted); border-radius: var(--radius-md); }
.loading-spinner { width: 32px; height: 32px; border: 3px solid var(--border-default); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; flex-shrink: 0; }
@keyframes spin { to { transform: rotate(360deg); } }
.generating-info { display: flex; flex-direction: column; gap: var(--space-1); }
.generating-title { font-size: var(--text-base); font-weight: var(--font-semibold); color: var(--text-primary); }
.generating-detail { font-size: var(--text-sm); color: var(--text-secondary); }

/* 流式输出 */
.streaming-section { background: var(--bg-elevated); border: 1px solid var(--border-default); border-radius: var(--radius-md); overflow: hidden; }
.streaming-header { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); background: var(--bg-surface); border-bottom: 1px solid var(--border-default); font-size: var(--text-sm); color: var(--text-secondary); }
.streaming-icon { display: flex; gap: 3px; }
.streaming-icon .dot { width: 6px; height: 6px; background: var(--primary); border-radius: 50%; animation: bounce 1.4s infinite ease-in-out both; }
.streaming-icon .dot:nth-child(1) { animation-delay: -0.32s; }
.streaming-icon .dot:nth-child(2) { animation-delay: -0.16s; }
@keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
.streaming-content { padding: var(--space-3); font-size: var(--text-sm); line-height: var(--leading-relaxed); color: var(--text-secondary); max-height: 200px; overflow-y: auto; white-space: pre-wrap; font-family: var(--font-mono, monospace); }

/* 计划预览 */
.plan-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-2); }
.plan-header h4 { margin: 0; font-size: var(--text-base); font-weight: var(--font-semibold); color: var(--text-primary); }
.plan-meta { display: flex; gap: var(--space-3); }
.meta-item { font-size: var(--text-sm); color: var(--text-secondary); }
.plan-instruction { padding: var(--space-3); background: var(--bg-elevated); border-radius: var(--radius-md); font-size: var(--text-sm); }
.plan-instruction .label { color: var(--text-tertiary); }
.plan-instruction .value { color: var(--text-primary); }
.episodes-plan { display: flex; flex-direction: column; gap: var(--space-2); max-height: 250px; overflow-y: auto; }
.episode-plan-item { padding: var(--space-3); background: var(--bg-elevated); border: 1px solid var(--border-default); border-radius: var(--radius-md); }
.ep-header { display: flex; justify-content: space-between; margin-bottom: var(--space-2); }
.ep-number { font-weight: var(--font-semibold); color: var(--text-primary); }
.ep-words { font-size: var(--text-sm); color: var(--text-tertiary); }
.ep-changes { font-size: var(--text-sm); color: var(--text-secondary); line-height: var(--leading-relaxed); }
.ep-elements { margin-top: var(--space-2); display: flex; align-items: center; gap: var(--space-1); flex-wrap: wrap; }
.elements-label { font-size: 12px; color: var(--text-tertiary); }
.element-tag { padding: 2px 6px; background: var(--primary-muted); border-radius: var(--radius-sm); font-size: 11px; color: var(--primary); }
.coherence-section { padding: var(--space-3); background: var(--bg-elevated); border-radius: var(--radius-md); }
.coherence-section h5 { margin: 0 0 var(--space-2); font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--text-primary); }
.coherence-item { display: flex; gap: var(--space-2); padding: var(--space-2) 0; border-bottom: 1px solid var(--border-default); font-size: var(--text-sm); }
.coherence-item:last-child { border-bottom: none; }
.coherence-type { padding: 2px 6px; background: var(--warning-muted, var(--warning-muted)); border-radius: var(--radius-sm); font-size: 11px; color: var(--warning, var(--warning)); white-space: nowrap; }
.coherence-desc { color: var(--text-secondary); }
.regenerate-btn { align-self: flex-start; padding: var(--space-2) var(--space-3); background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: var(--radius-md); font-size: var(--text-sm); color: var(--text-secondary); cursor: pointer; }
.regenerate-btn:hover { background: var(--bg-hover); }
.empty-state { display: flex; align-items: center; justify-content: center; padding: var(--space-8); color: var(--text-tertiary); }
</style>
