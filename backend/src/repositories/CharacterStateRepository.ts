import mongoose from 'mongoose';
import { CharacterState, ICharacterState } from '../models/CharacterState';
import { Character } from '../models/Character';

export interface StateChanges {
  equipmentGained: string[];
  equipmentLost: string[];
  newAbilities: string[];
  condition: {
    physical: string;
    mental: string;
    combat: string;
  } | null;
  permanentMark: {
    mark: string;
    type: 'disability' | 'special' | 'awakening';
  } | null;
  description: string;
}

class CharacterStateRepositoryClass {
  /**
   * 获取角色在某集的状态
   */
  async getStateAtEpisode(
    projectId: string,
    characterId: string,
    episodeNumber: number
  ): Promise<ICharacterState | null> {
    return CharacterState.findOne({
      projectId: new mongoose.Types.ObjectId(projectId),
      characterId: new mongoose.Types.ObjectId(characterId),
      episodeNumber,
    });
  }

  /**
   * 获取角色的最新状态
   */
  async getLatestState(
    projectId: string,
    characterId: string
  ): Promise<ICharacterState | null> {
    return CharacterState.findOne({
      projectId: new mongoose.Types.ObjectId(projectId),
      characterId: new mongoose.Types.ObjectId(characterId),
    })
      .sort({ episodeNumber: -1 })
      .limit(1);
  }

  /**
   * 获取角色的状态历史
   */
  async getStateHistory(
    projectId: string,
    characterId: string
  ): Promise<ICharacterState[]> {
    return CharacterState.find({
      projectId: new mongoose.Types.ObjectId(projectId),
      characterId: new mongoose.Types.ObjectId(characterId),
    }).sort({ episodeNumber: 1 });
  }

  /**
   * 获取某集所有角色的状态
   */
  async getEpisodeStates(
    projectId: string,
    episodeNumber: number
  ): Promise<ICharacterState[]> {
    return CharacterState.find({
      projectId: new mongoose.Types.ObjectId(projectId),
      episodeNumber,
    });
  }

  /**
   * 更新角色状态（核心方法）
   */
  async updateState(
    projectId: string,
    characterId: string,
    characterName: string,
    episodeNumber: number,
    changes: StateChanges
  ): Promise<ICharacterState> {
    const projectOid = new mongoose.Types.ObjectId(projectId);
    const characterOid = new mongoose.Types.ObjectId(characterId);

    // 获取上一集的状态，用于累计
    const previousState = await CharacterState.findOne({
      projectId: projectOid,
      characterId: characterOid,
      episodeNumber: { $lt: episodeNumber },
    })
      .sort({ episodeNumber: -1 })
      .limit(1);

    // 计算累计装备和能力
    let currentEquipment = previousState?.currentEquipment || [];
    let currentAbilities = previousState?.currentAbilities || [];

    // 添加新装备
    if (changes.equipmentGained.length > 0) {
      currentEquipment = [...currentEquipment, ...changes.equipmentGained];
    }

    // 移除失去的装备
    if (changes.equipmentLost.length > 0) {
      currentEquipment = currentEquipment.filter(
        (e) => !changes.equipmentLost.includes(e)
      );
    }

    // 添加新能力
    if (changes.newAbilities.length > 0) {
      currentAbilities = [...currentAbilities, ...changes.newAbilities];
    }

    // 去重
    currentEquipment = [...new Set(currentEquipment)];
    currentAbilities = [...new Set(currentAbilities)];

    // 使用upsert更新或创建
    const state = await CharacterState.findOneAndUpdate(
      {
        projectId: projectOid,
        characterId: characterOid,
        episodeNumber,
      },
      {
        characterName,
        equipmentGained: changes.equipmentGained,
        equipmentLost: changes.equipmentLost,
        newAbilities: changes.newAbilities,
        condition: changes.condition || {
          physical: '状态正常',
          mental: '状态正常',
          combat: '战力正常',
        },
        permanentMark: changes.permanentMark || undefined,
        currentEquipment,
        currentAbilities,
        description: changes.description,
      },
      {
        upsert: true,
        new: true,
      }
    );

    return state;
  }

  /**
   * 获取角色出场统计
   */
  async getAppearanceStats(
    projectId: string,
    characterId: string
  ): Promise<{
    totalAppearances: number;
    firstAppearance: number | null;
    lastAppearance: number | null;
    episodes: number[];
  }> {
    const states = await CharacterState.find({
      projectId: new mongoose.Types.ObjectId(projectId),
      characterId: new mongoose.Types.ObjectId(characterId),
    })
      .select('episodeNumber')
      .sort({ episodeNumber: 1 });

    const episodes = states.map((s) => s.episodeNumber);

    return {
      totalAppearances: episodes.length,
      firstAppearance: episodes[0] || null,
      lastAppearance: episodes[episodes.length - 1] || null,
      episodes,
    };
  }

  /**
   * 根据角色名获取角色状态
   */
  async getStateByCharacterName(
    projectId: string,
    characterName: string,
    episodeNumber?: number
  ): Promise<ICharacterState | null> {
    const query: Record<string, unknown> = {
      projectId: new mongoose.Types.ObjectId(projectId),
      characterName,
    };

    if (episodeNumber !== undefined) {
      query.episodeNumber = episodeNumber;
    }

    return CharacterState.findOne(query).sort({ episodeNumber: -1 });
  }

  /**
   * 删除某集之后的所有状态（用于回滚）
   */
  async deleteStatesAfterEpisode(
    projectId: string,
    episodeNumber: number
  ): Promise<number> {
    const result = await CharacterState.deleteMany({
      projectId: new mongoose.Types.ObjectId(projectId),
      episodeNumber: { $gt: episodeNumber },
    });
    return result.deletedCount;
  }

  /**
   * 获取有永久性标记的角色
   */
  async getCharactersWithPermanentMarks(
    projectId: string
  ): Promise<ICharacterState[]> {
    return CharacterState.find({
      projectId: new mongoose.Types.ObjectId(projectId),
      permanentMark: { $exists: true, $ne: null },
    }).sort({ episodeNumber: 1 });
  }
}

export const characterStateRepository = new CharacterStateRepositoryClass();
