import { describe, it, expect, vi, beforeAll } from 'vitest';

// 共享前端 SSE 核心（纯 TS，node 可测）
import { SSEFrameParser, consumeSSEReader } from '../../frontend/src/services/sseCore';
import { normalizeApiBase, humanizeError, formatHttpError, SSEClientError } from '../../frontend/src/services/apiConfig';

function enc(s: string) { return new TextEncoder().encode(s); }
function fakeReader(chunks: string[]) {
  let i = 0;
  return {
    read: async () => i < chunks.length ? { done: false, value: enc(chunks[i++]) } : { done: true },
    cancel: async () => { i = chunks.length; },
  };
}

describe('SSEFrameParser', () => {
  it('处理 CRLF/注释/无空格冒号/多行data/碎块', () => {
    const p = new SSEFrameParser();
    let evs = p.feed('event: chunk\r\ndata: {"a":1\r\n\r\n: hb\n\ndata:{"b":2}');
    evs = evs.concat(p.feed('\n\nda'));
    evs = evs.concat(p.feed('ta: x\ndata: y\n\n'));
    expect(evs[0]).toEqual({ event: 'chunk', data: '{"a":1' });
    expect(evs[1].data).toBe('{"b":2}');
    expect(evs[2].data).toBe('x\ny');
    expect(p.flush()).toEqual([]);
  });
});

describe('consumeSSEReader', () => {
  it('done 恰好一次完成', async () => {
    const events: string[] = [];
    let done = 0;
    const r = await consumeSSEReader(fakeReader([
      'data: {"type":"start"}\n\n', 'data: {"type":"done","x":1}\n\n',
    ]), { terminalEvents: ['done'], onEvent: t => { events.push(t); }, onTerminal: () => { done++; } });
    expect(r.status).toBe('done'); expect(done).toBe(1); expect(events).toEqual(['start']);
  });
  it('EOF 无 done => 连接中断', async () => {
    let msg = '';
    const r = await consumeSSEReader(fakeReader(['data: {"type":"chunk","content":"x"}\n\n']),
      { terminalEvents: ['done'], onError: e => { msg = e.message; } });
    expect(r.status).toBe('error');
    expect(msg).toContain('连接中断');
  });
  it('error 事件 => 一次 onError，无 done', async () => {
    let errs = 0, done = 0;
    const r = await consumeSSEReader(fakeReader([
      'data: {"type":"error","message":"炸了","requestId":"r1"}\n\n',
      'data: {"type":"done"}\n\n',
    ]), { terminalEvents: ['done'], onError: () => errs++, onTerminal: () => done++ });
    expect(r.status).toBe('error'); expect(errs).toBe(1); expect(done).toBe(0);
  });
  it('rewrite: complete 非终止，result 才是终止；且恰好一次成功', async () => {
    let done = 0; let resultData: any = null;
    const r = await consumeSSEReader(fakeReader([
      'data: {"type":"complete","text":"全文"}\n\n',
      'data: {"type":"result","historyId":"h9"}\n\n',
    ]), { terminalEvents: ['result'], onTerminal: (_t, d) => { done++; resultData = d; } });
    expect(r.status).toBe('done'); expect(done).toBe(1); expect((resultData as any).historyId).toBe('h9');
  });
  it('interim complete 后持久化错误 => error 非成功', async () => {
    const r = await consumeSSEReader(fakeReader([
      'data: {"type":"complete","text":"x"}\n\n',
      'data: {"type":"error","error":"保存失败"}\n\n',
    ]), { terminalEvents: ['result'] });
    expect(r.status).toBe('error');
  });
  it('回调异常不被吞为解析错误', async () => {
    let kind = '';
    const r = await consumeSSEReader(fakeReader(['data: {"type":"x"}\n\n']), {
      terminalEvents: ['done'],
      onEvent: () => { throw new Error('cb-boom'); },
      onError: e => { kind = (e as any).kind; },
    });
    expect(r.status).toBe('error'); expect(kind).toBe('callback');
  });
  it('JSON 解析错误为 parse 类', async () => {
    let kind = '';
    const r = await consumeSSEReader(fakeReader(['data: {bad json\n\n']), {
      terminalEvents: ['done'], onError: e => { kind = (e as any).kind; } });
    expect(r.status).toBe('error'); expect(kind).toBe('parse');
  });
  it('主动 abort 静默', async () => {
    const c = new AbortController(); c.abort();
    const r = await consumeSSEReader(fakeReader(['data: {"type":"x"}\n\n']),
      { terminalEvents: ['done'], signal: c.signal, onError: () => { throw new Error('不应调用'); } });
    expect(r.status).toBe('aborted');
  });
});

describe('apiConfig', () => {
  it('normalizeApiBase', () => {
    expect(normalizeApiBase(undefined)).toBe('/api');
    expect(normalizeApiBase(' http://x/api/ ')).toBe('http://x/api');
    expect(normalizeApiBase('')).toBe('/api');
  });
  it('humanizeError 不输出裸 network error', () => {
    expect(humanizeError(new Error('Network Error'))).not.toMatch(/network error/i);
    expect(humanizeError(new TypeError('Failed to fetch'))).toContain('网络连接失败');
  });
  it('formatHttpError 解析 JSON 错误体', () => {
    expect(formatHttpError(401, '{"error":"token无效"}').message).toContain('token无效');
    expect(formatHttpError(500, '').message).toContain('500');
  });
});

// ---- v2 回归：人性化/解析器/预中止 ----
import { parseOutlineText } from '../../frontend/src/services/outlineParse';

describe('humanizeError v2', () => {
  it('中文服务端消息原样保留（不再被翻译成网络异常）', () => {
    const err = new SSEClientError('server', '无权访问此项目');
    expect(humanizeError(err)).toBe('无权访问此项目');
  });
  it('requestId 只追加一次；已带后缀的不重复', () => {
    const e1 = new SSEClientError('server', '保存失败', undefined, { requestId: 'R1' });
    expect(humanizeError(e1)).toBe('保存失败（请求ID: R1）');
    const e2 = new SSEClientError('server', '保存失败（请求ID: R1）', undefined, { requestId: 'R1' });
    expect(humanizeError(e2)).toBe('保存失败（请求ID: R1）');
  });
  it('字符串输入与裸网络错误', () => {
    expect(humanizeError('Failed to fetch')).toContain('网络连接失败');
    expect(humanizeError('权限不足')).toBe('权限不足');
  });
});

describe('parseOutlineText', () => {
  it('标准 ## 三章不算增强；不被误判为5步', () => {
    const r = parseOutlineText('## 人物卡\n甲。\n## 剧情大纲\n乙。\n## 分集梗概\n丙。');
    expect(r.enhanced).toBe(false);
    expect(r.characterCards).toBe('甲。');
    expect(r.episodeSummaries).toBe('丙。');
  });
  it('增强需内核/功能标题；嵌套 ### 保留在所属章节', () => {
    const r = parseOutlineText('## 故事内核\n核心。\n## 角色功能\n### 子标题\n功能。\n## 人物卡\n卡。');
    expect(r.enhanced).toBe(true);
    expect(r.characterFunctions).toContain('### 子标题');
  });
  it('标准 ### 编号 + 末段取到文末（含分集梗概全量）', () => {
    const r = parseOutlineText('### 一、人物卡\n卡。\n### 二、剧情大纲\n纲。\n### 三、分集梗概\n第1集：甲\n第2集：乙\n结尾。');
    expect(r.episodeSummaries).toContain('结尾。');
    expect(r.enhanced).toBe(false);
  });
  it('旧式【】与 CRLF', () => {
    const r = parseOutlineText('【人物卡】\r\n卡。\r\n【剧情大纲】\r\n纲。\r\n【分集梗概】\r\n尾。');
    expect(r.synopsis).toBe('纲。');
    expect(r.episodeSummaries).toBe('尾。');
  });
});

describe('consumeSSEReader 预取消', () => {
  it('预中止信号：不 read、不回调成功，释放 reader', async () => {
    const ac = new AbortController();
    ac.abort();
    let reads = 0; let cancelled = false; let released = false;
    const reader = {
      read: () => { reads++; return new Promise(() => {}); },
      cancel: () => { cancelled = true; return Promise.resolve(); },
      releaseLock: () => { released = true; },
    };
    const r = await consumeSSEReader(reader as never, { signal: ac.signal });
    expect(r.status).toBe('aborted');
    expect(reads).toBe(0);
    expect(cancelled).toBe(true);
    expect(released).toBe(true);
  });
});
