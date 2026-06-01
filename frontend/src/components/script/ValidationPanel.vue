<template>
  <div class="validation-panel">
    <div class="panel-header">
      <h3>剧本验证</h3>
      <button
        class="validate-btn"
        @click="handleValidate"
        :disabled="validationStore.loading"
      >
        {{ validationStore.loading ? '验证中...' : '开始验证' }}
      </button>
    </div>

    <!-- 验证进度 -->
    <div v-if="validationStore.loading && validationStore.progress" class="progress-section">
      <div class="progress-info">
        <span>正在验证窗口 {{ validationStore.progress.current }}/{{ validationStore.progress.total }}</span>
        <span>{{ progressPercent }}%</span>
      </div>
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: progressPercent + '%' }"
        ></div>
      </div>
    </div>

    <!-- 验证结果摘要 -->
    <div v-if="validationStore.result" class="summary-section">
      <!-- 评分卡片 -->
      <div v-if="validationStore.result.report" class="score-card">
        <div class="score-value" :class="scoreClass">{{ validationStore.result.report.score }}</div>
        <div class="score-label">{{ validationStore.result.report.rating }}</div>
      </div>

      <div class="summary-cards">
        <div class="summary-card error">
          <span class="count">{{ validationStore.summary.errors }}</span>
          <span class="label">错误</span>
        </div>
        <div class="summary-card warning">
          <span class="count">{{ validationStore.summary.warnings }}</span>
          <span class="label">警告</span>
        </div>
        <div class="summary-card info">
          <span class="count">{{ validationStore.summary.info }}</span>
          <span class="label">提示</span>
        </div>
      </div>

      <div v-if="!validationStore.hasErrors && !validationStore.hasWarnings" class="success-message">
        验证通过，未发现问题
      </div>
    </div>

    <!-- 过滤器 -->
    <div v-if="validationStore.issues.length > 0" class="filter-section">
      <div class="filter-group">
        <label>按类型:</label>
        <select v-model="filterType">
          <option value="">全部</option>
          <option value="error">错误</option>
          <option value="warning">警告</option>
          <option value="info">提示</option>
        </select>
      </div>
      <div class="filter-group">
        <label>按集数:</label>
        <select v-model="filterEpisode">
          <option value="">全部</option>
          <option v-for="ep in episodeList" :key="ep" :value="ep">第 {{ ep }} 集</option>
        </select>
      </div>
      <div class="filter-group">
        <label>按类别:</label>
        <select v-model="filterCategory">
          <option value="">全部</option>
          <option v-for="cat in categoryList" :key="cat" :value="cat">{{ cat }}</option>
        </select>
      </div>
    </div>

    <!-- 问题列表 -->
    <div class="issues-section">
      <div v-if="filteredIssues.length === 0 && validationStore.result" class="empty-state">
        {{ validationStore.issues.length > 0 ? '没有符合筛选条件的问题' : '没有发现问题' }}
      </div>

      <div
        v-for="(issue, index) in filteredIssues"
        :key="index"
        class="issue-item"
        :class="issue.type"
      >
        <div class="issue-header">
          <span class="issue-badge" :class="issue.type">
            {{ issue.type === 'error' ? '错误' : issue.type === 'warning' ? '警告' : '提示' }}
          </span>
          <span v-if="issue.isGlobal" class="issue-global-badge">全局</span>
          <span class="issue-episode">第 {{ issue.episode }} 集</span>
          <span v-if="issue.windowRange && !issue.isGlobal" class="issue-window">窗口 {{ issue.windowRange }}</span>
          <span class="issue-category">{{ issue.category }}</span>
        </div>
        <div class="issue-description">{{ issue.description }}</div>
        <div v-if="issue.evidence" class="issue-evidence">
          <span class="evidence-label">原文:</span>
          {{ issue.evidence }}
        </div>
        <div v-if="issue.suggestion" class="issue-suggestion">
          <span class="suggestion-label">建议:</span>
          {{ issue.suggestion }}
        </div>
        <div v-if="issue.location" class="issue-location">
          <span class="location-label">位置:</span>
          {{ issue.location }}
        </div>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="validationStore.error" class="error-message">
      {{ validationStore.error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useValidationStore } from '@/stores/validationStore';

const props = defineProps<{
  projectId: string;
}>();

const emit = defineEmits<{
  (e: 'issueClick', issue: { episode: number; location?: string }): void;
}>();

const validationStore = useValidationStore();

const filterType = ref('');
const filterEpisode = ref('');
const filterCategory = ref('');

// 进度百分比
const progressPercent = computed(() => {
  if (!validationStore.progress) return 0;
  return Math.round((validationStore.progress.current / validationStore.progress.total) * 100);
});

// 评分样式类
const scoreClass = computed(() => {
  const score = validationStore.result?.report?.score || 0;
  if (score >= 90) return 'excellent';
  if (score >= 80) return 'good';
  if (score >= 70) return 'average';
  if (score >= 60) return 'poor';
  return 'bad';
});

// 集数列表
const episodeList = computed(() => {
  const episodes = new Set(validationStore.issues.map(i => i.episode));
  return Array.from(episodes).sort((a, b) => a - b);
});

// 类别列表
const categoryList = computed(() => {
  const categories = new Set(validationStore.issues.map(i => i.category));
  return Array.from(categories).sort();
});

// 过滤后的问题列表
const filteredIssues = computed(() => {
  let issues = validationStore.issues;

  if (filterType.value) {
    issues = issues.filter(i => i.type === filterType.value);
  }

  if (filterEpisode.value) {
    issues = issues.filter(i => i.episode === parseInt(filterEpisode.value));
  }

  if (filterCategory.value) {
    issues = issues.filter(i => i.category === filterCategory.value);
  }

  return issues;
});

// 开始验证
async function handleValidate() {
  filterType.value = '';
  filterEpisode.value = '';
  filterCategory.value = '';

  try {
    await validationStore.validateProject(props.projectId);
  } catch (err) {
    console.error('验证失败:', err);
  }
}
</script>

<style scoped>
.validation-panel {
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  border: 1px solid var(--border-default);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-5);
}

.panel-header h3 {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
}

.validate-btn {
  padding: var(--space-2) var(--space-4);
  background: var(--primary);
  color: var(--text-on-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.validate-btn:hover:not(:disabled) {
  background: var(--primary-hover);
}

.validate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.progress-section {
  margin-bottom: var(--space-5);
  padding: var(--space-4);
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.progress-bar {
  height: 6px;
  background: var(--bg-hover);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary);
  transition: width var(--transition-normal);
}

.summary-section {
  margin-bottom: var(--space-5);
}

.score-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  margin-bottom: var(--space-4);
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
}

.score-value {
  font-size: var(--text-4xl);
  font-weight: 700;
  line-height: 1;
}

.score-value.excellent {
  color: var(--success);
}

.score-value.good {
  color: var(--success);
}

.score-value.average {
  color: var(--warning);
}

.score-value.poor {
  color: var(--warning);
}

.score-value.bad {
  color: var(--error);
}

.score-label {
  margin-top: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-weight: 500;
}

.summary-cards {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.summary-card {
  flex: 1;
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  text-align: center;
  border: 1px solid var(--border-default);
}

.summary-card.error {
  background: var(--error-muted);
  border-color: var(--error-border);
}

.summary-card.warning {
  background: var(--warning-muted);
  border-color: var(--warning-border);
}

.summary-card.info {
  background: var(--primary-muted);
  border-color: var(--primary-border);
}

.summary-card .count {
  display: block;
  font-size: var(--text-2xl);
  font-weight: 600;
  margin-bottom: var(--space-1);
}

.summary-card.error .count {
  color: var(--error);
}

.summary-card.warning .count {
  color: var(--warning);
}

.summary-card.info .count {
  color: var(--primary);
}

.summary-card .label {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.success-message {
  padding: var(--space-4);
  background: var(--success-muted);
  color: var(--success);
  border-radius: var(--radius-lg);
  text-align: center;
  font-weight: 500;
  border: 1px solid var(--success-border);
}

.filter-section {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
  padding: var(--space-3);
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
}

.filter-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.filter-group label {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.filter-group select {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  background: var(--bg-surface);
  color: var(--text-primary);
}

.filter-group select:focus {
  outline: none;
  border-color: var(--border-focus);
}

.issues-section {
  max-height: 400px;
  overflow-y: auto;
}

.empty-state {
  padding: var(--space-8);
  text-align: center;
  color: var(--text-muted);
}

.issue-item {
  padding: var(--space-4);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-3);
  background: var(--bg-elevated);
}

.issue-item.error {
  border-left: 4px solid var(--error);
}

.issue-item.warning {
  border-left: 4px solid var(--warning);
}

.issue-item.info {
  border-left: 4px solid var(--primary);
}

.issue-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.issue-badge {
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 500;
}

.issue-badge.error {
  background: var(--error-muted);
  color: var(--error);
}

.issue-badge.warning {
  background: var(--warning-muted);
  color: var(--warning);
}

.issue-badge.info {
  background: var(--primary-muted);
  color: var(--primary);
}

.issue-episode {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.issue-global-badge {
  font-size: var(--text-xs);
  padding: 2px var(--space-2);
  background: var(--primary-muted);
  color: var(--primary);
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.issue-window {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.issue-category {
  font-size: var(--text-xs);
  padding: 2px var(--space-2);
  background: var(--bg-hover);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
}

.issue-description {
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
  color: var(--text-primary);
}

.issue-evidence {
  margin-top: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  background: var(--bg-hover);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font-style: italic;
  border-left: 2px solid var(--border-default);
}

.evidence-label {
  font-weight: 500;
  margin-right: var(--space-1);
  font-style: normal;
}

.issue-suggestion {
  margin-top: var(--space-2);
  font-size: var(--text-sm);
  color: var(--success);
  background: var(--success-muted);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
}

.suggestion-label {
  font-weight: 500;
  margin-right: var(--space-1);
}

.issue-location {
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.location-label {
  font-weight: 500;
}

.error-message {
  margin-top: var(--space-4);
  padding: var(--space-3);
  background: var(--error-muted);
  color: var(--error);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
}
</style>
