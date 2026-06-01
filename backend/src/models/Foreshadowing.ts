import mongoose, { Schema, Document } from 'mongoose';

/**
 * 伏笔状态
 * - planted: 已埋设，等待回收
 * - dormant: 休眠中，暂不追踪（可被唤醒）
 * - resolved: 已回收
 * - merged: 已合并到其他伏笔
 * - abandoned: 已放弃（AI判定为无效或过期）
 */
export type ForeshadowingStatus = 'planted' | 'dormant' | 'resolved' | 'merged' | 'abandoned';

/**
 * 伏笔有效性评级（AI评定）
 * - true_foreshadowing: 真正的伏笔，需要回收
 * - atmosphere: 氛围描写，不需要回收
 * - setup: 铺垫/背景，可选回收
 * - hook: 钩子/悬念，需要承接但不一定单独回收
 * - redundant: 冗余，与其他伏笔重复
 */
export type ForeshadowingValidity =
  | 'true_foreshadowing'
  | 'atmosphere'
  | 'setup'
  | 'hook'
  | 'redundant'
  | 'pending_review';  // 待AI审核

export interface IForeshadowing extends Document {
  projectId: mongoose.Types.ObjectId;
  episodePlanted: number;
  episodeResolved?: number;
  content: string;
  type: 'suspense' | 'character' | 'item' | 'plot' | 'worldbuilding' | 'relationship';
  importance: 'critical' | 'high' | 'normal' | 'low';
  status: ForeshadowingStatus;

  // AI分析字段
  validity: ForeshadowingValidity;
  validityReason?: string;
  relevanceScore: number;  // 0-100，与当前剧情的相关度
  urgencyScore: number;    // 0-100，回收紧迫度

  // 合并相关
  mergedInto?: mongoose.Types.ObjectId;  // 如果被合并，指向目标伏笔
  mergedFrom?: mongoose.Types.ObjectId[];  // 如果是合并目标，记录来源

  // 分组/聚类
  clusterGroup?: string;  // AI分配的主题组
  clusterLabel?: string;  // 组标签（如"红绳之谜"、"申公豹阴谋"）

  // 回收相关
  resolutionNote?: string;
  suggestedResolution?: string;  // AI建议的回收方式
  resolvedAt?: Date;

  // 生命周期
  lastReviewedAt?: Date;  // 上次AI审核时间
  lastReviewedEpisode?: number;
  reviewCount: number;

  // 元数据
  sourceType: 'manual' | 'ai_detected' | 'cliffhanger' | 'merged';
  relatedCharacters?: string[];
  relatedPlotlines?: string[];

  createdAt: Date;
  updatedAt: Date;
}

const ForeshadowingSchema = new Schema<IForeshadowing>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    episodePlanted: { type: Number, required: true },
    episodeResolved: { type: Number },
    content: { type: String, required: true },
    type: {
      type: String,
      enum: ['suspense', 'character', 'item', 'plot', 'worldbuilding', 'relationship'],
      default: 'suspense'
    },
    importance: {
      type: String,
      enum: ['critical', 'high', 'normal', 'low'],
      default: 'normal'
    },
    status: {
      type: String,
      enum: ['planted', 'dormant', 'resolved', 'merged', 'abandoned'],
      default: 'planted'
    },

    // AI分析字段
    validity: {
      type: String,
      enum: ['true_foreshadowing', 'atmosphere', 'setup', 'hook', 'redundant', 'pending_review'],
      default: 'pending_review'
    },
    validityReason: { type: String },
    relevanceScore: { type: Number, default: 50, min: 0, max: 100 },
    urgencyScore: { type: Number, default: 50, min: 0, max: 100 },

    // 合并相关
    mergedInto: { type: Schema.Types.ObjectId, ref: 'Foreshadowing' },
    mergedFrom: [{ type: Schema.Types.ObjectId, ref: 'Foreshadowing' }],

    // 分组/聚类
    clusterGroup: { type: String },
    clusterLabel: { type: String },

    // 回收相关
    resolutionNote: { type: String },
    suggestedResolution: { type: String },
    resolvedAt: { type: Date },

    // 生命周期
    lastReviewedAt: { type: Date },
    lastReviewedEpisode: { type: Number },
    reviewCount: { type: Number, default: 0 },

    // 元数据
    sourceType: {
      type: String,
      enum: ['manual', 'ai_detected', 'cliffhanger', 'merged'],
      default: 'ai_detected'
    },
    relatedCharacters: [{ type: String }],
    relatedPlotlines: [{ type: String }],
  },
  {
    timestamps: true,
  }
);

// 索引优化
ForeshadowingSchema.index({ projectId: 1, status: 1 });
ForeshadowingSchema.index({ projectId: 1, validity: 1 });
ForeshadowingSchema.index({ projectId: 1, clusterGroup: 1 });
ForeshadowingSchema.index({ projectId: 1, urgencyScore: -1 });

export const Foreshadowing = mongoose.model<IForeshadowing>('Foreshadowing', ForeshadowingSchema);
