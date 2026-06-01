<template>
  <div class="foreshadowing-tracker">
    <div class="tracker-header">
      <h3>伏笔追踪</h3>
      <div class="header-actions">
        <button class="btn-icon" @click="loadData" :disabled="store.loading">
          <span class="icon">↻</span>
        </button>
        <button class="btn-add" @click="showCreateModal = true">
          + 新增伏笔
        </button>
      </div>
    </div>

    <div v-if="store.stats" class="stats-section">
      <div
        v-for="s in statCards"
        :key="s.key"
        class="stat-card"
        :class="s.key"
      >
        <span class="stat-value">{{ store.stats[s.key] }}</span>
        <span class="stat-label">{{ s.label }}</span>
      </div>
    </div>

    <div v-if="store.stats?.urgentCount && store.stats.urgentCount > 0" class="overdue-warning">
      <div class="warning-header">
        <span class="warning-icon">⚠</span>
        <span>{{ store.stats.urgentCount }} 个伏笔需要紧急回收</span>
      </div>
      <div class="overdue-list">
        <div
          v-for="item in store.urgentForeshadowings"
          :key="item._id"
          class="overdue-item"
          @click="emit('select', item)"
        >
          <span class="ep-badge">第{{ item.episodePlanted }}集</span>
          <span class="content-preview">{{ item.content.slice(0, 30) }}...</span>
        </div>
      </div>
    </div>

    <div class="filter-tabs">
      <button
        v-for="f in filterOptions"
        :key="f.value"
        :class="{ active: filterStatus === f.value }"
        @click="filterStatus = f.value"
      >
        {{ f.label }}
      </button>
    </div>

    <div class="foreshadowing-list">
      <div v-if="store.loading" class="loading">加载中...</div>

      <div v-else-if="filteredList.length === 0" class="empty-state">
        暂无伏笔
      </div>

      <div
        v-else
        v-for="item in filteredList"
        :key="item._id"
        class="foreshadowing-card"
        :class="[item.status, item.importance]"
        @click="emit('select', item)"
      >
        <div class="card-header">
          <span class="type-badge">{{ typeLabels[item.type] }}</span>
          <span class="importance-badge" :class="item.importance">
            {{ importanceLabels[item.importance] }}
          </span>
          <span class="status-badge" :class="item.status">
            {{ statusLabels[item.status] }}
          </span>
        </div>
        <div class="card-content">{{ item.content }}</div>
        <div class="card-footer">
          <span class="episode-info">
            埋于第 {{ item.episodePlanted }} 集
            <template v-if="item.episodeResolved">
              → 第 {{ item.episodeResolved }} 集回收
            </template>
          </span>
          <div class="card-actions">
            <button
              v-if="item.status === 'planted'"
              class="action-btn resolve"
              @click.stop="handleResolve(item)"
            >
              标记回收
            </button>
            <button
              v-if="item.status === 'planted'"
              class="action-btn abandon"
              @click.stop="confirmAndAct('确定要放弃这个伏笔吗？', () => store.abandonForeshadowing(item._id))"
            >
              放弃
            </button>
            <button
              class="action-btn delete"
              @click.stop="confirmAndAct('确定要删除这个伏笔吗？此操作不可恢复。', () => store.deleteForeshadowing(item._id))"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
        <div class="modal-container">
          <div class="modal-header">
            <h4>新增伏笔</h4>
            <button class="close-btn" @click="showCreateModal = false">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>伏笔内容</label>
              <textarea v-model="newForeshadowing.content" rows="3" placeholder="描述这个伏笔的内容..."></textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>埋设集数</label>
                <input type="number" v-model="newForeshadowing.episodePlanted" min="1" />
              </div>
              <div class="form-group">
                <label>类型</label>
                <select v-model="newForeshadowing.type">
                  <option value="character">角色</option>
                  <option value="plot">剧情</option>
                  <option value="suspense">悬念</option>
                  <option value="item">道具</option>
                </select>
              </div>
              <div class="form-group">
                <label>重要性</label>
                <select v-model="newForeshadowing.importance">
                  <option value="critical">关键</option>
                  <option value="high">重要</option>
                  <option value="normal">普通</option>
                  <option value="low">次要</option>
                </select>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn secondary" @click="showCreateModal = false">取消</button>
            <button class="btn primary" @click="handleCreate" :disabled="!newForeshadowing.content">
              创建
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showResolveModal" class="modal-overlay" @click.self="showResolveModal = false">
        <div class="modal-container">
          <div class="modal-header">
            <h4>标记伏笔回收</h4>
            <button class="close-btn" @click="showResolveModal = false">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>回收集数</label>
              <input type="number" v-model="resolveData.episodeResolved" min="1" />
            </div>
            <div class="form-group">
              <label>回收说明 (可选)</label>
              <textarea v-model="resolveData.resolutionNote" rows="2" placeholder="说明如何回收这个伏笔..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn secondary" @click="showResolveModal = false">取消</button>
            <button class="btn primary" @click="confirmResolve" :disabled="!resolveData.episodeResolved">
              确认回收
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useForeshadowingStore } from '@/stores/foreshadowingStore';
import type { Foreshadowing, ForeshadowingStats } from '@/types';

const props = defineProps<{
  projectId: string;
  currentEpisode?: number;
}>();

const emit = defineEmits<{
  (e: 'select', item: Foreshadowing): void;
}>();

const store = useForeshadowingStore();

const filterStatus = ref('');
const showCreateModal = ref(false);
const showResolveModal = ref(false);
const selectedItem = ref<Foreshadowing | null>(null);

const statCards: { key: keyof ForeshadowingStats; label: string }[] = [
  { key: 'total', label: '总计' },
  { key: 'planted', label: '待回收' },
  { key: 'resolved', label: '已回收' },
  { key: 'abandoned', label: '已放弃' },
];

const filterOptions = [
  { value: '', label: '全部' },
  { value: 'planted', label: '待回收' },
  { value: 'resolved', label: '已回收' },
  { value: 'abandoned', label: '已放弃' },
  { value: 'dormant', label: '休眠' },
  { value: 'merged', label: '已合并' },
];

const typeLabels: Record<string, string> = {
  character: '角色',
  plot: '剧情',
  suspense: '悬念',
  item: '道具',
  worldbuilding: '世界观',
  relationship: '关系',
};

const importanceLabels: Record<string, string> = {
  critical: '关键',
  high: '重要',
  normal: '普通',
  low: '次要',
};

const statusLabels: Record<string, string> = {
  planted: '待回收',
  resolved: '已回收',
  abandoned: '已放弃',
  dormant: '休眠',
  merged: '已合并',
};

function defaultNewForeshadowing() {
  return {
    content: '',
    episodePlanted: props.currentEpisode || 1,
    type: 'suspense' as const,
    importance: 'normal' as const,
  };
}

const newForeshadowing = ref(defaultNewForeshadowing());

const resolveData = ref({
  episodeResolved: props.currentEpisode || 1,
  resolutionNote: '',
});

const filteredList = computed(() => {
  if (!filterStatus.value) return store.foreshadowings;
  return store.foreshadowings.filter(f => f.status === filterStatus.value);
});

watch(() => props.projectId, loadData, { immediate: true });

async function loadData() {
  await Promise.all([
    store.loadForeshadowings(props.projectId),
    store.loadStats(props.projectId, props.currentEpisode),
  ]);
}

async function reloadStats() {
  await store.loadStats(props.projectId, props.currentEpisode);
}

async function confirmAndAct(message: string, action: () => Promise<unknown>) {
  if (!confirm(message)) return;
  try {
    await action();
    await reloadStats();
  } catch (err) {
    console.error(err);
  }
}

async function handleCreate() {
  try {
    await store.createForeshadowing({
      projectId: props.projectId,
      ...newForeshadowing.value,
    });
    showCreateModal.value = false;
    newForeshadowing.value = defaultNewForeshadowing();
    await reloadStats();
  } catch (err) {
    console.error('创建伏笔失败:', err);
  }
}

function handleResolve(item: Foreshadowing) {
  selectedItem.value = item;
  resolveData.value = {
    episodeResolved: props.currentEpisode || item.episodePlanted + 1,
    resolutionNote: '',
  };
  showResolveModal.value = true;
}

async function confirmResolve() {
  if (!selectedItem.value) return;
  try {
    await store.resolveForeshadowing(
      selectedItem.value._id,
      resolveData.value.episodeResolved,
      resolveData.value.resolutionNote
    );
    showResolveModal.value = false;
    selectedItem.value = null;
    await reloadStats();
  } catch (err) {
    console.error('标记回收失败:', err);
  }
}
</script>

<style scoped>
.foreshadowing-tracker {
  background: var(--bg-surface);
  border-radius: 12px;
  padding: 20px;
  box-shadow: var(--shadow-sm);
}

.tracker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.tracker-header h3 {
  margin: 0;
  font-size: 18px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.btn-icon {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
  border-radius: 6px;
  cursor: pointer;
}

.btn-add {
  padding: 6px 12px;
  background: var(--primary);
  color: var(--text-on-primary);
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.stats-section {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  flex: 1;
  padding: 12px;
  background: var(--bg-elevated);
  border-radius: 8px;
  text-align: center;
}

.stat-card.planted {
  background: var(--warning-muted);
}

.stat-card.resolved {
  background: var(--success-muted);
}

.stat-card.abandoned {
  background: var(--bg-base);
}

.stat-value {
  display: block;
  font-size: 20px;
  font-weight: 600;
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.overdue-warning {
  margin-bottom: 16px;
  padding: 12px;
  background: var(--warning-muted);
  border: 1px solid var(--warning);
  border-radius: 8px;
}

.warning-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: var(--orange);
  margin-bottom: 8px;
}

.overdue-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.overdue-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: var(--bg-hover);
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.ep-badge {
  padding: 2px 6px;
  background: var(--orange);
  color: var(--text-on-primary);
  border-radius: 4px;
  font-size: 11px;
}

.filter-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.filter-tabs button {
  padding: 6px 12px;
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.filter-tabs button.active {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--text-on-primary);
}

.foreshadowing-list {
  max-height: 400px;
  overflow-y: auto;
}

.loading, .empty-state {
  padding: 32px;
  text-align: center;
  color: var(--text-muted);
}

.foreshadowing-card {
  padding: 12px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: box-shadow 0.2s;
}

.foreshadowing-card:hover {
  box-shadow: var(--shadow-md);
}

.foreshadowing-card.critical {
  border-left: 4px solid var(--error);
}

.foreshadowing-card.major {
  border-left: 4px solid var(--orange);
}

.card-header {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.type-badge, .importance-badge, .status-badge {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}

.type-badge {
  background: var(--info-muted);
  color: var(--primary);
}

.importance-badge.critical {
  background: var(--error-muted);
  color: var(--error);
}

.importance-badge.major {
  background: var(--warning-muted);
  color: var(--orange);
}

.importance-badge.normal {
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.importance-badge.minor {
  background: var(--bg-base);
  color: var(--text-muted);
}

.status-badge.planted {
  background: var(--warning-muted);
  color: var(--orange);
}

.status-badge.resolved {
  background: var(--success-muted);
  color: var(--success);
}

.status-badge.abandoned {
  background: var(--bg-base);
  color: var(--text-muted);
}

.card-content {
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 8px;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.episode-info {
  font-size: 12px;
  color: var(--text-secondary);
}

.card-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}

.action-btn.resolve {
  background: var(--success-muted);
  color: var(--success);
}

.action-btn.abandon {
  background: var(--warning-muted);
  color: var(--orange);
}

.action-btn.delete {
  background: var(--error-muted);
  color: var(--error);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background: var(--bg-surface);
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-default);
}

.modal-header h4 {
  margin: 0;
  font-size: 16px;
}

.close-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  font-size: 20px;
  cursor: pointer;
  color: var(--text-secondary);
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 6px;
}

.form-group textarea,
.form-group input,
.form-group select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-row .form-group {
  flex: 1;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-default);
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.btn.primary {
  background: var(--primary);
  color: var(--text-on-primary);
}

.btn.secondary {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
