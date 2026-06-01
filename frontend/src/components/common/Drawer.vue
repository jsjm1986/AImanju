<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue';

interface Props {
  visible: boolean;
  title?: string;
  width?: string;
  position?: 'left' | 'right';
  showOverlay?: boolean;
  closeOnOverlay?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  width: '480px',
  position: 'right',
  showOverlay: true,
  closeOnOverlay: true,
});

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const handleOverlayClick = () => {
  if (props.closeOnOverlay) {
    emit('close');
  }
};

const handleEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.visible) {
    emit('close');
  }
};

watch(() => props.visible, (visible) => {
  if (visible) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
});

onMounted(() => {
  document.addEventListener('keydown', handleEscape);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape);
  document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
    <!-- 遮罩层 -->
    <div
      v-if="showOverlay"
      class="drawer-overlay"
      :class="{ visible: visible }"
      @click="handleOverlayClick"
    ></div>

    <!-- 抽屉面板 -->
    <div
      class="drawer"
      :class="[
        `drawer-${position}`,
        { open: visible }
      ]"
      :style="{ width: width }"
    >
      <!-- 头部 -->
      <div v-if="title || $slots.header" class="drawer-header">
        <slot name="header">
          <h3 class="drawer-title">{{ title }}</h3>
        </slot>
        <button class="drawer-close" @click="emit('close')" title="关闭">
          ✕
        </button>
      </div>

      <!-- 内容区 -->
      <div class="drawer-body">
        <slot></slot>
      </div>

      <!-- 底部 -->
      <div v-if="$slots.footer" class="drawer-footer">
        <slot name="footer"></slot>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  z-index: var(--z-modal);
  opacity: 0;
  visibility: hidden;
  transition: opacity var(--duration-normal) var(--ease-out-expo),
              visibility var(--duration-normal);
}

.drawer-overlay.visible {
  opacity: 1;
  visibility: visible;
}

.drawer {
  position: fixed;
  top: 0;
  bottom: 0;
  background: var(--bg-surface);
  z-index: calc(var(--z-modal) + 1);
  display: flex;
  flex-direction: column;
  transition: transform var(--duration-normal) var(--ease-out-expo);
  max-width: 90vw;
}

.drawer-right {
  right: 0;
  transform: translateX(100%);
  border-left: 1px solid var(--border-default);
}

.drawer-left {
  left: 0;
  transform: translateX(-100%);
  border-right: 1px solid var(--border-default);
}

.drawer.open {
  transform: translateX(0);
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-elevated);
  flex-shrink: 0;
}

.drawer-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.drawer-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
  font-size: 14px;
}

.drawer-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
  min-height: 0;
}

.drawer-footer {
  padding: var(--space-4);
  border-top: 1px solid var(--border-default);
  background: var(--bg-elevated);
  flex-shrink: 0;
}
</style>
