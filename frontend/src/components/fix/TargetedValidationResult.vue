<template>
  <div class="targeted-validation-result" :class="{ passed: result.passed, failed: !result.passed }">
    <div class="result-header">
      <span class="result-icon">{{ result.passed ? '✓' : '✕' }}</span>
      <span class="result-title">
        {{ result.passed ? '验证通过' : '验证未通过' }}
      </span>
    </div>

    <div class="result-detail">
      <div class="detail-item">
        <span class="detail-label">原问题状态</span>
        <span class="detail-value" :class="{ resolved: result.originalIssueResolved }">
          {{ result.originalIssueResolved ? '已解决' : '未解决' }}
        </span>
      </div>
    </div>

    <div class="result-description">
      <p>{{ result.details }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TargetedValidationResult } from '@/types/fix';

defineProps<{
  result: TargetedValidationResult;
}>();
</script>

<style scoped>
.targeted-validation-result {
  padding: 16px;
  border-radius: 8px;
  margin-top: 16px;
}

.targeted-validation-result.passed {
  background: var(--success-bg);
  border: 1px solid var(--success);
}

.targeted-validation-result.failed {
  background: var(--error-bg);
  border: 1px solid var(--error);
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.result-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
}

.passed .result-icon {
  background: var(--success);
  color: var(--text-on-primary);
}

.failed .result-icon {
  background: var(--error);
  color: var(--text-on-primary);
}

.result-title {
  font-weight: 600;
  font-size: 14px;
}

.passed .result-title {
  color: var(--success);
}

.failed .result-title {
  color: var(--error);
}

.result-detail {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.detail-value {
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--bg-tertiary);
}

.detail-value.resolved {
  background: var(--success-bg);
  color: var(--success);
}

.result-description {
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.result-description p {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-primary);
}
</style>
