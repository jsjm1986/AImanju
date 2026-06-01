<template>
  <div class="outline-display">
    <div v-if="!hasContent" class="empty-state">
      <span class="empty-icon">📝</span>
      <p>暂无大纲内容</p>
    </div>
    
    <div v-else class="outline-content">
      <!-- 解析后的段落显示 -->
      <div 
        v-for="(paragraph, index) in parsedParagraphs" 
        :key="index" 
        class="paragraph"
        :class="paragraph.type"
      >
        <template v-if="paragraph.type === 'heading'">
          <h3 class="paragraph-heading">{{ paragraph.text }}</h3>
        </template>
        <template v-else-if="paragraph.type === 'character-heading'">
          <h4 class="character-heading">👤 {{ paragraph.text }}</h4>
        </template>
        <template v-else>
          <p class="paragraph-text">{{ paragraph.text }}</p>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface OutlineObject {
  raw?: string;
  characterCards?: string;
  synopsis?: string;
  episodeSummaries?: string;
}

const props = defineProps<{
  outline: string | OutlineObject | null | undefined;
}>();

interface Paragraph {
  type: 'heading' | 'character-heading' | 'text';
  text: string;
}

// 获取大纲文本内容
const outlineText = computed(() => {
  if (!props.outline) return '';
  if (typeof props.outline === 'string') return props.outline;
  // 如果是对象，优先使用 raw，否则拼接各部分
  if (props.outline.raw) return props.outline.raw;
  const parts: string[] = [];
  if (props.outline.characterCards) {
    parts.push('### 一、人物卡\n\n' + props.outline.characterCards);
  }
  if (props.outline.synopsis) {
    parts.push('### 二、剧情大纲\n\n' + props.outline.synopsis);
  }
  if (props.outline.episodeSummaries) {
    parts.push('### 三、分集梗概\n\n' + props.outline.episodeSummaries);
  }
  return parts.join('\n\n');
});

const hasContent = computed(() => !!outlineText.value);

// 解析大纲内容
const parsedParagraphs = computed(() => {
  if (!outlineText.value) return [];
  
  const lines = outlineText.value.split('\n');
  const paragraphs: Paragraph[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // 检测标题（### 或 【】）
    if (trimmed.startsWith('###') || trimmed.startsWith('##')) {
      paragraphs.push({
        type: 'heading',
        text: trimmed.replace(/^#+\s*/, '').replace(/[【】]/g, ''),
      });
    } 
    // 检测角色标题（以角色名开头，如 "1.林小满"）
    else if (/^\d+[.、]/.test(trimmed) && trimmed.includes('：')) {
      paragraphs.push({
        type: 'character-heading',
        text: trimmed,
      });
    }
    // 普通段落
    else {
      paragraphs.push({
        type: 'text',
        text: trimmed,
      });
    }
  }
  
  return paragraphs;
});
</script>

<style scoped>
.outline-display {
  padding: var(--space-4);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12);
  color: var(--text-muted);
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: var(--space-4);
}

.outline-content {
  max-width: 800px;
  margin: 0 auto;
}

.paragraph {
  margin-bottom: var(--space-4);
}

.paragraph-heading {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--primary);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-2);
  border-bottom: 2px solid var(--primary-light);
}

.character-heading {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--secondary);
  margin: var(--space-4) 0 var(--space-2);
}

.paragraph-text {
  font-size: var(--text-base);
  line-height: 1.8;
  color: var(--text-secondary);
  text-indent: 2em;
}

/* 响应式 */
@media (max-width: 768px) {
  .outline-display {
    padding: var(--space-3);
  }
  
  .paragraph-text {
    font-size: var(--text-sm);
  }
}
</style>
