import { Router, Request, Response } from 'express';
import { BatchTask } from '../models/BatchTask';
import { BatchTaskExecutor } from '../services/batch/BatchTaskExecutor';
import { Project } from '../models/Project';
import { broadcastTaskUpdate } from './taskManagerController';
import { aiClient } from '../services/ai/AIClient';
import { creatorAuth } from '../middleware/creatorMiddleware';
import { protectProjectRouter } from '../middleware/projectAccess';

const router = Router();
protectProjectRouter(router, {
  params: { id: (id) => BatchTask.findById(id).select('projectId').exec() },
});

/**
 * 创建批量任务
 * POST /api/world-state/:projectId/batch-tasks
 */
router.post('/:projectId/batch-tasks', creatorAuth, async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { episodes } = req.body;

        // 验证参数
        if (!episodes || !Array.isArray(episodes) || episodes.length === 0) {
            return res.status(400).json({ error: '请提供要生成的集数列表' });
        }

        // 检查是否已有活跃任务
        const existingTask = await BatchTask.findOne({
            projectId,
            status: { $in: ['pending', 'running'] }
        });

        if (existingTask) {
            return res.status(409).json({
                error: '该项目已有正在进行的批量任务',
                taskId: existingTask._id,
                task: existingTask
            });
        }

        // 获取项目名称
        const project = await Project.findById(projectId);
        const projectName = project?.name || `项目 ${projectId.slice(-6)}`;

        // 获取当前使用的模型名称（从 AI 客户端获取用户选择的模型）
        const modelName = aiClient.getCurrentModelName() || 'default';

        // 创建新任务
        const task = await BatchTask.create({
            projectId,
            projectName,
            modelName,
            episodes,
            status: 'pending',
            creatorId: req.creatorId
        });

        console.log(`[BatchTaskController] Created task ${task._id} for project ${projectId}, episodes: ${episodes.join(', ')}`);

        // 广播新任务创建
        broadcastTaskUpdate(task);

        // 异步启动任务（不阻塞响应）
        const executor = BatchTaskExecutor.getInstance();
        executor.processTask(task._id.toString()).catch(err => {
            console.error(`[BatchTaskController] Task ${task._id} failed:`, err);
        });

        res.json(task);
    } catch (error) {
        console.error('[BatchTaskController] Failed to create task:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * 获取活跃任务（必须放在 /:id 之前，否则会被匹配为 id='active'）
 * GET /api/world-state/:projectId/batch-tasks/active
 */
router.get('/:projectId/batch-tasks/active', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;

        const task = await BatchTask.findOne({
            projectId,
            status: { $in: ['pending', 'running', 'paused'] }
        }).sort({ createdAt: -1 });

        res.json(task);
    } catch (error) {
        console.error('[BatchTaskController] Failed to get active task:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * 获取任务状态
 * GET /api/world-state/:projectId/batch-tasks/:id
 */
router.get('/:projectId/batch-tasks/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const task = await BatchTask.findById(id);
        if (!task) {
            return res.status(404).json({ error: '任务不存在' });
        }

        res.json(task);
    } catch (error) {
        console.error('[BatchTaskController] Failed to get task:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * 停止任务
 * POST /api/world-state/:projectId/batch-tasks/:id/stop
 */
router.post('/:projectId/batch-tasks/:id/stop', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const task = await BatchTask.findById(id);
        if (!task) {
            return res.status(404).json({ error: '任务不存在' });
        }

        // 只有运行中或等待中的任务可以停止
        if (task.status !== 'running' && task.status !== 'pending') {
            return res.status(400).json({
                error: `任务状态为 ${task.status}，无法停止`,
                task
            });
        }

        task.status = 'stopped';
        task.completedAt = new Date();
        task.updatedAt = new Date();
        await task.save();

        console.log(`[BatchTaskController] Stopped task ${id}`);
        broadcastTaskUpdate(task);

        res.json({ success: true, task });
    } catch (error) {
        console.error('[BatchTaskController] Failed to stop task:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * 删除已完成的任务（可选，用于清理）
 * DELETE /api/world-state/:projectId/batch-tasks/:id
 */
router.delete('/:projectId/batch-tasks/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const task = await BatchTask.findById(id);
        if (!task) {
            return res.status(404).json({ error: '任务不存在' });
        }

        // 只能删除已完成、失败或已停止的任务
        if (task.status === 'running' || task.status === 'pending') {
            return res.status(400).json({ error: '无法删除正在执行的任务，请先停止任务' });
        }

        await BatchTask.findByIdAndDelete(id);
        console.log(`[BatchTaskController] Deleted task ${id}`);

        res.json({ success: true });
    } catch (error) {
        console.error('[BatchTaskController] Failed to delete task:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;
