<template>
  <div class="state-timeline">
    <div class="timeline-header">
      <h4>{{ characterName }} - 状态时间线</h4>
      <div class="legend">
        <span class="legend-item positive">正面变化</span>
        <span class="legend-item negative">负面变化</span>
        <span class="legend-item neutral">状态记录</span>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      加载中...
    </div>

    <div v-else-if="states.length === 0" class="empty-state">
      暂无状态记录
    </div>

    <div v-else class="timeline-container">
      <div
        v-for="(state, index) in states"
        :key="state._id || index"
        class="timeline-item"
        :class="getStateClass(state)"
      >
        <div class="timeline-marker">
          <div class="marker-dot"></div>
          <div v-if="index < states.length - 1" class="marker-line"></div>
        </div>

        <div class="timeline-content">
          <div class="timeline-episode">第{{ state.episode }}集</div>

          <!-- 位置变化 -->
          <div v-if="state.location" class="state-item location">
            <span class="state-label">位置:</span>
            <span class="state-value">{{ state.location }}</span>
          </div>

          <!-- 状态描述 -->
          <div v-if="state.status" class="state-item status">
            <span class="state-label">状态:</span>
            <span class="state-value">{{ state.status }}</span>
          </div>

          <!-- 能力变化 -->
          <div v-if="state.powerLevel" class="state-item power">
            <span class="state-label">实力:</span>
            <span class="state-value">{{ state.powerLevel }}</span>
            <span v-if="state.powerChange" class="power-change" :class="state.powerChange > 0 ? 'up' : 'down'">
              {{ state.powerChange > 0 ? '↑' : '↓' }}{{ Math.abs(state.powerChange) }}
            </span>
          </div>

          <!-- 装备/物品变化 -->
          <div v-if="state.items && state.items.length > 0" class="state-item items">
            <span class="state-label">获得物品:</span>
            <span class="item-tags">
              <span v-for="item in state.items" :key="item" class="item-tag">{{ item }}</span>
            </span>
          </div>

          <!-- 关系变化 -->
          <div v-if="state.relationshipChanges && state.relationshipChanges.length > 0" class="state-item relations">
            <span class="state-label">关系变化:</span>
            <div class="relation-list">
              <div v-for="rel in state.relationshipChanges" :key="rel.target" class="relation-item">
                <span class="relation-target">{{ rel.target }}</span>
                <span class="relation-change" :class="rel.change">{{ getRelationLabel(rel.change) }}</span>
              </div>
            </div>
          </div>

          <!-- 永久性标记 -->
          <div v-if="state.permanentMarks && state.permanentMarks.length > 0" class="state-item marks">
            <span class="state-label">永久标记:</span>
            <span class="mark-tags">
              <span v-for="mark in state.permanentMarks" :key="mark" class="mark-tag">{{ mark }}</span>
            </span>
          </div>

          <!-- 备注 -->
          <div v-if="state.note" class="state-note">
            {{ state.note }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface RelationshipChange {
  target: string;
  change: 'improved' | 'worsened' | 'new' | 'broken';
}

interface CharacterState {
  _id?: string;
  episode: number;
  location?: string;
  status?: string;
  powerLevel?: string;
  powerChange?: number;
  items?: string[];
  relationshipChanges?: RelationshipChange[];
  permanentMarks?: string[];
  note?: string;
  type?: 'positive' | 'negative' | 'neutral';
}

const props = withDefaults(defineProps<{
  characterName: string;
  states: CharacterState[];
  loading?: boolean;
}>(), {
  loading: false,
});

const getStateClass = (state: CharacterState) => {
  if (state.type) return state.type;
  if (state.powerChange && state.powerChange > 0) return 'positive';
  if (state.powerChange && state.powerChange < 0) return 'negative';
  return 'neutral';
};

const getRelationLabel = (change: string) => {
  const labels: Record<string, string> = {
    improved: '↑ 改善',
    worsened: '↓ 恶化',
    new: '+ 建立',
    broken: '× 破裂',
  };
  return labels[change] || change;
};
</script>

<style scoped>
.state-timeline {
  padding: 16px;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.timeline-header h4 {
  margin: 0;
  font-size: 16px;
  color: var(--text-primary);
}

.legend {
  display: flex;
  gap: 16px;
  font-size: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-item::before {
  content: '';
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-item.positive::before {
  background: var(--success);
}

.legend-item.negative::before {
  background: #f44336;
}

.legend-item.neutral::before {
  background: #9e9e9e;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
}

.timeline-container {
  position: relative;
}

.timeline-item {
  display: flex;
  gap: 16px;
  padding-bottom: 24px;
}

.timeline-item:last-child {
  padding-bottom: 0;
}

.timeline-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 20px;
  flex-shrink: 0;
}

.marker-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 3px solid;
  background: white;
  z-index: 1;
}

.positive .marker-dot {
  border-color: var(--success);
}

.negative .marker-dot {
  border-color: var(--error);
}

.neutral .marker-dot {
  border-color: var(--text-muted);
}

.marker-line {
  flex: 1;
  width: 2px;
  background: var(--bg-hover);
  margin-top: 4px;
}

.timeline-content {
  flex: 1;
  background: var(--bg-base);
  border-radius: 8px;
  padding: 12px 16px;
  border: 1px solid var(--border-default);
}

.positive .timeline-content {
  border-left: 3px solid var(--success);
}

.negative .timeline-content {
  border-left: 3px solid var(--error);
}

.neutral .timeline-content {
  border-left: 3px solid var(--text-muted);
}

.timeline-episode {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
  margin-bottom: 8px;
}

.state-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 13px;
}

.state-label {
  color: var(--text-secondary);
  flex-shrink: 0;
  min-width: 60px;
}

.state-value {
  color: var(--text-primary);
}

.power-change {
  margin-left: 8px;
  font-weight: 600;
  font-size: 12px;
}

.power-change.up {
  color: var(--success);
}

.power-change.down {
  color: var(--error);
}

.item-tags,
.mark-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.item-tag {
  padding: 2px 8px;
  background: var(--info-muted);
  color: var(--primary);
  border-radius: 4px;
  font-size: 12px;
}

.mark-tag {
  padding: 2px 8px;
  background: var(--warning-muted);
  color: var(--orange);
  border-radius: 4px;
  font-size: 12px;
}

.relation-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.relation-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.relation-target {
  color: var(--text-primary);
}

.relation-change {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
}

.relation-change.improved {
  background: var(--success-muted);
  color: var(--success);
}

.relation-change.worsened {
  background: var(--error-muted);
  color: var(--error);
}

.relation-change.new {
  background: var(--info-muted);
  color: #1565c0;
}

.relation-change.broken {
  background: #fce4ec;
  color: #ad1457;
}

.state-note {
  margin-top: 8px;
  padding: 8px 12px;
  background: white;
  border-radius: 4px;
  font-size: 13px;
  color: var(--text-secondary);
  border: 1px dashed var(--border-default);
}
</style>
