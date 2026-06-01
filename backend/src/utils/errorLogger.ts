/**
 * 增强的错误日志工具
 * 提供统一的错误记录、格式化和调试信息
 */

/**
 * 错误上下文信息
 */
export interface ErrorContext {
  module: string;           // 模块名称
  method: string;           // 方法名称
  operation?: string;       // 具体操作
  input?: unknown;          // 输入数据（会被截断）
  additionalInfo?: Record<string, unknown>;  // 额外信息
}

/**
 * 格式化错误信息
 */
export function formatError(error: unknown, context: ErrorContext): string {
  const err = error instanceof Error ? error : new Error(String(error));
  
  const lines: string[] = [
    `[${context.module}] ❌ 错误发生在 ${context.method}`,
  ];

  if (context.operation) {
    lines.push(`  操作: ${context.operation}`);
  }

  lines.push(`  错误类型: ${err.name}`);
  lines.push(`  错误信息: ${err.message}`);

  if (context.input !== undefined) {
    const inputStr = safeStringify(context.input, 200);
    lines.push(`  输入数据: ${inputStr}`);
  }

  if (context.additionalInfo) {
    for (const [key, value] of Object.entries(context.additionalInfo)) {
      const valueStr = safeStringify(value, 100);
      lines.push(`  ${key}: ${valueStr}`);
    }
  }

  if (err.stack) {
    // 只取前3行堆栈
    const stackLines = err.stack.split('\n').slice(1, 4);
    lines.push(`  堆栈:`);
    stackLines.forEach(line => lines.push(`    ${line.trim()}`));
  }

  return lines.join('\n');
}

/**
 * 安全地将值转换为字符串（带截断）
 */
export function safeStringify(value: unknown, maxLength: number = 200): string {
  try {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    
    let str: string;
    if (typeof value === 'string') {
      str = value;
    } else if (typeof value === 'object') {
      str = JSON.stringify(value);
    } else {
      str = String(value);
    }

    if (str.length > maxLength) {
      return str.substring(0, maxLength) + `...(共${str.length}字符)`;
    }
    return str;
  } catch (e) {
    return `[无法序列化: ${(e as Error).message}]`;
  }
}

/**
 * 记录错误并返回格式化的消息
 */
export function logError(error: unknown, context: ErrorContext): string {
  const formatted = formatError(error, context);
  console.error(formatted);
  return formatted;
}

/**
 * 验证对象字段是否存在
 * 返回缺失字段列表
 */
export function validateFields<T extends object>(
  obj: T | null | undefined,
  requiredFields: (keyof T)[],
  context: string
): string[] {
  const missing: string[] = [];
  
  if (!obj) {
    console.warn(`[${context}] 对象为空，所有字段缺失: ${requiredFields.join(', ')}`);
    return requiredFields.map(String);
  }

  for (const field of requiredFields) {
    if (obj[field] === undefined || obj[field] === null) {
      missing.push(String(field));
    }
  }

  if (missing.length > 0) {
    console.warn(`[${context}] 缺失字段: ${missing.join(', ')}`);
  }

  return missing;
}

/**
 * 安全访问嵌套属性
 */
export function safeGet<T>(
  obj: unknown,
  path: string,
  defaultValue: T
): T {
  try {
    const keys = path.split('.');
    let current: unknown = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined) {
        return defaultValue;
      }
      current = (current as Record<string, unknown>)[key];
    }
    
    return (current as T) ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * 包装异步函数，自动捕获并记录错误
 */
export function withErrorLogging<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  context: Omit<ErrorContext, 'input'>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(error, {
        ...context,
        input: args.length === 1 ? args[0] : args,
      });
      throw error;
    }
  };
}

/**
 * 创建带模块前缀的日志器
 */
export function createLogger(moduleName: string) {
  return {
    info: (message: string, data?: unknown) => {
      console.log(`[${moduleName}] ${message}`, data !== undefined ? safeStringify(data, 300) : '');
    },
    warn: (message: string, data?: unknown) => {
      console.warn(`[${moduleName}] ⚠️ ${message}`, data !== undefined ? safeStringify(data, 300) : '');
    },
    error: (message: string, error?: unknown, context?: Partial<ErrorContext>) => {
      if (error) {
        logError(error, {
          module: moduleName,
          method: context?.method || 'unknown',
          operation: message,
          ...context,
        });
      } else {
        console.error(`[${moduleName}] ❌ ${message}`);
      }
    },
    debug: (message: string, data?: unknown) => {
      if (process.env.DEBUG) {
        console.log(`[${moduleName}] 🔍 ${message}`, data !== undefined ? safeStringify(data, 500) : '');
      }
    },
  };
}

export default {
  formatError,
  logError,
  safeStringify,
  validateFields,
  safeGet,
  withErrorLogging,
  createLogger,
};
