import mongoose, { Schema, Document } from 'mongoose';

// ========== 角色状态类型 ==========
export type CharacterTier = 'core' | 'recurring' | 'arc' | 'temporary' | 'extra';
export type CharacterStatus = 'active' | 'archived' | 'deceased' | 'departed';

// ========== 形态变化记录 ==========
export interface IFormChangeRecord {
  episode: number;                 // 变化发生的集数
  from: string;                    // 原形态
  to: string;                      // 新形态
  trigger: string;                 // 触发原因（AI 填写）
}

export interface ICharacterState {
  characterId: mongoose.Types.ObjectId;
  name: string;
  role: string;                    // 角色定位（男主/女主/反派）

  // 生命周期管理
  tier: CharacterTier;
  status: CharacterStatus;
  belongsToArc?: string;           // 所属剧情弧（用于剧情角色）
  arcStartEpisode?: number;
  arcEndEpisode?: number;

  // 装备与能力
  currentEquipment: string[];      // 当前持有装备
  currentAbilities: string[];      // 已展示能力

  // 身体状态
  physicalCondition: string;       // 身体状态（正常/轻伤/重伤/残疾）
  mentalCondition: string;         // 精神状态（正常/愤怒/悲伤/迷茫）
  combatPower: string;             // 战力评估（100%/70%/受限）

  // 形态追踪
  currentForm: string;             // 当前形态，默认 "基础形态"
  baseForm: string;                // 基础/默认形态（用于恢复）
  unlockedForms: string[];         // 已解锁的可用形态
  formHistory: IFormChangeRecord[]; // 形态变化历史记录

  // 永久性变化
  permanentMarks: string[];        // 永久标记（伤疤/觉醒/特殊体质）
  identityChanges: string[];       // 身份变化历史

  // 位置与关系
  currentLocation: string;         // 当前位置
  relationships: Map<string, string>; // 与其他角色关系

  // 出场信息（用于自动升降级）
  firstAppearance: number;         // 首次出场集数
  lastAppearance: number;          // 最后出场集数
  appearanceCount: number;         // 总出场次数
  consecutiveAppearances: number;  // 连续出场次数

  // 重要性评分（用于注意力权重）
  importanceScore: number;         // 0-100
}

// ========== 伏笔类型 ==========
export type ForeshadowingType = 'plot' | 'character' | 'item' | 'suspense';
export type ForeshadowingImportance = 'high' | 'normal' | 'low';

export interface IPlantedForeshadowing {
  id: string;
  content: string;
  episodePlanted: number;
  type: ForeshadowingType;
  importance: ForeshadowingImportance;
  expectedResolution?: string;     // 预期回收方式
}

export interface IResolvedForeshadowing {
  content: string;
  episodeResolved: number;
  resolutionNote: string;
}

// ========== 剧情状态类型 ==========
export interface IRecentEvent {
  episode: number;
  event: string;
}

export interface ICliffhanger {
  episode: number;
  content: string;
  resolved: boolean;
}

export interface IPlotState {
  currentArc: string;                // 当前剧情弧（如"酒馆开张篇"）
  arcProgress: number;               // 弧线进度（0-100%）
  mainPlotProgress: string;          // 主线进度描述

  recentEvents: IRecentEvent[];      // 最近5集关键事件

  pendingConflicts: string[];        // 待解决冲突
  resolvedConflicts: string[];       // 已解决冲突（最近5个）

  cliffhangers: ICliffhanger[];      // 悬念/钩子
}

// ========== 世界设定类型 ==========
export interface IFaction {
  status: string;                // 势力状态
  attitude: string;              // 对主角态度
  keyMembers: string[];          // 关键成员
}

export interface ILocation {
  description: string;
  firstAppearance: number;
  significance: string;          // 重要性说明
}

export interface IWorldItem {
  description: string;
  owner: string;                 // 当前持有者
  status: string;                // 状态（完整/损坏/丢失）
}

export interface IWorldSettings {
  revealedSecrets: string[];         // 已揭露的秘密
  hiddenSecrets: string[];           // 待揭露的秘密（可选，用于规划）

  factions: Map<string, IFaction>;   // 势力格局
  locations: Map<string, ILocation>; // 已出现地点
  items: Map<string, IWorldItem>;    // 重要道具
}

// ========== 生成约束类型 ==========
export interface IConstraints {
  mustInclude: string[];             // 本集必须包含的元素
  mustAvoid: string[];               // 必须避免的内容
  styleNotes: string[];              // 风格注意事项
}

// ========== WorldState 主类型 ==========
export interface IWorldState extends Document {
  projectId: mongoose.Types.ObjectId;
  episodeNumber: number;       // 截至哪一集

  // 角色状态
  characters: Map<string, ICharacterState>;

  // 伏笔状态
  foreshadowings: {
    planted: IPlantedForeshadowing[];
    recentlyResolved: IResolvedForeshadowing[];
  };

  // 剧情状态
  plotState: IPlotState;

  // 世界设定
  worldSettings: IWorldSettings;

  // 生成约束
  constraints: IConstraints;

  createdAt: Date;
  updatedAt: Date;
}

// ========== Schema 定义 ==========
// 形态变化记录 Schema
const FormChangeRecordSchema = new Schema(
  {
    episode: { type: Number, required: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    trigger: { type: String, default: '' },
  },
  { _id: false }
);

const CharacterStateSchema = new Schema<ICharacterState>(
  {
    characterId: { type: Schema.Types.ObjectId, ref: 'Character' },
    name: { type: String, required: true },
    role: { type: String, default: '未知' },

    // 生命周期
    tier: {
      type: String,
      enum: ['core', 'recurring', 'arc', 'temporary', 'extra'],
      default: 'temporary'
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'deceased', 'departed'],
      default: 'active'
    },
    belongsToArc: { type: String },
    arcStartEpisode: { type: Number },
    arcEndEpisode: { type: Number },

    // 装备与能力
    currentEquipment: [{ type: String }],
    currentAbilities: [{ type: String }],

    // 状态
    physicalCondition: { type: String, default: '正常' },
    mentalCondition: { type: String, default: '正常' },
    combatPower: { type: String, default: '100%' },

    // 形态追踪
    currentForm: { type: String, default: '基础形态' },
    baseForm: { type: String, default: '基础形态' },
    unlockedForms: [{ type: String }],
    formHistory: [FormChangeRecordSchema],

    // 永久性变化
    permanentMarks: [{ type: String }],
    identityChanges: [{ type: String }],

    // 位置与关系
    currentLocation: { type: String, default: '' },
    relationships: { type: Map, of: String },

    // 出场信息
    firstAppearance: { type: Number, default: 0 },
    lastAppearance: { type: Number, default: 0 },
    appearanceCount: { type: Number, default: 0 },
    consecutiveAppearances: { type: Number, default: 0 },

    // 重要性
    importanceScore: { type: Number, default: 50 },
  },
  { _id: false }
);

const PlantedForeshadowingSchema = new Schema(
  {
    id: { type: String, required: true },
    content: { type: String, required: true },
    episodePlanted: { type: Number, required: true },
    type: {
      type: String,
      enum: ['plot', 'character', 'item', 'suspense'],
      default: 'plot'
    },
    importance: {
      type: String,
      enum: ['high', 'normal', 'low'],
      default: 'normal'
    },
    expectedResolution: { type: String },
  },
  { _id: false }
);

const ResolvedForeshadowingSchema = new Schema(
  {
    content: { type: String, required: true },
    episodeResolved: { type: Number, required: true },
    resolutionNote: { type: String, default: '' },
  },
  { _id: false }
);

const PlotStateSchema = new Schema(
  {
    currentArc: { type: String, default: '' },
    arcProgress: { type: Number, default: 0 },
    mainPlotProgress: { type: String, default: '' },
    recentEvents: [{
      episode: { type: Number },
      event: { type: String },
    }],
    pendingConflicts: [{ type: String }],
    resolvedConflicts: [{ type: String }],
    cliffhangers: [{
      episode: { type: Number },
      content: { type: String },
      resolved: { type: Boolean, default: false },
    }],
  },
  { _id: false }
);

const WorldSettingsSchema = new Schema(
  {
    revealedSecrets: [{ type: String }],
    hiddenSecrets: [{ type: String }],
    factions: {
      type: Map,
      of: {
        status: { type: String },
        attitude: { type: String },
        keyMembers: [{ type: String }],
      }
    },
    locations: {
      type: Map,
      of: {
        description: { type: String },
        firstAppearance: { type: Number },
        significance: { type: String },
      }
    },
    items: {
      type: Map,
      of: {
        description: { type: String },
        owner: { type: String },
        status: { type: String },
      }
    },
  },
  { _id: false }
);

const ConstraintsSchema = new Schema(
  {
    mustInclude: [{ type: String }],
    mustAvoid: [{ type: String }],
    styleNotes: [{ type: String }],
  },
  { _id: false }
);

const WorldStateSchema = new Schema<IWorldState>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true
    },
    episodeNumber: { type: Number, required: true },

    characters: { type: Map, of: CharacterStateSchema },

    foreshadowings: {
      planted: [PlantedForeshadowingSchema],
      recentlyResolved: [ResolvedForeshadowingSchema],
    },

    plotState: { type: PlotStateSchema, default: () => ({}) },

    worldSettings: { type: WorldSettingsSchema, default: () => ({}) },

    constraints: { type: ConstraintsSchema, default: () => ({}) },
  },
  {
    timestamps: true,
  }
);

// 索引：快速查找项目的最新状态
WorldStateSchema.index({ projectId: 1, episodeNumber: -1 });

// 复合唯一索引：确保每集只有一个状态快照
WorldStateSchema.index({ projectId: 1, episodeNumber: 1 }, { unique: true });

export const WorldState = mongoose.model<IWorldState>('WorldState', WorldStateSchema);
