import { AIClient, aiClient } from '../ai/AIClient';
import { foreshadowingRepository, PlantedForeshadowing } from '../../repositories/ForeshadowingRepository';
import { characterStateRepository, StateChanges } from '../../repositories/CharacterStateRepository';
import { Character } from '../../models/Character';
import { STATE_ANALYSIS_PROMPT } from './prompts';
import {
  StateAnalysisResult,
  CharacterAnalysis,
  PlantedForeshadowingItem,
  OldFormatChange,
} from './types';
import {
  parseAnalysisResponse,
  calculateForeshadowingSimilarity,
  verifyForeshadowingResolution,
  extractCliffhangerFromScript,
} from './utils';

const TOKEN_LIMIT = 4000;

function ensureCondition(changes: StateChanges): NonNullable<StateChanges['condition']> {
  if (!changes.condition) {
    changes.condition = { physical: '状态正常', mental: '状态正常', combat: '战力正常' };
  }
  return changes.condition;
}

export class StateAnalyzer {
  private projectId: string;
  private aiClient: AIClient;

  constructor(projectId: string) {
    this.projectId = projectId;
    this.aiClient = aiClient;
  }

  async analyzeEpisode(
    episode: number,
    scriptContent: string,
    autoUpdate: boolean = true
  ): Promise<StateAnalysisResult> {
    console.log(`[StateAnalyzer] 分析第${episode}集...`);

    const MAX_RETRIES = 2;
    let analysis: StateAnalysisResult | null = null;

    const unresolvedForeshadowing = await foreshadowingRepository.getUnresolved(this.projectId);
    let foreshadowingContext = '';

    if (unresolvedForeshadowing.length > 0) {
      const topForeshadowing = unresolvedForeshadowing.slice(0, 20);
      foreshadowingContext = `
【待回收伏笔列表 - 请检查本集是否回收了以下伏笔】
${topForeshadowing.map(f => `- 第${f.episodePlanted}集埋下 [${f.importance}]: ${f.content}`).join('\n')}

如果本集剧情揭示或解答了上述任何伏笔，请在 resolved 数组中标记。
`;
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      let userMessage = `请分析以下第${episode}集剧本，提取所有角色状态变化：
${foreshadowingContext}
---剧本开始---
${scriptContent}
---剧本结束---

请输出JSON格式的分析结果。`;

      if (attempt > 0) {
        userMessage += `

【格式提醒】请务必：
1. 只输出JSON，不要任何其他文字
2. 确保JSON语法正确
3. 严格按照系统指令中的JSON结构输出`;
      }

      try {
        const response = await this.aiClient.generate(
          STATE_ANALYSIS_PROMPT,
          userMessage,
          TOKEN_LIMIT
        );

        analysis = parseAnalysisResponse(response);
        if (analysis?.characters !== undefined) {
          break;
        }
      } catch (error) {
        console.error(`[StateAnalyzer] 第${episode}集分析失败:`, error);
        if (attempt === MAX_RETRIES) throw error;
      }
    }

    if (!analysis || analysis.characters === undefined) {
      console.error(`[StateAnalyzer] 第${episode}集状态分析失败，使用空结果`);
      analysis = {
        episode,
        characters: [],
        episodeSummary: {
          brief: `第${episode}集`,
          keyEvents: [],
          cliffhanger: '',
          foreshadowing: { planted: [], resolved: [] },
        },
      };
    }

    if (autoUpdate && analysis.characters.length > 0) {
      await this.applyStateChanges(episode, analysis.characters);
    }

    await this.processForeshadowing(episode, analysis, scriptContent);

    console.log(`[StateAnalyzer] 第${episode}集分析完成`);
    return analysis;
  }

  private async processForeshadowing(
    episode: number,
    analysis: StateAnalysisResult,
    scriptContent: string
  ): Promise<void> {
    const cliffhanger = analysis.episodeSummary?.cliffhanger;
    const foreshadowing = analysis.episodeSummary?.foreshadowing || { planted: [], resolved: [] };

    // 兜底：如果有cliffhanger但没被识别为伏笔，自动添加
    if (cliffhanger && cliffhanger.length > 10) {
      const plantedContents = (foreshadowing.planted || []).map(f => f.content?.toLowerCase() || '');
      const cliffhangerLower = cliffhanger.toLowerCase();

      const alreadyTracked = plantedContents.some(content =>
        content.includes(cliffhangerLower.substring(0, 10)) ||
        cliffhangerLower.includes(content.substring(0, 10))
      );

      if (!alreadyTracked) {
        foreshadowing.planted = foreshadowing.planted || [];
        foreshadowing.planted.push({
          content: cliffhanger,
          type: 'suspense',
          importance: 'normal',
        });
        console.log(`[StateAnalyzer] 自动将结尾钩子转为伏笔: ${cliffhanger.substring(0, 30)}...`);
      }
    }

    // 处理埋下的伏笔
    if (foreshadowing.planted?.length > 0) {
      const result = await foreshadowingRepository.createBatch(
        this.projectId,
        episode,
        foreshadowing.planted as PlantedForeshadowing[]
      );
      console.log(`[StateAnalyzer] 第${episode}集埋下${result.created}个伏笔`);
    }

    // 处理回收的伏笔
    if (foreshadowing.resolved?.length > 0) {
      await this.processResolvedForeshadowing(episode, foreshadowing.resolved, scriptContent);
    }

    // 容错：如果AI没提取到伏笔，尝试从剧本提取
    if (!foreshadowing.planted?.length && !foreshadowing.resolved?.length) {
      const fallbackCliffhanger = extractCliffhangerFromScript(scriptContent);
      if (fallbackCliffhanger) {
        await foreshadowingRepository.create(this.projectId, episode, {
          content: fallbackCliffhanger,
          type: 'suspense',
          importance: 'low',
        });
        console.log(`[StateAnalyzer] 容错提取伏笔: ${fallbackCliffhanger.substring(0, 30)}...`);
      }
    }
  }

  private async processResolvedForeshadowing(
    episode: number,
    resolved: { content: string; resolution: string }[],
    scriptContent: string
  ): Promise<void> {
    const unresolvedList = await foreshadowingRepository.getUnresolved(this.projectId);
    let resolvedCount = 0;

    for (const item of resolved) {
      const match = this.findMatchingForeshadowing(item.content, unresolvedList);
      if (match) {
        const verification = verifyForeshadowingResolution(
          match.content,
          item.resolution || item.content,
          scriptContent
        );

        const note = verification.verified
          ? item.resolution
          : `[未验证] ${item.resolution || ''}`;

        await foreshadowingRepository.resolve(match._id.toString(), episode, note);
        resolvedCount++;

        if (verification.verified) {
          console.log(`[StateAnalyzer] 回收伏笔: "${match.content}" (验证: ${(verification.score * 100).toFixed(0)}%)`);
        } else {
          console.warn(`[StateAnalyzer] 警告: 伏笔回收未验证 "${match.content}"`);
        }
      }
    }

    if (resolvedCount > 0) {
      console.log(`[StateAnalyzer] 第${episode}集回收${resolvedCount}个伏笔`);
    }
  }

  private findMatchingForeshadowing(
    resolvedContent: string,
    unresolvedList: Array<{ _id: { toString(): string }; content: string }>
  ): { _id: { toString(): string }; content: string } | null {
    if (!resolvedContent || unresolvedList.length === 0) return null;

    const resolvedLower = resolvedContent.toLowerCase();
    const MIN_SIMILARITY = 0.45;

    // 精确匹配
    for (const f of unresolvedList) {
      if (f.content.toLowerCase() === resolvedLower) {
        return f;
      }
    }

    // 相似度匹配
    let bestMatch: { item: typeof unresolvedList[0]; similarity: number } | null = null;

    for (const f of unresolvedList) {
      const similarity = calculateForeshadowingSimilarity(resolvedContent, f.content);
      if (similarity >= MIN_SIMILARITY) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { item: f, similarity };
        }
      }
    }

    if (bestMatch) {
      console.log(`[StateAnalyzer] 伏笔匹配: "${bestMatch.item.content}" (相似度: ${(bestMatch.similarity * 100).toFixed(1)}%)`);
      return bestMatch.item;
    }

    return null;
  }

  private async applyStateChanges(
    episode: number,
    characters: CharacterAnalysis[]
  ): Promise<void> {
    for (const charData of characters) {
      const char = await Character.findOne({
        projectId: this.projectId,
        name: charData.name,
      });

      if (!char) {
        console.log(`[StateAnalyzer] 未找到角色: ${charData.name}`);
        continue;
      }

      const updates = charData.updates;
      if (!updates) continue;

      const currentState = await characterStateRepository.getLatestState(
        this.projectId,
        char._id.toString()
      );

      const changes: StateChanges = {
        equipmentGained: [],
        equipmentLost: [],
        newAbilities: [],
        condition: null,
        permanentMark: null,
        description: '',
      };

      const descriptions: string[] = [];

      if (updates.equipment) {
        if (updates.equipment.gained?.length > 0) {
          for (const item of updates.equipment.gained) {
            if (!currentState?.currentEquipment?.includes(item)) {
              changes.equipmentGained.push(item);
              descriptions.push(`获得${item}`);
            }
          }
        }
        if (updates.equipment.lost?.length > 0) {
          changes.equipmentLost = updates.equipment.lost;
          descriptions.push(`失去${updates.equipment.lost.join('、')}`);
        }
      }

      if (updates.abilities?.newlyRevealed?.length > 0) {
        for (const ability of updates.abilities.newlyRevealed) {
          if (!currentState?.currentAbilities?.includes(ability)) {
            changes.newAbilities.push(ability);
            descriptions.push(`展示新能力：${ability}`);
          }
        }
      }

      if (updates.condition) {
        changes.condition = {
          physical: updates.condition.physical || '状态正常',
          mental: updates.condition.mental || '状态正常',
          combat: updates.condition.combat || '战力正常',
        };
      }

      if (updates.permanentMark) {
        changes.permanentMark = updates.permanentMark;
        descriptions.push(`【永久性变化】${updates.permanentMark.mark}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const charDataAny = charData as any;
      if (Array.isArray(charDataAny.changes)) {
        this.processOldFormatChanges(
          charDataAny.changes,
          { equipment: currentState?.currentEquipment, abilities: currentState?.currentAbilities },
          changes,
          descriptions
        );
      }

      changes.description = descriptions.join('；');

      await characterStateRepository.updateState(
        this.projectId,
        char._id.toString(),
        charData.name,
        episode,
        changes
      );

      if (descriptions.length > 0) {
        console.log(`[StateAnalyzer] 更新${charData.name}状态: ${changes.description}`);
      } else {
        console.log(`[StateAnalyzer] 记录${charData.name}在第${episode}集出场`);
      }
    }
  }

  async analyzeMultipleEpisodes(
    episodes: { episode: number; content: string }[]
  ): Promise<StateAnalysisResult[]> {
    const results: StateAnalysisResult[] = [];

    for (const { episode, content } of episodes) {
      const result = await this.analyzeEpisode(episode, content, true);
      results.push(result);
      // 避免API限流
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  }

  extractForeshadowingFromScript(
    episode: number,
    scriptContent: string
  ): { planted: PlantedForeshadowingItem[]; resolved: never[] } {
    if (!scriptContent || scriptContent.length < 100) {
      return { planted: [], resolved: [] };
    }

    const cliffhanger = extractCliffhangerFromScript(scriptContent);
    if (!cliffhanger) {
      return { planted: [], resolved: [] };
    }

    console.log(`[StateAnalyzer] 从剧本提取悬念: ${cliffhanger.substring(0, 30)}...`);

    const importance = cliffhanger.length > 10 ? 'normal' : 'low';
    return {
      planted: [{ content: cliffhanger, type: 'suspense', importance }],
      resolved: [],
    };
  }

  private processOldFormatChanges(
    changesArray: OldFormatChange[],
    currentState: { equipment?: string[]; abilities?: string[] } | null,
    changes: StateChanges,
    descriptions: string[]
  ): void {
    for (const change of changesArray) {
      switch (change.type) {
        case 'equipment':
          if (change.action === 'add' && change.item) {
            if (!currentState?.equipment?.includes(change.item)) {
              changes.equipmentGained.push(change.item);
              descriptions.push(`获得${change.item}`);
            }
          } else if (change.action === 'remove' && change.item) {
            changes.equipmentLost.push(change.item);
            descriptions.push(`失去${change.item}`);
          }
          break;

        case 'ability':
          if (change.name && !currentState?.abilities?.includes(change.name)) {
            changes.newAbilities.push(change.name);
            descriptions.push(`展示新能力：${change.name}`);
          }
          break;

        case 'injury': {
          const condition = ensureCondition(changes);
          if (change.action === 'recover') {
            condition.physical = `伤势痊愈：${change.detail || ''}`;
            descriptions.push('伤势痊愈');
          } else if (change.detail) {
            condition.physical = change.detail;
            descriptions.push(`受伤：${change.detail}`);
          }
          break;
        }

        case 'power': {
          const condition = ensureCondition(changes);
          condition.combat = change.detail || change.status || '战力变化';
          descriptions.push(`实力变化：${change.detail || change.status || ''}`);
          break;
        }

        case 'event':
          if (change.description) {
            descriptions.push(change.description);
          }
          break;
      }
    }
  }
}
