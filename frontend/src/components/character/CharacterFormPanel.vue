<template>
  <div class="form-panel">
    <!-- 当前形态 -->
    <div class="current-form-section">
      <div class="section-header">
        <span class="section-icon">🔮</span>
        <span class="section-title">当前形态</span>
      </div>
      <div class="current-form-display">
        <div class="form-badge" :class="{ 'is-base': isBaseForm }">
          <span class="form-icon">{{ getFormIcon(currentForm) }}</span>
          <span class="form-name">{{ currentForm }}</span>
        </div>
        <div v-if="!isBaseForm" class="base-form-hint">
          基础形态: {{ baseForm }}
        </div>
      </div>
    </div>

    <!-- 已解锁形态 -->
    <div class="unlocked-forms-section">
      <div class="section-header">
        <span class="section-icon">✨</span>
        <span class="section-title">已解锁形态</span>
        <span class="form-count">{{ unlockedForms.length }}</span>
      </div>
      <div class="forms-grid">
        <div
          v-for="form in unlockedForms"
          :key="form"
          class="form-card"
          :class="{ 
            active: form === currentForm,
            base: form === baseForm 
          }"
        >
          <span class="form-card-icon">{{ getFormIcon(form) }}</span>
          <span class="form-card-name">{{ form }}</span>
          <span v-if="form === currentForm" class="current-badge">当前</span>
          <span v-else-if="form === baseForm" class="base-badge">基础</span>
        </div>
      </div>
      <div v-if="unlockedForms.length === 0" class="empty-forms">
        暂无解锁的形态
      </div>
    </div>

    <!-- 形态变化历史 -->
    <div class="form-history-section">
      <div class="section-header">
        <span class="section-icon">📜</span>
        <span class="section-title">形态变化历史</span>
      </div>
      <div v-if="formHistory.length > 0" class="history-timeline">
        <div
          v-for="(record, index) in formHistory"
          :key="index"
          class="history-item"
        >
          <div class="history-marker">
            <div class="marker-dot"></div>
            <div v-if="index < formHistory.length - 1" class="marker-line"></div>
          </div>
          <div class="history-content">
            <div class="history-episode">第{{ record.episode }}集</div>
            <div class="history-change">
              <span class="from-form">{{ record.from }}</span>
              <span class="arrow">→</span>
              <span class="to-form">{{ record.to }}</span>
            </div>
            <div class="history-trigger">
              <span class="trigger-label">触发:</span>
              <span class="trigger-value">{{ record.trigger }}</span>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="empty-history">
        暂无形态变化记录
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { IFormChangeRecord } from '@/types/worldState';

const props = withDefaults(defineProps<{
  currentForm?: string;
  baseForm?: string;
  unlockedForms?: string[];
  formHistory?: IFormChangeRecord[];
}>(), {
  currentForm: '基础形态',
  baseForm: '基础形态',
  unlockedForms: () => ['基础形态'],
  formHistory: () => [],
});

const isBaseForm = computed(() => props.currentForm === props.baseForm);

// 根据形态名称返回对应图标
const getFormIcon = (form: string): string => {
  const iconMap: Record<string, string> = {
    '基础形态': '👤',
    '人形': '👤',
    '狼形': '🐺',
    '半狼形': '🐾',
    '兽形': '🦁',
    '觉醒形态': '⚡',
    '完全体': '🌟',
    '狂暴化': '💢',
    '战斗形态': '⚔️',
    '练气期': '🌱',
    '筑基期': '🌿',
    '金丹期': '💎',
    '元婴期': '👶',
    '化神期': '✨',
    '超级赛亚人': '💛',
  };
  
  // 尝试匹配关键词
  for (const [key, icon] of Object.entries(iconMap)) {
    if (form.includes(key) || key.includes(form)) {
      return icon;
    }
  }
  
  // 默认图标
  return '🔄';
};
</script>

<style scoped>
.form-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.section-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.section-icon {
  font-size: 16px;
}

.section-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.form-count {
  margin-left: auto;
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  background: var(--bg-hover);
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

/* 当前形态 */
.current-form-section {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}

.current-form-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.form-badge {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  background: linear-gradient(135deg, var(--primary-muted), var(--bg-elevated));
  border: 2px solid var(--primary);
  border-radius: var(--radius-lg);
}

.form-badge.is-base {
  background: var(--bg-elevated);
  border-color: var(--border-default);
}

.form-icon {
  font-size: 24px;
}

.form-name {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.base-form-hint {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

/* 已解锁形态 */
.unlocked-forms-section {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}

.forms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: var(--space-2);
}

.form-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  position: relative;
  transition: all 0.15s;
}

.form-card:hover {
  border-color: var(--border-hover);
  background: var(--bg-hover);
}

.form-card.active {
  border-color: var(--primary);
  background: var(--primary-muted);
}

.form-card.base:not(.active) {
  border-style: dashed;
}

.form-card-icon {
  font-size: 20px;
}

.form-card-name {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  text-align: center;
}

.current-badge,
.base-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: var(--radius-full);
}

.current-badge {
  background: var(--primary);
  color: var(--text-on-primary);
}

.base-badge {
  background: var(--bg-hover);
  color: var(--text-tertiary);
  border: 1px solid var(--border-default);
}

.empty-forms {
  text-align: center;
  padding: var(--space-4);
  color: var(--text-tertiary);
  font-size: var(--text-sm);
}

/* 形态历史 */
.form-history-section {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}

.history-timeline {
  display: flex;
  flex-direction: column;
}

.history-item {
  display: flex;
  gap: var(--space-3);
  padding-bottom: var(--space-4);
}

.history-item:last-child {
  padding-bottom: 0;
}

.history-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 16px;
  flex-shrink: 0;
}

.marker-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--primary);
  border: 2px solid var(--bg-surface);
  box-shadow: 0 0 0 2px var(--primary-muted);
  z-index: 1;
}

.marker-line {
  flex: 1;
  width: 2px;
  background: var(--border-default);
  margin-top: var(--space-1);
}

.history-content {
  flex: 1;
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  border: 1px solid var(--border-default);
}

.history-episode {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--primary);
  margin-bottom: var(--space-2);
}

.history-change {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.from-form {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  padding: 2px 8px;
  background: var(--bg-hover);
  border-radius: var(--radius-sm);
}

.arrow {
  color: var(--text-tertiary);
}

.to-form {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  padding: 2px 8px;
  background: var(--primary-muted);
  border-radius: var(--radius-sm);
}

.history-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
}

.trigger-label {
  color: var(--text-tertiary);
}

.trigger-value {
  color: var(--text-secondary);
}

.empty-history {
  text-align: center;
  padding: var(--space-4);
  color: var(--text-tertiary);
  font-size: var(--text-sm);
}
</style>
