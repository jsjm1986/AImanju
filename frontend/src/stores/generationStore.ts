/**
 * 生成过程状态管理
 * 管理剧本生成的进度、日志、上下文和分析结果
 * 支持状态持久化，切换页面后保留生成记录
 */

import { episodeApi, worldStateApi } from '@/services/api';
import { humanizeError } from '@/services/apiConfig';
import type {
  IContextPreview,
  IGenerationProgress,
} from '@/types';
import { defineStore } from 'pinia';
import { computed, ref, watch, onScopeDispose } from 'vue';


// 日志条目类型
interface ILogEntry {
  time: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}

// 详细的角色信息（扩展版）
interface ICharacterDetail {
  name: string;
  role: string;
  tier: string;
  weight: number;
  reason: string;
  equipment?: string[];
  abilities?: string[];
  physicalCondition?: string;
  mentalCondition?: string;
  combatPower?: string;
  location?: string;
  permanentMarks?: string[];
  relationships?: Record<string, string>;
}

// 详细的伏笔信息
interface IForeshadowingDetail {
  content: string;
  weight: number;
  reason: string;
  episodePlanted?: number;
  importance?: string;
}

// 详细的事件信息
interface IEventDetail {
  episode?: number;
  content: string;
  weight?: number;
  reason?: string;
}

// 剧情状态信息
interface IPlotState {
  currentArc: string;
  arcProgress: number;
  mainPlotProgress?: string;
  pendingConflicts: string[];
  recentEvents: Array<{ episode: number; event: string }>;
}

// 世界设定信息
interface IWorldSettings {
  revealedSecrets: string[];
  factions: Array<{ name: string; status: string; attitude: string }>;
  locations: Array<{ name: string; description: string }>;
  items: Array<{ name: string; owner: string; status: string }>;
}

// 节奏设置信息
interface IRhythmSettings {
  preset: string;
  coolPointDensity: number;
  plotTwistInterval: number;
  faceSlapInterval: number;
}

// 写作风格信息
interface IWritingStyle {
  preset: string;
  presetName: string;
  customDescription?: string;
}

// 上下文信息类型（完整版）
interface IContextInfo {
  // 本集梗概
  episodePlan?: string;
  constraints: string[];
  suggestions: string[];
  // 详细的角色信息（包含权重和原因）
  relevantCharacters: ICharacterDetail[];
  // 详细的伏笔信息（包含权重和原因）
  relevantForeshadowings: IForeshadowingDetail[];
  // 相关事件
  relevantEvents?: IEventDetail[];
  // 隐藏关联
  hiddenConnections: string[];
  // 剧情状态
  plotState?: IPlotState;
  // 世界设定
  worldSettings?: IWorldSettings;
  // 节奏设置
  rhythmSettings?: IRhythmSettings;
  // 写作风格
  writingStyle?: IWritingStyle;
  // 上集悬念
  previousCliffhanger?: string | null;
  // 格式化的世界状态信息（"世界信息"，完整的上下文文本）
  formattedContext?: string;
}

// 剧情更新信息
interface IPlotUpdates {
  currentArc: string;
  arcProgress: number;
  keyEvent: string;
  newConflict: string | null;
  resolvedConflict: string | null;
  cliffhanger: string;
}

// 世界更新信息
interface IWorldUpdates {
  newSecrets: string[];
  factionChanges: Array<{ faction: string; change: string }>;
  newLocations: Array<{ name: string; description: string }>;
  itemChanges: Array<{ item: string; change: string }>;
}

// 本集摘要
interface IEpisodeSummary {
  summary: string;
  keyEvents: string[];
  cliffhanger: string;
}

// 下集提示
interface INextEpisodeHints {
  suggestedFocus: string[];
  pendingForeshadowings: string[];
  charactersThatShouldAppear: string[];
}

// 角色退场
interface ICharacterExit {
  name: string;
  exitType: 'deceased' | 'departed' | 'archived';
  note: string;
}

// 分析结果类型（完整版）
interface IAnalysisInfo {
  // 基础统计
  characterUpdates: number;
  newCharacters: Array<{ name: string; tier: string; role?: string }>;
  foreshadowingResolved: number;
  foreshadowingPlanted: Array<{ content: string; type: string; importance?: string }>;
  // 剧情更新
  plotUpdates?: IPlotUpdates;
  // 世界更新
  worldUpdates?: IWorldUpdates;
  // 本集摘要
  episodeSummary?: IEpisodeSummary;
  // 下集提示
  nextEpisodeHints?: INextEpisodeHints;
  // 角色退场
  characterExits?: ICharacterExit[];
}

// 多头注意力分析结果
interface IMultiHeadAnalysis {
  enabledHeads: string[];
  headResults: Array<{
    headType: string;
    insights: string[];
    suggestions: string[];
    constraints: string[];
    warnings: string[];
  }>;
  crossDimensionInsights: string[];
  aggregatedConstraints: string[];
  aggregatedSuggestions: string[];
}

// 角色生命周期变化
interface ICharacterLifecycle {
  tierChanges: Array<{
    name: string;
    from: string;
    to: string;
    reason: string;
  }>;
  newCharactersToTrack: Array<{
    name: string;
    tier: string;
  }>;
  archivedCharacters: string[];
}

// 约束验证结果
interface IConstraintValidationResult {
  constraintId: string;
  constraintType: string;
  constraintContent: string;
  fulfilled: boolean;
  confidence: number;
  evidence: string | null;
  reasoning: string;
  severity: string;
  suggestions?: string[];
}

// 约束验证响应
interface IConstraintValidation {
  overallSatisfied: boolean;
  satisfactionRate: number;
  criticalViolations: number;
  importantViolations: number;
  normalViolations: number;
  results: IConstraintValidationResult[];
  summary: string;
  improvementSuggestions: string[];
  retryInfo?: {
    attemptNumber: number;
    maxAttempts: number;
    reason: string;
  };
}

// 重试通知
interface IRetryNotification {
  attemptNumber: number;
  maxAttempts: number;
  reason: string;
  strengthenedConstraints: string[];
}

// 节奏决策详情
interface IRhythmDecisionDetail {
  needed: boolean;
  urgency: string;
  reason: string;
  subject?: string;
  object?: string;
  methodology?: string[];
  validationCriteria?: string[];
}

// 伏笔详情
interface IForeshadowingResolveDetail {
  id: string;
  content: string;
  reason: string;
  urgency: string;
  episodePlanted?: number;
  originalHint?: string;
  methodology?: string[];
  validationCriteria?: string[];
}

// AI 约束决策结果
interface IAIConstraintDecision {
  rhythm: {
    faceSlap: IRhythmDecisionDetail;
    plotTwist: IRhythmDecisionDetail;
    boss: IRhythmDecisionDetail;
    guidanceNotes?: string[];  // 节奏指导建议
  };
  foreshadowing: {
    mustResolveCount: number;
    canResolveCount: number;
    shouldIgnoreCount: number;
    mustResolve: IForeshadowingResolveDetail[];
    canResolve?: Array<{ content: string; reason: string }>;  // 可以回收的伏笔
    shouldIgnore?: Array<{ content: string; reason: string }>;  // 暂时忽略的伏笔
  };
  cliffhanger: {
    mustContinue: boolean;
    content: string | null;
    reason: string;
  };
  characterStatesCount: number;
  characterStates?: Array<{ name: string; condition: string; mustShow: boolean; reason: string }>;  // 角色状态详情
  worldConsistencyCount: number;
  worldConsistency?: Array<{ content: string; severity: string; reason: string }>;  // 世界一致性约束详情
  summary: string;
  stats: {
    totalConstraints: number;
    verifiableCount: number;
    guidanceCount: number;
    criticalCount: number;
    importantCount: number;
    normalCount?: number;
  };
}

// 预算分配结果
interface IBudgetAllocation {
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
interface IBudgetAdjustmentReason {
  module: string;
  adjustment: number;
  reason: string;
}

// 预算分配信息
interface IBudgetAllocationInfo {
  allocation: IBudgetAllocation;
  adjustmentReasons: IBudgetAdjustmentReason[];
}

export const useGenerationStore = defineStore('generation', () => {
  // ===== 状态 =====
  const isGenerating = ref(false);
  const progress = ref<IGenerationProgress>({
    current: 0,
    total: 100,
    step: '',
    message: '',
  });

  // 当前生成的项目和集数信息（用于浮动窗口导航）
  const currentProjectId = ref<string | null>(null);
  const currentEpisodeNumber = ref<number | null>(null);

  // 实时日志
  const logs = ref<ILogEntry[]>([]);

  // 上下文信息（从 SSE 实时获取）
  const context = ref<IContextInfo | null>(null);

  // 分析结果（生成完成后从 SSE 获取）
  const analysis = ref<IAnalysisInfo | null>(null);

  // 多头注意力分析结果
  const multiHeadAnalysis = ref<IMultiHeadAnalysis | null>(null);

  // 角色生命周期变化
  const characterLifecycle = ref<ICharacterLifecycle | null>(null);

  // 约束验证结果
  const constraintValidation = ref<IConstraintValidation | null>(null);

  // AI 约束决策结果
  const aiConstraintDecision = ref<IAIConstraintDecision | null>(null);

  // 预算分配信息
  const budgetAllocation = ref<IBudgetAllocationInfo | null>(null);

  // 重试通知历史
  const retryNotifications = ref<IRetryNotification[]>([]);

  // 上下文预览（用于手动预览，可能会移除）
  const contextPreview = ref<IContextPreview | null>(null);

  // 生成的内容
  const generatedContent = ref('');
  const wordCount = ref(0);

  // 错误信息
  const error = ref<string | null>(null);

  // ===== 持久化存储 =====
  const STORAGE_KEY = 'generation-store-state';

  // 从 localStorage 加载状态
  function loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.logs) logs.value = data.logs;
        if (data.context) context.value = data.context;
        if (data.analysis) analysis.value = data.analysis;
        if (data.multiHeadAnalysis) multiHeadAnalysis.value = data.multiHeadAnalysis;
        if (data.characterLifecycle) characterLifecycle.value = data.characterLifecycle;
        if (data.constraintValidation) constraintValidation.value = data.constraintValidation;
        if (data.aiConstraintDecision) aiConstraintDecision.value = data.aiConstraintDecision;
        if (data.budgetAllocation) budgetAllocation.value = data.budgetAllocation;
        if (data.retryNotifications) retryNotifications.value = data.retryNotifications;
        if (data.wordCount) wordCount.value = data.wordCount;
        if (data.progress) progress.value = data.progress;
        // 不恢复 generatedContent 以节省空间，不恢复 isGenerating
        console.log('[GenerationStore] 已从 localStorage 恢复状态');
      }
    } catch (e) {
      console.warn('[GenerationStore] 加载存储状态失败:', e);
    }
  }

  // 保存状态到 localStorage
  function saveToStorage() {
    try {
      const data = {
        logs: logs.value,
        context: context.value,
        analysis: analysis.value,
        multiHeadAnalysis: multiHeadAnalysis.value,
        characterLifecycle: characterLifecycle.value,
        constraintValidation: constraintValidation.value,
        aiConstraintDecision: aiConstraintDecision.value,
        budgetAllocation: budgetAllocation.value,
        retryNotifications: retryNotifications.value,
        wordCount: wordCount.value,
        progress: progress.value,
        savedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[GenerationStore] 保存状态失败:', e);
    }
  }

  // 初始化时加载存储的状态
  loadFromStorage();

  // 监听状态变化并保存（防抖）
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  const stopWatch = watch(
    [logs, context, analysis, multiHeadAnalysis, characterLifecycle, constraintValidation, aiConstraintDecision, budgetAllocation, retryNotifications, wordCount, progress],
    () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(saveToStorage, 500);
    },
    { deep: true, flush: 'post' }
  );

  onScopeDispose(() => {
    stopWatch();
    if (saveTimeout) clearTimeout(saveTimeout);
  });

  // ===== 计算属性 =====

  // 进度百分比
  const progressPercent = computed(() => {
    if (progress.value.total === 0) return 0;
    return Math.round((progress.value.current / progress.value.total) * 100);
  });

  // 所有约束
  const allConstraints = computed(() => {
    return context.value?.constraints || [];
  });

  // 所有建议
  const allSuggestions = computed(() => {
    return context.value?.suggestions || [];
  });

  // 验证是否通过
  const validationPassed = computed(() => {
    return constraintValidation.value?.overallSatisfied ?? true;
  });

  // 验证满足率
  const validationRate = computed(() => {
    return constraintValidation.value?.satisfactionRate ?? 1;
  });

  // 未满足的约束
  const unfulfilledConstraints = computed(() => {
    return constraintValidation.value?.results.filter((r) => !r.fulfilled) || [];
  });

  // 关键违规数
  const criticalViolations = computed(() => {
    return constraintValidation.value?.criticalViolations ?? 0;
  });

  // ===== 方法 =====

  // 添加日志
  function addLog(message: string, level: 'info' | 'warn' | 'error' = 'info') {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    logs.value.push({ time, message, level });
  }

  // 预览上下文（保留兼容性）
  async function previewContext(projectId: string, episodeNumber: number) {
    try {
      const { data } = await worldStateApi.previewContext(projectId, episodeNumber);
      contextPreview.value = data;
      return data;
    } catch (e) {
      error.value = (e as { friendlyMessage?: string })?.friendlyMessage || humanizeError(e);
      return null;
    }
  }

  // 私有的连接控制（不再使用 window 全局）与运行标识：旧回调不会写入新运行
  let abortController: AbortController | null = null;
  let runSeq = 0;

  // 开始生成；返回 true 表示收到服务端 done（终态成功），停止/失败返回 false
  async function startGeneration(projectId: string, episodeNumber: number): Promise<boolean> {
    if (isGenerating.value) {
      addLog('⚠️ 已有正在进行的生成，忽略重复启动', 'warn');
      return false;
    }
    // 重置状态
    resetGenerationState();
    isGenerating.value = true;
    const myRun = ++runSeq;
    abortController = new AbortController();
    let doneOk = false;
    // 保存当前生成的项目和集数信息
    currentProjectId.value = projectId;
    currentEpisodeNumber.value = episodeNumber;
    // 同时保存到 localStorage 供浮动窗口使用
    localStorage.setItem('last-project-id', projectId);
    addLog(`开始生成第${episodeNumber}集剧本...`);

    try {
      await worldStateApi.generateEnhanced(projectId, episodeNumber, {
        onProgress: (data) => {
          if (myRun !== runSeq) return;
          progress.value = {
            current: data.current,
            total: data.total,
            step: '',
            message: data.status,
          };
        },
        onLog: (data) => {
          if (myRun !== runSeq) return;
          addLog(data.message, data.level as 'info' | 'warn' | 'error');
        },
        onContext: (data: any) => {
          if (myRun !== runSeq) return;
          context.value = data;
          const charCount = data.relevantCharacters?.length || 0;
          const foreCount = data.relevantForeshadowings?.length || 0;
          addLog(`📋 上下文构建完成：${charCount}个角色, ${foreCount}个伏笔`);
          if (data.rhythmSettings) {
            addLog(`📋 节奏预设: ${data.rhythmSettings.preset}, 爽点密度: ${data.rhythmSettings.coolPointDensity}`);
          }
        },
        onAnalysis: (data: any) => {
          if (myRun !== runSeq) return;
          analysis.value = data;
          addLog(`📊 分析完成：${data.characterUpdates}个角色更新, ${data.foreshadowingPlanted.length}个新伏笔`);
        },
        onMultiHeadAnalysis: (data: any) => {
          if (myRun !== runSeq) return;
          multiHeadAnalysis.value = data;
          addLog(`🧠 多头注意力分析完成：${data.enabledHeads.length}个注意力头`);
          if (data.crossDimensionInsights.length > 0) {
            addLog(`  - 跨维度洞察: ${data.crossDimensionInsights.length}个`);
          }
          if (data.aggregatedConstraints.length > 0) {
            addLog(`  - 新增约束: ${data.aggregatedConstraints.length}个`);
          }
        },
        onCharacterLifecycle: (data: any) => {
          if (myRun !== runSeq) return;
          characterLifecycle.value = data;
          if (data.tierChanges.length > 0) {
            addLog(`👤 角色层级变化: ${data.tierChanges.length}个`);
            data.tierChanges.forEach((change) => {
              addLog(`  - ${change.name}: ${change.from} → ${change.to}`);
            });
          }
          if (data.archivedCharacters.length > 0) {
            addLog(`📦 角色归档: ${data.archivedCharacters.join(', ')}`);
          }
        },
        onConstraintValidation: (data: any) => {
          if (myRun !== runSeq) return;
          constraintValidation.value = data;
          const rate = (data.satisfactionRate * 100).toFixed(1);
          addLog(`🔍 约束验证完成：满足率 ${rate}%`);
          if (data.criticalViolations > 0) {
            addLog(`  ⚠️ Critical 违规: ${data.criticalViolations}个`, 'warn');
          }
          if (data.importantViolations > 0) {
            addLog(`  - Important 违规: ${data.importantViolations}个`);
          }
          if (!data.overallSatisfied) {
            addLog(`  📝 ${data.summary}`, 'warn');
          }
          if (data.retryInfo) {
            addLog(`  🔄 将进行第${data.retryInfo.attemptNumber + 1}次尝试`, 'warn');
          }
        },
        onAIConstraintDecision: (data: any) => {
          if (myRun !== runSeq) return;
          aiConstraintDecision.value = data;
          addLog(`🤖 AI 约束决策完成：${data.stats.totalConstraints}个约束`);
          addLog(`  - 可验证: ${data.stats.verifiableCount}, 指导性: ${data.stats.guidanceCount}`);
          if (data.rhythm.faceSlap.needed) {
            addLog(`  - 打脸: ${data.rhythm.faceSlap.urgency}`);
          }
          if (data.rhythm.plotTwist.needed) {
            addLog(`  - 反转: ${data.rhythm.plotTwist.urgency}`);
          }
          if (data.foreshadowing.mustResolveCount > 0) {
            addLog(`  - 必须回收伏笔: ${data.foreshadowing.mustResolveCount}个`);
          }
        },
        // 暂时注释 - 等待 API 类型定义添加此回调
        // onBudgetAllocation: (data: IBudgetAllocationInfo) => {
        //   budgetAllocation.value = data;
        //   addLog(`💰 预算分配完成：总预算 ${data.allocation.total} 字符`);
        //   addLog(`  - 角色: ${data.allocation.characters}, 伏笔: ${data.allocation.foreshadowing}`);
        //   if (data.adjustmentReasons.length > 0) {
        //     addLog(`  - 调整原因: ${data.adjustmentReasons.length}项`);
        //   }
        // },
        onRetryNotification: (data: any) => {
          if (myRun !== runSeq) return;
          retryNotifications.value.push(data);
          addLog(`🔄 重试通知：第${data.attemptNumber}次尝试（共${data.maxAttempts}次）`, 'warn');
          addLog(`  原因: ${data.reason}`);
          if (data.strengthenedConstraints.length > 0) {
            addLog(`  强化约束: ${data.strengthenedConstraints.length}个`);
          }
        },
        onChunk: (text) => {
          if (myRun !== runSeq) return; // 旧运行回调不得写入新运行
          generatedContent.value += text;
          wordCount.value = generatedContent.value.length;
        },
        onComplete: async (data: { wordCount?: number; validationInfo?: { satisfactionRate: number; attempts: number; criticalViolations: number; importantViolations: number } }) => {
          if (myRun !== runSeq) return;
          if (data.validationInfo) {
            const rate = (data.validationInfo.satisfactionRate * 100).toFixed(1);
            addLog(`📊 验证统计：满足率 ${rate}%，尝试 ${data.validationInfo.attempts} 次`);
          }
          // 以服务端持久化的最终选定版本为准（而非流式拼接内容）；
          // 读取失败不得用拼接内容冒充成功；成功提示仅在持久化读取验证后
          try {
            const resp = await episodeApi.getByNumber(projectId, episodeNumber);
            if (myRun !== runSeq) return; // await 后先校验运行身份再写状态
            const saved = (resp.data as { data?: { content?: string; wordCount?: number } })?.data;
            if (saved?.content) {
              generatedContent.value = saved.content;
              wordCount.value = saved.wordCount ?? saved.content.length;
            } else {
              throw new Error('已保存剧本为空');
            }
          } catch (e) {
            if (myRun !== runSeq) return;
            error.value = `生成已完成但读取已保存剧本失败: ${(e as { friendlyMessage?: string })?.friendlyMessage || humanizeError(e)}`;
            addLog(`❌ ${error.value}`, 'error');
            return;
          }
          if (myRun !== runSeq) return;
          progress.value = {
            current: 100,
            total: 100,
            step: '完成',
            message: `生成完成，共 ${wordCount.value} 字`,
          };
          addLog(`✅ 生成完成，共 ${wordCount.value} 字`);
          doneOk = true;
        },
        onError: (err) => {
          if (myRun !== runSeq) return;
          error.value = err.message;
          addLog(`❌ 错误: ${err.message}`, 'error');
          isGenerating.value = false;
        },
      }, { signal: abortController.signal });
      if (myRun === runSeq) isGenerating.value = false;
      return doneOk && myRun === runSeq;
    } catch (e) {
      if (myRun !== runSeq) return false;
      if ((e as Error)?.name === 'AbortError') {
        isGenerating.value = false;
        return false;
      }
      error.value = (e as { friendlyMessage?: string })?.friendlyMessage || humanizeError(e);
      addLog(`❌ 生成失败: ${error.value}`, 'error');
      isGenerating.value = false;
      return false;
    } finally {
      if (myRun === runSeq) abortController = null;
    }
  }

  // 重置生成状态
  function resetGenerationState() {
    progress.value = { current: 0, total: 100, step: '', message: '' };
    logs.value = [];
    context.value = null;
    analysis.value = null;
    multiHeadAnalysis.value = null;
    characterLifecycle.value = null;
    constraintValidation.value = null;
    aiConstraintDecision.value = null;
    budgetAllocation.value = null;
    retryNotifications.value = [];
    generatedContent.value = '';
    wordCount.value = 0;
    error.value = null;
    // 清除持久化存储
    localStorage.removeItem(STORAGE_KEY);
  }

  // 停止生成：真正中断底层连接
  function stopGeneration() {
    runSeq++; // 使在途回调失效
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    isGenerating.value = false;
    addLog('⚠️ 生成已停止', 'warn');
  }

  // 完全重置：先中止在途运行
  function reset() {
    if (isGenerating.value || abortController) stopGeneration();
    resetGenerationState();
    isGenerating.value = false;
    contextPreview.value = null;
  }

  return {
    // 状态
    isGenerating,
    progress,
    currentProjectId,
    currentEpisodeNumber,
    logs,
    context,
    analysis,
    multiHeadAnalysis,
    characterLifecycle,
    constraintValidation,
    aiConstraintDecision,
    budgetAllocation,
    retryNotifications,
    contextPreview,
    generatedContent,
    wordCount,
    error,

    // 计算属性
    progressPercent,
    allConstraints,
    allSuggestions,
    validationPassed,
    validationRate,
    unfulfilledConstraints,
    criticalViolations,

    // 方法
    addLog,
    previewContext,
    startGeneration,
    stopGeneration,
    resetGenerationState,
    reset,
  };
});
