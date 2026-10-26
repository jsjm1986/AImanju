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
          disabled: testingModel !== null || model.configured === false
        }"
        @click="handleModelClick(model)"
      >
        <span class="provider-badge" :class="model.brand">
          {{ model.brand }}
        </span>
        <span class="model-display-name">{{ model.displayName }}</span>
        <span v-if="model.configured === false" class="unconfigured-tag">未配置</span>
        
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
import { aiModelApi, type AIModel } from '@/services/api';

// 模型列表以后端 /ai/models 为唯一来源，用户选择持久化在服务端
type ModelInfo = AIModel;

const models = ref<ModelInfo[]>([]);
const currentModel = ref<ModelInfo | null>(null);
const showDropdown = ref(false);
const loadingModels = ref(false);
const testingModel = ref<string | null>(null);
const testResults = ref<Record<string, boolean>>({});
const testMessage = ref('');
const testMessageType = ref<'success' | 'error' | ''>('');

async function handleModelClick(model: ModelInfo) {
  // 如果正在测试，忽略点击
  if (testingModel.value !== null) return;
  
  // 未配置 API Key 的模型不可选——直接提示，不发起测试
  if (model.configured === false) {
    testMessage.value = `${model.displayName} 未配置 API 密钥，无法使用`;
    testMessageType.value = 'error';
    return;
  }
  
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

// 初始化：从后端拉取模型列表和当前选择（后端已持久化，无需 localStorage）
onMounted(async () => {
  loadingModels.value = true;
  try {
    const { data } = await aiModelApi.getModels();
    models.value = data.models;
    currentModel.value = data.models.find(m => m.name === data.currentModel) || data.models[0] || null;
  } catch (e) {
    console.warn('[ModelSelector] Failed to load models', e);
  } finally {
    loadingModels.value = false;
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
  background: rgba(107, 114, 128, 0.15);
  color: #6b7280;
}

.provider-badge.OpenAI {
  background: rgba(16, 163, 127, 0.15);
  color: #10a37f;
}

.provider-badge.Google {
  background: rgba(66, 133, 244, 0.15);
  color: #4285f4;
}

.provider-badge.百炼,
.provider-badge.Claude {
  background: rgba(217, 119, 87, 0.15);
  color: #d97757;
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

.unconfigured-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  background: var(--error-muted);
  color: var(--error);
  flex-shrink: 0;
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
