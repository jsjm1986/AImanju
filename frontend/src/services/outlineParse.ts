/**
 * 纯大纲文本解析器（无依赖，可单测）。
 * 支持三种格式：
 * - 增强模式 `## 故事内核 / ## 角色功能 / ## 人物卡 / ## 剧情大纲 / ## 分集梗概`
 *   （边界仅识别已知 ## 标题；### 及以下嵌套子标题保留在所属章节内）
 * - 标准模式 `### 一、人物卡` / `### 二、剧情大纲` / `### 三、分集梗概`（末段取到文末）
 * - 旧式【人物卡】【剧情大纲】【分集梗概】（末段取到文末）
 */

export interface ParsedOutlineFields {
  raw: string;
  enhanced: boolean;
  storyCore: string;
  characterFunctions: string;
  characterCards: string;
  synopsis: string;
  episodeSummaries: string;
}

interface SectionHit { key: keyof Omit<ParsedOutlineFields, 'raw' | 'enhanced'>; start: number; bodyStart: number; }

const ENHANCED_TITLES: Array<{ title: string; key: keyof Omit<ParsedOutlineFields, 'raw' | 'enhanced'> }> = [
  { title: '故事内核', key: 'storyCore' },
  { title: '角色功能', key: 'characterFunctions' },
  { title: '人物卡', key: 'characterCards' },
  { title: '剧情大纲', key: 'synopsis' },
  { title: '分集梗概', key: 'episodeSummaries' },
];

const STANDARD_TITLES: Array<{ title: string; key: keyof Omit<ParsedOutlineFields, 'raw' | 'enhanced'> }> = [
  { title: '人物卡', key: 'characterCards' },
  { title: '剧情大纲', key: 'synopsis' },
  { title: '分集梗概', key: 'episodeSummaries' },
];

const BRACKET_TITLES: Array<{ title: string; key: keyof Omit<ParsedOutlineFields, 'raw' | 'enhanced'> }> = [
  { title: '人物卡', key: 'characterCards' },
  { title: '剧情大纲', key: 'synopsis' },
  { title: '分集梗概', key: 'episodeSummaries' },
];

/** 增强模式：行首 `## 标题`（精确匹配已知标题，### 子标题不算边界） */
function findEnhancedSections(content: string): SectionHit[] {
  const hits: SectionHit[] = [];
  const re = /^##[ \t]+([^\n#]+)[ \t]*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const title = m[1]!.trim();
    const found = ENHANCED_TITLES.find(t => t.title === title);
    if (found) hits.push({ key: found.key, start: m.index, bodyStart: m.index + m[0].length });
  }
  return hits;
}

/** 标准模式：行首 `### 一、人物卡`（允许一至三个 #，标题需以已知章节名开头） */
function findStandardSections(content: string): SectionHit[] {
  const hits: SectionHit[] = [];
  const re = /^#{1,3}[ \t]*(?:[一二三]、)?[ \t]*([^\n#]+?)[ \t]*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const title = m[1]!.trim();
    const found = STANDARD_TITLES.find(t => title.startsWith(t.title));
    if (found) hits.push({ key: found.key, start: m.index, bodyStart: m.index + m[0].length });
  }
  return hits;
}

/** 旧式【章节名】标记 */
function findBracketSections(content: string): SectionHit[] {
  const hits: SectionHit[] = [];
  for (const { title, key } of BRACKET_TITLES) {
    const idx = content.indexOf(`【${title}】`);
    if (idx >= 0) hits.push({ key, start: idx, bodyStart: idx + title.length + 2 });
  }
  return hits.sort((a, b) => a.start - b.start);
}

export function parseOutlineText(content: string): ParsedOutlineFields {
  const result: ParsedOutlineFields = {
    raw: content,
    enhanced: false,
    storyCore: '',
    characterFunctions: '',
    characterCards: '',
    synopsis: '',
    episodeSummaries: '',
  };
  if (!content) return result;

  // 增强模式判定：必须命中“故事内核/角色功能”级标题，标准三章 ## 不算增强
  let hits = findEnhancedSections(content);
  const hasEnhancedOnly = hits.some(h => h.key === 'storyCore' || h.key === 'characterFunctions');
  if (!hasEnhancedOnly) hits = [];
  if (hits.length === 0) hits = findStandardSections(content);
  else result.enhanced = true;
  if (hits.length === 0) hits = findBracketSections(content);

  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i]!;
    const end = i + 1 < hits.length ? hits[i + 1]!.start : content.length;
    const body = content.slice(hit.bodyStart, end).trim();
    // 同名章节只取首个
    if (!result[hit.key]) result[hit.key] = body;
  }
  return result;
}
