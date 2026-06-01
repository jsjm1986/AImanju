import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { BuyerUser } from '../models/BuyerUser';
import { BuyerRequest, generateToken, buyerAuth } from '../middleware/buyerAuth';

const router = Router();

/**
 * 用户注册
 * POST /api/auth/register
 */
router.post('/register', async (req: BuyerRequest, res: Response) => {
    try {
        const { username, email, password, nickname } = req.body;

        // 验证必填字段
        if (!username || !email || !password) {
            return res.status(400).json({ error: '用户名、邮箱和密码都是必填项' });
        }

        // 验证用户名格式
        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({ error: '用户名长度需在3-20个字符之间' });
        }

        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: '邮箱格式不正确' });
        }

        // 验证密码强度
        if (password.length < 6) {
            return res.status(400).json({ error: '密码长度至少6个字符' });
        }

        // 检查用户名是否已存在
        const existingUsername = await BuyerUser.findOne({ username });
        if (existingUsername) {
            return res.status(400).json({ error: '用户名已被使用' });
        }

        // 检查邮箱是否已存在
        const existingEmail = await BuyerUser.findOne({ email: email.toLowerCase() });
        if (existingEmail) {
            return res.status(400).json({ error: '邮箱已被注册' });
        }

        // 加密密码
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // 创建用户
        const user = await BuyerUser.create({
            username,
            email: email.toLowerCase(),
            passwordHash,
            nickname: nickname || username,
            points: 0,
            role: 'buyer',
            status: 'active',
        });

        // 生成 Token
        const token = generateToken(user);

        console.log(`[Auth] New user registered: ${username}`);

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                nickname: user.nickname,
                points: user.points,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('[Auth] Register error:', error);
        res.status(500).json({ error: '注册失败，请稍后重试' });
    }
});

/**
 * 用户登录
 * POST /api/auth/login
 */
router.post('/login', async (req: BuyerRequest, res: Response) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: '请输入用户名和密码' });
        }

        // 查找用户（支持用户名或邮箱登录）
        const user = await BuyerUser.findOne({
            $or: [
                { username },
                { email: username.toLowerCase() },
            ],
        });

        if (!user) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        // 检查账号状态
        if (user.status === 'banned') {
            return res.status(403).json({ error: '账号已被禁用' });
        }

        // 验证密码
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        // 更新最后登录时间
        user.lastLoginAt = new Date();
        await user.save();

        // 生成 Token
        const token = generateToken(user);

        console.log(`[Auth] User logged in: ${user.username}`);

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                nickname: user.nickname,
                points: user.points,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('[Auth] Login error:', error);
        res.status(500).json({ error: '登录失败，请稍后重试' });
    }
});

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
router.get('/me', buyerAuth, async (req: BuyerRequest, res: Response) => {
    try {
        const user = req.buyer!;
        res.json({
            id: user._id,
            username: user.username,
            email: user.email,
            nickname: user.nickname,
            avatar: user.avatar,
            points: user.points,
            role: user.role,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt,
        });
    } catch (error) {
        console.error('[Auth] Get me error:', error);
        res.status(500).json({ error: '获取用户信息失败' });
    }
});

/**
 * 更新用户信息
 * PUT /api/auth/me
 */
router.put('/me', buyerAuth, async (req: BuyerRequest, res: Response) => {
    try {
        const user = req.buyer!;
        const { nickname, avatar } = req.body;

        if (nickname) user.nickname = nickname;
        if (avatar !== undefined) user.avatar = avatar;

        await user.save();

        res.json({
            success: true,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                nickname: user.nickname,
                avatar: user.avatar,
                points: user.points,
            },
        });
    } catch (error) {
        console.error('[Auth] Update me error:', error);
        res.status(500).json({ error: '更新失败' });
    }
});

/**
 * 修改密码
 * PUT /api/auth/me/password
 */
router.put('/me/password', buyerAuth, async (req: BuyerRequest, res: Response) => {
    try {
        const user = req.buyer!;
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({ error: '请提供旧密码和新密码' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: '新密码长度至少6个字符' });
        }

        // 验证旧密码
        const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: '旧密码错误' });
        }

        // 加密新密码
        const salt = await bcrypt.genSalt(10);
        user.passwordHash = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.json({ success: true, message: '密码修改成功' });
    } catch (error) {
        console.error('[Auth] Change password error:', error);
        res.status(500).json({ error: '修改密码失败' });
    }
});

export default router;
