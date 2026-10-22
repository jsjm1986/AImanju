/**
 * 改写服务 - 管理剧本改写功能
 */

import mongoose from 'mongoose';
import { IRewriteHistory, RewriteHistory } from '../../models/RewriteHistory';
import { episodeRepository } from '../../repositories/EpisodeRepository';
import { projectRepository } from '../../repositories/ProjectRepository';
import { robustParseJson } from '../../utils/jsonParser';
import { getOutlineRaw } from '../../utils/outline';
import { WordCountService } from '../../utils/wordCount';
import { AIClient, AIStreamCallbacks, aiClient } from '../ai/AIClient';
import { ContextManager } from '../context/ContextManager';
import { normalizeOverseasScript, outputFormatService } from '../format/OutputFormatService';
import {
  CoordinatedRewriteOptions,
  CrossEpisodeAnalysisOptions,
  CrossEpisodeFixOptions,
  FixAnalysisOptions,
  FixExecutionOptions,
  TargetedValidationOptions,
  SequentialFixOptions,
  getCoordinatedRewritePrompt,
  getCrossEpisodeAnalysisPrompt,
  getCrossEpisodeFixPrompt,
  getFixAnalysisPrompt,
  getFixExecutionPrompt,
  getTargetedValidationPrompt,
  getSequentialFixPrompt,
} from './rewritePrompts';
import { Foreshadowing, IForeshadowing } from '../../models/Foreshadowing';

export type RewriteType = 'full' | 'selection' | 'instruction' | 'manual';

export interface RewriteParams {
  projectId: string;
  episodeId: string;
  episodeNumber: number;
  type: RewriteType;
  instruction: string;
  selection?: {
    start: number;
    end: number;
    text: string;
  };
}

export interface RewriteResult {
  success: boolean;
  originalContent: string;
  rewrittenContent: string;
  diff?: DiffSegment[];
  historyId?: string;
  error?: string;
}

export interface DiffSegment {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
}

export interface RewriteHistoryRecord {
  _id: string;
  episodeId: string;
  episodeNumber: number;
  type: RewriteType;
  instruction: string;
  originalContent: string;
  rewrittenContent: string;
  systemPrompt?: string;
  userPrompt?: string;
  selection?: {
    start: number;
    end: number;
    text: string;
  };
  originalWordCount: number;
  rewrittenWordCount: number;
  wordCountDiff: number;
  applied: boolean;
  appliedAt?: Date;
  reverted?: boolean;
  createdAt: Date;
}

/**
 * 局部改写 (selection) - 只改写选中的文字
 * 特点：精确聚焦，只处理用户选中的部分
 */
const SELECTION_SYSTEM_PROMPT = `你是一位专业的剧本改写编辑，专注于精确修改用户选中的文本片段。

## 任务
根据用户的改写指令，只修改用户选中的文本部分。

## 核心原则
1. **精确聚焦**：只改写用户提供的选中文本，不要添加额外内容
2. **保持风格**：改写后的文本要与原剧本的整体风格保持一致
3. **角色一致**：如果涉及对话，保持角色的性格和说话方式
4. **格式不变**：严格保持原有的剧本格式（对话格式、场景描写格式等）

## 输出要求
- 直接输出改写后的文本
- 不要加任何解释、说明或前缀
- 输出长度应与原选中文本相近，除非指令明确要求扩展或精简`;

/**
 * 智能改写 (instruction) - AI 自动定位并修改
 * 特点：精准定位，最小改动，保持大部分内容不变
 */
const INSTRUCTION_SYSTEM_PROMPT = `你是一位专业的剧本改写编辑，擅长精准定位问题并进行最小化修改。

## 任务
根据用户的改写指令，智能分析剧本内容，找到需要修改的地方进行优化。

## 核心原则 - 最小改动原则
1. **精准定位**：仔细分析用户指令，只修改与指令相关的部分
2. **最小改动**：能改一句话解决的，不要改一段；能改一段解决的，不要改全文
3. **保持原貌**：不相关的内容必须保持原样，一字不改
4. **自然过渡**：修改的部分要与上下文自然衔接

## 改写策略
- 如果指令是"增强冲突感"，只在关键对话处增加张力，不要改动无关场景
- 如果指令是"加快节奏"，只删减冗余描写，保留核心情节
- 如果指令是"优化对话"，只调整对话内容，不改动场景描写
- 如果指令是"增加细节"，只在需要的地方补充，不要全文添加

## 输出要求
- 输出完整的改写后剧本
- 不要加任何解释说明
- 保持原有的剧本格式`;

/**
 * 全文重写 (full) - 重新生成整集内容
 * 特点：大幅调整，可以重新组织结构
 */
const FULL_REWRITE_SYSTEM_PROMPT = `你是一位专业的剧本改写编辑，擅长对剧本进行全面优化和重构。

## 任务
根据用户的改写指令，对整集剧本进行全面重写和优化。

## 核心原则 - 全面优化
1. **整体把控**：从全局角度审视剧本，可以调整结构和节奏
2. **大胆改写**：可以重新组织场景顺序、调整情节比重、重写对话
3. **保持核心**：保留原剧本的核心剧情走向和关键情节点
4. **角色一致**：保持角色性格和人物关系不变

## 改写权限
- ✅ 可以重新组织场景顺序
- ✅ 可以大幅修改对话内容
- ✅ 可以增删场景描写
- ✅ 可以调整情节节奏
- ✅ 可以优化整体结构
- ❌ 不要改变核心剧情走向
- ❌ 不要改变角色性格设定
- ❌ 不要改变关键情节点

## 输出要求
- 输出完整的重写后剧本
- 不要加任何解释说明
- 保持标准的剧本格式`;

export class RewriteService {
  private projectId: string;
  private aiClient: AIClient;
  private contextManager: ContextManager;
  private isOverseasFormat?: boolean;

  constructor(projectId: string) {
    this.projectId = projectId;
    this.aiClient = aiClient;
    this.contextManager = new ContextManager(projectId);
  }

  /** 海外格式项目在内容落库前做排版归一化（##/OS-VO空格/场标空格） */
  private async normalizeIfOverseas(content: string): Promise<string> {
    if (this.isOverseasFormat === undefined) {
      const project = await projectRepository.findById(this.projectId);
      this.isOverseasFormat = project?.outputFormat?.preset === 'overseas_drama';
    }
    return this.isOverseasFormat ? normalizeOverseasScript(content) : content;
  }

  /**
   * IRewriteHistory -> RewriteHistoryRecord 映射
   */
  private toHistoryRecord(h: IRewriteHistory): RewriteHistoryRecord {
    return {
      _id: h._id.toString(),
      episodeId: h.episodeId.toString(),
      episodeNumber: h.episodeNumber,
      type: h.type as RewriteType,
      instruction: h.instruction,
      originalContent: h.originalContent,
      rewrittenContent: h.rewrittenContent,
      systemPrompt: h.systemPrompt,
      userPrompt: h.userPrompt,
      selection: h.selection,
      originalWordCount: h.originalWordCount || 0,
      rewrittenWordCount: h.rewrittenWordCount || 0,
      wordCountDiff: h.wordCountDiff || 0,
      applied: h.applied || false,
      appliedAt: h.appliedAt,
      reverted: h.reverted || false,
      createdAt: h.createdAt,
    };
  }

  /**
   * 统计历史记录的类型分布和应用状态
   */
  private computeHistoryStats(histories: IRewriteHistory[]): {
    total: number;
    byType: { selection: number; instruction: number; full: number; manual: number };
    applied: number;
    pending: number;
  } {
    const stats = {
      total: histories.length,
      byType: { selection: 0, instruction: 0, full: 0, manual: 0 },
      applied: 0,
      pending: 0,
    };
    for (const h of histories) {
      const t = h.type as RewriteType;
      if (t in stats.byType) stats.byType[t]++;
      if (h.applied) stats.applied++;
      else stats.pending++;
    }
    return stats;
  }

  /**
   * 批量获取多集内容
   */
  private async fetchEpisodeContents(episodeNumbers: number[]): Promise<Record<number, string>> {
    const contents: Record<number, string> = {};
    for (const epNum of episodeNumbers) {
      const ep = await episodeRepository.findByNumber(this.projectId, epNum);
      if (ep?.content) {
        contents[epNum] = ep.content;
      }
    }
    return contents;
  }

  /**
   * 生成连续集数范围
   */
  private static episodeRange(start: number, end: number): number[] {
    const nums: number[] = [];
    for (let ep = start; ep <= end; ep++) nums.push(ep);
    return nums;
  }

  /**
   * 准备改写上下文（rewrite / rewriteStream 共用）
   */
  private async prepareRewriteContext(params: RewriteParams): Promise<{
    originalContent: string;
    contentToRewrite: string;
    prefix: string;
    suffix: string;
    systemPrompt: string;
    userMessage: string;
  } | { error: RewriteResult }> {
    const { episodeId, episodeNumber, type, instruction, selection } = params;

    const episode = await episodeRepository.findById(episodeId);
    if (!episode) {
      return { error: { success: false, originalContent: '', rewrittenContent: '', error: '集数不存在' } };
    }

    const originalContent = episode.content || '';
    let contentToRewrite = originalContent;
    let prefix = '';
    let suffix = '';

    if (type === 'selection' && selection) {
      prefix = originalContent.substring(0, selection.start);
      suffix = originalContent.substring(selection.end);
      contentToRewrite = selection.text;
    }

    const formatSection = type !== 'selection'
      ? await this.getProjectFormatSection()
      : undefined;

    const systemPrompt = this.getSystemPromptByType(type, formatSection);
    const userMessage = this.buildRewritePrompt(contentToRewrite, instruction, episodeNumber, type);

    return { originalContent, contentToRewrite, prefix, suffix, systemPrompt, userMessage };
  }

  /**
   * 组合改写结果并保存历史
   */
  private async finalizeRewrite(
    params: RewriteParams,
    originalContent: string,
    rewrittenPart: string,
    prefix: string,
    suffix: string,
    systemPrompt: string,
    userMessage: string,
  ): Promise<RewriteResult> {
    const { episodeId, episodeNumber, type, instruction, selection } = params;

    const rewrittenContent = type === 'selection'
      ? prefix + rewrittenPart + suffix
      : rewrittenPart;

    const diff = this.computeDiff(originalContent, rewrittenContent);

    const history = await this.saveHistory({
      projectId: this.projectId,
      episodeId,
      episodeNumber,
      type,
      instruction,
      originalContent,
      rewrittenContent,
      systemPrompt,
      userPrompt: userMessage,
      selection: type === 'selection' ? selection : undefined,
    });

    return {
      success: true,
      originalContent,
      rewrittenContent,
      diff,
      historyId: history._id.toString(),
    };
  }

  /**
   * 获取项目的输出格式说明（用于注入到改写系统提示词中）
   */
  private async getProjectFormatSection(): Promise<string | undefined> {
    try {
      const project = await projectRepository.findById(this.projectId);
      if (project?.outputFormat) {
        const resolved = outputFormatService.resolveConfig(project.outputFormat);
        return outputFormatService.buildFormatPromptSection(resolved, project.outputFormat?.customPrompt);
      }
    } catch (e) {
      console.warn('[RewriteService] 获取项目输出格式失败:', e);
    }
    return undefined;
  }

  /**
   * 改写剧本（完整或选中部分）
   */
  async rewrite(params: RewriteParams): Promise<RewriteResult> {
    const ctx = await this.prepareRewriteContext(params);
    if ('error' in ctx) return ctx.error;

    const { originalContent, prefix, suffix, systemPrompt, userMessage } = ctx;

    try {
      const rewrittenPart = await this.aiClient.generate(systemPrompt, userMessage, 8000);
      return this.finalizeRewrite(params, originalContent, rewrittenPart, prefix, suffix, systemPrompt, userMessage);
    } catch (error) {
      console.error('[RewriteService] 改写失败:', error);
      return { success: false, originalContent, rewrittenContent: '', error: (error as Error).message };
    }
  }

  /**
   * 流式改写（用于前端实时显示）
   */
  async rewriteStream(
    params: RewriteParams,
    callbacks: AIStreamCallbacks
  ): Promise<RewriteResult> {
    const ctx = await this.prepareRewriteContext(params);
    if ('error' in ctx) return ctx.error;

    const { originalContent, prefix, suffix, systemPrompt, userMessage } = ctx;

    try {
      const rewrittenPart = await this.aiClient.generateStream(systemPrompt, userMessage, callbacks);
      return this.finalizeRewrite(params, originalContent, rewrittenPart, prefix, suffix, systemPrompt, userMessage);
    } catch (error) {
      return { success: false, originalContent, rewrittenContent: '', error: (error as Error).message };
    }
  }

  async applyRewrite(historyId: string): Promise<boolean> {
    const history = await RewriteHistory.findById(historyId);
    if (!history) throw new Error('改写历史不存在');

    await episodeRepository.update(history.episodeId.toString(), {
      content: await this.normalizeIfOverseas(history.rewrittenContent),
    });

    history.applied = true;
    history.appliedAt = new Date();
    await history.save();
    return true;
  }

  async revertRewrite(historyId: string): Promise<boolean> {
    const history = await RewriteHistory.findById(historyId);
    if (!history) throw new Error('改写历史不存在');

    await episodeRepository.update(history.episodeId.toString(), {
      content: history.originalContent,
    });

    history.applied = false;
    await history.save();
    return true;
  }

  async getHistory(episodeId: string): Promise<RewriteHistoryRecord[]> {
    const histories = await RewriteHistory.find({
      episodeId: new mongoose.Types.ObjectId(episodeId),
    }).sort({ createdAt: -1 });

    return histories.map(h => this.toHistoryRecord(h));
  }

  async batchRewrite(
    episodeIds: string[],
    instruction: string,
    onProgress?: (current: number, total: number, episodeNumber: number) => void
  ): Promise<RewriteResult[]> {
    const results: RewriteResult[] = [];

    for (let i = 0; i < episodeIds.length; i++) {
      const episode = await episodeRepository.findById(episodeIds[i]);
      if (!episode) continue;

      onProgress?.(i + 1, episodeIds.length, episode.episodeNumber);

      const result = await this.rewrite({
        projectId: this.projectId,
        episodeId: episodeIds[i],
        episodeNumber: episode.episodeNumber,
        type: 'instruction',
        instruction,
      });

      results.push(result);

      if (i < episodeIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  private getSystemPromptByType(type: RewriteType, formatSection?: string): string {
    const PROMPT_MAP: Record<string, string> = {
      selection: SELECTION_SYSTEM_PROMPT,
      instruction: INSTRUCTION_SYSTEM_PROMPT,
      full: FULL_REWRITE_SYSTEM_PROMPT,
    };
    const base = PROMPT_MAP[type] || INSTRUCTION_SYSTEM_PROMPT;
    return formatSection ? `${base}\n\n${formatSection}` : base;
  }

  private buildRewritePrompt(
    content: string,
    instruction: string,
    episodeNumber: number,
    type: RewriteType
  ): string {
    if (type === 'selection') {
      return `## 需要改写的文本

${content}

## 改写指令

${instruction}

请直接输出改写后的文本。`;
    }

    if (type === 'instruction') {
      return `## 原始剧本（第${episodeNumber}集）

${content}

## 改写指令

${instruction}

## 重要提醒
- 只修改与指令相关的部分
- 不相关的内容保持原样
- 输出完整的改写后剧本`;
    }

    return `## 原始剧本（第${episodeNumber}集）

${content}

## 重写指令

${instruction}

## 重要提醒
- 可以大幅调整结构和内容
- 保持核心剧情走向不变
- 输出完整的重写后剧本`;
  }

  private async saveHistory(data: {
    projectId: string;
    episodeId: string;
    episodeNumber: number;
    type: RewriteType;
    instruction: string;
    originalContent: string;
    rewrittenContent: string;
    systemPrompt?: string;
    userPrompt?: string;
    selection?: {
      start: number;
      end: number;
      text: string;
    };
  }): Promise<IRewriteHistory> {
    const dualMode = WordCountService.isDualModeEnabled();

    let wordCounts: any = {};

    if (dualMode) {
      const original = WordCountService.countBoth(data.originalContent);
      const rewritten = WordCountService.countBoth(data.rewrittenContent);
      wordCounts = {
        originalWordCount: original.v1,
        rewrittenWordCount: rewritten.v1,
        wordCountDiff: rewritten.v1 - original.v1,
        originalWordCountV2: original.v2,
        rewrittenWordCountV2: rewritten.v2,
        wordCountDiffV2: rewritten.v2 - original.v2,
      };
    } else {
      const algorithm = WordCountService.getDefaultAlgorithm();
      const originalWordCount = WordCountService.count(data.originalContent, algorithm);
      const rewrittenWordCount = WordCountService.count(data.rewrittenContent, algorithm);
      wordCounts = {
        originalWordCount,
        rewrittenWordCount,
        wordCountDiff: rewrittenWordCount - originalWordCount,
      };
    }

    const history = new RewriteHistory({
      projectId: new mongoose.Types.ObjectId(data.projectId),
      episodeId: new mongoose.Types.ObjectId(data.episodeId),
      episodeNumber: data.episodeNumber,
      type: data.type,
      instruction: data.instruction,
      originalContent: data.originalContent,
      rewrittenContent: data.rewrittenContent,
      systemPrompt: data.systemPrompt,
      userPrompt: data.userPrompt,
      selection: data.selection,
      ...wordCounts,
      applied: false,
    });
    return history.save();
  }

  private computeDiff(original: string, modified: string): DiffSegment[] {
    const orig = original ?? '';
    const mod = modified ?? '';
    const diff: DiffSegment[] = [];
    const originalLines = orig.split('\n');
    const modifiedLines = mod.split('\n');

    let i = 0, j = 0;
    while (i < originalLines.length || j < modifiedLines.length) {
      if (i >= originalLines.length) {
        diff.push({ type: 'added', content: modifiedLines[j] + '\n' });
        j++;
      } else if (j >= modifiedLines.length) {
        diff.push({ type: 'removed', content: originalLines[i] + '\n' });
        i++;
      } else if (originalLines[i] === modifiedLines[j]) {
        diff.push({ type: 'unchanged', content: originalLines[i] + '\n' });
        i++;
        j++;
      } else {
        diff.push({ type: 'removed', content: originalLines[i] + '\n' });
        diff.push({ type: 'added', content: modifiedLines[j] + '\n' });
        i++;
        j++;
      }
    }

    return diff;
  }

  /**
   * 历史统计信息接口
   */
  static readonly HistoryStatsInterface = {
    total: 0,
    byType: { selection: 0, instruction: 0, full: 0, manual: 0 },
    applied: 0,
    pending: 0,
  };

  /**
   * 保存手动编辑历史
   */
  async saveManualEditHistory(data: {
    episodeId: string;
    episodeNumber: number;
    originalContent: string;
    modifiedContent: string;
    description?: string;
  }): Promise<{
    success: boolean;
    historyId?: string;
    error?: string;
  }> {
    try {
      const history = await this.saveHistory({
        projectId: this.projectId,
        episodeId: data.episodeId,
        episodeNumber: data.episodeNumber,
        type: 'manual',
        instruction: data.description || '手动编辑',
        originalContent: data.originalContent,
        rewrittenContent: data.modifiedContent,
      });

      history.applied = true;
      history.appliedAt = new Date();
      await history.save();

      return { success: true, historyId: history._id.toString() };
    } catch (error) {
      console.error('[RewriteService] 保存手动编辑历史失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 构建历史查询条件
   */
  private buildHistoryQuery(
    baseFilter: Record<string, unknown>,
    options?: { type?: RewriteType; search?: string }
  ): Record<string, unknown> {
    const query: Record<string, unknown> = { ...baseFilter };
    if (options?.type) query.type = options.type;
    if (options?.search) query.instruction = { $regex: options.search, $options: 'i' };
    return query;
  }

  /**
   * 获取改写历史（增强版，支持筛选和搜索）
   */
  async getHistoryWithStats(
    episodeId: string,
    options?: { type?: RewriteType; search?: string }
  ): Promise<{
    history: RewriteHistoryRecord[];
    stats: {
      total: number;
      byType: { selection: number; instruction: number; full: number; manual: number };
      applied: number;
      pending: number;
    };
  }> {
    const episodeOid = new mongoose.Types.ObjectId(episodeId);
    const query = this.buildHistoryQuery({ episodeId: episodeOid }, options);

    const histories = await RewriteHistory.find(query).sort({ createdAt: -1 });
    const allHistories = await RewriteHistory.find({ episodeId: episodeOid });

    return {
      history: histories.map(h => this.toHistoryRecord(h)),
      stats: this.computeHistoryStats(allHistories),
    };
  }

  /**
   * 获取项目所有改写历史（跨集）
   */
  async getProjectHistory(options?: {
    type?: RewriteType;
    search?: string;
  }): Promise<{
    history: RewriteHistoryRecord[];
    byEpisode: Record<number, RewriteHistoryRecord[]>;
    stats: {
      total: number;
      byType: { selection: number; instruction: number; full: number; manual: number };
      applied: number;
      pending: number;
    };
  }> {
    const projectOid = new mongoose.Types.ObjectId(this.projectId);
    const query = this.buildHistoryQuery({ projectId: projectOid }, options);

    const histories = await RewriteHistory.find(query).sort({ createdAt: -1 });
    const allHistories = await RewriteHistory.find({ projectId: projectOid });

    const byEpisode: Record<number, RewriteHistoryRecord[]> = {};
    const historyRecords = histories.map(h => {
      const record = this.toHistoryRecord(h);
      if (!byEpisode[h.episodeNumber]) byEpisode[h.episodeNumber] = [];
      byEpisode[h.episodeNumber].push(record);
      return record;
    });

    return {
      history: historyRecords,
      byEpisode,
      stats: this.computeHistoryStats(allHistories),
    };
  }

  /**
   * 获取单条历史详情
   */
  async getHistoryDetail(historyId: string): Promise<{
    history: {
      _id: string;
      projectId: string;
      episodeId: string;
      episodeNumber: number;
      type: RewriteType;
      instruction: string;
      originalContent: string;
      rewrittenContent: string;
      systemPrompt?: string;
      userPrompt?: string;
      selection?: { start: number; end: number; text: string };
      originalWordCount: number;
      rewrittenWordCount: number;
      wordCountDiff: number;
      applied: boolean;
      appliedAt?: Date;
      reverted?: boolean;
      createdAt: Date;
    };
    diff: DiffSegment[];
  } | null> {
    const history = await RewriteHistory.findById(historyId);
    if (!history) return null;

    let diff: DiffSegment[] = [];
    try {
      if (history.originalContent && history.rewrittenContent) {
        diff = this.computeDiff(history.originalContent, history.rewrittenContent);
      }
      if (!Array.isArray(diff)) diff = [];
    } catch (error) {
      console.error(`[RewriteService] Failed to compute diff for history ${historyId}:`, error);
      diff = [];
    }

    return {
      history: {
        ...this.toHistoryRecord(history),
        projectId: history.projectId.toString(),
      },
      diff,
    };
  }

  async deleteHistory(historyId: string): Promise<boolean> {
    const history = await RewriteHistory.findById(historyId);
    if (!history) throw new Error('改写历史不存在');
    if (history.projectId.toString() !== this.projectId) throw new Error('无权删除此记录');

    await RewriteHistory.deleteOne({ _id: history._id });
    return true;
  }

  /**
   * 增强版回滚改写（级联更新后续记录状态）
   */
  async revertRewriteEnhanced(historyId: string): Promise<{
    success: boolean;
    affectedRecords: number;
  }> {
    const history = await RewriteHistory.findById(historyId);
    if (!history) throw new Error('改写历史不存在');

    await episodeRepository.update(history.episodeId.toString(), {
      content: history.originalContent,
    });

    history.applied = false;
    history.appliedAt = undefined;
    await history.save();

    const result = await RewriteHistory.updateMany(
      {
        episodeId: history.episodeId,
        createdAt: { $gt: history.createdAt },
        applied: true,
      },
      {
        $set: { applied: false, reverted: true },
        $unset: { appliedAt: 1 },
      }
    );

    return { success: true, affectedRecords: result.modifiedCount + 1 };
  }

  /**
   * 分析问题并生成修复方案
   *
   * 业务逻辑：
   * 1. 获取问题周围的多集内容（前2集 + 当前集 + 后2集）
   * 2. 让 AI 分析问题是否涉及多集
   * 3. AI 在返回的 affectedEpisodes 中指明需要修改的集数
   * 4. 前端根据 affectedEpisodes 决定使用单集还是跨集修复流程
   */
  async analyzeAndPlanFix(issue: {
    type: string;
    severity: string;
    episode: number;
    location?: string;
    description: string;
    evidence?: string;
    suggestion?: string;
  }): Promise<{
    analysis: string;
    affectedEpisodes: number[];
    plans: FixPlan[];
  }> {
    const project = await projectRepository.findById(this.projectId);
    if (!project) throw new Error('项目不存在');

    const startEp = Math.max(1, issue.episode - 2);
    const episodeContents = await this.fetchEpisodeContents(
      RewriteService.episodeRange(startEp, issue.episode + 2)
    );

    const fullContext = await this.contextManager.buildFullContext({
      currentEpisode: issue.episode,
    });

    const options: FixAnalysisOptions = {
      issue,
      episodeContents,
      characterContext: fullContext.characters,
      outline: getOutlineRaw(project.outline),
    };

    const prompt = getFixAnalysisPrompt(options);
    const response = await this.aiClient.generate(prompt, '请分析问题并生成修复方案。', 8192);

    interface FixAnalysisResult {
      analysis?: string;
      affectedEpisodes?: number[];
      plans?: FixPlan[];
    }

    const result = robustParseJson<FixAnalysisResult>(response, {
      analysis: '解析失败，请重试',
      affectedEpisodes: [issue.episode],
      plans: [],
    });

    return {
      analysis: result.analysis || '解析失败',
      affectedEpisodes: result.affectedEpisodes || [issue.episode],
      plans: result.plans || [],
    };
  }

  async executeFix(
    plan: FixPlan,
    episodeNumber: number,
    callbacks: AIStreamCallbacks
  ): Promise<string> {
    const episode = await episodeRepository.findByNumber(this.projectId, episodeNumber);
    if (!episode?.content) throw new Error('剧本内容不存在');

    const fullContext = await this.contextManager.buildFullContext({
      currentEpisode: episodeNumber,
    });

    const options: FixExecutionOptions = {
      plan,
      episodeNum: episodeNumber,
      originalContent: episode.content,
      characterContext: fullContext.characters,
      formatSection: await this.getProjectFormatSection(),
    };

    const prompt = getFixExecutionPrompt(options);
    return this.aiClient.generateStream(prompt, '请执行修复。', callbacks);
  }

  async analyzeCrossEpisodeIssue(issue: {
    type: string;
    severity: string;
    episode: number;
    description: string;
    evidence?: string;
    affectedEpisodes?: number[];
    windowRange?: { start: number; end: number };
  }): Promise<{
    analysis: string;
    affectedEpisodes: number[];
    plans: FixPlan[];
  }> {
    const project = await projectRepository.findById(this.projectId);
    if (!project) throw new Error('项目不存在');

    const episodeNumbers = issue.affectedEpisodes || [issue.episode];
    const episodeContents = await this.fetchEpisodeContents(episodeNumbers);

    const fullContext = await this.contextManager.buildFullContext({
      currentEpisode: Math.max(...episodeNumbers),
    });

    const options: CrossEpisodeFixOptions = {
      issue,
      episodeContents,
      characterContext: fullContext.characters,
      outline: getOutlineRaw(project.outline),
    };

    const prompt = getCrossEpisodeFixPrompt(options);
    const response = await this.aiClient.withMaxTokensFallback(
      (maxTokens) => this.aiClient.generate(prompt, '请分析跨集问题并生成修复方案。', maxTokens),
      12288,
      '跨集问题分析'
    );

    interface CrossEpisodeFixResult {
      analysis?: { rootCause?: string } | string;
      plans?: Array<{
        id: string;
        name: string;
        description: string;
        confidence: number;
        recommended?: boolean;
        changes?: Array<{
          episode: number;
          location: string;
          original: string;
          modified: string;
          reason: string;
        }>;
      }>;
    }

    const result = robustParseJson<CrossEpisodeFixResult>(response, {
      analysis: '解析失败，请重试',
      plans: [],
    });

    const normalizedPlans: FixPlan[] = (result.plans || []).map(plan => ({
      ...plan,
      recommended: plan.recommended ?? false,
      changes: plan.changes || [],
    }));

    return {
      analysis: typeof result.analysis === 'object'
        ? result.analysis?.rootCause || JSON.stringify(result.analysis)
        : result.analysis || '解析失败',
      affectedEpisodes: episodeNumbers,
      plans: normalizedPlans,
    };
  }

  async coordinatedRewrite(
    episodeNumbers: number[],
    instruction: string,
    callbacks: AIStreamCallbacks
  ): Promise<string> {
    const project = await projectRepository.findById(this.projectId);
    if (!project) throw new Error('项目不存在');

    const episodes: Array<{ number: number; content: string }> = [];
    for (const epNum of episodeNumbers.sort((a, b) => a - b)) {
      const ep = await episodeRepository.findByNumber(this.projectId, epNum);
      if (ep?.content) episodes.push({ number: epNum, content: ep.content });
    }
    if (episodes.length === 0) throw new Error('未找到任何剧本内容');

    let previousContext = '';
    if (episodeNumbers[0] > 1) {
      previousContext = await this.contextManager.buildPreviousSummary(episodeNumbers[0]);
    }

    const fullContext = await this.contextManager.buildFullContext({
      currentEpisode: Math.max(...episodeNumbers),
    });

    const options: CoordinatedRewriteOptions = {
      episodes,
      outline: getOutlineRaw(project.outline),
      characters: fullContext.characters,
      previousContext,
      formatSection: await this.getProjectFormatSection(),
    };

    const systemPrompt = getCoordinatedRewritePrompt(options);
    return this.aiClient.generateStream(systemPrompt, `【改写要求】\n${instruction}`, callbacks);
  }

  parseCoordinatedRewriteResult(content: string): {
    episodes: Array<{ number: number; content: string; wordCount: number }>;
    totalWordCount: number;
  } {
    const episodes: Array<{ number: number; content: string; wordCount: number }> = [];
    const pattern = /<<<第(\d+)集>>>([\s\S]*?)<<<第\d+集结束>>>/g;
    let match;

    while ((match = pattern.exec(content)) !== null) {
      const episodeContent = match[2].trim();
      episodes.push({
        number: parseInt(match[1]),
        content: episodeContent,
        wordCount: episodeContent.replace(/\s/g, '').length,
      });
    }

    return {
      episodes,
      totalWordCount: episodes.reduce((sum, ep) => sum + ep.wordCount, 0),
    };
  }

  async saveCoordinatedRewriteResult(
    episodes: Array<{ number: number; content: string }>
  ): Promise<void> {
    for (const ep of episodes) {
      const normalized = await this.normalizeIfOverseas(ep.content);
      await episodeRepository.upsert(this.projectId, ep.number, {
        content: normalized,
        wordCount: normalized.replace(/\s/g, '').length,
      });
    }
  }

  async findRelatedForeshadowings(
    issueType: string,
    sourceEpisode: number,
    windowEnd?: number
  ): Promise<IForeshadowing[]> {
    const endEp = windowEnd || sourceEpisode + 10;

    const foreshadowings = await Foreshadowing.find({
      projectId: new mongoose.Types.ObjectId(this.projectId),
      episodePlanted: { $gte: Math.max(1, sourceEpisode - 2), $lte: endEp },
      status: { $in: ['planted', 'dormant'] },
    }).sort({ episodePlanted: 1 }).lean();

    return issueType === 'unresolved' ? foreshadowings : foreshadowings.slice(0, 10);
  }

  /**
   * 分析跨集问题并生成修复方案
   */
  async analyzeAndPlanCrossEpisodeFix(issue: {
    type: string;
    severity: string;
    episode: number;
    description: string;
    evidence?: string;
    windowRange?: string;
  }): Promise<{
    analysis: string;
    affectedEpisodes: Array<{
      episodeNumber: number;
      role: 'source' | 'bridge' | 'resolution';
      relevance: string;
    }>;
    plans: CrossEpisodeFixPlan[];
    relatedForeshadowings: IForeshadowing[];
  }> {
    const project = await projectRepository.findById(this.projectId);
    if (!project) throw new Error('项目不存在');

    let startEp = Math.max(1, issue.episode - 2);
    let endEp = issue.episode + 5;
    if (issue.windowRange) {
      const match = issue.windowRange.match(/(\d+)-(\d+)/);
      if (match) {
        startEp = Math.max(1, parseInt(match[1]) - 1);
        endEp = parseInt(match[2]) + 2;
      }
    }

    const episodeContents = await this.fetchEpisodeContents(
      RewriteService.episodeRange(startEp, endEp)
    );

    const relatedForeshadowings = await this.findRelatedForeshadowings(
      issue.type, issue.episode, endEp
    );

    const fullContext = await this.contextManager.buildFullContext({
      currentEpisode: endEp,
    });

    const options: CrossEpisodeAnalysisOptions = {
      issue,
      episodeContents,
      foreshadowings: relatedForeshadowings.map(f => ({
        id: f._id.toString(),
        content: f.content,
        episodePlanted: f.episodePlanted,
        status: f.status,
      })),
      characterContext: fullContext.characters,
      outline: getOutlineRaw(project.outline),
    };

    const prompt = getCrossEpisodeAnalysisPrompt(options);
    const response = await this.aiClient.withMaxTokensFallback(
      (maxTokens) => this.aiClient.generate(prompt, '请分析跨集问题并生成修复方案。', maxTokens),
      16384,
      '跨集联动修复分析'
    );

    interface AnalysisResult {
      analysis?: string;
      affectedEpisodes?: Array<{
        episodeNumber: number;
        role: 'source' | 'bridge' | 'resolution';
        relevance: string;
      }>;
      plans?: CrossEpisodeFixPlan[];
    }

    const result = robustParseJson<AnalysisResult>(response, {
      analysis: '解析失败，请重试',
      affectedEpisodes: [{ episodeNumber: issue.episode, role: 'source', relevance: '问题源头' }],
      plans: [],
    });

    return {
      analysis: result.analysis || '解析失败',
      affectedEpisodes: result.affectedEpisodes || [],
      plans: (result.plans || []).map(p => ({
        ...p,
        recommended: p.recommended ?? false,
        changes: p.changes || [],
      })),
      relatedForeshadowings,
    };
  }

  /**
   * 执行多集联动修复（逐集批量模式）
   *
   * 每集独立调用AI，避免max_tokens超限。
   * 传递跨集上下文（已修复集摘要 + 后续修复预告）。
   */
  async executeMultiEpisodeFix(
    plan: CrossEpisodeFixPlan,
    callbacks: AIStreamCallbacks & {
      onEpisodeStart?: (episodeNumber: number, index: number, total: number) => void;
      onEpisodeComplete?: (episodeNumber: number, content: string) => void;
    },
    originalIssue?: { type: string; description: string; evidence?: string }
  ): Promise<Map<number, { original: string; fixed: string }>> {
    const episodeNumbers = [...new Set(plan.changes.map(c => c.episode))].sort((a, b) => a - b);

    console.log('[RewriteService] executeMultiEpisodeFix 开始（逐集模式）:', {
      planId: plan.id, planName: plan.name, episodeNumbers, changesCount: plan.changes.length,
    });

    const episodeContents = await this.fetchEpisodeContents(episodeNumbers);
    for (const epNum of episodeNumbers) {
      if (episodeContents[epNum]) {
        console.log(`[RewriteService] 第${epNum}集原始内容长度:`, episodeContents[epNum].length);
      } else {
        console.log(`[RewriteService] 第${epNum}集内容为空或不存在`);
      }
    }

    const fullContext = await this.contextManager.buildFullContext({
      currentEpisode: Math.max(...episodeNumbers),
    });

    const results = new Map<number, { original: string; fixed: string }>();

    for (let i = 0; i < episodeNumbers.length; i++) {
      const epNum = episodeNumbers[i];
      const original = episodeContents[epNum] || '';

      callbacks.onEpisodeStart?.(epNum, i, episodeNumbers.length);
      console.log(`[RewriteService] 开始修复第${epNum}集 (${i + 1}/${episodeNumbers.length})`);

      const fixedContent = await this.executeSequentialFix(
        epNum, original, plan, results, episodeNumbers.slice(i + 1),
        originalIssue, fullContext.characters, callbacks, i, episodeNumbers.length
      );

      results.set(epNum, { original, fixed: fixedContent });
      callbacks.onEpisodeComplete?.(epNum, fixedContent);

      console.log(`[RewriteService] 第${epNum}集结果:`, {
        originalLength: original.length,
        fixedLength: fixedContent.length,
        changeRatio: original.length > 0
          ? ((fixedContent.length - original.length) / original.length * 100).toFixed(2) + '%'
          : 'N/A',
      });
    }

    callbacks.onComplete?.('全部修复完成');
    console.log('[RewriteService] executeMultiEpisodeFix 全部完成:', {
      totalEpisodes: episodeNumbers.length, resultCount: results.size,
    });

    return results;
  }

  private generateFixSummary(content: string): string {
    const preview = content.substring(0, 200).replace(/\n/g, ' ');
    return preview + (content.length > 200 ? '...' : '');
  }

  private extractKeyChanges(
    original: string,
    fixed: string,
    planChanges: Array<{ location: string; modified: string; reason: string }>
  ): string[] {
    if (planChanges.length > 0) return planChanges.map(c => `${c.location}: ${c.reason}`);
    if (original !== fixed) return ['已实施修复方案'];
    return ['无变更'];
  }

  /**
   * 构建跨集修复上下文并生成提示词
   */
  private buildSequentialFixPrompt(
    epNum: number,
    content: string,
    plan: CrossEpisodeFixPlan,
    previousResults: Map<number, { original: string; fixed: string }>,
    upcomingEpisodes: number[],
    originalIssue: { type: string; description: string; evidence?: string } | undefined,
    characterContext: string,
  ): string {
    const previousFixes = Array.from(previousResults.entries())
      .filter(([ep]) => ep < epNum)
      .sort((a, b) => a[0] - b[0])
      .map(([ep, data]) => ({
        episode: ep,
        summary: this.generateFixSummary(data.fixed),
        keyChanges: this.extractKeyChanges(data.original, data.fixed, plan.changes.filter(c => c.episode === ep)),
      }));

    const upcomingFixes = upcomingEpisodes.map(ep => ({
      episode: ep,
      plannedChanges: plan.changes
        .filter(c => c.episode === ep)
        .map(c => c.reason)
        .join('；') || '保持一致性调整',
    }));

    return getSequentialFixPrompt({
      originalIssue: originalIssue || { type: 'cross_episode', description: plan.description },
      currentEpisode: epNum,
      currentContent: content,
      changes: plan.changes.filter(c => c.episode === epNum).map(c => ({
        location: c.location,
        original: c.original,
        modified: c.modified,
        reason: c.reason,
        relatedTo: c.relatedTo,
      })),
      crossEpisodeContext: { previousFixes, upcomingFixes },
      planName: plan.name,
      planDescription: plan.description,
      characterContext,
    });
  }

  /**
   * 执行单集流式修复（executeMultiEpisodeFix / retrySingleEpisodeFix 共用）
   */
  private async executeSequentialFix(
    epNum: number,
    content: string,
    plan: CrossEpisodeFixPlan,
    previousResults: Map<number, { original: string; fixed: string }>,
    upcomingEpisodes: number[],
    originalIssue: { type: string; description: string; evidence?: string } | undefined,
    characterContext: string,
    callbacks: AIStreamCallbacks,
    index: number,
    total: number,
  ): Promise<string> {
    const prompt = this.buildSequentialFixPrompt(
      epNum, content, plan, previousResults, upcomingEpisodes, originalIssue, characterContext
    );
    console.log(`[RewriteService] 第${epNum}集提示词长度:`, prompt.length);

    let fixedContent = '';
    await new Promise<void>((resolve, reject) => {
      this.aiClient.generateStream(
        prompt,
        `请执行第${epNum}集修复（${index + 1}/${total}）`,
        {
          onChunk: (chunk) => {
            fixedContent += chunk;
            callbacks.onChunk?.(chunk);
          },
          onComplete: () => {
            console.log(`[RewriteService] 第${epNum}集修复完成, 内容长度:`, fixedContent.length);
            resolve();
          },
          onError: (err) => {
            console.error(`[RewriteService] 第${epNum}集修复失败:`, err);
            reject(err);
          },
        },
        8192
      );
    });

    return fixedContent;
  }

  /**
   * 单集重试修复
   */
  async retrySingleEpisodeFix(
    episodeNumber: number,
    plan: CrossEpisodeFixPlan,
    previousResults: Map<number, { original: string; fixed: string }>,
    callbacks: AIStreamCallbacks,
    originalIssue?: { type: string; description: string; evidence?: string }
  ): Promise<{ original: string; fixed: string }> {
    console.log(`[RewriteService] retrySingleEpisodeFix 开始: 第${episodeNumber}集`);

    const episode = await episodeRepository.findByNumber(this.projectId, episodeNumber);
    if (!episode?.content) throw new Error(`第${episodeNumber}集内容不存在`);
    const original = episode.content;

    const fullContext = await this.contextManager.buildFullContext({
      currentEpisode: episodeNumber,
    });

    const allEpisodes = [...new Set(plan.changes.map(c => c.episode))].sort((a, b) => a - b);
    const upcomingEpisodes = allEpisodes.filter(ep => ep > episodeNumber);

    const prompt = this.buildSequentialFixPrompt(
      episodeNumber, original, plan, previousResults, upcomingEpisodes, originalIssue, fullContext.characters
    );
    console.log(`[RewriteService] 第${episodeNumber}集重试提示词长度:`, prompt.length);

    let fixedContent = '';
    await new Promise<void>((resolve, reject) => {
      this.aiClient.generateStream(
        prompt,
        `请执行第${episodeNumber}集修复（重试）`,
        {
          onChunk: (chunk) => {
            fixedContent += chunk;
            callbacks.onChunk?.(chunk);
          },
          onComplete: () => {
            console.log(`[RewriteService] 第${episodeNumber}集重试完成, 内容长度:`, fixedContent.length);
            callbacks.onComplete?.(fixedContent);
            resolve();
          },
          onError: (err) => {
            console.error(`[RewriteService] 第${episodeNumber}集重试失败:`, err);
            callbacks.onError?.(err);
            reject(err);
          },
        },
        8192
      );
    });

    return { original, fixed: fixedContent };
  }

  async applyCrossEpisodeFix(
    fixResults: Map<number, { original: string; fixed: string }>,
    issue: {
      type: string;
      description: string;
      episode: number;
      evidence?: string;
    },
    plan: CrossEpisodeFixPlan,
    options?: { excludeEpisodes?: number[] }
  ): Promise<{
    masterHistoryId: string;
    appliedEpisodes: number[];
    historyIds: string[];
  }> {
    const excludeSet = new Set(options?.excludeEpisodes || []);
    const appliedEpisodes: number[] = [];
    const historyIds: string[] = [];
    let masterHistoryId = '';

    for (const [epNum, result] of fixResults) {
      if (excludeSet.has(epNum) || result.original === result.fixed) continue;

      const episode = await episodeRepository.findByNumber(this.projectId, epNum);
      if (!episode) continue;

      await episodeRepository.update(episode._id.toString(), { content: await this.normalizeIfOverseas(result.fixed) });

      const originalWordCount = result.original.replace(/\s/g, '').length;
      const fixedWordCount = result.fixed.replace(/\s/g, '').length;

      const history = new RewriteHistory({
        projectId: new mongoose.Types.ObjectId(this.projectId),
        episodeId: episode._id,
        episodeNumber: epNum,
        type: 'cross-episode-fix',
        instruction: `跨集修复: ${issue.description}\n方案: ${plan.name}`,
        originalContent: result.original,
        rewrittenContent: result.fixed,
        originalWordCount,
        rewrittenWordCount: fixedWordCount,
        wordCountDiff: fixedWordCount - originalWordCount,
        applied: true,
        appliedAt: new Date(),
        systemPrompt: JSON.stringify({
          issue: {
            type: issue.type,
            description: issue.description,
            sourceEpisode: issue.episode,
            evidence: issue.evidence,
          },
          plan: { id: plan.id, name: plan.name, description: plan.description, confidence: plan.confidence },
          affectedEpisodes: Array.from(fixResults.keys()).map(n => ({ episodeNumber: n })),
          masterHistoryId: '',
        } as Partial<CrossEpisodeFixMetadata>),
      });

      await history.save();
      historyIds.push(history._id.toString());
      appliedEpisodes.push(epNum);
      if (!masterHistoryId) masterHistoryId = history._id.toString();
    }

    if (masterHistoryId && historyIds.length > 1) {
      for (const historyId of historyIds) {
        const history = await RewriteHistory.findById(historyId);
        if (history) {
          const metadata = JSON.parse(history.systemPrompt || '{}');
          metadata.masterHistoryId = masterHistoryId;
          metadata.affectedEpisodes = appliedEpisodes.map(n => ({
            episodeNumber: n,
            historyId: historyIds[appliedEpisodes.indexOf(n)],
          }));
          history.systemPrompt = JSON.stringify(metadata);
          await history.save();
        }
      }
    }

    return { masterHistoryId, appliedEpisodes, historyIds };
  }

  async validateFixResult(
    originalIssue: {
      type: string;
      description: string;
      episode: number;
      evidence?: string;
    },
    affectedEpisodes: number[]
  ): Promise<{
    passed: boolean;
    originalIssueResolved: boolean;
    details: string;
  }> {
    const fixedEpisodeContents = await this.fetchEpisodeContents(affectedEpisodes);

    const options: TargetedValidationOptions = {
      originalIssue,
      fixedEpisodeContents,
    };

    const prompt = getTargetedValidationPrompt(options);
    const response = await this.aiClient.generate(prompt, '请验证修复效果。', 4096);

    interface ValidationResult {
      passed?: boolean;
      originalIssueResolved?: boolean;
      details?: string;
    }

    const result = robustParseJson<ValidationResult>(response, {
      passed: false,
      originalIssueResolved: false,
      details: '验证解析失败',
    });

    return {
      passed: result.passed ?? false,
      originalIssueResolved: result.originalIssueResolved ?? false,
      details: result.details || '验证完成',
    };
  }

  async revertCrossEpisodeFix(
    masterHistoryId: string,
    options?: { episodesToRevert?: number[] }
  ): Promise<{
    revertedEpisodes: number[];
    affectedHistoryIds: string[];
  }> {
    const masterHistory = await RewriteHistory.findById(masterHistoryId);
    if (!masterHistory) throw new Error('修复记录不存在');

    const metadata = JSON.parse(masterHistory.systemPrompt || '{}') as Partial<CrossEpisodeFixMetadata>;

    const revertSet = options?.episodesToRevert
      ? new Set(options.episodesToRevert)
      : null;

    const revertedEpisodes: number[] = [];
    const affectedHistoryIds: string[] = [];

    const histories = await RewriteHistory.find({
      projectId: masterHistory.projectId,
      type: 'cross-episode-fix',
      applied: true,
    });

    for (const history of histories) {
      const historyMeta = JSON.parse(history.systemPrompt || '{}') as Partial<CrossEpisodeFixMetadata>;
      if (historyMeta.masterHistoryId !== masterHistoryId && history._id.toString() !== masterHistoryId) {
        continue;
      }
      if (revertSet && !revertSet.has(history.episodeNumber)) continue;

      await episodeRepository.update(history.episodeId.toString(), {
        content: history.originalContent,
      });

      history.applied = false;
      history.reverted = true;
      await history.save();

      revertedEpisodes.push(history.episodeNumber);
      affectedHistoryIds.push(history._id.toString());
    }

    return { revertedEpisodes, affectedHistoryIds };
  }
}

export interface FixPlan {
  id: string;
  name: string;
  description: string;
  confidence: number;
  changes: Array<{
    episode: number;
    location: string;
    original: string;
    modified: string;
    reason: string;
  }>;
  sideEffects?: string;
  recommended: boolean;
}

export interface CrossEpisodeFixPlan extends FixPlan {
  changes: Array<{
    episode: number;
    role?: 'source' | 'bridge' | 'resolution';
    priority?: 'required' | 'recommended' | 'optional';
    location: string;
    original: string;
    modified: string;
    reason: string;
    relatedTo?: number[];
  }>;
  connections?: Array<{
    fromEpisode: number;
    toEpisode: number;
    type: 'foreshadowing' | 'callback' | 'continuation';
    description: string;
  }>;
}

export interface CrossEpisodeFixMetadata {
  issue: {
    type: string;
    description: string;
    sourceEpisode: number;
    evidence?: string;
  };
  plan: {
    id: string;
    name: string;
    description: string;
    confidence: number;
  };
  affectedEpisodes: Array<{
    episodeId?: string;
    episodeNumber: number;
    historyId?: string;
  }>;
  relatedForeshadowings?: Array<{
    foreshadowingId: string;
    content: string;
    previousStatus: string;
    newStatus?: string;
  }>;
  validation?: {
    passed: boolean;
    originalIssueResolved: boolean;
    validatedAt: string;
  };
  masterHistoryId?: string;
}
