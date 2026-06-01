/**
 * 角色状态控制器 - 角色状态追踪API
 */

import { Router, Request, Response } from 'express';
import { characterStateRepository } from '../repositories/CharacterStateRepository';
import { StateAnalyzer } from '../services/state/StateAnalyzer';

const router = Router();

/**
 * GET /state/character/:characterId
 * 获取角色状态历史
 */
router.get('/character/:characterId', async (req: Request, res: Response) => {
  const { characterId } = req.params;
  const { projectId } = req.query;

  if (!projectId) {
    return res.status(400).json({ error: '缺少projectId参数' });
  }

  try {
    const history = await characterStateRepository.getStateHistory(
      projectId as string,
      characterId
    );

    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /state/character/:characterId/latest
 * 获取角色最新状态
 */
router.get('/character/:characterId/latest', async (req: Request, res: Response) => {
  const { characterId } = req.params;
  const { projectId } = req.query;

  if (!projectId) {
    return res.status(400).json({ error: '缺少projectId参数' });
  }

  try {
    const state = await characterStateRepository.getLatestState(
      projectId as string,
      characterId
    );

    res.json({ state });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /state/character/:characterId/appearances
 * 获取角色出场统计
 */
router.get('/character/:characterId/appearances', async (req: Request, res: Response) => {
  const { characterId } = req.params;
  const { projectId } = req.query;

  if (!projectId) {
    return res.status(400).json({ error: '缺少projectId参数' });
  }

  try {
    const stats = await characterStateRepository.getAppearanceStats(
      projectId as string,
      characterId
    );

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /state/episode/:episodeNumber
 * 获取某集所有角色状态
 */
router.get('/episode/:episodeNumber', async (req: Request, res: Response) => {
  const { episodeNumber } = req.params;
  const { projectId } = req.query;

  if (!projectId) {
    return res.status(400).json({ error: '缺少projectId参数' });
  }

  try {
    const states = await characterStateRepository.getEpisodeStates(
      projectId as string,
      parseInt(episodeNumber)
    );

    res.json({ states });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /state/permanent-marks/:projectId
 * 获取有永久性标记的角色
 */
router.get('/permanent-marks/:projectId', async (req: Request, res: Response) => {
  const { projectId } = req.params;

  try {
    const states = await characterStateRepository.getCharactersWithPermanentMarks(projectId);

    res.json({ states });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /state/analyze
 * 分析剧本并提取角色状态（支持SSE）
 */
router.post('/analyze', async (req: Request, res: Response) => {
  const { projectId, episodeNumber, scriptContent, autoUpdate } = req.body;

  if (!projectId || !episodeNumber || !scriptContent) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  try {
    const analyzer = new StateAnalyzer(projectId);
    const result = await analyzer.analyzeEpisode(
      episodeNumber,
      scriptContent,
      autoUpdate !== false
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /state/analyze-batch
 * 批量分析多集剧本
 */
router.post('/analyze-batch', async (req: Request, res: Response) => {
  const { projectId, episodes } = req.body;

  if (!projectId || !episodes || !Array.isArray(episodes)) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  // 设置SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const analyzer = new StateAnalyzer(projectId);
    const results = [];

    for (let i = 0; i < episodes.length; i++) {
      const ep = episodes[i];
      res.write(`data: ${JSON.stringify({
        type: 'progress',
        current: i + 1,
        total: episodes.length,
        episode: ep.episode
      })}\n\n`);

      const result = await analyzer.analyzeEpisode(ep.episode, ep.content, true);
      results.push(result);

      // 避免API限流
      if (i < episodes.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'complete', results })}\n\n`);
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: (error as Error).message })}\n\n`);
    res.end();
  }
});

/**
 * DELETE /state/after/:episodeNumber
 * 删除某集之后的所有状态（用于回滚）
 */
router.delete('/after/:episodeNumber', async (req: Request, res: Response) => {
  const { episodeNumber } = req.params;
  const { projectId } = req.body;

  if (!projectId) {
    return res.status(400).json({ error: '缺少projectId参数' });
  }

  try {
    const deletedCount = await characterStateRepository.deleteStatesAfterEpisode(
      projectId,
      parseInt(episodeNumber)
    );

    res.json({ success: true, deletedCount });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
