import { Router, Request, Response } from 'express';
import { characterRepository } from '../repositories';
import { Character } from '../models/Character';
import { protectProjectRouter, isAdminRequest, buildSafePatch } from '../middleware/projectAccess';

const router = Router();
protectProjectRouter(router, {
  params: { id: (id) => Character.findById(id).select('projectId').exec() },
});

// 获取所有角色（可选按项目筛选）
router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    // 无 projectId 的全局列表仅 admin；普通用户必须使用项目级端点
    if (!projectId && !isAdminRequest(req)) {
      return res.status(403).json({ error: '无权访问全局角色列表' });
    }
    if (projectId) {
      const characters = await characterRepository.findByProject(projectId as string);
      res.json({ success: true, data: characters });
    } else {
      // 返回所有角色
      const characters = await characterRepository.findAll();
      res.json({ success: true, data: characters });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 获取项目的所有角色
router.get('/project/:projectId', async (req: Request, res: Response) => {
  try {
    const characters = await characterRepository.findByProject(req.params.projectId);
    res.json({ success: true, data: characters });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 获取单个角色
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const character = await characterRepository.findById(req.params.id);
    if (!character) {
      return res.status(404).json({ success: false, error: '角色不存在' });
    }
    res.json({ success: true, data: character });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 创建角色
router.post('/', async (req: Request, res: Response) => {
  try {
    const { projectId, name, gender, age, identity, personality, background, abilities, appearance } = req.body;

    if (!projectId || !name || !identity || !personality || !background) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }

    const character = await characterRepository.create({
      projectId,
      name,
      gender: gender || 'unknown',
      age,
      identity,
      personality,
      background,
      abilities,
      appearance,
      relationships: [],
    });
    res.status(201).json({ success: true, data: character });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 更新角色
router.put('/:id', async (req: Request, res: Response) => {
  try {
    // 拒绝操作符/点键/原型键；_id/projectId 不得改写（路由资源为准）
    const patch = buildSafePatch(req.body, ['_id', 'projectId']);
    if (!patch) return res.status(400).json({ success: false, error: '非法的更新载荷' });
    const character = await characterRepository.update(req.params.id, patch);
    if (!character) {
      return res.status(404).json({ success: false, error: '角色不存在' });
    }
    res.json({ success: true, data: character });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 更新角色关系
router.put('/:id/relationships', async (req: Request, res: Response) => {
  try {
    const { relationships } = req.body;
    const character = await characterRepository.updateRelationships(req.params.id, relationships);
    if (!character) {
      return res.status(404).json({ success: false, error: '角色不存在' });
    }
    res.json({ success: true, data: character });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// 删除角色
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await characterRepository.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: '角色不存在' });
    }
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
