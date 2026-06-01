import { Router, Request, Response } from 'express';
import { Creator } from '../models/Creator';
import { Agent, generateInviteCode } from '../models/Agent';
import { AgentAllocation } from '../models/AgentAllocation';
import { Project } from '../models/Project';
import { Episode } from '../models/Episode';
import { agentAuth } from '../middleware/agentAuth';

const router = Router();

type AsyncHandler = (req: Request, res: Response) => Promise<any>;

function wrapRoute(tag: string, errorMsg: string, handler: AsyncHandler): AsyncHandler {
    return async (req: Request, res: Response) => {
        try {
            await handler(req, res);
        } catch (error) {
            console.error(`[${tag}] ${errorMsg}:`, error);
            res.status(500).json({ error: errorMsg });
        }
    };
}

/**
 * 统计概览
 * GET /api/agent/dashboard/stats
 */
router.get('/stats', agentAuth, wrapRoute('AgentDashboard', '获取统计失败', async (req, res) => {
    const agentId = req.agentId!;
    const agent = req.agent!;

    const [totalCreators, trialCreators, paidCreators] = await Promise.all([
        Creator.countDocuments({ agentId }),
        Creator.countDocuments({ agentId, tier: 'trial' }),
        Creator.countDocuments({ agentId, tier: 'paid' }),
    ]);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentRegistrations = await Creator.countDocuments({
        agentId,
        createdAt: { $gte: weekAgo },
    });

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthAllocations = await AgentAllocation.aggregate([
        {
            $match: {
                agentId: agent._id,
                type: { $in: ['activate', 'add_quota'] },
                createdAt: { $gte: monthStart },
            },
        },
        { $group: { _id: null, total: { $sum: '$projectCount' } } },
    ]);

    res.json({
        totalCreators,
        trialCreators,
        paidCreators,
        recentRegistrations,
        projectQuota: agent.projectQuota,
        projectsAllocated: agent.projectsAllocated,
        remainingQuota: agent.getRemainingQuota(),
        monthAllocated: monthAllocations[0]?.total || 0,
    });
}));

/**
 * 下级创作者列表
 * GET /api/agent/dashboard/creators
 */
router.get('/creators', agentAuth, wrapRoute('AgentDashboard', '获取创作者列表失败', async (req, res) => {
    const agentId = req.agentId!;
    const { page = 1, limit = 20, search, tier } = req.query;

    const query: any = { agentId };
    if (search) {
        query.$or = [
            { username: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
        ];
    }
    if (tier && ['trial', 'paid'].includes(tier as string)) {
        query.tier = tier;
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);

    const creators = await Creator.find(query)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean();

    const total = await Creator.countDocuments(query);

    const creatorIds = creators.map(c => c._id);
    const projectCounts = await Project.aggregate([
        { $match: { creatorId: { $in: creatorIds } } },
        { $group: { _id: '$creatorId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(projectCounts.map(p => [p._id.toString(), p.count]));

    const result = creators.map(c => ({
        ...c,
        actualProjectCount: countMap.get(c._id.toString()) || 0,
    }));

    res.json({
        creators: result,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
        },
    });
}));

/**
 * 单个创作者详情
 * GET /api/agent/dashboard/creators/:id
 */
router.get('/creators/:id', agentAuth, wrapRoute('AgentDashboard', '获取创作者详情失败', async (req, res) => {
    const agentId = req.agentId!;

    const creator = await Creator.findOne({ _id: req.params.id, agentId })
        .select('-passwordHash')
        .lean();

    if (!creator) {
        return res.status(404).json({ error: '创作者不存在或不属于您' });
    }

    const projects = await Project.find({ creatorId: creator._id })
        .select('name genre status createdAt totalEpisodes')
        .sort({ createdAt: -1 })
        .lean();

    const projectIds = projects.map(p => p._id);
    const episodeCounts = await Episode.aggregate([
        { $match: { projectId: { $in: projectIds } } },
        { $group: { _id: '$projectId', count: { $sum: 1 } } },
    ]);
    const episodeMap = new Map(episodeCounts.map(e => [e._id.toString(), e.count]));

    const allocations = await AgentAllocation.find({ agentId, creatorId: creator._id })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

    res.json({
        creator,
        projects: projects.map(p => ({
            ...p,
            episodeCount: episodeMap.get(p._id.toString()) || 0,
        })),
        allocations,
    });
}));

/**
 * 开通付费
 * PUT /api/agent/dashboard/creators/:id/activate
 */
router.put('/creators/:id/activate', agentAuth, wrapRoute('AgentDashboard', '开通失败', async (req, res) => {
    const agent = req.agent!;
    const { projectCount = 1 } = req.body;

    if (!Number.isInteger(projectCount) || projectCount < 1) {
        return res.status(400).json({ error: '项目配额数量必须为正整数' });
    }

    const creator = await Creator.findOne({ _id: req.params.id, agentId: agent._id });
    if (!creator) {
        return res.status(404).json({ error: '创作者不存在或不属于您' });
    }

    if (creator.tier === 'paid') {
        return res.status(400).json({ error: '该创作者已是付费用户，请使用追加配额功能' });
    }

    if (!agent.canAllocateProjects(projectCount)) {
        return res.status(400).json({
            error: `配额池不足，剩余 ${agent.getRemainingQuota()} 个，需要 ${projectCount} 个`,
        });
    }

    creator.tier = 'paid';
    creator.projectQuota += projectCount;
    await creator.save();

    agent.projectsAllocated += projectCount;
    await agent.save();

    await AgentAllocation.create({
        agentId: agent._id,
        creatorId: creator._id,
        type: 'activate',
        projectCount,
        description: `开通付费并分配 ${projectCount} 个项目配额`,
    });

    console.log(`[AgentDashboard] 代理 ${agent.username} 为创作者 ${creator.username} 开通付费，分配 ${projectCount} 个配额`);

    res.json({
        message: '开通成功',
        creator: {
            id: creator._id,
            username: creator.username,
            tier: creator.tier,
            projectQuota: creator.projectQuota,
        },
        agentRemaining: agent.getRemainingQuota(),
    });
}));

/**
 * 追加配额
 * PUT /api/agent/dashboard/creators/:id/add-quota
 */
router.put('/creators/:id/add-quota', agentAuth, wrapRoute('AgentDashboard', '追加配额失败', async (req, res) => {
    const agent = req.agent!;
    const { projectCount = 1 } = req.body;

    if (!Number.isInteger(projectCount) || projectCount < 1) {
        return res.status(400).json({ error: '项目配额数量必须为正整数' });
    }

    const creator = await Creator.findOne({ _id: req.params.id, agentId: agent._id });
    if (!creator) {
        return res.status(404).json({ error: '创作者不存在或不属于您' });
    }

    if (creator.tier !== 'paid') {
        return res.status(400).json({ error: '请先开通付费后再追加配额' });
    }

    if (!agent.canAllocateProjects(projectCount)) {
        return res.status(400).json({
            error: `配额池不足，剩余 ${agent.getRemainingQuota()} 个，需要 ${projectCount} 个`,
        });
    }

    creator.projectQuota += projectCount;
    await creator.save();

    agent.projectsAllocated += projectCount;
    await agent.save();

    await AgentAllocation.create({
        agentId: agent._id,
        creatorId: creator._id,
        type: 'add_quota',
        projectCount,
        description: `追加 ${projectCount} 个项目配额`,
    });

    console.log(`[AgentDashboard] 代理 ${agent.username} 为创作者 ${creator.username} 追加 ${projectCount} 个配额`);

    res.json({
        message: '追加成功',
        creator: {
            id: creator._id,
            username: creator.username,
            projectQuota: creator.projectQuota,
        },
        agentRemaining: agent.getRemainingQuota(),
    });
}));

/**
 * 获取邀请码
 * GET /api/agent/dashboard/invite
 */
router.get('/invite', agentAuth, wrapRoute('AgentDashboard', '获取邀请码失败', async (req, res) => {
    const agent = req.agent!;
    const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;

    res.json({
        inviteCode: agent.inviteCode,
        inviteLink: `${baseUrl}/login?invite=${agent.inviteCode}`,
    });
}));

/**
 * 刷新邀请码
 * POST /api/agent/dashboard/invite/refresh
 */
router.post('/invite/refresh', agentAuth, wrapRoute('AgentDashboard', '刷新邀请码失败', async (req, res) => {
    const agent = req.agent!;

    let newCode = generateInviteCode();
    let attempts = 0;
    while (attempts < 10) {
        const exists = await Agent.findOne({ inviteCode: newCode });
        if (!exists) break;
        newCode = generateInviteCode();
        attempts++;
    }

    agent.inviteCode = newCode;
    await agent.save();

    const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;

    console.log(`[AgentDashboard] 代理 ${agent.username} 刷新了邀请码`);

    res.json({
        message: '邀请码已刷新',
        inviteCode: newCode,
        inviteLink: `${baseUrl}/login?invite=${newCode}`,
    });
}));

/**
 * 分配记录流水
 * GET /api/agent/dashboard/allocations
 */
router.get('/allocations', agentAuth, wrapRoute('AgentDashboard', '获取分配记录失败', async (req, res) => {
    const agentId = req.agentId!;
    const { page = 1, limit = 20, type } = req.query;

    const query: any = { agentId };
    if (type && ['activate', 'add_quota', 'reduce_quota'].includes(type as string)) {
        query.type = type;
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);

    const total = await AgentAllocation.countDocuments(query);
    const allocations = await AgentAllocation.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean();

    const creatorIds = [...new Set(allocations.map(a => a.creatorId.toString()))];
    const creators = await Creator.find({ _id: { $in: creatorIds } })
        .select('username email')
        .lean();
    const creatorMap = new Map(creators.map(c => [c._id.toString(), c]));

    const result = allocations.map(a => ({
        ...a,
        creatorName: creatorMap.get(a.creatorId.toString())?.username || '未知用户',
    }));

    res.json({
        allocations: result,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
        },
    });
}));

export default router;
