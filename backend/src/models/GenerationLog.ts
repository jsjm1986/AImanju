import mongoose, { Document, Schema } from 'mongoose';

/**
 * 生成日志数据模型
 * 用于持久化存储每次剧本生成的完整上下文和结果
 */

export interface IGenerationLog extends Document {
  projectId: mongoose.Types.ObjectId;
  episodeNumber: number;

  // 生成上下文（核心数据）
  context: {
    episodePlan: string;                    // 本集梗概
    formattedContext: string;               // 完整世界信息文本
    constraints: string[];                  // 约束条件
    suggestions: string[];                  // 建议
    relevantCharacters: Array<{
      name: string;
      role: string;
      tier: string;
      weight: number;
      reason: string;
    }>;
    relevantForeshadowings: Array<{
      content: string;
      weight: number;
      reason: string;
      episodePlanted?: number;
      importance?: string;
    }>;
    previousCliffhanger?: string;
    rhythmSettings?: Record<string, unknown>;
  };

  // 多头注意力分析
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  multiHeadAnalysis?: any;

  // AI 约束决策结果（V3 UnifiedConstraintManager）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aiConstraintDecision?: any;

  // 约束验证结果
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constraintValidation?: any;

  // 分析结果
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  analysis?: any;

  // 角色生命周期变化
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  characterLifecycle?: any;

  // 重试信息
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  retryInfo?: any;

  // 生成日志
  logs: Array<{
    time: string;
    message: string;
    level: 'info' | 'warn' | 'error';
  }>;

  // 元数据
  status: 'success' | 'partial_success' | 'failed';
  wordCount: number;  // V1 算法（兼容）
  wordCountV2?: number;  // V2 算法
  wordCountAlgorithm?: 'v1' | 'v2';  // 使用的算法版本
  generationDuration: number;  // 毫秒

  createdAt: Date;
  updatedAt: Date;
}

const GenerationLogSchema = new Schema<IGenerationLog>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    episodeNumber: { type: Number, required: true },

    context: {
      episodePlan: String,
      formattedContext: String,
      constraints: [String],
      suggestions: [String],
      relevantCharacters: [{
        name: String,
        role: String,
        tier: String,
        weight: Number,
        reason: String,
      }],
      relevantForeshadowings: [{
        content: String,
        weight: Number,
        reason: String,
        episodePlanted: Number,
        importance: String,
      }],
      previousCliffhanger: String,
      rhythmSettings: Schema.Types.Mixed,
    },

    multiHeadAnalysis: Schema.Types.Mixed,
    aiConstraintDecision: Schema.Types.Mixed,  // AI 约束决策结果
    constraintValidation: Schema.Types.Mixed,
    analysis: Schema.Types.Mixed,
    characterLifecycle: Schema.Types.Mixed,
    retryInfo: Schema.Types.Mixed,

    logs: [{
      time: String,
      message: String,
      level: { type: String, enum: ['info', 'warn', 'error'] },
    }],

    status: { type: String, enum: ['success', 'partial_success', 'failed'], default: 'success' },
    wordCount: Number,  // V1 算法
    wordCountV2: Number,  // V2 算法
    wordCountAlgorithm: { type: String, enum: ['v1', 'v2'] },
    generationDuration: Number,
  },
  { timestamps: true }
);

// 索引：快速查找项目的生成历史
GenerationLogSchema.index({ projectId: 1, episodeNumber: -1 });
// 唯一索引：每集只保留最新一条记录
GenerationLogSchema.index({ projectId: 1, episodeNumber: 1 }, { unique: true });

export const GenerationLog = mongoose.model<IGenerationLog>('GenerationLog', GenerationLogSchema);
