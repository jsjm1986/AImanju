/**
 * 共享工具函数
 */

import { IOutline } from '../models/Project';

/**
 * 从大纲数据获取原始内容
 * 支持字符串和对象两种格式
 */
export function getOutlineRaw(outline: string | IOutline | undefined): string {
  if (!outline) return '';
  if (typeof outline === 'string') return outline;
  return outline.raw || '';
}
