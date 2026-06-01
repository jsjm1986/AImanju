import { Router, Request, Response } from 'express';
import { ProjectPublish } from '../models/ProjectPublish';
import { Project } from '../models/Project';

const router = Router();

/**
 * 获取项目发布配置
 * GET /api/publish/:projectId
 */
router.get('/:projectId', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;

        // 验证项目存在
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ error: '项目不存在' });
        }

        // 获取或创建配置
        let config = await ProjectPublish.findOne({ projectId });
        if (!config) {
            config = await ProjectPublish.create({
                projectId,
                isPublished: false,
                pricePerEpisode: 10,
                freeEpisodeCount: 5,
                tags: [],
            });
        }

        res.json({
            projectId,
            projectName: project.name,
            isPublished: config.isPublished,
            pricePerEpisode: config.pricePerEpisode,
            freeEpisodeCount: config.freeEpisodeCount,
            maxPointsEpisode: (config as any).maxPointsEpisode || 20,  // 固定20
            fullScriptPrice: (config as any).fullScriptPrice || 0,
            coverImage: config.coverImage,
            targetAudience: config.targetAudience,
            tags: config.tags,
            supportsRewrite: config.supportsRewrite,
            rewritePrice: config.rewritePrice,
            publishedAt: config.publishedAt,
        });
    } catch (error) {
        console.error('[Publish] Get config error:', error);
        res.status(500).json({ error: '获取发布配置失败' });
    }
});

/**
 * 更新项目发布配置
 * PUT /api/publish/:projectId
 */
router.put('/:projectId', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { pricePerEpisode, freeEpisodeCount, fullScriptPrice, coverImage, targetAudience, tags, supportsRewrite, rewritePrice } = req.body;

        // 验证项目存在
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ error: '项目不存在' });
        }

        // 更新或创建配置
        const config = await ProjectPublish.findOneAndUpdate(
            { projectId },
            {
                $set: {
                    ...(pricePerEpisode !== undefined && { pricePerEpisode }),
                    ...(freeEpisodeCount !== undefined && { freeEpisodeCount }),
                    ...(fullScriptPrice !== undefined && { fullScriptPrice }),
                    ...(coverImage !== undefined && { coverImage }),
                    ...(targetAudience !== undefined && { targetAudience }),
                    ...(tags !== undefined && { tags }),
                    ...(supportsRewrite !== undefined && { supportsRewrite }),
                    ...(rewritePrice !== undefined && { rewritePrice }),
                },
            },
            { upsert: true, new: true }
        );

        console.log(`[Publish] Updated config for project ${project.name}`);

        res.json({
            success: true,
            config: {
                projectId,
                isPublished: config.isPublished,
                pricePerEpisode: config.pricePerEpisode,
                freeEpisodeCount: config.freeEpisodeCount,
                fullScriptPrice: (config as any).fullScriptPrice || 0,
                coverImage: config.coverImage,
                targetAudience: config.targetAudience,
                tags: config.tags,
                supportsRewrite: config.supportsRewrite,
                rewritePrice: config.rewritePrice,
            },
        });
    } catch (error) {
        console.error('[Publish] Update config error:', error);
        res.status(500).json({ error: '更新发布配置失败' });
    }
});

/**
 * 上架项目
 * POST /api/publish/:projectId/publish
 */
router.post('/:projectId/publish', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;

        // 验证项目存在
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ error: '项目不存在' });
        }

        const config = await ProjectPublish.findOneAndUpdate(
            { projectId },
            {
                $set: {
                    isPublished: true,
                    publishedAt: new Date(),
                },
            },
            { upsert: true, new: true }
        );

        console.log(`[Publish] Project ${project.name} published`);

        res.json({
            success: true,
            message: '项目已上架',
            publishedAt: config.publishedAt,
        });
    } catch (error) {
        console.error('[Publish] Publish error:', error);
        res.status(500).json({ error: '上架失败' });
    }
});

/**
 * 下架项目
 * POST /api/publish/:projectId/unpublish
 */
router.post('/:projectId/unpublish', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;

        await ProjectPublish.findOneAndUpdate(
            { projectId },
            { $set: { isPublished: false } }
        );

        console.log(`[Publish] Project ${projectId} unpublished`);

        res.json({
            success: true,
            message: '项目已下架',
        });
    } catch (error) {
        console.error('[Publish] Unpublish error:', error);
        res.status(500).json({ error: '下架失败' });
    }
});

export default router;
