<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { agentDashboardApi } from '@/services/agentApi';

const loading = ref(false);
const allocations = ref<any[]>([]);
const pagination = ref({ page: 1, limit: 20, total: 0, pages: 0 });
const typeFilter = ref('');

const typeLabels: Record<string, string> = {
  activate: '开通付费',
  add_quota: '追加配额',
  reduce_quota: '回收配额',
};

const fetchAllocations = async () => {
  loading.value = true;
  try {
    const response = await agentDashboardApi.getAllocations({
      page: pagination.value.page,
      limit: pagination.value.limit,
      type: typeFilter.value || undefined,
    });
    allocations.value = response.data.allocations;
    pagination.value = response.data.pagination;
  } catch (err) {
    console.error('获取分配记录失败:', err);
  } finally {
    loading.value = false;
  }
};

const formatDate = (date: string) => date ? new Date(date).toLocaleString('zh-CN') : '-';

watch(typeFilter, () => { pagination.value.page = 1; fetchAllocations(); });

onMounted(fetchAllocations);
</script>

<template>
  <div class="allocations-page">
    <h1 class="page-title">分配记录</h1>

    <div class="toolbar">
      <select v-model="typeFilter" class="type-select">
        <option value="">全部类型</option>
        <option value="activate">开通付费</option>
        <option value="add_quota">追加配额</option>
        <option value="reduce_quota">回收配额</option>
      </select>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <table v-else class="alloc-table">
      <thead>
        <tr>
          <th>时间</th>
          <th>创作者</th>
          <th>类型</th>
          <th>项目数</th>
          <th>说明</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="a in allocations" :key="a._id">
          <td>{{ formatDate(a.createdAt) }}</td>
          <td>{{ a.creatorName }}</td>
          <td><span :class="['type-badge', a.type]">{{ typeLabels[a.type] || a.type }}</span></td>
          <td>{{ a.type === 'reduce_quota' ? '-' : '+' }}{{ a.projectCount }}</td>
          <td class="desc">{{ a.description }}</td>
        </tr>
        <tr v-if="!allocations.length">
          <td colspan="5" class="empty">暂无分配记录</td>
        </tr>
      </tbody>
    </table>

    <div v-if="pagination.pages > 1" class="pagination">
      <button :disabled="pagination.page <= 1" @click="pagination.page--; fetchAllocations()">上一页</button>
      <span>{{ pagination.page }} / {{ pagination.pages }}</span>
      <button :disabled="pagination.page >= pagination.pages" @click="pagination.page++; fetchAllocations()">下一页</button>
    </div>
  </div>
</template>

<style scoped>
.allocations-page { max-width: 900px; }
.page-title { color: var(--text-primary); font-size: 22px; margin: 0 0 20px; }
.toolbar { margin-bottom: 16px; }
.type-select {
  padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border-default);
  background: var(--bg-surface); color: var(--text-primary); font-size: 14px;
}
.loading { color: var(--text-tertiary); padding: 40px; text-align: center; }
.alloc-table { width: 100%; border-collapse: collapse; background: var(--bg-surface); border-radius: 10px; overflow: hidden; }
.alloc-table th { text-align: left; padding: 12px 14px; color: var(--text-tertiary); font-size: 12px; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid var(--border-default); }
.alloc-table td { padding: 12px 14px; color: var(--text-primary); font-size: 14px; border-bottom: 1px solid var(--border-default); }
.alloc-table tr:hover td { background: var(--bg-hover); }
.type-badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
.type-badge.activate { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
.type-badge.add_quota { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.type-badge.reduce_quota { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
.desc { color: var(--text-secondary); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.empty { text-align: center; color: var(--text-muted); padding: 32px !important; }
.pagination { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 16px; }
.pagination button {
  padding: 6px 14px; border-radius: 6px; border: 1px solid var(--border-default); background: var(--bg-surface);
  color: var(--text-secondary); font-size: 13px; cursor: pointer;
}
.pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
.pagination span { color: var(--text-secondary); font-size: 13px; }
</style>
