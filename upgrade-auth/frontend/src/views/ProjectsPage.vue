<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useProjectStore } from '@/stores/projectStore';
import { useTagStore } from '@/stores/tagStore';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/composables/useToast';
import { useConfirm } from '@/composables/useConfirm';
import { episodeApi } from '@/services/api';
import Modal from '@/components/common/Modal.vue';
import Drawer from '@/components/common/Drawer.vue';
import type { WritingStylePreset } from '@/types';
import { WRITING_STYLE_PRESETS } from '@/types';

const router = useRouter();
const projectStore = useProjectStore();
const tagStore = useTagStore();
const authStore = useAuthStore();
const toast = useToast();
const confirm = useConfirm();

// 登出
const handleLogout = () => {
  authStore.logout();
  router.push('/login');
};

// 项目进度数据（真实的已完成集数）
const projectProgressMap = ref<Map<string, number>>(new Map());

// 页面状态
const showCreateModal = ref(false);
const showTagDrawer = ref(false);
const selectedTagFilter = ref<string>('');
const searchQuery = ref('');
const viewMode = ref<'grid' | 'list'>('grid');

// 标签管理状态
const newTagName = ref('');
const newTagColor = ref('#6366F1');
const editingTag = ref<{ _id: string; name: string; color: string } | null>(null);

// 项目标签选择状态
const tagSelectorProjectId = ref<string | null>(null);
const tagSelectorPosition = ref({ top: 0, left: 0 });

// 预设颜色
const presetColors = [
  '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', 
  '#F59E0B', '#10B981', '#06B6D4', '#3B82F6',
  '#84CC16', '#F97316', '#14B8A6', '#A855F7'
];

// 题材选项列表
const typeOptions = [
  '甜宠', '都市', '虐恋', '古风', '悬疑', '穿越',
  '推理', '恋爱', '逆袭', '现实', '文旅', '奇幻',
  '玄幻', '重生', '系统', '末世', '仙侠', '历史',
  '科幻', '校园', '职场', '竞技', '游戏', '军事'
];

// 新建项目表单
const newProject = ref({
  name: '',
  genre: '男频漫剧',
  type: '玄幻',
  customType: '',
  totalEpisodes: 60,
  writingStyle: 'colloquial' as WritingStylePreset,
  customWritingStyle: '',
});

const useCustomType = computed(() => newProject.value.type === '__custom__');
const useCustomWritingStyle = computed(() => newProject.value.writingStyle === 'custom');
const actualType = computed(() => {
  if (useCustomType.value) {
    return newProject.value.customType.trim() || '自定义';
  }
  return newProject.value.type;
});

// 筛选后的项目列表
const filteredProjects = computed(() => {
  let projects = projectStore.projects;
  
  if (selectedTagFilter.value) {
    projects = projects.filter(p => p.tags?.includes(selectedTagFilter.value));
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

// 获取项目的真实进度数据
const fetchProjectProgress = async (projectId: string) => {
  try {
    const { data } = await episodeApi.getByProject(projectId);
    if (data.success && data.data) {
      const completedCount = data.data.filter(ep => ep.status === 'completed').length;
      projectProgressMap.value.set(projectId, completedCount);
    }
  } catch (err) {
    // 静默失败，使用默认值0
    projectProgressMap.value.set(projectId, 0);
  }
};

// 批量获取所有项目的进度
const fetchAllProjectsProgress = async () => {
  const projects = projectStore.projects;
  await Promise.all(projects.map(p => fetchProjectProgress(p._id)));
};

// 从 localStorage 恢复视图偏好
onMounted(async () => {
  const savedView = localStorage.getItem('projectsViewMode');
  if (savedView === 'list' || savedView === 'grid') {
    viewMode.value = savedView;
  }
  
  await Promise.all([
    projectStore.fetchProjects(),
    tagStore.loadTags(),
  ]);
  
  // 获取所有项目的真实进度
  await fetchAllProjectsProgress();
});

const setViewMode = (mode: 'grid' | 'list') => {
  viewMode.value = mode;
  localStorage.setItem('projectsViewMode', mode);
};

// 项目操作
const openProject = (id: string) => {
  router.push(`/project/${id}/outline`);
};

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

  const created = await projectStore.createProject({
    name: newProject.value.name,
    genre: newProject.value.genre,
    type: actualType.value,
    totalEpisodes: newProject.value.totalEpisodes,
    writingStyle: {
      preset: newProject.value.writingStyle,
      customDescription: useCustomWritingStyle.value ? newProject.value.customWritingStyle : undefined,
    },
  });

  // 新项目进度为0
  if (created?._id) {
    projectProgressMap.value.set(created._id, 0);
  }

  showCreateModal.value = false;
  newProject.value = {
    name: '',
    genre: '男频漫剧',
    type: '玄幻',
    customType: '',
    totalEpisodes: 60,
    writingStyle: 'colloquial',
    customWritingStyle: '',
  };
  toast.success('项目创建成功');
};

const handleDelete = async (id: string) => {
  const confirmed = await confirm.danger('确定删除此项目？删除后无法恢复。');
  if (confirmed) {
    await projectStore.deleteProject(id);
    // 清理进度缓存
    projectProgressMap.value.delete(id);
    toast.success('项目已删除');
  }
};

// 标签管理
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
    newTagColor.value = presetColors[Math.floor(Math.random() * presetColors.length)];
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
    await tagStore.updateTag(editingTag.value._id, {
      name: editingTag.value.name,
      color: editingTag.value.color
    });
    editingTag.value = null;
    toast.success('标签已更新');
  } catch (err) {
    toast.error('更新标签失败');
  }
};

const cancelEditTag = () => {
  editingTag.value = null;
};

const handleDeleteTag = async (tagId: string) => {
  const confirmed = await confirm.danger('确定删除此标签？');
  if (confirmed) {
    await tagStore.deleteTag(tagId);
    toast.success('标签已删除');
  }
};

// 项目标签选择器
const openTagSelector = (projectId: string, event: MouseEvent) => {
  event.stopPropagation();
  
  if (tagSelectorProjectId.value === projectId) {
    tagSelectorProjectId.value = null;
    return;
  }
  
  const rect = (event.target as HTMLElement).getBoundingClientRect();
  tagSelectorPosition.value = {
    top: rect.bottom + 8,
    left: Math.min(rect.left, window.innerWidth - 280)
  };
  tagSelectorProjectId.value = projectId;
};

const closeTagSelector = () => {
  tagSelectorProjectId.value = null;
};

const toggleProjectTag = async (projectId: string, tagId: string) => {
  const project = projectStore.projects.find(p => p._id === projectId);
  if (!project) return;

  const currentTags = project.tags || [];
  let newTags: string[];

  if (currentTags.includes(tagId)) {
    newTags = currentTags.filter(t => t !== tagId);
  } else {
    newTags = [...currentTags, tagId];
  }

  try {
    await projectStore.updateProject(projectId, { tags: newTags });
  } catch (err) {
    toast.error('更新标签失败');
  }
};

const projectHasTag = (project: { tags?: string[] }, tagId: string) => {
  return project.tags?.includes(tagId) || false;
};

const getProjectTags = (tagIds: string[] | undefined) => {
  if (!tagIds) return [];
  return tagStore.getTagsByIds(tagIds);
};

// 辅助函数
const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    draft: '草稿',
    outline_done: '大纲完成',
    generating: '生成中',
    completed: '已完成',
  };
  return map[status] || status;
};

const getProjectProgress = (project: { _id: string; totalEpisodes: number; status?: string }) => {
  // 使用真实的已完成集数
  const completed = projectProgressMap.value.get(project._id) || 0;
  return { completed, total: project.totalEpisodes };
};

const formatTime = (dateStr: string | undefined) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  if (hours < 1) return '刚刚';
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return date.toLocaleDateString('zh-CN');
};

// 点击外部关闭标签选择器
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.tag-selector-popup') && !target.closest('.tag-trigger-btn')) {
    closeTagSelector();
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});
</script>

<template>
  <div class="projects-page">
    <!-- 顶部工具栏 -->
    <header class="page-toolbar">
      <div class="toolbar-left">
        <h1 class="page-title">🏠 项目管理</h1>
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
        <button class="btn-icon-text" @click="showTagDrawer = true">
          <span>🏷️</span>
          <span>标签管理</span>
        </button>
        <button class="btn-primary" @click="showCreateModal = true">
          <span>+</span> 新建项目
        </button>
        <button class="btn-logout" @click="handleLogout" title="退出登录">
          🚪 退出
        </button>
      </div>
    </header>

    <div v-if="projectStore.loading" class="loading">加载中...</div>

    <!-- 项目网格/列表 -->
    <div v-else class="projects-container" :class="viewMode">
      <div
        v-for="project in filteredProjects"
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
        
        <div class="progress-section">
          <div class="progress-bar">
            <div 
              class="progress-fill" 
              :style="{ width: `${(getProjectProgress(project).completed / getProjectProgress(project).total) * 100}%` }"
            ></div>
          </div>
          <span class="progress-text">
            {{ getProjectProgress(project).completed }}/{{ getProjectProgress(project).total }}集
          </span>
        </div>

        <!-- 项目标签区域 -->
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
          <span class="update-time">{{ formatTime(project.updatedAt) }}</span>
        </div>
      </div>

      <!-- 新建项目引导卡片 -->
      <div class="project-card add-card" @click="showCreateModal = true">
        <div class="add-icon">+</div>
        <span class="add-text">新建项目</span>
        <p class="add-hint">开始创作你的剧本</p>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="filteredProjects.length === 0 && !projectStore.loading" class="empty-state">
      <div class="empty-icon">📂</div>
      <h3 class="empty-title">
        {{ selectedTagFilter || searchQuery ? '没有找到匹配的项目' : '还没有项目' }}
      </h3>
      <p class="empty-desc">
        {{ selectedTagFilter || searchQuery ? '尝试调整筛选条件' : '点击上方按钮创建你的第一个项目' }}
      </p>
    </div>

    <!-- 标签选择器弹出层 -->
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

    <!-- 标签管理抽屉 -->
    <Drawer
      :visible="showTagDrawer"
      title="标签管理"
      width="400px"
      @close="showTagDrawer = false"
    >
      <div class="tag-drawer-content">
        <!-- 创建新标签 -->
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

        <!-- 标签列表 -->
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
              <!-- 编辑模式 -->
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
              <!-- 显示模式 -->
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

    <!-- 新建项目弹窗 -->
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
  </div>
</template>


<style scoped>
.projects-page {
  min-height: 100vh;
  padding: var(--space-5);
  background: var(--bg-base);
}

/* 工具栏 */
.page-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) 0;
  margin-bottom: var(--space-5);
  border-bottom: 1px solid var(--border-default);
}

.toolbar-left { display: flex; align-items: center; }

.page-title {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
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
.view-btn.active { background: var(--primary); color: white; }

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
  color: white;
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
  background: rgba(239, 68, 68, 0.1);
  border-color: var(--error);
  color: var(--error);
}

/* 项目容器 */
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

/* 项目卡片 */
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
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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
.delete-btn:hover { background: var(--error); border-color: var(--error); color: white; }

.card-title {
  margin: 0 0 var(--space-2);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.card-meta {
  margin: 0 0 var(--space-4);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

/* 进度条 */
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

/* 标签区域 */
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
  color: white;
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
  background: rgba(99, 102, 241, 0.05);
}

/* 卡片底部 */
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

.status-badge.completed { background: rgba(34, 197, 94, 0.15); color: var(--success); }
.status-badge.generating { background: rgba(245, 158, 11, 0.15); color: var(--warning); }
.status-badge.outline_done { background: rgba(99, 102, 241, 0.15); color: var(--primary); }

.update-time { font-size: 12px; color: var(--text-muted); }

/* 新建卡片 */
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
  background: rgba(99, 102, 241, 0.05);
}

.add-icon { font-size: 48px; color: var(--text-muted); margin-bottom: var(--space-2); }
.add-text { font-size: var(--text-base); font-weight: var(--font-medium); color: var(--text-secondary); }
.add-hint { margin: var(--space-1) 0 0; font-size: var(--text-sm); color: var(--text-muted); }

/* 空状态 */
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

/* 标签选择器弹出层 */
.tag-selector-popup {
  position: fixed;
  z-index: 1000;
  width: 260px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
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

.tag-option-item.selected { background: rgba(99, 102, 241, 0.1); }
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

/* 标签管理抽屉 */
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
.color-option.active { border-color: white; box-shadow: 0 0 0 2px var(--primary); }
.color-option.small { width: 20px; height: 20px; }

.btn-create {
  height: 40px;
  background: var(--primary);
  color: white;
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
.action-btn.danger:hover { background: rgba(239, 68, 68, 0.15); }

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

.btn-save { background: var(--primary); color: white; }
.btn-save:hover { background: var(--primary-hover); }
.btn-cancel { background: var(--bg-surface); color: var(--text-secondary); border: 1px solid var(--border-default); }
.btn-cancel:hover { background: var(--bg-hover); }

/* 表单 */
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

/* 写作风格选择器 */
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
  background: rgba(99, 102, 241, 0.1);
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
</style>
