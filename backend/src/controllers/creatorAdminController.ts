import { Router, Request, Response } from 'express';
import { Creator } from '../models/Creator';
import { Episode } from '../models/Episode';
import { Project } from '../models/Project';
import { PublishRequest } from '../models/PublishRequest';
import { Agent, generateInviteCode } from '../models/Agent';
import { AgentAllocation } from '../models/AgentAllocation';
import { creatorAuth, requireAdmin } from '../middleware/creatorMiddleware';

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

router.get('/users', creatorAuth, requireAdmin, wrapRoute('CreatorAdmin', '获取用户列表失败', async (req, res) => {
    const { page = 1, limit = 20, search } = req.query;

    const query: any = {};
    if (search) {
        query.$or = [
            { username: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
        ];
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
        users: result,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
}));

router.get('/users/:id', creatorAuth, requireAdmin, wrapRoute('CreatorAdmin', '获取用户详情失败', async (req, res) => {
    const creator = await Creator.findById(req.params.id).select('-passwordHash').lean();
    if (!creator) {
        return res.status(404).json({ error: '用户不存在' });
    }

    const projects = await Project.find({ creatorId: creator._id })
        .select('name genre status createdAt totalEpisodes')
        .sort({ createdAt: -1 })
        .lean();

    res.json({ user: creator, projects });
}));

router.put('/users/:id/quota', creatorAuth, requireAdmin, wrapRoute('CreatorAdmin', '更新配额失败', async (req, res) => {
    const { projectQuota, tier, resetTrialEpisodes } = req.body;

    const creator = await Creator.findById(req.params.id);
    if (!creator) {
        return res.status(404).json({ error: '用户不存在' });
    }

    if (creator.role === 'admin' && req.creator!._id.toString() !== creator._id.toString()) {
        return res.status(403).json({ error: '不能修改其他管理员的配额' });
    }

    if (typeof projectQuota === 'number' && projectQuota >= 0) {
        creator.projectQuota = projectQuota;
    }
    if (tier && ['trial', 'paid'].includes(tier)) {
        creator.tier = tier;
    }
    if (resetTrialEpisodes) {
        creator.trialEpisodesUsed = 0;
    }

    await creator.save();

    console.log(`[CreatorAdmin] 管理员 ${req.creator!.username} 修改了用户 ${creator.username} 的配额`);

    res.json({
        message: '配额更新成功',
        user: {
            id: creator._id,
            username: creator.username,
            tier: creator.tier,
            projectQuota: creator.projectQuota,
            projectsUsed: creator.projectsUsed,
            trialEpisodesUsed: creator.trialEpisodesUsed,
        },
    });
}));

router.delete('/users/:id', creatorAuth, requireAdmin, wrapRoute('CreatorAdmin', '删除用户失败', async (req, res) => {
    const creator = await Creator.findById(req.params.id);
    if (!creator) {
        return res.status(404).json({ error: '用户不存在' });
    }
    if (creator.role === 'admin') {
        return res.status(403).json({ error: '不能删除管理员账户' });
    }
    if (creator._id.toString() === req.creator!._id.toString()) {
        return res.status(403).json({ error: '不能删除自己的账户' });
    }

    const projectCount = await Project.countDocuments({ creatorId: creator._id });
    if (projectCount > 0) {
        return res.status(400).json({
            error: `该用户有 ${projectCount} 个项目，请先转移或删除项目`,
            projectCount,
        });
    }

    await Creator.findByIdAndDelete(req.params.id);
    console.log(`[CreatorAdmin] 管理员 ${req.creator!.username} 删除了用户 ${creator.username}`);
    res.json({ message: '用户已删除' });
}));

router.get('/config', creatorAuth, requireAdmin, wrapRoute('CreatorAdmin', '获取配置失败', async (_req, res) => {
    res.json({
        projectPrice: parseInt(process.env.PROJECT_PRICE || '99'),
        trialEpisodeLimit: parseInt(process.env.TRIAL_EPISODE_LIMIT || '10'),
        trialProjectLimit: 1,
    });
}));

router.get('/stats', creatorAuth, requireAdmin, wrapRoute('CreatorAdmin', '获取统计数据失败', async (_req, res) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [totalCreators, trialCreators, paidCreators, totalProjects, recentRegistrations] = await Promise.all([
        Creator.countDocuments(),
        Creator.countDocuments({ tier: 'trial' }),
        Creator.countDocuments({ tier: 'paid' }),
        Project.countDocuments(),
        Creator.countDocuments({ createdAt: { $gte: weekAgo } }),
    ]);

    res.json({ totalCreators, trialCreators, paidCreators, totalProjects, recentRegistrations });
}));

router.get('/publish-requests', creatorAuth, wrapRoute('PublishRequest', '获取上架申请失败', async (req, res) => {
    const creatorId = req.creatorId;

    const requests = await PublishRequest.find({ creatorId })
        .sort({ createdAt: -1 })
        .lean();

    const projectIds = requests.map(r => r.projectId);
    const projects = await Project.find({ _id: { $in: projectIds } })
        .select('name genre totalEpisodes')
        .lean();
    const projectMap = new Map(projects.map(p => [p._id.toString(), p]));

    const result = requests.map(r => ({
        ...r,
        project: projectMap.get(r.projectId.toString()),
    }));

    res.json({ requests: result });
}));

router.post('/publish-requests', creatorAuth, wrapRoute('PublishRequest', '提交上架申请失败', async (req, res) => {
    const creatorId = req.creatorId;
    const { projectId, pricePerEpisode, freeEpisodeCount, targetAudience, tags, supportsRewrite, rewritePrice } = req.body;

    if (!projectId) {
        return res.status(400).json({ error: '项目ID不能为空' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
        return res.status(404).json({ error: '项目不存在' });
    }
    if (project.creatorId?.toString() !== creatorId) {
        return res.status(403).json({ error: '无权操作此项目' });
    }

    const episodeCount = await Episode.countDocuments({ projectId });
    if (episodeCount === 0) {
        return res.status(400).json({ error: '项目没有生成内容，无法申请上架' });
    }

    const existingPendingRequest = await PublishRequest.findOne({ projectId, status: 'pending' });
    if (existingPendingRequest) {
        return res.status(400).json({ error: '该项目已有待审核的申请' });
    }

    await PublishRequest.deleteMany({ projectId, status: 'rejected' });

    const request = await PublishRequest.create({
        projectId,
        creatorId,
        pricePerEpisode: pricePerEpisode || 10,
        freeEpisodeCount: freeEpisodeCount || 5,
        targetAudience: targetAudience || 'male',
        tags: tags || [],
        supportsRewrite: supportsRewrite || false,
        rewritePrice: rewritePrice || 0,
        status: 'pending',
    });

    console.log(`[PublishRequest] 创作者 ${req.creator?.username} 提交了项目 ${project.name} 的上架申请`);

    res.status(201).json({ message: '上架申请已提交，请等待审核', request });
}));

router.delete('/publish-requests/:id', creatorAuth, wrapRoute('PublishRequest', '撤回申请失败', async (req, res) => {
    const request = await PublishRequest.findById(req.params.id);
    if (!request) {
        return res.status(404).json({ error: '申请不存在' });
    }
    if (request.creatorId.toString() !== req.creatorId) {
        return res.status(403).json({ error: '无权操作此申请' });
    }
    if (request.status !== 'pending') {
        return res.status(400).json({ error: '只能撤回待审核的申请' });
    }

    await PublishRequest.findByIdAndDelete(req.params.id);
    res.json({ message: '申请已撤回' });
}));

// ============= 代理管理 =============

router.get('/agents', creatorAuth, requireAdmin, wrapRoute('CreatorAdmin', '获取代理列表失败', async (req, res) => {
    const { page = 1, limit = 20, search } = req.query;

    const query: any = {};
    if (search) {
        query.$or = [
            { username: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { note: { $regex: search, $options: 'i' } },
        ];
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);

    const agents = await Agent.find(query)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean();

    const total = await Agent.countDocuments(query);

    const agentIds = agents.map(a => a._id);
    const creatorCounts = await Creator.aggregate([
        { $match: { agentId: { $in: agentIds } } },
        { $group: { _id: '$agentId', total: { $sum: 1 }, paid: { $sum: { $cond: [{ $eq: ['$tier', 'paid'] }, 1, 0] } } } },
    ]);
    const countMap = new Map(creatorCounts.map(c => [c._id.toString(), { total: c.total, paid: c.paid }]));

    const result = agents.map(a => ({
        ...a,
        creatorCount: countMap.get(a._id.toString())?.total || 0,
        paidCreatorCount: countMap.get(a._id.toString())?.paid || 0,
    }));

    res.json({
        agents: result,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
}));

router.post('/agents', creatorAuth, requireAdmin, wrapRoute('CreatorAdmin', '创建代理失败', async (req, res) => {
    const { username, email, password, projectQuota = 0, note = '' } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: '用户名、邮箱和密码都是必填项' });
    }

    if (username.length < 2 || username.length > 50) {
        return res.status(400).json({ error: '用户名长度应在2-50个字符之间' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: '邮箱格式不正确' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: '密码长度至少6个字符' });
    }

    const existingUsername = await Agent.findOne({ username });
    if (existingUsername) {
        return res.status(400).json({ error: '用户名已被使用' });
    }

    const existingEmail = await Agent.findOne({ email });
    if (existingEmail) {
        return res.status(400).json({ error: '邮箱已被注册' });
    }

    let inviteCode = generateInviteCode();
    let attempts = 0;
    while (attempts < 10) {
        const exists = await Agent.findOne({ inviteCode });
        if (!exists) break;
        inviteCode = generateInviteCode();
        attempts++;
    }

    const agent = new Agent({
        username,
        email,
        passwordHash: password,
        status: 'active',
        projectQuota: Math.max(0, Number(projectQuota) || 0),
        projectsAllocated: 0,
        inviteCode,
        note,
    });

    await agent.save();

    console.log(`[CreatorAdmin] 管理员 ${req.creator!.username} 创建了代理 ${username}`);

    res.status(201).json({
        message: '代理创建成功',
        agent: {
            id: agent._id,
            username: agent.username,
            email: agent.email,
            status: agent.status,
            projectQuota: agent.projectQuota,
            projectsAllocated: agent.projectsAllocated,
            inviteCode: agent.inviteCode,
            note: agent.note,
        },
    });
}));

router.get('/agents/:id', creatorAuth, requireAdmin, wrapRoute('CreatorAdmin', '获取代理详情失败', async (req, res) => {
    const agent = await Agent.findById(req.params.id).select('-passwordHash').lean();
    if (!agent) {
        return res.status(404).json({ error: '代理不存在' });
    }

    const [totalCreators, trialCreators, paidCreators] = await Promise.all([
        Creator.countDocuments({ agentId: agent._id }),
        Creator.countDocuments({ agentId: agent._id, tier: 'trial' }),
        Creator.countDocuments({ agentId: agent._id, tier: 'paid' }),
    ]);

    const recentAllocations = await AgentAllocation.find({ agentId: agent._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

    res.json({
        agent,
        stats: { totalCreators, trialCreators, paidCreators },
        recentAllocations,
    });
}));

router.put('/agents/:id', creatorAuth, requireAdmin, wrapRoute('CreatorAdmin', '更新代理失败', async (req, res) => {
    const { projectQuota, status, note } = req.body;

    const agent = await Agent.findById(req.params.id);
    if (!agent) {
        return res.status(404).json({ error: '代理不存在' });
    }

    if (typeof projectQuota === 'number' && projectQuota >= 0) {
        if (projectQuota < agent.projectsAllocated) {
            return res.status(400).json({
                error: `配额不能低于已分配数量（${agent.projectsAllocated}）`,
            });
        }
        agent.projectQuota = projectQuota;
    }
    if (status && ['active', 'frozen'].includes(status)) {
        agent.status = status;
    }
    if (note !== undefined) {
        agent.note = note;
    }

    await agent.save();

    console.log(`[CreatorAdmin] 管理员 ${req.creator!.username} 修改了代理 ${agent.username} 的信息`);

    res.json({
        message: '代理信息已更新',
        agent: {
            id: agent._id,
            username: agent.username,
            email: agent.email,
            status: agent.status,
            projectQuota: agent.projectQuota,
            projectsAllocated: agent.projectsAllocated,
            note: agent.note,
        },
    });
}));

router.delete('/agents/:id', creatorAuth, requireAdmin, wrapRoute('CreatorAdmin', '删除代理失败', async (req, res) => {
    const agent = await Agent.findById(req.params.id);
    if (!agent) {
        return res.status(404).json({ error: '代理不存在' });
    }

    const creatorCount = await Creator.countDocuments({ agentId: agent._id });
    if (creatorCount > 0) {
        return res.status(400).json({
            error: `该代理下有 ${creatorCount} 个创作者，请先转移或解绑`,
            creatorCount,
        });
    }

    await AgentAllocation.deleteMany({ agentId: agent._id });
    await Agent.findByIdAndDelete(req.params.id);

    console.log(`[CreatorAdmin] 管理员 ${req.creator!.username} 删除了代理 ${agent.username}`);
    res.json({ message: '代理已删除' });
}));

router.get('/agents/:id/allocations', creatorAuth, requireAdmin, wrapRoute('CreatorAdmin', '获取分配记录失败', async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Number(page);
    const limitNum = Number(limit);

    const agent = await Agent.findById(req.params.id);
    if (!agent) {
        return res.status(404).json({ error: '代理不存在' });
    }

    const query = { agentId: agent._id };
    const total = await AgentAllocation.countDocuments(query);
    const allocations = await AgentAllocation.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean();

    const creatorIds = [...new Set(allocations.map(a => a.creatorId.toString()))];
    const creators = await Creator.find({ _id: { $in: creatorIds } })
        .select('username')
        .lean();
    const creatorMap = new Map(creators.map(c => [c._id.toString(), c.username]));

    const result = allocations.map(a => ({
        ...a,
        creatorName: creatorMap.get(a.creatorId.toString()) || '未知用户',
    }));

    res.json({
        allocations: result,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
}));

export default router;
