/**
 * AI服务 - 多模型支持 (Claude + OpenAI兼容格式)
 */

import Anthropic from '@anthropic-ai/sdk';
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
}

export interface AIStreamCallbacks {
  onChunk?: (text: string) => void;
  onComplete?: (fullText: string) => void;
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

function initDefaultModel(): void {
  if (currentModelName) return;
  currentModelName = process.env.DEFAULT_AI_PROVIDER === 'glm' ? 'glm-night' : 'ds-qwen35-plus';
}

// ==================== 常量 ====================

const MODEL_MAX_OUTPUT = 32000;
const TIMEOUT_STREAM = 1800000;
const TIMEOUT_NORMAL = 180000;
const TIMEOUT_TEST  = 30000;

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

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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

function isRetryableError(error: Error): boolean {
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

/** 带超时的 fetch，统一 AbortController 模式 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  timeoutMessage: string
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === 'AbortError') throw new Error(timeoutMessage);
    throw error;
  }
}

/** 读取 SSE 流并逐行回调 */
async function readSSEStream(
  response: Response,
  onLine: (data: string) => void,
  timeoutMs: number,
  timeoutMessage: string
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法获取响应流');

  const timeoutId = setTimeout(() => reader.cancel(), timeoutMs);
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data && data !== '[DONE]') onLine(data);
      }
    }

    if (buffer.trim() && buffer.startsWith('data: ')) {
      const data = buffer.slice(6).trim();
      if (data && data !== '[DONE]') onLine(data);
    }
    clearTimeout(timeoutId);
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === 'AbortError') throw new Error(timeoutMessage);
    throw error;
  }
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
    return getModelConfigs()[currentModelName];
  }

  getAvailableModels(): Array<{ name: string; displayName: string; provider: AIProvider }> {
    return Object.values(getModelConfigs()).map(c => ({
      name: c.name, displayName: c.displayName, provider: c.provider,
    }));
  }

  getCurrentModelName(): string {
    return currentModelName;
  }

  switchModel(modelName: string): boolean {
    const configs = getModelConfigs();
    if (!configs[modelName]) {
      logger.error(`未知模型: ${modelName}`, new Error(`Unknown model: ${modelName}`), { method: 'switchModel' });
      return false;
    }
    currentModelName = modelName;
    const config = configs[modelName];
    console.log(`[AI] 切换到模型: ${config.displayName} (${config.model})`);
    return true;
  }

  async testModel(modelName?: string): Promise<{ success: boolean; message: string; latency?: number }> {
    const configs = getModelConfigs();
    const targetModel = modelName || currentModelName;
    const config = configs[targetModel];

    if (!config) {
      return { success: false, message: `未知模型: ${targetModel}` };
    }

    const startTime = Date.now();
    const originalModel = currentModelName;
    if (modelName && modelName !== currentModelName) {
      currentModelName = targetModel;
    }

    try {
      let success: boolean;
      let message: string;

      if (config.provider === 'openai') {
        const result = await this.testOpenAIConnection(config);
        success = result.success;
        message = result.success ? `${config.displayName} 连接正常` : result.message;
      } else {
        const response = await this.generate('', '请回复"OK"两个字母。', 50);
        success = response.length > 0;
        message = success ? `${config.displayName} 连接正常` : '模型返回空响应';
      }

      return { success, message, ...(success ? { latency: Date.now() - startTime } : {}) };
    } catch (error) {
      const err = error as Error;
      logger.error(`测试模型失败: ${targetModel}`, err, { method: 'testModel' });
      return { success: false, message: `连接失败: ${err.message.slice(0, 100)}` };
    } finally {
      if (modelName && modelName !== originalModel) {
        currentModelName = originalModel;
      }
    }
  }

  private async testOpenAIConnection(config: ModelConfig): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetchWithTimeout(
        `${config.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
          body: JSON.stringify({
            model: config.model, max_tokens: 100,
            messages: [{ role: 'user', content: '请直接回复"OK"两个字母。' }],
          }),
        },
        TIMEOUT_TEST, '连接超时'
      );

      if (!response.ok) return { success: false, message: `API错误: ${response.status}` };

      const data = await response.json() as Record<string, unknown>;
      return hasOpenAIResponseContent(data)
        ? { success: true, message: '连接正常' }
        : { success: false, message: '模型返回空响应' };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }

  async withRetry<T>(fn: () => Promise<T>, operationName: string = 'AI调用'): Promise<T> {
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
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
        await sleep(delay);
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
    maxTokens?: number
  ): Promise<string> {
    const config = this.getCurrentConfig();
    if (config.provider === 'openai') {
      return this.generateStreamOpenAI(systemPrompt, userPrompt, callbacks, maxTokens);
    }
    return this.generateStreamClaude(systemPrompt, userPrompt, callbacks, maxTokens);
  }

  private async generateStreamClaude(
    systemPrompt: string,
    userPrompt: string,
    callbacks: AIStreamCallbacks,
    maxTokens?: number
  ): Promise<string> {
    return this.withRetry(async () => {
      let fullText = '';
      const effectiveMaxTokens = maxTokens || TOKEN_CONFIG.DEFAULT;
      const config = this.getCurrentConfig();

      logger.info(`[Claude] 开始流式生成`, { 模型: config.model, MaxTokens: effectiveMaxTokens });

      const response = await fetchWithTimeout(
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
        TIMEOUT_STREAM, 'timeout: AI流式请求超时（30分钟）'
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status} ${errorText}`);
      }

      try {
        await readSSEStream(response, (data) => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              fullText += parsed.delta.text;
              callbacks.onChunk?.(parsed.delta.text);
            }
          } catch { /* ignore malformed SSE */ }
        }, TIMEOUT_STREAM, 'timeout: AI流式请求超时（30分钟）');
      } catch (error) {
        callbacks.onError?.(error as Error);
        throw error;
      }

      callbacks.onComplete?.(fullText);
      return fullText;
    }, 'Claude流式生成');
  }

  private async generateStreamOpenAI(
    systemPrompt: string,
    userPrompt: string,
    callbacks: AIStreamCallbacks,
    maxTokens?: number
  ): Promise<string> {
    return this.withRetry(async () => {
      let fullText = '';
      let reasoningText = '';
      let contentStarted = false;
      let pendingContent = '';
      const effectiveMaxTokens = maxTokens || TOKEN_CONFIG.DEFAULT;
      const config = this.getCurrentConfig();

      logger.info(`[OpenAI] 开始流式生成`, { 模型: config.model, MaxTokens: effectiveMaxTokens });

      const response = await fetchWithTimeout(
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
          }),
        },
        TIMEOUT_STREAM, 'timeout: AI流式请求超时（30分钟）'
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status} ${errorText}`);
      }

      try {
        await readSSEStream(response, (data) => {
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;

            if (delta?.reasoning_content) {
              reasoningText += delta.reasoning_content;
              return;
            }

            const content = delta?.content;
            if (!content) return;

            if (contentStarted) {
              fullText += content;
              callbacks.onChunk?.(content);
              return;
            }

            pendingContent += content;
            if (pendingContent.length < 20 && !pendingContent.includes('\n')) return;

            if (isRealContent(pendingContent)) {
              contentStarted = true;
              fullText += pendingContent;
              callbacks.onChunk?.(pendingContent);
              pendingContent = '';
            } else if (isThinkingPattern(pendingContent)) {
              reasoningText += pendingContent;
              pendingContent = '';
            }
          } catch { /* ignore */ }
        }, TIMEOUT_STREAM, 'timeout: AI流式请求超时（30分钟）');
      } catch (error) {
        callbacks.onError?.(error as Error);
        throw error;
      }

      // 处理剩余的缓冲内容
      if (pendingContent) {
        if (!isThinkingPattern(pendingContent)) {
          fullText += pendingContent;
          callbacks.onChunk?.(pendingContent);
        } else {
          reasoningText += pendingContent;
        }
      }

      if (!fullText && reasoningText) {
        logger.warn(`[OpenAI] 流式生成只有思考过程，没有最终内容`, {
          reasoningLength: reasoningText.length
        });
      }

      logger.info(`[OpenAI] 流式生成完成`, {
        contentLength: fullText.length,
        reasoningLength: reasoningText.length
      });

      callbacks.onComplete?.(fullText);
      return fullText;
    }, 'OpenAI流式生成');
  }

  async generate(systemPrompt: string, userPrompt: string, maxTokens?: number): Promise<string> {
    const config = this.getCurrentConfig();
    if (config.provider === 'openai') {
      return this.generateOpenAI(systemPrompt, userPrompt, maxTokens);
    }
    return this.generateClaude(systemPrompt, userPrompt, maxTokens);
  }

  private async generateClaude(systemPrompt: string, userPrompt: string, maxTokens?: number): Promise<string> {
    return this.withRetry(async () => {
      const effectiveMaxTokens = maxTokens || TOKEN_CONFIG.DEFAULT;
      const config = this.getCurrentConfig();

      const response = await fetchWithTimeout(
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
        TIMEOUT_STREAM, 'timeout: AI请求超时（30分钟）'
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status} ${errorText}`);
      }

      const data = await response.json() as { content?: Array<{ type: string; text?: string }> };
      const textBlock = data.content?.find((block: { type: string }) => block.type === 'text');
      return textBlock?.text || '';
    }, 'Claude非流式生成');
  }

  private async generateOpenAI(systemPrompt: string, userPrompt: string, maxTokens?: number): Promise<string> {
    return this.withRetry(async () => {
      const effectiveMaxTokens = maxTokens || TOKEN_CONFIG.DEFAULT;
      const config = this.getCurrentConfig();

      logger.info(`[OpenAI] 开始非流式生成`, {
        模型: config.model, baseUrl: config.baseUrl, MaxTokens: effectiveMaxTokens
      });

      const response = await fetchWithTimeout(
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
          }),
        },
        TIMEOUT_NORMAL, 'timeout: AI请求超时（3分钟）'
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[OpenAI] API 响应错误`, new Error(`${response.status}`), {
          method: 'generateOpenAI',
          additionalInfo: { status: response.status, errorText: safeStringify(errorText, 500) },
        });
        throw new Error(`${response.status} ${errorText}`);
      }

      const data = await response.json() as Record<string, unknown>;
      logger.info(`[OpenAI] 原始响应`, { data: safeStringify(data, 500) });

      const content = extractOpenAIContent(data);
      if (content) {
        logger.info(`[OpenAI] 非流式生成完成`, { 长度: content.length });
        return content;
      }

      logger.warn(`[OpenAI] 无法解析响应内容`, { data: safeStringify(data, 500) });
      return '';
    }, 'OpenAI非流式生成');
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
