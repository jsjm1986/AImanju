import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';

// 强制 openai 通道：fixture 仅配置 deepseek（provider: openai）
process.env.DEEPSEEK_API_KEY = 'test-key';
process.env.DEEPSEEK_API_BASE_URL = 'http://fixture.local';
process.env.DEEPSEEK_MODEL = 'deepseek-chat';

import { aiClient, withModel } from '../src/services/ai/AIClient';

const enc = (s: string) => new TextEncoder().encode(s);

function sseBody(frames: string[]): () => ReadableStream<Uint8Array> {
  return () => new ReadableStream({
    start(c) {
      for (const f of frames) c.enqueue(enc(f));
      c.close();
    },
  });
}

function mockFetchOnce(body: (() => ReadableStream) | object, status = 200) {
  return vi.fn().mockImplementation(async () => new Response(
    typeof body === 'function' ? body() : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': typeof body === 'function' ? 'text/event-stream' : 'application/json' },
    })
  );
}

const delta = (content: string, finish: string | null = null) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: finish }] })}\n\n`;

const realWrite = fs.writeFileSync.bind(fs);
beforeEach(() => {
  vi.stubEnv('GLM_NIGHT_API_KEY', 'test-glm-key');
  vi.stubEnv('GLM_NIGHT_API_BASE_URL', 'http://fixture-glm.local/v4');
  vi.stubEnv('GLM_NIGHT_MODEL', 'fixture-glm');
  vi.spyOn(fs, 'writeFileSync').mockImplementation((...args) => {
    if (String(args[0]).endsWith('.ai-model.json')) return;
    return realWrite(...args);
  });
  aiClient.switchModel('deepseek-chat');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('上游 OpenAI SSE 流', () => {
  it('正常 UTF-8 + [DONE] 成功', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(sseBody([
      delta('你好'), delta('世界', 'stop'), 'data: [DONE]\n\n',
    ])));
    const chunks: string[] = [];
    const r = await aiClient.generateStream('s', 'u', { onChunk: t => chunks.push(t) });
    expect(r).toBe('你好世界');
    expect(chunks.join('')).toBe('你好世界');
  });

  it('EOF 无终止标记 => 失败', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(sseBody([delta('x')])));
    await expect(aiClient.generateStream('s', 'u', {})).rejects.toThrow('结束标记');
  });

  it('provider error 帧 => 失败', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(sseBody([
      `data: ${JSON.stringify({ error: { message: 'provider boom' } })}\n\n`,
    ])));
    await expect(aiClient.generateStream('s', 'u', {})).rejects.toThrow('provider boom');
  });

  it('finish_reason length => 明确截断失败（不重试）', async () => {
    const f = mockFetchOnce(sseBody([delta('部分', 'length')]));
    vi.stubGlobal('fetch', f);
    await expect(aiClient.generateStream('s', 'u', {})).rejects.toThrow('截断');
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('已发内容后失败 => 仅一次请求，不重复追加', async () => {
    const part1 = '第一次已经发给消费者的部分内容，长度必须超过二十字才会下发';
    const f = vi.fn()
      .mockImplementationOnce(async () => new Response(sseBody([delta(part1)])(), { status: 200 }))
      .mockImplementation(async () => new Response(sseBody([delta('RETRY-RETRY-RETRY-RETRY-x', 'stop'), 'data: [DONE]\n\n'])(), { status: 200 }));
    // 流在发完内容后 EOF 无终止 => 非重试错误
    vi.stubGlobal('fetch', f);
    const chunks: string[] = [];
    await expect(aiClient.generateStream('s', 'u', { onChunk: t => chunks.push(t) }))
      .rejects.toThrow('结束标记');
    expect(f).toHaveBeenCalledTimes(1);
    expect(chunks.join('')).toBe(part1); // 无重复追加
  });

  it('发出内容前的可重试错误可恢复且不误报 onError', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(new Response('x', { status: 500 }))
      .mockImplementation(async () => new Response(sseBody([delta('ok', 'stop'), 'data: [DONE]\n\n'])(), { status: 200 }));
    vi.stubGlobal('fetch', f);
    let errs = 0;
    const r = await aiClient.generateStream('s', 'u', { onError: () => errs++ });
    expect(r).toBe('ok');
    expect(errs).toBe(0); // 仅终态失败才调 onError
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('仅思考内容（reasoning）=> 明确失败', async () => {
    const f = mockFetchOnce(sseBody([
      `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: 'hmm' }, finish_reason: 'stop' }] })}\n\n`,
      'data: [DONE]\n\n',
    ]));
    vi.stubGlobal('fetch', f);
    await expect(aiClient.generateStream('s', 'u', {})).rejects.toThrow('有效内容');
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('onComplete 在重试外 await 一次；其异常不触发提供者重试', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(new Response('x', { status: 500 }))
      .mockImplementation(async () => new Response(sseBody([delta('ok', 'stop'), 'data: [DONE]\n\n'])(), { status: 200 }));
    vi.stubGlobal('fetch', f);
    await expect(aiClient.generateStream('s', 'u', {
      onComplete: async () => { throw new Error('持久化失败 network error'); },
    })).rejects.toThrow('持久化失败');
    expect(f).toHaveBeenCalledTimes(2); // 1次预重试 + 1次成功；完成回调错误不再重试
  });

  it('非流式：finish_reason length 明确失败；空响应明确失败', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ choices: [{ message: { content: 'x' }, finish_reason: 'length' }] }));
    await expect(aiClient.generate('s', 'u')).rejects.toThrow('截断');

    vi.stubGlobal('fetch', mockFetchOnce({ choices: [{ message: { content: '  ' }, finish_reason: 'stop' }] }));
    await expect(aiClient.generate('s', 'u')).rejects.toThrow('有效内容');
  });
});

describe('模型配置判定与快照', () => {
  it('缺 key/网关 => configured=false + 可读原因；已配置无原因', () => {
    const models = aiClient.getAvailableModels();
    const ds = models.find(m => m.name === 'deepseek-chat')!;
    expect(ds.configured).toBe(true);
    expect(ds.unavailableReason).toBeUndefined();
    const unconfigured = models.find(m => !m.configured)!;
    expect(unconfigured.unavailableReason).toBeTruthy();
  });

  it('未配置模型 switch/test 不发上游请求', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const target = aiClient.getAvailableModels().find(m => !m.configured)!;
    expect(aiClient.switchModel(target.name)).toBe(false);
    const r = await aiClient.testModel(target.name);
    expect(r.success).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it('testModel 成功/失败均不改变全局选择', async () => {
    const fetcher = mockFetchOnce({ choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }] });
    vi.stubGlobal('fetch', fetcher);
    const before = aiClient.getCurrentModelName();
    expect((await aiClient.testModel('glm-night')).success).toBe(true);
    expect(aiClient.getCurrentModelName()).toBe(before);
    fetcher.mockRejectedValueOnce(new Error('fixture offline'));
    expect((await aiClient.testModel('glm-night')).success).toBe(false);
    expect(aiClient.getCurrentModelName()).toBe(before);
  });

  it('withModel 快照：并发生成钉住各自模型', async () => {
    const seen: string[] = [];
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const bothStarted = new Promise<void>(resolve => { started = resolve; });
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string, init: any) => {
      const model = JSON.parse(init.body).model;
      seen.push(model);
      if (seen.length === 2) started();
      await gate;
      return new Response(sseBody([delta(model, 'stop'), 'data: [DONE]\n\n'])(), { status: 200 });
    }));
    const ds = withModel('deepseek-chat', async () => {
      const text = await aiClient.generateStream('s', 'u', {});
      expect(aiClient.getCurrentConfig().name).toBe('deepseek-chat');
      return text;
    });
    const glm = withModel('glm-night', async () => {
      const text = await aiClient.generateStream('s', 'u', {});
      expect(aiClient.getCurrentConfig().name).toBe('glm-night');
      return text;
    });
    await bothStarted;
    expect(aiClient.switchModel('glm-night')).toBe(true);
    release();
    expect(await Promise.all([ds, glm])).toEqual(['deepseek-chat', 'fixture-glm']);
    expect(seen.sort()).toEqual(['deepseek-chat', 'fixture-glm']);
    expect(aiClient.getCurrentModelName()).toBe('glm-night');
  });
});

describe('withModel 显式名称校验', () => {
  it('未知模型名抛出，不回退到其他提供者', async () => {
    expect(() => withModel('no-such-model', () => 'x')).toThrow('未知模型');
    // 原型属性名同样拒绝
    expect(() => withModel('toString', () => 'x')).toThrow('未知模型');
    expect(() => withModel('constructor', () => 'x')).toThrow('未知模型');
  });

  it('其他请求切换模型时，失败重试仍使用原请求模型', async () => {
    vi.useFakeTimers();
    let firstAttempt!: () => void;
    const attempted = new Promise<void>(resolve => { firstAttempt = resolve; });
    const seen: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init: any) => {
      const model = JSON.parse(init.body).model;
      seen.push(model);
      if (seen.length === 1) {
        firstAttempt();
        return new Response('temporary upstream failure', { status: 503 });
      }
      return new Response(sseBody([delta(model, 'stop'), 'data: [DONE]\n\n'])(), { status: 200 });
    }));
    const original = withModel('deepseek-chat', () => aiClient.generateStream('s', 'u', {}));
    await attempted;
    expect(aiClient.switchModel('glm-night')).toBe(true);
    const other = withModel('glm-night', () => aiClient.generateStream('s', 'u', {}));
    await vi.runAllTimersAsync();
    expect(await original).toBe('deepseek-chat');
    expect(await other).toBe('fixture-glm');
    expect(seen.filter(model => model === 'deepseek-chat')).toHaveLength(2);
    expect(seen.filter(model => model === 'fixture-glm')).toHaveLength(1);
  });

  it('withModel signal 供上下文 abort；预取消的流式调用直接拒绝', async () => {
    const ac = new AbortController();
    ac.abort();
    let onErr = 0;
    await expect(withModel('deepseek-chat', () => aiClient.generateStream('s', 'u', { onError: () => onErr++ }), ac.signal))
      .rejects.toThrow();
    expect(onErr).toBe(1);
  });
});
