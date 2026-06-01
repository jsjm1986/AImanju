<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { characterEnhancementApi } from '@/services/api';
import { useSSE } from '@/composables/useSSE';
import { useToast } from '@/composables/useToast';
import type { ICharacterCharm, ICharacterVoice } from '@/services/api';

const props = defineProps<{
  projectId: string;
  characterCount: number;
}>();

const emit = defineEmits<{
  (e: 'initialized'): void;
  (e: 'skip'): void;
}>();

const toast = useToast();
const { isLoading, connect } = useSSE();

const status = ref<{
  totalCharacters: number;
  initializedCount: number;
  uninitializedCount: number;
  characters: Array<{ name: string; initialized: boolean }>;
} | null>(null);

const initializing = ref(false);
const progress = ref({ current: 0, total: 0, characterName: '' });

interface PreviewItem {
  characterId: string;
  characterName: string;
  success: boolean;
  error?: string;
  charmCount: number;
  charm?: ICharacterCharm;
  voice?: ICharacterVoice;
}

const previewList = ref<PreviewItem[]>([]);
const showPreview = ref(false);
const saving = ref(false);
const isRegenerate = ref(false);
const retryingCharacterId = ref<string | null>(null);

const needsInit = computed(() => !!status.value && status.value.uninitializedCount > 0);

const allInitialized = computed(() =>
  !!status.value && status.value.initializedCount === status.value.totalCharacters && status.value.totalCharacters > 0
);

const successfulPreviews = computed(() => previewList.value.filter(p => p.success && p.charm && p.voice));
const failedPreviews = computed(() => previewList.value.filter(p => !p.success));
const successCount = computed(() => previewList.value.filter(p => p.success).length);
const failCount = computed(() => previewList.value.filter(p => !p.success).length);

const formalLevelMap: Record<string, string> = {
  very_formal: '非常正式',
  formal: '正式',
  neutral: '中性',
  casual: '随意',
  very_casual: '非常随意',
};

const vocabularyStyleMap: Record<string, string> = {
  literary: '文学',
  technical: '专业',
  colloquial: '口语',
  slang: '俚语',
  classical: '古典',
};

const loadStatus = async () => {
  if (!props.projectId) return;
  try {
    const res = await characterEnhancementApi.getInitStatus(props.projectId);
    if (res.data.success && res.data.data) {
      const data = res.data.data;
      status.value = {
        totalCharacters: data.totalCharacters,
        initializedCount: data.initializedCount,
        uninitializedCount: data.uninitializedCount,
        characters: data.characters,
      };
    }
  } catch (error) {
    console.error('加载初始化状态失败:', error);
  }
};

const startPreview = async (force = false) => {
  if (initializing.value || isLoading.value) return;

  isRegenerate.value = force;
  initializing.value = true;
  previewList.value = [];
  showPreview.value = false;
  progress.value = { current: 0, total: 0, characterName: '' };

  await connect(
    characterEnhancementApi.batchInitUrl(props.projectId),
    { force, preview: true },
    {
      onMessage: (data: Record<string, unknown>) => {
        if (data.type === 'start') {
          progress.value.total = (data.total as number) || 0;
        } else if (data.type === 'progress') {
          progress.value.current = (data.current as number) || 0;
          progress.value.characterName = (data.characterName as string) || '';
        } else if (data.type === 'character_done') {
          previewList.value.push({
            characterId: (data.characterId as string) || '',
            characterName: (data.characterName as string) || '',
            success: (data.success as boolean) || false,
            error: data.error as string | undefined,
            charmCount: (data.charmCount as number) || 0,
            charm: data.charm as ICharacterCharm | undefined,
            voice: data.voice as ICharacterVoice | undefined,
          });
        }
      },
      onDone: () => {
        initializing.value = false;
        showPreview.value = true;
        toast.success('角色特征生成完成，请确认保存');
      },
      onError: (msg) => {
        initializing.value = false;
        toast.error('生成失败: ' + msg);
      },
    }
  );
};

const confirmSave = async () => {
  if (saving.value) return;

  const toSave = successfulPreviews.value.map(p => ({
    characterId: p.characterId,
    characterName: p.characterName,
    charm: p.charm!,
    voice: p.voice!,
  }));

  if (toSave.length === 0) {
    toast.warning('没有可保存的数据');
    return;
  }

  saving.value = true;
  try {
    const res = await characterEnhancementApi.batchConfirm(props.projectId, toSave);
    if (res.data.success) {
      toast.success(res.data.message);
      showPreview.value = false;
      previewList.value = [];
      loadStatus();
      emit('initialized');
    } else {
      toast.error(res.data.message || '保存失败');
    }
  } catch (error) {
    toast.error('保存失败');
    console.error(error);
  } finally {
    saving.value = false;
  }
};

const cancelPreview = () => {
  showPreview.value = false;
  previewList.value = [];
};

const retrySingleCharacter = async (item: PreviewItem) => {
  if (retryingCharacterId.value) return;

  retryingCharacterId.value = item.characterId;
  try {
    const res = await characterEnhancementApi.initSingle(item.characterId, props.projectId);
    if (res.data.success && res.data.charm && res.data.voice) {
      const index = previewList.value.findIndex(p => p.characterId === item.characterId);
      if (index !== -1) {
        previewList.value[index] = {
          ...item,
          success: true,
          error: undefined,
          charm: res.data.charm,
          voice: res.data.voice,
          charmCount: (res.data.charm.catchphrases?.length || 0) +
            (res.data.charm.quirks?.length || 0) +
            (res.data.charm.signatureMoves?.length || 0),
        };
      }
      toast.success(`${item.characterName} 重试成功`);
    } else {
      toast.error(`${item.characterName} 重试失败: ${res.data.error || '未知错误'}`);
    }
  } catch (error) {
    toast.error(`${item.characterName} 重试失败`);
    console.error(error);
  } finally {
    retryingCharacterId.value = null;
  }
};

const retryAllFailed = async () => {
  for (const item of failedPreviews.value) {
    await retrySingleCharacter(item);
  }
};

watch(() => props.projectId, async () => await loadStatus(), { immediate: true });
</script>

<template>
  <div class="init-card" v-if="status">
    <div v-if="allInitialized && !showPreview && !initializing" class="completed-banner">
      <div class="completed-info">
        <span class="icon">✅</span>
        <span>已为 {{ status.totalCharacters }} 个角色初始化特征</span>
      </div>
      <button class="btn-secondary" @click="startPreview(true)" :disabled="initializing">
        🔄 重新生成
      </button>
    </div>

    <div v-else-if="needsInit && !initializing && !showPreview" class="init-prompt">
      <div class="prompt-header">
        <span class="icon">✨</span>
        <span class="title">智能角色增强</span>
      </div>
      <p class="prompt-desc">
        已提取 <strong>{{ status.totalCharacters }}</strong> 个角色，是否为他们初始化：
      </p>
      <ul class="feature-list">
        <li>口头禅、小癖好、标志性动作</li>
        <li>语言风格（正式程度/词汇/句式）</li>
      </ul>
      <div class="prompt-actions">
        <button class="btn-primary" @click="() => startPreview()">🚀 一键初始化</button>
        <button class="btn-text" @click="$emit('skip')">稍后处理</button>
      </div>
    </div>

    <div v-else-if="initializing" class="init-progress">
      <div class="generating-overlay">
        <div class="generating-icon">
          <span class="ai-icon pulse">🤖</span>
        </div>
        <div class="generating-title">AI 正在{{ isRegenerate ? '重新' : '' }}生成角色特征</div>
        <div class="generating-subtitle">请耐心等待，每个角色需要约 5-10 秒</div>
        
        <div class="progress-container">
          <div class="progress-bar-enhanced">
            <div 
              class="progress-fill-enhanced" 
              :style="{ width: progress.total ? (progress.current / progress.total * 100) + '%' : '0%' }"
            ></div>
          </div>
          
          <div class="progress-info">
            <span class="progress-numbers">{{ progress.current }} / {{ progress.total }}</span>
            <span v-if="progress.characterName" class="current-character">
              正在处理: <strong>{{ progress.characterName }}</strong>
            </span>
          </div>
          
          <div class="realtime-stats" v-if="previewList.length > 0">
            <span class="stat-total">共计 {{ progress.total }} 个角色</span>
            <span class="stat-success">✅ {{ successCount }} 成功</span>
            <span class="stat-fail" v-if="failCount > 0">
              ❌ {{ failCount }} 失败
            </span>
            <span class="stat-remaining">
              ⏳ 剩余 {{ progress.total - progress.current }} 个
            </span>
          </div>
        </div>

        <div class="completed-characters" v-if="previewList.length > 0">
          <div class="completed-title">已完成的角色:</div>
          <div class="completed-list">
            <div 
              v-for="item in previewList" 
              :key="item.characterId"
              class="completed-item"
              :class="{ error: !item.success }"
            >
              <span class="char-status">{{ item.success ? '✓' : '✗' }}</span>
              <span class="char-name">{{ item.characterName }}</span>
              <span v-if="item.success && item.charmCount" class="charm-count">+{{ item.charmCount }} 项</span>
              <span v-if="!item.success" class="error-text">{{ item.error }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="showPreview" class="preview-section">
      <div class="preview-header">
        <span class="icon">👀</span>
        <span class="title">预览生成结果</span>
        <div class="status-summary">
          <span class="total-count">共计 {{ status?.totalCharacters || previewList.length }} 个角色</span>
          <span class="success-count">✅ {{ successfulPreviews.length }} 成功</span>
          <span v-if="failedPreviews.length > 0" class="fail-count">❌ {{ failedPreviews.length }} 失败</span>
        </div>
      </div>

      <div class="preview-list">
        <div 
          v-for="item in previewList" 
          :key="item.characterId"
          class="preview-item"
          :class="{ 
            'success': item.success, 
            'error': !item.success,
            'retrying': retryingCharacterId === item.characterId
          }"
        >
          <div class="preview-item-header">
            <span class="char-status">{{ item.success ? '✓' : '✗' }}</span>
            <span class="char-name">{{ item.characterName }}</span>
            <button
              v-if="!item.success" 
              class="btn-retry"
              @click="retrySingleCharacter(item)"
              :disabled="retryingCharacterId !== null"
            >
              {{ retryingCharacterId === item.characterId ? '⏳ 重试中...' : '🔄 重试' }}
            </button>
          </div>
          
          <template v-if="item.success && item.charm">
            <div class="preview-detail">
              <div class="detail-section">
                <span class="label">口头禅：</span>
                <span class="value">{{ item.charm.catchphrases?.join('、') || '-' }}</span>
              </div>
              <div class="detail-section">
                <span class="label">小癖好：</span>
                <span class="value">{{ item.charm.quirks?.join('、') || '-' }}</span>
              </div>
              <div class="detail-section">
                <span class="label">标志动作：</span>
                <span class="value">{{ item.charm.signatureMoves?.join('、') || '-' }}</span>
              </div>
              <div class="detail-section" v-if="item.voice">
                <span class="label">语言风格：</span>
                <span class="value">
                  {{ formalLevelMap[item.voice.formalLevel] || item.voice.formalLevel }}
                  / {{ vocabularyStyleMap[item.voice.vocabularyStyle] || item.voice.vocabularyStyle }}
                </span>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="error-detail">{{ item.error || '生成失败' }}</div>
          </template>
        </div>
      </div>

      <div class="preview-actions">
        <button 
          class="btn-primary" 
          @click="confirmSave" 
          :disabled="saving || successfulPreviews.length === 0"
        >
          {{ saving ? '保存中...' : `✅ 保存成功的 (${successfulPreviews.length} 个)` }}
        </button>
        <button 
          v-if="failedPreviews.length > 0"
          class="btn-warning" 
          @click="retryAllFailed" 
          :disabled="saving || retryingCharacterId !== null"
        >
          🔄 重试失败的 ({{ failedPreviews.length }} 个)
        </button>
        <button class="btn-secondary" @click="cancelPreview" :disabled="saving">
          ❌ 放弃全部
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.init-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
}

.completed-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  color: var(--success);
  font-size: var(--text-sm);
}

.completed-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.btn-secondary {
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.init-prompt {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.prompt-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.prompt-header .icon {
  font-size: 20px;
}

.prompt-header .title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.prompt-desc {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.feature-list {
  margin: 0;
  padding-left: var(--space-5);
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.feature-list li {
  margin-bottom: var(--space-1);
}

.prompt-actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.btn-primary {
  padding: var(--space-2) var(--space-4);
  background: linear-gradient(135deg, var(--primary) 0%, #6366f1 100%);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-text {
  padding: var(--space-2) var(--space-4);
  background: transparent;
  color: var(--text-tertiary);
  border: none;
  font-size: var(--text-sm);
  cursor: pointer;
}

.btn-text:hover:not(:disabled) {
  color: var(--text-secondary);
}

.btn-text:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 进度显示 */
.init-progress {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.generating-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-6);
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: var(--radius-lg);
}

.generating-icon {
  margin-bottom: var(--space-3);
}

.ai-icon {
  font-size: 48px;
  display: inline-block;
}

.ai-icon.pulse {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.8; }
}

.generating-title {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.generating-subtitle {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin-bottom: var(--space-4);
}

.progress-container {
  width: 100%;
  max-width: 400px;
}

.progress-bar-enhanced {
  height: 10px;
  background: var(--bg-elevated);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-bottom: var(--space-2);
}

.progress-fill-enhanced {
  height: 100%;
  background: linear-gradient(90deg, var(--primary) 0%, #6366f1 50%, #a855f7 100%);
  border-radius: var(--radius-full);
  transition: width 0.5s ease;
  position: relative;
}

.progress-fill-enhanced::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--text-sm);
}

.progress-numbers {
  color: var(--primary);
  font-weight: var(--font-semibold);
}

.current-character {
  color: var(--text-secondary);
}

.current-character strong {
  color: var(--text-primary);
}

.realtime-stats {
  display: flex;
  justify-content: center;
  gap: var(--space-4);
  margin-top: var(--space-3);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.stat-success {
  color: var(--success);
}

.stat-total {
  color: var(--text-secondary);
}

.total-count {
  color: var(--text-secondary);
  margin-right: var(--space-2);
}

.stat-fail {
  color: var(--error);
}

.stat-remaining {
  color: var(--text-tertiary);
}

.completed-characters {
  width: 100%;
  margin-top: var(--space-4);
}

.completed-title {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin-bottom: var(--space-2);
}

.completed-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  max-height: 120px;
  overflow-y: auto;
}

.completed-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: var(--success-muted);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
}

.completed-item.error {
  background: var(--error-muted);
}

.char-status {
  color: var(--success);
}

.completed-item.error .char-status {
  color: var(--error);
}

.char-name {
  color: var(--text-primary);
}

.charm-count {
  color: var(--success);
}

.error-text {
  color: var(--error);
}

.preview-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.preview-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.preview-header .icon {
  font-size: 20px;
}

.preview-header .title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.preview-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-height: 400px;
  overflow-y: auto;
}

.preview-item {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.preview-item.error {
  border-color: var(--error);
  background: var(--error-muted);
}

.preview-item-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
  font-weight: var(--font-medium);
}

.preview-item-header .char-status {
  font-size: var(--text-lg);
}

.preview-item-header .char-name {
  font-size: var(--text-base);
}

.preview-detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.detail-section {
  display: flex;
  gap: var(--space-2);
  font-size: var(--text-sm);
}

.detail-section .label {
  color: var(--text-tertiary);
  flex-shrink: 0;
  min-width: 70px;
}

.detail-section .value {
  color: var(--text-secondary);
}

.error-detail {
  color: var(--error);
  font-size: var(--text-sm);
}

.preview-actions {
  display: flex;
  gap: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-default);
  flex-wrap: wrap;
}

.status-summary {
  margin-left: auto;
  display: flex;
  gap: var(--space-3);
  font-size: var(--text-sm);
}

.success-count {
  color: var(--success);
}

.fail-count {
  color: var(--error);
}

.preview-item.success {
  border-color: var(--success);
  border-left: 3px solid var(--success);
}

/* 重试中状态 */
.preview-item.retrying {
  opacity: 0.7;
  pointer-events: none;
}

/* 重试按钮 */
.btn-retry {
  margin-left: auto;
  padding: var(--space-1) var(--space-2);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-retry:hover:not(:disabled) {
  background: var(--warning);
  color: white;
  border-color: var(--warning);
}

.btn-retry:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 警告按钮 */
.btn-warning {
  padding: var(--space-2) var(--space-4);
  background: var(--warning);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-warning:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn-warning:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
