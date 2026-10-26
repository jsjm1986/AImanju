/**
 * 纯 TypeScript SSE 帧解析 + 流消费核心（无 DOM/Vue 依赖，可在 Node 测试）。
 * 语义：
 * - 支持 CRLF、注释心跳、无空格冒号、多行 data、跨 chunk UTF-8、末尾 flush
 * - JSON 解析错误与回调异常区分并各自传播
 * - 必须收到显式终止事件（terminalEvents）；EOF 未收到 => 连接中断错误
 * - 服务器 error 事件 => 恰好一次 onError；正常终止 => 恰好一次完成回调
 * - 空闲超时（心跳注释也重置）；主动 AbortSignal 取消保持静默
 */

import { SSEClientError } from './apiConfig';

export interface SSEEvent {
  event: string;
  data: string;
}

/** 增量 SSE 帧解析器（按 \n\n 分块，输入文本已按 UTF-8 解码） */
export class SSEFrameParser {
  private buffer = '';

  feed(text: string): SSEEvent[] {
    this.buffer += text;
    const blocks = this.buffer.split(/\r?\n\r?\n/);
    this.buffer = blocks.pop() || '';
    const events: SSEEvent[] = [];
    for (const block of blocks) {
      const ev = this.parseBlock(block);
      if (ev) events.push(ev);
    }
    return events;
  }

  /** 流结束时调用，处理残余不完整块 */
  flush(): SSEEvent[] {
    const rest = this.buffer;
    this.buffer = '';
    const ev = this.parseBlock(rest);
    return ev ? [ev] : [];
  }

  private parseBlock(block: string): SSEEvent | null {
    if (!block.trim()) return null;
    let event = 'message';
    const dataLines: string[] = [];
    for (const rawLine of block.split(/\r?\n/)) {
      const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
      if (!line) continue;
      if (line.startsWith(':')) continue; // 注释/心跳
      const colon = line.indexOf(':');
      if (colon === -1) {
        // 无冒号：字段名为整行，值为空（按规范），只认 data
        if (line === 'data') dataLines.push('');
        continue;
      }
      const field = line.slice(0, colon);
      let value = line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'event') event = value.trim() || 'message';
      else if (field === 'data') dataLines.push(value);
    }
    if (dataLines.length === 0) return null;
    return { event, data: dataLines.join('\n') };
  }
}

export interface SSEReaderLike {
  read(): Promise<{ done: boolean; value?: Uint8Array }>;
  cancel(reason?: unknown): Promise<void> | void;
}

export type SSEConsumeOutcome =
  | { status: 'done'; eventType: string; data: unknown }
  | { status: 'error'; error: Error }
  | { status: 'aborted' };

export interface ConsumeOptions {
  /** 终止事件类型列表（如 ['done']、['result']、['complete']） */
  terminalEvents: readonly string[];
  /** 错误事件类型，默认 ['error'] */
  errorEvents?: readonly string[];
  /** 字节空闲超时（任意字节含注释心跳重置），默认 75s */
  idleTimeoutMs?: number;
  signal?: AbortSignal;
  /** 普通事件分发；抛错会作为 callback 类错误终止并传播 */
  onEvent?: (type: string, data: unknown) => void | Promise<void>;
  /** 终止事件分发（被 await）；抛错 => callback 类错误 */
  onTerminal?: (type: string, data: unknown) => void | Promise<void>;
  /** 恰好调用一次 */
  onError?: (error: Error) => void;
}

export async function consumeSSEReader(reader: SSEReaderLike, opts: ConsumeOptions): Promise<SSEConsumeOutcome> {
  const parser = new SSEFrameParser();
  const decoder = new TextDecoder();
  const terminalSet = new Set(opts.terminalEvents);
  const errorSet = new Set(opts.errorEvents || ['error']);
  const idleMs = opts.idleTimeoutMs ?? 75000;

  let finished = false;
  let errorSent = false;
  let aborted = false;
  let idleTimedOut = false;

  const cancelReader = () => {
    try { Promise.resolve(reader.cancel()).catch(() => {}); } catch { /* 同步抛错忽略 */ }
  };

  const fail = (err: Error): SSEConsumeOutcome => {
    finished = true;
    if (!errorSent) {
      errorSent = true;
      try { opts.onError?.(err); } catch { /* onError 自身异常不再传播 */ }
    }
    cancelReader();
    return { status: 'error', error: err };
  };

  const onAbort = () => { aborted = true; cancelReader(); };
  // 预取消：在任何 read/回调之前返回 aborted，同时释放 reader 资源
  if (opts.signal?.aborted) {
    try { Promise.resolve(reader.cancel()).catch(() => {}); } catch { /* 忽略 */ }
    try { (reader as unknown as { releaseLock?: () => void }).releaseLock?.(); } catch { /* 忽略 */ }
    return { status: 'aborted' };
  }
  opts.signal?.addEventListener('abort', onAbort, { once: true });

  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  const armIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleTimedOut = true;
      cancelReader();
    }, idleMs);
  };
  armIdle();

  const stopIdle = () => { if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; } };

  const dispatch = async (ev: SSEEvent): Promise<SSEConsumeOutcome | null> => {
    if (finished || aborted || idleTimedOut || opts.signal?.aborted) return null;
    // JSON 解析错误：独立于回调错误传播
    let data: unknown;
    try {
      data = JSON.parse(ev.data);
    } catch {
      return fail(new SSEClientError('parse', `收到无法解析的服务器数据（${ev.event}），连接中断可重试`));
    }
    // 事件类型：优先 event: 行，退回 data.type（兼容仅写 data: 的端点）
    const type = ev.event !== 'message'
      ? ev.event
      : (typeof (data as any)?.type === 'string' ? (data as any).type : ev.event);
    // 服务器错误事件：恰好一次 onError
    if (errorSet.has(type)) {
      const parsed = data as Record<string, unknown>;
      const message = (parsed?.message as string) || (parsed?.error as string) || '服务器返回错误';
      const requestId = parsed?.requestId as string | undefined;
      const err = new SSEClientError('server', message);
      if (requestId) err.requestId = requestId;
      return fail(err);
    }
    if (terminalSet.has(type)) {
      finished = true;
      stopIdle(); // 终态回调期间不再计空闲超时
      try {
        await opts.onTerminal?.(type, data);
        if (aborted || opts.signal?.aborted) return { status: 'aborted' };
      } catch (e) {
        const err = new SSEClientError('callback', `处理完成回调失败：${(e as Error)?.message || e}`);
        if (!errorSent) { errorSent = true; try { opts.onError?.(err); } catch { /* 忽略 */ } }
        return { status: 'error', error: err };
      }
      cancelReader();
      return { status: 'done', eventType: type, data };
    }
    try {
      await opts.onEvent?.(type, data);
    } catch (e) {
      const err = e instanceof SSEClientError ? e : new SSEClientError('callback', (e as Error)?.message || String(e));
      return fail(err);
    }
    return null;
  };

  try {
    while (!finished) {
      let read: { done: boolean; value?: Uint8Array };
      try {
        read = await reader.read();
      } catch (e) {
        // read 自身拒绝：归一为单次错误（取消/超时优先判定）
        if (aborted || opts.signal?.aborted) return { status: 'aborted' };
        if (idleTimedOut) return fail(new SSEClientError('timeout', '连接空闲超时（长时间未收到数据），可重试'));
        return fail(e instanceof Error ? e : new SSEClientError('network', String(e)));
      }
      const { done, value } = read;
      if (done) break;
      armIdle();
      const events = parser.feed(decoder.decode(value, { stream: true }));
      for (const ev of events) {
        const r = await dispatch(ev);
        if (r) return r;
      }
    }
    // 取消/超时优先于残余块派发：预取消的 reader 不得把缓冲 done 误当成功
    if (aborted || opts.signal?.aborted) return { status: 'aborted' };
    if (idleTimedOut) return fail(new SSEClientError('timeout', '连接空闲超时（长时间未收到数据），可重试'));
    // EOF：flush 残余块
    for (const ev of parser.feed(decoder.decode())) {
      const r = await dispatch(ev);
      if (r) return r;
    }
    for (const ev of parser.flush()) {
      const r = await dispatch(ev);
      if (r) return r;
    }

    if (!finished) return fail(new SSEClientError('eof', '连接中断，未收到完成确认，可重试'));
    return { status: 'error', error: new SSEClientError('eof', '连接中断') };
  } finally {
    stopIdle();
    opts.signal?.removeEventListener('abort', onAbort);
    cancelReader();
    try { (reader as unknown as { releaseLock?: () => void }).releaseLock?.(); } catch { /* 忽略 */ }
  }
}
