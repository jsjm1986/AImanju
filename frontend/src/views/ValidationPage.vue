<template>
  <div class="validation-page">
    <!-- 页面标题和操作栏 -->
    <header class="page-header">
      <div class="header-left">
        <h1>剧本验证</h1>
        <span v-if="validationRange" class="range-badge">
          验证范围: 第 {{ validationRange.start }} - {{ validationRange.end }} 集
        </span>
      </div>
      <div class="header-actions">
        <button class="action-btn secondary" @click="showRangeSelector = true">
          范围验证
        </button>
        <button 
          class="action-btn primary" 
          @click="handleValidate" 
          :disabled="validationStore.loading"
        >
          {{ validationStore.loading ? '验证中...' : '开始验证' }}
        </button>
      </div>
    </header>

    <!-- 验证进度弹窗 -->
    <div v-if="validationStore.loading" class="progress-overlay">
      <div class="progress-modal">
        <h3>🔍 正在验证剧本</h3>
        
        <!-- 初始化信息 -->
        <div v-if="validationStore.initInfo" class="init-info">
          <div class="init-item">
            <span class="init-label">📚 剧集数量</span>
            <span class="init-value">{{ validationStore.initInfo.episodeCount }} 集</span>
          </div>
          <div class="init-item">
            <span class="init-label">👥 角色数量</span>
            <span class="init-value">{{ validationStore.initInfo.characterCount }} 个</span>
          </div>
        </div>
        
        <!-- 进度信息 -->
        <div v-if="validationStore.progress" class="progress-content">
          <div class="progress-status">
            正在验证窗口 {{ validationStore.progress.current + 1 }} / {{ validationStore.progress.total }}
          </div>
          <div class="progress-detail">
            <span class="detail-label">当前范围:</span>
            <span class="detail-value">
              第 {{ validationStore.progress.windowStart || '?' }} - {{ validationStore.progress.windowEnd || '?' }} 集
            </span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
            </div>
            <span class="progress-percent">{{ progressPercent }}%</span>
          </div>
          <div class="progress-hint">
            AI 正在分析剧本连续性、角色状态、伏笔回收等问题...
          </div>
        </div>
        
        <!-- 初始化中 -->
        <div v-else class="progress-loading">
          <span class="spinner"></span>
          <span>正在初始化验证器，加载剧本数据...</span>
        </div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="page-content">
      <!-- 左侧：概览面板 -->
      <aside class="overview-panel">
        <!-- 无报告提示 -->
        <div v-if="!validationStore.result" class="no-report">
          <div class="no-report-icon">📋</div>
          <div class="no-report-text">暂无验证报告</div>
          <div class="no-report-hint">点击"开始验证"检查剧本质量</div>
        </div>

        <!-- 评分卡片 -->
        <div v-if="validationStore.result?.report" class="score-card">
          <div class="score-value" :class="scoreClass">
            {{ validationStore.result.report.score }}
          </div>
          <div class="score-label">{{ validationStore.result.report.rating }}</div>
        </div>

        <!-- 问题统计卡片 -->
        <div v-if="validationStore.result" class="summary-cards">
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

        <!-- 全局问题统计 -->
        <div v-if="validationStore.result && globalIssueCount > 0" class="global-stats">
          <span class="global-icon">🌐</span>
          <span class="global-count">{{ globalIssueCount }} 个全局问题</span>
        </div>

        <!-- 最近验证时间 -->
        <div v-if="lastValidationTime" class="last-validation">
          <span class="time-label">最近验证:</span>
          <span class="time-value">{{ lastValidationTime }}</span>
        </div>

        <!-- 验证通过提示 -->
        <div v-if="validationStore.result && !validationStore.hasErrors && !validationStore.hasWarnings" class="success-message">
          ✓ 验证通过，未发现问题
        </div>
      </aside>

      <!-- 右侧：标签页内容 -->
      <main class="main-panel">
        <!-- 标签导航 -->
        <div class="tab-nav">
          <button 
            class="tab-btn" 
            :class="{ active: activeTab === 'issues' }"
            @click="activeTab = 'issues'"
          >
            问题列表
            <span v-if="validationStore.issues.length > 0" class="tab-badge">
              {{ validationStore.issues.length }}
            </span>
          </button>
          <button 
            class="tab-btn" 
            :class="{ active: activeTab === 'byEpisode' }"
            @click="activeTab = 'byEpisode'"
          >
            按集数
          </button>
          <button 
            class="tab-btn" 
            :class="{ active: activeTab === 'fixHistory' }"
            @click="activeTab = 'fixHistory'"
          >
            修复历史
          </button>
          <button 
            class="tab-btn" 
            :class="{ active: activeTab === 'history' }"
            @click="activeTab = 'history'"
          >
            历史报告
          </button>
        </div>

        <!-- 问题列表标签页 -->
        <div v-if="activeTab === 'issues'" class="tab-content">
          <!-- 筛选器 -->
          <div v-if="validationStore.issues.length > 0" class="filter-section">
            <div class="filter-group">
              <label>类型:</label>
              <select v-model="filterType">
                <option value="">全部</option>
                <option value="error">错误</option>
                <option value="warning">警告</option>
                <option value="info">提示</option>
              </select>
            </div>
            <div class="filter-group">
              <label>集数:</label>
              <select v-model="filterEpisode">
                <option value="">全部</option>
                <option v-for="ep in episodeList" :key="ep" :value="ep">第 {{ ep }} 集</option>
              </select>
            </div>
            <div class="filter-group">
              <label>类别:</label>
              <select v-model="filterCategory">
                <option value="">全部</option>
                <option v-for="cat in categoryList" :key="cat" :value="cat">{{ getCategoryLabel(cat) }}</option>
              </select>
            </div>
            <div class="filter-group">
              <label>状态:</label>
              <select v-model="filterStatus">
                <option value="">全部</option>
                <option value="pending">待处理</option>
                <option value="fixed">已处理</option>
                <option value="ignored">忽略</option>
                <option value="false_positive">误报</option>
              </select>
            </div>
            <div class="filter-group">
              <label>范围:</label>
              <select v-model="filterGlobal">
                <option value="">全部</option>
                <option value="global">仅全局</option>
                <option value="local">仅局部</option>
              </select>
            </div>
            <div class="batch-actions">
              <label class="select-all-label">
                <input 
                  type="checkbox" 
                  :checked="isAllSelected" 
                  @change="toggleSelectAll"
                />
                全选
              </label>
              <button 
                v-if="selectedIssues.size > 0"
                class="batch-fix-btn"
                @click="openBatchFixModal"
              >
                批量修复 ({{ selectedIssues.size }})
              </button>
            </div>
          </div>

          <!-- 问题列表 -->
          <div class="issues-list">
            <div v-if="filteredIssues.length === 0" class="empty-state">
              {{ validationStore.issues.length > 0 ? '没有符合筛选条件的问题' : '没有发现问题' }}
            </div>

            <div
              v-for="(issue, index) in sortedIssues"
              :key="index"
              class="issue-item"
              :class="[issue.type, { expanded: expandedIssues.has(index), selected: selectedIssues.has(index) }]"
              @click="toggleIssue(index)"
            >
              <div class="issue-header">
                <input 
                  type="checkbox" 
                  class="issue-checkbox"
                  :checked="selectedIssues.has(index)"
                  @click.stop
                  @change="toggleIssueSelection(index)"
                />
                <span class="issue-badge" :class="issue.type">
                  {{ issue.type === 'error' ? '错误' : issue.type === 'warning' ? '警告' : '提示' }}
                </span>
                <span v-if="issue.isGlobal" class="issue-global-badge">全局</span>
                <span v-else-if="issue.windowRange && issue.windowRange.includes('-')" class="issue-cross-episode-badge">跨集</span>
                <span class="issue-episode">第 {{ issue.episode }} 集</span>
                <span v-if="issue.windowRange && !issue.isGlobal" class="issue-window">
                  窗口 {{ issue.windowRange }}
                </span>
                <span class="issue-category">{{ getCategoryLabel(issue.category) }}</span>
                
                <!-- 状态标签 -->
                <div class="issue-status-wrapper" @click.stop>
                  <span 
                    class="issue-status-badge"
                    :style="{ 
                      color: getStatusConfig(issue.status || 'pending').color,
                      backgroundColor: getStatusConfig(issue.status || 'pending').bgColor
                    }"
                    @click="toggleStatusDropdown(index)"
                  >
                    {{ getStatusConfig(issue.status || 'pending').label }}
                    <span class="status-dropdown-icon">▼</span>
                  </span>
                  <!-- 状态下拉菜单 -->
                  <div v-if="statusDropdownIndex === index" class="status-dropdown">
                    <div 
                      v-for="(config, status) in ISSUE_STATUS_CONFIG" 
                      :key="status"
                      class="status-option"
                      :class="{ active: (issue.status || 'pending') === status }"
                      @click="changeIssueStatus(index, status as IssueStatus)"
                    >
                      <span 
                        class="status-dot"
                        :style="{ backgroundColor: config.color }"
                      ></span>
                      {{ config.label }}
                    </div>
                  </div>
                </div>
                
                <span class="expand-icon">{{ expandedIssues.has(index) ? '▼' : '▶' }}</span>
              </div>
              <div class="issue-description">{{ issue.description }}</div>
              
              <!-- 展开详情 -->
              <div v-if="expandedIssues.has(index)" class="issue-detail">
                <div v-if="issue.evidence" class="issue-evidence">
                  <span class="detail-label">原文:</span>
                  {{ issue.evidence }}
                </div>
                <div v-if="issue.suggestion" class="issue-suggestion">
                  <span class="detail-label">建议:</span>
                  {{ issue.suggestion }}
                </div>
                <div v-if="issue.location" class="issue-location">
                  <span class="detail-label">位置:</span>
                  {{ issue.location }}
                  <button class="preview-btn" @click.stop="openScriptPreview(issue)">
                    📖 查看原文
                  </button>
                </div>
                <div v-else class="issue-location-actions">
                  <button class="preview-btn" @click.stop="openScriptPreview(issue)">
                    📖 查看原文
                  </button>
                </div>
                <div class="issue-actions">
                  <button 
                    v-if="(issue.status || 'pending') === 'pending'"
                    class="fix-btn" 
                    @click.stop="openFixModal(issue)"
                  >
                    🔧 修复
                  </button>
                  <button 
                    v-if="(issue.status || 'pending') !== 'ignored'"
                    class="ignore-btn" 
                    @click.stop="changeIssueStatus(index, 'ignored')"
                  >
                    忽略
                  </button>
                  <button 
                    v-if="(issue.status || 'pending') !== 'false_positive'"
                    class="false-positive-btn" 
                    @click.stop="changeIssueStatus(index, 'false_positive')"
                  >
                    标记误报
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 按集数分组标签页 -->
        <div v-if="activeTab === 'byEpisode'" class="tab-content">
          <div v-if="Object.keys(issuesByEpisode).length === 0" class="empty-state">
            没有发现问题
          </div>
          
          <div 
            v-for="(issues, episode) in issuesByEpisode" 
            :key="episode"
            class="episode-group"
            :class="{ 'has-errors': hasEpisodeErrors(Number(episode)) }"
          >
            <div 
              class="episode-header"
              @click="toggleEpisodeGroup(Number(episode))"
            >
              <span class="episode-title">第 {{ episode }} 集</span>
              <div class="episode-stats">
                <span v-if="getEpisodeErrorCount(Number(episode)) > 0" class="stat error">
                  {{ getEpisodeErrorCount(Number(episode)) }} 错误
                </span>
                <span v-if="getEpisodeWarningCount(Number(episode)) > 0" class="stat warning">
                  {{ getEpisodeWarningCount(Number(episode)) }} 警告
                </span>
                <span v-if="getEpisodeInfoCount(Number(episode)) > 0" class="stat info">
                  {{ getEpisodeInfoCount(Number(episode)) }} 提示
                </span>
              </div>
              <span class="expand-icon">{{ expandedEpisodes.has(Number(episode)) ? '▼' : '▶' }}</span>
            </div>
            
            <div v-if="expandedEpisodes.has(Number(episode))" class="episode-issues">
              <div
                v-for="(issue, idx) in issues"
                :key="idx"
                class="issue-item compact"
                :class="issue.type"
              >
                <div class="issue-header">
                  <span class="issue-badge" :class="issue.type">
                    {{ issue.type === 'error' ? '错误' : issue.type === 'warning' ? '警告' : '提示' }}
                  </span>
                  <span v-if="issue.isGlobal" class="issue-global-badge">全局</span>
                  <span class="issue-category">{{ getCategoryLabel(issue.category) }}</span>
                </div>
                <div class="issue-description">{{ issue.description }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 历史报告标签页 -->
        <div v-if="activeTab === 'history'" class="tab-content">
          <div v-if="historyLoading" class="loading-state">
            <span class="spinner"></span>
            <span>加载历史报告...</span>
          </div>
          
          <div v-else-if="historyReports.length === 0" class="empty-state">
            暂无历史验证报告
          </div>
          
          <div v-else class="history-list">
            <div
              v-for="report in historyReports"
              :key="report.id"
              class="history-item"
              :class="{ active: selectedReportId === report.id }"
            >
              <div class="history-main" @click="loadReportDetail(report.id)">
                <div class="history-score" :class="getScoreClass(report.score)">
                  {{ report.score }}
                </div>
                <div class="history-info">
                  <div class="history-rating">{{ report.rating }}</div>
                  <div class="history-meta">
                    <span class="history-range">
                      {{ report.validationType === 'range' 
                        ? `第 ${report.startEpisode}-${report.endEpisode} 集` 
                        : `全部 ${report.totalEpisodes || '?'} 集` }}
                    </span>
                    <span class="history-time">{{ formatTime(report.createdAt) }}</span>
                  </div>
                </div>
                <div class="history-stats">
                  <span class="stat error">{{ report.criticalCount }} 错误</span>
                  <span class="stat warning">{{ report.warningCount }} 警告</span>
                  <span class="stat info">{{ report.suggestionCount }} 提示</span>
                </div>
              </div>
              <button 
                class="delete-btn" 
                @click.stop="confirmDeleteReport(report.id)"
                title="删除报告"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>

        <!-- 修复历史标签页 -->
        <div v-if="activeTab === 'fixHistory'" class="tab-content">
          <FixHistoryTab 
            :project-id="projectId" 
            @revert="handleFixHistoryRevert"
          />
        </div>
      </main>
    </div>

    <!-- 修复方案弹窗 -->
    <FixPlanModal
      :visible="showFixModal"
      :issue="selectedIssueForFix"
      :project-id="projectId"
      @close="closeFixModal"
      @execute="handleExecuteFix"
      @switch-to-cross-episode="handleSwitchToCrossEpisode"
    />

    <!-- 修复进度面板 -->
    <div v-if="showFixProgress" class="fix-overlay">
      <FixProgressPanel
        :progress="fixStore.executeProgress"
        :content="fixStore.streamContent"
        @cancel="cancelFix"
      />
    </div>

    <!-- 修复结果预览 -->
    <div v-if="showFixResult && fixStore.fixResult" class="fix-overlay">
      <FixResultPreview
        :original-content="fixStore.fixResult.originalContent"
        :fixed-content="fixStore.fixResult.fixedContent"
        :word-count-diff="fixStore.fixResult.wordCountDiff"
        :can-undo="fixStore.canUndo"
        :undo-countdown="fixStore.undoCountdown"
        :applying="fixStore.applying"
        @apply="applyFix"
        @discard="discardFix"
        @undo="undoFix"
        @confirm="confirmFix"
      />
    </div>

    <!-- 范围选择器弹窗 -->
    <div v-if="showRangeSelector" class="modal-overlay" @click.self="showRangeSelector = false">
      <div class="modal-content">
        <h3>范围验证</h3>
        <p class="modal-hint">选择要验证的集数范围</p>
        <div class="range-inputs">
          <div class="range-input">
            <label>起始集:</label>
            <input 
              type="number" 
              v-model.number="rangeStart" 
              :min="1" 
              :max="totalEpisodes"
            />
          </div>
          <span class="range-separator">至</span>
          <div class="range-input">
            <label>结束集:</label>
            <input 
              type="number" 
              v-model.number="rangeEnd" 
              :min="rangeStart" 
              :max="totalEpisodes"
            />
          </div>
        </div>
        <div v-if="rangeError" class="range-error">{{ rangeError }}</div>
        <div class="modal-actions">
          <button class="action-btn secondary" @click="showRangeSelector = false">取消</button>
          <button class="action-btn primary" @click="handleRangeValidate">开始验证</button>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="modal-content">
        <h3>确认删除</h3>
        <p>确定要删除这份验证报告吗？此操作无法撤销。</p>
        <div class="modal-actions">
          <button class="action-btn secondary" @click="showDeleteConfirm = false">取消</button>
          <button class="action-btn danger" @click="deleteReport">删除</button>
        </div>
      </div>
    </div>

    <!-- 批量修复弹窗 -->
    <BatchFixModal
      :visible="showBatchFixModal"
      :issues="batchFixIssues"
      :project-id="projectId"
      @close="closeBatchFixModal"
      @complete="handleBatchFixComplete"
    />

    <!-- 剧本预览弹窗 -->
    <ScriptPreviewModal
      :visible="showScriptPreview"
      :issue="previewIssue"
      :project-id="projectId"
      @close="closeScriptPreview"
      @fix="handlePreviewFix"
    />

    <!-- 跨集联动修复弹窗 -->
    <CrossEpisodeFixModal
      :visible="showCrossEpisodeFixModal"
      :project-id="projectId"
      :issue="selectedIssueForFix"
      @close="closeCrossEpisodeFixModal"
      @fixed="handleCrossEpisodeFixed"
    />

    <!-- 错误提示 -->
    <div v-if="validationStore.error" class="error-toast">
      <span>{{ validationStore.error }}</span>
      <button @click="validationStore.error = null">×</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useValidationStore } from '@/stores/validationStore';
import { useEpisodeStore } from '@/stores/episodeStore';
import { useFixStore } from '@/stores/fixStore';
import type { ValidationIssue, IssueStatus } from '@/types';
import { ISSUE_STATUS_CONFIG } from '@/types';
import FixPlanModal from '@/components/fix/FixPlanModal.vue';
import FixProgressPanel from '@/components/fix/FixProgressPanel.vue';
import FixResultPreview from '@/components/fix/FixResultPreview.vue';
import FixHistoryTab from '@/components/fix/FixHistoryTab.vue';
import BatchFixModal from '@/components/fix/BatchFixModal.vue';
import ScriptPreviewModal from '@/components/fix/ScriptPreviewModal.vue';
import CrossEpisodeFixModal from '@/components/fix/CrossEpisodeFixModal.vue';

const route = useRoute();
const validationStore = useValidationStore();
const episodeStore = useEpisodeStore();
const fixStore = useFixStore();

const projectId = computed(() => route.params.id as string);

// 标签页状态
const activeTab = ref<'issues' | 'byEpisode' | 'history' | 'fixHistory'>('issues');

// 修复相关状态
const showFixModal = ref(false);
const selectedIssueForFix = ref<ValidationIssue | null>(null);
const showFixProgress = ref(false);
const showFixResult = ref(false);
const currentFixEpisodeId = ref<string>('');
const showBatchFixModal = ref(false);
const showCrossEpisodeFixModal = ref(false);

// 剧本预览弹窗状态
const showScriptPreview = ref(false);
const previewIssue = ref<ValidationIssue | null>(null);

// 批量选择状态
const selectedIssues = ref(new Set<number>());

// 筛选器状态
const filterType = ref('');
const filterEpisode = ref('');
const filterCategory = ref('');
const filterGlobal = ref('');
const filterStatus = ref('');

// 状态下拉菜单
const statusDropdownIndex = ref<number | null>(null);

// 展开状态
const expandedIssues = ref(new Set<number>());
const expandedEpisodes = ref(new Set<number>());

// 范围验证
const showRangeSelector = ref(false);
const rangeStart = ref(1);
const rangeEnd = ref(10);
const validationRange = ref<{ start: number; end: number } | null>(null);

// 历史报告
const historyReports = ref<Array<{
  id: string;
  score: number;
  rating: string;
  totalIssues: number;
  criticalCount: number;
  warningCount: number;
  suggestionCount: number;
  // 验证范围信息
  validationType?: 'full' | 'range';
  startEpisode?: number;
  endEpisode?: number;
  totalEpisodes?: number;
  createdAt: string;
}>>([]);
const historyLoading = ref(false);
const selectedReportId = ref<string | null>(null);

// 删除确认
const showDeleteConfirm = ref(false);
const reportToDelete = ref<string | null>(null);

// 计算属性
const totalEpisodes = computed(() => episodeStore.episodes.length || 100);

// 批量选择计算属性
const isAllSelected = computed(() => {
  return sortedIssues.value.length > 0 && 
    sortedIssues.value.every((_, index) => selectedIssues.value.has(index));
});

const progressPercent = computed(() => {
  if (!validationStore.progress) return 0;
  return Math.round((validationStore.progress.current / validationStore.progress.total) * 100);
});

const scoreClass = computed(() => {
  const score = validationStore.result?.report?.score || 0;
  if (score >= 90) return 'excellent';
  if (score >= 80) return 'good';
  if (score >= 70) return 'average';
  if (score >= 60) return 'poor';
  return 'bad';
});

const globalIssueCount = computed(() => {
  return validationStore.issues.filter(i => i.isGlobal).length;
});

const lastValidationTime = computed(() => {
  const time = validationStore.result?.report?.generatedAt;
  if (!time) return null;
  return formatTime(time);
});

const episodeList = computed(() => {
  const episodes = new Set(validationStore.issues.map(i => i.episode));
  return Array.from(episodes).sort((a, b) => a - b);
});

const categoryList = computed(() => {
  const categories = new Set(validationStore.issues.map(i => i.category));
  return Array.from(categories).sort();
});

// 类别中文映射
const categoryLabels: Record<string, string> = {
  continuity: '连续性',
  dialogue: '对话',
  pacing: '节奏',
  unresolved: '未解决',
  character: '角色',
  plot: '剧情',
  worldbuilding: '世界观',
  foreshadowing: '伏笔',
  consistency: '一致性',
  logic: '逻辑',
  timeline: '时间线',
  relationship: '关系',
  emotion: '情感',
  action: '动作',
  setting: '场景',
};

function getCategoryLabel(category: string): string {
  return categoryLabels[category] || category;
}

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
  if (filterStatus.value) {
    issues = issues.filter(i => (i.status || 'pending') === filterStatus.value);
  }
  if (filterGlobal.value === 'global') {
    issues = issues.filter(i => i.isGlobal);
  } else if (filterGlobal.value === 'local') {
    issues = issues.filter(i => !i.isGlobal);
  }

  return issues;
});

// 按严重程度排序
const sortedIssues = computed(() => {
  const severityOrder = { error: 0, warning: 1, info: 2 };
  return [...filteredIssues.value].sort((a, b) => {
    return (severityOrder[a.type] || 3) - (severityOrder[b.type] || 3);
  });
});

const issuesByEpisode = computed(() => {
  const grouped: Record<number, ValidationIssue[]> = {};
  for (const issue of validationStore.issues) {
    if (!grouped[issue.episode]) {
      grouped[issue.episode] = [];
    }
    grouped[issue.episode]!.push(issue);
  }
  // 按集数排序
  const sorted: Record<number, ValidationIssue[]> = {};
  Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach(ep => {
      sorted[ep] = grouped[ep]!;
    });
  return sorted;
});

const rangeError = computed(() => {
  if (rangeStart.value > rangeEnd.value) {
    return '起始集不能大于结束集';
  }
  if (rangeStart.value < 1) {
    return '起始集不能小于1';
  }
  return '';
});

// 方法
function toggleIssue(index: number) {
  if (expandedIssues.value.has(index)) {
    expandedIssues.value.delete(index);
  } else {
    expandedIssues.value.add(index);
  }
  expandedIssues.value = new Set(expandedIssues.value);
}

function toggleEpisodeGroup(episode: number) {
  if (expandedEpisodes.value.has(episode)) {
    expandedEpisodes.value.delete(episode);
  } else {
    expandedEpisodes.value.add(episode);
  }
  expandedEpisodes.value = new Set(expandedEpisodes.value);
}

function hasEpisodeErrors(episode: number): boolean {
  return issuesByEpisode.value[episode]?.some(i => i.type === 'error') || false;
}

function getEpisodeErrorCount(episode: number): number {
  return issuesByEpisode.value[episode]?.filter(i => i.type === 'error').length || 0;
}

function getEpisodeWarningCount(episode: number): number {
  return issuesByEpisode.value[episode]?.filter(i => i.type === 'warning').length || 0;
}

function getEpisodeInfoCount(episode: number): number {
  return issuesByEpisode.value[episode]?.filter(i => i.type === 'info').length || 0;
}

function getScoreClass(score: number): string {
  if (score >= 90) return 'excellent';
  if (score >= 80) return 'good';
  if (score >= 70) return 'average';
  if (score >= 60) return 'poor';
  return 'bad';
}

function formatTime(timeStr: string): string {
  const date = new Date(timeStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}



/**
 * 打开剧本预览弹窗
 */
function openScriptPreview(issue: ValidationIssue) {
  previewIssue.value = issue;
  showScriptPreview.value = true;
}

/**
 * 关闭剧本预览弹窗
 */
function closeScriptPreview() {
  showScriptPreview.value = false;
  previewIssue.value = null;
}

/**
 * 从预览弹窗触发修复
 */
function handlePreviewFix(issue: ValidationIssue) {
  console.log('[ValidationPage] handlePreviewFix 被调用', issue);
  closeScriptPreview();
  openFixModal(issue);
}

// ===== 状态管理相关函数 =====

/**
 * 获取状态配置
 */
function getStatusConfig(status: IssueStatus) {
  return ISSUE_STATUS_CONFIG[status] || ISSUE_STATUS_CONFIG.pending;
}

/**
 * 切换状态下拉菜单
 */
function toggleStatusDropdown(index: number) {
  if (statusDropdownIndex.value === index) {
    statusDropdownIndex.value = null;
  } else {
    statusDropdownIndex.value = index;
  }
}

/**
 * 修改问题状态
 */
function changeIssueStatus(index: number, newStatus: IssueStatus) {
  const issue = sortedIssues.value[index];
  if (issue) {
    // 找到原始问题在 store 中的索引
    const originalIndex = validationStore.issues.findIndex(
      i => i.episode === issue.episode && 
           i.description === issue.description &&
           i.category === issue.category
    );
    if (originalIndex !== -1) {
      validationStore.issues[originalIndex]!.status = newStatus;
    }
  }
  statusDropdownIndex.value = null;
}

/**
 * 点击外部关闭状态下拉菜单
 */
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest('.issue-status-wrapper')) {
    statusDropdownIndex.value = null;
  }
}

// 监听点击事件关闭下拉菜单
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

async function handleValidate() {
  validationRange.value = null;
  expandedIssues.value = new Set();
  filterType.value = '';
  filterEpisode.value = '';
  filterCategory.value = '';
  filterGlobal.value = '';

  try {
    await validationStore.validateProject(projectId.value);
    // 验证完成后刷新历史报告
    await loadHistoryReports();
  } catch (err) {
    console.error('验证失败:', err);
    // 错误已在 store 中设置
  }
}

async function handleRangeValidate() {
  if (rangeError.value) return;

  showRangeSelector.value = false;
  validationRange.value = { start: rangeStart.value, end: rangeEnd.value };
  expandedIssues.value = new Set();
  filterType.value = '';
  filterEpisode.value = '';
  filterCategory.value = '';
  filterGlobal.value = '';

  try {
    await validationStore.validateRange(projectId.value, rangeStart.value, rangeEnd.value);
    await loadHistoryReports();
  } catch (err) {
    console.error('范围验证失败:', err);
    // 错误已在 store 中设置
  }
}

async function loadHistoryReports() {
  historyLoading.value = true;
  try {
    historyReports.value = await validationStore.loadReports(projectId.value);
  } catch (err) {
    // 静默处理，404 已在 store 中处理
    historyReports.value = [];
  } finally {
    historyLoading.value = false;
  }
}

async function loadReportDetail(reportId: string) {
  selectedReportId.value = reportId;
  try {
    await validationStore.loadReportDetail(reportId);
    activeTab.value = 'issues';
  } catch (err) {
    console.error('加载报告详情失败:', err);
  }
}

function confirmDeleteReport(reportId: string) {
  reportToDelete.value = reportId;
  showDeleteConfirm.value = true;
}

async function deleteReport() {
  if (!reportToDelete.value) return;

  try {
    await validationStore.deleteReport(reportToDelete.value);
    historyReports.value = historyReports.value.filter(r => r.id !== reportToDelete.value);
    if (selectedReportId.value === reportToDelete.value) {
      selectedReportId.value = null;
      validationStore.clearResults();
    }
  } catch (err) {
    console.error('删除报告失败:', err);
  } finally {
    showDeleteConfirm.value = false;
    reportToDelete.value = null;
  }
}

// ===== 修复相关方法 =====



/**
 * 打开修复弹窗
 * 业务逻辑：先打开单集修复弹窗进行分析，分析完成后根据 AI 返回的 affectedEpisodes 决定：
 * - 如果 affectedEpisodes 只有 1 集，继续使用单集修复流程
 * - 如果 affectedEpisodes 有多集，自动切换到跨集修复弹窗
 */
function openFixModal(issue: ValidationIssue) {
  console.log('[ValidationPage] openFixModal 被调用', issue);
  selectedIssueForFix.value = issue;
  
  // 先打开单集修复弹窗，让 AI 分析问题
  // 分析完成后，FixPlanModal 会根据 affectedEpisodes 决定是否需要切换到跨集修复
  console.log('[ValidationPage] 打开修复弹窗（AI 将决定是单集还是跨集修复）');
  showFixModal.value = true;
}

function closeCrossEpisodeFixModal() {
  showCrossEpisodeFixModal.value = false;
  selectedIssueForFix.value = null;
  fixStore.resetCrossEpisode();
}

function handleCrossEpisodeFixed() {
  // 更新问题状态为已修复
  if (selectedIssueForFix.value) {
    removeFixedIssueFromList(selectedIssueForFix.value);
  }
  closeCrossEpisodeFixModal();
}

function closeFixModal() {
  showFixModal.value = false;
  selectedIssueForFix.value = null;
  fixStore.reset();
}

/**
 * 处理从单集修复切换到跨集修复
 * 当 AI 分析结果表明问题涉及多集时，FixPlanModal 会触发此事件
 */
function handleSwitchToCrossEpisode(issue: ValidationIssue) {
  console.log('[ValidationPage] 收到切换到跨集修复的请求', issue);
  // 关闭单集修复弹窗
  showFixModal.value = false;
  // 保持 selectedIssueForFix 不变，打开跨集修复弹窗
  showCrossEpisodeFixModal.value = true;
}

async function handleExecuteFix() {
  if (!selectedIssueForFix.value) return;
  
  // 获取对应集的 episodeId
  const episode = episodeStore.episodes.find(
    ep => ep.episodeNumber === selectedIssueForFix.value!.episode
  );
  if (!episode) {
    console.error('找不到对应的集数');
    return;
  }
  
  currentFixEpisodeId.value = episode._id;
  showFixModal.value = false;
  showFixProgress.value = true;
  
  await fixStore.executeFix(
    projectId.value,
    selectedIssueForFix.value.episode,
    episode._id
  );
  
  if (fixStore.status === 'completed') {
    showFixProgress.value = false;
    showFixResult.value = true;
  } else if (fixStore.status === 'error') {
    showFixProgress.value = false;
  }
}

function cancelFix() {
  fixStore.cancelExecution();
  showFixProgress.value = false;
}

async function applyFix() {
  if (!selectedIssueForFix.value || !currentFixEpisodeId.value) return;
  
  const success = await fixStore.applyFix(
    projectId.value,
    currentFixEpisodeId.value,
    selectedIssueForFix.value.episode
  );
  
  if (success) {
    // 应用成功后，只从当前问题列表中移除已修复的问题
    // 不触发全局验证，让用户可以继续修复其他问题
    if (selectedIssueForFix.value) {
      removeFixedIssueFromList(selectedIssueForFix.value);
    }
  }
}

/**
 * 将问题标记为已修复
 */
function removeFixedIssueFromList(issue: ValidationIssue) {
  // 直接更新 validationStore.issues 数组
  const idx = validationStore.issues.findIndex(
    i => i.episode === issue.episode && 
         i.description === issue.description &&
         i.category === issue.category
  );
  if (idx !== -1) {
    // 更新状态为已修复，而不是删除
    validationStore.issues[idx]!.status = 'fixed';
    console.log('[ValidationPage] 问题状态已更新为已修复:', issue.description);
  } else {
    console.warn('[ValidationPage] 未找到要更新的问题:', issue);
  }
}

function discardFix() {
  showFixResult.value = false;
  fixStore.reset();
  selectedIssueForFix.value = null;
}

async function undoFix() {
  const success = await fixStore.undoFix();
  if (success) {
    // 撤销成功后，把问题状态恢复为待处理
    if (selectedIssueForFix.value) {
      const idx = validationStore.issues.findIndex(
        i => i.episode === selectedIssueForFix.value!.episode && 
             i.description === selectedIssueForFix.value!.description &&
             i.category === selectedIssueForFix.value!.category
      );
      if (idx !== -1) {
        validationStore.issues[idx]!.status = 'pending';
        console.log('[ValidationPage] 问题状态已恢复为待处理:', selectedIssueForFix.value.description);
      }
    }
    // 关闭面板
    showFixResult.value = false;
    selectedIssueForFix.value = null;
    fixStore.reset();
  }
}

function confirmFix() {
  // 用户确认修复，关闭面板
  showFixResult.value = false;
  selectedIssueForFix.value = null;
  fixStore.reset();
}

async function handleFixHistoryRevert(_historyId: string) {
  await fixStore.undoFix();
  // 回滚后不自动验证，用户可以手动触发
}

// ===== 批量选择方法 =====

function toggleIssueSelection(index: number) {
  if (selectedIssues.value.has(index)) {
    selectedIssues.value.delete(index);
  } else {
    selectedIssues.value.add(index);
  }
  selectedIssues.value = new Set(selectedIssues.value);
}

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedIssues.value.clear();
  } else {
    sortedIssues.value.forEach((_, index) => {
      selectedIssues.value.add(index);
    });
  }
  selectedIssues.value = new Set(selectedIssues.value);
}

function openBatchFixModal() {
  // 获取选中的问题，过滤掉 undefined
  const issues = Array.from(selectedIssues.value)
    .map(index => sortedIssues.value[index])
    .filter((issue): issue is NonNullable<typeof issue> => issue !== undefined);
  if (issues.length === 0) return;
  
  // 如果只选了一个，直接打开单个修复弹窗
  if (issues.length === 1) {
    openFixModal(issues[0]!);
    return;
  }
  
  // 打开批量修复弹窗
  showBatchFixModal.value = true;
}

// 获取批量修复的问题列表
const batchFixIssues = computed(() => {
  return Array.from(selectedIssues.value)
    .map(index => sortedIssues.value[index])
    .filter((issue): issue is NonNullable<typeof issue> => issue !== undefined);
});

// 批量修复完成回调
async function handleBatchFixComplete(successCount: number) {
  showBatchFixModal.value = false;
  selectedIssues.value.clear();
  selectedIssues.value = new Set(selectedIssues.value);
  
  if (successCount > 0) {
    // 刷新验证结果
    await handleValidate();
  }
}

function closeBatchFixModal() {
  showBatchFixModal.value = false;
}

// 生命周期
onMounted(async () => {
  // 加载最新验证报告
  try {
    await validationStore.loadLatestReport(projectId.value);
  } catch (err) {
    // 没有报告不算错误
  }
  // 加载历史报告
  await loadHistoryReports();
});

// 监听项目ID变化
watch(projectId, async () => {
  validationStore.reset();
  try {
    await validationStore.loadLatestReport(projectId.value);
  } catch (err) {
    // 没有报告不算错误
  }
  await loadHistoryReports();
});
</script>

<style scoped>
.validation-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-base);
  overflow: hidden;
}

/* ===== 页面标题栏 ===== */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-6);
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-default);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.page-header h1 {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--text-primary);
}

.range-badge {
  padding: var(--space-1) var(--space-3);
  background: var(--primary-muted);
  color: var(--primary);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
}

.header-actions {
  display: flex;
  gap: var(--space-3);
}

.action-btn {
  padding: var(--space-2) var(--space-4);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-btn.primary {
  background: var(--primary);
  color: var(--text-on-primary);
}

.action-btn.primary:hover:not(:disabled) {
  background: var(--primary-hover);
}

.action-btn.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.secondary {
  background: var(--bg-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}

.action-btn.secondary:hover {
  background: var(--bg-hover);
}

.action-btn.danger {
  background: var(--error);
  color: var(--text-on-primary);
}

.action-btn.danger:hover {
  opacity: 0.9;
}

/* ===== 进度弹窗 ===== */
.progress-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.progress-modal {
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  min-width: 420px;
  max-width: 500px;
  box-shadow: var(--shadow-xl);
}

.progress-modal h3 {
  margin: 0 0 var(--space-4);
  font-size: var(--text-xl);
  color: var(--text-primary);
  font-weight: 600;
}

.init-info {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
}

.init-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.init-label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.init-value {
  font-size: var(--text-base);
  color: var(--text-primary);
  font-weight: 500;
}

.progress-content {
  margin-top: var(--space-4);
}

.progress-status {
  font-size: var(--text-base);
  color: var(--text-primary);
  font-weight: 500;
  margin-bottom: var(--space-2);
}

.progress-detail {
  display: flex;
  gap: var(--space-2);
  font-size: var(--text-sm);
  margin-bottom: var(--space-3);
}

.detail-label {
  color: var(--text-tertiary);
}

.detail-value {
  color: var(--primary);
  font-weight: 500;
}

.progress-bar-container {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: var(--bg-hover);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--primary-hover));
  transition: width var(--transition-normal);
}

.progress-percent {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-weight: 500;
  min-width: 40px;
  text-align: right;
}

.progress-hint {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  border-left: 2px solid var(--primary);
}

.progress-loading {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--text-secondary);
  padding: var(--space-4) 0;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-default);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ===== 主内容区 ===== */
.page-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-6);
}

/* ===== 概览面板 ===== */
.overview-panel {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.no-report {
  padding: var(--space-8) var(--space-4);
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  text-align: center;
}

.no-report-icon {
  font-size: 48px;
  margin-bottom: var(--space-3);
}

.no-report-text {
  font-size: var(--text-lg);
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.no-report-hint {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.score-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-6);
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
}

.score-value {
  font-size: 56px;
  font-weight: 700;
  line-height: 1;
}

.score-value.excellent { color: var(--success); }
.score-value.good { color: var(--success); }
.score-value.average { color: var(--warning); }
.score-value.poor { color: var(--warning); }
.score-value.bad { color: var(--error); }

.score-label {
  margin-top: var(--space-2);
  font-size: var(--text-base);
  color: var(--text-secondary);
  font-weight: 500;
}

.summary-cards {
  display: flex;
  gap: var(--space-2);
}

.summary-card {
  flex: 1;
  padding: var(--space-3);
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
  font-size: var(--text-xl);
  font-weight: 600;
}

.summary-card.error .count { color: var(--error); }
.summary-card.warning .count { color: var(--warning); }
.summary-card.info .count { color: var(--primary); }

.summary-card .label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.global-stats {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
}

.global-icon {
  font-size: 20px;
}

.global-count {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.last-validation {
  padding: var(--space-3);
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  font-size: var(--text-sm);
}

.time-label {
  color: var(--text-tertiary);
  margin-right: var(--space-2);
}

.time-value {
  color: var(--text-secondary);
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

/* ===== 主面板 ===== */
.main-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  overflow: hidden;
}

.tab-nav {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-elevated);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tab-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.tab-btn.active {
  background: var(--primary-muted);
  color: var(--primary);
}

.tab-badge {
  padding: 2px 8px;
  background: var(--bg-hover);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
}

.tab-btn.active .tab-badge {
  background: var(--primary);
  color: var(--text-on-primary);
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
}

/* ===== 筛选器 ===== */
.filter-section {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  padding: var(--space-3);
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-4);
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
  border-color: var(--primary);
}

/* ===== 问题列表 ===== */
.issues-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.empty-state {
  padding: var(--space-12);
  text-align: center;
  color: var(--text-muted);
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-12);
  color: var(--text-secondary);
}

.issue-item {
  padding: var(--space-4);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.issue-item:hover {
  border-color: var(--border-hover);
}

.issue-item.error { border-left: 4px solid var(--error); }
.issue-item.warning { border-left: 4px solid var(--warning); }
.issue-item.info { border-left: 4px solid var(--primary); }

.issue-item.compact {
  padding: var(--space-3);
  cursor: default;
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

.issue-global-badge {
  padding: 2px var(--space-2);
  background: var(--primary-muted);
  color: var(--primary);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 500;
}

.issue-cross-episode-badge {
  padding: 2px var(--space-2);
  background: var(--warning-muted, var(--warning-muted));
  color: var(--warning, var(--warning));
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 500;
}

.issue-episode {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.issue-window {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.issue-category {
  padding: 2px var(--space-2);
  background: var(--bg-hover);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.expand-icon {
  margin-left: auto;
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.issue-description {
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
  color: var(--text-primary);
}

.issue-detail {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-default);
}

.issue-evidence {
  padding: var(--space-3);
  background: var(--bg-hover);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-style: italic;
  border-left: 2px solid var(--border-default);
  margin-bottom: var(--space-2);
}

.issue-suggestion {
  padding: var(--space-3);
  background: var(--success-muted);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--success);
  margin-bottom: var(--space-2);
}

.issue-location {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.detail-label {
  font-weight: 500;
  font-style: normal;
  margin-right: var(--space-1);
}

.jump-btn {
  margin-left: auto;
  padding: var(--space-1) var(--space-3);
  background: var(--primary);
  color: var(--text-on-primary);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  cursor: pointer;
}

.jump-btn:hover {
  background: var(--primary-hover);
}

/* ===== 按集数分组 ===== */
.episode-group {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-3);
  overflow: hidden;
}

.episode-group.has-errors {
  border-left: 4px solid var(--error);
}

.episode-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.episode-header:hover {
  background: var(--bg-hover);
}

.episode-title {
  font-weight: 500;
  color: var(--text-primary);
}

.episode-stats {
  display: flex;
  gap: var(--space-2);
  margin-left: auto;
}

.episode-stats .stat {
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
}

.episode-stats .stat.error {
  background: var(--error-muted);
  color: var(--error);
}

.episode-stats .stat.warning {
  background: var(--warning-muted);
  color: var(--warning);
}

.episode-stats .stat.info {
  background: var(--primary-muted);
  color: var(--primary);
}

.episode-issues {
  padding: 0 var(--space-4) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* ===== 历史报告 ===== */
.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.history-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
}

.history-item:hover {
  border-color: var(--border-hover);
}

.history-item.active {
  border-color: var(--primary);
  background: var(--primary-muted);
}

.history-main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-4);
  cursor: pointer;
}

.history-score {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  font-size: var(--text-lg);
  font-weight: 700;
  background: var(--bg-surface);
}

.history-score.excellent { color: var(--success); }
.history-score.good { color: var(--success); }
.history-score.average { color: var(--warning); }
.history-score.poor { color: var(--warning); }
.history-score.bad { color: var(--error); }

.history-info {
  flex: 1;
}

.history-rating {
  font-weight: 500;
  color: var(--text-primary);
}

.history-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: 2px;
}

.history-range {
  font-size: var(--text-xs);
  color: var(--primary);
  background: var(--primary-muted);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
}

.history-time {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.history-stats {
  display: flex;
  gap: var(--space-2);
}

.history-stats .stat {
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
}

.history-stats .stat.error {
  background: var(--error-muted);
  color: var(--error);
}

.history-stats .stat.warning {
  background: var(--warning-muted);
  color: var(--warning);
}

.history-stats .stat.info {
  background: var(--primary-muted);
  color: var(--primary);
}

.delete-btn {
  padding: var(--space-2);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  opacity: 0.5;
  transition: opacity var(--transition-fast);
}

.delete-btn:hover {
  opacity: 1;
}

/* ===== 弹窗 ===== */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-surface);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  min-width: 400px;
  max-width: 500px;
  box-shadow: var(--shadow-xl);
}

.modal-content h3 {
  margin: 0 0 var(--space-2);
  font-size: var(--text-lg);
  color: var(--text-primary);
}

.modal-content p {
  margin: 0 0 var(--space-4);
  color: var(--text-secondary);
}

.modal-hint {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.range-inputs {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: var(--space-4) 0;
}

.range-input {
  flex: 1;
}

.range-input label {
  display: block;
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin-bottom: var(--space-1);
}

.range-input input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.range-input input:focus {
  outline: none;
  border-color: var(--primary);
}

.range-separator {
  color: var(--text-tertiary);
  padding-top: var(--space-5);
}

.range-error {
  color: var(--error);
  font-size: var(--text-sm);
  margin-bottom: var(--space-3);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}

/* ===== 错误提示 ===== */
.error-toast {
  position: fixed;
  bottom: var(--space-6);
  right: var(--space-6);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--error);
  color: var(--text-on-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: 1001;
}

.error-toast button {
  background: transparent;
  border: none;
  color: var(--text-on-primary);
  font-size: var(--text-lg);
  cursor: pointer;
  opacity: 0.8;
}

.error-toast button:hover {
  opacity: 1;
}

/* ===== 响应式布局 ===== */
@media (max-width: 1024px) {
  .page-content {
    flex-direction: column;
  }

  .overview-panel {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
  }

  .score-card {
    flex: 1;
    min-width: 150px;
  }

  .summary-cards {
    flex: 2;
    min-width: 200px;
  }

  .no-report {
    flex: 1;
  }
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .header-actions {
    width: 100%;
  }

  .header-actions .action-btn {
    flex: 1;
  }

  .filter-section {
    flex-direction: column;
  }

  .overview-panel {
    flex-direction: column;
  }

  .score-card,
  .summary-cards,
  .no-report {
    width: 100%;
  }
}

.fix-btn {
  padding: var(--space-2) var(--space-4);
  background: var(--success);
  color: var(--text-on-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.fix-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.fix-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-6);
}

.fix-overlay > * {
  max-width: 800px;
  width: 100%;
}

/* ===== 批量选择样式 ===== */
.batch-actions {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-left: auto;
}

.select-all-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  cursor: pointer;
}

.select-all-label input {
  cursor: pointer;
}

.batch-fix-btn {
  padding: var(--space-2) var(--space-4);
  background: var(--success);
  color: var(--text-on-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.batch-fix-btn:hover {
  opacity: 0.9;
}

.issue-checkbox {
  cursor: pointer;
  width: 16px;
  height: 16px;
}

.issue-item.selected {
  background: var(--primary-muted);
  border-color: var(--primary);
}

/* ===== 问题状态标签样式 ===== */
.issue-status-wrapper {
  position: relative;
  margin-left: auto;
  margin-right: var(--space-2);
}

.issue-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.issue-status-badge:hover {
  opacity: 0.8;
}

.status-dropdown-icon {
  font-size: 8px;
  opacity: 0.6;
}

.status-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 100;
  min-width: 120px;
  overflow: hidden;
}

.status-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  color: var(--text-primary);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.status-option:hover {
  background: var(--bg-hover);
}

.status-option.active {
  background: var(--primary-muted);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

/* ===== 问题操作按钮样式 ===== */
.issue-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-default);
}

.ignore-btn,
.false-positive-btn {
  padding: var(--space-2) var(--space-3);
  background: var(--bg-hover);
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.ignore-btn:hover {
  background: var(--bg-active);
  color: var(--text-primary);
}

.false-positive-btn:hover {
  background: var(--purple-muted);
  border-color: var(--purple-border);
  color: var(--primary-hover);
}

/* ===== 剧本预览按钮样式 ===== */
.preview-btn {
  padding: var(--space-1) var(--space-3);
  background: var(--primary-muted);
  color: var(--primary);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--transition-fast);
  margin-left: var(--space-2);
}

.preview-btn:hover {
  background: var(--primary);
  color: var(--text-on-primary);
}

.issue-location-actions {
  display: flex;
  align-items: center;
  margin-top: var(--space-2);
}
</style>
