import { validationApi } from '@/services/api';
import type { ValidationIssue, ValidationResult } from '@/types';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

type ValidationCallbacks = {
  onInit?: (data: { episodeCount: number; characterCount: number }) => void;
  onProgress?: (data: { current: number; total: number; windowStart: number; windowEnd: number }) => void;
};

function groupBy<T>(items: T[], keyFn: (item: T) => string | number): Record<string | number, T[]> {
  const grouped: Record<string | number, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!grouped[key]) grouped[key] = [];
    grouped[key]!.push(item);
  }
  return grouped;
}

export const useValidationStore = defineStore('validation', () => {
  const issues = ref<ValidationIssue[]>([]);
  const result = ref<ValidationResult | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const progress = ref<{ current: number; total: number; windowStart: number; windowEnd: number } | null>(null);
  const initInfo = ref<{ episodeCount: number; characterCount: number } | null>(null);
  const windows = ref<Array<{ start: number; end: number }>>([]);

  const errorIssues = computed(() => issues.value.filter(i => i.type === 'error'));
  const warningIssues = computed(() => issues.value.filter(i => i.type === 'warning'));
  const infoIssues = computed(() => issues.value.filter(i => i.type === 'info'));
  const issuesByEpisode = computed(() => groupBy(issues.value, i => i.episode));
  const issuesByCategory = computed(() => groupBy(issues.value, i => i.category));

  const hasErrors = computed(() => errorIssues.value.length > 0);
  const hasWarnings = computed(() => warningIssues.value.length > 0);
  const summary = computed(() => ({
    errors: errorIssues.value.length,
    warnings: warningIssues.value.length,
    info: infoIssues.value.length,
    total: issues.value.length,
  }));

  function resetState(): void {
    loading.value = true;
    error.value = null;
    issues.value = [];
    result.value = null;
    progress.value = null;
    initInfo.value = null;
  }

  async function executeValidation(
    apiCall: Promise<void>,
    _callbacks?: ValidationCallbacks
  ): Promise<ValidationResult | null> {
    resetState();
    try {
      await apiCall;
      return result.value;
    } catch (err: any) {
      error.value = err?.response?.data?.error || err?.message || '验证失败';
      throw err;
    } finally {
      loading.value = false;
      progress.value = null;
    }
  }

  function createValidationHandlers(callbacks?: ValidationCallbacks) {
    return {
      onInit: (data: { episodeCount: number; characterCount: number }) => {
        initInfo.value = data;
        callbacks?.onInit?.(data);
      },
      onProgress: (data: { current: number; total: number; windowStart: number; windowEnd: number }) => {
        progress.value = data;
        callbacks?.onProgress?.(data);
      },
      onComplete: (r: ValidationResult) => {
        result.value = r;
        issues.value = r.issues;
      },
      onError: (err: Error) => {
        error.value = err.message;
      },
    };
  }

  async function validateProject(projectId: string, callbacks?: ValidationCallbacks) {
    return executeValidation(
      validationApi.validateProject(projectId, createValidationHandlers(callbacks)),
      callbacks
    );
  }

  async function validateRange(
    projectId: string,
    startEpisode: number,
    endEpisode: number,
    callbacks?: ValidationCallbacks
  ) {
    return executeValidation(
      validationApi.validateRange(projectId, startEpisode, endEpisode, createValidationHandlers(callbacks)),
      callbacks
    );
  }

  async function loadWindows(projectId: string) {
    try {
      const response = await validationApi.getWindows(projectId);
      windows.value = response.data.windows;
      return windows.value;
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    }
  }

  async function loadReports(projectId: string) {
    try {
      const response = await validationApi.getReports(projectId);
      return response.data.reports || [];
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    }
  }

  function populateReportData(report: any): void {
    result.value = {
      success: true,
      issues: report.issues,
      summary: report.summary,
      report: {
        score: report.score,
        rating: report.rating,
        totalIssues: report.totalIssues,
        issues: report.issues,
        summary: report.summary,
      },
    };
    issues.value = report.issues;
  }

  async function loadLatestReport(projectId: string) {
    try {
      const response = await validationApi.getLatestReport(projectId);
      const report = response.data.report;
      if (!report) return null;
      populateReportData(report);
      return report;
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    }
  }

  async function loadReportDetail(reportId: string) {
    try {
      const response = await validationApi.getReportDetail(reportId);
      const report = response.data.report;
      populateReportData(report);
      return report;
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    }
  }

  async function deleteReport(reportId: string) {
    try {
      await validationApi.deleteReport(reportId);
      return true;
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    }
  }

  function filterByEpisode(episode: number) {
    return issues.value.filter(i => i.episode === episode);
  }

  function filterByCategory(category: string) {
    return issues.value.filter(i => i.category === category);
  }

  function filterByType(type: 'error' | 'warning' | 'info') {
    return issues.value.filter(i => i.type === type);
  }

  function clearResults() {
    issues.value = [];
    result.value = null;
    progress.value = null;
    initInfo.value = null;
  }

  function reset() {
    clearResults();
    loading.value = false;
    error.value = null;
    windows.value = [];
  }

  return {
    // 状态
    issues,
    result,
    loading,
    error,
    progress,
    initInfo,
    windows,
    // 计算属性
    errorIssues,
    warningIssues,
    infoIssues,
    issuesByEpisode,
    issuesByCategory,
    hasErrors,
    hasWarnings,
    summary,
    // 方法
    validateProject,
    validateRange,
    loadWindows,
    loadReports,
    loadLatestReport,
    loadReportDetail,
    deleteReport,
    filterByEpisode,
    filterByCategory,
    filterByType,
    clearResults,
    reset,
  };
});
