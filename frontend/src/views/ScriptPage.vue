<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useEpisodeStore } from '@/stores/episodeStore';
import { useProjectStore } from '@/stores/projectStore';
import { useWorldStateStore } from '@/stores/worldStateStore';
import { useGenerationStore } from '@/stores/generationStore';
import { useAttentionStore } from '@/stores/attentionStore';
import { useBatchGenerationStore } from '@/stores/batchGenerationStore';
import { WordCountService } from '@/utils/wordCount';
import { useSSE } from '@/composables/useSSE';
import { useToast } from '@/composables/useToast';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
import { useConfirm } from '@/composables/useConfirm';
import { rewriteApi, episodeApi } from '@/services/api';
import Drawer from '@/components/common/Drawer.vue';
import RewriteModal from '@/components/script/RewriteModal.vue';
import EditDiffModal from '@/components/script/EditDiffModal.vue';
import ValidationPanel from '@/components/script/ValidationPanel.vue';
import GenerationProgressPanel from '@/components/script/GenerationProgressPanel.vue';
import RhythmSettingsModal from '@/components/script/RhythmSettingsModal.vue';
import GenerationHistoryPanel from '@/components/script/GenerationHistoryPanel.vue';
import AttentionHeadsModal from '@/components/script/AttentionHeadsModal.vue';
import RewriteHistoryPanel from '@/components/script/RewriteHistoryPanel.vue';
import BatchRewriteModal from '@/components/script/BatchRewriteModal.vue';
import ConfigConfirmationModal from '@/components/script/ConfigConfirmationModal.vue';
import PublishSettingsModal from '@/components/project/PublishSettingsModal.vue';
import CharacterPyramid from '@/components/worldstate/CharacterPyramid.vue';
import RhythmDashboard from '@/components/worldstate/RhythmDashboard.vue';
import BatchAnalysisPanel from '@/components/worldstate/BatchAnalysisPanel.vue';
import ForeshadowingKanban from '@/components/foreshadowing/ForeshadowingKanban.vue';
import type { EpisodeStatus } from '@/types';

const route = useRoute();
const episodeStore = useEpisodeStore();
const projectStore = useProjectStore();
const worldStateStore = useWorldStateStore();
const generationStore = useGenerationStore();
const attentionStore = useAttentionStore();
const batchStore = useBatchGenerationStore();
const { isLoading, error, disconnect } = useSSE();
const toast = useToast();
const { confirm } = useConfirm();

type DrawerType = 'config' | 'progress' | 'characters' | 'foreshadowing' | 'validation' | 'history' | 'rewrite-history' | 'batch' | null;
const activeDrawer = ref<DrawerType>(null);
const openDrawer = (type: DrawerType) => { activeDrawer.value = type; };
const closeDrawer = () => { activeDrawer.value = null; };

const showRewriteModal = ref(false);
const showBatchRewriteModal = ref(false);
const showRhythmModal = ref(false);
const showPublishModal = ref(false);
const showAttentionModal = ref(false);
const showConfigConfirmationModal = ref(false);
const selectedText = ref<{ start: number; end: number; text: string } | undefined>(undefined);

const isEditing = ref(false);
const editBackup = ref('');
const showDiffModal = ref(false);
const summary = ref('');

const isMultiSelectMode = ref(false);
const selectedEpisodes = ref<number[]>([]);

const projectId = computed(() => route.params.id as string);
const currentEpisodeNumber = ref(1);
const scriptContent = ref('');
const currentProject = computed(() => projectStore.projects.find(p => p._id === projectId.value));
const totalEpisodes = computed(() => currentProject.value?.totalEpisodes || 60);
const currentEpisode = computed(() => episodeStore.getEpisodeByNumber(currentEpisodeNumber.value));
const isBatchGenerating = ref(false);

const isBusy = computed(() => isLoading.value || generationStore.isGenerating || isBatchGenerating.value);

const editStats = computed(() => {
  if (!isEditing.value || !editBackup.value) {
    return { addedChars: 0, removedChars: 0, hasChanges: false };
  }
  const origLen = editBackup.value.length;
  const modLen = scriptContent.value.length;
  const hasChanges = editBackup.value !== scriptContent.value;
  return {
    addedChars: Math.max(0, modLen - origLen),
    removedChars: Math.max(0, origLen - modLen),
    hasChanges,
  };
});

const batchProgress = computed(() => {
  const task = batchStore.currentTask;
  if (task && task.projectId === projectId.value) {
    return {
      current: task.completed?.length || 0,
      total: task.episodes?.length || 0,
      currentEpisode: task.currentEpisode || 0,
    };
  }
  return { current: 0, total: 0, currentEpisode: 0 };
});

interface EpisodeNavItem {
  number: number;
  status: EpisodeStatus;
  hasContent: boolean;
}

const episodeNavList = computed<EpisodeNavItem[]>(() => {
  const list: EpisodeNavItem[] = [];
  for (let i = 1; i <= totalEpisodes.value; i++) {
    const ep = episodeStore.getEpisodeByNumber(i);
    list.push({
      number: i,
      status: ep?.status || 'pending',
      hasContent: !!ep?.content,
    });
  }
  return list;
});

const completedCount = computed(() => episodeNavList.value.filter(ep => ep.hasContent).length);

const rewriteCount = ref(0);

async function fetchRewriteCount() {
  if (!currentEpisode.value?._id || !projectId.value) {
    rewriteCount.value = 0;
    return;
  }
  try {
    const { data } = await rewriteApi.getHistory(currentEpisode.value._id, projectId.value);
    rewriteCount.value = data.stats?.total || 0;
  } catch (e) {
    rewriteCount.value = 0;
  }
}

const toolbarItems = [
  { type: 'config' as const, icon: '⚙️', label: '配置' },
  { type: 'progress' as const, icon: '📊', label: '进度' },
  { type: 'characters' as const, icon: '👥', label: '角色' },
  { type: 'foreshadowing' as const, icon: '🎭', label: '伏笔' },
  { type: 'validation' as const, icon: '✅', label: '验证' },
  { type: 'history' as const, icon: '📋', label: '生成历史' },
  { type: 'rewrite-history' as const, icon: '✨', label: '改写历史' },
  { type: 'batch' as const, icon: '📈', label: '批量' },
];

onMounted(async () => {
  if (projectId.value) {
    await episodeStore.fetchEpisodes(projectId.value);
    if (!currentProject.value) await projectStore.fetchProjects();
    await worldStateStore.fetchWorldState(projectId.value);
    await attentionStore.fetchProjectConfig(projectId.value);
    const activeTask = await batchStore.resumeTask(projectId.value);
    if (activeTask) {
      isBatchGenerating.value = true;
      openDrawer('progress');
      toast.info('检测到未完成的批量任务，正在恢复...');
    }
  }
});

watch(currentEpisodeNumber, async (newNum) => {
  if (!projectId.value) return;
  isEditing.value = false;
  await episodeStore.fetchEpisodeByNumber(projectId.value, newNum);
  scriptContent.value = currentEpisode.value?.content || '';
  await fetchRewriteCount();
});

watch(currentEpisode, async (ep) => {
  if (ep?.content) scriptContent.value = ep.content;
  await fetchRewriteCount();
});

watch(() => projectId.value, async (newProjectId, oldProjectId) => {
  if (newProjectId && newProjectId !== oldProjectId) {
    batchStore.clearTask();
    generationStore.reset();
    isBatchGenerating.value = false;
    const activeTask = await batchStore.resumeTask(newProjectId);
    if (activeTask) isBatchGenerating.value = true;
  }
});

const selectEpisode = (num: number) => {
  if (isMultiSelectMode.value) {
    const index = selectedEpisodes.value.indexOf(num);
    if (index === -1) {
      selectedEpisodes.value.push(num);
      selectedEpisodes.value.sort((a, b) => a - b);
    } else {
      selectedEpisodes.value.splice(index, 1);
    }
  } else {
    currentEpisodeNumber.value = num;
  }
};

const toggleMultiSelect = () => {
  isMultiSelectMode.value = !isMultiSelectMode.value;
  if (!isMultiSelectMode.value) {
    selectedEpisodes.value = [];
  }
};

const toggleSelectAll = () => {
  if (selectedEpisodes.value.length === totalEpisodes.value) {
    selectedEpisodes.value = [];
  } else {
    selectedEpisodes.value = Array.from({ length: totalEpisodes.value }, (_, i) => i + 1);
  }
};

const selectUngenerated = () => {
  selectedEpisodes.value = episodeNavList.value
    .filter(ep => !ep.hasContent)
    .map(ep => ep.number);
};

const prevEpisode = () => {
  if (currentEpisodeNumber.value > 1) currentEpisodeNumber.value--;
};

const nextEpisode = () => {
  if (currentEpisodeNumber.value < totalEpisodes.value) currentEpisodeNumber.value++;
};

useKeyboardShortcuts([
  { key: 'ArrowUp', handler: prevEpisode, description: '上一集' },
  { key: 'ArrowDown', handler: nextEpisode, description: '下一集' },
  { key: 'g', ctrl: true, handler: () => handleGenerate(), description: '生成剧本' },
  { key: 'r', ctrl: true, handler: () => openRewriteModal(), description: '改写剧本' },
  { key: 'm', ctrl: true, handler: () => toggleMultiSelect(), description: '切换多选模式' },
  { key: 's', ctrl: true, handler: () => { if (isEditing.value) saveEdit(); }, description: '保存编辑' },
]);

const toggleEdit = () => {
  if (isBusy.value) return;
  if (!isEditing.value) {
    editBackup.value = scriptContent.value;
    isEditing.value = true;
  } else {
    isEditing.value = false;
  }
};

const cancelEdit = () => {
  scriptContent.value = editBackup.value;
  isEditing.value = false;
  toast.info('已取消编辑');
};

const showDiffPreview = () => {
  if (!editStats.value.hasChanges) {
    toast.info('没有修改内容');
    isEditing.value = false;
    return;
  }
  showDiffModal.value = true;
};

const confirmSave = async () => {
  try {
    const saveData = {
      content: scriptContent.value,
      summary: summary.value,
      wordCount: WordCountService.count(scriptContent.value),
    };

    if (!currentEpisode.value) {
      await episodeApi.upsert(projectId.value, currentEpisodeNumber.value, saveData);
      await episodeStore.fetchEpisodes(projectId.value);
      isEditing.value = false;
      showDiffModal.value = false;
      toast.success('创建并保存成功');
      return;
    }

    if (editBackup.value !== scriptContent.value) {
      await rewriteApi.saveManualEdit({
        projectId: projectId.value,
        episodeId: currentEpisode.value._id,
        episodeNumber: currentEpisodeNumber.value,
        originalContent: editBackup.value,
        modifiedContent: scriptContent.value,
        description: '手动编辑',
      });
    }

    await episodeStore.updateEpisode(currentEpisode.value._id, saveData);
    isEditing.value = false;
    showDiffModal.value = false;
    toast.success('保存成功');
    await fetchRewriteCount();
  } catch (err) {
    toast.error('保存失败');
  }
};

const discardChanges = () => {
  scriptContent.value = editBackup.value;
  isEditing.value = false;
  showDiffModal.value = false;
  toast.info('已放弃修改');
};

const saveEdit = async () => {
  if (editStats.value.hasChanges) {
    showDiffPreview();
  } else {
    isEditing.value = false;
    toast.info('没有修改内容');
  }
};

const handleGenerate = async () => {
  if (isBusy.value) return;

  if (currentEpisodeNumber.value === 1) {
    showConfigConfirmationModal.value = true;
    return;
  }

  const confirmed = await confirm({
    title: '确认生成',
    message: `确定要生成第 ${currentEpisodeNumber.value} 集剧本吗？\n\n生成过程可能需要几分钟时间。`,
    type: 'default',
    confirmText: '开始生成',
    cancelText: '取消',
  });
  if (!confirmed) return;
  await executeGeneration();
};

const executeGeneration = async () => {
  scriptContent.value = '';
  openDrawer('progress');
  showConfigConfirmationModal.value = false;
  await generationStore.startGeneration(projectId.value, currentEpisodeNumber.value);
  scriptContent.value = generationStore.generatedContent;
  if (!generationStore.error) {
    await episodeStore.fetchEpisodes(projectId.value);
    await worldStateStore.fetchWorldState(projectId.value, currentEpisodeNumber.value);
    toast.success(`第${currentEpisodeNumber.value}集生成完成`);
  }
};

const handleBatchGenerate = async () => {
  if (selectedEpisodes.value.length === 0) {
    toast.error('请先选择要生成的集数');
    return;
  }
  if (isBatchGenerating.value) return;
  selectedEpisodes.value.sort((a, b) => a - b);
  const confirmed = await confirm({
    title: '确认批量生成',
    message: `确定要批量生成 ${selectedEpisodes.value.length} 集剧本吗？\n\n选中集数：${selectedEpisodes.value.join(', ')}\n\n批量生成可能需要较长时间，请耐心等待。`,
    type: 'warning',
    confirmText: '开始批量生成',
    cancelText: '取消',
  });
  if (!confirmed) return;
  isBatchGenerating.value = true;
  openDrawer('progress');
  try {
    await batchStore.startBatchTask(projectId.value, selectedEpisodes.value);
  } catch (error: any) {
    toast.error(error.response?.status === 409 ? '该项目已有正在进行的批量任务' : '启动批量生成失败: ' + error.message);
    isBatchGenerating.value = false;
  }
};

const handleStop = () => {
  if (batchStore.isRunning) batchStore.stopTask(projectId.value);
  else if (generationStore.isGenerating) generationStore.stopGeneration();
  else disconnect();
  isBatchGenerating.value = false;
  toast.info('已停止生成');
};

const openRewriteModal = () => {
  const selection = window.getSelection();
  if (selection && selection.toString().trim()) {
    const text = selection.toString();
    const start = scriptContent.value.indexOf(text);
    if (start !== -1) {
      selectedText.value = { start, end: start + text.length, text };
    }
  } else {
    selectedText.value = undefined;
  }
  showRewriteModal.value = true;
};

const onRewriteApplied = async (newContent: string) => {
  scriptContent.value = newContent;
  await episodeStore.fetchEpisodes(projectId.value);
  await fetchRewriteCount();
};

const onBatchRewriteApplied = async () => {
  await episodeStore.fetchEpisodes(projectId.value);
  toast.success('批量改写已应用');
  await fetchRewriteCount();
};

const onWorldStateInitialized = () => {
  toast.success('WorldState 初始化完成');
  worldStateStore.fetchWorldState(projectId.value);
};

const onBatchAnalyzed = () => {
  toast.success('批量分析完成');
  worldStateStore.fetchWorldState(projectId.value, currentEpisodeNumber.value);
};

const onAttentionConfigSaved = () => {
  toast.success('注意力头配置已保存');
};

const handleReuseContext = (context: {
  episodePlan: string;
  formattedContext: string;
  constraints: string[];
  suggestions: string[];
}) => {
  toast.info('上下文已加载，可用于改写参考');
  console.log('复用上下文:', context);
};

const onRewriteRollback = async (content: string) => {
  scriptContent.value = content;
  toast.success('已回滚到改写前的版本');
  await fetchRewriteCount();
};

watch(() => generationStore.generatedContent, (newContent) => {
  if (generationStore.isGenerating && newContent && !isBatchGenerating.value) {
    scriptContent.value = newContent;
  }
});

watch(() => batchStore.currentTask?.status, async (status) => {
  if (status === 'completed') {
    await episodeStore.fetchEpisodes(projectId.value);
    const task = batchStore.currentTask;
    const successCount = task?.completed.length || 0;
    const failedCount = task?.failed.length || 0;
    const skippedCount = task?.skipped.length || 0;

    if (failedCount > 0 || skippedCount > 0) {
      toast.warning(`批量生成完成：成功${successCount}集，失败${failedCount}集，超时${skippedCount}集`);
    } else {
      toast.success(`批量生成完成，共生成${successCount}集`);
    }

    isBatchGenerating.value = false;
    selectedEpisodes.value = [];
    isMultiSelectMode.value = false;
  } else if (status === 'failed' || status === 'stopped') {
    isBatchGenerating.value = false;
    toast.error(status === 'stopped' ? '批量生成已停止' : '批量生成失败');
  }
});
</script>

<template>
  <div class="script-page">
    <header class="page-header">
      <div class="header-left">
        <h2 class="page-title">第{{ currentEpisodeNumber }}集</h2>
        <span v-if="currentProject" class="project-name">{{ currentProject.name }}</span>
        <span class="progress-badge">{{ completedCount }}/{{ totalEpisodes }}集</span>
      </div>
      <div class="header-actions">
        <template v-if="!isEditing">
          <button class="btn-secondary" @click="toggleEdit" :disabled="isBusy">
            ✏️ 编辑
          </button>
          <button class="btn-secondary" @click="openRewriteModal" :disabled="!scriptContent">
            ✨ AI改写
          </button>
          <button class="btn-secondary" @click="showBatchRewriteModal = true">
            📚 批量改写
          </button>
        </template>
        <template v-else>
          <button class="btn-cancel-header" @click="cancelEdit">取消</button>
          <button class="btn-save-header" @click="saveEdit">💾 保存</button>
        </template>
        <button class="btn-primary" @click="handleGenerate" :disabled="isBusy">
          🚀 智能生成
        </button>
        <button class="btn-publish" @click="showPublishModal = true">
          📤 发布
        </button>
      </div>
    </header>

    <div class="episode-grid-section">
      <div class="grid-header">
        <span class="grid-title">集数选择</span>
        <div class="grid-actions">
          <button
            class="btn-mini"
            :class="{ active: isMultiSelectMode }"
            @click="toggleMultiSelect"
          >
            {{ isMultiSelectMode ? '退出多选' : '多选' }}
          </button>
          <template v-if="isMultiSelectMode">
            <button class="btn-mini" @click="toggleSelectAll">
              {{ selectedEpisodes.length === totalEpisodes ? '取消全选' : '全选' }}
            </button>
            <button class="btn-mini" @click="selectUngenerated">选未生成</button>
            <button
              v-if="selectedEpisodes.length > 0"
              class="btn-primary btn-sm"
              @click="handleBatchGenerate"
              :disabled="isBatchGenerating"
            >
              {{ isBatchGenerating ? `生成中...` : `批量生成 (${selectedEpisodes.length}集)` }}
            </button>
          </template>
        </div>
      </div>
      <div class="episode-grid">
        <button
          v-for="ep in episodeNavList"
          :key="ep.number"
          class="ep-btn"
          :class="{
            active: !isMultiSelectMode && currentEpisodeNumber === ep.number,
            selected: isMultiSelectMode && selectedEpisodes.includes(ep.number),
            completed: ep.hasContent,
          }"
          @click="selectEpisode(ep.number)"
        >
          {{ ep.number }}
        </button>
      </div>
    </div>

    <main class="main-content">
      <div v-if="isBatchGenerating" class="batch-progress-inline">
        <div class="batch-info">
          <span>批量生成进度</span>
          <span>{{ batchProgress.current }}/{{ batchProgress.total }}</span>
        </div>
        <div class="batch-bar">
          <div
            class="batch-fill"
            :style="{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }"
          ></div>
        </div>
        <div class="batch-current">正在生成第 {{ batchProgress.currentEpisode }} 集...</div>
      </div>

      <div v-if="error || generationStore.error" class="error-banner">
        {{ error || generationStore.error }}
      </div>

      <div class="script-body">
        <div v-if="scriptContent" class="script-text">
          <textarea
            v-if="isEditing"
            v-model="scriptContent"
            class="edit-textarea"
            placeholder="编辑剧本内容..."
          ></textarea>
          <pre v-else>{{ scriptContent }}</pre>
        </div>
        <div v-else class="empty-state">
          <div class="empty-icon">📝</div>
          <p class="empty-title">暂无剧本内容</p>
          <p class="empty-desc">点击"智能生成"生成当前集，或开启多选模式批量生成</p>
        </div>
      </div>
    </main>

    <div v-if="currentEpisode" class="status-bar">
      <span class="status-item">字数: {{ scriptContent.length }}</span>
      <span class="status-divider"></span>
      <span class="status-item">状态: {{ currentEpisode.status }}</span>
      <span class="status-divider"></span>
      <span
        class="status-item status-clickable"
        @click="openDrawer('rewrite-history')"
        :title="rewriteCount > 0 ? '点击查看修改历史' : '暂无修改记录'"
      >
        修改: {{ rewriteCount }}次
        <span v-if="rewriteCount > 0" class="history-icon">📋</span>
      </span>
      <template v-if="isEditing">
        <span class="status-divider"></span>
        <span class="edit-stats" :class="{ changed: editStats.hasChanges }">
          <span v-if="editStats.hasChanges" class="stats-detail">
            <span class="stat-added">+{{ editStats.addedChars }}</span>
            <span class="stat-removed">-{{ editStats.removedChars }}</span>
          </span>
          <span v-else class="stats-unchanged">无修改</span>
        </span>
        <button 
          v-if="editStats.hasChanges" 
          class="btn-preview-diff" 
          @click="showDiffPreview"
        >
          👁 预览差异
        </button>
        <span class="editing-hint">Ctrl+S 保存</span>
      </template>
    </div>

    <!-- 底部工具栏 -->
    <div class="bottom-toolbar">
      <button
        v-for="item in toolbarItems"
        :key="item.type"
        class="toolbar-btn"
        :class="{
          active: activeDrawer === item.type,
          generating: item.type === 'progress' && (generationStore.isGenerating || isBatchGenerating),
        }"
        @click="openDrawer(item.type)"
      >
        <span class="btn-icon">{{ item.icon }}</span>
        <span class="btn-label">{{ item.label }}</span>
      </button>
    </div>

    <Drawer
      :visible="activeDrawer === 'config'"
      title="生成配置"
      width="400px"
      @close="closeDrawer"
    >
      <div class="drawer-section">
        <div class="setting-group">
          <label>当前选中</label>
          <div class="setting-value highlight">第 {{ currentEpisodeNumber }} 集</div>
        </div>
        <div class="setting-group">
          <label>生成模式</label>
          <div class="setting-value">智能生成 (WorldState增强)</div>
        </div>
        <div class="setting-group">
          <label>节奏预设</label>
          <div class="setting-row">
            <span>{{ worldStateStore.worldState ? '已配置' : '默认' }}</span>
            <button
              class="btn-mini"
              @click="showRhythmModal = true"
              :disabled="isBusy"
              :title="generationStore.isGenerating ? '生成过程中无法修改配置' : '修改节奏预设'"
            >
              修改
            </button>
          </div>
        </div>
        <div class="setting-group">
          <label>注意力头</label>
          <div class="setting-row">
            <span>{{ attentionStore.currentConfig.mode === 'custom' ? '自定义' : '自动' }}</span>
            <button
              class="btn-mini"
              @click="showAttentionModal = true"
              :disabled="isBusy"
              :title="generationStore.isGenerating ? '生成过程中无法修改配置' : '配置注意力头'"
            >
              配置
            </button>
          </div>
        </div>
        <button class="btn-primary full-width" @click="handleGenerate" :disabled="isBusy">
          🚀 生成第 {{ currentEpisodeNumber }} 集
        </button>
      </div>

      <div class="drawer-divider"></div>

      <div class="drawer-section">
        <h4 class="section-title">节奏控制</h4>
        <RhythmDashboard
          :project-id="projectId"
          :current-episode="currentEpisodeNumber"
          @open-settings="showRhythmModal = true"
        />
      </div>
    </Drawer>

    <Drawer
      :visible="activeDrawer === 'progress'"
      title="生成进度"
      width="480px"
      @close="closeDrawer"
    >
      <GenerationProgressPanel
        :episode-number="batchProgress.currentEpisode || currentEpisodeNumber"
        :project-id="projectId"
        @stop="handleStop"
      />
    </Drawer>

    <Drawer
      :visible="activeDrawer === 'characters'"
      title="角色监控"
      width="400px"
      @close="closeDrawer"
    >
      <CharacterPyramid />
    </Drawer>

    <Drawer
      :visible="activeDrawer === 'foreshadowing'"
      title="伏笔追踪"
      width="480px"
      @close="closeDrawer"
    >
      <ForeshadowingKanban />
    </Drawer>

    <Drawer
      :visible="activeDrawer === 'validation'"
      title="验证面板"
      width="400px"
      @close="closeDrawer"
    >
      <ValidationPanel :project-id="projectId" />
    </Drawer>

    <Drawer
      :visible="activeDrawer === 'history'"
      title="生成历史"
      width="480px"
      @close="closeDrawer"
    >
      <GenerationHistoryPanel
        :project-id="projectId"
        :episode-number="currentEpisodeNumber"
        @reuse-context="handleReuseContext"
      />
    </Drawer>

    <Drawer
      :visible="activeDrawer === 'rewrite-history'"
      title="改写历史"
      width="480px"
      @close="closeDrawer"
    >
      <RewriteHistoryPanel
        :project-id="projectId"
        :episode-id="currentEpisode?._id || ''"
        :episode-number="currentEpisodeNumber"
        @rollback-success="onRewriteRollback"
      />
    </Drawer>

    <Drawer
      :visible="activeDrawer === 'batch'"
      title="批量操作"
      width="400px"
      @close="closeDrawer"
    >
      <BatchAnalysisPanel
        :project-id="projectId"
        @initialized="onWorldStateInitialized"
        @analyzed="onBatchAnalyzed"
      />
    </Drawer>

    <RewriteModal
      :visible="showRewriteModal"
      :project-id="projectId"
      :episode-id="currentEpisode?._id || ''"
      :episode-number="currentEpisodeNumber"
      :selection="selectedText"
      @close="showRewriteModal = false"
      @applied="onRewriteApplied"
    />

    <RhythmSettingsModal
      :visible="showRhythmModal"
      :project-id="projectId"
      @close="showRhythmModal = false"
    />

    <AttentionHeadsModal
      :visible="showAttentionModal"
      :project-id="projectId"
      :project-type="currentProject?.type"
      @close="showAttentionModal = false"
      @saved="onAttentionConfigSaved"
    />

    <EditDiffModal
      :visible="showDiffModal"
      :original-content="editBackup"
      :modified-content="scriptContent"
      @close="showDiffModal = false"
      @confirm="confirmSave"
      @discard="discardChanges"
    />

    <BatchRewriteModal
      :visible="showBatchRewriteModal"
      :project-id="projectId"
      :episodes="episodeStore.episodes"
      @close="showBatchRewriteModal = false"
      @applied="onBatchRewriteApplied"
    />

    <ConfigConfirmationModal
      :visible="showConfigConfirmationModal"
      :project-id="projectId"
      :episode-number="currentEpisodeNumber"
      @close="showConfigConfirmationModal = false"
      @confirm="executeGeneration"
    />

    <PublishSettingsModal
      v-if="showPublishModal"
      :project-id="projectId"
      @close="showPublishModal = false"
      @updated="showPublishModal = false"
    />
  </div>
</template>

<style scoped>
.script-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-base);
  overflow: hidden;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-5);
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-default);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.page-title {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.project-name {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.progress-badge {
  font-size: var(--text-xs);
  color: var(--success);
  background: var(--success-muted);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.header-actions {
  display: flex;
  gap: var(--space-2);
}

.episode-grid-section {
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-default);
  padding: var(--space-3) var(--space-5);
  flex-shrink: 0;
}

.grid-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.grid-title {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.grid-actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.episode-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.ep-btn {
  width: 36px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.ep-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.ep-btn.active {
  background: var(--primary-muted);
  border-color: var(--primary);
  color: var(--primary);
}

.ep-btn.selected {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--text-on-primary);
}

.ep-btn.completed {
  background: var(--success-muted);
  border-color: var(--success);
  color: var(--success);
}

.ep-btn.completed.active {
  background: var(--success);
  color: var(--text-on-primary);
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-surface);
}

.batch-progress-inline {
  padding: var(--space-3) var(--space-5);
  background: var(--primary-muted);
  border-bottom: 1px solid var(--border-default);
}

.batch-info {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-sm);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.batch-bar {
  height: 6px;
  background: var(--bg-hover);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.batch-fill {
  height: 100%;
  background: var(--primary);
  transition: width var(--duration-normal);
}

.batch-current {
  font-size: var(--text-xs);
  color: var(--primary);
  margin-top: var(--space-2);
}

.error-banner {
  padding: var(--space-3) var(--space-5);
  background: var(--error-muted);
  color: var(--error);
  font-size: var(--text-sm);
  border-bottom: 1px solid var(--border-default);
}

.script-body {
  flex: 1;
  padding: var(--space-5);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.script-text pre {
  white-space: pre-wrap;
  font-family: inherit;
  line-height: var(--leading-relaxed);
  margin: 0;
  font-size: var(--text-base);
  color: var(--text-primary);
}

.script-text {
  height: 100%;
}

.script-text .edit-textarea {
  width: 100%;
  height: 100%;
  padding: 0;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: var(--text-base);
  line-height: var(--leading-relaxed);
  color: var(--text-primary);
  resize: none;
  outline: none;
  box-sizing: border-box;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: var(--space-4);
  opacity: 0.5;
}

.empty-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-2);
}

.empty-desc {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin: 0;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-5);
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-default);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  flex-shrink: 0;
}

.status-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.status-clickable {
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  transition: all var(--duration-fast);
}

.status-clickable:hover {
  background: var(--bg-hover);
  color: var(--primary);
}

.history-icon {
  font-size: var(--text-xs);
  margin-left: var(--space-1);
}

.status-divider {
  width: 1px;
  height: 16px;
  background: var(--border-default);
}

.editing-hint {
  margin-left: auto;
  color: var(--primary);
  font-size: var(--text-xs);
}

.edit-stats {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
}

.edit-stats.changed {
  background: var(--primary-muted);
}

.stats-detail {
  display: flex;
  gap: var(--space-2);
}

.stat-added {
  color: var(--success);
  font-weight: var(--font-medium);
}

.stat-removed {
  color: var(--error);
  font-weight: var(--font-medium);
}

.stats-unchanged {
  color: var(--text-tertiary);
}

.btn-preview-diff {
  padding: var(--space-1) var(--space-2);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.btn-preview-diff:hover {
  background: var(--bg-hover);
  border-color: var(--primary);
  color: var(--primary);
}

.btn-save-header {
  padding: var(--space-2) var(--space-4);
  background: var(--success);
  color: var(--text-on-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: background var(--duration-fast);
}

.btn-save-header:hover {
  background: var(--success);
}

.btn-cancel-header {
  padding: var(--space-2) var(--space-4);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.btn-cancel-header:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.bottom-toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-default);
  flex-shrink: 0;
}

.toolbar-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
  min-width: 56px;
}

.toolbar-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.toolbar-btn.active {
  background: var(--primary-muted);
  border-color: var(--primary);
  color: var(--primary);
}

.toolbar-btn.generating {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.toolbar-btn .btn-icon {
  font-size: 18px;
}

.toolbar-btn .btn-label {
  font-size: 10px;
  font-weight: var(--font-medium);
}

.btn-primary {
  padding: var(--space-2) var(--space-4);
  background: var(--primary);
  color: var(--text-on-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary.full-width {
  width: 100%;
  margin-top: var(--space-4);
}

.btn-primary.btn-sm {
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
}

.btn-publish {
  padding: var(--space-2) var(--space-4);
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.btn-publish:hover {
  background: linear-gradient(135deg, #059669, #047857);
  transform: translateY(-1px);
}

.btn-secondary {
  padding: var(--space-2) var(--space-4);
  background: var(--bg-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-mini {
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-xs);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.btn-mini:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.btn-mini.active {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--text-on-primary);
}

.drawer-section {
  padding: var(--space-4);
}

.drawer-divider {
  height: 1px;
  background: var(--border-default);
  margin: var(--space-4) 0;
}

.section-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-3);
}

.setting-group {
  margin-bottom: var(--space-4);
}

.setting-group:last-child {
  margin-bottom: 0;
}

.setting-group label {
  display: block;
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-bottom: var(--space-1);
}

.setting-value {
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.setting-value.highlight {
  color: var(--primary);
  font-weight: var(--font-semibold);
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
</style>
