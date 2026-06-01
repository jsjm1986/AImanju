<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { useProjectStore } from '@/stores/projectStore';
import { useSSE } from '@/composables/useSSE';
import { useToast } from '@/composables/useToast';
import { useConfirm } from '@/composables/useConfirm';
import CharacterEnhancementInitCard from '@/components/character/CharacterEnhancementInitCard.vue';

const route = useRoute();
const projectStore = useProjectStore();
const { isLoading, error, connect, disconnect } = useSSE();
const toast = useToast();
const confirmDialog = useConfirm();

const projectId = computed(() => route.params.id as string);
const isInputCollapsed = ref(false);
const concept = ref('');
const requirements = ref('');
const characterCards = ref('');
const synopsis = ref('');
const episodeSummaries = ref('');
const rawOutput = ref('');
const storyCore = ref('');
const characterFunctions = ref('');
const showAdvanced = ref(false);
const storyMode = ref<'complete' | 'open_ended' | 'sequel'>('complete');
const pacing = ref<'fast' | 'standard' | 'slow'>('standard');
const previousSeasonId = ref<string>('');

const availablePreviousProjects = computed(() =>
  projectStore.projects.filter(p =>
    p._id !== projectId.value && p.outline &&
    (p.status === 'outline_done' || p.status === 'completed')
  )
);

const isEditing = ref(false);
const editBackup = ref({ characterCards: '', synopsis: '', episodeSummaries: '' });

type TabKey = 'storyCore' | 'charFunctions' | 'characters' | 'synopsis' | 'episodes';
const activeTab = ref<TabKey>('characters');

const currentStep = ref(0);
const totalSteps = ref(3);
const stepNames = computed(() => totalSteps.value === 5
  ? ['故事内核', '角色功能', '人物卡', '剧情大纲', '分集梗概']
  : ['生成人物卡', '生成剧情大纲', '生成分集梗概']
);

const contentRefs: Record<string, ReturnType<typeof ref<HTMLElement | null>>> = {
  characters: ref<HTMLElement | null>(null),
  synopsis: ref<HTMLElement | null>(null),
  episodes: ref<HTMLElement | null>(null),
};

const currentProject = computed(() =>
  projectStore.projects.find(p => p._id === projectId.value)
);

const hasOutline = computed(() =>
  !!(characterCards.value || synopsis.value || episodeSummaries.value)
);

const contentFields: Record<string, ReturnType<typeof ref<string>>> = {
  storyCore, charFunctions: characterFunctions,
  characters: characterCards, synopsis, episodes: episodeSummaries,
};

const tabsFor5Steps: TabKey[] = ['storyCore', 'charFunctions', 'characters', 'synopsis', 'episodes'];
const tabsFor3Steps: TabKey[] = ['characters', 'synopsis', 'episodes'];

function getTabForStep(step: number): TabKey {
  const tabs = totalSteps.value === 5 ? tabsFor5Steps : tabsFor3Steps;
  return tabs[step - 1] || 'characters';
}

const tabDefs = computed(() => {
  const all: { key: TabKey; label: string; icon: string; emptyText: string; showIf?: boolean; editable?: boolean }[] = [
    { key: 'storyCore', label: '故事内核', icon: '💡', emptyText: '启用高级选项后将显示故事内核', showIf: totalSteps.value === 5 || !!storyCore.value },
    { key: 'charFunctions', label: '角色功能', icon: '🎭', emptyText: '启用高级选项后将显示角色功能矩阵', showIf: totalSteps.value === 5 || !!characterFunctions.value },
    { key: 'characters', label: '人物卡', icon: '👥', emptyText: '生成后将显示人物卡', editable: true },
    { key: 'synopsis', label: '剧情大纲', icon: '📖', emptyText: '生成后将显示剧情大纲', editable: true },
    { key: 'episodes', label: '分集梗概', icon: '📝', emptyText: '生成后将显示分集梗概', editable: true },
  ];
  return all.filter(t => t.showIf !== false);
});

const editablePlaceholders: Record<string, string> = {
  characters: '输入人物卡内容...',
  synopsis: '输入剧情大纲...',
  episodes: '输入分集梗概...',
};

const activeTabContent = computed(() => contentFields[activeTab.value]?.value || '');

function scrollToBottom(step: number) {
  nextTick(() => {
    const tab = getTabForStep(step);
    const container = contentRefs[tab]?.value;
    if (container) container.scrollTop = container.scrollHeight;
  });
};

onMounted(async () => {
  if (!currentProject.value) await projectStore.fetchProjects();
  loadOutlineFromProject();
  if (hasOutline.value) isInputCollapsed.value = true;
});

watch(() => currentProject.value?.outline, () => loadOutlineFromProject());

function loadOutlineFromProject() {
  if (currentProject.value?.outline) {
    const outline = currentProject.value.outline;
    if (typeof outline === 'object') {
      characterCards.value = outline.characterCards || '';
      synopsis.value = outline.synopsis || '';
      episodeSummaries.value = outline.episodeSummaries || '';
      rawOutput.value = outline.raw || '';
    } else if (typeof outline === 'string') {
      parseOutlineContent(outline);
    }
  }
  if (currentProject.value?.concept) concept.value = currentProject.value.concept;
  if (currentProject.value?.requirements) requirements.value = currentProject.value.requirements;
}

const outlineSections = [
  { field: characterCards, md: '一、人物卡', bracket: '人物卡', nextMd: '二、', nextBracket: '剧情大纲' },
  { field: synopsis, md: '二、剧情大纲', bracket: '剧情大纲', nextMd: '三、', nextBracket: '分集梗概' },
  { field: episodeSummaries, md: '三、分集梗概', bracket: '分集梗概', nextMd: null, nextBracket: null },
];

function parseOutlineContent(content: string) {
  rawOutput.value = content;
  for (const sec of outlineSections) {
    const nextMd = sec.nextMd ? `(?=###?\\s*${sec.nextMd}|$)` : '';
    const nextBr = sec.nextBracket ? `(?=【${sec.nextBracket}】|$)` : '';
    const match = content.match(new RegExp(`###?\\s*${sec.md}[\\s\\S]*?${nextMd || ''}`, 'i')) ||
                  content.match(new RegExp(`【${sec.bracket}】[\\s\\S]*?${nextBr || ''}`, ''));
    if (match) {
      sec.field.value = match[0].replace(new RegExp(`###?\\s*${sec.md}\\s*`, 'i'), '').replace(new RegExp(`【${sec.bracket}】\\s*`), '').trim();
    }
  }
}

const handleGenerate = async () => {
  if (isLoading.value) return;
  if (!concept.value.trim()) { toast.warning('请填写故事概念'); return; }

  Object.values(contentFields).forEach(f => f.value = '');
  rawOutput.value = '';
  currentStep.value = 1;
  isEditing.value = false;
  isInputCollapsed.value = false;

  const useEnhanced = showAdvanced.value;
  totalSteps.value = useEnhanced ? 5 : 3;
  activeTab.value = useEnhanced ? 'storyCore' : 'characters';

  await connect(
    '/ai/generate-outline-stream',
    {
      projectId: projectId.value,
      concept: concept.value,
      requirements: requirements.value,
      genre: currentProject.value?.genre || '男频漫剧',
      type: currentProject.value?.type || '玄幻',
      totalEpisodes: currentProject.value?.totalEpisodes || 60,
      storyMode: useEnhanced ? storyMode.value : undefined,
      pacing: useEnhanced ? pacing.value : undefined,
      previousSeasonId: (useEnhanced && storyMode.value === 'sequel' && previousSeasonId.value)
        ? previousSeasonId.value : undefined,
    },
    {
      onMessage: (data: Record<string, unknown>) => {
        if (data.type === 'start') {
          totalSteps.value = (data.totalSteps as number) || 3;
        } else if (data.type === 'step_start') {
          currentStep.value = data.step as number;
          activeTab.value = getTabForStep(data.step as number);
        } else if (data.type === 'chunk') {
          const step = data.step as number;
          const chunk = (data.chunk as string) || '';
          const tab = getTabForStep(step);
          const field = contentFields[tab];
          if (field) { field.value += chunk; scrollToBottom(step); }
        } else if (data.type === 'done') {
          const doneFields: Record<string, ReturnType<typeof ref<string>>> = {
            characterCards, synopsis, episodeSummaries,
            storyCore, characterFunctions, raw: rawOutput,
          };
          for (const [key, field] of Object.entries(doneFields)) {
            if (data[key]) field.value = data[key] as string;
          }
        }
      },
      onChunk: (text: string) => { rawOutput.value += text; },
      onDone: async () => {
        currentStep.value = 0;
        isInputCollapsed.value = true;
        await projectStore.fetchProjects();
        toast.success('大纲生成完成');
      },
      onError: (msg: string) => {
        currentStep.value = 0;
        toast.error('生成失败: ' + msg);
      },
    }
  );
};


const handleStop = () => {
  disconnect();
  currentStep.value = 0;
  toast.info('已停止生成');
};

const toggleEdit = () => {
  if (isLoading.value) return;
  if (!isEditing.value) {
    editBackup.value = {
      characterCards: characterCards.value,
      synopsis: synopsis.value,
      episodeSummaries: episodeSummaries.value
    };
  }
  isEditing.value = !isEditing.value;
};

const cancelEdit = () => {
  characterCards.value = editBackup.value.characterCards;
  synopsis.value = editBackup.value.synopsis;
  episodeSummaries.value = editBackup.value.episodeSummaries;
  isEditing.value = false;
  toast.info('已取消编辑');
};

function buildRawOutline(): string {
  return `### 一、人物卡\n\n${characterCards.value}\n\n### 二、剧情大纲\n\n${synopsis.value}\n\n### 三、分集梗概\n\n${episodeSummaries.value}`;
}

function buildOutlinePayload(extra: Record<string, unknown> = {}) {
  return {
    outline: {
      raw: buildRawOutline(),
      characterCards: characterCards.value,
      synopsis: synopsis.value,
      episodeSummaries: episodeSummaries.value,
    },
    status: 'outline_done' as const,
    ...extra,
  };
}

const saveEdit = async () => {
  try {
    await projectStore.updateProject(projectId.value, buildOutlinePayload());
    isEditing.value = false;
    toast.success('保存成功');
  } catch { toast.error('保存失败'); }
};

const handleClear = async () => {
  if (await confirmDialog.warning('确定清空大纲内容？')) {
    characterCards.value = '';
    synopsis.value = '';
    episodeSummaries.value = '';
    rawOutput.value = '';
    isInputCollapsed.value = false;
    toast.success('已清空');
  }
};

const handleSaveOutline = async () => {
  if (!hasOutline.value) { toast.warning('没有可保存的内容'); return; }
  try {
    await projectStore.updateProject(projectId.value, buildOutlinePayload({
      concept: concept.value,
      requirements: requirements.value,
    }));
    toast.success('大纲已保存，可以开始生成剧本了');
  } catch { toast.error('保存失败'); }
};

const handleCharEnhanceInit = () => {
  toast.success('角色魅力特征和语言风格已初始化完成');
  projectStore.fetchProjects();
};

const handleCharEnhanceSkip = () => {
  toast.info('已跳过角色增强初始化，可稍后在角色管理页面进行');
};

const copyContent = async (content: string, name: string) => {
  try {
    await navigator.clipboard.writeText(content);
    toast.success(`${name}已复制`);
  } catch { toast.error('复制失败'); }
};

const copyActiveTab = () => copyContent(activeTabContent.value, activeTab.value);

const exportOutline = () => {
  const content = `【人物卡】\n\n${characterCards.value}\n\n【剧情大纲】\n\n${synopsis.value}\n\n【分集梗概】\n\n${episodeSummaries.value}`;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentProject.value?.name || '大纲'}_outline.txt`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('大纲已导出');
};
</script>

<template>
  <div class="outline-page">
    <header class="page-toolbar">
      <h2 class="page-title">大纲生成</h2>
      <div class="toolbar-actions">
        <span v-if="currentProject?.status === 'outline_done'" class="status-badge saved">✓ 已保存</span>
        <button class="btn-text" @click="copyContent(rawOutput, '全部')" :disabled="!hasOutline">复制全部</button>
        <button class="btn-text" @click="exportOutline" :disabled="!hasOutline">导出</button>
        <button
          class="btn-primary-sm"
          @click="handleSaveOutline"
          :disabled="!hasOutline || isLoading || currentProject?.status === 'outline_done'"
        >💾 保存大纲</button>
        <button class="btn-text danger" @click="handleClear" :disabled="!hasOutline || isLoading">清空</button>
      </div>
    </header>

    <div class="input-section" :class="{ collapsed: isInputCollapsed }">
      <div class="input-header" @click="isInputCollapsed = !isInputCollapsed">
        <div class="input-header-left">
          <span class="collapse-icon">{{ isInputCollapsed ? '▶' : '▼' }}</span>
          <span class="input-title">输入设置</span>
          <span v-if="concept" class="input-preview">{{ concept.slice(0, 30) }}{{ concept.length > 30 ? '...' : '' }}</span>
        </div>
        <div class="input-header-right" v-if="isInputCollapsed">
          <button class="btn-mini" @click.stop="isInputCollapsed = false">展开编辑</button>
        </div>
      </div>
      
      <div class="input-body" v-show="!isInputCollapsed">
        <div class="input-grid">
          <div class="input-card main">
            <label class="input-label required">故事概念</label>
            <textarea
              v-model="concept"
              placeholder="描述核心概念，50-200字&#10;例如：重生回到高考前一天，开局觉醒最强学习系统"
              rows="4"
              :disabled="isLoading"
              class="input-textarea"
            ></textarea>
          </div>
          
          <div class="input-card">
            <label class="input-label">特殊要求（可选）</label>
            <textarea
              v-model="requirements"
              placeholder="例如：爽点类型、开局要求、感情线等"
              rows="4"
              :disabled="isLoading"
              class="input-textarea"
            ></textarea>
          </div>
        </div>

        <div class="advanced-options">
          <div class="advanced-header" @click="showAdvanced = !showAdvanced">
            <span class="advanced-toggle">{{ showAdvanced ? '▼' : '▶' }}</span>
            <span class="advanced-title">高级选项</span>
            <span v-if="showAdvanced" class="advanced-hint">（5步增强生成）</span>
          </div>
          <div v-show="showAdvanced" class="advanced-body">
            <div class="option-row">
              <div class="option-group">
                <label class="option-label">故事模式</label>
                <select v-model="storyMode" class="option-select" :disabled="isLoading">
                  <option value="complete">完整剧（一季完结）</option>
                  <option value="open_ended">可续集（留续集空间）</option>
                  <option value="sequel">承接季（续接前作）</option>
                </select>
              </div>
              <div class="option-group">
                <label class="option-label">节奏风格</label>
                <select v-model="pacing" class="option-select" :disabled="isLoading">
                  <option value="fast">快节奏（竖屏短剧）</option>
                  <option value="standard">标准节奏（横屏短剧）</option>
                  <option value="slow">慢热（长篇网剧）</option>
                </select>
              </div>
            </div>
            
            <div v-if="storyMode === 'sequel'" class="sequel-selector">
              <label class="option-label">关联前作</label>
              <select 
                v-model="previousSeasonId" 
                class="option-select sequel-select" 
                :disabled="isLoading"
              >
                <option value="">-- 请选择前作项目 --</option>
                <option 
                  v-for="project in availablePreviousProjects" 
                  :key="project._id" 
                  :value="project._id"
                >
                  {{ project.name }} ({{ project.totalEpisodes }}集)
                </option>
              </select>
              <div v-if="availablePreviousProjects.length === 0" class="sequel-empty">
                暂无可选的前作项目，请先完成其他项目的大纲生成
              </div>
              <div v-else-if="previousSeasonId" class="sequel-hint">
                将继承前作的人物设定，并回收未解决的伏笔
              </div>
            </div>
            
            <div class="option-note">
              <template v-if="storyMode === 'sequel'">
                承接季模式：继承前作角色设定，回收伏笔，设计本季独立冲突
              </template>
              <template v-else>
                启用高级选项后，将使用 5 步增强生成：故事内核 → 角色功能 → 人物卡 → 大纲 → 分集
              </template>
            </div>
          </div>
        </div>
        
        <div class="input-footer">
          <div class="project-tags">
            <span class="tag">{{ currentProject?.genre || '男频漫剧' }}</span>
            <span class="tag">{{ currentProject?.type || '玄幻' }}</span>
            <span class="tag">{{ currentProject?.totalEpisodes || 60 }}集</span>
          </div>
          <button
            v-if="!isLoading"
            class="btn-primary"
            @click="handleGenerate"
            :disabled="!concept.trim()"
          >
            🚀 生成大纲
          </button>
          <button v-else class="btn-danger" @click="handleStop">
            停止生成
          </button>
        </div>
      </div>
    </div>

    <div v-if="isLoading" class="progress-float">
      <div class="progress-header">
        <span class="progress-spinner"></span>
        <span class="progress-label">正在生成中...</span>
        <span class="progress-pulse"></span>
      </div>
      <div class="progress-steps">
        <span
          v-for="(name, index) in stepNames"
          :key="index"
          class="step"
          :class="{ active: currentStep === index + 1, done: currentStep > index + 1 }"
        >
          <span v-if="currentStep === index + 1" class="step-indicator"></span>
          {{ name }}
          <span v-if="currentStep > index + 1" class="step-check">✓</span>
        </span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: (currentStep / totalSteps * 100) + '%' }"></div>
        <div class="progress-glow"></div>
      </div>
    </div>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <CharacterEnhancementInitCard
      v-if="hasOutline && !isLoading"
      :project-id="projectId"
      :character-count="0"
      @initialized="handleCharEnhanceInit"
      @skip="handleCharEnhanceSkip"
    />

    <div class="output-section">
      <div class="tabs-header">
        <div class="tabs-nav">
          <button
            v-for="tab in tabDefs"
            :key="tab.key"
            class="tab-btn"
            :class="{ active: activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
            <span v-if="contentFields[tab.key]?.value" class="tab-check">✓</span>
          </button>
        </div>
        <div class="tabs-actions">
          <template v-if="!isEditing">
            <button class="btn-edit" @click="toggleEdit" :disabled="!hasOutline || isLoading">✏️ 编辑</button>
            <button class="btn-text" @click="copyActiveTab" :disabled="!hasOutline">复制</button>
          </template>
          <template v-else>
            <button class="btn-save" @click="saveEdit">💾 保存</button>
            <button class="btn-cancel" @click="cancelEdit">取消</button>
          </template>
        </div>
      </div>

      <div class="tabs-content">
        <div
          v-for="tab in tabDefs"
          :key="tab.key"
          v-show="activeTab === tab.key"
          class="tab-panel"
          :class="{ episodes: tab.key === 'episodes' }"
          :ref="(el: any) => { if (contentRefs[tab.key]) contentRefs[tab.key]!.value = el as HTMLElement; }"
        >
          <textarea
            v-if="isEditing && tab.editable"
            v-model="contentFields[tab.key]!.value"
            class="edit-textarea"
            :placeholder="editablePlaceholders[tab.key]"
          ></textarea>
          <pre v-else-if="contentFields[tab.key]?.value">{{ contentFields[tab.key]!.value }}</pre>
          <div v-else class="empty-state">
            <span class="empty-icon">{{ tab.icon }}</span>
            <p>{{ tab.emptyText }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.outline-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-base);
  overflow: hidden;
}

.page-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-5);
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-default);
  flex-shrink: 0;
}

.page-title {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.status-badge {
  padding: var(--space-1) var(--space-2);
  background: var(--bg-elevated);
  color: var(--text-tertiary);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.status-badge.saved {
  background: var(--success-muted);
  color: var(--success);
}

.input-section {
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-default);
  flex-shrink: 0;
  transition: all var(--duration-normal) var(--ease-out-expo);
}

.input-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-5);
  cursor: pointer;
  user-select: none;
}

.input-header:hover {
  background: var(--bg-hover);
}

.input-header-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.collapse-icon {
  font-size: 10px;
  color: var(--text-tertiary);
  width: 16px;
}

.input-title {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.input-preview {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin-left: var(--space-2);
}

.input-body {
  padding: 0 var(--space-5) var(--space-4);
}

.input-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.input-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.input-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.input-label.required::after {
  content: '*';
  color: var(--error);
  margin-left: var(--space-1);
}

.input-textarea {
  width: 100%;
  padding: var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
  color: var(--text-primary);
  resize: none;
  font-family: inherit;
  transition: border-color var(--transition-fast);
}

.input-textarea:hover:not(:disabled) {
  border-color: var(--border-hover);
}

.input-textarea:focus {
  border-color: var(--border-focus);
  outline: none;
}

.input-textarea:disabled {
  opacity: 0.6;
}

.input-textarea::placeholder {
  color: var(--text-muted);
}

.input-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-muted, var(--border-default));
}

.project-tags {
  display: flex;
  gap: var(--space-2);
}

.tag {
  padding: var(--space-1) var(--space-2);
  background: var(--bg-elevated);
  color: var(--text-tertiary);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
}

.advanced-options {
  margin-top: var(--space-4);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
}

.advanced-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  user-select: none;
}

.advanced-header:hover {
  background: var(--bg-hover);
}

.advanced-toggle {
  font-size: 10px;
  color: var(--text-tertiary);
  width: 12px;
}

.advanced-title {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.advanced-hint {
  font-size: var(--text-xs);
  color: var(--primary);
  margin-left: var(--space-1);
}

.advanced-body {
  padding: var(--space-4);
  border-top: 1px solid var(--border-default);
}

.option-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.option-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.option-select {
  padding: var(--space-2) var(--space-3);
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
  cursor: pointer;
}

.option-select:hover:not(:disabled) {
  border-color: var(--border-hover);
}

.option-select:focus {
  border-color: var(--border-focus);
  outline: none;
}

.option-note {
  margin-top: var(--space-3);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  line-height: var(--leading-relaxed);
}

.sequel-selector {
  margin-top: var(--space-4);
  padding: var(--space-3);
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
}

.sequel-select {
  width: 100%;
  margin-top: var(--space-2);
}

.sequel-empty {
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  color: var(--warning);
}

.sequel-hint {
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  color: var(--success);
}

.progress-float {
  padding: var(--space-3) var(--space-5);
  background: linear-gradient(135deg, var(--primary-muted) 0%, rgba(var(--primary-rgb), 0.15) 100%);
  border-bottom: 2px solid var(--primary);
  flex-shrink: 0;
}

.progress-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.progress-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--primary);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.progress-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--primary);
}

.progress-pulse {
  width: 8px;
  height: 8px;
  background: var(--primary);
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

.progress-steps {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-2);
  font-size: var(--text-sm);
}

.progress-steps .step {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--text-muted);
  transition: color 0.3s ease;
}

.progress-steps .step.active {
  color: var(--primary);
  font-weight: var(--font-medium);
}

.progress-steps .step.done {
  color: var(--success);
}

.step-indicator {
  width: 6px;
  height: 6px;
  background: var(--primary);
  border-radius: 50%;
  animation: blink 0.8s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.step-check {
  font-size: 10px;
  color: var(--success);
}

.progress-bar {
  height: 4px;
  background: var(--bg-hover);
  border-radius: var(--radius-full);
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary) 0%, var(--success) 100%);
  transition: width 0.3s ease;
  position: relative;
}

.progress-glow {
  position: absolute;
  top: 0;
  right: 0;
  width: 50px;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}

.error-banner {
  padding: var(--space-3) var(--space-5);
  background: var(--error-muted);
  color: var(--error);
  font-size: var(--text-sm);
  flex-shrink: 0;
}

.output-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tabs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 var(--space-5);
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-default);
  flex-shrink: 0;
}

.tabs-nav {
  display: flex;
}

.tab-btn {
  padding: var(--space-3) var(--space-4);
  background: transparent;
  border: none;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  transition: color var(--transition-fast);
}

.tab-btn:hover {
  color: var(--text-primary);
}

.tab-btn.active {
  color: var(--primary);
  font-weight: var(--font-medium);
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--primary);
}

.tab-check {
  font-size: 10px;
  color: var(--success);
}

.tabs-actions {
  display: flex;
  gap: var(--space-2);
}

.tabs-content {
  flex: 1;
  overflow: hidden;
}

.tab-panel {
  height: 100%;
  padding: var(--space-5);
  overflow-y: auto;
  background: var(--bg-surface);
}

.tab-panel pre {
  white-space: pre-wrap;
  font-family: inherit;
  line-height: var(--leading-relaxed);
  margin: 0;
  font-size: var(--text-base);
  color: var(--text-primary);
}

.tab-panel.episodes pre {
  font-size: var(--text-sm);
}

.edit-textarea {
  width: 100%;
  height: 100%;
  min-height: 300px;
  padding: 0;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: var(--text-base);
  line-height: var(--leading-relaxed);
  color: var(--text-primary);
  resize: none;
  outline: none;
}

.tab-panel.episodes .edit-textarea {
  font-size: var(--text-sm);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: var(--space-3);
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: var(--text-sm);
}

.btn-primary {
  padding: var(--space-2) var(--space-5);
  background: var(--primary);
  color: var(--text-on-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary-sm {
  padding: var(--space-1) var(--space-3);
  background: var(--primary);
  color: var(--text-on-primary);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.btn-primary-sm:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn-primary-sm:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-danger {
  padding: var(--space-2) var(--space-5);
  background: var(--error);
  color: var(--text-on-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
}

.btn-text {
  padding: var(--space-1) var(--space-2);
  background: transparent;
  color: var(--text-secondary);
  border: none;
  font-size: var(--text-sm);
  cursor: pointer;
}

.btn-text:hover:not(:disabled) {
  color: var(--primary);
}

.btn-text:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-text.danger {
  color: var(--error);
}

.btn-text.active {
  color: var(--primary);
  font-weight: var(--font-medium);
}

.btn-mini {
  padding: var(--space-1) var(--space-2);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  cursor: pointer;
}

.btn-mini:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.btn-edit {
  padding: var(--space-1) var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-edit:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.btn-edit:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-save {
  padding: var(--space-1) var(--space-3);
  background: var(--success);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--text-on-primary);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.btn-save:hover {
  background: var(--success-hover, var(--success));
}

.btn-cancel {
  padding: var(--space-1) var(--space-3);
  background: transparent;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-cancel:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
</style>
