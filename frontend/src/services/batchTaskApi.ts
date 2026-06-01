import http from './api';

/**
 * 批量任务接口
 */
export interface IBatchTask {
    _id: string;
    projectId: string;
    status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'stopped';

    episodes: number[];
    currentIndex: number;
    currentEpisode: number;

    completed: number[];
    failed: Array<{
        episode: number;
        error: string;
        attempts: number;
    }>;
    skipped: number[];

    currentProgress: {
        percent: number;
        step: string;
        message: string;
        startTime: string;
    };

    logs: Array<{
        time: string;
        message: string;
        level: 'info' | 'warn' | 'error';
        episode: number;
    }>;

    lastContext?: any;
    lastAnalysis?: any;
    lastMultiHeadAnalysis?: any;
    lastConstraintValidation?: any;
    lastAIConstraintDecision?: any;
    lastBudgetAllocation?: any;

    stats: {
        totalTime: number;
        avgTimePerEpisode: number;
        successRate: number;
    };

    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    updatedAt: string;
}

/**
 * 批量任务 API
 */
export const batchTaskApi = {
    /**
     * 创建批量任务
     */
    create: (projectId: string, episodes: number[]) =>
        http.post<IBatchTask>(`/world-state/${projectId}/batch-tasks`, { episodes }),

    /**
     * 获取任务状态
     */
    getStatus: (projectId: string, taskId: string) =>
        http.get<IBatchTask>(`/world-state/${projectId}/batch-tasks/${taskId}`),

    /**
     * 停止任务
     */
    stop: (projectId: string, taskId: string) =>
        http.post(`/world-state/${projectId}/batch-tasks/${taskId}/stop`),

    /**
     * 获取活跃任务
     */
    getActive: (projectId: string) =>
        http.get<IBatchTask | null>(`/world-state/${projectId}/batch-tasks/active`),

    /**
     * 删除任务（可选）
     */
    /**
     * 删除任务（可选）
     */
    delete: (projectId: string, taskId: string) =>
        http.delete(`/world-state/${projectId}/batch-tasks/${taskId}`),

    // ==========================================
    // 新版统一任务管理 API (对应 taskManagerController)
    // ==========================================

    /**
     * 获取所有任务
     */
    getAllTasks: () => {
        const url = getAbsoluteUrl('/tasks');
        return http.get<IBatchTask[]>(url);
    },

    /**
     * 暂停任务
     */
    pauseTask: (taskId: string) => {
        const url = getAbsoluteUrl(`/tasks/${taskId}/pause`);
        return http.post(url);
    },

    /**
     * 恢复任务
     */
    resumeTask: (taskId: string) => {
        const url = getAbsoluteUrl(`/tasks/${taskId}/resume`);
        return http.post(url);
    },

    /**
     * 停止任务 (新版)
     */
    stopTaskV2: (taskId: string) => {
        const url = getAbsoluteUrl(`/tasks/${taskId}/stop`);
        return http.post(url);
    },

    /**
     * 删除任务 (新版)
     */
    deleteTaskV2: (taskId: string) => {
        const url = getAbsoluteUrl(`/tasks/${taskId}`);
        return http.delete(url);
    },
};

// 辅助函数：构造绝对 URL 以绕过 axios potential baseURL double-prefix issue
function getAbsoluteUrl(path: string): string {
    const envBase = import.meta.env.VITE_API_BASE || 'http://localhost:8333/api';
    console.log('[TaskApi] EnvBase:', envBase);

    // 确保 base 不以前缀 / 结尾
    const base = envBase.endsWith('/') ? envBase.slice(0, -1) : envBase;
    // 确保 path 以 / 开头
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    const finalUrl = `${base}${cleanPath}`;
    console.log('[TaskApi] Requesting:', finalUrl);
    return finalUrl;
}
