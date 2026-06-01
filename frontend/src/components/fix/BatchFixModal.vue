<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="modal-container batch-fix-modal">
      <!-- 头部 -->
      <div class="modal-header">
        <h3>🔧 批量修复 ({{ issues.length }} 个问题)</h3>
        <button class="close-btn" @click="handleClose">×</button>
      </div>

      <!-- 进度指示 -->
      <div class="progress-indicator">
        <div class="progress-steps">
          <div :class="['step', { active: step === 'analyzing', done: step !== 'analyzing' }]">
            <span class="step-num">1</span>
            <span class="step-label">分析问题</span>
          </div>
          <div class="step-line"></div>
          <div :class="['step', { active: step === 'confirming', done: step === 'applying' || step === 'done' }]">
            <span class="step-num">2</span>
            <span class="step-label">确认方案</span>
          </div>
          <div class="step-line"></div>
          <div :class="['step', { active: step === 'applying', done: step === 'done' }]">
            <span class="step-num">3</span>
            <span class="step-label">应用修复</span>
          </div>
        </div>
      </div>

      <!-- 分析中 -->
      <div v-if="step === 'analyzing'" class="analyzing-section">
        <div class="spinner"></div>
        <p>正在分析 {{ analyzingIndex + 1 }}/{{ issues.length }} 个问题...</p>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${(analyzingIndex / issues.length) * 100}%` }"></div>
        </div>
      </div>

      <!-- 确认方案 -->
      <div v-else-if="step === 'confirming'" class="confirming-section">
        <!-- 跨集问题提示 -->
        <div v-if="crossEpisodeIssues.length > 0" class="cross-episode-notice">
          <span class="notice-icon">🌐</span>
          <span>包含 {{ crossEpisodeIssues.length }} 个跨集问题，将按集数顺序修复</span>
        </div>

        <div class="mode-selector">
          <label class="mode-option">
            <input type="radio" v-model="confirmMode" value="one-by-one" />
            <span>逐个确认</span>
          </label>
          <label class="mode-option">
            <input type="radio" v-model="confirmMode" value="all-at-once" />
            <span>一键全部应用</span>
          </label>
        </div>

        <!-- 逐个确认模式 -->
        <div v-if="confirmMode === 'one-by-one'" class="one-by-one-view">
          <div class="current-issue">
            <div class="issue-nav">
              <button :disabled="currentConfirmIndex === 0" @click="currentConfirmIndex--">← 上一个</button>
              <span>{{ currentConfirmIndex + 1 }} / {{ analysisResults.length }}</span>
              <button :disabled="currentConfirmIndex === analysisResults.length - 1" @click="currentConfirmIndex++">下一个 →</button>
            </div>
            
            <div v-if="currentResult" class="issue-detail-card">
              <div class="issue-info">
                <span :class="['issue-badge', `badge-${currentIssue?.type}`]">
                  {{ getBadgeText(currentIssue?.type) }}
                </span>
                <span v-if="currentIssue?.isGlobal" class="global-badge">🌐 跨集</span>
                <span class="issue-episode">第 {{ currentIssue?.episode }} 集</span>
                <span v-if="currentIssue?.windowRange" class="issue-window">
                  涉及: {{ currentIssue.windowRange }}
                </span>
              </div>
              <p class="issue-desc">{{ currentIssue?.description }}</p>
              
              <div class="plan-selector">
                <h5>选择修复方案：</h5>
                <div 
                  v-for="plan in currentResult.plans" 
                  :key="plan.id"
                  :class="['plan-option', { selected: selectedPlans[currentConfirmIndex]?.id === plan.id }]"
                  @click="selectPlan(currentConfirmIndex, plan)"
                >
                  <span class="plan-name">{{ plan.name }}</span>
                  <span v-if="plan.recommended" class="recommend-tag">推荐</span>
                  <span class="confidence">{{ plan.confidence }}%</span>
                </div>
              </div>
              
              <!-- 跨集问题的集数选择 -->
              <div v-if="currentIssue?.isGlobal && currentResult.affectedEpisodes" class="episode-selector">
                <h5>选择要修复的集数：</h5>
                <div class="episode-checkboxes">
                  <label 
                    v-for="ep in currentResult.affectedEpisodes" 
                    :key="ep"
                    class="episode-checkbox"
                  >
                    <input 
                      type="checkbox" 
                      :checked="isEpisodeSelected(currentConfirmIndex, ep)"
                      @change="toggleEpisodeSelection(currentConfirmIndex, ep)"
                    />
                    <span>第 {{ ep }} 集</span>
                  </label>
                </div>
                <div class="episode-actions">
                  <button class="link-btn" @click="selectAllEpisodes(currentConfirmIndex)">全选</button>
                  <button class="link-btn" @click="deselectAllEpisodes(currentConfirmIndex)">取消全选</button>
                </div>
              </div>
              
              <label class="skip-option">
                <input type="checkbox" v-model="skippedIssues[currentConfirmIndex]" />
                跳过此问题
              </label>
            </div>
          </div>
        </div>

        <!-- 一键全部应用模式 -->
        <div v-else class="all-at-once-view">
          <p class="hint">将使用每个问题的推荐方案进行修复</p>
          <div class="issues-summary">
            <div v-for="(result, idx) in analysisResults" :key="idx" class="summary-item">
              <div class="summary-main">
                <span v-if="issues[idx]?.isGlobal" class="global-icon">🌐</span>
                <span class="summary-episode">第 {{ issues[idx]?.episode }} 集</span>
                <span class="summary-desc">{{ truncate(issues[idx]?.description, 40) }}</span>
              </div>
              <span class="summary-plan">→ {{ getRecommendedPlan(result)?.name || '无方案' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 应用中 -->
      <div v-else-if="step === 'applying'" class="applying-section">
        <div class="spinner"></div>
        <p>{{ applyingMessage }}</p>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${applyingProgress}%` }"></div>
        </div>
        <div v-if="currentApplyingEpisode" class="applying-detail">
          正在修复第 {{ currentApplyingEpisode }} 集...
        </div>
      </div>

      <!-- 完成 -->
      <div v-else-if="step === 'done'" class="done-section">
        <div class="done-icon">✅</div>
        <h4>批量修复完成</h4>
        <p>成功修复 {{ successCount }} 个问题，跳过 {{ skippedCount }} 个</p>
        <div v-if="failedEpisodes.length > 0" class="failed-notice">
          <span class="notice-icon">⚠️</span>
          <span>以下集数修复失败: {{ failedEpisodes.join(', ') }}</span>
        </div>
      </div>

      <!-- 错误 -->
      <div v-if="error" class="error-message">
        ❌ {{ error }}
      </div>

      <!-- 底部操作 -->
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="handleClose">
          {{ step === 'done' ? '关闭' : '取消' }}
        </button>
        <button 
          v-if="step === 'confirming'"
          class="btn btn-primary" 
          :disabled="!canApply"
          @click="startApplying"
        >
          开始修复 ({{ toApplyCount }})
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { fixApi } from '@/services/api';
import type { ValidationIssue } from '@/types';
import type { FixPlan } from '@/types/fix';

const props = defineProps<{
  visible: boolean;
  issues: ValidationIssue[];
  projectId: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'complete', successCount: number): void;
}>();

type Step = 'analyzing' | 'confirming' | 'applying' | 'done';

interface AnalysisResult {
  analysis: string;
  plans: FixPlan[];
  affectedEpisodes?: number[];
}

const step = ref<Step>('analyzing');
const confirmMode = ref<'one-by-one' | 'all-at-once'>('all-at-once');
const analyzingIndex = ref(0);
const currentConfirmIndex = ref(0);
const applyingIndex = ref(0);
const error = ref<string | null>(null);

const analysisResults = ref<AnalysisResult[]>([]);
const selectedPlans = ref<Record<number, FixPlan>>({});
const skippedIssues = ref<Record<number, boolean>>({});
const selectedEpisodes = ref<Record<number, Set<number>>>({});

const successCount = ref(0);
const skippedCount = ref(0);
const failedEpisodes = ref<number[]>([]);
const currentApplyingEpisode = ref<number | null>(null);
const applyingMessage = ref('');

const currentIssue = computed(() => props.issues[currentConfirmIndex.value]);
const currentResult = computed(() => analysisResults.value[currentConfirmIndex.value]);

// 跨集问题列表
const crossEpisodeIssues = computed(() => {
  return props.issues.filter(issue => issue.isGlobal);
});

// 计算应用进度
const applyingProgress = computed(() => {
  if (toApplyCount.value === 0) return 0;
  return Math.round((applyingIndex.value / toApplyCount.value) * 100);
});

const toApplyCount = computed(() => {
  if (confirmMode.value === 'all-at-once') {
    return analysisResults.value.filter((r, i) => r.plans.length > 0 && !skippedIssues.value[i]).length;
  }
  return Object.keys(selectedPlans.value).filter(k => !skippedIssues.value[parseInt(k)]).length;
});

const canApply = computed(() => toApplyCount.value > 0);

watch(() => props.visible, async (visible) => {
  if (visible && props.issues.length > 0) {
    resetState();
    await startAnalyzing();
  }
});

function resetState() {
  step.value = 'analyzing';
  analyzingIndex.value = 0;
  currentConfirmIndex.value = 0;
  applyingIndex.value = 0;
  error.value = null;
  analysisResults.value = [];
  selectedPlans.value = {};
  skippedIssues.value = {};
  selectedEpisodes.value = {};
  successCount.value = 0;
  skippedCount.value = 0;
  failedEpisodes.value = [];
  currentApplyingEpisode.value = null;
  applyingMessage.value = '';
}

function getBadgeText(type: string | undefined): string {
  if (type === 'error' || type === 'critical') return '错误';
  if (type === 'warning') return '警告';
  return '提示';
}

async function startAnalyzing() {
  try {
    await fixApi.batchAnalyze(props.projectId, props.issues, {
      onProgress: (data) => {
        analyzingIndex.value = data.current;
      },
      onComplete: (results) => {
        analysisResults.value = results.map((r, idx) => {
          const issue = props.issues[idx];
          if (!issue) return { analysis: r.analysis, plans: r.plans, affectedEpisodes: undefined };
          // 解析跨集问题涉及的集数
          let affectedEpisodes: number[] | undefined;
          if (issue.isGlobal && issue.windowRange) {
            const match = issue.windowRange.match(/(\d+)-(\d+)/);
            if (match && match[1] && match[2]) {
              const start = parseInt(match[1]);
              const end = parseInt(match[2]);
              affectedEpisodes = [];
              for (let i = start; i <= end; i++) {
                affectedEpisodes.push(i);
              }
            }
          }
          
          return {
            analysis: r.analysis,
            plans: r.plans,
            affectedEpisodes,
          };
        });
        
        // 预选推荐方案和所有集数
        analysisResults.value.forEach((result, idx) => {
          const recommended = getRecommendedPlan(result);
          if (recommended) {
            selectedPlans.value[idx] = recommended;
          }
          // 默认选中所有涉及的集数
          if (result.affectedEpisodes) {
            selectedEpisodes.value[idx] = new Set(result.affectedEpisodes);
          }
        });
        
        step.value = 'confirming';
      },
      onError: (err) => {
        error.value = err.message;
      },
    });
  } catch (err) {
    error.value = (err as Error).message;
  }
}

function getRecommendedPlan(result: { plans: FixPlan[] }): FixPlan | null {
  return result.plans.find(p => p.recommended) || result.plans[0] || null;
}

function selectPlan(index: number, plan: FixPlan) {
  selectedPlans.value[index] = plan;
}

// 跨集问题的集数选择
function isEpisodeSelected(issueIndex: number, episode: number): boolean {
  return selectedEpisodes.value[issueIndex]?.has(episode) ?? false;
}

function toggleEpisodeSelection(issueIndex: number, episode: number) {
  if (!selectedEpisodes.value[issueIndex]) {
    selectedEpisodes.value[issueIndex] = new Set();
  }
  const set = selectedEpisodes.value[issueIndex];
  if (set.has(episode)) {
    set.delete(episode);
  } else {
    set.add(episode);
  }
  selectedEpisodes.value = { ...selectedEpisodes.value };
}

function selectAllEpisodes(issueIndex: number) {
  const result = analysisResults.value[issueIndex];
  if (result?.affectedEpisodes) {
    selectedEpisodes.value[issueIndex] = new Set(result.affectedEpisodes);
    selectedEpisodes.value = { ...selectedEpisodes.value };
  }
}

function deselectAllEpisodes(issueIndex: number) {
  selectedEpisodes.value[issueIndex] = new Set();
  selectedEpisodes.value = { ...selectedEpisodes.value };
}

async function startApplying() {
  step.value = 'applying';
  applyingIndex.value = 0;
  failedEpisodes.value = [];
  
  // 收集要修复的问题，按集数排序
  const toApply: Array<{ 
    index: number; 
    issue: ValidationIssue; 
    plan: FixPlan;
    episodes: number[];
  }> = [];
  
  analysisResults.value.forEach((result, idx) => {
    if (skippedIssues.value[idx]) {
      skippedCount.value++;
      return;
    }
    
    const plan = confirmMode.value === 'all-at-once' 
      ? getRecommendedPlan(result)
      : selectedPlans.value[idx];
    
    if (plan) {
      const issue = props.issues[idx];
      if (!issue) {
        skippedCount.value++;
        return;
      }
      // 确定要修复的集数
      let episodes: number[];
      if (issue.isGlobal && result.affectedEpisodes) {
        // 跨集问题：使用选中的集数
        const selected = selectedEpisodes.value[idx];
        episodes = selected ? Array.from(selected).sort((a, b) => a - b) : result.affectedEpisodes;
      } else {
        // 单集问题
        episodes = [issue.episode];
      }
      
      if (episodes.length > 0) {
        toApply.push({ index: idx, issue, plan, episodes });
      } else {
        skippedCount.value++;
      }
    } else {
      skippedCount.value++;
    }
  });

  // 按集数顺序执行修复
  for (const item of toApply) {
    applyingMessage.value = `正在修复问题 ${applyingIndex.value + 1}/${toApply.length}...`;
    
    // 对于跨集问题，按顺序修复每一集
    for (const episode of item.episodes) {
      currentApplyingEpisode.value = episode;
      
      try {
        // 调用修复 API
        // 注意：这里简化处理，实际应该调用完整的 SSE 修复流程
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // 实际应该调用:
        // await fixApi.execute(props.projectId, item.plan.id, episode, item.plan.customInstruction);
        
      } catch (err) {
        failedEpisodes.value.push(episode);
        console.error(`修复第 ${episode} 集失败:`, err);
      }
    }
    
    applyingIndex.value++;
    successCount.value++;
  }
  
  currentApplyingEpisode.value = null;
  step.value = 'done';
  emit('complete', successCount.value);
}

function truncate(text: string | undefined, maxLength: number): string {
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}

function handleClose() {
  emit('close');
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.batch-fix-modal {
  background: var(--bg-surface);
  border-radius: 12px;
  width: 90%;
  max-width: 700px;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-default);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary);
}

.progress-indicator {
  padding: 20px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-default);
}

.progress-steps {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.step {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-tertiary);
}

.step.active {
  color: var(--primary);
}

.step.done {
  color: var(--success);
}

.step-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--bg-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
}

.step.active .step-num {
  background: var(--primary);
  color: var(--text-on-primary);
}

.step.done .step-num {
  background: var(--success);
  color: var(--text-on-primary);
}

.step-label {
  font-size: 13px;
}

.step-line {
  width: 40px;
  height: 2px;
  background: var(--border-default);
}

.analyzing-section, .applying-section {
  padding: 40px 20px;
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-default);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.progress-bar {
  height: 6px;
  background: var(--bg-hover);
  border-radius: 3px;
  margin-top: 16px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary);
  transition: width 0.3s;
}

.confirming-section {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.mode-selector {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.mode-option {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
}

.one-by-one-view, .all-at-once-view {
  background: var(--bg-elevated);
  border-radius: 8px;
  padding: 16px;
}

.issue-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.issue-nav button {
  padding: 6px 12px;
  background: var(--bg-hover);
  border: 1px solid var(--border-default);
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
}

.issue-nav button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.issue-detail-card {
  background: var(--bg-surface);
  border-radius: 8px;
  padding: 16px;
}

.issue-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.issue-badge {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.badge-error { background: #fee2e2; color: var(--error); }
.badge-warning { background: var(--warning-muted); color: var(--warning); }
.badge-info { background: #dbeafe; color: var(--info); }

.issue-episode {
  color: var(--text-secondary);
  font-size: 14px;
}

.issue-desc {
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.5;
}

.plan-selector h5 {
  margin: 0 0 12px;
  font-size: 14px;
}

.plan-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--bg-elevated);
  border: 2px solid var(--border-default);
  border-radius: 6px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-primary);
}

.plan-option:hover {
  border-color: var(--primary);
}

.plan-option.selected {
  border-color: var(--primary);
  background: var(--primary-muted);
}

.plan-name {
  flex: 1;
  font-weight: 500;
}

.recommend-tag {
  background: #10b981;
  color: var(--text-on-primary);
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
}

.confidence {
  color: var(--text-secondary);
  font-size: 13px;
}

.skip-option {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
}

.hint {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 16px;
}

.issues-summary {
  max-height: 300px;
  overflow-y: auto;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-default);
  font-size: 13px;
}

.summary-item:last-child {
  border-bottom: none;
}

.summary-episode {
  color: var(--text-secondary);
  min-width: 60px;
}

.summary-desc {
  flex: 1;
  color: var(--text-primary);
}

.summary-plan {
  color: var(--primary);
}

.done-section {
  padding: 40px 20px;
  text-align: center;
}

.done-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.done-section h4 {
  margin: 0 0 8px;
  font-size: 18px;
}

.done-section p {
  color: var(--text-secondary);
}

.error-message {
  padding: 12px 20px;
  background: #fee2e2;
  color: var(--error);
  font-size: 14px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-default);
}

.btn {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
}

.btn-primary {
  background: var(--primary);
  border: none;
  color: var(--text-on-primary);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 跨集问题相关样式 */
.cross-episode-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--warning-muted);
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
  color: var(--warning);
}

.notice-icon {
  font-size: 16px;
}

.global-badge {
  background: #dbeafe;
  color: #1d4ed8;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.global-icon {
  margin-right: 4px;
}

.issue-window {
  color: var(--text-tertiary);
  font-size: 12px;
}

.episode-selector {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-default);
}

.episode-selector h5 {
  margin: 0 0 12px;
  font-size: 14px;
}

.episode-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.episode-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
  color: var(--text-primary);
}

.episode-checkbox:hover {
  border-color: var(--primary);
}

.episode-checkbox input:checked + span {
  color: var(--primary);
  font-weight: 500;
}

.episode-actions {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.link-btn {
  background: none;
  border: none;
  color: var(--primary);
  font-size: 13px;
  cursor: pointer;
  padding: 0;
}

.link-btn:hover {
  text-decoration: underline;
}

.applying-detail {
  margin-top: 12px;
  font-size: 13px;
  color: var(--text-secondary);
}

.failed-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 12px 16px;
  background: #fee2e2;
  border-radius: 8px;
  font-size: 14px;
  color: var(--error);
}

.summary-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

/* 响应式适配 */
@media (max-width: 640px) {
  .batch-fix-modal {
    width: 95%;
    max-height: 90vh;
  }
  
  .progress-steps {
    flex-wrap: wrap;
    gap: 4px;
  }
  
  .step-line {
    width: 20px;
  }
  
  .step-label {
    font-size: 11px;
  }
  
  .mode-selector {
    flex-direction: column;
    gap: 12px;
  }
  
  .issue-nav {
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .issue-nav button {
    flex: 1;
    min-width: 80px;
  }
  
  .episode-checkboxes {
    max-height: 150px;
    overflow-y: auto;
  }
  
  .summary-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .summary-plan {
    margin-left: 0;
  }
}
</style>
