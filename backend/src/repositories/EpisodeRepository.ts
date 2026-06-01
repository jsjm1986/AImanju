import { Episode, IEpisode } from '../models';
import { BaseRepository } from './BaseRepository';
import mongoose from 'mongoose';

export class EpisodeRepository extends BaseRepository<IEpisode> {
  constructor() {
    super(Episode);
  }

  async findByProject(projectId: string): Promise<IEpisode[]> {
    return this.model.find({ projectId: new mongoose.Types.ObjectId(projectId) })
      .sort({ episodeNumber: 1 }).exec();
  }

  async findByNumber(projectId: string, episodeNumber: number): Promise<IEpisode | null> {
    return this.model.findOne({
      projectId: new mongoose.Types.ObjectId(projectId),
      episodeNumber
    }).exec();
  }

  async upsert(projectId: string, episodeNumber: number, data: Partial<IEpisode>): Promise<IEpisode> {
    return this.model.findOneAndUpdate(
      { projectId: new mongoose.Types.ObjectId(projectId), episodeNumber },
      { ...data, projectId: new mongoose.Types.ObjectId(projectId), episodeNumber },
      { upsert: true, new: true }
    ).exec() as Promise<IEpisode>;
  }
}

export const episodeRepository = new EpisodeRepository();
