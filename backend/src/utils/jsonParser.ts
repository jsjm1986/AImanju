const logJson = {
  info: (msg: string) => console.log(`[JsonParser] ${msg}`),
  warn: (msg: string) => console.warn(`[JsonParser] ⚠️ ${msg}`),
  error: (msg: string, data?: string) => {
    console.error(`[JsonParser] ❌ ${msg}`);
    if (data) console.error(`[JsonParser] 数据: ${data.substring(0, 300)}${data.length > 300 ? '...' : ''}`);
  },
};

const BRACKET_PAIR: Record<string, string> = { '{': '}', '[': ']' };

const JSON_TERMINATORS = new Set([':', ',', '}', ']', '']);

function startsWithJsonChar(s: string): boolean {
  return s.startsWith('{') || s.startsWith('[');
}

function normalizeJsonChars(s: string): string {
  return s
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'");
}

type CharHandler = (char: string, inString: boolean, index: number, source: string) => string | null;

function walkJsonChars(jsonString: string, handler: CharHandler): string {
  let result = '';
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString[i];

    if (escapeNext) {
      result += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      result += char;
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }

    const replacement = handler(char, inString, i, jsonString);
    if (replacement !== null) {
      result += replacement;
    } else {
      result += char;
    }
  }

  return result;
}

function findNextNonWhitespace(s: string, from: number): string {
  for (let j = from; j < s.length; j++) {
    if (!/\s/.test(s[j])) return s[j];
  }
  return '';
}

type ExtractionStrategy = {
  regex: RegExp;
  level: 'info' | 'warn';
  label: string;
  requireJsonStart?: boolean;
  stripTrailingBackticks?: boolean;
};

const EXTRACTION_STRATEGIES: ExtractionStrategy[] = [
  { regex: /```json\s*([\s\S]*?)\s*```/, level: 'info', label: '完整 ```json 代码块' },
  { regex: /```\s*([\s\S]*?)\s*```/, level: 'info', label: '完整 ``` 代码块', requireJsonStart: true },
  { regex: /```json\s*([\s\S]*)/, level: 'warn', label: '截断的 ```json 代码块（可能不完整）', stripTrailingBackticks: true },
  { regex: /```\s*([\s\S]*)/, level: 'warn', label: '截断的 ``` 代码块（可能不完整）', requireJsonStart: true, stripTrailingBackticks: true },
  { regex: /\{[\s\S]*\}/, level: 'info', label: '正则匹配 JSON 对象' },
  { regex: /\{[\s\S]*/, level: 'warn', label: '不完整的 JSON 对象（需要修复）' },
  { regex: /\[[\s\S]*\]/, level: 'info', label: '正则匹配 JSON 数组' },
];

export function extractJsonFromResponse(response: string): string {
  if (!response || typeof response !== 'string') {
    logJson.warn('extractJsonFromResponse: 输入为空或非字符串');
    return '';
  }

  for (const strategy of EXTRACTION_STRATEGIES) {
    const match = response.match(strategy.regex);
    if (!match) continue;

    const isCapture = match.length > 1;
    let content = (isCapture ? match[1] : match[0]).trim();

    if (strategy.stripTrailingBackticks) {
      content = content.replace(/`+$/, '').trim();
    }

    if (strategy.requireJsonStart && !startsWithJsonChar(content)) continue;

    logJson[strategy.level](`提取方式: ${strategy.label}`);
    return content;
  }

  logJson.warn('无法识别 JSON 格式，返回原始响应');
  return response.trim();
}

export function safeParseJson<T>(jsonString: string, defaultValue: T): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    logJson.error('safeParseJson 解析失败', jsonString);
    console.error('[JsonParser] 原始字符串:', jsonString.substring(0, 200));
    return defaultValue;
  }
}

export function parseJsonFromResponse<T>(response: string, defaultValue: T): T {
  const jsonString = extractJsonFromResponse(response);
  return safeParseJson(jsonString, defaultValue);
}

export function fixJsonString(jsonString: string): string {
  let fixed = normalizeJsonChars(jsonString).trim();
  fixed = fixUnescapedNewlines(fixed);
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');
  fixed = fixed.replace(/'([^']+)':/g, '"$1":');
  fixed = fixed.replace(/([{,]\s*)([a-zA-Z_]\w*)\s*:/g, '$1"$2":');
  return fixed;
}

function fixUnescapedNewlines(jsonString: string): string {
  let result = '';
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString[i];

    if (escapeNext) { result += char; escapeNext = false; continue; }
    if (char === '\\') { result += char; escapeNext = true; continue; }
    if (char === '"') { inString = !inString; result += char; continue; }

    if (inString && (char === '\n' || char === '\r')) {
      if (char === '\r' && jsonString[i + 1] === '\n') {
        result += '\\n';
        i++;
      } else if (char === '\n') {
        result += '\\n';
      } else {
        result += '\\r';
      }
      continue;
    }

    result += char;
  }

  return result;
}

export function fixTruncatedJson(jsonString: string): string {
  let fixed = jsonString.trim();

  try {
    JSON.parse(fixed);
    return fixed;
  } catch {
    // continue to fix
  }

  const lastCompleteMatch = fixed.match(/^([\s\S]*[}\]"0-9])\s*,?\s*"[^"]*$/);
  if (lastCompleteMatch) fixed = lastCompleteMatch[1];

  const incompleteStringMatch = fixed.match(/^([\s\S]*"[^"]*":\s*")[^"]*$/);
  if (incompleteStringMatch) fixed = incompleteStringMatch[1] + '..."';

  const stack: string[] = [];
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < fixed.length; i++) {
    const char = fixed[i];
    if (escapeNext) { escapeNext = false; continue; }
    if (char === '\\') { escapeNext = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (char === '{' || char === '[') {
      stack.push(char);
    } else if (char === '}' && stack.length > 0 && stack[stack.length - 1] === '{') {
      stack.pop();
    } else if (char === ']' && stack.length > 0 && stack[stack.length - 1] === '[') {
      stack.pop();
    }
  }

  if (inString) fixed += '"';
  fixed = fixed.replace(/,\s*$/, '');

  while (stack.length > 0) {
    fixed += BRACKET_PAIR[stack.pop()!] ?? '';
  }

  return fixed;
}

export function robustParseJson<T>(response: string, defaultValue: T): T {
  if (!response || typeof response !== 'string') {
    logJson.warn('robustParseJson: 输入为空或非字符串');
    return defaultValue;
  }

  logJson.info(`开始解析 JSON (输入长度: ${response.length})`);

  const extracted = extractJsonFromResponse(response);
  if (!extracted) {
    logJson.warn('无法从响应中提取 JSON');
    return defaultValue;
  }

  const attempts: Array<{ label: string; json: string; level: 'info' | 'warn' }> = [
    { label: '直接解析', json: extracted, level: 'info' },
    { label: '格式修复后', json: fixJsonString(extracted), level: 'info' },
    { label: '截断修复后', json: fixTruncatedJson(fixJsonString(extracted)), level: 'warn' },
    { label: '激进修复后', json: aggressiveJsonFix(extracted), level: 'warn' },
  ];

  for (let i = 0; i < attempts.length; i++) {
    const { label, json, level } = attempts[i];
    try {
      const result = JSON.parse(json) as T;
      logJson[level](`第${i + 1}次尝试（${label}）解析成功`);
      return result;
    } catch (e) {
      logJson.warn(`第${i + 1}次尝试失败: ${(e as Error).message}`);
    }
  }

  logJson.error('所有尝试都失败');
  logJson.error('原始响应', response);
  return defaultValue;
}

function aggressiveJsonFix(jsonString: string): string {
  let fixed = normalizeJsonChars(jsonString);
  fixed = fixed.replace(/\.{3,}/g, '...');
  fixed = fixed.replace(/\\u(?![0-9a-fA-F]{4})/g, 'u');
  fixed = fixMultilineStrings(fixed);
  fixed = fixUnescapedNewlines(fixed);
  fixed = fixUnescapedQuotesInStrings(fixed);
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');
  fixed = fixSpecialCharacters(fixed);
  fixed = fixTruncatedJson(fixed);
  return fixed;
}

function fixMultilineStrings(jsonString: string): string {
  let result = '';
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString[i];

    if (escapeNext) {
      result += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      result += char;
      escapeNext = true;
      continue;
    }

    if (char === '"' && !inString) {
      inString = true;
      result += char;
      continue;
    }

    if (char === '"' && inString) {
      const lookAhead = findNextNonWhitespace(jsonString, i + 1);
      if (JSON_TERMINATORS.has(lookAhead)) {
        inString = false;
        result += char;
      } else {
        result += '\\"';
      }
      continue;
    }

    if (inString) {
      if (char === '\n') { result += '\\n'; continue; }
      if (char === '\t') { result += '\\t'; continue; }
      if (char.charCodeAt(0) < 32) continue;
    }

    result += char;
  }

  return result;
}

function fixSpecialCharacters(jsonString: string): string {
  let fixed = jsonString.replace(/[\u200B-\u200D\uFEFF]/g, '');
  fixed = fixed.replace(/\\u(?![0-9a-fA-F]{4})/g, '\\\\u');
  fixed = fixed.replace(/\\([^"\\\/bfnrtu])/g, (_match, char) => {
    return /[0-9]/.test(char) ? char : '\\\\' + char;
  });

  return walkJsonChars(fixed, (char, inString) => {
    if (!inString) return null;
    if (char === '\t') return '\\t';
    if (char === '\r') return '\\r';
    if (char === '\n') return '\\n';
    if (char.charCodeAt(0) < 32) return '';
    return null;
  });
}

function fixUnescapedQuotesInStrings(jsonString: string): string {
  let result = '';
  let inString = false;
  let escapeNext = false;
  let stringContent = '';

  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString[i];

    if (escapeNext) {
      if (inString) { stringContent += char; } else { result += char; }
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      if (inString) { stringContent += char; } else { result += char; }
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      if (!inString) {
        inString = true;
        stringContent = '';
        result += char;
      } else {
        const nextNonWs = findNextNonWhitespace(jsonString, i + 1);
        const isStringEnd = JSON_TERMINATORS.has(nextNonWs);
        const isFollowedByNewString = nextNonWs === '"' &&
          /[,:\[\{]/.test(result.substring(result.length - 10));

        if (isStringEnd || isFollowedByNewString) {
          result += sanitizeStringContent(stringContent);
          result += char;
          inString = false;
          stringContent = '';
        } else {
          stringContent += '\\"';
        }
      }
      continue;
    }

    if (inString) { stringContent += char; } else { result += char; }
  }

  if (inString && stringContent) {
    result += sanitizeStringContent(stringContent);
  }

  return result;
}

function sanitizeStringContent(content: string): string {
  return content
    .replace(/\\(?![nrtbf"\\/u])/g, '\\\\')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/\t/g, '\\t');
}

export function validateJsonStructure(
  json: unknown,
  requiredFields: string[]
): { valid: boolean; missingFields: string[] } {
  if (typeof json !== 'object' || json === null) {
    return { valid: false, missingFields: requiredFields };
  }

  const obj = json as Record<string, unknown>;
  const missingFields = requiredFields.filter((field) => !(field in obj));

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

export const DEFAULT_ANALYSIS_RESULT = {
  characterUpdates: [],
  newCharacters: [],
  characterTierChanges: [],
  characterExits: [],
  foreshadowingResolved: [],
  foreshadowingPlanted: [],
  plotUpdates: {
    currentArc: '',
    arcProgress: 0,
    keyEvent: '',
    newConflict: null,
    resolvedConflict: null,
    cliffhanger: '',
  },
  worldUpdates: {
    newSecrets: [],
    factionChanges: [],
    newLocations: [],
    itemChanges: [],
  },
  episodeSummary: {
    summary: '',
    keyEvents: [],
    cliffhanger: '',
  },
  multiHeadInsights: {
    H1_relationships: [],
    H2_conflicts: [],
    H3_foreshadowing: [],
    H4_emotions: [],
    H5_consistency: [],
    H6_pacing: [],
    crossDimensionSuggestions: [],
  },
  nextEpisodeHints: {
    suggestedFocus: [],
    pendingForeshadowings: [],
    charactersThatShouldAppear: [],
    suggestedNewCharacters: [],
  },
};

export const DEFAULT_ATTENTION_RESULT = {
  attentionAnalysis: {
    characters: [],
    foreshadowings: [],
    events: [],
    conflicts: [],
  },
  hiddenConnections: [],
  suggestedElements: [],
};

export interface ICharacterUpdate {
  characterName: string;
  equipmentGained: string[];
  equipmentLost: string[];
  newAbilities: string[];
  physicalChange: string | null;
  mentalChange: string | null;
  locationChange: string | null;
  relationshipChanges: Array<{
    target: string;
    change: string;
  }>;
  formChange?: {
    from: string;
    to: string;
    trigger: string;
    isNewForm: boolean;
  } | null;
}

export interface INewCharacter {
  name: string;
  nameCn?: string;
  suggestedTier: 'core' | 'recurring' | 'arc' | 'temporary' | 'extra';
  reason: string;
  belongsToArc?: string;
  trackingRequired: boolean;
  initialState?: {
    role?: string;
    abilities?: string[];
    location?: string;
  };
}

export interface IForeshadowingResolved {
  originalContent: string;
  matchScore: number;
  resolutionNote: string;
}

export interface IForeshadowingPlanted {
  content: string;
  type: 'plot' | 'character' | 'item' | 'suspense';
  importance: 'high' | 'normal' | 'low';
  expectedResolution?: string;
}

export interface IAnalysisResult {
  characterUpdates: ICharacterUpdate[];
  newCharacters: INewCharacter[];
  characterTierChanges: Array<{
    name: string;
    from: string;
    to: string;
    reason: string;
  }>;
  characterExits: Array<{
    name: string;
    exitType: 'deceased' | 'departed' | 'archived';
    episode: number;
    note: string;
  }>;
  foreshadowingResolved: IForeshadowingResolved[];
  foreshadowingPlanted: IForeshadowingPlanted[];
  plotUpdates: {
    currentArc: string;
    arcProgress: number;
    keyEvent: string;
    newConflict: string | null;
    resolvedConflict: string | null;
    cliffhanger: string;
  };
  worldUpdates: {
    newSecrets: string[];
    factionChanges: Array<{ faction: string; change: string }>;
    newLocations: Array<{ name: string; description: string }>;
    itemChanges: Array<{ item: string; change: string }>;
  };
  episodeSummary: {
    summary: string;
    keyEvents: string[];
    cliffhanger: string;
  };
  multiHeadInsights?: {
    H1_relationships: string[];
    H2_conflicts: string[];
    H3_foreshadowing: string[];
    H4_emotions: string[];
    H5_consistency: string[];
    H6_pacing: string[];
    crossDimensionSuggestions: string[];
  };
  nextEpisodeHints: {
    suggestedFocus: string[];
    pendingForeshadowings: string[];
    charactersThatShouldAppear: string[];
    suggestedNewCharacters?: string[];
  };
}

export interface IAttentionResult {
  attentionAnalysis: {
    characters: Array<{
      name: string;
      weight: number;
      reason: string;
    }>;
    foreshadowings: Array<{
      content: string;
      weight: number;
      reason: string;
    }>;
    events: Array<{
      content: string;
      weight: number;
      reason: string;
    }>;
    conflicts: Array<{
      content: string;
      weight: number;
      reason: string;
    }>;
  };
  hiddenConnections: string[];
  suggestedElements: string[];
}
