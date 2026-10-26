import { describe, it, expect, vi, beforeEach } from 'vitest';

// 受控的流式输出队列：每次 generateStream 消耗一个脚本化结果（字符串或 Error）
const queue: Array<string | Error> = [];
vi.mock('../src/services/ai/AIClient', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/services/ai/AIClient')>();
  return {
    ...original,
    aiClient: {
      ...original.aiClient,
      generateStream: vi.fn(async (_sys: string, _user: string, callbacks: { onChunk?: (t: string) => void }) => {
        const next = queue.shift();
        if (next === undefined) throw new Error('测试未提供输出');
        if (next instanceof Error) throw next;
        callbacks.onChunk?.(next);
        return next;
      }),
    },
  };
});

import { OutlineService } from '../src/services/outline/OutlineService';
import { aiClient } from '../src/services/ai/AIClient';

const service = new OutlineService();
const buildMessages = (start: number, end: number) => ({ system: 's', user: `${start}-${end}` });
const callbacks = { onChunk: () => {} } as never;

function eps(start: number, end: number): string {
  const parts: string[] = [];
  for (let n = start; n <= end; n++) parts.push(`第${n}集：\n梗概：内容${n}\n人物：A、B`);
  return parts.join('\n\n');
}

const range = (svc: OutlineService, s: number, e: number, prev = '') =>
  (svc as unknown as { generateEpisodeRange: Function })
    .generateEpisodeRange(3, buildMessages, s, e, prev, '[T]', callbacks, undefined);

beforeEach(() => { queue.length = 0; vi.clearAllMocks(); });

describe('分集梗概缺集校验与拆分', () => {
  it('完整批次一次通过，不重复请求', async () => {
    queue.push(eps(1, 20));
    const out = await range(service, 1, 20);
    expect(out).toContain('第20集');
    expect(aiClient.generateStream).toHaveBeenCalledTimes(1);
  });

  it('付费卡点标注「第N集（一卡）：」不误报缺集', async () => {
    const marked = '第1集：\n梗概：a\n第2集（一卡）：\n梗概：b\n第3集（二卡）: \n梗概：c';
    queue.push(marked);
    const out = await range(service, 1, 3);
    expect(aiClient.generateStream).toHaveBeenCalledTimes(1);
    expect(out).toBe(marked);
  });

  it('缺集先整段重试；第二次补齐则通过（共2次请求）', async () => {
    queue.push(eps(1, 18)); // 缺19/20
    queue.push(eps(1, 20));
    const out = await range(service, 1, 20);
    expect(aiClient.generateStream).toHaveBeenCalledTimes(2);
    expect(out).toContain('第19集');
  });

  it('重试仍缺集 → 二分拆分，两个半段各自完整', async () => {
    queue.push(eps(1, 15)); // 缺16-20
    queue.push(eps(1, 17)); // 重试仍缺
    queue.push(eps(1, 10));
    queue.push(eps(11, 20));
    const out = await range(service, 1, 20);
    expect(aiClient.generateStream).toHaveBeenCalledTimes(4);
    for (let n = 1; n <= 20; n++) expect(out).toContain(`第${n}集`);
  });

  it('上游长度截断错误 → 直接二分，不整段重试', async () => {
    queue.push(new Error('生成内容达到长度上限被截断'));
    queue.push(eps(1, 10));
    queue.push(eps(11, 20));
    const out = await range(service, 1, 20);
    expect(aiClient.generateStream).toHaveBeenCalledTimes(3);
    for (let n = 1; n <= 20; n++) expect(out).toContain(`第${n}集`);
  });

  it('单集仍缺 → 抛出带集号的明确错误', async () => {
    queue.push('梗概：没有集号标题');
    queue.push('梗概：依旧没有集号标题');
    await expect(range(service, 1, 1)).rejects.toThrow('分集梗概缺少第1集');
    // 单集不可拆分：整段重试一次后停止（2次调用）
    expect(aiClient.generateStream).toHaveBeenCalledTimes(2);
  });

  it('其他错误原样抛出（非截断不拆分）', async () => {
    queue.push(new Error('ECONNRESET'));
    await expect(range(service, 1, 20)).rejects.toThrow('ECONNRESET');
    expect(aiClient.generateStream).toHaveBeenCalledTimes(1);
  });
});
