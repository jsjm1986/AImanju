<template>
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="visible" class="toast" :class="type">
        <div class="toast-indicator"></div>
        <div class="toast-content">
          <div v-if="title" class="toast-title">{{ title }}</div>
          <div class="toast-message">{{ message }}</div>
        </div>
        <button v-if="closable" class="toast-close" @click="close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

const props = withDefaults(defineProps<{
  message: string;
  title?: string;
  type?: ToastType;
  duration?: number;
  closable?: boolean;
}>(), {
  type: 'info',
  duration: 3000,
  closable: true,
});

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const visible = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

const show = () => {
  visible.value = true;
  if (props.duration > 0) {
    timer = setTimeout(() => {
      close();
    }, props.duration);
  }
};

const close = () => {
  visible.value = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  emit('close');
};

onMounted(() => {
  show();
});

watch(() => props.message, () => {
  if (timer) {
    clearTimeout(timer);
  }
  show();
});

defineExpose({ show, close });
</script>

<style scoped>
.toast {
  position: fixed;
  top: var(--space-5);
  right: var(--space-5);
  display: flex;
  align-items: stretch;
  min-width: 280px;
  max-width: 400px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  overflow: hidden;
  z-index: var(--z-toast);
}

.toast-indicator {
  width: 4px;
  flex-shrink: 0;
}

.toast.success .toast-indicator { background: var(--success); }
.toast.error .toast-indicator { background: var(--error); }
.toast.warning .toast-indicator { background: var(--warning); }
.toast.info .toast-indicator { background: var(--info); }

.toast-content {
  flex: 1;
  padding: var(--space-3) var(--space-4);
}

.toast-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-1);
}

.toast-message {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: var(--leading-normal);
}

.toast-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  color: var(--text-tertiary);
  flex-shrink: 0;
  transition: color var(--transition-fast);
}

.toast-close:hover {
  color: var(--text-primary);
}

/* 过渡动画 */
.toast-enter-active,
.toast-leave-active {
  transition: all 200ms ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
