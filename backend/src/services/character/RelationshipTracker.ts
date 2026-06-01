import mongoose from 'mongoose';
import {
    CharacterRelationship,
    ICharacterRelationship,
    IRelationshipHistory,
    IRelationshipKeyEvent,
    RelationshipEventType,
    RelationshipImpact,
    RelationshipLevel
} from '../../models/CharacterRelationship';
import { createLogger } from '../../utils/errorLogger';

const logger = createLogger('RelationshipTracker');

const LEVEL_DESCRIPTIONS: Record<RelationshipLevel, string> = {
  stranger: '陌生人 - 互不相识或仅有表面接触',
  acquaintance: '相识 - 有过接触，但关系浅薄',
  familiar: '熟悉 - 有一定了解，可以正常交流',
  close: '亲近 - 关系密切，互相信任',
  intimate: '亲密 - 深厚的情感纽带',
  hostile: '敌对 - 存在矛盾或冲突',
  enemy: '仇敌 - 深刻的敌意或仇恨',
};

const STAGNATION_THRESHOLD = 5;

const SENTIMENT_CHANGES: Record<RelationshipEventType, number> = {
  first_meeting: 0.1,
  bonding: 0.2,
  conflict: -0.2,
  betrayal: -0.5,
  reconciliation: 0.3,
  deepening: 0.25,
};

const IMPACT_MULTIPLIER: Record<RelationshipImpact, number> = {
  positive: 1,
  negative: -1,
  neutral: 0,
};

function toObjectId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

function buildPairFilter(projectId: string, idA: string, idB: string) {
  return {
    projectId: toObjectId(projectId),
    characterAId: toObjectId(idA),
    characterBId: toObjectId(idB),
  };
}

function sortPair(charAId: string, charBId: string, charAName: string, charBName: string) {
  const [id1, id2] = [charAId, charBId].sort();
  const [name1, name2] = charAId < charBId ? [charAName, charBName] : [charBName, charAName];
  return { id1, id2, name1, name2 };
}

function clampSentiment(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

export class RelationshipTracker {
  async getRelationship(
    projectId: string,
    charAId: string,
    charBId: string
  ): Promise<ICharacterRelationship | null> {
    try {
      const [id1, id2] = [charAId, charBId].sort();
      return await CharacterRelationship.findOne({
        projectId: toObjectId(projectId),
        $or: [
          { characterAId: toObjectId(id1), characterBId: toObjectId(id2) },
          { characterAId: toObjectId(id2), characterBId: toObjectId(id1) },
        ],
      });
    } catch (error) {
      logger.error('获取角色关系失败', error as Error, {
        method: 'getRelationship',
        additionalInfo: { projectId, charAId, charBId },
      });
      return null;
    }
  }

  async updateRelationship(
    projectId: string,
    charAId: string,
    charBId: string,
    charAName: string,
    charBName: string,
    newLevel: RelationshipLevel,
    event: string,
    currentEpisode: number
  ): Promise<boolean> {
    try {
      const { id1, id2, name1, name2 } = sortPair(charAId, charBId, charAName, charBName);
      const filter = buildPairFilter(projectId, id1, id2);
      const existing = await this.getRelationship(projectId, charAId, charBId);
      const currentLevel = existing?.currentLevel || 'stranger';

      if (currentLevel === newLevel) {
        await CharacterRelationship.findOneAndUpdate(
          filter,
          { $set: { lastInteractionEpisode: currentEpisode } },
          { upsert: true }
        );
        return true;
      }

      const historyEntry: IRelationshipHistory = {
        episode: currentEpisode,
        fromLevel: currentLevel,
        toLevel: newLevel,
        event,
        timestamp: new Date(),
      };

      const sentimentDelta = this.calculateSentimentDelta(currentLevel, newLevel);
      const newSentiment = clampSentiment((existing?.sentiment || 0) + sentimentDelta);

      await CharacterRelationship.findOneAndUpdate(
        filter,
        {
          $set: {
            characterAName: name1,
            characterBName: name2,
            currentLevel: newLevel,
            sentiment: newSentiment,
            lastInteractionEpisode: currentEpisode,
          },
          $push: { history: historyEntry },
        },
        { upsert: true }
      );

      logger.info('更新关系状态成功', {
        charAName, charBName,
        fromLevel: currentLevel, toLevel: newLevel,
        episode: currentEpisode,
      });

      return true;
    } catch (error) {
      logger.error('更新关系状态失败', error as Error, {
        method: 'updateRelationship',
        additionalInfo: { projectId, charAId, charBId, newLevel },
      });
      return false;
    }
  }

  async recordKeyEvent(
    projectId: string,
    charAId: string,
    charBId: string,
    charAName: string,
    charBName: string,
    episode: number,
    type: RelationshipEventType,
    description: string,
    impact: RelationshipImpact
  ): Promise<boolean> {
    try {
      const { id1, id2, name1, name2 } = sortPair(charAId, charBId, charAName, charBName);
      const filter = buildPairFilter(projectId, id1, id2);

      const keyEvent: IRelationshipKeyEvent = { episode, type, description, impact };
      const sentimentDelta = SENTIMENT_CHANGES[type] * IMPACT_MULTIPLIER[impact];

      await CharacterRelationship.findOneAndUpdate(
        filter,
        {
          $set: {
            characterAName: name1,
            characterBName: name2,
            lastInteractionEpisode: episode,
          },
          $inc: { sentiment: sentimentDelta },
          $push: { keyEvents: keyEvent },
        },
        { upsert: true }
      );

      const updatedDoc = await CharacterRelationship.findOne(filter);
      if (updatedDoc && (updatedDoc.sentiment < -1 || updatedDoc.sentiment > 1)) {
        await CharacterRelationship.updateOne(
          filter,
          { $set: { sentiment: clampSentiment(updatedDoc.sentiment) } }
        );
      }

      logger.info('记录关键事件成功', {
        charAName, charBName, episode, type, impact,
      });

      return true;
    } catch (error) {
      logger.error('记录关键事件失败', error as Error, {
        method: 'recordKeyEvent',
        additionalInfo: { projectId, charAId, charBId, episode, type },
      });
      return false;
    }
  }

  async checkStagnantRelationships(
    projectId: string,
    currentEpisode: number
  ): Promise<Array<{ charAName: string; charBName: string; episodesSince: number; suggestion: string }>> {
    try {
      const relationships = await CharacterRelationship.find({
        projectId: toObjectId(projectId),
        currentLevel: { $nin: ['stranger', 'enemy'] },
      });

      return relationships
        .map(rel => ({
          charAName: rel.characterAName,
          charBName: rel.characterBName,
          episodesSince: currentEpisode - rel.lastInteractionEpisode,
          suggestion: this.getSuggestionForStagnant(rel.currentLevel, currentEpisode - rel.lastInteractionEpisode),
        }))
        .filter(item => item.episodesSince >= STAGNATION_THRESHOLD);
    } catch (error) {
      logger.error('检测停滞关系失败', error as Error, {
        method: 'checkStagnantRelationships',
        additionalInfo: { projectId, currentEpisode },
      });
      return [];
    }
  }

  formatForPrompt(relationships: ICharacterRelationship[]): string {
    if (!relationships || relationships.length === 0) return '';

    const grouped = this.groupByLevel(relationships);
    const lines: string[] = ['【角色关系网络】', ''];

    this.appendRelationshipSection(lines, '【亲近关系】', grouped.positive);
    this.appendRelationshipSection(lines, '【敌对关系】', grouped.negative);

    const significantNeutral = grouped.neutral.filter(r => r.history.length > 0 || r.keyEvents.length > 0);
    if (significantNeutral.length > 0) {
      lines.push('【一般关系】');
      for (const rel of significantNeutral.slice(0, 5)) {
        lines.push(`  ${rel.characterAName} ↔ ${rel.characterBName}：${LEVEL_DESCRIPTIONS[rel.currentLevel]}`);
      }
      lines.push('');
    }

    lines.push('请根据角色间的关系状态，适当展现互动方式和情感表达。');
    return lines.join('\n');
  }

  async getProjectRelationships(projectId: string): Promise<ICharacterRelationship[]> {
    try {
      return await CharacterRelationship.find({ projectId: toObjectId(projectId) });
    } catch (error) {
      logger.error('获取项目关系失败', error as Error, {
        method: 'getProjectRelationships',
        additionalInfo: { projectId },
      });
      return [];
    }
  }

  async getCharacterRelationships(
    projectId: string,
    characterId: string
  ): Promise<ICharacterRelationship[]> {
    try {
      return await CharacterRelationship.find({
        projectId: toObjectId(projectId),
        $or: [
          { characterAId: toObjectId(characterId) },
          { characterBId: toObjectId(characterId) },
        ],
      });
    } catch (error) {
      logger.error('获取角色关系失败', error as Error, {
        method: 'getCharacterRelationships',
        additionalInfo: { projectId, characterId },
      });
      return [];
    }
  }

  private appendRelationshipSection(
    lines: string[],
    title: string,
    rels: ICharacterRelationship[]
  ): void {
    if (rels.length === 0) return;

    lines.push(title);
    for (const rel of rels) {
      lines.push(`  ${rel.characterAName} ↔ ${rel.characterBName}：${LEVEL_DESCRIPTIONS[rel.currentLevel]}`);
      if (rel.keyEvents.length > 0) {
        const lastEvent = rel.keyEvents[rel.keyEvents.length - 1];
        lines.push(`    最近事件（第${lastEvent.episode}集）：${lastEvent.description}`);
      }
    }
    lines.push('');
  }

  private calculateSentimentDelta(fromLevel: RelationshipLevel, toLevel: RelationshipLevel): number {
    const levelValues: Record<RelationshipLevel, number> = {
      enemy: -1,
      hostile: -0.5,
      stranger: 0,
      acquaintance: 0.25,
      familiar: 0.5,
      close: 0.75,
      intimate: 1,
    };

    return (levelValues[toLevel] - levelValues[fromLevel]) * 0.3;
  }

  private groupByLevel(relationships: ICharacterRelationship[]): {
    positive: ICharacterRelationship[];
    negative: ICharacterRelationship[];
    neutral: ICharacterRelationship[];
  } {
    const positive: ICharacterRelationship[] = [];
    const negative: ICharacterRelationship[] = [];
    const neutral: ICharacterRelationship[] = [];

    for (const rel of relationships) {
      if (['close', 'intimate'].includes(rel.currentLevel)) {
        positive.push(rel);
      } else if (['hostile', 'enemy'].includes(rel.currentLevel)) {
        negative.push(rel);
      } else {
        neutral.push(rel);
      }
    }

    return { positive, negative, neutral };
  }

  private getSuggestionForStagnant(level: RelationshipLevel, episodesSince: number): string {
    const suggestions: Record<RelationshipLevel, string> = {
      stranger: '',
      acquaintance: `已${episodesSince}集无互动，建议安排偶遇或共同任务`,
      familiar: `已${episodesSince}集无互动，建议安排深入交流或共同经历`,
      close: `已${episodesSince}集无互动，建议安排情感互动或考验`,
      intimate: `已${episodesSince}集无互动，建议安排重要对话或共同面对挑战`,
      hostile: `已${episodesSince}集无互动，建议安排冲突升级或和解契机`,
      enemy: '',
    };

    return suggestions[level] || `已${episodesSince}集无互动`;
  }

  getLevelDescription(level: RelationshipLevel): string {
    return LEVEL_DESCRIPTIONS[level];
  }
}

export const relationshipTracker = new RelationshipTracker();
