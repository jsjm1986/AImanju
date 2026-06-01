<template>
  <div class="instruction-editor">
    <div class="editor-header">
      <h4>输入改写指令</h4>
      <p class="hint">描述你想要的改写效果，AI 会保持剧情连贯性进行批量改写</p>
    </div>

    <div class="quick-templates">
      <span class="templates-label">快捷模板：</span>
      <button v-for="tpl in templates" :key="tpl.label" class="template-btn" @click="applyTemplate(tpl.value)">
        {{ tpl.label }}
      </button>
    </div>

    <textarea
      :value="instruction"
      @input="handleInput"
      class="instruction-input"
      placeholder="例如：&#10;• 增强情感冲突，让对话更有张力&#10;• 加快叙事节奏，删除冗余描写&#10;• 优化角色对话，让语言更自然生动"
      rows="6"
    ></textarea>

    <div class="char-count">
      <span :class="{ warning: instruction.length > 500 }">{{ instruction.length }} / 500</span>
    </div>

    <div class="tips-section">
      <div class="tips-title">💡 改写技巧</div>
      <ul class="tips-list">
        <li>指令越具体，改写效果越好</li>
        <li>可以同时提出多个改写要求</li>
        <li>AI 会自动处理跨集的角色状态和伏笔连贯性</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ instruction: string }>();
const emit = defineEmits<{ (e: 'update:instruction', value: string): void }>();

const templates = [
  { label: '增强冲突', value: '增强情感冲突，让对话更有张力，增加戏剧性' },
  { label: '加快节奏', value: '加快叙事节奏，删除冗余描写，让剧情更紧凑' },
  { label: '丰富细节', value: '丰富环境和动作细节描写，增加画面感' },
  { label: '优化对话', value: '优化角色对话，让语言更自然生动，符合角色性格' },
  { label: '增加爽点', value: '增加爽点和高潮情节，提升阅读体验' },
];

function handleInput(e: Event) {
  const value = (e.target as HTMLTextAreaElement).value;
  if (value.length <= 500) emit('update:instruction', value);
}

function applyTemplate(value: string) {
  emit('update:instruction', value);
}
</script>

<style scoped>
.instruction-editor { display: flex; flex-direction: column; gap: var(--space-4); }
.editor-header h4 { margin: 0 0 var(--space-1); font-size: var(--text-base); font-weight: var(--font-semibold); color: var(--text-primary); }
.hint { margin: 0; font-size: var(--text-sm); color: var(--text-tertiary); }
.quick-templates { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.templates-label { font-size: var(--text-sm); color: var(--text-secondary); }
.template-btn { padding: var(--space-1) var(--space-2); background: var(--bg-elevated); border: 1px solid var(--border-default); border-radius: var(--radius-full); font-size: 12px; color: var(--text-secondary); cursor: pointer; transition: all var(--duration-fast); }
.template-btn:hover { background: var(--primary-muted); border-color: var(--primary); color: var(--primary); }
.instruction-input { width: 100%; padding: var(--space-3); background: var(--bg-elevated); border: 1px solid var(--border-default); border-radius: var(--radius-md); font-size: var(--text-sm); line-height: var(--leading-relaxed); color: var(--text-primary); resize: none; font-family: inherit; box-sizing: border-box; }
.instruction-input::placeholder { color: var(--text-muted); }
.instruction-input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-muted); }
.char-count { text-align: right; font-size: 12px; color: var(--text-tertiary); }
.char-count .warning { color: var(--warning, var(--warning)); }
.tips-section { padding: var(--space-3); background: var(--bg-elevated); border-radius: var(--radius-md); }
.tips-title { font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--text-primary); margin-bottom: var(--space-2); }
.tips-list { margin: 0; padding-left: var(--space-4); font-size: var(--text-sm); color: var(--text-secondary); line-height: var(--leading-relaxed); }
.tips-list li { margin-bottom: var(--space-1); }
</style>
