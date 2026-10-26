/**
 * 伏笔控制器 - 伏笔管理 API
 * 核心：纯 AI 驱动的智能决策
 */

import { Router, Request, Response } from 'express';
import { foreshadowingRepository } from '../repositories/ForeshadowingRepository';
import { PlotThreadValidator } from '../services/foreshadowing/PlotThreadValidator';
import { ForeshadowingManager, ForeshadowingContext } from '../services/foreshadowing/ForeshadowingManager';
import { Foreshadowing } from '../models/Foreshadowing';
import { protectProjectRouter } from '../middleware/projectAccess';

const router = Router();
protectProjectRouter(router, {
  params: { id: (id) => Foreshadowing.findById(id).select('projectId').exec() },
});

// ==================== 基础 CRUD ====================

/**
 * GET /foreshadowing/:projectId
 * 获取项目所有伏笔
 */
router.get('/:projectId', async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { status } = req.query;

  try {
    let foreshadowings;
    if (status === 'unresolved') {
      foreshadowings = await foreshadowingRepository.getUnresolved(projectId);
    } else if (status === 'resolved') {
      foreshadowings = await foreshadowingRepository.getResolved(projectId);
    } else if (status === 'dormant') {
      foreshadowings = await foreshadowingRepository.getDormant(projectId);
    } else {
      foreshadowings = await foreshadowingRepository.findByProject(projectId);
    }

    res.json({ foreshadowings });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /foreshadowing/:projectId/stats
 * 获取伏笔统计
 */
router.get('/:projectId/stats', async (req: Request, res: Response) => {
  const { projectId } = req.params;

  try {
    const manager = new ForeshadowingManager(projectId);
    const stats = await manager.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /foreshadowing
 * 创建伏笔
 */
router.post('/', async (req: Request, res: Response) => {
  const { projectId, episodePlanted, content, type, importance } = req.body;

  if (!projectId || !episodePlanted || !content) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  try {
    const foreshadowing = await foreshadowingRepository.create(projectId, episodePlanted, {
      content,
      type: type || 'suspense',
      importance: importance || 'normal',
    });

    res.json({ foreshadowing });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /foreshadowing/:id
 * 更新伏笔
 */
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { content, type, importance } = req.body;

  try {
    const foreshadowing = await foreshadowingRepository.update(id, {
      content,
      type,
      importance,
    });

    if (!foreshadowing) {
      return res.status(404).json({ error: '伏笔不存在' });
    }

    res.json({ foreshadowing });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /foreshadowing/:id/resolve
 * 标记伏笔已回收
 */
router.post('/:id/resolve', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { episodeResolved, resolutionNote } = req.body;

  if (!episodeResolved) {
    return res.status(400).json({ error: '缺少episodeResolved参数' });
  }

  try {
    const foreshadowing = await foreshadowingRepository.resolve(
      id,
      episodeResolved,
      resolutionNote || ''
    );

    if (!foreshadowing) {
      return res.status(404).json({ error: '伏笔不存在' });
    }

    res.json({ foreshadowing });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /foreshadowing/:id
 * 删除伏笔
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const success = await foreshadowingRepository.delete(id);

    if (!success) {
      return res.status(404).json({ error: '伏笔不存在' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ==================== AI 智能决策（核心） ====================

/**
 * POST /foreshadowing/:projectId/ai-decide
 * AI 一次性分析并决策（核心接口）
 *
 * 输入完整上下文，AI 输出：
 * - 哪些伏笔作为约束
 * - 哪些伏笔需要合并/放弃/休眠/唤醒
 * - 每个伏笔的有效性判断
 */
router.post('/:projectId/ai-decide', async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const {
    projectName,
    projectType,
    currentEpisode,
    episodePlan,
    recentEvents,
    characterStates,
    previousCliffhanger,
  } = req.body;

  // 验证必要参数
  if (!projectName || !currentEpisode || !episodePlan) {
    return res.status(400).json({
      error: '缺少必要参数',
      required: ['projectName', 'currentEpisode', 'episodePlan'],
    });
  }

  try {
    const context: ForeshadowingContext = {
      projectId,
      projectName,
      projectType: projectType || '未知',
      currentEpisode,
      episodePlan,
      recentEvents,
      characterStates,
      previousCliffhanger,
    };

    const manager = new ForeshadowingManager(projectId);
    const result = await manager.analyzeAndDecide(context);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /foreshadowing/:projectId/get-constraints
 * 获取优化后的伏笔约束（简化版，供剧本生成使用）
 */
router.post('/:projectId/get-constraints', async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const {
    projectName,
    projectType,
    currentEpisode,
    episodePlan,
    recentEvents,
    characterStates,
    previousCliffhanger,
  } = req.body;

  if (!projectName || !currentEpisode || !episodePlan) {
    return res.status(400).json({
      error: '缺少必要参数',
      required: ['projectName', 'currentEpisode', 'episodePlan'],
    });
  }

  try {
    const context: ForeshadowingContext = {
      projectId,
      projectName,
      projectType: projectType || '未知',
      currentEpisode,
      episodePlan,
      recentEvents,
      characterStates,
      previousCliffhanger,
    };

    const manager = new ForeshadowingManager(projectId);
    const constraints = await manager.getConstraints(context);

    res.json(constraints);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ==================== 辅助接口 ====================

/**
 * GET /foreshadowing/:projectId/urgent
 * 获取紧急需要回收的伏笔
 */
router.get('/:projectId/urgent', async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { threshold } = req.query;

  try {
    const urgent = await foreshadowingRepository.getUrgent(
      projectId,
      threshold ? parseInt(threshold as string) : 80
    );

    res.json({ urgent, count: urgent.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /foreshadowing/:projectId/clusters
 * 获取伏笔聚类组
 */
router.get('/:projectId/clusters', async (req: Request, res: Response) => {
  const { projectId } = req.params;

  try {
    const clusters = await foreshadowingRepository.getClusterLabels(projectId);
    res.json({ clusters });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /foreshadowing/:projectId/analyze
 * AI 分析剧本中的伏笔（用于剧本生成后提取伏笔）
 */
router.post('/:projectId/analyze', async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { episodeNumber, scriptContent } = req.body;

  if (!episodeNumber || !scriptContent) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  try {
    const validator = new PlotThreadValidator(projectId);
    const analysis = await validator.analyzeScript(episodeNumber, scriptContent);

    res.json({ foreshadowings: analysis });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
