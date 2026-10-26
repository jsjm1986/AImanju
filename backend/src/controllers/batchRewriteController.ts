/**
 * 批量改写控制器
 */

import { Request, Response, Router } from 'express';
import { BatchCoherentRewriteService } from '../services/rewrite/BatchCoherentRewriteService';
import { BatchRewriteHistory } from '../models/BatchRewriteHistory';
import { protectProjectRouter } from '../middleware/projectAccess';

const router = Router();
protectProjectRouter(router, {
  params: { id: (id) => BatchRewriteHistory.findById(id).select('projectId').exec() },
  references: { historyId: (id) => BatchRewriteHistory.findById(id).select('projectId').exec() },
});

/**
 * POST /batch-rewrite/plan
 * 生成改写计划 (SSE 流式)
 */
router.post('/plan', async (req: Request, res: Response) => {
  const { projectId, episodeRange, instruction } = req.body;

  if (!projectId || !episodeRange || !instruction) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const service = new BatchCoherentRewriteService(projectId);
    const plan = await service.generatePlanStream(
      { episodeRange, instruction },
      {
        onProgress: (stage, detail) => {
          res.write(`data: ${JSON.stringify({ type: 'progress', stage, detail })}\n\n`);
        },
        onChunk: (chunk) => {
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        },
        onComplete: (plan) => {
          res.write(`data: ${JSON.stringify({ type: 'complete', plan })}\n\n`);
        },
        onError: (error) => {
          res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        },
      }
    );
    
    res.write(`data: ${JSON.stringify({ type: 'done', plan })}\n\n`);
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: (error as Error).message })}\n\n`);
    res.end();
  }
});

/**
 * POST /batch-rewrite/execute
 * 执行批量改写 (SSE)
 */
router.post('/execute', async (req: Request, res: Response) => {
  const { projectId, plan } = req.body;

  if (!projectId || !plan) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // 发送初始准备阶段的进度
  res.write(`data: ${JSON.stringify({ type: 'preparing', message: '正在初始化改写服务...' })}\n\n`);

  try {
    const service = new BatchCoherentRewriteService(projectId);
    const result = await service.executeRewrite(plan, {
      onPreparing: (message) => {
        res.write(`data: ${JSON.stringify({ type: 'preparing', message })}\n\n`);
      },
      onEpisodeStart: (episodeNumber, total) => {
        res.write(`data: ${JSON.stringify({ type: 'episode_start', episodeNumber, total })}\n\n`);
      },
      onEpisodeChunk: (episodeNumber, chunk) => {
        res.write(`data: ${JSON.stringify({ type: 'episode_chunk', episodeNumber, chunk })}\n\n`);
      },
      onEpisodeComplete: (episodeResult) => {
        res.write(`data: ${JSON.stringify({ type: 'episode_complete', result: episodeResult })}\n\n`);
      },
      onEpisodeFailed: (episodeNumber, error) => {
        res.write(`data: ${JSON.stringify({ type: 'episode_failed', episodeNumber, error })}\n\n`);
      },
      onAllComplete: (batchResult) => {
        res.write(`data: ${JSON.stringify({ type: 'all_complete', result: batchResult })}\n\n`);
      },
      onError: (error) => {
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      },
    });

    res.write(`data: ${JSON.stringify({ type: 'done', result })}\n\n`);
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: (error as Error).message })}\n\n`);
    res.end();
  }
});

/**
 * POST /batch-rewrite/apply
 * 应用改写结果
 */
router.post('/apply', async (req: Request, res: Response) => {
  const { projectId, historyId, selectedEpisodes } = req.body;

  if (!projectId || !historyId) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  try {
    const service = new BatchCoherentRewriteService(projectId);
    const result = await service.applyResults(historyId, selectedEpisodes);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /batch-rewrite/rollback
 * 回滚批量改写
 */
router.post('/rollback', async (req: Request, res: Response) => {
  const { projectId, historyId } = req.body;

  if (!projectId || !historyId) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  try {
    const service = new BatchCoherentRewriteService(projectId);
    const result = await service.rollback(historyId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /batch-rewrite/history
 * 获取历史记录列表
 */
router.get('/history', async (req: Request, res: Response) => {
  const { projectId, startDate, endDate, episodeStart, episodeEnd } = req.query;

  if (!projectId) {
    return res.status(400).json({ error: '缺少projectId' });
  }

  try {
    const service = new BatchCoherentRewriteService(projectId as string);
    const history = await service.getHistory({
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      episodeStart: episodeStart ? parseInt(episodeStart as string) : undefined,
      episodeEnd: episodeEnd ? parseInt(episodeEnd as string) : undefined,
    });
    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /batch-rewrite/history/:id
 * 获取历史记录详情
 */
router.get('/history/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { projectId } = req.query;

  if (!projectId) {
    return res.status(400).json({ error: '缺少projectId' });
  }

  try {
    const service = new BatchCoherentRewriteService(projectId as string);
    const detail = await service.getHistoryDetail(id);
    if (!detail) {
      return res.status(404).json({ error: '历史记录不存在' });
    }
    res.json({ success: true, history: detail });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /batch-rewrite/history/:id
 * 删除历史记录
 */
router.delete('/history/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { projectId } = req.body;

  if (!projectId) {
    return res.status(400).json({ error: '缺少projectId' });
  }

  try {
    const service = new BatchCoherentRewriteService(projectId);
    const success = await service.deleteHistory(id);
    res.json({ success });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
