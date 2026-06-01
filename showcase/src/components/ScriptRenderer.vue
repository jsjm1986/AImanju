<template>
  <div class="script-renderer">
    <div v-if="!content" class="empty-state">
      <span class="empty-icon">📄</span>
      <p>暂无内容</p>
    </div>
    
    <div v-else class="script-content" v-html="formattedContent"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  content: string;
}>();

// 格式化剧本内容
const formattedContent = computed(() => {
  if (!props.content) return '';
  
  let html = escapeHtml(props.content);
  
  // 场景标题：1-1: 现代办公室-夜 内
  html = html.replace(
    /^(\d+-\d+[:：]\s*.+)$/gm,
    '<div class="scene-header">$1</div>'
  );
  
  // 场景标题备选格式：第1场: xxx
  html = html.replace(
    /^(第\d+场[:：]\s*.+)$/gm,
    '<div class="scene-header">$1</div>'
  );
  
  // 场景标题备选格式：【场景】xxx
  html = html.replace(
    /^(【场景】.+)$/gm,
    '<div class="scene-header">$1</div>'
  );
  
  // 描述：△ 开头的内容
  html = html.replace(
    /^(△.+)$/gm,
    '<div class="description">$1</div>'
  );
  
  // 角色名（带动作）：林小满（疲惫地）：
  html = html.replace(
    /^(.+?)（([^）]+)）[:：]/gm,
    '<span class="character">$1</span><span class="action">（$2）</span>：'
  );
  
  // 角色名（不带动作）：林小满：
  // 排除场景行（包含日/夜/内/外）
  html = html.replace(
    /^([^\d<△【].+?)[:：](?!.*[日夜内外])/gm,
    (match, name) => {
      // 如果是简单的角色名（不含特殊字符）
      if (/^[\u4e00-\u9fa5A-Za-z0-9·]+$/.test(name.trim())) {
        return `<span class="character">${name}</span>：`;
      }
      return match;
    }
  );
  
  // 角色 OS（旁白/内心独白）
  html = html.replace(
    /^(.+?)(OS|VO|旁白)[:：]/gm,
    '<span class="character">$1</span><span class="os">$2</span>：'
  );
  
  // 特殊标注颜色
  html = html.replace(
    /\[([^\]]+)\]/g,
    '<span class="highlight">[$1]</span>'
  );
  
  // 换行处理
  html = html.replace(/\n/g, '<br>');
  
  return html;
});

function escapeHtml(text: string) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
</script>

<style scoped>
.script-renderer {
  font-family: var(--font-sans);
  line-height: 1.8;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12);
  color: var(--text-muted);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: var(--space-4);
}

.script-content {
  padding: var(--space-6);
  font-size: var(--text-base);
  color: var(--text-primary);
}

/* 场景标题 */
:deep(.scene-header) {
  display: block;
  padding: var(--space-3) var(--space-4);
  margin: var(--space-6) 0 var(--space-4);
  background: var(--bg-elevated);
  border-left: 4px solid var(--primary);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--primary);
}

:deep(.scene-header:first-child) {
  margin-top: 0;
}

/* 描述（△开头） */
:deep(.description) {
  display: block;
  padding: var(--space-2) 0;
  color: var(--text-muted);
  font-style: italic;
  font-size: var(--text-sm);
}

/* 角色名 */
:deep(.character) {
  color: var(--secondary);
  font-weight: 600;
}

/* 动作描述 */
:deep(.action) {
  color: var(--text-muted);
  font-size: 0.9em;
}

/* OS/旁白 */
:deep(.os) {
  color: var(--accent);
  font-size: 0.85em;
  font-weight: 500;
}

/* 高亮标注 */
:deep(.highlight) {
  color: var(--warning);
  font-weight: 500;
}

/* 响应式 */
@media (max-width: 768px) {
  .script-content {
    padding: var(--space-4);
    font-size: var(--text-sm);
  }
  
  :deep(.scene-header) {
    font-size: var(--text-xs);
    padding: var(--space-2) var(--space-3);
  }
}
</style>
