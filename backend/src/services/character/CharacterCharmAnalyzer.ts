/**
 * 角色魅力分析器
 * 管理角色的魅力特征：口头禅、小癖好、标志性动作、高光时刻
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import mongoose from 'mongoose';
import {
    CharacterEnhancement,
    ICharacterCharm,
    ICharacterEnhancement,
    IImpressiveMoment,
    ImpressiveMomentType,
} from '../../models/CharacterEnhancement';
import { createLogger } from '../../utils/errorLogger';

const logger = createLogger('CharacterCharmAnalyzer');

/**
 * 角色类型到高光频率的映射
 */
const HIGHLIGHT_FREQUENCY_MAP: Record<string, number> = {
  '主角': 3,      // 每3集应有一次高光
  '男主角': 3,
  '女主角': 3,
  '配角': 8,      // 每8集应有一次高光
  '反派': 5,      // 每5集应有一次高光
  '导师': 10,     // 每10集应有一次高光
  '龙套': 20,     // 每20集应有一次高光（如果有的话）
  'default': 10,  // 默认每10集
};

/**
 * 角色魅力分析器
 */
export class CharacterCharmAnalyzer {
  /**
   * 获取角色魅力特征 (Requirements 7.1)
   */
  async getCharm(characterId: string): Promise<ICharacterCharm | null> {
    try {
      const enhancement = await CharacterEnhancement.findOne({
        characterId: new mongoose.Types.ObjectId(characterId),
      });
      
      if (!enhancement) {
        return null;
      }
      
      return enhancement.charm;
    } catch (error) {
      logger.error('获取角色魅力失败', error as Error, {
        method: 'getCharm',
        additionalInfo: { characterId },
      });
      return null;
    }
  }

  /**
   * 设置角色魅力特征 (Requirements 7.1)
   */
  async setCharm(
    projectId: string,
    characterId: string,
    characterName: string,
    charm: Partial<ICharacterCharm>
  ): Promise<ICharacterEnhancement | null> {
    try {
      const update: Record<string, unknown> = {};
      
      if (charm.catchphrases !== undefined) {
        update['charm.catchphrases'] = charm.catchphrases;
      }
      if (charm.quirks !== undefined) {
        update['charm.quirks'] = charm.quirks;
      }
      if (charm.signatureMoves !== undefined) {
        update['charm.signatureMoves'] = charm.signatureMoves;
      }
      if (charm.impressiveMoments !== undefined) {
        update['charm.impressiveMoments'] = charm.impressiveMoments;
      }

      const result = await CharacterEnhancement.findOneAndUpdate(
        {
          projectId: new mongoose.Types.ObjectId(projectId),
          characterId: new mongoose.Types.ObjectId(characterId),
        },
        {
          $set: {
            characterName,
            ...update,
          },
        },
        {
          upsert: true,
          new: true,
        }
      );

      logger.info('设置角色魅力成功', {
        characterId,
        characterName,
        updatedFields: Object.keys(update),
      });

      return result;
    } catch (error) {
      logger.error('设置角色魅力失败', error as Error, {
        method: 'setCharm',
        additionalInfo: { projectId, characterId, characterName },
      });
      return null;
    }
  }

  /**
   * 记录高光时刻 (Requirements 7.3)
   */
  async recordImpressiveMoment(
    projectId: string,
    characterId: string,
    characterName: string,
    episode: number,
    description: string,
    type: ImpressiveMomentType
  ): Promise<boolean> {
    try {
      const moment: IImpressiveMoment = {
        episode,
        description,
        type,
      };

      await CharacterEnhancement.findOneAndUpdate(
        {
          projectId: new mongoose.Types.ObjectId(projectId),
          characterId: new mongoose.Types.ObjectId(characterId),
        },
        {
          $set: { characterName },
          $push: { 'charm.impressiveMoments': moment },
        },
        {
          upsert: true,
        }
      );

      logger.info('记录高光时刻成功', {
        characterId,
        characterName,
        episode,
        type,
      });

      return true;
    } catch (error) {
      logger.error('记录高光时刻失败', error as Error, {
        method: 'recordImpressiveMoment',
        additionalInfo: { projectId, characterId, episode },
      });
      return false;
    }
  }

  /**
   * 获取建议的高光频率 (Requirements 7.4)
   */
  getSuggestedHighlightFrequency(characterType: string): number {
    // 尝试精确匹配
    if (HIGHLIGHT_FREQUENCY_MAP[characterType]) {
      return HIGHLIGHT_FREQUENCY_MAP[characterType];
    }
    
    // 尝试模糊匹配
    const lowerType = characterType.toLowerCase();
    if (lowerType.includes('主角') || lowerType.includes('主人公')) {
      return HIGHLIGHT_FREQUENCY_MAP['主角'];
    }
    if (lowerType.includes('反派') || lowerType.includes('boss')) {
      return HIGHLIGHT_FREQUENCY_MAP['反派'];
    }
    if (lowerType.includes('配角')) {
      return HIGHLIGHT_FREQUENCY_MAP['配角'];
    }
    
    return HIGHLIGHT_FREQUENCY_MAP['default'];
  }

  /**
   * 检查角色是否需要高光时刻 (Requirements 7.4)
   */
  async checkNeedsHighlight(
    characterId: string,
    characterType: string,
    currentEpisode: number
  ): Promise<{ needsHighlight: boolean; episodesSinceLastHighlight: number; suggestion?: string }> {
    try {
      const charm = await this.getCharm(characterId);
      const frequency = this.getSuggestedHighlightFrequency(characterType);
      
      if (!charm || charm.impressiveMoments.length === 0) {
        return {
          needsHighlight: currentEpisode >= frequency,
          episodesSinceLastHighlight: currentEpisode,
          suggestion: currentEpisode >= frequency 
            ? `角色尚无高光时刻，建议在本集安排一次高光表现` 
            : undefined,
        };
      }

      // 找到最近的高光时刻
      const lastHighlight = Math.max(...charm.impressiveMoments.map(m => m.episode));
      const episodesSince = currentEpisode - lastHighlight;
      
      return {
        needsHighlight: episodesSince >= frequency,
        episodesSinceLastHighlight: episodesSince,
        suggestion: episodesSince >= frequency
          ? `角色已${episodesSince}集未有高光表现，建议安排一次高光时刻`
          : undefined,
      };
    } catch (error) {
      logger.error('检查高光需求失败', error as Error, {
        method: 'checkNeedsHighlight',
        additionalInfo: { characterId, currentEpisode },
      });
      return {
        needsHighlight: false,
        episodesSinceLastHighlight: 0,
      };
    }
  }

  /**
   * 格式化为提示词 (Requirements 7.2, 7.5)
   */
  formatForPrompt(characters: Array<{ characterId: string; characterName: string; charm: ICharacterCharm }>): string {
    if (!characters || characters.length === 0) {
      return '';
    }

    const lines: string[] = ['【角色魅力特征】', ''];

    for (const char of characters) {
      const { characterName, charm } = char;
      
      // 跳过没有任何魅力特征的角色
      if (
        charm.catchphrases.length === 0 &&
        charm.quirks.length === 0 &&
        charm.signatureMoves.length === 0
      ) {
        continue;
      }

      lines.push(`【${characterName}】`);
      
      if (charm.catchphrases.length > 0) {
        lines.push(`  口头禅：${charm.catchphrases.join('、')}`);
      }
      
      if (charm.quirks.length > 0) {
        lines.push(`  小癖好：${charm.quirks.join('、')}`);
      }
      
      if (charm.signatureMoves.length > 0) {
        lines.push(`  标志性动作：${charm.signatureMoves.join('、')}`);
      }
      
      // 显示最近的高光时刻（最多3个）
      if (charm.impressiveMoments.length > 0) {
        const recentMoments = charm.impressiveMoments
          .sort((a, b) => b.episode - a.episode)
          .slice(0, 3);
        
        lines.push(`  近期高光：`);
        for (const moment of recentMoments) {
          const typeDesc = this.getMomentTypeDescription(moment.type);
          lines.push(`    - 第${moment.episode}集 [${typeDesc}] ${moment.description}`);
        }
      }
      
      lines.push('');
    }

    if (lines.length <= 2) {
      return ''; // 没有任何角色有魅力特征
    }

    lines.push('请在剧本中适当展现角色的魅力特征，保持角色的独特性和辨识度。');
    
    return lines.join('\n');
  }

  /**
   * 获取高光时刻类型描述
   */
  private getMomentTypeDescription(type: ImpressiveMomentType): string {
    const descriptions: Record<ImpressiveMomentType, string> = {
      combat: '战斗',
      wisdom: '智慧',
      emotional: '情感',
      humor: '幽默',
    };
    return descriptions[type] || type;
  }

  /**
   * 批量获取项目中所有角色的魅力特征
   */
  async getProjectCharms(projectId: string): Promise<Array<{
    characterId: string;
    characterName: string;
    charm: ICharacterCharm;
  }>> {
    try {
      const enhancements = await CharacterEnhancement.find({
        projectId: new mongoose.Types.ObjectId(projectId),
      });

      return enhancements.map(e => ({
        characterId: e.characterId.toString(),
        characterName: e.characterName,
        charm: e.charm,
      }));
    } catch (error) {
      logger.error('批量获取角色魅力失败', error as Error, {
        method: 'getProjectCharms',
        additionalInfo: { projectId },
      });
      return [];
    }
  }
}

// 导出单例
export const characterCharmAnalyzer = new CharacterCharmAnalyzer();
