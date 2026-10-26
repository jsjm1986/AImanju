/**
 * 修复控制器 - 验证问题修复 API
 */

import { Request, Response, Router } from 'express';
import mongoose from 'mongoose';
import { RewriteHistory } from '../models/RewriteHistory';
import { episodeRepository } from '../repositories/EpisodeRepository';
import { RewriteService } from '../services/rewrite/RewriteService';
import { protectProjectRouter } from '../middleware/projectAccess';

const router = Router();
protectProjectRouter(router, {
  references: {
    episodeId: (id) => episodeRepository.findById(id).then(d => d ? { projectId: (d as unknown as { projectId?: unknown }).projectId } : null),
    historyId: (id) => RewriteHistory.findById(id).select('projectId').exec(),
    masterHistoryId: (id) => RewriteHistory.findById(id).select('projectId').exec(),
  },
  arrays: {
    updates: { idField: 'foreshadowingId', load: async (id) => { const { Foreshadowing } = await import('../models/Foreshadowing'); return Foreshadowing.findById(id).select('projectId').exec(); } },
    fixResults: { idField: 'episodeId', load: (id) => episodeRepository.findById(id).then(d => d ? { projectId: (d as unknown as { projectId?: unknown }).projectId } : null) },
  },
});

console.log('[FixController] 路由模块已加载');

interface FixPlan {
  id: string;
  name: string;
  description: string;
  confidence: number;
  recommended: boolean;
  sideEffects?: string;
  changes: Array<{
    episode: number;
    location: string;
    original: string;
    modified: string;
    reason: string;
  }>;
}

// ========== 通用辅助函数 ==========

function setupSSE(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
}

function sendSSE(res: Response, data: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function sendSSEError(res: Response, error: unknown): void {
  sendSSE(res, { type: 'error', message: (error as Error).message });
  res.end();
}

function handleError(res: Response, label: string, error: unknown): void {
  console.error(`[FixController] ${label}:`, error);
  res.status(500).json({ success: false, error: (error as Error).message });
}

function calcWordCountDiff(original: string, fixed: string): { originalWordCount: number; fixedWordCount: number; wordCountDiff: number } {
  const originalWordCount = original.replace(/\s/g, '').length;
  const fixedWordCount = fixed.replace(/\s/g, '').length;
  return { originalWordCount, fixedWordCount, wordCountDiff: fixedWordCount - originalWordCount };
}

function enhancePlanWithInstruction(plan: any, customInstruction?: string): any {
  if (!customInstruction) return plan;
  return { ...plan, description: `${plan.description}\n\n用户补充要求：${customInstruction}` };
}

function parseMeta(h: { systemPrompt?: string }): Record<string, any> {
  try { return JSON.parse(h.systemPrompt || '{}'); } catch { return {}; }
}

/**
 * POST /fix/analyze - 分析问题并生成修复方案 (SSE)
 * 始终全面分析，返回 affectedEpisodes 供前端决定单集/跨集修复流程
 */
router.post('/analyze', async (req: Request, res: Response) => {
  const { projectId, issue } = req.body;

  if (!projectId || !issue) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  setupSSE(res);
  sendSSE(res, { type: 'start', message: '开始分析问题...' });

  try {
    const rewriteService = new RewriteService(projectId);
    sendSSE(res, { type: 'progress', message: '正在分析问题范围和影响...' });

    const result = await rewriteService.analyzeAndPlanFix({
      type: issue.category || issue.type,
      severity: issue.type,
      episode: issue.episode,
      location: issue.location,
      description: issue.description,
      evidence: issue.evidence,
      suggestion: issue.suggestion,
    });

    sendSSE(res, {
      type: 'complete',
      success: true,
      analysis: result.analysis,
      affectedEpisodes: result.affectedEpisodes,
      plans: result.plans,
    });
    res.end();
  } catch (error) {
    console.error('[FixController] 分析问题失败:', error);
    sendSSEError(res, error);
  }
});

/** POST /fix/execute - 执行修复方案 (SSE) */
router.post('/execute', async (req: Request, res: Response) => {
  const { projectId, plan, episodeNumber, customInstruction } = req.body;

  if (!projectId || !plan || !episodeNumber) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  setupSSE(res);

  try {
    const rewriteService = new RewriteService(projectId);

    const episode = await episodeRepository.findByNumber(projectId, episodeNumber);
    if (!episode) {
      sendSSEError(res, new Error('集数不存在'));
      return;
    }

    const originalContent = episode.content || '';
    let fixedContent = '';
    const enhancedPlan = enhancePlanWithInstruction(plan, customInstruction);

    await rewriteService.executeFix(enhancedPlan, episodeNumber, {
      onChunk: (chunk: string) => {
        fixedContent += chunk;
        const percent = Math.min(95, Math.round((fixedContent.length / Math.max(originalContent.length, 1)) * 100));
        sendSSE(res, { type: 'progress', content: fixedContent, percent });
      },
      onComplete: () => {
        const { wordCountDiff } = calcWordCountDiff(originalContent, fixedContent);
        console.log('[FixController] 修复完成', {
          originalLength: originalContent.length,
          fixedLength: fixedContent.length,
          wordCountDiff
        });
        sendSSE(res, { type: 'complete', result: { originalContent, fixedContent, wordCountDiff } });
        res.end();
      },
      onError: (error: Error) => {
        sendSSEError(res, error);
      }
    });
  } catch (error) {
    console.error('[FixController] 执行修复失败:', error);
    sendSSEError(res, error);
  }
});

/** POST /fix/apply - 应用修复结果 */
router.post('/apply', async (req: Request, res: Response) => {
  const { projectId, episodeId, episodeNumber, originalContent, fixedContent, issue, plan } = req.body;

  if (!projectId || !episodeId || !originalContent || !fixedContent) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  try {
    await episodeRepository.update(episodeId, { content: fixedContent });

    const { originalWordCount, fixedWordCount, wordCountDiff } = calcWordCountDiff(originalContent, fixedContent);

    const history = new RewriteHistory({
      projectId: new mongoose.Types.ObjectId(projectId),
      episodeId: new mongoose.Types.ObjectId(episodeId),
      episodeNumber,
      type: 'fix',
      instruction: `修复问题: ${issue?.description || '未知问题'}\n方案: ${plan?.name || '未知方案'}`,
      originalContent,
      rewrittenContent: fixedContent,
      originalWordCount,
      rewrittenWordCount: fixedWordCount,
      wordCountDiff,
      applied: true,
      appliedAt: new Date(),
      systemPrompt: JSON.stringify({ issue, plan }),
    });

    await history.save();

    res.json({ success: true, historyId: history._id.toString() });
  } catch (error) {
    handleError(res, '应用修复失败', error);
  }
});

/** POST /fix/revert - 撤销修复 */
router.post('/revert', async (req: Request, res: Response) => {
  const { historyId } = req.body;

  if (!historyId) {
    return res.status(400).json({ error: '缺少 historyId' });
  }

  try {
    const history = await RewriteHistory.findById(historyId);
    if (!history) {
      return res.status(404).json({ error: '修复记录不存在' });
    }

    await episodeRepository.update(history.episodeId.toString(), {
      content: history.originalContent,
    });

    history.applied = false;
    history.reverted = true;
    await history.save();

    res.json({ success: true });
  } catch (error) {
    handleError(res, '撤销修复失败', error);
  }
});

/** POST /fix/batch-analyze - 批量分析问题 (SSE) */
router.post('/batch-analyze', async (req: Request, res: Response) => {
  const { projectId, issues } = req.body;

  if (!projectId || !issues || !Array.isArray(issues)) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  setupSSE(res);
  sendSSE(res, { type: 'init', total: issues.length });

  try {
    const rewriteService = new RewriteService(projectId);
    const results: Array<{ issueIndex: number; analysis: string; plans: FixPlan[] }> = [];

    const issuesByEpisode = new Map<number, Array<{ index: number; issue: any }>>();
    issues.forEach((issue, index) => {
      const ep = issue.episode;
      if (!issuesByEpisode.has(ep)) issuesByEpisode.set(ep, []);
      issuesByEpisode.get(ep)!.push({ index, issue });
    });

    let processedCount = 0;

    for (const [episode, episodeIssues] of issuesByEpisode) {
      sendSSE(res, {
        type: 'progress',
        current: processedCount,
        total: issues.length,
        episode,
        message: `正在分析第 ${episode} 集的问题...`
      });

      if (episodeIssues.length === 1) {
        const { index, issue } = episodeIssues[0];
        const result = await rewriteService.analyzeAndPlanFix({
          type: issue.category || issue.type,
          severity: issue.type,
          episode: issue.episode,
          location: issue.location,
          description: issue.description,
          evidence: issue.evidence,
          suggestion: issue.suggestion,
        });
        results.push({ issueIndex: index, analysis: result.analysis, plans: result.plans });
        processedCount++;
      } else {
        const combinedDescription = episodeIssues
          .map(({ issue }, i) => `${i + 1}. ${issue.description}`)
          .join('\n');

        const result = await rewriteService.analyzeAndPlanFix({
          type: 'multiple',
          severity: 'critical',
          episode,
          description: `第${episode}集存在多个问题需要修复：\n${combinedDescription}`,
        });

        episodeIssues.forEach(({ index }) => {
          results.push({ issueIndex: index, analysis: result.analysis, plans: result.plans });
        });
        processedCount += episodeIssues.length;
      }

      sendSSE(res, { type: 'episode_done', episode, current: processedCount, total: issues.length });
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    results.sort((a, b) => a.issueIndex - b.issueIndex);

    sendSSE(res, {
      type: 'complete',
      success: true,
      results: results.map(r => ({ analysis: r.analysis, plans: r.plans })),
    });
    res.end();
  } catch (error) {
    console.error('[FixController] 批量分析失败:', error);
    sendSSEError(res, error);
  }
});

/** GET /fix/history/:projectId - 获取修复历史 */
router.get('/history/:projectId', async (req: Request, res: Response) => {
  const { projectId } = req.params;

  try {
    const histories = await RewriteHistory.find({
      projectId: new mongoose.Types.ObjectId(projectId),
      type: 'fix',
    }).sort({ createdAt: -1 });

    const stats = {
      totalFixes: histories.length,
      successRate: histories.length > 0
        ? histories.filter(h => h.applied && !h.reverted).length / histories.length
        : 0,
      byIssueType: {} as Record<string, number>,
    };

    for (const h of histories) {
      const meta = parseMeta(h);
      const issueType = meta.issue?.category || meta.issue?.type || 'unknown';
      stats.byIssueType[issueType] = (stats.byIssueType[issueType] || 0) + 1;
    }

    res.json({
      history: histories.map(h => {
        const meta = parseMeta(h);
        const issue = meta.issue;
        const plan = meta.plan;

        return {
          id: h._id.toString(),
          episodeNumber: h.episodeNumber,
          issueType: issue?.category || issue?.type || 'unknown',
          issueDescription: issue?.description || h.instruction,
          planName: plan?.name || '未知方案',
          originalContent: h.originalContent,
          fixedContent: h.rewrittenContent,
          wordCountDiff: h.wordCountDiff,
          appliedAt: h.appliedAt || h.createdAt,
          canRevert: h.applied && !h.reverted &&
            (Date.now() - new Date(h.appliedAt || h.createdAt).getTime()) < 30000,
        };
      }),
      stats,
    });
  } catch (error) {
    handleError(res, '获取修复历史失败', error);
  }
});

function parseWindowRange(windowRange?: string): number[] | undefined {
  if (!windowRange) return undefined;
  const match = windowRange.match(/(\d+)-(\d+)/);
  if (!match) return undefined;
  const start = parseInt(match[1]);
  const end = parseInt(match[2]);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

// ========== 跨集联动修复 API ==========
console.log('[FixController] 注册跨集修复路由...');

/** POST /fix/cross-episode/analyze - 分析跨集问题 (SSE) */
router.post('/cross-episode/analyze', async (req: Request, res: Response) => {
  console.log('[FixController] 收到 /cross-episode/analyze 请求');
  const { projectId, issue } = req.body;

  if (!projectId || !issue) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  setupSSE(res);
  sendSSE(res, { type: 'start', message: '开始分析跨集问题...' });

  try {
    const rewriteService = new RewriteService(projectId);
    sendSSE(res, { type: 'progress', message: '识别相关集数和伏笔...' });

    const result = await rewriteService.analyzeAndPlanCrossEpisodeFix({
      type: issue.category || issue.type,
      severity: issue.type,
      episode: issue.episode,
      description: issue.description,
      evidence: issue.evidence,
      windowRange: issue.windowRange,
    });

    sendSSE(res, {
      type: 'complete',
      success: true,
      analysis: result.analysis,
      affectedEpisodes: result.affectedEpisodes,
      plans: result.plans,
      relatedForeshadowings: result.relatedForeshadowings.map(f => ({
        id: f._id.toString(),
        content: f.content,
        episodePlanted: f.episodePlanted,
        currentStatus: f.status,
      })),
    });
    res.end();
  } catch (error) {
    console.error('[FixController] 跨集分析失败:', error);
    sendSSEError(res, error);
  }
});

/** POST /fix/cross-episode/execute - 执行多集联动修复 (SSE) */
router.post('/cross-episode/execute', async (req: Request, res: Response) => {
  const { projectId, plan, customInstruction } = req.body;

  if (!projectId || !plan) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  setupSSE(res);

  const episodeNumbers = [...new Set<number>(plan.changes.map((c: any) => c.episode as number))].sort((a, b) => a - b);
  sendSSE(res, { type: 'start', totalEpisodes: episodeNumbers.length, episodes: episodeNumbers });

  try {
    const rewriteService = new RewriteService(projectId);
    const enhancedPlan = enhancePlanWithInstruction(plan, customInstruction);
    let currentContent = '';

    const results = await rewriteService.executeMultiEpisodeFix(enhancedPlan, {
      onChunk: (chunk: string) => {
        currentContent += chunk;
        const percent = Math.min(95, Math.round(currentContent.length / 5000 * 100));
        sendSSE(res, { type: 'progress', content: currentContent, percent });
      },
      onEpisodeStart: (episodeNumber: number) => {
        sendSSE(res, { type: 'episode_start', episodeNumber });
      },
      onEpisodeComplete: (episodeNumber: number, content: string) => {
        sendSSE(res, { type: 'episode_complete', episodeNumber, fixedContent: content });
      },
      onComplete: () => { /* handled below */ },
      onError: (error: Error) => { sendSSEError(res, error); }
    });

    const resultsArray = Array.from(results.entries()).map(([epNum, result]) => ({
      episodeNumber: epNum,
      original: result.original,
      fixed: result.fixed,
    }));

    sendSSE(res, { type: 'complete', results: resultsArray });
    res.end();
  } catch (error) {
    console.error('[FixController] 跨集修复执行失败:', error);
    sendSSEError(res, error);
  }
});

/** POST /fix/cross-episode/apply - 应用跨集修复结果 */
router.post('/cross-episode/apply', async (req: Request, res: Response) => {
  const { projectId, fixResults, issue, plan, excludeEpisodes } = req.body;

  if (!projectId || !fixResults || !issue || !plan) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  try {
    const rewriteService = new RewriteService(projectId);

    const resultsMap = new Map<number, { original: string; fixed: string }>();
    for (const result of fixResults) {
      resultsMap.set(result.episodeNumber, { original: result.original, fixed: result.fixed });
    }

    const applyResult = await rewriteService.applyCrossEpisodeFix(resultsMap, issue, plan, { excludeEpisodes });

    const relatedForeshadowings = await rewriteService.findRelatedForeshadowings(issue.type, issue.episode);

    res.json({
      success: true,
      masterHistoryId: applyResult.masterHistoryId,
      appliedEpisodes: applyResult.appliedEpisodes,
      historyIds: applyResult.historyIds,
      relatedForeshadowings: relatedForeshadowings.map(f => ({
        id: f._id.toString(),
        content: f.content,
        currentStatus: f.status,
      })),
    });
  } catch (error) {
    handleError(res, '应用跨集修复失败', error);
  }
});

/** POST /fix/cross-episode/validate - 针对性验证修复效果 */
router.post('/cross-episode/validate', async (req: Request, res: Response) => {
  const { projectId, originalIssue, affectedEpisodes } = req.body;

  if (!projectId || !originalIssue || !affectedEpisodes) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  try {
    const rewriteService = new RewriteService(projectId);
    const validation = await rewriteService.validateFixResult(originalIssue, affectedEpisodes);
    res.json({ success: true, validation });
  } catch (error) {
    handleError(res, '验证修复效果失败', error);
  }
});

/** POST /fix/cross-episode/update-foreshadowing - 更新伏笔状态 */
router.post('/cross-episode/update-foreshadowing', async (req: Request, res: Response) => {
  const { updates } = req.body;

  if (!updates || !Array.isArray(updates)) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  try {
    const { Foreshadowing } = await import('../models/Foreshadowing');

    let updatedCount = 0;
    for (const update of updates) {
      if (!update.foreshadowingId || !update.newStatus) continue;
      await Foreshadowing.findByIdAndUpdate(update.foreshadowingId, {
        status: update.newStatus,
        resolutionNote: `通过跨集修复更新状态`,
      });
      updatedCount++;
    }

    res.json({ success: true, updatedCount });
  } catch (error) {
    handleError(res, '更新伏笔状态失败', error);
  }
});

/** POST /fix/cross-episode/revert - 回滚跨集修复 */
router.post('/cross-episode/revert', async (req: Request, res: Response) => {
  const { masterHistoryId, episodesToRevert } = req.body;

  if (!masterHistoryId) {
    return res.status(400).json({ error: '缺少 masterHistoryId' });
  }

  try {
    const masterHistory = await RewriteHistory.findById(masterHistoryId);
    if (!masterHistory) {
      return res.status(404).json({ error: '修复记录不存在' });
    }

    const rewriteService = new RewriteService(masterHistory.projectId.toString());
    const result = await rewriteService.revertCrossEpisodeFix(masterHistoryId, { episodesToRevert });

    res.json({
      success: true,
      revertedEpisodes: result.revertedEpisodes,
      affectedHistoryIds: result.affectedHistoryIds,
    });
  } catch (error) {
    handleError(res, '回滚跨集修复失败', error);
  }
});

/** GET /fix/cross-episode/history/:projectId - 获取跨集修复历史 */
router.get('/cross-episode/history/:projectId', async (req: Request, res: Response) => {
  const { projectId } = req.params;

  try {
    const histories = await RewriteHistory.find({
      projectId: new mongoose.Types.ObjectId(projectId),
      type: 'cross-episode-fix',
    }).sort({ createdAt: -1 });

    const groupedHistories = new Map<string, typeof histories>();
    for (const h of histories) {
      const meta = parseMeta(h);
      const masterId = meta.masterHistoryId || h._id.toString();
      if (!groupedHistories.has(masterId)) groupedHistories.set(masterId, []);
      groupedHistories.get(masterId)!.push(h);
    }

    const crossEpisodeFixes = Array.from(groupedHistories.entries()).map(([masterId, records]) => {
      const meta = parseMeta(records[0]);
      const allApplied = records.every(r => r.applied && !r.reverted);
      const allReverted = records.every(r => r.reverted);

      return {
        masterHistoryId: masterId,
        issue: meta.issue,
        plan: meta.plan,
        affectedEpisodes: records.map(r => r.episodeNumber).sort((a, b) => a - b),
        appliedAt: records[0].appliedAt || records[0].createdAt,
        status: allApplied ? 'applied' : allReverted ? 'reverted' : 'partial',
        canRevert: records.some(r => r.applied && !r.reverted),
        validation: meta.validation,
      };
    });

    res.json({ success: true, history: crossEpisodeFixes });
  } catch (error) {
    handleError(res, '获取跨集修复历史失败', error);
  }
});

export default router;
