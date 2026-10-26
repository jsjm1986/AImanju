<template>
  <div class="character-pyramid">
    <!-- 头部 -->
    <div class="panel-header">
      <h3 class="panel-title">
        <span class="icon">👥</span>
        角色金字塔
      </h3>
    </div>

    <!-- 金字塔可视化 -->
    <div class="pyramid-container">
      <div
        v-for="tier in tiers"
        :key="tier.key"
        class="pyramid-tier"
        :class="[tier.key, { active: activeTier === tier.key }]"
        @click="toggleTier(tier.key)"
      >
        <div class="tier-content">
          <span class="tier-label">{{ tier.label }}</span>
          <span class="tier-count">({{ getCharacterCount(tier.key) }}人)</span>
        </div>
        <div class="tier-names">
          {{ getCharacterNames(tier.key) }}
        </div>
      </div>
    </div>

    <!-- 展开的角色列表 -->
    <div v-if="activeTier && expandedCharacters.length > 0" class="character-list">
      <div class="list-header">
        <span>{{ getTierLabel(activeTier) }} 详情</span>
        <button class="btn-close" @click="activeTier = null" aria-label="关闭">✕</button>
      </div>
      <div class="character-cards">
        <div
          v-for="char in expandedCharacters"
          :key="char.name"
          class="character-card"
          :class="char.status"
        >
          <div class="char-header">
            <span class="char-name">{{ char.name }}</span>
            <span class="char-role">{{ char.role }}</span>
          </div>
          <div class="char-info">
            <div v-if="char.currentEquipment.length > 0" class="info-row">
              <span class="info-label">装备:</span>
              <span class="info-value">{{ char.currentEquipment.join('、') }}</span>
            </div>
            <div v-if="char.currentAbilities.length > 0" class="info-row">
              <span class="info-label">能力:</span>
              <span class="info-value">{{ char.currentAbilities.join('、') }}</span>
            </div>
            <div v-if="char.physicalCondition !== '正常'" class="info-row warning">
              <span class="info-label">身体:</span>
              <span class="info-value">{{ char.physicalCondition }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">出场:</span>
              <span class="info-value">{{ char.appearanceCount }}次 (最近:第{{ char.lastAppearance }}集)</span>
            </div>
          </div>
          <div v-if="char.status !== 'active'" class="char-status-badge">
            {{ getStatusLabel(char.status) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useWorldStateStore } from '@/stores/worldStateStore';
import { storeToRefs } from 'pinia';
import type { CharacterTier, CharacterStatus } from '@/types';

const worldStateStore = useWorldStateStore();
const { charactersByTier } = storeToRefs(worldStateStore);

// 层级配置
const tiers = [
  { key: 'core' as CharacterTier, label: '核心' },
  { key: 'recurring' as CharacterTier, label: '常驻配角' },
  { key: 'arc' as CharacterTier, label: '剧情角色' },
  { key: 'temporary' as CharacterTier, label: '临时角色' },
  { key: 'extra' as CharacterTier, label: '龙套角色' },
];

// 当前展开的层级
const activeTier = ref<CharacterTier | null>(null);

// 获取层级角色数量
function getCharacterCount(tier: CharacterTier): number {
  return charactersByTier.value.get(tier)?.length || 0;
}

// 获取层级角色名称（简短显示）
function getCharacterNames(tier: CharacterTier): string {
  const chars = charactersByTier.value.get(tier) || [];
  if (chars.length === 0) return '-';
  const names = chars.slice(0, 3).map(c => c.name);
  if (chars.length > 3) {
    names.push(`...`);
  }
  return names.join('、');
}

// 获取层级标签
function getTierLabel(tier: CharacterTier): string {
  return tiers.find(t => t.key === tier)?.label || tier;
}

// 获取状态标签
function getStatusLabel(status: CharacterStatus): string {
  const labels: Record<CharacterStatus, string> = {
    active: '活跃',
    archived: '归档',
    deceased: '死亡',
    departed: '离开',
  };
  return labels[status] || status;
}

// 切换层级展开
function toggleTier(tier: CharacterTier) {
  if (activeTier.value === tier) {
    activeTier.value = null;
  } else {
    activeTier.value = tier;
  }
}

// 展开的角色列表
const expandedCharacters = computed(() => {
  if (!activeTier.value) return [];
  return charactersByTier.value.get(activeTier.value) || [];
});
</script>

<style scoped>
.character-pyramid {
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  overflow: hidden;
}

.panel-header {
  padding: var(--space-3) var(--space-4);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-default);
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

/* 金字塔 */
.pyramid-container {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  background: var(--bg-surface);
}

.pyramid-tier {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 2px solid transparent;
}

.pyramid-tier:hover {
  transform: scale(1.02);
}

.pyramid-tier.active {
  border-color: var(--primary);
}

/* 层级颜色 - 深色主题适配 */
.pyramid-tier.core {
  background: rgba(239, 68, 68, 0.2);
  width: 40%;
}

.pyramid-tier.recurring {
  background: rgba(249, 115, 22, 0.2);
  width: 55%;
}

.pyramid-tier.arc {
  background: rgba(234, 179, 8, 0.2);
  width: 70%;
}

.pyramid-tier.temporary {
  background: var(--success-border);
  width: 85%;
}

.pyramid-tier.extra {
  background: var(--bg-hover);
  width: 100%;
}

.tier-content {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.tier-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-primary);
}

.tier-count {
  font-size: 10px;
  color: var(--text-tertiary);
}

.tier-names {
  font-size: 10px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

/* 角色列表 */
.character-list {
  border-top: 1px solid var(--border-default);
  background: var(--bg-elevated);
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-xs);
  font-weight: 600;
  background: var(--bg-hover);
  color: var(--text-primary);
}

.btn-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  transition: color var(--transition-fast);
}

.btn-close:hover {
  color: var(--text-primary);
}

.character-cards {
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: 200px;
  overflow-y: auto;
}

.character-card {
  padding: var(--space-3);
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  position: relative;
}

.character-card.deceased {
  opacity: 0.6;
}

.character-card.archived {
  opacity: 0.7;
}

.char-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
}

.char-name {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.char-role {
  font-size: 10px;
  color: var(--text-tertiary);
}

.char-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.info-row {
  display: flex;
  font-size: 10px;
}

.info-label {
  color: var(--text-tertiary);
  margin-right: var(--space-1);
  flex-shrink: 0;
}

.info-value {
  color: var(--text-secondary);
}

.info-row.warning .info-value {
  color: var(--warning);
}

.char-status-badge {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  font-size: 10px;
  padding: 2px var(--space-2);
  background: var(--text-muted);
  color: var(--bg-base);
  border-radius: var(--radius-sm);
}
</style>
