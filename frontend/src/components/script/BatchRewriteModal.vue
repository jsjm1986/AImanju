<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="batch-rewrite-overlay" @click.self="handleClose">
        <div class="batch-rewrite-modal">
          <div class="modal-header">
            <div class="header-left">
              <span class="header-icon">📚</span>
              <h3>批量连贯改写</h3>
            </div>
            <button class="close-btn" @click="handleClose" :disabled="isBusy">
              <span>×</span>
            </button>
          </div>

          <div class="steps-indicator">
            <div
              v-for="(step, index) in steps"
              :key="step.key"
              class="step-item"
              :class="{
                active: store.currentStep === step.key,
                completed: stepIndex(step.key) < currentStepIndex,
                clickable: canGoToStep(step.key)
              }"
              @click="canGoToStep(step.key) && store.goToStep(step.key)"
            >
              <div class="step-number">{{ index + 1 }}</div>
              <div class="step-info">
                <span class="step-title">{{ step.title }}</span>
                <span class="step-desc">{{ step.desc }}</span>
              </div>
            </div>
          </div>

          <div class="modal-body">
            <div v-if="store.currentStep === 'select'" class="step-content">
              <EpisodeRangeSelector
                :episodes="episodes"
                :selected-range="store.episodeRange"
                @update:range="({ start, end }) => store.setEpisodeRange(start, end)"
              />
            </div>

            <div v-if="store.currentStep === 'instruction'" class="step-content">
              <InstructionEditor
                :instruction="store.instruction"
                @update:instruction="store.setInstruction"
              />
            </div>

            <div v-if="store.currentStep === 'plan'" class="step-content">
              <RewritePlanPreview
                :plan="store.plan"
                :loading="store.loading"
                :is-generating="store.isGeneratingPlan"
                :stage="store.planGenerationStage"
                :stage-detail="store.planGenerationDetail"
                :streaming-content="store.planStreamingContent"
                @regenerate="handleGeneratePlan"
              />
            </div>

            <div v-if="store.currentStep === 'execute'" class="step-content">
              <BatchRewriteProgress
                :status="store.status"
                :current-episode="store.currentEpisode"
                :total-episodes="store.totalEpisodes"
                :progress="store.progress"
                :streaming-content="store.streamingContent"
                :episode-results="store.episodeResults"
                :execution-stage="store.executionStage"
                :execution-message="store.executionMessage"
              />
            </div>

            <div v-if="store.currentStep === 'review'" class="step-content">
              <BatchReviewPanel
                :result="store.result"
                :episode-results="store.episodeResults"
                @apply="handleApply()"
                @apply-selected="handleApply($event)"
                @rollback="handleRollback"
              />
            </div>
          </div>

          <div class="modal-footer">
            <div v-if="store.error" class="error-banner">
              <span class="error-icon">⚠️</span>
              <span>{{ store.error }}</span>
            </div>

            <div class="footer-actions">
              <button
                v-if="canGoPrev"
                class="btn-secondary"
                @click="store.prevStep"
                :disabled="store.loading || store.executing"
              >
                ← 上一步
              </button>

              <div class="spacer"></div>

              <button class="btn-cancel" @click="handleClose" :disabled="isBusy">
                取消
              </button>

              <button
                v-if="store.currentStep === 'select'"
                class="btn-primary"
                @click="store.nextStep()"
                :disabled="!store.hasEpisodeRange"
              >
                下一步 →
              </button>

              <button
                v-else-if="store.currentStep === 'instruction'"
                class="btn-primary"
                @click="handleGeneratePlan"
                :disabled="!store.hasInstruction || store.loading || store.isGeneratingPlan"
              >
                <span v-if="store.loading || store.isGeneratingPlan">生成中...</span>
                <span v-else>生成计划 →</span>
              </button>

              <button
                v-else-if="store.currentStep === 'plan'"
                class="btn-primary"
                @click="handleExecute"
                :disabled="!store.hasPlan || store.executing || store.isGeneratingPlan"
              >
                开始改写 →
              </button>

              <button
                v-else-if="store.currentStep === 'review'"
                class="btn-success"
                @click="handleApply()"
                :disabled="store.loading"
              >
                ✓ 应用全部
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch, onUnmounted } from 'vue';
import { useBatchRewriteStore, type BatchRewriteStep } from '@/stores/batchRewriteStore';
import type { Episode } from '@/types';
import EpisodeRangeSelector from './EpisodeRangeSelector.vue';
import InstructionEditor from './InstructionEditor.vue';
import RewritePlanPreview from './RewritePlanPreview.vue';
import BatchRewriteProgress from './BatchRewriteProgress.vue';
import BatchReviewPanel from './BatchReviewPanel.vue';

const props = defineProps<{
  visible: boolean;
  projectId: string;
  episodes: Episode[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'applied'): void;
}>();

const store = useBatchRewriteStore();

const steps = [
  { key: 'select' as const, title: '选择集数', desc: '选择要改写的集数范围' },
  { key: 'instruction' as const, title: '改写指令', desc: '输入改写要求' },
  { key: 'plan' as const, title: '预览计划', desc: '查看改写计划' },
  { key: 'execute' as const, title: '执行改写', desc: '批量改写中' },
  { key: 'review' as const, title: '审核结果', desc: '确认并应用' },
];

const stepKeys = steps.map(s => s.key);

function stepIndex(step: BatchRewriteStep): number {
  return stepKeys.indexOf(step);
}

const currentStepIndex = computed(() => stepIndex(store.currentStep));

const isBusy = computed(() => store.executing || store.isGeneratingPlan);

const canGoPrev = computed(() => {
  return currentStepIndex.value > 0 && store.currentStep !== 'execute' && !store.isGeneratingPlan;
});

function canGoToStep(step: BatchRewriteStep): boolean {
  if (isBusy.value) return false;
  return stepIndex(step) < currentStepIndex.value;
}

async function handleGeneratePlan() {
  store.goToStep('plan');
  try {
    await store.generatePlan(props.projectId);
  } catch (err) {
    console.error('生成计划失败:', err);
  }
}

async function handleExecute() {
  store.goToStep('execute');
  try {
    await store.executeRewrite(props.projectId);
    store.goToStep('review');
  } catch (err) {
    console.error('执行改写失败:', err);
  }
}

async function handleApply(selectedEpisodes?: number[]) {
  if (!store.result) return;
  try {
    await store.applyResults(props.projectId, store.result.id, selectedEpisodes);
    emit('applied');
    emit('close');
  } catch (err) {
    console.error('应用改写失败:', err);
  }
}

async function handleRollback() {
  if (!store.result) return;
  try {
    await store.rollback(props.projectId, store.result.id);
    store.reset();
  } catch (err) {
    console.error('回滚失败:', err);
  }
}

function handleClose() {
  if (isBusy.value) return;
  emit('close');
}

watch(() => props.visible, (v) => {
  if (!v) store.reset();
});

onUnmounted(() => {
  store.reset();
});
</script>

<style scoped>
.modal-enter-active, .modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-active .batch-rewrite-modal, .modal-leave-active .batch-rewrite-modal {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .batch-rewrite-modal, .modal-leave-to .batch-rewrite-modal {
  transform: scale(0.95) translateY(-10px);
  opacity: 0;
}

.batch-rewrite-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-5);
}

.batch-rewrite-modal {
  background: var(--bg-surface);
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-default);
  box-shadow: 0 24px 48px var(--overlay-bg);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  background: linear-gradient(135deg, var(--primary-muted) 0%, transparent 100%);
  border-bottom: 1px solid var(--border-default);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.header-icon { font-size: 20px; }

.modal-header h3 {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--bg-elevated);
  font-size: 20px;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast);
}

.close-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.close-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 步骤指示器 */
.steps-indicator {
  display: flex;
  padding: var(--space-4) var(--space-5);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-default);
  gap: var(--space-2);
}

.step-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  transition: all var(--duration-fast);
}

.step-item.clickable {
  cursor: pointer;
}

.step-item.clickable:hover {
  background: var(--bg-hover);
}

.step-item.active {
  background: var(--primary-muted);
}

.step-item.completed .step-number {
  background: var(--success);
  color: var(--text-on-primary);
}

.step-number {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--bg-surface);
  border: 2px solid var(--border-default);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.step-item.active .step-number {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--text-on-primary);
}

.step-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.step-title {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.step-desc {
  font-size: 11px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-5);
}

.step-content {
  min-height: 300px;
}

.modal-footer {
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--border-default);
  background: var(--bg-elevated);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.error-banner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--error-muted);
  border: 1px solid var(--error-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--error);
}

.error-icon { font-size: 14px; }

.footer-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.spacer { flex: 1; }

.btn-primary, .btn-success, .btn-secondary, .btn-cancel {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.btn-primary {
  background: var(--primary);
  color: var(--text-on-primary);
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn-success {
  background: var(--success);
  color: var(--text-on-primary);
}

.btn-success:hover:not(:disabled) {
  background: var(--success);
}

.btn-secondary {
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-hover);
}

.btn-cancel {
  background: transparent;
  color: var(--text-secondary);
}

.btn-cancel:hover:not(:disabled) {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.btn-primary:disabled, .btn-success:disabled, .btn-secondary:disabled, .btn-cancel:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
