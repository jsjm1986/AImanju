/**
 * 文档控制器 - 提供工程文档API
 * 支持所有 /docs 目录下的文档
 */

import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

// 文档映射表（优先级最高）
const DOCS_MAP: Record<string, { file: string; title: string; description: string }> = {
  'engineering': {
    file: '剧本生成系统工程说明.md',
    title: '剧本生成系统工程说明',
    description: '系统架构、核心功能、AI驱动约束决策等完整工程说明',
  },
  'workflow': {
    file: '业务流程图.md',
    title: '业务流程图',
    description: '生成流程时序图、详细执行步骤、WorldState管理、SSE消息对照表',
  },
  'logic': {
    file: '剧本生成业务逻辑设计.md',
    title: '剧本生成业务逻辑设计',
    description: '核心数据模型、业务逻辑设计、生成流程详解',
  },
  'cross-episode': {
    file: '跨集联动修复功能说明.md',
    title: '跨集联动修复功能说明',
    description: '跨集引用、前后关联修复、一致性校验功能',
  },
};

const DOCS_BASE_PATH = path.join(__dirname, '../../../docs');

function slugifyDocId(filename: string): string {
  const base = filename.replace(/\.md$/i, '');
  const id = base
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '');
  return id || base || 'doc';
}

function buildDocsMap(): Record<string, { file: string; title: string; description: string }> {
  const docsMap: Record<string, { file: string; title: string; description: string }> = { ...DOCS_MAP };

  try {
    const files = fs.readdirSync(DOCS_BASE_PATH);
    const mdFiles = files.filter((file) => file.toLowerCase().endsWith('.md'));

    for (const file of mdFiles) {
      // 已在映射表中的文件直接跳过（保持自定义标题与描述）
      const alreadyMapped = Object.values(docsMap).some((info) => info.file === file);
      if (alreadyMapped) continue;

      const id = slugifyDocId(file);
      let finalId = id;
      if (docsMap[finalId]) {
        // 避免ID冲突（确定性后缀）
        let suffix = 2;
        while (docsMap[`${finalId}-${suffix}`]) {
          suffix += 1;
        }
        finalId = `${finalId}-${suffix}`;
      }

      docsMap[finalId] = {
        file,
        title: file.replace(/\.md$/i, ''),
        description: '自动发现文档',
      };
    }
  } catch (error) {
    console.warn('[DocsController] 自动扫描docs目录失败:', error);
  }

  return docsMap;
}

/**
 * 获取可用文档列表
 */
export const getDocsList = async (_req: Request, res: Response) => {
  try {
    const docsMap = buildDocsMap();
    const docsList = Object.entries(docsMap).map(([id, info]) => {
      const docPath = path.join(DOCS_BASE_PATH, info.file);
      const exists = fs.existsSync(docPath);
      const stats = exists ? fs.statSync(docPath) : null;

      return {
        id,
        title: info.title,
        description: info.description,
        available: exists,
        lastModified: stats?.mtime || null,
        size: stats?.size || 0,
      };
    });

    res.json({
      success: true,
      docs: docsList,
    });
  } catch (error) {
    console.error('[DocsController] 获取文档列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取文档列表失败',
    });
  }
};

/**
 * 获取指定文档内容
 */
export const getDocContent = async (req: Request, res: Response) => {
  try {
    const { docId } = req.params;

    // 查找文档配置
    const docsMap = buildDocsMap();
    const docConfig = docsMap[docId];
    if (!docConfig) {
      return res.status(404).json({
        success: false,
        error: `未知的文档ID: ${docId}`,
        availableDocs: Object.keys(docsMap),
      });
    }

    // 文档路径
    const docPath = path.join(DOCS_BASE_PATH, docConfig.file);

    // 检查文件是否存在
    if (!fs.existsSync(docPath)) {
      return res.status(404).json({
        success: false,
        error: '文档不存在',
      });
    }

    // 读取文档内容
    const content = fs.readFileSync(docPath, 'utf-8');
    const stats = fs.statSync(docPath);

    res.json({
      success: true,
      id: docId,
      title: docConfig.title,
      description: docConfig.description,
      content,
      lastModified: stats.mtime,
      size: stats.size,
    });
  } catch (error) {
    console.error('[DocsController] 获取文档失败:', error);
    res.status(500).json({
      success: false,
      error: '获取文档失败',
    });
  }
};

/**
 * 兼容旧API - 获取工程流程文档
 */
export const getEngineeringDoc = async (req: Request, res: Response) => {
  req.params.docId = 'engineering';
  return getDocContent(req, res);
};
