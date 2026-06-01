import mongoose, { Document, Schema } from 'mongoose';

/**
 * 角色关系数据模型
 * 追踪角色之间的关系状态、历史和关键事件
 * 
 * Requirements: 9.1
 */

// ============ 类型定义 ============

/**
 * 关系等级
 * stranger → acquaintance → familiar → close → intimate (正向)
 * stranger → hostile → enemy (负向)
 */
export type RelationshipLevel = 
  | 'stranger' 
  | 'acquaintance' 
  | 'familiar' 
  | 'close' 
  | 'intimate' 
  | 'hostile' 
  | 'enemy';

/**
 * 关系事件类型
 */
export type RelationshipEventType = 
  | 'first_meeting' 
  | 'bonding' 
  | 'conflict' 
  | 'betrayal' 
  | 'reconciliation' 
  | 'deepening';

/**
 * 事件影响类型
 */
export type RelationshipImpact = 'positive' | 'negative' | 'neutral';

// ============ 子文档接口 ============

/**
 * 关系历史记录
 */
export interface IRelationshipHistory {
  episode: number;
  fromLevel: RelationshipLevel;
  toLevel: RelationshipLevel;
  event: string;
  timestamp: Date;
}

/**
 * 关键事件
 */
export interface IRelationshipKeyEvent {
  episode: number;
  type: RelationshipEventType;
  description: string;
  impact: RelationshipImpact;
}

// ============ 主文档接口 ============

export interface ICharacterRelationship extends Document {
  projectId: mongoose.Types.ObjectId;
  characterAId: mongoose.Types.ObjectId;
  characterBId: mongoose.Types.ObjectId;
  characterAName: string;
  characterBName: string;
  
  currentLevel: RelationshipLevel;
  sentiment: number;  // -1 到 1，负数敌对，正数友好
  
  history: IRelationshipHistory[];
  keyEvents: IRelationshipKeyEvent[];
  
  lastInteractionEpisode: number;
  
  createdAt: Date;
  updatedAt: Date;
}

// ============ Schema 定义 ============

const RelationshipHistorySchema = new Schema<IRelationshipHistory>(
  {
    episode: { type: Number, required: true },
    fromLevel: { 
      type: String, 
      enum: ['stranger', 'acquaintance', 'familiar', 'close', 'intimate', 'hostile', 'enemy'], 
      required: true 
    },
    toLevel: { 
      type: String, 
      enum: ['stranger', 'acquaintance', 'familiar', 'close', 'intimate', 'hostile', 'enemy'], 
      required: true 
    },
    event: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const RelationshipKeyEventSchema = new Schema<IRelationshipKeyEvent>(
  {
    episode: { type: Number, required: true },
    type: { 
      type: String, 
      enum: ['first_meeting', 'bonding', 'conflict', 'betrayal', 'reconciliation', 'deepening'], 
      required: true 
    },
    description: { type: String, required: true },
    impact: { 
      type: String, 
      enum: ['positive', 'negative', 'neutral'], 
      required: true 
    },
  },
  { _id: false }
);

const CharacterRelationshipSchema = new Schema<ICharacterRelationship>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    characterAId: { type: Schema.Types.ObjectId, ref: 'Character', required: true },
    characterBId: { type: Schema.Types.ObjectId, ref: 'Character', required: true },
    characterAName: { type: String, required: true },
    characterBName: { type: String, required: true },
    
    currentLevel: { 
      type: String, 
      enum: ['stranger', 'acquaintance', 'familiar', 'close', 'intimate', 'hostile', 'enemy'], 
      default: 'stranger' 
    },
    sentiment: { type: Number, default: 0, min: -1, max: 1 },
    
    history: [RelationshipHistorySchema],
    keyEvents: [RelationshipKeyEventSchema],
    
    lastInteractionEpisode: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

// 复合索引：项目ID + 角色A + 角色B（唯一）
CharacterRelationshipSchema.index(
  { projectId: 1, characterAId: 1, characterBId: 1 }, 
  { unique: true }
);

// 复合索引：项目ID + 角色名（用于查询）
CharacterRelationshipSchema.index({ projectId: 1, characterAName: 1, characterBName: 1 });

// 索引：用于查找停滞关系
CharacterRelationshipSchema.index({ projectId: 1, lastInteractionEpisode: 1 });

export const CharacterRelationship = mongoose.model<ICharacterRelationship>(
  'CharacterRelationship', 
  CharacterRelationshipSchema
);
