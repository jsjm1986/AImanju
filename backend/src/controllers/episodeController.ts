import { Router, Request, Response } from 'express';
import { episodeRepository } from '../repositories';
import { Episode } from '../models/Episode';
import { protectProjectRouter, buildSafePatch } from '../middleware/projectAccess';

const router = Router();
protectProjectRouter(router, {
  params: { id: (id) => Episode.findById(id).select('projectId').exec() },
});

// 获取项目的所有剧集
router.get('/project/:projectId', async (req: Request, res: Response) => {
  try {
    const episodes = await episodeRepository.findByProject(req.params.projectId);
    res.json({ success: true, data: episodes });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 获取单个剧集
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const episode = await episodeRepository.findById(req.params.id);
    if (!episode) {
      return res.status(404).json({ success: false, error: '剧集不存在' });
    }
    res.json({ success: true, data: episode });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 按集数获取剧集
router.get('/project/:projectId/number/:episodeNumber', async (req: Request, res: Response) => {
  try {
    const episode = await episodeRepository.findByNumber(
      req.params.projectId,
      parseInt(req.params.episodeNumber)
    );
    if (!episode) {
      return res.status(404).json({ success: false, error: '剧集不存在' });
    }
    res.json({ success: true, data: episode });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 创建或更新剧集 (upsert)
router.put('/project/:projectId/number/:episodeNumber', async (req: Request, res: Response) => {
  try {
    // 路由身份为准：projectId/episodeNumber/_id 不得由 body 覆盖
    const patch = buildSafePatch(req.body, ['_id', 'projectId', 'episodeNumber']);
    if (!patch) return res.status(400).json({ success: false, error: '非法的更新载荷' });
    const episode = await episodeRepository.upsert(
      req.params.projectId,
      parseInt(req.params.episodeNumber),
      patch
    );
    res.json({ success: true, data: episode });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 更新剧集
router.put('/:id', async (req: Request, res: Response) => {
  try {
    // _id/projectId/episodeNumber 不可改写
    const patch = buildSafePatch(req.body, ['_id', 'projectId', 'episodeNumber']);
    if (!patch) return res.status(400).json({ success: false, error: '非法的更新载荷' });
    const episode = await episodeRepository.update(req.params.id, patch);
    if (!episode) {
      return res.status(404).json({ success: false, error: '剧集不存在' });
    }
    res.json({ success: true, data: episode });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 删除剧集
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await episodeRepository.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: '剧集不存在' });
    }
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
