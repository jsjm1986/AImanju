export * from './worldState';
export * from './fix';

export interface ProjectOutline {
  raw: string;
  characterCards: string;
  synopsis: string;
  episodeSummaries: string;
}

export type WritingStylePreset =
  | 'literary'
  | 'colloquial'
  | 'humorous'
  | 'serious'
  | 'poetic'
  | 'dramatic'
  | 'minimalist'
  | 'descriptive'
  | 'custom';

export interface WritingStyle {
  preset: WritingStylePreset;
  customDescription?: string;
  dialogueStyle?: 'formal' | 'casual' | 'mixed';
  narrativeVoice?: 'third-person' | 'first-person' | 'omniscient';
  emotionalTone?: 'warm' | 'cold' | 'neutral' | 'intense';
}

export const WRITING_STYLE_PRESETS: Record<WritingStylePreset, { name: string; description: string; example: string }> = {
  literary: {
    name: '文艺风',
    description: '优美细腻，注重意境和文学性',
    example: '月光如水，洒落在她苍白的脸庞上，映出一抹难以言喻的哀愁。'
  },
  colloquial: {
    name: '口语化',
    description: '通俗易懂，贴近生活，节奏明快',
    example: '他一脚踹开门，冷笑道："就凭你？"'
  },
  humorous: {
    name: '幽默风',
    description: '诙谐有趣，轻松愉快，善用反差',
    example: '他一本正经地点点头："放心，我这人最大的优点就是谦虚。"'
  },
  serious: {
    name: '严肃风',
    description: '正经庄重，深沉厚重，适合权谋历史',
    example: '朝堂之上，暗流涌动。每一个眼神，都是一场无声的博弈。'
  },
  poetic: {
    name: '诗意风',
    description: '富有诗意，意境深远，适合古风仙侠',
    example: '剑光如虹，划破长空。他立于云端，衣袂飘飘，宛若谪仙。'
  },
  dramatic: {
    name: '戏剧化',
    description: '冲突强烈，情感饱满，高潮迭起',
    example: '"不！"她撕心裂肺地喊道，眼睁睁看着他坠入深渊。'
  },
  minimalist: {
    name: '极简风',
    description: '简洁明快，留白多，节奏紧凑',
    example: '他来了。她走了。一切，结束了。'
  },
  descriptive: {
    name: '描写细腻',
    description: '细节丰富，画面感强，适合动漫改编',
    example: '他缓缓抬起右手，指尖凝聚着淡蓝色的灵力光芒，周围的空气都开始微微震颤。'
  },
  custom: {
    name: '自定义',
    description: '根据您的需求自定义写作风格',
    example: ''
  },
};

export interface Project {
  _id: string;
  name: string;
  genre: string;
  type: string;
  totalEpisodes: number;
  status: ProjectStatus;
  outline?: ProjectOutline | string;
  concept?: string;
  requirements?: string;
  tags?: string[];
  writingStyle?: WritingStyle;  // 写作风格配置
  outputFormat?: { mode: string; preset?: string; customPrompt?: string; enableNarrativeMethodology?: boolean };  // 输出格式配置
  creatorId?: { username: string; tier: string };  // 创建者信息（管理员视图）
  publishStatus?: 'draft' | 'pending' | 'published' | 'rejected';  // 发布状态
  publishRequest?: { adminNote?: string };  // 发布请求信息
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectStatus = 'draft' | 'outline_done' | 'generating' | 'completed';

// ===== 标签类型 =====

export interface Tag {
  _id: string;
  name: string;
  color: string;
  sortOrder: number;
  createdAt: Date;
}

// 角色类型枚举
export type CharacterType = 'main' | 'supporting' | 'recurring' | 'guest' | 'extra';

export interface Character {
  _id: string;
  projectId: string;
  name: string;
  role?: string;         // 角色定位：男主角、反派等
  type: string;          // 角色类型（自由文本）
  gender: string;        // 性别（自由文本）
  age?: string;
  identity: string;
  personality: string;
  background: string;
  abilities?: string;
  // 详细外貌字段（V1兼容）
  hairStyle?: string;    // 发型
  hairColor?: string;    // 发色
  faceType?: string;     // 脸型
  bodyType?: string;     // 身材
  clothing?: string;     // 穿着
  accessories?: string;  // 配饰
  // 保留原有字段用于兼容
  appearance?: string;
  // 初始装备和能力
  initialEquipment?: string[];
  initialAbilities?: string[];
  relationships?: CharacterRelationship[];
  createdAt: Date;
  updatedAt: Date;
}

// 角色类型显示名称（用于兼容旧数据）
export const CharacterTypeLabels: Record<string, string> = {
  main: '主角',
  supporting: '重要配角',
  recurring: '关键角色',
  guest: '客串角色',
  extra: '龙套',
};

// 性别显示名称（用于兼容旧数据）
export const GenderLabels: Record<string, string> = {
  male: '男',
  female: '女',
  unknown: '未知',
};

export interface CharacterRelationship {
  targetCharacterId: string;
  targetName: string;
  relationship: string;
}

export interface Episode {
  _id: string;
  projectId: string;
  episodeNumber: number;
  title?: string;
  content: string;
  summary?: string;
  wordCount: number;
  wordCountV2?: number;
  status: EpisodeStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type EpisodeStatus = 'pending' | 'generating' | 'completed' | 'failed';

export interface GenerationProgress {
  currentEpisode: number;
  totalEpisodes: number;
  status: 'generating' | 'analyzing' | 'saving' | 'done' | 'error';
  content?: string;
  error?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ===== 伏笔相关类型 =====

/**
 * 伏笔状态
 */
export type ForeshadowingStatus =
  | 'planted'    // 已埋设，等待回收
  | 'dormant'    // 休眠中，暂不追踪
  | 'resolved'   // 已回收
  | 'merged'     // 已合并到其他伏笔
  | 'abandoned'; // 已放弃

/**
 * 伏笔类型
 */
export type ForeshadowingType =
  | 'suspense'      // 悬念
  | 'character'     // 角色相关
  | 'item'          // 道具/物品
  | 'plot'          // 剧情
  | 'worldbuilding' // 世界观
  | 'relationship'; // 人物关系

/**
 * 伏笔重要性
 */
export type ForeshadowingImportance = 'critical' | 'high' | 'normal' | 'low';

/**
 * 伏笔有效性（AI评定）
 */
export type ForeshadowingValidity =
  | 'true_foreshadowing'  // 真正的伏笔，需要回收
  | 'atmosphere'          // 氛围描写，不需要回收
  | 'setup'               // 铺垫/背景，可选回收
  | 'hook'                // 钩子/悬念，需要承接但不一定单独回收
  | 'redundant'           // 冗余，与其他伏笔重复
  | 'pending_review';     // 待AI审核

/**
 * 伏笔完整数据结构
 */
export interface Foreshadowing {
  _id: string;
  projectId: string;
  episodePlanted: number;
  episodeResolved?: number;
  content: string;
  type: ForeshadowingType;
  importance: ForeshadowingImportance;
  status: ForeshadowingStatus;

  // AI分析字段
  validity: ForeshadowingValidity;
  validityReason?: string;
  relevanceScore: number;   // 0-100，与当前剧情的相关度
  urgencyScore: number;     // 0-100，回收紧迫度

  // 合并相关
  mergedInto?: string;      // 如果被合并，指向目标伏笔ID
  mergedFrom?: string[];    // 如果是合并目标，记录来源ID列表

  // 分组/聚类
  clusterGroup?: string;    // AI分配的主题组
  clusterLabel?: string;    // 组标签（如"红绳之谜"）

  // 回收相关
  resolutionNote?: string;
  suggestedResolution?: string;  // AI建议的回收方式
  resolvedAt?: Date;

  // 生命周期
  lastReviewedAt?: Date;
  lastReviewedEpisode?: number;
  reviewCount: number;

  // 元数据
  sourceType: 'manual' | 'ai_detected' | 'cliffhanger' | 'merged';
  relatedCharacters?: string[];
  relatedPlotlines?: string[];

  createdAt: Date;
  updatedAt: Date;
}

/**
 * 伏笔统计
 */
export interface ForeshadowingStats {
  total: number;
  planted: number;
  dormant: number;
  resolved: number;
  abandoned: number;
  merged: number;
  byImportance?: {
    critical: number;
    high: number;
    normal: number;
    low: number;
  };
  byValidity?: Record<string, number>;
  urgentCount?: number;
  pendingReviewCount?: number;
}

/**
 * 伏笔回收建议（旧接口兼容）
 */
export interface ForeshadowingSuggestion {
  urgent: Foreshadowing[];
  recommended: Foreshadowing[];
  optional: Foreshadowing[];
}

// ===== AI 伏笔决策相关类型 =====

/**
 * AI 决策输入上下文
 */
export interface ForeshadowingContext {
  projectId: string;
  projectName: string;
  projectType: string;
  currentEpisode: number;
  episodePlan: string;
  recentEvents?: string[];
  characterStates?: Array<{ name: string; state: string }>;
  previousCliffhanger?: string;
}

/**
 * AI 输出的完整决策
 */
export interface AIForeshadowingDecision {
  // 约束决策
  constraints: {
    verifiable: Array<{
      id: string;
      content: string;
      reason: string;
      priority: number;
    }>;
    guidance: Array<{
      id: string;
      content: string;
      reason: string;
    }>;
  };

  // 生命周期决策
  lifecycle: {
    merge: Array<{
      ids: string[];
      primaryId: string;
      mergedContent: string;
      label: string;
    }>;
    abandon: Array<{
      id: string;
      reason: string;
    }>;
    dormant: Array<{
      id: string;
      reason: string;
    }>;
    awaken: Array<{
      id: string;
      reason: string;
    }>;
  };

  // 有效性判断
  validity: Array<{
    id: string;
    type: ForeshadowingValidity;
    reason: string;
  }>;

  // 总结
  summary: string;
}

/**
 * AI 决策执行结果
 */
export interface AIDecisionResult {
  decision: AIForeshadowingDecision;
  applied: {
    constraintsSet: number;
    merged: number;
    abandoned: number;
    dormant: number;
    awakened: number;
    validityUpdated: number;
  };
}

/**
 * 优化后的约束（供剧本生成使用）
 */
export interface OptimizedConstraints {
  verifiable: Array<{
    id: string;
    content: string;
    priority: number;
  }>;
  guidance: Array<{
    id: string;
    content: string;
  }>;
}

/**
 * 伏笔聚类组
 */
export interface ForeshadowingCluster {
  group: string;
  label: string;
  count: number;
}

// ===== 验证相关类型 =====

/**
 * 问题处理状态
 */
export type IssueStatus = 'pending' | 'fixed' | 'ignored' | 'false_positive';

/**
 * 问题状态标签配置
 */
export const ISSUE_STATUS_CONFIG: Record<IssueStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: '待处理', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)' },
  fixed: { label: '已处理', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)' },
  ignored: { label: '忽略', color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.15)' },
  false_positive: { label: '误报', color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.15)' },
};

export interface ValidationIssue {
  type: 'error' | 'critical' | 'warning' | 'info';
  category: string;
  episode: number;
  description: string;
  suggestion?: string;
  location?: string;
  evidence?: string;      // 原文引用
  windowRange?: string;   // 验证窗口范围
  isGlobal?: boolean;     // 是否为全局问题
  status?: IssueStatus;   // 问题处理状态
}

export interface ValidationResult {
  success: boolean;
  issues: ValidationIssue[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
  // 报告相关字段（从后端返回）
  report?: {
    score: number;
    rating: string;
    totalIssues: number;
    issues: ValidationIssue[];
    summary: {
      errors: number;
      warnings: number;
      info: number;
    };
    generatedAt?: string;
  };
}

export interface ValidationProgress {
  type: 'init' | 'progress' | 'complete' | 'error';
  current?: number;
  total?: number;
  windowStart?: number;
  windowEnd?: number;
}

// ===== 改写相关类型 =====

export type RewriteType = 'full' | 'selection' | 'instruction' | 'manual' | 'fix';

// 选中范围接口（仅局部改写时使用）
export interface RewriteSelection {
  start: number;
  end: number;
  text: string;
}

export interface RewriteHistory {
  _id: string;
  projectId: string;
  episodeId: string;
  episodeNumber: number;
  type: RewriteType;
  instruction: string;
  originalContent: string;
  rewrittenContent: string;

  // AI 提示词（仅 AI 改写时保存）
  systemPrompt?: string;  // AI 系统提示词
  userPrompt?: string;    // 发送给 AI 的完整用户消息

  // 选中范围（仅 selection 类型）
  selection?: RewriteSelection;

  // 字数统计
  originalWordCount: number;
  rewrittenWordCount: number;
  wordCountDiff: number;  // 正数表示增加，负数表示减少

  // 状态
  applied: boolean;
  appliedAt?: Date;
  reverted?: boolean;  // 是否被回滚操作级联失效

  createdAt: Date;
  updatedAt?: Date;
}

// 历史统计信息
export interface RewriteHistoryStats {
  total: number;
  byType: {
    selection: number;
    instruction: number;
    full: number;
    manual: number;
  };
  applied: number;
  pending: number;
}

// 历史列表响应（带统计）
export interface RewriteHistoryResponse {
  history: RewriteHistory[];
  stats: RewriteHistoryStats;
}

// 项目历史响应（跨集）
export interface ProjectHistoryResponse {
  history: RewriteHistory[];
  byEpisode: Record<number, RewriteHistory[]>;
  stats: RewriteHistoryStats;
}

// 历史详情响应
export interface RewriteHistoryDetailResponse {
  history: RewriteHistory;
  diff: DiffBlock[];
}

// 回滚响应
export interface RewriteRevertResponse {
  success: boolean;
  affectedRecords: number;
}

export interface RewriteResult {
  historyId: string;
  originalContent: string;
  rewrittenContent: string;
  diff: DiffBlock[];
}

export interface DiffBlock {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  lineNumber?: number;
  // 增强字段（用于折叠功能）
  lines?: string[];
  startLine?: number;
  endLine?: number;
  collapsed?: boolean;
}

export interface RewriteProgress {
  type: 'chunk' | 'complete' | 'result' | 'error';
  text?: string;
  error?: string;
}

// ===== 角色状态相关类型 =====

export interface CharacterState {
  _id: string;
  projectId: string;
  characterId: string;
  characterName: string;
  episode: number;
  equipment: string[];
  abilities: string[];
  conditions: string[];
  location: string;
  emotionalState: string;
  relationships: Record<string, string>;
  notes: string;
  createdAt: Date;
}

export interface CharacterAppearanceStats {
  totalAppearances: number;
  firstAppearance: number;
  lastAppearance: number;
  episodes: number[];
}

export interface StateAnalysisResult {
  episode: number;
  states: CharacterState[];
  foreshadowings: {
    planted: Foreshadowing[];
    resolved: Foreshadowing[];
  };
}


// ==================== 批量连贯改写相关类型 ====================

// 批量改写请求
export interface BatchRewriteRequest {
  projectId: string;
  episodeRange: {
    start: number;
    end: number;
  };
  instruction: string;
  options?: BatchRewriteOptions;
}

// 批量改写选项
export interface BatchRewriteOptions {
  preserveKeyEvents?: boolean;  // 保留关键事件
  maintainWordCount?: boolean;  // 保持字数
  focusAreas?: string[];        // 重点关注区域
}

// 改写计划
export interface RewritePlan {
  id: string;
  projectId: string;
  episodeRange: { start: number; end: number };
  instruction: string;
  totalWordCount: number;
  estimatedTime: number;  // 预估时间（秒）
  episodes: EpisodePlan[];
  coherencePoints: CoherencePoint[];
  createdAt: Date;
}

// 单集改写计划
export interface EpisodePlan {
  episodeNumber: number;
  currentWordCount: number;
  plannedChanges: string;
  keyElements: string[];
  connectionPoints: {
    fromPrevious: string[];
    toNext: string[];
  };
}

// 连贯性处理点
export interface CoherencePoint {
  type: 'character_state' | 'foreshadowing' | 'plot_thread' | 'timeline';
  description: string;
  affectedEpisodes: number[];
  handling: string;
}

// 连贯性上下文
export interface CoherenceContext {
  previousSummary: string;
  characterStates: CharacterStateInfo[];
  activeForeshadowings: ForeshadowingInfo[];
  plotThreads: PlotThread[];
  followingPlotPoints: string[];
}

// 角色状态信息（用于连贯性上下文）
export interface CharacterStateInfo {
  name: string;
  condition: string;
  lastAppearance?: number;
}

// 伏笔信息（用于连贯性上下文）
export interface ForeshadowingInfo {
  content: string;
  plantedEpisode: number;
  importance: string;
}

// 剧情线索
export interface PlotThread {
  name: string;
  status: 'active' | 'resolved' | 'pending';
  relatedEpisodes: number[];
}

// 批量改写结果
export interface BatchRewriteResult {
  id: string;
  planId: string;
  status: BatchRewriteStatus;
  episodes: EpisodeRewriteResult[];
  coherenceReport?: CoherenceReport;
  createdAt: Date;
  completedAt?: Date;
}

// 批量改写状态
export type BatchRewriteStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial';

// 单集改写结果
export interface EpisodeRewriteResult {
  episodeNumber: number;
  episodeId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  originalContent: string;
  rewrittenContent: string;
  wordCountChange: number;
  coherenceIssues: string[];
  error?: string;
}

// 连贯性报告
export interface CoherenceReport {
  overallScore: number;  // 0-100
  characterConsistency: boolean;
  foreshadowingHandled: boolean;
  timelineConsistent: boolean;
  issues: CoherenceIssue[];
}

// 连贯性问题
export interface CoherenceIssue {
  type: string;
  severity: 'warning' | 'error';
  episode: number;
  description: string;
  suggestion?: string;
}

// 批量改写历史记录
export interface BatchRewriteHistory {
  _id: string;
  projectId: string;
  planId: string;
  instruction: string;
  episodeRange: {
    start: number;
    end: number;
  };
  status: BatchRewriteStatus | 'rolled_back';
  episodes: BatchEpisodeResult[];
  coherenceReport?: CoherenceReport;
  appliedAt?: Date;
  rolledBackAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 批量改写中的单集结果
export interface BatchEpisodeResult {
  episodeNumber: number;
  episodeId: string;
  originalContent: string;
  rewrittenContent: string;
  applied: boolean;
  wordCountChange: number;
}

// 批量改写进度事件
export interface BatchRewriteProgressEvent {
  type: 'plan_generated' | 'episode_start' | 'episode_chunk' | 'episode_complete' | 'episode_failed' | 'all_complete' | 'error';
  currentEpisode?: number;
  totalEpisodes?: number;
  content?: string;
  result?: EpisodeRewriteResult;
  error?: string;
}


// ==================== 角色增强相关类型 ====================

// 成长阶段类型
export type GrowthStage = 'initial' | 'challenged' | 'growing' | 'transformed';

// 语言正式程度
export type FormalLevel = 'very_formal' | 'formal' | 'neutral' | 'casual' | 'very_casual' | 'archaic';

// 词汇风格
export type VocabularyStyle = 'literary' | 'technical' | 'colloquial' | 'archaic' | 'modern' | 'simple';

// 句式模式
export type SentencePattern = 'long_complex' | 'medium' | 'short_punchy' | 'mixed' | 'short' | 'long' | 'fragmented';

// 高光时刻类型
export type ImpressiveMomentType = 'combat' | 'wisdom' | 'emotional' | 'humor';

// 成长事件类型
export type GrowthEventType = 'skill' | 'mindset' | 'relationship' | 'identity' | 'realization' | 'setback' | 'breakthrough';

// 关系等级
export type RelationshipLevel = 'stranger' | 'acquaintance' | 'familiar' | 'close' | 'intimate' | 'hostile' | 'enemy';

// 关系事件类型
export type RelationshipEventType = 'first_meeting' | 'bonding' | 'conflict' | 'betrayal' | 'reconciliation' | 'deepening';

// 关系影响类型
export type RelationshipImpact = 'positive' | 'negative' | 'neutral';

// 高光时刻
export interface ImpressiveMoment {
  episode: number;
  description: string;
  type: ImpressiveMomentType;
}

// 角色魅力特征
export interface ICharacterCharm {
  catchphrases: string[];      // 口头禅
  quirks: string[];            // 小癖好
  signatureMoves: string[];    // 标志性动作
  impressiveMoments: ImpressiveMoment[];
}

// 成长阶段历史
export interface IStageHistory {
  stage: GrowthStage;
  startEpisode: number;
  endEpisode?: number;
  trigger?: string;
}

// 转折点
export interface ITurningPoint {
  episode: number;
  event: string;
  impact: string;
  beforeState: string;
  afterState: string;
}

// 成长事件
export interface IGrowthEvent {
  episode: number;
  type: GrowthEventType;
  description: string;
}

// 里程碑
export interface IMilestone {
  episode: number;
  milestone: string;
  achieved: boolean;
}

// 角色成长弧线
export interface ICharacterArc {
  currentStage: GrowthStage;
  stageHistory: IStageHistory[];
  turningPoints: ITurningPoint[];
  growthEvents: IGrowthEvent[];
  milestones: IMilestone[];
  lastGrowthEpisode: number;
}

// 语言风格演变
export interface IVoiceEvolution {
  stage: GrowthStage;
  formalLevel: FormalLevel;
  vocabularyStyle: VocabularyStyle;
  description: string;
}

// 情绪调整规则
export interface IEmotionalAdjustment {
  emotion: string;
  adjustments: {
    formalLevel?: FormalLevel;
    sentencePattern?: SentencePattern;
  };
}

// 角色语言风格
export interface ICharacterVoice {
  formalLevel: FormalLevel;
  vocabularyStyle: VocabularyStyle;
  sentencePattern: SentencePattern;
  preferredWords: string[];
  avoidedWords: string[];
  voiceEvolution: IVoiceEvolution[];
  emotionalAdjustments: IEmotionalAdjustment[];
}

// 角色增强数据
export interface ICharacterEnhancement {
  _id: string;
  projectId: string;
  characterId: string;
  characterName: string;
  charm: ICharacterCharm;
  arc: ICharacterArc;
  voice: ICharacterVoice;
  createdAt: Date;
  updatedAt: Date;
}

// 关系历史记录
export interface IRelationshipHistory {
  episode: number;
  fromLevel: RelationshipLevel;
  toLevel: RelationshipLevel;
  event: string;
  timestamp: Date;
}

// 关系关键事件
export interface IRelationshipKeyEvent {
  episode: number;
  type: RelationshipEventType;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
}

// 角色关系
export interface ICharacterRelationshipData {
  _id: string;
  projectId: string;
  characterAId: string;
  characterBId: string;
  characterAName: string;
  characterBName: string;
  currentLevel: RelationshipLevel;
  sentiment: number;  // -1 到 1
  history: IRelationshipHistory[];
  keyEvents: IRelationshipKeyEvent[];
  lastInteractionEpisode: number;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== 预算分配相关类型 ====================

// 预算分配结果
export interface IBudgetAllocation {
  previousSummaries: number;
  characters: number;
  foreshadowing: number;
  characterContinuity: number;
  stateChanges: number;
  sceneRhythm: number;
  characterCharm: number;
  total: number;
}

// 预算调整原因
export interface IBudgetAdjustmentReason {
  module: string;
  adjustment: number;
  reason: string;
}

// 预算分配 SSE 消息
export interface BudgetAllocationMessage {
  allocation: IBudgetAllocation;
  adjustmentReasons: IBudgetAdjustmentReason[];
}

// 成长阶段描述
export const GROWTH_STAGE_LABELS: Record<GrowthStage, string> = {
  initial: '初始阶段',
  challenged: '受挑战阶段',
  growing: '成长阶段',
  transformed: '蜕变阶段',
};

// 关系等级描述
export const RELATIONSHIP_LEVEL_LABELS: Record<RelationshipLevel, string> = {
  stranger: '陌生人',
  acquaintance: '相识',
  familiar: '熟悉',
  close: '亲近',
  intimate: '亲密',
  hostile: '敌对',
  enemy: '仇敌',
};

// 语言正式程度描述
export const FORMAL_LEVEL_LABELS: Record<FormalLevel, string> = {
  very_formal: '非常正式',
  formal: '正式',
  neutral: '中性',
  casual: '随意',
  very_casual: '非常随意',
  archaic: '古风',
};

// 词汇风格描述
export const VOCABULARY_STYLE_LABELS: Record<VocabularyStyle, string> = {
  literary: '文学性',
  technical: '专业性',
  colloquial: '口语化',
  archaic: '古风',
  modern: '现代',
  simple: '简单',
};

// 句式模式描述
export const SENTENCE_PATTERN_LABELS: Record<SentencePattern, string> = {
  long_complex: '长复句',
  medium: '中等',
  short_punchy: '短促有力',
  mixed: '混合',
  short: '短句',
  long: '长句',
  fragmented: '碎片化',
};
