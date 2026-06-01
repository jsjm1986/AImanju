/**
 * 修复功能类型定义
 */

// 修复变更
export interface FixChange {
  episode: number;
  location: string;
  original: string;
  modified: string;
  reason: string;
}

// 修复方案
export interface FixPlan {
  id: string;
  name: string;
  description: string;
  confidence: number;
  recommended: boolean;
  sideEffects?: string;
  changes: FixChange[];
}

// 修复结果
export interface FixResult {
  originalContent: string;
  fixedContent: string;
  wordCountDiff: number;
}

// 修复历史记录
export interface FixHistory {
  id: string;
  episodeNumber: number;
  issueType: string;
  issueDescription: string;
  planName: string;
  originalContent: string;
  fixedContent: string;
  wordCountDiff: number;
  appliedAt: Date | string;
  canRevert: boolean;
}

// 修复历史统计
export interface FixHistoryStats {
  totalFixes: number;
  successRate: number;
  byIssueType: Record<string, number>;
}

// 验证问题（用于修复）- 已移至 index.ts 统一定义

// 分析结果
export interface FixAnalysisResult {
  success: boolean;
  analysis: string;
  affectedEpisodes?: number[];
  plans: FixPlan[];
  error?: string;
}

// 批量分析结果
export interface BatchAnalysisResult {
  success: boolean;
  results: Array<{
    issueIndex: number;
    analysis: string;
    plans: FixPlan[];
  }>;
  error?: string;
}

// SSE 进度事件
export interface FixProgressEvent {
  type: 'progress' | 'complete' | 'error';
  content?: string;
  percent?: number;
  result?: FixResult;
  message?: string;
}

// 修复状态
export type FixStatus = 'idle' | 'analyzing' | 'executing' | 'completed' | 'error';


// ==================== 跨集联动修复类型 ====================

// 受影响的集数信息
export interface AffectedEpisode {
  episodeNumber: number;
  episodeId?: string;
  role: 'source' | 'bridge' | 'resolution';  // 源头/铺垫/回收
  relevance: string;  // 相关性说明
}

// 跨集修复变更（扩展 FixChange）
export interface CrossEpisodeFixChange extends FixChange {
  role: 'source' | 'bridge' | 'resolution';
  priority: 'required' | 'recommended' | 'optional';
  relatedTo?: number[];  // 关联的其他集数
}

// 修改关联
export interface FixConnection {
  fromEpisode: number;
  toEpisode: number;
  type: 'foreshadowing' | 'callback' | 'continuation';
  description: string;
}

// 跨集修复方案（扩展 FixPlan）
export interface CrossEpisodeFixPlan extends Omit<FixPlan, 'changes'> {
  changes: CrossEpisodeFixChange[];
  connections?: FixConnection[];
}

// 关联伏笔信息
export interface RelatedForeshadowing {
  id: string;
  content: string;
  episodePlanted: number;
  currentStatus: string;
  newStatus?: string;  // 用户选择的新状态
}

// 针对性验证结果
export interface TargetedValidationResult {
  passed: boolean;
  originalIssueResolved: boolean;
  details: string;
}

// 跨集修复元数据（存储在 RewriteHistory.systemPrompt 中）
export interface CrossEpisodeFixMetadata {
  issue: {
    type: string;
    description: string;
    sourceEpisode: number;
    evidence?: string;
  };
  plan: {
    id: string;
    name: string;
    description: string;
    confidence: number;
  };
  affectedEpisodes: Array<{
    episodeId: string;
    episodeNumber: number;
    historyId: string;
  }>;
  relatedForeshadowings?: Array<{
    foreshadowingId: string;
    content: string;
    previousStatus: string;
    newStatus?: string;
  }>;
  validation?: {
    passed: boolean;
    originalIssueResolved: boolean;
    validatedAt: string;
  };
  masterHistoryId?: string;
}

// 跨集修复分析结果
export interface CrossEpisodeAnalysisResult {
  success: boolean;
  analysis: string;
  affectedEpisodes: AffectedEpisode[];
  plans: CrossEpisodeFixPlan[];
  relatedForeshadowings: RelatedForeshadowing[];
  error?: string;
}

// 多集修复结果
export interface MultiEpisodeFixResult {
  episodeNumber: number;
  original: string;
  fixed: string;
}

// 跨集修复执行进度事件
export interface CrossEpisodeProgressEvent {
  type: 'start' | 'episode_start' | 'episode_progress' | 'episode_complete' | 'complete' | 'error';
  totalEpisodes?: number;
  episodeNumber?: number;
  content?: string;
  percent?: number;
  fixedContent?: string;
  results?: MultiEpisodeFixResult[];
  message?: string;
}

// 跨集修复状态
export type CrossEpisodeFixStatus =
  | 'idle'
  | 'analyzing'
  | 'selecting'
  | 'executing'
  | 'previewing'
  | 'applying'
  | 'validating'
  | 'completed'
  | 'error';
