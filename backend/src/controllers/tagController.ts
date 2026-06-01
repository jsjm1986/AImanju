/**
 * 创作者标签控制器
 * 管理创作者自己的标签（与 Showcase 标签分离）
 */

import { Router, Request, Response } from 'express';
import { CreatorTag } from '../models/CreatorTag';
import { Project } from '../models/Project';
import { creatorAuth } from '../middleware/creatorMiddleware';
import mongoose from 'mongoose';

const router = Router();

// 所有路由都需要创作者认证
router.use(creatorAuth);

/**
 * GET /tags
 * 获取当前创作者的所有标签
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tags = await CreatorTag.find({ creatorId: req.creatorId })
      .sort({ sortOrder: 1, name: 1 })
      .lean();
    res.json({ tags });
  } catch (error) {
    console.error('[TagController] Error getting tags:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /tags/:id
 * 获取单个标签
 */
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const tag = await CreatorTag.findOne({ _id: id, creatorId: req.creatorId });
    if (!tag) {
      return res.status(404).json({ error: '标签不存在' });
    }
    res.json({ tag });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /tags
 * 创建标签
 */
router.post('/', async (req: Request, res: Response) => {
  const { name, color, sortOrder } = req.body;

  if (!name) {
    return res.status(400).json({ error: '缺少标签名称' });
  }

  try {
    // 检查同一创作者下是否已存在同名标签
    const existing = await CreatorTag.findOne({
      creatorId: req.creatorId,
      name
    });
    if (existing) {
      return res.status(400).json({ error: '标签名称已存在' });
    }

    const tag = await CreatorTag.create({
      name,
      color: color || '#6366f1',
      sortOrder: sortOrder || 0,
      creatorId: req.creatorId,
    });

    res.status(201).json({ tag });
  } catch (error) {
    console.error('[TagController] Error creating tag:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /tags/:id
 * 更新标签
 */
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, color, sortOrder } = req.body;

  try {
    // 查找属于当前创作者的标签
    const tag = await CreatorTag.findOne({ _id: id, creatorId: req.creatorId });
    if (!tag) {
      return res.status(404).json({ error: '标签不存在' });
    }

    // 如果更改名称，检查是否与其他标签冲突
    if (name && name !== tag.name) {
      const existing = await CreatorTag.findOne({
        creatorId: req.creatorId,
        name,
        _id: { $ne: id }
      });
      if (existing) {
        return res.status(400).json({ error: '标签名称已存在' });
      }
      tag.name = name;
    }

    if (color !== undefined) tag.color = color;
    if (sortOrder !== undefined) tag.sortOrder = sortOrder;

    await tag.save();
    res.json({ tag });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /tags/:id
 * 删除标签
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    // 检查标签是否被项目使用
    const usageCount = await Project.countDocuments({
      creatorId: req.creatorId,
      tags: id
    });
    if (usageCount > 0) {
      return res.status(400).json({
        error: `该标签被 ${usageCount} 个项目使用，无法删除`,
        usageCount,
      });
    }

    const result = await CreatorTag.findOneAndDelete({
      _id: id,
      creatorId: req.creatorId
    });
    if (!result) {
      return res.status(404).json({ error: '标签不存在' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /tags/sort
 * 批量更新排序
 */
router.put('/sort', async (req: Request, res: Response) => {
  const { orders } = req.body;

  if (!orders || !Array.isArray(orders)) {
    return res.status(400).json({ error: '缺少排序数据' });
  }

  try {
    const bulkOps = orders.map(({ id, sortOrder }) => ({
      updateOne: {
        filter: { _id: id, creatorId: req.creatorId },
        update: { $set: { sortOrder } },
      },
    }));
    await CreatorTag.bulkWrite(bulkOps);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /tags/project/:projectId
 * 获取项目的标签
 */
router.get('/project/:projectId', async (req: Request, res: Response) => {
  const { projectId } = req.params;

  try {
    const project = await Project.findOne({
      _id: projectId,
      creatorId: req.creatorId
    }).populate('tags').lean();

    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }

    res.json({ tags: project.tags || [] });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /tags/project/:projectId/:tagId
 * 为项目添加标签
 */
router.post('/project/:projectId/:tagId', async (req: Request, res: Response) => {
  const { projectId, tagId } = req.params;

  try {
    // 验证标签属于当前创作者
    const tag = await CreatorTag.findOne({ _id: tagId, creatorId: req.creatorId });
    if (!tag) {
      return res.status(404).json({ error: '标签不存在' });
    }

    const result = await Project.findOneAndUpdate(
      { _id: projectId, creatorId: req.creatorId },
      { $addToSet: { tags: tagId } },
      { new: true }
    );
    if (!result) {
      return res.status(404).json({ error: '项目不存在' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /tags/project/:projectId/:tagId
 * 从项目移除标签
 */
router.delete('/project/:projectId/:tagId', async (req: Request, res: Response) => {
  const { projectId, tagId } = req.params;

  try {
    const result = await Project.findOneAndUpdate(
      { _id: projectId, creatorId: req.creatorId },
      { $pull: { tags: tagId } },
      { new: true }
    );
    if (!result) {
      return res.status(404).json({ error: '项目不存在' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
