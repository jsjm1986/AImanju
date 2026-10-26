/**
 * AI服务 - 多模型支持 (Claude + OpenAI兼容格式)
 */

import Anthropic from '@anthropic-ai/sdk';
import { AsyncLocalStorage } from 'async_hooks';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger, safeStringify } from '../../utils/errorLogger';

const logger = createLogger('AIClient');

// ==================== 类型定义 ====================

export type AIProvider = 'claude' | 'openai';

export interface ModelConfig {
  provider: AIProvider;
  name: string;
  displayName: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  /** 附加请求体字段（合并进 /chat/completions 请求，如关闭推理模式） */
  extraBody?: Record<string, unknown>;
}

export interface AIStreamCallbacks {
  onChunk?: (text: string) => void;
  onComplete?: (fullText: string) => void | Promise<void>;
  onError?: (error: Error) => void;
  onLog?: (message: string, level?: 'info' | 'warn' | 'error') => void;
}

// ==================== 配置 ====================

const CLAUDE_API_KEYS: string[] = [
  process.env.CLAUDE_API_KEY || '',
  process.env.CLAUDE_API_KEY_2 || '',
  process.env.CLAUDE_API_KEY_3 || '',
].filter(k => k.length > 0);

let currentClaudeKeyIndex = 0;

function getCurrentClaudeApiKey(): string {
  return CLAUDE_API_KEYS[currentClaudeKeyIndex] || '';
}

function rotateClaudeApiKey(): string {
  if (CLAUDE_API_KEYS.length <= 1) return getCurrentClaudeApiKey();
  const oldIndex = currentClaudeKeyIndex;
  currentClaudeKeyIndex = (currentClaudeKeyIndex + 1) % CLAUDE_API_KEYS.length;
  console.log(`[AI] Claude API Key轮换: ${oldIndex} -> ${currentClaudeKeyIndex}`);
  return getCurrentClaudeApiKey();
}

function getModelConfigs(): Record<string, ModelConfig> {
  const dashscope = (model: string, displayName: string): ModelConfig => ({
    provider: 'claude',
    name: '',
    displayName,
    apiKey: process.env.DASHSCOPE_API_KEY || '',
    baseUrl: process.env.DASHSCOPE_API_BASE_URL || 'https://coding.dashscope.aliyuncs.com/apps/anthropic',
    model,
  });

  return {
    'glm-night': {
      provider: 'openai', name: 'glm-night', displayName: '智谱GLM-5',
      apiKey: process.env.GLM_NIGHT_API_KEY || '',
      baseUrl: process.env.GLM_NIGHT_API_BASE_URL || 'https://open.bigmodel.cn/api/coding/paas/v4',
      model: process.env.GLM_NIGHT_MODEL || 'glm-4.7',
    },
    'ark-code': {
      provider: 'openai', name: 'ark-code', displayName: 'Ark Code (豆包)',
      apiKey: process.env.ARK_API_KEY || '',
      baseUrl: process.env.ARK_API_BASE_URL || 'https://ark.cn-beijing.volces.com/api/coding/v3',
      model: process.env.ARK_MODEL || 'ark-code-latest',
    },
    'deepseek-chat': {
      provider: 'openai', name: 'deepseek-chat', displayName: 'DeepSeek Chat',
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      baseUrl: process.env.DEEPSEEK_API_BASE_URL || 'https://api.deepseek.com',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      // deepseek-flash/v4 为推理模型：reasoning 会耗尽 max_tokens 导致空响应。
      // 默认关闭思考；设 DEEPSEEK_THINKING=enabled 可恢复。
      ...(process.env.DEEPSEEK_THINKING === 'enabled' ? {} : { extraBody: { thinking: { type: 'disabled' } } }),
    },
    // 通过自定义 OpenAI 兼容网关访问的模型（GPT 系列、Gemini 系列等）
    // 配置 CUSTOM_GATEWAY_API_KEY 与 CUSTOM_GATEWAY_BASE_URL 即可启用
    'gpt-5': {
      provider: 'openai', name: 'gpt-5', displayName: 'GPT-5',
      apiKey: process.env.CUSTOM_GATEWAY_API_KEY || '',
      baseUrl: process.env.CUSTOM_GATEWAY_BASE_URL || '',
      model: 'gpt-5',
    },
    'gpt-5.1': {
      provider: 'openai', name: 'gpt-5.1', displayName: 'GPT-5.1',
      apiKey: process.env.CUSTOM_GATEWAY_API_KEY || '',
      baseUrl: process.env.CUSTOM_GATEWAY_BASE_URL || '',
      model: 'gpt-5.1',
    },
    'gpt-5.2': {
      provider: 'openai', name: 'gpt-5.2', displayName: 'GPT-5.2',
      apiKey: process.env.CUSTOM_GATEWAY_API_KEY || '',
      baseUrl: process.env.CUSTOM_GATEWAY_BASE_URL || '',
      model: 'gpt-5.2',
    },
    'gpt-5.4': {
      provider: 'openai', name: 'gpt-5.4', displayName: 'GPT-5.4',
      apiKey: process.env.CUSTOM_GATEWAY_API_KEY || '',
      baseUrl: process.env.CUSTOM_GATEWAY_BASE_URL || '',
      model: 'gpt-5.4',
    },
    'gpt-5-codex': {
      provider: 'openai', name: 'gpt-5-codex', displayName: 'GPT-5 Codex',
      apiKey: process.env.CUSTOM_GATEWAY_API_KEY || '',
      baseUrl: process.env.CUSTOM_GATEWAY_BASE_URL || '',
      model: 'gpt-5-codex',
    },
    'gpt-5-codex-mini': {
      provider: 'openai', name: 'gpt-5-codex-mini', displayName: 'GPT-5 Codex Mini',
      apiKey: process.env.CUSTOM_GATEWAY_API_KEY || '',
      baseUrl: process.env.CUSTOM_GATEWAY_BASE_URL || '',
      model: 'gpt-5-codex-mini',
    },
    'gpt-5.1-codex': {
      provider: 'openai', name: 'gpt-5.1-codex', displayName: 'GPT-5.1 Codex',
      apiKey: process.env.CUSTOM_GATEWAY_API_KEY || '',
      baseUrl: process.env.CUSTOM_GATEWAY_BASE_URL || '',
      model: 'gpt-5.1-codex',
    },
    'gpt-5.1-codex-mini': {
      provider: 'openai', name: 'gpt-5.1-codex-mini', displayName: 'GPT-5.1 Codex Mini',
      apiKey: process.env.CUSTOM_GATEWAY_API_KEY || '',
      baseUrl: process.env.CUSTOM_GATEWAY_BASE_URL || '',
      model: 'gpt-5.1-codex-mini',
    },
    'gpt-5.1-codex-max': {
      provider: 'openai', name: 'gpt-5.1-codex-max', displayName: 'GPT-5.1 Codex Max',
      apiKey: process.env.CUSTOM_GATEWAY_API_KEY || '',
      baseUrl: process.env.CUSTOM_GATEWAY_BASE_URL || '',
      model: 'gpt-5.1-codex-max',
    },
    'gpt-5.2-codex': {
      provider: 'openai', name: 'gpt-5.2-codex', displayName: 'GPT-5.2 Codex',
      apiKey: process.env.CUSTOM_GATEWAY_API_KEY || '',
      baseUrl: process.env.CUSTOM_GATEWAY_BASE_URL || '',
      model: 'gpt-5.2-codex',
    },
    'gpt-5.3-codex': {
      provider: 'openai', name: 'gpt-5.3-codex', displayName: 'GPT-5.3 Codex',
      apiKey: process.env.CUSTOM_GATEWAY_API_KEY || '',
      baseUrl: process.env.CUSTOM_GATEWAY_BASE_URL || '',
      model: 'gpt-5.3-codex',
    },
    'gpt-5.3-codex-spark': {
      provider: 'openai', name: 'gpt-5.3-codex-spark', displayName: 'GPT-5.3 Codex Spark',
      apiKey: process.env.CUSTOM_GATEWAY_API_KEY || '',
      baseUrl: process.env.CUSTOM_GATEWAY_BASE_URL || '',
      model: 'gpt-5.3-codex-spark',
    },
    'gemini-2.5-pro': {
      provider: 'openai', name: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro',
      apiKey: process.env.CUSTOM_GATEWAY_API_KEY || '',
      baseUrl: process.env.CUSTOM_GATEWAY_BASE_URL || '',
      model: 'gemini-2.5-pro',
    },
    'gemini-2.5-flash': {
      provider: 'openai', name: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash',
      apiKey: process.env.CUSTOM_GATEWAY_API_KEY || '',
      baseUrl: process.env.CUSTOM_GATEWAY_BASE_URL || '',
      model: 'gemini-2.5-flash',
    },
    'gemini-2.5-flash-lite': {
      provider: 'openai', name: 'gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash Lite',
      apiKey: process.env.CUSTOM_GATEWAY_API_KEY || '',
      baseUrl: process.env.CUSTOM_GATEWAY_BASE_URL || '',
      model: 'gemini-2.5-flash-lite',
    },
    'gemini-3-pro-preview': {
      provider: 'openai', name: 'gemini-3-pro-preview', displayName: 'Gemini 3 Pro Preview',
      apiKey: process.env.CUSTOM_GATEWAY_API_KEY || '',
      baseUrl: process.env.CUSTOM_GATEWAY_BASE_URL || '',
      model: 'gemini-3-pro-preview',
    },
    'gemini-3-flash-preview': {
      provider: 'openai', name: 'gemini-3-flash-preview', displayName: 'Gemini 3 Flash Preview',
      apiKey: process.env.CUSTOM_GATEWAY_API_KEY || '',
      baseUrl: process.env.CUSTOM_GATEWAY_BASE_URL || '',
      model: 'gemini-3-flash-preview',
    },
    'gemini-3.1-pro-preview': {
      provider: 'openai', name: 'gemini-3.1-pro-preview', displayName: 'Gemini 3.1 Pro Preview',
      apiKey: process.env.CUSTOM_GATEWAY_API_KEY || '',
      baseUrl: process.env.CUSTOM_GATEWAY_BASE_URL || '',
      model: 'gemini-3.1-pro-preview',
    },
    'ds-qwen35-plus':  { ...dashscope('qwen3.5-plus', 'Qwen3.5 Plus'), name: 'ds-qwen35-plus' },
    'ds-kimi-k25':     { ...dashscope('kimi-k2.5', 'Kimi K2.5'), name: 'ds-kimi-k25' },
    'ds-glm5':         { ...dashscope('glm-5', 'GLM-5 (百炼)'), name: 'ds-glm5' },
    'ds-minimax-m25':  { ...dashscope('MiniMax-M2.5', 'MiniMax M2.5'), name: 'ds-minimax-m25' },
    'ds-qwen3-max':    { ...dashscope('qwen3-max-2026-01-23', 'Qwen3 Max'), name: 'ds-qwen3-max' },
  };
}

let currentModelName = '';

// ==================== 请求级模型快照 ====================
// AsyncLocalStorage 让单次生成/请求锁定一个模型配置：
// 其他用户并发切换全局模型不会改变进行中的请求。
interface ModelCtx { modelName: string; signal?: AbortSignal; }
const modelContext = new AsyncLocalStorage<ModelCtx>();

/**
 * 在 fn 执行期间（含内部 await）将模型固定为 modelName；不改全局选择、不持久化。
 * signal 挂到请求上下文：generate/generateStream 及上游请求默认取显式参数或上下文 signal。
 * 显式指定未知模型名 => 抛错（绝不回退到别的计费提供者）。
 */
export function withModel<T>(modelName: string, fn: () => T, signal?: AbortSignal): T {
  if (!Object.prototype.hasOwnProperty.call(getModelConfigs(), modelName)) {
    throw new Error(`未知模型: ${modelName}`);
  }
  const parent = modelContext.getStore();
  return modelContext.run({ modelName, signal: signal ?? parent?.signal }, fn);
}

/** 当前请求上下文的取消信号（若有） */
export function currentRequestSignal(): AbortSignal | undefined {
  return modelContext.getStore()?.signal;
}

/** 当前上下文已取消则抛 AbortError */
export function throwIfContextAborted(): void {
  if (modelContext.getStore()?.signal?.aborted) throw createAbortError();
}

function resolveModelName(): string {
  return modelContext.getStore()?.modelName || currentModelName;
}

// ==================== 模型选择持久化 ====================
// 用户在 UI 选择的模型持久化到本地 JSON 文件，重启后保留。
// 优先级：持久化文件 > DEFAULT_AI_PROVIDER 环境变量 > 内置默认。
const MODEL_SETTINGS_FILE = path.join(process.cwd(), '.ai-model.json');

function loadPersistedModel(): string | null {
  try {
    if (!fs.existsSync(MODEL_SETTINGS_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(MODEL_SETTINGS_FILE, 'utf-8'));
    const name = typeof data?.model === 'string' ? data.model : null;
    return name && getModelConfigs()[name] ? name : null;
  } catch {
    return null;
  }
}

function persistModel(modelName: string): void {
  try {
    fs.writeFileSync(MODEL_SETTINGS_FILE, JSON.stringify({ model: modelName }, null, 2), 'utf-8');
  } catch (error) {
    console.warn(`[AI] 模型选择持久化失败（不影响使用）: ${(error as Error).message}`);
  }
}

/** 配置完整性判定：非空密钥 + 合法 http(s) 网关 + 非空模型名 */
export function isModelConfigComplete(config?: ModelConfig): boolean {
  return !modelUnavailableReason(config);
}

/** 返回模型不可用的可读原因（不含密钥），已配置返回 null */
export function modelUnavailableReason(config?: ModelConfig): string | null {
  if (!config) return '未知模型';
  if (!config.apiKey || !config.apiKey.trim()) return '未配置 API 密钥';
  if (!config.model || !config.model.trim()) return '未配置模型名';
  const baseUrl = config.baseUrl?.trim();
  if (!baseUrl) return '未配置 API 网关地址';
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('bad protocol');
  } catch {
    return 'API 网关地址无效';
  }
  return null;
}

/** 列表/当前模型展示名：部分注册键对应多个实际模型（如 deepseek-chat 键承载 deepseek-flash） */
function displayNameFor(config: ModelConfig): string {
  if (config.name === 'deepseek-chat' && config.model === 'deepseek-flash') return 'DeepSeek Flash';
  return config.displayName;
}

function initDefaultModel(): void {
  if (currentModelName) return;
  const configs = getModelConfigs();
  const preferred = loadPersistedModel()
    || (process.env.DEFAULT_AI_PROVIDER === 'glm' ? 'glm-night' : 'ds-qwen35-plus');
  // 首选模型未完整配置时兜底到第一个已配置模型——避免启动即处于无 key 状态导致全站生成失败
  if (isModelConfigComplete(configs[preferred])) {
    currentModelName = preferred;
    return;
  }
  const configured = Object.values(configs).find(c => isModelConfigComplete(c));
  if (configured) {
    currentModelName = configured.name;
    console.warn(`[AI] 首选模型 ${preferred} 未完整配置，回退到 ${configured.displayName}`);
    return;
  }
  // 无已配置模型或持久化值已失效：仍落到已知注册项，保证 list/current 可用、生成报明确配置错误
  const fallbackName = configs[preferred] ? preferred : Object.keys(configs)[0];
  if (!configs[preferred]) {
    console.warn(`[AI] 持久化模型 ${preferred} 不在注册表中，回退到 ${fallbackName}`);
  }
  currentModelName = fallbackName;
}

/** 名称不在注册表时回退到已知项（防止陈旧持久化/上下文值令 getCurrentConfig 崩溃） */
function resolveKnownConfig(name: string): ModelConfig {
  const configs = getModelConfigs();
  if (configs[name]) return configs[name];
  const configured = Object.values(configs).find(c => isModelConfigComplete(c));
  return configured || Object.values(configs)[0];
}

/** 品牌标签（前端徽章显示用，由模型 key 推导，保证列表接口单源） */
function brandOfModel(name: string): string {
  if (name === 'glm-night' || name.startsWith('ds-glm')) return '智谱';
  if (name === 'ark-code') return '豆包';
  if (name === 'deepseek-chat') return 'DeepSeek';
  if (name.startsWith('ds-qwen')) return '通义';
  if (name.startsWith('ds-kimi')) return 'Kimi';
  if (name.startsWith('ds-minimax')) return 'MiniMax';
  if (name.startsWith('ds-')) return '百炼';
  if (name.startsWith('gpt')) return 'OpenAI';
  if (name.startsWith('gemini')) return 'Google';
  if (name.startsWith('claude')) return 'Claude';
  return 'AI';
}

// ==================== 常量 ====================

const MODEL_MAX_OUTPUT = 32000;
const TIMEOUT_STREAM = 1800000;
const TIMEOUT_NORMAL = 180000;
const TIMEOUT_TEST  = 30000;
/** 上游流式响应字节空闲上限：任意字节（含心跳注释）都会重置 */
const TIMEOUT_STREAM_IDLE = 120000;

export const TOKEN_CONFIG = {
  OUTLINE: MODEL_MAX_OUTPUT,
  SCRIPT_EPISODE: MODEL_MAX_OUTPUT,
  STATE_ANALYSIS: Math.floor(MODEL_MAX_OUTPUT * 0.75),
  VALIDATION: MODEL_MAX_OUTPUT,
  PLOT_THREAD: MODEL_MAX_OUTPUT,
  FIX_ANALYSIS: MODEL_MAX_OUTPUT,
  DEFAULT: 8192,
};

export const RETRY_CONFIG = {
  maxRetries: 5,
  baseDelay: 2000,
  maxDelay: 45000,
  retryableErrors: [
    'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED',
    'EPIPE', 'EHOSTUNREACH', 'ENETUNREACH', 'EPROTO', 'ECONNABORTED',
    'socket hang up', 'network', 'fetch failed', 'socket disconnected',
    'connection reset', 'connection refused', 'tls', 'ssl', 'certificate',
    'overloaded', 'rate_limit', 'timeout', 'capacity', 'busy',
    '529', '429', '500', '502', '503', '504',
    'unexpected end', 'json', 'truncated', 'incomplete', 'parse', 'unexpected token',
  ],
};

const RETRYABLE_ERRORS_LOWER = RETRY_CONFIG.retryableErrors.map(e => e.toLowerCase());

export const SAFE_MAX_TOKENS = 8192;

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(createAbortError()); return; }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(createAbortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function createAbortError(): Error {
  const err = new Error('请求已取消');
  err.name = 'AbortError';
  return err;
}

function isAbortError(error: unknown): boolean {
  return (error as Error)?.name === 'AbortError' ||
    (error as Error)?.message === '请求已取消';
}

// ==================== 工具函数 ====================

function isMaxTokensError(error: Error): boolean {
  const msg = error.message?.toLowerCase() || '';
  return msg.includes('max_tokens') &&
    (msg.includes('invalid') || msg.includes('range') || msg.includes('exceed'));
}

function matchesRetryablePatterns(str: string): boolean {
  const lower = str.toLowerCase();
  return RETRYABLE_ERRORS_LOWER.some(e => lower.includes(e));
}

/** 归一未知抛出值为 Error（保留原始消息） */
function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'string') return new Error(error);
  if (error && typeof error === 'object' && 'message' in (error as any)) return new Error(String((error as any).message));
  return new Error(String(error ?? '未知错误'));
}

/** 标记：已对消费者发出部分内容后失败——禁止透明重试，避免重复追加内容 */
function markNonRetryable(error: unknown): void {
  try { (normalizeError(error) as any).nonRetryable = true; (error as any).nonRetryable = true; } catch { /* 非对象 */ }
}

function isRetryableError(error: Error): boolean {
  if ((error as any).nonRetryable) return false;
  if (isAbortError(error)) return false;
  if ((error as any).forceRetryable) return true;
  if (matchesRetryablePatterns(error.message || '')) return true;

  const cause = (error as any).cause;
  if (cause) {
    if (matchesRetryablePatterns(cause.message || cause.code || '')) return true;
    if (cause.code && RETRYABLE_ERRORS_LOWER.includes(cause.code.toLowerCase())) return true;
  }

  const name = error.name?.toLowerCase() || '';
  return name.includes('network') || name.includes('timeout') || name.includes('fetch');
}

function getDetailedErrorMessage(error: Error): string {
  const parts: string[] = [error.message];
  const cause = (error as any).cause;
  if (cause) {
    if (cause.code) parts.push(`[${cause.code}]`);
    if (cause.message && cause.message !== error.message) parts.push(cause.message);
    if (cause.host) parts.push(`host=${cause.host}`);
  }
  return parts.join(' | ');
}

function isRateLimitError(error: Error): boolean {
  const msg = error.message?.toLowerCase() || '';
  return msg.includes('rate_limit') || msg.includes('429') ||
    msg.includes('concurrency') || msg.includes('too many');
}

function getRetryDelay(attempt: number, isRateLimit: boolean = false): number {
  if (isRateLimit) {
    return 30000 * Math.pow(2, attempt) + Math.random() * 5000;
  }
  return Math.min(RETRY_CONFIG.baseDelay * Math.pow(2, attempt), RETRY_CONFIG.maxDelay) + Math.random() * 1000;
}

/** 带超时的流式 fetch：头超时独立；返回后用户中止仍联动到 body 读取，直到调用方 release */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  timeoutMessage: string,
  signal?: AbortSignal
): Promise<{ response: Response; release: () => void; abort: () => void }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const onOuterAbort = () => controller.abort();
  signal?.addEventListener('abort', onOuterAbort, { once: true });
  const release = () => {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onOuterAbort);
  };
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timeoutId); // 头时限结束；body 阶段由用户 signal 联动 + 调用方主动 abort
    return { response, release, abort: () => controller.abort() };
  } catch (error) {
    release();
    if ((error as Error).name === 'AbortError') {
      if (signal?.aborted) throw createAbortError();
      throw new Error(timeoutMessage);
    }
    throw error;
  }
}

const ERROR_BODY_READ_TIMEOUT = 30_000;

/**
 * 带总时限的非流式请求：超时覆盖响应头返回 + 响应体读取，
 * 防止"头已返回、体悬挂"绕过测试/普通调用时限。
 */
async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  timeoutMessage: string,
  signal?: AbortSignal
): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const onOuterAbort = () => controller.abort();
  signal?.addEventListener('abort', onOuterAbort, { once: true });
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { /* 非 JSON 响应体 */ }
    return { ok: response.ok, status: response.status, json, text };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      if (signal?.aborted) throw createAbortError();
      throw new Error(timeoutMessage);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onOuterAbort);
  }
}

interface UpstreamSSEOptions {
  /** 字节空闲上限：任意字节（含注释心跳）重置 */
  idleTimeoutMs: number;
  /** 流总时长上限（可选） */
  totalTimeoutMs?: number;
  idleMessage: string;
  totalMessage?: string;
  signal?: AbortSignal;
}

/**
 * 读取上游 SSE 流。
 * - 支持 CRLF、注释心跳、无空格冒号、多行 data、跨 chunk UTF-8、末尾 decoder flush
 * - onData 抛出异常会向上传播（绝不吞掉消费方回调异常）
 * - onData 返回 'terminal' 表示显式结束标记（如 message_stop）；'[DONE]' 自动识别
 * - EOF 之前未收到结束标记 => 抛出连接中断错误（不得视为成功）
 * - 超时取消不能伪装成正常 EOF
 */
async function readSSEStream(
  response: Response,
  onData: (data: string) => void | 'terminal' | Promise<void | 'terminal'>,
  opts: UpstreamSSEOptions
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法获取响应流');

  const decoder = new TextDecoder();
  let buffer = '';
  let sawTerminal = false;
  let abortedBySignal = false;
  let idleTimedOut = false;
  let totalTimedOut = false;

  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  const armIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleTimedOut = true;
      reader.cancel().catch(() => {});
    }, opts.idleTimeoutMs);
  };
  const totalTimer = opts.totalTimeoutMs
    ? setTimeout(() => {
        totalTimedOut = true;
        reader.cancel().catch(() => {});
      }, opts.totalTimeoutMs)
    : null;
  const onAbort = () => {
    abortedBySignal = true;
    reader.cancel().catch(() => {});
  };
  opts.signal?.addEventListener('abort', onAbort, { once: true });
  armIdleTimer();

  const dispatchEvent = async (block: string) => {
    const dataLines: string[] = [];
    for (const rawLine of block.split('\n')) {
      const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
      if (!line || line.startsWith(':')) continue; // 注释/心跳
      if (line.startsWith('event:')) continue;
      if (line.startsWith('data:')) {
        // 允许 'data:' 或 'data: ' 两种写法
        dataLines.push(line.slice(5).replace(/^ /, ''));
      }
    }
    if (dataLines.length === 0) return;
    const data = dataLines.join('\n').trim();
    if (!data) return;
    if (data === '[DONE]') {
      sawTerminal = true;
      return;
    }
    const result = await onData(data);
    if (result === 'terminal') sawTerminal = true;
  };

  try {
    while (true) {
      if (opts.signal?.aborted) { abortedBySignal = true; break; }
      const { done, value } = await reader.read();
      if (done) break;
      armIdleTimer();

      buffer += decoder.decode(value, { stream: true });
      // 规范行尾为 \n；末尾孤立 '\r' 保留下次再判（可能和下一块的 '\n' 组成 \r\n）
      let pendingCR = '';
      if (buffer.endsWith('\r')) { pendingCR = '\r'; buffer = buffer.slice(0, -1); }
      buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n') + pendingCR;
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';
      for (const block of blocks) {
        if (sawTerminal) break; // 同一 chunk 内终止帧之后的块不再派发
        if (abortedBySignal || idleTimedOut || totalTimedOut || opts.signal?.aborted) break;
        if (block.trim()) await dispatchEvent(block);
      }
      // 显式终止标记已到：不必等待 socket EOF（保持打开的连接不应悬挂）
      if (sawTerminal) {
        try { await reader.cancel(); } catch { /* 忽略 */ }
        break;
      }
    }
    // 处理残余帧前先检查取消/超时：预取消的 reader 不应继续派发
    if (abortedBySignal || idleTimedOut || totalTimedOut) {
      try { await reader.cancel(); } catch { /* 忽略 */ }
    } else if (!sawTerminal) {
      // 最终 flush：decoder 尾部字节 + 缓冲区残余 block
      buffer += decoder.decode();
      for (const block of buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n\n')) {
        if (block.trim()) await dispatchEvent(block);
      }
    }
  } catch (error) {
    try { await reader.cancel(); } catch { /* 忽略 */ }
    throw error;
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
    if (totalTimer) clearTimeout(totalTimer);
    opts.signal?.removeEventListener('abort', onAbort);
    try { reader.releaseLock(); } catch { /* 忽略 */ }
  }

  if (abortedBySignal || opts.signal?.aborted) throw createAbortError();
  if (idleTimedOut) throw new Error(opts.idleMessage);
  if (totalTimedOut) throw new Error(opts.totalMessage || 'timeout: AI流式请求超时');
  if (!sawTerminal) throw new Error('连接中断：上游响应未收到结束标记');
}

function buildOpenAIMessages(systemPrompt: string, userPrompt: string): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });
  return messages;
}

function buildClaudePrompt(systemPrompt: string, userPrompt: string): string {
  return systemPrompt ? `${systemPrompt}\n\n---\n\n${userPrompt}` : userPrompt;
}

function extractOpenAIContent(data: Record<string, unknown>): string {
  const choices = data.choices as Array<{ message?: { content?: string; reasoning_content?: string } }> | undefined;
  if (choices?.[0]?.message) {
    const message = choices[0].message;
    if (!message.content && message.reasoning_content) {
      logger.warn(`[OpenAI] 模型只返回了思考过程，没有最终回答`, {
        reasoning_length: message.reasoning_content.length
      });
    }
    return message.content || '';
  }
  if (data.content) {
    const c = data.content;
    return typeof c === 'string' ? c : (c as Array<{ text?: string }>)?.[0]?.text || '';
  }
  if (data.response) return data.response as string;
  if (data.text) return data.text as string;
  if (data.output) return data.output as string;
  return '';
}

function hasOpenAIResponseContent(data: Record<string, unknown>): boolean {
  const choices = data.choices as Array<{ message?: { content?: string; reasoning_content?: string } }> | undefined;
  if (choices?.[0]?.message) {
    const msg = choices[0].message;
    if (msg.content || msg.reasoning_content) return true;
  }
  return !!(data.content || data.response || data.text || data.output);
}

// OpenAI 流式生成中的思考过程检测
const THINKING_PATTERNS = [
  /^\*\*[A-Za-z]/,
  /^I'm |^I've |^I am |^I need to |^I should |^I will |^I'll /i,
  /^Let me |^Let's think|^Now I |^Okay,? let|^Here's my|^First,? I/i,
  /^Looking at |^Considering |^Thinking about|^Analyzing the/i,
  /^Wait,? let|^Hmm,? |^Actually,? I|^Well,? I/i,
];

function isThinkingPattern(text: string): boolean {
  const trimmed = text.trim();
  if (/[\u4e00-\u9fa5]/.test(trimmed)) return false;
  return THINKING_PATTERNS.some(pattern => pattern.test(trimmed));
}

function isRealContent(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/[\u4e00-\u9fa5]/.test(trimmed)) return true;
  if (/^(第|场景|内景|外景|日|夜|INT\.|EXT\.)/.test(trimmed)) return true;
  if (/^[\[{]/.test(trimmed)) return true;
  if (/^#+\s*[\u4e00-\u9fa5]/.test(trimmed)) return true;
  return false;
}

// ==================== AIClient 类 ====================

export class AIClient {
  private claudeClient: Anthropic | null = null;
  private static instance: AIClient | null = null;

  constructor() {
    if (AIClient.instance) return;
    this.initClaudeClient();
    const config = this.getCurrentConfig();
    console.log(`[AI] 初始化客户端: provider=${config.provider}, model=${config.model}`);
  }

  static getInstance(): AIClient {
    initDefaultModel();
    if (!AIClient.instance) {
      AIClient.instance = new AIClient();
    }
    return AIClient.instance;
  }

  private initClaudeClient(): void {
    const apiKey = getCurrentClaudeApiKey();
    if (!apiKey) return;
    const claudeModel = Object.values(getModelConfigs()).find(c => c.provider === 'claude');
    if (claudeModel) {
      this.claudeClient = new Anthropic({ apiKey, baseURL: claudeModel.baseUrl });
    }
  }

  private tryRotateClaudeKey(): void {
    if (this.getCurrentConfig().provider === 'claude' && CLAUDE_API_KEYS.length > 1) {
      rotateClaudeApiKey();
      this.initClaudeClient();
    }
  }

  getCurrentConfig(): ModelConfig {
    return resolveKnownConfig(resolveModelName());
  }

  getAvailableModels(): Array<{ name: string; displayName: string; provider: AIProvider; brand: string; model: string; configured: boolean; unavailableReason?: string }> {
    return Object.values(getModelConfigs()).map(c => ({
      name: c.name, displayName: displayNameFor(c), provider: c.provider, brand: brandOfModel(c.name),
      model: c.model, configured: isModelConfigComplete(c),
      unavailableReason: modelUnavailableReason(c) ?? undefined,
    }));
  }

  getCurrentModelName(): string {
    return resolveModelName();
  }

  /** 按注册名检查模型是否完整配置（供路由校验显式指定的模型） */
  isModelConfigured(modelName: string): boolean {
    return isModelConfigComplete(getModelConfigs()[modelName]);
  }

  switchModel(modelName: string): boolean {
    const configs = getModelConfigs();
    if (!configs[modelName]) {
      logger.error(`未知模型: ${modelName}`, new Error(`Unknown model: ${modelName}`), { method: 'switchModel' });
      return false;
    }
    // 未完整配置的模型不可切换——防止"切换成功但所有生成失败"的假可用状态
    if (!isModelConfigComplete(configs[modelName])) {
      logger.error(`模型未完整配置: ${modelName}`, new Error(`Model not configured: ${modelName}`), { method: 'switchModel' });
      return false;
    }
    currentModelName = modelName;
    persistModel(modelName);
    const config = configs[modelName];
    console.log(`[AI] 切换到模型: ${config.displayName} (${config.model})`);
    return true;
  }

  /**
   * 测试指定（或当前）模型连通性。
   * 直接按目标配置发请求，不修改全局模型选择、不持久化；
   * 与并发的合法切换互不影响。
   */
  async testModel(modelName?: string): Promise<{ success: boolean; message: string; latency?: number }> {
    const configs = getModelConfigs();
    const targetModel = modelName || resolveModelName();
    const config = configs[targetModel];

    if (!config) {
      return { success: false, message: `未知模型: ${targetModel}` };
    }
    const unavailable = modelUnavailableReason(config);
    if (unavailable) {
      return { success: false, message: `${displayNameFor(config)} ${unavailable}` };
    }

    const startTime = Date.now();

    try {
      let success: boolean;
      let message: string;

      if (config.provider === 'openai') {
        const result = await this.testOpenAIConnection(config);
        success = result.success;
        message = result.success ? `${displayNameFor(config)} 连接正常` : result.message;
      } else {
        const result = await this.testClaudeConnection(config);
        success = result.success;
        message = result.success ? `${displayNameFor(config)} 连接正常` : result.message;
      }

      return { success, message, ...(success ? { latency: Date.now() - startTime } : {}) };
    } catch (error) {
      const err = error as Error;
      logger.error(`测试模型失败: ${targetModel}`, err, { method: 'testModel' });
      return { success: false, message: `连接失败: ${err.message.slice(0, 100)}` };
    }
  }

  private async testOpenAIConnection(config: ModelConfig): Promise<{ success: boolean; message: string }> {
    try {
      const { ok, status, json } = await fetchJsonWithTimeout(
        `${config.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
          body: JSON.stringify({
            model: config.model, max_tokens: 100,
            messages: [{ role: 'user', content: '请直接回复"OK"两个字母。' }],
            ...(config.extraBody || {}),
          }),
        },
        TIMEOUT_TEST, '连接超时'
      );

      if (!ok) return { success: false, message: `API错误: ${status}` };

      const data = json as Record<string, unknown>;
      return hasOpenAIResponseContent(data)
        ? { success: true, message: '连接正常' }
        : { success: false, message: '模型返回空响应' };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }

  private async testClaudeConnection(config: ModelConfig): Promise<{ success: boolean; message: string }> {
    try {
      const { ok, status, json } = await fetchJsonWithTimeout(
        `${config.baseUrl}/v1/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: 50,
            messages: [{ role: 'user', content: '请直接回复"OK"两个字母。' }],
          }),
        },
        TIMEOUT_TEST, '连接超时'
      );

      if (!ok) return { success: false, message: `API错误: ${status}` };

      const data = json as { content?: Array<{ type: string; text?: string }> };
      const hasText = !!data?.content?.find(block => block.type === 'text' && block.text);
      return hasText
        ? { success: true, message: '连接正常' }
        : { success: false, message: '模型返回空响应' };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }

  async withRetry<T>(fn: () => Promise<T>, operationName: string = 'AI调用', signal?: AbortSignal): Promise<T> {
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      if (signal?.aborted) throw createAbortError();
      try {
        return await fn();
      } catch (error) {
        lastError = normalizeError(error);
        const rateLimit = isRateLimitError(lastError);

        if (attempt === RETRY_CONFIG.maxRetries || !isRetryableError(lastError)) {
          logger.error(`${operationName} 最终失败`, lastError, {
            method: 'withRetry',
            additionalInfo: { 尝试次数: attempt + 1, 是否速率限制: rateLimit },
          });
          throw lastError;
        }

        if (rateLimit) this.tryRotateClaudeKey();

        const delay = getRetryDelay(attempt, rateLimit);
        logger.warn(`${operationName} 失败，${Math.round(delay / 1000)}秒后重试`, {
          尝试: `${attempt + 1}/${RETRY_CONFIG.maxRetries + 1}`,
          错误: getDetailedErrorMessage(lastError),
        });
        await sleep(delay, signal);
      }
    }
    throw lastError;
  }

  async withMaxTokensFallback<T>(
    fn: (maxTokens: number) => Promise<T>,
    requestedMaxTokens: number,
    operationName: string = 'AI调用'
  ): Promise<T> {
    try {
      return await fn(requestedMaxTokens);
    } catch (error) {
      const err = error as Error;
      if (isMaxTokensError(err) && requestedMaxTokens > SAFE_MAX_TOKENS) {
        logger.warn(`${operationName} max_tokens 超限，降级到 ${SAFE_MAX_TOKENS}`, {
          原始值: requestedMaxTokens, 降级值: SAFE_MAX_TOKENS,
        });
        return await fn(SAFE_MAX_TOKENS);
      }
      throw err;
    }
  }

  async generateStream(
    systemPrompt: string,
    userPrompt: string,
    callbacks: AIStreamCallbacks,
    maxTokens?: number,
    signal?: AbortSignal
  ): Promise<string> {
    signal = signal ?? currentRequestSignal();
    if (signal?.aborted) { const e = createAbortError(); callbacks.onError?.(e); throw e; }
    // 在调用开始时固定模型配置：其他并发切换不影响本次生成（含重试）
    const config = this.getCurrentConfig();
    const unavailable = modelUnavailableReason(config);
    if (unavailable) {
      const err = new Error(`当前模型 ${displayNameFor(config)} ${unavailable}，请先配置或切换模型`);
      callbacks.onError?.(err);
      throw err;
    }
    if (config.provider === 'openai') {
      return this.generateStreamOpenAI(systemPrompt, userPrompt, callbacks, maxTokens, config, signal);
    }
    return this.generateStreamClaude(systemPrompt, userPrompt, callbacks, maxTokens, config, signal);
  }

  private async generateStreamClaude(
    systemPrompt: string,
    userPrompt: string,
    callbacks: AIStreamCallbacks,
    maxTokens: number | undefined,
    config: ModelConfig,
    signal?: AbortSignal
  ): Promise<string> {
    try {
      const fullText = await this.withRetry(async () => {
        let fullText = '';
        let emitted = false;
        const emit = (text: string) => { emitted = true; callbacks.onChunk?.(text); };
        const effectiveMaxTokens = maxTokens || TOKEN_CONFIG.DEFAULT;

        logger.info(`[Claude] 开始流式生成`, { 模型: config.model, MaxTokens: effectiveMaxTokens });

        const { response, release, abort } = await fetchWithTimeout(
          `${config.baseUrl}/v1/messages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': config.apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: config.model,
              max_tokens: effectiveMaxTokens,
              stream: true,
              messages: [{ role: 'user', content: buildClaudePrompt(systemPrompt, userPrompt) }],
            }),
          },
          TIMEOUT_STREAM, 'timeout: AI流式请求超时（30分钟）', signal
        );

        try {
        if (!response.ok) {
          // 有界错误体：30s 截止或用户中止都会解除读取
          let errorText = '';
          const dl = setTimeout(() => abort(), ERROR_BODY_READ_TIMEOUT);
          try { errorText = await response.text(); } catch { /* 中止/超时 */ }
          clearTimeout(dl);
          release();
          throw new Error(`${response.status} ${errorText}`);
        }

        try {
          await readSSEStream(response, (data) => {
            const parsed = JSON.parse(data); // 解析失败向上传播（重试/失败语义统一）
            if (parsed.type === 'error') {
              const msg = parsed.error?.message || parsed.message || '上游流式响应返回错误';
              throw new Error(String(msg));
            }
            if (parsed.type === 'message_stop') return 'terminal';
            if (parsed.type === 'message_delta' && parsed.delta?.stop_reason === 'max_tokens') {
              const err = new Error('生成内容达到长度上限被截断');
              markNonRetryable(err);
              throw err;
            }
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              fullText += parsed.delta.text;
              emit(parsed.delta.text);
            }
          }, {
            idleTimeoutMs: TIMEOUT_STREAM_IDLE,
            totalTimeoutMs: TIMEOUT_STREAM,
            idleMessage: 'AI 流式响应超时（120秒无数据）',
            totalMessage: 'timeout: AI流式请求超时（30分钟）',
            signal,
          });
        } catch (error) {
          const norm = normalizeError(error);
          if (emitted) markNonRetryable(norm);
          throw norm;
        }

        if (!fullText.trim()) {
          const err = new Error('模型未返回有效内容（空响应或仅思考过程）');
          markNonRetryable(err);
          throw err;
        }
        } finally {
          release(); // 流读毕/失败均解除 signal 联动
        }

        return fullText;
      }, 'Claude流式生成', signal);
      // 完成回调在重试循环外：回调失败不触发提供者重试/重复分块
      await callbacks.onComplete?.(fullText);
      return fullText;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      callbacks.onError?.(err);
      throw err;
    }
  }

  private async generateStreamOpenAI(
    systemPrompt: string,
    userPrompt: string,
    callbacks: AIStreamCallbacks,
    maxTokens: number | undefined,
    config: ModelConfig,
    signal?: AbortSignal
  ): Promise<string> {
    try {
      const fullText = await this.withRetry(async () => {
        let fullText = '';
        let reasoningText = '';
        let contentStarted = false;
        let pendingContent = '';
        let emitted = false;
        const emit = (text: string) => { emitted = true; callbacks.onChunk?.(text); };
        const effectiveMaxTokens = maxTokens || TOKEN_CONFIG.DEFAULT;

        logger.info(`[OpenAI] 开始流式生成`, { 模型: config.model, MaxTokens: effectiveMaxTokens });

        const { response, release, abort } = await fetchWithTimeout(
          `${config.baseUrl}/chat/completions`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
              model: config.model,
              max_tokens: effectiveMaxTokens,
              stream: true,
              messages: buildOpenAIMessages(systemPrompt, userPrompt),
              ...(config.extraBody || {}),
            }),
          },
          TIMEOUT_STREAM, 'timeout: AI流式请求超时（30分钟）', signal
        );

        try {
        if (!response.ok) {
          // 有界错误体：30s 截止或用户中止都会解除读取
          let errorText = '';
          const dl = setTimeout(() => abort(), ERROR_BODY_READ_TIMEOUT);
          try { errorText = await response.text(); } catch { /* 中止/超时 */ }
          clearTimeout(dl);
          release();
          throw new Error(`${response.status} ${errorText}`);
        }

        try {
          await readSSEStream(response, (data) => {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              const errObj = parsed.error as { message?: string; type?: string };
              throw new Error(errObj?.message || '上游流式响应返回错误');
            }
            const choice = parsed.choices?.[0];
            if (choice?.finish_reason === 'length') {
              const err = new Error('生成内容达到长度上限被截断');
              markNonRetryable(err);
              throw err;
            }
            const delta = choice?.delta;

            if (delta?.reasoning_content) {
              reasoningText += delta.reasoning_content;
              return choice?.finish_reason ? 'terminal' : undefined;
            }

            const content = delta?.content;
            if (content) {
              if (contentStarted) {
                fullText += content;
                emit(content);
              } else {
                pendingContent += content;
                if (pendingContent.length >= 20 || pendingContent.includes('\n')) {
                  if (isRealContent(pendingContent)) {
                    contentStarted = true;
                    fullText += pendingContent;
                    emit(pendingContent);
                    pendingContent = '';
                  } else if (isThinkingPattern(pendingContent)) {
                    reasoningText += pendingContent;
                    pendingContent = '';
                  }
                }
              }
            }
            return choice?.finish_reason ? 'terminal' : undefined;
          }, {
            idleTimeoutMs: TIMEOUT_STREAM_IDLE,
            totalTimeoutMs: TIMEOUT_STREAM,
            idleMessage: 'AI 流式响应超时（120秒无数据）',
            totalMessage: 'timeout: AI流式请求超时（30分钟）',
            signal,
          });
        } catch (error) {
          const norm = normalizeError(error);
          if (emitted) markNonRetryable(norm);
          throw norm;
        }

        // 处理剩余的缓冲内容
        if (pendingContent) {
          if (!isThinkingPattern(pendingContent)) {
            fullText += pendingContent;
            emit(pendingContent);
          } else {
            reasoningText += pendingContent;
          }
        }

        if (!fullText.trim()) {
          logger.warn(`[OpenAI] 流式生成只有思考过程或空内容`, { reasoningLength: reasoningText.length });
          const err = new Error('模型未返回有效内容（空响应或仅思考过程）');
          markNonRetryable(err);
          throw err;
        }

        logger.info(`[OpenAI] 流式生成完成`, {
          contentLength: fullText.length,
          reasoningLength: reasoningText.length
        });
        } finally {
          release(); // 流读毕/失败均解除 signal 联动
        }

        return fullText;
      }, 'OpenAI流式生成', signal);
      await callbacks.onComplete?.(fullText);
      return fullText;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      callbacks.onError?.(err);
      throw err;
    }
  }

  async generate(systemPrompt: string, userPrompt: string, maxTokens?: number, signal?: AbortSignal): Promise<string> {
    signal = signal ?? currentRequestSignal();
    if (signal?.aborted) throw createAbortError();
    // 在调用开始时固定模型配置（含重试）
    const config = this.getCurrentConfig();
    const unavailable = modelUnavailableReason(config);
    if (unavailable) {
      throw new Error(`当前模型 ${displayNameFor(config)} ${unavailable}，请先配置或切换模型`);
    }
    if (config.provider === 'openai') {
      return this.generateOpenAI(systemPrompt, userPrompt, maxTokens, config, signal);
    }
    return this.generateClaude(systemPrompt, userPrompt, maxTokens, config, signal);
  }

  private async generateClaude(systemPrompt: string, userPrompt: string, maxTokens: number | undefined, config: ModelConfig, signal?: AbortSignal): Promise<string> {
    return this.withRetry(async () => {
      const effectiveMaxTokens = maxTokens || TOKEN_CONFIG.DEFAULT;

      const { ok, status, json, text: errorText } = await fetchJsonWithTimeout(
        `${config.baseUrl}/v1/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: effectiveMaxTokens,
            messages: [{ role: 'user', content: buildClaudePrompt(systemPrompt, userPrompt) }],
          }),
        },
        TIMEOUT_NORMAL, 'timeout: AI请求超时（3分钟）', signal
      );

      if (!ok) throw new Error(`${status} ${errorText}`);

      const data = json as { content?: Array<{ type: string; text?: string; stop_reason?: string }>; stop_reason?: string };
      if (data.stop_reason === 'max_tokens') {
        const err = new Error('生成内容达到长度上限被截断');
        markNonRetryable(err);
        throw err;
      }
      const textBlock = data.content?.find((block: { type: string }) => block.type === 'text');
      if (!textBlock?.text?.trim()) {
        const err = new Error('模型未返回有效内容（空响应或仅思考过程）');
        markNonRetryable(err);
        throw err;
      }
      return textBlock.text;
    }, 'Claude非流式生成', signal);
  }

  private async generateOpenAI(systemPrompt: string, userPrompt: string, maxTokens: number | undefined, config: ModelConfig, signal?: AbortSignal): Promise<string> {
    return this.withRetry(async () => {
      const effectiveMaxTokens = maxTokens || TOKEN_CONFIG.DEFAULT;

      logger.info(`[OpenAI] 开始非流式生成`, {
        模型: config.model, baseUrl: config.baseUrl, MaxTokens: effectiveMaxTokens
      });

      const { ok, status, json, text: errorText } = await fetchJsonWithTimeout(
        `${config.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: effectiveMaxTokens,
            messages: buildOpenAIMessages(systemPrompt, userPrompt),
            ...(config.extraBody || {}),
          }),
        },
        TIMEOUT_NORMAL, 'timeout: AI请求超时（3分钟）', signal
      );

      if (!ok) {
        logger.error(`[OpenAI] API 响应错误`, new Error(`${status}`), {
          method: 'generateOpenAI',
          additionalInfo: { status, errorText: safeStringify(errorText, 500) },
        });
        throw new Error(`${status} ${errorText}`);
      }

      const data = json as Record<string, unknown>;
      logger.info(`[OpenAI] 原始响应`, { data: safeStringify(data, 500) });

      const finishReason = (data?.choices as Array<{ finish_reason?: string }> | undefined)?.[0]?.finish_reason;
      if (finishReason === 'length') {
        const err = new Error('生成内容达到长度上限被截断');
        markNonRetryable(err);
        throw err;
      }

      const content = extractOpenAIContent(data);
      if (content && content.trim()) {
        logger.info(`[OpenAI] 非流式生成完成`, { 长度: content.length });
        return content;
      }

      logger.warn(`[OpenAI] 无法解析响应内容`, { data: safeStringify(data, 500) });
      const err = new Error('模型未返回有效内容（空响应或仅思考过程）');
      markNonRetryable(err);
      throw err;
    }, 'OpenAI非流式生成', signal);
  }

  async generateSingleEpisodeWithRetry(
    epNum: number,
    systemPrompt: string,
    userMessage: string,
    onChunk: ((chunk: string) => void) | null,
    onRetry: ((attempt: number, errorMessage: string) => void) | null,
    maxTokens: number = TOKEN_CONFIG.SCRIPT_EPISODE
  ): Promise<{ success: boolean; content?: string; error?: string; attempts: number }> {
    const MAX_EPISODE_RETRIES = 3;

    for (let attempt = 0; attempt <= MAX_EPISODE_RETRIES; attempt++) {
      try {
        let fullContent = '';

        await this.generateStream(systemPrompt, userMessage, {
          onChunk: (chunk) => {
            fullContent += chunk;
            if (onChunk) onChunk(chunk);
          },
        }, maxTokens);

        if (!fullContent || fullContent.length < 100) {
          throw new Error(`生成内容过短（${fullContent.length}字符）`);
        }

        return { success: true, content: fullContent, attempts: attempt + 1 };
      } catch (error) {
        const err = error as Error;
        console.error(`[AI] 第${epNum}集生成失败（尝试 ${attempt + 1}/${MAX_EPISODE_RETRIES + 1}）:`, err.message);

        if (attempt === MAX_EPISODE_RETRIES) {
          return { success: false, error: err.message, attempts: attempt + 1 };
        }

        const rateLimit = isRateLimitError(err);
        if (onRetry) {
          onRetry(attempt + 1, rateLimit ? `${err.message}（速率限制）` : err.message);
        }

        if (rateLimit) this.tryRotateClaudeKey();
        await sleep(getRetryDelay(attempt, rateLimit));
      }
    }

    return { success: false, error: '未知错误', attempts: MAX_EPISODE_RETRIES + 1 };
  }

  async generateBatch(
    items: Array<{ systemPrompt: string; userPrompt: string; id: string | number }>,
    maxTokens: number = TOKEN_CONFIG.DEFAULT,
    onProgress?: (current: number, total: number, item: string | number) => void
  ): Promise<Array<{ id: string | number; content: string; success: boolean; error?: string }>> {
    const results: Array<{ id: string | number; content: string; success: boolean; error?: string }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (onProgress) onProgress(i + 1, items.length, item.id);

      try {
        const content = await this.generate(item.systemPrompt, item.userPrompt, maxTokens);
        results.push({ id: item.id, content, success: true });
      } catch (error) {
        results.push({ id: item.id, content: '', success: false, error: (error as Error).message });
      }

      if (i < items.length - 1) await sleep(1000);
    }

    return results;
  }
}

// 导出单例
export const aiClient = AIClient.getInstance();
