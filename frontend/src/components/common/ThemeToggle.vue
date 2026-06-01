<template>
  <div class="theme-selector" ref="selectorRef">
    <button 
      class="theme-trigger" 
      @click="toggleDropdown"
      :title="`当前主题: ${themeConfig?.name ?? ''}`"
    >
      <span class="theme-icon">{{ themeConfig?.icon ?? '🎨' }}</span>
      <span class="theme-name">{{ themeConfig?.name ?? '主题' }}</span>
      <span class="dropdown-arrow">▾</span>
    </button>

    <Transition name="dropdown">
      <div v-if="isOpen" class="theme-dropdown">
        <div class="dropdown-header">选择主题 ({{ themes.length }})</div>
        <div class="theme-list">
          <button
            v-for="t in themes"
            :key="t.id"
            class="theme-option"
            :class="{ active: theme === t.id }"
            @click="selectTheme(t.id)"
            :title="t.description"
          >
            <span class="option-icon">{{ t.icon }}</span>
            <div class="option-info">
              <span class="option-name">{{ t.name }}</span>
              <span class="option-desc">{{ t.description }}</span>
            </div>
            <span v-if="theme === t.id" class="check-mark">✓</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useTheme, type ThemeId } from '@/composables/useTheme';

const { theme, themeConfig, themes, setTheme } = useTheme();

const isOpen = ref(false);
const selectorRef = ref<HTMLElement | null>(null);

const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
};

const selectTheme = (themeId: ThemeId) => {
  setTheme(themeId);
  isOpen.value = false;
};

// 点击外部关闭
const handleClickOutside = (event: MouseEvent) => {
  if (selectorRef.value && !selectorRef.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.theme-selector {
  position: relative;
}

.theme-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.theme-trigger:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

.theme-icon {
  font-size: 16px;
  line-height: 1;
}

.theme-name {
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.dropdown-arrow {
  font-size: 10px;
  color: var(--text-muted);
  transition: transform var(--transition-fast);
}

.theme-trigger:hover .dropdown-arrow {
  color: var(--text-secondary);
}


/* 下拉菜单 */
.theme-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 360px; /* 加宽以容纳两列 */
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  z-index: var(--z-dropdown);
  display: flex;
  flex-direction: column;
}

.dropdown-header {
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-elevated); /* 稍微区分标题栏 */
}

/* 主题选项容器改为网格布局 */
.theme-list {
  display: grid;
  grid-template-columns: 1fr 1fr; /* 双列布局 */
  gap: 1px; /* 间隙，用于显示边框（如果背景色不同） */
  background: var(--border-default); /* 利用间隙做分割线效果 */
  max-height: 480px; /* 限制最大高度 */
  overflow-y: auto;
}

.theme-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-3);
  background: var(--bg-surface); /* 恢复背景色 */
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: left;
  position: relative;
}

.theme-option:hover {
  background: var(--bg-hover);
  z-index: 1; /* hover时浮起 */
}

.theme-option.active {
  background: var(--primary-muted);
}

.option-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
  flex-shrink: 0;
}

.option-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0; /* 防止溢出 */
}

.option-name {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.option-desc {
  font-size: 11px; /* 稍微缩小描述文字 */
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.check-mark {
  color: var(--primary);
  font-weight: var(--font-bold);
  font-size: 12px;
  position: absolute;
  top: 4px;
  right: 4px;
  line-height: 1;
}

/* 过渡动画 */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all var(--transition-fast);
  transform-origin: top right;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-8px);
}
</style>
