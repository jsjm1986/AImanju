<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="modal-container">
      <div class="modal-header">
        <h2 class="modal-title">
          <span class="icon">🧠</span>
          注意力头配置
        </h2>
        <button class="btn-close" @click="handleClose">×</button>
      </div>

      <div class="modal-body">
        <div class="mode-section">
          <div class="mode-header">
            <span class="section-label">配置模式</span>
          </div>
          <div class="mode-options">
            <label
              v-for="opt in modeOptions"
              :key="opt.value"
              class="mode-option"
              :class="{ active: localConfig.mode === opt.value }"
            >
              <input
                type="radio"
                v-model="localConfig.mode"
                :value="opt.value"
                @change="handleModeChange"
              />
              <span class="mode-icon">{{ opt.icon }}</span>
              <div class="mode-info">
                <span class="mode-name">{{ opt.name }}</span>
                <span class="mode-desc">{{ opt.desc }}</span>
              </div>
              <span v-if="localConfig.mode === opt.value" class="mode-check">✓</span>
            </label>
          </div>
        </div>

        <div v-if="localConfig.mode === 'auto'" class="auto-info">
          <div class="ai-section">
            <div class="ai-header">
              <span class="info-icon">✨</span>
              <span>AI 智能分析</span>
              <span v-if="headsSource === 'ai'" class="source-badge ai">AI 推荐</span>
              <span v-else-if="headsSource === 'fallback'" class="source-badge fallback">关键词匹配</span>
            </div>
            <button
              class="btn-ai-analyze"
              @click="handleAiAnalyze"
              :disabled="aiRecommending"
            >
              <span v-if="aiRecommending" class="loading-icon">⏳</span>
              <span v-else>🔍</span>
              {{ aiAnalyzeButtonText }}
            </button>
          </div>

          <div v-if="aiRecommendation" class="ai-result">
            <div v-if="aiRecommendation.identifiedElements?.length" class="identified-elements">
              <span class="result-label">识别的题材元素:</span>
              <div class="element-tags">
                <span v-for="elem in aiRecommendation.identifiedElements" :key="elem" class="element-tag">
                  {{ elem }}
                </span>
              </div>
            </div>

            <div v-if="aiRecommendation.summary" class="ai-summary">
              {{ aiRecommendation.summary }}
            </div>

            <div class="recommended-heads">
              <span class="result-label">推荐的注意力头:</span>
              <div class="recommendation-list">
                <div
                  v-for="rec in aiRecommendation.reasons"
                  :key="rec.head"
                  class="recommendation-item"
                >
                  <span class="rec-head-name">{{ getHeadName(rec.head) }}</span>
                  <span class="rec-reason">{{ rec.reason }}</span>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="no-ai-hint">
            <p>点击"开始 AI 分析"让 AI 根据您的项目类型描述智能推荐注意力头</p>
            <p class="fallback-note">当前使用关键词匹配作为备用方案</p>
          </div>

          <div class="auto-heads">
            <span class="heads-label">将自动启用:</span>
            <div class="auto-head-tags">
              <span v-for="head in displayAutoHeads" :key="head" class="head-tag auto">
                {{ getHeadName(head) }}
              </span>
            </div>
          </div>
        </div>

        <div v-else class="custom-section">
          <div class="heads-summary">
            <span>已选择 <strong>{{ localConfig.enabledHeads.length }}</strong> 个注意力头</span>
            <span class="base-note">(基础头不可取消)</span>
          </div>

          <div class="category-list">
            <div
              v-for="(heads, category) in allHeadsByCategory"
              :key="category"
              class="category-group"
            >
              <div class="category-header" :class="category">
                <span class="category-name">{{ getCategoryName(category) }}</span>
                <span class="category-count">
                  {{ getSelectedCountInCategory(category) }}/{{ heads.length }}
                </span>
              </div>
              <div class="heads-grid">
                <label
                  v-for="head in heads"
                  :key="head.type"
                  class="head-checkbox"
                  :class="{
                    selected: isSelected(head.type),
                    required: head.required,
                    disabled: head.required
                  }"
                >
                  <input
                    type="checkbox"
                    :checked="isSelected(head.type)"
                    :disabled="head.required"
                    @change="toggleHead(head.type)"
                  />
                  <span class="checkbox-mark">
                    <span v-if="isSelected(head.type)" class="check">✓</span>
                  </span>
                  <div class="head-content">
                    <span class="head-name">{{ head.name }}</span>
                    <span class="head-desc">{{ head.description }}</span>
                  </div>
                  <span v-if="head.required" class="required-badge">必选</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="handleClose">取消</button>
        <button class="btn-primary" @click="handleSave" :disabled="saving">
          {{ saving ? '保存中...' : '保存配置' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useAttentionStore } from '@/stores/attentionStore';
import { storeToRefs } from 'pinia';

const props = defineProps<{
  visible: boolean;
  projectId: string;
  projectType?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved'): void;
}>();

const attentionStore = useAttentionStore();
const {
  allHeads,
  allHeadsByCategory,
  currentConfig,
  aiRecommendation,
  aiRecommending,
  effectiveHeads,
  headsSource,
} = storeToRefs(attentionStore);

const {
  fetchAllHeads,
  fetchProjectConfig,
  fetchAiRecommendation,
  saveProjectConfig,
  getHeadName,
  getCategoryName,
} = attentionStore;

const modeOptions = [
  { value: 'auto' as const, icon: '🤖', name: '自动模式', desc: 'AI 智能分析推荐注意力头' },
  { value: 'custom' as const, icon: '🎛️', name: '自定义模式', desc: '手动选择要启用的注意力头' },
];

const localConfig = ref<{
  mode: 'auto' | 'custom';
  enabledHeads: string[];
}>({
  mode: 'auto',
  enabledHeads: [],
});

const saving = ref(false);

const displayAutoHeads = computed(() => {
  if (localConfig.value.mode === 'auto' && aiRecommendation.value?.recommendedHeads) {
    return aiRecommendation.value.recommendedHeads;
  }
  return effectiveHeads.value;
});

const aiAnalyzeButtonText = computed(() => {
  if (aiRecommending.value) return 'AI 分析中...';
  return aiRecommendation.value ? '重新分析' : '开始 AI 分析';
});

function isSelected(headType: string): boolean {
  return localConfig.value.enabledHeads.includes(headType);
}

function getSelectedCountInCategory(category: string): number {
  const heads = allHeadsByCategory.value[category] || [];
  return heads.filter(h => isSelected(h.type)).length;
}

function toggleHead(headType: string): void {
  const index = localConfig.value.enabledHeads.indexOf(headType);
  if (index === -1) {
    localConfig.value.enabledHeads.push(headType);
  } else {
    const head = allHeads.value.find(h => h.type === headType);
    if (!head?.required) {
      localConfig.value.enabledHeads.splice(index, 1);
    }
  }
}

function handleModeChange(): void {
  if (localConfig.value.mode === 'custom') {
    const recommended = aiRecommendation.value?.recommendedHeads;
    localConfig.value.enabledHeads = [...(recommended?.length ? recommended : effectiveHeads.value)];
  }
}

async function handleAiAnalyze(): Promise<void> {
  await fetchAiRecommendation(props.projectId, true);
}

async function handleSave(): Promise<void> {
  saving.value = true;
  try {
    if (localConfig.value.mode === 'auto') {
      attentionStore.setAutoMode();
    } else {
      attentionStore.setCustomMode(localConfig.value.enabledHeads);
    }
    const success = await saveProjectConfig(props.projectId);
    if (success) {
      emit('saved');
      emit('close');
    }
  } finally {
    saving.value = false;
  }
}

function handleClose(): void {
  emit('close');
}

async function loadData(): Promise<void> {
  await Promise.all([
    fetchAllHeads(),
    fetchProjectConfig(props.projectId),
  ]);
  localConfig.value = {
    mode: currentConfig.value.mode,
    enabledHeads: currentConfig.value.mode === 'custom'
      ? [...(currentConfig.value.enabledHeads || effectiveHeads.value)]
      : [...effectiveHeads.value],
  };
}

watch(() => props.visible, (visible) => {
  if (visible) loadData();
});

onMounted(() => {
  if (props.visible) loadData();
});
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

.modal-container {
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 700px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-default);
  box-shadow: 0 20px 60px var(--overlay-bg);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border-default);
}

.modal-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.icon {
  font-size: 20px;
}

.btn-close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: var(--radius-md);
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: var(--transition-fast);
}

.btn-close:hover {
  background: var(--error-muted);
  color: var(--error);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-5);
}

.mode-section {
  margin-bottom: var(--space-5);
}

.mode-header {
  margin-bottom: var(--space-3);
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.mode-options {
  display: flex;
  gap: var(--space-3);
}

.mode-option {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition-fast);
}

.mode-option:hover {
  border-color: var(--border-hover);
}

.mode-option.active {
  border-color: var(--primary);
  background: var(--primary-muted);
}

.mode-option input {
  display: none;
}

.mode-icon {
  font-size: 20px;
}

.mode-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mode-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.mode-desc {
  font-size: 11px;
  color: var(--text-secondary);
}

.mode-check {
  width: 20px;
  height: 20px;
  background: var(--primary);
  color: var(--text-on-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.auto-info {
  padding: var(--space-4);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
}

.info-icon {
  font-size: 14px;
}

.auto-heads {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.heads-label {
  font-size: 11px;
  color: var(--text-secondary);
}

.auto-head-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.head-tag {
  font-size: 11px;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  background: var(--bg-hover);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
}

.head-tag.auto {
  background: var(--primary-muted);
  border-color: var(--primary-border);
  color: var(--primary);
}

.ai-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border-default);
}

.ai-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.source-badge {
  font-size: 10px;
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  font-weight: 500;
}

.source-badge.ai {
  background: var(--success-muted);
  color: var(--success);
}

.source-badge.fallback {
  background: var(--warning-muted);
  color: var(--warning);
}

.btn-ai-analyze {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  font-size: 12px;
  background: var(--primary);
  color: var(--text-on-primary);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition-fast);
}

.btn-ai-analyze:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn-ai-analyze:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.ai-result {
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  margin-bottom: var(--space-4);
  border: 1px solid var(--border-default);
}

.identified-elements {
  margin-bottom: var(--space-3);
}

.result-label {
  font-size: 11px;
  color: var(--text-secondary);
  display: block;
  margin-bottom: var(--space-1);
}

.element-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.element-tag {
  font-size: 10px;
  padding: 2px var(--space-2);
  background: var(--success-muted);
  color: var(--success);
  border-radius: var(--radius-full);
}

.ai-summary {
  font-size: 12px;
  color: var(--text-primary);
  margin-bottom: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--primary);
}

.recommendation-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.recommendation-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
}

.rec-head-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
}

.rec-reason {
  font-size: 11px;
  color: var(--text-secondary);
}

.no-ai-hint {
  padding: var(--space-4);
  text-align: center;
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px dashed var(--border-default);
  margin-bottom: var(--space-4);
}

.no-ai-hint p {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.no-ai-hint .fallback-note {
  margin-top: var(--space-1);
  font-size: 11px;
  color: var(--text-muted);
}

.heads-summary {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
  font-size: 13px;
  color: var(--text-primary);
}

.base-note {
  font-size: 11px;
  color: var(--text-secondary);
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.category-group {
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  border: 1px solid var(--border-default);
}

.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-default);
}

.category-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.category-header.base .category-name { color: var(--text-secondary); }
.category-header.mystery .category-name { color: var(--primary-hover); }
.category-header.horror .category-name { color: var(--error); }
.category-header.mind .category-name { color: var(--warning); }
.category-header.game .category-name { color: var(--success); }
.category-header.cool .category-name { color: var(--orange); }
.category-header.style .category-name { color: var(--pink); }

.category-count {
  font-size: 11px;
  color: var(--text-secondary);
}

.heads-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);
}

.head-checkbox {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition-fast);
}

.head-checkbox:hover:not(.disabled) {
  border-color: var(--border-hover);
}

.head-checkbox.selected {
  border-color: var(--primary);
  background: var(--primary-muted);
}

.head-checkbox.disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.head-checkbox input {
  display: none;
}

.checkbox-mark {
  width: 16px;
  height: 16px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: var(--transition-fast);
}

.head-checkbox.selected .checkbox-mark {
  background: var(--primary);
  border-color: var(--primary);
}

.check {
  color: var(--text-on-primary);
  font-size: 10px;
}

.head-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.head-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
}

.head-desc {
  font-size: 10px;
  color: var(--text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.required-badge {
  font-size: 9px;
  padding: 2px var(--space-1);
  background: var(--bg-hover);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  white-space: nowrap;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--border-default);
}

.btn-secondary {
  padding: var(--space-2) var(--space-4);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  transition: var(--transition-fast);
}

.btn-secondary:hover {
  background: var(--bg-hover);
}

.btn-primary {
  padding: var(--space-2) var(--space-4);
  background: var(--primary);
  color: var(--text-on-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: 13px;
  cursor: pointer;
  transition: var(--transition-fast);
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .mode-options {
    flex-direction: column;
  }
  .heads-grid {
    grid-template-columns: 1fr;
  }
}
</style>
