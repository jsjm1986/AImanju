<template>
  <div class="admin-page">
    <div class="admin-container container">
      <!-- 侧边栏 -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <span class="sidebar-title">管理后台</span>
        </div>
        <nav class="sidebar-nav">
          <button 
            v-for="tab in tabs" 
            :key="tab.id"
            class="nav-item"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <span class="nav-label">{{ tab.label }}</span>
          </button>
        </nav>
      </aside>

      <!-- 主内容区 -->
      <main class="main-area">
        <!-- 项目管理 -->
        <section v-if="activeTab === 'projects'" class="panel">
          <div class="panel-header">
            <h2>项目管理</h2>
            <button @click="loadProjects" class="btn btn-secondary">🔄 刷新</button>
          </div>

          <div v-if="loadingProjects" class="loading">加载中...</div>
          <div v-else class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>项目名称</th>
                  <th>类型</th>
                  <th>集数</th>
                  <th>每集价格</th>
                  <th>免费集数</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="project in allProjects" :key="project._id">
                  <td class="td-name">{{ project.name }}</td>
                  <td>{{ project.genre || '-' }}</td>
                  <td>{{ project.actualEpisodeCount || 0 }}</td>
                  <td>
                    <input 
                      type="number" 
                      v-model.number="project.pricePerEpisode"
                      min="0"
                      class="price-input"
                    />
                  </td>
                  <td>
                    <input 
                      type="number" 
                      v-model.number="project.freeEpisodeCount"
                      min="0"
                      max="10"
                      class="price-input"
                    />
                  </td>
                  <td>
                    <span class="badge" :class="project.isPublished ? 'badge-success' : ''">
                      {{ project.isPublished ? '已上架' : '未上架' }}
                    </span>
                  </td>
                  <td class="td-actions">
                    <button 
                      @click="openPublishSettings(project)"
                      class="btn-action btn-settings"
                    >
                      设置
                    </button>
                    <button 
                      v-if="!project.isPublished"
                      @click="publishProject(project)"
                      class="btn-action btn-publish"
                    >
                      上架
                    </button>
                    <button 
                      v-else
                      @click="unpublishProject(project)"
                      class="btn-action btn-unpublish"
                    >
                      下架
                    </button>
                    <button 
                      @click="saveProjectConfig(project)"
                      class="btn-action btn-save"
                    >
                      保存
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- 上架审核 -->
        <section v-if="activeTab === 'publish'" class="panel">
          <div class="panel-header">
            <h2>🚀 上架审核</h2>
            <button @click="loadPublishRequests" class="btn btn-secondary">🔄 刷新</button>
          </div>

          <div v-if="loadingPublishRequests" class="loading">加载中...</div>
          <div v-else class="table-wrapper">
            <div v-if="publishRequests.length === 0" class="empty-state">
              暂无待审核的上架申请
            </div>
            <table v-else class="data-table">
              <thead>
                <tr>
                  <th>项目名称</th>
                  <th>创作者</th>
                  <th>集数</th>
                  <th>每集价格</th>
                  <th>免费集数</th>
                  <th>受众</th>
                  <th>状态</th>
                  <th>申请时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="req in publishRequests" :key="req._id" :class="{ 'row-pending': req.status === 'pending' }">
                  <td class="td-name">{{ req.project?.name || '未知' }}</td>
                  <td>{{ req.creator?.username || '未知' }}</td>
                  <td>{{ req.actualEpisodeCount }}</td>
                  <td>{{ req.pricePerEpisode }}</td>
                  <td>{{ req.freeEpisodeCount }}</td>
                  <td>{{ req.targetAudience === 'male' ? '男频' : '女频' }}</td>
                  <td>
                    <span class="badge" :class="'badge-' + req.status">
                      {{ req.status === 'pending' ? '待审核' : req.status === 'approved' ? '已通过' : '已拒绝' }}
                    </span>
                  </td>
                  <td>{{ new Date(req.createdAt).toLocaleDateString() }}</td>
                  <td class="td-actions" v-if="req.status === 'pending'">
                    <button class="btn-action btn-approve" @click="approvePublishRequest(req)">
                      通过
                    </button>
                    <button class="btn-action btn-reject" @click="rejectPublishRequest(req)">
                      拒绝
                    </button>
                  </td>
                  <td v-else class="td-note">
                    {{ req.adminNote || '-' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- 用户管理 -->
        <section v-if="activeTab === 'users'" class="panel">
          <div class="panel-header">
            <h2>👥 用户管理</h2>
            <button @click="loadUsers" class="btn btn-secondary">🔄 刷新</button>
          </div>

          <div v-if="loadingUsers" class="loading">加载中...</div>
          <div v-else class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>用户名</th>
                  <th>昵称</th>
                  <th>邮箱</th>
                  <th>积分</th>
                  <th>角色</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="user in users" :key="user._id">
                  <td>{{ user.username }}</td>
                  <td>{{ user.nickname || '-' }}</td>
                  <td>{{ user.email }}</td>
                  <td class="td-points">{{ user.points }}</td>
                  <td>
                    <span class="badge" :class="user.role === 'admin' ? 'badge-warning' : ''">
                      {{ user.role === 'admin' ? '管理员' : '用户' }}
                    </span>
                  </td>
                  <td>
                    <span class="badge" :class="user.status === 'active' ? 'badge-success' : 'badge-error'">
                      {{ user.status === 'active' ? '正常' : '禁用' }}
                    </span>
                  </td>
                  <td class="td-actions">
                    <button @click="openRechargeModal(user)" class="btn-action btn-recharge">
                      充值
                    </button>
                    <button 
                      v-if="user.status === 'active'"
                      @click="toggleUserStatus(user, 'banned')"
                      class="btn-action btn-ban"
                    >
                      禁用
                    </button>
                    <button 
                      v-else
                      @click="toggleUserStatus(user, 'active')"
                      class="btn-action btn-enable"
                    >
                      启用
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- 标签管理 -->
        <section v-if="activeTab === 'tags'" class="panel">
          <div class="panel-header">
            <h2>标签管理</h2>
            <button @click="openTagModal()" class="btn btn-primary">+ 添加标签</button>
          </div>

          <div v-if="loadingTags" class="loading">加载中...</div>
          <div v-else class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>标签名称</th>
                  <th>分类</th>
                  <th>颜色</th>
                  <th>排序</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="tag in tags" :key="tag._id">
                  <td class="td-name">
                    <span class="tag-preview" :style="{ background: tag.color }">{{ tag.name }}</span>
                  </td>
                  <td>{{ getCategoryLabel(tag.category) }}</td>
                  <td>
                    <span class="color-dot" :style="{ background: tag.color }"></span>
                    {{ tag.color }}
                  </td>
                  <td>{{ tag.sortOrder }}</td>
                  <td>
                    <span class="badge" :class="tag.isActive ? 'badge-success' : ''">
                      {{ tag.isActive ? '启用' : '禁用' }}
                    </span>
                  </td>
                  <td class="td-actions">
                    <button @click="openTagModal(tag)" class="btn-action btn-edit">编辑</button>
                    <button @click="toggleTagActive(tag)" class="btn-action" :class="tag.isActive ? 'btn-ban' : 'btn-enable'">
                      {{ tag.isActive ? '禁用' : '启用' }}
                    </button>
                    <button @click="deleteTag(tag)" class="btn-action btn-delete">删除</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- 改写请求管理 -->
        <section v-if="activeTab === 'rewrite'" class="panel">
          <div class="panel-header">
            <h2>改写请求</h2>
            <button @click="loadRewriteRequests" class="btn btn-secondary">🔄 刷新</button>
          </div>
          <div v-if="loadingRewrite" class="loading-state">加载中...</div>
          <div v-else class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>项目</th>
                  <th>用户</th>
                  <th>需求描述</th>
                  <th>价格</th>
                  <th>状态</th>
                  <th>时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="rewriteRequests.length === 0">
                  <td colspan="7" class="empty-row">暂无改写请求</td>
                </tr>
                <tr v-for="req in rewriteRequests" :key="req._id">
                  <td class="td-name">{{ req.projectName }}</td>
                  <td>{{ req.buyerName }}</td>
                  <td class="td-requirements">
                    <span :title="req.requirements">{{ req.requirements.substring(0, 30) }}{{ req.requirements.length > 30 ? '...' : '' }}</span>
                  </td>
                  <td>{{ req.price }} 积分</td>
                  <td>
                    <span class="badge" :class="getRewriteStatusClass(req.status)">
                      {{ getRewriteStatusLabel(req.status) }}
                    </span>
                  </td>
                  <td>{{ formatDate(req.createdAt) }}</td>
                  <td class="td-actions">
                    <select 
                      :value="req.status" 
                      @change="updateRewriteStatus(req, ($event.target as HTMLSelectElement).value)"
                      class="status-select"
                    >
                      <option value="paid">已支付</option>
                      <option value="processing">处理中</option>
                      <option value="completed">已完成</option>
                      <option value="rejected">已拒绝</option>
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>

    <!-- 充值弹窗 -->
    <div v-if="rechargeModal.visible" class="modal-overlay" @click.self="rechargeModal.visible = false">
      <div class="modal-content">
        <h3>积分充值</h3>
        <p class="modal-user">用户：{{ rechargeModal.user?.username }}</p>
        <p class="modal-balance">当前积分：{{ rechargeModal.user?.points }}</p>
        <div class="form-group">
          <label>充值金额</label>
          <input 
            v-model.number="rechargeModal.amount" 
            type="number" 
            min="1"
            class="input"
            placeholder="输入积分数量"
          />
        </div>
        <div class="modal-actions">
          <button @click="rechargeModal.visible = false" class="btn btn-secondary">取消</button>
          <button @click="confirmRecharge" class="btn btn-primary" :disabled="recharging">
            {{ recharging ? '处理中...' : '确认充值' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 标签编辑弹窗 -->
    <div v-if="tagModal.visible" class="modal-overlay" @click.self="tagModal.visible = false">
      <div class="modal-content">
        <h3>{{ tagModal.isEdit ? '编辑标签' : '添加标签' }}</h3>
        
        <div class="form-group">
          <label>标签名称</label>
          <input 
            v-model="tagModal.form.name" 
            type="text" 
            class="input"
            placeholder="如：都市、古风、悬疑"
            maxlength="20"
          />
        </div>
        
        <div class="form-group">
          <label>适用分类</label>
          <select v-model="tagModal.form.category" class="input">
            <option value="common">通用（男女频都显示）</option>
            <option value="male">仅男频</option>
            <option value="female">仅女频</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>标签颜色</label>
          <div class="color-row">
            <input 
              v-model="tagModal.form.color" 
              type="color" 
              class="color-picker"
            />
            <input 
              v-model="tagModal.form.color" 
              type="text" 
              class="input color-text"
              placeholder="#6366f1"
            />
          </div>
        </div>
        
        <div class="form-group">
          <label>排序权重（越小越靠前）</label>
          <input 
            v-model.number="tagModal.form.sortOrder" 
            type="number" 
            class="input"
            min="0"
          />
        </div>
        
        <div class="modal-actions">
          <button @click="tagModal.visible = false" class="btn btn-secondary">取消</button>
          <button @click="saveTag" class="btn btn-primary" :disabled="savingTag">
            {{ savingTag ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 发布设置弹窗 -->
    <div v-if="publishModal.visible" class="modal-overlay" @click.self="publishModal.visible = false">
      <div class="modal-content modal-lg">
        <h3>📤 发布设置 - {{ publishModal.projectName }}</h3>
        
        <div class="form-group">
          <label>目标受众</label>
          <div class="audience-selector">
            <label class="radio-item" :class="{ active: publishModal.form.targetAudience === 'female' }">
              <input type="radio" v-model="publishModal.form.targetAudience" value="female" />
              <span>👩 女频</span>
            </label>
            <label class="radio-item" :class="{ active: publishModal.form.targetAudience === 'male' }">
              <input type="radio" v-model="publishModal.form.targetAudience" value="male" />
              <span>👨 男频</span>
            </label>
          </div>
        </div>
        
        <div class="form-group">
          <label>选择标签 <span class="hint">(可多选)</span></label>
          <div class="tags-grid">
            <label 
              v-for="tag in tags" 
              :key="tag._id" 
              class="tag-checkbox"
              :class="{ selected: publishModal.form.tags.includes(tag._id) }"
              :style="{ '--tag-bg': tag.color }"
            >
              <input type="checkbox" :value="tag._id" v-model="publishModal.form.tags" />
              <span>{{ tag.name }}</span>
            </label>
          </div>
          <p v-if="tags.length === 0" class="empty-hint">暂无标签，请先在标签管理中添加</p>
        </div>
        
        <div class="form-group">
          <label class="checkbox-row">
            <input type="checkbox" v-model="publishModal.form.supportsRewrite" />
            <span>支持改写服务</span>
          </label>
          <p class="form-hint">勾选后，买家可以申请付费改写剧本</p>
        </div>
        
        <div v-if="publishModal.form.supportsRewrite" class="form-group">
          <label>改写服务价格（积分/次）</label>
          <input 
            v-model.number="publishModal.form.rewritePrice" 
            type="number" 
            class="input"
            min="0"
            placeholder="请输入改写服务价格"
          />
        </div>
        
        <div class="modal-actions">
          <button @click="publishModal.visible = false" class="btn btn-secondary">取消</button>
          <button @click="savePublishSettings" class="btn btn-primary" :disabled="savingPublish">
            {{ savingPublish ? '保存中...' : '保存设置' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import http from '@/services/api';

const tabs = [
  { id: 'projects', label: '项目管理' },
  { id: 'publish', label: '上架审核' },
  { id: 'users', label: '用户管理' },
  { id: 'tags', label: '标签管理' },
  { id: 'rewrite', label: '改写请求' },
];

const activeTab = ref('projects');

// 项目数据
interface ProjectItem {
  _id: string;
  name: string;
  genre?: string;
  totalEpisodes?: number;
  actualEpisodeCount: number;
  pricePerEpisode: number;
  freeEpisodeCount: number;
  isPublished: boolean;
}
const allProjects = ref<ProjectItem[]>([]);
const loadingProjects = ref(false);

// 用户数据
interface UserItem {
  _id: string;
  username: string;
  nickname?: string;
  email: string;
  points: number;
  role: string;
  status: string;
}
const users = ref<UserItem[]>([]);
const loadingUsers = ref(false);

// 充值弹窗
const rechargeModal = reactive({
  visible: false,
  user: null as UserItem | null,
  amount: 100,
});
const recharging = ref(false);

// 标签数据
interface TagItem {
  _id: string;
  name: string;
  category: 'male' | 'female' | 'common';
  color: string;
  sortOrder: number;
  isActive: boolean;
}
const tags = ref<TagItem[]>([]);
const loadingTags = ref(false);

// 标签弹窗
const tagModal = reactive({
  visible: false,
  isEdit: false,
  editId: '',
  form: {
    name: '',
    category: 'common' as 'male' | 'female' | 'common',
    color: '#6366f1',
    sortOrder: 0,
  }
});
const savingTag = ref(false);

// 发布设置弹窗
const publishModal = reactive({
  visible: false,
  projectId: '',
  projectName: '',
  form: {
    targetAudience: 'female' as 'male' | 'female',
    tags: [] as string[],
    supportsRewrite: false,
    rewritePrice: 0,
  }
});
const savingPublish = ref(false);

// 改写请求数据
interface RewriteRequestItem {
  _id: string;
  projectId: string;
  projectName: string;
  buyerId: string;
  buyerName: string;
  status: string;
  price: number;
  requirements: string;
  result?: string;
  createdAt: string;
}
const rewriteRequests = ref<RewriteRequestItem[]>([]);
const loadingRewrite = ref(false);

// 上架申请数据
interface PublishRequestItem {
  _id: string;
  projectId: string;
  creatorId: string;
  project?: { name: string; genre: string };
  creator?: { username: string; email: string };
  actualEpisodeCount: number;
  status: 'pending' | 'approved' | 'rejected';
  pricePerEpisode: number;
  freeEpisodeCount: number;
  targetAudience: 'male' | 'female';
  adminNote?: string;
  createdAt: string;
}
const publishRequests = ref<PublishRequestItem[]>([]);
const loadingPublishRequests = ref(false);

onMounted(() => {
  loadProjects();
  loadUsers();
  loadTags();
  loadRewriteRequests();
  loadPublishRequests();
});

// 加载上架申请
async function loadPublishRequests() {
  loadingPublishRequests.value = true;
  try {
    const res = await http.get('/admin/publish-requests');
    publishRequests.value = (res as any).requests || [];
  } catch (err) {
    console.error('Load publish requests failed:', err);
  } finally {
    loadingPublishRequests.value = false;
  }
}

// 批准上架申请
async function approvePublishRequest(request: PublishRequestItem) {
  if (!confirm(`确定批准项目「${request.project?.name}」上架吗？`)) return;
  try {
    await http.put(`/admin/publish-requests/${request._id}/approve`);
    alert('申请已批准，项目已上架');
    loadPublishRequests();
    loadProjects();
  } catch (err) {
    console.error('Approve failed:', err);
    alert('批准失败');
  }
}

// 拒绝上架申请
async function rejectPublishRequest(request: PublishRequestItem) {
  const reason = prompt('请输入拒绝原因：');
  if (reason === null) return;
  try {
    await http.put(`/admin/publish-requests/${request._id}/reject`, { adminNote: reason });
    alert('申请已拒绝');
    loadPublishRequests();
  } catch (err) {
    console.error('Reject failed:', err);
    alert('拒绝失败');
  }
}

async function loadProjects() {
  loadingProjects.value = true;
  try {
    // 使用管理员 API 获取所有项目及实际剧集数量
    const res = await http.get('/admin/projects');
    allProjects.value = (res as any).projects || [];
  } catch (err) {
    console.error('Load projects failed:', err);
  } finally {
    loadingProjects.value = false;
  }
}

async function saveProjectConfig(project: ProjectItem) {
  try {
    await http.put(`/publish/${project._id}`, {
      pricePerEpisode: project.pricePerEpisode,
      freeEpisodeCount: project.freeEpisodeCount,
    });
    alert('保存成功');
  } catch (err) {
    alert('保存失败');
  }
}

async function publishProject(project: ProjectItem) {
  try {
    await http.post(`/publish/${project._id}/publish`);
    project.isPublished = true;
    alert('上架成功');
  } catch (err) {
    alert('上架失败');
  }
}

async function unpublishProject(project: ProjectItem) {
  try {
    await http.post(`/publish/${project._id}/unpublish`);
    project.isPublished = false;
    alert('下架成功');
  } catch (err) {
    alert('下架失败');
  }
}

async function loadUsers() {
  loadingUsers.value = true;
  try {
    const res = await http.get('/admin/users');
    users.value = (res as any).users || [];
  } catch (err) {
    console.error('Load users failed:', err);
  } finally {
    loadingUsers.value = false;
  }
}

function openRechargeModal(user: UserItem) {
  rechargeModal.user = user;
  rechargeModal.amount = 100;
  rechargeModal.visible = true;
}

async function confirmRecharge() {
  if (!rechargeModal.user || !rechargeModal.amount) return;
  
  recharging.value = true;
  try {
    const res = await http.post(`/admin/users/${rechargeModal.user._id}/recharge`, {
      amount: rechargeModal.amount,
    });
    rechargeModal.user.points = (res as any).newBalance;
    rechargeModal.visible = false;
    alert('充值成功');
  } catch (err) {
    alert('充值失败');
  } finally {
    recharging.value = false;
  }
}

async function toggleUserStatus(user: UserItem, status: 'active' | 'banned') {
  try {
    await http.put(`/admin/users/${user._id}/status`, { status });
    user.status = status;
    alert(status === 'active' ? '已启用' : '已禁用');
  } catch (err) {
    alert('操作失败');
  }
}

// ========================================
// 标签管理函数
// ========================================

async function loadTags() {
  loadingTags.value = true;
  try {
    const res = await http.get('/admin/tags');
    tags.value = (res as any).tags || [];
  } catch (err) {
    console.error('Load tags failed:', err);
  } finally {
    loadingTags.value = false;
  }
}

function openTagModal(tag?: TagItem) {
  if (tag) {
    tagModal.isEdit = true;
    tagModal.editId = tag._id;
    tagModal.form.name = tag.name;
    tagModal.form.category = tag.category;
    tagModal.form.color = tag.color;
    tagModal.form.sortOrder = tag.sortOrder;
  } else {
    tagModal.isEdit = false;
    tagModal.editId = '';
    tagModal.form.name = '';
    tagModal.form.category = 'common';
    tagModal.form.color = '#6366f1';
    tagModal.form.sortOrder = 0;
  }
  tagModal.visible = true;
}

async function saveTag() {
  if (!tagModal.form.name) {
    alert('请输入标签名称');
    return;
  }

  savingTag.value = true;
  try {
    if (tagModal.isEdit) {
      await http.put(`/admin/tags/${tagModal.editId}`, tagModal.form);
    } else {
      await http.post('/admin/tags', tagModal.form);
    }
    tagModal.visible = false;
    loadTags();
    alert(tagModal.isEdit ? '更新成功' : '创建成功');
  } catch (err: any) {
    alert(err.error || '操作失败');
  } finally {
    savingTag.value = false;
  }
}

async function toggleTagActive(tag: TagItem) {
  try {
    await http.put(`/admin/tags/${tag._id}`, { isActive: !tag.isActive });
    tag.isActive = !tag.isActive;
  } catch (err) {
    alert('操作失败');
  }
}

async function deleteTag(tag: TagItem) {
  if (!confirm(`确定删除标签 "${tag.name}" 吗？`)) return;
  
  try {
    await http.delete(`/admin/tags/${tag._id}`);
    tags.value = tags.value.filter(t => t._id !== tag._id);
    alert('删除成功');
  } catch (err) {
    alert('删除失败');
  }
}

function getCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    male: '男频',
    female: '女频',
    common: '通用',
  };
  return labels[category] || category;
}

// 发布设置函数
async function openPublishSettings(project: ProjectItem) {
  publishModal.projectId = project._id;
  publishModal.projectName = project.name;
  
  // 加载当前项目的发布配置
  try {
    const res = await http.get(`/publish/${project._id}`);
    const data = res as any;
    publishModal.form.targetAudience = data.targetAudience || 'female';
    publishModal.form.tags = data.tags || [];
    publishModal.form.supportsRewrite = data.supportsRewrite || false;
    publishModal.form.rewritePrice = data.rewritePrice || 0;
  } catch {
    publishModal.form.targetAudience = 'female';
    publishModal.form.tags = [];
    publishModal.form.supportsRewrite = false;
    publishModal.form.rewritePrice = 0;
  }
  
  publishModal.visible = true;
}

async function savePublishSettings() {
  savingPublish.value = true;
  try {
    await http.put(`/publish/${publishModal.projectId}`, {
      targetAudience: publishModal.form.targetAudience,
      tags: publishModal.form.tags,
      supportsRewrite: publishModal.form.supportsRewrite,
      rewritePrice: publishModal.form.rewritePrice,
    });
    publishModal.visible = false;
    alert('发布设置已保存');
  } catch (err) {
    alert('保存失败');
  } finally {
    savingPublish.value = false;
  }
}

// 改写请求管理
async function loadRewriteRequests() {
  loadingRewrite.value = true;
  try {
    const res = await http.get('/admin/rewrite-requests');
    rewriteRequests.value = (res as any).requests || [];
  } catch (err) {
    console.error('Load rewrite requests error:', err);
  } finally {
    loadingRewrite.value = false;
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getRewriteStatusClass(status: string): string {
  const map: Record<string, string> = {
    'paid': 'badge-warning',
    'processing': 'badge-info',
    'completed': 'badge-success',
    'rejected': 'badge-error',
  };
  return map[status] || '';
}

function getRewriteStatusLabel(status: string): string {
  const map: Record<string, string> = {
    'pending': '待支付',
    'paid': '已支付',
    'processing': '处理中',
    'completed': '已完成',
    'rejected': '已拒绝',
    'cancelled': '已取消',
  };
  return map[status] || status;
}

async function updateRewriteStatus(req: RewriteRequestItem, newStatus: string) {
  try {
    await http.put(`/admin/rewrite-requests/${req._id}`, { status: newStatus });
    req.status = newStatus;
  } catch (err) {
    alert('更新状态失败');
  }
}
</script>

<style scoped>
.admin-page {
  min-height: calc(100vh - 64px);
  padding: var(--space-6) 0;
}

.admin-container {
  display: flex;
  gap: var(--space-6);
  max-width: 1400px;
}

/* 侧边栏 */
.sidebar {
  width: 220px;
  flex-shrink: 0;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  overflow: hidden;
}

@media (max-width: 768px) {
  .admin-container {
    flex-direction: column;
  }
  .sidebar {
    width: 100%;
  }
  .sidebar-nav {
    flex-direction: row;
    overflow-x: auto;
  }
}

.sidebar-header {
  padding: var(--space-5);
  border-bottom: 1px solid var(--border-color);
}

.sidebar-title {
  font-size: var(--text-lg);
  font-weight: 600;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  padding: var(--space-3);
  gap: var(--space-2);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: 500;
  text-align: left;
  transition: all var(--duration-fast);
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--primary);
}

.nav-item.active {
  background: var(--primary-light);
  color: var(--primary);
}

.nav-icon {
  font-size: 18px;
}

/* 主内容区 */
.main-area {
  flex: 1;
  min-width: 0;
}

.panel {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5);
  border-bottom: 1px solid var(--border-color);
}

.panel-header h2 {
  font-size: var(--text-lg);
  font-weight: 600;
}

.loading {
  padding: var(--space-10);
  text-align: center;
  color: var(--text-muted);
}

/* 表格 */
.table-wrapper {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}


.data-table th,
.data-table td {
  padding: var(--space-4);
  text-align: left;
  border-bottom: 1px solid var(--border-color);
  vertical-align: middle;
}

.data-table th {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  background: var(--bg-elevated);
}

.data-table td {
  font-size: var(--text-sm);
}

.td-name {
  font-weight: 500;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-points {
  font-weight: 600;
  color: var(--primary);
}

.td-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.price-input {
  width: 70px;
  padding: var(--space-2);
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  text-align: center;
}

.price-input:focus {
  outline: none;
  border-color: var(--primary);
}

/* 操作按钮 */
.btn-action {
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
  font-weight: 500;
  border-radius: var(--radius-sm);
  border: none;
  cursor: pointer;
  transition: all var(--duration-fast);
}

.btn-settings {
  background: transparent;
  color: var(--primary);
  border: 1px solid var(--primary);
  /* Use ghost button style or simple text link style? 
     Screenshot shows just text or minimal button. 
     Let's match button sizing but ghost style. */
  border: none;
  padding: 0 var(--space-2);
}

.btn-settings:hover {
  text-decoration: underline;
  background: rgba(59, 130, 246, 0.1); 
}

.btn-publish {
  background: var(--success);
  color: white;
}

.btn-unpublish {
  background: var(--warning);
  color: white;
}

.btn-save {
  background: var(--primary);
  color: white;
}

.btn-recharge {
  background: var(--info);
  color: white;
}

.btn-ban {
  background: var(--error);
  color: white;
}

.btn-enable {
  background: var(--success);
  color: white;
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  width: 90%;
  max-width: 400px;
  border: 1px solid var(--border-color);
}

.modal-content h3 {
  margin-bottom: var(--space-4);
}

.modal-user,
.modal-balance {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  margin-bottom: var(--space-2);
}

.modal-content .form-group {
  margin: var(--space-5) 0;
}

.modal-content .form-group label {
  display: block;
  margin-bottom: var(--space-2);
  font-weight: 500;
}

.modal-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
}

/* 标签相关样式 */
.tag-preview {
  display: inline-block;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  color: white;
  font-size: var(--text-sm);
  font-weight: 500;
}

.color-dot {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  vertical-align: middle;
  margin-right: var(--space-2);
}

.color-row {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.color-picker {
  width: 50px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.color-text {
  flex: 1;
}

.btn-edit {
  color: var(--info);
}

.btn-delete {
  color: var(--error);
}

.btn-settings {
  color: var(--primary);
}

/* 发布设置弹窗 */
.modal-lg {
  max-width: 500px;
}

.audience-selector {
  display: flex;
  gap: var(--space-4);
}

.radio-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast);
  border: 2px solid transparent;
}

.radio-item input {
  display: none;
}

.radio-item.active {
  border-color: var(--primary);
  background: var(--primary-lighter);
}

.tags-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.tag-checkbox {
  display: flex;
  align-items: center;
  padding: var(--space-2) var(--space-4);
  background: var(--bg-secondary);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all var(--duration-fast);
  font-size: var(--text-sm);
}

.tag-checkbox input {
  display: none;
}

.tag-checkbox.selected {
  background: var(--tag-bg, var(--primary));
  color: white;
}

.hint {
  font-weight: normal;
  color: var(--text-muted);
  font-size: var(--text-xs);
}

.empty-hint {
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-style: italic;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}

.checkbox-row input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--primary);
}

.form-hint {
  margin-top: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* 状态下拉选择框 */
.status-select {
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
}

.status-select option {
  background: var(--bg-card);
  color: var(--text-primary);
}

/* 改写需求列 */
.td-requirements {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 空行提示 */
.empty-row {
  text-align: center;
  color: var(--text-muted);
  padding: var(--space-8) !important;
}

/* ============================================
   上架审核样式
   ============================================ */

/* 空状态样式 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: var(--text-muted);
  background: linear-gradient(180deg, rgba(139, 92, 246, 0.03) 0%, transparent 100%);
  border-radius: var(--radius-lg);
  border: 1px dashed var(--border-color);
}

.empty-state::before {
  content: '📭';
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.6;
}

/* 待审核行高亮 */
.row-pending {
  background: linear-gradient(90deg, rgba(234, 179, 8, 0.08) 0%, transparent 100%);
}

.row-pending:hover {
  background: linear-gradient(90deg, rgba(234, 179, 8, 0.12) 0%, transparent 100%) !important;
}

/* 审核状态徽章 */
.badge-pending {
  background: linear-gradient(135deg, rgba(234, 179, 8, 0.2) 0%, rgba(234, 179, 8, 0.1) 100%);
  color: #eab308;
  border: 1px solid rgba(234, 179, 8, 0.3);
}

.badge-approved {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(34, 197, 94, 0.1) 100%);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.badge-rejected {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.1) 100%);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

/* 通过按钮 */
.btn-approve {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: #fff;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-approve:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
}

/* 拒绝按钮 */
.btn-reject {
  background: transparent;
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.4);
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-reject:hover {
  background: #ef4444;
  color: #fff;
  border-color: #ef4444;
}

/* 备注列 */
.td-note {
  color: var(--text-muted);
  font-size: var(--text-sm);
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
