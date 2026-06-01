import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { batchTaskApi } from '@/services/batchTaskApi';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8333/api';

export interface Task {
    _id: string;
    projectId: string;
    projectName?: string;
    modelName?: string;
    status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'stopped';
    episodes: number[];
    currentIndex: number;
    currentEpisode?: number;
    completed: number[];
    failed: Array<{ episode: number; error: string; attempts: number }>;
    skipped: number[];
    currentProgress?: {
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
    stats?: {
        totalTime: number;
        avgTimePerEpisode: number;
        successRate: number;
    };
    createdAt: string;
    startedAt?: string;
    pausedAt?: string;
    completedAt?: string;
    updatedAt: string;
}

export const useTaskManagerStore = defineStore('taskManager', () => {
    console.log('[TaskStore] Initializing with API_BASE:', API_BASE);

    const tasks = ref<Task[]>([]);
    const selectedTaskId = ref<string | null>(null);
    const sseConnection = ref<EventSource | null>(null);
    const isConnected = ref(false);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    const runningCount = computed(() =>
        tasks.value.filter(t => t.status === 'running' || t.status === 'pending').length
    );

    const activeTasks = computed(() =>
        tasks.value.filter(t => ['pending', 'running', 'paused'].includes(t.status))
    );

    const completedTasks = computed(() =>
        tasks.value.filter(t => ['completed', 'failed', 'stopped'].includes(t.status))
    );

    const selectedTask = computed(() =>
        tasks.value.find(t => t._id === selectedTaskId.value) || null
    );

    let beforeUnloadHandler: (() => void) | null = null;
    let retryCount = 0;
    const MAX_RETRIES = 5;

    function connectSSE() {
        if (sseConnection.value) {
            console.log('[TaskStore] SSE already connected');
            return;
        }

        const token = localStorage.getItem('comic-script-creator-token');
        if (!token) {
            console.warn('[TaskStore] No auth token, skipping SSE connection');
            return;
        }

        const baseUrl = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
        const url = `${baseUrl}/tasks/stream?token=${encodeURIComponent(token)}`;
        console.log('[TaskStore] Connecting to SSE...');

        const eventSource = new EventSource(url);
        let isUnloading = false;

        beforeUnloadHandler = () => {
            isUnloading = true;
            eventSource.close();
        };
        window.addEventListener('beforeunload', beforeUnloadHandler);

        eventSource.onopen = () => {
            console.log('[TaskStore] SSE connected');
            isConnected.value = true;
            error.value = null;
            retryCount = 0;
        };

        eventSource.onmessage = (event) => {
            try {
                handleSSEEvent(JSON.parse(event.data));
            } catch (e) {
                console.error('[TaskStore] Failed to parse SSE event:', e);
            }
        };

        eventSource.onerror = (e) => {
            if (isUnloading) return;

            console.error('[TaskStore] SSE error:', e);
            isConnected.value = false;
            disconnectSSE();

            retryCount++;
            if (retryCount > MAX_RETRIES) {
                console.warn(`[TaskStore] SSE max retries (${MAX_RETRIES}) reached, stopping`);
                error.value = '连接失败，请刷新页面重试';
                return;
            }

            const delay = Math.min(5000 * retryCount, 30000);
            error.value = `SSE 连接断开，${Math.round(delay / 1000)}秒后重试...`;
            setTimeout(() => {
                if (!isConnected.value && !isUnloading) {
                    connectSSE();
                }
            }, delay);
        };

        sseConnection.value = eventSource;
    }

    function disconnectSSE() {
        if (sseConnection.value) {
            sseConnection.value.close();
            sseConnection.value = null;
            isConnected.value = false;
            console.log('[TaskStore] SSE disconnected');
        }
        if (beforeUnloadHandler) {
            window.removeEventListener('beforeunload', beforeUnloadHandler);
            beforeUnloadHandler = null;
        }
    }

    function handleSSEEvent(data: any) {
        switch (data.type) {
            case 'tasks-snapshot':
                tasks.value = data.tasks || [];
                console.log('[TaskStore] Received tasks snapshot:', tasks.value.length);
                break;
            case 'task-update':
                updateTask(data.task);
                break;
            case 'task-log':
                addLogToTask(data.taskId, data.log);
                break;
            case 'task-deleted':
                removeTask(data.taskId);
                break;
            case 'heartbeat':
                break;
            default:
                console.log('[TaskStore] Unknown SSE event type:', data.type);
        }
    }

    function updateTask(task: Task) {
        const index = tasks.value.findIndex(t => t._id === task._id);
        if (index >= 0) {
            tasks.value[index] = task;
        } else {
            tasks.value.unshift(task);
        }
    }

    function addLogToTask(taskId: string, log: any) {
        const task = tasks.value.find(t => t._id === taskId);
        if (task) {
            task.logs = task.logs || [];
            task.logs.push(log);
            if (task.logs.length > 200) {
                task.logs = task.logs.slice(-200);
            }
        }
    }

    function removeTask(taskId: string) {
        const index = tasks.value.findIndex(t => t._id === taskId);
        if (index >= 0) {
            tasks.value.splice(index, 1);
        }
        if (selectedTaskId.value === taskId) {
            selectedTaskId.value = null;
        }
    }

    async function refreshTasks() {
        isLoading.value = true;
        try {
            const response = await batchTaskApi.getAllTasks();
            tasks.value = response.data as any;
            console.log('[TaskStore] Refreshed tasks:', tasks.value.length);
        } catch (e) {
            console.error('[TaskStore] Failed to refresh tasks:', e);
            error.value = '刷新任务列表失败';
        } finally {
            isLoading.value = false;
        }
    }

    async function executeTaskAction(
        taskId: string,
        action: (id: string) => Promise<any>,
        errorMsg: string
    ) {
        try {
            const response = await action(taskId);
            if (response.data.success) {
                updateTask(response.data.task);
            }
            return response.data;
        } catch (e: any) {
            console.error(`[TaskStore] ${errorMsg}:`, e);
            throw new Error(e.response?.data?.error || errorMsg);
        }
    }

    async function pauseTask(taskId: string) {
        return executeTaskAction(taskId, batchTaskApi.pauseTask, '暂停任务失败');
    }

    async function resumeTask(taskId: string) {
        return executeTaskAction(taskId, batchTaskApi.resumeTask, '恢复任务失败');
    }

    async function stopTask(taskId: string) {
        return executeTaskAction(taskId, batchTaskApi.stopTaskV2, '停止任务失败');
    }

    async function deleteTask(taskId: string) {
        try {
            const response = await batchTaskApi.deleteTaskV2(taskId);
            if ((response.data as any).success) {
                removeTask(taskId);
            }
            return response.data;
        } catch (e: any) {
            console.error('[TaskStore] Failed to delete task:', e);
            throw new Error(e.response?.data?.error || '删除任务失败');
        }
    }

    function selectTask(taskId: string | null) {
        selectedTaskId.value = taskId;
    }

    return {
        // 状态
        tasks,
        selectedTaskId,
        isConnected,
        isLoading,
        error,

        // 计算属性
        runningCount,
        activeTasks,
        completedTasks,
        selectedTask,

        // 方法
        connectSSE,
        disconnectSSE,
        refreshTasks,
        pauseTask,
        resumeTask,
        stopTask,
        deleteTask,
        selectTask,
    };
});
