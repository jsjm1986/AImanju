import mongoose, { Document, Schema } from 'mongoose';

/**
 * 批量改写历史记录模型
 * 用于记录批量连贯改写的完整信息，支持回滚和历史查看
 */

// 单集改写结果接口
export interface IBatchEpisodeResult {
  episodeNumber: number;
  episodeId: mongoose.Types.ObjectId;
  originalContent: string;
  rewrittenContent: string;
  applied: boolean;
  wordCountChange: number;
}

// 连贯性问题接口
export interface ICoherenceIssue {
  type: string;
  severity: 'warning' | 'error';
  episode: number;
  description: string;
}

// 连贯性报告接口
export interface ICoherenceReport {
  overallScore: number;  // 0-100
  characterConsistency: boolean;
  foreshadowingHandled: boolean;
  timelineConsistent: boolean;
  issues: ICoherenceIssue[];
}

// 批量改写历史主接口
export interface IBatchRewriteHistory extends Document {
  projectId: mongoose.Types.ObjectId;
  planId: string;
  instruction: string;
  episodeRange: {
    start: number;
    end: number;
  };
  status: 'pending' | 'in_progress' | 'completed' | 'partial' | 'failed' | 'rolled_back';
  episodes: IBatchEpisodeResult[];
  coherenceReport?: ICoherenceReport;
  appliedAt?: Date;
  rolledBackAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 单集改写结果 Schema
const BatchEpisodeResultSchema = new Schema<IBatchEpisodeResult>(
  {
    episodeNumber: { type: Number, required: true },
    episodeId: { type: Schema.Types.ObjectId, ref: 'Episode', required: true },
    originalContent: { type: String, required: true },
    rewrittenContent: { type: String, required: true },
    applied: { type: Boolean, default: false },
    wordCountChange: { type: Number, default: 0 },
  },
  { _id: false }
);

// 连贯性问题 Schema
const CoherenceIssueSchema = new Schema<ICoherenceIssue>(
  {
    type: { type: String, required: true },
    severity: { type: String, enum: ['warning', 'error'], required: true },
    episode: { type: Number, required: true },
    description: { type: String, required: true },
  },
  { _id: false }
);

// 连贯性报告 Schema
const CoherenceReportSchema = new Schema<ICoherenceReport>(
  {
    overallScore: { type: Number, min: 0, max: 100, default: 0 },
    characterConsistency: { type: Boolean, default: true },
    foreshadowingHandled: { type: Boolean, default: true },
    timelineConsistent: { type: Boolean, default: true },
    issues: { type: [CoherenceIssueSchema], default: [] },
  },
  { _id: false }
);

// 批量改写历史主 Schema
const BatchRewriteHistorySchema = new Schema<IBatchRewriteHistory>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    planId: { type: String, required: true },
    instruction: { type: String, required: true },
    episodeRange: {
      start: { type: Number, required: true },
      end: { type: Number, required: true },
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'partial', 'failed', 'rolled_back'],
      default: 'pending',
    },
    episodes: { type: [BatchEpisodeResultSchema], default: [] },
    coherenceReport: { type: CoherenceReportSchema, required: false },
    appliedAt: { type: Date, required: false },
    rolledBackAt: { type: Date, required: false },
  },
  {
    timestamps: true,
  }
);

// 索引
BatchRewriteHistorySchema.index({ projectId: 1, createdAt: -1 });  // 按项目和时间排序
BatchRewriteHistorySchema.index({ projectId: 1, status: 1 });  // 按状态筛选
BatchRewriteHistorySchema.index({ projectId: 1, 'episodeRange.start': 1, 'episodeRange.end': 1 });  // 按集数范围筛选

export const BatchRewriteHistory = mongoose.model<IBatchRewriteHistory>(
  'BatchRewriteHistory',
  BatchRewriteHistorySchema
);
