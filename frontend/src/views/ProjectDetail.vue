<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProjectStore } from '@/stores/projectStore';
import { useEpisodeStore } from '@/stores/episodeStore';
import { useAuthStore } from '@/stores/authStore';
import { useTaskManagerStore } from '@/stores/taskManagerStore';
import ModelSelector from '@/components/common/ModelSelector.vue';
import ThemeToggle from '@/components/common/ThemeToggle.vue';

const route = useRoute();
const router = useRouter();
const projectStore = useProjectStore();
const episodeStore = useEpisodeStore();
const authStore = useAuthStore();
const taskStore = useTaskManagerStore();

const projectId = computed(() => route.params.id as string);

// 侧边栏折叠状态
const isSidebarCollapsed = ref(true);
const isSidebarHovered = ref(false);

// 从 localStorage 读取用户偏好
onMounted(() => {
  const saved = localStorage.getItem('sidebar-collapsed');
  if (saved !== null) {
    isSidebarCollapsed.value = saved === 'true';
  }
});

// 切换折叠状态
const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value;
  localStorage.setItem('sidebar-collapsed', String(isSidebarCollapsed.value));
};

// 计算侧边栏是否展开显示
const isSidebarExpanded = computed(() => {
  return !isSidebarCollapsed.value || isSidebarHovered.value;
});

const currentProject = computed(() => {
  return projectStore.projects.find(p => p._id === projectId.value);
});

// 获取已生成集数
const generatedCount = computed(() => {
  return episodeStore.episodes.filter(ep => ep.content && ep.content.length > 0).length;
});

// 进度显示
const progressText = computed(() => {
  if (!currentProject.value) return '';
  return `${generatedCount.value}/${currentProject.value.totalEpisodes}集`;
});

// 登出
const handleLogout = () => {
  authStore.logout();
  router.push('/login');
};

// 动态状态标签
const dynamicStatusLabel = computed(() => {
  if (!currentProject.value) return '';

  const total = currentProject.value.totalEpisodes;
  const generated = generatedCount.value;

  if (generated > 0) {
    if (generated >= total) return '已完成';
    return '生成中';
  }

  return getStatusLabel(currentProject.value.status);
});

// 动态状态样式类
const dynamicStatusClass = computed(() => {
  if (!currentProject.value) return '';

  const total = currentProject.value.totalEpisodes;
  const generated = generatedCount.value;

  if (generated >= total) return 'completed';
  if (generated > 0) return 'generating';
  return currentProject.value.status;
});

// 导航项配置（设置放第一，符合使用流程）
const navItems = computed(() => [
  { path: 'settings', icon: '⚙️', label: '设置' },
  { path: 'outline', icon: '📝', label: '大纲' },
  { path: 'characters', icon: '👥', label: '角色' },
  { path: 'script', icon: '📖', label: '剧本' },
  { path: 'validation', icon: '✓', label: '验证' },
  { path: 'preview', icon: '📤', label: '导出' },
  { path: 'engineering', icon: '📚', label: '说明' },
  { path: 'tasks', icon: '⚡', label: '任务', badge: taskStore.runningCount > 0 ? taskStore.runningCount : undefined },
]);

onMounted(async () => {
  if (!currentProject.value) {
    await projectStore.fetchProjects();
  }
  if (currentProject.value) {
    projectStore.setCurrentProject(currentProject.value);
    await episodeStore.fetchEpisodes(currentProject.value._id);
  }
});

watch(projectId, async () => {
  if (!currentProject.value) {
    await projectStore.fetchProjects();
  }
  if (currentProject.value) {
    projectStore.setCurrentProject(currentProject.value);
    await episodeStore.fetchEpisodes(currentProject.value._id);
  }
});

const goBack = () => {
  router.push('/');
};

const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    draft: '草稿',
    outline_done: '大纲完成',
    generating: '生成中',
    completed: '已完成',
  };
  return map[status] || status;
};
</script>

<template>
  <div class="project-detail">
    <!-- 顶部项目信息栏（精简版） -->
    <header class="project-header">
      <div class="header-left">
        <button class="back-btn" @click="goBack" title="返回项目列表">
          <span class="back-icon">←</span>
        </button>
        <div class="project-info" v-if="currentProject">
          <h1 class="project-name">{{ currentProject.name }}</h1>
        </div>
      </div>
      <div class="header-right" v-if="currentProject">
        <ThemeToggle />
        <ModelSelector />
        <span class="tag">{{ currentProject.genre }}</span>
        <span class="progress">{{ progressText }}</span>
        <span class="status" :class="dynamicStatusClass">{{ dynamicStatusLabel }}</span>
      </div>
    </header>

    <div class="main-layout">
      <!-- 左侧导航（图标模式，hover 展开） -->
      <aside 
        class="sidebar" 
        :class="{ expanded: isSidebarExpanded }"
        @mouseenter="isSidebarHovered = true"
        @mouseleave="isSidebarHovered = false"
      >
        <nav class="nav-list">
          <router-link 
            v-for="item in navItems" 
            :key="item.path"
            :to="`/project/${projectId}/${item.path}`"
            class="nav-item"
            :title="item.label"
          >
            <span class="nav-icon">{{ item.icon }}</span>
            <span class="nav-label">{{ item.label }}</span>
            <span v-if="item.badge" class="nav-badge">{{ item.badge }}</span>
          </router-link>
        </nav>
        
        <!-- 登出按钮 -->
        <button class="logout-btn" @click="handleLogout" title="退出登录">
          <span class="nav-icon">🚪</span>
          <span class="nav-label">退出</span>
        </button>
        
        <!-- 折叠切换按钮 -->
        <button class="collapse-btn" @click="toggleSidebar" :title="isSidebarCollapsed ? '固定展开' : '自动折叠'">
          <span class="collapse-icon">{{ isSidebarCollapsed ? '→' : '←' }}</span>
        </button>
      </aside>

      <!-- 内容区 -->
      <main class="content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.project-detail {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-base);
}

/* ===== 顶部项目信息栏（精简版） ===== */
.project-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: var(--header-height);
  padding: 0 var(--space-4);
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-default);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: transparent;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.back-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.back-icon {
  font-size: 16px;
}

.project-name {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.tag {
  padding: var(--space-1) var(--space-2);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.progress {
  color: var(--text-tertiary);
  font-size: var(--text-sm);
}

.status {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.status.completed {
  background: var(--success-muted);
  color: var(--success);
}

.status.outline_done {
  background: var(--primary-muted);
  color: var(--primary);
}

.status.generating {
  background: var(--warning-muted);
  color: var(--warning);
}

/* ===== 主布局 ===== */
.main-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ===== 侧边导航（图标模式） ===== */
.sidebar {
  width: var(--panel-xs);
  background: var(--bg-elevated);
  border-right: 1px solid var(--border-default);
  display: flex;
  flex-direction: column;
  transition: width var(--duration-normal) var(--ease-out-expo);
  overflow: hidden;
  flex-shrink: 0;
}

.sidebar.expanded {
  width: 160px;
}

.nav-list {
  display: flex;
  flex-direction: column;
  padding: var(--space-3) 0;
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  text-decoration: none;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  transition: all var(--transition-fast);
  white-space: nowrap;
  border-left: 3px solid transparent;
  position: relative;
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.nav-item.router-link-active {
  background: var(--primary-muted);
  color: var(--primary);
  border-left-color: var(--primary);
}

.nav-icon {
  font-size: 18px;
  flex-shrink: 0;
  width: 24px;
  text-align: center;
}

.nav-label {
  opacity: 0;
  transition: opacity var(--duration-fast);
}

.sidebar.expanded .nav-label {
  opacity: 1;
}

.nav-badge {
  background: var(--primary);
  color: white;
  font-size: 10px;
  font-weight: var(--font-semibold);
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  opacity: 1;
}

.sidebar:not(.expanded) .nav-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 14px;
  height: 14px;
  font-size: 9px;
}

/* 登出按钮 */
.logout-btn {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: var(--space-2) var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: 14px;
  width: calc(100% - var(--space-6));
}

.logout-btn:hover {
  background: var(--error-muted);
  border-color: var(--error);
  color: var(--error);
}

.logout-btn .nav-icon {
  font-size: 16px;
}

.logout-btn .nav-label {
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.sidebar.expanded .logout-btn .nav-label {
  opacity: 1;
}

/* 折叠切换按钮 */
.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: var(--space-2) var(--space-3);
  padding: var(--space-2);
  background: transparent;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.collapse-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.collapse-icon {
  font-size: 12px;
}

/* ===== 内容区 ===== */
.content {
  flex: 1;
  overflow: hidden;
  background: var(--bg-base);
  display: flex;
  flex-direction: column;
}
</style>
