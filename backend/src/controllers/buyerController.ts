import { Router, Response } from 'express';
import { Project } from '../models/Project';
import { Episode } from '../models/Episode';
import { Character } from '../models/Character';
import { ProjectPublish } from '../models/ProjectPublish';
import { EpisodePurchase } from '../models/EpisodePurchase';
import { BuyerUser } from '../models/BuyerUser';
import { Tag } from '../models/Tag';
import { PointsTransaction } from '../models/PointsTransaction';
import { Favorite } from '../models/Favorite';
import { RewriteRequest } from '../models/RewriteRequest';
import { BuyerRequest, buyerAuth, optionalAuth } from '../middleware/buyerAuth';

const router = Router();

const FREE_LIMIT = 5;
const POINTS_LIMIT = 20;

// --- Shared helpers ---

function asyncHandler(
    fn: (req: BuyerRequest, res: Response) => Promise<any>,
    errorLabel: string,
    errorMessage: string,
) {
    return async (req: BuyerRequest, res: Response) => {
        try {
            await fn(req, res);
        } catch (error) {
            console.error(`[Buyer] ${errorLabel}:`, error);
            res.status(500).json({ error: errorMessage });
        }
    };
}

function extractSynopsis(project: any): string {
    if (project.outline && typeof project.outline === 'object' && project.outline.synopsis) {
        return project.outline.synopsis;
    }
    return '';
}

function truncate(text: string, maxLen: number): string {
    if (!text) return '';
    return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
}

async function buildProjectNameMap(projectIds: string[]): Promise<Map<string, string>> {
    const projects = await Project.find({ _id: { $in: projectIds } })
        .select('name')
        .lean();
    return new Map(projects.map(p => [p._id.toString(), p.name]));
}

function buildPagination(page: number, limit: number, total: number) {
    return { page, limit, total, pages: Math.ceil(total / limit) };
}

/**
 * 检查剧集访问权限并返回内容（三层规则）
 * 返回 true 表示已发送响应，调用方无需再处理
 */
async function handleEpisodeAccess(
    res: Response,
    episode: any,
    publishConfig: any,
    buyerId: string | undefined,
    extra: Record<string, any> = {},
): Promise<void> {
    const epNum = episode.episodeNumber;

    const contentPayload = {
        episodeNumber: episode.episodeNumber,
        content: episode.content,
        summary: episode.summary,
        wordCount: episode.wordCount,
        ...extra,
    };

    if (epNum <= FREE_LIMIT) {
        res.json({ ...contentPayload, accessType: 'free' });
        return;
    }

    if (!buyerId) {
        res.status(401).json({
            error: '请登录后查看',
            accessType: epNum <= POINTS_LIMIT ? 'points_required' : 'script_required',
        });
        return;
    }

    if (epNum <= POINTS_LIMIT) {
        const purchase = await EpisodePurchase.findOne({
            userId: buyerId,
            episodeId: episode._id,
        });

        if (!purchase) {
            res.status(403).json({
                error: '请先购买此剧集',
                accessType: 'points_required',
                price: publishConfig.pricePerEpisode,
            });
            return;
        }

        res.json({ ...contentPayload, accessType: 'points_purchased' });
        return;
    }

    // 21集+ 需整本购买
    res.status(403).json({
        error: '第21集及以后需购买完整剧本',
        accessType: 'script_required',
        fullScriptPrice: publishConfig.fullScriptPrice || 0,
        contactRequired: true,
        contactWechat: 'Tom_de',
    });
}

// --- Routes ---

/** GET /api/buyer/tags */
router.get('/tags', asyncHandler(async (req: BuyerRequest, res: Response) => {
    const { category } = req.query;
    const query: any = { isActive: true };

    if (category && ['male', 'female', 'common'].includes(category as string)) {
        query.$or = [{ category }, { category: 'common' }];
    }

    const tags = await Tag.find(query).sort({ sortOrder: 1 }).select('name category color').lean();
    res.json({ tags });
}, 'Get tags error', '获取标签失败'));

/** GET /api/buyer/projects */
router.get('/projects', optionalAuth, asyncHandler(async (req: BuyerRequest, res: Response) => {
    const { page = 1, limit = 20, tag } = req.query;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const query: any = { isPublished: true };
    if (tag) query.tags = tag;

    const publishConfigs = await ProjectPublish.find(query)
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();

    const projectIds = publishConfigs.map(p => p.projectId);
    const projects = await Project.find({ _id: { $in: projectIds } }).lean();

    const episodeCounts = await Episode.aggregate([
        { $match: { projectId: { $in: projectIds } } },
        { $group: { _id: '$projectId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(episodeCounts.map(e => [e._id.toString(), e.count]));

    const result = publishConfigs.map(config => {
        const project = projects.find(p => p._id.toString() === config.projectId.toString());
        if (!project) return null;

        return {
            _id: project._id,
            name: project.name,
            description: truncate(extractSynopsis(project), 80),
            genre: project.genre,
            coverImage: config.coverImage,
            targetAudience: config.targetAudience,
            tags: config.tags,
            pricePerEpisode: config.pricePerEpisode,
            freeEpisodeCount: config.freeEpisodeCount,
            supportsRewrite: config.supportsRewrite,
            rewritePrice: config.rewritePrice,
            episodeCount: countMap.get(project._id.toString()) || 0,
            publishedAt: config.publishedAt,
        };
    }).filter(Boolean);

    const total = await ProjectPublish.countDocuments(query);
    res.json({ projects: result, pagination: buildPagination(pageNum, limitNum, total) });
}, 'Get projects error', '获取项目列表失败'));

/** GET /api/buyer/projects/:id */
router.get('/projects/:id', optionalAuth, asyncHandler(async (req: BuyerRequest, res: Response) => {
    const projectId = req.params.id;

    const publishConfig = await ProjectPublish.findOne({ projectId, isPublished: true }).lean();
    if (!publishConfig) {
        return res.status(404).json({ error: '项目不存在或未上架' });
    }

    const project = await Project.findById(projectId).lean();
    if (!project) {
        return res.status(404).json({ error: '项目不存在' });
    }

    const characters = await Character.find({ projectId })
        .select('name role type gender age identity personality background abilities appearance hairStyle hairColor faceType bodyType clothing accessories initialEquipment initialAbilities relationships')
        .lean();

    const episodes = await Episode.find({ projectId })
        .select('_id episodeNumber summary wordCount createdAt')
        .sort({ episodeNumber: 1 })
        .lean();

    let purchasedEpisodeIds: string[] = [];
    if (req.buyerId) {
        const purchases = await EpisodePurchase.find({ userId: req.buyerId, projectId })
            .select('episodeId').lean();
        purchasedEpisodeIds = purchases.map(p => p.episodeId.toString());
    }

    res.json({
        project: {
            _id: project._id,
            name: project.name,
            description: extractSynopsis(project),
            genre: project.genre,
            outline: project.outline,
        },
        publishConfig: {
            pricePerEpisode: publishConfig.pricePerEpisode,
            freeEpisodeCount: publishConfig.freeEpisodeCount,
            coverImage: publishConfig.coverImage,
            tags: publishConfig.tags,
            supportsRewrite: publishConfig.supportsRewrite,
            rewritePrice: publishConfig.rewritePrice,
        },
        characters,
        episodes,
        purchasedEpisodeIds,
    });
}, 'Get project error', '获取项目详情失败'));

/**
 * GET /api/buyer/episodes/:id/content
 * 三层访问规则：1-5集免费 / 6-20集积分购买 / 21集+整本购买
 */
router.get('/episodes/:id/content', optionalAuth, asyncHandler(async (req: BuyerRequest, res: Response) => {
    const episode = await Episode.findById(req.params.id).lean();
    if (!episode) {
        return res.status(404).json({ error: '剧集不存在' });
    }

    const publishConfig = await ProjectPublish.findOne({
        projectId: episode.projectId,
        isPublished: true,
    }).lean();
    if (!publishConfig) {
        return res.status(404).json({ error: '项目未上架' });
    }

    await handleEpisodeAccess(res, episode, publishConfig, req.buyerId);
}, 'Get episode content error', '获取剧集内容失败'));

/**
 * GET /api/buyer/projects/:projectId/episodes/:episodeNumber/content
 * 三层访问规则：1-5集免费 / 6-20集积分购买 / 21集+整本购买
 */
router.get('/projects/:projectId/episodes/:episodeNumber/content', optionalAuth, asyncHandler(async (req: BuyerRequest, res: Response) => {
    const { projectId, episodeNumber } = req.params;
    const epNum = parseInt(episodeNumber, 10);

    const publishConfig = await ProjectPublish.findOne({ projectId, isPublished: true }).lean();
    if (!publishConfig) {
        return res.status(404).json({ error: '项目未上架' });
    }

    const episode = await Episode.findOne({ projectId, episodeNumber: epNum }).lean();
    if (!episode) {
        return res.status(404).json({ error: '剧集不存在' });
    }

    const totalEpisodes = await Episode.countDocuments({ projectId });
    await handleEpisodeAccess(res, episode, publishConfig, req.buyerId, { totalEpisodes });
}, 'Get episode by number error', '获取剧集内容失败'));

/**
 * POST /api/buyer/episodes/:id/purchase
 * 只允许购买6-20集（积分购买区间）
 */
router.post('/episodes/:id/purchase', buyerAuth, asyncHandler(async (req: BuyerRequest, res: Response) => {
    const episodeId = req.params.id;
    const userId = req.buyerId!;

    const episode = await Episode.findById(episodeId);
    if (!episode) {
        return res.status(404).json({ error: '剧集不存在' });
    }

    const publishConfig = await ProjectPublish.findOne({
        projectId: episode.projectId,
        isPublished: true,
    });
    if (!publishConfig) {
        return res.status(404).json({ error: '项目未上架' });
    }

    const epNum = episode.episodeNumber;
    if (epNum <= FREE_LIMIT) {
        return res.status(400).json({ error: '前5集免费，无需购买' });
    }
    if (epNum > POINTS_LIMIT) {
        return res.status(400).json({
            error: '第21集及以后需购买完整剧本，请联系客服',
            contactWechat: 'Tom_de',
        });
    }

    const existingPurchase = await EpisodePurchase.findOne({ userId, episodeId });
    if (existingPurchase) {
        return res.status(400).json({ error: '已购买过此剧集' });
    }

    const user = await BuyerUser.findById(userId);
    if (!user) {
        return res.status(404).json({ error: '用户不存在' });
    }

    const price = publishConfig.pricePerEpisode;
    if (user.points < price) {
        return res.status(400).json({ error: '积分不足' });
    }

    user.points -= price;
    await user.save();

    const purchase = await EpisodePurchase.create({
        userId,
        projectId: episode.projectId,
        episodeId,
        episodeNumber: episode.episodeNumber,
        pointsCost: price,
    });

    const project = await Project.findById(episode.projectId).select('name').lean();
    await PointsTransaction.create({
        userId,
        type: 'purchase',
        amount: -price,
        balance: user.points,
        description: `购买《${project?.name || '未知项目'}》第${episode.episodeNumber}集`,
        relatedId: purchase._id,
        relatedType: 'episode',
    });

    console.log(`[Buyer] User ${user.username} purchased episode ${episode.episodeNumber} for ${price} points`);
    res.json({ success: true, message: '购买成功', newBalance: user.points });
}, 'Purchase error', '购买失败'));

/** GET /api/buyer/purchases */
router.get('/purchases', buyerAuth, asyncHandler(async (req: BuyerRequest, res: Response) => {
    const userId = req.buyerId!;

    const purchases = await EpisodePurchase.find({ userId })
        .sort({ purchasedAt: -1 })
        .lean();

    const projectIds = [...new Set(purchases.map(p => p.projectId.toString()))];
    const projectMap = await buildProjectNameMap(projectIds);

    const result = purchases.map(p => ({
        _id: p._id,
        projectId: p.projectId,
        projectName: projectMap.get(p.projectId.toString()) || '未知项目',
        episodeNumber: p.episodeNumber,
        pointsCost: p.pointsCost,
        purchasedAt: p.purchasedAt,
    }));

    res.json({ purchases: result });
}, 'Get purchases error', '获取购买记录失败'));

// ============= 改写服务请求 =============

/** POST /api/buyer/projects/:projectId/rewrite-request */
router.post('/projects/:projectId/rewrite-request', buyerAuth, asyncHandler(async (req: BuyerRequest, res: Response) => {
    const { projectId } = req.params;
    const { requirements } = req.body;
    const buyerId = req.buyerId!;

    if (!requirements || requirements.trim().length < 10) {
        return res.status(400).json({ error: '请输入至少10个字符的改写需求描述' });
    }

    const publishConfig = await ProjectPublish.findOne({ projectId, isPublished: true });
    if (!publishConfig) {
        return res.status(404).json({ error: '项目未上架' });
    }
    if (!publishConfig.supportsRewrite) {
        return res.status(400).json({ error: '该项目不支持改写服务' });
    }

    const hasPurchased = await EpisodePurchase.exists({ userId: buyerId, projectId });
    if (!hasPurchased) {
        return res.status(400).json({ error: '您需要先购买该剧本的剧集才能申请改写服务' });
    }

    const price = publishConfig.rewritePrice || 0;

    const user = await BuyerUser.findById(buyerId);
    if (!user) {
        return res.status(404).json({ error: '用户不存在' });
    }
    if (user.points < price) {
        return res.status(400).json({ error: '积分不足', required: price, current: user.points });
    }

    user.points -= price;
    await user.save();

    const project = await Project.findById(projectId).select('name').lean();

    const rewriteRequest = await RewriteRequest.create({
        projectId,
        buyerId,
        status: 'paid',
        price,
        requirements: requirements.trim(),
        paidAt: new Date(),
    });

    await PointsTransaction.create({
        userId: buyerId,
        type: 'rewrite',
        amount: -price,
        balance: user.points,
        description: `申请《${project?.name || '未知项目'}》改写服务`,
        relatedId: rewriteRequest._id,
        relatedType: 'rewrite',
    });

    console.log(`[Buyer] Rewrite request created: ${rewriteRequest._id} for project ${projectId}`);

    res.json({
        success: true,
        message: '改写请求已提交',
        request: {
            _id: rewriteRequest._id,
            projectId,
            projectName: project?.name || '未知项目',
            status: rewriteRequest.status,
            price: rewriteRequest.price,
            requirements: rewriteRequest.requirements,
            paidAt: rewriteRequest.paidAt,
        },
        newBalance: user.points,
    });
}, 'Rewrite request error', '提交改写请求失败'));

/** GET /api/buyer/rewrite-requests */
router.get('/rewrite-requests', buyerAuth, asyncHandler(async (req: BuyerRequest, res: Response) => {
    const buyerId = req.buyerId!;

    const requests = await RewriteRequest.find({ buyerId })
        .sort({ createdAt: -1 })
        .lean();

    const projectIds = [...new Set(requests.map(r => r.projectId.toString()))];
    const projectMap = await buildProjectNameMap(projectIds);

    const result = requests.map(r => ({
        _id: r._id,
        projectId: r.projectId,
        projectName: projectMap.get(r.projectId.toString()) || '未知项目',
        status: r.status,
        price: r.price,
        requirements: r.requirements,
        result: r.result,
        paidAt: r.paidAt,
        completedAt: r.completedAt,
        createdAt: r.createdAt,
    }));

    res.json({ requests: result });
}, 'Get rewrite requests error', '获取改写请求失败'));

/** GET /api/buyer/rewrite-requests/:requestId */
router.get('/rewrite-requests/:requestId', buyerAuth, asyncHandler(async (req: BuyerRequest, res: Response) => {
    const { requestId } = req.params;
    const buyerId = req.buyerId!;

    const request = await RewriteRequest.findOne({ _id: requestId, buyerId }).lean();
    if (!request) {
        return res.status(404).json({ error: '改写请求不存在' });
    }

    const project = await Project.findById(request.projectId).select('name').lean();

    res.json({
        request: {
            ...request,
            projectName: project?.name || '未知项目',
        },
    });
}, 'Get rewrite request detail error', '获取改写请求详情失败'));

/** GET /api/buyer/transactions */
router.get('/transactions', buyerAuth, asyncHandler(async (req: BuyerRequest, res: Response) => {
    const userId = req.buyerId!;
    const { page = 1, limit = 20, type } = req.query;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const query: any = { userId };
    if (type && ['recharge', 'purchase', 'rewrite', 'refund', 'admin_adjust'].includes(type as string)) {
        query.type = type;
    }

    const total = await PointsTransaction.countDocuments(query);
    const transactions = await PointsTransaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();

    res.json({ transactions, pagination: buildPagination(pageNum, limitNum, total) });
}, 'Get transactions error', '获取积分流水失败'));

/** POST /api/buyer/favorites/:projectId */
router.post('/favorites/:projectId', buyerAuth, asyncHandler(async (req: BuyerRequest, res: Response) => {
    const { projectId } = req.params;
    const userId = req.buyerId!;

    const publishConfig = await ProjectPublish.findOne({ projectId, isPublished: true });
    if (!publishConfig) {
        return res.status(404).json({ error: '项目不存在或未上架' });
    }

    const existing = await Favorite.findOne({ userId, projectId });
    if (existing) {
        return res.status(400).json({ error: '已收藏该项目' });
    }

    await Favorite.create({ userId, projectId });
    res.json({ success: true, message: '收藏成功' });
}, 'Add favorite error', '收藏失败'));

/** DELETE /api/buyer/favorites/:projectId */
router.delete('/favorites/:projectId', buyerAuth, asyncHandler(async (req: BuyerRequest, res: Response) => {
    const { projectId } = req.params;
    const userId = req.buyerId!;

    const result = await Favorite.deleteOne({ userId, projectId });
    if (result.deletedCount === 0) {
        return res.status(404).json({ error: '未收藏该项目' });
    }

    res.json({ success: true, message: '已取消收藏' });
}, 'Remove favorite error', '取消收藏失败'));

/** GET /api/buyer/favorites */
router.get('/favorites', buyerAuth, asyncHandler(async (req: BuyerRequest, res: Response) => {
    const userId = req.buyerId!;

    const favorites = await Favorite.find({ userId })
        .sort({ createdAt: -1 })
        .lean();

    const projectIds = favorites.map(f => f.projectId);
    const projects = await Project.find({ _id: { $in: projectIds } })
        .select('name concept')
        .lean();
    const projectMap = new Map(projects.map(p => [p._id.toString(), p]));

    const result = favorites.map(f => {
        const project = projectMap.get(f.projectId.toString());
        return {
            _id: f._id,
            projectId: f.projectId,
            projectName: project?.name || '未知项目',
            projectDescription: project?.concept || '',
            createdAt: f.createdAt,
        };
    });

    res.json({ favorites: result });
}, 'Get favorites error', '获取收藏列表失败'));

export default router;
