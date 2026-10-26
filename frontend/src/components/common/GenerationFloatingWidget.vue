<script setup lang="ts">
/**
 * 全局生成状态浮动窗口
 * 在任何页面都可以看到生成进度，点击可跳转回剧本页面
 */
import { useGenerationStore } from '@/stores/generationStore';
import { storeToRefs } from 'pinia';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const generationStore = useGenerationStore();
const { isGenerating, progress, wordCount, progressPercent, error, currentProjectId, currentEpisodeNumber } = storeToRefs(generationStore);

// 组件状态
const isMinimized = ref(false);
const isDragging = ref(false);
const isVisible = ref(false);

// 位置状态
const position = ref({ x: 20, y: 20 });
const dragOffset = ref({ x: 0, y: 0 });
const justDragged = ref(false);
let dragMoved = false;

// 存储键
const POSITION_KEY = 'generation-widget-position';
const MINIMIZED_KEY = 'generation-widget-minimized';

// 从 localStorage 加载位置
function loadPosition() {
  try {
    const stored = localStorage.getItem(POSITION_KEY);
    if (stored) {
      position.value = JSON.parse(stored);
    }
    const minimized = localStorage.getItem(MINIMIZED_KEY);
    if (minimized) {
      isMinimized.value = minimized === 'true';
    } else if (window.innerWidth <= 640) {
      // 移动端首次使用默认最小化，避免遮挡正文
      isMinimized.value = true;
    }
  } catch (e) {
    console.warn('加载浮窗位置失败:', e);
  }
}

// 保存位置到 localStorage
function savePosition() {
  try {
    localStorage.setItem(POSITION_KEY, JSON.stringify(position.value));
    localStorage.setItem(MINIMIZED_KEY, String(isMinimized.value));
  } catch (e) {
    console.warn('保存浮窗位置失败:', e);
  }
}

// 状态图标
const statusIcon = computed(() => {
  if (error.value) return '❌';
  if (!isGenerating.value && progressPercent.value === 100) return '✅';
  if (isGenerating.value) return '⚡';
  return '📝';
});

// 状态文本
const statusText = computed(() => {
  if (error.value) return '生成失败';
  if (!isGenerating.value && progressPercent.value === 100) return '生成完成';
  if (isGenerating.value) {
    const ep = currentEpisodeNumber.value ? `第${currentEpisodeNumber.value}集 ` : '';
    return ep + (progress.value.message || '生成中...');
  }
  return '就绪';
});

// 拖拽开始（Pointer Events 统一鼠标/触摸/手写笔）
function onDragStart(e: PointerEvent) {
  if ((e.target as HTMLElement).closest('.widget-actions')) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  isDragging.value = true;
  dragMoved = false;
  dragOffset.value = {
    x: e.clientX - position.value.x,
    y: e.clientY - position.value.y,
  };
  document.addEventListener('pointermove', onDragMove);
  document.addEventListener('pointerup', onDragEnd);
  document.addEventListener('pointercancel', onDragEnd);
}

// 拖拽移动
function onDragMove(e: PointerEvent) {
  if (!isDragging.value) return;
  const newX = e.clientX - dragOffset.value.x;
  const newY = e.clientY - dragOffset.value.y;
  if (!dragMoved && Math.abs(newX - position.value.x) + Math.abs(newY - position.value.y) > 4) {
    dragMoved = true;
  }
  // 限制在视口内
  const maxX = window.innerWidth - 200;
  const maxY = window.innerHeight - 80;
  position.value = {
    x: Math.max(0, Math.min(newX, maxX)),
    y: Math.max(0, Math.min(newY, maxY)),
  };
}

// 拖拽结束/中断（pointercancel 也要清理拖拽态）
function onDragEnd() {
  if (!isDragging.value) return;
  isDragging.value = false;
  if (dragMoved) {
    justDragged.value = true;
    setTimeout(() => { justDragged.value = false; }, 0);
    savePosition();
  }
  document.removeEventListener('pointermove', onDragMove);
  document.removeEventListener('pointerup', onDragEnd);
  document.removeEventListener('pointercancel', onDragEnd);
}

// 切换最小化
function toggleMinimize() {
  isMinimized.value = !isMinimized.value;
  savePosition();
}

// 跳转到剧本页面
function navigateToScript() {
  // 优先使用 store 中的项目 ID
  const projectId = currentProjectId.value || router.currentRoute.value.params.id;
  if (projectId) {
    router.push({ name: 'Script', params: { id: projectId } }).catch(() => {
      router.back();
    });
  } else {
    // 如果没有项目 ID，尝试从 localStorage 获取最近的项目
    const lastProjectId = localStorage.getItem('last-project-id');
    if (lastProjectId) {
      router.push({ name: 'Script', params: { id: lastProjectId } }).catch(() => {
        router.push({ name: 'Projects' });
      });
    } else {
      router.push({ name: 'Projects' });
    }
  }
}

// 关闭浮窗
function closeWidget() {
  isVisible.value = false;
}

// 监听生成状态变化
watch(isGenerating, (generating) => {
  if (generating) {
    isVisible.value = true;
  }
});

// 监听进度完成
watch(progressPercent, (percent) => {
  if (percent === 100 && !isGenerating.value) {
    // 生成完成后保持显示 5 秒
    setTimeout(() => {
      if (!isGenerating.value) {
        // 不自动关闭，让用户手动关闭
      }
    }, 5000);
  }
});

onMounted(() => {
  loadPosition();
  // 如果正在生成，显示浮窗
  if (isGenerating.value || progressPercent.value > 0) {
    isVisible.value = true;
  }
});

// 拖拽后抑制紧随的 click（拖动浮窗时松开手指/鼠标不应误触展开或跳转）
function onMinimizedClick() {
  if (justDragged.value) return;
  toggleMinimize();
}

function onNavigateClick() {
  if (justDragged.value) return;
  navigateToScript();
}

onUnmounted(() => {
  document.removeEventListener('pointermove', onDragMove);
  document.removeEventListener('pointerup', onDragEnd);
  document.removeEventListener('pointercancel', onDragEnd);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="widget-fade">
      <div
        v-if="isVisible"
        class="generation-floating-widget"
        :class="{ 'is-minimized': isMinimized, 'is-dragging': isDragging }"
        :style="{ right: `${position.x}px`, bottom: `${position.y}px` }"
        @pointerdown="onDragStart"
      >
        <!-- 最小化状态 -->
        <div v-if="isMinimized" class="widget-minimized" @click="onMinimizedClick">
          <span class="status-icon">{{ statusIcon }}</span>
          <span v-if="isGenerating" class="mini-progress">{{ progressPercent }}%</span>
        </div>

        <!-- 展开状态 -->
        <div v-else class="widget-expanded">
          <div class="widget-header">
            <span class="status-icon">{{ statusIcon }}</span>
            <span class="status-text">{{ statusText }}</span>
            <div class="widget-actions">
              <button class="action-btn" @click.stop="toggleMinimize" title="最小化">−</button>
              <button class="action-btn" @click.stop="closeWidget" title="关闭">×</button>
            </div>
          </div>

          <div class="widget-body">
            <!-- 进度条 -->
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${progressPercent}%` }"></div>
            </div>
            <div class="progress-info">
              <span class="progress-percent">{{ progressPercent }}%</span>
              <span class="word-count">{{ wordCount }} 字</span>
            </div>
          </div>

          <div class="widget-footer">
            <button class="nav-btn" @click="onNavigateClick">
              查看详情 →
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.generation-floating-widget {
  position: fixed;
  z-index: 9999;
  background: var(--bg-elevated, #1e1e2e);
  border: 1px solid var(--border-subtle, #313244);
  border-radius: 12px;
  box-shadow: 0 8px 32px var(--overlay-bg);
  cursor: grab;
  user-select: none;
  touch-action: none;
  transition: box-shadow 0.2s, transform 0.2s;
}

.generation-floating-widget:hover {
  box-shadow: 0 12px 40px var(--overlay-bg);
}

.generation-floating-widget.is-dragging {
  cursor: grabbing;
  transform: scale(1.02);
}

/* 最小化状态 */
.widget-minimized {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  cursor: pointer;
}

.widget-minimized .status-icon {
  font-size: 16px;
}

.widget-minimized .mini-progress {
  font-size: 12px;
  color: var(--text-secondary, #a6adc8);
  font-weight: 500;
}

/* 展开状态 */
.widget-expanded {
  width: 200px;
}

.widget-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-subtle, #313244);
}

.widget-header .status-icon {
  font-size: 14px;
}

.widget-header .status-text {
  flex: 1;
  font-size: 12px;
  color: var(--text-primary, #cdd6f4);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.widget-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--text-secondary, #a6adc8);
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}

.action-btn:hover {
  background: var(--bg-hover, #313244);
  color: var(--text-primary, #cdd6f4);
}

.widget-body {
  padding: 12px;
}

.progress-bar {
  height: 6px;
  background: var(--bg-subtle, #181825);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-primary, #89b4fa), var(--accent-secondary, #b4befe));
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-secondary, #a6adc8);
}

.progress-percent {
  font-weight: 600;
  color: var(--accent-primary, #89b4fa);
}

.widget-footer {
  padding: 8px 12px;
  border-top: 1px solid var(--border-subtle, #313244);
}

.nav-btn {
  width: 100%;
  padding: 6px 12px;
  border: none;
  background: var(--accent-primary, #89b4fa);
  color: var(--bg-base, #1e1e2e);
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: opacity 0.15s;
}

.nav-btn:hover {
  opacity: 0.9;
}

/* 动画 */
.widget-fade-enter-active,
.widget-fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.widget-fade-enter-from,
.widget-fade-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}
</style>
