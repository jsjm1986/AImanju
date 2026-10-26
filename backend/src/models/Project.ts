import mongoose, { Document, Schema } from 'mongoose';
import type { StoryMode, PacingStyle } from '../services/outline/outlinePrompts';
import type { IOutputFormatConfig } from '../types/OutputFormat';

// 大纲结构
export interface IOutline {
  raw: string;
  characterCards: string;
  synopsis: string;
  episodeSummaries: string;
  // v2 增强字段
  storyCore?: string;           // 故事内核
  characterFunctions?: string;  // 角色功能矩阵
  generationConfig?: {
    storyMode?: StoryMode;
    pacing?: PacingStyle;
    previousSeasonId?: string;
  };
}

// 大纲生成草稿（断点续传检查点）
// 与已完成的 outline 分离：重新生成/失败绝不破坏已有成功大纲
export interface IOutlineDraftEpisodeBatch {
  startEpisode: number;
  endEpisode: number;
  content: string;
}

export interface IOutlineDraft {
  generationId: string;          // 本次生成唯一ID（防止旧运行的晚到写覆盖新运行）
  inputKey: string;              // 规范输入 + 模型的 sha256（resume 一致性校验）
  mode: 'standard' | 'enhanced';
  modelName: string;             // 注册模型键
  model: string;                 // 实际上游模型名
  status: 'running' | 'interrupted' | 'failed' | 'completed';
  completedSteps: number[];      // 已完成步骤（1-based）
  result: {
    raw: string;
    characterCards: string;
    synopsis: string;
    episodeSummaries: string;
    storyCore?: string;
    characterFunctions?: string;
  };
  episodeBatches: IOutlineDraftEpisodeBatch[]; // 已完成的分集梗概批次
  error?: string;
  updatedAt: string;             // ISO 时间戳
  // 重试所需输入快照（不改已有成功 outline）
  concept?: string;
  requirements?: string;
  generationConfig?: {
    storyMode?: StoryMode;
    pacing?: PacingStyle;
    previousSeasonId?: string;
  };
}

// 注意力头配置
export interface IAttentionHeadConfig {
  mode: 'auto' | 'custom';           // auto=根据类型自动选择, custom=用户自定义
  enabledHeads?: string[];           // 启用的注意力头列表（自定义模式）
  headWeights?: Record<string, number>; // 自定义权重
  // AI 推荐相关
  aiRecommendedHeads?: string[];     // AI 推荐的注意力头
  aiRecommendationReasons?: Array<{  // AI 推荐理由
    head: string;
    reason: string;
  }>;
  aiIdentifiedElements?: string[];   // AI 识别出的题材元素
  aiAnalyzedAt?: Date;               // AI 分析时间
}

// 写作风格配置
export type WritingStylePreset =
  | 'literary'      // 文艺风：优美细腻，注重意境
  | 'colloquial'    // 口语化：通俗易懂，贴近生活
  | 'humorous'      // 幽默风：诙谐有趣，轻松愉快
  | 'serious'       // 严肃风：正经庄重，深沉厚重
  | 'poetic'        // 诗意风：富有诗意，意境深远
  | 'dramatic'      // 戏剧化：冲突强烈，情感饱满
  | 'minimalist'    // 极简风：简洁明快，留白多
  | 'descriptive'   // 描写细腻：细节丰富，画面感强
  | 'custom';       // 自定义风格

export interface IWritingStyle {
  preset: WritingStylePreset;        // 预设风格类型
  customDescription?: string;        // 自定义风格描述（preset为custom时必填）
  // 风格细节参数（可选，用于微调）
  dialogueStyle?: 'formal' | 'casual' | 'mixed';  // 对白风格
  narrativeVoice?: 'third-person' | 'first-person' | 'omniscient';  // 叙事视角
  emotionalTone?: 'warm' | 'cold' | 'neutral' | 'intense';  // 情感基调
}

// 节奏控制参数
export interface IRhythmParams {
  faceSlappingFrequency: number;   // 打脸频率：1-20集/次
  coolPointDensity: number;        // 爽点密度：1-5个/集
  powerUpSpeed: 'slow' | 'medium' | 'fast' | 'godlike';
  equipmentDropRate: 'rare' | 'normal' | 'frequent';
  plotTwistFrequency: number;      // 反转频率：5-30集/次
  suspenseIntensity: 'weak' | 'medium' | 'strong' | 'extreme';
  romanceSpeed: 'none' | 'slow' | 'normal' | 'fast' | 'instant';
  heartacheLevel: 'none' | 'light' | 'medium' | 'heavy' | 'be';
  villainIQ: 'fodder' | 'normal' | 'smart' | 'genius';
  pressureCurve: 'easy' | 'normal' | 'hard' | 'extreme';
  bossInterval: number;            // Boss间隔：10-50集/次
}

// 节奏追踪状态（持久化存储）
export interface IRhythmTracking {
  lastFaceSlap: number;      // 上次打脸发生在第几集
  lastPlotTwist: number;     // 上次反转发生在第几集
  lastBoss: number;          // 上次Boss战发生在第几集
}

export interface IProject extends Document {
  name: string;
  genre: string;
  type: string;
  totalEpisodes: number;
  status: 'draft' | 'outline_done' | 'generating' | 'completed';
  outline?: IOutline | string;  // 支持对象或字符串格式
  outlineDraft?: IOutlineDraft; // 大纲生成草稿（断点续传检查点）
  concept?: string;             // 故事概念（生成大纲时的输入）
  requirements?: string;        // 特殊要求（生成大纲时的输入）
  tags: mongoose.Types.ObjectId[];
  creatorId?: mongoose.Types.ObjectId;  // 关联创作者（多用户支持）
  rhythmPreset?: string;        // 节奏预设类型
  rhythmParams?: IRhythmParams; // 节奏控制参数
  rhythmTracking?: IRhythmTracking; // 节奏追踪状态
  attentionHeadConfig?: IAttentionHeadConfig; // 注意力头配置
  writingStyle?: IWritingStyle; // 写作风格配置
  outputFormat?: IOutputFormatConfig; // 输出格式配置
  // v2 续集关联
  previousSeasonId?: mongoose.Types.ObjectId;  // 关联前作项目
  seasonNumber?: number;                       // 第几季 (1, 2, 3...)
  seriesName?: string;                         // 系列名（如"逆袭人生"系列）
  storyMode?: StoryMode;                       // 故事模式
  pacing?: PacingStyle;                        // 节奏风格
  createdAt: Date;
  updatedAt: Date;
}

const OutlineSchema = new Schema<IOutline>(
  {
    raw: { type: String },
    characterCards: { type: String },
    synopsis: { type: String },
    episodeSummaries: { type: String },
  },
  { _id: false }
);

const ProjectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true },
    genre: { type: String, required: true },
    type: { type: String, required: true },
    totalEpisodes: { type: Number, required: true, default: 100 },
    status: {
      type: String,
      enum: ['draft', 'outline_done', 'generating', 'completed'],
      default: 'draft',
    },
    outline: { type: Schema.Types.Mixed },  // 使用Mixed类型支持对象或字符串
    outlineDraft: { type: Schema.Types.Mixed },  // 大纲生成草稿（断点续传检查点）
    concept: { type: String },              // 故事概念
    requirements: { type: String },         // 特殊要求
    tags: [{ type: Schema.Types.ObjectId, ref: 'CreatorTag' }],
    creatorId: { type: Schema.Types.ObjectId, ref: 'Creator', index: true },  // 关联创作者
    rhythmPreset: { type: String, default: 'hot-blood' },  // 默认热血对决
    rhythmParams: { type: Schema.Types.Mixed },            // 节奏控制参数
    rhythmTracking: {                                      // 节奏追踪状态
      type: Schema.Types.Mixed,
      default: { lastFaceSlap: 0, lastPlotTwist: 0, lastBoss: 0 }
    },
    attentionHeadConfig: { type: Schema.Types.Mixed, default: { mode: 'auto' } }, // 注意力头配置
    writingStyle: { type: Schema.Types.Mixed, default: { preset: 'colloquial' } }, // 写作风格配置，默认口语化
    outputFormat: { type: Schema.Types.Mixed, default: { mode: 'preset', preset: 'standard' } }, // 输出格式配置
    // v2 续集关联
    previousSeasonId: { type: Schema.Types.ObjectId, ref: 'Project' },  // 关联前作
    seasonNumber: { type: Number, min: 1 },
    seriesName: { type: String },
    storyMode: { type: String, enum: ['complete', 'open_ended', 'sequel'], default: 'complete' },
    pacing: { type: String, enum: ['fast', 'standard', 'slow'], default: 'standard' },
  },
  {
    timestamps: true,
  }
);

export const Project = mongoose.model<IProject>('Project', ProjectSchema);
