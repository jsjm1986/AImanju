/**
 * 全局错误处理
 */

import { toast } from '@/composables/useToast';
import axios, { AxiosError } from 'axios';

interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

/**
 * 解析 API 错误
 */
export function parseApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiError>;

    // 网络错误
    if (!axiosError.response) {
      return '网络连接失败，请检查网络后重试';
    }

    const { status, data } = axiosError.response;

    // 根据状态码处理
    switch (status) {
      case 400:
        return data?.message || '请求参数错误';
      case 401:
        return '未授权，请重新登录';
      case 403:
        return '没有权限执行此操作';
      case 404:
        return data?.message || '请求的资源不存在';
      case 409:
        return data?.message || '数据冲突，请刷新后重试';
      case 422:
        return data?.message || '数据验证失败';
      case 429:
        return 'API 请求过于频繁，请稍后再试';
      case 500:
        return '服务器内部错误，请稍后重试';
      case 502:
      case 503:
      case 504:
        return '服务暂时不可用，请稍后重试';
      default:
        return data?.message || `请求失败 (${status})`;
    }
  }

  // 普通错误
  if (error instanceof Error) {
    return error.message;
  }

  // 未知错误
  return '发生未知错误';
}

/**
 * 处理错误并显示 Toast
 */
export function handleError(error: unknown, title?: string): void {
  const message = parseApiError(error);
  toast.error(message, title);
  console.error('[Error]', error);
}

/**
 * 创建安全的异步函数包装器
 */
export function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  errorTitle?: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, errorTitle);
      throw error;
    }
  }) as T;
}

import type { App } from 'vue';

/**
 * Vue 错误处理插件
 */
export function setupErrorHandling(app: App) {
  // 全局错误处理
  app.config.errorHandler = (err, _instance, info) => {
    console.error('[Vue Error]', info, err);
    handleError(err, 'Vue 错误');
  };

  // 未捕获的 Promise 错误
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Unhandled Promise]', event.reason);
    // 不显示 toast，因为可能是有意未处理的 promise
  });
}

/**
 * 重试函数
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delay?: number;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {}
): Promise<T> {
  const { maxRetries = 3, delay = 1000, onRetry } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        onRetry?.(attempt, error);
        await new Promise((resolve) => setTimeout(resolve, delay * attempt));
      }
    }
  }

  throw lastError;
}

export default {
  parseApiError,
  handleError,
  withErrorHandling,
  setupErrorHandling,
  withRetry,
};
