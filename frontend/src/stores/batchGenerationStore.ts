import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { batchTaskApi, type IBatchTask } from '@/services/batchTaskApi';

/**
 * 批量生成任务状态管理
 */
export const useBatchGenerationStore = defineStore('batchGeneration', () => {
    // ===== 状态 =====
    const currentTask = ref<IBatchTask | null>(null);
    const isPolling = ref(false);
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    // ===== 方法 =====

    /**
     * 启动批量任务
     */
    async function startBatchTask(projectId: string, episodes: number[]): Promise<IBatchTask> {
        const { data } = await batchTaskApi.create(projectId, episodes);
        currentTask.value = data;

        // 保存到 localStorage
        localStorage.setItem('batch-task-id', data._id);
        localStorage.setItem('batch-project-id', projectId);

        // 启动轮询
        startPolling(projectId, data._id);

        return data;
    }

    /**
     * 智能轮询：3-10秒动态间隔
     */
    function startPolling(projectId: string, taskId: string) {
        if (isPolling.value) {
            console.log('[BatchStore] Polling already active');
            return;
        }

        isPolling.value = true;
        let consecutiveNoChange = 0;
        let lastCompletedCount = 0;

        const poll = async () => {
            if (!isPolling.value) return;

            try {
                const { data } = await batchTaskApi.getStatus(projectId, taskId);

                // 校验项目是否已切换，防止旧项目数据覆盖
                const currentCachedProjectId = localStorage.getItem('batch-project-id');
                if (currentCachedProjectId !== projectId) {
                    console.log('[BatchStore] Project switched, discarding old poll result');
                    isPolling.value = false;
                    return;
                }

                currentTask.value = data;

                // 智能调整轮询间隔
                const currentCompletedCount = data.completed.length;
                if (currentCompletedCount === lastCompletedCount) {
                    consecutiveNoChange++;
                } else {
                    consecutiveNoChange = 0;
                    lastCompletedCount = currentCompletedCount;
                }

                // 如果任务结束，停止轮询
                if (data.status !== 'running' && data.status !== 'pending') {
                    isPolling.value = false;
                    localStorage.removeItem('batch-task-id');
                    localStorage.removeItem('batch-project-id');
                    console.log(`[BatchStore] Task ${taskId} finished with status: ${data.status}`);
                    return;
                }

                // 继续轮询，动态间隔
                const interval = Math.min(3000 + consecutiveNoChange * 1000, 10000);
                pollTimer = setTimeout(poll, interval);
            } catch (error) {
                console.error('[BatchStore] Polling failed:', error);
                // 错误时延长间隔到10秒
                pollTimer = setTimeout(poll, 10000);
            }
        };

        poll();
    }

    /**
     * 恢复任务（页面刷新后）或查找当前项目的活跃任务
     */
    async function resumeTask(projectId: string): Promise<IBatchTask | null> {
        const cachedTaskId = localStorage.getItem('batch-task-id');
        const cachedProjectId = localStorage.getItem('batch-project-id');

        // 1. 先检查 localStorage 缓存（同项目）
        if (cachedTaskId && cachedProjectId === projectId) {
            try {
                const { data } = await batchTaskApi.getStatus(projectId, cachedTaskId);
                // 如果任务还在运行，恢复轮询
                if (data.status === 'running' || data.status === 'pending' || data.status === 'paused') {
                    currentTask.value = data;
                    startPolling(projectId, cachedTaskId);
                    console.log(`[BatchStore] Resumed cached task ${cachedTaskId}`);
                    return data;
                }
            } catch (e) {
                console.warn('[BatchStore] Cached task not found:', e);
            }
        }

        // 2. 清除无效缓存
        localStorage.removeItem('batch-task-id');
        localStorage.removeItem('batch-project-id');

        // 3. 查询当前项目的活跃任务
        try {
            const { data } = await batchTaskApi.getActive(projectId);
            if (data && (data.status === 'running' || data.status === 'pending' || data.status === 'paused')) {
                currentTask.value = data;
                // 保存到缓存
                localStorage.setItem('batch-task-id', data._id);
                localStorage.setItem('batch-project-id', projectId);
                startPolling(projectId, data._id);
                console.log(`[BatchStore] Found active task ${data._id} for project ${projectId}`);
                return data;
            }
        } catch (e) {
            console.warn('[BatchStore] Failed to get active task:', e);
        }

        return null;
    }

    /**
     * 停止任务
     */
    async function stopTask(projectId: string): Promise<void> {
        if (!currentTask.value) return;

        // 停止轮询
        isPolling.value = false;
        if (pollTimer) {
            clearTimeout(pollTimer);
            pollTimer = null;
        }

        // 调用停止 API
        await batchTaskApi.stop(projectId, currentTask.value._id);
    }

    /**
     * 清理任务状态
     */
    function clearTask() {
        currentTask.value = null;
        isPolling.value = false;
        if (pollTimer) {
            clearTimeout(pollTimer);
            pollTimer = null;
        }
        localStorage.removeItem('batch-task-id');
        localStorage.removeItem('batch-project-id');
    }

    // ===== 计算属性 =====

    /**
     * 已完成集数（去重）
     */
    const completedCount = computed(() => {
        const completed = currentTask.value?.completed || [];
        return new Set(completed).size;
    });

    /**
     * 进度信息
     */
    const progress = computed(() => ({
        current: completedCount.value,
        total: currentTask.value?.episodes.length || 0,
        currentEpisode: currentTask.value?.currentEpisode || 0,
    }));

    /**
     * 是否正在运行
     */
    const isRunning = computed(() =>
        currentTask.value?.status === 'running' ||
        currentTask.value?.status === 'pending'
    );

    /**
     * 失败集数
     */
    const failedCount = computed(() => currentTask.value?.failed.length || 0);

    /**
     * 超时跳过集数
     */
    const skippedCount = computed(() => currentTask.value?.skipped.length || 0);

    /**
     * 预估剩余时间（毫秒）
     */
    const estimatedRemaining = computed(() => {
        const task = currentTask.value;
        if (!task?.stats?.avgTimePerEpisode) return null;

        const remaining =
            task.episodes.length -
            completedCount.value -
            task.failed.length -
            task.skipped.length;

        return remaining * task.stats.avgTimePerEpisode;
    });

    return {
        // 状态
        currentTask,
        isPolling,

        // 计算属性
        progress,
        isRunning,
        completedCount,
        failedCount,
        skippedCount,
        estimatedRemaining,

        // 方法
        startBatchTask,
        resumeTask,
        stopTask,
        clearTask,
    };
});
