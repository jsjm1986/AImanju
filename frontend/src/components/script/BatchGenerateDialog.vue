<script setup lang="ts">
/**
 * 批量生成对话框组件
 */
import { ref, computed, watch } from 'vue';
import Modal from '@/components/common/Modal.vue';

interface Props {
  visible: boolean;
  currentEpisode: number;
  totalEpisodes: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm', start: number, end: number): void;
}>();

const startEpisode = ref(1);
const endEpisode = ref(5);

// 当弹窗打开时，设置默认值
watch(() => props.visible, (visible) => {
  if (visible) {
    startEpisode.value = props.currentEpisode;
    endEpisode.value = Math.min(props.currentEpisode + 4, props.totalEpisodes);
  }
});

// 计算将要生成的集数
const episodeCount = computed(() => {
  if (endEpisode.value >= startEpisode.value) {
    return endEpisode.value - startEpisode.value + 1;
  }
  return 0;
});

// 验证输入
const isValid = computed(() => {
  return startEpisode.value >= 1 &&
         startEpisode.value <= props.totalEpisodes &&
         endEpisode.value >= startEpisode.value &&
         endEpisode.value <= props.totalEpisodes;
});

const handleConfirm = () => {
  if (isValid.value) {
    emit('confirm', startEpisode.value, endEpisode.value);
  }
};

const handleClose = () => {
  emit('close');
};
</script>

<template>
  <Modal :show="visible" title="批量生成剧本" @close="handleClose">
    <div class="batch-form">
      <p class="batch-desc">请选择要生成的集数范围：</p>

      <div class="range-inputs">
        <div class="input-group">
          <label class="form-label">起始集数</label>
          <input
            type="number"
            class="form-input"
            v-model.number="startEpisode"
            :min="1"
            :max="totalEpisodes"
          />
        </div>

        <span class="range-separator">至</span>

        <div class="input-group">
          <label class="form-label">结束集数</label>
          <input
            type="number"
            class="form-input"
            v-model.number="endEpisode"
            :min="startEpisode"
            :max="totalEpisodes"
          />
        </div>
      </div>

      <div class="batch-info">
        <p v-if="isValid">
          将生成 <strong>{{ episodeCount }}</strong> 集剧本（第{{ startEpisode }}集 - 第{{ endEpisode }}集）
        </p>
        <p v-else class="error-text">
          请输入有效的集数范围（1 - {{ totalEpisodes }}）
        </p>
      </div>

      <div class="batch-actions">
        <button class="btn btn-secondary" @click="handleClose">取消</button>
        <button
          class="btn btn-primary"
          @click="handleConfirm"
          :disabled="!isValid"
        >
          开始生成
        </button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.batch-form {
  padding: var(--spacing-sm, 8px) 0;
}

.batch-desc {
  margin: 0 0 var(--spacing-md, 16px);
  color: var(--color-text-secondary, #666);
  font-size: var(--font-size-base, 14px);
}

.range-inputs {
  display: flex;
  align-items: flex-end;
  gap: var(--spacing-md, 16px);
}

.input-group {
  flex: 1;
}

.input-group .form-label {
  display: block;
  margin-bottom: var(--spacing-sm, 8px);
  font-size: var(--font-size-sm, 13px);
  font-weight: var(--font-weight-medium, 500);
  color: var(--color-text-primary, #333);
}

.input-group .form-input {
  width: 100%;
  height: var(--input-height-md, 40px);
  padding: 0 var(--spacing-sm, 8px);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: var(--radius-md, 8px);
  font-size: var(--font-size-base, 14px);
}

.input-group .form-input:focus {
  border-color: var(--color-primary, #1976d2);
  box-shadow: 0 0 0 3px var(--color-primary-light, #e3f2fd);
  outline: none;
}

.range-separator {
  padding-bottom: 10px;
  color: var(--color-text-secondary, #666);
}

.batch-info {
  margin: var(--spacing-md, 16px) 0;
  padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
  background: var(--color-bg-hover, #fafafa);
  border-radius: var(--radius-md, 8px);
  font-size: var(--font-size-sm, 13px);
}

.batch-info p {
  margin: 0;
}

.batch-info strong {
  color: var(--color-primary, #1976d2);
}

.error-text {
  color: var(--color-error, #f44336);
}

.batch-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm, 8px);
  margin-top: var(--spacing-lg, 24px);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: var(--btn-height-md, 36px);
  padding: 0 var(--spacing-md, 16px);
  border: none;
  border-radius: var(--radius-md, 8px);
  font-size: var(--font-size-base, 14px);
  font-weight: var(--font-weight-medium, 500);
  cursor: pointer;
  transition: all var(--transition-fast, 0.15s ease);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary, #1976d2);
  color: var(--text-on-primary);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover, #1565c0);
}

.btn-secondary {
  background: var(--color-bg-card, #ffffff);
  color: var(--color-text-primary, #333);
  border: 1px solid var(--color-border, #e0e0e0);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-bg-hover, #fafafa);
}
</style>
