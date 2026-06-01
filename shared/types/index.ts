// 项目相关类型
export interface Project {
  _id: string;
  name: string;
  genre: string;
  type: string;
  totalEpisodes: number;
  status: ProjectStatus;
  outline?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectStatus = 'draft' | 'outline_done' | 'generating' | 'completed';

// 角色相关类型
export interface Character {
  _id: string;
  projectId: string;
  name: string;
  gender: 'male' | 'female' | 'unknown';
  age?: string;
  identity: string;
  personality: string;
  background: string;
  abilities?: string;
  appearance?: string;
  relationships?: CharacterRelationship[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CharacterRelationship {
  targetCharacterId: string;
  targetName: string;
  relationship: string;
}

// 剧集相关类型
export interface Episode {
  _id: string;
  projectId: string;
  episodeNumber: number;
  title?: string;
  content: string;
  summary?: string;
  wordCount: number;
  status: EpisodeStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type EpisodeStatus = 'pending' | 'generating' | 'completed' | 'failed';

// 大纲相关类型
export interface Outline {
  _id: string;
  projectId: string;
  content: string;
  episodeSummaries: EpisodeSummary[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EpisodeSummary {
  episodeNumber: number;
  title: string;
  summary: string;
}

// 伏笔追踪类型
export interface Foreshadowing {
  _id: string;
  projectId: string;
  content: string;
  plantedEpisode: number;
  resolvedEpisode?: number;
  importance: 'high' | 'normal' | 'low';
  type: 'suspense' | 'character' | 'item' | 'plot';
  status: 'planted' | 'resolved' | 'abandoned';
  createdAt: Date;
  updatedAt: Date;
}

// 改写历史类型
export interface RewriteHistory {
  _id: string;
  projectId: string;
  episodeNumber: number;
  originalContent: string;
  rewrittenContent: string;
  instruction: string;
  createdAt: Date;
}

// 验证报告类型
export interface ValidationReport {
  _id: string;
  projectId: string;
  issues: ValidationIssue[];
  createdAt: Date;
}

export interface ValidationIssue {
  type: 'critical' | 'warning' | 'suggestion';
  episodeNumber: number;
  description: string;
  suggestion?: string;
}

// 标签类型
export interface Tag {
  _id: string;
  name: string;
  color: string;
  projectIds: string[];
  createdAt: Date;
}

// API 响应类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// SSE 事件类型
export interface SSEEvent {
  type: string;
  data: unknown;
}

export interface GenerationProgress {
  currentEpisode: number;
  totalEpisodes: number;
  status: 'generating' | 'analyzing' | 'saving' | 'done' | 'error';
  content?: string;
  error?: string;
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
