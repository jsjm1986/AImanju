import mongoose from 'mongoose';
import { RewriteHistory, IRewriteHistory } from '../models/RewriteHistory';

export interface CreateRewriteData {
  episodeId: string;
  episodeNumber: number;
  type: 'full' | 'selection' | 'instruction';
  instruction: string;
  originalContent: string;
  rewrittenContent: string;
}

class RewriteHistoryRepositoryClass {
  /**
   * 创建改写历史记录
   */
  async create(projectId: string, data: CreateRewriteData): Promise<IRewriteHistory> {
    const history = new RewriteHistory({
      projectId: new mongoose.Types.ObjectId(projectId),
      episodeId: new mongoose.Types.ObjectId(data.episodeId),
      episodeNumber: data.episodeNumber,
      type: data.type,
      instruction: data.instruction,
      originalContent: data.originalContent,
      rewrittenContent: data.rewrittenContent,
      applied: false,
    });

    return history.save();
  }

  /**
   * 获取项目的所有改写历史
   */
  async findByProject(projectId: string): Promise<IRewriteHistory[]> {
    return RewriteHistory.find({
      projectId: new mongoose.Types.ObjectId(projectId),
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * 获取剧集的改写历史
   */
  async findByEpisode(episodeId: string): Promise<IRewriteHistory[]> {
    return RewriteHistory.find({
      episodeId: new mongoose.Types.ObjectId(episodeId),
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * 根据项目和集数获取改写历史
   */
  async findByProjectAndEpisode(projectId: string, episodeNumber: number): Promise<IRewriteHistory[]> {
    return RewriteHistory.find({
      projectId: new mongoose.Types.ObjectId(projectId),
      episodeNumber,
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * 根据ID获取改写历史
   */
  async findById(id: string): Promise<IRewriteHistory | null> {
    return RewriteHistory.findById(id).lean();
  }

  /**
   * 标记改写已应用
   */
  async markApplied(id: string): Promise<IRewriteHistory | null> {
    return RewriteHistory.findByIdAndUpdate(
      id,
      { applied: true },
      { new: true }
    ).lean();
  }

  /**
   * 标记改写已撤销
   */
  async markReverted(id: string): Promise<IRewriteHistory | null> {
    return RewriteHistory.findByIdAndUpdate(
      id,
      { applied: false },
      { new: true }
    ).lean();
  }

  /**
   * 删除改写历史
   */
  async delete(id: string): Promise<boolean> {
    const result = await RewriteHistory.deleteOne({ _id: new mongoose.Types.ObjectId(id) });
    return result.deletedCount > 0;
  }

  /**
   * 删除剧集的所有改写历史
   */
  async deleteByEpisode(episodeId: string): Promise<number> {
    const result = await RewriteHistory.deleteMany({
      episodeId: new mongoose.Types.ObjectId(episodeId),
    });
    return result.deletedCount;
  }

  /**
   * 删除项目的所有改写历史
   */
  async deleteByProject(projectId: string): Promise<number> {
    const result = await RewriteHistory.deleteMany({
      projectId: new mongoose.Types.ObjectId(projectId),
    });
    return result.deletedCount;
  }

  /**
   * 获取最近的改写历史
   */
  async getRecent(projectId: string, limit = 20): Promise<IRewriteHistory[]> {
    return RewriteHistory.find({
      projectId: new mongoose.Types.ObjectId(projectId),
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * 获取已应用的改写历史
   */
  async getApplied(projectId: string): Promise<IRewriteHistory[]> {
    return RewriteHistory.find({
      projectId: new mongoose.Types.ObjectId(projectId),
      applied: true,
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * 获取未应用的改写历史
   */
  async getPending(projectId: string): Promise<IRewriteHistory[]> {
    return RewriteHistory.find({
      projectId: new mongoose.Types.ObjectId(projectId),
      applied: false,
    })
      .sort({ createdAt: -1 })
      .lean();
  }
}

export const RewriteHistoryRepository = new RewriteHistoryRepositoryClass();
