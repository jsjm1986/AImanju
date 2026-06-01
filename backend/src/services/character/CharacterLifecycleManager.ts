import { CharacterTier } from '../../models/WorldState';
import { INewCharacter, IAnalysisResult } from '../../utils/jsonParser';

export interface ITierConfig {
  tier: CharacterTier;
  attentionWeight: number;
  trackingLevel: 'full' | 'key' | 'basic' | 'minimal' | 'none';
  contextContent: string;
  upgradeThreshold?: {
    consecutiveAppearances?: number;
    totalAppearances?: number;
    plotImportance?: string[];
  };
  downgradeThreshold?: {
    absenceEpisodes?: number;
    arcEnded?: boolean;
  };
}

export const TIER_CONFIGS: Record<CharacterTier, ITierConfig> = {
  core: {
    tier: 'core',
    attentionWeight: 1.0,
    trackingLevel: 'full',
    contextContent: '完整状态 + 近期变化 + 关系网络',
  },
  recurring: {
    tier: 'recurring',
    attentionWeight: 0.7,
    trackingLevel: 'key',
    contextContent: '关键状态 + 重要变化',
    upgradeThreshold: {},
    downgradeThreshold: {
      absenceEpisodes: 30,
    },
  },
  arc: {
    tier: 'arc',
    attentionWeight: 0.5,
    trackingLevel: 'basic',
    contextContent: '基本状态 + 本弧相关',
    upgradeThreshold: {
      consecutiveAppearances: 10,
      totalAppearances: 20,
    },
    downgradeThreshold: {
      arcEnded: true,
      absenceEpisodes: 15,
    },
  },
  temporary: {
    tier: 'temporary',
    attentionWeight: 0.3,
    trackingLevel: 'minimal',
    contextContent: '仅在相关时提及',
    upgradeThreshold: {
      consecutiveAppearances: 3,
      totalAppearances: 5,
    },
    downgradeThreshold: {
      absenceEpisodes: 5,
    },
  },
  extra: {
    tier: 'extra',
    attentionWeight: 0,
    trackingLevel: 'none',
    contextContent: '不进入上下文',
  },
};

export interface ICharacterImportanceCriteria {
  hasName: boolean;
  dialogueCount: number;
  interactsWithProtagonist: boolean;
  advancesPlot: boolean;
  mentionedInOutline: boolean;
}

const TIER_ORDER: CharacterTier[] = ['extra', 'temporary', 'arc', 'recurring', 'core'];

export class CharacterLifecycleManager {
  private projectId: string;

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  suggestTierForNewCharacter(criteria: ICharacterImportanceCriteria): CharacterTier {
    if (!criteria.hasName) return 'extra';

    let score = 0;
    if (criteria.dialogueCount > 3) score++;
    if (criteria.interactsWithProtagonist) score++;
    if (criteria.advancesPlot) score++;
    if (criteria.mentionedInOutline) score++;

    if (score >= 3) return 'arc';
    if (score >= 1) return 'temporary';
    return 'extra';
  }

  private getTierConfig(tier: CharacterTier, caller: string): ITierConfig | null {
    if (!tier) {
      console.warn(`[CharacterLifecycleManager] ${caller}: currentTier is undefined`);
      return null;
    }
    const config = TIER_CONFIGS[tier];
    if (!config) {
      console.warn(`[CharacterLifecycleManager] ${caller}: unknown tier "${tier}"`);
      return null;
    }
    return config;
  }

  checkUpgrade(
    currentTier: CharacterTier,
    consecutiveAppearances: number,
    totalAppearances: number,
    plotImportance?: string[]
  ): CharacterTier | null {
    const config = this.getTierConfig(currentTier, 'checkUpgrade');
    const threshold = config?.upgradeThreshold;
    if (!threshold) return null;

    if (
      threshold.consecutiveAppearances &&
      consecutiveAppearances >= threshold.consecutiveAppearances
    ) {
      return this.getAdjacentTier(currentTier, 1);
    }

    if (threshold.totalAppearances && totalAppearances >= threshold.totalAppearances) {
      return this.getAdjacentTier(currentTier, 1);
    }

    if (
      threshold.plotImportance &&
      plotImportance &&
      threshold.plotImportance.some((p) => plotImportance.includes(p))
    ) {
      return this.getAdjacentTier(currentTier, 1);
    }

    return null;
  }

  checkDowngrade(
    currentTier: CharacterTier,
    absenceEpisodes: number,
    arcEnded: boolean = false
  ): CharacterTier | null {
    const config = this.getTierConfig(currentTier, 'checkDowngrade');
    const threshold = config?.downgradeThreshold;
    if (!threshold) return null;

    if (threshold.arcEnded && arcEnded) {
      return this.getAdjacentTier(currentTier, -1);
    }

    if (threshold.absenceEpisodes && absenceEpisodes >= threshold.absenceEpisodes) {
      return this.getAdjacentTier(currentTier, -1);
    }

    return null;
  }

  private getAdjacentTier(tier: CharacterTier, direction: 1 | -1): CharacterTier | null {
    const index = TIER_ORDER.indexOf(tier);
    const next = index + direction;
    return next >= 0 && next < TIER_ORDER.length ? TIER_ORDER[next] : null;
  }

  processAppearance(
    currentEpisode: number,
    lastAppearance: number,
    appearanceCount: number,
    consecutiveAppearances: number
  ): {
    newAppearanceCount: number;
    newConsecutiveAppearances: number;
  } {
    const isConsecutive = currentEpisode - lastAppearance <= 1;
    return {
      newAppearanceCount: appearanceCount + 1,
      newConsecutiveAppearances: isConsecutive ? consecutiveAppearances + 1 : 1,
    };
  }

  async processEpisodeCharacters(
    currentEpisode: number,
    analysis: IAnalysisResult,
    existingCharacters: Map<
      string,
      {
        tier: CharacterTier;
        lastAppearance: number;
        appearanceCount: number;
        consecutiveAppearances: number;
        belongsToArc?: string;
      }
    >
  ): Promise<{
    tierChanges: Array<{ name: string; from: CharacterTier; to: CharacterTier; reason: string }>;
    newCharactersToTrack: INewCharacter[];
    archivedCharacters: string[];
  }> {
    const tierChanges: Array<{
      name: string;
      from: CharacterTier;
      to: CharacterTier;
      reason: string;
    }> = [];
    const newCharactersToTrack: INewCharacter[] = [];
    const archivedCharacters: string[] = [];

    const appearingCharacters = new Set(
      analysis.characterUpdates.map((u) => u.characterName)
    );

    for (const [name, char] of existingCharacters) {
      const appeared = appearingCharacters.has(name);

      if (appeared) {
        const appearanceData = this.processAppearance(
          currentEpisode,
          char.lastAppearance,
          char.appearanceCount,
          char.consecutiveAppearances
        );

        const newTier = this.checkUpgrade(
          char.tier,
          appearanceData.newConsecutiveAppearances,
          appearanceData.newAppearanceCount
        );

        if (newTier) {
          tierChanges.push({
            name,
            from: char.tier,
            to: newTier,
            reason: `连续出场${appearanceData.newConsecutiveAppearances}集，总出场${appearanceData.newAppearanceCount}集`,
          });
        }
      } else {
        const absenceEpisodes = currentEpisode - char.lastAppearance;
        const newTier = this.checkDowngrade(char.tier, absenceEpisodes);

        if (newTier) {
          tierChanges.push({
            name,
            from: char.tier,
            to: newTier,
            reason: `已${absenceEpisodes}集未出场`,
          });

          if (newTier === 'extra') {
            archivedCharacters.push(name);
          }
        }
      }
    }

    for (const newChar of analysis.newCharacters) {
      if (newChar.trackingRequired && newChar.suggestedTier !== 'extra') {
        newCharactersToTrack.push(newChar);
      }
    }

    for (const change of analysis.characterTierChanges) {
      if (!tierChanges.some((t) => t.name === change.name)) {
        tierChanges.push({
          name: change.name,
          from: change.from as CharacterTier,
          to: change.to as CharacterTier,
          reason: change.reason,
        });
      }
    }

    for (const exit of analysis.characterExits) {
      if (exit.exitType === 'deceased' || exit.exitType === 'departed') {
        archivedCharacters.push(exit.name);
      }
    }

    return {
      tierChanges,
      newCharactersToTrack,
      archivedCharacters,
    };
  }

  getAttentionWeight(tier: CharacterTier): number {
    return TIER_CONFIGS[tier].attentionWeight;
  }

  getTrackingLevel(
    tier: CharacterTier
  ): 'full' | 'key' | 'basic' | 'minimal' | 'none' {
    return TIER_CONFIGS[tier].trackingLevel;
  }

  shouldTrack(tier: CharacterTier): boolean {
    return TIER_CONFIGS[tier].trackingLevel !== 'none';
  }

  typeToTier(type: string): CharacterTier {
    const mapping: Record<string, CharacterTier> = {
      主角: 'core',
      男主角: 'core',
      女主角: 'core',
      反派: 'recurring',
      重要配角: 'recurring',
      关键角色: 'arc',
      配角: 'arc',
      客串角色: 'temporary',
      客串: 'temporary',
      龙套: 'extra',
    };
    return mapping[type] || 'arc';
  }

  tierToType(tier: CharacterTier): string {
    const mapping: Record<CharacterTier, string> = {
      core: '主角',
      recurring: '重要配角',
      arc: '关键角色',
      temporary: '客串角色',
      extra: '龙套',
    };
    return mapping[tier] || '配角';
  }

  calculateImportanceScore(tier: CharacterTier, appearanceCount: number = 0): number {
    const baseScores: Record<CharacterTier, number> = {
      core: 100,
      recurring: 70,
      arc: 50,
      temporary: 30,
      extra: 10,
    };

    const baseScore = baseScores[tier];
    const appearanceBonus = Math.min(appearanceCount * 0.5, 20);

    return Math.min(baseScore + appearanceBonus, 100);
  }

  formatCharacterContext(
    character: {
      name: string;
      role: string;
      tier: CharacterTier;
      currentEquipment: string[];
      currentAbilities: string[];
      physicalCondition: string;
      mentalCondition: string;
      currentLocation: string;
      relationships: Map<string, string>;
    },
    detailLevel: 'full' | 'key' | 'basic' | 'minimal'
  ): string {
    const parts: string[] = [];

    parts.push(`【${character.name}】(${character.role})`);

    if (detailLevel === 'minimal') {
      return parts.join(' | ');
    }

    if (character.currentEquipment.length > 0) {
      parts.push(`装备：${character.currentEquipment.join('、')}`);
    }
    if (character.currentLocation) {
      parts.push(`位置：${character.currentLocation}`);
    }

    if (detailLevel === 'basic') {
      return parts.join(' | ');
    }

    if (character.currentAbilities.length > 0) {
      parts.push(`能力：${character.currentAbilities.join('、')}`);
    }
    if (character.physicalCondition !== '正常') {
      parts.push(`身体：${character.physicalCondition}`);
    }
    if (character.mentalCondition !== '正常') {
      parts.push(`精神：${character.mentalCondition}`);
    }

    if (detailLevel === 'key') {
      return parts.join(' | ');
    }

    if (character.relationships.size > 0) {
      const relStrings = Array.from(character.relationships, ([target, rel]) => `${target}:${rel}`);
      parts.push(`关系：${relStrings.join('、')}`);
    }

    return parts.join(' | ');
  }
}
