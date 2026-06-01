<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="script-preview-modal">
      <!-- 头部 -->
      <div class="modal-header">
        <div class="header-left">
          <h3>📖 剧本预览</h3>
          <span class="issue-type-badge" :class="issue?.type">
            {{ issue?.type === 'error' ? '错误' : issue?.type === 'warning' ? '警告' : '提示' }}
          </span>
        </div>
        <button class="close-btn" @click="handleClose">×</button>
      </div>

      <!-- 问题描述 -->
      <div class="issue-summary">
        <div class="issue-desc">{{ issue?.description }}</div>
        <div v-if="issue?.suggestion" class="issue-suggestion">
          <span class="suggestion-label">💡 建议：</span>
          {{ issue.suggestion }}
        </div>
      </div>

      <!-- 集数标签（多集时显示） -->
      <div v-if="relatedEpisodes.length > 1" class="episode-tabs">
        <button
          v-for="ep in relatedEpisodes"
          :key="ep"
          :class="['episode-tab', { active: currentEpisode === ep }]"
          @click="switchEpisode(ep)"
        >
          第 {{ ep }} 集
          <span v-if="ep === issue?.episode" class="main-episode-dot"></span>
        </button>
      </div>

      <!-- 剧本内容 -->
      <div class="script-content" ref="scriptContentRef">
        <div v-if="loading" class="loading-state">
          <span class="spinner"></span>
          <span>加载剧本内容...</span>
        </div>
        
        <div v-else-if="!scriptContent" class="empty-state">
          暂无剧本内容
        </div>
        
        <div v-else class="script-text" v-html="highlightedContent"></div>
      </div>

      <!-- 底部操作 -->
      <div class="modal-footer">
        <div class="footer-info">
          <span class="episode-info">第 {{ currentEpisode }} 集</span>
          <span v-if="highlightCount > 0" class="highlight-info">
            找到 {{ highlightCount }} 处相关内容
          </span>
        </div>
        <div class="footer-actions">
          <button class="btn btn-secondary" @click="handleClose">关闭</button>
          <button class="btn btn-primary" @click="handleFix">
            🔧 修复此问题
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { episodeApi } from '@/services/api';
import type { ValidationIssue } from '@/types';

const props = defineProps<{
  visible: boolean;
  issue: ValidationIssue | null;
  projectId: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'fix', issue: ValidationIssue): void;
}>();

const loading = ref(false);
const scriptContent = ref('');
const currentEpisode = ref(0);
const scriptContentRef = ref<HTMLElement | null>(null);
const episodeCache = ref<Record<number, string>>({});

// 相关集数列表
const relatedEpisodes = computed(() => {
  if (!props.issue) return [];
  
  const episodes = new Set<number>();
  episodes.add(props.issue.episode);
  
  // 从 windowRange 解析相关集数
  if (props.issue.windowRange) {
    const match = props.issue.windowRange.match(/(\d+)-(\d+)/);
    if (match && match[1] && match[2]) {
      const start = parseInt(match[1]);
      const end = parseInt(match[2]);
      for (let i = start; i <= end; i++) {
        episodes.add(i);
      }
    }
  }
  
  return Array.from(episodes).sort((a, b) => a - b);
});

// 高亮后的内容
const highlightedContent = computed(() => {
  if (!scriptContent.value || !props.issue) return '';
  
  let content = escapeHtml(scriptContent.value);
  
  // 高亮 evidence 中的文本
  if (props.issue.evidence) {
    const evidenceTexts = extractKeyPhrases(props.issue.evidence);
    for (const text of evidenceTexts) {
      if (text.length >= 4) { // 至少4个字符才高亮
        const escapedText = escapeRegExp(escapeHtml(text));
        const regex = new RegExp(`(${escapedText})`, 'gi');
        content = content.replace(regex, '<mark class="highlight evidence" id="highlight-evidence">$1</mark>');
      }
    }
  }
  
  // 高亮 location 中提到的场景
  if (props.issue.location) {
    const locationMatch = props.issue.location.match(/(\d+-\d+)/g);
    if (locationMatch) {
      for (const scene of locationMatch) {
        const sceneRegex = new RegExp(`(${scene}[：:][^\\n]*)`,'g');
        content = content.replace(sceneRegex, '<mark class="highlight location">$1</mark>');
      }
    }
  }
  
  // 将换行转为 HTML
  content = content.replace(/\n/g, '<br>');
  
  return content;
});

// 高亮数量
const highlightCount = computed(() => {
  const matches = highlightedContent.value.match(/<mark/g);
  return matches ? matches.length : 0;
});

// 监听弹窗打开
watch(() => props.visible, async (visible) => {
  if (visible && props.issue) {
    currentEpisode.value = props.issue.episode;
    await loadEpisodeContent(props.issue.episode);
  }
});

// 监听集数切换
watch(currentEpisode, async (ep) => {
  if (ep > 0) {
    await loadEpisodeContent(ep);
  }
});

async function loadEpisodeContent(episodeNumber: number) {
  // 检查缓存
  if (episodeCache.value[episodeNumber]) {
    scriptContent.value = episodeCache.value[episodeNumber];
    await nextTick();
    scrollToHighlight();
    return;
  }
  
  loading.value = true;
  try {
    const response = await episodeApi.getByNumber(props.projectId, episodeNumber);
    const content = response.data.data?.content || '';
    scriptContent.value = content;
    episodeCache.value[episodeNumber] = content;
    
    await nextTick();
    scrollToHighlight();
  } catch (err) {
    console.error('加载剧本失败:', err);
    scriptContent.value = '';
  } finally {
    loading.value = false;
  }
}

function switchEpisode(ep: number) {
  currentEpisode.value = ep;
}

function scrollToHighlight() {
  const highlight = document.getElementById('highlight-evidence');
  if (highlight && scriptContentRef.value) {
    highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function handleClose() {
  episodeCache.value = {};
  emit('close');
}

function handleFix() {
  if (props.issue) {
    emit('fix', props.issue);
  }
}

// 工具函数
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractKeyPhrases(text: string): string[] {
  // 提取关键短语用于高亮
  // 按标点符号分割，取较长的片段
  const phrases = text.split(/[，。！？、；：""''（）\s]+/).filter(p => p.length >= 4);
  return phrases.slice(0, 5); // 最多5个短语
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--space-4);
}

.script-preview-modal {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 900px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px var(--overlay-bg);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-elevated);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.modal-header h3 {
  margin: 0;
  font-size: var(--text-lg);
  color: var(--text-primary);
}

.issue-type-badge {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.issue-type-badge.error {
  background: var(--error-muted);
  color: var(--error);
}

.issue-type-badge.warning {
  background: var(--warning-muted);
  color: var(--warning);
}

.issue-type-badge.info {
  background: var(--info-muted);
  color: var(--info);
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: var(--text-primary);
}

/* 问题描述 */
.issue-summary {
  padding: var(--space-4) var(--space-5);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-default);
  flex-shrink: 0;
}

.issue-desc {
  font-size: var(--text-base);
  color: var(--text-primary);
  line-height: var(--leading-relaxed);
  margin-bottom: var(--space-2);
}

.issue-suggestion {
  font-size: var(--text-sm);
  color: var(--success);
  background: var(--success-muted);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
}

.suggestion-label {
  font-weight: var(--font-medium);
}

/* 集数标签 */
.episode-tabs {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  background: var(--bg-base);
  border-bottom: 1px solid var(--border-default);
  flex-shrink: 0;
  overflow-x: auto;
}

.episode-tab {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.episode-tab:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

.episode-tab.active {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--text-on-primary);
}

.main-episode-dot {
  width: 6px;
  height: 6px;
  background: var(--warning);
  border-radius: 50%;
}

.episode-tab.active .main-episode-dot {
  background: white;
}

/* 剧本内容 */
.script-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4) var(--space-5);
  background: var(--bg-base);
}

.loading-state,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-12);
  color: var(--text-secondary);
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-default);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.script-text {
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  line-height: 1.8;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

/* 高亮样式 */
.script-text :deep(.highlight) {
  padding: 2px 4px;
  border-radius: 3px;
  scroll-margin-top: 100px;
}

.script-text :deep(.highlight.evidence) {
  background: var(--error-border);
  border-bottom: 2px solid var(--error);
  color: var(--text-primary);
}

.script-text :deep(.highlight.location) {
  background: var(--warning-muted);
  border-left: 3px solid var(--warning);
  display: inline-block;
  padding-left: 8px;
}

/* 底部 */
.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--border-default);
  background: var(--bg-elevated);
  flex-shrink: 0;
}

.footer-info {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.episode-info {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.highlight-info {
  font-size: var(--text-sm);
  color: var(--warning);
}

.footer-actions {
  display: flex;
  gap: var(--space-3);
}

.btn {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-secondary {
  background: var(--bg-hover);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--bg-active);
}

.btn-primary {
  background: var(--primary);
  border: none;
  color: var(--text-on-primary);
}

.btn-primary:hover {
  background: var(--primary-hover);
}
</style>
