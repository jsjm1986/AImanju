import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Creator, ICreator } from '../models/Creator';

/**
 * 扩展 Request 类型
 */
declare global {
    namespace Express {
        interface Request {
            creatorId?: string;
            creator?: ICreator;
        }
    }
}

/**
 * 获取 JWT 密钥
 */
function getJwtSecret(): string {
    const secret = process.env.JWT_CREATOR_SECRET || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_CREATOR_SECRET or JWT_SECRET environment variable is required');
    }
    return secret;
}

/**
 * 创作者认证中间件
 * 验证 JWT Token 并注入 creatorId
 */
export async function creatorAuth(req: Request, res: Response, next: NextFunction) {
    try {
        let token: string | undefined;

        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        } else if (req.query.token && typeof req.query.token === 'string') {
            token = req.query.token;
        }

        if (!token) {
            return res.status(401).json({ error: '未登录，请先登录' });
        }

        // 验证 token
        const decoded = jwt.verify(token, getJwtSecret()) as { creatorId: string };

        if (!decoded.creatorId) {
            return res.status(401).json({ error: 'Token 无效' });
        }

        // 查找创作者
        const creator = await Creator.findById(decoded.creatorId);
        if (!creator) {
            return res.status(401).json({ error: '用户不存在' });
        }

        // 注入到 request
        req.creatorId = decoded.creatorId;
        req.creator = creator;

        next();
    } catch (error) {
        if ((error as Error).name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token 已过期，请重新登录' });
        }
        if ((error as Error).name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Token 无效' });
        }
        console.error('[CreatorAuth] Error:', error);
        return res.status(500).json({ error: '认证失败' });
    }
}

/**
 * 可选认证中间件
 * 如果有 token 则验证，没有也放行
 */
export async function optionalCreatorAuth(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, getJwtSecret()) as { creatorId: string };

        if (decoded.creatorId) {
            const creator = await Creator.findById(decoded.creatorId);
            if (creator) {
                req.creatorId = decoded.creatorId;
                req.creator = creator;
            }
        }

        next();
    } catch (error) {
        // 忽略错误，继续处理
        next();
    }
}

/**
 * 管理员权限中间件
 * 必须在 creatorAuth 之后使用
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (!req.creator || req.creator.role !== 'admin') {
        return res.status(403).json({ error: '需要管理员权限' });
    }
    next();
}

/**
 * 配额检查中间件 - 创建项目
 * 必须在 creatorAuth 之后使用
 */
export function checkProjectQuota(req: Request, res: Response, next: NextFunction) {
    if (!req.creator) {
        return res.status(401).json({ error: '未登录' });
    }

    if (!req.creator.canCreateProject()) {
        const message = req.creator.tier === 'trial'
            ? '试用账户只能创建1个项目，请购买项目配额'
            : '项目配额已用完，请购买更多配额';
        return res.status(403).json({ error: message, code: 'QUOTA_EXCEEDED' });
    }

    next();
}

/**
 * 配额检查中间件 - 生成剧集
 * 必须在 creatorAuth 之后使用
 */
export function checkEpisodeQuota(req: Request, res: Response, next: NextFunction) {
    if (!req.creator) {
        return res.status(401).json({ error: '未登录' });
    }

    if (!req.creator.canGenerateEpisode()) {
        const remaining = req.creator.getRemainingTrialEpisodes();
        return res.status(403).json({
            error: `试用配额已用完（${remaining}集），请购买项目配额以解锁无限生成`,
            code: 'EPISODE_QUOTA_EXCEEDED',
        });
    }

    next();
}

/**
 * 生成 JWT Token
 */
export function generateCreatorToken(creatorId: string): string {
    return jwt.sign(
        { creatorId },
        getJwtSecret(),
        { expiresIn: '7d' }
    );
}
