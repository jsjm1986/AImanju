<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="visible" class="dialog-overlay" @click.self="handleCancel">
        <div class="dialog-container" :class="type">
          <div class="dialog-header">
            <div class="dialog-icon">
              <span v-if="type === 'danger'">⚠</span>
              <span v-else-if="type === 'warning'">⚠</span>
              <span v-else>?</span>
            </div>
            <h3 class="dialog-title">{{ title }}</h3>
          </div>

          <div class="dialog-body">
            <p class="dialog-message">{{ message }}</p>
            <slot></slot>
          </div>

          <div class="dialog-footer">
            <button
              v-if="showCancel"
              class="btn btn-cancel"
              @click="handleCancel"
              :disabled="loading"
            >
              {{ cancelText }}
            </button>
            <button
              class="btn btn-confirm"
              :class="type"
              @click="handleConfirm"
              :disabled="loading"
            >
              <span v-if="loading" class="loading-spinner"></span>
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { watch } from 'vue';

export type DialogType = 'default' | 'warning' | 'danger';

const props = withDefaults(defineProps<{
  visible: boolean;
  title?: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  loading?: boolean;
}>(), {
  title: '确认',
  type: 'default',
  confirmText: '确定',
  cancelText: '取消',
  showCancel: true,
  loading: false,
});

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

const handleConfirm = () => {
  emit('confirm');
};

const handleCancel = () => {
  emit('update:visible', false);
  emit('cancel');
};

// ESC 键关闭
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.visible) {
    handleCancel();
  }
};

watch(() => props.visible, (val) => {
  if (val) {
    document.addEventListener('keydown', handleKeydown);
  } else {
    document.removeEventListener('keydown', handleKeydown);
  }
});
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
}

.dialog-container {
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 400px;
  border: 1px solid var(--border-default);
  box-shadow: 0 20px 60px var(--overlay-bg);
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-5) 0;
}

.dialog-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.default .dialog-icon {
  background: var(--primary-muted);
  color: var(--primary);
}

.warning .dialog-icon {
  background: var(--warning-muted);
  color: var(--warning);
}

.danger .dialog-icon {
  background: var(--error-muted);
  color: var(--error);
}

.dialog-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.dialog-body {
  padding: var(--space-4) var(--space-5) var(--space-5);
}

.dialog-message {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5);
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-default);
}

.btn {
  padding: var(--space-2) var(--space-4);
  border: none;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition-fast);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-cancel {
  background: var(--bg-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}

.btn-cancel:hover:not(:disabled) {
  background: var(--bg-hover);
}

.btn-confirm {
  background: var(--primary);
  color: var(--text-on-primary);
}

.btn-confirm:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn-confirm.warning {
  background: var(--warning);
}

.btn-confirm.warning:hover:not(:disabled) {
  background: var(--warning);
}

.btn-confirm.danger {
  background: var(--error);
}

.btn-confirm.danger:hover:not(:disabled) {
  background: var(--error);
}

.loading-spinner {
  width: 14px;
  height: 14px;
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

.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-enter-active .dialog-container,
.dialog-leave-active .dialog-container {
  transition: transform 0.2s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-from .dialog-container {
  transform: scale(0.95);
}

.dialog-leave-to .dialog-container {
  transform: scale(0.95);
}
</style>
