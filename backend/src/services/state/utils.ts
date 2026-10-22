/**
 * StateAnalyzer 工具函数
 */

import { StateAnalysisResult, VerificationResult } from './types';

// 停用词列表
const STOP_WORDS = new Set([
  '的', '了', '是', '在', '有', '和', '与', '或', '被', '把',
  '对', '这', '那', '之', '于', '为', '以', '也', '都', '就',
  '而', '但', '着', '过', '到', '中'
]);

/**
 * 提取关键词
 */
export function extractKeywords(text: string): string[] {
  if (!text) return [];
  return text
    .split(/[，,、。！？\s：:""''【】\[\]（）()]+/)
    .filter(w => w.length >= 2 && !STOP_WORDS.has(w));
}

/**
 * 解析AI返回的分析结果
 */
export function parseAnalysisResponse(response: string): StateAnalysisResult | null {
  if (!response) return null;

  let cleaned = response;

  // 移除常见的非JSON前缀
  const prefixes = [
    /^好的[，,。]?\s*/i,
    /^以下是[^{]*/i,
    /^根据[^{]*/i,
    /^分析结果[如下：:]*\s*/i,
  ];

  for (const prefix of prefixes) {
    cleaned = cleaned.replace(prefix, '');
  }

  // 移除markdown代码块
  cleaned = cleaned
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // 尝试直接解析
  try {
    return JSON.parse(cleaned);
  } catch {
    // 尝试提取JSON对象
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      let jsonStr = jsonMatch[0];

      // 修复常见JSON问题
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
      jsonStr = jsonStr.replace(/[""]/g, '"').replace(/['']/g, "'");

      try {
        return JSON.parse(jsonStr);
      } catch {
        // 尝试修复截断的JSON
        return tryRepairTruncatedJson(jsonStr);
      }
    }
  }

  // 返回空结果
  return { episode: 0, characters: [], episodeSummary: { brief: '', keyEvents: [], cliffhanger: '', foreshadowing: { planted: [], resolved: [] } } };
}

/**
 * 尝试修复截断的JSON
 */
function tryRepairTruncatedJson(jsonStr: string): StateAnalysisResult | null {
  try {
    // 提取episode
    const epMatch = jsonStr.match(/"episode"\s*:\s*(\d+)/);
    const episode = epMatch ? parseInt(epMatch[1]) : 0;

    // 尝试补全括号
    let repaired = jsonStr;
    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/\]/g) || []).length;

    // 截断到最后一个完整的对象
    const lastComplete = repaired.lastIndexOf('}');
    if (lastComplete > 0) {
      repaired = repaired.substring(0, lastComplete + 1);
    }

    // 补全缺失的闭合符号
    for (let i = 0; i < openBrackets - closeBrackets; i++) {
      repaired += ']';
    }
    for (let i = 0; i < openBraces - closeBraces; i++) {
      repaired += '}';
    }

    return JSON.parse(repaired);
  } catch {
    return null;
  }
}

/**
 * 计算两个伏笔描述的相似度（0-1）
 */
export function calculateForeshadowingSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;

  const t1 = text1.toLowerCase();
  const t2 = text2.toLowerCase();

  // 提取关键词
  const keywords1 = extractKeywords(t1);
  const keywords2 = extractKeywords(t2);

  if (keywords1.length === 0 || keywords2.length === 0) return 0;

  // 计算Jaccard相似度
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);
  const intersection = [...set1].filter(k => set2.has(k));
  const union = new Set([...set1, ...set2]);
  const jaccardSimilarity = intersection.length / union.size;

  // 计算实体匹配（中文2-4字词 或 拉丁字母人名/词，兼容海外剧本英文名）
  const entityPattern = /[\u4e00-\u9fa5]{2,4}|[A-Za-z][A-Za-z'’.\-]{1,19}/g;
  const entities1 = (t1.match(entityPattern) || []).slice(0, 5);
  const entities2 = (t2.match(entityPattern) || []).slice(0, 5);

  let entityMatchScore = 0;
  if (entities1.length > 0 && entities2.length > 0) {
    const entitySet1 = new Set(entities1);
    const entitySet2 = new Set(entities2);
    const entityIntersection = [...entitySet1].filter(e => entitySet2.has(e));
    entityMatchScore = entityIntersection.length / Math.min(entitySet1.size, entitySet2.size);
  }

  // 综合评分
  return jaccardSimilarity * 0.5 + entityMatchScore * 0.5;
}

/**
 * 验证伏笔回收
 */
export function verifyForeshadowingResolution(
  foreshadowingContent: string,
  resolutionContent: string,
  scriptContent: string
): VerificationResult {
  if (!scriptContent || scriptContent.length === 0) {
    return { verified: true, score: 1, reason: '无剧本内容，跳过验证' };
  }

  const scriptLower = scriptContent.toLowerCase();
  const MIN_SCORE = 0.3;

  // 提取关键词
  const foreshadowKeywords = extractKeywords(foreshadowingContent);
  const resolutionKeywords = extractKeywords(resolutionContent);
  const allKeywords = [...new Set([...foreshadowKeywords, ...resolutionKeywords])];

  if (allKeywords.length === 0) {
    return { verified: true, score: 0.5, reason: '无法提取关键词' };
  }

  // 检查关键词出现
  let matchedCount = 0;
  const matchedKeywords: string[] = [];

  for (const keyword of allKeywords) {
    if (scriptLower.includes(keyword.toLowerCase())) {
      matchedCount++;
      matchedKeywords.push(keyword);
    }
  }

  const matchRatio = matchedCount / allKeywords.length;

  // 检查实体（兼容拉丁字母人名）
  const entityPattern = /[\u4e00-\u9fa5]{2,4}|[A-Za-z][A-Za-z'’.\-]{1,19}/g;
  const entities = (foreshadowingContent.match(entityPattern) || []).slice(0, 3);
  let entityMatchCount = 0;

  for (const entity of entities) {
    if (scriptLower.includes(entity.toLowerCase())) {
      entityMatchCount++;
    }
  }

  const entityMatchRatio = entities.length > 0 ? entityMatchCount / entities.length : 0.5;

  // 综合评分
  const score = matchRatio * 0.6 + entityMatchRatio * 0.4;
  const verified = score >= MIN_SCORE;

  let reason = '';
  if (!verified) {
    reason = `关键词匹配率 ${(matchRatio * 100).toFixed(0)}%`;
    if (matchedKeywords.length > 0) {
      reason += `，已匹配: ${matchedKeywords.slice(0, 3).join('、')}`;
    }
  }

  return { verified, score, reason };
}

/**
 * 从剧本中提取结尾悬念（容错机制）
 */
export function extractCliffhangerFromScript(scriptContent: string): string | null {
  if (!scriptContent || scriptContent.length < 100) return null;

  // 尝试多种模式
  const patterns = [
    /【?结尾悬念】?[：:]\s*(.+?)(?=\n|$)/i,
    /cliffhanger[：:]\s*(.+?)(?=\n|$)/i,
    /悬念[：:]\s*(.+?)(?=\n|$)/i,
    /\[HOOK\]\s*(.+?)(?=\n|$)/i,
    /【?钩子】?[：:]\s*(.+?)(?=\n|$)/i,
  ];

  for (const pattern of patterns) {
    const match = scriptContent.match(pattern);
    if (match?.[1]) {
      const cliffhanger = match[1].trim();
      if (cliffhanger.length > 10 && cliffhanger.length < 200) {
        return cliffhanger;
      }
    }
  }

  // 检查结尾部分的悬念性关键词
  const lastPart = scriptContent.slice(-200);
  const suspenseKeywords = ['神秘', '突然', '竟然', '不料', '却见', '谁知', '？', '......'];

  for (const keyword of suspenseKeywords) {
    if (lastPart.includes(keyword)) {
      const sentences = lastPart.split(/[。！？\n]/);
      const suspenseSentence = sentences.find(s => s.includes(keyword) && s.length > 10);
      if (suspenseSentence) {
        return suspenseSentence.trim().substring(0, 100);
      }
    }
  }

  return null;
}
