/**
 * 伏笔状态管理
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { foreshadowingApi } from '@/services/api';
import type {
  Foreshadowing, ForeshadowingStats, ForeshadowingSuggestion,
  ForeshadowingContext, AIDecisionResult,
  OptimizedConstraints, ForeshadowingCluster
} from '@/types';

export const useForeshadowingStore = defineStore('foreshadowing', () => {
  // 状态
  const foreshadowings = ref<Foreshadowing[]>([]);
  const stats = ref<ForeshadowingStats | null>(null);
  const suggestions = ref<ForeshadowingSuggestion | null>(null);
  const timeline = ref<Array<{ episode: number; planted: Foreshadowing[]; resolved: Foreshadowing[] }>>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const currentProjectId = ref<string | null>(null);

  // V2新增状态
  const aiDecisionResult = ref<AIDecisionResult | null>(null);
  const urgentForeshadowings = ref<Foreshadowing[]>([]);
  const clusters = ref<ForeshadowingCluster[]>([]);
  const currentConstraints = ref<OptimizedConstraints | null>(null);
  const aiDeciding = ref(false);  // AI决策中

  // 计算属性
  const unresolvedForeshadowings = computed(() =>
    foreshadowings.value.filter(f => f.status === 'planted')
  );

  const resolvedForeshadowings = computed(() =>
    foreshadowings.value.filter(f => f.status === 'resolved')
  );

  const abandonedForeshadowings = computed(() =>
    foreshadowings.value.filter(f => f.status === 'abandoned')
  );

  // V2新增计算属性
  const dormantForeshadowings = computed(() =>
    foreshadowings.value.filter(f => f.status === 'dormant')
  );

  const mergedForeshadowings = computed(() =>
    foreshadowings.value.filter(f => f.status === 'merged')
  );

  const criticalForeshadowings = computed(() =>
    foreshadowings.value.filter(f => f.importance === 'critical' && f.status === 'planted')
  );

  // 按有效性分组
  const foreshadowingsByValidity = computed(() => {
    const result: Record<string, Foreshadowing[]> = {
      true_foreshadowing: [],
      atmosphere: [],
      setup: [],
      hook: [],
      redundant: [],
      pending_review: [],
    };
    for (const f of foreshadowings.value) {
      const validity = f.validity || 'pending_review';
      if (result[validity]) {
        result[validity].push(f);
      }
    }
    return result;
  });

  // 按聚类组分组
  const foreshadowingsByCluster = computed(() => {
    const result: Record<string, Foreshadowing[]> = {};
    for (const f of foreshadowings.value) {
      const group = f.clusterGroup;
      if (group) {
        if (!result[group]) {
          result[group] = [];
        }
        result[group].push(f);
      }
    }
    return result;
  });

  // 加载伏笔列表
  async function loadForeshadowings(projectId: string, status?: string) {
    loading.value = true;
    error.value = null;
    currentProjectId.value = projectId;

    try {
      const response = await foreshadowingApi.getByProject(projectId, status);
      foreshadowings.value = response.data.foreshadowings;
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // 加载伏笔统计
  async function loadStats(projectId: string, currentEpisode?: number) {
    try {
      const response = await foreshadowingApi.getStats(projectId, currentEpisode);
      stats.value = response.data;
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    }
  }

  // 加载回收建议
  async function loadSuggestions(projectId: string, currentEpisode: number) {
    try {
      const response = await foreshadowingApi.getSuggestions(projectId, currentEpisode);
      suggestions.value = response.data;
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    }
  }

  // 加载时间线
  async function loadTimeline(projectId: string) {
    try {
      const response = await foreshadowingApi.getTimeline(projectId);
      timeline.value = response.data.timeline;
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    }
  }

  // 创建伏笔
  async function createForeshadowing(data: {
    projectId: string;
    episodePlanted: number;
    content: string;
    type?: string;
    importance?: string;
  }) {
    loading.value = true;
    error.value = null;

    try {
      const response = await foreshadowingApi.create(data);
      foreshadowings.value.push(response.data.foreshadowing);
      return response.data.foreshadowing;
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // 更新伏笔
  async function updateForeshadowing(id: string, data: Partial<Foreshadowing>) {
    loading.value = true;
    error.value = null;

    try {
      const response = await foreshadowingApi.update(id, data);
      const index = foreshadowings.value.findIndex(f => f._id === id);
      if (index !== -1) {
        foreshadowings.value[index] = response.data.foreshadowing;
      }
      return response.data.foreshadowing;
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // 标记伏笔已回收
  async function resolveForeshadowing(id: string, episodeResolved: number, resolutionNote?: string) {
    loading.value = true;
    error.value = null;

    try {
      const response = await foreshadowingApi.resolve(id, episodeResolved, resolutionNote);
      const index = foreshadowings.value.findIndex(f => f._id === id);
      if (index !== -1) {
        foreshadowings.value[index] = response.data.foreshadowing;
      }
      return response.data.foreshadowing;
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // 放弃伏笔
  async function abandonForeshadowing(id: string, reason?: string) {
    loading.value = true;
    error.value = null;

    try {
      const response = await foreshadowingApi.abandon(id, reason);
      const index = foreshadowings.value.findIndex(f => f._id === id);
      if (index !== -1) {
        foreshadowings.value[index] = response.data.foreshadowing;
      }
      return response.data.foreshadowing;
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // 删除伏笔
  async function deleteForeshadowing(id: string) {
    loading.value = true;
    error.value = null;

    try {
      await foreshadowingApi.delete(id);
      foreshadowings.value = foreshadowings.value.filter(f => f._id !== id);
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // AI分析剧本中的伏笔
  async function analyzeScript(projectId: string, episodeNumber: number, scriptContent: string) {
    loading.value = true;
    error.value = null;

    try {
      const response = await foreshadowingApi.analyze(projectId, episodeNumber, scriptContent);
      return response.data.foreshadowings;
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // ===== V2 新增方法 =====

  /**
   * AI 一次性分析并决策
   * 给 AI 完整上下文，获取完整决策（约束、生命周期、有效性）
   */
  async function aiDecide(projectId: string, context: Omit<ForeshadowingContext, 'projectId'>) {
    aiDeciding.value = true;
    error.value = null;

    try {
      const response = await foreshadowingApi.aiDecide(projectId, context);
      aiDecisionResult.value = response.data;

      // 决策执行后重新加载伏笔列表
      await loadForeshadowings(projectId);

      return response.data;
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    } finally {
      aiDeciding.value = false;
    }
  }

  /**
   * 获取优化后的约束
   * 供剧本生成使用，返回 verifiable 和 guidance 两类
   */
  async function getConstraints(projectId: string, context: Omit<ForeshadowingContext, 'projectId'>) {
    loading.value = true;
    error.value = null;

    try {
      const response = await foreshadowingApi.getConstraints(projectId, context);
      currentConstraints.value = response.data;
      return response.data;
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 加载紧急需要回收的伏笔
   */
  async function loadUrgent(projectId: string, threshold?: number) {
    try {
      const response = await foreshadowingApi.getUrgent(projectId, threshold);
      urgentForeshadowings.value = response.data.urgent;
      return response.data;
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    }
  }

  /**
   * 加载伏笔聚类组
   */
  async function loadClusters(projectId: string) {
    try {
      const response = await foreshadowingApi.getClusters(projectId);
      clusters.value = response.data.clusters;
      return response.data.clusters;
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    }
  }

  // 重置状态
  function reset() {
    foreshadowings.value = [];
    stats.value = null;
    suggestions.value = null;
    timeline.value = [];
    loading.value = false;
    error.value = null;
    currentProjectId.value = null;
    // V2新增状态重置
    aiDecisionResult.value = null;
    urgentForeshadowings.value = [];
    clusters.value = [];
    currentConstraints.value = null;
    aiDeciding.value = false;
  }

  return {
    // 状态
    foreshadowings,
    stats,
    suggestions,
    timeline,
    loading,
    error,
    currentProjectId,
    // V2新增状态
    aiDecisionResult,
    urgentForeshadowings,
    clusters,
    currentConstraints,
    aiDeciding,
    // 计算属性
    unresolvedForeshadowings,
    resolvedForeshadowings,
    abandonedForeshadowings,
    criticalForeshadowings,
    // V2新增计算属性
    dormantForeshadowings,
    mergedForeshadowings,
    foreshadowingsByValidity,
    foreshadowingsByCluster,
    // 方法
    loadForeshadowings,
    loadStats,
    loadSuggestions,
    loadTimeline,
    createForeshadowing,
    updateForeshadowing,
    resolveForeshadowing,
    abandonForeshadowing,
    deleteForeshadowing,
    analyzeScript,
    // V2新增方法
    aiDecide,
    getConstraints,
    loadUrgent,
    loadClusters,
    reset,
  };
});
