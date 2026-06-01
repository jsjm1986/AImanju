<script setup lang="ts">
/**
 * 角色增强管理面板
 * 包含魅力特征、成长弧线、语言风格、关系图谱和形态追踪的管理
 * Requirements: 7.5
 */
import { ref, watch } from 'vue';
import { characterEnhancementApi, worldStateApi, type ICharacterEnhancementResponse } from '@/services/api';
import { useToast } from '@/composables/useToast';
import type { Character, ICharacterRelationshipData } from '@/types';
import type { ICharacterState } from '@/types/worldState';
import CharacterCharmEditor from './CharacterCharmEditor.vue';
import CharacterArcVisualization from './CharacterArcVisualization.vue';
import CharacterRelationshipGraph from './CharacterRelationshipGraph.vue';
import CharacterVoiceEditor from './CharacterVoiceEditor.vue';
import CharacterFormPanel from './CharacterFormPanel.vue';

const props = defineProps<{
  character: Character;
  projectId: string;
  allCharacters: Character[];
}>();

const emit = defineEmits<{
  (e: 'updated'): void;
}>();

const toast = useToast();
const activeTab = ref<'charm' | 'arc' | 'voice' | 'relationships' | 'form'>('charm');
const loading = ref(false);
const enhancement = ref<ICharacterEnhancementResponse | null>(null);
const relationships = ref<ICharacterRelationshipData[]>([]);
const characterState = ref<ICharacterState | null>(null);

const tabs = [
  { key: 'charm', label: '魅力特征', icon: '✨' },
  { key: 'arc', label: '成长弧线', icon: '📈' },
  { key: 'voice', label: '语言风格', icon: '💬' },
  { key: 'relationships', label: '关系图谱', icon: '🔗' },
  { key: 'form', label: '形态追踪', icon: '🔮' },
] as const;

const loadEnhancement = async () => {
  if (!props.character?._id) return;
  loading.value = true;
  try {
    const [enhRes, relRes, wsRes] = await Promise.all([
      characterEnhancementApi.get(props.character._id, props.projectId),
      characterEnhancementApi.getRelationships(props.character._id, props.projectId),
      worldStateApi.get(props.projectId),
    ]);
    enhancement.value = enhRes.data.enhancement;
    relationships.value = relRes.data.relationships || [];
    
    // 从 WorldState 获取角色状态（包含形态信息）
    if (wsRes.data.exists && wsRes.data.worldState) {
      const characters = wsRes.data.worldState.characters || {};
      characterState.value = characters[props.character.name] || null;
    }
  } catch (error) {
    console.error('加载角色增强数据失败:', error);
  } finally {
    loading.value = false;
  }
};

watch(() => props.character?._id, loadEnhancement, { immediate: true });

const handleCharmUpdate = async (charm: ICharacterEnhancementResponse['charm']) => {
  try {
    await characterEnhancementApi.updateCharm(props.character._id, {
      projectId: props.projectId,
      characterName: props.character.name,
      charm,
    });
    toast.success('魅力特征已更新');
    await loadEnhancement();
    emit('updated');
  } catch (error) {
    toast.error('更新失败');
  }
};

const handleArcUpdate = async () => {
  await loadEnhancement();
  emit('updated');
};

const handleVoiceUpdate = async (voice: ICharacterEnhancementResponse['voice']) => {
  try {
    await characterEnhancementApi.updateVoice(props.character._id, {
      projectId: props.projectId,
      characterName: props.character.name,
      voice,
    });
    toast.success('语言风格已更新');
    await loadEnhancement();
    emit('updated');
  } catch (error) {
    toast.error('更新失败');
  }
};

const handleRelationshipUpdate = async () => {
  await loadEnhancement();
  emit('updated');
};
</script>

<template>
  <div class="enhancement-panel">
    <div class="panel-header">
      <h3 class="panel-title">角色增强</h3>
      <div class="tab-nav">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="tab-btn"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          <span class="tab-label">{{ tab.label }}</span>
        </button>
      </div>
    </div>

    <div class="panel-body" v-if="!loading">
      <CharacterCharmEditor
        v-if="activeTab === 'charm'"
        :character="character"
        :project-id="projectId"
        :charm="enhancement?.charm"
        @update="handleCharmUpdate"
      />
      <CharacterArcVisualization
        v-else-if="activeTab === 'arc'"
        :character="character"
        :project-id="projectId"
        :arc="enhancement?.arc"
        @update="handleArcUpdate"
      />
      <CharacterVoiceEditor
        v-else-if="activeTab === 'voice'"
        :character="character"
        :project-id="projectId"
        :voice="enhancement?.voice"
        @update="handleVoiceUpdate"
      />
      <CharacterRelationshipGraph
        v-else-if="activeTab === 'relationships'"
        :character="character"
        :project-id="projectId"
        :relationships="relationships"
        :all-characters="allCharacters"
        @update="handleRelationshipUpdate"
      />
      <CharacterFormPanel
        v-else-if="activeTab === 'form'"
        :current-form="characterState?.currentForm"
        :base-form="characterState?.baseForm"
        :unlocked-forms="characterState?.unlockedForms"
        :form-history="characterState?.formHistory"
      />
    </div>

    <div v-else class="loading-state">
      <span class="loading-spinner">⏳</span>
      <span>加载中...</span>
    </div>
  </div>
</template>

<style scoped>
.enhancement-panel {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.panel-header {
  padding: var(--space-4);
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-elevated);
}

.panel-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-3);
}

.tab-nav {
  display: flex;
  gap: var(--space-2);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.tab-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.tab-btn.active {
  background: var(--primary-muted);
  border-color: var(--primary);
  color: var(--primary);
}

.tab-icon {
  font-size: 14px;
}

.panel-body {
  padding: var(--space-4);
  min-height: 300px;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-8);
  color: var(--text-tertiary);
}

.loading-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
