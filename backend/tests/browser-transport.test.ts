import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CREATOR_TOKEN_KEY, humanizeError, SSEClientError } from '../../frontend/src/services/apiConfig';
import { postSSE } from '../../frontend/src/services/sseClient';
import { consumeSSEReader } from '../../frontend/src/services/sseCore';

const AUTH_KEY = 'comic-script-creator-auth';
let storage: Map<string, string>;

beforeEach(() => {
  storage = new Map([[CREATOR_TOKEN_KEY, 'fixture-token'], [AUTH_KEY, '{"id":"fixture"}']]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.stubGlobal('window', { location: { href: '/editor' } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function hangingErrorBody(status = 503) {
  return vi.fn(async (_url: unknown, init: RequestInit) => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        init.signal!.addEventListener('abort', () => {
          controller.error(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      },
    });
    return new Response(body, { status, headers: { 'X-Request-ID': 'body-timeout-id' } });
  });
}

describe('POST-SSE browser transport boundaries', () => {
  it('pre-aborted request never fetches or reports an error', async () => {
    const fetcher = vi.fn();
    const onError = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    controller.abort();
    const result = await postSSE('/fixture', {}, {
      terminalEvents: ['done'], signal: controller.signal, onError,
    });
    expect(result.status).toBe('aborted');
    expect(fetcher).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('401 clears both credentials and redirects, preserving the server reason and request ID', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: '登录已过期，请重新登录' }),
      { status: 401, headers: { 'X-Request-ID': 'auth-id' } }
    )));
    const onError = vi.fn();
    const result = await postSSE('/fixture', {}, { terminalEvents: ['done'], onError });
    expect(result.status).toBe('error');
    expect(storage.has(CREATOR_TOKEN_KEY)).toBe(false);
    expect(storage.has(AUTH_KEY)).toBe(false);
    expect(window.location.href).toBe('/login');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(humanizeError(onError.mock.calls[0][0])).toBe('登录已过期，请重新登录（请求ID: auth-id）');
  });

  it('403 preserves the login and actionable mixed-language server reason', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: '无权访问项目，连接诊断: network error' }),
      { status: 403, headers: { 'X-Request-ID': 'owner-id' } }
    )));
    const onError = vi.fn();
    await postSSE('/fixture', {}, { terminalEvents: ['done'], onError });
    expect(storage.size).toBe(2);
    expect(window.location.href).toBe('/editor');
    expect(humanizeError(onError.mock.calls[0][0]))
      .toBe('无权访问项目，连接诊断: network error（请求ID: owner-id）');
  });

  it('network failure does not erase authentication or redirect', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const onError = vi.fn();
    const result = await postSSE('/fixture', {}, { terminalEvents: ['done'], onError });
    expect(result.status).toBe('error');
    expect(storage.size).toBe(2);
    expect(window.location.href).toBe('/editor');
    expect(humanizeError(onError.mock.calls[0][0])).toContain('网络连接失败');
  });

  it('header deadline is a timeout, not a quiet user cancellation', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: unknown, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    })));
    const onError = vi.fn();
    const pending = postSSE('/fixture', {}, { terminalEvents: ['done'], headersTimeoutMs: 20, onError });
    await vi.advanceTimersByTimeAsync(21);
    expect((await pending).status).toBe('error');
    expect(onError.mock.calls[0][0]).toMatchObject({ kind: 'timeout', message: '连接超时，请稍后重试' });
  });

  it('an unending HTTP error body has a bounded actionable timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', hangingErrorBody());
    const onError = vi.fn();
    const pending = postSSE('/fixture', {}, { terminalEvents: ['done'], onError });
    await vi.advanceTimersByTimeAsync(10001);
    expect((await pending).status).toBe('error');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toMatchObject({ kind: 'timeout', status: 503, requestId: 'body-timeout-id' });
    expect(humanizeError(onError.mock.calls[0][0])).toContain('读取错误响应超时');
    expect(storage.size).toBe(2);
  });

  it('user abort while reading an HTTP error body remains quiet', async () => {
    vi.stubGlobal('fetch', hangingErrorBody());
    const controller = new AbortController();
    const onError = vi.fn();
    const pending = postSSE('/fixture', {}, { terminalEvents: ['done'], signal: controller.signal, onError });
    await Promise.resolve();
    controller.abort();
    expect((await pending).status).toBe('aborted');
    expect(onError).not.toHaveBeenCalled();
    expect(storage.size).toBe(2);
  });

  it('embedded and structured request IDs are rendered only once after translation', () => {
    expect(humanizeError(new SSEClientError('timeout', 'timeout（请求ID: r-one）', undefined, { requestId: 'r-one' })))
      .toBe('连接超时，请稍后重试（请求ID: r-one）');
    expect(humanizeError('保存失败（请求ID: r-one）（请求ID: r-one）')).toBe('保存失败（请求ID: r-one）');
  });
});

describe('awaited terminal cancellation', () => {
  it('abort during the terminal callback cannot become success or dispatch following frames', async () => {
    const controller = new AbortController();
    const cancel = vi.fn(async () => {});
    const releaseLock = vi.fn();
    const reader = {
      read: vi.fn(async () => ({
        done: false,
        value: new TextEncoder().encode('data: {"type":"done"}\n\ndata: {"type":"chunk","content":"late"}\n\n'),
      })),
      cancel,
      releaseLock,
    };
    const onEvent = vi.fn();
    const onError = vi.fn();
    const result = await consumeSSEReader(reader, {
      terminalEvents: ['done'],
      signal: controller.signal,
      onTerminal: async () => { await Promise.resolve(); controller.abort(); },
      onEvent,
      onError,
    });
    expect(result.status).toBe('aborted');
    expect(onEvent).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalled();
    expect(releaseLock).toHaveBeenCalledTimes(1);
  });
});
