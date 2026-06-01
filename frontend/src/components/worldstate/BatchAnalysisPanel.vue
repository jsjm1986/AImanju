<template>
  <div class="batch-analysis-panel">
    <!-- 头部 -->
    <div class="panel-header">
      <h3 class="panel-title">
        <span class="icon">📊</span>
        批量分析管理
      </h3>
    </div>

    <!-- 项目状态卡片 -->
    <div class="status-cards">
      <div class="status-card">
        <span class="card-value">{{ projectStats.totalEpisodes }}</span>
        <span class="card-label">总集数</span>
      </div>
      <div class="status-card">
        <span class="card-value">{{ projectStats.generatedEpisodes }}</span>
        <span class="card-label">已生成</span>
      </div>
      <div class="status-card">
        <span class="card-value">{{ projectStats.analyzedEpisodes }}</span>
        <span class="card-label">已分析</span>
      </div>
      <div class="status-card highlight">
        <span class="card-value">{{ projectStats.pendingAnalysis }}</span>
        <span class="card-label">待分析</span>
      </div>
    </div>

    <!-- 批量分析配置 -->
    <div class="config-section">
      <div class="section-header">
        <span class="icon">🔧</span>
        批量分析操作
      </div>

      <div class="config-form">
        <div class="form-row">
          <label>分析范围:</label>
          <div class="range-inputs">
            <span>从第</span>
            <input
              type="number"
              v-model.number="startEpisode"
              min="1"
              :max="projectStats.generatedEpisodes"
              class="episode-input"
            />
            <span>集 到第</span>
            <input
              type="number"
              v-model.number="endEpisode"
              :min="startEpisode"
              :max="projectStats.generatedEpisodes"
              class="episode-input"
            />
            <span>集</span>
          </div>
        </div>

        <div class="form-row options">
          <label class="checkbox-label">
            <input type="checkbox" v-model="options.autoUpdate" />
            <span>自动更新 WorldState</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="options.skipAnalyzed" />
            <span>跳过已分析的集数</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="options.forceReanalyze" />
            <span>强制重新分析所有</span>
          </label>
        </div>
      </div>

      <div class="action-buttons">
        <button
          class="btn-primary"
          :disabled="isAnalyzing"
          @click="handleStartAnalysis"
        >
          {{ isAnalyzing ? '分析中...' : '开始批量分析' }}
        </button>
        <button
          class="btn-secondary"
          :disabled="isAnalyzing || !canInitialize"
          @click="handleInitialize"
        >
          初始化 WorldState
        </button>
      </div>
    </div>

    <!-- 分析进度 -->
    <div v-if="isAnalyzing || analysisProgress.current > 0" class="progress-section">
      <div class="section-header">
        <span class="icon">📈</span>
        分析进度
      </div>

      <div class="progress-bar-container">
        <div
          class="progress-bar"
          :style="{ width: `${progressPercent}%` }"
        ></div>
      </div>
      <div class="progress-info">
        <span>{{ analysisProgress.current }}/{{ analysisProgress.total }}</span>
        <span>{{ progressPercent }}%</span>
      </div>

      <div v-if="currentAnalyzing" class="current-status">
        当前: 正在分析第 {{ currentAnalyzing }} 集...
      </div>

      <!-- 分析日志 -->
      <div class="log-section">
        <div class="log-header">分析日志:</div>
        <div class="log-content">
          <div
            v-for="(log, index) in analysisLogs"
            :key="index"
            class="log-item"
            :class="log.type"
          >
            <span class="log-icon">{{ log.type === 'success' ? '✅' : log.type === 'error' ? '❌' : '⏳' }}</span>
            <span class="log-text">{{ log.message }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 分析结果汇总 -->
    <div v-if="analysisResult" class="result-section">
      <div class="section-header">
        <span class="icon">📋</span>
        分析结果汇总
      </div>

      <div class="result-table">
        <div class="result-row">
          <span class="result-label">角色状态更新</span>
          <span class="result-value">{{ analysisResult.characterUpdates }} 次</span>
        </div>
        <div class="result-row">
          <span class="result-label">新埋伏笔</span>
          <span class="result-value">{{ analysisResult.newForeshadowings }} 个</span>
        </div>
        <div class="result-row">
          <span class="result-label">回收伏笔</span>
          <span class="result-value">{{ analysisResult.resolvedForeshadowings }} 个</span>
        </div>
      </div>

      <div class="result-actions">
        <button class="btn-secondary" @click="handleExportReport">
          导出分析报告
        </button>
        <button class="btn-secondary" @click="showDetailedLog = !showDetailedLog">
          {{ showDetailedLog ? '隐藏详细日志' : '查看详细日志' }}
        </button>
      </div>
    </div>

    <!-- 错误信息 -->
    <div v-if="error" class="error-state">
      <span class="error-icon">❌</span>
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { worldStateApi, episodeApi, projectApi } from '@/services/api';

const props = defineProps<{
  projectId: string;
}>();

const emit = defineEmits<{
  (e: 'initialized'): void;
  (e: 'analyzed'): void;
}>();

// 项目统计
const projectStats = ref({
  totalEpisodes: 0,
  generatedEpisodes: 0,
  analyzedEpisodes: 0,
  pendingAnalysis: 0,
});

// 分析配置
const startEpisode = ref(1);
const endEpisode = ref(35);
const options = ref({
  autoUpdate: true,
  skipAnalyzed: true,
  forceReanalyze: false,
});

// 分析状态
const isAnalyzing = ref(false);
const analysisProgress = ref({ current: 0, total: 0 });
const currentAnalyzing = ref<number | null>(null);
const analysisLogs = ref<Array<{ type: 'success' | 'error' | 'pending'; message: string }>>([]);
const analysisResult = ref<{
  characterUpdates: number;
  newForeshadowings: number;
  resolvedForeshadowings: number;
} | null>(null);

const showDetailedLog = ref(false);
const error = ref<string | null>(null);


// 是否可以初始化
const canInitialize = computed(() => {
  return projectStats.value.generatedEpisodes > 0;
});

// 进度百分比
const progressPercent = computed(() => {
  if (analysisProgress.value.total === 0) return 0;
  return Math.round((analysisProgress.value.current / analysisProgress.value.total) * 100);
});

// 开始批量分析
async function handleStartAnalysis() {
  if (!props.projectId) return;

  isAnalyzing.value = true;
  error.value = null;
  analysisLogs.value = [];
  analysisResult.value = null;

  const total = endEpisode.value - startEpisode.value + 1;
  analysisProgress.value = { current: 0, total };

  try {
    const response = await worldStateApi.analyzeBatch(
      props.projectId,
      startEpisode.value,
      endEpisode.value
    );

    const { data } = response;

    if (data.success) {
      // 使用真实API返回的数据
      let totalCharUpdates = 0;
      let totalForeshadowingPlanted = 0;
      let totalForeshadowingResolved = 0;

      data.episodes.forEach((ep, index) => {
        currentAnalyzing.value = ep.episode;
        analysisProgress.value.current = index + 1;

        // 添加真实日志
        analysisLogs.value.push({
          type: 'success',
          message: `第${ep.episode}集: 发现${ep.characterUpdates}个角色更新, ${ep.foreshadowingPlanted}个新伏笔, ${ep.foreshadowingResolved}个伏笔回收`,
        });

        totalCharUpdates += ep.characterUpdates;
        totalForeshadowingPlanted += ep.foreshadowingPlanted;
        totalForeshadowingResolved += ep.foreshadowingResolved;
      });

      // 设置真实结果
      analysisResult.value = {
        characterUpdates: totalCharUpdates,
        newForeshadowings: totalForeshadowingPlanted,
        resolvedForeshadowings: totalForeshadowingResolved,
      };

      emit('analyzed');
    } else {
      error.value = '分析失败';
    }
  } catch (e) {
    error.value = (e as Error).message;
    analysisLogs.value.push({
      type: 'error',
      message: `分析失败: ${(e as Error).message}`,
    });
  } finally {
    isAnalyzing.value = false;
    currentAnalyzing.value = null;
  }
}

// 初始化 WorldState
async function handleInitialize() {
  if (!props.projectId) return;

  try {
    await worldStateApi.initialize(props.projectId);
    emit('initialized');
  } catch (e) {
    error.value = (e as Error).message;
  }
}

// 导出报告
function handleExportReport() {
  // TODO: 实现导出功能
  console.log('Export report');
}

// 加载项目统计
async function loadProjectStats() {
  if (!props.projectId) return;

  try {
    // 获取项目信息
    const projectResponse = await projectApi.getById(props.projectId);
    const project = projectResponse.data?.data || projectResponse.data;

    // 获取所有剧集
    const episodesResponse = await episodeApi.getByProject(props.projectId);
    const episodes = episodesResponse.data?.data || episodesResponse.data || [];

    // 获取WorldState
    const worldStateResponse = await worldStateApi.get(props.projectId);

    // 计算统计数据
    const totalEpisodes = (project as { totalEpisodes?: number })?.totalEpisodes || 60;
    const generatedEpisodes = Array.isArray(episodes)
      ? episodes.filter((ep: { content?: string }) => ep.content && ep.content.length > 0).length
      : 0;
    const analyzedEpisodes = worldStateResponse.data.exists ? worldStateResponse.data.worldState?.episodeNumber || 0 : 0;

    projectStats.value = {
      totalEpisodes,
      generatedEpisodes,
      analyzedEpisodes,
      pendingAnalysis: Math.max(0, generatedEpisodes - analyzedEpisodes),
    };

    // 更新默认分析范围
    if (generatedEpisodes > 0) {
      endEpisode.value = generatedEpisodes;
    }
  } catch (e) {
    console.error('加载项目统计失败:', e);
  }
}

// 监听 projectId 变化
watch(() => props.projectId, () => {
  loadProjectStats();
});

onMounted(() => {
  loadProjectStats();
});
</script>

<style scoped>
.batch-analysis-panel {
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  overflow: hidden;
}

.panel-header {
  padding: var(--space-3) var(--space-4);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-default);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.icon {
  font-size: var(--text-base);
}

/* 状态卡片 */
.status-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-default);
}

.status-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  text-align: center;
}

.status-card.highlight {
  background: var(--primary-muted);
  border-color: var(--primary);
}

.card-value {
  display: block;
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--text-primary);
}

.status-card.highlight .card-value {
  color: var(--primary);
}

.card-label {
  font-size: 10px;
  color: var(--text-tertiary);
}

/* 配置区 */
.config-section {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-default);
}

.section-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-tertiary);
  margin-bottom: var(--space-3);
}

.config-form {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  margin-bottom: var(--space-3);
}

.form-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.form-row:last-child {
  margin-bottom: 0;
}

.form-row label {
  color: var(--text-tertiary);
  min-width: 80px;
}

.range-inputs {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.episode-input {
  width: 60px;
  padding: var(--space-2);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  text-align: center;
  font-size: var(--text-xs);
  background: var(--bg-surface);
  color: var(--text-primary);
}

.episode-input:focus {
  outline: none;
  border-color: var(--border-focus);
}

.form-row.options {
  flex-wrap: wrap;
  gap: var(--space-4);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  color: var(--text-primary);
}

.checkbox-label input {
  cursor: pointer;
  accent-color: var(--primary);
}

.action-buttons {
  display: flex;
  gap: var(--space-2);
}

.btn-primary,
.btn-secondary {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-xs);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-primary {
  background: var(--primary);
  color: var(--text-on-primary);
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn-secondary {
  background: var(--bg-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 进度区 */
.progress-section {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-default);
}

.progress-bar-container {
  height: 6px;
  background: var(--bg-hover);
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-bottom: var(--space-2);
}

.progress-bar {
  height: 100%;
  background: var(--primary);
  border-radius: var(--radius-sm);
  transition: width var(--transition-normal);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-bottom: var(--space-2);
}

.current-status {
  font-size: var(--text-xs);
  color: var(--primary);
  margin-bottom: var(--space-3);
}

.log-section {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.log-header {
  padding: var(--space-2) var(--space-3);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-tertiary);
  background: var(--bg-hover);
  border-bottom: 1px solid var(--border-default);
}

.log-content {
  max-height: 150px;
  overflow-y: auto;
  padding: var(--space-2) var(--space-3);
}

.log-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  font-size: 10px;
  padding: var(--space-1) 0;
  border-bottom: 1px solid var(--border-default);
}

.log-item:last-child {
  border-bottom: none;
}

.log-icon {
  flex-shrink: 0;
}

.log-text {
  color: var(--text-secondary);
}

.log-item.error .log-text {
  color: var(--error);
}

/* 结果区 */
.result-section {
  padding: var(--space-3) var(--space-4);
}

.result-table {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-bottom: var(--space-3);
}

.result-row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-3);
  font-size: var(--text-xs);
  border-bottom: 1px solid var(--border-default);
}

.result-row:last-child {
  border-bottom: none;
}

.result-row.warning {
  background: var(--warning-muted);
}

.result-label {
  color: var(--text-tertiary);
}

.result-value {
  font-weight: 500;
  color: var(--text-primary);
}

.result-row.warning .result-value {
  color: var(--warning);
}

.result-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
}

/* 错误状态 */
.error-state {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--error-muted);
  color: var(--error);
  font-size: var(--text-xs);
}
</style>
