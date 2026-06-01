<template>
  <div class="progress-tracker" :class="{ compact }">
    <!-- 进度条 -->
    <div class="progress-bar-container">
      <div class="progress-bar" :style="{ width: `${percentage}%` }">
        <div v-if="showStripes" class="progress-stripes"></div>
      </div>
    </div>

    <!-- 进度信息 -->
    <div class="progress-info">
      <div class="progress-text">
        <span v-if="label" class="progress-label">{{ label }}</span>
        <span class="progress-status">{{ statusText }}</span>
      </div>
      <div class="progress-percentage">{{ percentage }}%</div>
    </div>

    <!-- 详细信息 -->
    <div v-if="showDetails && details" class="progress-details">
      <div v-if="details.currentStep" class="detail-item">
        <span class="detail-label">当前步骤:</span>
        <span class="detail-value">{{ details.currentStep }}</span>
      </div>
      <div v-if="details.elapsed" class="detail-item">
        <span class="detail-label">已用时间:</span>
        <span class="detail-value">{{ formatTime(details.elapsed) }}</span>
      </div>
      <div v-if="details.estimated" class="detail-item">
        <span class="detail-label">预计剩余:</span>
        <span class="detail-value">{{ formatTime(details.estimated) }}</span>
      </div>
    </div>

    <!-- 步骤列表 -->
    <div v-if="showSteps && steps.length > 0" class="steps-container">
      <div
        v-for="(step, index) in steps"
        :key="index"
        class="step-item"
        :class="{
          completed: step.status === 'completed',
          active: step.status === 'active',
          pending: step.status === 'pending',
          error: step.status === 'error',
        }"
      >
        <div class="step-indicator">
          <span v-if="step.status === 'completed'">✓</span>
          <span v-else-if="step.status === 'error'">✕</span>
          <span v-else-if="step.status === 'active'" class="spinner"></span>
          <span v-else>{{ index + 1 }}</span>
        </div>
        <div class="step-content">
          <div class="step-title">{{ step.title }}</div>
          <div v-if="step.description" class="step-description">{{ step.description }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface ProgressStep {
  title: string;
  description?: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

interface ProgressDetails {
  currentStep?: string;
  elapsed?: number;
  estimated?: number;
}

const props = withDefaults(defineProps<{
  current: number;
  total: number;
  label?: string;
  status?: string;
  showStripes?: boolean;
  showDetails?: boolean;
  showSteps?: boolean;
  compact?: boolean;
  details?: ProgressDetails;
  steps?: ProgressStep[];
}>(), {
  showStripes: true,
  showDetails: false,
  showSteps: false,
  compact: false,
  steps: () => [],
});

const percentage = computed(() => {
  if (props.total === 0) return 0;
  return Math.round((props.current / props.total) * 100);
});

const statusText = computed(() => {
  if (props.status) return props.status;
  return `${props.current} / ${props.total}`;
});

const formatTime = (seconds: number) => {
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}时${mins}分`;
};
</script>

<style scoped>
.progress-tracker {
  padding: 16px;
  background: white;
  border-radius: 8px;
  border: 1px solid var(--border-default);
}

.progress-tracker.compact {
  padding: 12px;
}

.progress-bar-container {
  height: 8px;
  background: var(--bg-hover);
  border-radius: 4px;
  overflow: hidden;
}

.compact .progress-bar-container {
  height: 6px;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #1976d2, #42a5f5);
  border-radius: 4px;
  transition: width 0.3s ease;
  position: relative;
  overflow: hidden;
}

.progress-stripes {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.15) 25%,
    transparent 25%,
    transparent 50%,
    rgba(255, 255, 255, 0.15) 50%,
    rgba(255, 255, 255, 0.15) 75%,
    transparent 75%,
    transparent
  );
  background-size: 20px 20px;
  animation: stripes 0.5s linear infinite;
}

@keyframes stripes {
  from {
    background-position: 0 0;
  }
  to {
    background-position: 20px 0;
  }
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.progress-text {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-label {
  font-weight: 500;
  color: var(--text-primary);
}

.progress-status {
  color: var(--text-secondary);
  font-size: 13px;
}

.progress-percentage {
  font-weight: 600;
  color: var(--primary);
  font-size: 14px;
}

.progress-details {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-default);
}

.detail-item {
  display: flex;
  gap: 4px;
  font-size: 12px;
}

.detail-label {
  color: var(--text-muted);
}

.detail-value {
  color: var(--text-primary);
}

.steps-container {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.step-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--bg-base);
}

.step-item.active {
  background: var(--info-muted);
}

.step-item.completed {
  opacity: 0.7;
}

.step-item.error {
  background: var(--error-muted);
}

.step-indicator {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.pending .step-indicator {
  background: var(--bg-hover);
  color: var(--text-muted);
}

.active .step-indicator {
  background: var(--primary);
  color: var(--text-on-primary);
}

.completed .step-indicator {
  background: var(--success);
  color: var(--text-on-primary);
}

.error .step-indicator {
  background: #f44336;
  color: var(--text-on-primary);
}

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: var(--text-on-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.step-content {
  flex: 1;
}

.step-title {
  font-size: 13px;
  color: var(--text-primary);
}

.step-description {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}
</style>
