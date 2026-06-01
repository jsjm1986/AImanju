import mongoose from 'mongoose';
import {
  Foreshadowing,
  IForeshadowing,
  ForeshadowingStatus,
  ForeshadowingValidity,
} from '../models/Foreshadowing';

export interface PlantedForeshadowing {
  content: string;
  type: 'suspense' | 'character' | 'item' | 'plot' | 'worldbuilding' | 'relationship';
  importance: 'critical' | 'high' | 'normal' | 'low';
  sourceType?: 'manual' | 'ai_detected' | 'cliffhanger' | 'merged';
  relatedCharacters?: string[];
}

export interface ResolvedForeshadowing {
  content: string;
  resolution: string;
}

const URGENCY_BASE: Record<string, number> = {
  critical: 80,
  high: 60,
  normal: 40,
  low: 20,
};

function toObjectId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

class ForeshadowingRepositoryClass {
  async findByProject(projectId: string): Promise<IForeshadowing[]> {
    return Foreshadowing.find({ projectId: toObjectId(projectId) })
      .sort({ episodePlanted: 1 })
      .lean();
  }

  async getUnresolved(projectId: string): Promise<IForeshadowing[]> {
    return Foreshadowing.find({
      projectId: toObjectId(projectId),
      status: 'planted',
      validity: { $in: ['true_foreshadowing', 'setup', 'pending_review'] },
    })
      .sort({ urgencyScore: -1, importance: -1, episodePlanted: 1 })
      .lean();
  }

  async getActiveTrue(projectId: string, limit: number = 50): Promise<IForeshadowing[]> {
    return Foreshadowing.find({
      projectId: toObjectId(projectId),
      status: 'planted',
      validity: 'true_foreshadowing',
    })
      .sort({ urgencyScore: -1, importance: -1 })
      .limit(limit)
      .lean();
  }

  async getUrgent(projectId: string, threshold: number = 80): Promise<IForeshadowing[]> {
    return Foreshadowing.find({
      projectId: toObjectId(projectId),
      status: 'planted',
      validity: { $in: ['true_foreshadowing', 'setup'] },
      urgencyScore: { $gte: threshold },
    })
      .sort({ urgencyScore: -1 })
      .lean();
  }

  async getResolved(projectId: string): Promise<IForeshadowing[]> {
    return Foreshadowing.find({
      projectId: toObjectId(projectId),
      status: 'resolved',
    })
      .sort({ episodeResolved: 1 })
      .lean();
  }

  async getDormant(projectId: string): Promise<IForeshadowing[]> {
    return Foreshadowing.find({
      projectId: toObjectId(projectId),
      status: 'dormant',
    })
      .sort({ episodePlanted: 1 })
      .lean();
  }

  async getPendingReview(projectId: string, limit: number = 50): Promise<IForeshadowing[]> {
    return Foreshadowing.find({
      projectId: toObjectId(projectId),
      status: 'planted',
      validity: 'pending_review',
    })
      .limit(limit)
      .lean();
  }

  async getByCluster(projectId: string, clusterGroup: string): Promise<IForeshadowing[]> {
    return Foreshadowing.find({
      projectId: toObjectId(projectId),
      clusterGroup,
    })
      .sort({ status: 1, episodePlanted: 1 })
      .lean();
  }

  async getClusterLabels(projectId: string): Promise<Array<{ group: string; label: string; count: number }>> {
    return Foreshadowing.aggregate([
      { $match: { projectId: toObjectId(projectId), clusterGroup: { $exists: true, $ne: null } } },
      { $group: { _id: { group: '$clusterGroup', label: '$clusterLabel' }, count: { $sum: 1 } } },
      { $project: { _id: 0, group: '$_id.group', label: '$_id.label', count: 1 } },
    ]);
  }

  async create(
    projectId: string,
    episodePlanted: number,
    data: PlantedForeshadowing
  ): Promise<IForeshadowing> {
    const foreshadowing = new Foreshadowing({
      projectId: toObjectId(projectId),
      episodePlanted,
      content: data.content,
      type: data.type || 'suspense',
      importance: data.importance || 'normal',
      status: 'planted',
      validity: 'pending_review',
      sourceType: data.sourceType || 'ai_detected',
      relatedCharacters: data.relatedCharacters || [],
      relevanceScore: 50,
      urgencyScore: URGENCY_BASE[data.importance] ?? 40,
      reviewCount: 0,
    });
    return foreshadowing.save();
  }

  async createBatch(
    projectId: string,
    episodePlanted: number,
    items: PlantedForeshadowing[]
  ): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    for (const item of items) {
      const existing = await Foreshadowing.findOne({
        projectId: toObjectId(projectId),
        content: { $regex: item.content.substring(0, 20), $options: 'i' },
        status: { $in: ['planted', 'dormant'] },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await this.create(projectId, episodePlanted, item);
      created++;
    }

    return { created, skipped };
  }

  async resolve(
    foreshadowingId: string,
    episodeResolved: number,
    resolutionNote: string
  ): Promise<IForeshadowing | null> {
    return Foreshadowing.findByIdAndUpdate(
      foreshadowingId,
      {
        status: 'resolved',
        episodeResolved,
        resolutionNote,
        resolvedAt: new Date(),
      },
      { new: true }
    );
  }

  async abandon(foreshadowingId: string, reason: string): Promise<IForeshadowing | null> {
    return this.setStatusWithNote(foreshadowingId, 'abandoned', reason);
  }

  async setDormant(foreshadowingId: string, reason: string): Promise<IForeshadowing | null> {
    return this.setStatusWithNote(foreshadowingId, 'dormant', reason);
  }

  async awaken(foreshadowingId: string): Promise<IForeshadowing | null> {
    return Foreshadowing.findByIdAndUpdate(
      foreshadowingId,
      {
        status: 'planted',
        $inc: { urgencyScore: 10 },
      },
      { new: true }
    );
  }

  async updateValidity(
    foreshadowingId: string,
    validity: ForeshadowingValidity,
    reason: string
  ): Promise<IForeshadowing | null> {
    return Foreshadowing.findByIdAndUpdate(
      foreshadowingId,
      {
        validity,
        validityReason: reason,
        lastReviewedAt: new Date(),
        $inc: { reviewCount: 1 },
      },
      { new: true }
    );
  }

  async updateUrgency(foreshadowingId: string, urgencyScore: number): Promise<IForeshadowing | null> {
    return Foreshadowing.findByIdAndUpdate(
      foreshadowingId,
      { urgencyScore: Math.min(100, Math.max(0, urgencyScore)) },
      { new: true }
    );
  }

  async incrementUrgencyByAge(
    projectId: string,
    currentEpisode: number,
    ageThreshold: number = 5,
    increment: number = 5
  ): Promise<number> {
    const result = await Foreshadowing.updateMany(
      {
        projectId: toObjectId(projectId),
        status: 'planted',
        validity: { $in: ['true_foreshadowing', 'setup'] },
        episodePlanted: { $lte: currentEpisode - ageThreshold },
      },
      { $inc: { urgencyScore: increment } }
    );
    return result.modifiedCount;
  }

  async findById(id: string): Promise<IForeshadowing | null> {
    return Foreshadowing.findById(id);
  }

  async update(id: string, data: Partial<IForeshadowing>): Promise<IForeshadowing | null> {
    return Foreshadowing.findByIdAndUpdate(id, data, { new: true });
  }

  async delete(id: string): Promise<boolean> {
    const result = await Foreshadowing.findByIdAndDelete(id);
    return !!result;
  }

  async getStats(projectId: string): Promise<{
    total: number;
    planted: number;
    dormant: number;
    resolved: number;
    abandoned: number;
    merged: number;
    byImportance: { critical: number; high: number; normal: number; low: number };
    byValidity: Record<string, number>;
    urgentCount: number;
    pendingReviewCount: number;
  }> {
    const objectId = toObjectId(projectId);

    const [statusCounts, importanceCounts, validityCounts, urgentCount, pendingCount] = await Promise.all([
      Foreshadowing.aggregate([
        { $match: { projectId: objectId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Foreshadowing.aggregate([
        { $match: { projectId: objectId, status: 'planted' } },
        { $group: { _id: '$importance', count: { $sum: 1 } } },
      ]),
      Foreshadowing.aggregate([
        { $match: { projectId: objectId } },
        { $group: { _id: '$validity', count: { $sum: 1 } } },
      ]),
      Foreshadowing.countDocuments({
        projectId: objectId,
        status: 'planted',
        urgencyScore: { $gte: 80 },
      }),
      Foreshadowing.countDocuments({
        projectId: objectId,
        status: 'planted',
        validity: 'pending_review',
      }),
    ]);

    const stats = {
      total: 0,
      planted: 0,
      dormant: 0,
      resolved: 0,
      abandoned: 0,
      merged: 0,
      byImportance: { critical: 0, high: 0, normal: 0, low: 0 },
      byValidity: {} as Record<string, number>,
      urgentCount,
      pendingReviewCount: pendingCount,
    };

    for (const item of statusCounts) {
      const status = item._id as ForeshadowingStatus;
      if (status in stats) {
        (stats as any)[status] = item.count;
      }
      stats.total += item.count;
    }

    for (const item of importanceCounts) {
      const importance = item._id as 'critical' | 'high' | 'normal' | 'low';
      if (importance in stats.byImportance) {
        stats.byImportance[importance] = item.count;
      }
    }

    for (const item of validityCounts) {
      stats.byValidity[item._id] = item.count;
    }

    return stats;
  }

  async countUnresolved(projectId: string): Promise<number> {
    return Foreshadowing.countDocuments({
      projectId: toObjectId(projectId),
      status: { $in: ['planted', 'dormant'] },
      validity: { $in: ['true_foreshadowing', 'setup', 'pending_review'] },
    });
  }

  private setStatusWithNote(
    id: string,
    status: ForeshadowingStatus,
    note: string
  ): Promise<IForeshadowing | null> {
    return Foreshadowing.findByIdAndUpdate(
      id,
      { status, resolutionNote: note },
      { new: true }
    );
  }
}

export const foreshadowingRepository = new ForeshadowingRepositoryClass();
