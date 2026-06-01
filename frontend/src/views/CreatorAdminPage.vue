<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/composables/useToast';
import { useConfirm } from '@/composables/useConfirm';
import api from '@/services/api';
import Modal from '@/components/common/Modal.vue';

const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();
const confirm = useConfirm();

const activeTab = ref<'users' | 'agents'>('users');

const loading = ref(false);
const users = ref<any[]>([]);
const stats = ref<any>(null);
const selectedUser = ref<any>(null);
const showQuotaModal = ref(false);
const showUserDetailModal = ref(false);

// 代理管理状态
const agents = ref<any[]>([]);
const agentsLoading = ref(false);
const showCreateAgentModal = ref(false);
const showEditAgentModal = ref(false);
const selectedAgent = ref<any>(null);
const agentForm = ref({ username: '', email: '', password: '', projectQuota: 10, note: '' });
const editAgentForm = ref({ projectQuota: 0, status: 'active' as string, note: '' });

const quotaForm = ref({
  tier: 'trial' as 'trial' | 'paid',
  projectQuota: 1,
  trialEpisodesUsed: 0,
});

const countByTier = (tier: string) => users.value.filter(u => u.tier === tier).length;
const trialUsers = computed(() => countByTier('trial'));
const paidUsers = computed(() => countByTier('paid'));

const formatDate = (date: string) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN');
};

const fetchUsers = async () => {
  loading.value = true;
  try {
    const response = await api.get('/creator/admin/users');
    users.value = response.data.users || [];
  } catch {
    toast.error('获取用户列表失败');
  } finally {
    loading.value = false;
  }
};

const fetchStats = async () => {
  try {
    const response = await api.get('/creator/admin/stats');
    stats.value = response.data;
  } catch (err) {
    console.error('获取统计失败:', err);
  }
};

const openQuotaEdit = (user: any) => {
  selectedUser.value = user;
  quotaForm.value = {
    tier: user.tier,
    projectQuota: user.projectQuota,
    trialEpisodesUsed: user.trialEpisodesUsed || 0,
  };
  showQuotaModal.value = true;
};

const saveQuota = async () => {
  if (!selectedUser.value) return;
  try {
    await api.put(`/creator/admin/users/${selectedUser.value._id}/quota`, quotaForm.value);
    toast.success('配额已更新');
    showQuotaModal.value = false;
    fetchUsers();
  } catch {
    toast.error('更新配额失败');
  }
};

const deleteUser = async (user: any) => {
  const confirmed = await confirm.danger(`确定删除用户 ${user.username}？此操作不可恢复！`);
  if (!confirmed) return;
  try {
    await api.delete(`/creator/admin/users/${user._id}`);
    toast.success('用户已删除');
    fetchUsers();
  } catch {
    toast.error('删除失败');
  }
};

// 代理管理方法
const fetchAgents = async () => {
  agentsLoading.value = true;
  try {
    const response = await api.get('/creator/admin/agents');
    agents.value = response.data.agents || [];
  } catch {
    toast.error('获取代理列表失败');
  } finally {
    agentsLoading.value = false;
  }
};

const createAgent = async () => {
  const f = agentForm.value;
  if (!f.username || !f.email || !f.password) {
    toast.error('请填写完整信息');
    return;
  }
  try {
    await api.post('/creator/admin/agents', f);
    toast.success('代理创建成功');
    showCreateAgentModal.value = false;
    agentForm.value = { username: '', email: '', password: '', projectQuota: 10, note: '' };
    fetchAgents();
  } catch (err: any) {
    toast.error(err.response?.data?.error || '创建失败');
  }
};

const openEditAgent = (agent: any) => {
  selectedAgent.value = agent;
  editAgentForm.value = {
    projectQuota: agent.projectQuota,
    status: agent.status,
    note: agent.note || '',
  };
  showEditAgentModal.value = true;
};

const saveAgent = async () => {
  if (!selectedAgent.value) return;
  try {
    await api.put(`/creator/admin/agents/${selectedAgent.value._id}`, editAgentForm.value);
    toast.success('代理信息已更新');
    showEditAgentModal.value = false;
    fetchAgents();
  } catch (err: any) {
    toast.error(err.response?.data?.error || '更新失败');
  }
};

const deleteAgent = async (agent: any) => {
  const confirmed = await confirm.danger(`确定删除代理 ${agent.username}？`);
  if (!confirmed) return;
  try {
    await api.delete(`/creator/admin/agents/${agent._id}`);
    toast.success('代理已删除');
    fetchAgents();
  } catch (err: any) {
    toast.error(err.response?.data?.error || '删除失败');
  }
};

onMounted(() => {
  if (!authStore.isAuthenticated) {
    router.push('/login');
    return;
  }
  if (authStore.user?.role !== 'admin') {
    toast.error('需要管理员权限');
    router.push('/');
    return;
  }
  fetchUsers();
  fetchStats();
  fetchAgents();
});
</script>

<template>
  <div class="admin-page">
    <!-- 头部 -->
    <header class="page-header">
      <div class="header-left">
        <button class="back-btn" @click="router.push('/')">← 返回</button>
        <h1>创作者管理</h1>
      </div>
      <div class="header-right">
        <span class="admin-badge">管理员</span>
      </div>
    </header>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ users.length }}</div>
        <div class="stat-label">总用户数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ trialUsers }}</div>
        <div class="stat-label">试用用户</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ paidUsers }}</div>
        <div class="stat-label">付费用户</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats?.totalProjects || 0 }}</div>
        <div class="stat-label">总项目数</div>
      </div>
    </div>

    <!-- Tab 切换 -->
    <div class="admin-tabs">
      <button :class="['admin-tab', { active: activeTab === 'users' }]" @click="activeTab = 'users'">用户管理</button>
      <button :class="['admin-tab', { active: activeTab === 'agents' }]" @click="activeTab = 'agents'">代理管理</button>
    </div>

    <!-- 用户列表 -->
    <div v-show="activeTab === 'users'" class="users-section">
      <div class="section-header">
        <h2>用户列表</h2>
        <button class="refresh-btn" @click="fetchUsers" :disabled="loading">
          {{ loading ? '刷新中...' : '刷新' }}
        </button>
      </div>

      <div class="users-table-wrapper">
        <table class="users-table">
          <thead>
            <tr>
              <th>用户名</th>
              <th>邮箱</th>
              <th>类型</th>
              <th>项目配额</th>
              <th>已用项目</th>
              <th>试用集数</th>
              <th>注册时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user._id" :class="{ admin: user.role === 'admin' }">
              <td>
                <span class="username">{{ user.username }}</span>
                <span v-if="user.role === 'admin'" class="role-tag admin">管理员</span>
              </td>
              <td>{{ user.email }}</td>
              <td>
                <span class="tier-badge" :class="user.tier">
                  {{ user.tier === 'trial' ? '试用' : '付费' }}
                </span>
              </td>
              <td>{{ user.projectQuota }}</td>
              <td>{{ user.projectsUsed }}</td>
              <td>{{ user.trialEpisodesUsed || 0 }} / 10</td>
              <td>{{ formatDate(user.createdAt) }}</td>
              <td class="actions">
                <button class="action-btn view" @click="selectedUser = user; showUserDetailModal = true" title="查看详情">
                  👁️
                </button>
                <button class="action-btn edit" @click="openQuotaEdit(user)" title="编辑配额">
                  ✏️
                </button>
                <button 
                  v-if="user.role !== 'admin'"
                  class="action-btn delete" 
                  @click="deleteUser(user)" 
                  title="删除用户"
                >
                  🗑️
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 代理管理 -->
    <div v-show="activeTab === 'agents'" class="agents-section">
      <div class="section-header">
        <h2>代理列表</h2>
        <div class="header-actions">
          <button class="refresh-btn" @click="fetchAgents" :disabled="agentsLoading">
            {{ agentsLoading ? '刷新中...' : '刷新' }}
          </button>
          <button class="create-btn" @click="showCreateAgentModal = true">创建代理</button>
        </div>
      </div>

      <div class="users-table-wrapper">
        <table class="users-table">
          <thead>
            <tr>
              <th>用户名</th>
              <th>邮箱</th>
              <th>状态</th>
              <th>配额池</th>
              <th>已分配</th>
              <th>下级用户</th>
              <th>邀请码</th>
              <th>备注</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="agent in agents" :key="agent._id">
              <td>{{ agent.username }}</td>
              <td>{{ agent.email }}</td>
              <td>
                <span class="tier-badge" :class="agent.status === 'active' ? 'paid' : 'trial'">
                  {{ agent.status === 'active' ? '正常' : '冻结' }}
                </span>
              </td>
              <td>{{ agent.projectQuota }}</td>
              <td>{{ agent.projectsAllocated }}</td>
              <td>{{ agent.creatorCount || 0 }} (付费 {{ agent.paidCreatorCount || 0 }})</td>
              <td><code>{{ agent.inviteCode }}</code></td>
              <td class="note-cell">{{ agent.note || '-' }}</td>
              <td class="actions">
                <button class="action-btn edit" @click="openEditAgent(agent)" title="编辑">✏️</button>
                <button class="action-btn delete" @click="deleteAgent(agent)" title="删除">🗑️</button>
              </td>
            </tr>
            <tr v-if="!agents.length">
              <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 32px">暂无代理</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 创建代理弹窗 -->
    <Modal :show="showCreateAgentModal" title="创建代理" width="480px" @close="showCreateAgentModal = false">
      <div class="quota-form">
        <div class="form-grid">
          <div class="form-group">
            <label>用户名</label>
            <div class="input-wrapper">
              <input v-model="agentForm.username" type="text" placeholder="代理用户名" />
            </div>
          </div>
          <div class="form-group">
            <label>邮箱</label>
            <div class="input-wrapper">
              <input v-model="agentForm.email" type="email" placeholder="代理邮箱" />
            </div>
          </div>
          <div class="form-group">
            <label>密码</label>
            <div class="input-wrapper">
              <input v-model="agentForm.password" type="text" placeholder="初始密码" />
            </div>
          </div>
          <div class="form-group">
            <label>项目配额池</label>
            <div class="input-wrapper">
              <input v-model.number="agentForm.projectQuota" type="number" min="0" />
              <span class="input-suffix">个项目</span>
            </div>
          </div>
        </div>
        <div class="form-group full-width">
          <label>备注</label>
          <div class="input-wrapper">
            <input v-model="agentForm.note" type="text" placeholder="代理商名称、联系方式等" />
          </div>
        </div>
        <div class="form-actions">
          <button class="btn-cancel" @click="showCreateAgentModal = false">取消</button>
          <button class="btn-save" @click="createAgent">创建</button>
        </div>
      </div>
    </Modal>

    <!-- 编辑代理弹窗 -->
    <Modal :show="showEditAgentModal" title="编辑代理" width="480px" @close="showEditAgentModal = false">
      <div class="quota-form" v-if="selectedAgent">
        <div class="user-card">
          <div class="user-avatar">{{ selectedAgent.username.charAt(0).toUpperCase() }}</div>
          <div class="user-meta">
            <div class="user-name">{{ selectedAgent.username }}</div>
            <div class="user-email">{{ selectedAgent.email }}</div>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label>项目配额池</label>
            <div class="input-wrapper">
              <input v-model.number="editAgentForm.projectQuota" type="number" min="0" />
              <span class="input-suffix">个项目</span>
            </div>
            <p class="hint">已分配 {{ selectedAgent.projectsAllocated }} 个，不能低于此值</p>
          </div>
          <div class="form-group">
            <label>状态</label>
            <div class="select-wrapper">
              <select v-model="editAgentForm.status">
                <option value="active">正常</option>
                <option value="frozen">冻结</option>
              </select>
            </div>
          </div>
        </div>
        <div class="form-group full-width">
          <label>备注</label>
          <div class="input-wrapper">
            <input v-model="editAgentForm.note" type="text" placeholder="备注" />
          </div>
        </div>
        <div class="form-actions">
          <button class="btn-cancel" @click="showEditAgentModal = false">取消</button>
          <button class="btn-save" @click="saveAgent">保存</button>
        </div>
      </div>
    </Modal>

    <!-- 配额编辑弹窗 -->
    <Modal :show="showQuotaModal" title="编辑用户配额" width="520px" @close="showQuotaModal = false">
      <div class="quota-form" v-if="selectedUser">
        <!-- 用户信息卡片 -->
        <div class="user-card">
          <div class="user-avatar">{{ selectedUser.username.charAt(0).toUpperCase() }}</div>
          <div class="user-meta">
            <div class="user-name">{{ selectedUser.username }}</div>
            <div class="user-email">{{ selectedUser.email }}</div>
          </div>
          <div class="user-tier-badge" :class="selectedUser.tier">
            {{ selectedUser.tier === 'trial' ? '试用版' : '专业版' }}
          </div>
        </div>
        
        <!-- 表单布局 -->
        <div class="form-grid">
          <div class="form-group">
            <label>用户类型</label>
            <div class="select-wrapper">
              <select v-model="quotaForm.tier">
                <option value="trial">试用版</option>
                <option value="paid">专业版 (付费)</option>
              </select>
            </div>
          </div>
          
          <div class="form-group">
            <label>项目配额</label>
            <div class="input-wrapper">
              <input type="number" v-model.number="quotaForm.projectQuota" min="0" max="999" />
              <span class="input-suffix">个项目</span>
            </div>
          </div>
        </div>
        
        <div class="form-group full-width" v-if="quotaForm.tier === 'trial'">
          <label>已用试用集数</label>
          <div class="input-with-progress">
            <input type="number" v-model.number="quotaForm.trialEpisodesUsed" min="0" max="100" />
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${Math.min(quotaForm.trialEpisodesUsed * 10, 100)}%` }"></div>
            </div>
            <span class="progress-text">{{ quotaForm.trialEpisodesUsed }} / 10 集</span>
          </div>
          <p class="hint">设置为 0 可重置用户的试用配额</p>
        </div>
        
        <div class="form-actions">
          <button class="btn-cancel" @click="showQuotaModal = false">取消</button>
          <button class="btn-save" @click="saveQuota">保存修改</button>
        </div>
      </div>
    </Modal>

    <!-- 用户详情弹窗 -->
    <Modal :show="showUserDetailModal" title="用户详情" @close="showUserDetailModal = false">
      <div class="user-detail" v-if="selectedUser">
        <div class="detail-row">
          <span class="label">用户ID</span>
          <span class="value">{{ selectedUser._id }}</span>
        </div>
        <div class="detail-row">
          <span class="label">用户名</span>
          <span class="value">{{ selectedUser.username }}</span>
        </div>
        <div class="detail-row">
          <span class="label">邮箱</span>
          <span class="value">{{ selectedUser.email }}</span>
        </div>
        <div class="detail-row">
          <span class="label">角色</span>
          <span class="value">{{ selectedUser.role === 'admin' ? '管理员' : '普通用户' }}</span>
        </div>
        <div class="detail-row">
          <span class="label">类型</span>
          <span class="value">{{ selectedUser.tier === 'trial' ? '试用' : '付费' }}</span>
        </div>
        <div class="detail-row">
          <span class="label">项目配额</span>
          <span class="value">{{ selectedUser.projectsUsed }} / {{ selectedUser.projectQuota }}</span>
        </div>
        <div class="detail-row" v-if="selectedUser.tier === 'trial'">
          <span class="label">试用集数</span>
          <span class="value">{{ selectedUser.trialEpisodesUsed || 0 }} / 10</span>
        </div>
        <div class="detail-row">
          <span class="label">注册时间</span>
          <span class="value">{{ formatDate(selectedUser.createdAt) }}</span>
        </div>
        <div class="detail-row">
          <span class="label">最后更新</span>
          <span class="value">{{ formatDate(selectedUser.updatedAt) }}</span>
        </div>
        
        <div class="detail-actions">
          <button class="btn-edit" @click="showUserDetailModal = false; openQuotaEdit(selectedUser)">
            编辑配额
          </button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.admin-page {
  min-height: 100vh;
  padding: 24px;
  background: var(--bg-base);
}

.admin-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 24px;
  background: var(--bg-surface);
  padding: 4px;
  border-radius: 10px;
  border: 1px solid var(--border-default);
  width: fit-content;
}

.admin-tab {
  padding: 8px 20px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.admin-tab:hover {
  color: var(--text-primary);
}

.admin-tab.active {
  background: var(--primary);
  color: white;
}

.agents-section { margin-bottom: 24px; }

.header-actions { display: flex; gap: 8px; }

.create-btn {
  padding: 8px 16px;
  background: var(--primary);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.create-btn:hover { background: var(--primary-hover); }

.note-cell { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-tertiary); }

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-btn {
  padding: 8px 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
  color: var(--text-primary);
}

.admin-badge {
  padding: 6px 12px;
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}

/* 统计卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 32px;
}

.stat-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: var(--text-secondary);
}

/* 用户列表 */
.users-section {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-default);
}

.section-header h2 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary);
}

.refresh-btn {
  padding: 8px 16px;
  background: var(--primary);
  border: none;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.users-table-wrapper {
  overflow-x: auto;
}

.users-table {
  width: 100%;
  border-collapse: collapse;
}

.users-table th,
.users-table td {
  padding: 14px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border-default);
}

.users-table th {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: var(--bg-elevated);
}

.users-table td {
  font-size: 14px;
  color: var(--text-primary);
}

.users-table tr.admin {
  background: rgba(139, 92, 246, 0.05);
}

.username {
  font-weight: 500;
}

.role-tag {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}

.role-tag.admin {
  background: rgba(139, 92, 246, 0.2);
  color: #a78bfa;
}

.tier-badge {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.tier-badge.trial {
  background: rgba(234, 179, 8, 0.2);
  color: #eab308;
}

.tier-badge.paid {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.action-btn.view {
  background: rgba(59, 130, 246, 0.1);
}

.action-btn.edit {
  background: rgba(234, 179, 8, 0.1);
}

.action-btn.delete {
  background: rgba(239, 68, 68, 0.1);
}

.action-btn:hover {
  transform: scale(1.1);
}

.user-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 12px;
  margin-bottom: 24px;
}

.user-avatar {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  border-radius: 12px;
  color: #fff;
  font-size: 20px;
  font-weight: 700;
}

.user-meta {
  flex: 1;
}

.user-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.user-email {
  font-size: 13px;
  color: var(--text-secondary);
}

.user-tier-badge {
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.user-tier-badge.trial {
  background: rgba(234, 179, 8, 0.2);
  color: #eab308;
}

.user-tier-badge.paid {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

/* 表单网格 */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 0;
}

.form-group.full-width {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.select-wrapper,
.input-wrapper {
  position: relative;
}

.form-group select,
.form-group input {
  width: 100%;
  padding: 12px 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 15px;
  transition: all 0.2s;
}

.form-group select:focus,
.form-group input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}

.input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.input-wrapper input {
  flex: 1;
}

.input-suffix {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* 试用集数进度条 */
.input-with-progress {
  display: flex;
  align-items: center;
  gap: 12px;
}

.input-with-progress input {
  width: 80px;
  flex-shrink: 0;
}

.input-with-progress .progress-bar {
  flex: 1;
  height: 8px;
  background: var(--bg-elevated);
  border-radius: 4px;
  overflow: hidden;
}

.input-with-progress .progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #22c55e 0%, #eab308 50%, #ef4444 100%);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.input-with-progress .progress-text {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  min-width: 60px;
  text-align: right;
}

.form-group .hint {
  margin: 10px 0 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border-default);
}

.btn-cancel,
.btn-save {
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  color: var(--text-secondary);
}

.btn-save {
  background: var(--primary);
  border: none;
  color: #fff;
}

/* 用户详情 */
.user-detail {
  padding: 8px 0;
}

.detail-row {
  display: flex;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-default);
}

.detail-row:last-of-type {
  border-bottom: none;
}

.detail-row .label {
  width: 100px;
  color: var(--text-secondary);
  font-size: 13px;
}

.detail-row .value {
  flex: 1;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  word-break: break-all;
}

.detail-actions {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border-default);
}

.btn-edit {
  width: 100%;
  padding: 12px;
  background: var(--primary);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .users-table th,
  .users-table td {
    padding: 10px 12px;
    font-size: 12px;
  }
}
</style>
