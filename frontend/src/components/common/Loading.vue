<template>
  <div class="loading-container" :class="[size, { overlay, inline }]">
    <div class="loading-spinner" :class="type">
      <div v-if="type === 'spinner'" class="spinner"></div>
      <div v-else-if="type === 'dots'" class="dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div v-else-if="type === 'pulse'" class="pulse"></div>
    </div>
    <div v-if="text" class="loading-text">{{ text }}</div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  text?: string;
  type?: 'spinner' | 'dots' | 'pulse';
  size?: 'small' | 'medium' | 'large';
  overlay?: boolean;
  inline?: boolean;
}>(), {
  type: 'spinner',
  size: 'medium',
  overlay: false,
  inline: false,
});
</script>

<style scoped>
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.loading-container.inline {
  flex-direction: row;
  gap: 8px;
}

.loading-container.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  z-index: 9999;
}

.loading-text {
  color: var(--text-secondary);
  font-size: 14px;
}

.small .loading-text {
  font-size: 12px;
}

.large .loading-text {
  font-size: 16px;
}

/* Spinner */
.spinner {
  border-radius: 50%;
  border-style: solid;
  border-color: var(--border-default);
  border-top-color: var(--primary);
  animation: spin 0.8s linear infinite;
}

.small .spinner {
  width: 20px;
  height: 20px;
  border-width: 2px;
}

.medium .spinner {
  width: 32px;
  height: 32px;
  border-width: 3px;
}

.large .spinner {
  width: 48px;
  height: 48px;
  border-width: 4px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Dots */
.dots {
  display: flex;
  gap: 6px;
}

.dots span {
  background: var(--primary);
  border-radius: 50%;
  animation: bounce 1.4s ease-in-out infinite both;
}

.small .dots span {
  width: 6px;
  height: 6px;
}

.medium .dots span {
  width: 10px;
  height: 10px;
}

.large .dots span {
  width: 14px;
  height: 14px;
}

.dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%,
  80%,
  100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

/* Pulse */
.pulse {
  background: var(--primary);
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}

.small .pulse {
  width: 20px;
  height: 20px;
}

.medium .pulse {
  width: 32px;
  height: 32px;
}

.large .pulse {
  width: 48px;
  height: 48px;
}

@keyframes pulse {
  0% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  50% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
}
</style>
