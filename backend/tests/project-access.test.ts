import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Server } from 'http';

// 假认证：用 x-test-creator 头注入身份（策略单测）
vi.mock('../src/middleware/creatorMiddleware', () => ({
  creatorAuth: (req: any, res: any, next: any) => {
    const h = req.headers['x-test-creator'];
    if (!h) return res.status(401).json({ success: false, error: '未登录' });
    const [id, role] = String(h).split(':');
    req.creatorId = id;
    req.creator = { _id: id, role: role || 'creator' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  generateCreatorToken: () => 'fake',
}));

import { protectProjectRouter } from '../src/middleware/projectAccess';
import { projectRepository } from '../src/repositories';

const P_OWN = 'aaaaaaaabbbbbbbbccccccc1';
const P_OWN_U = P_OWN.toUpperCase(); // 同一项目的大小写变体
const P_FOREIGN = 'aaaaaaaabbbbbbbbccccccc2';
const P_LEGACY = 'aaaaaaaabbbbbbbbccccccc3'; // 无 creatorId
const P_MISSING = 'aaaaaaaabbbbbbbbccccccc4';
const R_OWN_EP = 'ddddddddeeeeeeee11111111';
const R_FOREIGN_EP = 'ddddddddeeeeeeee22222222';
const R_MISSING = 'ddddddddeeeeeeee33333333';

const PROJECTS: Record<string, { creatorId?: string }> = {
  // 键一律小写（模拟 ObjectId 规范化）
  [P_OWN]: { creatorId: 'u-own' },
  [P_FOREIGN]: { creatorId: 'u-other' },
  [P_LEGACY]: {},
};
const RESOURCES: Record<string, { projectId?: string }> = {
  [R_OWN_EP]: { projectId: P_OWN },
  [R_FOREIGN_EP]: { projectId: P_FOREIGN },
};

const fakeLoader = (id: string) =>
  Promise.resolve(RESOURCES[id] === undefined ? null : { projectId: RESOURCES[id].projectId });

let app: express.Express;
const hits: string[] = [];

function build() {
  hits.length = 0;
  vi.clearAllMocks();
  vi.spyOn(projectRepository, 'findById').mockImplementation(async (id: string) => {
    // 模拟真实 ObjectId 语义：hex 大小写不敏感
    const p = PROJECTS[String(id).toLowerCase()];
    return (p === undefined ? null : { _id: id, ...p }) as never;
  });
  app = express();
  app.use(express.json());
  const router = express.Router();
  protectProjectRouter(router, {
    params: { id: fakeLoader },
    references: { resourceId: fakeLoader },
    arrays: { items: { idField: 'rid', load: fakeLoader } },
  });
  router.get('/p', (_req, res) => { hits.push('p'); res.json({ ok: 1 }); });
  router.post('/op', (_req, res) => { hits.push('op'); res.json({ ok: 1 }); });
  router.get('/r/:id', (_req, res) => { hits.push('r'); res.json({ ok: 1 }); });
  router.get('/by-project/:projectId', (_req, res) => { hits.push('bp'); res.json({ ok: 1 }); });
  router.post('/by-project/:projectId/op', (_req, res) => { hits.push('bpo'); res.json({ ok: 1 }); });
  app.use(router);
}

beforeEach(build);

async function call(method: 'get' | 'post', path: string, opts: { auth?: string; body?: unknown } = {}) {
  const server: Server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
  const port = (server.address() as { port: number }).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(opts.auth ? { 'x-test-creator': opts.auth } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  } finally {
    server.close();
  }
}

describe('projectAccess 主项目授权', () => {
  it('匿名 => 401（无任何 repo 调用）', async () => {
    const r = await call('get', '/p?projectId=' + P_OWN);
    expect(r.status).toBe(401);
    expect(projectRepository.findById).not.toHaveBeenCalled();
  });

  it('所有者 => 200', async () => {
    const r = await call('get', '/p?projectId=' + P_OWN, { auth: 'u-own' });
    expect(r.status).toBe(200);
  });

  it('非所有者 => 403', async () => {
    const r = await call('get', '/p?projectId=' + P_FOREIGN, { auth: 'u-own' });
    expect(r.status).toBe(403);
  });

  it('未绑定历史项目：普通用户403 / admin 200', async () => {
    expect((await call('get', '/p?projectId=' + P_LEGACY, { auth: 'u-own' })).status).toBe(403);
    expect((await call('get', '/p?projectId=' + P_LEGACY, { auth: 'anyone:admin' })).status).toBe(200);
  });

  it('非法ID（过短/对象/$操作符/数组）=> 400 且查询前拒绝', async () => {
    vi.clearAllMocks();
    expect((await call('get', '/p?projectId=abc', { auth: 'u-own' })).status).toBe(400);
    expect((await call('post', '/op', { auth: 'u-own', body: { projectId: { $gt: '' } } })).status).toBe(400);
    expect((await call('post', '/op', { auth: 'u-own', body: { projectId: [P_OWN] } })).status).toBe(400);
    expect((await call('get', '/p?projectId=' + encodeURIComponent(' ' + P_OWN + ' '), { auth: 'u-own' })).status).toBe(400);
    expect(projectRepository.findById).not.toHaveBeenCalled();
  });

  it('缺失项目 => 404；查询异常 => 500', async () => {
    expect((await call('get', '/p?projectId=' + P_MISSING, { auth: 'u-own' })).status).toBe(404);
    vi.mocked(projectRepository.findById).mockRejectedValueOnce(new Error('db down'));
    expect((await call('get', '/p?projectId=' + P_OWN, { auth: 'u-own' })).status).toBe(500);
  });

  it('大小写不同的24hex指向同一项目（授权缓存共享，不冲突）', async () => {
    const r = await call('post', '/op', { auth: 'u-own', body: { projectId: P_OWN_U } });
    expect(r.status).toBe(200);
  });

  it('body/query 声明冲突 => 400', async () => {
    const r = await call('post', '/op?projectId=' + P_OWN, { auth: 'u-own', body: { projectId: P_FOREIGN } });
    expect(r.status).toBe(400);
  });
});

describe('projectAccess 资源授权', () => {
  it('资源路径：属主资源放行 / 他人资源 403 / 缺失 404 / 非法 400', async () => {
    expect((await call('get', `/r/${R_OWN_EP}`, { auth: 'u-own' })).status).toBe(200);
    expect((await call('get', `/r/${R_FOREIGN_EP}`, { auth: 'u-own' })).status).toBe(403);
    expect((await call('get', `/r/${R_MISSING}`, { auth: 'u-own' })).status).toBe(404);
    expect((await call('get', '/r/notanid', { auth: 'u-own' })).status).toBe(400);
  });

  it('伪造：自有项目 + 他人资源 => 400（资源实际归属不符）', async () => {
    const r = await call('post', '/op', { auth: 'u-own', body: { projectId: P_OWN, resourceId: R_FOREIGN_EP } });
    expect(r.status).toBe(400);
  });

  it('仅资源（无主 projectId）：属主资源放行', async () => {
    const r = await call('post', '/op', { auth: 'u-own', body: { resourceId: R_OWN_EP } });
    expect(r.status).toBe(200);
  });

  it('path projectId 与 body resourceId 归属冲突 => 400', async () => {
    const r = await call('post', `/by-project/${P_OWN}/op`, { auth: 'u-own', body: { resourceId: R_FOREIGN_EP } });
    expect(r.status).toBe(400);
    expect(hits).toEqual([]); // handler 未执行
  });

  it('数组逐项校验：第二个元素属于他人 => 400 且 handler 未执行', async () => {
    const r = await call('post', '/op', {
      auth: 'u-own',
      body: { items: [{ rid: R_OWN_EP }, { rid: R_FOREIGN_EP }] },
    });
    expect(r.status).toBe(400);
    expect(hits).toEqual([]);
  });

  it('数组全部同项目 => 200', async () => {
    const r = await call('post', '/op', {
      auth: 'u-own',
      body: { projectId: P_OWN, items: [{ rid: R_OWN_EP }] },
    });
    expect(r.status).toBe(200);
  });
});
