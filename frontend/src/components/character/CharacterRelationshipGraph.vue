<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Character, ICharacterRelationshipData, RelationshipLevel, RelationshipEventType, RelationshipImpact } from '@/types';
import { characterEnhancementApi } from '@/services/api';
import { useToast } from '@/composables/useToast';

const props = defineProps<{
  character: Character;
  projectId: string;
  relationships: ICharacterRelationshipData[];
  allCharacters: Character[];
}>();

const emit = defineEmits<{
  (e: 'update'): void;
}>();

const toast = useToast();

const relationshipLevels: { value: RelationshipLevel; label: string; color: string }[] = [
  { value: 'intimate', label: '亲密', color: '#ec4899' },
  { value: 'close', label: '亲近', color: 'var(--warning)' },
  { value: 'familiar', label: '熟悉', color: 'var(--success)' },
  { value: 'acquaintance', label: '相识', color: 'var(--info)' },
  { value: 'stranger', label: '陌生', color: '#94a3b8' },
  { value: 'hostile', label: '敌对', color: 'var(--error)' },
  { value: 'enemy', label: '仇敌', color: '#7f1d1d' },
];

const eventTypes: { value: RelationshipEventType; label: string }[] = [
  { value: 'first_meeting', label: '初次相遇' },
  { value: 'bonding', label: '建立羁绊' },
  { value: 'conflict', label: '发生冲突' },
  { value: 'betrayal', label: '背叛' },
  { value: 'reconciliation', label: '和解' },
  { value: 'deepening', label: '关系加深' },
];

const impacts: { value: RelationshipImpact; label: string }[] = [
  { value: 'positive', label: '正面' },
  { value: 'negative', label: '负面' },
  { value: 'neutral', label: '中性' },
];

type EnrichedRelationship = ICharacterRelationshipData & {
  otherCharacterId: string;
  otherCharacterName: string;
};

const characterRelationships = computed<EnrichedRelationship[]>(() => {
  return props.relationships.map(rel => {
    const isCharA = rel.characterAId === props.character._id;
    return {
      ...rel,
      otherCharacterId: isCharA ? rel.characterBId : rel.characterAId,
      otherCharacterName: isCharA ? rel.characterBName : rel.characterAName,
    };
  });
});

const availableCharacters = computed(() => {
  const relatedIds = new Set(characterRelationships.value.map(r => r.otherCharacterId));
  return props.allCharacters.filter(c => c._id !== props.character._id && !relatedIds.has(c._id));
});

const showRelationForm = ref(false);
const showEventForm = ref(false);
const selectedRelationship = ref<EnrichedRelationship | null>(null);

const relationForm = ref({
  targetCharacterId: '',
  level: 'acquaintance' as RelationshipLevel,
  event: '',
  episode: 1,
});

const eventForm = ref({
  episode: 1,
  type: 'bonding' as RelationshipEventType,
  description: '',
  impact: 'positive' as RelationshipImpact,
});

const getLevelInfo = (level: RelationshipLevel): { value: RelationshipLevel; label: string; color: string } => {
  const found = relationshipLevels.find(l => l.value === level);
  return found ?? { value: 'stranger', label: '陌生', color: '#94a3b8' };
};

const getEventTypeLabel = (type: RelationshipEventType) => {
  return eventTypes.find(t => t.value === type)?.label || type;
};

const addRelationship = async () => {
  if (!relationForm.value.targetCharacterId || !relationForm.value.event.trim()) {
    toast.warning('请选择角色并填写事件');
    return;
  }
  const targetChar = props.allCharacters.find(c => c._id === relationForm.value.targetCharacterId);
  if (!targetChar) return;

  try {
    await characterEnhancementApi.updateRelationship({
      projectId: props.projectId,
      charAId: props.character._id,
      charBId: targetChar._id,
      charAName: props.character.name,
      charBName: targetChar.name,
      level: relationForm.value.level,
      event: relationForm.value.event,
      episode: relationForm.value.episode,
    });
    toast.success('关系已建立');
    showRelationForm.value = false;
    relationForm.value = { targetCharacterId: '', level: 'acquaintance', event: '', episode: 1 };
    emit('update');
  } catch (error) {
    toast.error('操作失败');
  }
};

const updateRelationshipLevel = async (rel: EnrichedRelationship, newLevel: RelationshipLevel) => {
  try {
    await characterEnhancementApi.updateRelationship({
      projectId: props.projectId,
      charAId: props.character._id,
      charBId: rel.otherCharacterId,
      charAName: props.character.name,
      charBName: rel.otherCharacterName,
      level: newLevel,
      event: '关系等级调整',
      episode: rel.lastInteractionEpisode || 1,
    });
    toast.success('关系已更新');
    emit('update');
  } catch (error) {
    toast.error('更新失败');
  }
};

const addKeyEvent = async () => {
  if (!selectedRelationship.value || !eventForm.value.description.trim()) {
    toast.warning('请填写事件描述');
    return;
  }
  try {
    await characterEnhancementApi.recordRelationshipEvent({
      projectId: props.projectId,
      charAId: props.character._id,
      charBId: selectedRelationship.value.otherCharacterId,
      charAName: props.character.name,
      charBName: selectedRelationship.value.otherCharacterName,
      episode: eventForm.value.episode,
      type: eventForm.value.type,
      description: eventForm.value.description,
      impact: eventForm.value.impact,
    });
    toast.success('事件已记录');
    showEventForm.value = false;
    selectedRelationship.value = null;
    eventForm.value = { episode: 1, type: 'bonding', description: '', impact: 'positive' };
    emit('update');
  } catch (error) {
    toast.error('记录失败');
  }
};

const getSentimentDisplay = (sentiment: number) => {
  if (sentiment > 0.5) return { label: '非常好', color: 'var(--success)' };
  if (sentiment > 0) return { label: '良好', color: '#84cc16' };
  if (sentiment === 0) return { label: '中性', color: '#94a3b8' };
  if (sentiment > -0.5) return { label: '紧张', color: 'var(--warning)' };
  return { label: '恶劣', color: 'var(--error)' };
};
</script>

<template>
  <div class="relationship-graph">
    <div class="graph-header">
      <span class="header-title">关系网络</span>
      <button v-if="availableCharacters.length > 0" class="btn-action" @click="showRelationForm = !showRelationForm">
        {{ showRelationForm ? '取消' : '+ 添加关系' }}
      </button>
    </div>

    <div v-if="showRelationForm" class="form-card">
      <div class="form-row">
        <div class="form-field">
          <label>选择角色</label>
          <select v-model="relationForm.targetCharacterId" class="field-select">
            <option value="">请选择...</option>
            <option v-for="char in availableCharacters" :key="char._id" :value="char._id">
              {{ char.name }}
            </option>
          </select>
        </div>
        <div class="form-field">
          <label>关系等级</label>
          <select v-model="relationForm.level" class="field-select">
            <option v-for="level in relationshipLevels" :key="level.value" :value="level.value">
              {{ level.label }}
            </option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label>发生集数</label>
          <input v-model.number="relationForm.episode" type="number" min="1" class="field-input" />
        </div>
      </div>
      <div class="form-field full">
        <label>建立关系的事件</label>
        <input v-model="relationForm.event" type="text" class="field-input" placeholder="描述两人如何建立关系..." />
      </div>
      <button class="btn-primary" @click="addRelationship">保存</button>
    </div>

    <div class="relationship-list">
      <div v-if="characterRelationships.length === 0" class="empty-hint">
        暂无关系记录
      </div>
      <div v-for="rel in characterRelationships" :key="rel._id" class="relationship-card">
        <div class="card-header">
          <div class="char-info">
            <div class="char-avatar">{{ rel.otherCharacterName.charAt(0) }}</div>
            <div class="char-name">{{ rel.otherCharacterName }}</div>
          </div>
          <div class="level-badge" :style="{ backgroundColor: getLevelInfo(rel.currentLevel).color }">
            {{ getLevelInfo(rel.currentLevel).label }}
          </div>
        </div>

        <div class="card-body">
          <!-- 情感值 -->
          <div class="sentiment-bar">
            <div class="sentiment-label">情感值</div>
            <div class="sentiment-track">
              <div
                class="sentiment-fill"
                :style="{
                  width: `${(rel.sentiment + 1) * 50}%`,
                  backgroundColor: getSentimentDisplay(rel.sentiment).color
                }"
              ></div>
              <div class="sentiment-marker" :style="{ left: `${(rel.sentiment + 1) * 50}%` }"></div>
            </div>
            <div class="sentiment-value" :style="{ color: getSentimentDisplay(rel.sentiment).color }">
              {{ getSentimentDisplay(rel.sentiment).label }}
            </div>
          </div>

          <!-- 快速调整等级 -->
          <div class="level-adjust">
            <span class="adjust-label">调整等级：</span>
            <div class="level-buttons">
              <button
                v-for="level in relationshipLevels"
                :key="level.value"
                class="level-btn"
                :class="{ active: rel.currentLevel === level.value }"
                :style="{ '--level-color': level.color }"
                @click="updateRelationshipLevel(rel, level.value)"
              >
                {{ level.label }}
              </button>
            </div>
          </div>

          <!-- 关键事件 -->
          <div class="key-events">
            <div class="events-header">
              <span>关键事件</span>
              <button class="btn-small" @click="selectedRelationship = rel; showEventForm = true">+ 添加</button>
            </div>
            <div v-if="rel.keyEvents.length === 0" class="empty-hint small">暂无关键事件</div>
            <div v-for="(event, idx) in rel.keyEvents.slice(-3)" :key="idx" class="event-item">
              <span class="event-episode">第{{ event.episode }}集</span>
              <span class="event-type" :class="event.impact">{{ getEventTypeLabel(event.type) }}</span>
              <span class="event-desc">{{ event.description }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加事件弹窗 -->
    <div v-if="showEventForm && selectedRelationship" class="modal-overlay" @click.self="showEventForm = false">
      <div class="modal-content">
        <div class="modal-header">
          <span>添加关键事件</span>
          <button class="modal-close" @click="showEventForm = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-field">
              <label>集数</label>
              <input v-model.number="eventForm.episode" type="number" min="1" class="field-input" />
            </div>
            <div class="form-field">
              <label>事件类型</label>
              <select v-model="eventForm.type" class="field-select">
                <option v-for="t in eventTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
              </select>
            </div>
            <div class="form-field">
              <label>影响</label>
              <select v-model="eventForm.impact" class="field-select">
                <option v-for="i in impacts" :key="i.value" :value="i.value">{{ i.label }}</option>
              </select>
            </div>
          </div>
          <div class="form-field full">
            <label>事件描述</label>
            <textarea v-model="eventForm.description" class="field-textarea" rows="3" placeholder="描述这个事件..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" @click="showEventForm = false">取消</button>
          <button class="btn-primary" @click="addKeyEvent">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.relationship-graph {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.graph-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-title {
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

.form-card {
  background: var(--bg-base);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-3);
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
  background: var(--bg-elevated);
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

.btn-ghost {
  padding: var(--space-2) var(--space-4);
  background: transparent;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  cursor: pointer;
}

.relationship-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.empty-hint {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  text-align: center;
  padding: var(--space-4);
}

.empty-hint.small {
  padding: var(--space-2);
  font-size: var(--text-xs);
}

.relationship-card {
  background: var(--bg-base);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-default);
}

.char-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.char-avatar {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-muted);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--primary);
}

.char-name {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.level-badge {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-on-primary);
}

.card-body {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.sentiment-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.sentiment-label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  width: 50px;
}

.sentiment-track {
  flex: 1;
  height: 6px;
  background: var(--bg-hover);
  border-radius: var(--radius-full);
  position: relative;
}

.sentiment-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.3s;
}

.sentiment-marker {
  position: absolute;
  top: -3px;
  width: 12px;
  height: 12px;
  background: white;
  border: 2px solid var(--border-default);
  border-radius: var(--radius-full);
  transform: translateX(-50%);
}

.sentiment-value {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  width: 50px;
  text-align: right;
}

.level-adjust {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.adjust-label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.level-buttons {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}

.level-btn {
  padding: 2px 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.level-btn:hover {
  border-color: var(--level-color);
  color: var(--level-color);
}

.level-btn.active {
  background: var(--level-color);
  border-color: var(--level-color);
  color: var(--text-on-primary);
}

.key-events {
  border-top: 1px solid var(--border-default);
  padding-top: var(--space-3);
}

.events-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.btn-small {
  padding: 2px 6px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  cursor: pointer;
}

.event-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) 0;
  font-size: var(--text-xs);
}

.event-episode {
  color: var(--text-tertiary);
}

.event-type {
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: var(--bg-hover);
}

.event-type.positive { background: var(--success-muted); color: var(--success); }
.event-type.negative { background: #fee2e2; color: var(--error); }
.event-type.neutral { background: var(--bg-hover); color: var(--text-secondary); }

.event-desc {
  color: var(--text-secondary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  border-bottom: 1px solid var(--border-default);
  font-weight: var(--font-semibold);
}

.modal-close {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--text-tertiary);
  cursor: pointer;
}

.modal-body {
  padding: var(--space-4);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-4);
  border-top: 1px solid var(--border-default);
}
</style>
