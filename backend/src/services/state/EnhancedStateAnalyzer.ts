/**
 * 增强版状态分析器
 * 与 WorldStateManager 集成，输出完整的 JSON 分析结果
 */

import { Character } from '../../models/Character';
import { GrowthEventType } from '../../models/CharacterEnhancement';
import { RelationshipEventType, RelationshipImpact, RelationshipLevel } from '../../models/CharacterRelationship';
import { IWorldState } from '../../models/WorldState';
import { foreshadowingRepository } from '../../repositories/ForeshadowingRepository';
import { worldStateRepository } from '../../repositories/WorldStateRepository';
import {
  DEFAULT_ANALYSIS_RESULT,
  IAnalysisResult,
  robustParseJson,
} from '../../utils/jsonParser';
import { AIClient, aiClient } from '../ai/AIClient';
import { characterArcTracker } from '../character/CharacterArcTracker';
import { characterVoiceProfiler } from '../character/CharacterVoiceProfiler';
import { relationshipTracker } from '../character/RelationshipTracker';
import { WorldStateManager } from '../world/WorldStateManager';
import { ENHANCED_ANALYSIS_PROMPT } from './prompts';

const TOKEN_LIMIT = 8000;
const LOG_PREFIX = '[EnhancedStateAnalyzer]';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** 在 keyword map 中查找第一个匹配项 */
function findFirstMatchInMap<T extends string>(
  text: string,
  keywordMap: Record<T, string[]>
): T | null {
  for (const [key, keywords] of Object.entries(keywordMap) as [T, string[]][]) {
    if ((keywords as string[]).some(kw => text.includes(kw))) {
      return key;
    }
  }
  return null;
}

function containsAnyKeyword(text: string, keywords: string[]): boolean {
  return keywords.some(kw => text.includes(kw));
}

export class EnhancedStateAnalyzer {
  private projectId: string;
  private aiClient: AIClient;
  private worldStateManager: WorldStateManager;

  constructor(projectId: string, aiClientInstance?: AIClient) {
    this.projectId = projectId;
    this.aiClient = aiClientInstance || aiClient;
    this.worldStateManager = new WorldStateManager(projectId, this.aiClient);
  }

  /**
   * 分析单集剧本并更新 WorldState
   */
  async analyzeEpisode(
    episode: number,
    scriptContent: string,
    autoUpdate: boolean = true
  ): Promise<IAnalysisResult> {
    console.log(`${LOG_PREFIX} 分析第${episode}集...`);

    const [characters, unresolvedForeshadowings] = await Promise.all([
      this.getCharacterList(),
      this.getUnresolvedForeshadowings(),
    ]);

    const prompt = ENHANCED_ANALYSIS_PROMPT
      .replace('{script}', scriptContent)
      .replace('{characters}', characters)
      .replace('{unresolvedForeshadowings}', unresolvedForeshadowings);

    let analysis: IAnalysisResult = DEFAULT_ANALYSIS_RESULT;
    const MAX_RETRIES = 2;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`${LOG_PREFIX} AI 分析尝试 ${attempt}/${MAX_RETRIES}...`);
        const response = await this.aiClient.generate('', prompt, TOKEN_LIMIT);

        if (!response || response.length < 100) {
          console.warn(`${LOG_PREFIX} AI 响应过短 (${response?.length || 0}字符)，重试...`);
          if (attempt < MAX_RETRIES) { await delay(1000); continue; }
        }

        analysis = robustParseJson<IAnalysisResult>(response, DEFAULT_ANALYSIS_RESULT);

        if (!this.isValidAnalysisResult(analysis) && attempt < MAX_RETRIES) {
          console.warn(`${LOG_PREFIX} 解析结果无效，重试...`);
          await delay(1000);
          continue;
        }

        console.log(`${LOG_PREFIX} 第${episode}集分析完成 (尝试 ${attempt} 次):`);
        console.log(`  - 角色更新: ${analysis.characterUpdates?.length || 0}个`);
        console.log(`  - 新角色: ${analysis.newCharacters?.length || 0}个`);
        console.log(`  - 伏笔回收: ${analysis.foreshadowingResolved?.length || 0}个`);
        console.log(`  - 新埋伏笔: ${analysis.foreshadowingPlanted?.length || 0}个`);
        break;
      } catch (error) {
        console.error(`${LOG_PREFIX} 第${episode}集分析失败 (尝试 ${attempt}):`, error);
        if (attempt < MAX_RETRIES) { await delay(1000); }
      }
    }

    analysis = this.sanitizeAnalysisResult(analysis);

    if (autoUpdate) {
      await this.applyUpdates(episode, analysis);
    }

    return analysis;
  }

  private isValidAnalysisResult(analysis: IAnalysisResult): boolean {
    return !!(
      analysis.characterUpdates?.length ||
      analysis.newCharacters?.length ||
      analysis.foreshadowingResolved?.length ||
      analysis.foreshadowingPlanted?.length ||
      analysis.plotUpdates?.keyEvent ||
      analysis.episodeSummary?.summary
    );
  }

  /**
   * 清理分析结果，确保所有字段都有有效值
   */
  private sanitizeAnalysisResult(analysis: IAnalysisResult): IAnalysisResult {
    return {
      characterUpdates: analysis.characterUpdates || [],
      newCharacters: analysis.newCharacters || [],
      characterTierChanges: analysis.characterTierChanges || [],
      characterExits: analysis.characterExits || [],
      foreshadowingResolved: analysis.foreshadowingResolved || [],
      foreshadowingPlanted: analysis.foreshadowingPlanted || [],
      plotUpdates: analysis.plotUpdates || {
        currentArc: '',
        arcProgress: 0,
        keyEvent: '',
        newConflict: null,
        resolvedConflict: null,
        cliffhanger: '',
      },
      worldUpdates: analysis.worldUpdates || {
        newSecrets: [],
        factionChanges: [],
        newLocations: [],
        itemChanges: [],
      },
      episodeSummary: analysis.episodeSummary || {
        summary: '',
        keyEvents: [],
        cliffhanger: '',
      },
      multiHeadInsights: analysis.multiHeadInsights || {
        H1_relationships: [],
        H2_conflicts: [],
        H3_foreshadowing: [],
        H4_emotions: [],
        H5_consistency: [],
        H6_pacing: [],
        crossDimensionSuggestions: [],
      },
      nextEpisodeHints: analysis.nextEpisodeHints || {
        suggestedFocus: [],
        pendingForeshadowings: [],
        charactersThatShouldAppear: [],
        suggestedNewCharacters: [],
      },
    };
  }

  /**
   * 获取角色列表（格式化文本）
   */
  private async getCharacterList(): Promise<string> {
    const characters = await Character.find({ projectId: this.projectId });

    if (characters.length === 0) {
      return '暂无已知角色';
    }

    return characters
      .map((c) => `- ${c.name} (${c.role || c.type || '未知'}): ${c.identity || ''}`)
      .join('\n');
  }

  /**
   * 获取未回收伏笔（格式化文本）
   */
  private async getUnresolvedForeshadowings(): Promise<string> {
    const foreshadowings = await foreshadowingRepository.getUnresolved(
      this.projectId
    );

    if (foreshadowings.length === 0) {
      return '暂无未回收伏笔';
    }

    return foreshadowings
      .slice(0, 20)
      .map(
        (f) =>
          `- 第${f.episodePlanted}集 [${f.importance}]: ${f.content}`
      )
      .join('\n');
  }

  private async applyUpdates(
    episode: number,
    analysis: IAnalysisResult
  ): Promise<void> {
    const previousState = await worldStateRepository.getStateAtEpisode(
      this.projectId,
      episode - 1
    );

    await this.worldStateManager.updateFromAnalysis(episode, analysis, previousState);
    await this.syncForeshadowings(episode, analysis);
    await this.syncNewCharacters(episode, analysis);

    // 以下检测失败不阻断主流程
    await this.safeExecute('成长事件检测', () => this.detectAndRecordGrowthEvents(episode, analysis));
    await this.safeExecute('关系变化检测', () => this.detectAndRecordRelationshipChanges(episode, analysis));
    await this.safeExecute('对白风格检测', () => this.detectDialogueStyleInconsistencies(episode, analysis));

    console.log(`${LOG_PREFIX} 第${episode}集状态已更新`);
  }

  /** 执行非关键操作，失败时仅打印日志不阻断主流程 */
  private async safeExecute(label: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (error) {
      console.error(`${LOG_PREFIX} ${label}失败:`, error);
    }
  }

  private async findCharacterByName(name: string): Promise<InstanceType<typeof Character> | null> {
    return Character.findOne({ projectId: this.projectId, name });
  }

  private static readonly SIGNIFICANT_MENTAL_KEYWORDS = [
    '觉醒', '顿悟', '转变', '成长', '蜕变', '决心', '放下', '接受',
    '原谅', '理解', '领悟', '突破', '克服', '战胜', '面对',
  ];

  private static readonly SIGNIFICANT_RELATIONSHIP_KEYWORDS = [
    '和解', '决裂', '结盟', '背叛', '信任', '原谅', '告白', '分离',
    '重逢', '认可', '敌对', '化敌为友', '反目',
  ];

  private async detectAndRecordGrowthEvents(
    episode: number,
    analysis: IAnalysisResult
  ): Promise<void> {
    for (const update of analysis.characterUpdates) {
      const character = await this.findCharacterByName(update.characterName);
      if (!character) continue;

      const id = character._id.toString();
      const name = update.characterName;
      const record = (type: GrowthEventType, desc: string) =>
        characterArcTracker.recordGrowthEvent(this.projectId, id, name, episode, type, desc);

      if (update.newAbilities?.length) {
        for (const ability of update.newAbilities) {
          await record('skill', `获得新能力：${ability}`);
        }
      }

      if (update.mentalChange && containsAnyKeyword(update.mentalChange, EnhancedStateAnalyzer.SIGNIFICANT_MENTAL_KEYWORDS)) {
        await record('mindset', `心态转变：${update.mentalChange}`);
      }

      if (update.relationshipChanges?.length) {
        for (const rel of update.relationshipChanges) {
          if (containsAnyKeyword(rel.change, EnhancedStateAnalyzer.SIGNIFICANT_RELATIONSHIP_KEYWORDS)) {
            await record('relationship', `关系变化：与${rel.target}的关系${rel.change}`);
          }
        }
      }
    }

    console.log(`${LOG_PREFIX} 第${episode}集成长事件检测完成`);
  }

  private async detectAndRecordRelationshipChanges(
    episode: number,
    analysis: IAnalysisResult
  ): Promise<void> {
    for (const update of analysis.characterUpdates) {
      if (!update.relationshipChanges?.length) continue;

      const characterA = await this.findCharacterByName(update.characterName);
      if (!characterA) continue;

      for (const rel of update.relationshipChanges) {
        const characterB = await this.findCharacterByName(rel.target);
        if (!characterB) continue;

        const { eventType, impact, newLevel } = this.parseRelationshipChange(rel.change);

        await relationshipTracker.recordKeyEvent(
          this.projectId,
          characterA._id.toString(),
          characterB._id.toString(),
          characterA.name,
          characterB.name,
          episode,
          eventType,
          rel.change,
          impact
        );

        if (newLevel) {
          await relationshipTracker.updateRelationship(
            this.projectId,
            characterA._id.toString(),
            characterB._id.toString(),
            characterA.name,
            characterB.name,
            newLevel,
            rel.change,
            episode
          );
        }
      }
    }

    console.log(`${LOG_PREFIX} 第${episode}集关系变化检测完成`);
  }

  private static readonly EVENT_KEYWORDS: Record<RelationshipEventType, string[]> = {
    first_meeting: ['初次见面', '初遇', '相遇', '初识'],
    bonding: ['结盟', '合作', '信任', '认可', '友好', '亲近', '好感'],
    conflict: ['冲突', '争吵', '矛盾', '对立', '不满', '误会'],
    betrayal: ['背叛', '出卖', '欺骗', '反目'],
    reconciliation: ['和解', '原谅', '化解', '重归于好', '冰释前嫌'],
    deepening: ['深化', '加深', '告白', '表白', '亲密', '升温'],
  };

  private static readonly LEVEL_KEYWORDS: Record<RelationshipLevel, string[]> = {
    stranger: ['陌生', '不认识'],
    acquaintance: ['相识', '认识', '初识'],
    familiar: ['熟悉', '了解', '熟络'],
    close: ['亲近', '信任', '好友', '挚友'],
    intimate: ['亲密', '恋人', '爱人', '伴侣'],
    hostile: ['敌对', '对立', '仇视', '敌意'],
    enemy: ['仇敌', '死敌', '不共戴天'],
  };

  private static readonly IMPACT_KEYWORDS: Record<'positive' | 'negative', string[]> = {
    positive: ['信任', '认可', '好感', '亲近', '和解', '原谅', '深化', '告白', '合作', '结盟'],
    negative: ['冲突', '背叛', '敌对', '反目', '决裂', '仇视', '矛盾', '不满'],
  };

  private parseRelationshipChange(change: string): {
    eventType: RelationshipEventType;
    impact: RelationshipImpact;
    newLevel: RelationshipLevel | null;
  } {
    const text = change.toLowerCase();

    return {
      eventType: findFirstMatchInMap(text, EnhancedStateAnalyzer.EVENT_KEYWORDS) ?? 'bonding',
      impact: findFirstMatchInMap(text, EnhancedStateAnalyzer.IMPACT_KEYWORDS) ?? 'neutral',
      newLevel: findFirstMatchInMap(text, EnhancedStateAnalyzer.LEVEL_KEYWORDS),
    };
  }

  private async syncForeshadowings(
    episode: number,
    analysis: IAnalysisResult
  ): Promise<void> {
    for (const f of analysis.foreshadowingPlanted) {
      await foreshadowingRepository.create(this.projectId, episode, {
        content: f.content,
        type: f.type,
        importance: f.importance,
      });
    }
    if (analysis.foreshadowingPlanted.length > 0) {
      console.log(`${LOG_PREFIX} 埋设${analysis.foreshadowingPlanted.length}个伏笔`);
    }

    if (analysis.foreshadowingResolved.length > 0) {
      const unresolvedList = await foreshadowingRepository.getUnresolved(this.projectId);

      for (const resolved of analysis.foreshadowingResolved) {
        const match = this.findMatchingForeshadowing(resolved.originalContent, unresolvedList);
        if (match) {
          await foreshadowingRepository.resolve(match._id.toString(), episode, resolved.resolutionNote);
          console.log(`${LOG_PREFIX} 回收伏笔: "${match.content.substring(0, 30)}..."`);
        }
      }
    }

    // 自动将结尾钩子作为伏笔（如果尚未被 AI 识别为伏笔）
    const cliffhanger = analysis.plotUpdates?.cliffhanger;
    if (cliffhanger && cliffhanger.length > 10) {
      const alreadyPlanted = analysis.foreshadowingPlanted.some(
        (f) => f.content.includes(cliffhanger.substring(0, 20))
      );
      if (!alreadyPlanted) {
        await foreshadowingRepository.create(this.projectId, episode, {
          content: cliffhanger,
          type: 'suspense',
          importance: 'normal',
        });
        console.log(`${LOG_PREFIX} 自动将结尾钩子转为伏笔: "${cliffhanger.substring(0, 30)}..."`);
      }
    }
  }

  /** 模糊匹配伏笔：精确 > 包含 > 关键词 */
  private findMatchingForeshadowing(
    content: string,
    unresolvedList: Array<{ _id: { toString(): string }; content: string }>
  ): { _id: { toString(): string }; content: string } | null {
    if (!content || unresolvedList.length === 0) return null;

    const contentLower = content.toLowerCase();

    const exact = unresolvedList.find(f => f.content.toLowerCase() === contentLower);
    if (exact) return exact;

    const contains = unresolvedList.find(f => {
      const fLower = f.content.toLowerCase();
      return fLower.includes(contentLower) || contentLower.includes(fLower);
    });
    if (contains) return contains;

    const contentWords = contentLower.split(/[，。、\s]+/).filter(w => w.length > 2);
    return unresolvedList.find(f => {
      const fWords = f.content.toLowerCase().split(/[，。、\s]+/);
      const matchCount = contentWords.filter(w => fWords.some(fw => fw.includes(w))).length;
      return matchCount >= 2 || matchCount >= contentWords.length * 0.5;
    }) ?? null;
  }

  private async syncNewCharacters(
    _episode: number,
    analysis: IAnalysisResult
  ): Promise<void> {
    for (const newChar of analysis.newCharacters) {
      if (!newChar.trackingRequired) continue;

      const existing = await this.findCharacterByName(newChar.name);
      if (existing) continue;

      await Character.create({
        projectId: this.projectId,
        name: newChar.name,
        role: newChar.initialState?.role || '',
        type: this.tierToType(newChar.suggestedTier),
        gender: '未知',
        identity: newChar.reason || '',
        personality: '',
        background: '',
      });

      console.log(`${LOG_PREFIX} 创建新角色: ${newChar.name} (${newChar.suggestedTier})`);
    }
  }

  private static readonly TIER_TO_TYPE: Record<string, string> = {
    core: '主角',
    recurring: '重要配角',
    arc: '关键角色',
    temporary: '客串角色',
    extra: '龙套',
  };

  private tierToType(tier: string): string {
    return EnhancedStateAnalyzer.TIER_TO_TYPE[tier] || '配角';
  }

  /**
   * 批量分析多集
   */
  async analyzeMultipleEpisodes(
    episodes: { episode: number; content: string }[]
  ): Promise<IAnalysisResult[]> {
    const results: IAnalysisResult[] = [];

    for (const { episode, content } of episodes) {
      const result = await this.analyzeEpisode(episode, content, true);
      results.push(result);
      await delay(500);
    }

    return results;
  }

  /**
   * 初始化第一集的 WorldState
   */
  async initializeWorldState(): Promise<IWorldState> {
    const characters = await Character.find({ projectId: this.projectId });

    const charData = characters.map((c) => ({
      name: c.name,
      role: c.role || c.type || '未知',
      tier: this.typeToTier(c.type) as 'core' | 'recurring' | 'arc' | 'temporary' | 'extra',
      abilities: c.initialAbilities || [],
      equipment: c.initialEquipment || [],
    }));

    return this.worldStateManager.initializeFirstEpisode(charData);
  }

  /**
   * 将角色类型转换为层级
   */
  private typeToTier(type: string): string {
    const typeMapping: Record<string, string> = {
      '主角': 'core',
      '男主角': 'core',
      '女主角': 'core',
      '反派': 'recurring',
      '重要配角': 'recurring',
      '关键角色': 'arc',
      '配角': 'arc',
      '客串角色': 'temporary',
      '客串': 'temporary',
      '龙套': 'extra',
    };
    return typeMapping[type] || 'arc';
  }

  /**
   * 获取生成上下文（用于剧本生成）
   */
  async getGenerationContext(
    episodePlan: string
  ): Promise<{
    formattedContext: string;
    constraints: string[];
    suggestions: string[];
  }> {
    const worldState = await worldStateRepository.getLatestState(this.projectId);

    if (!worldState) {
      return {
        formattedContext: '',
        constraints: [],
        suggestions: [],
      };
    }

    const context = await this.worldStateManager.buildGenerationContext(
      worldState,
      episodePlan
    );

    return {
      formattedContext: context.formattedContext,
      constraints: context.constraints,
      suggestions: [
        ...context.hiddenConnections,
        ...context.suggestedElements,
      ],
    };
  }

  /**
   * 检测对白风格一致性 (Requirements 10.4)
   */
  private async detectDialogueStyleInconsistencies(
    _episode: number,
    analysis: IAnalysisResult
  ): Promise<void> {
    try {
      // 获取项目中所有角色的语言风格
      const voices = await characterVoiceProfiler.getProjectVoices(this.projectId);
      
      if (voices.length === 0) {
        return; // 没有配置语言风格，跳过检测
      }

      const warnings: Array<{ characterName: string; warning: string }> = [];

      // 从分析结果中提取角色对白（如果有的话）
      for (const update of analysis.characterUpdates) {
        const voiceData = voices.find(v => v.characterName === update.characterName);
        
        if (!voiceData) {
          continue; // 该角色没有配置语言风格
        }

        // 如果分析结果中包含对白样本，进行验证
        // 注意：当前 IAnalysisResult 可能不包含对白，这里预留扩展点
        // 实际验证可以在生成后的后处理中进行
      }

      if (warnings.length > 0) {
        console.log(`[EnhancedStateAnalyzer] 对白风格警告:`);
        for (const w of warnings) {
          console.log(`  - ${w.characterName}: ${w.warning}`);
        }
      }
    } catch (error) {
      console.error(`[EnhancedStateAnalyzer] 对白风格检测失败:`, error);
      // 不阻断主流程
    }
  }

  /**
   * 验证剧本中的对白风格一致性（公开方法，可在生成后调用）
   */
  async validateScriptDialogueStyles(
    scriptContent: string
  ): Promise<Array<{ characterName: string; warnings: string[] }>> {
    const results: Array<{ characterName: string; warnings: string[] }> = [];

    try {
      // 获取项目中所有角色的语言风格
      const voices = await characterVoiceProfiler.getProjectVoices(this.projectId);
      
      if (voices.length === 0) {
        return results;
      }

      // 提取剧本中的对白
      const dialoguePattern = /^(.+?)(?:（.+?）)?[：:]\s*(.+)$/gm;
      const dialogues: Map<string, string[]> = new Map();

      let match;
      while ((match = dialoguePattern.exec(scriptContent)) !== null) {
        const characterName = match[1].trim();
        const dialogue = match[2].trim();
        
        if (!dialogues.has(characterName)) {
          dialogues.set(characterName, []);
        }
        dialogues.get(characterName)!.push(dialogue);
      }

      // 验证每个角色的对白
      for (const voiceData of voices) {
        const characterDialogues = dialogues.get(voiceData.characterName);
        
        if (!characterDialogues || characterDialogues.length === 0) {
          continue;
        }

        const allWarnings: string[] = [];
        
        for (const dialogue of characterDialogues) {
          const validation = characterVoiceProfiler.validateDialogue(voiceData.voice, dialogue);
          if (!validation.valid) {
            allWarnings.push(...validation.warnings);
          }
        }

        if (allWarnings.length > 0) {
          // 去重
          const uniqueWarnings = [...new Set(allWarnings)];
          results.push({
            characterName: voiceData.characterName,
            warnings: uniqueWarnings,
          });
        }
      }
    } catch (error) {
      console.error(`[EnhancedStateAnalyzer] 对白风格验证失败:`, error);
    }

    return results;
  }
}
