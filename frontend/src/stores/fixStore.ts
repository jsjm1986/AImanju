import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { fixApi } from '@/services/api';
import type { ValidationIssue } from '@/types';
import type {
  FixPlan,
  FixResult,
  FixHistory,
  FixHistoryStats,
  FixStatus,
  FixAnalysisResult,
  CrossEpisodeFixPlan,
  CrossEpisodeFixStatus,
  AffectedEpisode,
  RelatedForeshadowing,
  MultiEpisodeFixResult,
  TargetedValidationResult,
} from '@/types/fix';

function sortPlansByRecommendation<T extends { recommended?: boolean; confidence: number }>(plans: T[]): T[] {
  return [...plans].sort((a, b) => {
    if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
    return b.confidence - a.confidence;
  });
}

function handleError(err: unknown, errorRef: { value: string | null }, statusRef?: { value: string }) {
  errorRef.value = (err as Error).message;
  if (statusRef) statusRef.value = 'error';
}

export const useFixStore = defineStore('fix', () => {
  const status = ref<FixStatus>('idle');
  const analyzing = ref(false);
  const executing = ref(false);
  const applying = ref(false);

  const currentIssue = ref<ValidationIssue | null>(null);
  const analysisResult = ref<FixAnalysisResult | null>(null);
  const plans = ref<FixPlan[]>([]);
  const selectedPlan = ref<FixPlan | null>(null);
  const customInstruction = ref('');

  const executeProgress = ref(0);
  const streamContent = ref('');

  const fixResult = ref<FixResult | null>(null);
  const lastHistoryId = ref<string | null>(null);

  const canUndo = ref(false);
  const undoCountdown = ref(0);
  let undoTimer: ReturnType<typeof setInterval> | null = null;

  const history = ref<FixHistory[]>([]);
  const historyStats = ref<FixHistoryStats | null>(null);

  const error = ref<string | null>(null);

  const crossEpisodeMode = ref(false);
  const crossEpisodeStatus = ref<CrossEpisodeFixStatus>('idle');
  const affectedEpisodes = ref<AffectedEpisode[]>([]);
  const crossEpisodePlans = ref<CrossEpisodeFixPlan[]>([]);
  const selectedCrossEpisodePlan = ref<CrossEpisodeFixPlan | null>(null);
  const multiEpisodeResults = ref<MultiEpisodeFixResult[]>([]);
  const relatedForeshadowings = ref<RelatedForeshadowing[]>([]);
  const masterHistoryId = ref<string | null>(null);
  const validationResult = ref<TargetedValidationResult | null>(null);
  const currentExecutingEpisode = ref<number | null>(null);
  const totalEpisodesToFix = ref(0);

  const sortedPlans = computed(() => sortPlansByRecommendation(plans.value));
  const recommendedPlan = computed(() => plans.value.find(p => p.recommended) || plans.value[0] || null);
  const canExecute = computed(() => selectedPlan.value !== null && !executing.value);
  const canApply = computed(() => fixResult.value !== null && !applying.value);

  const sortedCrossEpisodePlans = computed(() => sortPlansByRecommendation(crossEpisodePlans.value));
  const recommendedCrossEpisodePlan = computed(() => crossEpisodePlans.value.find(p => p.recommended) || crossEpisodePlans.value[0] || null);
  const canExecuteCrossEpisode = computed(() => selectedCrossEpisodePlan.value !== null && !executing.value);
  const canApplyCrossEpisode = computed(() => multiEpisodeResults.value.length > 0 && !applying.value);
  const isCrossEpisodeIssue = computed(() => {
    if (!currentIssue.value) return false;
    return currentIssue.value.isGlobal || (currentIssue.value.windowRange && currentIssue.value.windowRange.includes('-'));
  });

  async function analyzeIssue(projectId: string, issue: ValidationIssue) {
    analyzing.value = true;
    status.value = 'analyzing';
    error.value = null;
    currentIssue.value = issue;
    plans.value = [];
    selectedPlan.value = null;

    try {
      await fixApi.analyze(projectId, issue, {
        onProgress: (message) => console.log('[Fix] 分析进度:', message),
        onComplete: (data) => {
          if (data.success) {
            analysisResult.value = data;
            plans.value = data.plans || [];
            selectedPlan.value = recommendedPlan.value;
            status.value = 'idle';
          } else {
            error.value = '分析失败';
            status.value = 'error';
          }
          analyzing.value = false;
        },
        onError: (err) => {
          handleError(err, error, status);
          analyzing.value = false;
        },
      });
    } catch (err) {
      handleError(err, error, status);
      analyzing.value = false;
    }
  }

  async function executeFix(projectId: string, episodeNumber: number, _episodeId: string) {
    if (!selectedPlan.value) {
      error.value = '请先选择修复方案';
      return;
    }

    executing.value = true;
    status.value = 'executing';
    error.value = null;
    executeProgress.value = 0;
    streamContent.value = '';
    fixResult.value = null;

    try {
      await fixApi.execute(
        projectId,
        selectedPlan.value,
        episodeNumber,
        customInstruction.value || undefined,
        {
          onProgress: (data) => {
            streamContent.value = data.content;
            executeProgress.value = data.percent;
          },
          onComplete: (result) => {
            fixResult.value = result;
            executeProgress.value = 100;
            status.value = 'completed';
            executing.value = false;
          },
          onError: (err) => {
            handleError(err, error, status);
            executing.value = false;
          },
        }
      );
    } catch (err) {
      handleError(err, error, status);
      executing.value = false;
    }
  }

  async function applyFix(projectId: string, episodeId: string, episodeNumber: number) {
    if (!fixResult.value) {
      error.value = '没有可应用的修复结果';
      return false;
    }

    applying.value = true;
    error.value = null;

    try {
      const response = await fixApi.apply({
        projectId,
        episodeId,
        episodeNumber,
        originalContent: fixResult.value.originalContent,
        fixedContent: fixResult.value.fixedContent,
        issue: currentIssue.value || undefined,
        plan: selectedPlan.value || undefined,
      });

      if (!response.data.success) throw new Error('应用失败');

      lastHistoryId.value = response.data.historyId;
      startUndoCountdown();
      return true;
    } catch (err) {
      handleError(err, error);
      return false;
    } finally {
      applying.value = false;
    }
  }

  async function undoFix() {
    if (!lastHistoryId.value) {
      error.value = '没有可撤销的修复';
      return false;
    }

    try {
      const response = await fixApi.revert(lastHistoryId.value);
      if (response.data.success) {
        stopUndoCountdown();
        lastHistoryId.value = null;
        return true;
      }
      return false;
    } catch (err) {
      handleError(err, error);
      return false;
    }
  }

  function startUndoCountdown() {
    canUndo.value = true;
    undoCountdown.value = 30;

    if (undoTimer) clearInterval(undoTimer);

    undoTimer = setInterval(() => {
      undoCountdown.value--;
      if (undoCountdown.value <= 0) stopUndoCountdown();
    }, 1000);
  }

  function stopUndoCountdown() {
    canUndo.value = false;
    undoCountdown.value = 0;
    if (undoTimer) {
      clearInterval(undoTimer);
      undoTimer = null;
    }
  }

  async function loadHistory(projectId: string) {
    try {
      const response = await fixApi.getHistory(projectId);
      history.value = response.data.history;
      historyStats.value = response.data.stats;
    } catch (err) {
      handleError(err, error);
    }
  }

  function selectPlan(plan: FixPlan) {
    selectedPlan.value = plan;
  }

  function setCustomInstruction(instruction: string) {
    customInstruction.value = instruction;
  }

  function reset() {
    status.value = 'idle';
    analyzing.value = false;
    executing.value = false;
    applying.value = false;
    currentIssue.value = null;
    analysisResult.value = null;
    plans.value = [];
    selectedPlan.value = null;
    customInstruction.value = '';
    executeProgress.value = 0;
    streamContent.value = '';
    fixResult.value = null;
    error.value = null;
    stopUndoCountdown();
  }

  function cancelExecution() {
    executing.value = false;
    status.value = 'idle';
  }

  /** Cross-episode fix analysis */
  async function analyzeCrossEpisodeIssue(projectId: string, issue: ValidationIssue) {
    analyzing.value = true;
    crossEpisodeMode.value = true;
    crossEpisodeStatus.value = 'analyzing';
    error.value = null;
    currentIssue.value = issue;
    crossEpisodePlans.value = [];
    selectedCrossEpisodePlan.value = null;
    affectedEpisodes.value = [];
    relatedForeshadowings.value = [];

    try {
      await fixApi.analyzeCrossEpisode(projectId, issue, {
        onProgress: (message) => console.log('[CrossEpisodeFix] 分析进度:', message),
        onComplete: (data) => {
          if (data.success) {
            affectedEpisodes.value = data.affectedEpisodes || [];
            crossEpisodePlans.value = data.plans || [];
            relatedForeshadowings.value = data.relatedForeshadowings || [];
            selectedCrossEpisodePlan.value = recommendedCrossEpisodePlan.value;
            crossEpisodeStatus.value = 'selecting';
          } else {
            error.value = data.error || '分析失败';
            crossEpisodeStatus.value = 'error';
          }
          analyzing.value = false;
        },
        onError: (err) => {
          handleError(err, error);
          crossEpisodeStatus.value = 'error';
          analyzing.value = false;
        },
      });
    } catch (err) {
      handleError(err, error);
      crossEpisodeStatus.value = 'error';
      analyzing.value = false;
    }
  }

  async function executeCrossEpisodeFix(projectId: string) {
    if (!selectedCrossEpisodePlan.value) {
      error.value = '请先选择修复方案';
      return;
    }

    executing.value = true;
    crossEpisodeStatus.value = 'executing';
    error.value = null;
    executeProgress.value = 0;
    streamContent.value = '';
    multiEpisodeResults.value = [];

    try {
      await fixApi.executeCrossEpisode(
        projectId,
        selectedCrossEpisodePlan.value,
        customInstruction.value || undefined,
        {
          onStart: (data) => {
            totalEpisodesToFix.value = data.totalEpisodes;
          },
          onEpisodeStart: (episodeNumber) => {
            currentExecutingEpisode.value = episodeNumber;
          },
          onProgress: (data) => {
            streamContent.value = data.content;
            executeProgress.value = data.percent;
          },
          onEpisodeComplete: () => {},
          onComplete: (results) => {
            multiEpisodeResults.value = results;
            executeProgress.value = 100;
            crossEpisodeStatus.value = 'previewing';
            executing.value = false;
            currentExecutingEpisode.value = null;
          },
          onError: (err) => {
            handleError(err, error);
            crossEpisodeStatus.value = 'error';
            executing.value = false;
            currentExecutingEpisode.value = null;
          },
        }
      );
    } catch (err) {
      handleError(err, error);
      crossEpisodeStatus.value = 'error';
      executing.value = false;
    }
  }

  async function applyCrossEpisodeFix(projectId: string, options?: { excludeEpisodes?: number[] }) {
    if (multiEpisodeResults.value.length === 0) {
      error.value = '没有可应用的修复结果';
      return false;
    }

    if (!currentIssue.value || !selectedCrossEpisodePlan.value) {
      error.value = '缺少问题或方案信息';
      return false;
    }

    applying.value = true;
    crossEpisodeStatus.value = 'applying';
    error.value = null;

    try {
      const response = await fixApi.applyCrossEpisode({
        projectId,
        fixResults: multiEpisodeResults.value,
        issue: {
          type: currentIssue.value.category || currentIssue.value.type,
          description: currentIssue.value.description,
          episode: currentIssue.value.episode,
          evidence: currentIssue.value.evidence,
        },
        plan: selectedCrossEpisodePlan.value,
        excludeEpisodes: options?.excludeEpisodes,
      });

      if (!response.data.success) throw new Error('应用失败');

      masterHistoryId.value = response.data.masterHistoryId;
      if (response.data.relatedForeshadowings) {
        relatedForeshadowings.value = response.data.relatedForeshadowings;
      }
      startUndoCountdown();
      crossEpisodeStatus.value = 'completed';
      return true;
    } catch (err) {
      handleError(err, error);
      crossEpisodeStatus.value = 'error';
      return false;
    } finally {
      applying.value = false;
    }
  }

  async function validateCrossEpisodeFix(projectId: string) {
    if (!currentIssue.value || affectedEpisodes.value.length === 0) {
      error.value = '缺少验证所需信息';
      return false;
    }

    crossEpisodeStatus.value = 'validating';
    error.value = null;

    try {
      const response = await fixApi.validateCrossEpisode({
        projectId,
        originalIssue: {
          type: currentIssue.value.category || currentIssue.value.type,
          description: currentIssue.value.description,
          episode: currentIssue.value.episode,
          evidence: currentIssue.value.evidence,
        },
        affectedEpisodes: affectedEpisodes.value.map(e => e.episodeNumber),
      });

      if (response.data.success) {
        validationResult.value = response.data.validation;
        return response.data.validation.passed;
      }
      return false;
    } catch (err) {
      handleError(err, error);
      return false;
    }
  }

  async function updateForeshadowingStatus(updates: Array<{ foreshadowingId: string; newStatus: string }>) {
    try {
      const response = await fixApi.updateForeshadowing(updates);
      if (response.data.success) {
        for (const update of updates) {
          const foreshadowing = relatedForeshadowings.value.find(f => f.id === update.foreshadowingId);
          if (foreshadowing) foreshadowing.newStatus = update.newStatus;
        }
        return true;
      }
      return false;
    } catch (err) {
      handleError(err, error);
      return false;
    }
  }

  async function revertCrossEpisodeFix(options?: { episodesToRevert?: number[] }) {
    if (!masterHistoryId.value) {
      error.value = '没有可撤销的跨集修复';
      return false;
    }

    try {
      const response = await fixApi.revertCrossEpisode(masterHistoryId.value, options?.episodesToRevert);
      if (response.data.success) {
        stopUndoCountdown();
        masterHistoryId.value = null;
        crossEpisodeStatus.value = 'idle';
        return true;
      }
      return false;
    } catch (err) {
      handleError(err, error);
      return false;
    }
  }

  function selectCrossEpisodePlan(plan: CrossEpisodeFixPlan) {
    selectedCrossEpisodePlan.value = plan;
  }

  function resetCrossEpisode() {
    crossEpisodeMode.value = false;
    crossEpisodeStatus.value = 'idle';
    affectedEpisodes.value = [];
    crossEpisodePlans.value = [];
    selectedCrossEpisodePlan.value = null;
    multiEpisodeResults.value = [];
    relatedForeshadowings.value = [];
    masterHistoryId.value = null;
    validationResult.value = null;
    currentExecutingEpisode.value = null;
    totalEpisodesToFix.value = 0;
    stopUndoCountdown();
  }

  return {
    // 状态
    status,
    analyzing,
    executing,
    applying,
    currentIssue,
    analysisResult,
    plans,
    selectedPlan,
    customInstruction,
    executeProgress,
    streamContent,
    fixResult,
    lastHistoryId,
    canUndo,
    undoCountdown,
    history,
    historyStats,
    error,

    // 计算属性
    sortedPlans,
    recommendedPlan,
    canExecute,
    canApply,

    // 方法
    analyzeIssue,
    executeFix,
    applyFix,
    undoFix,
    loadHistory,
    selectPlan,
    setCustomInstruction,
    reset,
    cancelExecution,

    // ===== 跨集修复 =====
    // 状态
    crossEpisodeMode,
    crossEpisodeStatus,
    affectedEpisodes,
    crossEpisodePlans,
    selectedCrossEpisodePlan,
    multiEpisodeResults,
    relatedForeshadowings,
    masterHistoryId,
    validationResult,
    currentExecutingEpisode,
    totalEpisodesToFix,

    // 计算属性
    sortedCrossEpisodePlans,
    recommendedCrossEpisodePlan,
    canExecuteCrossEpisode,
    canApplyCrossEpisode,
    isCrossEpisodeIssue,

    // 方法
    analyzeCrossEpisodeIssue,
    executeCrossEpisodeFix,
    applyCrossEpisodeFix,
    validateCrossEpisodeFix,
    updateForeshadowingStatus,
    revertCrossEpisodeFix,
    selectCrossEpisodePlan,
    resetCrossEpisode,
  };
});
