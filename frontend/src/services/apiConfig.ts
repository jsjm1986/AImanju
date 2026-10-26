/**
 * 统一前端 API 传输配置：
 * - API_BASE 规范化（默认 '/api'，兼容显式绝对地址，去尾斜杠）
 * - apiUrl 构造、创作者令牌、可读的 HTTP/网络/异常流错误格式
 */

const envBase: string | undefined = (import.meta as any).env?.VITE_API_BASE;

export function normalizeApiBase(raw?: string): string {
  const trimmed = (raw ?? '').trim();
  const base = trimmed || '/api';
  const stripped = base.replace(/\/+$/, '');
  return stripped || '/api';
}

export const API_BASE = normalizeApiBase(envBase);

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

export const CREATOR_TOKEN_KEY = 'comic-script-creator-token';

export function getCreatorToken(): string | null {
  try { return localStorage.getItem(CREATOR_TOKEN_KEY); } catch { return null; }
}

export function buildAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const token = getCreatorToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export type SSEErrorKind = 'http' | 'network' | 'timeout' | 'parse' | 'callback' | 'eof' | 'server' | 'aborted' | 'config';

export interface SSEErrorInit { status?: number; requestId?: string; code?: string; }

export class SSEClientError extends Error {
  kind: SSEErrorKind;
  status?: number;
  requestId?: string;
  code?: string;
  constructor(kind: SSEErrorKind, message: string, status?: number, init: SSEErrorInit = {}) {
    super(message);
    this.name = 'SSEClientError';
    this.kind = kind;
    this.status = status;
    this.requestId = init.requestId;
    this.code = init.code;
  }
}

/** 把 HTTP 非 2xx 响应转成可读错误（尽量取响应体里的 error/message，保留错误码供配额等场景） */
export function formatHttpError(status: number, bodyText: string): SSEClientError {
  let serverMessage = '';
  let code: string | undefined;
  try {
    const parsed = JSON.parse(bodyText);
    serverMessage = parsed?.error || parsed?.message || '';
    code = parsed?.code;
  } catch { /* 非 JSON 响应体 */ }
  if (!serverMessage && bodyText) serverMessage = bodyText.slice(0, 200);
  // 服务端英文技术消息也做人性化，不直抛给用户
  if (serverMessage) serverMessage = humanizeError(new Error(serverMessage));

  if (status === 401) return new SSEClientError('http', serverMessage || '未登录或登录已过期，请重新登录', status, { code });
  if (status === 403) return new SSEClientError('http', serverMessage || '权限不足', status, { code });
  if (status === 409) return new SSEClientError('http', serverMessage || '请求冲突，请稍后重试', status, { code });
  if (status >= 500) return new SSEClientError('http', serverMessage || `服务器错误（HTTP ${status}），请稍后重试`, status, { code });
  return new SSEClientError('http', serverMessage || `请求失败（HTTP ${status}）`, status, { code });
}

/**
 * 将任意异常翻译为面向用户的可读信息；
 * 绝不把原始 'network error'/'Failed to fetch' 直接抛给用户。
 */
export function humanizeError(err: unknown): string {
  const raw = typeof err === 'string' ? err : ((err as Error)?.message || String(err ?? ''));
  const embedded = raw.match(/[（(]请求ID:\s*([^）)]+)[）)]/);
  const requestId = (err instanceof SSEClientError ? err.requestId : undefined) || embedded?.[1];
  const message = raw.replace(/[（(]请求ID:\s*[^）)]+[）)]/g, '').trim();
  const base = humanizeBase({ message, name: (err as Error)?.name || '' });
  return requestId ? `${base}（请求ID: ${requestId}）` : base;
}

function humanizeBase(err: unknown): string {
  const msg = typeof err === 'string' ? err : ((err as Error)?.message || String(err ?? ''));
  const name = (err as Error)?.name || '';
  if (name === 'AbortError' || msg === '请求已取消') return '请求已取消';
  if (/[\u4e00-\u9fa5]/.test(msg)) return msg;
  if (msg === 'Failed to fetch' || msg === 'fetch failed' || msg === 'Network Error' ||
      /network\s*error/i.test(msg) || msg === 'Load failed') {
    return '网络连接失败，请检查网络或后端服务后重试';
  }
  if (/timeout|timed? ?out|连接超时/i.test(msg)) return '连接超时，请稍后重试';
  return msg ? `请求失败：${msg.slice(0, 200)}` : '网络异常，请重试';
}
