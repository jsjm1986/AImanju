/**
 * WorldState 相关类型定义
 * 用于前端可视化展示世界状态、注意力系统、节奏控制等
 */

// ===== 角色层级 =====
export type CharacterTier = 'core' | 'recurring' | 'arc' | 'temporary' | 'extra';
export type CharacterStatus = 'active' | 'archived' | 'deceased' | 'departed';

// 层级显示名称
export const CharacterTierLabels: Record<CharacterTier, string> = {
  core: '核心角色',
  recurring: '常驻配角',
  arc: '剧情角色',
  temporary: '临时角色',
  extra: '龙套角色',
};

// 层级颜色
export const CharacterTierColors: Record<CharacterTier, string> = {
  core: '#ef4444',      // red-500
  recurring: '#f97316', // orange-500
  arc: '#eab308',       // yellow-500
  temporary: '#22c55e', // green-500
  extra: '#6b7280',     // gray-500
};

// ===== 形态变化记录 =====
export interface IFormChangeRecord {
  episode: number;
  from: string;
  to: string;
  trigger: string;
}

// ===== 角色状态 =====
export interface ICharacterState {
  characterId: string;
  name: string;
  role: string;
  tier: CharacterTier;
  status: CharacterStatus;
  belongsToArc?: string;
  arcStartEpisode?: number;
  arcEndEpisode?: number;
  currentEquipment: string[];
  currentAbilities: string[];
  physicalCondition: string;
  mentalCondition: string;
  combatPower: string;
  // 形态追踪
  currentForm?: string;
  baseForm?: string;
  unlockedForms?: string[];
  formHistory?: IFormChangeRecord[];
  permanentMarks: string[];
  identityChanges: string[];
  currentLocation: string;
  relationships: Record<string, string>;
  firstAppearance: number;
  lastAppearance: number;
  appearanceCount: number;
  consecutiveAppearances: number;
  importanceScore: number;
}

// ===== 伏笔类型 =====
export interface IPlantedForeshadowing {
  id: string;
  content: string;
  episodePlanted: number;
  type: string;
  importance: string;
  expectedResolution?: string;
}

export interface IResolvedForeshadowing {
  content: string;
  episodeResolved: number;
  resolutionNote: string;
}

// 伏笔状态颜色
export function getForeshadowingColor(episodePlanted: number, currentEpisode: number): string {
  const age = currentEpisode - episodePlanted;
  if (age > 10) return '#ef4444';  // red - 超期
  if (age > 7) return '#f97316';   // orange - 临近
  if (age > 5) return '#eab308';   // yellow - 警告
  return '#22c55e';                 // green - 正常
}

// ===== 剧情状态 =====
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
  currentArc: string;
  arcProgress: number;
  mainPlotProgress: string;
  recentEvents: IRecentEvent[];
  pendingConflicts: string[];
  resolvedConflicts: string[];
  cliffhangers: ICliffhanger[];
}

// ===== 世界设定 =====
export interface IFaction {
  status: string;
  attitude: string;
  keyMembers: string[];
}

export interface ILocation {
  description: string;
  firstAppearance: number;
  significance?: string;
}

export interface IWorldItem {
  description: string;
  owner: string;
  status: string;
}

export interface IWorldSettings {
  revealedSecrets: string[];
  hiddenSecrets: string[];
  factions: Record<string, IFaction>;
  locations: Record<string, ILocation>;
  items: Record<string, IWorldItem>;
}

// ===== 生成约束 =====
export interface IConstraints {
  mustInclude: string[];
  mustAvoid: string[];
  styleNotes: string[];
}

// ===== WorldState 完整结构 =====
export interface IWorldState {
  _id: string;
  projectId: string;
  episodeNumber: number;
  characters: Record<string, ICharacterState>;
  foreshadowings: {
    planted: IPlantedForeshadowing[];
    recentlyResolved: IResolvedForeshadowing[];
  };
  plotState: IPlotState;
  worldSettings: IWorldSettings;
  constraints: IConstraints;
  createdAt: string;
  updatedAt: string;
}

// ===== 注意力系统 =====
export type AttentionHeadCategory = 'base' | 'mystery' | 'horror' | 'mind' | 'game' | 'cool' | 'style';

export interface IAttentionHead {
  type: string;
  weight: number;
  category?: AttentionHeadCategory;
  name?: string;
  description?: string;
}

// 注意力头类别显示
export const AttentionHeadCategoryLabels: Record<AttentionHeadCategory, string> = {
  base: '基础头',
  mystery: '悬疑模块',
  horror: '恐怖模块',
  mind: '智斗模块',
  game: '游戏模块',
  cool: '爽文模块',
  style: '风格头',
};

// 注意力头类别颜色
export const AttentionHeadCategoryColors: Record<AttentionHeadCategory, string> = {
  base: '#6366f1',     // indigo
  mystery: '#8b5cf6',  // violet
  horror: '#dc2626',   // red
  mind: '#0891b2',     // cyan
  game: '#16a34a',     // green
  cool: '#ea580c',     // orange
  style: '#64748b',    // slate
};

// ===== 题材类型 =====
export type GenreType =
  | 'xuanhuan'  // 玄幻/仙侠
  | 'dushi'     // 都市/重生
  | 'xuanyi'    // 悬疑/侦探
  | 'kongbu'    // 恐怖/惊悚
  | 'zhidou'    // 智斗/谋略
  | 'xitong'    // 游戏/系统流
  | 'yanqing'   // 言情/甜宠
  | 'xiju'      // 喜剧/搞笑
  | 'custom';   // 自定义

export const GenreTypeLabels: Record<GenreType, string> = {
  xuanhuan: '玄幻/仙侠',
  dushi: '都市/重生',
  xuanyi: '悬疑/侦探',
  kongbu: '恐怖/惊悚',
  zhidou: '智斗/谋略',
  xitong: '游戏/系统流',
  yanqing: '言情/甜宠',
  xiju: '喜剧/搞笑',
  custom: '自定义',
};

// ===== 集类型 =====
export type EpisodeType = 'battle' | 'romance' | 'reveal' | 'daily' | 'climax';

export const EpisodeTypeLabels: Record<EpisodeType, string> = {
  battle: '战斗集',
  romance: '感情集',
  reveal: '揭秘集',
  daily: '日常集',
  climax: '高潮集',
};

// ===== 跨维度洞察 =====
export interface ICrossDimensionInsight {
  element: string;
  relatedHeads: string[];
  insight: string;
  importance: 'high' | 'medium' | 'low';
}

// ===== 节奏预设 =====
export type RhythmPresetType =
  | 'extreme-cool'    // 极致爽文
  | 'hot-blood'       // 热血对决
  | 'brain-burn'      // 烧脑悬疑
  | 'horror-thriller' // 惊悚恐怖
  | 'sweet-romance'   // 甜宠言情
  | 'system-flow'     // 系统流爽文
  | 'mind-game'       // 智斗谋略
  | 'custom';         // 自定义

export interface IRhythmPreset {
  type: RhythmPresetType;
  name: string;
  description: string;
  icon: string;
  recommendedGenres: string[];
}

// ===== 节奏参数 =====
export type PowerUpSpeed = 'slow' | 'medium' | 'fast' | 'godlike';
export type EquipmentDropRate = 'rare' | 'normal' | 'frequent';
export type SuspenseIntensity = 'weak' | 'medium' | 'strong' | 'extreme';
export type RomanceSpeed = 'none' | 'slow' | 'normal' | 'fast' | 'instant';
export type HeartacheLevel = 'none' | 'light' | 'medium' | 'heavy' | 'be';
export type VillainIQ = 'fodder' | 'normal' | 'smart' | 'genius';
export type PressureCurve = 'easy' | 'normal' | 'hard' | 'extreme';

export interface IRhythmParams {
  faceSlappingFrequency: number;
  coolPointDensity: number;
  powerUpSpeed: PowerUpSpeed;
  equipmentDropRate: EquipmentDropRate;
  plotTwistFrequency: number;
  suspenseIntensity: SuspenseIntensity;
  romanceSpeed: RomanceSpeed;
  heartacheLevel: HeartacheLevel;
  villainIQ: VillainIQ;
  pressureCurve: PressureCurve;
  bossInterval: number;
}

// 节奏参数显示名称
export const RhythmParamLabels: Record<keyof IRhythmParams, string> = {
  faceSlappingFrequency: '打脸频率',
  coolPointDensity: '爽点密度',
  powerUpSpeed: '升级节奏',
  equipmentDropRate: '装备获取',
  plotTwistFrequency: '反转频率',
  suspenseIntensity: '悬念强度',
  romanceSpeed: '感情进度',
  heartacheLevel: '虐心程度',
  villainIQ: '反派智商',
  pressureCurve: '压力曲线',
  bossInterval: 'Boss间隔',
};

// ===== 节奏追踪 =====
export interface IRhythmTracking {
  lastFaceSlap: number;
  lastPlotTwist: number;
  lastBoss: number;
  coolPointsThisEpisode?: number;
}

// ===== 节奏配置响应 =====
export interface IRhythmConfig {
  currentPreset: RhythmPresetType;
  params: IRhythmParams;
  tracking: IRhythmTracking;
}

// ===== 上下文预览 =====
export interface IContextPreview {
  hasWorldState: boolean;
  message?: string;
  episodePlan?: string;
  worldStateEpisode?: number;
  characterCount?: number;
  plantedForeshadowings?: number;
  context?: {
    formattedContext: string;
    constraints: string[];
    rhythmConstraints: string[];
    suggestions: string[];
  };
}

// ===== 生成进度 =====
export interface IGenerationProgress {
  current: number;
  total: number;
  step: string;
  message: string;
}

// ===== 注意力头分析结果 =====
export interface IHeadAnalysisResult {
  headType: string;
  insights: string[];
  suggestions: string[];
  constraints: string[];
  warnings?: string[];
  relevantElements?: Array<{
    element: string;
    weight: number;
    reason: string;
  }>;
}

// ===== 多头注意力聚合结果 =====
export interface IMultiHeadResult {
  headResults: IHeadAnalysisResult[];
  crossDimensionInsights: string[];
  aggregatedConstraints: string[];
  aggregatedSuggestions: string[];
}

// ===== 批量分析结果 =====
export interface IBatchAnalysisResult {
  episode: number;
  characterUpdates: number;
  foreshadowingResolved: number;
  foreshadowingPlanted: number;
}

export interface IBatchAnalysisResponse {
  success: boolean;
  analyzed: number;
  episodes: IBatchAnalysisResult[];
}

// ===== 角色层级变化 =====
export interface ITierChange {
  name: string;
  from: CharacterTier;
  to: CharacterTier;
  reason: string;
}
