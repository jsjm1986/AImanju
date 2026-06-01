import mongoose, { Document, Schema } from 'mongoose';

// 选中范围接口（仅局部改写时使用）
export interface ISelection {
  start: number;
  end: number;
  text: string;
}

export interface IRewriteHistory extends Document {
  projectId: mongoose.Types.ObjectId;
  episodeId: mongoose.Types.ObjectId;
  episodeNumber: number;
  type: 'full' | 'selection' | 'instruction' | 'manual' | 'fix';
  instruction: string;
  originalContent: string;
  rewrittenContent: string;

  // AI 提示词（仅 AI 改写时保存）
  systemPrompt?: string;  // AI 系统提示词
  userPrompt?: string;    // 发送给 AI 的完整用户消息

  // 选中范围（仅 selection 类型）
  selection?: ISelection;

  // 字数统计（V1 算法 - 兼容）
  originalWordCount: number;
  rewrittenWordCount: number;
  wordCountDiff: number;  // 正数表示增加，负数表示减少

  // 字数统计（V2 算法 - 新增）
  originalWordCountV2?: number;
  rewrittenWordCountV2?: number;
  wordCountDiffV2?: number;

  // 状态
  applied: boolean;
  appliedAt?: Date;
  reverted: boolean;  // 是否被回滚操作级联失效

  createdAt: Date;
  updatedAt: Date;
}

const SelectionSchema = new Schema<ISelection>(
  {
    start: { type: Number, required: true },
    end: { type: Number, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
);

const RewriteHistorySchema = new Schema<IRewriteHistory>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    episodeId: { type: Schema.Types.ObjectId, ref: 'Episode', required: true },
    episodeNumber: { type: Number, required: true },
    type: { type: String, enum: ['full', 'selection', 'instruction', 'manual', 'fix'], default: 'full' },
    instruction: { type: String, required: true },
    originalContent: { type: String, required: true },
    rewrittenContent: { type: String, required: true },

    // AI 提示词（仅 AI 改写时保存）
    systemPrompt: { type: String, required: false },
    userPrompt: { type: String, required: false },

    // 选中范围（仅 selection 类型）
    selection: { type: SelectionSchema, required: false },

    // 字数统计（V1 算法 - 兼容）
    originalWordCount: { type: Number, default: 0 },
    rewrittenWordCount: { type: Number, default: 0 },
    wordCountDiff: { type: Number, default: 0 },

    // 字数统计（V2 算法 - 新增）
    originalWordCountV2: { type: Number },
    rewrittenWordCountV2: { type: Number },
    wordCountDiffV2: { type: Number },

    // 状态
    applied: { type: Boolean, default: false },
    appliedAt: { type: Date, required: false },
    reverted: { type: Boolean, default: false },  // 是否被回滚操作级联失效
  },
  {
    timestamps: true,
  }
);

// 索引
RewriteHistorySchema.index({ projectId: 1, episodeNumber: 1 });
RewriteHistorySchema.index({ episodeId: 1 });
RewriteHistorySchema.index({ projectId: 1, type: 1 });  // 支持按类型筛选
RewriteHistorySchema.index({ projectId: 1, applied: 1 });  // 支持按应用状态筛选
RewriteHistorySchema.index({ projectId: 1, createdAt: -1 });  // 支持按时间排序

export const RewriteHistory = mongoose.model<IRewriteHistory>('RewriteHistory', RewriteHistorySchema);
