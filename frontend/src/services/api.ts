import type {
  AIDecisionResult,
  ApiResponse,
  Character,
  CharacterAppearanceStats,
  CharacterState,
  Episode,
  Foreshadowing,
  ForeshadowingCluster,
  ForeshadowingContext,
  ForeshadowingStats,
  ForeshadowingSuggestion,
  GenreType,
  IAttentionHead,
  IBatchAnalysisResponse,
  IContextPreview,
  IRhythmConfig,
  IRhythmParams,
  IRhythmPreset,
  IWorldState,
  OptimizedConstraints,
  Project,
  ProjectHistoryResponse,
  RewriteHistoryDetailResponse,
  RewriteHistoryResponse,
  RewriteResult,
  RewriteRevertResponse,
  RewriteType,
  StateAnalysisResult,
  Tag,
  ValidationIssue,
  ValidationResult
} from '@/types';
import axios from 'axios';
import { API_BASE, apiUrl, CREATOR_TOKEN_KEY as TOKEN_KEY } from './apiConfig';
import { postSSE } from './sseClient';

export type { ICharacterCharm, ICharacterVoice } from '@/types';

const http = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

http.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('comic-script-creator-auth');
      window.location.href = '/login';
    } else if (error.response?.status === 403) {
      const serverError = error.response?.data?.error || '';
      const code = error.response?.data?.code || '';
      let friendlyMessage = serverError || '权限不足';

      if (code === 'QUOTA_EXCEEDED' || code === 'EPISODE_QUOTA_EXCEEDED' ||
        serverError.includes('配额') || serverError.includes('试用')) {
        friendlyMessage += '\n\n如需购买更多配额，请联系管理员：\n微信：agimeme\n\n了解更多请查看说明文档';
      }

      error.message = friendlyMessage;
      error.friendlyMessage = friendlyMessage;
    }
    return Promise.reject(error);
  }
);

export const projectApi = {
  getAll: () => http.get<ApiResponse<Project[]>>('/projects'),
  getById: (id: string) => http.get<ApiResponse<Project>>(`/projects/${id}`),
  create: (data: Partial<Project>) => http.post<ApiResponse<Project>>('/projects', data),
  update: (id: string, data: Partial<Project>) => http.put<ApiResponse<Project>>(`/projects/${id}`, data),
  delete: (id: string) => http.delete<ApiResponse<void>>(`/projects/${id}`),
};

export const publishApi = {
  getConfig: (projectId: string) =>
    http.get<ApiResponse<{
      projectId: string;
      projectName: string;
      isPublished: boolean;
      pricePerEpisode: number;
      freeEpisodeCount: number;
      maxPointsEpisode: number;
      fullScriptPrice: number;
      coverImage?: string;
      tags: string[];
      publishedAt?: string;
    }>>(`/publish/${projectId}`),

  updateConfig: (projectId: string, data: {
    pricePerEpisode?: number;
    freeEpisodeCount?: number;
    fullScriptPrice?: number;
    coverImage?: string;
    tags?: string[];
    targetAudience?: 'male' | 'female';
  }) => http.put<ApiResponse<{ success: boolean }>>(`/publish/${projectId}`, data),

  publish: (projectId: string) =>
    http.post<ApiResponse<{ success: boolean; publishedAt: string }>>(`/publish/${projectId}/publish`),

  unpublish: (projectId: string) =>
    http.post<ApiResponse<{ success: boolean }>>(`/publish/${projectId}/unpublish`),
};

export const outputFormatApi = {
  get: (projectId: string) =>
    http.get<{
      success: boolean;
      data: {
        config: { mode: string; preset?: string; customPrompt?: string; enableNarrativeMethodology?: boolean; advanced?: unknown };
        resolved: unknown;
        presets: Array<{
          id: string;
          name: string;
          description: string;
          wordRange: string;
          sceneRange: string;
          suitableFor: string[];
        }>;
      };
    }>(`/projects/${projectId}/output-format`),

  update: (projectId: string, config: { mode: string; preset?: string; customPrompt?: string; enableNarrativeMethodology?: boolean; advanced?: unknown }) =>
    http.put<{ success: boolean; data: unknown }>(`/projects/${projectId}/output-format`, config),
};

export const characterApi = {
  getByProject: (projectId: string) => http.get<ApiResponse<Character[]>>(`/characters/project/${projectId}`),
  getById: (id: string) => http.get<ApiResponse<Character>>(`/characters/${id}`),
  create: (data: Partial<Character>) => http.post<ApiResponse<Character>>('/characters', data),
  update: (id: string, data: Partial<Character>) => http.put<ApiResponse<Character>>(`/characters/${id}`, data),
  updateRelationships: (id: string, relationships: Character['relationships']) =>
    http.put<ApiResponse<Character>>(`/characters/${id}/relationships`, { relationships }),
  delete: (id: string) => http.delete<ApiResponse<void>>(`/characters/${id}`),
};

export const episodeApi = {
  getByProject: (projectId: string) => http.get<ApiResponse<Episode[]>>(`/episodes/project/${projectId}`),
  getById: (id: string) => http.get<ApiResponse<Episode>>(`/episodes/${id}`),
  getByNumber: (projectId: string, episodeNumber: number) =>
    http.get<ApiResponse<Episode>>(`/episodes/project/${projectId}/number/${episodeNumber}`),
  upsert: (projectId: string, episodeNumber: number, data: Partial<Episode>) =>
    http.put<ApiResponse<Episode>>(`/episodes/project/${projectId}/number/${episodeNumber}`, data),
  update: (id: string, data: Partial<Episode>) => http.put<ApiResponse<Episode>>(`/episodes/${id}`, data),
  delete: (id: string) => http.delete<ApiResponse<void>>(`/episodes/${id}`),
};

// SSE 流处理
export function createSSEConnection(url: string, callbacks: {
  onMessage?: (data: unknown) => void;
  onError?: (error: Error) => void;
  onDone?: () => void;
}) {
  const eventSource = new EventSource(apiUrl(url));

  eventSource.onmessage = (e) => {
    try {
      callbacks.onMessage?.(JSON.parse(e.data));
    } catch (err) {
      callbacks.onError?.(err as Error);
    }
  };

  eventSource.addEventListener('done', () => {
    callbacks.onDone?.();
    eventSource.close();
  });

  eventSource.onerror = () => {
    callbacks.onError?.(new Error('SSE 连接错误'));
    eventSource.close();
  };

  return eventSource;
}

/**
 * 统一 POST-SSE 连接（共享底层消费器）。
 * - terminalEvents 按调用方约定终止事件；默认 'done'（SSEHandler 端点）
 * - EOF 无终止 => '连接中断，未收到完成确认，可重试'；error 事件仅触发一次 onError
 * - options.signal 主动取消静默；onComplete 被 await
 */
export async function createPostSSEConnection(
  url: string,
  body: Record<string, unknown>,
  callbacks: {
    onChunk?: (text: string) => void;
    onProgress?: (data: any) => void;
    onLog?: (data: { message: string; level: string; timestamp: number }) => void;
    onContext?: (data: unknown) => void;
    onAnalysis?: (data: unknown) => void;
    onMultiHeadAnalysis?: (data: unknown) => void;
    onCharacterLifecycle?: (data: unknown) => void;
    onConstraintValidation?: (data: any) => void;
    onRetryNotification?: (data: any) => void;
    onAIConstraintDecision?: (data: any) => void;
    onComplete?: (data: unknown) => void | Promise<void>;
    onError?: (error: Error) => void;
  },
  options?: { signal?: AbortSignal; terminalEvents?: readonly string[] }
): Promise<void> {
  const progressLike = new Set([
    'start', 'progress', 'episode_start', 'episode_complete', 'episode_chunk',
    'episode_failed', 'batch_progress', 'step_start', 'step_done', 'checkpoint',
    'budgetAllocation', 'preparing', 'all_complete', 'window_start',
    'window_progress', 'init', 'multiple', 'fix', 'complete', 'done', 'result',
  ]);
  await postSSE(url, body, {
    terminalEvents: options?.terminalEvents || ['done'],
    signal: options?.signal,
    onError: (e) => callbacks.onError?.(e),
    onTerminal: async (_type, data) => { await callbacks.onComplete?.(data); },
    onEvent: (type, data) => {
      switch (type) {
        case 'chunk':
          callbacks.onChunk?.((data as any).content ?? (data as any).chunk ?? (data as any).text ?? '');
          break;
        case 'log':
          callbacks.onLog?.(data as any);
          break;
        case 'context':
          callbacks.onContext?.(data);
          break;
        case 'analysis':
          callbacks.onAnalysis?.(data);
          break;
        case 'multiHeadAnalysis':
          callbacks.onMultiHeadAnalysis?.(data);
          break;
        case 'characterLifecycle':
          callbacks.onCharacterLifecycle?.(data);
          break;
        case 'constraintValidation':
          callbacks.onConstraintValidation?.(data);
          break;
        case 'retryNotification':
          callbacks.onRetryNotification?.(data);
          break;
        case 'aiConstraintDecision':
          callbacks.onAIConstraintDecision?.(data);
          break;
        default:
          if (progressLike.has(type)) {
            callbacks.onProgress?.(data as any);
          } else {
            console.log('[SSE] 未知消息类型:', type, data);
          }
      }
    },
  });
}

export const foreshadowingApi = {
  getByProject: (projectId: string, status?: string) =>
    http.get<{ foreshadowings: Foreshadowing[] }>(`/foreshadowing/${projectId}`, {
      params: status ? { status } : undefined,
    }),

  getStats: (projectId: string, currentEpisode?: number) =>
    http.get<ForeshadowingStats>(`/foreshadowing/${projectId}/stats`, {
      params: currentEpisode ? { currentEpisode } : undefined,
    }),

  getSuggestions: (projectId: string, currentEpisode: number) =>
    http.get<ForeshadowingSuggestion>(`/foreshadowing/${projectId}/suggestions`, {
      params: { currentEpisode },
    }),

  getTimeline: (projectId: string) =>
    http.get<{ timeline: Array<{ episode: number; planted: Foreshadowing[]; resolved: Foreshadowing[] }> }>(
      `/foreshadowing/${projectId}/timeline`
    ),

  create: (data: {
    projectId: string;
    episodePlanted: number;
    content: string;
    type?: string;
    importance?: string;
  }) => http.post<{ foreshadowing: Foreshadowing }>('/foreshadowing', data),

  update: (id: string, data: Partial<Foreshadowing>) =>
    http.put<{ foreshadowing: Foreshadowing }>(`/foreshadowing/${id}`, data),

  resolve: (id: string, episodeResolved: number, resolutionNote?: string) =>
    http.post<{ foreshadowing: Foreshadowing }>(`/foreshadowing/${id}/resolve`, {
      episodeResolved,
      resolutionNote,
    }),

  abandon: (id: string, reason?: string) =>
    http.post<{ foreshadowing: Foreshadowing }>(`/foreshadowing/${id}/abandon`, { reason }),

  delete: (id: string) => http.delete<{ success: boolean }>(`/foreshadowing/${id}`),

  validate: (projectId: string, currentEpisode: number) =>
    http.post<ValidationResult>(`/foreshadowing/${projectId}/validate`, { currentEpisode }),

  analyze: (projectId: string, episodeNumber: number, scriptContent: string) =>
    http.post<{ foreshadowings: Array<{ type: string; action: string; content: string }> }>(
      `/foreshadowing/${projectId}/analyze`,
      { episodeNumber, scriptContent }
    ),

  aiDecide: (projectId: string, context: Omit<ForeshadowingContext, 'projectId'>) =>
    http.post<AIDecisionResult>(`/foreshadowing/${projectId}/ai-decide`, context),

  getConstraints: (projectId: string, context: Omit<ForeshadowingContext, 'projectId'>) =>
    http.post<OptimizedConstraints>(`/foreshadowing/${projectId}/get-constraints`, context),

  getUrgent: (projectId: string, threshold?: number) =>
    http.get<{ urgent: Foreshadowing[]; count: number }>(`/foreshadowing/${projectId}/urgent`, {
      params: threshold ? { threshold } : undefined,
    }),

  getClusters: (projectId: string) =>
    http.get<{ clusters: ForeshadowingCluster[] }>(`/foreshadowing/${projectId}/clusters`),
};

function parseValidationProgress(data: Record<string, unknown>, callbacks: {
  onInit?: (data: { episodeCount: number; characterCount: number }) => void;
  onProgress?: (data: { current: number; total: number; windowStart: number; windowEnd: number; message?: string }) => void;
}) {
  if (data.type === 'init') {
    callbacks.onInit?.({
      episodeCount: (data.totalEpisodes as number) || 0,
      characterCount: (data.characterCount as number) || 0,
    });
  } else if (data.type === 'window_start' || data.type === 'window_progress') {
    callbacks.onProgress?.({
      current: (data.windowIndex as number) || 0,
      total: (data.totalWindows as number) || 0,
      windowStart: (data.windowStart as number) || 0,
      windowEnd: (data.windowEnd as number) || 0,
      message: (data.message as string) || '',
    });
  }
}

export const validationApi = {
  validateProject: (
    projectId: string,
    callbacks: {
      onInit?: (data: { episodeCount: number; characterCount: number }) => void;
      onProgress?: (data: { current: number; total: number; windowStart: number; windowEnd: number; message?: string }) => void;
      onComplete?: (result: ValidationResult) => void;
      onError?: (error: Error) => void;
    }
  ) => createPostSSEConnection('/validation/validate', { projectId }, {
    onProgress: (data) => parseValidationProgress(data as Record<string, unknown>, callbacks),
    onComplete: (data) => {
      const d = data as Record<string, unknown>;
      const report = d.report as Record<string, unknown> | undefined;

      if (report) {
        return callbacks.onComplete?.({
          success: (d.success as boolean) || false,
          issues: (report.issues as ValidationIssue[]) || [],
          summary: (report.summary as { errors: number; warnings: number; info: number }) || { errors: 0, warnings: 0, info: 0 },
          report: {
            score: (report.score as number) || 0,
            rating: (report.rating as string) || '',
            totalIssues: (report.totalIssues as number) || 0,
            issues: (report.issues as ValidationIssue[]) || [],
            summary: (report.summary as { errors: number; warnings: number; info: number }) || { errors: 0, warnings: 0, info: 0 },
            generatedAt: report.generatedAt as string | undefined,
          },
        });
      } else {
        return callbacks.onComplete?.(data as ValidationResult);
      }
    },
    onError: callbacks.onError,
  }, { terminalEvents: ['complete'] }),

  validateRange: (
    projectId: string,
    startEpisode: number,
    endEpisode: number,
    callbacks: {
      onInit?: (data: { episodeCount: number; characterCount: number }) => void;
      onProgress?: (data: { current: number; total: number; windowStart: number; windowEnd: number; message?: string }) => void;
      onComplete?: (result: ValidationResult) => void;
      onError?: (error: Error) => void;
    }
  ) => createPostSSEConnection('/validation/validate-range', { projectId, startEpisode, endEpisode }, {
    onProgress: (data) => parseValidationProgress(data as Record<string, unknown>, callbacks),
    onComplete: (data) => {
      const d = data as Record<string, unknown>;
      return callbacks.onComplete?.({
        success: (d.success as boolean) || false,
        issues: (d.issues as ValidationIssue[]) || [],
        summary: (d.summary as { errors: number; warnings: number; info: number }) || { errors: 0, warnings: 0, info: 0 },
      });
    },
    onError: callbacks.onError,
  }, { terminalEvents: ['complete'] }),

  getWindows: (projectId: string) =>
    http.get<{ windows: Array<{ start: number; end: number }> }>(`/validation/windows/${projectId}`),

  getReports: (projectId: string) =>
    http.get<{
      reports: Array<{
        id: string;
        score: number;
        rating: string;
        totalIssues: number;
        criticalCount: number;
        warningCount: number;
        suggestionCount: number;
        createdAt: string;
      }>;
    }>(`/validation/reports/${projectId}`),

  getLatestReport: (projectId: string) =>
    http.get<{
      report: {
        id: string;
        score: number;
        rating: string;
        totalIssues: number;
        criticalCount: number;
        warningCount: number;
        suggestionCount: number;
        issues: ValidationIssue[];
        summary: { errors: number; warnings: number; info: number };
        createdAt: string;
      };
    }>(`/validation/reports/${projectId}/latest`),

  getReportDetail: (reportId: string) =>
    http.get<{
      report: {
        id: string;
        projectId: string;
        score: number;
        rating: string;
        totalIssues: number;
        criticalCount: number;
        warningCount: number;
        suggestionCount: number;
        issues: ValidationIssue[];
        summary: { errors: number; warnings: number; info: number };
        createdAt: string;
      };
    }>(`/validation/report/${reportId}`),

  deleteReport: (reportId: string) =>
    http.delete<{ success: boolean }>(`/validation/report/${reportId}`),
};

export const rewriteApi = {
  rewrite: (params: {
    projectId: string;
    episodeId: string;
    episodeNumber?: number;
    type?: string;
    instruction: string;
    selection?: { start: number; end: number; text: string };
  }) => http.post<RewriteResult>('/rewrite', { ...params, stream: false }),

  rewriteStream: (
    params: {
      projectId: string;
      episodeId: string;
      episodeNumber?: number;
      type?: string;
      instruction: string;
      selection?: { start: number; end: number; text: string };
    },
    callbacks: {
      onChunk?: (text: string) => void;
      onComplete?: (result: RewriteResult) => void;
      onError?: (error: Error) => void;
    }
  ) => createPostSSEConnection('/rewrite', { ...params, stream: true }, {
    onChunk: callbacks.onChunk,
    onComplete: (data) => callbacks.onComplete?.(data as RewriteResult),
    onError: callbacks.onError,
  }, { terminalEvents: ['result'] }),

  apply: (historyId: string, projectId: string) =>
    http.post<{ success: boolean }>(`/rewrite/apply/${historyId}`, { projectId }),

  revert: (historyId: string, projectId: string) =>
    http.post<RewriteRevertResponse>(`/rewrite/revert/${historyId}`, { projectId }),

  getHistory: (
    episodeId: string,
    projectId: string,
    options?: { type?: RewriteType; search?: string }
  ) =>
    http.get<RewriteHistoryResponse>(`/rewrite/history/${episodeId}`, {
      params: { projectId, ...options },
    }),

  getProjectHistory: (
    projectId: string,
    options?: { type?: RewriteType; search?: string }
  ) =>
    http.get<ProjectHistoryResponse>(`/rewrite/history/project/${projectId}`, {
      params: options,
    }),

  getHistoryDetail: (historyId: string, projectId: string) =>
    http.get<RewriteHistoryDetailResponse>(`/rewrite/history/detail/${historyId}`, {
      params: { projectId },
    }),

  deleteHistory: (historyId: string, projectId: string) =>
    http.delete<{ success: boolean }>(`/rewrite/history/${historyId}`, {
      data: { projectId },
    }),

  saveManualEdit: (params: {
    projectId: string;
    episodeId: string;
    episodeNumber: number;
    originalContent: string;
    modifiedContent: string;
    description?: string;
  }) => http.post<{ success: boolean; historyId?: string }>('/rewrite/manual-edit', params),

  batchRewrite: (
    projectId: string,
    episodeIds: string[],
    instruction: string,
    callbacks: {
      onProgress?: (data: { current: number; total: number; episodeNumber: number }) => void;
      onComplete?: (results: RewriteResult[]) => void;
      onError?: (error: Error) => void;
    }
  ) => createPostSSEConnection('/rewrite/batch', { projectId, episodeIds, instruction }, {
    onProgress: (data) => {
      const d = data as Record<string, unknown>;
      callbacks.onProgress?.({
        current: (d.current as number) || 0,
        total: (d.total as number) || 0,
        episodeNumber: (d.episodeNumber as number) || 0,
      });
    },
    onComplete: (data) => callbacks.onComplete?.((data as { results: RewriteResult[] }).results),
    onError: callbacks.onError,
  }, { terminalEvents: ['complete'] }),
};

export const stateApi = {
  getCharacterHistory: (characterId: string, projectId: string) =>
    http.get<{ history: CharacterState[] }>(`/state/character/${characterId}`, {
      params: { projectId },
    }),

  getCharacterLatest: (characterId: string, projectId: string) =>
    http.get<{ state: CharacterState | null }>(`/state/character/${characterId}/latest`, {
      params: { projectId },
    }),

  getCharacterAppearances: (characterId: string, projectId: string) =>
    http.get<CharacterAppearanceStats>(`/state/character/${characterId}/appearances`, {
      params: { projectId },
    }),

  getEpisodeStates: (projectId: string, episodeNumber: number) =>
    http.get<{ states: CharacterState[] }>(`/state/episode/${episodeNumber}`, {
      params: { projectId },
    }),

  getPermanentMarks: (projectId: string) =>
    http.get<{ states: CharacterState[] }>(`/state/permanent-marks/${projectId}`),

  analyze: (projectId: string, episodeNumber: number, scriptContent: string, autoUpdate?: boolean) =>
    http.post<StateAnalysisResult>('/state/analyze', {
      projectId,
      episodeNumber,
      scriptContent,
      autoUpdate,
    }),

  analyzeBatch: (
    projectId: string,
    episodes: Array<{ episode: number; content: string }>,
    callbacks: {
      onProgress?: (data: { current: number; total: number; episode: number }) => void;
      onComplete?: (results: StateAnalysisResult[]) => void;
      onError?: (error: Error) => void;
    }
  ) => createPostSSEConnection('/state/analyze-batch', { projectId, episodes }, {
    onProgress: (data) => {
      const d = data as Record<string, unknown>;
      callbacks.onProgress?.({
        current: (d.current as number) || 0,
        total: (d.total as number) || 0,
        episode: (d.episode as number) || 0,
      });
    },
    onComplete: (data) => callbacks.onComplete?.((data as { results: StateAnalysisResult[] }).results),
    onError: callbacks.onError,
  }, { terminalEvents: ['complete'] }),

  deleteAfterEpisode: (projectId: string, episodeNumber: number) =>
    http.delete<{ success: boolean; deletedCount: number }>(`/state/after/${episodeNumber}`, {
      data: { projectId },
    }),
};

export const tagApi = {
  getAll: () => http.get<{ tags: Tag[] }>('/tags'),
  getById: (id: string) => http.get<{ tag: Tag }>(`/tags/${id}`),
  create: (data: { name: string; color?: string; sortOrder?: number }) =>
    http.post<{ tag: Tag }>('/tags', data),
  update: (id: string, data: Partial<Tag>) =>
    http.put<{ tag: Tag }>(`/tags/${id}`, data),
  delete: (id: string) => http.delete<{ success: boolean }>(`/tags/${id}`),
  updateSort: (orders: { id: string; sortOrder: number }[]) =>
    http.put<{ success: boolean }>('/tags/sort', { orders }),
  getProjectTags: (projectId: string) =>
    http.get<{ tags: Tag[] }>(`/tags/project/${projectId}`),
  addToProject: (projectId: string, tagId: string) =>
    http.post<{ success: boolean }>(`/tags/project/${projectId}/${tagId}`),
  removeFromProject: (projectId: string, tagId: string) =>
    http.delete<{ success: boolean }>(`/tags/project/${projectId}/${tagId}`),
};

export const worldStateApi = {
  get: (projectId: string, episode?: number) =>
    http.get<{ exists: boolean; worldState?: IWorldState; message?: string }>(
      `/world-state/${projectId}`,
      { params: episode ? { episode } : undefined }
    ),

  initialize: (projectId: string) =>
    http.post<{ success: boolean; episodeNumber: number; characterCount: number }>(
      `/world-state/${projectId}/initialize`
    ),

  previewContext: (projectId: string, episodeNumber: number) =>
    http.post<IContextPreview>('/world-state/preview-context', { projectId, episodeNumber }),

  getAttentionHeads: (genre?: GenreType) =>
    http.get<{ genre: string; heads: IAttentionHead[] }>('/world-state/attention-heads', {
      params: genre ? { genre } : undefined,
    }),

  getRhythmPresets: () =>
    http.get<{ presets: IRhythmPreset[] }>('/world-state/rhythm-presets'),

  getRhythmConfig: (projectId: string) =>
    http.get<IRhythmConfig>(`/world-state/rhythm-config/${projectId}`),

  saveRhythmConfig: (projectId: string, data: { preset?: string; params?: Partial<IRhythmParams> }) =>
    http.post<{ success: boolean; currentPreset: string; params: IRhythmParams }>(
      `/world-state/rhythm-config/${projectId}`,
      data
    ),

  analyzeEpisode: (projectId: string, episodeNumber: number, autoUpdate = true) =>
    http.post<{ success: boolean; episodeNumber: number; analysis: unknown }>(
      '/world-state/analyze-episode',
      { projectId, episodeNumber, autoUpdate }
    ),

  analyzeBatch: (projectId: string, startEpisode: number, endEpisode: number) =>
    http.post<IBatchAnalysisResponse>('/world-state/analyze-batch', {
      projectId,
      startEpisode,
      endEpisode,
    }),

  generateEnhanced: (
    projectId: string,
    episodeNumber: number,
    callbacks: {
      onProgress?: (data: { current: number; total: number; status: string }) => void;
      onChunk?: (text: string) => void;
      onLog?: (data: { message: string; level: string; timestamp: number }) => void;
      onContext?: (data: unknown) => void;
      onAnalysis?: (data: unknown) => void;
      onMultiHeadAnalysis?: (data: unknown) => void;
      onCharacterLifecycle?: (data: unknown) => void;
      onConstraintValidation?: (data: unknown) => void;
      onRetryNotification?: (data: unknown) => void;
      onAIConstraintDecision?: (data: unknown) => void;
      onComplete?: (data: { projectId: string; episodeNumber: number; wordCount: number; validationInfo?: { satisfactionRate: number; attempts: number; criticalViolations: number; importantViolations: number } }) => void | Promise<void>;
      onError?: (error: Error) => void;
    },
    options?: { signal?: AbortSignal }
  ) =>
    createPostSSEConnection(
      '/world-state/generate-script-enhanced',
      { projectId, episodeNumber, useWorldState: true },
      {
        onProgress: callbacks.onProgress,
        onChunk: callbacks.onChunk,
        onLog: callbacks.onLog,
        onContext: callbacks.onContext,
        onAnalysis: callbacks.onAnalysis,
        onMultiHeadAnalysis: callbacks.onMultiHeadAnalysis,
        onCharacterLifecycle: callbacks.onCharacterLifecycle,
        onConstraintValidation: callbacks.onConstraintValidation,
        onRetryNotification: callbacks.onRetryNotification,
        onAIConstraintDecision: callbacks.onAIConstraintDecision,
        onComplete: (data) => callbacks.onComplete?.(data as { projectId: string; episodeNumber: number; wordCount: number; validationInfo?: { satisfactionRate: number; attempts: number; criticalViolations: number; importantViolations: number } }),
        onError: callbacks.onError,
      },
      { signal: options?.signal }
    ),
};

export interface IGenerationLog {
  _id: string;
  projectId: string;
  episodeNumber: number;
  context: {
    episodePlan: string;
    formattedContext: string;
    constraints: string[];
    suggestions: string[];
    relevantCharacters: Array<{
      name: string;
      role: string;
      tier: string;
      weight: number;
      reason: string;
    }>;
    relevantForeshadowings: Array<{
      content: string;
      weight: number;
      reason: string;
      episodePlanted?: number;
      importance?: string;
    }>;
    previousCliffhanger?: string;
    rhythmSettings?: Record<string, unknown>;
  };
  multiHeadAnalysis?: Record<string, unknown>;
  constraintValidation?: Record<string, unknown>;
  analysis?: Record<string, unknown>;
  characterLifecycle?: Record<string, unknown>;
  retryInfo?: {
    totalAttempts: number;
    retryReasons: string[];
    strengthenedConstraints: string[];
  };
  logs: Array<{
    time: string;
    message: string;
    level: 'info' | 'warn' | 'error';
  }>;
  status: 'success' | 'partial_success' | 'failed';
  wordCount: number;
  generationDuration: number;
  createdAt: string;
  updatedAt: string;
}

export const generationLogApi = {
  getByEpisode: (projectId: string, episodeNumber: number) =>
    http.get<{ exists: boolean; log?: IGenerationLog; message?: string }>(
      `/world-state/generation-log/${projectId}/${episodeNumber}`
    ),

  getByProject: (projectId: string, page = 1, limit = 20) =>
    http.get<{ logs: IGenerationLog[]; total: number; pages: number }>(
      `/world-state/generation-logs/${projectId}`,
      { params: { page, limit } }
    ),

  getStats: (projectId: string) =>
    http.get<{
      totalGenerated: number;
      averageSatisfactionRate: number;
      totalRetries: number;
      averageDuration: number;
    }>(`/world-state/generation-stats/${projectId}`),
};

export interface IAttentionHeadInfo {
  type: string;
  weight: number;
}

export interface IAttentionHeadConfig {
  type: string;
  name: string;
  description: string;
  category: string;
  weight: number;
  required: boolean;
}

export interface IProjectAttentionConfig {
  mode: 'auto' | 'custom';
  enabledHeads?: string[];
  headWeights?: Record<string, number>;
}

export const attentionApi = {
  getHeads: (genre?: string) =>
    http.get<{
      genre: string;
      heads: IAttentionHeadInfo[];
    }>('/world-state/attention-heads', { params: { genre } }),

  getAllHeads: () =>
    http.get<{
      heads: IAttentionHeadConfig[];
      genreMapping: Record<string, string[]>;
    }>('/world-state/attention-heads/all'),

  getConfig: (projectId: string) =>
    http.get<{
      projectId: string;
      projectType: string;
      genre: string;
      config: IProjectAttentionConfig;
      effectiveHeads: string[];
      headsSource: 'ai' | 'custom' | 'fallback';
      fallbackHeads: string[];
      defaultHeads?: string[];
      aiRecommendation: {
        recommendedHeads: string[];
        reasons: Array<{ head: string; reason: string }>;
        identifiedElements: string[];
        analyzedAt?: string;
      } | null;
    }>(`/world-state/attention-config/${projectId}`),

  saveConfig: (projectId: string, config: IProjectAttentionConfig) =>
    http.post<{ success: boolean; config: IProjectAttentionConfig }>(
      `/world-state/attention-config/${projectId}`,
      config
    ),

  recommendHeads: (projectId: string, forceRefresh = false) =>
    http.post<{
      success: boolean;
      cached: boolean;
      recommendation: {
        recommendedHeads: string[];
        reasons: Array<{ head: string; reason: string }>;
        identifiedElements: string[];
        summary: string;
        analyzedAt?: string;
      };
    }>(`/world-state/attention-recommend/${projectId}`, { forceRefresh }),
};

import type {
  BatchRewriteHistory,
  BatchRewriteResult,
  EpisodeRewriteResult,
  RewritePlan,
} from '@/types';

export const batchRewriteApi = {
  generatePlan: async (
    params: {
      projectId: string;
      episodeRange: { start: number; end: number };
      instruction: string;
    },
    callbacks: {
      onProgress?: (stage: string, detail: string) => void;
      onChunk?: (chunk: string) => void;
      onComplete?: (plan: RewritePlan) => void;
      onError?: (error: Error) => void;
    }
  ): Promise<void> => {
    await createPostSSEConnection('/batch-rewrite/plan', params as unknown as Record<string, unknown>, {
      onProgress: (data: any) => {
        if (data.type === 'progress') callbacks.onProgress?.(data.stage, data.detail);
      },
      onChunk: (text) => callbacks.onChunk?.(text),
      onComplete: (data: any) => {
        if (data.plan) return callbacks.onComplete?.(data.plan);
      },
      onError: callbacks.onError,
    }, { terminalEvents: ['done'] });
  },

  execute: async (
    projectId: string,
    plan: RewritePlan,
    callbacks: {
      onPreparing?: (message: string) => void;
      onEpisodeStart?: (episodeNumber: number, total: number) => void;
      onEpisodeChunk?: (episodeNumber: number, chunk: string) => void;
      onEpisodeComplete?: (result: EpisodeRewriteResult) => void;
      onEpisodeFailed?: (episodeNumber: number, error: string) => void;
      onAllComplete?: (result: BatchRewriteResult) => void;
      onError?: (error: Error) => void;
    }
  ): Promise<void> => {
    await createPostSSEConnection('/batch-rewrite/execute', { projectId, plan } as unknown as Record<string, unknown>, {
      onProgress: (data: any) => {
        switch (data.type) {
          case 'preparing': callbacks.onPreparing?.(data.message); break;
          case 'episode_start': callbacks.onEpisodeStart?.(data.episodeNumber, data.total); break;
          case 'episode_chunk': callbacks.onEpisodeChunk?.(data.episodeNumber, data.chunk); break;
          case 'episode_complete': callbacks.onEpisodeComplete?.(data.result); break;
          case 'episode_failed': callbacks.onEpisodeFailed?.(data.episodeNumber, data.error); break;
          // 注：all_complete 为服务端中间事件，最终完成仅由终止事件 done 触发一次
        }
      },
      onComplete: (data: any) => {
        if (data.result) return callbacks.onAllComplete?.(data.result);
      },
      onError: callbacks.onError,
    }, { terminalEvents: ['done'] });
  },

  apply: (params: {
    projectId: string;
    historyId: string;
    selectedEpisodes?: number[];
  }) => http.post<{ success: boolean; appliedCount: number }>('/batch-rewrite/apply', params),

  rollback: (params: {
    projectId: string;
    historyId: string;
  }) => http.post<{ success: boolean; rolledBackCount: number }>('/batch-rewrite/rollback', params),

  getHistory: (
    projectId: string,
    options?: {
      startDate?: string;
      endDate?: string;
      episodeStart?: number;
      episodeEnd?: number;
    }
  ) => http.get<{ success: boolean; history: BatchRewriteHistory[] }>('/batch-rewrite/history', {
    params: { projectId, ...options },
  }),

  getHistoryDetail: (historyId: string, projectId: string) =>
    http.get<{ success: boolean; history: BatchRewriteHistory }>(`/batch-rewrite/history/${historyId}`, {
      params: { projectId },
    }),

  deleteHistory: (historyId: string, projectId: string) =>
    http.delete<{ success: boolean }>(`/batch-rewrite/history/${historyId}`, {
      data: { projectId },
    }),
};

import type {
  GrowthEventType,
  GrowthStage,
  ICharacterArc,
  ICharacterCharm,
  ICharacterRelationshipData,
  ICharacterVoice,
  ImpressiveMomentType,
  RelationshipEventType,
  RelationshipImpact,
  RelationshipLevel,
} from '@/types';

export interface ICharacterEnhancementResponse {
  _id: string;
  characterId: string;
  characterName: string;
  charm: ICharacterCharm;
  arc: ICharacterArc;
  voice: ICharacterVoice;
  createdAt: string;
  updatedAt: string;
}

export const characterEnhancementApi = {
  get: (characterId: string, projectId: string) =>
    http.get<{ success: boolean; exists: boolean; enhancement: ICharacterEnhancementResponse | null }>(
      `/character-enhancement/${characterId}`,
      { params: { projectId } }
    ),

  getByProject: (projectId: string) =>
    http.get<{ success: boolean; enhancements: ICharacterEnhancementResponse[] }>(
      `/character-enhancement/project/${projectId}`
    ),

  updateCharm: (characterId: string, data: {
    projectId: string;
    characterName: string;
    charm: Partial<ICharacterCharm>;
  }) => http.put<{ success: boolean; charm: ICharacterCharm }>(
    `/character-enhancement/${characterId}/charm`,
    data
  ),

  recordImpressiveMoment: (characterId: string, data: {
    projectId: string;
    characterName: string;
    episode: number;
    description: string;
    type: ImpressiveMomentType;
  }) => http.post<{ success: boolean }>(
    `/character-enhancement/${characterId}/impressive-moment`,
    data
  ),

  updateStage: (characterId: string, data: {
    projectId: string;
    characterName: string;
    stage: GrowthStage;
    trigger: string;
    episode: number;
  }) => http.put<{ success: boolean }>(
    `/character-enhancement/${characterId}/arc/stage`,
    data
  ),

  recordTurningPoint: (characterId: string, data: {
    projectId: string;
    characterName: string;
    episode: number;
    event: string;
    impact: string;
    beforeState?: string;
    afterState?: string;
  }) => http.post<{ success: boolean }>(
    `/character-enhancement/${characterId}/arc/turning-point`,
    data
  ),

  recordGrowthEvent: (characterId: string, data: {
    projectId: string;
    characterName: string;
    episode: number;
    type: GrowthEventType;
    description: string;
  }) => http.post<{ success: boolean }>(
    `/character-enhancement/${characterId}/arc/growth-event`,
    data
  ),

  updateVoice: (characterId: string, data: {
    projectId: string;
    characterName: string;
    voice: Partial<ICharacterVoice>;
  }) => http.put<{ success: boolean; voice: ICharacterVoice }>(
    `/character-enhancement/${characterId}/voice`,
    data
  ),

  getRelationships: (characterId: string, projectId: string) =>
    http.get<{ success: boolean; relationships: ICharacterRelationshipData[] }>(
      `/character-enhancement/${characterId}/relationships`,
      { params: { projectId } }
    ),

  getProjectRelationships: (projectId: string) =>
    http.get<{ success: boolean; relationships: ICharacterRelationshipData[] }>(
      `/character-enhancement/relationships/project/${projectId}`
    ),

  updateRelationship: (data: {
    projectId: string;
    charAId: string;
    charBId: string;
    charAName: string;
    charBName: string;
    level: RelationshipLevel;
    event: string;
    episode: number;
  }) => http.put<{ success: boolean }>('/character-enhancement/relationship', data),

  recordRelationshipEvent: (data: {
    projectId: string;
    charAId: string;
    charBId: string;
    charAName: string;
    charBName: string;
    episode: number;
    type: RelationshipEventType;
    description: string;
    impact: RelationshipImpact;
  }) => http.post<{ success: boolean }>('/character-enhancement/relationship/key-event', data),

  getStagnantRelationships: (projectId: string, currentEpisode: number) =>
    http.get<{
      success: boolean;
      stagnant: Array<{ charAName: string; charBName: string; episodesSince: number; suggestion: string }>;
    }>(`/character-enhancement/relationships/stagnant/${projectId}`, {
      params: { currentEpisode },
    }),

  getInitStatus: (projectId: string) =>
    http.get<{
      success: boolean;
      data: {
        totalCharacters: number;
        initializedCount: number;
        uninitializedCount: number;
        characters: Array<{ name: string; characterId: string; initialized: boolean }>;
      };
    }>(`/character-enhancement/${projectId}/init-status`),

  batchInitUrl: (projectId: string) => `/character-enhancement/${projectId}/batch-init-stream`,

  initSingle: (characterId: string, projectId: string) =>
    http.post<{
      success: boolean;
      error?: string;
      charm?: ICharacterCharm;
      voice?: ICharacterVoice;
    }>(`/character-enhancement/${characterId}/init`, { projectId }),

  batchConfirm: (projectId: string, characters: Array<{
    characterId: string;
    characterName: string;
    charm: ICharacterCharm;
    voice: ICharacterVoice;
  }>) =>
    http.post<{
      success: boolean;
      message: string;
      successCount: number;
      failCount: number;
    }>(`/character-enhancement/${projectId}/batch-confirm`, { characters }),
};

import type {
  FixAnalysisResult,
  FixHistory,
  FixHistoryStats,
  FixPlan,
  CrossEpisodeAnalysisResult,
  CrossEpisodeFixPlan,
  AffectedEpisode,
  RelatedForeshadowing,
  MultiEpisodeFixResult,
  TargetedValidationResult,
} from '@/types/fix';

export const fixApi = {
  analyze: (
    projectId: string,
    issue: ValidationIssue,
    callbacks?: {
      onProgress?: (message: string) => void;
      onComplete?: (result: FixAnalysisResult) => void;
      onError?: (error: Error) => void;
    }
  ) => createPostSSEConnection('/fix/analyze', { projectId, issue }, {
    onProgress: (data) => {
      const d = data as Record<string, unknown>;
      if (d.type === 'start' || d.type === 'progress') {
        callbacks?.onProgress?.((d.message as string) || '');
      }
    },
    onComplete: (data) => {
      const d = data as Record<string, unknown>;
      return callbacks?.onComplete?.({
        success: (d.success as boolean) || false,
        analysis: (d.analysis as string) || '',
        affectedEpisodes: (d.affectedEpisodes as number[]) || undefined,
        plans: (d.plans as FixPlan[]) || [],
      });
    },
    onError: callbacks?.onError,
  }, { terminalEvents: ['complete'] }),

  execute: (
    projectId: string,
    plan: FixPlan,
    episodeNumber: number,
    customInstruction?: string,
    callbacks?: {
      onProgress?: (data: { content: string; percent: number }) => void;
      onComplete?: (result: { originalContent: string; fixedContent: string; wordCountDiff: number }) => void;
      onError?: (error: Error) => void;
    }
  ) => createPostSSEConnection('/fix/execute', {
    projectId,
    plan,
    episodeNumber,
    customInstruction,
  }, {
    onProgress: (data) => {
      const d = data as Record<string, unknown>;
      if (d.type === 'progress') {
        callbacks?.onProgress?.({
          content: (d.content as string) || '',
          percent: (d.percent as number) || 0,
        });
      }
    },
    onComplete: (data) => {
      const d = data as Record<string, unknown>;
      if (d.type === 'complete' && d.result) {
        const result = d.result as Record<string, unknown>;
        return callbacks?.onComplete?.({
          originalContent: (result.originalContent as string) || '',
          fixedContent: (result.fixedContent as string) || '',
          wordCountDiff: (result.wordCountDiff as number) || 0,
        });
      }
    },
    onError: callbacks?.onError,
  }, { terminalEvents: ['complete'] }),

  apply: (data: {
    projectId: string;
    episodeId: string;
    episodeNumber: number;
    originalContent: string;
    fixedContent: string;
    issue?: ValidationIssue;
    plan?: FixPlan;
  }) => http.post<{ success: boolean; historyId: string }>('/fix/apply', data),

  revert: (historyId: string) =>
    http.post<{ success: boolean }>('/fix/revert', { historyId }),

  batchAnalyze: (
    projectId: string,
    issues: ValidationIssue[],
    callbacks?: {
      onProgress?: (data: { current: number; total: number; episode: number; message: string }) => void;
      onComplete?: (results: Array<{ analysis: string; plans: FixPlan[] }>) => void;
      onError?: (error: Error) => void;
    }
  ) => createPostSSEConnection('/fix/batch-analyze', { projectId, issues }, {
    onProgress: (data) => {
      const d = data as Record<string, unknown>;
      if (d.type === 'progress' || d.type === 'episode_done') {
        callbacks?.onProgress?.({
          current: (d.current as number) || 0,
          total: (d.total as number) || 0,
          episode: (d.episode as number) || 0,
          message: (d.message as string) || '',
        });
      }
    },
    onComplete: (data) => {
      const d = data as Record<string, unknown>;
      if (d.results) {
        return callbacks?.onComplete?.(d.results as Array<{ analysis: string; plans: FixPlan[] }>);
      }
    },
    onError: callbacks?.onError,
  }, { terminalEvents: ['complete'] }),

  getHistory: (projectId: string) =>
    http.get<{ history: FixHistory[]; stats: FixHistoryStats }>(`/fix/history/${projectId}`),

  analyzeCrossEpisode: (
    projectId: string,
    issue: ValidationIssue,
    callbacks?: {
      onProgress?: (message: string) => void;
      onComplete?: (result: CrossEpisodeAnalysisResult) => void;
      onError?: (error: Error) => void;
    }
  ) => createPostSSEConnection('/fix/cross-episode/analyze', { projectId, issue }, {
    onProgress: (data) => {
      const d = data as Record<string, unknown>;
      if (d.type === 'start' || d.type === 'progress') {
        callbacks?.onProgress?.((d.message as string) || '');
      }
    },
    onComplete: (data) => {
      const d = data as Record<string, unknown>;
      return callbacks?.onComplete?.({
        success: (d.success as boolean) || false,
        analysis: (d.analysis as string) || '',
        affectedEpisodes: (d.affectedEpisodes as AffectedEpisode[]) || [],
        plans: (d.plans as CrossEpisodeFixPlan[]) || [],
        relatedForeshadowings: (d.relatedForeshadowings as RelatedForeshadowing[]) || [],
      });
    },
    onError: callbacks?.onError,
  }, { terminalEvents: ['complete'] }),

  executeCrossEpisode: (
    projectId: string,
    plan: CrossEpisodeFixPlan,
    customInstruction?: string,
    callbacks?: {
      onStart?: (data: { totalEpisodes: number; episodes: number[] }) => void;
      onEpisodeStart?: (episodeNumber: number) => void;
      onProgress?: (data: { content: string; percent: number }) => void;
      onEpisodeComplete?: (data: { episodeNumber: number; fixedContent: string }) => void;
      onComplete?: (results: MultiEpisodeFixResult[]) => void;
      onError?: (error: Error) => void;
    }
  ) => createPostSSEConnection('/fix/cross-episode/execute', {
    projectId,
    plan,
    customInstruction,
  }, {
    onProgress: (data) => {
      const d = data as Record<string, unknown>;
      if (d.type === 'start') {
        callbacks?.onStart?.({
          totalEpisodes: (d.totalEpisodes as number) || 0,
          episodes: (d.episodes as number[]) || [],
        });
      } else if (d.type === 'episode_start') {
        callbacks?.onEpisodeStart?.((d.episodeNumber as number) || 0);
      } else if (d.type === 'progress') {
        callbacks?.onProgress?.({
          content: (d.content as string) || '',
          percent: (d.percent as number) || 0,
        });
      } else if (d.type === 'episode_complete') {
        callbacks?.onEpisodeComplete?.({
          episodeNumber: (d.episodeNumber as number) || 0,
          fixedContent: (d.fixedContent as string) || '',
        });
      }
    },
    onComplete: (data) => {
      const d = data as Record<string, unknown>;
      return callbacks?.onComplete?.((d.results as MultiEpisodeFixResult[]) || []);
    },
    onError: callbacks?.onError,
  }, { terminalEvents: ['complete'] }),

  applyCrossEpisode: (data: {
    projectId: string;
    fixResults: MultiEpisodeFixResult[];
    issue: { type: string; description: string; episode: number; evidence?: string };
    plan: CrossEpisodeFixPlan;
    excludeEpisodes?: number[];
  }) => http.post<{
    success: boolean;
    masterHistoryId: string;
    appliedEpisodes: number[];
    historyIds: string[];
    relatedForeshadowings?: RelatedForeshadowing[];
  }>('/fix/cross-episode/apply', data),

  validateCrossEpisode: (data: {
    projectId: string;
    originalIssue: { type: string; description: string; episode: number; evidence?: string };
    affectedEpisodes: number[];
  }) => http.post<{
    success: boolean;
    validation: TargetedValidationResult;
  }>('/fix/cross-episode/validate', data),

  updateForeshadowing: (updates: Array<{ foreshadowingId: string; newStatus: string }>) =>
    http.post<{ success: boolean; updatedCount: number }>('/fix/cross-episode/update-foreshadowing', { updates }),

  revertCrossEpisode: (masterHistoryId: string, episodesToRevert?: number[]) =>
    http.post<{
      success: boolean;
      revertedEpisodes: number[];
      affectedHistoryIds: string[];
    }>('/fix/cross-episode/revert', { masterHistoryId, episodesToRevert }),

  getCrossEpisodeHistory: (projectId: string) =>
    http.get<{
      success: boolean;
      history: Array<{
        masterHistoryId: string;
        issue: { type: string; description: string; sourceEpisode: number };
        plan: { id: string; name: string; description: string; confidence: number };
        affectedEpisodes: number[];
        appliedAt: string;
        status: 'applied' | 'reverted' | 'partial';
        canRevert: boolean;
        validation?: TargetedValidationResult;
      }>;
    }>(`/fix/cross-episode/history/${projectId}`),
};

export interface AIModel {
  name: string;
  displayName: string;
  provider: 'claude' | 'openai';
  brand: string;
  model: string;
  configured: boolean;
  unavailableReason?: string;
}

export interface CurrentModelInfo {
  name: string;
  displayName: string;
  provider: 'claude' | 'openai';
  model: string;
}

export const aiModelApi = {
  getModels: () =>
    http.get<{ models: AIModel[]; currentModel: string }>('/ai/models'),

  getCurrentModel: () =>
    http.get<CurrentModelInfo>('/ai/models/current'),

  switchModel: (modelName: string) =>
    http.post<{ success: boolean; currentModel: CurrentModelInfo }>('/ai/models/switch', { modelName }),

  testModel: (modelName?: string) =>
    http.post<{ success: boolean; message: string; latency?: number }>('/ai/models/test', { modelName }, { timeout: 45000 }),
};

export default http;
