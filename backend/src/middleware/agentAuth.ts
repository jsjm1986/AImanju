import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Agent, IAgent } from '../models/Agent';

declare global {
    namespace Express {
        interface Request {
            agentId?: string;
            agent?: IAgent;
        }
    }
}

function getJwtSecret(): string {
    const secret = process.env.JWT_AGENT_SECRET || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_AGENT_SECRET or JWT_SECRET environment variable is required');
    }
    return secret;
}

export async function agentAuth(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: '未登录，请先登录' });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, getJwtSecret()) as { agentId: string };

        if (!decoded.agentId) {
            return res.status(401).json({ error: 'Token 无效' });
        }

        const agent = await Agent.findById(decoded.agentId);
        if (!agent) {
            return res.status(401).json({ error: '用户不存在' });
        }

        if (agent.status === 'frozen') {
            return res.status(403).json({ error: '账号已被冻结，请联系管理员' });
        }

        req.agentId = decoded.agentId;
        req.agent = agent;

        next();
    } catch (error) {
        if ((error as Error).name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token 已过期，请重新登录' });
        }
        if ((error as Error).name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Token 无效' });
        }
        console.error('[AgentAuth] Error:', error);
        return res.status(500).json({ error: '认证失败' });
    }
}

export function generateAgentToken(agentId: string): string {
    return jwt.sign(
        { agentId },
        getJwtSecret(),
        { expiresIn: '7d' }
    );
}
