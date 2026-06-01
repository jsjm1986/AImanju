<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useProjectStore } from '@/stores/projectStore';
import { useEpisodeStore } from '@/stores/episodeStore';
import { useCharacterStore } from '@/stores/characterStore';
import { useForeshadowingStore } from '@/stores/foreshadowingStore';
import { useToast } from '@/composables/useToast';
import Drawer from '@/components/common/Drawer.vue';
import { WordCountService } from '@/utils/wordCount';
import type { Character, ProjectOutline } from '@/types';

type ExportFormat = 'txt' | 'json' | 'md' | 'html';

const route = useRoute();
const projectStore = useProjectStore();
const episodeStore = useEpisodeStore();
const characterStore = useCharacterStore();
const foreshadowingStore = useForeshadowingStore();
const toast = useToast();

const projectId = computed(() => route.params.id as string);
const exportFormat = ref<ExportFormat>('txt');
const selectedRange = ref({ start: 1, end: 10 });
const isExporting = ref(false);
const includeOutline = ref(true);
const includeCharacters = ref(true);
const showSettingsDrawer = ref(false);

const formatOptions: { value: ExportFormat; icon: string; name: string; desc: string }[] = [
  { value: 'txt', icon: '📄', name: 'TXT', desc: '纯文本' },
  { value: 'json', icon: '📊', name: 'JSON', desc: '结构化' },
  { value: 'md', icon: '📝', name: 'MD', desc: 'Markdown' },
  { value: 'html', icon: '🌐', name: 'HTML', desc: '网页' },
];

const currentProject = computed(() => projectStore.projects.find(p => p._id === projectId.value));
const totalEpisodes = computed(() => currentProject.value?.totalEpisodes || 60);
const completedEpisodes = computed(() => episodeStore.episodes.filter(e => e.status === 'completed'));

const totalWordCount = computed(() =>
  completedEpisodes.value.reduce((sum, e) =>
    sum + WordCountService.getPreferredCount(e.wordCountV2, e.wordCount), 0)
);

const completionRate = computed(() =>
  Math.round(completedEpisodes.value.length / totalEpisodes.value * 100)
);

const selectedEpisodesCount = computed(() =>
  selectedRange.value.end - selectedRange.value.start + 1
);

const rangeEpisodes = computed(() =>
  episodeStore.sortedEpisodes.filter(
    e => e.episodeNumber >= selectedRange.value.start && e.episodeNumber <= selectedRange.value.end
  )
);

const previewContent = computed(() => {
  if (rangeEpisodes.value.length === 0) return '没有可预览的内容';
  return rangeEpisodes.value
    .map(e => `【第${e.episodeNumber}集】${e.title || ''}\n\n${e.content || '(暂无内容)'}`)
    .join('\n\n---\n\n');
});

onMounted(async () => {
  if (projectId.value) {
    await Promise.all([
      episodeStore.fetchEpisodes(projectId.value),
      characterStore.fetchCharacters(projectId.value),
    ]);
    if (!currentProject.value) await projectStore.fetchProjects();
    foreshadowingStore.loadStats(projectId.value).catch(() => {});
  }
  selectedRange.value.end = Math.min(10, totalEpisodes.value);
});

const handlePrevRange = () => {
  const size = selectedEpisodesCount.value;
  const newStart = Math.max(1, selectedRange.value.start - size);
  selectedRange.value.start = newStart;
  selectedRange.value.end = newStart + size - 1;
};

const handleNextRange = () => {
  const size = selectedEpisodesCount.value;
  const newEnd = Math.min(totalEpisodes.value, selectedRange.value.end + size);
  selectedRange.value.end = newEnd;
  selectedRange.value.start = newEnd - size + 1;
};

const exportBuilders: Record<ExportFormat, { build: (eps: typeof episodeStore.episodes) => string; ext: string; mime: string }> = {
  txt:  { build: buildTxtContent,      ext: '.txt',  mime: 'text/plain' },
  json: { build: buildJsonContent,     ext: '.json', mime: 'application/json' },
  md:   { build: buildMarkdownContent, ext: '.md',   mime: 'text/markdown' },
  html: { build: buildHtmlContent,     ext: '.html', mime: 'text/html' },
};

const handleExport = async () => {
  if (isExporting.value) return;
  isExporting.value = true;
  try {
    const { build, ext, mime } = exportBuilders[exportFormat.value];
    const filename = `${currentProject.value?.name || 'export'}_${selectedRange.value.start}-${selectedRange.value.end}`;
    downloadFile(build(rangeEpisodes.value), filename + ext, mime);
    toast.success('导出成功');
    showSettingsDrawer.value = false;
  } catch (error) {
    toast.error('导出失败: ' + (error as Error).message);
  } finally {
    isExporting.value = false;
  }
};

const escapeHtml = (text: string) => text
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const outlineSections: { key: keyof ProjectOutline; label: string }[] = [
  { key: 'characterCards', label: '人物卡' },
  { key: 'synopsis', label: '剧情梗概' },
  { key: 'episodeSummaries', label: '分集摘要' },
];

const getOutlineSections = (outline: ProjectOutline | string): { label: string; text: string }[] => {
  if (typeof outline === 'string') return [{ label: '大纲', text: outline }];
  const sections = outlineSections
    .filter(s => outline[s.key])
    .map(s => ({ label: s.label, text: outline[s.key] }));
  if (sections.length === 0 && outline.raw) return [{ label: '大纲', text: outline.raw }];
  return sections;
};

function buildTxtContent(episodes: typeof episodeStore.episodes): string {
  let content = `${currentProject.value?.name || '未命名项目'}\n${'='.repeat(40)}\n\n`;

  if (includeOutline.value && currentProject.value?.outline) {
    for (const s of getOutlineSections(currentProject.value.outline)) {
      content += `【${s.label}】\n${s.text}\n\n`;
    }
    content += `${'='.repeat(40)}\n\n`;
  }

  if (includeCharacters.value && characterStore.characters.length > 0) {
    content += `【角色表】\n${'─'.repeat(40)}\n`;
    for (const char of characterStore.characters) {
      content += formatCharacterForTxt(char);
    }
    content += `${'='.repeat(40)}\n\n`;
  }

  content += episodes.map(e =>
    `【第${e.episodeNumber}集】${e.title || ''}\n\n${e.content || '(暂无内容)'}`
  ).join('\n\n---\n\n');

  return content;
}

const buildAppearanceText = (char: Character): string => {
  const parts: string[] = [];
  if (char.hairStyle || char.hairColor) {
    const hair = [char.hairColor, char.hairStyle].filter(Boolean).join('');
    if (hair) parts.push(hair);
  }
  if (char.faceType) parts.push(char.faceType);
  if (char.bodyType) parts.push(char.bodyType);
  if (char.clothing) parts.push(char.clothing);
  if (char.accessories) parts.push(char.accessories);
  return parts.length > 0 ? parts.join('，') : (char.appearance || '');
};

type CharField = { label: string; value: string };

const getCharFields = (char: Character): CharField[] => {
  const fields: CharField[] = [];
  const add = (label: string, value?: string | null) => { if (value) fields.push({ label, value }); };
  add('身份', char.identity);
  add('性格', char.personality);
  add('背景', char.background);
  add('能力', char.abilities);
  add('外貌', buildAppearanceText(char));
  if (char.initialEquipment?.length) add('初始装备', char.initialEquipment.join('、'));
  if (char.initialAbilities?.length) add('初始能力', char.initialAbilities.join('、'));
  return fields;
};

const getCharBasicInfo = (char: Character): CharField[] =>
  [{ label: '性别', value: char.gender }, { label: '年龄', value: char.age || '' }, { label: '类型', value: char.type }]
    .filter(f => f.value);

const formatCharacterForTxt = (char: Character): string => {
  let content = `\n◆ ${char.name}`;
  if (char.role) content += ` [${char.role}]`;
  content += '\n';
  const basic = getCharBasicInfo(char);
  if (basic.length) content += `  ${basic.map(f => `${f.label}: ${f.value}`).join(' | ')}\n`;
  for (const f of getCharFields(char)) content += `  ${f.label}: ${f.value}\n`;
  if (char.relationships?.length) {
    content += `  人物关系:\n`;
    for (const rel of char.relationships) content += `    - ${rel.targetName}: ${rel.relationship}\n`;
  }
  return content + '\n';
};

const formatCharacterForMarkdown = (char: Character): string => {
  let content = `### ${char.name}`;
  if (char.role) content += ` (${char.role})`;
  content += '\n\n| 属性 | 信息 |\n|------|------|\n';
  for (const f of [...getCharBasicInfo(char), ...getCharFields(char).filter(f => ['身份'].includes(f.label))]) {
    content += `| ${f.label} | ${f.value} |\n`;
  }
  content += '\n';
  for (const f of getCharFields(char).filter(f => f.label !== '身份')) {
    content += `**${f.label}**: ${f.value}\n\n`;
  }
  if (char.relationships?.length) {
    content += `**人物关系**:\n`;
    for (const rel of char.relationships) content += `- ${rel.targetName}: ${rel.relationship}\n`;
    content += '\n';
  }
  return content;
};

const formatCharacterForHtml = (char: Character): string => {
  let content = `<div class="character"><h3>${escapeHtml(char.name)}`;
  if (char.role) content += ` <span class="role-tag">${escapeHtml(char.role)}</span>`;
  content += '</h3><div class="char-basic">';
  for (const f of getCharBasicInfo(char)) {
    content += `<span class="info-item"><strong>${f.label}:</strong> ${escapeHtml(f.value)}</span>`;
  }
  content += '</div>';
  for (const f of getCharFields(char)) {
    content += `<p><strong>${f.label}:</strong> ${escapeHtml(f.value)}</p>`;
  }
  if (char.relationships?.length) {
    content += '<div class="relationships"><strong>人物关系:</strong><ul>';
    for (const rel of char.relationships) {
      content += `<li>${escapeHtml(rel.targetName)}: ${escapeHtml(rel.relationship)}</li>`;
    }
    content += '</ul></div>';
  }
  return content + '</div>';
};

function buildJsonContent(episodes: typeof episodeStore.episodes): string {
  const formatOutlineForJson = (outline: ProjectOutline | string | undefined) => {
    if (!outline) return undefined;
    if (typeof outline === 'string') return { raw: outline };
    return {
      raw: outline.raw || undefined,
      characterCards: outline.characterCards || undefined,
      synopsis: outline.synopsis || undefined,
      episodeSummaries: outline.episodeSummaries || undefined,
    };
  };

  const formatCharacterForJson = (char: Character) => ({
    name: char.name,
    role: char.role || undefined,
    type: char.type || undefined,
    gender: char.gender || undefined,
    age: char.age || undefined,
    identity: char.identity || undefined,
    personality: char.personality || undefined,
    background: char.background || undefined,
    abilities: char.abilities || undefined,
    appearance: {
      hairStyle: char.hairStyle || undefined,
      hairColor: char.hairColor || undefined,
      faceType: char.faceType || undefined,
      bodyType: char.bodyType || undefined,
      clothing: char.clothing || undefined,
      accessories: char.accessories || undefined,
      description: char.appearance || undefined,
    },
    initialEquipment: char.initialEquipment?.length ? char.initialEquipment : undefined,
    initialAbilities: char.initialAbilities?.length ? char.initialAbilities : undefined,
    relationships: char.relationships?.length
      ? char.relationships.map(rel => ({ targetName: rel.targetName, relationship: rel.relationship }))
      : undefined,
  });

  return JSON.stringify({
    project: {
      name: currentProject.value?.name,
      genre: currentProject.value?.genre,
      type: currentProject.value?.type,
      totalEpisodes: currentProject.value?.totalEpisodes,
      outline: includeOutline.value ? formatOutlineForJson(currentProject.value?.outline) : undefined,
    },
    characters: includeCharacters.value ? characterStore.characters.map(formatCharacterForJson) : undefined,
    exportTime: new Date().toISOString(),
    episodes: episodes.map(e => ({
      number: e.episodeNumber,
      title: e.title,
      content: e.content,
      wordCount: WordCountService.getPreferredCount(e.wordCountV2, e.wordCount),
    })),
    statistics: {
      totalEpisodes: episodes.length,
      totalWordCount: episodes.reduce((sum, e) => sum + WordCountService.getPreferredCount(e.wordCountV2, e.wordCount), 0),
      characterCount: characterStore.characters.length,
    }
  }, null, 2);
}

function buildMarkdownContent(episodes: typeof episodeStore.episodes): string {
  let content = `# ${currentProject.value?.name || '未命名项目'}\n\n`;
  content += `> 类型: ${currentProject.value?.genre} | ${currentProject.value?.type}\n\n`;

  if (includeOutline.value && currentProject.value?.outline) {
    for (const s of getOutlineSections(currentProject.value.outline)) {
      content += `## ${s.label}\n\n${s.text}\n\n`;
    }
    content += `---\n\n`;
  }

  if (includeCharacters.value && characterStore.characters.length > 0) {
    content += `## 角色表\n\n`;
    for (const char of characterStore.characters) content += formatCharacterForMarkdown(char);
    content += `---\n\n`;
  }

  content += `## 剧本\n\n`;
  for (const e of episodes) {
    content += `### 第${e.episodeNumber}集 ${e.title || ''}\n\n${e.content || '(暂无内容)'}\n\n---\n\n`;
  }
  return content;
}

function buildHtmlContent(episodes: typeof episodeStore.episodes): string {
  const title = currentProject.value?.name || '未命名项目';
  const esc = (text: string) => escapeHtml(text).replace(/\n/g, '<br>');

  let body = '';

  if (includeOutline.value && currentProject.value?.outline) {
    const sections = getOutlineSections(currentProject.value.outline);
    body += '<section class="outline">';
    if (sections.length === 1 && sections[0]?.label === '大纲') {
      body += `<h2>大纲</h2><div class="outline-content">${esc(sections[0]?.text || '')}</div>`;
    } else {
      for (const s of sections) {
        body += `<div class="outline-section"><h3>${s.label}</h3><div class="outline-content">${esc(s.text)}</div></div>`;
      }
    }
    body += '</section>';
  }

  if (includeCharacters.value && characterStore.characters.length > 0) {
    body += `<section class="characters"><h2>角色表</h2>`;
    for (const char of characterStore.characters) body += formatCharacterForHtml(char);
    body += `</section>`;
  }

  body += `<section class="episodes">`;
  for (const e of episodes) {
    body += `<article class="episode"><h2>第${e.episodeNumber}集 ${e.title || ''}</h2>`;
    body += `<div class="content">${(e.content || '(暂无内容)').replace(/\n/g, '<br>')}</div></article>`;
  }
  body += `</section>`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 40px 20px; line-height: 1.8; background: #fafafa; }
    h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; color: #1a1a1a; }
    h2 { color: #1976d2; margin-top: 40px; border-left: 4px solid #1976d2; padding-left: 12px; }
    h3 { color: #333; margin-bottom: 12px; }
    section { margin-bottom: 40px; }
    /* 大纲样式 */
    .outline { background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .outline-section { margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px dashed #e0e0e0; }
    .outline-section:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .outline-section h3 { color: #1976d2; font-size: 16px; }
    .outline-content { white-space: pre-wrap; color: #444; line-height: 1.9; }
    /* 角色样式 */
    .characters { background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .character { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #4caf50; }
    .character:last-child { margin-bottom: 0; }
    .character h3 { margin: 0 0 12px 0; color: #2e7d32; }
    .role-tag { font-size: 12px; background: #e8f5e9; color: #2e7d32; padding: 2px 8px; border-radius: 4px; margin-left: 8px; font-weight: normal; }
    .char-basic { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e0e0e0; }
    .info-item { font-size: 14px; color: #666; }
    .info-item strong { color: #333; }
    .character p { margin: 8px 0; color: #555; }
    .character p strong { color: #333; }
    .relationships { margin-top: 12px; }
    .relationships ul { margin: 8px 0 0 0; padding-left: 20px; }
    .relationships li { color: #666; margin: 4px 0; }
    /* 剧本样式 */
    .episodes { background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .episode { border-bottom: 1px solid #e0e0e0; padding-bottom: 30px; margin-bottom: 30px; }
    .episode:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .episode h2 { font-size: 18px; margin-bottom: 16px; }
    .content { white-space: pre-wrap; color: #333; line-height: 2; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${body}
</body>
</html>`;
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="preview-page">
    <header class="preview-toolbar">
      <div class="toolbar-left">
        <h2 class="page-title">内容预览</h2>
        <div class="range-nav">
          <button class="nav-btn" @click="handlePrevRange" :disabled="selectedRange.start <= 1" title="上一页">◀</button>
          <span class="range-label">第 {{ selectedRange.start }}-{{ selectedRange.end }} 集</span>
          <button class="nav-btn" @click="handleNextRange" :disabled="selectedRange.end >= totalEpisodes" title="下一页">▶</button>
        </div>
      </div>
      <div class="toolbar-stats">
        <div class="stat-badge">
          <span class="stat-label">总集数</span>
          <span class="stat-value">{{ totalEpisodes }}</span>
        </div>
        <div class="stat-badge">
          <span class="stat-label">已完成</span>
          <span class="stat-value highlight">{{ completedEpisodes.length }}</span>
        </div>
        <div class="stat-badge">
          <span class="stat-label">完成率</span>
          <span class="stat-value">{{ completionRate }}%</span>
        </div>
        <div class="stat-badge">
          <span class="stat-label">总字数</span>
          <span class="stat-value">{{ totalWordCount.toLocaleString() }}</span>
        </div>
      </div>
      <div class="toolbar-right">
        <button class="btn-settings" @click="showSettingsDrawer = true">
          <span class="btn-icon">⚙️</span>
          <span>导出设置</span>
        </button>
      </div>
    </header>

    <main class="preview-main">
      <div class="preview-container">
        <div class="preview-paper">
          <pre class="preview-text">{{ previewContent }}</pre>
        </div>
      </div>
    </main>

    <footer class="preview-footer">
      <button class="btn-export" @click="showSettingsDrawer = true">
        <span class="btn-icon">📥</span>
        <span>导出文件</span>
      </button>
    </footer>

    <Drawer
      :visible="showSettingsDrawer"
      title="导出设置"
      width="380px"
      @close="showSettingsDrawer = false"
    >
      <div class="drawer-content">
        <div class="setting-section">
          <h4 class="section-title">导出范围</h4>
          <div class="range-slider-group">
            <div class="range-inputs">
              <div class="range-input-item">
                <label>起始集</label>
                <input 
                  type="number" 
                  v-model.number="selectedRange.start" 
                  min="1" 
                  :max="selectedRange.end"
                />
              </div>
              <span class="range-separator">—</span>
              <div class="range-input-item">
                <label>结束集</label>
                <input 
                  type="number" 
                  v-model.number="selectedRange.end" 
                  :min="selectedRange.start" 
                  :max="totalEpisodes"
                />
              </div>
            </div>
            <div class="range-info-text">
              共 {{ selectedEpisodesCount }} 集
            </div>
          </div>
        </div>

        <div class="setting-section">
          <h4 class="section-title">导出格式</h4>
          <div class="format-cards">
            <label
              v-for="fmt in formatOptions"
              :key="fmt.value"
              class="format-card"
              :class="{ active: exportFormat === fmt.value }"
            >
              <input type="radio" v-model="exportFormat" :value="fmt.value" />
              <span class="format-icon">{{ fmt.icon }}</span>
              <span class="format-name">{{ fmt.name }}</span>
              <span class="format-desc">{{ fmt.desc }}</span>
            </label>
          </div>
        </div>

        <div class="setting-section">
          <h4 class="section-title">包含内容</h4>
          <div class="include-options">
            <label class="include-option">
              <input type="checkbox" v-model="includeOutline" />
              <span class="option-text">包含大纲</span>
            </label>
            <label class="include-option">
              <input type="checkbox" v-model="includeCharacters" />
              <span class="option-text">包含角色表</span>
            </label>
          </div>
        </div>
      </div>

      <template #footer>
        <button 
          class="btn-export-action" 
          @click="handleExport" 
          :disabled="isExporting"
        >
          {{ isExporting ? '导出中...' : '确认导出' }}
        </button>
      </template>
    </Drawer>
  </div>
</template>

<style scoped>
.preview-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-base);
}

.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-5);
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-default);
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: var(--space-5);
}

.page-title {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.range-nav {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.nav-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: 12px;
}

.nav-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.range-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  min-width: 100px;
  text-align: center;
}

.toolbar-stats {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.stat-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-1) var(--space-3);
}

.stat-label {
  font-size: 11px;
  color: var(--text-tertiary);
}

.stat-value {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.stat-value.highlight {
  color: var(--success);
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.btn-settings {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: var(--text-sm);
}

.btn-settings:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.btn-icon {
  font-size: 14px;
}

.preview-main {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4) var(--space-6);
}

.preview-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.preview-paper {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-6) var(--space-8);
  min-height: calc(100vh - 200px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.preview-text {
  white-space: pre-wrap;
  font-family: inherit;
  line-height: 1.9;
  margin: 0;
  color: var(--text-primary);
  font-size: 15px;
  letter-spacing: 0.3px;
}

.preview-footer {
  display: flex;
  justify-content: center;
  padding: var(--space-4);
  background: var(--bg-surface);
  border-top: 1px solid var(--border-default);
  flex-shrink: 0;
}

.btn-export {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  background: var(--primary);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.btn-export:hover {
  background: var(--primary-hover);
}

.drawer-content {
  padding: var(--space-4);
}

.setting-section {
  margin-bottom: var(--space-5);
}

.section-title {
  margin: 0 0 var(--space-3);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.range-slider-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.range-inputs {
  display: flex;
  align-items: flex-end;
  gap: var(--space-3);
}

.range-input-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.range-input-item label {
  font-size: 12px;
  color: var(--text-tertiary);
}

.range-input-item input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  text-align: center;
  box-sizing: border-box;
}

.range-input-item input:focus {
  outline: none;
  border-color: var(--border-focus);
}

.range-separator {
  color: var(--text-tertiary);
  padding-bottom: var(--space-2);
}

.range-info-text {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  text-align: center;
}

.format-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2);
}

.format-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-3) var(--space-2);
  background: var(--bg-elevated);
  border: 2px solid var(--border-default);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.format-card input {
  display: none;
}

.format-card:hover {
  border-color: var(--border-hover);
  background: var(--bg-hover);
}

.format-card.active {
  border-color: var(--primary);
  background: rgba(var(--primary-rgb), 0.1);
}

.format-icon {
  font-size: 24px;
  margin-bottom: var(--space-1);
}

.format-name {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.format-desc {
  font-size: 11px;
  color: var(--text-tertiary);
}

.include-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.include-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.include-option:hover {
  background: var(--bg-hover);
}

.include-option input {
  accent-color: var(--primary);
}

.option-text {
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.btn-export-action {
  width: 100%;
  padding: var(--space-3);
  background: var(--primary);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.btn-export-action:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn-export-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
