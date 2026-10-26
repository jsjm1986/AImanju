<script setup lang="ts">
/**
 * 角色语言风格编辑器
 * 编辑正式程度、词汇风格、句式特点等
 * Requirements: 7.5
 */
import { ref, watch } from 'vue';
import type { Character, ICharacterVoice, FormalLevel, VocabularyStyle, SentencePattern } from '@/types';

const props = defineProps<{
  character: Character;
  projectId: string;
  voice?: ICharacterVoice;
}>();

const emit = defineEmits<{
  (e: 'update', voice: ICharacterVoice): void;
}>();

const formalLevels: { value: FormalLevel; label: string; desc: string }[] = [
  { value: 'casual', label: '随意', desc: '口语化，使用俚语' },
  { value: 'neutral', label: '中性', desc: '标准用语' },
  { value: 'formal', label: '正式', desc: '书面语，礼貌用语' },
  { value: 'archaic', label: '古风', desc: '文言或古典风格' },
];

const vocabularyStyles: { value: VocabularyStyle; label: string; desc: string }[] = [
  { value: 'simple', label: '简单', desc: '常用词汇' },
  { value: 'technical', label: '专业', desc: '行业术语' },
  { value: 'literary', label: '文学', desc: '修辞丰富' },
  { value: 'colloquial', label: '口语', desc: '日常用语' },
];

const sentencePatterns: { value: SentencePattern; label: string; desc: string }[] = [
  { value: 'short', label: '短句', desc: '简洁有力' },
  { value: 'long', label: '长句', desc: '详细描述' },
  { value: 'mixed', label: '混合', desc: '灵活变化' },
  { value: 'fragmented', label: '碎片', desc: '断续表达' },
];

// 表单数据
const formData = ref<ICharacterVoice>({
  formalLevel: 'neutral',
  vocabularyStyle: 'simple',
  sentencePattern: 'mixed',
  preferredWords: [],
  avoidedWords: [],
  voiceEvolution: [],
  emotionalAdjustments: [],
});

const newPreferredWord = ref('');
const newAvoidedWord = ref('');

// 初始化
watch(() => props.voice, (voice) => {
  if (voice) {
    formData.value = {
      formalLevel: voice.formalLevel || 'neutral',
      vocabularyStyle: voice.vocabularyStyle || 'simple',
      sentencePattern: voice.sentencePattern || 'mixed',
      preferredWords: [...(voice.preferredWords || [])],
      avoidedWords: [...(voice.avoidedWords || [])],
      voiceEvolution: voice.voiceEvolution || [],
      emotionalAdjustments: voice.emotionalAdjustments || [],
    };
  }
}, { immediate: true });

const addWord = (list: string[], newWord: { value: string }) => {
  const value = newWord.value.trim();
  if (!value || list.includes(value)) return;
  list.push(value);
  newWord.value = '';
  saveVoice();
};

const removeWord = (list: string[], index: number) => {
  list.splice(index, 1);
  saveVoice();
};

const saveVoice = () => {
  emit('update', { ...formData.value });
};
</script>

<template>
  <div class="voice-editor">
    <!-- 正式程度 -->
    <div class="voice-section">
      <div class="section-header">
        <span class="section-icon">📝</span>
        <span class="section-title">正式程度</span>
      </div>
      <div class="option-grid">
        <label
          v-for="level in formalLevels"
          :key="level.value"
          class="option-card"
          :class="{ selected: formData.formalLevel === level.value }"
        >
          <input
            type="radio"
            :value="level.value"
            v-model="formData.formalLevel"
            @change="saveVoice"
            class="option-radio"
          />
          <div class="option-content">
            <div class="option-label">{{ level.label }}</div>
            <div class="option-desc">{{ level.desc }}</div>
          </div>
        </label>
      </div>
    </div>

    <!-- 词汇风格 -->
    <div class="voice-section">
      <div class="section-header">
        <span class="section-icon">📚</span>
        <span class="section-title">词汇风格</span>
      </div>
      <div class="option-grid">
        <label
          v-for="style in vocabularyStyles"
          :key="style.value"
          class="option-card"
          :class="{ selected: formData.vocabularyStyle === style.value }"
        >
          <input
            type="radio"
            :value="style.value"
            v-model="formData.vocabularyStyle"
            @change="saveVoice"
            class="option-radio"
          />
          <div class="option-content">
            <div class="option-label">{{ style.label }}</div>
            <div class="option-desc">{{ style.desc }}</div>
          </div>
        </label>
      </div>
    </div>

    <!-- 句式特点 -->
    <div class="voice-section">
      <div class="section-header">
        <span class="section-icon">✍️</span>
        <span class="section-title">句式特点</span>
      </div>
      <div class="option-grid">
        <label
          v-for="pattern in sentencePatterns"
          :key="pattern.value"
          class="option-card"
          :class="{ selected: formData.sentencePattern === pattern.value }"
        >
          <input
            type="radio"
            :value="pattern.value"
            v-model="formData.sentencePattern"
            @change="saveVoice"
            class="option-radio"
          />
          <div class="option-content">
            <div class="option-label">{{ pattern.label }}</div>
            <div class="option-desc">{{ pattern.desc }}</div>
          </div>
        </label>
      </div>
    </div>

    <!-- 偏好用词 -->
    <div class="voice-section">
      <div class="section-header">
        <span class="section-icon">✅</span>
        <span class="section-title">偏好用词</span>
      </div>
      <div class="tag-list">
        <span v-for="(word, idx) in formData.preferredWords" :key="idx" class="tag preferred">
          {{ word }}
          <button class="tag-remove" @click="removeWord(formData.preferredWords, idx)" aria-label="移除">×</button>
        </span>
        <div class="tag-input-wrapper">
          <input
            v-model="newPreferredWord"
            type="text"
            class="tag-input"
            placeholder="添加偏好词..."
            @keyup.enter="addWord(formData.preferredWords, { value: newPreferredWord }); newPreferredWord = ''"
          />
          <button class="tag-add" @click="addWord(formData.preferredWords, { value: newPreferredWord }); newPreferredWord = ''" aria-label="添加">+</button>
        </div>
      </div>
    </div>

    <!-- 避免用词 -->
    <div class="voice-section">
      <div class="section-header">
        <span class="section-icon">🚫</span>
        <span class="section-title">避免用词</span>
      </div>
      <div class="tag-list">
        <span v-for="(word, idx) in formData.avoidedWords" :key="idx" class="tag avoided">
          {{ word }}
          <button class="tag-remove" @click="removeWord(formData.avoidedWords, idx)" aria-label="移除">×</button>
        </span>
        <div class="tag-input-wrapper">
          <input
            v-model="newAvoidedWord"
            type="text"
            class="tag-input"
            placeholder="添加避免词..."
            @keyup.enter="addWord(formData.avoidedWords, { value: newAvoidedWord }); newAvoidedWord = ''"
          />
          <button class="tag-add avoided" @click="addWord(formData.avoidedWords, { value: newAvoidedWord }); newAvoidedWord = ''" aria-label="添加">+</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.voice-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.voice-section {
  background: var(--bg-base);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.section-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.section-icon {
  font-size: 16px;
}

.section-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.option-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);
}

@media (min-width: 768px) {
  .option-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.option-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s;
}

.option-card:hover {
  border-color: var(--border-hover);
}

.option-card.selected {
  background: var(--primary-muted);
  border-color: var(--primary);
}

.option-radio {
  margin-top: 2px;
  accent-color: var(--primary);
}

.option-content {
  flex: 1;
}

.option-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.option-desc {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
}

.tag.preferred {
  background: var(--success-muted);
  color: var(--success);
  border: 1px solid var(--success-border);
}

.tag.avoided {
  background: #fee2e2;
  color: var(--error);
  border: 1px solid var(--error-border);
}

.tag-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  background: transparent;
  border: none;
  border-radius: var(--radius-full);
  font-size: 14px;
  color: inherit;
  opacity: 0.6;
  cursor: pointer;
}

.tag-remove:hover {
  opacity: 1;
}

.tag-input-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.tag-input {
  width: 120px;
  padding: var(--space-1) var(--space-2);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.tag-input:focus {
  outline: none;
  border-color: var(--primary);
}

.tag-add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--success);
  border: none;
  border-radius: var(--radius-full);
  font-size: 14px;
  color: var(--text-on-primary);
  cursor: pointer;
}

.tag-add.avoided {
  background: var(--error);
}
</style>
