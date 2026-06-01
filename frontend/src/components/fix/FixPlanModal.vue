<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="modal-container fix-plan-modal">
      <div class="modal-header">
        <h3>🔧 修复方案</h3>
        <button class="close-btn" @click="handleClose">×</button>
      </div>

      <div class="issue-info">
        <div class="issue-header">
          <span :class="['issue-badge', `badge-${issue?.type}`]">
            {{ issueTypeLabel }}
          </span>
          <span class="issue-episode">第 {{ issue?.episode }} 集</span>
        </div>
        <p class="issue-description">{{ issue?.description }}</p>
        <p v-if="issue?.evidence" class="issue-evidence">
          <span class="label">原文引用：</span>{{ issue.evidence }}
        </p>
      </div>

      <div v-if="fixStore.analyzing" class="loading-state">
        <div class="spinner"></div>
        <p>正在分析问题并生成修复方案...</p>
      </div>

      <div v-else-if="fixStore.analysisResult" class="analysis-section">
        <div class="analysis-summary">
          <h4>📊 分析结果</h4>
          <p>{{ fixStore.analysisResult.analysis }}</p>
        </div>

        <div class="plans-section">
          <h4>💡 修复方案 ({{ fixStore.plans.length }})</h4>
          <div class="plans-list">
            <div
              v-for="plan in fixStore.sortedPlans"
              :key="plan.id"
              :class="['plan-card', { selected: fixStore.selectedPlan?.id === plan.id, recommended: plan.recommended }]"
              @click="fixStore.selectPlan(plan)"
            >
              <div class="plan-header">
                <span class="plan-name">
                  {{ plan.name }}
                  <span v-if="plan.recommended" class="recommend-tag">推荐</span>
                </span>
                <div class="confidence-bar">
                  <div class="confidence-track">
                    <div class="confidence-fill" :style="{ width: `${formatConfidence(plan.confidence)}%` }"></div>
                  </div>
                  <span class="confidence-text">{{ formatConfidence(plan.confidence) }}%</span>
                </div>
              </div>
              <p class="plan-description">{{ plan.description }}</p>

              <div v-if="fixStore.selectedPlan?.id === plan.id" class="plan-details">
                <div v-if="plan.changes?.length" class="changes-preview">
                  <h5>修改预览</h5>
                  <div v-for="(change, idx) in plan.changes.slice(0, 2)" :key="idx" class="change-item">
                    <div class="change-location">{{ change.location }}</div>
                    <div class="change-diff">
                      <div class="diff-old">{{ truncate(change.original, 100) }}</div>
                      <div class="diff-arrow">→</div>
                      <div class="diff-new">{{ truncate(change.modified, 100) }}</div>
                    </div>
                  </div>
                </div>
                <p v-if="plan.sideEffects" class="side-effects">
                  <span class="label">⚠️ 副作用：</span>{{ plan.sideEffects }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="custom-instruction">
          <h4>✏️ 补充说明（可选）</h4>
          <textarea
            v-model="customInstruction"
            placeholder="输入额外的修复要求或注意事项..."
            rows="2"
          ></textarea>
        </div>
      </div>

      <div v-else-if="fixStore.error" class="error-state">
        <p>❌ {{ fixStore.error }}</p>
        <button class="btn btn-secondary" @click="retryAnalysis">重试</button>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="handleClose">取消</button>
        <button
          class="btn btn-primary"
          :disabled="!fixStore.canExecute"
          @click="handleExecute"
        >
          执行修复
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useFixStore } from '@/stores/fixStore';
import type { ValidationIssue } from '@/types';

const props = defineProps<{
  visible: boolean;
  issue: ValidationIssue | null;
  projectId: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'execute', plan: any): void;
  (e: 'switchToCrossEpisode', issue: ValidationIssue): void;
}>();

const fixStore = useFixStore();
const customInstruction = ref('');

const issueTypeLabel = computed(() => {
  const labels: Record<string, string> = {
    critical: '严重',
    warning: '警告',
    info: '建议',
    error: '错误',
  };
  return labels[props.issue?.type || ''] || props.issue?.type;
});

/**
 * 检查是否需要切换到跨集修复
 * 基于 AI 分析结果判断：如果 affectedEpisodes 有多集，或者 plan.changes 涉及多集
 */
function shouldSwitchToCrossEpisode(): boolean {
  if (!fixStore.analysisResult) return false;
  
  // 检查 affectedEpisodes 是否有多集
  const affectedEpisodes = fixStore.analysisResult.affectedEpisodes || [];
  if (affectedEpisodes.length > 1) {
    console.log('[FixPlanModal] AI 分析结果显示涉及多集:', affectedEpisodes);
    return true;
  }
  
  // 检查 plans 中的 changes 是否涉及多集
  const plans = fixStore.plans || [];
  for (const plan of plans) {
    if (plan.changes && plan.changes.length > 0) {
      const episodesInChanges = [...new Set(plan.changes.map(c => c.episode))];
      if (episodesInChanges.length > 1) {
        console.log('[FixPlanModal] 修复方案涉及多集:', episodesInChanges);
        return true;
      }
    }
  }
  
  return false;
}

// 键盘快捷键处理
function handleKeydown(e: KeyboardEvent) {
  if (!props.visible) return;
  
  if (e.key === 'Escape') {
    handleClose();
  } else if (e.key === 'Enter' && e.ctrlKey && fixStore.canExecute) {
    handleExecute();
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});

// 监听弹窗打开，自动分析
watch(() => props.visible, async (visible) => {
  if (visible && props.issue) {
    customInstruction.value = '';
    await fixStore.analyzeIssue(props.projectId, props.issue);
    
    // 分析完成后，检查是否需要切换到跨集修复
    if (!fixStore.analyzing && !fixStore.error && shouldSwitchToCrossEpisode()) {
      console.log('[FixPlanModal] AI 分析结果表明需要跨集修复，切换到跨集修复弹窗');
      // 关闭当前弹窗，通知父组件切换到跨集修复
      fixStore.reset();
      emit('switchToCrossEpisode', props.issue);
    }
  }
});

// 同步自定义指令到 store
watch(customInstruction, (val) => {
  fixStore.setCustomInstruction(val);
});

function handleClose() {
  fixStore.reset();
  emit('close');
}

function handleExecute() {
  if (fixStore.selectedPlan) {
    emit('execute', fixStore.selectedPlan);
  }
}

function retryAnalysis() {
  if (props.issue) {
    fixStore.analyzeIssue(props.projectId, props.issue);
  }
}

function truncate(text: string, maxLength: number): string {
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}

/**
 * 格式化置信度显示
 * 处理 0-1 小数和 0-100 整数两种情况
 */
function formatConfidence(confidence: number): number {
  if (confidence <= 1) {
    // 0-1 的小数，转换为百分比
    return Math.round(confidence * 100);
  }
  // 已经是百分比
  return Math.round(confidence);
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
  z-index: var(--z-modal);
}

.fix-plan-modal {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 700px;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px var(--overlay-bg);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-elevated);
}

.modal-header h3 {
  margin: 0;
  font-size: var(--text-lg);
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: var(--text-primary);
}

.issue-info {
  padding: var(--space-4) var(--space-5);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-default);
}

.issue-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}

.issue-badge {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.badge-critical, .badge-error {
  background: var(--error-muted);
  color: var(--error);
}

.badge-warning {
  background: var(--warning-muted);
  color: var(--warning);
}

.badge-info {
  background: var(--info-muted);
  color: var(--info);
}

.issue-episode {
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.issue-description {
  margin: 0 0 var(--space-2);
  font-size: var(--text-md);
  line-height: var(--leading-normal);
  color: var(--text-primary);
}

.issue-evidence {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  background: var(--bg-base);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--warning);
}

.issue-evidence .label {
  font-weight: var(--font-medium);
  color: var(--warning);
}

.loading-state, .error-state {
  padding: var(--space-10) var(--space-5);
  text-align: center;
}

.loading-state p, .error-state p {
  color: var(--text-secondary);
  margin: 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-default);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto var(--space-4);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.analysis-section {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4) var(--space-5);
}

.analysis-summary {
  margin-bottom: var(--space-5);
}

.analysis-summary h4, .plans-section h4, .custom-instruction h4 {
  margin: 0 0 var(--space-3);
  font-size: var(--text-md);
  color: var(--text-primary);
  font-weight: var(--font-semibold);
}

.analysis-summary p {
  margin: 0;
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
  color: var(--text-secondary);
}

.plans-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.plan-card {
  border: 2px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  cursor: pointer;
  transition: all var(--transition-fast);
  background: var(--bg-base);
}

.plan-card:hover {
  border-color: var(--primary);
  background: var(--bg-elevated);
}

.plan-card.selected {
  border-color: var(--primary);
  background: var(--bg-elevated);
}

.plan-card.recommended {
  border-color: var(--success);
}

.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
}

.plan-name {
  font-weight: var(--font-semibold);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-primary);
}

.recommend-tag {
  background: var(--success);
  color: var(--text-on-primary);
  font-size: var(--text-xs);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-weight: var(--font-medium);
}

.confidence-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.confidence-track {
  width: 80px;
  height: 6px;
  background: var(--bg-hover);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.confidence-fill {
  height: 100%;
  background: var(--primary);
  border-radius: var(--radius-full);
  transition: width var(--transition-base);
}

.confidence-text {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  min-width: 32px;
}

.plan-description {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: var(--leading-normal);
}

.plan-details {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-default);
}

.changes-preview h5 {
  margin: 0 0 var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.change-item {
  margin-bottom: var(--space-2);
}

.change-location {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-bottom: var(--space-1);
}

.change-diff {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  font-size: var(--text-xs);
}

.diff-old {
  flex: 1;
  background: var(--error-muted);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  text-decoration: line-through;
  color: var(--error);
}

.diff-new {
  flex: 1;
  background: var(--success-muted);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  color: var(--success);
}

.diff-arrow {
  color: var(--text-tertiary);
  padding-top: var(--space-2);
}

.side-effects {
  margin: var(--space-2) 0 0;
  font-size: var(--text-sm);
  color: var(--warning);
}

.custom-instruction {
  margin-top: var(--space-5);
}

.custom-instruction textarea {
  width: 100%;
  padding: var(--space-3);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  resize: vertical;
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: inherit;
}

.custom-instruction textarea:focus {
  outline: none;
  border-color: var(--primary);
}

.custom-instruction textarea::placeholder {
  color: var(--text-tertiary);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--border-default);
  background: var(--bg-elevated);
}

.btn {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-secondary {
  background: var(--bg-hover);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--bg-active);
}

.btn-primary {
  background: var(--primary);
  border: none;
  color: var(--text-on-primary);
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
