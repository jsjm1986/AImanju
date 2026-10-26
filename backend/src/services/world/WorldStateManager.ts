import mongoose from 'mongoose';
import {
  CharacterStatus,
  CharacterTier,
  ICharacterState,
  IWorldState,
} from '../../models/WorldState';
import { worldStateRepository } from '../../repositories/WorldStateRepository';
import {
  DEFAULT_ATTENTION_RESULT,
  IAnalysisResult,
  IAttentionResult,
  robustParseJson,
} from '../../utils/jsonParser';
import { AIClient, aiClient } from '../ai/AIClient';

export interface IGenerationContext {
  constraints: string[];
  previousCliffhanger: string | null;
  relevantCharacters: ICharacterState[];
  relevantForeshadowings: Array<{ content: string; weight: number; reason: string }>;
  relevantEvents: Array<{ content: string; weight: number; reason: string }>;
  hiddenConnections: string[];
  suggestedElements: string[];
  episodePlan: string;
  formattedContext: string;
}

// 分段衰减：近3集100%、4-10集70%、11-20集40%、20+集20%
function calculateTimeDecay(eventEpisode: number, currentEpisode: number): number {
  const age = currentEpisode - eventEpisode;
  if (age <= 3) return 1.0;
  if (age <= 10) return 0.7;
  if (age <= 20) return 0.4;
  return 0.2;
}

const IMPORTANCE_SCORES: Record<CharacterTier, number> = {
  core: 100, recurring: 70, arc: 50, temporary: 30, extra: 10,
};

const FORESHADOWING_THRESHOLDS: Record<string, number> = {
  high: 10, normal: 20, low: 30,
};

/** 创建默认角色状态 */
function createDefaultCharacterState(
  char: { name: string; role: string; tier: CharacterTier; abilities?: string[]; equipment?: string[] },
  overrides?: Partial<ICharacterState>
): ICharacterState {
  return {
    characterId: new mongoose.Types.ObjectId(),
    name: char.name,
    role: char.role,
    tier: char.tier,
    status: 'active',
    currentEquipment: char.equipment || [],
    currentAbilities: char.abilities || [],
    physicalCondition: '正常',
    mentalCondition: '正常',
    combatPower: '100%',
    currentForm: '基础形态',
    baseForm: '基础形态',
    unlockedForms: ['基础形态'],
    formHistory: [],
    permanentMarks: [],
    identityChanges: [],
    currentLocation: '',
    relationships: new Map(),
    firstAppearance: 0,
    lastAppearance: 0,
    appearanceCount: 0,
    consecutiveAppearances: 0,
    importanceScore: IMPORTANCE_SCORES[char.tier] || 50,
    ...overrides,
  };
}

/** 创建空的初始世界状态骨架 */
function createEmptyWorldState(
  projectId: string,
  characters: Map<string, ICharacterState>,
  plotOverrides?: Partial<IWorldState['plotState']>,
  constraintOverrides?: Partial<IWorldState['constraints']>
): Partial<IWorldState> {
  return {
    projectId: new mongoose.Types.ObjectId(projectId),
    episodeNumber: 0,
    characters,
    foreshadowings: { planted: [], recentlyResolved: [] },
    plotState: {
      currentArc: '',
      arcProgress: 0,
      mainPlotProgress: '',
      recentEvents: [],
      pendingConflicts: [],
      resolvedConflicts: [],
      cliffhangers: [],
      ...plotOverrides,
    },
    worldSettings: {
      revealedSecrets: [],
      hiddenSecrets: [],
      factions: new Map(),
      locations: new Map(),
      items: new Map(),
    },
    constraints: {
      mustInclude: [],
      mustAvoid: [],
      styleNotes: [],
      ...constraintOverrides,
    },
  };
}

/** 格式化势力和道具摘要 */
function formatWorldSettingsSummary(worldSettings: IWorldState['worldSettings']): string[] {
  const lines: string[] = [];
  if (worldSettings.factions?.size > 0) {
    const factions = Array.from(worldSettings.factions.entries())
      .map(([name, info]) => `${name}(${info.attitude})`);
    if (factions.length > 0) lines.push(`势力格局: ${factions.join('、')}`);
  }
  if (worldSettings.items?.size > 0) {
    const items = Array.from(worldSettings.items.entries())
      .filter(([_, info]) => info.status !== '丢失')
      .map(([name, info]) => `${name}(持有:${info.owner})`);
    if (items.length > 0) lines.push(`重要物品: ${items.join('、')}`);
  }
  return lines;
}

/** 向 sections 追加带标题的列表段落 */
function appendBulletSection(sections: string[], title: string, items: string[]): void {
  if (items.length === 0) return;
  sections.push(`\n${title}`);
  for (const item of items) {
    sections.push(`• ${item}`);
  }
}

export class WorldStateManager {
  private projectId: string;
  private aiClient: AIClient;

  constructor(projectId: string, aiClientInstance?: AIClient) {
    this.projectId = projectId;
    this.aiClient = aiClientInstance || aiClient;
  }

  async getWorldState(episodeNumber: number): Promise<IWorldState | null> {
    return worldStateRepository.getStateAtEpisode(this.projectId, episodeNumber);
  }

  async getLatestState(): Promise<IWorldState | null> {
    return worldStateRepository.getLatestState(this.projectId);
  }

  async updateFromAnalysis(
    currentEpisode: number,
    analysis: IAnalysisResult,
    previousState: IWorldState | null
  ): Promise<IWorldState> {
    console.log(`[WorldStateManager] 更新第${currentEpisode}集世界状态`);
    const newState = this.buildNewState(previousState, currentEpisode, analysis);
    return worldStateRepository.upsertState(this.projectId, currentEpisode, newState);
  }

  private buildNewState(
    previousState: IWorldState | null,
    currentEpisode: number,
    analysis: IAnalysisResult
  ): Partial<IWorldState> {
    // Mongoose Map 键不允许含 "." 或以 "$" 开头——英文名（如 D.Vescari）会写库失败，统一归一化
    const mk = (s?: string) => (typeof s === 'string' ? s.replace(/\./g, '·').replace(/^\$+/, '') : s);
    analysis.characterUpdates?.forEach(u => {
      u.characterName = mk(u.characterName) as string;
      u.relationshipChanges?.forEach(r => { r.target = mk(r.target) as string; });
    });
    analysis.newCharacters?.forEach(c => { c.name = mk(c.name) as string; });
    analysis.characterTierChanges?.forEach(c => { c.name = mk(c.name) as string; });
    analysis.characterExits?.forEach(c => { c.name = mk(c.name) as string; });
    analysis.worldUpdates?.factionChanges?.forEach(c => { c.faction = mk(c.faction) as string; });
    analysis.worldUpdates?.newLocations?.forEach(l => { l.name = mk(l.name) as string; });
    analysis.worldUpdates?.itemChanges?.forEach(c => { c.item = mk(c.item) as string; });

    const characters = new Map<string, ICharacterState>();
    previousState?.characters?.forEach((char, name) => {
      characters.set(name, { ...char });
    });

    const appearingNames = new Set(analysis.characterUpdates.map((u) => u.characterName));
    characters.forEach((char) => {
      if (!appearingNames.has(char.name)) char.consecutiveAppearances = 0;
    });

    for (const update of analysis.characterUpdates) {
      const existing = characters.get(update.characterName);
      if (!existing) continue;

      // 装备：合并新增、移除丢失
      const equip = Array.isArray(existing.currentEquipment) ? existing.currentEquipment : [];
      if (update.equipmentGained.length > 0) {
        existing.currentEquipment = [...new Set([...equip, ...update.equipmentGained])];
      }
      if (update.equipmentLost.length > 0) {
        existing.currentEquipment = (existing.currentEquipment || equip)
          .filter((e) => !update.equipmentLost.includes(e));
      }

      // 能力：合并新增
      const abilities = Array.isArray(existing.currentAbilities) ? existing.currentAbilities : [];
      if (update.newAbilities.length > 0) {
        existing.currentAbilities = [...new Set([...abilities, ...update.newAbilities])];
      }

      if (update.physicalChange) existing.physicalCondition = update.physicalChange;
      if (update.mentalChange) existing.mentalCondition = update.mentalChange;
      if (update.locationChange) existing.currentLocation = update.locationChange;

      if (update.relationshipChanges.length > 0) {
        if (!existing.relationships) existing.relationships = new Map<string, string>();
        for (const rel of update.relationshipChanges) {
          existing.relationships.set(rel.target, rel.change);
        }
      }

      if (update.formChange) {
        this.applyFormChange(existing, update.formChange, currentEpisode, update.characterName);
      }

      existing.lastAppearance = currentEpisode;
      existing.appearanceCount += 1;
      existing.consecutiveAppearances += 1;
    }

    for (const newChar of analysis.newCharacters) {
      if (newChar.trackingRequired && !characters.has(newChar.name)) {
        characters.set(newChar.name, createDefaultCharacterState(
          { name: newChar.name, role: newChar.initialState?.role || '未知', tier: newChar.suggestedTier as CharacterTier, abilities: newChar.initialState?.abilities },
          {
            status: 'active' as CharacterStatus,
            belongsToArc: newChar.belongsToArc,
            arcStartEpisode: currentEpisode,
            currentLocation: newChar.initialState?.location || '',
            firstAppearance: currentEpisode,
            lastAppearance: currentEpisode,
            appearanceCount: 1,
            consecutiveAppearances: 1,
          }
        ));
      }
    }

    for (const change of analysis.characterTierChanges) {
      const char = characters.get(change.name);
      if (!char) continue;
      char.tier = change.to as CharacterTier;
      char.importanceScore = IMPORTANCE_SCORES[change.to as CharacterTier] || 50;
    }

    for (const exit of analysis.characterExits) {
      const char = characters.get(exit.name);
      if (char) char.status = exit.exitType as CharacterStatus;
    }

    // 伏笔状态：移除已回收 + 添加新埋设
    const resolvedIds = new Set(analysis.foreshadowingResolved.map((f) => f.originalContent));
    const plantedForeshadowings = [
      ...(previousState?.foreshadowings?.planted || []).filter((f) => !resolvedIds.has(f.content)),
      ...analysis.foreshadowingPlanted.map((planted) => ({
        id: new mongoose.Types.ObjectId().toString(),
        content: planted.content,
        episodePlanted: currentEpisode,
        type: planted.type,
        importance: planted.importance,
        expectedResolution: planted.expectedResolution,
      })),
    ];

    const recentlyResolved = [
      ...(previousState?.foreshadowings?.recentlyResolved || []),
      ...analysis.foreshadowingResolved.map((f) => ({
        content: f.originalContent,
        episodeResolved: currentEpisode,
        resolutionNote: f.resolutionNote,
      })),
    ].slice(-10);

    // 构建剧情状态
    const plotState = {
      currentArc: analysis.plotUpdates.currentArc || previousState?.plotState?.currentArc || '',
      arcProgress: analysis.plotUpdates.arcProgress || previousState?.plotState?.arcProgress || 0,
      mainPlotProgress: previousState?.plotState?.mainPlotProgress || '',
      recentEvents: [
        ...(previousState?.plotState?.recentEvents || []),
        { episode: currentEpisode, event: analysis.plotUpdates.keyEvent },
      ].slice(-5),
      pendingConflicts: this.updateConflicts(
        previousState?.plotState?.pendingConflicts || [],
        analysis.plotUpdates.newConflict,
        analysis.plotUpdates.resolvedConflict
      ),
      resolvedConflicts: analysis.plotUpdates.resolvedConflict
        ? [...(previousState?.plotState?.resolvedConflicts || []), analysis.plotUpdates.resolvedConflict].slice(-5)
        : previousState?.plotState?.resolvedConflicts || [],
      cliffhangers: [
        ...(previousState?.plotState?.cliffhangers || []).map((c) => ({
          ...c,
          resolved: c.episode < currentEpisode ? true : c.resolved,
        })),
        ...(analysis.plotUpdates.cliffhanger
          ? [{ episode: currentEpisode, content: analysis.plotUpdates.cliffhanger, resolved: false }]
          : []),
      ],
    };

    // 构建世界设定
    const factions = this.cloneMapOrNew(previousState?.worldSettings?.factions);
    analysis.worldUpdates?.factionChanges?.forEach(change => {
      const existing = factions.get(change.faction) || { status: '', attitude: '未知', keyMembers: [] };
      existing.status = change.change;
      factions.set(change.faction, existing);
    });

    const locations = this.cloneMapOrNew(previousState?.worldSettings?.locations);
    analysis.worldUpdates?.newLocations?.forEach(loc => {
      if (!locations.has(loc.name)) {
        locations.set(loc.name, {
          description: loc.description,
          firstAppearance: currentEpisode,
          significance: loc.description.substring(0, 20),
        });
      }
    });

    const items = this.cloneMapOrNew(previousState?.worldSettings?.items);
    analysis.worldUpdates?.itemChanges?.forEach(change => {
      const existing = items.get(change.item) || { description: '', owner: '未知', status: '正常' };
      existing.description = change.change;
      items.set(change.item, existing);
    });

    const worldSettings = {
      revealedSecrets: [
        ...(previousState?.worldSettings?.revealedSecrets || []),
        ...analysis.worldUpdates.newSecrets,
      ],
      hiddenSecrets: previousState?.worldSettings?.hiddenSecrets || [],
      factions,
      locations,
      items,
    };

    return {
      projectId: new mongoose.Types.ObjectId(this.projectId),
      episodeNumber: currentEpisode,
      characters,
      foreshadowings: {
        planted: plantedForeshadowings,
        recentlyResolved,
      },
      plotState,
      worldSettings,
      constraints: {
        mustInclude: [],
        mustAvoid: [],
        styleNotes: [],
      },
    };
  }

  private calculateImportanceScore(tier: CharacterTier): number {
    return IMPORTANCE_SCORES[tier] || 50;
  }

  private cloneMapOrNew<K, V>(source?: Map<K, V>): Map<K, V> {
    return source ? new Map(source) : new Map();
  }

  /** 兼容旧数据的形态变化处理 */
  private applyFormChange(
    char: ICharacterState,
    formChange: { from: string; to: string; trigger: string; isNewForm?: boolean },
    episode: number,
    characterName: string
  ): void {
    const { from, to, trigger, isNewForm } = formChange;

    if (!char.currentForm) char.currentForm = '基础形态';
    if (!char.baseForm) char.baseForm = '基础形态';
    if (!char.unlockedForms) char.unlockedForms = ['基础形态'];
    if (!char.formHistory) char.formHistory = [];

    char.currentForm = to;
    if (isNewForm && !char.unlockedForms.includes(to)) {
      char.unlockedForms.push(to);
    }
    char.formHistory.push({ episode, from, to, trigger });
    console.log(`[WorldStateManager] ${characterName} 形态变化: ${from} → ${to} (${trigger})`);
  }

  private updateConflicts(
    current: string[],
    newConflict: string | null,
    resolvedConflict: string | null
  ): string[] {
    let conflicts = [...current];
    if (resolvedConflict) conflicts = conflicts.filter((c) => c !== resolvedConflict);
    if (newConflict && !conflicts.includes(newConflict)) conflicts.push(newConflict);
    return conflicts;
  }

  /** 使用 AI 驱动的注意力计算构建生成上下文 */
  async buildGenerationContext(
    worldState: IWorldState | null,
    episodePlan: string
  ): Promise<IGenerationContext> {
    if (!worldState) {
      return {
        constraints: [], previousCliffhanger: null, relevantCharacters: [],
        relevantForeshadowings: [], relevantEvents: [],
        hiddenConnections: [], suggestedElements: [],
        episodePlan, formattedContext: '',
      };
    }

    const currentEpisode = worldState.episodeNumber + 1;
    const constraints = this.buildHardConstraints(worldState, currentEpisode);
    const previousCliffhanger = this.getLatestCliffhanger(worldState);
    const attentionResult = await this.analyzeAttention(episodePlan, worldState);

    console.log(`[WorldStateManager] 注意力分析完成:`);
    console.log(`  - 相关角色: ${attentionResult.attentionAnalysis.characters.length}个`);
    console.log(`  - 相关伏笔: ${attentionResult.attentionAnalysis.foreshadowings.length}个`);
    console.log(`  - 隐藏关联: ${attentionResult.hiddenConnections.length}个`);

    const relevantCharacters = this.getCharactersByAttention(
      worldState.characters, attentionResult.attentionAnalysis.characters
    );
    const formattedContext = this.formatContext(
      worldState, relevantCharacters, attentionResult,
      constraints, previousCliffhanger, currentEpisode
    );

    return {
      constraints, previousCliffhanger, relevantCharacters,
      relevantForeshadowings: attentionResult.attentionAnalysis.foreshadowings,
      relevantEvents: attentionResult.attentionAnalysis.events,
      hiddenConnections: attentionResult.hiddenConnections,
      suggestedElements: attentionResult.suggestedElements,
      episodePlan, formattedContext,
    };
  }

  private async analyzeAttention(
    episodePlan: string,
    worldState: IWorldState
  ): Promise<IAttentionResult> {
    const worldStateSummary = this.formatWorldStateSummary(worldState);

    const prompt = `你是剧本上下文分析专家。请根据本集梗概，分析以下世界状态中各元素的相关性。

【本集梗概】
${episodePlan}

【当前世界状态】
${worldStateSummary}

【重要要求】
- 必须列出所有与本集剧情可能相关的角色，包括直接提及和间接相关的角色
- 宁可多列不要遗漏，即使只是可能出场也要包含
- 如果梗概中提到某个角色，该角色必须出现在 characters 列表中
- 角色列表（characters）绝对不能为空，至少列出梗概中提到的角色

请分析并输出 JSON 格式：

\`\`\`json
{
  "attentionAnalysis": {
    "characters": [
      {"name": "角色名", "weight": 0.0-1.0, "reason": "相关原因"}
    ],
    "foreshadowings": [
      {"content": "伏笔内容", "weight": 0.0-1.0, "reason": "可能的使用方式"}
    ],
    "events": [
      {"content": "事件", "weight": 0.0-1.0, "reason": "关联原因"}
    ],
    "conflicts": [
      {"content": "冲突", "weight": 0.0-1.0, "reason": "处理建议"}
    ]
  },
  "hiddenConnections": [
    "AI发现的隐含关联，如角色关系传播、道具与能力的组合等"
  ],
  "suggestedElements": [
    "AI建议本集可以使用的元素组合"
  ]
}
\`\`\`

注意：
1. 理解语义关联，不是简单的字符匹配
2. 发现隐含关联（如提到角色A应关联其关系密切的角色B）
3. 预判可能需要的伏笔、道具、能力
4. weight >= 0.7 的元素会被详细包含在上下文中
5. weight < 0.3 的元素将被省略

JSON格式要求：
- 所有字符串值必须使用英文双引号 "
- 字符串内部的引号必须转义为 \\"
- 字符串内部不能有换行，用 \\n 代替
- reason 字段限制在50字以内`;

    try {
      const response = await this.aiClient.generate('', prompt, 4000);
      console.log('[WorldStateManager] analyzeAttention AI 响应长度:', response.length);
      console.log('[WorldStateManager] analyzeAttention AI 响应预览:', response.substring(0, 300));

      const result = robustParseJson<IAttentionResult>(response, DEFAULT_ATTENTION_RESULT);
      // AI 可能返回缺字段的部分 JSON（如省略 foreshadowings），与默认值合并防空指针
      result.attentionAnalysis = { ...DEFAULT_ATTENTION_RESULT.attentionAnalysis, ...(result.attentionAnalysis || {}) };
      result.hiddenConnections ||= [];
      result.suggestedElements ||= [];

      if (result.attentionAnalysis.characters.length === 0) {
        console.warn('[WorldStateManager] analyzeAttention 返回空角色列表！');
        console.warn('[WorldStateManager] 梗概:', episodePlan.substring(0, 100));
        console.warn('[WorldStateManager] AI 原始响应:', response.substring(0, 500));
      } else {
        console.log('[WorldStateManager] analyzeAttention 成功，角色数:', result.attentionAnalysis.characters.length);
      }
      return result;
    } catch (error) {
      console.error('[WorldStateManager] 注意力分析失败:', error);
      return DEFAULT_ATTENTION_RESULT;
    }
  }

  /** 格式化 WorldState 摘要（供 AI 分析） */
  private formatWorldStateSummary(worldState: IWorldState): string {
    const sections: string[] = [];

    sections.push('【剧情背景】');
    if (worldState.plotState.currentArc) {
      sections.push(`  • 当前篇章: ${worldState.plotState.currentArc} (进度: ${worldState.plotState.arcProgress}%)`);
    }
    if (worldState.plotState.mainPlotProgress) {
      sections.push(`  • 主线进度: ${worldState.plotState.mainPlotProgress}`);
    }
    sections.push(`  • 当前集数: 第 ${worldState.episodeNumber + 1} 集`);

    sections.push('\n【角色列表】');
    worldState.characters.forEach((char) => {
      if (char.status !== 'active') return;

      const details = [
        `${char.name}(${char.role})`,
        `级别:${char.tier}`,
        char.currentLocation ? `位置:${char.currentLocation}` : null,
        char.currentAbilities.length > 0 ? `能力:${char.currentAbilities.slice(0, 3).join(',')}` : null,
        char.currentForm && char.currentForm !== '基础形态' ? `形态:${char.currentForm}` : null,
        char.physicalCondition !== '正常' ? `身体:${char.physicalCondition}` : null,
        char.mentalCondition !== '正常' ? `精神:${char.mentalCondition}` : null,
        char.currentEquipment.length > 0 ? `装备:${char.currentEquipment.join(',')}` : null,
      ].filter(Boolean);

      if (char.relationships?.size > 0) {
        const relations = Array.from(char.relationships.entries())
          .slice(0, 2)
          .map(([name, rel]) => `${name}:${rel}`)
          .join(', ');
        if (relations) details.push(`关系:[${relations}]`);
      }

      sections.push(`  • ${details.join(' | ')}`);
    });

    if (worldState.foreshadowings.planted.length > 0) {
      sections.push('\n【未回收伏笔】');
      for (const f of worldState.foreshadowings.planted) {
        sections.push(`  • [第${f.episodePlanted}集埋下] ${f.content} (重要性:${f.importance})`);
      }
    }

    if (worldState.plotState.recentEvents.length > 0) {
      sections.push('\n【近期事件】');
      for (const e of worldState.plotState.recentEvents.slice(-5)) {
        sections.push(`  • 第${e.episode}集: ${e.event}`);
      }
    } else {
      sections.push('\n【近期事件】\n  • (暂无历史事件，故事刚开始)');
    }

    if (worldState.plotState.pendingConflicts.length > 0) {
      sections.push('\n【待解决冲突】');
      for (const c of worldState.plotState.pendingConflicts) {
        sections.push(`  • ${c}`);
      }
    }

    if (worldState.worldSettings) {
      const settingsLines = formatWorldSettingsSummary(worldState.worldSettings);
      if (settingsLines.length > 0) {
        sections.push('\n【世界当前格局】');
        sections.push(...settingsLines.map(s => `  • ${s}`));
      }
    }

    const latestCliffhanger = this.getLatestCliffhanger(worldState);
    if (latestCliffhanger) {
      sections.push(`\n【上集悬念】\n  ${latestCliffhanger}`);
    }

    return sections.join('\n');
  }

  /** 核心角色始终包含，其他角色根据注意力权重筛选 */
  private getCharactersByAttention(
    characters: Map<string, ICharacterState>,
    attentionCharacters: Array<{ name: string; weight: number; reason: string }>
  ): ICharacterState[] {
    const attentionMap = new Map(attentionCharacters.map((c) => [c.name, c.weight]));
    const result: ICharacterState[] = [];

    characters.forEach((char) => {
      if (char.status !== 'active') return;
      const weight = attentionMap.get(char.name) || 0;
      if (char.tier === 'core' || weight >= 0.3) result.push(char);
    });

    return result.sort((a, b) => (attentionMap.get(b.name) || 0) - (attentionMap.get(a.name) || 0));
  }

  /** 硬约束：规则引擎，不依赖 AI */
  private buildHardConstraints(worldState: IWorldState, currentEpisode: number): string[] {
    const constraints: string[] = [];

    const overdue = worldState.foreshadowings.planted.filter((f) => {
      const threshold = FORESHADOWING_THRESHOLDS[f.importance] ?? 30;
      return currentEpisode - f.episodePlanted > threshold;
    });
    if (overdue.length > 0) {
      constraints.push(
        `【伏笔约束】以下伏笔已超期，必须在本集处理：\n${overdue.map((f) => `- ${f.content}`).join('\n')}`
      );
    }

    const latestCliffhanger = this.getLatestCliffhanger(worldState);
    if (latestCliffhanger) {
      constraints.push(`【悬念约束】必须在开头自然承接前情悬念：${latestCliffhanger}`);
    }

    worldState.characters.forEach((char) => {
      if (char.physicalCondition !== '正常' && char.tier !== 'extra') {
        constraints.push(`【状态约束】${char.name}当前${char.physicalCondition}，需在剧情中体现`);
      }
    });

    return constraints;
  }

  private getLatestCliffhanger(worldState: IWorldState): string | null {
    const unresolved = worldState.plotState.cliffhangers.filter((c) => !c.resolved);
    return unresolved.length > 0 ? unresolved[unresolved.length - 1].content : null;
  }

  private formatContext(
    worldState: IWorldState,
    relevantCharacters: ICharacterState[],
    attentionResult: IAttentionResult,
    constraints: string[],
    previousCliffhanger: string | null,
    currentEpisode: number
  ): string {
    const sections: string[] = [];

    if (constraints.length > 0) {
      sections.push('【强制约束】');
      sections.push(constraints.join('\n'));
    }

    if (previousCliffhanger) {
      sections.push('\n【前情悬念 - 必须承接，但正文中不要写"上集"等字眼】');
      sections.push(previousCliffhanger);
    }

    if (relevantCharacters.length > 0) {
      sections.push('\n【相关角色状态】');
      for (const char of relevantCharacters) {
        const parts = [
          `【${char.name}】(${char.role})`,
          char.currentForm && char.currentForm !== '基础形态' ? `当前形态：${char.currentForm}` : null,
          char.unlockedForms?.length > 1 ? `可切换形态：${char.unlockedForms.join('、')}` : null,
          char.currentEquipment.length > 0 ? `装备：${char.currentEquipment.join('、')}` : null,
          char.currentAbilities.length > 0 ? `能力：${char.currentAbilities.join('、')}` : null,
          char.physicalCondition !== '正常' ? `身体：${char.physicalCondition}` : null,
          char.mentalCondition !== '正常' ? `精神：${char.mentalCondition}` : null,
          char.currentLocation ? `位置：${char.currentLocation}` : null,
        ].filter(Boolean);
        sections.push(parts.join(' | '));
      }
    }

    appendBulletSection(sections, '【可回收伏笔】',
      attentionResult.attentionAnalysis.foreshadowings
        .filter((f) => f.weight >= 0.5)
        .map((f) => `${f.content} - ${f.reason}`)
    );

    if (worldState.plotState.currentArc) {
      sections.push(`\n【剧情背景】\n当前篇章: ${worldState.plotState.currentArc} (进度: ${worldState.plotState.arcProgress}%)`);
      if (worldState.plotState.mainPlotProgress) {
        sections.push(`主线进度: ${worldState.plotState.mainPlotProgress}`);
      }
    }

    if (worldState.worldSettings) {
      const settingsLines = formatWorldSettingsSummary(worldState.worldSettings);
      if (settingsLines.length > 0) {
        sections.push(`\n【世界当前格局】\n${settingsLines.join('\n')}`);
      }
    }

    // 只包含衰减权重 >= 0.4 的近期事件
    const recentEventLines = worldState.plotState.recentEvents.slice(-3)
      .filter((e) => calculateTimeDecay(e.episode, currentEpisode) >= 0.4)
      .map((e) => e.event);
    appendBulletSection(sections, '【近期事件】', recentEventLines);

    appendBulletSection(sections, '【待解决冲突】', worldState.plotState.pendingConflicts);
    appendBulletSection(sections, '【潜在关联 - 可利用】', attentionResult.hiddenConnections);
    appendBulletSection(sections, '【建议元素】', attentionResult.suggestedElements);

    return sections.join('\n');
  }

  async initializeFirstEpisode(
    characters: Array<{
      name: string;
      role: string;
      tier: CharacterTier;
      abilities?: string[];
      equipment?: string[];
    }>
  ): Promise<IWorldState> {
    const characterMap = this.buildCharacterMap(characters);
    const initialState = createEmptyWorldState(this.projectId, characterMap);
    return worldStateRepository.upsertState(this.projectId, 0, initialState);
  }

  /** 从项目信息初始化 WorldState，用于第一集生成前自动初始化 */
  async initializeFromProject(params: {
    characters: Array<{
      name: string;
      role: string;
      tier: CharacterTier;
      abilities?: string[];
      equipment?: string[];
      identity?: string;
      personality?: string;
    }>;
    outline?: {
      mainPlot?: string;
      arcs?: Array<{ name: string; description: string }>;
      worldBackground?: string;
    };
    projectType?: string;
  }): Promise<IWorldState> {
    const { characters, outline, projectType } = params;
    const characterMap = this.buildCharacterMap(characters);

    const currentArc = outline?.arcs?.[0]?.name || '';
    const mainPlotProgress = outline?.mainPlot ? '故事开端' : '';

    const initialState = createEmptyWorldState(
      this.projectId,
      characterMap,
      { currentArc, mainPlotProgress },
      projectType ? { styleNotes: [`题材类型: ${projectType}`] } : undefined
    );

    console.log(`[WorldStateManager] 从项目初始化 WorldState，角色数: ${characters.length}`);
    return worldStateRepository.upsertState(this.projectId, 0, initialState);
  }

  private buildCharacterMap(
    characters: Array<{ name: string; role: string; tier: CharacterTier; abilities?: string[]; equipment?: string[] }>
  ): Map<string, ICharacterState> {
    // Mongoose Map 键不允许"."和"$"开头（"Dr. Aaron Pike"实测触发初始化崩溃）——与 update 路径 mk() 保持一致口径
    const sanitizeKey = (s: string) => s.replace(/\./g, '·').replace(/^\$+/, '');
    const map = new Map<string, ICharacterState>();
    for (const char of characters) {
      const safeName = sanitizeKey(char.name);
      map.set(safeName, createDefaultCharacterState({ ...char, name: safeName }));
    }
    return map;
  }
}
