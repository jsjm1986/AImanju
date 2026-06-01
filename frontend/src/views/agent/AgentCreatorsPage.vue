<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { agentDashboardApi } from '@/services/agentApi';

const loading = ref(false);
const creators = ref<any[]>([]);
const pagination = ref({ page: 1, limit: 20, total: 0, pages: 0 });
const search = ref('');
const tierFilter = ref('');
const selectedCreator = ref<any>(null);
const creatorDetail = ref<any>(null);
const showDetailModal = ref(false);
const showQuotaModal = ref(false);
const quotaCount = ref(1);
const quotaAction = ref<'activate' | 'add'>('activate');
const actionLoading = ref(false);

const fetchCreators = async () => {
  loading.value = true;
  try {
    const response = await agentDashboardApi.getCreators({
      page: pagination.value.page,
      limit: pagination.value.limit,
      search: search.value || undefined,
      tier: tierFilter.value || undefined,
    });
    creators.value = response.data.creators;
    pagination.value = response.data.pagination;
  } catch (err) {
    console.error('获取创作者列表失败:', err);
  } finally {
    loading.value = false;
  }
};

const viewDetail = async (creator: any) => {
  selectedCreator.value = creator;
  showDetailModal.value = true;
  try {
    const response = await agentDashboardApi.getCreatorDetail(creator._id);
    creatorDetail.value = response.data;
  } catch (err) {
    console.error('获取详情失败:', err);
  }
};

const openQuotaModal = (creator: any, action: 'activate' | 'add') => {
  selectedCreator.value = creator;
  quotaAction.value = action;
  quotaCount.value = 1;
  showQuotaModal.value = true;
};

const handleQuotaAction = async () => {
  if (!selectedCreator.value || quotaCount.value < 1) return;
  actionLoading.value = true;
  try {
    if (quotaAction.value === 'activate') {
      await agentDashboardApi.activateCreator(selectedCreator.value._id, quotaCount.value);
    } else {
      await agentDashboardApi.addQuota(selectedCreator.value._id, quotaCount.value);
    }
    showQuotaModal.value = false;
    fetchCreators();
  } catch (err: any) {
    alert(err.response?.data?.error || '操作失败');
  } finally {
    actionLoading.value = false;
  }
};

const formatDate = (date: string) => date ? new Date(date).toLocaleString('zh-CN') : '-';

let searchTimer: any;
watch(search, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { pagination.value.page = 1; fetchCreators(); }, 300);
});
watch(tierFilter, () => { pagination.value.page = 1; fetchCreators(); });

onMounted(fetchCreators);
</script>

<template>
  <div class="creators-page">
    <h1 class="page-title">创作者管理</h1>

    <div class="toolbar">
      <input v-model="search" class="search-input" placeholder="搜索用户名或邮箱..." />
      <select v-model="tierFilter" class="tier-select">
        <option value="">全部</option>
        <option value="trial">试用</option>
        <option value="paid">付费</option>
      </select>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <table v-else class="creators-table">
      <thead>
        <tr>
          <th>用户名</th>
          <th>邮箱</th>
          <th>类型</th>
          <th>项目配额</th>
          <th>已用/配额</th>
          <th>注册时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in creators" :key="c._id">
          <td>{{ c.username }}</td>
          <td>{{ c.email }}</td>
          <td>
            <span :class="['tier-badge', c.tier]">{{ c.tier === 'trial' ? '试用' : '付费' }}</span>
          </td>
          <td>{{ c.projectQuota }}</td>
          <td>{{ c.actualProjectCount }} / {{ c.tier === 'trial' ? 1 : c.projectQuota }}</td>
          <td>{{ formatDate(c.createdAt) }}</td>
          <td class="actions">
            <button class="action-btn" @click="viewDetail(c)">详情</button>
            <button v-if="c.tier === 'trial'" class="action-btn primary" @click="openQuotaModal(c, 'activate')">开通</button>
            <button v-else class="action-btn" @click="openQuotaModal(c, 'add')">追加</button>
          </td>
        </tr>
        <tr v-if="!creators.length">
          <td colspan="7" class="empty">暂无创作者</td>
        </tr>
      </tbody>
    </table>

    <div v-if="pagination.pages > 1" class="pagination">
      <button :disabled="pagination.page <= 1" @click="pagination.page--; fetchCreators()">上一页</button>
      <span>{{ pagination.page }} / {{ pagination.pages }}</span>
      <button :disabled="pagination.page >= pagination.pages" @click="pagination.page++; fetchCreators()">下一页</button>
    </div>

    <!-- Detail Modal -->
    <div v-if="showDetailModal" class="modal-overlay" @click.self="showDetailModal = false">
      <div class="modal-card">
        <div class="modal-header">
          <h3>创作者详情: {{ selectedCreator?.username }}</h3>
          <button class="close-btn" @click="showDetailModal = false">&times;</button>
        </div>
        <div v-if="creatorDetail" class="modal-body">
          <div class="detail-grid">
            <div><span class="label">类型</span><span :class="['tier-badge', creatorDetail.creator.tier]">{{ creatorDetail.creator.tier === 'trial' ? '试用' : '付费' }}</span></div>
            <div><span class="label">项目配额</span><span>{{ creatorDetail.creator.projectQuota }}</span></div>
            <div><span class="label">已用项目</span><span>{{ creatorDetail.creator.projectsUsed }}</span></div>
            <div><span class="label">注册时间</span><span>{{ formatDate(creatorDetail.creator.createdAt) }}</span></div>
          </div>

          <h4 v-if="creatorDetail.projects.length">项目列表</h4>
          <div v-for="p in creatorDetail.projects" :key="p._id" class="project-item">
            <span class="project-name">{{ p.name }}</span>
            <span class="project-info">{{ p.genre }} · {{ p.episodeCount }}集</span>
          </div>

          <h4 v-if="creatorDetail.allocations.length">分配记录</h4>
          <div v-for="a in creatorDetail.allocations" :key="a._id" class="alloc-item">
            <span>{{ a.description }}</span>
            <span class="alloc-date">{{ formatDate(a.createdAt) }}</span>
          </div>
        </div>
        <div v-else class="loading">加载中...</div>
      </div>
    </div>

    <!-- Quota Modal -->
    <div v-if="showQuotaModal" class="modal-overlay" @click.self="showQuotaModal = false">
      <div class="modal-card small">
        <div class="modal-header">
          <h3>{{ quotaAction === 'activate' ? '开通付费' : '追加配额' }} - {{ selectedCreator?.username }}</h3>
          <button class="close-btn" @click="showQuotaModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>分配项目配额数量</label>
            <input v-model.number="quotaCount" type="number" min="1" max="100" class="quota-input" />
          </div>
          <div class="modal-actions">
            <button class="cancel-btn" @click="showQuotaModal = false">取消</button>
            <button class="confirm-btn" :disabled="actionLoading || quotaCount < 1" @click="handleQuotaAction">
              {{ actionLoading ? '处理中...' : '确认' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.creators-page { max-width: 1000px; }
.page-title { color: var(--text-primary); font-size: 22px; margin: 0 0 20px; }
.toolbar { display: flex; gap: 12px; margin-bottom: 16px; }
.search-input {
  flex: 1; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border-default);
  background: var(--bg-surface); color: var(--text-primary); font-size: 14px;
}
.search-input:focus { outline: none; border-color: var(--primary); }
.search-input::placeholder { color: var(--text-muted); }
.tier-select {
  padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border-default);
  background: var(--bg-surface); color: var(--text-primary); font-size: 14px;
}
.loading { color: var(--text-tertiary); padding: 40px; text-align: center; }
.creators-table { width: 100%; border-collapse: collapse; background: var(--bg-surface); border-radius: 10px; overflow: hidden; }
.creators-table th { text-align: left; padding: 12px 14px; color: var(--text-tertiary); font-size: 12px; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid var(--border-default); }
.creators-table td { padding: 12px 14px; color: var(--text-primary); font-size: 14px; border-bottom: 1px solid var(--border-default); }
.creators-table tr:hover td { background: var(--bg-hover); }
.tier-badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
.tier-badge.trial { background: var(--bg-elevated); color: var(--text-secondary); }
.tier-badge.paid { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
.actions { display: flex; gap: 6px; }
.action-btn {
  padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border-default); background: transparent;
  color: var(--text-secondary); font-size: 12px; cursor: pointer; transition: all 0.15s;
}
.action-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.action-btn.primary { border-color: var(--primary); color: var(--primary); }
.action-btn.primary:hover { background: var(--primary); color: white; }
.empty { text-align: center; color: var(--text-muted); padding: 32px !important; }
.pagination { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 16px; }
.pagination button {
  padding: 6px 14px; border-radius: 6px; border: 1px solid var(--border-default); background: var(--bg-surface);
  color: var(--text-secondary); font-size: 13px; cursor: pointer;
}
.pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
.pagination span { color: var(--text-secondary); font-size: 13px; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-card { background: var(--bg-surface); border-radius: 14px; width: 90%; max-width: 600px; max-height: 80vh; overflow-y: auto; }
.modal-card.small { max-width: 400px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid var(--border-default); }
.modal-header h3 { margin: 0; font-size: 16px; color: var(--text-primary); }
.close-btn { background: none; border: none; font-size: 24px; color: var(--text-muted); cursor: pointer; }
.modal-body { padding: 20px 24px; }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
.detail-grid .label { color: var(--text-tertiary); font-size: 12px; display: block; margin-bottom: 4px; }
.project-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-default); }
.project-name { color: var(--text-primary); font-size: 14px; }
.project-info { color: var(--text-tertiary); font-size: 13px; }
.alloc-item { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: var(--text-secondary); }
.alloc-date { color: var(--text-muted); }
h4 { color: var(--text-primary); font-size: 14px; margin: 16px 0 8px; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; color: var(--text-secondary); font-size: 14px; margin-bottom: 6px; }
.quota-input {
  width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border-default);
  background: var(--bg-elevated); color: var(--text-primary); font-size: 16px;
}
.quota-input:focus { outline: none; border-color: var(--primary); }
.modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
.cancel-btn {
  padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border-default); background: transparent;
  color: var(--text-secondary); font-size: 14px; cursor: pointer;
}
.confirm-btn {
  padding: 8px 20px; border-radius: 8px; border: none; background: var(--primary);
  color: var(--text-on-primary); font-size: 14px; font-weight: 600; cursor: pointer;
}
.confirm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
