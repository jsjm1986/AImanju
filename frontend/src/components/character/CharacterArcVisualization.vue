<script setup lang="ts">
/**
 * 角色成长弧线可视化
 * 展示成长阶段、转折点、成长事件和里程碑
 * Requirements: 7.5
 */
import { ref, computed } from 'vue';
import type { Character, ICharacterArc, GrowthStage, GrowthEventType } from '@/types';
import { characterEnhancementApi } from '@/services/api';
import { useToast } from '@/composables/useToast';

const props = defineProps<{
  character: Character;
  projectId: string;
  arc?: ICharacterArc;
}>();

const emit = defineEmits<{
  (e: 'update'): void;
}>();

const toast = useToast();

const stages: { value: GrowthStage; label: string; desc: string; color: string }[] = [
  { value: 'initial', label: '初始', desc: '故事开始时的状态', color: '#94a3b8' },
  { value: 'challenged', label: '受挑战', desc: '遭遇困难，开始动摇', color: 'var(--warning)' },
  { value: 'growing', label: '成长中', desc: '积极改变和成长', color: 'var(--success)' },
  { value: 'transformed', label: '蜕变', desc: '完成重大转变', color: 'var(--primary-hover)' },
];

const eventTypes: { value: GrowthEventType; label: string }[] = [
  { value: 'realization', label: '领悟' },
  { value: 'setback', label: '挫折' },
  { value: 'breakthrough', label: '突破' },
  { value: 'relationship', label: '关系变化' },
];

const currentStageIndex = computed(() => {
  const stage = props.arc?.currentStage || 'initial';
  return stages.findIndex(s => s.value === stage);
});

// 表单状态
const showStageForm = ref(false);
const showEventForm = ref(false);
const showTurningForm = ref(false);

const stageForm = ref({
  stage: 'challenged' as GrowthStage,
  trigger: '',
  episode: 1,
});

const eventForm = ref({
  episode: 1,
  type: 'realization' as GrowthEventType,
  description: '',
});

const turningForm = ref({
  episode: 1,
  event: '',
  impact: '',
  beforeState: '',
  afterState: '',
});

const updateStage = async () => {
  if (!stageForm.value.trigger.trim()) {
    toast.warning('请填写触发原因');
    return;
  }
  try {
    await characterEnhancementApi.updateStage(props.character._id, {
      projectId: props.projectId,
      characterName: props.character.name,
      stage: stageForm.value.stage,
      trigger: stageForm.value.trigger,
      episode: stageForm.value.episode,
    });
    toast.success('成长阶段已更新');
    showStageForm.value = false;
    stageForm.value = { stage: 'challenged', trigger: '', episode: 1 };
    emit('update');
  } catch (error) {
    toast.error('更新失败');
  }
};

const addGrowthEvent = async () => {
  if (!eventForm.value.description.trim()) {
    toast.warning('请填写描述');
    return;
  }
  try {
    await characterEnhancementApi.recordGrowthEvent(props.character._id, {
      projectId: props.projectId,
      characterName: props.character.name,
      episode: eventForm.value.episode,
      type: eventForm.value.type,
      description: eventForm.value.description,
    });
    toast.success('成长事件已记录');
    showEventForm.value = false;
    eventForm.value = { episode: 1, type: 'realization', description: '' };
    emit('update');
  } catch (error) {
    toast.error('记录失败');
  }
};

const addTurningPoint = async () => {
  if (!turningForm.value.event.trim() || !turningForm.value.impact.trim()) {
    toast.warning('请填写事件和影响');
    return;
  }
  try {
    await characterEnhancementApi.recordTurningPoint(props.character._id, {
      projectId: props.projectId,
      characterName: props.character.name,
      episode: turningForm.value.episode,
      event: turningForm.value.event,
      impact: turningForm.value.impact,
      beforeState: turningForm.value.beforeState,
      afterState: turningForm.value.afterState,
    });
    toast.success('转折点已记录');
    showTurningForm.value = false;
    turningForm.value = { episode: 1, event: '', impact: '', beforeState: '', afterState: '' };
    emit('update');
  } catch (error) {
    toast.error('记录失败');
  }
};

const getEventTypeLabel = (type: GrowthEventType) => {
  return eventTypes.find(t => t.value === type)?.label || type;
};
</script>

<template>
  <div class="arc-visualization">
    <!-- 成长阶段进度条 -->
    <div class="stage-progress">
      <div class="progress-header">
        <span class="section-title">成长阶段</span>
        <button class="btn-action" @click="showStageForm = !showStageForm">
          {{ showStageForm ? '取消' : '更新阶段' }}
        </button>
      </div>

      <div class="stage-track">
        <div
          v-for="(stage, idx) in stages"
          :key="stage.value"
          class="stage-node"
          :class="{ active: idx <= currentStageIndex, current: idx === currentStageIndex }"
        >
          <div class="node-dot" :style="{ backgroundColor: idx <= currentStageIndex ? stage.color : undefined }"></div>
          <div class="node-label">{{ stage.label }}</div>
          <div class="node-desc">{{ stage.desc }}</div>
        </div>
        <div class="stage-line">
          <div class="line-fill" :style="{ width: `${(currentStageIndex / (stages.length - 1)) * 100}%` }"></div>
        </div>
      </div>

      <!-- 更新阶段表单 -->
      <div v-if="showStageForm" class="form-card">
        <div class="form-row">
          <div class="form-field">
            <label>新阶段</label>
            <select v-model="stageForm.stage" class="field-select">
              <option v-for="s in stages" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>
          </div>
          <div class="form-field">
            <label>发生集数</label>
            <input v-model.number="stageForm.episode" type="number" min="1" class="field-input" />
          </div>
        </div>
        <div class="form-field full">
          <label>触发原因</label>
          <input v-model="stageForm.trigger" type="text" class="field-input" placeholder="是什么导致了这个阶段的转变..." />
        </div>
        <button class="btn-primary" @click="updateStage">保存</button>
      </div>
    </div>

    <!-- 转折点 -->
    <div class="arc-section">
      <div class="section-header">
        <span class="section-icon">🔄</span>
        <span class="section-title">转折点</span>
        <button class="btn-action" @click="showTurningForm = !showTurningForm">
          {{ showTurningForm ? '取消' : '+ 添加' }}
        </button>
      </div>

      <div v-if="showTurningForm" class="form-card">
        <div class="form-row">
          <div class="form-field">
            <label>集数</label>
            <input v-model.number="turningForm.episode" type="number" min="1" class="field-input" />
          </div>
        </div>
        <div class="form-field full">
          <label>事件</label>
          <input v-model="turningForm.event" type="text" class="field-input" placeholder="发生了什么..." />
        </div>
        <div class="form-field full">
          <label>影响</label>
          <input v-model="turningForm.impact" type="text" class="field-input" placeholder="对角色产生了什么影响..." />
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>转变前状态</label>
            <input v-model="turningForm.beforeState" type="text" class="field-input" placeholder="可选" />
          </div>
          <div class="form-field">
            <label>转变后状态</label>
            <input v-model="turningForm.afterState" type="text" class="field-input" placeholder="可选" />
          </div>
        </div>
        <button class="btn-primary" @click="addTurningPoint">保存</button>
      </div>

      <div class="timeline">
        <div v-if="!arc?.turningPoints?.length" class="empty-hint">暂无转折点记录</div>
        <div v-for="(tp, idx) in arc?.turningPoints" :key="idx" class="timeline-item turning">
          <div class="item-marker">🔄</div>
          <div class="item-content">
            <div class="item-meta">第{{ tp.episode }}集</div>
            <div class="item-title">{{ tp.event }}</div>
            <div class="item-desc">{{ tp.impact }}</div>
            <div v-if="tp.beforeState || tp.afterState" class="item-states">
              <span v-if="tp.beforeState">{{ tp.beforeState }}</span>
              <span v-if="tp.beforeState && tp.afterState">→</span>
              <span v-if="tp.afterState">{{ tp.afterState }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 成长事件 -->
    <div class="arc-section">
      <div class="section-header">
        <span class="section-icon">📈</span>
        <span class="section-title">成长事件</span>
        <button class="btn-action" @click="showEventForm = !showEventForm">
          {{ showEventForm ? '取消' : '+ 添加' }}
        </button>
      </div>

      <div v-if="showEventForm" class="form-card">
        <div class="form-row">
          <div class="form-field">
            <label>集数</label>
            <input v-model.number="eventForm.episode" type="number" min="1" class="field-input" />
          </div>
          <div class="form-field">
            <label>类型</label>
            <select v-model="eventForm.type" class="field-select">
              <option v-for="t in eventTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
          </div>
        </div>
        <div class="form-field full">
          <label>描述</label>
          <textarea v-model="eventForm.description" class="field-textarea" rows="2" placeholder="描述这个成长事件..."></textarea>
        </div>
        <button class="btn-primary" @click="addGrowthEvent">保存</button>
      </div>

      <div class="timeline">
        <div v-if="!arc?.growthEvents?.length" class="empty-hint">暂无成长事件记录</div>
        <div v-for="(event, idx) in arc?.growthEvents" :key="idx" class="timeline-item event">
          <div class="item-marker" :class="event.type">
            {{ event.type === 'realization' ? '💡' : event.type === 'setback' ? '⚠️' : event.type === 'breakthrough' ? '🚀' : '❤️' }}
          </div>
          <div class="item-content">
            <div class="item-meta">
              <span>第{{ event.episode }}集</span>
              <span class="event-type" :class="event.type">{{ getEventTypeLabel(event.type) }}</span>
            </div>
            <div class="item-desc">{{ event.description }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.arc-visualization {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.stage-progress {
  background: var(--bg-base);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}

.progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.section-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.btn-action {
  padding: var(--space-1) var(--space-2);
  background: var(--primary-muted);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--primary);
  cursor: pointer;
}

.stage-track {
  position: relative;
  display: flex;
  justify-content: space-between;
  padding: 0 var(--space-2);
}

.stage-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  z-index: 1;
  opacity: 0.5;
}

.stage-node.active {
  opacity: 1;
}

.stage-node.current .node-dot {
  transform: scale(1.3);
  box-shadow: 0 0 0 4px var(--primary-muted);
}

.node-dot {
  width: 16px;
  height: 16px;
  border-radius: var(--radius-full);
  background: var(--bg-hover);
  border: 2px solid var(--border-default);
  transition: all 0.2s;
}

.node-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.node-desc {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  text-align: center;
  max-width: 80px;
}

.stage-line {
  position: absolute;
  top: 7px;
  left: var(--space-4);
  right: var(--space-4);
  height: 2px;
  background: var(--border-default);
}

.line-fill {
  height: 100%;
  background: var(--primary);
  transition: width 0.3s;
}

.arc-section {
  background: var(--bg-base);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-3);
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

.section-header .section-title {
  flex: 1;
}

.form-card {
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  margin-bottom: var(--space-3);
}

.form-row {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
}

.form-field.full {
  margin-bottom: var(--space-3);
}

.form-field label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.field-input,
.field-select,
.field-textarea {
  padding: var(--space-2);
  background: var(--bg-base);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.btn-primary {
  padding: var(--space-2) var(--space-4);
  background: var(--primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-on-primary);
  cursor: pointer;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.empty-hint {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  text-align: center;
  padding: var(--space-4);
}

.timeline-item {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-2);
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
}

.item-marker {
  font-size: 16px;
  flex-shrink: 0;
}

.item-content {
  flex: 1;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-bottom: var(--space-1);
}

.item-title {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: var(--space-1);
}

.item-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.item-states {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.event-type {
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: var(--bg-hover);
}

.event-type.realization { background: #dbeafe; color: var(--info); }
.event-type.setback { background: #fee2e2; color: var(--error); }
.event-type.breakthrough { background: var(--success-muted); color: var(--success); }
.event-type.relationship { background: #fce7f3; color: #db2777; }
</style>
