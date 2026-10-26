import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
    namespace Express {
        interface Request {
            requestId?: string;
        }
    }
}

/**
 * 请求诊断中间件：
 * - 为每个请求分配 X-Request-ID（响应头 + req.requestId，供 SSE 错误透传）
 * - 记录开始/完成/中断日志（方法、不含 query 的路径、状态码、耗时；不记录敏感载荷）
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
    const requestId = randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    const startedAt = Date.now();
    const { method } = req;
    const path = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path; // 不含 query（query 可能带 token）

    console.log(`[REQ ${requestId}] ${new Date().toISOString()} → ${method} ${path}`);

    let finished = false;
    res.on('finish', () => {
        finished = true;
        console.log(`[REQ ${requestId}] ${new Date().toISOString()} ← ${method} ${path} ${res.statusCode} ${Date.now() - startedAt}ms`);
    });
    res.on('close', () => {
        if (!finished) {
            console.log(`[REQ ${requestId}] ${new Date().toISOString()} ✗ ${method} ${path} aborted after ${Date.now() - startedAt}ms`);
        }
    });

    next();
}
