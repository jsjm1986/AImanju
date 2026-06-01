import { Router, Request, Response } from 'express';
import { episodeRepository } from '../repositories';

const router = Router();

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
    const episode = await episodeRepository.upsert(
      req.params.projectId,
      parseInt(req.params.episodeNumber),
      req.body
    );
    res.json({ success: true, data: episode });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 更新剧集
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const episode = await episodeRepository.update(req.params.id, req.body);
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
