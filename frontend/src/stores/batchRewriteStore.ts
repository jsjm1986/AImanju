/**
 * 批量连贯改写状态管理
 */

import { batchRewriteApi } from '@/services/api';
import type {
    BatchRewriteHistory,
    BatchRewriteResult,
    BatchRewriteStatus,
    EpisodeRewriteResult,
    RewritePlan,
} from '@/types';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

  // 改写步骤
export type BatchRewriteStep = 'select' | 'instruction' | 'plan' | 'execute' | 'review';

// 计划生成阶段
export type PlanGenerationStage = 'validating' | 'loading' | 'context' | 'generating' | 'parsing' | 'done';

// 执行阶段
export type ExecutionStage = 'preparing' | 'rewriting' | 'done';

export const useBatchRewriteStore = defineStore('batchRewrite', () => {
  // ===== 状态 =====
  const currentStep = ref<BatchRewriteStep>('select');
  const episodeRange = ref<{ start: number; end: number } | null>(null);
  const instruction = ref('');
  const plan = ref<RewritePlan | null>(null);
  const result = ref<BatchRewriteResult | null>(null);
  const history = ref<BatchRewriteHistory[]>([]);
  const currentHistoryDetail = ref<BatchRewriteHistory | null>(null);
  const status = ref<BatchRewriteStatus>('pending');
  const currentEpisode = ref<number>(0);
  const totalEpisodes = ref<number>(0);
  const streamingContent = ref<Record<number, string>>({});
  const episodeResults = ref<EpisodeRewriteResult[]>([]);
  const loading = ref(false);
  const executing = ref(false);
  const error = ref<string | null>(null);
  
  // 计划生成流式状态
  const planGenerationStage = ref<PlanGenerationStage | null>(null);
  const planGenerationDetail = ref<string>('');
  const planStreamingContent = ref<string>('');
  
  // 执行阶段状态
  const executionStage = ref<ExecutionStage | null>(null);
  const executionMessage = ref<string>('');

  // ===== 计算属性 =====
  const hasEpisodeRange = computed(() => {
    return episodeRange.value !== null && 
           episodeRange.value.start > 0 && 
           episodeRange.value.end > 0;
  });
  const hasInstruction = computed(() => instruction.value.trim().length > 0);
  const hasPlan = computed(() => plan.value !== null);
  const hasResult = computed(() => result.value !== null);
  const canGeneratePlan = computed(() => hasEpisodeRange.value && hasInstruction.value);
  const canExecute = computed(() => hasPlan.value && !executing.value);
  const progress = computed(() => {
    if (totalEpisodes.value === 0) return 0;
    // 已完成的集数 / 总集数
    const completed = episodeResults.value.length;
    return Math.round((completed / totalEpisodes.value) * 100);
  });
  const completedEpisodes = computed(() => episodeResults.value.filter(r => r.status === 'completed'));
  const failedEpisodes = computed(() => episodeResults.value.filter(r => r.status === 'failed'));
  
  // 计划生成是否正在进行
  const isGeneratingPlan = computed(() => planGenerationStage.value !== null && planGenerationStage.value !== 'done');

  // ===== 方法 =====
  function setEpisodeRange(start: number, end: number) {
    episodeRange.value = { start, end };
  }

  function setInstruction(text: string) {
    instruction.value = text;
  }

  function nextStep() {
    const steps: BatchRewriteStep[] = ['select', 'instruction', 'plan', 'execute', 'review'];
    const idx = steps.indexOf(currentStep.value);
    if (idx < steps.length - 1) currentStep.value = steps[idx + 1] as BatchRewriteStep;
  }

  function prevStep() {
    const steps: BatchRewriteStep[] = ['select', 'instruction', 'plan', 'execute', 'review'];
    const idx = steps.indexOf(currentStep.value);
    if (idx > 0) currentStep.value = steps[idx - 1] as BatchRewriteStep;
  }

  function goToStep(step: BatchRewriteStep) {
    currentStep.value = step;
  }

  async function generatePlan(projectId: string): Promise<RewritePlan> {
    if (!episodeRange.value || !instruction.value) throw new Error('请先选择集数范围和输入改写指令');
    loading.value = true;
    error.value = null;
    planGenerationStage.value = null;
    planGenerationDetail.value = '';
    planStreamingContent.value = '';
    
    return new Promise((resolve, reject) => {
      batchRewriteApi.generatePlan(
        {
          projectId,
          episodeRange: episodeRange.value!,
          instruction: instruction.value,
        },
        {
          onProgress: (stage, detail) => {
            planGenerationStage.value = stage as PlanGenerationStage;
            planGenerationDetail.value = detail;
          },
          onChunk: (chunk) => {
            planStreamingContent.value += chunk;
          },
          onComplete: (generatedPlan) => {
            plan.value = generatedPlan;
            planGenerationStage.value = 'done';
            loading.value = false;
            resolve(generatedPlan);
          },
          onError: (err) => {
            error.value = err.message;
            loading.value = false;
            planGenerationStage.value = null;
            reject(err);
          },
        }
      );
    });
  }


  async function executeRewrite(projectId: string) {
    if (!plan.value) throw new Error('请先生成改写计划');
    executing.value = true;
    status.value = 'in_progress';
    error.value = null;
    streamingContent.value = {};
    episodeResults.value = [];
    executionStage.value = 'preparing';
    executionMessage.value = '正在准备改写上下文...';
    try {
      await batchRewriteApi.execute(projectId, plan.value, {
        onPreparing: (message) => {
          executionStage.value = 'preparing';
          executionMessage.value = message;
        },
        onEpisodeStart: (episodeNumber, total) => {
          executionStage.value = 'rewriting';
          currentEpisode.value = episodeNumber;
          totalEpisodes.value = total;
          streamingContent.value[episodeNumber] = '';
          executionMessage.value = `正在改写第 ${episodeNumber} 集...`;
        },
        onEpisodeChunk: (episodeNumber, chunk) => {
          if (!streamingContent.value[episodeNumber]) streamingContent.value[episodeNumber] = '';
          streamingContent.value[episodeNumber] += chunk;
        },
        onEpisodeComplete: (episodeResult) => {
          episodeResults.value.push(episodeResult);
        },
        onEpisodeFailed: (episodeNumber, errorMsg) => {
          episodeResults.value.push({
            episodeNumber,
            episodeId: '',
            status: 'failed',
            originalContent: '',
            rewrittenContent: '',
            wordCountChange: 0,
            coherenceIssues: [],
            error: errorMsg,
          });
        },
        onAllComplete: (batchResult) => {
          result.value = batchResult;
          status.value = batchResult.status;
          executionStage.value = 'done';
        },
        onError: (err) => {
          error.value = err.message;
          status.value = 'failed';
          executionStage.value = null;
        },
      });
    } catch (err) {
      error.value = (err as Error).message;
      status.value = 'failed';
      throw err;
    } finally {
      executing.value = false;
    }
  }

  async function applyResults(projectId: string, historyId: string, selectedEpisodes?: number[]) {
    loading.value = true;
    error.value = null;
    try {
      const response = await batchRewriteApi.apply({ projectId, historyId, selectedEpisodes });
      return response.data;
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function rollback(projectId: string, historyId: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await batchRewriteApi.rollback({ projectId, historyId });
      return response.data;
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function loadHistory(projectId: string, options?: { startDate?: string; endDate?: string; episodeStart?: number; episodeEnd?: number }) {
    loading.value = true;
    error.value = null;
    try {
      const response = await batchRewriteApi.getHistory(projectId, options);
      history.value = response.data.history;
      return response.data.history;
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function loadHistoryDetail(historyId: string, projectId: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await batchRewriteApi.getHistoryDetail(historyId, projectId);
      currentHistoryDetail.value = response.data.history;
      return response.data.history;
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteHistory(historyId: string, projectId: string) {
    loading.value = true;
    error.value = null;
    try {
      await batchRewriteApi.deleteHistory(historyId, projectId);
      history.value = history.value.filter(h => h._id !== historyId);
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  function reset() {
    currentStep.value = 'select';
    episodeRange.value = null;
    instruction.value = '';
    plan.value = null;
    result.value = null;
    status.value = 'pending';
    currentEpisode.value = 0;
    totalEpisodes.value = 0;
    streamingContent.value = {};
    episodeResults.value = [];
    loading.value = false;
    executing.value = false;
    error.value = null;
    planGenerationStage.value = null;
    planGenerationDetail.value = '';
    planStreamingContent.value = '';
    executionStage.value = null;
    executionMessage.value = '';
  }

  function clearHistoryDetail() {
    currentHistoryDetail.value = null;
  }

  return {
    // 状态
    currentStep, episodeRange, instruction, plan, result, history, currentHistoryDetail,
    status, currentEpisode, totalEpisodes, streamingContent, episodeResults, loading, executing, error,
    planGenerationStage, planGenerationDetail, planStreamingContent,
    executionStage, executionMessage,
    // 计算属性
    hasEpisodeRange, hasInstruction, hasPlan, hasResult, canGeneratePlan, canExecute, progress, 
    completedEpisodes, failedEpisodes, isGeneratingPlan,
    // 方法
    setEpisodeRange, setInstruction, nextStep, prevStep, goToStep, generatePlan, executeRewrite,
    applyResults, rollback, loadHistory, loadHistoryDetail, deleteHistory, reset, clearHistoryDetail,
  };
});
