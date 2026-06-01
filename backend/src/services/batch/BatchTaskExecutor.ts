import axios from 'axios';
import { BatchTask, IBatchTask, IFailedEpisode, ITaskStats } from '../../models/BatchTask';
import { SSECallbackAdapter } from './SSECallbackAdapter';
import { broadcastTaskLog, broadcastTaskUpdate } from '../../controllers/taskManagerController';

/**
 * 批量任务执行器
 * 负责批量生成任务的编排、超时控制、重试管理、进度追踪
 */
export class BatchTaskExecutor {
    private static instance: BatchTaskExecutor;
    private readonly EPISODE_TIMEOUT = 45 * 60 * 1000;
    private readonly MAX_RETRY_ATTEMPTS = 3;
    private readonly RETRY_DELAY = 5000;
    private readonly INTER_EPISODE_DELAY = 10000;
    private readonly LOCK_TTL = 90 * 60 * 1000;

    private pausedTasks: Set<string> = new Set();
    private activeTaskLocks: Map<string, number> = new Map();
    private currentAbortController: AbortController | null = null;
    private taskCreatorMap: Map<string, string> = new Map();

    private constructor() { }

    static getInstance(): BatchTaskExecutor {
        if (!this.instance) {
            this.instance = new BatchTaskExecutor();
        }
        return this.instance;
    }

    pauseTask(taskId: string): void {
        this.pausedTasks.add(taskId);
        console.log(`[BatchTaskExecutor] Task ${taskId} marked for pause`);
    }

    resumeTask(taskId: string): void {
        this.pausedTasks.delete(taskId);
        console.log(`[BatchTaskExecutor] Task ${taskId} marked for resume`);
    }

    isTaskPaused(taskId: string): boolean {
        return this.pausedTasks.has(taskId);
    }

    /**
     * 处理批量任务（公开 API，编排整个生命周期）
     */
    async processTask(taskId: string): Promise<void> {
        const task = await BatchTask.findById(taskId);
        if (!task) {
            console.error(`[BatchTaskExecutor] Task ${taskId} not found`);
            return;
        }

        if (!this.acquireTaskLock(taskId)) {
            console.warn(`[BatchTaskExecutor] Task ${taskId} is already running, skip duplicate execution`);
            return;
        }

        try {
            console.log(`[BatchTaskExecutor] Starting task ${taskId}, ${task.episodes.length} episodes`);

            if (task.creatorId) {
                this.taskCreatorMap.set(taskId, task.creatorId);
            }

            const completedSet = this.initializeTask(task);
            await task.save();
            broadcastTaskUpdate(task);

            await this.executeEpisodeLoop(taskId, task, completedSet);
        } finally {
            this.taskCreatorMap.delete(taskId);
            this.releaseTaskLock(taskId);
        }
    }

    /**
     * 初始化任务状态，去重已完成集数，返回 completedSet
     */
    private initializeTask(task: IBatchTask): Set<number> {
        task.status = 'running';
        task.startedAt = new Date();

        const initialCompleted = task.completed || [];
        const completedSet = new Set(initialCompleted);
        if (completedSet.size !== initialCompleted.length) {
            task.completed = Array.from(completedSet);
        }
        return completedSet;
    }

    /**
     * 遍历集数列表，逐集生成，处理暂停/停止/错误
     */
    private async executeEpisodeLoop(
        taskId: string,
        task: IBatchTask,
        completedSet: Set<number>
    ): Promise<void> {
        const startTime = Date.now();
        const episodeTimes: number[] = [];

        for (let i = task.currentIndex; i < task.episodes.length; i++) {
            this.refreshTaskLock(taskId);
            const episodeNum = task.episodes[i];

            // 跳过已完成集数
            if (completedSet.has(episodeNum)) {
                task.currentIndex = i + 1;
                task.currentEpisode = episodeNum;
                await task.save();
                await this.addTaskLog(taskId, `⏭️ 第${episodeNum}集已完成，跳过`, 'info', episodeNum);
                continue;
            }

            task.currentIndex = i;
            task.currentEpisode = episodeNum;
            await task.save();

            // 生成单集，失败时暂停并退出循环
            const episodeStart = Date.now();
            const success = await this.processOneEpisode(taskId, task, episodeNum, completedSet, i);
            if (!success) return;

            episodeTimes.push(Date.now() - episodeStart);

            // 更新统计
            this.updateStats(task, startTime, episodeTimes, i);
            await task.save();

            // 集间延迟 + 外部中断检查
            const shouldContinue = await this.waitAndCheckInterruption(taskId, task, i);
            if (!shouldContinue) return;
        }

        await this.finalizeTask(taskId);
    }

    /**
     * 处理单集生成，成功返回 true，失败（暂停任务后）返回 false
     */
    private async processOneEpisode(
        taskId: string,
        task: IBatchTask,
        episodeNum: number,
        completedSet: Set<number>,
        index: number
    ): Promise<boolean> {
        try {
            console.log(`[BatchTaskExecutor] Generating episode ${episodeNum}...`);
            await this.generateEpisodeWithRetry(taskId, task.projectId, episodeNum);
            this.refreshTaskLock(taskId);

            if (!completedSet.has(episodeNum)) {
                task.completed.push(episodeNum);
                completedSet.add(episodeNum);
            }
            task.currentIndex = index + 1;

            await this.addTaskLog(taskId, `✅ 第${episodeNum}集生成完成`, 'info', episodeNum);
            await task.save();
            return true;
        } catch (error: any) {
            await this.handleEpisodeFailure(taskId, task, episodeNum, error);
            return false;
        }
    }

    /**
     * 统一处理集数生成失败：记录失败、暂停任务、广播更新
     */
    private async handleEpisodeFailure(
        taskId: string,
        task: IBatchTask,
        episodeNum: number,
        error: any
    ): Promise<void> {
        const errorMessage = error.message || String(error);
        const isTimeout = errorMessage === 'TIMEOUT';

        const failedEntry: IFailedEpisode = {
            episode: episodeNum,
            error: isTimeout ? '生成超时（30分钟）' : errorMessage.substring(0, 200),
            attempts: this.MAX_RETRY_ATTEMPTS
        };
        task.failed.push(failedEntry);

        if (isTimeout) {
            await this.addTaskLog(taskId, `⚠️ 第${episodeNum}集超时（30分钟），任务已暂停`, 'warn', episodeNum);
            console.warn(`[BatchTaskExecutor] Episode ${episodeNum} timeout, pausing task`);
        } else {
            await this.addTaskLog(taskId, `❌ 第${episodeNum}集失败: ${errorMessage.substring(0, 100)}`, 'error', episodeNum);
            console.error(`[BatchTaskExecutor] Episode ${episodeNum} failed:`, errorMessage);
        }

        task.status = 'paused';
        await task.save();
        broadcastTaskUpdate(task);

        const pauseLevel = isTimeout ? 'warn' : 'error';
        const pauseMsg = isTimeout ? '⏸️ 任务已暂停，请检查后点击继续' : '⏸️ 多次重试失败，任务已暂停，请检查后点击继续';
        await this.addTaskLog(taskId, pauseMsg, pauseLevel, episodeNum);
    }

    /**
     * 更新任务统计信息
     */
    private updateStats(task: IBatchTask, startTime: number, episodeTimes: number[], index: number): void {
        const avgTime = episodeTimes.reduce((a, b) => a + b, 0) / episodeTimes.length;
        task.stats = {
            totalTime: Date.now() - startTime,
            avgTimePerEpisode: avgTime,
            successRate: task.completed.length / (index + 1)
        } as ITaskStats;
    }

    /**
     * 集间延迟，并检查外部中断（暂停/停止）
     * 返回 true 表示继续，false 表示应退出循环
     */
    private async waitAndCheckInterruption(taskId: string, task: IBatchTask, index: number): Promise<boolean> {
        // 非最后一集时添加 API 冷却延迟
        if (index < task.episodes.length - 1) {
            console.log(`[BatchTaskExecutor] Waiting ${this.INTER_EPISODE_DELAY / 1000}s before next episode...`);
            await new Promise(resolve => setTimeout(resolve, this.INTER_EPISODE_DELAY));
            this.refreshTaskLock(taskId);
        }

        // 内存标记暂停（由 controller 设置）
        if (this.isTaskPaused(taskId)) {
            console.log(`[BatchTaskExecutor] Task ${taskId} paused by user, stopping execution`);
            return false;
        }

        // 数据库状态检查
        const currentTask = await BatchTask.findById(taskId);
        if (currentTask?.status === 'stopped') {
            console.log(`[BatchTaskExecutor] Task ${taskId} stopped by user`);
            return false;
        }
        if (currentTask?.status === 'paused') {
            console.log(`[BatchTaskExecutor] Task ${taskId} is paused, stopping execution`);
            return false;
        }

        return true;
    }

    /**
     * 完成任务：更新最终状态并广播
     */
    private async finalizeTask(taskId: string): Promise<void> {
        const finalTask = await BatchTask.findById(taskId);
        if (!finalTask) return;

        if (finalTask.status !== 'stopped') {
            finalTask.status = 'completed';
        }
        finalTask.completedAt = new Date();
        await finalTask.save();

        broadcastTaskUpdate(finalTask);

        const summary = `批量生成完成: 成功${finalTask.completed.length}集, 失败${finalTask.failed.length}集（含超时）, 跳过${finalTask.skipped.length}集`;
        await this.addTaskLog(taskId, summary, 'info', 0);
        console.log(`[BatchTaskExecutor] ${summary}`);
    }

    /**
     * 生成单集（带重试和超时），超时错误不重试直接抛出
     */
    private async generateEpisodeWithRetry(
        taskId: string,
        projectId: string,
        episodeNumber: number
    ): Promise<void> {
        for (let attempt = 0; attempt < this.MAX_RETRY_ATTEMPTS; attempt++) {
            this.refreshTaskLock(taskId);

            if (attempt > 0) {
                await this.addTaskLog(taskId, `🔄 第${episodeNumber}集第${attempt + 1}次重试...`, 'warn', episodeNumber);
                await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
            }

            try {
                await this.callGenerationAPIWithTimeout(taskId, projectId, episodeNumber);
                return;
            } catch (error: any) {
                // 超时不重试
                if (error.message === 'TIMEOUT') throw error;
                // 最后一次尝试也失败
                if (attempt >= this.MAX_RETRY_ATTEMPTS - 1) throw error;
            }
        }
    }

    /**
     * 带超时控制的生成 API 调用，超时时 abort 请求并抛出 TIMEOUT
     */
    private async callGenerationAPIWithTimeout(
        taskId: string,
        projectId: string,
        episodeNumber: number
    ): Promise<void> {
        this.currentAbortController = new AbortController();
        const timeoutId = setTimeout(() => {
            console.log(`[BatchTaskExecutor] Episode ${episodeNumber} timeout, aborting request...`);
            this.currentAbortController?.abort();
        }, this.EPISODE_TIMEOUT);

        try {
            await this.callGenerationAPI(taskId, projectId, episodeNumber, this.currentAbortController.signal);
        } catch (error: any) {
            if (error.name === 'CanceledError' || error.message?.includes('aborted')) {
                throw new Error('TIMEOUT');
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
            this.currentAbortController = null;
        }
    }

    /**
     * 调用生成 API（HTTP SSE 流式请求）
     */
    private async callGenerationAPI(
        taskId: string,
        projectId: string,
        episodeNumber: number,
        signal?: AbortSignal
    ): Promise<void> {
        const adapter = new SSECallbackAdapter(taskId, episodeNumber, (log) => {
            broadcastTaskLog(taskId, log, this.taskCreatorMap.get(taskId));
        });

        const port = process.env.PORT || 8333;
        const host = process.env.HOST || 'localhost';
        const url = `http://${host}:${port}/api/world-state/generate-script-enhanced`;
        console.log(`[BatchTaskExecutor] Calling generation API: ${url}`);

        return new Promise((resolve, reject) => {
            let doneReceived = false;
            let settled = false;

            const settle = (action: 'resolve' | 'reject', value?: Error) => {
                if (settled) return;
                settled = true;
                if (action === 'resolve') resolve();
                else reject(value);
            };

            axios.post(
                url,
                { projectId, episodeNumber, useWorldState: true },
                {
                    responseType: 'stream',
                    timeout: this.EPISODE_TIMEOUT,
                    signal,
                    headers: { 'Accept': 'text/event-stream' }
                }
            ).then(response => {
                let buffer = '';

                response.data.on('data', async (chunk: Buffer) => {
                    try {
                        buffer += chunk.toString();
                        const lines = buffer.split('\n\n');
                        buffer = lines.pop() || '';

                        for (const block of lines) {
                            for (const line of block.split('\n')) {
                                if (!line.startsWith('data: ')) continue;
                                await this.handleSSELine(line, adapter, doneReceived, (done) => {
                                    doneReceived = done;
                                }, settle);
                            }
                        }

                        if (await adapter.isClosed()) {
                            response.data.destroy();
                            settle('reject', new Error('Task cancelled by user'));
                        }
                    } catch (error) {
                        console.error('[BatchTaskExecutor] Error processing SSE chunk:', error);
                    }
                });

                response.data.on('end', () => {
                    if (!doneReceived) settle('reject', new Error('STREAM_ENDED_WITHOUT_DONE'));
                });
                response.data.on('error', (err: Error) => settle('reject', err));
            }).catch((err: Error) => settle('reject', err));
        });
    }

    /**
     * 处理单行 SSE data，分发到对应的 adapter 方法
     */
    private async handleSSELine(
        line: string,
        adapter: SSECallbackAdapter,
        _doneReceived: boolean,
        setDone: (v: boolean) => void,
        settle: (action: 'resolve' | 'reject', value?: Error) => void
    ): Promise<void> {
        try {
            const data = JSON.parse(line.substring(6));
            console.log(`[BatchTaskExecutor] Received SSE event: ${data.type}`);

            switch (data.type) {
                case 'progress':
                    await adapter.sendProgress(data.current, data.total, data.status);
                    break;
                case 'log':
                    console.log(`[BatchTaskExecutor] Processing log: ${data.message?.substring(0, 50)}`);
                    await adapter.sendLog(data.message, data.level);
                    break;
                case 'context':
                    await adapter.sendContext(data);
                    break;
                case 'analysis':
                    await adapter.sendAnalysis(data);
                    break;
                case 'multiHeadAnalysis':
                    await adapter.sendMultiHeadAnalysis(data);
                    break;
                case 'characterLifecycle':
                    await adapter.sendCharacterLifecycle(data);
                    break;
                case 'constraintValidation':
                    await adapter.sendConstraintValidation(data);
                    break;
                case 'aiConstraintDecision':
                    await adapter.sendAIConstraintDecision(data);
                    break;
                case 'budgetAllocation':
                    await adapter.sendBudgetAllocation(data);
                    break;
                case 'retryNotification':
                    await adapter.sendRetryNotification(data);
                    break;
                case 'chunk':
                    await adapter.sendChunk(data.content);
                    break;
                case 'done':
                    setDone(true);
                    try {
                        await adapter.sendDone(data);
                    } catch (error) {
                        console.error('[BatchTaskExecutor] Failed to handle done event:', error);
                    }
                    settle('resolve');
                    break;
                case 'error':
                    settle('reject', new Error(data.message));
                    break;
            }
        } catch (parseError) {
            console.warn('[BatchTaskExecutor] Failed to parse SSE data:', parseError);
        }
    }

    /**
     * 添加任务日志（原子操作，避免 VersionError）
     */
    private async addTaskLog(
        taskId: string,
        message: string,
        level: 'info' | 'warn' | 'error',
        episode: number
    ): Promise<void> {
        try {
            const logEntry = {
                time: new Date(),
                message: message.substring(0, 500),
                level,
                episode
            };

            // atomic update 避免并发 VersionError（不能用 task.save()）
            await BatchTask.findByIdAndUpdate(
                taskId,
                {
                    $push: {
                        logs: {
                            $each: [logEntry],
                            $slice: -200 // 只保留最后200条日志
                        }
                    },
                    $set: { updatedAt: new Date() }
                },
                { new: true, upsert: false }
            );

            broadcastTaskLog(taskId, logEntry, this.taskCreatorMap.get(taskId));
        } catch (error) {
            console.error(`[BatchTaskExecutor] Failed to add log:`, error);
        }
    }

    private acquireTaskLock(taskId: string): boolean {
        const now = Date.now();
        const lastTouch = this.activeTaskLocks.get(taskId);

        if (lastTouch && now - lastTouch < this.LOCK_TTL) {
            return false;
        }

        if (lastTouch) {
            console.warn(`[BatchTaskExecutor] Stale lock detected for task ${taskId}, releasing`);
        }

        this.activeTaskLocks.set(taskId, now);
        return true;
    }

    private refreshTaskLock(taskId: string): void {
        if (this.activeTaskLocks.has(taskId)) {
            this.activeTaskLocks.set(taskId, Date.now());
        }
    }

    private releaseTaskLock(taskId: string): void {
        this.activeTaskLocks.delete(taskId);
    }

    /**
     * 服务启动时恢复未完成的任务
     */
    async recoverPendingTasks(): Promise<void> {
        try {
            const pendingTasks = await BatchTask.find({
                status: { $in: ['pending', 'running'] }
            });

            if (pendingTasks.length === 0) {
                console.log('[BatchTaskExecutor] No pending tasks to recover');
                return;
            }

            console.log(`[BatchTaskExecutor] Recovering ${pendingTasks.length} pending tasks`);

            for (const task of pendingTasks) {
                console.log(`[BatchTaskExecutor] Recovering task ${task._id} for project ${task.projectId}`);

                // 异步执行，不阻塞启动流程
                this.processTask(task._id.toString()).catch(err => {
                    console.error(`[BatchTaskExecutor] Failed to recover task ${task._id}:`, err);
                });
            }
        } catch (error) {
            console.error('[BatchTaskExecutor] Failed to recover pending tasks:', error);
        }
    }
}
