import mongoose from 'mongoose';
import { EpisodeSummary, IEpisodeSummary } from '../models/EpisodeSummary';

class SummaryRepositoryClass {
  /**
   * 保存集数摘要
   */
  async save(
    projectId: string,
    episode: number,
    data: {
      summary: string;
      keyEvents: string[];
      cliffhanger: string;
      characterChanges: string[];
    }
  ): Promise<IEpisodeSummary> {
    return EpisodeSummary.findOneAndUpdate(
      {
        projectId: new mongoose.Types.ObjectId(projectId),
        episodeNumber: episode,
      },
      {
        summary: data.summary,
        keyEvents: data.keyEvents,
        cliffhanger: data.cliffhanger,
        characterChanges: data.characterChanges,
      },
      {
        upsert: true,
        new: true,
      }
    );
  }

  /**
   * 获取所有摘要
   */
  async getAll(projectId: string): Promise<IEpisodeSummary[]> {
    return EpisodeSummary.find({
      projectId: new mongoose.Types.ObjectId(projectId),
    }).sort({ episodeNumber: 1 });
  }

  /**
   * 获取最近的摘要
   */
  async getRecent(
    projectId: string,
    beforeEpisode: number,
    limit: number = 5
  ): Promise<IEpisodeSummary[]> {
    return EpisodeSummary.find({
      projectId: new mongoose.Types.ObjectId(projectId),
      episodeNumber: { $lt: beforeEpisode },
    })
      .sort({ episodeNumber: -1 })
      .limit(limit)
      .then(results => results.reverse()); // 按集数正序返回
  }

  /**
   * 获取单集摘要
   */
  async getByEpisode(
    projectId: string,
    episode: number
  ): Promise<IEpisodeSummary | null> {
    return EpisodeSummary.findOne({
      projectId: new mongoose.Types.ObjectId(projectId),
      episodeNumber: episode,
    });
  }

  /**
   * 删除所有摘要
   */
  async deleteAll(projectId: string): Promise<number> {
    const result = await EpisodeSummary.deleteMany({
      projectId: new mongoose.Types.ObjectId(projectId),
    });
    return result.deletedCount;
  }

  /**
   * 删除某集之后的摘要
   */
  async deleteAfterEpisode(
    projectId: string,
    episode: number
  ): Promise<number> {
    const result = await EpisodeSummary.deleteMany({
      projectId: new mongoose.Types.ObjectId(projectId),
      episodeNumber: { $gt: episode },
    });
    return result.deletedCount;
  }
}

export const summaryRepository = new SummaryRepositoryClass();
