import mongoose from 'mongoose';
import {
  WorldState,
  IWorldState,
  ICharacterState,
  IPlantedForeshadowing,
  CharacterTier,
  CharacterStatus,
} from '../models/WorldState';

function toObjectId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

const FORESHADOWING_THRESHOLDS: Record<string, { overdue: number; warning: number }> = {
  high:   { overdue: 10, warning: 5 },
  normal: { overdue: 20, warning: 10 },
  low:    { overdue: 30, warning: 15 },
};

class WorldStateRepositoryClass {
  private episodeFilter(projectId: string, episodeNumber: number) {
    return { projectId: toObjectId(projectId), episodeNumber };
  }

  private updateAtEpisode(
    projectId: string,
    episodeNumber: number,
    update: mongoose.UpdateQuery<IWorldState>,
    extraFilter?: Record<string, unknown>
  ): Promise<IWorldState | null> {
    return WorldState.findOneAndUpdate(
      { ...this.episodeFilter(projectId, episodeNumber), ...extraFilter },
      update,
      { new: true }
    );
  }

  private async getLatestCharacters(projectId: string): Promise<ICharacterState[]> {
    const state = await this.getLatestState(projectId);
    if (!state) return [];
    const chars: ICharacterState[] = [];
    state.characters.forEach((char) => chars.push(char));
    return chars;
  }

  async getStateAtEpisode(
    projectId: string,
    episodeNumber: number
  ): Promise<IWorldState | null> {
    return WorldState.findOne({
      projectId: toObjectId(projectId),
      episodeNumber: { $lte: episodeNumber },
    })
      .sort({ episodeNumber: -1 })
      .limit(1);
  }

  async getLatestState(projectId: string): Promise<IWorldState | null> {
    return WorldState.findOne({
      projectId: toObjectId(projectId),
    })
      .sort({ episodeNumber: -1 })
      .limit(1);
  }

  async getExactStateAtEpisode(
    projectId: string,
    episodeNumber: number
  ): Promise<IWorldState | null> {
    return WorldState.findOne(this.episodeFilter(projectId, episodeNumber));
  }

  async upsertState(
    projectId: string,
    episodeNumber: number,
    stateData: Partial<IWorldState>
  ): Promise<IWorldState> {
    const projectOid = toObjectId(projectId);
    return WorldState.findOneAndUpdate(
      { projectId: projectOid, episodeNumber },
      { ...stateData, projectId: projectOid, episodeNumber },
      { upsert: true, new: true }
    );
  }

  async createSnapshot(
    projectId: string,
    episodeNumber: number,
    stateData: Partial<IWorldState>
  ): Promise<IWorldState> {
    return WorldState.create({
      ...stateData,
      projectId: toObjectId(projectId),
      episodeNumber,
    });
  }

  async updateCharacterState(
    projectId: string,
    episodeNumber: number,
    characterName: string,
    updates: Partial<ICharacterState>
  ): Promise<IWorldState | null> {
    const prefix = `characters.${characterName}`;
    return this.updateAtEpisode(projectId, episodeNumber, {
      $set: Object.fromEntries(
        Object.entries(updates).map(([k, v]) => [`${prefix}.${k}`, v])
      ),
    });
  }

  async addCharacter(
    projectId: string,
    episodeNumber: number,
    characterName: string,
    characterState: ICharacterState
  ): Promise<IWorldState | null> {
    return this.updateAtEpisode(projectId, episodeNumber, {
      $set: { [`characters.${characterName}`]: characterState },
    });
  }

  async addPlantedForeshadowing(
    projectId: string,
    episodeNumber: number,
    foreshadowing: IPlantedForeshadowing
  ): Promise<IWorldState | null> {
    return this.updateAtEpisode(projectId, episodeNumber, {
      $push: { 'foreshadowings.planted': foreshadowing },
    });
  }

  async resolveForeshadowing(
    projectId: string,
    episodeNumber: number,
    foreshadowingId: string,
    resolutionNote: string
  ): Promise<IWorldState | null> {
    const state = await this.getExactStateAtEpisode(projectId, episodeNumber);
    if (!state) return null;

    const planted = state.foreshadowings.planted.find((f) => f.id === foreshadowingId);
    if (!planted) return null;

    return this.updateAtEpisode(projectId, episodeNumber, {
      $pull: { 'foreshadowings.planted': { id: foreshadowingId } },
      $push: {
        'foreshadowings.recentlyResolved': {
          $each: [{
            content: planted.content,
            episodeResolved: episodeNumber,
            resolutionNote,
          }],
          $slice: -10,
        },
      },
    });
  }

  async updatePlotState(
    projectId: string,
    episodeNumber: number,
    plotUpdates: Record<string, unknown>
  ): Promise<IWorldState | null> {
    return this.updateAtEpisode(projectId, episodeNumber, {
      $set: Object.fromEntries(
        Object.entries(plotUpdates).map(([k, v]) => [`plotState.${k}`, v])
      ),
    });
  }

  async addRecentEvent(
    projectId: string,
    episodeNumber: number,
    event: string
  ): Promise<IWorldState | null> {
    return this.updateAtEpisode(projectId, episodeNumber, {
      $push: {
        'plotState.recentEvents': {
          $each: [{ episode: episodeNumber, event }],
          $slice: -5,
        },
      },
    });
  }

  async addCliffhanger(
    projectId: string,
    episodeNumber: number,
    content: string
  ): Promise<IWorldState | null> {
    return this.updateAtEpisode(projectId, episodeNumber, {
      $push: {
        'plotState.cliffhangers': {
          episode: episodeNumber,
          content,
          resolved: false,
        },
      },
    });
  }

  async resolveCliffhanger(
    projectId: string,
    episodeNumber: number,
    cliffhangerEpisode: number
  ): Promise<IWorldState | null> {
    return this.updateAtEpisode(projectId, episodeNumber, {
      $set: { 'plotState.cliffhangers.$.resolved': true },
    }, { 'plotState.cliffhangers.episode': cliffhangerEpisode });
  }

  async getUnresolvedForeshadowings(
    projectId: string
  ): Promise<IPlantedForeshadowing[]> {
    const state = await this.getLatestState(projectId);
    return state?.foreshadowings.planted || [];
  }

  async getOverdueForeshadowings(
    projectId: string,
    currentEpisode: number
  ): Promise<IPlantedForeshadowing[]> {
    const state = await this.getLatestState(projectId);
    if (!state) return [];

    return state.foreshadowings.planted.filter((f) => {
      const age = currentEpisode - f.episodePlanted;
      return age > FORESHADOWING_THRESHOLDS[f.importance].overdue;
    });
  }

  async getNearOverdueForeshadowings(
    projectId: string,
    currentEpisode: number
  ): Promise<IPlantedForeshadowing[]> {
    const state = await this.getLatestState(projectId);
    if (!state) return [];

    return state.foreshadowings.planted.filter((f) => {
      const age = currentEpisode - f.episodePlanted;
      const { overdue, warning } = FORESHADOWING_THRESHOLDS[f.importance];
      return age > warning && age <= overdue;
    });
  }

  async getCharactersByTier(
    projectId: string,
    tier: CharacterTier
  ): Promise<ICharacterState[]> {
    return (await this.getLatestCharacters(projectId)).filter((c) => c.tier === tier);
  }

  async getActiveCharacters(projectId: string): Promise<ICharacterState[]> {
    return (await this.getLatestCharacters(projectId)).filter((c) => c.status === 'active');
  }

  async updateCharacterTier(
    projectId: string,
    episodeNumber: number,
    characterName: string,
    newTier: CharacterTier
  ): Promise<IWorldState | null> {
    return this.updateAtEpisode(projectId, episodeNumber, {
      $set: { [`characters.${characterName}.tier`]: newTier },
    });
  }

  async updateCharacterStatus(
    projectId: string,
    episodeNumber: number,
    characterName: string,
    newStatus: CharacterStatus
  ): Promise<IWorldState | null> {
    return this.updateAtEpisode(projectId, episodeNumber, {
      $set: { [`characters.${characterName}.status`]: newStatus },
    });
  }

  async deleteStatesAfterEpisode(
    projectId: string,
    episodeNumber: number
  ): Promise<number> {
    const result = await WorldState.deleteMany({
      projectId: toObjectId(projectId),
      episodeNumber: { $gt: episodeNumber },
    });
    return result.deletedCount;
  }

  async getAllStates(projectId: string): Promise<IWorldState[]> {
    return WorldState.find({
      projectId: toObjectId(projectId),
    }).sort({ episodeNumber: 1 });
  }

  async deleteAllStates(projectId: string): Promise<number> {
    const result = await WorldState.deleteMany({
      projectId: toObjectId(projectId),
    });
    return result.deletedCount;
  }

  async getUnresolvedCliffhangers(
    projectId: string
  ): Promise<{ episode: number; content: string }[]> {
    const state = await this.getLatestState(projectId);
    if (!state) return [];

    return state.plotState.cliffhangers
      .filter((c) => !c.resolved)
      .map((c) => ({ episode: c.episode, content: c.content }));
  }

  async getPendingConflicts(projectId: string): Promise<string[]> {
    const state = await this.getLatestState(projectId);
    return state?.plotState.pendingConflicts || [];
  }

  async addPendingConflict(
    projectId: string,
    episodeNumber: number,
    conflict: string
  ): Promise<IWorldState | null> {
    return this.updateAtEpisode(projectId, episodeNumber, {
      $addToSet: { 'plotState.pendingConflicts': conflict },
    });
  }

  async resolveConflict(
    projectId: string,
    episodeNumber: number,
    conflict: string
  ): Promise<IWorldState | null> {
    return this.updateAtEpisode(projectId, episodeNumber, {
      $pull: { 'plotState.pendingConflicts': conflict },
      $push: {
        'plotState.resolvedConflicts': {
          $each: [conflict],
          $slice: -5,
        },
      },
    });
  }
}

export const worldStateRepository = new WorldStateRepositoryClass();
