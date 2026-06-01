import { Router, Request, Response } from 'express';
import { Agent } from '../models/Agent';
import { agentAuth, generateAgentToken } from '../middleware/agentAuth';

const router = Router();

/**
 * 代理登录
 * POST /api/agent/login
 */
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码都是必填项' });
        }

        const agent = await Agent.findOne({
            $or: [{ username }, { email: username }],
        });

        if (!agent) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        if (agent.status === 'frozen') {
            return res.status(403).json({ error: '账号已被冻结，请联系管理员' });
        }

        const isMatch = await agent.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        agent.lastLoginAt = new Date();
        await agent.save();

        const token = generateAgentToken(agent._id.toString());

        console.log(`[AgentAuth] 代理登录: ${agent.username}`);

        res.json({
            message: '登录成功',
            token,
            user: {
                id: agent._id,
                username: agent.username,
                email: agent.email,
                status: agent.status,
                projectQuota: agent.projectQuota,
                projectsAllocated: agent.projectsAllocated,
                remainingQuota: agent.getRemainingQuota(),
                inviteCode: agent.inviteCode,
            },
        });
    } catch (error) {
        console.error('[AgentAuth] Login error:', error);
        res.status(500).json({ error: '登录失败，请稍后重试' });
    }
});

/**
 * 获取当前代理信息
 * GET /api/agent/profile
 */
router.get('/profile', agentAuth, async (req: Request, res: Response) => {
    try {
        const agent = req.agent!;

        res.json({
            user: {
                id: agent._id,
                username: agent.username,
                email: agent.email,
                status: agent.status,
                projectQuota: agent.projectQuota,
                projectsAllocated: agent.projectsAllocated,
                remainingQuota: agent.getRemainingQuota(),
                inviteCode: agent.inviteCode,
                note: agent.note,
                createdAt: agent.createdAt,
                lastLoginAt: agent.lastLoginAt,
            },
        });
    } catch (error) {
        console.error('[AgentAuth] Profile error:', error);
        res.status(500).json({ error: '获取信息失败' });
    }
});

/**
 * 更新个人信息
 * PUT /api/agent/profile
 */
router.put('/profile', agentAuth, async (req: Request, res: Response) => {
    try {
        const agent = req.agent!;
        const { email, currentPassword, newPassword } = req.body;

        if (email && email !== agent.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ error: '邮箱格式不正确' });
            }
            const existing = await Agent.findOne({ email, _id: { $ne: agent._id } });
            if (existing) {
                return res.status(400).json({ error: '邮箱已被其他账户使用' });
            }
            agent.email = email;
        }

        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ error: '请输入当前密码' });
            }
            const isMatch = await agent.comparePassword(currentPassword);
            if (!isMatch) {
                return res.status(400).json({ error: '当前密码错误' });
            }
            if (newPassword.length < 6) {
                return res.status(400).json({ error: '新密码长度至少6个字符' });
            }
            agent.passwordHash = newPassword;
        }

        await agent.save();

        res.json({
            message: '更新成功',
            user: {
                id: agent._id,
                username: agent.username,
                email: agent.email,
            },
        });
    } catch (error) {
        console.error('[AgentAuth] Update profile error:', error);
        res.status(500).json({ error: '更新失败' });
    }
});

export default router;
