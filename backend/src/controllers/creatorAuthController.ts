import { Router, Request, Response } from 'express';
import { Creator } from '../models/Creator';
import { Agent } from '../models/Agent';
import { creatorAuth, generateCreatorToken } from '../middleware/creatorMiddleware';

const router = Router();

/**
 * 注册新创作者
 * POST /api/creator/register
 */
router.post('/register', async (req: Request, res: Response) => {
    try {
        const { username, email, password, inviteCode } = req.body;

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

        const existingUsername = await Creator.findOne({ username });
        if (existingUsername) {
            return res.status(400).json({ error: '用户名已被使用' });
        }

        const existingEmail = await Creator.findOne({ email });
        if (existingEmail) {
            return res.status(400).json({ error: '邮箱已被注册' });
        }

        let agentId = null;
        if (inviteCode) {
            const agent = await Agent.findOne({ inviteCode: inviteCode.toUpperCase(), status: 'active' });
            if (!agent) {
                return res.status(400).json({ error: '邀请码无效或已过期' });
            }
            agentId = agent._id;
        }

        const creator = new Creator({
            username,
            email,
            passwordHash: password,
            role: 'creator',
            tier: 'trial',
            projectQuota: 0,
            projectsUsed: 0,
            trialEpisodesUsed: 0,
            agentId,
            inviteCode: inviteCode ? inviteCode.toUpperCase() : null,
        });

        await creator.save();

        const token = generateCreatorToken(creator._id.toString());

        console.log(`[CreatorAuth] 新用户注册: ${username} (${email})${agentId ? ` [邀请码: ${inviteCode}]` : ''}`);

        res.status(201).json({
            message: '注册成功',
            token,
            user: {
                id: creator._id,
                username: creator.username,
                email: creator.email,
                role: creator.role,
                tier: creator.tier,
                projectQuota: creator.projectQuota,
                projectsUsed: creator.projectsUsed,
                trialEpisodesUsed: creator.trialEpisodesUsed,
                remainingTrialEpisodes: creator.getRemainingTrialEpisodes(),
                remainingProjectQuota: creator.getRemainingProjectQuota(),
            },
        });
    } catch (error) {
        console.error('[CreatorAuth] Register error:', error);
        res.status(500).json({ error: '注册失败，请稍后重试' });
    }
});

/**
 * 登录
 * POST /api/creator/login
 */
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码都是必填项' });
        }

        // 查找用户（支持用户名或邮箱登录）
        const creator = await Creator.findOne({
            $or: [{ username }, { email: username }],
        });

        if (!creator) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        // 验证密码
        const isMatch = await creator.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        // 更新最后登录时间
        creator.lastLoginAt = new Date();
        await creator.save();

        // 生成 token
        const token = generateCreatorToken(creator._id.toString());

        console.log(`[CreatorAuth] 用户登录: ${creator.username}`);

        res.json({
            message: '登录成功',
            token,
            user: {
                id: creator._id,
                username: creator.username,
                email: creator.email,
                role: creator.role,
                tier: creator.tier,
                projectQuota: creator.projectQuota,
                projectsUsed: creator.projectsUsed,
                trialEpisodesUsed: creator.trialEpisodesUsed,
                remainingTrialEpisodes: creator.getRemainingTrialEpisodes(),
                remainingProjectQuota: creator.getRemainingProjectQuota(),
            },
        });
    } catch (error) {
        console.error('[CreatorAuth] Login error:', error);
        res.status(500).json({ error: '登录失败，请稍后重试' });
    }
});

/**
 * 获取当前用户信息
 * GET /api/creator/profile
 */
router.get('/profile', creatorAuth, async (req: Request, res: Response) => {
    try {
        const creator = req.creator!;

        res.json({
            user: {
                id: creator._id,
                username: creator.username,
                email: creator.email,
                role: creator.role,
                tier: creator.tier,
                projectQuota: creator.projectQuota,
                projectsUsed: creator.projectsUsed,
                trialEpisodesUsed: creator.trialEpisodesUsed,
                remainingTrialEpisodes: creator.getRemainingTrialEpisodes(),
                remainingProjectQuota: creator.getRemainingProjectQuota(),
                createdAt: creator.createdAt,
                lastLoginAt: creator.lastLoginAt,
            },
        });
    } catch (error) {
        console.error('[CreatorAuth] Profile error:', error);
        res.status(500).json({ error: '获取用户信息失败' });
    }
});

/**
 * 更新个人信息
 * PUT /api/creator/profile
 */
router.put('/profile', creatorAuth, async (req: Request, res: Response) => {
    try {
        const creator = req.creator!;
        const { email, currentPassword, newPassword } = req.body;

        // 更新邮箱
        if (email && email !== creator.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ error: '邮箱格式不正确' });
            }

            const existingEmail = await Creator.findOne({ email, _id: { $ne: creator._id } });
            if (existingEmail) {
                return res.status(400).json({ error: '邮箱已被其他账户使用' });
            }

            creator.email = email;
        }

        // 更新密码
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ error: '请输入当前密码' });
            }

            const isMatch = await creator.comparePassword(currentPassword);
            if (!isMatch) {
                return res.status(400).json({ error: '当前密码错误' });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({ error: '新密码长度至少6个字符' });
            }

            creator.passwordHash = newPassword; // 会在 save 时自动加密
        }

        await creator.save();

        res.json({
            message: '更新成功',
            user: {
                id: creator._id,
                username: creator.username,
                email: creator.email,
                role: creator.role,
                tier: creator.tier,
            },
        });
    } catch (error) {
        console.error('[CreatorAuth] Update profile error:', error);
        res.status(500).json({ error: '更新失败' });
    }
});

/**
 * 获取配额信息
 * GET /api/creator/quota
 */
router.get('/quota', creatorAuth, async (req: Request, res: Response) => {
    try {
        const creator = req.creator!;
        const trialLimit = parseInt(process.env.TRIAL_EPISODE_LIMIT || '10');
        const projectPrice = parseInt(process.env.PROJECT_PRICE || '99');

        res.json({
            tier: creator.tier,
            role: creator.role,
            // 项目配额
            projectQuota: creator.tier === 'trial' ? 1 : creator.projectQuota,
            projectsUsed: creator.projectsUsed,
            remainingProjects: creator.getRemainingProjectQuota(),
            canCreateProject: creator.canCreateProject(),
            // 集数配额（仅试用用户有限制）
            trialEpisodeLimit: trialLimit,
            trialEpisodesUsed: creator.trialEpisodesUsed,
            remainingTrialEpisodes: creator.getRemainingTrialEpisodes(),
            canGenerateEpisode: creator.canGenerateEpisode(),
            // 价格信息
            projectPrice,
        });
    } catch (error) {
        console.error('[CreatorAuth] Quota error:', error);
        res.status(500).json({ error: '获取配额信息失败' });
    }
});

export default router;
