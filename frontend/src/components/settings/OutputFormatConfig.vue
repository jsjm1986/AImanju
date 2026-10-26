<template>
  <div class="output-format-config">
    <h3 class="section-title">输出格式配置</h3>
    
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <span class="spinner"></span>
      <span>加载配置...</span>
    </div>
    
    <!-- 错误提示 -->
    <div v-if="error" class="alert-error">
      {{ error }}
    </div>
    
    <template v-if="!loading && !error">
      <!-- 预设选择器 - 卡片模式 -->
      <div class="preset-section">
        <div class="card-grid-sm">
          <div 
            v-for="preset in presets" 
            :key="preset.id"
            class="preset-card card card-hover card-clickable"
            :class="{ selected: config.preset === preset.id }"
            @click="selectPreset(preset.id)"
          >
            <div class="preset-header">
              <span class="preset-name">{{ preset.name }}</span>
              <span v-if="config.preset === preset.id" class="check-badge">✓</span>
            </div>
            <div class="preset-desc">{{ preset.description }}</div>
            <div class="preset-meta">
              <span class="meta-item">📝 {{ preset.wordRange }}</span>
              <span class="meta-item">🎬 {{ preset.sceneRange }}</span>
            </div>
            <div class="preset-tags">
              <span 
                v-for="tag in preset.suitableFor?.slice(0, 2)" 
                :key="tag" 
                class="tag"
              >{{ tag }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 自定义输出提示词 -->
      <div class="custom-prompt-section">
        <div class="form-group">
          <label class="form-label">
            自定义输出要求 
            <span class="label-hint">（可选，将追加到每次生成）</span>
          </label>
          <textarea 
            v-model="config.customPrompt"
            class="textarea"
            rows="3"
            placeholder="例如：所有对白必须精炼不超过20字。每个场景必须有画面描写。避免使用感叹号..."
          ></textarea>
        </div>
      </div>

      <!-- 叙事科学方法论开关 -->
      <div class="methodology-section">
        <div class="form-group">
          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="config.enableNarrativeMethodology"
              class="checkbox-input"
            />
            <span class="checkbox-text">启用叙事科学方法论</span>
            <button
              type="button"
              @click="showMethodologyInfo = true"
              class="info-btn"
              title="查看详情"
            >
              <span class="info-icon">ⓘ</span>
            </button>
          </label>
          <p class="help-text">
            注入完整的短剧叙事科学方法论（约8000字），提升剧本质量
          </p>
        </div>
      </div>

      <!-- 保存按钮 -->
      <div class="form-actions">
        <button class="btn btn-primary" @click="save" :disabled="saving">
          <span v-if="saving" class="spinner-sm"></span>
          {{ saving ? '保存中...' : '保存配置' }}
        </button>
        <span v-if="savedMessage" class="save-feedback">{{ savedMessage }}</span>
      </div>

      <!-- 方法论信息弹窗 -->
      <div v-if="showMethodologyInfo" class="modal-overlay" @click="showMethodologyInfo = false">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>叙事科学方法论说明</h3>
            <button class="modal-close" @click="showMethodologyInfo = false" aria-label="关闭">×</button>
          </div>
          <div class="modal-body">
            <p>该方法论包含：</p>
            <ul>
              <li>认知科学基础（注意力捕获、预期奖励、镜像情绪）</li>
              <li>叙事动力系统（角色欲望、地位博弈、压迫-释放机制）</li>
              <li>节奏结构系统（180秒标准结构、爽点密度控制）</li>
              <li>量化评分系统（开场钩子、爽点、地位变化评分）</li>
            </ul>
            <p class="modal-note"><strong>Token消耗</strong>：约8000字/次生成（~$0.18/集）</p>
            <p class="modal-note"><strong>建议</strong>：追求高质量时启用，成本敏感时关闭</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import type { IPresetInfo, OutputFormatPreset } from '@/types/outputFormat';
import { outputFormatApi } from '@/services/api';

interface ISimplifiedConfig {
  mode: 'preset';
  preset: OutputFormatPreset;
  customPrompt?: string;
  enableNarrativeMethodology?: boolean;
}

const props = defineProps<{ projectId: string }>();
const emit = defineEmits(['saved']);

const config = reactive<ISimplifiedConfig>({
  mode: 'preset',
  preset: 'standard',
  customPrompt: '',
  enableNarrativeMethodology: true
});

const presets = ref<IPresetInfo[]>([]);
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const savedMessage = ref('');
const showMethodologyInfo = ref(false);

const selectPreset = (id: OutputFormatPreset) => {
  config.preset = id;
};

const save = async () => {
  saving.value = true;
  savedMessage.value = '';
  error.value = '';
  try {
    await outputFormatApi.update(props.projectId, {
      mode: 'preset',
      preset: config.preset,
      customPrompt: config.customPrompt?.trim() || undefined,
      enableNarrativeMethodology: config.enableNarrativeMethodology
    });
    savedMessage.value = '✓ 已保存';
    emit('saved');
    setTimeout(() => { savedMessage.value = ''; }, 3000);
  } catch (e: any) {
    error.value = e.response?.data?.error || '保存失败';
  } finally {
    saving.value = false;
  }
};

onMounted(async () => {
  try {
    const res = await outputFormatApi.get(props.projectId);
    if (res.data.success) {
      const data = res.data.data.config as any;
      config.preset = data.preset || 'standard';
      config.customPrompt = data.customPrompt || '';
      config.enableNarrativeMethodology = data.enableNarrativeMethodology ?? false;
      presets.value = (res.data.data.presets || []) as IPresetInfo[];
    }
  } catch (e: any) {
    error.value = '加载配置失败: ' + (e.response?.data?.error || e.message || '未知错误');
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
/* ========== 使用设计系统变量 ========== */

.output-format-config {
  padding: var(--space-5);
}

.section-title {
  margin: 0 0 var(--space-5);
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

/* 加载和错误状态 */
.loading-state {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-6);
  color: var(--text-secondary);
}

.alert-error {
  padding: var(--space-3) var(--space-4);
  background: var(--error-muted);
  border: 1px solid var(--error-border);
  border-radius: var(--radius-md);
  color: var(--error);
  margin-bottom: var(--space-4);
  font-size: var(--text-sm);
}

.spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-default);
  border-top-color: var(--primary);
  border-radius: var(--radius-full);
  animation: spin 0.8s linear infinite;
}

.spinner-sm {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid var(--border-default);
  border-top-color: var(--text-on-primary);
  border-radius: var(--radius-full);
  animation: spin 0.8s linear infinite;
  margin-right: var(--space-2);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 预设卡片网格 */
.card-grid-sm {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-3);
}

.preset-card {
  padding: var(--space-3);
}

.preset-card.selected {
  border-color: var(--primary);
  background: var(--primary-muted);
}

.preset-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-1);
}

.preset-name {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.check-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  background: var(--primary);
  color: var(--text-on-primary);
  border-radius: var(--radius-full);
  font-size: 10px;
}

.preset-desc {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-bottom: var(--space-2);
  line-height: var(--leading-normal);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.preset-meta {
  display: flex;
  gap: var(--space-3);
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: var(--space-2);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 2px;
}

.preset-tags {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}

.preset-tags .tag {
  font-size: 10px;
  height: 18px;
  padding: 0 var(--space-1);
}

/* 自定义提示词区域 */
.custom-prompt-section {
  margin-top: var(--space-5);
  padding: var(--space-4);
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
}

.label-hint {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  font-weight: var(--font-normal);
}

/* 保存反馈 */
.save-feedback {
  color: var(--success);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

/* 叙事科学方法论区域 */
.methodology-section {
  margin-top: var(--space-5);
  padding: var(--space-4);
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  margin-bottom: var(--space-2);
}

.checkbox-input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.checkbox-text {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.info-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  margin-left: var(--space-1);
}

.info-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--text-tertiary);
  font-size: 14px;
  transition: color 0.2s;
}

.info-btn:hover .info-icon {
  color: var(--primary);
}

.help-text {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin: 0;
  padding-left: 26px;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4);
  border-bottom: 1px solid var(--border-default);
}

.modal-header h3 {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.modal-close:hover {
  color: var(--text-primary);
}

.modal-body {
  padding: var(--space-4);
}

.modal-body p {
  margin: 0 0 var(--space-3);
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.modal-body ul {
  margin: 0 0 var(--space-4);
  padding-left: var(--space-5);
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.modal-body li {
  margin-bottom: var(--space-2);
}

.modal-note {
  padding: var(--space-2) var(--space-3);
  background: var(--bg-muted);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-2);
}
</style>
