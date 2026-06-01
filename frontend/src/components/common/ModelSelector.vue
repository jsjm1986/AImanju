<template>
  <div class="model-selector">
    <div class="selector-trigger" @click="showDropdown = !showDropdown">
      <span class="model-icon">🤖</span>
      <span class="model-name">{{ currentModel?.displayName || 'Gemini 3 Pro' }}</span>
      <span class="dropdown-arrow" :class="{ open: showDropdown }">▼</span>
    </div>
    
    <div v-if="showDropdown" class="dropdown-menu" @click.stop>
      <div
        v-for="model in models"
        :key="model.name"
        class="dropdown-item"
        :class="{ 
          active: model.name === currentModel?.name,
          testing: testingModel === model.name,
          disabled: testingModel !== null
        }"
        @click="handleModelClick(model)"
      >
        <span class="provider-badge" :class="model.brand">
          {{ model.brand }}
        </span>
        <span class="model-display-name">{{ model.displayName }}</span>
        
        <!-- 状态指示 -->
        <span v-if="testingModel === model.name" class="status-icon testing">⏳</span>
        <span v-else-if="testResults[model.name] === true" class="status-icon success">✓</span>
        <span v-else-if="testResults[model.name] === false" class="status-icon failed">✗</span>
        <span v-else-if="model.name === currentModel?.name" class="status-icon current">●</span>
      </div>
      
      <!-- 测试结果提示 -->
      <div v-if="testMessage" class="test-message" :class="testMessageType">
        {{ testMessage }}
      </div>
    </div>
    
    <!-- 点击外部关闭 -->
    <div v-if="showDropdown" class="backdrop" @click="showDropdown = false"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { aiModelApi } from '@/services/api';

// 硬编码的模型列表
interface ModelInfo {
  name: string;
  displayName: string;
  provider: 'claude' | 'openai';
  brand: string;
}

const AVAILABLE_MODELS: ModelInfo[] = [
  { name: 'glm-night', displayName: '智谱GLM-5', provider: 'openai', brand: '智谱' },
  { name: 'ark-code', displayName: 'Ark Code (豆包)', provider: 'openai', brand: '豆包' },
  { name: 'deepseek-chat', displayName: 'DeepSeek', provider: 'openai', brand: 'DeepSeek' },
  { name: 'gpt-5', displayName: 'GPT-5', provider: 'openai', brand: 'OpenAI' },
  { name: 'gpt-5.1', displayName: 'GPT-5.1', provider: 'openai', brand: 'OpenAI' },
  { name: 'gpt-5.2', displayName: 'GPT-5.2', provider: 'openai', brand: 'OpenAI' },
  { name: 'gpt-5.4', displayName: 'GPT-5.4', provider: 'openai', brand: 'OpenAI' },
  { name: 'gpt-5-codex', displayName: 'GPT-5 Codex', provider: 'openai', brand: 'OpenAI' },
  { name: 'gpt-5-codex-mini', displayName: 'GPT-5 Codex Mini', provider: 'openai', brand: 'OpenAI' },
  { name: 'gpt-5.1-codex', displayName: 'GPT-5.1 Codex', provider: 'openai', brand: 'OpenAI' },
  { name: 'gpt-5.1-codex-mini', displayName: 'GPT-5.1 Codex Mini', provider: 'openai', brand: 'OpenAI' },
  { name: 'gpt-5.1-codex-max', displayName: 'GPT-5.1 Codex Max', provider: 'openai', brand: 'OpenAI' },
  { name: 'gpt-5.2-codex', displayName: 'GPT-5.2 Codex', provider: 'openai', brand: 'OpenAI' },
  { name: 'gpt-5.3-codex', displayName: 'GPT-5.3 Codex', provider: 'openai', brand: 'OpenAI' },
  { name: 'gpt-5.3-codex-spark', displayName: 'GPT-5.3 Codex Spark', provider: 'openai', brand: 'OpenAI' },
  { name: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', provider: 'openai', brand: 'Google' },
  { name: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', provider: 'openai', brand: 'Google' },
  { name: 'gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash Lite', provider: 'openai', brand: 'Google' },
  { name: 'gemini-3-pro-preview', displayName: 'Gemini 3 Pro Preview', provider: 'openai', brand: 'Google' },
  { name: 'gemini-3-flash-preview', displayName: 'Gemini 3 Flash Preview', provider: 'openai', brand: 'Google' },
  { name: 'gemini-3.1-pro-preview', displayName: 'Gemini 3.1 Pro Preview', provider: 'openai', brand: 'Google' },
  { name: 'ds-qwen35-plus', displayName: 'Qwen3.5 Plus', provider: 'openai', brand: '通义' },
  { name: 'ds-kimi-k25', displayName: 'Kimi K2.5', provider: 'openai', brand: 'Kimi' },
  { name: 'ds-glm5', displayName: 'GLM-5 (百炼)', provider: 'openai', brand: '智谱' },
  { name: 'ds-minimax-m25', displayName: 'MiniMax M2.5', provider: 'openai', brand: 'MiniMax' },
  { name: 'ds-qwen3-max', displayName: 'Qwen3 Max', provider: 'openai', brand: '通义' },
];

const models = ref<ModelInfo[]>(AVAILABLE_MODELS);
const currentModel = ref<ModelInfo>(AVAILABLE_MODELS[0]!); // 默认值，会被 onMounted 覆盖
const showDropdown = ref(false);
const testingModel = ref<string | null>(null);
const testResults = ref<Record<string, boolean>>({});
const testMessage = ref('');
const testMessageType = ref<'success' | 'error' | ''>('');

async function handleModelClick(model: ModelInfo) {
  // 如果正在测试，忽略点击
  if (testingModel.value !== null) return;
  
  // 如果是当前模型，不需要切换
  if (model.name === currentModel.value?.name) {
    showDropdown.value = false;
    return;
  }
  
  // 先测试目标模型
  testingModel.value = model.name;
  testMessage.value = `正在测试 ${model.displayName}...`;
  testMessageType.value = '';
  
  try {
    const { data } = await aiModelApi.testModel(model.name);
    
    if (data.success) {
      testResults.value[model.name] = true;
      testMessage.value = `${model.displayName} 可用 (${data.latency}ms)，正在切换...`;
      testMessageType.value = 'success';
      
      // 测试通过，执行切换
      const { data: switchData } = await aiModelApi.switchModel(model.name);
      if (switchData.success) {
        currentModel.value = model;
        // 保存到本地存储
        localStorage.setItem('selected_ai_model', model.name);
        testMessage.value = `已切换到 ${model.displayName}`;
        
        // 延迟关闭
        setTimeout(() => {
          showDropdown.value = false;
          testMessage.value = '';
        }, 1000);
      }
    } else {
      testResults.value[model.name] = false;
      testMessage.value = data.message || '连接失败';
      testMessageType.value = 'error';
    }
  } catch (error) {
    testResults.value[model.name] = false;
    testMessage.value = `测试失败: ${(error as Error).message}`;
    testMessageType.value = 'error';
  } finally {
    testingModel.value = null;
  }

}

// 初始化时恢复选择
onMounted(async () => {
  const savedModelName = localStorage.getItem('selected_ai_model');
  if (savedModelName) {
    const savedModel = models.value.find(m => m.name === savedModelName);
    if (savedModel && savedModel.name !== currentModel.value.name) {
      // 恢复 UI 显示
      currentModel.value = savedModel;
      
      // 同步后端状态（静默同步，失败不报错，因为后端可能已经重启）
      try {
        await aiModelApi.switchModel(savedModel.name);
        console.log(`[ModelSelector] Restored model selection: ${savedModel.name}`);
      } catch (e) {
        console.warn('[ModelSelector] Failed to sync saved model selection', e);
      }
    }
  }
});
</script>

<style scoped>
.model-selector {
  position: relative;
  display: inline-block;
}

.selector-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  transition: all var(--transition-fast);
}

.selector-trigger:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

.model-icon {
  font-size: var(--text-base);
}

.model-name {
  color: var(--text-primary);
  font-weight: var(--font-medium);
}

.testing-indicator {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.dropdown-arrow {
  font-size: 10px;
  color: var(--text-tertiary);
  transition: transform var(--transition-fast);
}

.dropdown-arrow.open {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + var(--space-1));
  left: 0;
  min-width: 240px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 16px var(--overlay-bg);
  z-index: var(--z-dropdown);
  overflow: hidden;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.dropdown-item:hover:not(.disabled) {
  background: var(--bg-hover);
}

.dropdown-item.active {
  background: var(--primary-muted);
}

.dropdown-item.testing {
  background: var(--warning-muted);
}

.dropdown-item.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.provider-badge {
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.provider-badge.智谱 {
  background: rgba(54, 88, 226, 0.15);
  color: #3658e2;
}

.provider-badge.豆包 {
  background: rgba(0, 186, 173, 0.15);
  color: #00baad;
}

.provider-badge.DeepSeek {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.provider-badge.通义 {
  background: rgba(124, 58, 237, 0.15);
  color: #7c3aed;
}

.provider-badge.Kimi {
  background: rgba(34, 34, 34, 0.12);
  color: #333;
}

.provider-badge.MiniMax {
  background: rgba(255, 107, 53, 0.15);
  color: #e85d26;
}

.model-display-name {
  flex: 1;
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.status-icon {
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
}

.status-icon.current {
  color: var(--primary);
}

.status-icon.success {
  color: var(--success);
}

.status-icon.failed {
  color: var(--error);
}

.status-icon.testing {
  animation: spin 1s linear infinite;
}

.test-message {
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-xs);
  border-top: 1px solid var(--border-default);
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.test-message.success {
  color: var(--success);
  background: var(--success-muted);
}

.test-message.error {
  color: var(--error);
  background: var(--error-muted);
}

.backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: calc(var(--z-dropdown) - 1);
}
</style>
