/**
 * 改写控制器 - 剧本改写API
 */

import { Request, Response, Router } from 'express';
import { RewriteService, RewriteType } from '../services/rewrite/RewriteService';

const router = Router();

/**
 * POST /rewrite
 * 改写剧本（支持SSE流式输出）
 */
router.post('/', async (req: Request, res: Response) => {
  const { projectId, episodeId, episodeNumber, type, instruction, selection, stream } = req.body;

  if (!projectId || !episodeId || !instruction) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  const rewriteService = new RewriteService(projectId);

  // 流式输出
  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const result = await rewriteService.rewriteStream(
        {
          projectId,
          episodeId,
          episodeNumber: episodeNumber || 0,
          type: (type as RewriteType) || 'full',
          instruction,
          selection,
        },
        {
          onChunk: (text) => {
            res.write(`data: ${JSON.stringify({ type: 'chunk', text })}\n\n`);
          },
          onComplete: (fullText) => {
            res.write(`data: ${JSON.stringify({ type: 'complete', text: fullText })}\n\n`);
          },
          onError: (error) => {
            res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
          },
        }
      );

      res.write(`data: ${JSON.stringify({ type: 'result', ...result })}\n\n`);
      res.end();
    } catch (error) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: (error as Error).message })}\n\n`);
      res.end();
    }
  } else {
    // 非流式输出
    try {
      const result = await rewriteService.rewrite({
        projectId,
        episodeId,
        episodeNumber: episodeNumber || 0,
        type: (type as RewriteType) || 'full',
        instruction,
        selection,
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
});

/**
 * POST /rewrite/apply/:historyId
 * 应用改写
 */
router.post('/apply/:historyId', async (req: Request, res: Response) => {
  const { historyId } = req.params;
  const { projectId } = req.body;

  if (!projectId) {
    return res.status(400).json({ error: '缺少projectId' });
  }

  try {
    const rewriteService = new RewriteService(projectId);
    await rewriteService.applyRewrite(historyId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /rewrite/revert/:historyId
 * 回滚改写（增强版，支持级联状态更新）
 */
router.post('/revert/:historyId', async (req: Request, res: Response) => {
  const { historyId } = req.params;
  const { projectId } = req.body;

  if (!projectId) {
    return res.status(400).json({ error: '缺少projectId' });
  }

  try {
    const rewriteService = new RewriteService(projectId);
    const result = await rewriteService.revertRewriteEnhanced(historyId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /rewrite/history/project/:projectId
 * 获取项目所有改写历史（跨集）
 * 注意：此路由必须在 /history/:episodeId 之前定义
 */
router.get('/history/project/:projectId', async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { type, search } = req.query;

  try {
    const rewriteService = new RewriteService(projectId);
    const result = await rewriteService.getProjectHistory({
      type: type as RewriteType | undefined,
      search: search as string | undefined,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /rewrite/history/detail/:historyId
 * 获取单条历史详情
 * 注意：此路由必须在 /history/:episodeId 之前定义
 */
router.get('/history/detail/:historyId', async (req: Request, res: Response) => {
  const { historyId } = req.params;
  const { projectId } = req.query;

  if (!projectId) {
    return res.status(400).json({ error: '缺少projectId' });
  }

  try {
    const rewriteService = new RewriteService(projectId as string);
    const result = await rewriteService.getHistoryDetail(historyId);
    
    if (!result) {
      return res.status(404).json({ error: '改写历史不存在' });
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /rewrite/history/:episodeId
 * 获取改写历史（增强版，支持筛选和搜索）
 */
router.get('/history/:episodeId', async (req: Request, res: Response) => {
  const { episodeId } = req.params;
  const { projectId, type, search } = req.query;

  if (!projectId) {
    return res.status(400).json({ error: '缺少projectId' });
  }

  try {
    const rewriteService = new RewriteService(projectId as string);
    const result = await rewriteService.getHistoryWithStats(episodeId, {
      type: type as RewriteType | undefined,
      search: search as string | undefined,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /rewrite/history/:historyId
 * 删除历史记录
 */
router.delete('/history/:historyId', async (req: Request, res: Response) => {
  const { historyId } = req.params;
  const { projectId } = req.body;

  if (!projectId) {
    return res.status(400).json({ error: '缺少projectId' });
  }

  try {
    const rewriteService = new RewriteService(projectId);
    await rewriteService.deleteHistory(historyId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /rewrite/manual-edit
 * 保存手动编辑历史
 */
router.post('/manual-edit', async (req: Request, res: Response) => {
  const { projectId, episodeId, episodeNumber, originalContent, modifiedContent, description } = req.body;

  if (!projectId || !episodeId || !originalContent || !modifiedContent) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  // 如果内容没有变化，不保存历史
  if (originalContent === modifiedContent) {
    return res.json({ success: true, message: '内容无变化，无需保存历史' });
  }

  try {
    const rewriteService = new RewriteService(projectId);
    const result = await rewriteService.saveManualEditHistory({
      episodeId,
      episodeNumber: episodeNumber || 0,
      originalContent,
      modifiedContent,
      description,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /rewrite/batch
 * 批量改写
 */
router.post('/batch', async (req: Request, res: Response) => {
  const { projectId, episodeIds, instruction } = req.body;

  if (!projectId || !episodeIds || !instruction) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  // 设置SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const rewriteService = new RewriteService(projectId);
    const results = await rewriteService.batchRewrite(
      episodeIds,
      instruction,
      (current, total, episodeNumber) => {
        res.write(`data: ${JSON.stringify({ type: 'progress', current, total, episodeNumber })}\n\n`);
      }
    );

    res.write(`data: ${JSON.stringify({ type: 'complete', results })}\n\n`);
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: (error as Error).message })}\n\n`);
    res.end();
  }
});

export default router;
