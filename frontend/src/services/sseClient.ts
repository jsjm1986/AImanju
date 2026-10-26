/**
 * 浏览器侧统一 POST-SSE 客户端：
 * - 统一 apiUrl + Bearer 认证头
 * - 45s 连接（响应头）超时，75s 字节空闲超时（心跳重置）
 * - 非 2xx 读取 JSON 错误体（限时限流）；EOF 无终止 => '连接中断，未收到完成确认，可重试'
 * - 主动取消静默（不弹错）
 */

import { apiUrl, buildAuthHeaders, formatHttpError, humanizeError, SSEClientError, CREATOR_TOKEN_KEY } from './apiConfig';
import { consumeSSEReader } from './sseCore';
import type { ConsumeOptions, SSEConsumeOutcome } from './sseCore';

export interface PostSSEOptions {
  terminalEvents: readonly string[];
  errorEvents?: readonly string[];
  headersTimeoutMs?: number;  // 连接/响应头超时，默认 45s
  idleTimeoutMs?: number;     // 字节空闲超时，默认 75s
  signal?: AbortSignal;
  onEvent?: ConsumeOptions['onEvent'];
  onTerminal?: ConsumeOptions['onTerminal'];
  onError?: ConsumeOptions['onError'];
}

const ERROR_BODY_READ_TIMEOUT = 10000;

export async function postSSE(
  path: string,
  body: Record<string, unknown>,
  opts: PostSSEOptions
): Promise<SSEConsumeOutcome> {
  // 预取消的外部信号：直接返回，不发请求
  if (opts.signal?.aborted) return { status: 'aborted' };

  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onOuterAbort, { once: true });

  const emitError = (err: Error): SSEConsumeOutcome => {
    const wrapped = err instanceof SSEClientError ? err : new SSEClientError('network', humanizeError(err));
    try { opts.onError?.(wrapped); } catch { /* 忽略 */ }
    return { status: 'error', error: wrapped };
  };

  // 单一计时器：先置"头超时"原因再取消——AbortError 不会被误判为主动取消
  let headerTimedOut = false;
  const headersTimer = setTimeout(() => {
    headerTimedOut = true;
    controller.abort();
  }, opts.headersTimeoutMs ?? 45000);

  try {
    const response = await fetch(apiUrl(path), {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(headersTimer);

    if (!response.ok) {
      // 有界错误体读取：body 超时独立标记；用户中止仍静默
      let text = '';
      let bodyTimedOut = false;
      const bodyDeadline = setTimeout(() => { bodyTimedOut = true; controller.abort(); }, ERROR_BODY_READ_TIMEOUT);
      try {
        text = await response.text();
      } catch { /* 超时/取消/失败：body 视为空 */ }
      clearTimeout(bodyDeadline);
      if (opts.signal?.aborted) return { status: 'aborted' };
      if (controller.signal.aborted && !headerTimedOut && !bodyTimedOut) return { status: 'aborted' };
      const err = bodyTimedOut
        ? new SSEClientError('timeout', `读取错误响应超时（HTTP ${response.status}），请稍后重试`, response.status)
        : formatHttpError(response.status, text);
      const requestId = response.headers.get('X-Request-ID');
      if (requestId) err.requestId = requestId;
      // 真实 401：与 axios 拦截一致——清除本地凭据并跳登录（403/网络错误不跳）
      if (response.status === 401) {
        try {
          localStorage.removeItem(CREATOR_TOKEN_KEY);
          localStorage.removeItem('comic-script-creator-auth');
        } catch { /* 忽略 */ }
        try { window.location.href = '/login'; } catch { /* 非浏览器环境忽略 */ }
      }
      return emitError(err);
    }

    const reader = response.body?.getReader();
    if (!reader) return emitError(new SSEClientError('network', '无法读取响应流'));

    const requestId = response.headers.get('X-Request-ID') || undefined;
    const outcome = await consumeSSEReader(reader, {
      terminalEvents: opts.terminalEvents,
      errorEvents: opts.errorEvents,
      idleTimeoutMs: opts.idleTimeoutMs ?? 75000,
      signal: controller.signal,
      onEvent: opts.onEvent,
      onTerminal: opts.onTerminal,
      onError: (e) => {
        if (requestId && e instanceof SSEClientError && !e.requestId) e.requestId = requestId;
        else if (requestId && !(e instanceof SSEClientError)) {
          // 归一裸 reader 错误，使头里的 requestId 也能挂上
          const wrapped = new SSEClientError('network', e.message || '网络异常', undefined, { requestId });
          opts.onError?.(wrapped);
          return;
        }
        opts.onError?.(e);
      },
    });
    return outcome;
  } catch (err) {
    if (opts.signal?.aborted) return { status: 'aborted' };
    if (headerTimedOut) {
      return emitError(new SSEClientError('timeout', '连接超时，请稍后重试'));
    }
    if (controller.signal.aborted) return { status: 'aborted' }; // 外部联动取消
    return emitError(err instanceof Error ? err : new Error(String(err)));
  } finally {
    clearTimeout(headersTimer);
    opts.signal?.removeEventListener('abort', onOuterAbort);
  }
}
