<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="rewrite-overlay" @click.self="handleClose">
        <div class="rewrite-modal">
          <div class="modal-header">
            <div class="header-left">
              <span class="header-icon">✨</span>
              <h3>AI 智能改写</h3>
              <button class="help-btn" @click="showHelp = true" title="查看说明">
                <span>?</span>
              </button>
            </div>
            <button class="close-btn" @click="handleClose" :disabled="rewriteStore.loading">
              <span>×</span>
            </button>
          </div>

          <div class="modal-body">
            <div class="config-section" :class="{ collapsed: configCollapsed && hasResult }">
              <div
                v-if="hasResult"
                class="config-collapse-header"
                @click="configCollapsed = !configCollapsed"
              >
                <span class="collapse-icon">{{ configCollapsed ? '▶' : '▼' }}</span>
                <span class="collapse-title">改写配置</span>
                <span class="collapse-summary" v-if="configCollapsed">
                  {{ modeLabel }} · {{ instruction.slice(0, 20) }}{{ instruction.length > 20 ? '...' : '' }}
                </span>
                <span class="collapse-hint">{{ configCollapsed ? '点击展开' : '点击折叠' }}</span>
              </div>

              <div class="config-content" v-show="!configCollapsed || !hasResult">
                <div class="mode-section">
                  <div class="section-header">
                    <label>改写模式</label>
                    <button class="mode-help-btn" @click="showHelp = true">
                      了解各模式区别 →
                    </button>
                  </div>
                  <div class="mode-options">
                    <label
                      v-for="mode in modeOptions"
                      :key="mode.value"
                      class="mode-option"
                      :class="{ active: rewriteType === mode.value, disabled: mode.value === 'selection' && !selection }"
                    >
                      <input type="radio" v-model="rewriteType" :value="mode.value" :disabled="mode.value === 'selection' && !selection" />
                      <div class="mode-card">
                        <span class="mode-icon">{{ mode.icon }}</span>
                        <div class="mode-info">
                          <span class="mode-title">{{ mode.title }}</span>
                          <span class="mode-desc">{{ mode.desc }}</span>
                        </div>
                        <span v-if="mode.badge || (mode.value === 'selection' && selection)" class="mode-badge" :class="mode.badgeClass">{{ mode.value === 'selection' && selection ? '已选中' : mode.badge }}</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div v-if="selection && rewriteType === 'selection'" class="selection-preview">
                  <div class="preview-header">
                    <span class="preview-label">📌 选中的文本</span>
                    <span class="preview-count">{{ selection.text.length }} 字</span>
                  </div>
                  <div class="preview-content">{{ selection.text }}</div>
                </div>

                <div class="instruction-section">
                  <div class="section-header">
                    <label>{{ instructionLabel }}</label>
                    <div class="quick-tags">
                      <button
                        v-for="tag in currentQuickTags"
                        :key="tag.value"
                        class="quick-tag"
                        @click="appendInstruction(tag.value)"
                        :disabled="rewriteStore.loading"
                      >
                        {{ tag.label }}
                      </button>
                    </div>
                  </div>
                  <textarea
                    v-model="instruction"
                    :placeholder="instructionPlaceholder"
                    rows="3"
                    :disabled="rewriteStore.loading"
                    class="instruction-input"
                  ></textarea>
                </div>
              </div>
            </div>

            <div v-if="rewriteStore.streaming" class="streaming-section">
              <div class="streaming-header">
                <span class="streaming-icon">
                  <span class="dot"></span>
                  <span class="dot"></span>
                  <span class="dot"></span>
                </span>
                <span>AI 正在改写中...</span>
              </div>
              <div ref="streamingContentRef" class="streaming-content">{{ rewriteStore.streamingContent }}</div>
            </div>

            <div v-if="rewriteStore.currentRewrite && !rewriteStore.streaming" class="result-section">
              <div class="result-header">
                <span class="result-icon">✅</span>
                <span>改写完成</span>
              </div>
              <DiffViewer
                :diff="rewriteStore.currentRewrite.diff"
                :original-content="rewriteStore.currentRewrite.originalContent"
                :modified-content="rewriteStore.currentRewrite.rewrittenContent"
              />
            </div>
          </div>

          <div class="modal-footer">
            <div v-if="rewriteStore.error" class="error-banner">
              <span class="error-icon">⚠️</span>
              <span>{{ rewriteStore.error }}</span>
            </div>

            <div class="footer-actions">
              <template v-if="!rewriteStore.currentRewrite && !rewriteStore.streaming">
                <button class="btn-cancel" @click="handleClose">取消</button>
                <button
                  class="btn-primary"
                  @click="handleRewrite"
                  :disabled="!instruction.trim() || rewriteStore.loading"
                >
                  <span class="btn-icon">✨</span>
                  开始改写
                </button>
              </template>
              <template v-else-if="rewriteStore.streaming">
                <button class="btn-cancel" disabled>请等待...</button>
              </template>
              <template v-else>
                <button class="btn-secondary" @click="handleRewrite" :disabled="rewriteStore.loading">
                  🔄 重新改写
                </button>
                <button class="btn-cancel" @click="handleClose">放弃</button>
                <button class="btn-success" @click="handleApply" :disabled="rewriteStore.loading">
                  <span class="btn-icon">✓</span>
                  应用改写
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="modal">
      <div v-if="showHelp" class="help-overlay" @click.self="showHelp = false">
        <div class="help-modal">
          <div class="help-header">
            <h3>📖 改写模式说明</h3>
            <button class="close-btn" @click="showHelp = false">×</button>
          </div>
          <div class="help-content">
            <div class="help-item">
              <div class="help-item-header">
                <span class="help-icon">✂️</span>
                <span class="help-title">局部改写</span>
              </div>
              <p class="help-desc">
                先在剧本中<strong>选中要修改的文字</strong>，然后打开改写弹窗。
                AI 只会改写你选中的部分，其他内容保持不变。
              </p>
              <div class="help-example">
                <span class="example-label">适用场景：</span>
                修改某段对话、优化某个场景描写、调整某个角色的台词
              </div>
            </div>
            <div class="help-item recommend">
              <div class="help-item-header">
                <span class="help-icon">🎯</span>
                <span class="help-title">智能改写</span>
                <span class="help-badge">推荐</span>
              </div>
              <p class="help-desc">
                告诉 AI 你想要什么效果，AI 会<strong>自动找到需要修改的地方</strong>进行优化，
                不需要的部分会保持原样。
              </p>
              <div class="help-example">
                <span class="example-label">适用场景：</span>
                增强冲突感、加快节奏、优化对话、增加爽点
              </div>
            </div>
            <div class="help-item warning">
              <div class="help-item-header">
                <span class="help-icon">📄</span>
                <span class="help-title">全文重写</span>
                <span class="help-badge">谨慎使用</span>
              </div>
              <p class="help-desc">
                AI 会<strong>重新生成整集剧本</strong>，适合对当前内容非常不满意、
                想要完全不同风格的情况。
              </p>
              <div class="help-example">
                <span class="example-label">注意：</span>
                耗时较长，且可能改变剧情走向，建议先尝试智能改写
              </div>
            </div>
            <div class="help-tips">
              <div class="tips-title">💡 使用技巧</div>
              <ul>
                <li>改写指令越具体，效果越好</li>
                <li>可以点击快捷标签快速添加常用指令</li>
                <li>改写后可以预览差异，不满意可以重新改写</li>
                <li>确认满意后再点击"应用改写"保存</li>
              </ul>
            </div>
          </div>
          <div class="help-footer">
            <button class="btn-primary" @click="showHelp = false">我知道了</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed, onUnmounted, nextTick } from 'vue';
import { useRewriteStore } from '@/stores/rewriteStore';
import DiffViewer from './DiffViewer.vue';

type RewriteType = 'full' | 'selection' | 'instruction';

const MODE_CONFIG: Record<RewriteType, { label: string; placeholder: string; tags: { label: string; value: string }[] }> = {
  selection: {
    label: '改写要求',
    placeholder: '描述如何改写选中的文字，例如：\n• 让对话更有张力\n• 增加情感描写',
    tags: [
      { label: '更有张力', value: '让这段内容更有张力和冲突感' },
      { label: '丰富细节', value: '丰富细节描写，增加画面感' },
      { label: '优化对话', value: '优化对话，让语言更自然' },
      { label: '加强情感', value: '加强情感表达，更打动人' },
    ],
  },
  instruction: {
    label: '改写指令',
    placeholder: '描述你想要的改写效果，AI 会自动定位修改，例如：\n• 增强冲突感，让剧情更紧张\n• 优化对话，让角色更有个性',
    tags: [
      { label: '增强冲突', value: '增强情感冲突，让对话更有张力' },
      { label: '加快节奏', value: '加快叙事节奏，删除冗余描写' },
      { label: '丰富细节', value: '丰富环境和动作细节描写' },
      { label: '优化对话', value: '优化对话，让语言更自然生动' },
      { label: '增加爽点', value: '增加爽点和高潮情节' },
    ],
  },
  full: {
    label: '重写要求',
    placeholder: '描述你想要的整体风格，例如：\n• 整体加快节奏，删除冗余\n• 增加更多爽点和高潮',
    tags: [
      { label: '整体提速', value: '整体加快节奏，删除冗余描写' },
      { label: '增加爽点', value: '增加爽点和高潮情节' },
      { label: '强化冲突', value: '强化矛盾冲突，增加戏剧性' },
      { label: '优化结构', value: '优化剧情结构，让故事更流畅' },
    ],
  },
};

const MODE_LABELS: Record<RewriteType, string> = { selection: '局部改写', instruction: '智能改写', full: '全文重写' };

const modeOptions = [
  { value: 'selection' as RewriteType, icon: '✂️', title: '局部改写', desc: '只改写选中的文字', badge: null as string | null, badgeClass: '' },
  { value: 'instruction' as RewriteType, icon: '🎯', title: '智能改写', desc: 'AI 自动定位并修改', badge: '推荐', badgeClass: 'recommend' },
  { value: 'full' as RewriteType, icon: '📄', title: '全文重写', desc: '重新生成整集内容', badge: '耗时较长', badgeClass: 'warning' },
];

const streamingContentRef = ref<HTMLElement | null>(null);

const props = defineProps<{
  visible: boolean;
  projectId: string;
  episodeId: string;
  episodeNumber: number;
  selection?: { start: number; end: number; text: string };
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'applied', content: string): void;
}>();

const rewriteStore = useRewriteStore();
const instruction = ref('');
const rewriteType = ref<RewriteType>('instruction');
const showHelp = ref(false);
const configCollapsed = ref(false);

const hasResult = computed(() => rewriteStore.currentRewrite || rewriteStore.streaming);
const modeLabel = computed(() => MODE_LABELS[rewriteType.value]);
const instructionLabel = computed(() => MODE_CONFIG[rewriteType.value].label);
const instructionPlaceholder = computed(() => MODE_CONFIG[rewriteType.value].placeholder);
const currentQuickTags = computed(() => MODE_CONFIG[rewriteType.value].tags);

function appendInstruction(text: string) {
  instruction.value = instruction.value ? instruction.value + '，' + text : text;
}

watch(() => props.selection, (sel) => {
  rewriteType.value = sel ? 'selection' : 'instruction';
}, { immediate: true });

watch(() => props.visible, (v) => {
  if (!v) {
    instruction.value = '';
    configCollapsed.value = false;
    rewriteStore.clearCurrentRewrite();
  }
});

watch(() => rewriteStore.currentRewrite, (r) => { if (r) configCollapsed.value = true; });

watch(() => rewriteStore.streamingContent, () => {
  nextTick(() => {
    if (streamingContentRef.value) {
      streamingContentRef.value.scrollTop = streamingContentRef.value.scrollHeight;
    }
  });
});

onUnmounted(() => { rewriteStore.clearCurrentRewrite(); });

async function handleRewrite() {
  if (!instruction.value.trim()) return;
  try {
    await rewriteStore.rewriteStream({
      projectId: props.projectId,
      episodeId: props.episodeId,
      episodeNumber: props.episodeNumber,
      type: rewriteType.value,
      instruction: instruction.value,
      selection: props.selection,
    });
  } catch (err) {
    console.error('改写失败:', err);
  }
}

async function handleApply() {
  if (!rewriteStore.currentRewrite) return;
  const rewrittenContent = rewriteStore.currentRewrite.rewrittenContent;
  try {
    await rewriteStore.applyRewrite(rewriteStore.currentRewrite.historyId, props.projectId);
    emit('applied', rewrittenContent);
    emit('close');
  } catch (err) {
    console.error('应用改写失败:', err);
  }
}

function handleClose() {
  if (rewriteStore.loading || rewriteStore.streaming) return;
  emit('close');
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .rewrite-modal,
.modal-enter-active .help-modal,
.modal-leave-active .rewrite-modal,
.modal-leave-active .help-modal {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .rewrite-modal,
.modal-enter-from .help-modal,
.modal-leave-to .rewrite-modal,
.modal-leave-to .help-modal {
  transform: scale(0.95) translateY(-10px);
  opacity: 0;
}

.rewrite-overlay,
.help-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-5);
}

.help-overlay {
  z-index: 1001;
}

.rewrite-modal {
  background: var(--bg-surface);
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 90vw;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-default);
  box-shadow: 0 24px 48px var(--overlay-bg);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  background: linear-gradient(135deg, var(--primary-muted) 0%, transparent 100%);
  border-bottom: 1px solid var(--border-default);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.header-icon {
  font-size: 20px;
}

.modal-header h3 {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.help-btn {
  width: 20px;
  height: 20px;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  border-radius: 50%;
  font-size: 12px;
  color: var(--text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast);
}

.help-btn:hover {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--text-on-primary);
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--bg-elevated);
  font-size: 20px;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast);
}

.close-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.close-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-height: 0;
}

.config-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  flex-shrink: 0;
}

.config-section.collapsed {
  gap: 0;
}

.config-collapse-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.config-collapse-header:hover {
  background: var(--bg-hover);
  border-color: var(--primary);
}

.collapse-icon {
  font-size: 10px;
  color: var(--text-tertiary);
  transition: transform var(--duration-fast);
}

.collapse-title {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.collapse-summary {
  flex: 1;
  font-size: 12px;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collapse-hint {
  font-size: 11px;
  color: var(--text-muted);
}

.config-collapse-header:hover .collapse-hint {
  color: var(--primary);
}

.config-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.mode-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-header label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.mode-help-btn {
  background: none;
  border: none;
  font-size: 12px;
  color: var(--primary);
  cursor: pointer;
  padding: 0;
}

.mode-help-btn:hover {
  text-decoration: underline;
}

.mode-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}

.mode-option {
  cursor: pointer;
}

.mode-option input {
  display: none;
}

.mode-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--bg-elevated);
  border: 2px solid var(--border-default);
  border-radius: var(--radius-md);
  transition: all var(--duration-fast);
  position: relative;
}

.mode-option:hover:not(.disabled) .mode-card {
  border-color: var(--border-hover);
}

.mode-option.active .mode-card {
  border-color: var(--primary);
  background: var(--primary-muted);
}

.mode-option.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mode-icon {
  font-size: 24px;
}

.mode-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.mode-title {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.mode-desc {
  font-size: 11px;
  color: var(--text-tertiary);
  text-align: center;
}

.mode-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  padding: 2px 6px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  font-size: 10px;
  color: var(--text-tertiary);
}

.mode-badge.recommend {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--text-on-primary);
}

.mode-badge.warning {
  background: var(--warning);
  border-color: var(--warning);
  color: var(--text-on-primary);
}

.selection-preview {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-hover);
  border-bottom: 1px solid var(--border-default);
}

.preview-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.preview-count {
  font-size: 11px;
  color: var(--text-tertiary);
}

.preview-content {
  padding: var(--space-3);
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
  color: var(--text-secondary);
  min-height: 60px;
  max-height: 120px;
  overflow-y: auto;
  white-space: pre-wrap;
}

.instruction-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.quick-tags {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.quick-tag {
  padding: var(--space-1) var(--space-2);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.quick-tag:hover:not(:disabled) {
  background: var(--primary-muted);
  border-color: var(--primary);
  color: var(--primary);
}

.quick-tag:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.instruction-input {
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
  transition: border-color var(--duration-fast);
  box-sizing: border-box;
}

.instruction-input::placeholder {
  color: var(--text-muted);
}

.instruction-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-muted);
}

.instruction-input:disabled {
  opacity: 0.6;
}

.streaming-section {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.streaming-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--primary-muted);
  border-bottom: 1px solid var(--border-default);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--primary);
}

.streaming-icon {
  display: flex;
  gap: 3px;
}

.streaming-icon .dot {
  width: 6px;
  height: 6px;
  background: var(--primary);
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.streaming-icon .dot:nth-child(1) { animation-delay: -0.32s; }
.streaming-icon .dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.streaming-content {
  padding: var(--space-3);
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
  color: var(--text-secondary);
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
}

.result-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  flex: 1;
  min-height: 0;
}

.result-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--success);
}

.result-icon {
  font-size: 16px;
}

.modal-footer {
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--border-default);
  background: var(--bg-elevated);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.error-banner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--error-muted);
  border: 1px solid var(--error-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--error);
}

.error-icon {
  font-size: 14px;
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.btn-primary,
.btn-success,
.btn-secondary,
.btn-cancel {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.btn-primary {
  background: var(--primary);
  color: var(--text-on-primary);
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn-success {
  background: var(--success);
  color: var(--text-on-primary);
}

.btn-success:hover:not(:disabled) {
  background: var(--success);
}

.btn-secondary {
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-hover);
}

.btn-cancel {
  background: transparent;
  color: var(--text-secondary);
}

.btn-cancel:hover:not(:disabled) {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.btn-primary:disabled,
.btn-success:disabled,
.btn-secondary:disabled,
.btn-cancel:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  font-size: 14px;
}

.help-modal {
  background: var(--bg-surface);
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 520px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-default);
  box-shadow: 0 24px 48px var(--overlay-bg);
  overflow: hidden;
}

.help-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-default);
}

.help-header h3 {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.help-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.help-item {
  padding: var(--space-4);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
}

.help-item.recommend {
  border-color: var(--primary);
  background: var(--primary-muted);
}

.help-item.warning {
  border-color: var(--warning);
}

.help-item-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.help-icon {
  font-size: 20px;
}

.help-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.help-badge {
  padding: 2px 8px;
  background: var(--primary);
  color: var(--text-on-primary);
  border-radius: var(--radius-full);
  font-size: 10px;
  font-weight: var(--font-medium);
}

.help-item.warning .help-badge {
  background: var(--warning);
}

.help-desc {
  margin: 0 0 var(--space-2);
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
  color: var(--text-secondary);
}

.help-desc strong {
  color: var(--text-primary);
}

.help-example {
  font-size: 12px;
  color: var(--text-tertiary);
  padding: var(--space-2);
  background: var(--bg-surface);
  border-radius: var(--radius-sm);
}

.example-label {
  color: var(--text-secondary);
  font-weight: var(--font-medium);
}

.help-tips {
  padding: var(--space-4);
  background: var(--success-muted);
  border: 1px solid var(--success);
  border-radius: var(--radius-md);
}

.tips-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--success);
  margin-bottom: var(--space-2);
}

.help-tips ul {
  margin: 0;
  padding-left: var(--space-4);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: var(--leading-relaxed);
}

.help-tips li {
  margin-bottom: var(--space-1);
}

.help-footer {
  padding: var(--space-4) var(--space-5);
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-default);
  display: flex;
  justify-content: center;
}
</style>
