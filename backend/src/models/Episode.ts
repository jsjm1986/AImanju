import mongoose, { Schema, Document } from 'mongoose';

export interface IEpisode extends Document {
  projectId: mongoose.Types.ObjectId;
  episodeNumber: number;
  title?: string;
  content: string;
  summary?: string;
  wordCount: number;  // V1 算法（保留兼容）
  wordCountV2?: number;  // V2 算法（新增）
  wordCountAlgorithm?: 'v1' | 'v2';  // 使用的算法版本
  status: 'pending' | 'generating' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

const EpisodeSchema = new Schema<IEpisode>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    episodeNumber: { type: Number, required: true },
    title: { type: String },
    content: { type: String, default: '' },
    summary: { type: String },
    wordCount: { type: Number, default: 0 },  // V1 算法（兼容）
    wordCountV2: { type: Number },  // V2 算法
    wordCountAlgorithm: {
      type: String,
      enum: ['v1', 'v2'],
      default: 'v1'  // 默认 v1，避免影响现有数据
    },
    status: {
      type: String,
      enum: ['pending', 'generating', 'completed', 'failed'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

// 复合索引：项目ID + 集数
EpisodeSchema.index({ projectId: 1, episodeNumber: 1 }, { unique: true });

export const Episode = mongoose.model<IEpisode>('Episode', EpisodeSchema);
