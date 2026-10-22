import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { BuyerUser, IBuyerUser } from '../models/BuyerUser';

function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET environment variable is required');
    }
    return secret;
}

/**
 * 扩展 Request 类型，添加 buyer 属性
 */
export interface BuyerRequest extends Request {
    buyer?: IBuyerUser;
    buyerId?: string;
}

/**
 * JWT Token 载荷
 */
interface TokenPayload extends jwt.JwtPayload {
    userId: string;
    role: string;
}

/**
 * 生成 JWT Token
 */
export function generateToken(user: IBuyerUser): string {
    const payload: TokenPayload = {
        userId: user._id.toString(),
        role: user.role,
    };
    return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

/**
 * 验证 JWT Token 中间件
 */
export async function buyerAuth(req: BuyerRequest, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: '未提供认证令牌' });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, getJwtSecret()) as TokenPayload;

        const user = await BuyerUser.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ error: '用户不存在' });
        }

        if (user.status === 'banned') {
            return res.status(403).json({ error: '账号已被禁用' });
        }

        req.buyer = user;
        req.buyerId = user._id.toString();
        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ error: '令牌已过期，请重新登录' });
        }
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ error: '无效的令牌' });
        }
        console.error('[BuyerAuth] Error:', error);
        return res.status(500).json({ error: '认证失败' });
    }
}

/**
 * 管理员权限中间件
 */
export async function adminAuth(req: BuyerRequest, res: Response, next: NextFunction) {
    // 先调用 buyerAuth
    await buyerAuth(req, res, () => {
        if (req.buyer?.role !== 'admin') {
            return res.status(403).json({ error: '需要管理员权限' });
        }
        next();
    });
}

/**
 * 可选认证中间件（不强制登录，但如果有 token 会解析）
 */
export async function optionalAuth(req: BuyerRequest, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, getJwtSecret()) as TokenPayload;

        const user = await BuyerUser.findById(decoded.userId);
        if (user && user.status === 'active') {
            req.buyer = user;
            req.buyerId = user._id.toString();
        }
        next();
    } catch {
        // Token 无效时忽略，继续处理请求
        next();
    }
}
