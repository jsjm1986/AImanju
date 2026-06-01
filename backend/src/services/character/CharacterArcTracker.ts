import mongoose from 'mongoose';
import {
    CharacterEnhancement,
    GrowthEventType,
    GrowthStage,
    ICharacterArc,
    IGrowthEvent,
    IMilestone,
    IStageHistory,
    ITurningPoint
} from '../../models/CharacterEnhancement';
import { createLogger } from '../../utils/errorLogger';

const logger = createLogger('CharacterArcTracker');

const STAGE_DESCRIPTIONS: Record<GrowthStage, string> = {
  initial: '初始阶段 - 角色处于故事开始时的状态',
  challenged: '受挑战阶段 - 角色遭遇困难或挑战，开始动摇',
  growing: '成长阶段 - 角色正在积极改变和成长',
  transformed: '蜕变阶段 - 角色完成了重大转变',
};

const STAGNATION_THRESHOLD = 10;

function toObjectId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

function buildCharacterFilter(projectId: string, characterId: string): Record<string, unknown> {
  return {
    projectId: toObjectId(projectId),
    characterId: toObjectId(characterId),
  };
}

async function pushToArc(
  projectId: string,
  characterId: string,
  characterName: string,
  setFields: Record<string, unknown>,
  pushField: string,
  pushData: unknown,
  logLabel: string,
  logContext: Record<string, unknown>,
): Promise<boolean> {
  try {
    await CharacterEnhancement.findOneAndUpdate(
      buildCharacterFilter(projectId, characterId),
      {
        $set: { characterName, ...setFields },
        $push: { [pushField]: pushData },
      },
      { upsert: true },
    );
    logger.info(`${logLabel}成功`, { characterId, characterName, ...logContext });
    return true;
  } catch (error) {
    logger.error(`${logLabel}失败`, error as Error, {
      method: logLabel,
      additionalInfo: { projectId, characterId, ...logContext },
    });
    return false;
  }
}

export class CharacterArcTracker {
  async getArc(characterId: string): Promise<ICharacterArc | null> {
    try {
      const enhancement = await CharacterEnhancement.findOne({
        characterId: toObjectId(characterId),
      });
      return enhancement?.arc ?? null;
    } catch (error) {
      logger.error('获取角色成长弧线失败', error as Error, {
        method: 'getArc',
        additionalInfo: { characterId },
      });
      return null;
    }
  }

  async updateStage(
    projectId: string,
    characterId: string,
    characterName: string,
    newStage: GrowthStage,
    trigger: string,
    currentEpisode: number
  ): Promise<boolean> {
    try {
      const filter = buildCharacterFilter(projectId, characterId);
      const enhancement = await CharacterEnhancement.findOne(filter);
      const currentStage = enhancement?.arc?.currentStage || 'initial';

      if (currentStage === newStage) {
        return true;
      }

      const stageHistory: IStageHistory = {
        stage: newStage,
        startEpisode: currentEpisode,
        trigger,
      };

      await CharacterEnhancement.findOneAndUpdate(
        filter,
        {
          $set: {
            characterName,
            'arc.currentStage': newStage,
            'arc.lastGrowthEpisode': currentEpisode,
          },
          $push: { 'arc.stageHistory': stageHistory },
        },
        { upsert: true },
      );

      if (enhancement && enhancement.arc.stageHistory.length > 0) {
        await CharacterEnhancement.updateOne(
          { ...filter, 'arc.stageHistory.endEpisode': { $exists: false } },
          { $set: { 'arc.stageHistory.$.endEpisode': currentEpisode - 1 } },
        );
      }

      logger.info('更新成长阶段成功', {
        characterId,
        characterName,
        fromStage: currentStage,
        toStage: newStage,
        episode: currentEpisode,
      });

      return true;
    } catch (error) {
      logger.error('更新成长阶段失败', error as Error, {
        method: 'updateStage',
        additionalInfo: { projectId, characterId, newStage },
      });
      return false;
    }
  }

  async recordTurningPoint(
    projectId: string,
    characterId: string,
    characterName: string,
    episode: number,
    event: string,
    impact: string,
    beforeState: string,
    afterState: string
  ): Promise<boolean> {
    const turningPoint: ITurningPoint = { episode, event, impact, beforeState, afterState };
    return pushToArc(
      projectId, characterId, characterName,
      { 'arc.lastGrowthEpisode': episode },
      'arc.turningPoints', turningPoint,
      '记录转折点', { episode, event },
    );
  }

  async recordGrowthEvent(
    projectId: string,
    characterId: string,
    characterName: string,
    episode: number,
    type: GrowthEventType,
    description: string
  ): Promise<boolean> {
    const growthEvent: IGrowthEvent = { episode, type, description };
    return pushToArc(
      projectId, characterId, characterName,
      { 'arc.lastGrowthEpisode': episode },
      'arc.growthEvents', growthEvent,
      '记录成长事件', { episode, type },
    );
  }

  async addMilestone(
    projectId: string,
    characterId: string,
    characterName: string,
    episode: number,
    milestone: string,
    achieved: boolean = false
  ): Promise<boolean> {
    const milestoneData: IMilestone = { episode, milestone, achieved };
    return pushToArc(
      projectId, characterId, characterName,
      {},
      'arc.milestones', milestoneData,
      '添加里程碑', { episode, milestone },
    );
  }

  async checkGrowthStagnation(
    characterId: string,
    currentEpisode: number
  ): Promise<string | null> {
    try {
      const arc = await this.getArc(characterId);
      if (!arc) return null;

      const gap = currentEpisode - arc.lastGrowthEpisode;
      if (gap >= STAGNATION_THRESHOLD) {
        return `角色已${gap}集未有成长事件，建议安排角色发展或转变`;
      }
      return null;
    } catch (error) {
      logger.error('检测成长停滞失败', error as Error, {
        method: 'checkGrowthStagnation',
        additionalInfo: { characterId, currentEpisode },
      });
      return null;
    }
  }

  async checkProjectStagnation(
    projectId: string,
    currentEpisode: number
  ): Promise<Array<{ characterId: string; characterName: string; warning: string }>> {
    try {
      const enhancements = await CharacterEnhancement.find({
        projectId: toObjectId(projectId),
      });

      return enhancements
        .filter(e => currentEpisode - e.arc.lastGrowthEpisode >= STAGNATION_THRESHOLD)
        .map(e => ({
          characterId: e.characterId.toString(),
          characterName: e.characterName,
          warning: `已${currentEpisode - e.arc.lastGrowthEpisode}集未有成长事件`,
        }));
    } catch (error) {
      logger.error('批量检测成长停滞失败', error as Error, {
        method: 'checkProjectStagnation',
        additionalInfo: { projectId, currentEpisode },
      });
      return [];
    }
  }

  formatForPrompt(arcs: Array<{ characterId: string; characterName: string; arc: ICharacterArc }>): string {
    if (!arcs || arcs.length === 0) {
      return '';
    }

    const lines: string[] = ['【角色成长弧线】', ''];

    for (const { characterName, arc } of arcs) {
      lines.push(`【${characterName}】`);
      lines.push(`  当前阶段：${STAGE_DESCRIPTIONS[arc.currentStage]}`);

      if (arc.growthEvents.length > 0) {
        const recentEvents = arc.growthEvents
          .sort((a, b) => b.episode - a.episode)
          .slice(0, 2);
        lines.push(`  近期成长：`);
        for (const event of recentEvents) {
          lines.push(`    - 第${event.episode}集：${event.description}`);
        }
      }

      if (arc.turningPoints.length > 0) {
        const lastTurning = arc.turningPoints[arc.turningPoints.length - 1];
        lines.push(`  最近转折：第${lastTurning.episode}集 - ${lastTurning.event}`);
      }

      const pendingMilestones = arc.milestones.filter(m => !m.achieved);
      if (pendingMilestones.length > 0) {
        lines.push(`  待达成里程碑：${pendingMilestones.map(m => m.milestone).join('、')}`);
      }

      lines.push('');
    }

    lines.push('请根据角色当前成长阶段，适当展现角色的状态和行为特征。');
    return lines.join('\n');
  }

  getStageDescription(stage: GrowthStage): string {
    return STAGE_DESCRIPTIONS[stage];
  }

  async getProjectArcs(projectId: string): Promise<Array<{
    characterId: string;
    characterName: string;
    arc: ICharacterArc;
  }>> {
    try {
      const enhancements = await CharacterEnhancement.find({
        projectId: toObjectId(projectId),
      });

      return enhancements.map(e => ({
        characterId: e.characterId.toString(),
        characterName: e.characterName,
        arc: e.arc,
      }));
    } catch (error) {
      logger.error('批量获取角色成长弧线失败', error as Error, {
        method: 'getProjectArcs',
        additionalInfo: { projectId },
      });
      return [];
    }
  }
}

export const characterArcTracker = new CharacterArcTracker();
