<template>
  <Modal
    :show="visible"
    :title="modalTitle"
    width="1200px"
    max-width="95vw"
    @close="handleClose"
  >
    <div class="cross-episode-fix">
      <div class="steps">
        <div
          v-for="(step, index) in steps"
          :key="step.key"
          class="step"
          :class="{
            active: currentStepIndex === index,
            completed: currentStepIndex > index,
          }"
        >
          <span class="step-number">{{ index + 1 }}</span>
          <span class="step-label">{{ step.label }}</span>
        </div>
      </div>

      <div class="step-content">
        <div v-if="status === 'analyzing'" class="analyzing">
          <Loading text="正在分析跨集问题..." />
          <p class="hint">识别相关集数和伏笔关联...</p>
        </div>

        <div v-else-if="status === 'selecting'" class="selecting">
          <div class="analysis-section">
            <h4>问题分析</h4>
            <div class="issue-info">
              <span class="issue-type">{{ getCategoryLabel(currentIssue?.category || currentIssue?.type) }}</span>
              <span class="issue-desc">{{ currentIssue?.description }}</span>
            </div>

            <div class="affected-episodes">
              <h5>涉及集数</h5>
              <div class="episode-tags">
                <span
                  v-for="ep in fixStore.affectedEpisodes"
                  :key="ep.episodeNumber"
                  class="episode-tag"
                  :class="ep.role"
                >
                  第{{ ep.episodeNumber }}集
                  <span class="role-label">{{ getRoleLabel(ep.role) }}</span>
                </span>
              </div>
            </div>
          </div>

          <div class="plans-section">
            <h4>修复方案</h4>
            <div class="plans-list">
              <div
                v-for="plan in fixStore.sortedCrossEpisodePlans"
                :key="plan.id"
                class="plan-card"
                :class="{ selected: fixStore.selectedCrossEpisodePlan?.id === plan.id }"
                @click="fixStore.selectCrossEpisodePlan(plan)"
              >
                <div class="plan-header">
                  <span class="plan-name">{{ plan.name }}</span>
                  <span v-if="plan.recommended" class="recommended-badge">推荐</span>
                  <span class="confidence">{{ formatConfidence(plan.confidence) }}%</span>
                </div>
                <p class="plan-desc">{{ plan.description }}</p>
                <div v-if="plan.sideEffects" class="side-effects">
                  ⚠️ {{ plan.sideEffects }}
                </div>
              </div>
            </div>
          </div>

          <div class="custom-instruction">
            <label>补充要求（可选）</label>
            <textarea
              v-model="customInstruction"
              placeholder="如有特殊要求，请在此说明..."
              rows="2"
            />
          </div>
        </div>

        <div v-else-if="status === 'executing'" class="executing">
          <div class="executing-header">
            <div class="executing-status">
              <span class="status-icon">⚡</span>
              <span v-if="fixStore.currentExecutingEpisode">
                正在修复第 {{ fixStore.currentExecutingEpisode }} 集...
              </span>
              <span v-else>准备修复...</span>
            </div>
            <div class="executing-progress">
              <span class="progress-text">{{ fixStore.executeProgress }}%</span>
            </div>
          </div>

          <div class="stream-output">
            <div class="stream-header">
              <span class="stream-icon">🤖</span>
              <span class="stream-title">AI 正在生成修复内容</span>
            </div>
            <div class="stream-content" ref="streamContentRef">
              <pre>{{ fixStore.streamContent || '等待 AI 响应...' }}</pre>
            </div>
          </div>

          <div class="progress-bar-mini">
            <div class="progress-fill" :style="{ width: fixStore.executeProgress + '%' }" />
          </div>
        </div>

        <div v-else-if="status === 'previewing'" class="previewing">
          <MultiEpisodePreview
            :results="fixStore.multiEpisodeResults"
            :affected-episodes="fixStore.affectedEpisodes"
            v-model:excluded-episodes="excludedEpisodes"
          />
        </div>

        <div v-else-if="status === 'completed'" class="completed">
          <div class="success-icon">✓</div>
          <h3>修复已应用</h3>
          <p>已成功修复 {{ appliedEpisodesCount }} 集剧本</p>

          <ForeshadowingUpdatePanel
            v-if="fixStore.relatedForeshadowings.length > 0"
            :foreshadowings="fixStore.relatedForeshadowings"
            @update="(updates) => fixStore.updateForeshadowingStatus(updates)"
          />

          <TargetedValidationResult
            v-if="fixStore.validationResult"
            :result="fixStore.validationResult"
          />

          <div v-if="fixStore.canUndo" class="undo-hint">
            <button class="btn-undo" @click="fixStore.revertCrossEpisodeFix()">
              撤销修复 ({{ fixStore.undoCountdown }}s)
            </button>
          </div>
        </div>

        <div v-else-if="status === 'error'" class="error-state">
          <div class="error-icon">✕</div>
          <p>{{ fixStore.error }}</p>
          <button class="btn-retry" @click="handleRetry">重试</button>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="handleClose">
          {{ isCompleted ? '关闭' : '取消' }}
        </button>

        <button
          v-if="status === 'selecting'"
          class="btn-primary"
          :disabled="!fixStore.canExecuteCrossEpisode"
          @click="handleExecute"
        >
          开始修复
        </button>

        <button
          v-if="status === 'previewing'"
          class="btn-primary"
          :disabled="!fixStore.canApplyCrossEpisode"
          @click="handleApply"
        >
          应用修复
        </button>

        <button
          v-if="status === 'completed' && !fixStore.validationResult"
          class="btn-secondary"
          @click="fixStore.validateCrossEpisodeFix(projectId)"
        >
          验证效果
        </button>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useFixStore } from '@/stores/fixStore';
import Modal from '@/components/common/Modal.vue';
import Loading from '@/components/common/Loading.vue';
import MultiEpisodePreview from './MultiEpisodePreview.vue';
import ForeshadowingUpdatePanel from './ForeshadowingUpdatePanel.vue';
import TargetedValidationResult from './TargetedValidationResult.vue';
import type { ValidationIssue } from '@/types';

const props = defineProps<{
  visible: boolean;
  projectId: string;
  issue: ValidationIssue | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'fixed'): void;
}>();

const fixStore = useFixStore();
const status = computed(() => fixStore.crossEpisodeStatus);

const customInstruction = ref('');
const excludedEpisodes = ref<number[]>([]);
const streamContentRef = ref<HTMLElement | null>(null);

watch(() => fixStore.streamContent, () => {
  nextTick(() => {
    if (streamContentRef.value) {
      streamContentRef.value.scrollTop = streamContentRef.value.scrollHeight;
    }
  });
});

const steps = [
  { key: 'analyze', label: '分析问题' },
  { key: 'select', label: '选择方案' },
  { key: 'execute', label: '执行修复' },
  { key: 'preview', label: '预览结果' },
  { key: 'complete', label: '完成' },
];

const stepIndexMap: Record<string, number> = {
  analyzing: 0, selecting: 1, executing: 2, previewing: 3,
  applying: 4, validating: 4, completed: 4,
};

const currentStepIndex = computed(() => stepIndexMap[status.value] ?? 0);

const titleMap: Record<string, string> = {
  analyzing: '分析跨集问题', selecting: '选择修复方案',
  executing: '执行修复中', previewing: '预览修复结果',
  applying: '应用修复中', validating: '验证修复效果',
  completed: '修复完成', error: '修复失败',
};

const modalTitle = computed(() => titleMap[status.value] || '跨集联动修复');

const currentIssue = computed(() => props.issue || fixStore.currentIssue);
const isCompleted = computed(() => status.value === 'completed' || status.value === 'error');
const appliedEpisodesCount = computed(() =>
  fixStore.multiEpisodeResults.length - excludedEpisodes.value.length
);

watch(() => props.visible, (val) => {
  if (val && props.issue) {
    fixStore.analyzeCrossEpisodeIssue(props.projectId, props.issue);
  }
});

const roleLabels: Record<string, string> = { source: '源头', bridge: '铺垫', resolution: '回收' };

function getRoleLabel(role: string): string {
  return roleLabels[role] || role;
}

const categoryLabels: Record<string, string> = {
  continuity: '连续性', dialogue: '对话', pacing: '节奏', unresolved: '未解决',
  character: '角色', plot: '剧情', worldbuilding: '世界观', foreshadowing: '伏笔',
  consistency: '一致性', logic: '逻辑', timeline: '时间线', relationship: '关系',
  emotion: '情感', action: '动作', setting: '场景',
  critical: '严重', warning: '警告', info: '提示',
};

function getCategoryLabel(category?: string): string {
  return category ? (categoryLabels[category] || category) : '未知';
}

function formatConfidence(confidence: number): number {
  return Math.round(confidence > 1 ? confidence : confidence * 100);
}

function handleExecute() {
  fixStore.setCustomInstruction(customInstruction.value);
  fixStore.executeCrossEpisodeFix(props.projectId);
}

async function handleApply() {
  const success = await fixStore.applyCrossEpisodeFix(props.projectId, {
    excludeEpisodes: excludedEpisodes.value,
  });
  if (success) emit('fixed');
}

function handleRetry() {
  if (props.issue) {
    fixStore.analyzeCrossEpisodeIssue(props.projectId, props.issue);
  }
}

function handleClose() {
  fixStore.resetCrossEpisode();
  emit('close');
}
</script>

<style scoped>
.cross-episode-fix {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.steps {
  display: flex;
  justify-content: space-between;
  padding: 0 20px;
  margin-bottom: 10px;
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

.step.completed {
  color: var(--success);
}

.step-number {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--bg-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
}

.step.active .step-number {
  background: var(--primary);
  color: var(--text-on-primary);
}

.step.completed .step-number {
  background: var(--success);
  color: var(--text-on-primary);
}

.step-label {
  font-size: 13px;
}

.step-content {
  min-height: 450px;
  max-height: 65vh;
  padding: 24px;
  background: var(--bg-elevated);
  border-radius: 12px;
  overflow-y: auto;
}

.analyzing {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
}

.analyzing .hint {
  color: var(--text-secondary);
  font-size: 14px;
}

.selecting {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.analysis-section h4,
.plans-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.issue-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-elevated);
  border-radius: 6px;
}

.issue-type {
  padding: 4px 8px;
  background: var(--error-muted);
  color: var(--error);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.issue-desc {
  color: var(--text-primary);
  font-size: 14px;
}

.affected-episodes {
  margin-top: 16px;
}

.affected-episodes h5 {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.episode-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.episode-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-elevated);
  border-radius: 16px;
  font-size: 13px;
}

.episode-tag.source {
  background: var(--error-muted);
  color: var(--error);
}

.episode-tag.bridge {
  background: var(--warning-muted);
  color: var(--warning);
}

.episode-tag.resolution {
  background: var(--success-muted);
  color: var(--success);
}

.role-label {
  font-size: 11px;
  opacity: 0.8;
}

.plans-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 280px;
  overflow-y: auto;
}

.plan-card {
  padding: 16px;
  background: var(--bg-surface);
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.plan-card:hover {
  border-color: var(--border-hover);
}

.plan-card.selected {
  border-color: var(--primary);
  background: var(--primary-muted);
}

.plan-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.plan-name {
  font-weight: 600;
  color: var(--text-primary);
}

.recommended-badge {
  padding: 2px 6px;
  background: var(--primary);
  color: var(--text-on-primary);
  border-radius: 4px;
  font-size: 11px;
}

.confidence {
  margin-left: auto;
  color: var(--text-secondary);
  font-size: 13px;
}

.plan-desc {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.side-effects {
  margin-top: 8px;
  padding: 8px;
  background: var(--warning-muted);
  color: var(--warning);
  border-radius: 4px;
  font-size: 12px;
}

.custom-instruction {
  margin-top: 16px;
}

.custom-instruction label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.custom-instruction textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 14px;
  resize: vertical;
}

.executing {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

.executing-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--bg-elevated);
  border-radius: 8px;
}

.executing-status {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--text-primary);
}

.status-icon {
  font-size: 18px;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.executing-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
}

.stream-output {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  overflow: hidden;
  min-height: 300px;
}

.stream-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-default);
}

.stream-icon {
  font-size: 16px;
}

.stream-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.stream-content {
  flex: 1;
  padding: 16px;
  overflow: auto;
  max-height: 350px;
}

.stream-content pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'SF Mono', Monaco, 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-primary);
}

.progress-bar-mini {
  height: 4px;
  background: var(--bg-elevated);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar-mini .progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--success));
  transition: width 0.3s;
}

.completed {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
}

.success-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--success-muted);
  color: var(--success);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
}

.completed h3 {
  margin: 0;
  color: var(--text-primary);
}

.completed p {
  margin: 0;
  color: var(--text-secondary);
}

.undo-hint {
  margin-top: 16px;
}

.btn-undo {
  padding: 8px 16px;
  background: var(--warning-muted);
  color: var(--warning);
  border: 1px solid var(--warning);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  height: 100%;
}

.error-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--error-muted);
  color: var(--error);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
}

.error-state p {
  color: var(--error);
  margin: 0;
}

.btn-retry {
  padding: 8px 16px;
  background: var(--primary);
  color: var(--text-on-primary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--border-default);
}

.btn-primary {
  padding: 10px 20px;
  background: var(--primary);
  color: var(--text-on-primary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  padding: 10px 20px;
  background: var(--bg-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
</style>
