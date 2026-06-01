<template>
  <div class="world-settings-panel">
    <!-- 头部 -->
    <div class="panel-header">
      <h3 class="panel-title">
        <span class="icon">🌐</span>
        世界设定详情
      </h3>
    </div>

    <!-- 标签页 -->
    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        {{ tab.label }}
        <span v-if="getTabCount(tab.key) > 0" class="tab-count">
          {{ getTabCount(tab.key) }}
        </span>
      </button>
    </div>

    <!-- 内容区 -->
    <div class="tab-content">
      <!-- 势力格局 -->
      <div v-if="activeTab === 'factions'" class="factions-view">
        <div v-if="Object.keys(factions).length === 0" class="empty-state">
          暂无势力信息
        </div>
        <div v-else class="faction-list">
          <div
            v-for="(faction, name) in factions"
            :key="name"
            class="faction-card"
          >
            <div class="faction-header">
              <span class="faction-name">{{ name }}</span>
              <span class="faction-status" :class="getAttitudeClass(faction.attitude)">
                {{ faction.attitude }}
              </span>
            </div>
            <div class="faction-info">
              <div class="info-row">
                <span class="label">状态:</span>
                <span class="value">{{ faction.status }}</span>
              </div>
              <div v-if="faction.keyMembers.length > 0" class="info-row">
                <span class="label">成员:</span>
                <span class="value">{{ faction.keyMembers.join('、') }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 重要地点 -->
      <div v-if="activeTab === 'locations'" class="locations-view">
        <div v-if="Object.keys(locations).length === 0" class="empty-state">
          暂无地点信息
        </div>
        <div v-else class="location-list">
          <div
            v-for="(location, name) in locations"
            :key="name"
            class="location-item"
          >
            <div class="location-icon">📍</div>
            <div class="location-info">
              <span class="location-name">{{ name }}</span>
              <span class="location-episode">第{{ location.firstAppearance }}集首次出现</span>
            </div>
            <div class="location-desc">{{ location.description }}</div>
          </div>
        </div>
      </div>

      <!-- 关键道具 -->
      <div v-if="activeTab === 'items'" class="items-view">
        <div v-if="Object.keys(items).length === 0" class="empty-state">
          暂无道具信息
        </div>
        <div v-else class="item-list">
          <div
            v-for="(item, name) in items"
            :key="name"
            class="item-card"
          >
            <div class="item-header">
              <span class="item-icon">🎁</span>
              <span class="item-name">{{ name }}</span>
            </div>
            <div class="item-info">
              <div class="info-row">
                <span class="label">持有:</span>
                <span class="value">{{ item.owner || '无' }}</span>
              </div>
              <div class="info-row">
                <span class="label">状态:</span>
                <span class="value" :class="getItemStatusClass(item.status)">
                  {{ item.status }}
                </span>
              </div>
              <div class="info-row">
                <span class="label">描述:</span>
                <span class="value">{{ item.description }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 秘密揭示 -->
      <div v-if="activeTab === 'secrets'" class="secrets-view">
        <!-- 已揭露 -->
        <div class="secrets-section">
          <div class="section-header">
            <span class="icon">✅</span>
            已揭露
          </div>
          <div v-if="revealedSecrets.length === 0" class="empty-hint">
            暂无已揭露的秘密
          </div>
          <ul v-else class="secrets-list revealed">
            <li v-for="(secret, index) in revealedSecrets" :key="index">
              {{ secret }}
            </li>
          </ul>
        </div>

        <!-- 待揭露 -->
        <div class="secrets-section">
          <div class="section-header">
            <span class="icon">🔒</span>
            待揭露 (编剧备忘)
          </div>
          <div v-if="hiddenSecrets.length === 0" class="empty-hint">
            暂无待揭露的秘密
          </div>
          <ul v-else class="secrets-list hidden">
            <li v-for="(secret, index) in hiddenSecrets" :key="index">
              {{ secret }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useWorldStateStore } from '@/stores/worldStateStore';
import { storeToRefs } from 'pinia';

const { worldState } = storeToRefs(useWorldStateStore());

const tabs = [
  { key: 'factions', label: '势力格局', icon: '⚔️' },
  { key: 'locations', label: '重要地点', icon: '📍' },
  { key: 'items', label: '关键道具', icon: '🎁' },
  { key: 'secrets', label: '秘密揭示', icon: '🔮' },
];

const activeTab = ref('factions');

const settings = computed(() => worldState.value?.worldSettings);
const factions = computed(() => settings.value?.factions ?? {});
const locations = computed(() => settings.value?.locations ?? {});
const items = computed(() => settings.value?.items ?? {});
const revealedSecrets = computed(() => settings.value?.revealedSecrets ?? []);
const hiddenSecrets = computed(() => settings.value?.hiddenSecrets ?? []);

function getTabCount(tabKey: string): number {
  const counts: Record<string, () => number> = {
    factions: () => Object.keys(factions.value).length,
    locations: () => Object.keys(locations.value).length,
    items: () => Object.keys(items.value).length,
    secrets: () => revealedSecrets.value.length + hiddenSecrets.value.length,
  };
  return counts[tabKey]?.() ?? 0;
}

const attitudeMap: Record<string, string> = { '友好': 'friendly', '敌对': 'hostile', '中立': 'neutral' };
const itemStatusMap: Record<string, string> = { '完整': 'intact', '损坏': 'damaged', '遗失': 'lost' };

function getAttitudeClass(attitude: string): string {
  return Object.entries(attitudeMap).find(([k]) => attitude.includes(k))?.[1] ?? '';
}

function getItemStatusClass(status: string): string {
  return itemStatusMap[status] ?? '';
}
</script>

<style scoped>
.world-settings-panel {
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
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.icon {
  font-size: 16px;
}

/* 标签页 */
.tabs {
  display: flex;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-default);
  overflow-x: auto;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-3);
  font-size: 12px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  color: var(--text-secondary);
  transition: var(--transition-fast);
  white-space: nowrap;
}

.tab-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.tab-btn.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.tab-icon {
  font-size: 14px;
}

.tab-count {
  font-size: 10px;
  background: var(--bg-hover);
  padding: 1px var(--space-2);
  border-radius: var(--radius-full);
}

/* 内容区 */
.tab-content {
  padding: var(--space-3);
  max-height: 400px;
  overflow-y: auto;
}

.empty-state {
  text-align: center;
  padding: var(--space-6);
  color: var(--text-secondary);
  font-size: 13px;
}

/* 势力 */
.faction-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.faction-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.faction-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
}

.faction-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.faction-status {
  font-size: 11px;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
}

.faction-status.friendly {
  background: var(--success-muted);
  color: var(--success);
}

.faction-status.hostile {
  background: var(--error-muted);
  color: var(--error);
}

.faction-status.neutral {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.faction-info .info-row {
  display: flex;
  font-size: 12px;
  margin-bottom: var(--space-1);
}

.label {
  color: var(--text-secondary);
  margin-right: var(--space-1);
}

.value {
  color: var(--text-primary);
}

/* 地点 */
.location-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.location-item {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  gap: var(--space-1) var(--space-2);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.location-icon {
  font-size: 16px;
  grid-row: span 2;
  align-self: center;
}

.location-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.location-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.location-episode {
  font-size: 11px;
  color: var(--text-secondary);
}

.location-desc {
  font-size: 12px;
  color: var(--text-secondary);
  grid-column: 2;
}

/* 道具 */
.item-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.item-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.item-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.item-icon {
  font-size: 16px;
}

.item-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.item-info .info-row {
  display: flex;
  font-size: 12px;
  margin-bottom: var(--space-1);
}

.value.intact { color: var(--success); }
.value.damaged { color: var(--warning); }
.value.lost { color: var(--error); }

/* 秘密 */
.secrets-section {
  margin-bottom: var(--space-4);
}

.secrets-section:last-child {
  margin-bottom: 0;
}

.section-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}

.empty-hint {
  font-size: 12px;
  color: var(--text-secondary);
  opacity: 0.7;
  padding: var(--space-2) 0;
}

.secrets-list {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3) var(--space-2) 28px;
  margin: 0;
}

.secrets-list li {
  font-size: 12px;
  padding: var(--space-1) 0;
  border-bottom: 1px solid var(--border-default);
}

.secrets-list li:last-child {
  border-bottom: none;
}

.secrets-list.revealed li {
  color: var(--text-primary);
}

.secrets-list.hidden li {
  color: var(--text-secondary);
  font-style: italic;
}
</style>
