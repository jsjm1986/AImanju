import { Router, Request, Response } from 'express';
import { BatchTask, IBatchTask } from '../models/BatchTask';
import { BatchTaskExecutor } from '../services/batch/BatchTaskExecutor';

const router = Router();

// SSE 客户端信息
interface SSEClientInfo {
    creatorId: string;
    isAdmin: boolean;
}

// SSE 客户端列表：res -> 客户端信息
const sseClients: Map<Response, SSEClientInfo> = new Map();

/**
 * 判断是否为管理员
 */
function isAdmin(req: Request): boolean {
    return req.creator?.role === 'admin';
}

/**
 * 广播任务更新给匹配的 SSE 客户端
 */
export function broadcastTaskUpdate(task: IBatchTask) {
    const event = JSON.stringify({ type: 'task-update', task });
    const taskCreatorId = task.creatorId;
    sseClients.forEach((info, client) => {
        // 有 creatorId 的任务只推给所属用户和 admin
        // 无 creatorId 的存量任务只推给 admin
        if (info.isAdmin || (taskCreatorId && info.creatorId === taskCreatorId)) {
            client.write(`data: ${event}\n\n`);
        }
    });
}

/**
 * 广播任务删除给匹配的 SSE 客户端
 */
export function broadcastTaskDeleted(taskId: string, creatorId?: string) {
    const event = JSON.stringify({ type: 'task-deleted', taskId });
    sseClients.forEach((info, client) => {
        if (info.isAdmin || (creatorId && info.creatorId === creatorId)) {
            client.write(`data: ${event}\n\n`);
        }
    });
}

/**
 * 广播任务日志给匹配的 SSE 客户端
 */
export function broadcastTaskLog(taskId: string, log: { time: Date; message: string; level: string; episode?: number }, creatorId?: string) {
    const event = JSON.stringify({ type: 'task-log', taskId, log });
    sseClients.forEach((info, client) => {
        if (info.isAdmin || (creatorId && info.creatorId === creatorId)) {
            client.write(`data: ${event}\n\n`);
        }
    });
}

/**
 * 构建用户过滤查询条件
 */
function buildUserQuery(req: Request): Record<string, any> {
    if (isAdmin(req)) return {};
    // 普通用户只能看到自己的任务
    return { creatorId: req.creatorId };
}

/**
 * 获取所有任务
 * GET /api/tasks
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const query = buildUserQuery(req);
        const tasks = await BatchTask.find(query)
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        res.json(tasks);
    } catch (error) {
        console.error('[TaskManager] Failed to get tasks:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * SSE 实时推送
 * GET /api/tasks/stream
 */
router.get('/stream', async (req: Request, res: Response) => {
    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // 添加到客户端列表（带用户标识）
    sseClients.set(res, { creatorId: req.creatorId!, isAdmin: isAdmin(req) });
    console.log(`[TaskManager] SSE client connected (creator: ${req.creatorId}, admin: ${isAdmin(req)}), total: ${sseClients.size}`);

    // 发送初始任务列表（按用户过滤）
    try {
        const query = buildUserQuery(req);
        const tasks = await BatchTask.find(query)
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        const snapshot = JSON.stringify({ type: 'tasks-snapshot', tasks });
        res.write(`data: ${snapshot}\n\n`);
    } catch (error) {
        console.error('[TaskManager] Failed to send initial tasks:', error);
    }

    // 心跳保持连接
    const heartbeat = setInterval(() => {
        res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
    }, 30000);

    // 客户端断开连接
    req.on('close', () => {
        clearInterval(heartbeat);
        sseClients.delete(res);
        console.log(`[TaskManager] SSE client disconnected, total: ${sseClients.size}`);
    });
});

/**
 * 获取单个任务
 * GET /api/tasks/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const task = await BatchTask.findById(id);

        if (!task) {
            return res.status(404).json({ error: '任务不存在' });
        }

        // 权限校验
        if (!isAdmin(req) && task.creatorId && task.creatorId !== req.creatorId) {
            return res.status(403).json({ error: '无权查看此任务' });
        }

        res.json(task);
    } catch (error) {
        console.error('[TaskManager] Failed to get task:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * 暂停任务
 * POST /api/tasks/:id/pause
 */
router.post('/:id/pause', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const task = await BatchTask.findById(id);

        if (!task) {
            return res.status(404).json({ error: '任务不存在' });
        }

        // 权限校验
        if (!isAdmin(req) && task.creatorId && task.creatorId !== req.creatorId) {
            return res.status(403).json({ error: '无权操作此任务' });
        }

        if (task.status !== 'running') {
            return res.status(400).json({ error: `任务状态为 ${task.status}，无法暂停` });
        }

        // 更新状态
        task.status = 'paused';
        task.pausedAt = new Date();
        task.updatedAt = new Date();
        await task.save();

        // 通知执行器暂停
        const executor = BatchTaskExecutor.getInstance();
        executor.pauseTask(id);

        console.log(`[TaskManager] Task ${id} paused`);

        // 广播更新
        broadcastTaskUpdate(task);

        res.json({ success: true, task });
    } catch (error) {
        console.error('[TaskManager] Failed to pause task:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * 恢复任务
 * POST /api/tasks/:id/resume
 */
router.post('/:id/resume', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const task = await BatchTask.findById(id);

        if (!task) {
            return res.status(404).json({ error: '任务不存在' });
        }

        // 权限校验
        if (!isAdmin(req) && task.creatorId && task.creatorId !== req.creatorId) {
            return res.status(403).json({ error: '无权操作此任务' });
        }

        if (task.status !== 'paused') {
            return res.status(400).json({ error: `任务状态为 ${task.status}，无法恢复` });
        }

        // 更新状态
        task.status = 'running';
        task.pausedAt = undefined;
        task.updatedAt = new Date();
        await task.save();

        // 通知执行器恢复并继续处理
        const executor = BatchTaskExecutor.getInstance();
        executor.resumeTask(id);

        // 异步继续执行任务
        executor.processTask(id).catch(err => {
            console.error(`[TaskManager] Task ${id} failed after resume:`, err);
        });

        console.log(`[TaskManager] Task ${id} resumed`);

        // 广播更新
        broadcastTaskUpdate(task);

        res.json({ success: true, task });
    } catch (error) {
        console.error('[TaskManager] Failed to resume task:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * 停止任务
 * POST /api/tasks/:id/stop
 */
router.post('/:id/stop', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const task = await BatchTask.findById(id);

        if (!task) {
            return res.status(404).json({ error: '任务不存在' });
        }

        // 权限校验
        if (!isAdmin(req) && task.creatorId && task.creatorId !== req.creatorId) {
            return res.status(403).json({ error: '无权操作此任务' });
        }

        if (!['running', 'pending', 'paused'].includes(task.status)) {
            return res.status(400).json({ error: `任务状态为 ${task.status}，无法停止` });
        }

        // 更新状态
        task.status = 'stopped';
        task.completedAt = new Date();
        task.updatedAt = new Date();
        await task.save();

        console.log(`[TaskManager] Task ${id} stopped`);

        // 广播更新
        broadcastTaskUpdate(task);

        res.json({ success: true, task });
    } catch (error) {
        console.error('[TaskManager] Failed to stop task:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * 删除任务
 * DELETE /api/tasks/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const task = await BatchTask.findById(id);

        if (!task) {
            return res.status(404).json({ error: '任务不存在' });
        }

        // 权限校验
        if (!isAdmin(req) && task.creatorId && task.creatorId !== req.creatorId) {
            return res.status(403).json({ error: '无权操作此任务' });
        }

        // 只能删除已完成、失败或停止的任务
        if (['running', 'pending'].includes(task.status)) {
            return res.status(400).json({ error: '无法删除正在执行的任务，请先停止任务' });
        }

        const taskCreatorId = task.creatorId;
        await BatchTask.findByIdAndDelete(id);
        console.log(`[TaskManager] Task ${id} deleted`);

        // 广播删除
        broadcastTaskDeleted(id, taskCreatorId);

        res.json({ success: true });
    } catch (error) {
        console.error('[TaskManager] Failed to delete task:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;
