/**
 * 项目级授权中间件：统一 creatorAuth + 主项目归属 + 资源参数/引用归属校验。
 *
 * 实现：包装 router.route()，为每个随后声明的路由在 handler 之前注入
 * route.all(guard)。guard 执行时已拿到完整 req.params，可精确校验：
 * - 原始 ID 必须是精确 24 位十六进制字符串（显式 null/数组/对象/空白 => 400，
 *   undefined 视为未提供）
 * - 主项目：params/body/query 的 projectId => findById => admin 或 owner；
 *   无 creatorId 的历史项目仅 admin；无身份 401；缺失 404；查询异常 500
 * - 资源：加载真实文档后授权其 projectId（绝不信任客户端提交的项目字段）
 * - 单请求多处声明 projectId 必须一致；资源实际归属与声明不一致 => 400
 * - 授权结果按请求缓存于 res.locals（键小写规范化，同 ObjectId 大小写不冲突）
 */
import { Router, Request, Response, NextFunction } from 'express';
import { projectRepository } from '../repositories';
import { creatorAuth } from './creatorMiddleware';

export type ResourceLoader = (id: string) => Promise<{ projectId?: unknown } | null>;

export interface ProtectOptions {
  /** 路径参数名 => 资源加载器（如 { id: Character.findById }） */
  params?: Record<string, ResourceLoader>;
  /** body/query 同名字段 => 资源加载器（如 { episodeId: Episode.findById }） */
  references?: Record<string, ResourceLoader>;
  /** body 数组字段 => 元素 id 字段 + 资源加载器；省略 idField 表示标量 ID 数组 */
  arrays?: Record<string, { idField?: string; load: ResourceLoader }>;
}

const RAW_ID_RE = /^[0-9a-fA-F]{24}$/;
const INVALID_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function fail(res: Response, req: Request, status: number, error: string): void {
  res.status(status).json({ success: false, error, requestId: req.requestId });
}

function isValidRawId(v: unknown): v is string {
  return typeof v === 'string' && RAW_ID_RE.test(v);
}

/** admin 判断（供控制器复用，如无 projectId 的全局列表仅 admin） */
export function isAdminRequest(req: Request): boolean {
  return req.creator?.role === 'admin';
}

interface ProjectLike { creatorId?: unknown }

function authCache(res: Response): Map<string, boolean> {
  if (!res.locals.__projectAuthCache) res.locals.__projectAuthCache = new Map<string, boolean>();
  return res.locals.__projectAuthCache;
}

/**
 * 校验原始 ID 并授权其指向的项目。合法且已授权 => true；否则已写响应 => false。
 * 无身份在任何 DB 查询前拒绝。
 */
export async function authorizeProject(req: Request, res: Response, rawId: unknown): Promise<boolean> {
  if (!isValidRawId(rawId)) {
    fail(res, req, 400, '无效的项目ID');
    return false;
  }
  const key = rawId.toLowerCase(); // 24-hex 大小写变体指向同一 ObjectId
  const cache = authCache(res);
  if (cache.get(key)) return true;

  if (!req.creatorId) {
    fail(res, req, 401, '未登录，请先登录');
    return false;
  }
  let project: ProjectLike | null;
  try {
    project = await projectRepository.findById(rawId) as ProjectLike | null;
  } catch (error) {
    fail(res, req, 500, `项目查询失败: ${(error as Error).message}`);
    return false;
  }
  if (!project) {
    fail(res, req, 404, '项目不存在');
    return false;
  }
  if (isAdminRequest(req)) {
    cache.set(key, true);
    return true;
  }
  const ownerId = project.creatorId ? String(project.creatorId) : null;
  if (!ownerId || ownerId !== req.creatorId) {
    fail(res, req, 403, '无权访问此项目');
    return false;
  }
  cache.set(key, true);
  return true;
}

interface PendingResource {
  loader: ResourceLoader;
  rawId: string;
  label: string;
}

/**
 * 安装保护：creatorAuth -> 路由级 guard（完整 params 可用）。
 * 无 projectId 的路由仅要求登录。
 */
export function protectProjectRouter(router: Router, options: ProtectOptions = {}): void {
  router.use(creatorAuth);

  const guard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // ---- 阶段1：收集并验证所有原始 ID（任何 DB 调用前；无项目引用则仅登录放行）----
      const declared: string[] = [];
      const resources: PendingResource[] = [];

      for (const src of [req.params?.projectId, req.body?.projectId, req.query?.projectId]) {
        if (src === undefined) continue;
        if (!isValidRawId(src)) { fail(res, req, 400, '无效的项目ID'); return; }
        declared.push(src);
      }
      for (const [name, loader] of Object.entries(options.params || {})) {
        if (name === 'projectId') continue; // projectId 自身已作为主声明
        const raw = req.params?.[name];
        if (raw === undefined) continue;
        if (!isValidRawId(raw)) { fail(res, req, 400, `无效的${name}ID`); return; }
        resources.push({ loader, rawId: raw, label: name });
      }
      for (const [field, loader] of Object.entries(options.references || {})) {
        for (const src of [req.body?.[field], req.query?.[field]]) {
          if (src === undefined) continue;
          if (!isValidRawId(src)) { fail(res, req, 400, `无效的${field}ID`); return; }
          resources.push({ loader, rawId: src, label: field });
        }
      }
      for (const [field, cfg] of Object.entries(options.arrays || {})) {
        const arr = req.body?.[field];
        if (arr === undefined) continue;
        if (!Array.isArray(arr)) { fail(res, req, 400, `无效的${field}`); return; }
        for (const el of arr) {
          const rawId = cfg.idField ? el?.[cfg.idField] : el; // 无 idField 时元素本身为 ID
          if (!isValidRawId(rawId)) { fail(res, req, 400, `无效的${field}元素ID`); return; }
          resources.push({ loader: cfg.load, rawId, label: `${field}` });
        }
      }

      if (declared.length === 0 && resources.length === 0) {
        next(); // 无项目相关声明/资源：仅要求已认证
        return;
      }

      // ---- 阶段2：声明一致性（同对象的多处声明必须指向同一项目）----
      const declaredCanon = new Set(declared.map((d) => d.toLowerCase()));
      if (declaredCanon.size > 1) {
        fail(res, req, 400, '请求中的项目ID不一致');
        return;
      }

      // ---- 阶段3：加载资源，追踪实际归属，冲突 => 400 ----
      const actualCanon = new Set<string>();
      const projectIdsToAuth = new Map<string, string>(); // canon -> raw
      for (const id of declared) projectIdsToAuth.set(id.toLowerCase(), id);

      for (const r of resources) {
        let doc: { projectId?: unknown } | null;
        try {
          doc = await r.loader(r.rawId);
        } catch (error) {
          fail(res, req, 500, `${r.label}查询失败: ${(error as Error).message}`);
          return;
        }
        if (!doc) {
          fail(res, req, 404, `${r.label}不存在`);
          return;
        }
        const actual = doc.projectId ? String(doc.projectId) : null;
        if (!actual) {
          fail(res, req, 400, `${r.label}缺少项目归属`);
          return;
        }
        const canon = actual.toLowerCase();
        if (declaredCanon.size && !declaredCanon.has(canon)) {
          fail(res, req, 400, '资源不属于指定项目');
          return;
        }
        actualCanon.add(canon);
        if (actualCanon.size > 1) {
          fail(res, req, 400, '请求涉及多个项目的资源');
          return;
        }
        projectIdsToAuth.set(canon, actual);
      }

      // ---- 阶段4：授权去重后的项目 ID ----
      for (const raw of projectIdsToAuth.values()) {
        if (!(await authorizeProject(req, res, raw))) return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };

  // 包装 router.route：每个随后声明的路由先注入 guard（此时 req.params 已解析）
  const originalRoute = router.route.bind(router);
  router.route = ((path: string) => {
    const route = originalRoute(path);
    route.all(guard);
    return route;
  }) as typeof router.route;
}

/**
 * 校验并构建安全的更新 patch：拒绝非对象/数组 body 与
 * 顶层操作符/点路径/原型键；剥离不可变字段。非法 => null。
 */
export function buildSafePatch(body: unknown, stripFields: string[]): Record<string, unknown> | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    if (k.startsWith('$') || k.includes('.') || INVALID_KEYS.has(k)) return null;
    if (stripFields.includes(k)) continue;
    out[k] = v;
  }
  return out;
}
