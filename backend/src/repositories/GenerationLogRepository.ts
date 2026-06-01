import { GenerationLog, IGenerationLog } from '../models/GenerationLog';

/**
 * 生成日志数据访问层
 */
export class GenerationLogRepository {
  /**
   * 保存或更新生成日志
   */
  async upsert(projectId: string, episodeNumber: number, data: Partial<IGenerationLog>): Promise<IGenerationLog> {
    return GenerationLog.findOneAndUpdate(
      { projectId, episodeNumber },
      { $set: { ...data, projectId, episodeNumber } },
      { upsert: true, new: true }
    ).exec() as Promise<IGenerationLog>;
  }

  /**
   * 获取某集的生成日志
   */
  async getByEpisode(projectId: string, episodeNumber: number): Promise<IGenerationLog | null> {
    return GenerationLog.findOne({ projectId, episodeNumber }).exec();
  }

  /**
   * 获取项目的所有生成日志（分页）
   */
  async getByProject(projectId: string, page = 1, limit = 20): Promise<{
    logs: IGenerationLog[];
    total: number;
    pages: number;
  }> {
    const total = await GenerationLog.countDocuments({ projectId });
    const logs = await GenerationLog.find({ projectId })
      .sort({ episodeNumber: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    return { logs, total, pages: Math.ceil(total / limit) };
  }

  /**
   * 删除某集的生成日志
   */
  async deleteByEpisode(projectId: string, episodeNumber: number): Promise<boolean> {
    const result = await GenerationLog.deleteOne({ projectId, episodeNumber });
    return result.deletedCount > 0;
  }

  /**
   * 获取项目的生成统计
   */
  async getStats(projectId: string): Promise<{
    totalGenerated: number;
    averageSatisfactionRate: number;
    totalRetries: number;
    averageDuration: number;
  }> {
    const logs = await GenerationLog.find({ projectId }).exec();

    if (logs.length === 0) {
      return {
        totalGenerated: 0,
        averageSatisfactionRate: 0,
        totalRetries: 0,
        averageDuration: 0,
      };
    }

    let totalSatisfactionRate = 0;
    let totalRetries = 0;
    let totalDuration = 0;
    let validRateCount = 0;

    for (const log of logs) {
      if (log.constraintValidation?.satisfactionRate !== undefined) {
        totalSatisfactionRate += log.constraintValidation.satisfactionRate;
        validRateCount++;
      }
      if (log.retryInfo?.totalAttempts) {
        totalRetries += log.retryInfo.totalAttempts - 1;  // 只计算重试次数，不包括首次
      }
      if (log.generationDuration) {
        totalDuration += log.generationDuration;
      }
    }

    return {
      totalGenerated: logs.length,
      averageSatisfactionRate: validRateCount > 0 ? totalSatisfactionRate / validRateCount : 0,
      totalRetries,
      averageDuration: logs.length > 0 ? totalDuration / logs.length : 0,
    };
  }
}

export const generationLogRepository = new GenerationLogRepository();
