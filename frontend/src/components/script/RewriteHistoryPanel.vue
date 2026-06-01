<template>
  <div class="rewrite-history-panel">
    <!-- 统计摘要 -->
    <div v-if="historyStats" class="history-stats">
      <div class="stat-item">
        <span class="stat-value">{{ historyStats.total }}</span>
        <span class="stat-label">总改写</span>
      </div>
      <div class="stat-item">
        <span class="stat-value applied">{{ historyStats.applied }}</span>
        <span class="stat-label">已应用</span>
      </div>
      <div class="stat-item">
        <span class="stat-value pending">{{ historyStats.pending }}</span>
        <span class="stat-label">未应用</span>
      </div>
    </div>

    <!-- 筛选器 -->
    <div class="history-filters">
      <select v-model="typeFilter" class="filter-select" @change="handleFilterChange">
        <option value="">全部类型</option>
        <option value="selection">✂️ 局部改写</option>
        <option value="instruction">🎯 智能改写</option>
        <option value="full">📄 全文重写</option>
        <option value="manual">✏️ 手动编辑</option>
      </select>
      <input 
        v-model="searchQuery" 
        class="search-input"
        placeholder="搜索改写指令..." 
        @input="handleSearchDebounced"
      />
    </div>

    <!-- 视图切换 -->
    <div class="view-toggle">
      <button 
        class="toggle-btn" 
        :class="{ active: viewMode === 'current' }" 
        @click="viewMode = 'current'"
      >
        当前集
      </button>
      <button 
        class="toggle-btn" 
        :class="{ active: viewMode === 'all' }" 
        @click="viewMode = 'all'"
      >
        全部集数
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <span class="loading-spinner"></span>
      <span>加载中...</span>
    </div>

    <!-- 历史列表 -->
    <div v-else class="history-list">
      <!-- 当前集视图 -->
      <template v-if="viewMode === 'current'">
        <HistoryItem 
          v-for="item in filteredHistory" 
          :key="item._id" 
          :item="item"
          @view="openDetail"
          @rollback="openRollbackConfirm"
          @delete="confirmDelete"
        />
        
        <!-- 空状态 -->
        <div v-if="filteredHistory.length === 0" class="empty-state">
          <span class="empty-icon">📝</span>
          <span class="empty-text">
            {{ searchQuery || typeFilter ? '未找到匹配的记录' : '暂无改写历史' }}
          </span>
        </div>
      </template>

      <!-- 全部集数视图 -->
      <template v-else>
        <div 
          v-for="(items, episode) in groupedHistory" 
          :key="episode" 
          class="episode-group"
        >
          <div 
            class="group-header" 
            @click="toggleGroup(Number(episode))"
          >
            <span class="group-icon">{{ expandedGroups.includes(Number(episode)) ? '▼' : '▶' }}</span>
            <span class="group-title">第 {{ episode }} 集</span>
            <span class="group-count">{{ items.length }} 条记录</span>
          </div>
          <Transition name="slide">
            <div v-if="expandedGroups.includes(Number(episode))" class="group-content">
              <HistoryItem 
                v-for="item in items" 
                :key="item._id" 
                :item="item"
                :show-episode="false"
                @view="openDetail"
                @rollback="openRollbackConfirm"
                @delete="confirmDelete"
              />
            </div>
          </Transition>
        </div>

        <!-- 空状态 -->
        <div v-if="Object.keys(groupedHistory).length === 0" class="empty-state">
          <span class="empty-icon">📝</span>
          <span class="empty-text">
            {{ searchQuery || typeFilter ? '未找到匹配的记录' : '暂无改写历史' }}
          </span>
        </div>
      </template>
    </div>

    <!-- 详情弹窗 -->
    <RewriteHistoryDetailModal
      v-if="showDetailModal"
      :visible="showDetailModal"
      :history-id="selectedHistoryId"
      :project-id="projectId"
      @close="closeDetail"
      @rollback="handleRollbackFromDetail"
    />

    <!-- 回滚确认弹窗（带差异预览） -->
    <RollbackConfirmModal
      v-if="showRollbackModal"
      :visible="showRollbackModal"
      :history="rollbackTarget"
      :project-id="projectId"
      @confirm="handleRollbackConfirm"
      @cancel="closeRollbackConfirm"
    />

    <!-- 删除确认对话框 -->
    <ConfirmDialog
      v-if="showDeleteDialog"
      :visible="showDeleteDialog"
      title="确认删除"
      :message="deleteDialogMessage"
      confirm-text="删除"
      type="danger"
      @confirm="handleDeleteConfirm"
      @cancel="closeDeleteDialog"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRewriteStore } from '@/stores/rewriteStore';
import { useToast } from '@/composables/useToast';
import HistoryItem from './HistoryItem.vue';
import RewriteHistoryDetailModal from './RewriteHistoryDetailModal.vue';
import RollbackConfirmModal from './RollbackConfirmModal.vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import type { RewriteHistory, RewriteType } from '@/types';

const props = defineProps<{
  projectId: string;
  episodeId: string;
  episodeNumber: number;
}>();

const emit = defineEmits<{
  (e: 'rollback-success', content: string): void;
}>();

const rewriteStore = useRewriteStore();
const toast = useToast();

// 状态
const viewMode = ref<'current' | 'all'>('current');
const typeFilter = ref<RewriteType | ''>('');
const searchQuery = ref('');
const expandedGroups = ref<number[]>([]);
const loading = ref(false);

// 弹窗状态
const showDetailModal = ref(false);
const selectedHistoryId = ref('');

// 回滚确认弹窗状态
const showRollbackModal = ref(false);
const rollbackTarget = ref<RewriteHistory | null>(null);

// 删除确认对话框状态
const showDeleteDialog = ref(false);
const deleteTarget = ref<RewriteHistory | null>(null);

// 计算属性
const historyStats = computed(() => rewriteStore.historyStats);

const filteredHistory = computed(() => {
  return rewriteStore.history;
});

const groupedHistory = computed(() => {
  return rewriteStore.projectHistoryByEpisode;
});

const deleteDialogMessage = computed(() => {
  if (!deleteTarget.value) return '';
  return deleteTarget.value.applied 
    ? '删除已应用的记录不会影响当前剧本内容。确定要删除此改写记录吗？'
    : '确定要删除此改写记录吗？此操作不可恢复。';
});

// 搜索防抖
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
const handleSearchDebounced = () => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadData();
  }, 300);
};

// 筛选变化
const handleFilterChange = () => {
  loadData();
};

// 加载数据
async function loadData() {
  // 当前集视图需要有效的 episodeId
  if (viewMode.value === 'current' && !props.episodeId) {
    // 如果没有 episodeId，清空历史并显示空状态
    rewriteStore.history.splice(0, rewriteStore.history.length);
    rewriteStore.historyStats = null;
    return;
  }

  loading.value = true;
  try {
    const options = {
      type: typeFilter.value || undefined,
      search: searchQuery.value || undefined,
    };

    if (viewMode.value === 'current') {
      await rewriteStore.loadHistory(props.episodeId, props.projectId, options);
    } else {
      await rewriteStore.loadProjectHistory(props.projectId, options);
    }
  } catch (err) {
    toast.error('加载历史记录失败');
  } finally {
    loading.value = false;
  }
}

// 切换分组展开/折叠
function toggleGroup(episode: number) {
  const index = expandedGroups.value.indexOf(episode);
  if (index === -1) {
    expandedGroups.value.push(episode);
  } else {
    expandedGroups.value.splice(index, 1);
  }
}

// 打开详情
function openDetail(item: RewriteHistory) {
  selectedHistoryId.value = item._id;
  showDetailModal.value = true;
}

// 关闭详情
function closeDetail() {
  showDetailModal.value = false;
  selectedHistoryId.value = '';
}

// 打开回滚确认弹窗
function openRollbackConfirm(item: RewriteHistory) {
  rollbackTarget.value = item;
  showRollbackModal.value = true;
}

// 关闭回滚确认弹窗
function closeRollbackConfirm() {
  showRollbackModal.value = false;
  rollbackTarget.value = null;
}

// 处理回滚确认
async function handleRollbackConfirm() {
  if (!rollbackTarget.value) return;

  try {
    const result = await rewriteStore.revertRewrite(rollbackTarget.value._id, props.projectId);
    toast.success(`已回滚到改写前的版本，共影响 ${result?.affectedRecords || 1} 条记录`);
    emit('rollback-success', rollbackTarget.value.originalContent);
    await loadData();
  } catch (err) {
    toast.error('回滚失败');
  } finally {
    closeRollbackConfirm();
  }
}

// 确认删除
function confirmDelete(item: RewriteHistory) {
  deleteTarget.value = item;
  showDeleteDialog.value = true;
}

// 关闭删除对话框
function closeDeleteDialog() {
  showDeleteDialog.value = false;
  deleteTarget.value = null;
}

// 处理删除确认
async function handleDeleteConfirm() {
  if (!deleteTarget.value) return;

  try {
    await rewriteStore.deleteHistory(deleteTarget.value._id, props.projectId);
    toast.success('删除成功');
  } catch (err) {
    toast.error('删除失败');
  } finally {
    closeDeleteDialog();
  }
}

// 从详情弹窗触发回滚
function handleRollbackFromDetail(item: RewriteHistory) {
  closeDetail();
  openRollbackConfirm(item);
}

// 监听视图模式变化
watch(viewMode, () => {
  loadData();
});

// 监听 episodeId 变化
watch(() => props.episodeId, (newId) => {
  if (viewMode.value === 'current') {
    if (!newId) {
      // 如果没有 episodeId，自动切换到全部集数视图
      viewMode.value = 'all';
    } else {
      loadData();
    }
  }
});

// 初始化
onMounted(() => {
  // 如果没有 episodeId，自动切换到全部集数视图
  if (!props.episodeId) {
    viewMode.value = 'all';
  }
  loadData();
});
</script>


<style scoped>
.rewrite-history-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* 统计摘要 */
.history-stats {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-3);
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-3);
  flex-shrink: 0;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.stat-value {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
}

.stat-value.applied {
  color: var(--success);
}

.stat-value.pending {
  color: var(--warning);
}

.stat-label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

/* 筛选器 */
.history-filters {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  flex-shrink: 0;
}

.filter-select {
  flex: 0 0 auto;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--text-primary);
  cursor: pointer;
}

.filter-select:focus {
  outline: none;
  border-color: var(--primary);
}

.search-input {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.search-input:focus {
  outline: none;
  border-color: var(--primary);
}

.search-input::placeholder {
  color: var(--text-muted);
}

/* 视图切换 */
.view-toggle {
  display: flex;
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  padding: 2px;
  margin-bottom: var(--space-3);
  flex-shrink: 0;
}

.toggle-btn {
  flex: 1;
  padding: var(--space-2);
  background: transparent;
  border: none;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-xs);
  transition: all var(--transition-fast);
}

.toggle-btn:hover {
  color: var(--text-primary);
}

.toggle-btn.active {
  background: var(--primary);
  color: var(--text-on-primary);
}

/* 加载状态 */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-6);
  color: var(--text-tertiary);
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-default);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 历史列表 */
.history-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-right: var(--space-1);
}

/* 分组 */
.episode-group {
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  overflow: hidden;
  flex-shrink: 0;
}

.group-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.group-header:hover {
  background: var(--bg-hover);
}

.group-icon {
  font-size: 10px;
  color: var(--text-tertiary);
}

.group-title {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.group-count {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-left: auto;
}

.group-content {
  padding: var(--space-2);
  padding-top: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  color: var(--text-tertiary);
}

.empty-icon {
  font-size: 32px;
  margin-bottom: var(--space-2);
  opacity: 0.5;
}

.empty-text {
  font-size: var(--text-sm);
}

/* 过渡动画 */
.slide-enter-active,
.slide-leave-active {
  transition: all var(--transition-normal);
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
}

.slide-enter-to,
.slide-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
