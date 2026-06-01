import { AIClient, aiClient } from '../ai/AIClient';
import { foreshadowingRepository } from '../../repositories/ForeshadowingRepository';
import { IForeshadowing } from '../../models/Foreshadowing';

export type ForeshadowingStatus = 'planted' | 'resolved' | 'abandoned' | 'overdue';

export interface ForeshadowingStats {
  total: number;
  planted: number;
  resolved: number;
  abandoned: number;
  overdue: number;
  byType: Record<string, number>;
  byImportance: Record<string, number>;
}

export interface ForeshadowingValidationResult {
  valid: boolean;
  issues: ForeshadowingIssue[];
  suggestions: string[];
}

export interface ForeshadowingIssue {
  foreshadowingId: string;
  content: string;
  episodePlanted: number;
  importance: string;
  issueType: 'overdue' | 'inconsistent' | 'duplicate' | 'orphan';
  description: string;
  suggestion: string;
}

export interface ForeshadowingAnalysis {
  content: string;
  type: 'suspense' | 'character' | 'item' | 'plot';
  importance: 'high' | 'normal' | 'low';
  relatedCharacters: string[];
  suggestedResolution: string;
  estimatedResolutionEpisode: number;
}

const OVERDUE_THRESHOLD: Record<string, number> = {
  high: 10,
  normal: 20,
  low: 30,
};

const IMPORTANCE_ORDER: Record<string, number> = { high: 0, normal: 1, low: 2 };

function getThreshold(importance: string): number {
  return OVERDUE_THRESHOLD[importance] ?? 20;
}

function sortByImportance(a: IForeshadowing, b: IForeshadowing): number {
  return (IMPORTANCE_ORDER[a.importance] ?? 1) - (IMPORTANCE_ORDER[b.importance] ?? 1);
}

const FORESHADOWING_ANALYSIS_PROMPT = `你是一位专业的剧本分析师，专门分析剧本中的伏笔和悬念。

## 任务
分析提供的剧本内容，识别其中的伏笔、悬念和线索。

## 伏笔类型
- suspense: 悬念类（神秘人物身份、未解谜团）
- character: 角色类（角色隐藏的秘密、背景暗示）
- item: 道具类（神秘物品、未知功能的装备）
- plot: 剧情类（预言、警告、暗示未来事件）

## 重要程度
- high: 主线伏笔，必须回收
- normal: 支线伏笔，建议回收
- low: 氛围伏笔，可选回收

## 输出格式（JSON）
{
  "foreshadowings": [
    {
      "content": "伏笔内容描述",
      "type": "类型",
      "importance": "重要程度",
      "relatedCharacters": ["相关角色"],
      "suggestedResolution": "建议的回收方式",
      "estimatedResolutionEpisode": 建议回收的集数
    }
  ]
}`;

export class PlotThreadValidator {
  private projectId: string;
  private aiClient: AIClient;

  constructor(projectId: string) {
    this.projectId = projectId;
    this.aiClient = aiClient;
  }

  async getStats(currentEpisode?: number): Promise<ForeshadowingStats> {
    const baseStats = await foreshadowingRepository.getStats(this.projectId);

    let overdueCount = 0;
    if (currentEpisode) {
      const unresolved = await foreshadowingRepository.getUnresolved(this.projectId);
      overdueCount = unresolved.filter(
        f => currentEpisode - f.episodePlanted >= getThreshold(f.importance)
      ).length;
    }

    return {
      ...baseStats,
      overdue: overdueCount,
      byType: {
        suspense: 0,
        character: 0,
        item: 0,
        plot: 0,
        ...baseStats.byImportance,
      },
    };
  }

  async validate(currentEpisode: number): Promise<ForeshadowingValidationResult> {
    const issues: ForeshadowingIssue[] = [];
    const suggestions: string[] = [];

    const unresolved = await foreshadowingRepository.getUnresolved(this.projectId);
    const allForeshadowing = await foreshadowingRepository.findByProject(this.projectId);

    for (const f of unresolved) {
      const gap = currentEpisode - f.episodePlanted;
      const threshold = getThreshold(f.importance);

      if (gap >= threshold) {
        issues.push({
          foreshadowingId: f._id.toString(),
          content: f.content,
          episodePlanted: f.episodePlanted,
          importance: f.importance,
          issueType: 'overdue',
          description: `伏笔已超过${gap}集未回收（阈值：${threshold}集）`,
          suggestion: `建议在接下来的剧情中安排回收此伏笔，或标记为已放弃`,
        });
      }
    }

    const contentMap = new Map<string, IForeshadowing[]>();
    for (const f of allForeshadowing) {
      const key = f.content.toLowerCase().substring(0, 20);
      const group = contentMap.get(key);
      if (group) {
        group.push(f);
      } else {
        contentMap.set(key, [f]);
      }
    }

    for (const [, items] of contentMap) {
      if (items.length <= 1) continue;
      for (const dup of items.slice(1)) {
        issues.push({
          foreshadowingId: dup._id.toString(),
          content: dup.content,
          episodePlanted: dup.episodePlanted,
          importance: dup.importance,
          issueType: 'duplicate',
          description: `与第${items[0].episodePlanted}集的伏笔可能重复`,
          suggestion: '考虑合并或删除重复的伏笔记录',
        });
      }
    }

    const highPriorityCount = unresolved.filter(f => f.importance === 'high').length;
    if (highPriorityCount > 3) {
      suggestions.push(`有${highPriorityCount}个高优先级伏笔待回收，建议尽快安排剧情回收`);
    }

    const overdueHighCount = issues.filter(
      i => i.issueType === 'overdue' && i.importance === 'high'
    ).length;
    if (overdueHighCount > 0) {
      suggestions.push(`有${overdueHighCount}个高优先级伏笔已超期，需要立即处理`);
    }

    return { valid: issues.length === 0, issues, suggestions };
  }

  async analyzeScript(
    episodeNumber: number,
    scriptContent: string
  ): Promise<ForeshadowingAnalysis[]> {
    const userMessage = `请分析以下第${episodeNumber}集剧本中的伏笔和悬念：

${scriptContent}

请识别所有伏笔并按JSON格式输出。`;

    try {
      const response = await this.aiClient.generate(
        FORESHADOWING_ANALYSIS_PROMPT,
        userMessage,
        4000
      );

      let jsonStr = response
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonStr);
      return parsed.foreshadowings || [];
    } catch (error) {
      console.error('[PlotThreadValidator] 分析失败:', error);
      return [];
    }
  }

  async getSuggestions(currentEpisode: number): Promise<{
    urgent: IForeshadowing[];
    recommended: IForeshadowing[];
    optional: IForeshadowing[];
  }> {
    const unresolved = await foreshadowingRepository.getUnresolved(this.projectId);

    const urgent: IForeshadowing[] = [];
    const recommended: IForeshadowing[] = [];
    const optional: IForeshadowing[] = [];

    for (const f of unresolved) {
      const gap = currentEpisode - f.episodePlanted;
      const threshold = getThreshold(f.importance);

      if (gap >= threshold) {
        urgent.push(f);
      } else if (gap >= threshold * 0.5 || f.importance === 'high') {
        recommended.push(f);
      } else {
        optional.push(f);
      }
    }

    urgent.sort(sortByImportance);
    recommended.sort(sortByImportance);
    optional.sort(sortByImportance);

    return { urgent, recommended, optional };
  }

  async checkResolution(
    foreshadowingId: string,
    scriptContent: string
  ): Promise<{ resolved: boolean; confidence: number; evidence?: string }> {
    const foreshadowing = await foreshadowingRepository.findById(foreshadowingId);
    if (!foreshadowing) {
      return { resolved: false, confidence: 0 };
    }

    const keywords = foreshadowing.content
      .split(/[，,、。！？\s]+/)
      .filter(w => w.length >= 2)
      .slice(0, 5);

    let matchCount = 0;
    let matchedKeyword = '';

    for (const keyword of keywords) {
      if (scriptContent.includes(keyword)) {
        matchCount++;
        if (!matchedKeyword) matchedKeyword = keyword;
      }
    }

    const confidence = keywords.length > 0 ? matchCount / keywords.length : 0;

    return {
      resolved: confidence >= 0.4,
      confidence,
      evidence: matchedKeyword ? `包含关键词"${matchedKeyword}"` : undefined,
    };
  }

  async getTimeline(): Promise<{
    episode: number;
    planted: IForeshadowing[];
    resolved: IForeshadowing[];
  }[]> {
    const all = await foreshadowingRepository.findByProject(this.projectId);

    type EpisodeEntry = { planted: IForeshadowing[]; resolved: IForeshadowing[] };
    const episodeMap = new Map<number, EpisodeEntry>();

    function getEntry(ep: number): EpisodeEntry {
      let entry = episodeMap.get(ep);
      if (!entry) {
        entry = { planted: [], resolved: [] };
        episodeMap.set(ep, entry);
      }
      return entry;
    }

    for (const f of all) {
      getEntry(f.episodePlanted).planted.push(f);
      if (f.episodeResolved) {
        getEntry(f.episodeResolved).resolved.push(f);
      }
    }

    return Array.from(episodeMap.entries())
      .map(([episode, data]) => ({ episode, ...data }))
      .sort((a, b) => a.episode - b.episode);
  }
}
