import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Server } from 'http';

// ---------- 共享可变测试数据库 ----------
const db = vi.hoisted(() => ({
  projects: new Map<string, { _id: string; creatorId?: string; name?: string }>(),
  chars: new Map<string, { _id: string; projectId?: string }>(),
  eps: new Map<string, { _id: string; projectId?: string }>(),
  hists: new Map<string, { _id: string; projectId?: string }>(),
  pubs: new Map<string, { _id: string; projectId?: string }>(),
  tasks: new Map<string, { _id: string; creatorId?: string; projectId?: string }>(),
}));

const spies = vi.hoisted(() => ({
  projFindById: vi.fn(),
  projUpdate: vi.fn(),
  charFindById: vi.fn(),
  charUpdate: vi.fn(),
  epFindById: vi.fn(),
  epUpdate: vi.fn(),
  epUpsert: vi.fn(),
  histFindById: vi.fn(),
  publishFindOne: vi.fn(),
  publishCreate: vi.fn(),
  publishFindOneAndUpdate: vi.fn(),
  taskFindById: vi.fn(),
  batchRewrite: vi.fn(),
  taskPause: vi.fn(),
}));

function queryLike(doc: unknown) {
  const q: any = {
    select: () => q,
    lean: () => q,
    exec: () => Promise.resolve(doc),
    then: (f: any, r: any) => Promise.resolve(doc).then(f, r),
  };
  return q;
}

// ---------- mocks ----------
vi.mock('../src/middleware/creatorMiddleware', () => ({
  creatorAuth: (req: any, res: any, next: any) => {
    const h = req.headers['x-test-creator'];
    if (!h) return res.status(401).json({ success: false, error: '未登录' });
    const [id, role] = String(h).split(':');
    req.creatorId = id;
    req.creator = { _id: id, role: role || 'creator', username: id };
    next();
  },
  optionalCreatorAuth: (_req: any, _res: any, next: any) => next(),
  checkProjectQuota: (_req: any, _res: any, next: any) => next(),
  checkEpisodeQuota: (_req: any, _res: any, next: any) => next(),
  generateCreatorToken: () => 'fake-token',
  isAdmin: (req: any) => req.creator?.role === 'admin',
}));

vi.mock('../src/repositories', () => ({
  projectRepository: {
    findById: (id: string) => {
      spies.projFindById(id);
      return Promise.resolve(db.projects.get(String(id).toLowerCase()) ?? null);
    },
    update: (id: string, patch: unknown) => {
      spies.projUpdate(id, patch);
      return Promise.resolve({ _id: id, ...(patch as object) });
    },
  },
  characterRepository: {
    findById: (id: string) => Promise.resolve(db.chars.get(String(id).toLowerCase()) ?? null),
    findByProject: () => Promise.resolve([]),
    findAll: () => Promise.resolve([]),
    update: (id: string, patch: unknown) => {
      spies.charUpdate(id, patch);
      return Promise.resolve({ _id: id, ...(patch as object) });
    },
  },
  episodeRepository: {
    findById: (id: string) => Promise.resolve(db.eps.get(String(id).toLowerCase()) ?? null),
    update: (id: string, patch: unknown) => {
      spies.epUpdate(id, patch);
      return Promise.resolve({ _id: id, ...(patch as object) });
    },
    upsert: (pid: string, ep: number, data: unknown) => {
      spies.epUpsert(pid, ep, data);
      return Promise.resolve({ projectId: pid, episodeNumber: ep });
    },
  },
  foreshadowingRepository: {},
  worldStateRepository: {},
  generationLogRepository: {},
}));

vi.mock('../src/repositories/ForeshadowingRepository', () => ({
  foreshadowingRepository: {},
  ForeshadowingRepository: class {},
}));

vi.mock('../src/models/Project', () => ({
  Project: { findById: (id: string) => Promise.resolve(db.projects.get(String(id).toLowerCase()) ?? null) },
}));
vi.mock('../src/models/Character', () => ({
  Character: { findById: (id: string) => { spies.charFindById(id); return queryLike(db.chars.get(String(id).toLowerCase()) ?? null); } },
}));
vi.mock('../src/models/Episode', () => ({
  Episode: { findById: (id: string) => { spies.epFindById(id); return queryLike(db.eps.get(String(id).toLowerCase()) ?? null); } },
}));
vi.mock('../src/models/RewriteHistory', () => ({
  RewriteHistory: { findById: (id: string) => { spies.histFindById(id); return queryLike(db.hists.get(String(id).toLowerCase()) ?? null); } },
}));
vi.mock('../src/models/ProjectPublish', () => ({
  ProjectPublish: {
    findOne: (q: any) => { spies.publishFindOne(q); return Promise.resolve(db.pubs.get(String(q.projectId).toLowerCase()) ?? null); },
    create: (d: any) => { spies.publishCreate(d); return Promise.resolve({ _id: 'pub1', ...d }); },
    findOneAndUpdate: (q: any, u: any) => { spies.publishFindOneAndUpdate(q, u); return Promise.resolve({ _id: 'pub1' }); },
  },
}));
vi.mock('../src/models/BatchTask', () => ({
  BatchTask: { findById: (id: string) => { spies.taskFindById(id); return Promise.resolve(db.tasks.get(String(id).toLowerCase()) ?? null); } },
}));

// projectController 剩余重模型/服务桩
vi.mock('../src/models/Creator', () => ({ Creator: {} }));
vi.mock('../src/models/CharacterEnhancement', () => ({ CharacterEnhancement: {} }));
vi.mock('../src/models/CharacterRelationship', () => ({ CharacterRelationship: {} }));
vi.mock('../src/models/CharacterState', () => ({ CharacterState: {} }));
vi.mock('../src/models/WorldState', () => ({ WorldState: {} }));
vi.mock('../src/models/Outline', () => ({ Outline: {} }));
vi.mock('../src/models/EpisodeSummary', () => ({ EpisodeSummary: {} }));
vi.mock('../src/models/Foreshadowing', () => ({ Foreshadowing: {} }));
vi.mock('../src/models/ValidationReport', () => ({ ValidationReport: {} }));
vi.mock('../src/services/context/ContextManager', () => ({ ContextManager: class {} }));
vi.mock('../src/services/rewrite/RewriteService', () => ({
  RewriteService: class {
    constructor(_pid: string) {}
    batchRewrite = (...a: any[]) => spies.batchRewrite(...a);
  },
  RewriteType: { CONTENT: 'content' },
}));
vi.mock('../src/services/batch/BatchTaskExecutor', () => ({
  BatchTaskExecutor: class {
    pauseTask = (...a: any[]) => spies.taskPause(...a);
    static getInstance() { return new (class { pauseTask = (...a: any[]) => spies.taskPause(...a); })(); }
  },
}));

import projectController from '../src/controllers/projectController';
import publishController from '../src/controllers/publishController';
import characterController from '../src/controllers/characterController';
import episodeController from '../src/controllers/episodeController';
import rewriteController from '../src/controllers/rewriteController';
import taskManagerController from '../src/controllers/taskManagerController';
import { creatorAuth as fakeCreatorAuth } from '../src/middleware/creatorMiddleware';

// ---------- fixtures ----------
const P_OWN = 'aaaaaaaabbbbbbbbccccccc1';
const P_FOREIGN = 'aaaaaaaabbbbbbbbccccccc2';
const P_COLLIDE = 'ddddddddeeeeeeee99999999'; // 项目ID（与某资源ID同值）
const R_OWN = 'ddddddddeeeeeeee11111111';
const R_FOREIGN = 'ddddddddeeeeeeee22222222';
const T_LEGACY = 'eeeeeeeeffffffff11111111';

const U = 'u-own';
const U_ADMIN = 'root:admin';

let server: Server;
let port = 0;

function seed() {
  db.projects.set(P_OWN, { _id: P_OWN, creatorId: U, name: 'own' });
  db.projects.set(P_FOREIGN, { _id: P_FOREIGN, creatorId: 'u-other', name: 'other' });
  db.projects.set(P_COLLIDE, { _id: P_COLLIDE, creatorId: 'u-other' });
  db.chars.set(R_OWN, { _id: R_OWN, projectId: P_OWN });
  db.chars.set(R_FOREIGN, { _id: R_FOREIGN, projectId: P_FOREIGN });
  db.chars.set(P_COLLIDE, { _id: P_COLLIDE, projectId: P_OWN }); // 资源ID与某项目ID同值——绝不能当项目查
  db.eps.set(R_OWN, { _id: R_OWN, projectId: P_OWN });
  db.eps.set(R_FOREIGN, { _id: R_FOREIGN, projectId: P_FOREIGN });
  db.hists.set(R_OWN, { _id: R_OWN, projectId: P_OWN });
  db.tasks.set(T_LEGACY, { _id: T_LEGACY, projectId: P_OWN }); // 无 creatorId（legacy）
}

beforeEach(async () => {
  db.projects.clear(); db.chars.clear(); db.eps.clear();
  db.hists.clear(); db.pubs.clear(); db.tasks.clear();
  seed();
  vi.clearAllMocks();

  const app = express();
  app.use(express.json());
  app.use('/api/projects', projectController);
  app.use('/api/publish', publishController);
  app.use('/api/characters', characterController);
  app.use('/api/episodes', episodeController);
  app.use('/api/rewrite', rewriteController);
  // taskManager 的 creatorAuth 在 app 挂载层 —— 测试中等价地在挂载点注入
  app.use('/api/tasks', fakeCreatorAuth, taskManagerController);
  server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  port = (server.address() as { port: number }).port;
});

import { afterEach } from 'vitest';
afterEach(() => { server?.close(); });

async function call(method: string, path: string, opts: { auth?: string; body?: unknown } = {}) {
  const r = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(opts.auth ? { 'x-test-creator': opts.auth } : {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

const authU = { auth: U };
const authAdmin = { auth: U_ADMIN };

// ==================== projectController ====================
describe('projectController', () => {
  it('畸形路径ID => 400 且不查 repo', async () => {
    vi.clearAllMocks();
    const r = await call('get', '/api/projects/notanid', authU);
    expect(r.status).toBe(400);
    expect(spies.projFindById).not.toHaveBeenCalled();
  });

  it('变更属主被拒且不写库', async () => {
    const r = await call('put', `/api/projects/${P_OWN}`, { ...authU, body: { creatorId: 'u-other' } });
    expect(r.status).toBe(400);
    expect(spies.projUpdate).not.toHaveBeenCalled();
  });

  it('admin 编辑他人项目、属主不变 => 允许，且仅转发可变字段', async () => {
    const r = await call('put', `/api/projects/${P_FOREIGN}`, { ...authAdmin, body: { name: 'renamed', creatorId: 'u-other' } });
    expect(r.status).toBe(200);
    expect(spies.projUpdate).toHaveBeenCalledTimes(1);
    expect(spies.projUpdate).toHaveBeenCalledWith(P_FOREIGN, { name: 'renamed' });
  });

  it('操作符 patch => 400', async () => {
    const r = await call('put', `/api/projects/${P_OWN}`, { ...authU, body: { $set: { name: 'x' } } });
    expect(r.status).toBe(400);
    expect(spies.projUpdate).not.toHaveBeenCalled();
  });
});

// ==================== publishController ====================
describe('publishController', () => {
  it('匿名 401 / 他人项目 403（无配置读写）/ 属主 200', async () => {
    expect((await call('get', `/api/publish/${P_OWN}`)).status).toBe(401);
    expect(spies.publishFindOne).not.toHaveBeenCalled();
    expect(spies.publishCreate).not.toHaveBeenCalled();

    expect((await call('get', `/api/publish/${P_FOREIGN}`, authU)).status).toBe(403);
    expect(spies.publishFindOne).not.toHaveBeenCalled();
    expect(spies.publishCreate).not.toHaveBeenCalled();

    const ok = await call('get', `/api/publish/${P_OWN}`, authU);
    expect(ok.status).toBe(200);
    expect(spies.publishFindOne).toHaveBeenCalledTimes(1);
  });
});

// ==================== characterController ====================
describe('characterController', () => {
  it('PUT /:id 剥离 _id/projectId 并仅转发剩余字段', async () => {
    const r = await call('put', `/api/characters/${R_OWN}`, { ...authU, body: { _id: R_FOREIGN, projectId: P_OWN, name: 'n' } });
    expect(r.status).toBe(200);
    expect(spies.charUpdate).toHaveBeenCalledWith(R_OWN, { name: 'n' });
    // body.projectId 与资源实际归属冲突 => 400
    const bad = await call('put', `/api/characters/${R_OWN}`, { ...authU, body: { projectId: P_FOREIGN, name: 'n' } });
    expect(bad.status).toBe(400);
    expect(spies.charUpdate).toHaveBeenCalledTimes(1);
  });

  it('PUT /:id 带 $set/点键 => 400 不写库', async () => {
    for (const body of [{ $set: { name: 'x' } }, { 'a.b': 1 }]) {
      const r = await call('put', `/api/characters/${R_OWN}`, { ...authU, body });
      expect(r.status).toBe(400);
    }
    expect(spies.charUpdate).not.toHaveBeenCalled();
  });
});

// ==================== episodeController ====================
describe('episodeController', () => {
  it('PUT /:id 剥离不可变字段', async () => {
    const r = await call('put', `/api/episodes/${R_OWN}`, { ...authU, body: { projectId: P_OWN, episodeNumber: 99, content: 'c' } });
    expect(r.status).toBe(200);
    expect(spies.epUpdate).toHaveBeenCalledWith(R_OWN, { content: 'c' });
  });

  it('upsert 路由身份为准：body projectId/episodeNumber 剥离', async () => {
    const r = await call('put', `/api/episodes/project/${P_OWN}/number/3`, { ...authU, body: { projectId: P_OWN, episodeNumber: 8, content: 'c' } });
    expect(r.status).toBe(200);
    expect(spies.epUpsert).toHaveBeenCalledWith(P_OWN, 3, { content: 'c' });
    const bad = await call('put', `/api/episodes/project/${P_OWN}/number/3`, { ...authU, body: { projectId: P_FOREIGN, content: 'c' } });
    expect(bad.status).toBe(400);
    expect(spies.epUpsert).toHaveBeenCalledTimes(1);
  });
});

// ==================== rewriteController ====================
describe('rewriteController /batch', () => {
  it('混入他人 episodeIds => 400 且不进入 RewriteService', async () => {
    const r = await call('post', '/api/rewrite/batch', {
      ...authU,
      body: { projectId: P_OWN, episodeIds: [R_OWN, R_FOREIGN], instruction: 'x' },
    });
    expect(r.status).toBe(400);
    expect(spies.batchRewrite).not.toHaveBeenCalled();
  });

  it('数组元素缺失/非法 => 400', async () => {
    const r = await call('post', '/api/rewrite/batch', {
      ...authU,
      body: { projectId: P_OWN, episodeIds: [R_OWN, null], instruction: 'x' },
    });
    expect(r.status).toBe(400);
    expect(spies.batchRewrite).not.toHaveBeenCalled();
  });

  it('标量数组：全同项目 => 通过 guard（batchRewrite 被调用）', async () => {
    spies.batchRewrite.mockResolvedValueOnce({ results: [] });
    const r = await call('post', '/api/rewrite/batch', {
      ...authU,
      body: { projectId: P_OWN, episodeIds: [R_OWN], instruction: 'x' },
    });
    expect(r.status).not.toBe(400);
    expect(spies.batchRewrite).toHaveBeenCalledTimes(1);
  });
});

// ==================== taskManagerController ====================
describe('taskManagerController', () => {
  it('legacy 无 creatorId 任务：普通用户 403 / admin 放行', async () => {
    const r = await call('get', `/api/tasks/${T_LEGACY}`, authU);
    expect(r.status).toBe(403);
    const ok = await call('get', `/api/tasks/${T_LEGACY}`, authAdmin);
    expect(ok.status).toBe(200);
  });
});

// ==================== helper 边界 ====================
describe('guard 边界', () => {
  it('资源ID与无关项目ID同值时，不当作项目探测', async () => {
    // ROWN == P_COLLIDE 的场景：资源 id 恰好等于一个别的项目的 _id
    const before = spies.projFindById.mock.calls.length;
    const r = await call('put', `/api/characters/${P_COLLIDE}`, { ...authU, body: { name: 'x' } });
    // guard 用 Character.findById 查资源 => actual=P_OWN => 授权 P_OWN 一次；
    // P_COLLIDE 不应被 projectRepository.findById 探测
    const probed = spies.projFindById.mock.calls.slice(before).map(c => String(c[0]));
    expect(r.status).toBe(200);
    expect(probed).toContain(P_OWN);
    expect(probed).not.toContain(P_COLLIDE);
  });

  it('主路径 projectId 畸形 => 在任何项目/资源查询前 400', async () => {
    vi.clearAllMocks();
    const r = await call('get', '/api/episodes/project/bad-id/number/1', authU);
    expect(r.status).toBe(400);
    expect(spies.projFindById).not.toHaveBeenCalled();
    expect(spies.epFindById).not.toHaveBeenCalled();
  });

  it('项目查询异常 => 500 不被吞掉', async () => {
    spies.projFindById.mockImplementationOnce(() => { throw new Error('db down'); });
    const r = await call('get', `/api/publish/${P_OWN}`, authU);
    expect(r.status).toBe(500);
  });

  it('query projectId 大小写别名指向同一项目 => 200', async () => {
    const r = await call('get', `/api/characters?projectId=${P_OWN.toUpperCase()}`, authU);
    expect(r.status).toBe(200);
  });
});
