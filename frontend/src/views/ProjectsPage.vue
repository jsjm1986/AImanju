<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useProjectStore } from '@/stores/projectStore';
import { useTagStore } from '@/stores/tagStore';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/composables/useToast';
import { useConfirm } from '@/composables/useConfirm';
import api, { episodeApi } from '@/services/api';
import Modal from '@/components/common/Modal.vue';
import Drawer from '@/components/common/Drawer.vue';
import ThemeToggle from '@/components/common/ThemeToggle.vue';
import QuotaExceededModal from '@/components/common/QuotaExceededModal.vue';
import type { WritingStylePreset } from '@/types';
import { WRITING_STYLE_PRESETS } from '@/types';

const router = useRouter();
const projectStore = useProjectStore();
const tagStore = useTagStore();
const authStore = useAuthStore();
const toast = useToast();
const confirm = useConfirm();

const handleLogout = () => {
  authStore.logout();
  router.push('/login');
};

const showPasswordModal = ref(false);
const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});
const passwordLoading = ref(false);

const handleChangePassword = async () => {
  if (!passwordForm.value.currentPassword || !passwordForm.value.newPassword) {
    toast.error('请填写当前密码和新密码');
    return;
  }
  if (passwordForm.value.newPassword.length < 6) {
    toast.error('新密码长度至少6个字符');
    return;
  }
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    toast.error('两次输入的密码不一致');
    return;
  }

  passwordLoading.value = true;
  try {
    await api.put('/creator/profile', {
      currentPassword: passwordForm.value.currentPassword,
      newPassword: passwordForm.value.newPassword,
    });
    toast.success('密码修改成功');
    showPasswordModal.value = false;
    passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' };
  } catch (err: any) {
    toast.error(err.response?.data?.error || '密码修改失败');
  } finally {
    passwordLoading.value = false;
  }
};

const projectProgressMap = ref<Map<string, number>>(new Map());
const showCreateModal = ref(false);
const showTagDrawer = ref(false);
const showQuotaModal = ref(false);
const quotaModalType = ref<'project' | 'episode'>('project');
const selectedTagFilter = ref<string>('');
const selectedUserFilter = ref<string>('');
const creators = ref<any[]>([]);
const searchQuery = ref('');
const viewMode = ref<'grid' | 'list'>('grid');
const showPublishModal = ref(false);
const publishingProject = ref<any>(null);
const publishForm = ref({
  pricePerEpisode: 10,
  freeEpisodeCount: 5,
  targetAudience: 'male' as 'male' | 'female',
  tags: [] as string[],
  supportsRewrite: false,
  rewritePrice: 0,
});
const publishLoading = ref(false);
const newTagName = ref('');
const newTagColor = ref('var(--primary)');
const editingTag = ref<{ _id: string; name: string; color: string } | null>(null);
const tagSelectorProjectId = ref<string | null>(null);
const tagSelectorPosition = ref({ top: 0, left: 0 });

const presetColors = [
  'var(--primary)', 'var(--primary-hover)', '#EC4899', 'var(--error)', 
  'var(--warning)', '#10B981', '#06B6D4', 'var(--info)',
  '#84CC16', 'var(--warning)', '#14B8A6', 'var(--primary-hover)'
];

const typeOptions = [
  '甜宠', '都市', '虐恋', '古风', '悬疑', '穿越',
  '推理', '恋爱', '逆袭', '现实', '文旅', '奇幻',
  '玄幻', '重生', '系统', '末世', '仙侠', '历史',
  '科幻', '校园', '职场', '竞技', '游戏', '军事'
];

const newProject = ref({
  name: '',
  genre: '男频漫剧',
  type: '玄幻',
  customType: '',
  totalEpisodes: 60,
  writingStyle: 'colloquial' as WritingStylePreset,
  customWritingStyle: '',
  outputFormat: 'standard',
});

const useCustomType = computed(() => newProject.value.type === '__custom__');
const useCustomWritingStyle = computed(() => newProject.value.writingStyle === 'custom');
const actualType = computed(() => {
  if (useCustomType.value) {
    return newProject.value.customType.trim() || '自定义';
  }
  return newProject.value.type;
});

const resolveTagId = (t: any): string => typeof t === 'string' ? t : t._id;

const filteredProjects = computed(() => {
  let projects = projectStore.projects;

  if (selectedTagFilter.value) {
    projects = projects.filter(p =>
      p.tags?.some((t: any) => resolveTagId(t) === selectedTagFilter.value)
    );
  }

  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    projects = projects.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.type?.toLowerCase().includes(query) ||
      p.genre?.toLowerCase().includes(query)
    );
  }

  return projects;
});

const ITEMS_PER_PAGE = 20;
const displayLimit = ref(ITEMS_PER_PAGE);
const displayedProjects = computed(() => filteredProjects.value.slice(0, displayLimit.value));
const hasMoreProjects = computed(() => displayLimit.value < filteredProjects.value.length);
const remainingCount = computed(() => filteredProjects.value.length - displayLimit.value);

function loadMore() { displayLimit.value += ITEMS_PER_PAGE; }
function showAll() { displayLimit.value = filteredProjects.value.length; }

watch([selectedTagFilter, searchQuery], () => { displayLimit.value = ITEMS_PER_PAGE; });

const fetchProjectProgress = async (projectId: string) => {
  try {
    const { data } = await episodeApi.getByProject(projectId);
    if (data.success && data.data) {
      projectProgressMap.value.set(projectId, data.data.filter(ep => ep.status === 'completed').length);
    }
  } catch {
    projectProgressMap.value.set(projectId, 0);
  }
};

const fetchAllProjectsProgress = () =>
  Promise.all(projectStore.projects.map(p => fetchProjectProgress(p._id)));

const fetchCreators = async () => {
  if (authStore.user?.role !== 'admin') return;
  try {
    const response = await api.get('/creator/admin/users');
    creators.value = response.data.users || [];
  } catch (err) {
    console.error('获取创建者列表失败:', err);
  }
};

const loadProjectsWithFilter = async () => {
  try {
    if (authStore.user?.role === 'admin' && selectedUserFilter.value) {
      const response = await api.get('/projects', { params: { filterCreatorId: selectedUserFilter.value } });
      if (response.data.success) {
        projectStore.projects = response.data.data;
      }
    } else {
      await projectStore.fetchProjects();
    }
    await fetchAllProjectsProgress();
  } catch (err) {
    console.error('获取项目失败:', err);
  }
};

const onUserFilterChange = () => loadProjectsWithFilter();

onMounted(async () => {
  const savedView = localStorage.getItem('projectsViewMode');
  if (savedView === 'list' || savedView === 'grid') viewMode.value = savedView;

  document.addEventListener('click', handleClickOutside);

  await Promise.all([
    projectStore.fetchProjects(),
    tagStore.loadTags(),
    fetchCreators(),
  ]);
  await fetchAllProjectsProgress();
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});

const setViewMode = (mode: 'grid' | 'list') => {
  viewMode.value = mode;
  localStorage.setItem('projectsViewMode', mode);
};

const openProject = (id: string) => router.push(`/project/${id}/outline`);

const handleCreate = async () => {
  if (!newProject.value.name.trim()) {
    toast.warning('请输入项目名称');
    return;
  }
  if (useCustomType.value && !newProject.value.customType.trim()) {
    toast.warning('请输入自定义题材');
    return;
  }
  if (useCustomWritingStyle.value && !newProject.value.customWritingStyle.trim()) {
    toast.warning('请输入自定义写作风格描述');
    return;
  }

  try {
    const created = await projectStore.createProject({
      name: newProject.value.name,
      genre: newProject.value.genre,
      type: actualType.value,
      totalEpisodes: newProject.value.totalEpisodes,
      writingStyle: {
        preset: newProject.value.writingStyle,
        customDescription: useCustomWritingStyle.value ? newProject.value.customWritingStyle : undefined,
      },
      outputFormat: { mode: 'preset', preset: newProject.value.outputFormat },
    });

    if (created?._id) projectProgressMap.value.set(created._id, 0);

    showCreateModal.value = false;
    newProject.value = {
      name: '', genre: '男频漫剧', type: '玄幻', customType: '',
      totalEpisodes: 60, writingStyle: 'colloquial', customWritingStyle: '', outputFormat: 'standard',
    };
    toast.success('项目创建成功');
  } catch (error: any) {
    const status = error.response?.status;
    const serverError = error.response?.data?.error || '';

    if (status === 403 && (serverError.includes('配额') || serverError.includes('试用') || serverError.includes('只能创建'))) {
      showCreateModal.value = false;
      quotaModalType.value = 'project';
      showQuotaModal.value = true;
    } else {
      toast.error(serverError || '创建项目失败');
    }
  }
};

const handleDelete = async (id: string) => {
  if (await confirm.danger('确定删除此项目？删除后无法恢复。')) {
    await projectStore.deleteProject(id);
    projectProgressMap.value.delete(id);
    toast.success('项目已删除');
  }
};

const isResubmit = ref(false);
const rejectionReason = ref('');

const openPublishModal = (project: any, resubmit: boolean = false) => {
  publishingProject.value = project;
  isResubmit.value = resubmit;
  rejectionReason.value = project.publishRequest?.adminNote || '';
  publishForm.value = {
    pricePerEpisode: project.publishRequest?.pricePerEpisode || 10,
    freeEpisodeCount: project.publishRequest?.freeEpisodeCount || 5,
    targetAudience: project.publishRequest?.targetAudience || (project.genre?.includes('女') ? 'female' : 'male'),
    tags: project.publishRequest?.tags || [],
    supportsRewrite: project.publishRequest?.supportsRewrite || false,
    rewritePrice: project.publishRequest?.rewritePrice || 0,
  };
  showPublishModal.value = true;
};

const submitPublishRequest = async () => {
  if (!publishingProject.value) return;
  publishLoading.value = true;
  try {
    const response = await api.post('/creator/admin/publish-requests', {
      projectId: publishingProject.value._id,
      ...publishForm.value,
    });
    toast.success(response.data.message || '申请已提交');
    showPublishModal.value = false;
    await projectStore.fetchProjects();
  } catch (err: any) {
    toast.error(err.response?.data?.error || '提交失败');
  } finally {
    publishLoading.value = false;
  }
};

const handleCreateTag = async () => {
  if (!newTagName.value.trim()) {
    toast.warning('请输入标签名称');
    return;
  }
  try {
    await tagStore.createTag({ 
      name: newTagName.value.trim(),
      color: newTagColor.value 
    });
    newTagName.value = '';
    newTagColor.value = presetColors[Math.floor(Math.random() * presetColors.length)] ?? '#6366f1';
    toast.success('标签创建成功');
  } catch (err) {
    toast.error('创建标签失败');
  }
};

const startEditTag = (tag: { _id: string; name: string; color: string }) => {
  editingTag.value = { ...tag };
};

const saveEditTag = async () => {
  if (!editingTag.value) return;
  try {
    await tagStore.updateTag(editingTag.value._id, { name: editingTag.value.name, color: editingTag.value.color });
    editingTag.value = null;
    toast.success('标签已更新');
  } catch { toast.error('更新标签失败'); }
};

const cancelEditTag = () => { editingTag.value = null; };

const handleDeleteTag = async (tagId: string) => {
  if (await confirm.danger('确定删除此标签？')) {
    await tagStore.deleteTag(tagId);
    toast.success('标签已删除');
  }
};

const openTagSelector = (projectId: string, event: MouseEvent) => {
  event.stopPropagation();
  if (tagSelectorProjectId.value === projectId) {
    tagSelectorProjectId.value = null;
    return;
  }
  const rect = (event.target as HTMLElement).getBoundingClientRect();
  tagSelectorPosition.value = { top: rect.bottom + 8, left: Math.min(rect.left, window.innerWidth - 280) };
  tagSelectorProjectId.value = projectId;
};

const closeTagSelector = () => { tagSelectorProjectId.value = null; };

const toggleProjectTag = async (projectId: string, tagId: string) => {
  const project = projectStore.projects.find(p => p._id === projectId);
  if (!project) return;

  const currentTagIds = (project.tags || []).map(resolveTagId);
  const newTags = currentTagIds.includes(tagId)
    ? currentTagIds.filter(t => t !== tagId)
    : [...currentTagIds, tagId];

  try {
    await projectStore.updateProject(projectId, { tags: newTags });
    await projectStore.fetchProjects();
  } catch { toast.error('更新标签失败'); }
};

const projectHasTag = (project: { tags?: any[] }, tagId: string) =>
  project.tags?.some((t: any) => resolveTagId(t) === tagId) ?? false;

const getProjectTags = (tags: any[] | undefined) => {
  if (!tags) return [];
  if (tags.length > 0 && typeof tags[0] === 'object') return tags;
  return tagStore.getTagsByIds(tags);
};

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿', outline_done: '大纲完成', generating: '生成中', completed: '已完成',
};
const getStatusLabel = (status: string) => STATUS_LABELS[status] || status;

const getProjectProgress = (project: { _id: string; totalEpisodes: number }) => ({
  completed: projectProgressMap.value.get(project._id) || 0,
  total: project.totalEpisodes,
});

const formatTime = (dateStr: Date | string | undefined) => {
  if (!dateStr) return '';
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  const hours = Math.floor((Date.now() - date.getTime()) / 3600000);
  const days = Math.floor(hours / 24);
  if (hours < 1) return '刚刚';
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return date.toLocaleDateString('zh-CN');
};

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.tag-selector-popup') && !target.closest('.tag-trigger-btn')) {
    closeTagSelector();
  }
};
</script>

<template>
  <div class="projects-page">
    <header class="page-toolbar">
      <div class="toolbar-left">
        <h1 class="page-title">🏠 项目管理</h1>
        <div class="user-quota-status" v-if="authStore.user">
          <span class="tier-badge" :class="authStore.user.tier">
            {{ authStore.user.tier === 'trial' ? '试用版' : '专业版' }}
          </span>
          <span class="quota-info">
            项目: {{ authStore.user.projectsUsed || 0 }} / {{ authStore.user.projectQuota }}
          </span>
          <span class="quota-info" v-if="authStore.user.tier === 'trial'">
            集数: {{ authStore.user.trialEpisodesUsed || 0 }} / 10
          </span>
          <div class="quota-help">
            <span class="help-icon">❓</span>
            <div class="help-tooltip">
              <div class="tooltip-title">配额说明</div>
              <ul class="tooltip-list">
                <li><strong>项目配额</strong>：可创建的项目数量上限</li>
                <li><strong>集数配额</strong>：试用版可生成10集内容</li>
                <li><strong>删除规则</strong>：生成少于10集的项目删除后可返还配额，超过10集不返还</li>
                <li><strong>升级专业版</strong>：解锁无限项目和集数</li>
              </ul>
              <div class="tooltip-contact">
                联系管理员购买：微信 <strong>agimeme</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="toolbar-center">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="搜索项目..." 
            class="search-input"
          />
        </div>
        <div class="filter-dropdown">
          <select v-model="selectedTagFilter" class="filter-select">
            <option value="">全部标签</option>
            <option 
              v-for="tag in tagStore.sortedTags" 
              :key="tag._id" 
              :value="tag._id"
            >
              {{ tag.name }}
            </option>
          </select>
        </div>
        <div v-if="authStore.user?.role === 'admin'" class="filter-dropdown">
          <select v-model="selectedUserFilter" class="filter-select user-filter" @change="onUserFilterChange">
            <option value="">全部用户</option>
            <option 
              v-for="creator in creators" 
              :key="creator._id" 
              :value="creator._id"
            >
              {{ creator.username }} ({{ creator.tier === 'trial' ? '试用' : '付费' }})
            </option>
          </select>
        </div>
      </div>
      <div class="toolbar-right">
        <div class="view-toggle">
          <button 
            class="view-btn" 
            :class="{ active: viewMode === 'grid' }"
            @click="setViewMode('grid')"
            title="网格视图"
          >▦</button>
          <button 
            class="view-btn" 
            :class="{ active: viewMode === 'list' }"
            @click="setViewMode('list')"
            title="列表视图"
          >☰</button>
        </div>
        <ThemeToggle />
        <button 
          v-if="authStore.user?.role === 'admin'" 
          class="btn-icon-text admin-btn"
          @click="router.push('/creator-admin')"
        >
          <span>⚙️</span>
          <span>用户管理</span>
        </button>
        <button class="btn-icon-text" @click="showTagDrawer = true">
          <span>🏷️</span>
          <span>标签管理</span>
        </button>
        <button class="btn-primary" @click="showCreateModal = true">
          <span>+</span> 新建项目
        </button>
        <button class="btn-icon-text password-btn" @click="showPasswordModal = true" title="修改密码">
          <span>🔑</span>
          <span>改密</span>
        </button>
        <button class="btn-logout" @click="handleLogout" title="退出登录">
          🚪 退出
        </button>
      </div>
    </header>

    <div v-if="projectStore.loading" class="loading">加载中...</div>

    <div v-else class="projects-container" :class="viewMode">
      <div
        v-for="project in displayedProjects"
        :key="project._id"
        class="project-card"
        @click="openProject(project._id)"
      >
        <div class="card-header">
          <div class="card-icon">📁</div>
          <button class="delete-btn" @click.stop="handleDelete(project._id)" title="删除">✕</button>
        </div>
        
        <h3 class="card-title">{{ project.name }}</h3>
        <p class="card-meta">{{ project.genre }} · {{ project.type }}</p>
        
        <div v-if="authStore.user?.role === 'admin' && project.creatorId" class="creator-info">
          <span class="creator-avatar">{{ (project.creatorId as any).username?.charAt(0)?.toUpperCase() || '?' }}</span>
          <span class="creator-name">{{ (project.creatorId as any).username || '未知' }}</span>
          <span class="creator-tier" :class="(project.creatorId as any).tier">
            {{ (project.creatorId as any).tier === 'trial' ? '试用' : '付费' }}
          </span>
        </div>
        
        <div class="progress-section">
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: `${(getProjectProgress(project).completed / (getProjectProgress(project).total || 1)) * 100}%` }"
            ></div>
          </div>
          <span class="progress-text">
            {{ getProjectProgress(project).completed }}/{{ getProjectProgress(project).total }}集
          </span>
        </div>

        <div class="card-tags-section">
          <div class="tags-display" v-if="project.tags && project.tags.length > 0">
            <span
              v-for="tag in getProjectTags(project.tags).slice(0, 3)"
              :key="tag._id"
              class="tag-chip"
              :style="{ background: tag.color }"
            >{{ tag.name }}</span>
            <span v-if="project.tags.length > 3" class="tag-more">+{{ project.tags.length - 3 }}</span>
          </div>
          <button 
            class="tag-trigger-btn"
            @click="openTagSelector(project._id, $event)"
            title="管理标签"
          >
            <span v-if="!project.tags || project.tags.length === 0">+ 添加标签</span>
            <span v-else>编辑</span>
          </button>
        </div>

        <div class="card-footer">
          <span class="status-badge" :class="project.status">{{ getStatusLabel(project.status) }}</span>

          <span 
            v-if="project.publishStatus === 'published'" 
            class="publish-status-badge published"
            title="已上架到买家平台"
          >
            ✅ 已上架
          </span>
          <span 
            v-else-if="project.publishStatus === 'pending'" 
            class="publish-status-badge pending"
            title="等待管理员审核"
          >
            ⏳ 审核中
          </span>
          <button 
            v-else-if="project.publishStatus === 'rejected'" 
            class="publish-status-badge rejected clickable"
            @click.stop="openPublishModal(project, true)"
            :title="'拒绝原因：' + (project.publishRequest?.adminNote || '未说明原因') + '（点击重新申请）'"
          >
            ❌ 被拒绝 <span class="resubmit-hint">重新申请</span>
          </button>
          <button 
            v-else
            class="publish-btn"
            @click.stop="openPublishModal(project)"
            title="申请上架到买家平台"
          >
            🚀 上架
          </button>
          
          <span class="update-time">{{ formatTime(project.updatedAt) }}</span>
        </div>
      </div>

      <div class="project-card add-card" @click="showCreateModal = true">
        <div class="add-icon">+</div>
        <span class="add-text">新建项目</span>
        <p class="add-hint">开始创作你的剧本</p>
      </div>
    </div>

    <div v-if="hasMoreProjects" class="load-more-section">
      <div class="load-more-info">
        显示 {{ displayedProjects.length }} / {{ filteredProjects.length }} 个项目
      </div>
      <div class="load-more-actions">
        <button class="btn-load-more" @click="loadMore">
          加载更多 (+{{ Math.min(20, remainingCount) }})
        </button>
        <button class="btn-show-all" @click="showAll">
          显示全部
        </button>
      </div>
    </div>

    <div v-if="filteredProjects.length === 0 && !projectStore.loading" class="empty-state">
      <div class="empty-icon">📂</div>
      <h3 class="empty-title">
        {{ selectedTagFilter || searchQuery ? '没有找到匹配的项目' : '还没有项目' }}
      </h3>
      <p class="empty-desc">
        {{ selectedTagFilter || searchQuery ? '尝试调整筛选条件' : '点击上方按钮创建你的第一个项目' }}
      </p>
    </div>

    <Teleport to="body">
      <div 
        v-if="tagSelectorProjectId"
        class="tag-selector-popup"
        :style="{ top: tagSelectorPosition.top + 'px', left: tagSelectorPosition.left + 'px' }"
        @click.stop
      >
        <div class="selector-header">
          <span>选择标签</span>
          <button class="close-btn" @click="closeTagSelector">✕</button>
        </div>
        <div class="selector-body">
          <div v-if="tagStore.tags.length === 0" class="no-tags">
            <p>还没有标签</p>
            <button class="btn-link" @click="showTagDrawer = true; closeTagSelector()">
              去创建标签
            </button>
          </div>
          <div v-else class="tag-options">
            <label 
              v-for="tag in tagStore.sortedTags" 
              :key="tag._id"
              class="tag-option-item"
              :class="{ selected: projectHasTag(projectStore.projects.find(p => p._id === tagSelectorProjectId) || {}, tag._id) }"
            >
              <input 
                type="checkbox"
                :checked="projectHasTag(projectStore.projects.find(p => p._id === tagSelectorProjectId) || {}, tag._id)"
                @change="toggleProjectTag(tagSelectorProjectId!, tag._id)"
              />
              <span class="tag-color-dot" :style="{ background: tag.color }"></span>
              <span class="tag-label">{{ tag.name }}</span>
              <span class="check-icon">✓</span>
            </label>
          </div>
        </div>
        <div class="selector-footer">
          <button class="btn-text" @click="showTagDrawer = true; closeTagSelector()">
            管理标签
          </button>
        </div>
      </div>
    </Teleport>

    <Drawer
      :visible="showTagDrawer"
      title="标签管理"
      width="400px"
      @close="showTagDrawer = false"
    >
      <div class="tag-drawer-content">
        <div class="create-tag-section">
          <h4>创建新标签</h4>
          <div class="create-tag-form">
            <input 
              v-model="newTagName"
              type="text"
              placeholder="标签名称"
              class="tag-name-input"
              @keyup.enter="handleCreateTag"
            />
            <div class="color-picker">
              <div 
                class="color-preview"
                :style="{ background: newTagColor }"
              ></div>
              <div class="color-options">
                <button
                  v-for="color in presetColors"
                  :key="color"
                  class="color-option"
                  :class="{ active: newTagColor === color }"
                  :style="{ background: color }"
                  @click="newTagColor = color"
                ></button>
              </div>
            </div>
            <button class="btn-create" @click="handleCreateTag">创建</button>
          </div>
        </div>

        <div class="tags-list-section">
          <h4>已有标签 ({{ tagStore.tags.length }})</h4>
          <div v-if="tagStore.tags.length === 0" class="empty-tags">
            <p>还没有创建任何标签</p>
          </div>
          <div v-else class="tags-list">
            <div 
              v-for="tag in tagStore.sortedTags" 
              :key="tag._id"
              class="tag-list-item"
            >
              <template v-if="editingTag && editingTag._id === tag._id">
                <input 
                  v-model="editingTag.name"
                  class="edit-name-input"
                  @keyup.enter="saveEditTag"
                />
                <div class="edit-colors">
                  <button
                    v-for="color in presetColors"
                    :key="color"
                    class="color-option small"
                    :class="{ active: editingTag.color === color }"
                    :style="{ background: color }"
                    @click="editingTag.color = color"
                  ></button>
                </div>
                <div class="edit-actions">
                  <button class="btn-save" @click="saveEditTag">保存</button>
                  <button class="btn-cancel" @click="cancelEditTag">取消</button>
                </div>
              </template>
              <template v-else>
                <span class="tag-color-indicator" :style="{ background: tag.color }"></span>
                <span class="tag-name-text">{{ tag.name }}</span>
                <div class="tag-actions">
                  <button class="action-btn" @click="startEditTag(tag)" title="编辑">✏️</button>
                  <button class="action-btn danger" @click="handleDeleteTag(tag._id)" title="删除">🗑️</button>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </Drawer>

    <Modal :show="showCreateModal" title="新建项目" @close="showCreateModal = false">
      <form @submit.prevent="handleCreate">
        <div class="form-group">
          <label>项目名称</label>
          <input v-model="newProject.name" placeholder="请输入项目名称" required />
        </div>
        <div class="form-group">
          <label>类型</label>
          <select v-model="newProject.genre">
            <option>男频漫剧</option>
            <option>女频漫剧</option>
          </select>
        </div>
        <div class="form-group">
          <label>题材</label>
          <select v-model="newProject.type">
            <option v-for="opt in typeOptions" :key="opt" :value="opt">{{ opt }}</option>
            <option value="__custom__">其他（自定义）</option>
          </select>
        </div>
        <div v-if="useCustomType" class="form-group">
          <label>自定义题材</label>
          <input v-model="newProject.customType" placeholder="请输入自定义题材" required />
        </div>
        <div class="form-group">
          <label>总集数</label>
          <input v-model.number="newProject.totalEpisodes" type="number" min="1" max="200" />
        </div>
        <div class="form-group">
          <label>写作风格 <span class="label-hint">（将强制应用于所有剧本生成）</span></label>
          <div class="style-selector">
            <div 
              v-for="(info, key) in WRITING_STYLE_PRESETS" 
              :key="key"
              class="style-option"
              :class="{ selected: newProject.writingStyle === key }"
              @click="newProject.writingStyle = key as WritingStylePreset"
            >
              <div class="style-name">{{ info.name }}</div>
              <div class="style-desc">{{ info.description }}</div>
              <div v-if="info.example && key !== 'custom'" class="style-example">
                "{{ info.example.slice(0, 30) }}..."
              </div>
            </div>
          </div>
        </div>
        <div v-if="useCustomWritingStyle" class="form-group">
          <label>自定义风格描述</label>
          <textarea 
            v-model="newProject.customWritingStyle" 
            placeholder="请详细描述您想要的写作风格，例如：对白简洁有力，画面描写注重动作感，情感表达含蓄内敛..."
            rows="3"
          ></textarea>
        </div>
        <button type="submit" class="btn-primary btn-full">创建项目</button>
      </form>
    </Modal>

    <QuotaExceededModal
      :visible="showQuotaModal"
      :type="quotaModalType"
      @close="showQuotaModal = false"
      @viewDocs="router.push('/docs')"
    />

    <Modal :show="showPublishModal" :title="isResubmit ? '重新申请上架' : '申请上架到买家平台'" width="520px" @close="showPublishModal = false">
      <div class="publish-form" v-if="publishingProject">
        <div class="publish-project-info">
          <span class="project-name">📁 {{ publishingProject.name }}</span>
          <span class="project-meta">{{ publishingProject.genre }} · {{ getProjectProgress(publishingProject).completed }}集</span>
        </div>

        <div v-if="isResubmit && rejectionReason" class="rejection-reason-box">
          <div class="rejection-header">
            <span class="rejection-icon">⚠️</span>
            <span class="rejection-title">上次申请被拒绝</span>
          </div>
          <div class="rejection-content">{{ rejectionReason }}</div>
          <div class="rejection-hint">请根据上述原因修改后重新提交</div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>每集价格（积分）</label>
            <input type="number" v-model.number="publishForm.pricePerEpisode" min="0" max="1000" />
          </div>
          <div class="form-group">
            <label>免费集数</label>
            <input type="number" v-model.number="publishForm.freeEpisodeCount" min="0" max="50" />
          </div>
        </div>

        <div class="form-group">
          <label>目标受众</label>
          <select v-model="publishForm.targetAudience" class="styled-select">
            <option value="male">男频</option>
            <option value="female">女频</option>
          </select>
        </div>

        <div class="rewrite-toggle-section">
          <div class="toggle-header">
            <div class="toggle-info">
              <span class="toggle-title">支持改写服务</span>
              <span class="toggle-desc">买家可付费申请改写部分内容，具体需求和价格协商确定</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="publishForm.supportsRewrite" />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div class="form-group" v-if="publishForm.supportsRewrite">
          <label>改写起步价格（积分）</label>
          <input type="number" v-model.number="publishForm.rewritePrice" min="0" placeholder="买家申请改写时的起步价格" />
        </div>

        <div class="publish-actions">
          <button class="btn-cancel" @click="showPublishModal = false">取消</button>
          <button class="btn-submit" @click="submitPublishRequest" :disabled="publishLoading">
            {{ publishLoading ? '提交中...' : '提交申请' }}
          </button>
        </div>
      </div>
    </Modal>

    <Modal :show="showPasswordModal" title="修改密码" width="400px" @close="showPasswordModal = false">
      <div class="password-form">
        <div class="form-group">
          <label>当前密码</label>
          <input 
            type="password" 
            v-model="passwordForm.currentPassword" 
            placeholder="请输入当前密码"
            autocomplete="current-password"
          />
        </div>
        <div class="form-group">
          <label>新密码</label>
          <input 
            type="password" 
            v-model="passwordForm.newPassword" 
            placeholder="请输入新密码（至少6个字符）"
            autocomplete="new-password"
          />
        </div>
        <div class="form-group">
          <label>确认新密码</label>
          <input 
            type="password" 
            v-model="passwordForm.confirmPassword" 
            placeholder="请再次输入新密码"
            autocomplete="new-password"
          />
        </div>
        <div class="password-actions">
          <button class="btn-cancel" @click="showPasswordModal = false">取消</button>
          <button 
            class="btn-submit" 
            @click="handleChangePassword" 
            :disabled="passwordLoading"
          >
            {{ passwordLoading ? '修改中...' : '确认修改' }}
          </button>
        </div>
      </div>
    </Modal>
  </div>
</template>
<style scoped>
.projects-page {
  min-height: 100vh;
  padding: var(--space-5);
  background: var(--bg-base);
}

.page-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) 0;
  margin-bottom: var(--space-5);
  border-bottom: 1px solid var(--border-default);
}

.toolbar-left { display: flex; align-items: center; gap: var(--space-4); }

.page-title {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.user-quota-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 20px;
}

.user-quota-status .tier-badge {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

.user-quota-status .tier-badge.trial {
  background: linear-gradient(135deg, rgba(234, 179, 8, 0.2) 0%, rgba(234, 179, 8, 0.1) 100%);
  color: #eab308;
}

.user-quota-status .tier-badge.paid {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(34, 197, 94, 0.1) 100%);
  color: #22c55e;
}

.quota-info {
  font-size: 12px;
  color: var(--text-secondary);
  padding-left: 12px;
  border-left: 1px solid var(--border-default);
}

.quota-help {
  position: relative;
  margin-left: 8px;
  cursor: pointer;
}

.help-icon {
  font-size: 14px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.quota-help:hover .help-icon {
  opacity: 1;
}

.help-tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 12px;
  width: 320px;
  padding: 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s;
  z-index: 100;
}

.quota-help:hover .help-tooltip {
  opacity: 1;
  visibility: visible;
}

.help-tooltip::before {
  content: '';
  position: absolute;
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 6px solid var(--border-default);
}

.tooltip-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-default);
}

.tooltip-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.tooltip-list li {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 8px;
  padding-left: 16px;
  position: relative;
}

.tooltip-list li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: var(--primary);
}

.tooltip-list li strong {
  color: var(--text-primary);
}

.tooltip-contact {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-default);
  font-size: 12px;
  color: var(--text-secondary);
}

.tooltip-contact strong {
  color: #22c55e;
}

.toolbar-center {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex: 1;
  max-width: 500px;
}

.search-box {
  flex: 1;
  display: flex;
  align-items: center;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: 0 var(--space-3);
}

.search-box:focus-within { border-color: var(--border-focus); }
.search-icon { font-size: 14px; margin-right: var(--space-2); }

.search-input {
  flex: 1;
  height: 36px;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.search-input:focus { outline: none; }
.search-input::placeholder { color: var(--text-muted); }

.filter-select {
  height: 36px;
  padding: 0 var(--space-3);
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  min-width: 120px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.view-toggle {
  display: flex;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.view-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 16px;
}

.view-btn:hover { background: var(--bg-hover); }
.view-btn.active { background: var(--primary); color: var(--text-on-primary); }

.btn-icon-text {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: 36px;
  padding: 0 var(--space-3);
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
}

.btn-icon-text:hover { background: var(--bg-hover); }

.btn-primary {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: 36px;
  padding: 0 var(--space-4);
  background: var(--primary);
  color: var(--text-on-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
}

.btn-primary:hover { background: var(--primary-hover); }
.btn-full { width: 100%; justify-content: center; }

.btn-logout {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: 36px;
  padding: 0 var(--space-3);
  background: transparent;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-logout:hover {
  background: var(--error-muted);
  border-color: var(--error);
  color: var(--error);
}

.password-btn {
  background: transparent;
  border: 1px solid var(--border-default);
  color: var(--text-secondary);
}

.password-btn:hover {
  background: var(--primary-muted);
  border-color: var(--primary);
  color: var(--primary);
}

.password-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.password-form .form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.password-form label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.password-form input {
  width: 100%;
  padding: 12px 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
  transition: all 0.2s;
}

.password-form input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
}

.password-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}

.password-actions button {
  flex: 1;
  padding: 12px 24px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
}

.password-actions .btn-cancel {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #999;
}

.password-actions .btn-cancel:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.25);
  color: #fff;
}

.password-actions .btn-submit {
  background: linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%);
  border: none;
  color: #fff;
}

.password-actions .btn-submit:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.password-actions .btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.projects-container {
  display: grid;
  gap: var(--space-4);
}

.projects-container.grid {
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
}

.projects-container.list {
  grid-template-columns: 1fr;
}

.project-card {
  position: relative;
  padding: var(--space-5);
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.project-card:hover {
  border-color: var(--border-hover);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.card-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.card-icon { font-size: 32px; }

.delete-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  cursor: pointer;
  opacity: 0;
  font-size: 12px;
}

.project-card:hover .delete-btn { opacity: 1; }
.delete-btn:hover { background: var(--error); border-color: var(--error); color: var(--text-on-primary); }

.card-title {
  margin: 0 0 var(--space-2);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.card-meta {
  margin: 0 0 var(--space-3);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.creator-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: var(--space-3);
  padding: 8px 12px;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%);
  border: 1px solid rgba(139, 92, 246, 0.15);
  border-radius: 8px;
}

.creator-avatar {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  border-radius: 6px;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.creator-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.creator-tier {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}

.creator-tier.trial {
  background: rgba(234, 179, 8, 0.2);
  color: #eab308;
}

.creator-tier.paid {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.user-filter {
  min-width: 140px;
}

.progress-section {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: var(--bg-elevated);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--success);
  border-radius: 3px;
}

.progress-text {
  font-size: 12px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.card-tags-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  min-height: 28px;
}

.tags-display {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  flex: 1;
}

.tag-chip {
  padding: 2px 10px;
  border-radius: 9999px;
  font-size: 12px;
  color: var(--text-on-primary);
}

.tag-more {
  padding: 2px 8px;
  background: var(--bg-elevated);
  border-radius: 9999px;
  font-size: 11px;
  color: var(--text-tertiary);
}

.tag-trigger-btn {
  padding: var(--space-1) var(--space-2);
  background: transparent;
  border: 1px dashed var(--border-default);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.tag-trigger-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-muted);
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-badge {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: var(--font-medium);
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.status-badge.completed { background: var(--success-muted); color: var(--success); }
.status-badge.generating { background: var(--warning-muted); color: var(--warning); }
.status-badge.outline_done { background: var(--primary-muted); color: var(--primary); }

.update-time { font-size: 12px; color: var(--text-muted); }

.add-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  border-style: dashed;
  background: transparent;
}

.add-card:hover {
  border-color: var(--primary);
  background: var(--primary-muted);
}

.add-icon { font-size: 48px; color: var(--text-muted); margin-bottom: var(--space-2); }
.add-text { font-size: var(--text-base); font-weight: var(--font-medium); color: var(--text-secondary); }
.add-hint { margin: var(--space-1) 0 0; font-size: var(--text-sm); color: var(--text-muted); }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-10);
  text-align: center;
}

.empty-icon { font-size: 64px; margin-bottom: var(--space-4); }
.empty-title { margin: 0 0 var(--space-2); font-size: var(--text-xl); color: var(--text-primary); }
.empty-desc { margin: 0; font-size: var(--text-base); color: var(--text-secondary); }

.loading { text-align: center; padding: var(--space-10); color: var(--text-secondary); }

.tag-selector-popup {
  position: fixed;
  z-index: 1000;
  width: 260px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-default);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.close-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.close-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

.selector-body {
  padding: var(--space-2);
  max-height: 240px;
  overflow-y: auto;
}

.no-tags {
  padding: var(--space-4);
  text-align: center;
  color: var(--text-tertiary);
}

.no-tags p { margin: 0 0 var(--space-2); font-size: var(--text-sm); }

.btn-link {
  background: none;
  border: none;
  color: var(--primary);
  font-size: var(--text-sm);
  cursor: pointer;
}

.btn-link:hover { text-decoration: underline; }

.tag-options {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tag-option-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.tag-option-item:hover { background: var(--bg-hover); }

.tag-option-item input { display: none; }

.tag-color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tag-label {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.check-icon {
  opacity: 0;
  color: var(--primary);
  font-size: 14px;
}

.tag-option-item.selected { background: var(--primary-muted); }
.tag-option-item.selected .check-icon { opacity: 1; }

.selector-footer {
  padding: var(--space-2) var(--space-3);
  border-top: 1px solid var(--border-default);
}

.btn-text {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.btn-text:hover { color: var(--primary); }

.tag-drawer-content {
  padding: var(--space-4);
}

.create-tag-section {
  margin-bottom: var(--space-6);
}

.create-tag-section h4,
.tags-list-section h4 {
  margin: 0 0 var(--space-3);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.create-tag-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.tag-name-input {
  height: 40px;
  padding: 0 var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.tag-name-input:focus { outline: none; border-color: var(--border-focus); }

.color-picker {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.color-preview {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

.color-options {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.color-option {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.color-option:hover { transform: scale(1.1); }
.color-option.active { border-color: var(--text-on-primary); box-shadow: 0 0 0 2px var(--primary); }
.color-option.small { width: 20px; height: 20px; }

.btn-create {
  height: 40px;
  background: var(--primary);
  color: var(--text-on-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
}

.btn-create:hover { background: var(--primary-hover); }

.empty-tags {
  padding: var(--space-6);
  text-align: center;
  color: var(--text-tertiary);
}

.empty-tags p { margin: 0; font-size: var(--text-sm); }

.tags-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.tag-list-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  flex-wrap: wrap;
}

.tag-color-indicator {
  width: 16px;
  height: 16px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.tag-name-text {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.tag-actions {
  display: flex;
  gap: var(--space-1);
}

.action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 14px;
}

.action-btn:hover { background: var(--bg-hover); }
.action-btn.danger:hover { background: var(--error-muted); }

.edit-name-input {
  flex: 1;
  height: 32px;
  padding: 0 var(--space-2);
  background: var(--bg-surface);
  border: 1px solid var(--border-focus);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.edit-colors {
  display: flex;
  gap: 4px;
  width: 100%;
  margin-top: var(--space-2);
}

.edit-actions {
  display: flex;
  gap: var(--space-2);
  width: 100%;
  margin-top: var(--space-2);
}

.btn-save, .btn-cancel {
  flex: 1;
  height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 12px;
  cursor: pointer;
}

.btn-save { background: var(--primary); color: var(--text-on-primary); }
.btn-save:hover { background: var(--primary-hover); }
.btn-cancel { background: var(--bg-surface); color: var(--text-secondary); border: 1px solid var(--border-default); }
.btn-cancel:hover { background: var(--bg-hover); }

.form-group { margin-bottom: var(--space-4); }

.form-group label {
  display: block;
  margin-bottom: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.form-group input,
.form-group select {
  width: 100%;
  height: 40px;
  padding: 0 var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus {
  border-color: var(--border-focus);
  outline: none;
}

.form-group textarea {
  width: 100%;
  padding: var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
  box-sizing: border-box;
  resize: vertical;
  font-family: inherit;
}

.form-group textarea:focus {
  border-color: var(--border-focus);
  outline: none;
}

.label-hint {
  font-weight: normal;
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.style-selector {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  max-height: 280px;
  overflow-y: auto;
}

.style-option {
  padding: var(--space-3);
  background: var(--bg-elevated);
  border: 2px solid var(--border-default);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.style-option:hover {
  border-color: var(--border-hover);
  background: var(--bg-hover);
}

.style-option.selected {
  border-color: var(--primary);
  background: var(--primary-muted);
}

.style-name {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-1);
}

.style-desc {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.style-example {
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--border-default);
  font-size: 10px;
  color: var(--text-tertiary);
  font-style: italic;
  line-height: 1.3;
}
.publish-form {
  padding: 0;
}

.publish-project-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 12px;
  margin-bottom: 24px;
}

.publish-project-info .project-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.publish-project-info .project-meta {
  font-size: 13px;
  color: var(--text-secondary);
}

.publish-form .form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.publish-form .form-group {
  margin-bottom: 20px;
}

.publish-form .form-group label {
  display: block;
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.publish-form .form-group input[type="number"],
.publish-form .form-group select {
  width: 100%;
  padding: 12px 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 15px;
  transition: all 0.2s;
}

.publish-form .form-group input:focus,
.publish-form .form-group select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}

.publish-form .checkbox-label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 14px 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  transition: all 0.2s;
  font-size: 0; /* 防止空白字符 */
}

.publish-form .checkbox-label:hover {
  border-color: var(--primary);
  background: rgba(139, 92, 246, 0.05);
}

.publish-form .checkbox-label input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 20px;
  height: 20px;
  min-width: 20px;
  background: var(--bg-surface);
  border: 2px solid #666;
  border-radius: 5px;
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
  margin: 0;
}

.publish-form .checkbox-label input[type="checkbox"]:checked {
  background: #8b5cf6;
  border-color: #8b5cf6;
}

.publish-form .checkbox-label input[type="checkbox"]:checked::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 6px;
  width: 5px;
  height: 10px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.publish-form .checkbox-label span {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.publish-actions {
  display: flex;
  gap: 12px;
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid var(--border-default);
}

.publish-actions .btn-cancel,
.publish-actions .btn-submit {
  flex: 1;
  padding: 14px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.publish-actions .btn-cancel {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  color: var(--text-secondary);
}

.publish-actions .btn-cancel:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.publish-actions .btn-submit {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  border: none;
  color: #fff;
}

.publish-actions .btn-submit:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
}

.publish-actions .btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.rejection-reason-box {
  margin-bottom: 20px;
  padding: 16px;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(234, 179, 8, 0.1) 100%);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 12px;
  border-left: 4px solid #ef4444;
}

.rejection-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.rejection-icon {
  font-size: 18px;
}

.rejection-title {
  font-size: 14px;
  font-weight: 600;
  color: #ef4444;
}

.rejection-content {
  font-size: 13px;
  color: var(--text-primary);
  padding: 10px 12px;
  background: var(--bg-base);
  border-radius: 8px;
  margin-bottom: 8px;
  line-height: 1.5;
}

.rejection-hint {
  font-size: 12px;
  color: var(--text-secondary);
  font-style: italic;
}

.publish-btn {
  padding: 4px 10px;
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.1) 100%);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 6px;
  color: #22c55e;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.publish-btn:hover {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: #fff;
  border-color: transparent;
}

.publish-status-badge {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: default;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.publish-status-badge.clickable {
  cursor: pointer;
  transition: all 0.2s;
}

.publish-status-badge.clickable:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
}

.resubmit-hint {
  font-size: 10px;
  opacity: 0.7;
  margin-left: 2px;
}

.publish-status-badge.published {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.1) 100%);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #22c55e;
}

.publish-status-badge.pending {
  background: linear-gradient(135deg, rgba(234, 179, 8, 0.15) 0%, rgba(234, 179, 8, 0.1) 100%);
  border: 1px solid rgba(234, 179, 8, 0.3);
  color: #eab308;
}

.publish-status-badge.rejected {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.1) 100%);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
  cursor: pointer;
}

.publish-form .styled-select {
  width: 100%;
  padding: 14px 40px 14px 14px;
  min-height: 48px;
  line-height: 1.4;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  color: #1a1a1a;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23333' d='M2 4l4 4 4-4'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 14px center;
}

:root[data-theme="dark"] .publish-form .styled-select {
  color: #f5f5f5;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ccc' d='M2 4l4 4 4-4'/%3E%3C/svg%3E");
}

.publish-form .styled-select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
}

.publish-form .styled-select option {
  background: #fff;
  color: #1a1a1a;
  padding: 10px;
}

:root[data-theme="dark"] .publish-form .styled-select option {
  background: #2a2a2a;
  color: #f5f5f5;
}

.rewrite-toggle-section {
  margin-bottom: 20px;
  padding: 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: 12px;
}

.toggle-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.toggle-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.toggle-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.toggle-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 26px;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #555;
  border-radius: 26px;
  transition: all 0.3s;
}

.toggle-slider::before {
  position: absolute;
  content: '';
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background: #fff;
  border-radius: 50%;
  transition: all 0.3s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-switch input:checked + .toggle-slider {
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(22px);
}

.publish-form input[type="number"]::placeholder {
  color: var(--text-tertiary);
  font-size: 13px;
}

.load-more-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  gap: 12px;
}

.load-more-info {
  color: var(--text-secondary);
  font-size: 14px;
}

.load-more-actions {
  display: flex;
  gap: 12px;
}

.btn-load-more {
  padding: 10px 24px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-load-more:hover {
  background: var(--primary-hover);
  transform: translateY(-1px);
}

.btn-show-all {
  padding: 10px 24px;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-show-all:hover {
  border-color: var(--primary);
  color: var(--primary);
}
</style>
