<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { generationLogApi, type IGenerationLog } from '@/services/api';

const props = defineProps<{
  projectId: string;
  episodeNumber: number;
}>();

const emit = defineEmits<{
  (e: 'reuseContext', context: IGenerationLog['context']): void;
}>();

const loading = ref(false);
const currentLog = ref<IGenerationLog | null>(null);
const historyLogs = ref<IGenerationLog[]>([]);
const totalPages = ref(0);
const currentPage = ref(1);

type TabKey = 'overview' | 'constraints' | 'characters' | 'foreshadowings' | 'multihead' | 'validation';
const activeTab = ref<TabKey>('overview');

const statusLabels: Record<string, string> = {
  success: '成功',
  partial_success: '部分成功',
  failed: '失败',
};

const constraintTypeLabels: Record<string, string> = {
  critical: '关键', important: '重要', normal: '一般',
  foreshadowing: '伏笔', rhythm: '节奏', cliffhanger: '悬念', continuity: '连续性',
};

const tierLabels: Record<string, string> = {
  core: '核心', main: '主角', arc: '篇章', recurring: '常驻', temporary: '临时', extra: '龙套',
};

const severityLabels: Record<string, string> = { critical: '关键', important: '重要', normal: '一般' };

const headTypeLabels: Record<string, string> = {
  'base-relationships': '角色关系', 'base-conflicts': '剧情冲突',
  'base-foreshadowing': '伏笔追踪', 'base-consistency': '世界一致性',
  'mystery-clues': '线索追踪', 'mystery-logic': '逻辑一致性',
  'cool-faceslap': '打脸节奏', 'cool-points': '爽点分布',
  'style-emotions': '情感弧线', 'style-pacing': '节奏控制',
};

const importanceLabels: Record<string, string> = {
  critical: '紧急', high: '高', medium: '中', low: '低', normal: '普通', none: '无',
};

const foreshadowingTypeLabels: Record<string, string> = {
  suspense: '悬念', item: '物品', plot: '剧情', character: '角色', dialogue: '对话', atmosphere: '氛围',
};

const lookup = (map: Record<string, string>, key: string) => map[key] || key;

const parseConstraint = (constraint: string): { type: string; content: string } => {
  const m1 = constraint.match(/^\[(\w+)\]\s*(.*)$/);
  if (m1?.[1] && m1[2]) return { type: m1[1].toLowerCase(), content: m1[2] };

  const m2 = constraint.match(/^【([^】]+)】\s*(.*)$/);
  if (m2?.[1]) {
    const text = m2[1];
    const typeKey = text.includes('节奏') ? 'rhythm'
      : text.includes('伏笔') ? 'foreshadowing'
      : text.includes('悬念') ? 'cliffhanger'
      : 'normal';
    return { type: typeKey, content: m2[2] || constraint };
  }
  return { type: 'normal', content: constraint };
};

const formatTime = (dateStr: string) =>
  new Date(dateStr).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
};

const formatSuggestion = (s: string) =>
  s.replace(/【Critical】/g, '【关键 (Critical)】')
   .replace(/【Important】/g, '【重要 (Important)】')
   .replace(/【Normal】/g, '【普通 (Normal)】')
   .replace(/【Optimization】/g, '【优化 (Optimization)】');

const loadCurrentLog = async () => {
  if (!props.projectId || !props.episodeNumber) return;
  loading.value = true;
  try {
    const res = await generationLogApi.getByEpisode(props.projectId, props.episodeNumber);
    currentLog.value = (res.data.exists && res.data.log) ? res.data.log : null;
  } catch (err) {
    console.error('加载生成日志失败:', err);
    currentLog.value = null;
  } finally {
    loading.value = false;
  }
};

const loadHistory = async () => {
  if (!props.projectId) return;
  loading.value = true;
  try {
    const res = await generationLogApi.getByProject(props.projectId, currentPage.value, 10);
    historyLogs.value = res.data.logs;
    totalPages.value = res.data.pages;
  } catch (err) {
    console.error('加载生成历史失败:', err);
  } finally {
    loading.value = false;
  }
};

const selectLog = (log: IGenerationLog) => { currentLog.value = log; };

const reuseContext = () => {
  if (currentLog.value?.context) emit('reuseContext', currentLog.value.context);
};

const prevPage = () => { if (currentPage.value > 1) { currentPage.value--; loadHistory(); } };
const nextPage = () => { if (currentPage.value < totalPages.value) { currentPage.value++; loadHistory(); } };

const validationSummary = computed(() => {
  if (!currentLog.value?.constraintValidation) return null;
  const cv = currentLog.value.constraintValidation as {
    satisfactionRate?: number; criticalViolations?: number;
    importantViolations?: number; overallSatisfied?: boolean;
  };
  return {
    rate: ((cv.satisfactionRate || 0) * 100).toFixed(0),
    critical: cv.criticalViolations || 0,
    important: cv.importantViolations || 0,
    passed: cv.overallSatisfied,
  };
});

const foreshadowingSummary = computed(() => {
  if (!currentLog.value?.analysis) return null;
  const a = currentLog.value.analysis as {
    foreshadowingResolved?: Array<{ originalContent: string; matchScore: number; resolutionNote: string }>;
    foreshadowingPlanted?: Array<{ content: string; type: string; importance: string }>;
  };
  return { resolved: a.foreshadowingResolved || [], planted: a.foreshadowingPlanted || [] };
});

const foreshadowingConstraints = computed(() => {
  if (!currentLog.value?.context?.constraints) return [];
  return currentLog.value.context.constraints.filter(c => c.includes('伏笔') || c.includes('回收'));
});

interface ParsedConstraint { type: string; content: string; original: string }
interface ConstraintGroups {
  critical: ParsedConstraint[]; important: ParsedConstraint[];
  normal: ParsedConstraint[]; other: ParsedConstraint[];
}

const constraintGroupDefs = computed(() => {
  const groups: ConstraintGroups = { critical: [], important: [], normal: [], other: [] };
  if (!currentLog.value?.context?.constraints) return groups;
  for (const c of currentLog.value.context.constraints) {
    const parsed = parseConstraint(c);
    const key = (['critical', 'important', 'normal'].includes(parsed.type) ? parsed.type : 'other') as keyof ConstraintGroups;
    groups[key].push({ ...parsed, original: c });
  }
  return groups;
});

const constraintSections = computed(() => [
  { key: 'critical', label: '关键约束', icon: '!', items: constraintGroupDefs.value.critical },
  { key: 'important', label: '重要约束', icon: '*', items: constraintGroupDefs.value.important },
  { key: 'normal', label: '一般约束', icon: '', items: constraintGroupDefs.value.normal },
  { key: 'other', label: '其他约束', icon: '', items: constraintGroupDefs.value.other },
].filter(s => s.items.length > 0));

const multiHeadData = computed(() => {
  if (!currentLog.value?.multiHeadAnalysis) return null;
  return currentLog.value.multiHeadAnalysis as {
    enabledHeads?: string[];
    headResults?: Array<{ headType: string; insights: string[]; suggestions: string[]; constraints: string[]; warnings: string[] }>;
    crossDimensionInsights?: string[];
    aggregatedConstraints?: string[];
    aggregatedSuggestions?: string[];
  };
});

const constraintValidationDetails = computed(() => {
  if (!currentLog.value?.constraintValidation) return null;
  return currentLog.value.constraintValidation as {
    satisfactionRate?: number; criticalViolations?: number;
    importantViolations?: number; normalViolations?: number;
    overallSatisfied?: boolean;
    results?: Array<{
      constraintId: string; constraintType: string; constraintContent: string;
      fulfilled: boolean; confidence: number; reasoning: string; severity: string;
    }>;
    summary?: string; improvementSuggestions?: string[];
  };
});

watch(() => [props.projectId, props.episodeNumber], () => { loadCurrentLog(); }, { immediate: true });
watch(() => props.projectId, () => { loadHistory(); }, { immediate: true });
</script>

<template>
  <div class="generation-history-panel">
    <div class="panel-header">
      <h4>生成历史</h4>
      <button class="btn-refresh" @click="loadCurrentLog(); loadHistory();" :disabled="loading">
        {{ loading ? '加载中...' : '刷新' }}
      </button>
    </div>

    <div v-if="currentLog" class="current-log">
      <div class="log-header">
        <span class="episode-badge">第{{ currentLog.episodeNumber }}集</span>
        <span class="status-badge" :class="currentLog.status">
          {{ statusLabels[currentLog.status] || currentLog.status }}
        </span>
        <span class="time">{{ formatTime(currentLog.createdAt) }}</span>
      </div>

      <div class="quick-stats">
        <div class="stat">
          <span class="label">字数</span>
          <span class="value">{{ currentLog.wordCount }}</span>
        </div>
        <div class="stat">
          <span class="label">耗时</span>
          <span class="value">{{ formatDuration(currentLog.generationDuration) }}</span>
        </div>
        <div v-if="validationSummary" class="stat">
          <span class="label">验证</span>
          <span class="value" :class="{ passed: validationSummary.passed, failed: !validationSummary.passed }">
            {{ validationSummary.rate }}%
          </span>
        </div>
        <div v-if="multiHeadData" class="stat">
          <span class="label">多头</span>
          <span class="value multihead">{{ multiHeadData.enabledHeads?.length || 0 }}个</span>
        </div>
      </div>

      <div class="tab-nav">
        <button
          :class="['tab-btn', { active: activeTab === 'overview' }]"
          @click="activeTab = 'overview'"
        >概览</button>
        <button
          :class="['tab-btn', { active: activeTab === 'constraints' }]"
          @click="activeTab = 'constraints'"
        >
          约束
          <span class="tab-count">{{ currentLog.context.constraints.length }}</span>
        </button>
        <button
          :class="['tab-btn', { active: activeTab === 'characters' }]"
          @click="activeTab = 'characters'"
        >
          角色
          <span class="tab-count">{{ currentLog.context.relevantCharacters.length }}</span>
        </button>
        <button
          :class="['tab-btn', { active: activeTab === 'foreshadowings' }]"
          @click="activeTab = 'foreshadowings'"
        >伏笔</button>
        <button
          v-if="multiHeadData"
          :class="['tab-btn', { active: activeTab === 'multihead' }]"
          @click="activeTab = 'multihead'"
        >多头分析</button>
        <button
          v-if="constraintValidationDetails"
          :class="['tab-btn', { active: activeTab === 'validation' }]"
          @click="activeTab = 'validation'"
        >验证详情</button>
      </div>

      <div class="tab-content">
        <div v-if="activeTab === 'overview'" class="tab-pane">
          <div class="section-card">
            <div class="section-title">本集梗概</div>
            <p class="section-text">{{ currentLog.context.episodePlan || '无' }}</p>
          </div>

          <div v-if="currentLog.context.previousCliffhanger" class="section-card">
            <div class="section-title">上集悬念</div>
            <p class="section-text">{{ currentLog.context.previousCliffhanger }}</p>
          </div>

          <div class="section-card">
            <div class="section-title">世界状态上下文</div>
            <pre class="formatted-context">{{ currentLog.context.formattedContext }}</pre>
          </div>
        </div>

        <div v-if="activeTab === 'constraints'" class="tab-pane">
          <div v-for="section in constraintSections" :key="section.key" class="constraint-group">
            <div class="group-header" :class="section.key">
              <span v-if="section.icon" class="group-icon">{{ section.icon }}</span>
              {{ section.label }} ({{ section.items.length }})
            </div>
            <div class="constraint-cards">
              <div
                v-for="(c, i) in section.items"
                :key="section.key + '-' + i"
                class="constraint-card"
                :class="section.key === 'other' ? c.type : section.key"
              >
                <span class="constraint-type-tag" :class="section.key === 'other' ? c.type : section.key">
                  {{ section.key === 'other' ? lookup(constraintTypeLabels, c.type) : section.label.replace('约束', '') }}
                </span>
                <span class="constraint-text">{{ c.content }}</span>
              </div>
            </div>
          </div>

          <div v-if="currentLog.context.suggestions && currentLog.context.suggestions.length > 0" class="constraint-group">
            <div class="group-header suggestions">
              参考建议 ({{ currentLog.context.suggestions.length }})
            </div>
            <div class="suggestion-list">
              <div v-for="(s, i) in currentLog.context.suggestions" :key="'sug-'+i" class="suggestion-item">
                {{ s }}
              </div>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'characters'" class="tab-pane">
          <div class="character-grid">
            <div
              v-for="c in currentLog.context.relevantCharacters"
              :key="c.name"
              class="character-card"
              :class="c.tier"
            >
              <div class="character-header">
                <span class="character-name">{{ c.name }}</span>
                <span class="character-tier" :class="c.tier">{{ tierLabels[c.tier] || c.tier }}</span>
              </div>
              <div class="character-role">{{ c.role }}</div>
              <div class="character-meta">
                <span class="weight-bar">
                  <span class="weight-fill" :style="{ width: (c.weight * 100) + '%' }"></span>
                </span>
                <span class="weight-text">权重 {{ (c.weight * 100).toFixed(0) }}%</span>
              </div>
              <div v-if="c.reason" class="character-reason">{{ c.reason }}</div>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'foreshadowings'" class="tab-pane">
          <div v-if="currentLog.context.relevantForeshadowings.length > 0" class="section-card">
            <div class="section-title">相关伏笔 ({{ currentLog.context.relevantForeshadowings.length }})</div>
            <div class="foreshadowing-cards">
              <div
                v-for="(f, i) in currentLog.context.relevantForeshadowings"
                :key="'rel-'+i"
                class="foreshadowing-card"
              >
                <div class="foreshadowing-header">
                  <span class="foreshadowing-weight">{{ (f.weight * 100).toFixed(0) }}%</span>
                  <span v-if="f.importance" class="foreshadowing-importance" :class="f.importance">{{ f.importance }}</span>
                  <span v-if="f.episodePlanted" class="foreshadowing-episode">第{{ f.episodePlanted }}集埋设</span>
                </div>
                <div class="foreshadowing-content">{{ f.content }}</div>
                <div v-if="f.reason" class="foreshadowing-reason">{{ f.reason }}</div>
              </div>
            </div>
          </div>

          <div v-if="foreshadowingConstraints.length > 0" class="section-card highlight-card">
            <div class="section-title warning">伏笔回收约束 ({{ foreshadowingConstraints.length }})</div>
            <ul class="highlight-list">
              <li v-for="(c, i) in foreshadowingConstraints" :key="'fc-'+i">{{ c }}</li>
            </ul>
          </div>

          <div v-if="foreshadowingSummary" class="foreshadowing-results">
            <div v-if="foreshadowingSummary.resolved.length > 0" class="section-card success-card">
              <div class="section-title success">已回收 ({{ foreshadowingSummary.resolved.length }})</div>
              <div class="result-cards">
                <div v-for="(f, i) in foreshadowingSummary.resolved" :key="'res-'+i" class="result-card resolved">
                  <div class="result-header">
                    <span class="match-badge">匹配度 {{ (f.matchScore * 100).toFixed(0) }}%</span>
                  </div>
                  <div class="result-content">{{ f.originalContent }}</div>
                  <div v-if="f.resolutionNote" class="result-note">{{ f.resolutionNote }}</div>
                </div>
              </div>
            </div>

            <div v-if="foreshadowingSummary.planted.length > 0" class="section-card info-card">
              <div class="section-title info">新埋设 ({{ foreshadowingSummary.planted.length }})</div>
              <div class="result-cards">
                <div v-for="(f, i) in foreshadowingSummary.planted" :key="'plant-'+i" class="result-card planted">
                  <div class="result-header">
                    <span class="importance-badge" :class="f.importance">{{ lookup(importanceLabels, f.importance) }}</span>
                    <span class="type-badge">{{ lookup(foreshadowingTypeLabels, f.type) }}</span>
                  </div>
                  <div class="result-content">{{ f.content }}</div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="currentLog.context.relevantForeshadowings.length === 0 && foreshadowingConstraints.length === 0" class="empty-state">
            暂无伏笔相关数据
          </div>
        </div>

        <div v-if="activeTab === 'multihead' && multiHeadData" class="tab-pane">
          <div class="section-card">
            <div class="section-title">启用的注意力头</div>
            <div class="head-tags">
              <span
                v-for="head in multiHeadData.enabledHeads"
                :key="head"
                class="head-tag"
              >{{ lookup(headTypeLabels, head) }}</span>
            </div>
          </div>

          <div v-if="multiHeadData.headResults && multiHeadData.headResults.length > 0">
            <div v-for="(hr, i) in multiHeadData.headResults" :key="'hr-'+i" class="head-result-card">
              <div class="head-result-header">
                <span class="head-name">{{ lookup(headTypeLabels, hr.headType) }}</span>
              </div>

              <div v-if="hr.insights && hr.insights.length > 0" class="head-section">
                <div class="head-section-title">洞察</div>
                <ul class="head-list insights">
                  <li v-for="(ins, j) in hr.insights" :key="'ins-'+j">{{ ins }}</li>
                </ul>
              </div>

              <div v-if="hr.constraints && hr.constraints.length > 0" class="head-section">
                <div class="head-section-title">约束</div>
                <ul class="head-list constraints">
                  <li v-for="(con, j) in hr.constraints" :key="'con-'+j">{{ con }}</li>
                </ul>
              </div>

              <div v-if="hr.suggestions && hr.suggestions.length > 0" class="head-section">
                <div class="head-section-title">建议</div>
                <ul class="head-list suggestions">
                  <li v-for="(sug, j) in hr.suggestions" :key="'sug-'+j">{{ sug }}</li>
                </ul>
              </div>

              <div v-if="hr.warnings && hr.warnings.length > 0" class="head-section">
                <div class="head-section-title warning">警告</div>
                <ul class="head-list warnings">
                  <li v-for="(warn, j) in hr.warnings" :key="'warn-'+j">{{ warn }}</li>
                </ul>
              </div>
            </div>
          </div>

          <div v-if="multiHeadData.crossDimensionInsights && multiHeadData.crossDimensionInsights.length > 0" class="section-card">
            <div class="section-title">跨维度洞察</div>
            <ul class="cross-insights-list">
              <li v-for="(ci, i) in multiHeadData.crossDimensionInsights" :key="'ci-'+i">{{ ci }}</li>
            </ul>
          </div>

          <div class="aggregated-section">
            <div v-if="multiHeadData.aggregatedConstraints && multiHeadData.aggregatedConstraints.length > 0" class="section-card">
              <div class="section-title">聚合约束 ({{ multiHeadData.aggregatedConstraints.length }})</div>
              <ul class="aggregated-list constraints">
                <li v-for="(ac, i) in multiHeadData.aggregatedConstraints" :key="'ac-'+i">{{ ac }}</li>
              </ul>
            </div>

            <div v-if="multiHeadData.aggregatedSuggestions && multiHeadData.aggregatedSuggestions.length > 0" class="section-card">
              <div class="section-title">聚合建议 ({{ multiHeadData.aggregatedSuggestions.length }})</div>
              <ul class="aggregated-list suggestions">
                <li v-for="(as, i) in multiHeadData.aggregatedSuggestions" :key="'as-'+i">{{ as }}</li>
              </ul>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'validation' && constraintValidationDetails" class="tab-pane">
          <div class="validation-summary">
            <div class="validation-rate" :class="{ passed: constraintValidationDetails.overallSatisfied }">
              <span class="rate-value">{{ ((constraintValidationDetails.satisfactionRate || 0) * 100).toFixed(0) }}%</span>
              <span class="rate-label">满足率</span>
            </div>
            <div class="violation-stats">
              <div class="violation-stat critical">
                <span class="violation-count">{{ constraintValidationDetails.criticalViolations || 0 }}</span>
                <span class="violation-label">关键违反</span>
              </div>
              <div class="violation-stat important">
                <span class="violation-count">{{ constraintValidationDetails.importantViolations || 0 }}</span>
                <span class="violation-label">重要违反</span>
              </div>
              <div class="violation-stat normal">
                <span class="violation-count">{{ constraintValidationDetails.normalViolations || 0 }}</span>
                <span class="violation-label">一般违反</span>
              </div>
            </div>
          </div>

          <div v-if="constraintValidationDetails.summary" class="section-card">
            <div class="section-title">验证摘要</div>
            <p class="section-text">{{ constraintValidationDetails.summary }}</p>
          </div>

          <div v-if="constraintValidationDetails.results && constraintValidationDetails.results.length > 0" class="section-card">
            <div class="section-title">详细验证结果</div>
            <div class="validation-results">
              <div
                v-for="(r, i) in constraintValidationDetails.results"
                :key="'vr-'+i"
                class="validation-result-card"
                :class="{ fulfilled: r.fulfilled, violated: !r.fulfilled }"
              >
                <div class="vr-header">
                  <span class="vr-status" :class="{ fulfilled: r.fulfilled, violated: !r.fulfilled }">
                    {{ r.fulfilled ? '通过' : '违反' }}
                  </span>
                  <span class="vr-severity" :class="r.severity">{{ lookup(severityLabels, r.severity) }}</span>
                  <span class="vr-confidence">置信度 {{ (r.confidence * 100).toFixed(0) }}%</span>
                </div>
                <div class="vr-content">{{ r.constraintContent }}</div>
                <div v-if="r.reasoning" class="vr-reasoning">{{ r.reasoning }}</div>
              </div>
            </div>
          </div>

          <div v-if="constraintValidationDetails.improvementSuggestions && constraintValidationDetails.improvementSuggestions.length > 0" class="section-card">
            <div class="section-title">改进建议</div>
            <ul class="improvement-list">
              <li v-for="(sug, i) in constraintValidationDetails.improvementSuggestions" :key="'imp-'+i">{{ formatSuggestion(sug) }}</li>
            </ul>
          </div>
        </div>
      </div>

      <details class="generation-logs">
        <summary>生成日志 ({{ currentLog.logs.length }}条)</summary>
        <div class="logs-content">
          <div
            v-for="(log, i) in currentLog.logs"
            :key="i"
            class="log-item"
            :class="log.level"
          >
            <span class="log-time">{{ log.time.split('T')[1]?.slice(0, 8) || '' }}</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
        </div>
      </details>

      <button class="btn-reuse" @click="reuseContext">
        复用此上下文进行改写
      </button>
    </div>

    <div v-else-if="!loading" class="no-log">
      <p>当前集暂无生成记录</p>
    </div>

    <div v-if="historyLogs.length > 0" class="history-divider">
      <span>其他集生成历史</span>
    </div>

    <div v-if="historyLogs.length > 0" class="history-list">
      <div
        v-for="log in historyLogs.filter(l => l.episodeNumber !== episodeNumber)"
        :key="log._id"
        class="history-item"
        @click="selectLog(log)"
      >
        <span class="episode">第{{ log.episodeNumber }}集</span>
        <span class="status" :class="log.status">{{ statusLabels[log.status] }}</span>
        <span class="word-count">{{ log.wordCount }}字</span>
        <span class="time">{{ formatTime(log.createdAt) }}</span>
      </div>
    </div>

    <div v-if="totalPages > 1" class="pagination">
      <button 
        class="page-btn" 
        :disabled="currentPage === 1"
        @click="prevPage"
      >
        上一页
      </button>
      <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
      <button 
        class="page-btn" 
        :disabled="currentPage === totalPages"
        @click="nextPage"
      >
        下一页
      </button>
    </div>
  </div>
</template>

<style scoped>
.generation-history-panel {
  padding: var(--space-3);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.panel-header h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.btn-refresh {
  padding: var(--space-1) var(--space-3);
  font-size: 11px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--text-primary);
  transition: var(--transition-fast);
}

.btn-refresh:hover:not(:disabled) {
  background: var(--bg-hover);
}

.btn-refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.current-log {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  margin-bottom: var(--space-4);
}

.log-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.episode-badge {
  background: var(--primary-muted);
  color: var(--primary);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 500;
}

.status-badge {
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: 10px;
}

.status-badge.success {
  background: var(--success-muted);
  color: var(--success);
}

.status-badge.partial_success {
  background: var(--warning-muted);
  color: var(--warning);
}

.status-badge.failed {
  background: var(--error-muted);
  color: var(--error);
}

.time {
  font-size: 10px;
  color: var(--text-muted);
  margin-left: auto;
}

.quick-stats {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  flex-wrap: wrap;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat .label {
  font-size: 9px;
  color: var(--text-muted);
}

.stat .value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.stat .value.passed {
  color: var(--success);
}

.stat .value.failed {
  color: var(--error);
}

.stat .value.multihead {
  color: var(--primary);
}

.tab-nav {
  display: flex;
  gap: var(--space-1);
  border-bottom: 1px solid var(--border-default);
  margin-bottom: var(--space-3);
  overflow-x: auto;
  padding-bottom: var(--space-2);
}

.tab-btn {
  padding: var(--space-1) var(--space-3);
  font-size: 11px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--text-secondary);
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  transition: var(--transition-fast);
}

.tab-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.tab-btn.active {
  background: var(--primary-muted);
  color: var(--primary);
  font-weight: 500;
}

.tab-count {
  font-size: 9px;
  padding: 1px var(--space-1);
  background: var(--bg-hover);
  border-radius: var(--radius-full);
}

.tab-btn.active .tab-count {
  background: var(--primary);
  color: var(--text-on-primary);
}

.tab-content {
  max-height: 450px;
  overflow-y: auto;
}

.tab-pane {
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.section-card {
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  margin-bottom: var(--space-3);
}

.section-card:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-title.warning {
  color: var(--warning);
}

.section-title.success {
  color: var(--success);
}

.section-title.info {
  color: var(--primary);
}

.section-text {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-primary);
}

.formatted-context {
  margin: 0;
  padding: var(--space-2);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  font-size: 10px;
  line-height: 1.6;
  white-space: pre-wrap;
  max-height: 250px;
  overflow-y: auto;
  border: 1px solid var(--border-default);
  color: var(--text-secondary);
}

.constraint-group {
  margin-bottom: var(--space-4);
}

.constraint-group:last-child {
  margin-bottom: 0;
}

.group-header {
  font-size: 11px;
  font-weight: 600;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-2);
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.group-header.critical {
  background: var(--error-muted);
  color: var(--error);
}

.group-header.important {
  background: var(--warning-muted);
  color: var(--warning);
}

.group-header.normal {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.group-header.other {
  background: var(--primary-muted);
  color: var(--primary);
}

.group-header.suggestions {
  background: var(--success-muted);
  color: var(--success);
}

.group-icon {
  font-weight: bold;
  font-size: 12px;
}

.constraint-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.constraint-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--border-default);
}

.constraint-card.critical {
  border-left-color: var(--error);
}

.constraint-card.important {
  border-left-color: var(--warning);
}

.constraint-card.normal {
  border-left-color: var(--text-muted);
}

.constraint-card.foreshadowing {
  border-left-color: var(--primary-hover);
}

.constraint-card.rhythm {
  border-left-color: var(--cyan);
}

.constraint-card.cliffhanger {
  border-left-color: var(--orange);
}

.constraint-type-tag {
  flex-shrink: 0;
  font-size: 9px;
  padding: 2px var(--space-1);
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.constraint-type-tag.critical {
  background: var(--error-muted);
  color: var(--error);
}

.constraint-type-tag.important {
  background: var(--warning-muted);
  color: var(--warning);
}

.constraint-type-tag.normal {
  background: var(--bg-hover);
  color: var(--text-muted);
}

.constraint-type-tag.foreshadowing {
  background: rgba(167, 139, 250, 0.15);
  color: var(--primary-hover);
}

.constraint-type-tag.rhythm {
  background: rgba(34, 211, 238, 0.15);
  color: var(--cyan);
}

.constraint-type-tag.cliffhanger {
  background: var(--orange-muted);
  color: var(--orange);
}

.constraint-text {
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-primary);
}

.suggestion-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.suggestion-item {
  padding: var(--space-2);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  font-size: 11px;
  line-height: 1.5;
  border-left: 3px solid var(--success);
  color: var(--text-primary);
}

.character-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--space-2);
}

.character-card {
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  padding: var(--space-2);
  border: 1px solid var(--border-default);
}

.character-card.core {
  border-color: var(--error);
  background: var(--error-muted);
}

.character-card.main {
  border-color: var(--warning);
  background: rgba(245, 158, 11, 0.05);
}

.character-card.arc {
  border-color: var(--primary);
  background: var(--primary-muted);
}

.character-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-1);
}

.character-name {
  font-weight: 600;
  font-size: 12px;
  color: var(--text-primary);
}

.character-tier {
  font-size: 9px;
  padding: 2px var(--space-1);
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.character-tier.core {
  background: var(--error-muted);
  color: var(--error);
}

.character-tier.main {
  background: var(--warning-muted);
  color: var(--warning);
}

.character-tier.arc {
  background: var(--primary-muted);
  color: var(--primary);
}

.character-tier.recurring {
  background: var(--success-muted);
  color: var(--success);
}

.character-tier.temporary {
  background: var(--bg-hover);
  color: var(--text-muted);
}

.character-role {
  font-size: 10px;
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}

.character-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.weight-bar {
  flex: 1;
  height: 3px;
  background: var(--bg-hover);
  border-radius: 2px;
  overflow: hidden;
}

.weight-fill {
  height: 100%;
  background: var(--primary);
  border-radius: 2px;
  transition: var(--transition-normal);
}

.weight-text {
  font-size: 9px;
  color: var(--text-muted);
  white-space: nowrap;
}

.character-reason {
  margin-top: var(--space-2);
  font-size: 10px;
  color: var(--text-secondary);
  padding-top: var(--space-2);
  border-top: 1px dashed var(--border-default);
}

.foreshadowing-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.foreshadowing-card {
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  border: 1px solid var(--border-default);
}

.foreshadowing-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.foreshadowing-weight {
  font-size: 11px;
  font-weight: 600;
  padding: 2px var(--space-2);
  background: var(--primary-muted);
  color: var(--primary);
  border-radius: var(--radius-sm);
}

.foreshadowing-importance {
  font-size: 10px;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
}

.foreshadowing-importance.high {
  background: var(--error-muted);
  color: var(--error);
}

.foreshadowing-importance.normal {
  background: var(--warning-muted);
  color: var(--warning);
}

.foreshadowing-importance.low {
  background: var(--bg-hover);
  color: var(--text-muted);
}

.foreshadowing-episode {
  font-size: 10px;
  color: var(--text-muted);
}

.foreshadowing-content {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-primary);
}

.foreshadowing-reason {
  margin-top: var(--space-2);
  font-size: 11px;
  color: var(--text-secondary);
  padding-top: var(--space-2);
  border-top: 1px dashed var(--border-default);
}

.highlight-card {
  background: var(--warning-muted);
  border: 1px solid var(--warning);
}

.highlight-list {
  margin: 0;
  padding-left: 20px;
  font-size: 12px;
}

.highlight-list li {
  margin-bottom: var(--space-2);
  color: var(--warning);
}

.success-card {
  background: var(--success-muted);
  border: 1px solid var(--success);
}

.info-card {
  background: var(--primary-muted);
  border: 1px solid var(--primary);
}

.result-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.result-card {
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.result-header {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.match-badge {
  font-size: 10px;
  padding: 2px var(--space-2);
  background: var(--success-muted);
  color: var(--success);
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.importance-badge {
  font-size: 10px;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.importance-badge.high {
  background: var(--error-muted);
  color: var(--error);
}

.importance-badge.normal {
  background: var(--warning-muted);
  color: var(--warning);
}

.type-badge {
  font-size: 10px;
  padding: 2px var(--space-2);
  background: var(--bg-hover);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
}

.result-content {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-primary);
}

.result-note {
  margin-top: var(--space-2);
  font-size: 11px;
  color: var(--text-secondary);
  font-style: italic;
}

.empty-state {
  text-align: center;
  padding: var(--space-6);
  color: var(--text-muted);
  font-size: 13px;
}

.head-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.head-tag {
  font-size: 11px;
  padding: var(--space-1) var(--space-3);
  background: var(--primary-muted);
  color: var(--primary);
  border-radius: var(--radius-full);
  font-weight: 500;
}

.head-result-card {
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  margin-bottom: var(--space-3);
  border: 1px solid var(--border-default);
}

.head-result-header {
  margin-bottom: var(--space-3);
}

.head-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.head-section {
  margin-bottom: var(--space-3);
}

.head-section:last-child {
  margin-bottom: 0;
}

.head-section-title {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}

.head-section-title.warning {
  color: var(--warning);
}

.head-list {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
}

.head-list li {
  margin-bottom: var(--space-1);
  line-height: 1.5;
}

.head-list.insights li {
  color: var(--text-primary);
}

.head-list.constraints li {
  color: var(--primary-hover);
}

.head-list.suggestions li {
  color: var(--success);
}

.head-list.warnings li {
  color: var(--warning);
}

.cross-insights-list {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
}

.cross-insights-list li {
  margin-bottom: var(--space-2);
  line-height: 1.5;
}

.aggregated-list {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
}

.aggregated-list li {
  margin-bottom: var(--space-2);
  line-height: 1.5;
}

.aggregated-list.constraints li::marker {
  color: var(--primary-hover);
}

.aggregated-list.suggestions li::marker {
  color: var(--success);
}

.validation-summary {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
  padding: var(--space-4);
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  align-items: center;
}

.validation-rate {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-3) var(--space-5);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  border: 2px solid var(--error);
}

.validation-rate.passed {
  border-color: var(--success);
}

.rate-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--error);
}

.validation-rate.passed .rate-value {
  color: var(--success);
}

.rate-label {
  font-size: 11px;
  color: var(--text-muted);
}

.violation-stats {
  display: flex;
  gap: var(--space-3);
  flex: 1;
}

.violation-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-2) var(--space-4);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
}

.violation-count {
  font-size: 20px;
  font-weight: 600;
}

.violation-stat.critical .violation-count {
  color: var(--error);
}

.violation-stat.important .violation-count {
  color: var(--warning);
}

.violation-stat.normal .violation-count {
  color: var(--text-secondary);
}

.violation-label {
  font-size: 10px;
  color: var(--text-muted);
}

.validation-results {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: 300px;
  overflow-y: auto;
}

.validation-result-card {
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  border-left: 3px solid var(--border-default);
}

.validation-result-card.fulfilled {
  border-left-color: var(--success);
}

.validation-result-card.violated {
  border-left-color: var(--error);
}

.vr-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.vr-status {
  font-size: 10px;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.vr-status.fulfilled {
  background: var(--success-muted);
  color: var(--success);
}

.vr-status.violated {
  background: var(--error-muted);
  color: var(--error);
}

.vr-severity {
  font-size: 10px;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
}

.vr-severity.critical {
  background: var(--error-muted);
  color: var(--error);
}

.vr-severity.important {
  background: var(--warning-muted);
  color: var(--warning);
}

.vr-severity.normal {
  background: var(--bg-hover);
  color: var(--text-muted);
}

.vr-confidence {
  font-size: 10px;
  color: var(--text-muted);
  margin-left: auto;
}

.vr-content {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-primary);
}

.vr-reasoning {
  margin-top: var(--space-2);
  font-size: 11px;
  color: var(--text-secondary);
  padding-top: var(--space-2);
  border-top: 1px dashed var(--border-default);
}

.improvement-list {
  margin: 0;
  padding-left: 20px;
  font-size: 12px;
}

.improvement-list li {
  margin-bottom: var(--space-2);
  line-height: 1.5;
}

.generation-logs {
  margin-top: var(--space-3);
}

.generation-logs summary {
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}

.logs-content {
  max-height: 200px;
  overflow-y: auto;
  padding: var(--space-2);
  background: var(--bg-surface);
  border-radius: var(--radius-md);
}

.log-item {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-1) 0;
  font-size: 11px;
  border-bottom: 1px solid var(--border-default);
}

.log-item:last-child {
  border-bottom: none;
}

.log-item.warn {
  color: var(--warning);
}

.log-item.error {
  color: var(--error);
}

.log-time {
  color: var(--text-muted);
  flex-shrink: 0;
  width: 60px;
}

.log-message {
  word-break: break-all;
}

.btn-reuse {
  width: 100%;
  margin-top: var(--space-3);
  padding: var(--space-2);
  background: var(--primary);
  color: var(--text-on-primary);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 13px;
  transition: var(--transition-fast);
}

.btn-reuse:hover {
  background: var(--primary-hover);
}

.no-log {
  text-align: center;
  padding: var(--space-6);
  color: var(--text-muted);
}

.history-divider {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: var(--space-4) 0;
}

.history-divider::before,
.history-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-default);
}

.history-divider span {
  font-size: 12px;
  color: var(--text-muted);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.history-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition-fast);
}

.history-item:hover {
  background: var(--bg-hover);
  border-color: var(--primary);
}

.history-item .episode {
  font-weight: 500;
  font-size: 13px;
  color: var(--text-primary);
}

.history-item .status {
  font-size: 11px;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
}

.history-item .status.success {
  background: var(--success-muted);
  color: var(--success);
}

.history-item .status.partial_success {
  background: var(--warning-muted);
  color: var(--warning);
}

.history-item .word-count {
  font-size: 12px;
  color: var(--text-secondary);
  margin-left: auto;
}

.history-item .time {
  font-size: 11px;
  color: var(--text-muted);
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-default);
}

.page-btn {
  padding: var(--space-1) var(--space-3);
  font-size: 11px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--text-primary);
  transition: var(--transition-fast);
}

.page-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--primary);
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 11px;
  color: var(--text-secondary);
}
</style>
