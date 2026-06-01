import { Router, Response } from 'express';
import { BuyerUser } from '../models/BuyerUser';
import { Creator } from '../models/Creator';
import { Episode } from '../models/Episode';
import { Project } from '../models/Project';
import { ProjectPublish } from '../models/ProjectPublish';
import { PublishRequest } from '../models/PublishRequest';
import { RewriteRequest } from '../models/RewriteRequest';
import { Tag } from '../models/Tag';
import { BuyerRequest, adminAuth } from '../middleware/buyerAuth';

const router = Router();

async function findPendingPublishRequest(id: string, res: Response) {
    const request = await PublishRequest.findById(id);
    if (!request) {
        res.status(404).json({ error: '申请不存在' });
        return null;
    }
    if (request.status !== 'pending') {
        res.status(400).json({ error: '只能审核待处理的申请' });
        return null;
    }
    return request;
}

router.get('/projects', adminAuth, async (req: BuyerRequest, res: Response) => {
    try {
        const projects = await Project.find()
            .select('name genre totalEpisodes status createdAt')
            .sort({ createdAt: -1 })
            .lean();

        const episodeCounts = await Episode.aggregate([
            { $group: { _id: '$projectId', actualEpisodeCount: { $sum: 1 } } }
        ]);
        const countMap = new Map(episodeCounts.map(e => [e._id.toString(), e.actualEpisodeCount]));

        const publishConfigs = await ProjectPublish.find().lean();
        const configMap = new Map(publishConfigs.map(c => [c.projectId.toString(), c]));

        const result = projects.map(p => {
            const config = configMap.get(p._id.toString());
            return {
                _id: p._id,
                name: p.name,
                genre: p.genre,
                totalEpisodes: p.totalEpisodes,
                actualEpisodeCount: countMap.get(p._id.toString()) || 0,
                status: p.status,
                pricePerEpisode: config?.pricePerEpisode || 10,
                freeEpisodeCount: config?.freeEpisodeCount || 5,
                isPublished: config?.isPublished || false,
                publishedAt: config?.publishedAt,
            };
        });

        res.json({ projects: result });
    } catch (error) {
        console.error('[Admin] Get projects error:', error);
        res.status(500).json({ error: '获取项目列表失败' });
    }
});

router.get('/users', adminAuth, async (req: BuyerRequest, res: Response) => {
    try {
        const { page = 1, limit = 20, search } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const query: any = {};
        if (search) {
            query.$or = [
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { nickname: { $regex: search, $options: 'i' } },
            ];
        }

        const [users, total] = await Promise.all([
            BuyerUser.find(query)
                .select('-passwordHash')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            BuyerUser.countDocuments(query),
        ]);

        res.json({
            users,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (error) {
        console.error('[Admin] Get users error:', error);
        res.status(500).json({ error: '获取用户列表失败' });
    }
});

router.get('/users/:id', adminAuth, async (req: BuyerRequest, res: Response) => {
    try {
        const user = await BuyerUser.findById(req.params.id).select('-passwordHash').lean();
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        res.json(user);
    } catch (error) {
        console.error('[Admin] Get user error:', error);
        res.status(500).json({ error: '获取用户信息失败' });
    }
});

router.post('/users/:id/recharge', adminAuth, async (req: BuyerRequest, res: Response) => {
    try {
        const { amount, reason } = req.body;
        const userId = req.params.id;

        if (!amount || typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ error: '请输入有效的充值金额' });
        }

        const user = await BuyerUser.findById(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        const oldPoints = user.points;
        user.points += amount;
        await user.save();

        console.log(`[Admin] Recharged ${amount} points to user ${user.username}. Balance: ${oldPoints} -> ${user.points}. Reason: ${reason || 'N/A'}`);

        res.json({
            success: true,
            message: `成功充值 ${amount} 积分`,
            user: {
                id: user._id,
                username: user.username,
                nickname: user.nickname,
                points: user.points,
                previousPoints: oldPoints,
            },
        });
    } catch (error) {
        console.error('[Admin] Recharge error:', error);
        res.status(500).json({ error: '充值失败' });
    }
});

router.put('/users/:id/status', adminAuth, async (req: BuyerRequest, res: Response) => {
    try {
        const { status } = req.body;
        const userId = req.params.id;

        if (!['active', 'banned'].includes(status)) {
            return res.status(400).json({ error: '无效的状态值' });
        }

        const user = await BuyerUser.findById(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        if (userId === req.buyerId) {
            return res.status(400).json({ error: '不能修改自己的状态' });
        }

        user.status = status;
        await user.save();

        console.log(`[Admin] User ${user.username} status changed to: ${status}`);

        res.json({
            success: true,
            message: status === 'banned' ? '用户已禁用' : '用户已启用',
        });
    } catch (error) {
        console.error('[Admin] Update status error:', error);
        res.status(500).json({ error: '操作失败' });
    }
});

router.put('/users/:id/role', adminAuth, async (req: BuyerRequest, res: Response) => {
    try {
        const { role } = req.body;
        const userId = req.params.id;

        if (!['buyer', 'admin'].includes(role)) {
            return res.status(400).json({ error: '无效的角色' });
        }

        const user = await BuyerUser.findById(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        user.role = role;
        await user.save();

        console.log(`[Admin] User ${user.username} role changed to: ${role}`);

        res.json({
            success: true,
            message: `用户角色已更新为 ${role === 'admin' ? '管理员' : '普通用户'}`,
        });
    } catch (error) {
        console.error('[Admin] Update role error:', error);
        res.status(500).json({ error: '操作失败' });
    }
});

router.get('/tags', adminAuth, async (req: BuyerRequest, res: Response) => {
    try {
        const tags = await Tag.find().sort({ category: 1, sortOrder: 1 }).lean();
        res.json({ tags });
    } catch (error) {
        console.error('[Admin] Get tags error:', error);
        res.status(500).json({ error: '获取标签失败' });
    }
});

router.post('/tags', adminAuth, async (req: BuyerRequest, res: Response) => {
    try {
        const { name, category, color, sortOrder } = req.body;

        if (!name) {
            return res.status(400).json({ error: '标签名称不能为空' });
        }

        const existing = await Tag.findOne({ name });
        if (existing) {
            return res.status(400).json({ error: '标签名称已存在' });
        }

        const tag = await Tag.create({
            name,
            category: category || 'common',
            color: color || '#6366f1',
            sortOrder: sortOrder || 0,
            isActive: true,
        });

        console.log(`[Admin] Created tag: ${name}`);
        res.status(201).json({ tag, message: '标签创建成功' });
    } catch (error) {
        console.error('[Admin] Create tag error:', error);
        res.status(500).json({ error: '创建标签失败' });
    }
});

router.put('/tags/:id', adminAuth, async (req: BuyerRequest, res: Response) => {
    try {
        const { name, category, color, sortOrder, isActive } = req.body;

        const tag = await Tag.findById(req.params.id);
        if (!tag) {
            return res.status(404).json({ error: '标签不存在' });
        }

        if (name && name !== tag.name) {
            const existing = await Tag.findOne({ name });
            if (existing) {
                return res.status(400).json({ error: '标签名称已存在' });
            }
            tag.name = name;
        }

        if (category !== undefined) tag.category = category;
        if (color !== undefined) tag.color = color;
        if (sortOrder !== undefined) tag.sortOrder = sortOrder;
        if (isActive !== undefined) tag.isActive = isActive;

        await tag.save();

        console.log(`[Admin] Updated tag: ${tag.name}`);
        res.json({ tag, message: '标签更新成功' });
    } catch (error) {
        console.error('[Admin] Update tag error:', error);
        res.status(500).json({ error: '更新标签失败' });
    }
});

router.delete('/tags/:id', adminAuth, async (req: BuyerRequest, res: Response) => {
    try {
        const tag = await Tag.findByIdAndDelete(req.params.id);
        if (!tag) {
            return res.status(404).json({ error: '标签不存在' });
        }

        console.log(`[Admin] Deleted tag: ${tag.name}`);
        res.json({ success: true, message: '标签删除成功' });
    } catch (error) {
        console.error('[Admin] Delete tag error:', error);
        res.status(500).json({ error: '删除标签失败' });
    }
});

router.get('/rewrite-requests', adminAuth, async (req: BuyerRequest, res: Response) => {
    try {
        const requests = await RewriteRequest.find()
            .sort({ createdAt: -1 })
            .lean();

        const projectIds = [...new Set(requests.map(r => r.projectId.toString()))];
        const projects = await Project.find({ _id: { $in: projectIds } })
            .select('name')
            .lean();
        const projectMap = new Map(projects.map(p => [p._id.toString(), p.name]));

        const buyerIds = [...new Set(requests.map(r => r.buyerId.toString()))];
        const buyers = await BuyerUser.find({ _id: { $in: buyerIds } })
            .select('username nickname')
            .lean();
        const buyerMap = new Map(buyers.map(b => [b._id.toString(), b.nickname || b.username]));

        const result = requests.map(r => ({
            _id: r._id,
            projectId: r.projectId,
            projectName: projectMap.get(r.projectId.toString()) || '未知项目',
            buyerId: r.buyerId,
            buyerName: buyerMap.get(r.buyerId.toString()) || '未知用户',
            status: r.status,
            price: r.price,
            requirements: r.requirements,
            result: r.result,
            adminNote: r.adminNote,
            paidAt: r.paidAt,
            completedAt: r.completedAt,
            createdAt: r.createdAt,
        }));

        res.json({ requests: result });
    } catch (error) {
        console.error('[Admin] Get rewrite requests error:', error);
        res.status(500).json({ error: '获取改写请求失败' });
    }
});

router.put('/rewrite-requests/:id', adminAuth, async (req: BuyerRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { status, result, adminNote } = req.body;

        const request = await RewriteRequest.findById(id);
        if (!request) {
            return res.status(404).json({ error: '改写请求不存在' });
        }

        if (status) request.status = status;
        if (result !== undefined) request.result = result;
        if (adminNote !== undefined) request.adminNote = adminNote;
        if (status === 'completed') request.completedAt = new Date();

        await request.save();

        console.log(`[Admin] Updated rewrite request ${id} status to ${status}`);
        res.json({ success: true, request });
    } catch (error) {
        console.error('[Admin] Update rewrite request error:', error);
        res.status(500).json({ error: '更新改写请求失败' });
    }
});

router.get('/publish-requests', adminAuth, async (req: BuyerRequest, res: Response) => {
    try {
        const { status } = req.query;

        const query: any = {};
        if (status && ['pending', 'approved', 'rejected'].includes(status as string)) {
            query.status = status;
        }

        const requests = await PublishRequest.find(query)
            .sort({ createdAt: -1 })
            .lean();

        const projectIds = requests.map(r => r.projectId);
        const projects = await Project.find({ _id: { $in: projectIds } })
            .select('name genre totalEpisodes status')
            .lean();
        const projectMap = new Map(projects.map(p => [p._id.toString(), p]));

        const creatorIds = requests.map(r => r.creatorId);
        const creators = await Creator.find({ _id: { $in: creatorIds } })
            .select('username email')
            .lean();
        const creatorMap = new Map(creators.map(c => [c._id.toString(), c]));

        const episodeCounts = await Episode.aggregate([
            { $match: { projectId: { $in: projectIds } } },
            { $group: { _id: '$projectId', count: { $sum: 1 } } },
        ]);
        const episodeCountMap = new Map(episodeCounts.map(e => [e._id.toString(), e.count]));

        const result = requests.map(r => ({
            ...r,
            project: projectMap.get(r.projectId.toString()),
            creator: creatorMap.get(r.creatorId.toString()),
            actualEpisodeCount: episodeCountMap.get(r.projectId.toString()) || 0,
        }));

        res.json({ requests: result });
    } catch (error) {
        console.error('[Admin] Get publish requests error:', error);
        res.status(500).json({ error: '获取上架申请失败' });
    }
});

router.put('/publish-requests/:id/approve', adminAuth, async (req: BuyerRequest, res: Response) => {
    try {
        const request = await findPendingPublishRequest(req.params.id, res);
        if (!request) return;

        request.status = 'approved';
        request.reviewedBy = req.buyerId as any;
        request.reviewedAt = new Date();
        await request.save();

        await ProjectPublish.findOneAndUpdate(
            { projectId: request.projectId },
            {
                projectId: request.projectId,
                isPublished: true,
                pricePerEpisode: request.pricePerEpisode,
                freeEpisodeCount: request.freeEpisodeCount,
                targetAudience: request.targetAudience,
                tags: request.tags,
                supportsRewrite: request.supportsRewrite,
                rewritePrice: request.rewritePrice,
                publishedAt: new Date(),
            },
            { upsert: true, new: true }
        );

        console.log(`[Admin] 管理员 ${req.buyerId} 批准了项目上架申请 ${req.params.id}`);
        res.json({ success: true, message: '申请已批准，项目已上架' });
    } catch (error) {
        console.error('[Admin] Approve publish request error:', error);
        res.status(500).json({ error: '批准申请失败' });
    }
});

router.put('/publish-requests/:id/reject', adminAuth, async (req: BuyerRequest, res: Response) => {
    try {
        const { adminNote } = req.body;

        const request = await findPendingPublishRequest(req.params.id, res);
        if (!request) return;

        request.status = 'rejected';
        request.adminNote = adminNote || '审核未通过';
        request.reviewedBy = req.buyerId as any;
        request.reviewedAt = new Date();
        await request.save();

        console.log(`[Admin] 管理员 ${req.buyerId} 拒绝了项目上架申请 ${req.params.id}`);
        res.json({ success: true, message: '申请已拒绝' });
    } catch (error) {
        console.error('[Admin] Reject publish request error:', error);
        res.status(500).json({ error: '拒绝申请失败' });
    }
});

export default router;
