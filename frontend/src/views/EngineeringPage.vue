<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick, onUnmounted } from 'vue';
import { marked } from 'marked';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
});

interface DocInfo {
  id: string;
  title: string;
  description: string;
  available: boolean;
  lastModified: string | null;
  size: number;
}

interface UpdateRecord {
  docId: string;
  docTitle: string;
  version: string;
  date: string;
  content: string;
}

const docsList = ref<DocInfo[]>([]);
const currentDocId = ref('engineering');
const docContent = ref('');
const docTitle = ref('');
const isLoading = ref(true);
const error = ref('');

const updateRecords = ref<UpdateRecord[]>([]);
const showUpdateSummary = ref(true);
const isLoadingSummary = ref(false);

const parseDateValue = (value: string) => {
  if (!value) return 0;
  const normalized = value.replace(/[./]/g, '-');
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortedUpdateRecords = computed(() => {
  return [...updateRecords.value].sort((a, b) => parseDateValue(b.date) - parseDateValue(a.date));
});

const tocItems = ref<Array<{ level: number; text: string; id: string }>>([]);
const activeSection = ref('');
const showDocPicker = ref(false);
const showZoomModal = ref(false);
const zoomedSvgContent = ref('');

const currentDocLabel = computed(() => {
  const matched = docsList.value.find((doc) => doc.id === currentDocId.value);
  return matched?.title || docTitle.value || '选择文档';
});

const selectDoc = (docId: string) => {
  const target = docsList.value.find((doc) => doc.id === docId);
  if (!target || !target.available) return;
  showDocPicker.value = false;
  loadDocument(docId);
};

const zoomLevel = ref(1);
const panX = ref(0);
const panY = ref(0);
const isDragging = ref(false);
const dragStartX = ref(0);
const dragStartY = ref(0);

const extractUpdateRecords = (markdown: string, doc: DocInfo): UpdateRecord[] => {
  const lines = markdown.split(/\r?\n/);
  const getLine = (index: number) => lines[index] ?? '';
  const headerIndex = lines.findIndex((line) => /^##\s*.*更新记录/.test(line));
  if (headerIndex === -1) return [];

  let i = headerIndex + 1;
  while (i < lines.length && getLine(i).trim() === '') i++;
  while (i < lines.length && !getLine(i).trim().startsWith('|')) {
    if (/^#{1,6}\s/.test(getLine(i))) return [];
    i++;
  }
  if (i >= lines.length) return [];

  const headerLine = getLine(i).trim();
  if (headerLine.includes('版本') && headerLine.includes('日期')) {
    i++;
    if (i < lines.length && /^\|[-\s:]+\|$/.test(getLine(i).trim())) i++;
  } else if (i + 1 < lines.length && /^\|[-\s:]+\|$/.test(getLine(i + 1).trim())) {
    i += 2;
  }

  const records: UpdateRecord[] = [];
  for (; i < lines.length; i++) {
    const line = getLine(i).trim();
    if (!line.startsWith('|')) break;
    if (/^\|[-\s:]+\|$/.test(line)) continue;
    const cells = line.split('|').map((cell) => cell.trim()).filter((cell) => cell.length > 0);
    if (cells.length < 2) continue;
    const version = cells[0] || '';
    const date = cells[1] || '';
    const content = cells.slice(2).join(' | ') || '';
    records.push({
      docId: doc.id,
      docTitle: doc.title,
      version,
      date,
      content,
    });
  }
  return records;
};

const loadUpdateSummary = async () => {
  if (docsList.value.length == 0) return;
  isLoadingSummary.value = true;
  try {
    const docsToLoad = docsList.value.filter((doc) => doc.available);
    const results = await Promise.all(
      docsToLoad.map(async (doc) => {
        try {
          const response = await fetch(`/api/docs/${doc.id}`);
          if (!response.ok) return [];
          const data = await response.json();
          return extractUpdateRecords(data.content || '', doc);
        } catch (err) {
          console.warn('加载文档更新记录失败:', doc.id, err);
          return [];
        }
      })
    );
    updateRecords.value = results.flat();
  } finally {
    isLoadingSummary.value = false;
  }
};

const loadDocsList = async () => {
  try {
    const response = await fetch('/api/docs');
    if (response.ok) {
      const data = await response.json();
      docsList.value = data.docs || [];
      await loadUpdateSummary();
    }
  } catch (err) {
    console.error('加载文档列表失败:', err);
  }
};

const loadDocument = async (docId?: string) => {
  isLoading.value = true;
  error.value = '';
  
  const targetDocId = docId || currentDocId.value;
  
  try {
    const response = await fetch(`/api/docs/${targetDocId}`);
    if (!response.ok) {
      throw new Error('加载文档失败');
    }
    const data = await response.json();
    docContent.value = data.content;
    docTitle.value = data.title || '';
    currentDocId.value = targetDocId;
    parseToc(data.content);
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    isLoading.value = false;
  }
};

const parseToc = (content: string) => {
  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  const items: Array<{ level: number; text: string; id: string }> = [];
  let match;
  
  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].replace(/[*_`]/g, '');
    const id = text.toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
      .replace(/^-|-$/g, '');
    items.push({ level, text, id });
  }
  tocItems.value = items;
};

const renderedContent = computed(() => {
  if (!docContent.value) return '';
  
  const renderer = new marked.Renderer();
  
  renderer.heading = ({ text, depth }: { text: string; depth: number }) => {
    const textStr = typeof text === 'string' ? text : String(text);
    const id = textStr.toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
      .replace(/^-|-$/g, '');
    return `<h${depth} id="${id}">${textStr}</h${depth}>`;
  };
  
  renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
    if (lang === 'mermaid') {
      return `<div class="mermaid-wrapper"><div class="mermaid">${text}</div><div class="zoom-hint">🔍 点击放大</div></div>`;
    }
    return `<pre><code class="language-${lang || ''}">${text}</code></pre>`;
  };
  
  return marked(docContent.value, { renderer, gfm: true, breaks: true });
});

const renderMermaid = async () => {
  await nextTick();
  const elements = document.querySelectorAll('.mermaid');
  if (elements.length > 0) {
    try {
      await mermaid.run({ nodes: elements as NodeListOf<HTMLElement> });
      await nextTick();
      forEachMermaidWrapper('add');
    } catch (e) {
      console.warn('Mermaid render warning:', e);
    }
  }
};

const zoomIn = () => {
  zoomLevel.value = Math.min(5, zoomLevel.value + 0.25);
};

const zoomOut = () => {
  zoomLevel.value = Math.max(0.5, zoomLevel.value - 0.25);
};

const resetZoom = () => {
  zoomLevel.value = 1;
  panX.value = 0;
  panY.value = 0;
};

const handleDiagramClick = (event: Event) => {
  const wrapper = event.currentTarget as HTMLElement;
  const svg = wrapper.querySelector('svg');
  if (svg) {
    zoomedSvgContent.value = svg.outerHTML;
    showZoomModal.value = true;
    resetZoom();
  }
};

const forEachMermaidWrapper = (action: 'add' | 'remove') => {
  const method = action === 'add' ? 'addEventListener' : 'removeEventListener';
  document.querySelectorAll('.mermaid-wrapper').forEach((w) => w[method]('click', handleDiagramClick));
};

const closeZoomModal = () => {
  showZoomModal.value = false;
  zoomedSvgContent.value = '';
  resetZoom();
};

const handleWheel = (event: WheelEvent) => {
  event.preventDefault();
  const delta = event.deltaY > 0 ? -0.1 : 0.1;
  const newZoom = Math.max(0.5, Math.min(5, zoomLevel.value + delta));
  zoomLevel.value = newZoom;
};

const handleMouseDown = (event: MouseEvent) => {
  if (event.button === 0) {
    isDragging.value = true;
    dragStartX.value = event.clientX - panX.value;
    dragStartY.value = event.clientY - panY.value;
  }
};

const handleMouseMove = (event: MouseEvent) => {
  if (isDragging.value) {
    panX.value = event.clientX - dragStartX.value;
    panY.value = event.clientY - dragStartY.value;
  }
};

const handleMouseUp = () => {
  isDragging.value = false;
};

const transformStyle = computed(() => {
  return {
    transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoomLevel.value})`,
    cursor: isDragging.value ? 'grabbing' : 'grab',
  };
});

const zoomPercentage = computed(() => Math.round(zoomLevel.value * 100));

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && showZoomModal.value) {
    closeZoomModal();
  }
};

watch(renderedContent, () => {
  forEachMermaidWrapper('remove');
  renderMermaid();
});

const scrollToSection = (id: string) => {
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    activeSection.value = id;
  }
};

const handleScroll = (event: Event) => {
  const container = event.target as HTMLElement;
  for (const item of tocItems.value) {
    const element = document.getElementById(item.id);
    if (element) {
      const rect = element.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      if (rect.top >= containerRect.top && rect.top <= containerRect.top + 200) {
        activeSection.value = item.id;
        break;
      }
    }
  }
};

onMounted(() => {
  loadDocsList();
  loadDocument();
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  forEachMermaidWrapper('remove');
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div class="engineering-page">
    <aside class="toc-sidebar">
      <div class="doc-selector" v-if="docsList.length > 0">
        <label class="doc-selector-label">📚 选择文档</label>
        <select 
          class="doc-select" 
          :value="currentDocId" 
          @change="loadDocument(($event.target as HTMLSelectElement).value)"
        >
          <option 
            v-for="doc in docsList" 
            :key="doc.id" 
            :value="doc.id"
            :disabled="!doc.available"
          >
            {{ doc.title }}
          </option>
        </select>
      </div>
      
      <div class="toc-header">
        <h3>📑 目录</h3>
        <span class="doc-title" v-if="docTitle">{{ docTitle }}</span>
      </div>
      <nav class="toc-nav">
        <a
          v-for="item in tocItems"
          :key="item.id"
          :class="['toc-item', `level-${item.level}`, { active: activeSection === item.id }]"
          @click="scrollToSection(item.id)"
        >
          {{ item.text }}
        </a>
      </nav>
    </aside>

    <main class="doc-content" @scroll="handleScroll">
      <div class="doc-selector mobile" v-if="docsList.length > 0">
        <label class="doc-selector-label">📚 选择文档</label>
        <button class="doc-select-btn" type="button" @click="showDocPicker = true">
          <span class="doc-select-text">{{ currentDocLabel }}</span>
          <span class="doc-select-arrow">▾</span>
        </button>
      </div>
      <div v-if="updateRecords.length > 0 || isLoadingSummary" class="update-summary">
        <div class="summary-header">
          <h4>🧾 更新记录汇总</h4>
          <button class="summary-toggle" type="button" @click="showUpdateSummary = !showUpdateSummary">
            {{ showUpdateSummary ? '收起' : '展开' }}
          </button>
        </div>
        <div v-if="isLoadingSummary" class="summary-loading">正在汇总更新记录...</div>
        <div v-else class="summary-body" v-show="showUpdateSummary">
          <table class="summary-table">
            <thead>
              <tr>
                <th>文档</th>
                <th>版本</th>
                <th>日期</th>
                <th>更新内容</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in sortedUpdateRecords" :key="`${item.docId}-${item.version}-${item.date}-${index}`">
                <td>{{ item.docTitle }}</td>
                <td>{{ item.version }}</td>
                <td>{{ item.date }}</td>
                <td>{{ item.content }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>加载文档中...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <p class="error-icon">⚠️</p>
        <p class="error-message">{{ error }}</p>
        <button class="retry-btn" @click="loadDocument()">重试</button>
      </div>

      <article v-else class="markdown-body" v-html="renderedContent"></article>
    </main>

    <Teleport to="body">
      <div v-if="showDocPicker" class="doc-picker-overlay" @click="showDocPicker = false">
        <div class="doc-picker" @click.stop>
          <div class="doc-picker-header">
            <span>选择文档</span>
            <button class="doc-picker-close" type="button" @click="showDocPicker = false" title="关闭">✕</button>
          </div>
          <div class="doc-picker-list">
            <button
              v-for="doc in docsList"
              :key="doc.id"
              class="doc-picker-item"
              :class="{ active: doc.id === currentDocId, disabled: !doc.available }"
              :disabled="!doc.available"
              type="button"
              @click="selectDoc(doc.id)"
            >
              <span class="doc-picker-title">{{ doc.title }}</span>
              <span v-if="doc.description" class="doc-picker-desc">{{ doc.description }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showZoomModal" class="zoom-modal" @click="closeZoomModal">
        <div class="zoom-modal-content" @click.stop>
          <div class="zoom-toolbar">
            <div class="zoom-controls">
              <button class="zoom-btn" @click="zoomOut" title="缩小">−</button>
              <span class="zoom-level">{{ zoomPercentage }}%</span>
              <button class="zoom-btn" @click="zoomIn" title="放大">+</button>
              <button class="zoom-btn reset" @click="resetZoom" title="重置">重置</button>
            </div>
            <button class="zoom-close-btn" @click="closeZoomModal" title="关闭">✕</button>
          </div>
          
          <div
            class="zoom-viewport"
            @wheel="handleWheel"
            @mousedown="handleMouseDown"
            @mousemove="handleMouseMove"
            @mouseup="handleMouseUp"
            @mouseleave="handleMouseUp"
          >
            <div class="zoom-svg-container" :style="transformStyle" v-html="zoomedSvgContent"></div>
          </div>
          
          <div class="zoom-hint-text">滚轮缩放 · 拖拽平移 · ESC 关闭</div>
        </div>
      </div>
    </Teleport>
  </div>
</template>


<style scoped>
.engineering-page {
  display: flex;
  height: 100%;
  background: var(--bg-base);
}

.toc-sidebar {
  width: 280px;
  background: var(--bg-surface);
  border-right: 1px solid var(--border-default);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.doc-selector {
  padding: var(--space-3);
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-elevated);
}

.doc-selector-label {
  display: block;
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-bottom: var(--space-2);
}

.doc-select {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.doc-select:hover,
.doc-select:focus {
  border-color: var(--primary);
}

.doc-select:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--primary-border);
}

.doc-select option {
  background: var(--bg-surface);
  color: var(--text-primary);
  padding: var(--space-2);
}

.doc-select option:disabled {
  color: var(--text-tertiary);
}

.doc-selector.mobile {
  display: none;
  margin-bottom: var(--space-4);
  border-radius: var(--radius-md);
}

.update-summary {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  padding: var(--space-3);
  margin-bottom: var(--space-5);
}

.summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}

.summary-header h4 {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.summary-toggle {
  padding: 4px 10px;
  font-size: 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  cursor: pointer;
}

.summary-loading {
  padding: var(--space-3);
  color: var(--text-tertiary);
  font-size: var(--text-sm);
}

.summary-body {
  overflow-x: auto;
}

.summary-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
  min-width: 520px;
}

.summary-table th,
.summary-table td {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-default);
  text-align: left;
  vertical-align: top;
}

.summary-table th {
  background: var(--bg-elevated);
  font-weight: var(--font-semibold);
}

.summary-table tbody tr:nth-child(even) {
  background: var(--bg-base);
}

.doc-select-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.doc-select-btn:active {
  transform: scale(0.99);
}

.doc-select-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-select-arrow {
  color: var(--text-tertiary);
}

.doc-picker-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  z-index: var(--z-modal);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.doc-picker {
  width: 100%;
  max-width: 720px;
  background: var(--bg-surface);
  border-top-left-radius: var(--radius-lg);
  border-top-right-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  border-bottom: none;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}

.doc-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-elevated);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
}

.doc-picker-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
}

.doc-picker-list {
  overflow-y: auto;
  padding: var(--space-2);
}

.doc-picker-item {
  width: 100%;
  text-align: left;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.doc-picker-item + .doc-picker-item {
  margin-top: var(--space-2);
}

.doc-picker-item.active {
  background: var(--primary-muted);
  border-color: var(--primary);
}

.doc-picker-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.doc-picker-title {
  display: block;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
}

.doc-picker-desc {
  display: block;
  margin-top: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.toc-header {
  padding: var(--space-4);
  border-bottom: 1px solid var(--border-default);
}

.toc-header h3 {
  margin: 0;
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.doc-title {
  display: block;
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-top: var(--space-1);
}

.toc-nav {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2) 0;
}

.toc-item {
  display: block;
  padding: var(--space-2) var(--space-4);
  color: var(--text-secondary);
  text-decoration: none;
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  border-left: 2px solid transparent;
}

.toc-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.toc-item.active {
  background: var(--primary-muted);
  color: var(--primary);
  border-left-color: var(--primary);
}

.toc-item.level-2 { padding-left: calc(var(--space-4) + 12px); }
.toc-item.level-3 { padding-left: calc(var(--space-4) + 24px); font-size: var(--text-xs); }

.doc-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
}

.loading-state, .error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: var(--text-tertiary);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-default);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: var(--space-4);
}

@keyframes spin { to { transform: rotate(360deg); } }

.error-icon { font-size: 48px; margin-bottom: var(--space-4); }
.error-message { margin-bottom: var(--space-4); color: var(--error); }

.retry-btn {
  padding: var(--space-2) var(--space-4);
  background: var(--primary);
  color: var(--text-on-primary);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.markdown-body {
  max-width: 900px;
  margin: 0 auto;
  color: var(--text-primary);
  line-height: 1.7;
}

.markdown-body :deep(h1) {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  margin: var(--space-8) 0 var(--space-4);
  padding-bottom: var(--space-3);
  border-bottom: 2px solid var(--border-default);
}

.markdown-body :deep(h2) {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  margin: var(--space-6) 0 var(--space-3);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-default);
}

.markdown-body :deep(h3) {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  margin: var(--space-5) 0 var(--space-2);
}

.markdown-body :deep(h4) {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  margin: var(--space-4) 0 var(--space-2);
}

.markdown-body :deep(p) { margin: var(--space-3) 0; }
.markdown-body :deep(ul), .markdown-body :deep(ol) { margin: var(--space-3) 0; padding-left: var(--space-6); }
.markdown-body :deep(li) { margin: var(--space-1) 0; }

.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: var(--space-4) 0;
  font-size: var(--text-sm);
}

.markdown-body :deep(th), .markdown-body :deep(td) {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-default);
  text-align: left;
}

.markdown-body :deep(th) { background: var(--bg-elevated); font-weight: var(--font-semibold); }
.markdown-body :deep(tr:nth-child(even)) { background: var(--bg-surface); }

.markdown-body :deep(code) {
  background: var(--bg-elevated);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-family: 'Fira Code', monospace;
  font-size: 0.9em;
  color: var(--primary);
}

.markdown-body :deep(pre) {
  background: var(--bg-elevated);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  overflow-x: auto;
  margin: var(--space-4) 0;
  border: 1px solid var(--border-default);
}

.markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
  color: var(--text-primary);
  font-size: 13px;
  font-family: 'Consolas', 'Monaco', 'Fira Code', 'Courier New', monospace;
  line-height: 1.4;
  white-space: pre;
  tab-size: 4;
  letter-spacing: 0;
}

.markdown-body :deep(blockquote) {
  margin: var(--space-4) 0;
  padding: var(--space-3) var(--space-4);
  border-left: 4px solid var(--primary);
  background: var(--bg-surface);
  color: var(--text-secondary);
}

.markdown-body :deep(hr) { border: none; border-top: 1px solid var(--border-default); margin: var(--space-6) 0; }
.markdown-body :deep(a) { color: var(--primary); text-decoration: none; }
.markdown-body :deep(a:hover) { text-decoration: underline; }
.markdown-body :deep(strong) { font-weight: var(--font-semibold); }

.markdown-body :deep(.mermaid-wrapper) {
  position: relative;
  background: var(--bg-elevated);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  margin: var(--space-4) 0;
  border: 1px solid var(--border-default);
  overflow-x: auto;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.markdown-body :deep(.mermaid-wrapper:hover) {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-border);
}

.markdown-body :deep(.mermaid-wrapper .zoom-hint) {
  position: absolute;
  top: 8px;
  right: 8px;
  background: var(--overlay-bg);
  color: var(--text-on-primary);
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.markdown-body :deep(.mermaid-wrapper:hover .zoom-hint) { opacity: 1; }
.markdown-body :deep(.mermaid) { display: flex; justify-content: center; }
.markdown-body :deep(.mermaid svg) { max-width: 100%; height: auto; }

.zoom-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.zoom-modal-content {
  display: flex;
  flex-direction: column;
  width: 95vw;
  height: 95vh;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.zoom-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-default);
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.zoom-btn,
.zoom-close-btn {
  width: 36px;
  height: 36px;
  background: var(--bg-hover);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.zoom-btn { font-size: 18px; }
.zoom-close-btn { font-size: 16px; }

.zoom-btn:hover {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--text-on-primary);
}

.zoom-btn.reset {
  width: auto;
  padding: 0 var(--space-3);
  font-size: 14px;
}

.zoom-level {
  min-width: 60px;
  text-align: center;
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: var(--font-medium);
}

.zoom-close-btn:hover {
  background: var(--error);
  border-color: var(--error);
  color: var(--text-on-primary);
}

.zoom-viewport {
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-base);
  position: relative;
}

.zoom-svg-container {
  transform-origin: center center;
  transition: transform 0.1s ease-out;
  user-select: none;
}

.zoom-svg-container :deep(svg) {
  display: block;
  max-width: none !important;
  max-height: none !important;
}

.zoom-hint-text {
  text-align: center;
  padding: var(--space-2);
  color: var(--text-tertiary);
  font-size: var(--text-sm);
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-default);
}

@media (max-width: 1024px) { .toc-sidebar { width: 220px; } }
@media (max-width: 768px) {
  .toc-sidebar { display: none; }
  .doc-content { padding: var(--space-4); }
  .doc-selector.mobile { display: block; }
}
</style>
