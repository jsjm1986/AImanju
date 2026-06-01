<template>
  <div class="foreshadowing-card" :class="[status, importance, validityClass]">
    <div class="card-header">
      <div class="card-tags">
        <div class="card-type">
          <span class="type-icon">{{ getTypeIcon(type) }}</span>
          <span class="type-label">{{ getTypeLabel(type) }}</span>
        </div>
        <span v-if="validity && validity !== 'pending_review'" class="validity-badge" :class="validity">
          {{ getValidityLabel(validity) }}
        </span>
      </div>
      <div class="card-importance" :class="importance">
        {{ getImportanceLabel(importance) }}
      </div>
    </div>

    <div class="card-content">
      {{ content }}
    </div>

    <div v-if="urgencyScore || clusterLabel" class="card-extra">
      <span v-if="urgencyScore && urgencyScore >= 60" class="urgency-indicator" :class="urgencyClass">
        ⚠️ 紧迫度: {{ urgencyScore }}
      </span>
      <span v-if="clusterLabel" class="cluster-label">
        📁 {{ clusterLabel }}
      </span>
    </div>

    <div class="card-meta">
      <div class="meta-item planted">
        <span class="meta-label">埋设:</span>
        <span class="meta-value">第{{ episodePlanted }}集</span>
      </div>

      <div v-if="episodeResolved" class="meta-item resolved">
        <span class="meta-label">回收:</span>
        <span class="meta-value">第{{ episodeResolved }}集</span>
      </div>

      <div v-if="statusMeta" class="meta-item" :class="status">
        <span class="meta-label">状态:</span>
        <span class="meta-value">{{ statusMeta }}</span>
      </div>
    </div>

    <div v-if="resolutionNote" class="card-resolution">
      <span class="resolution-label">{{ getResolutionLabel() }}</span>
      <p class="resolution-text">{{ resolutionNote }}</p>
    </div>

    <div v-if="validityReason" class="card-validity-reason">
      <span class="validity-reason-label">AI分析:</span>
      <p class="validity-reason-text">{{ validityReason }}</p>
    </div>

    <div class="card-actions">
      <template v-if="status === 'planted'">
        <button class="action-btn resolve" @click="$emit('resolve')">
          标记回收
        </button>
        <button class="action-btn dormant" @click="$emit('dormant')">
          休眠
        </button>
      </template>
      <template v-if="status === 'dormant'">
        <button class="action-btn awaken" @click="$emit('awaken')">
          唤醒
        </button>
      </template>
      <button class="action-btn edit" @click="$emit('edit')">编辑</button>
      <button class="action-btn delete" @click="$emit('delete')">删除</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type {
  ForeshadowingType,
  ForeshadowingImportance,
  ForeshadowingStatus,
  ForeshadowingValidity
} from '@/types';

const props = defineProps<{
  content: string;
  type: ForeshadowingType;
  importance: ForeshadowingImportance;
  status: ForeshadowingStatus;
  episodePlanted: number;
  episodeResolved?: number;
  resolutionNote?: string;
  validity?: ForeshadowingValidity;
  validityReason?: string;
  urgencyScore?: number;
  clusterLabel?: string;
}>();

defineEmits<{
  (e: 'resolve'): void;
  (e: 'edit'): void;
  (e: 'delete'): void;
  (e: 'dormant'): void;
  (e: 'awaken'): void;
}>();

const TYPE_ICONS: Record<ForeshadowingType, string> = {
  suspense: '❓', character: '👤', item: '🔮',
  plot: '📖', worldbuilding: '🌍', relationship: '💕',
};

const TYPE_LABELS: Record<ForeshadowingType, string> = {
  suspense: '悬念', character: '角色', item: '道具',
  plot: '剧情', worldbuilding: '世界观', relationship: '关系',
};

const IMPORTANCE_LABELS: Record<ForeshadowingImportance, string> = {
  critical: '关键', high: '重要', normal: '普通', low: '次要',
};

const VALIDITY_LABELS: Record<ForeshadowingValidity, string> = {
  true_foreshadowing: '真伏笔', atmosphere: '氛围', setup: '铺垫',
  hook: '钩子', redundant: '冗余', pending_review: '待审',
};

const STATUS_META: Partial<Record<ForeshadowingStatus, string>> = {
  dormant: '💤 休眠中', merged: '🔀 已合并', abandoned: '🗑️ 已放弃',
};

const RESOLUTION_LABELS: Record<string, string> = {
  resolved: '回收说明:', dormant: '休眠原因:',
  abandoned: '放弃原因:', merged: '合并说明:',
};

function getTypeIcon(type: ForeshadowingType): string {
  return TYPE_ICONS[type] || '📌';
}

function getTypeLabel(type: ForeshadowingType): string {
  return TYPE_LABELS[type] || type;
}

function getImportanceLabel(importance: ForeshadowingImportance): string {
  return IMPORTANCE_LABELS[importance] || importance;
}

function getValidityLabel(validity: ForeshadowingValidity): string {
  return VALIDITY_LABELS[validity] || validity;
}

function getResolutionLabel(): string {
  return RESOLUTION_LABELS[props.status] || '备注:';
}

const statusMeta = computed(() => STATUS_META[props.status]);

const validityClass = computed(() => {
  if (props.validity === 'redundant') return 'redundant-validity';
  if (props.validity === 'atmosphere') return 'atmosphere-validity';
  return '';
});

const urgencyClass = computed(() => {
  if (!props.urgencyScore) return '';
  if (props.urgencyScore >= 80) return 'critical';
  if (props.urgencyScore >= 60) return 'high';
  return '';
});
</script>

<style scoped>
.foreshadowing-card {
  background: white;
  border-radius: 8px;
  border: 1px solid var(--border-default);
  padding: 16px;
  transition: all 0.2s;
}

.foreshadowing-card:hover {
  box-shadow: var(--shadow-md);
}

.foreshadowing-card.resolved {
  opacity: 0.7;
  background: var(--bg-elevated);
}

.foreshadowing-card.abandoned {
  opacity: 0.5;
  background: var(--bg-base);
}

.foreshadowing-card.dormant {
  opacity: 0.75;
  background: var(--cyan-muted);
  border-color: var(--cyan);
}

.foreshadowing-card.merged {
  opacity: 0.6;
  background: var(--info-muted);
  border-color: var(--info);
}

.foreshadowing-card.redundant-validity {
  opacity: 0.6;
}

.foreshadowing-card.atmosphere-validity {
  border-style: dashed;
}

.foreshadowing-card.critical {
  border-left: 4px solid var(--error);
}

.foreshadowing-card.high {
  border-left: 4px solid var(--warning);
}

.foreshadowing-card.normal {
  border-left: 4px solid var(--primary);
}

.foreshadowing-card.low {
  border-left: 4px solid var(--border-default);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
  gap: 8px;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.card-type {
  display: flex;
  align-items: center;
  gap: 6px;
}

.type-icon {
  font-size: 16px;
}

.type-label {
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  padding: 2px 8px;
  border-radius: 4px;
}

.validity-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.validity-badge.true_foreshadowing {
  background: var(--success-muted);
  color: var(--success);
}

.validity-badge.atmosphere {
  background: var(--info-muted);
  color: var(--info);
}

.validity-badge.setup {
  background: var(--warning-muted);
  color: var(--warning);
}

.validity-badge.hook {
  background: var(--pink-muted);
  color: var(--pink);
}

.validity-badge.redundant {
  background: var(--bg-elevated);
  color: var(--text-muted);
}

.card-importance {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
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
  background: var(--primary-muted);
  color: var(--primary);
}

.card-importance.low {
  background: var(--bg-hover);
  color: var(--text-tertiary);
}

.card-content {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.6;
  margin-bottom: 12px;
}

.card-extra {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.urgency-indicator {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
}

.urgency-indicator.critical {
  background: var(--error-muted);
  color: var(--error);
  font-weight: 600;
}

.urgency-indicator.high {
  background: var(--warning-muted);
  color: var(--warning);
}

.urgency-indicator.normal {
  background: var(--bg-elevated);
  color: var(--text-tertiary);
}

.cluster-label {
  font-size: 11px;
  color: var(--info);
  background: var(--info-muted);
  padding: 2px 6px;
  border-radius: 4px;
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 12px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.meta-label {
  color: var(--text-muted);
}

.meta-value {
  color: var(--text-primary);
  font-weight: 500;
}

.meta-item.planted .meta-value {
  color: var(--primary);
}

.meta-item.resolved .meta-value {
  color: var(--success);
}

.meta-item.dormant .meta-value {
  color: var(--cyan);
}

.meta-item.merged .meta-value {
  color: var(--info);
}

.meta-item.abandoned .meta-value {
  color: var(--text-muted);
}

.card-resolution {
  background: var(--bg-elevated);
  border-radius: 4px;
  padding: 10px 12px;
  margin-bottom: 12px;
}

.resolution-label {
  font-size: 11px;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 4px;
}

.resolution-text {
  margin: 0;
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.5;
}

.card-validity-reason {
  background: var(--cyan-muted);
  border-radius: 4px;
  padding: 10px 12px;
  margin-bottom: 12px;
  border-left: 2px solid var(--cyan);
}

.validity-reason-label {
  font-size: 11px;
  color: var(--info);
  display: block;
  margin-bottom: 4px;
}

.validity-reason-text {
  margin: 0;
  font-size: 12px;
  color: var(--info);
  line-height: 1.5;
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border-default);
}

.action-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.resolve {
  background: var(--success-muted);
  color: var(--success);
}

.action-btn.resolve:hover {
  background: var(--success-muted);
}

.action-btn.dormant {
  background: var(--info-muted);
  color: var(--info);
}

.action-btn.dormant:hover {
  background: var(--info-muted);
}

.action-btn.awaken {
  background: var(--warning-muted);
  color: var(--warning);
}

.action-btn.awaken:hover {
  background: var(--warning);
  color: var(--bg-primary);
}

.action-btn.edit {
  background: var(--info-muted);
  color: var(--primary);
}

.action-btn.edit:hover {
  background: var(--primary);
  color: var(--bg-primary);
}

.action-btn.delete {
  background: var(--error-muted);
  color: var(--error);
}

.action-btn.delete:hover {
  background: var(--error);
  color: var(--bg-primary);
}
</style>
