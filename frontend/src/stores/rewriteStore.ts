import { rewriteApi } from '@/services/api';
import type {
  DiffBlock,
  RewriteHistory,
  RewriteHistoryStats,
  RewriteResult,
  RewriteType
} from '@/types';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export const useRewriteStore = defineStore('rewrite', () => {
  const history = ref<RewriteHistory[]>([]);
  const projectHistory = ref<RewriteHistory[]>([]);
  const projectHistoryByEpisode = ref<Record<number, RewriteHistory[]>>({});
  const historyStats = ref<RewriteHistoryStats | null>(null);
  const currentRewrite = ref<RewriteResult | null>(null);
  const currentHistoryDetail = ref<{ history: RewriteHistory; diff: DiffBlock[] } | null>(null);
  const streamingContent = ref('');
  const loading = ref(false);
  const streaming = ref(false);
  const error = ref<string | null>(null);
  const typeFilter = ref<RewriteType | undefined>(undefined);
  const searchQuery = ref('');
  const batchProgress = ref<{
    current: number;
    total: number;
    episodeNumber: number;
  } | null>(null);

  const hasCurrentRewrite = computed(() => currentRewrite.value !== null);
  const appliedHistory = computed(() => history.value.filter(h => h.applied));
  const pendingHistory = computed(() => history.value.filter(h => !h.applied));

  async function withLoading<T>(fn: () => Promise<T>): Promise<T> {
    loading.value = true;
    error.value = null;
    try {
      return await fn();
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  function updateHistoryItem(historyId: string, updates: Partial<RewriteHistory>) {
    const item = history.value.find(h => h._id === historyId);
    if (item) Object.assign(item, updates);
  }

  function removeHistoryItem(historyId: string) {
    history.value = history.value.filter(h => h._id !== historyId);
    projectHistory.value = projectHistory.value.filter(h => h._id !== historyId);

    for (const episodeNum in projectHistoryByEpisode.value) {
      projectHistoryByEpisode.value[episodeNum] =
        projectHistoryByEpisode.value[episodeNum]?.filter(h => h._id !== historyId) || [];
    }
  }

  async function loadHistory(
    episodeId: string,
    projectId: string,
    options?: { type?: RewriteType; search?: string }
  ) {
    return withLoading(async () => {
      const response = await rewriteApi.getHistory(episodeId, projectId, options);
      history.value = response.data.history;
      historyStats.value = response.data.stats;
    });
  }

  async function loadProjectHistory(
    projectId: string,
    options?: { type?: RewriteType; search?: string }
  ) {
    return withLoading(async () => {
      const response = await rewriteApi.getProjectHistory(projectId, options);
      projectHistory.value = response.data.history;
      projectHistoryByEpisode.value = response.data.byEpisode;
      historyStats.value = response.data.stats;
    });
  }

  async function loadHistoryDetail(historyId: string, projectId: string) {
    return withLoading(async () => {
      const response = await rewriteApi.getHistoryDetail(historyId, projectId);
      currentHistoryDetail.value = response.data;
      return response.data;
    });
  }

  async function deleteHistory(historyId: string, projectId: string) {
    return withLoading(async () => {
      await rewriteApi.deleteHistory(historyId, projectId);
      removeHistoryItem(historyId);
      if (historyStats.value) historyStats.value.total--;
    });
  }

  async function rewrite(params: {
    projectId: string;
    episodeId: string;
    episodeNumber?: number;
    type?: string;
    instruction: string;
    selection?: { start: number; end: number; text: string };
  }) {
    return withLoading(async () => {
      currentRewrite.value = null;
      const response = await rewriteApi.rewrite(params);
      currentRewrite.value = response.data;
      return response.data;
    });
  }

  async function rewriteStream(
    params: {
      projectId: string;
      episodeId: string;
      episodeNumber?: number;
      type?: string;
      instruction: string;
      selection?: { start: number; end: number; text: string };
    },
    callbacks?: { onChunk?: (text: string) => void }
  ) {
    streaming.value = true;
    loading.value = true;
    error.value = null;
    currentRewrite.value = null;
    streamingContent.value = '';

    try {
      await rewriteApi.rewriteStream(params, {
        onChunk: (text) => {
          streamingContent.value += text;
          callbacks?.onChunk?.(text);
        },
        onComplete: (result) => {
          currentRewrite.value = result;
        },
        onError: (err) => {
          error.value = err.message;
        },
      });
      return currentRewrite.value;
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    } finally {
      streaming.value = false;
      loading.value = false;
    }
  }

  async function applyRewrite(historyId: string, projectId: string) {
    return withLoading(async () => {
      await rewriteApi.apply(historyId, projectId);
      updateHistoryItem(historyId, { applied: true, appliedAt: new Date() });
      if (currentRewrite.value?.historyId === historyId) {
        currentRewrite.value = null;
      }
    });
  }

  async function revertRewrite(historyId: string, projectId: string) {
    return withLoading(async () => {
      const response = await rewriteApi.revert(historyId, projectId);
      updateHistoryItem(historyId, { applied: false, appliedAt: undefined });
      return response.data;
    });
  }

  async function batchRewrite(
    projectId: string,
    episodeIds: string[],
    instruction: string,
    callbacks?: {
      onProgress?: (data: { current: number; total: number; episodeNumber: number }) => void;
    }
  ) {
    loading.value = true;
    error.value = null;
    batchProgress.value = null;

    try {
      let results: RewriteResult[] = [];
      await rewriteApi.batchRewrite(projectId, episodeIds, instruction, {
        onProgress: (data) => {
          batchProgress.value = data;
          callbacks?.onProgress?.(data);
        },
        onComplete: (r) => {
          results = r;
        },
        onError: (err) => {
          error.value = err.message;
        },
      });
      return results;
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    } finally {
      loading.value = false;
      batchProgress.value = null;
    }
  }

  function setTypeFilter(type: RewriteType | undefined) {
    typeFilter.value = type;
  }

  function setSearchQuery(query: string) {
    searchQuery.value = query;
  }

  function clearCurrentRewrite() {
    currentRewrite.value = null;
    streamingContent.value = '';
  }

  function clearHistoryDetail() {
    currentHistoryDetail.value = null;
  }

  function reset() {
    history.value = [];
    projectHistory.value = [];
    projectHistoryByEpisode.value = {};
    historyStats.value = null;
    currentRewrite.value = null;
    currentHistoryDetail.value = null;
    streamingContent.value = '';
    loading.value = false;
    streaming.value = false;
    error.value = null;
    batchProgress.value = null;
    typeFilter.value = undefined;
    searchQuery.value = '';
  }

  function getDiffStats(diff: DiffBlock[]) {
    const stats = { added: 0, removed: 0, unchanged: 0 };

    for (const block of diff) {
      const lines = block.content.split('\n').length;
      if (block.type === 'added') stats.added += lines;
      else if (block.type === 'removed') stats.removed += lines;
      else stats.unchanged += lines;
    }

    return stats;
  }

  return {
    // 状态
    history,
    projectHistory,
    projectHistoryByEpisode,
    historyStats,
    currentRewrite,
    currentHistoryDetail,
    streamingContent,
    loading,
    streaming,
    error,
    batchProgress,
    typeFilter,
    searchQuery,
    // 计算属性
    hasCurrentRewrite,
    appliedHistory,
    pendingHistory,
    // 方法
    loadHistory,
    loadProjectHistory,
    loadHistoryDetail,
    deleteHistory,
    rewrite,
    rewriteStream,
    applyRewrite,
    revertRewrite,
    batchRewrite,
    setTypeFilter,
    setSearchQuery,
    clearCurrentRewrite,
    clearHistoryDetail,
    reset,
    getDiffStats,
  };
});
