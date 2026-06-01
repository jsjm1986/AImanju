<template>
  <div class="batch-review">
    <div class="review-header">
      <h4>审核改写结果</h4>
      <div class="review-stats">
        <span class="stat success">✓ {{ completedCount }} 成功</span>
        <span v-if="failedCount > 0" class="stat failed">✗ {{ failedCount }} 失败</span>
      </div>
    </div>

    <div v-if="result?.coherenceReport" class="coherence-report">
      <div class="report-header">
        <span class="report-title">连贯性报告</span>
        <span class="report-score" :class="getScoreClass(result.coherenceReport.overallScore)">
          {{ result.coherenceReport.overallScore }}分
        </span>
      </div>
      <div class="report-checks">
        <span class="check-item" :class="{ pass: result.coherenceReport.characterConsistency }">
          {{ result.coherenceReport.characterConsistency ? '✓' : '✗' }} 角色一致性
        </span>
        <span class="check-item" :class="{ pass: result.coherenceReport.foreshadowingHandled }">
          {{ result.coherenceReport.foreshadowingHandled ? '✓' : '✗' }} 伏笔处理
        </span>
        <span class="check-item" :class="{ pass: result.coherenceReport.timelineConsistent }">
          {{ result.coherenceReport.timelineConsistent ? '✓' : '✗' }} 时间线一致
        </span>
      </div>
      <div v-if="result.coherenceReport.issues.length" class="report-issues">
        <div v-for="(issue, idx) in result.coherenceReport.issues" :key="idx" class="issue-item" :class="issue.severity">
          <span class="issue-badge">{{ issue.severity === 'error' ? '错误' : '警告' }}</span>
          <span class="issue-desc">第{{ issue.episode }}集: {{ issue.description }}</span>
        </div>
      </div>
    </div>

    <div class="episodes-review">
      <div v-for="ep in episodeResults" :key="ep.episodeNumber" class="episode-review-item">
        <div class="ep-header">
          <label class="ep-checkbox">
            <input type="checkbox" v-model="selectedEpisodes" :value="ep.episodeNumber" :disabled="ep.status !== 'completed'" />
            <span class="ep-number">第 {{ ep.episodeNumber }} 集</span>
          </label>
          <span class="ep-status" :class="ep.status">{{ getStatusText(ep.status) }}</span>
        </div>
        <div v-if="ep.status === 'completed'" class="ep-preview">
          <div class="preview-toggle" @click="togglePreview(ep.episodeNumber)">
            {{ expandedEpisodes.includes(ep.episodeNumber) ? '收起' : '展开' }}预览
          </div>
          <div v-if="expandedEpisodes.includes(ep.episodeNumber)" class="preview-content">
            {{ ep.rewrittenContent.slice(0, 500) }}{{ ep.rewrittenContent.length > 500 ? '...' : '' }}
          </div>
        </div>
        <div v-if="ep.error" class="ep-error">{{ ep.error }}</div>
      </div>
    </div>

    <div class="review-actions">
      <button class="btn-secondary" @click="$emit('rollback')">放弃全部</button>
      <button class="btn-primary" @click="handleApplySelected" :disabled="selectedEpisodes.length === 0">
        应用选中 ({{ selectedEpisodes.length }})
      </button>
      <button class="btn-success" @click="$emit('apply')">应用全部</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { BatchRewriteResult, EpisodeRewriteResult } from '@/types';

const props = defineProps<{
  result: BatchRewriteResult | null;
  episodeResults: EpisodeRewriteResult[];
}>();

const emit = defineEmits<{
  (e: 'apply'): void;
  (e: 'apply-selected', episodes: number[]): void;
  (e: 'rollback'): void;
}>();

const selectedEpisodes = ref<number[]>([]);
const expandedEpisodes = ref<number[]>([]);

const completedCount = computed(() => props.episodeResults.filter(r => r.status === 'completed').length);
const failedCount = computed(() => props.episodeResults.filter(r => r.status === 'failed').length);

function getStatusText(status: string): string {
  const texts: Record<string, string> = { pending: '等待', in_progress: '进行中', completed: '成功', failed: '失败' };
  return texts[status] || status;
}

function getScoreClass(score: number): string {
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
}

function togglePreview(episodeNumber: number) {
  const idx = expandedEpisodes.value.indexOf(episodeNumber);
  if (idx >= 0) expandedEpisodes.value.splice(idx, 1);
  else expandedEpisodes.value.push(episodeNumber);
}

function handleApplySelected() {
  if (selectedEpisodes.value.length > 0) {
    emit('apply-selected', selectedEpisodes.value);
  }
}
</script>

<style scoped>
.batch-review { display: flex; flex-direction: column; gap: var(--space-4); }
.review-header { display: flex; justify-content: space-between; align-items: center; }
.review-header h4 { margin: 0; font-size: var(--text-base); font-weight: var(--font-semibold); color: var(--text-primary); }
.review-stats { display: flex; gap: var(--space-3); }
.stat { font-size: var(--text-sm); padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); }
.stat.success { background: var(--success-muted); color: var(--success); }
.stat.failed { background: var(--error-muted); color: var(--error); }
.coherence-report { padding: var(--space-3); background: var(--bg-elevated); border-radius: var(--radius-md); }
.report-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2); }
.report-title { font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--text-primary); }
.report-score { padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); font-size: var(--text-sm); font-weight: var(--font-semibold); }
.report-score.high { background: var(--success-muted); color: var(--success); }
.report-score.medium { background: var(--warning-muted, var(--warning-muted)); color: var(--warning, var(--warning)); }
.report-score.low { background: var(--error-muted); color: var(--error); }
.report-checks { display: flex; gap: var(--space-3); margin-bottom: var(--space-2); }
.check-item { font-size: var(--text-sm); color: var(--error); }
.check-item.pass { color: var(--success); }
.report-issues { display: flex; flex-direction: column; gap: var(--space-1); }
.issue-item { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); }
.issue-badge { padding: 1px 4px; border-radius: var(--radius-sm); font-size: 10px; }
.issue-item.error .issue-badge { background: var(--error); color: var(--text-on-primary); }
.issue-item.warning .issue-badge { background: var(--warning, var(--warning)); color: var(--text-on-primary); }
.issue-desc { color: var(--text-secondary); }
.episodes-review { display: flex; flex-direction: column; gap: var(--space-2); max-height: 300px; overflow-y: auto; }
.episode-review-item { padding: var(--space-3); background: var(--bg-elevated); border: 1px solid var(--border-default); border-radius: var(--radius-md); }
.ep-header { display: flex; justify-content: space-between; align-items: center; }
.ep-checkbox { display: flex; align-items: center; gap: var(--space-2); cursor: pointer; }
.ep-checkbox input { cursor: pointer; }
.ep-number { font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--text-primary); }
.ep-status { font-size: 12px; padding: 2px 6px; border-radius: var(--radius-sm); }
.ep-status.completed { background: var(--success-muted); color: var(--success); }
.ep-status.failed { background: var(--error-muted); color: var(--error); }
.ep-preview { margin-top: var(--space-2); }
.preview-toggle { font-size: 12px; color: var(--primary); cursor: pointer; }
.preview-toggle:hover { text-decoration: underline; }
.preview-content { margin-top: var(--space-2); padding: var(--space-2); background: var(--bg-surface); border-radius: var(--radius-sm); font-size: var(--text-sm); color: var(--text-secondary); line-height: var(--leading-relaxed); white-space: pre-wrap; }
.ep-error { margin-top: var(--space-2); font-size: 12px; color: var(--error); }
.review-actions { display: flex; justify-content: flex-end; gap: var(--space-2); }
.btn-primary, .btn-success, .btn-secondary { padding: var(--space-2) var(--space-4); border: none; border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: var(--font-medium); cursor: pointer; transition: all var(--duration-fast); }
.btn-primary { background: var(--primary); color: var(--text-on-primary); }
.btn-primary:hover:not(:disabled) { background: var(--primary-hover); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-success { background: var(--success); color: var(--text-on-primary); }
.btn-success:hover { background: var(--success); }
.btn-secondary { background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border-default); }
.btn-secondary:hover { background: var(--bg-hover); }
</style>
