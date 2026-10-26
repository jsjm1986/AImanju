<template>
  <div class="model-selector">
    <button
      ref="triggerRef"
      type="button"
      class="selector-trigger"
      :aria-expanded="showDropdown"
      aria-controls="model-menu"
      @click="toggleDropdown"
      @keydown.escape="closeMenu(true)"
    >
      <span class="model-icon">🤖</span>
      <span class="model-name">{{ triggerLabel }}</span>
      <span class="dropdown-arrow" :class="{ open: showDropdown }">▼</span>
    </button>

    <div
      v-if="showDropdown"
      id="model-menu"
      class="dropdown-menu"
      role="region"
      aria-label="模型选择"
      @click.stop
      @keydown.escape="closeMenu(true)"
    >
      <div v-if="loadingModels" class="menu-state">加载模型中...</div>
      <div v-else-if="loadError" class="test-message error">
        {{ loadError }}
        <button type="button" class="retry-btn" @click="loadModels">重试</button>
      </div>
      <template v-else>
        <div v-if="models.length === 0" class="menu-state">暂无可用模型，请先配置 API 密钥</div>
        <div
          v-for="model in models"
          :key="model.name"
          class="dropdown-item"
          :class="{ active: model.name === currentModel?.name, testing: testingModel === model.name, disabled: !model.configured }"
        >
          <button
            type="button"
            class="item-main"
            :disabled="loadingModels || testingModel !== null || !model.configured || model.name === currentModel?.name"
            :title="model.configured ? `切换到 ${model.displayName}` : (model.unavailableReason || '未配置')"
            @click="handleModelClick(model)"
          >
            <span class="provider-badge" :class="model.brand">{{ model.brand }}</span>
            <span class="model-display-name">
              {{ model.displayName }}
              <span class="actual-model">{{ model.model }}</span>
            </span>
            <span v-if="!model.configured" class="unconfigured-tag">{{ model.unavailableReason || '未配置' }}</span>
            <span v-if="testingModel === model.name" class="status-icon testing">⏳</span>
            <span v-else-if="testResults[model.name] === true" class="status-icon success">✓</span>
            <span v-else-if="testResults[model.name] === false" class="status-icon failed">✗</span>
            <span v-else-if="model.name === currentModel?.name" class="status-icon current" aria-label="当前使用">●</span>
          </button>
          <button
            v-if="model.name === currentModel?.name && model.configured"
            type="button"
            class="item-test"
            :disabled="testingModel !== null"
            @click="testCurrentModel(model)"
          >测试当前模型</button>
        </div>
        <div v-if="currentModel && !currentModel.configured" class="menu-state warn">
          当前模型 {{ currentModel.displayName }} {{ currentModel.unavailableReason || '未配置' }}，请先在服务端配置后重试
        </div>
        <div v-if="testMessage" class="test-message" :class="testMessageType" role="status">
          {{ testMessage }}
          <button v-if="lastFailedModel" type="button" class="retry-btn" @click="retryTest">重试</button>
        </div>
      </template>
    </div>
    <div v-if="showDropdown" class="backdrop" @click="closeMenu()"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { aiModelApi, type AIModel } from '@/services/api';
import { humanizeError } from '@/services/apiConfig';

const models = ref<AIModel[]>([]);
const currentModel = ref<AIModel | null>(null);
const showDropdown = ref(false);
const loadingModels = ref(false);
const testingModel = ref<string | null>(null);
const testResults = ref<Record<string, boolean>>({});
const testMessage = ref('');
const testMessageType = ref<'success' | 'error' | ''>('');
const loadError = ref('');
const lastFailedModel = ref<AIModel | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
let loadSeq = 0;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

const triggerLabel = computed(() => {
  const m = currentModel.value;
  if (!m) return '选择模型';
  return m.model ? `${m.displayName} (${m.model})` : m.displayName;
});

async function loadModels() {
  const seq = ++loadSeq;
  loadingModels.value = true;
  loadError.value = '';
  try {
    const { data } = await aiModelApi.getModels();
    if (seq !== loadSeq) return; // 过期的加载结果不得覆盖更新的状态
    models.value = data.models;
    // 列表响应已含当前模型名（单原子数据源）
    currentModel.value = data.models.find(m => m.name === data.currentModel) || null;
    testResults.value = {}; // 配置刷新后清除旧的测试结果标记
  } catch (e) {
    if (seq !== loadSeq) return;
    loadError.value = `加载模型列表失败：${humanizeError(e)}`;
  } finally {
    if (seq === loadSeq) loadingModels.value = false;
  }
}

function toggleDropdown() {
  showDropdown.value = !showDropdown.value;
  if (showDropdown.value) loadModels();
}

function closeMenu(refocus = false) {
  showDropdown.value = false;
  if (refocus) triggerRef.value?.focus();
}

async function runTest(model: AIModel, switchAfter: boolean) {
  testingModel.value = model.name;
  lastFailedModel.value = null;
  testMessage.value = `正在测试 ${model.displayName}...`;
  testMessageType.value = '';
  try {
    const { data } = await aiModelApi.testModel(model.name);
    if (data.success) {
      testResults.value[model.name] = true;
      if (!switchAfter) {
        testMessage.value = `${model.displayName} 连接正常 (${data.latency ?? 0}ms)`;
        testMessageType.value = 'success';
        return;
      }
      testMessage.value = `${model.displayName} 可用 (${data.latency ?? 0}ms)，正在切换...`;
      testMessageType.value = 'success';
      const { data: switchData } = await aiModelApi.switchModel(model.name);
      if (switchData.success) {
        const found = models.value.find(m => m.name === switchData.currentModel.name);
        currentModel.value = found
          ? { ...found, displayName: switchData.currentModel.displayName, model: switchData.currentModel.model }
          : ({ name: switchData.currentModel.name, displayName: switchData.currentModel.displayName, model: switchData.currentModel.model } as AIModel);
        testMessage.value = `已切换到 ${switchData.currentModel.displayName}`;
        hideTimer = setTimeout(() => { closeMenu(); testMessage.value = ''; }, 1000);
      }
    } else {
      testResults.value[model.name] = false;
      lastFailedModel.value = model;
      testMessage.value = humanizeError(new Error(data.message || '连接失败'));
      testMessageType.value = 'error';
    }
  } catch (error) {
    testResults.value[model.name] = false;
    lastFailedModel.value = model;
    testMessage.value = `测试失败: ${humanizeError(error)}`;
    testMessageType.value = 'error';
  } finally {
    testingModel.value = null;
  }
}

async function handleModelClick(model: AIModel) {
  if (testingModel.value !== null || loadingModels.value) return;
  if (!model.configured) return; // disabled 已挡，防御性返回
  if (model.name === currentModel.value?.name) return; // 当前模型用独立"测试当前模型"按钮
  await runTest(model, true);
}

async function testCurrentModel(model: AIModel) {
  if (testingModel.value !== null) return;
  await runTest(model, false);
}

function retryTest() {
  const m = lastFailedModel.value;
  if (!m) return;
  void runTest(m, m.name !== currentModel.value?.name);
}

const onGlobalKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && showDropdown.value) closeMenu(true);
};

onMounted(() => {
  loadModels();
  document.addEventListener('keydown', onGlobalKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onGlobalKeydown);
  if (hideTimer) clearTimeout(hideTimer);
});
</script>

<style scoped>
.model-selector { position: relative; display: inline-block; }
.selector-trigger {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  max-width: min(320px, calc(100vw - 140px));
  background: var(--bg-elevated); border: 1px solid var(--border-default);
  border-radius: var(--radius-md); cursor: pointer; font-size: var(--text-sm);
  transition: all var(--transition-fast); font-family: inherit;
}
.selector-trigger:hover { background: var(--bg-hover); border-color: var(--border-hover); }
.model-icon { font-size: var(--text-base); flex-shrink: 0; }
.model-name {
  color: var(--text-primary); font-weight: var(--font-medium);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.dropdown-arrow { font-size: 10px; color: var(--text-tertiary); transition: transform var(--transition-fast); flex-shrink: 0; }
.dropdown-arrow.open { transform: rotate(180deg); }
.dropdown-menu {
  position: absolute; top: calc(100% + var(--space-1)); right: 0;
  min-width: 280px; max-width: min(360px, calc(100vw - 16px));
  max-height: min(55vh, 440px); overflow-y: auto;
  background: var(--bg-surface); border: 1px solid var(--border-default);
  border-radius: var(--radius-md); box-shadow: 0 4px 16px var(--overlay-bg);
  z-index: var(--z-dropdown);
}
.menu-state {
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm); color: var(--text-secondary);
}
.menu-state.warn {
  color: var(--warning); border-top: 1px solid var(--border-default);
}
.dropdown-item { display: flex; flex-direction: column; }
.item-main {
  display: flex; align-items: center; gap: var(--space-2); width: 100%;
  padding: var(--space-3); cursor: pointer; text-align: left;
  background: none; border: none; font: inherit;
  transition: background var(--transition-fast);
}
.dropdown-item:hover .item-main:not(:disabled) { background: var(--bg-hover); }
.dropdown-item.active .item-main { background: var(--primary-muted); }
.dropdown-item.testing .item-main { background: var(--warning-muted); }
.item-main:disabled { opacity: 0.65; cursor: not-allowed; }
.item-test {
  margin: 0 var(--space-3) var(--space-2);
  padding: 2px var(--space-2); align-self: flex-start;
  font-size: var(--text-xs);
  border: 1px solid var(--border-default); border-radius: var(--radius-sm);
  background: var(--bg-surface); color: var(--text-secondary); cursor: pointer;
}
.item-test:hover { background: var(--bg-hover); }
.provider-badge {
  padding: 2px var(--space-2); border-radius: var(--radius-sm);
  font-size: var(--text-xs); font-weight: var(--font-medium);
  background: rgba(107, 114, 128, 0.15); color: #6b7280; flex-shrink: 0;
}
.provider-badge.OpenAI { background: rgba(16,163,127,.15); color: #10a37f; }
.provider-badge.Google { background: rgba(66,133,244,.15); color: #4285f4; }
.provider-badge.百炼,.provider-badge.Claude { background: rgba(217,119,87,.15); color: #d97757; }
.provider-badge.智谱 { background: rgba(54,88,226,.15); color: #3658e2; }
.provider-badge.豆包 { background: rgba(0,186,173,.15); color: #00baad; }
.provider-badge.DeepSeek { background: rgba(59,130,246,.15); color: #3b82f6; }
.provider-badge.通义 { background: rgba(124,58,237,.15); color: #7c3aed; }
.provider-badge.Kimi { background: rgba(34,34,34,.12); color: #333; }
.provider-badge.MiniMax { background: rgba(255,107,53,.15); color: #e85d26; }
.model-display-name { flex: 1; color: var(--text-primary); font-size: var(--text-sm); min-width: 0; }
.actual-model { display: block; font-size: 10px; color: var(--text-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.unconfigured-tag {
  font-size: 10px; padding: 1px 6px; border-radius: var(--radius-sm);
  background: var(--error-muted); color: var(--error); flex-shrink: 0;
  max-width: 120px; white-space: normal; word-break: break-all;
}
.status-icon { font-size: var(--text-xs); font-weight: var(--font-bold); }
.status-icon.current { color: var(--primary); }
.status-icon.success { color: var(--success); }
.status-icon.failed { color: var(--error); }
.status-icon.testing { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.test-message {
  padding: var(--space-2) var(--space-3); font-size: var(--text-xs);
  border-top: 1px solid var(--border-default);
  background: var(--bg-elevated); color: var(--text-secondary);
  word-break: break-word;
}
.test-message.success { color: var(--success); background: var(--success-muted); }
.test-message.error { color: var(--error); background: var(--error-muted); }
.retry-btn {
  margin-left: var(--space-2); padding: 1px 8px; font-size: var(--text-xs);
  border: 1px solid var(--border-default); border-radius: var(--radius-sm);
  background: var(--bg-surface); color: var(--text-primary); cursor: pointer;
}
.backdrop { position: fixed; inset: 0; z-index: calc(var(--z-dropdown) - 1); }
</style>
