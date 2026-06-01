<template>
  <div class="foreshadowing-kanban">
    <div class="panel-header">
      <h3 class="panel-title">
        <span class="icon">🎭</span>
        伏笔看板
      </h3>
      <div class="legend">
        <span class="legend-item overdue">🔴 紧急</span>
        <span class="legend-item near">🟠 临近</span>
        <span class="legend-item normal">🟢 正常</span>
        <span class="legend-item dormant">💤 休眠</span>
      </div>
    </div>

    <div class="kanban-container">
      <div class="kanban-column pending">
        <div class="column-header">
          <span class="column-title">待回收</span>
          <span class="column-count">{{ pendingForeshadowings.length }}</span>
        </div>
        <div class="column-content">
          <div
            v-for="item in pendingForeshadowings"
            :key="item._id"
            class="kanban-card"
            :class="getCardClass(item)"
          >
            <div class="card-header">
              <div class="card-tags">
                <span class="card-type">{{ labelOf(typeLabels, item.type) }}</span>
                <span v-if="item.validity && item.validity !== 'pending_review'" class="validity-badge" :class="item.validity">
                  {{ labelOf(validityLabels, item.validity) }}
                </span>
              </div>
              <span class="card-importance" :class="item.importance">
                {{ labelOf(importanceLabels, item.importance) }}
              </span>
            </div>
            <div class="card-content">{{ item.content }}</div>
            <div class="card-footer">
              <span class="card-episode">第{{ item.episodePlanted }}集埋设</span>
              <span class="card-age" :class="{ urgent: getAge(item) > 10 }">
                已{{ getAge(item) }}集
              </span>
            </div>
            <div v-if="item.urgencyScore && item.urgencyScore >= 80" class="card-urgency">
              ⚠️ 紧迫度: {{ item.urgencyScore }}
            </div>
            <div v-if="item.clusterLabel" class="card-cluster">
              📁 {{ item.clusterLabel }}
            </div>
          </div>
          <div v-if="pendingForeshadowings.length === 0" class="empty-column">
            暂无待回收伏笔
          </div>
        </div>
      </div>

      <div class="kanban-column dormant">
        <div class="column-header">
          <span class="column-title">休眠中</span>
          <span class="column-count dormant">{{ dormantForeshadowings.length }}</span>
        </div>
        <div class="column-content">
          <div
            v-for="item in dormantForeshadowings"
            :key="item._id"
            class="kanban-card dormant"
          >
            <div class="card-header">
              <span class="card-type">{{ labelOf(typeLabels, item.type) }}</span>
              <span class="card-importance" :class="item.importance">
                {{ labelOf(importanceLabels, item.importance) }}
              </span>
            </div>
            <div class="card-content">{{ item.content }}</div>
            <div class="card-footer">
              <span class="card-episode">第{{ item.episodePlanted }}集埋设</span>
            </div>
            <div v-if="item.resolutionNote" class="card-note">
              💤 {{ item.resolutionNote }}
            </div>
          </div>
          <div v-if="dormantForeshadowings.length === 0" class="empty-column">
            暂无休眠伏笔
          </div>
        </div>
      </div>

      <div class="kanban-column resolved">
        <div class="column-header">
          <span class="column-title">已回收</span>
          <span class="column-count success">{{ resolvedForeshadowings.length }}</span>
        </div>
        <div class="column-content">
          <div
            v-for="item in resolvedForeshadowings"
            :key="item._id"
            class="kanban-card resolved"
          >
            <div class="card-content">{{ item.content }}</div>
            <div class="card-footer">
              <span class="card-resolution">
                第{{ item.episodeResolved }}集回收
              </span>
            </div>
            <div v-if="item.resolutionNote" class="card-note">
              ✅ {{ item.resolutionNote }}
            </div>
          </div>
          <div v-if="resolvedForeshadowings.length === 0" class="empty-column">
            暂无已回收伏笔
          </div>
        </div>
      </div>

      <div class="kanban-column archived">
        <div class="column-header">
          <span class="column-title">已归档</span>
          <span class="column-count muted">{{ archivedForeshadowings.length }}</span>
        </div>
        <div class="column-content">
          <div
            v-for="item in archivedForeshadowings"
            :key="item._id"
            class="kanban-card archived"
            :class="item.status"
          >
            <div class="card-header">
              <span class="card-status" :class="item.status">
                {{ item.status === 'abandoned' ? '🗑️ 已放弃' : '🔀 已合并' }}
              </span>
            </div>
            <div class="card-content">{{ item.content }}</div>
            <div v-if="item.resolutionNote" class="card-note">
              {{ item.resolutionNote }}
            </div>
          </div>
          <div v-if="archivedForeshadowings.length === 0" class="empty-column">
            暂无归档伏笔
          </div>
        </div>
      </div>
    </div>

    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-label">活跃:</span>
        <span class="stat-value">{{ activeCount }}个</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">回收率:</span>
        <span class="stat-value">{{ resolutionRate }}%</span>
      </div>
      <div class="stat-item warning" v-if="urgentCount > 0">
        <span class="stat-label">紧急:</span>
        <span class="stat-value">{{ urgentCount }}个</span>
      </div>
      <div class="stat-item" v-if="pendingReviewCount > 0">
        <span class="stat-label">待审核:</span>
        <span class="stat-value">{{ pendingReviewCount }}个</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useForeshadowingStore } from '@/stores/foreshadowingStore';
import type { Foreshadowing } from '@/types';

const props = withDefaults(defineProps<{ currentEpisode?: number }>(), {
  currentEpisode: 1,
});

const { foreshadowings } = storeToRefs(useForeshadowingStore());

const typeLabels: Record<string, string> = {
  plot: '剧情', character: '角色', item: '道具',
  suspense: '悬念', worldbuilding: '世界观', relationship: '关系',
};
const importanceLabels: Record<string, string> = {
  critical: '关键', high: '重要', normal: '普通', low: '次要',
};
const validityLabels: Record<string, string> = {
  true_foreshadowing: '真伏笔', atmosphere: '氛围', setup: '铺垫',
  hook: '钩子', redundant: '冗余', pending_review: '待审',
};

function labelOf(map: Record<string, string>, key: string): string {
  return map[key] || key;
}

function getAge(item: Foreshadowing): number {
  return props.currentEpisode - item.episodePlanted;
}

function getCardClass(item: Foreshadowing): string {
  const age = getAge(item);
  const urgency = item.urgencyScore || 0;
  if (urgency >= 80 || age > 10) return 'overdue';
  if (urgency >= 60 || age > 7) return 'near';
  if (age > 5) return 'warning';
  return 'normal';
}

function byStatus(...statuses: string[]) {
  return foreshadowings.value.filter(f => statuses.includes(f.status));
}

const pendingForeshadowings = computed(() =>
  byStatus('planted').sort((a, b) => (b.urgencyScore || 0) - (a.urgencyScore || 0))
);
const dormantForeshadowings = computed(() => byStatus('dormant'));
const resolvedForeshadowings = computed(() =>
  byStatus('resolved').sort((a, b) => (b.episodeResolved || 0) - (a.episodeResolved || 0))
);
const archivedForeshadowings = computed(() => byStatus('abandoned', 'merged'));

const activeCount = computed(() =>
  pendingForeshadowings.value.length + dormantForeshadowings.value.length
);
const resolutionRate = computed(() => {
  const total = foreshadowings.value.length;
  return total === 0 ? 0 : Math.round((resolvedForeshadowings.value.length / total) * 100);
});
const urgentCount = computed(() =>
  pendingForeshadowings.value.filter(f => (f.urgencyScore || 0) >= 80).length
);
const pendingReviewCount = computed(() =>
  foreshadowings.value.filter(f => f.validity === 'pending_review').length
);
</script>

<style scoped>
.foreshadowing-kanban {
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-default);
  flex-wrap: wrap;
  gap: var(--space-2);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.icon {
  font-size: var(--text-base);
}

.legend {
  display: flex;
  gap: var(--space-3);
  font-size: 10px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--text-tertiary);
}

.kanban-container {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
  padding: var(--space-3);
  min-height: 300px;
  max-height: 500px;
  overflow: hidden;
}

.kanban-column {
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3);
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-hover);
}

.column-title {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-primary);
}

.column-count {
  font-size: 10px;
  padding: 2px var(--space-2);
  background: var(--bg-surface);
  border-radius: 10px;
  color: var(--text-secondary);
}

.column-count.warning {
  background: var(--warning-muted);
  color: var(--warning);
}

.column-count.success {
  background: var(--success-border);
  color: var(--success);
}

.column-count.dormant {
  background: var(--info-muted);
  color: var(--cyan);
}

.column-count.muted {
  background: var(--bg-hover);
  color: var(--text-muted);
}

.column-content {
  flex: 1;
  padding: var(--space-2);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.kanban-card {
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  padding: var(--space-3);
  border-left: 3px solid var(--success);
}

.kanban-card.warning,
.kanban-card.near {
  border-left-color: var(--warning);
}

.kanban-card.overdue {
  border-left-color: var(--error);
  background: var(--error-muted);
}

.kanban-card.dormant {
  border-left-color: var(--cyan);
  background: var(--info-muted);
  opacity: 0.85;
}

.kanban-card.resolved {
  border-left-color: var(--text-muted);
  opacity: 0.8;
}

.kanban-card.archived {
  border-left-color: var(--text-muted);
  opacity: 0.7;
}

.kanban-card.abandoned {
  border-left-color: var(--error);
}

.kanban-card.merged {
  border-left-color: var(--primary);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-2);
  gap: var(--space-2);
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.card-type {
  font-size: 10px;
  padding: 2px var(--space-2);
  background: var(--primary-muted);
  color: var(--primary);
  border-radius: var(--radius-sm);
}

.validity-badge {
  font-size: 9px;
  padding: 2px 5px;
  border-radius: var(--radius-sm);
}

.validity-badge.true_foreshadowing {
  background: var(--success-border);
  color: var(--success);
}

.validity-badge.atmosphere {
  background: var(--info-muted);
  color: var(--cyan);
}

.validity-badge.setup {
  background: var(--warning-muted);
  color: var(--warning);
}

.validity-badge.hook {
  background: var(--primary-muted);
  color: var(--primary-hover);
}

.validity-badge.redundant {
  background: var(--bg-hover);
  color: var(--text-muted);
}

.card-importance {
  font-size: 10px;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.card-importance.critical {
  background: var(--error-muted);
  color: var(--error);
  font-weight: 600;
}

.card-importance.high {
  background: var(--warning-muted);
  color: var(--warning);
}

.card-importance.normal {
  background: var(--bg-hover);
  color: var(--text-tertiary);
}

.card-importance.low {
  background: var(--bg-surface);
  color: var(--text-muted);
}

.card-content {
  font-size: var(--text-xs);
  line-height: 1.5;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.card-footer {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-tertiary);
}

.card-age.urgent {
  color: var(--error);
  font-weight: 600;
}

.card-urgency {
  font-size: 10px;
  color: var(--error);
  margin-top: var(--space-2);
  font-weight: 500;
}

.card-cluster {
  font-size: 10px;
  color: var(--primary);
  margin-top: var(--space-1);
}

.card-status {
  font-size: 10px;
}

.card-note {
  font-size: 10px;
  color: var(--text-tertiary);
  font-style: italic;
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px dashed var(--border-default);
}

.card-resolution {
  color: var(--success);
}

.empty-column {
  text-align: center;
  padding: var(--space-6);
  color: var(--text-muted);
  font-size: var(--text-xs);
}

.stats-bar {
  display: flex;
  justify-content: center;
  gap: var(--space-6);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-default);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 10px;
}

.stat-item.warning {
  color: var(--error);
}

.stat-label {
  color: var(--text-tertiary);
}

.stat-value {
  font-weight: 500;
  color: var(--text-primary);
}

.stat-item.warning .stat-value {
  color: var(--error);
}
</style>
