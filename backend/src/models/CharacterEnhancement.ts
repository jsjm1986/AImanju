import mongoose, { Document, Schema } from 'mongoose';

/**
 * 角色增强数据模型
 * 包含魅力特征、成长弧线、语言风格三大模块
 * 
 * Requirements: 7.1, 8.1, 10.1
 */

// ============ 类型定义 ============

/**
 * 成长阶段类型
 */
export type GrowthStage = 'initial' | 'challenged' | 'growing' | 'transformed';

/**
 * 语言正式程度
 */
export type FormalLevel = 'very_formal' | 'formal' | 'neutral' | 'casual' | 'very_casual';

/**
 * 词汇风格
 */
export type VocabularyStyle = 'literary' | 'technical' | 'colloquial' | 'archaic' | 'modern';

/**
 * 句式模式
 */
export type SentencePattern = 'long_complex' | 'medium' | 'short_punchy' | 'mixed';

/**
 * 高光时刻类型
 */
export type ImpressiveMomentType = 'combat' | 'wisdom' | 'emotional' | 'humor';

/**
 * 成长事件类型
 */
export type GrowthEventType = 'skill' | 'mindset' | 'relationship' | 'identity';

// ============ 子文档接口 ============

/**
 * 高光时刻
 */
export interface IImpressiveMoment {
  episode: number;
  description: string;
  type: ImpressiveMomentType;
}

/**
 * 成长阶段历史
 */
export interface IStageHistory {
  stage: GrowthStage;
  startEpisode: number;
  endEpisode?: number;
  trigger?: string;
}

/**
 * 转折点
 */
export interface ITurningPoint {
  episode: number;
  event: string;
  impact: string;
  beforeState: string;
  afterState: string;
}

/**
 * 成长事件
 */
export interface IGrowthEvent {
  episode: number;
  type: GrowthEventType;
  description: string;
}

/**
 * 里程碑
 */
export interface IMilestone {
  episode: number;
  milestone: string;
  achieved: boolean;
}

/**
 * 语言风格演变
 */
export interface IVoiceEvolution {
  stage: GrowthStage;
  formalLevel: FormalLevel;
  vocabularyStyle: VocabularyStyle;
  description: string;
}

/**
 * 情绪调整规则
 */
export interface IEmotionalAdjustment {
  emotion: string;
  adjustments: {
    formalLevel?: FormalLevel;
    sentencePattern?: SentencePattern;
  };
}

// ============ 主文档子结构 ============

/**
 * 魅力特征 (Requirements 7.1)
 */
export interface ICharacterCharm {
  catchphrases: string[];           // 口头禅
  quirks: string[];                 // 小癖好
  signatureMoves: string[];         // 标志性动作
  impressiveMoments: IImpressiveMoment[];  // 高光时刻
}

/**
 * 成长弧线 (Requirements 8.1)
 */
export interface ICharacterArc {
  currentStage: GrowthStage;
  stageHistory: IStageHistory[];
  turningPoints: ITurningPoint[];
  growthEvents: IGrowthEvent[];
  milestones: IMilestone[];
  lastGrowthEpisode: number;
}

/**
 * 语言风格 (Requirements 10.1)
 */
export interface ICharacterVoice {
  formalLevel: FormalLevel;
  vocabularyStyle: VocabularyStyle;
  sentencePattern: SentencePattern;
  preferredWords: string[];         // 常用词汇
  avoidedWords: string[];           // 禁用词汇
  voiceEvolution: IVoiceEvolution[];
  emotionalAdjustments: IEmotionalAdjustment[];
}

// ============ 主文档接口 ============

export interface ICharacterEnhancement extends Document {
  projectId: mongoose.Types.ObjectId;
  characterId: mongoose.Types.ObjectId;
  characterName: string;
  
  charm: ICharacterCharm;
  arc: ICharacterArc;
  voice: ICharacterVoice;
  
  createdAt: Date;
  updatedAt: Date;
}

// ============ Schema 定义 ============

const ImpressiveMomentSchema = new Schema<IImpressiveMoment>(
  {
    episode: { type: Number, required: true },
    description: { type: String, required: true },
    type: { type: String, enum: ['combat', 'wisdom', 'emotional', 'humor'], required: true },
  },
  { _id: false }
);

const StageHistorySchema = new Schema<IStageHistory>(
  {
    stage: { type: String, enum: ['initial', 'challenged', 'growing', 'transformed'], required: true },
    startEpisode: { type: Number, required: true },
    endEpisode: { type: Number },
    trigger: { type: String },
  },
  { _id: false }
);

const TurningPointSchema = new Schema<ITurningPoint>(
  {
    episode: { type: Number, required: true },
    event: { type: String, required: true },
    impact: { type: String, required: true },
    beforeState: { type: String, required: true },
    afterState: { type: String, required: true },
  },
  { _id: false }
);

const GrowthEventSchema = new Schema<IGrowthEvent>(
  {
    episode: { type: Number, required: true },
    type: { type: String, enum: ['skill', 'mindset', 'relationship', 'identity'], required: true },
    description: { type: String, required: true },
  },
  { _id: false }
);

const MilestoneSchema = new Schema<IMilestone>(
  {
    episode: { type: Number, required: true },
    milestone: { type: String, required: true },
    achieved: { type: Boolean, default: false },
  },
  { _id: false }
);

const VoiceEvolutionSchema = new Schema<IVoiceEvolution>(
  {
    stage: { type: String, enum: ['initial', 'challenged', 'growing', 'transformed'], required: true },
    formalLevel: { type: String, enum: ['very_formal', 'formal', 'neutral', 'casual', 'very_casual'], required: true },
    vocabularyStyle: { type: String, enum: ['literary', 'technical', 'colloquial', 'archaic', 'modern'], required: true },
    description: { type: String, required: true },
  },
  { _id: false }
);

const EmotionalAdjustmentSchema = new Schema<IEmotionalAdjustment>(
  {
    emotion: { type: String, required: true },
    adjustments: {
      formalLevel: { type: String, enum: ['very_formal', 'formal', 'neutral', 'casual', 'very_casual'] },
      sentencePattern: { type: String, enum: ['long_complex', 'medium', 'short_punchy', 'mixed'] },
    },
  },
  { _id: false }
);

const CharmSchema = new Schema<ICharacterCharm>(
  {
    catchphrases: [{ type: String }],
    quirks: [{ type: String }],
    signatureMoves: [{ type: String }],
    impressiveMoments: [ImpressiveMomentSchema],
  },
  { _id: false }
);

const ArcSchema = new Schema<ICharacterArc>(
  {
    currentStage: { type: String, enum: ['initial', 'challenged', 'growing', 'transformed'], default: 'initial' },
    stageHistory: [StageHistorySchema],
    turningPoints: [TurningPointSchema],
    growthEvents: [GrowthEventSchema],
    milestones: [MilestoneSchema],
    lastGrowthEpisode: { type: Number, default: 0 },
  },
  { _id: false }
);

const VoiceSchema = new Schema<ICharacterVoice>(
  {
    formalLevel: { type: String, enum: ['very_formal', 'formal', 'neutral', 'casual', 'very_casual'], default: 'neutral' },
    vocabularyStyle: { type: String, enum: ['literary', 'technical', 'colloquial', 'archaic', 'modern'], default: 'colloquial' },
    sentencePattern: { type: String, enum: ['long_complex', 'medium', 'short_punchy', 'mixed'], default: 'medium' },
    preferredWords: [{ type: String }],
    avoidedWords: [{ type: String }],
    voiceEvolution: [VoiceEvolutionSchema],
    emotionalAdjustments: [EmotionalAdjustmentSchema],
  },
  { _id: false }
);

const CharacterEnhancementSchema = new Schema<ICharacterEnhancement>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    characterId: { type: Schema.Types.ObjectId, ref: 'Character', required: true, index: true },
    characterName: { type: String, required: true },
    
    charm: { type: CharmSchema, default: () => ({
      catchphrases: [],
      quirks: [],
      signatureMoves: [],
      impressiveMoments: [],
    }) },
    
    arc: { type: ArcSchema, default: () => ({
      currentStage: 'initial',
      stageHistory: [],
      turningPoints: [],
      growthEvents: [],
      milestones: [],
      lastGrowthEpisode: 0,
    }) },
    
    voice: { type: VoiceSchema, default: () => ({
      formalLevel: 'neutral',
      vocabularyStyle: 'colloquial',
      sentencePattern: 'medium',
      preferredWords: [],
      avoidedWords: [],
      voiceEvolution: [],
      emotionalAdjustments: [],
    }) },
  },
  {
    timestamps: true,
  }
);

// 复合索引：项目ID + 角色ID（唯一）
CharacterEnhancementSchema.index({ projectId: 1, characterId: 1 }, { unique: true });

// 复合索引：项目ID + 角色名
CharacterEnhancementSchema.index({ projectId: 1, characterName: 1 });

export const CharacterEnhancement = mongoose.model<ICharacterEnhancement>('CharacterEnhancement', CharacterEnhancementSchema);
