<script setup lang="ts">
import { computed } from 'vue';
import Modal from '@/components/common/Modal.vue';
import { useAttentionStore } from '@/stores/attentionStore';
import { useProjectStore } from '@/stores/projectStore';

const props = defineProps<{
  visible: boolean;
  projectId: string;
  episodeNumber: number;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm'): void;
}>();

const attentionStore = useAttentionStore();
const projectStore = useProjectStore();

// 获取当前项目配置
const currentProject = computed(() => {
  return projectStore.projects.find(p => p._id === props.projectId);
});

// 节奏配置显示
const rhythmPreset = computed(() => {
  // 假设 UseWorldStateStore 中有 rhythm 信息，或者 RhythmController 会同步到 Project
  // 由于前端 Rhythm Dashboard 使用 WorldStateStore/Log，我们这里尝试获取
  // 简化起见，如果 Store 中没有明确的 "CurrentPreset"，显示 "默认/已配置"
  // 实际项目中可能需要从 RhythmStore 获取 (如果有)
  return '当前配置'; 
});

// 注意力配置显示
const attentionMode = computed(() => {
  const config = attentionStore.currentConfig;
  if (config.mode === 'custom') {
    const count = config.enabledHeads?.length || 0;
    return `自定义 (${count}个注意力头)`;
  }
  return '自动 (根据题材匹配)';
});

// 写作风格显示
const writingStyle = computed(() => {
  const style = currentProject.value?.writingStyle;
  if (!style) return '标准模式 (默认)';
  
  const styleNames: Record<string, string> = {
    literary: '文艺风', colloquial: '口语化', humorous: '幽默风', serious: '严肃风',
    poetic: '诗意风', dramatic: '戏剧化', minimalist: '极简风', descriptive: '描写细腻', custom: '自定义'
  };
  return styleNames[style.preset] || style.preset;
});

const handleConfirm = () => {
  emit('confirm');
};
</script>

<template>
  <Modal
    :show="visible"
    title="🚀 生成前配置确认"
    width="500px"
    @close="$emit('close')"
  >
    <div class="confirmation-content">
      <div class="alert-box">
        <i class="icon">⚠️</i>
        <p>即将开始生成第 {{ episodeNumber }} 集。生成一旦开始，<b>中途无法修改配置</b>。</p>
      </div>

      <div class="config-summary">
        <div class="summary-item">
          <label>🎭 写作风格</label>
          <div class="value">{{ writingStyle }}</div>
        </div>
        <div class="summary-item">
          <label>📊 节奏控制</label>
          <div class="value">{{ rhythmPreset }}</div>
        </div>
        <div class="summary-item">
          <label>🧠 注意力头</label>
          <div class="value">{{ attentionMode }}</div>
        </div>
      </div>

      <div class="actions">
        <button class="btn-cancel" @click="$emit('close')">调整配置</button>
        <button class="btn-confirm" @click="handleConfirm">确认并开始</button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.confirmation-content {
  padding: var(--space-2);
}

.alert-box {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--warning-muted);
  border: 1px solid var(--warning);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-5);
  align-items: center;
}

.alert-box .icon {
  font-style: normal;
  font-size: var(--text-xl);
}

.alert-box p {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--warning-dark);
}

.config-summary {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  margin-bottom: var(--space-5);
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--border-default);
}

.summary-item:last-child {
  border-bottom: none;
}

.summary-item label {
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.summary-item .value {
  font-weight: var(--font-semibold);
  color: var(--primary);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}

.btn-cancel {
  padding: var(--space-2) var(--space-4);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  cursor: pointer;
  font-weight: var(--font-medium);
}

.btn-cancel:hover {
  background: var(--bg-hover);
}

.btn-confirm {
  padding: var(--space-2) var(--space-5);
  background: var(--primary);
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-on-primary);
  cursor: pointer;
  font-weight: var(--font-semibold);
  box-shadow: var(--shadow-sm);
}

.btn-confirm:hover {
  background: var(--primary-hover);
}
</style>
