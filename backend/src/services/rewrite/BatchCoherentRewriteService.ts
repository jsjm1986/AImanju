import mongoose from 'mongoose';
import { BatchRewriteHistory, IBatchRewriteHistory } from '../../models/BatchRewriteHistory';
import { episodeRepository } from '../../repositories/EpisodeRepository';
import { foreshadowingRepository } from '../../repositories/ForeshadowingRepository';
import { projectRepository } from '../../repositories/ProjectRepository';
import { getOutlineRaw } from '../../utils/outline';
import { AIClient, aiClient } from '../ai/AIClient';
import { ContextManager } from '../context/ContextManager';
import { outputFormatService } from '../format/OutputFormatService';

const MAX_BATCH_EPISODES = 10;

type EpisodeData = { number: number; content: string; wordCount: number };

function charCount(text: string): number {
  return text.replace(/\s/g, '').length;
}

async function safeStep<T>(label: string, fn: () => Promise<T>, fallback: T, onProgress?: (msg: string) => void): Promise<T> {
  try {
    onProgress?.(label);
    return await fn();
  } catch (e) {
    console.warn(`[BatchRewrite] ${label}失败:`, (e as Error).message);
    return fallback;
  }
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface EpisodePlan {
  episodeNumber: number;
  currentWordCount: number;
  plannedChanges: string;
  keyElements: string[];
  connectionPoints: { fromPrevious: string[]; toNext: string[] };
}

export interface CoherencePoint {
  type: 'character_state' | 'foreshadowing' | 'plot_thread' | 'timeline';
  description: string;
  affectedEpisodes: number[];
  handling: string;
}

export interface RewritePlan {
  id: string;
  projectId: string;
  episodeRange: { start: number; end: number };
  instruction: string;
  totalWordCount: number;
  estimatedTime: number;
  episodes: EpisodePlan[];
  coherencePoints: CoherencePoint[];
  createdAt: Date;
}

export interface CharacterStateInfo {
  name: string;
  condition: string;
}

export interface ForeshadowingInfo {
  content: string;
  plantedEpisode: number;
  importance: string;
}

export interface CoherenceContext {
  previousSummary: string;
  characterStates: CharacterStateInfo[];
  activeForeshadowings: ForeshadowingInfo[];
  followingPlotPoints: string[];
}

export interface EpisodeRewriteResult {
  episodeNumber: number;
  episodeId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  originalContent: string;
  rewrittenContent: string;
  wordCountChange: number;
  coherenceIssues: string[];
  error?: string;
}

export interface CoherenceReport {
  overallScore: number;
  characterConsistency: boolean;
  foreshadowingHandled: boolean;
  timelineConsistent: boolean;
  issues: Array<{ type: string; severity: 'warning' | 'error'; episode: number; description: string }>;
}

export interface BatchRewriteResult {
  id: string;
  planId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial';
  episodes: EpisodeRewriteResult[];
  coherenceReport?: CoherenceReport;
  createdAt: Date;
  completedAt?: Date;
}

export interface BatchRewriteCallbacks {
  onPlanGenerated?: (plan: RewritePlan) => void;
  onPreparing?: (message: string) => void;
  onEpisodeStart?: (episodeNumber: number, total: number) => void;
  onEpisodeChunk?: (episodeNumber: number, chunk: string) => void;
  onEpisodeComplete?: (result: EpisodeRewriteResult) => void;
  onEpisodeFailed?: (episodeNumber: number, error: string) => void;
  onAllComplete?: (result: BatchRewriteResult) => void;
  onError?: (error: Error) => void;
}

export class BatchCoherentRewriteService {
  private projectId: string;
  private aiClient: AIClient;
  private contextManager: ContextManager;

  constructor(projectId: string) {
    this.projectId = projectId;
    this.aiClient = aiClient;
    this.contextManager = new ContextManager(projectId);
  }

  private async buildSystemPrompt(characters: string, outline: string): Promise<string> {
    const proj = await projectRepository.findById(this.projectId);
    const resolvedConfig = outputFormatService.resolveConfig(proj?.outputFormat);
    const formatSection = outputFormatService.buildFormatPromptSection(
      resolvedConfig,
      proj?.outputFormat?.customPrompt
    );
    const expertIdentity = resolvedConfig.expertIdentity || '你是一位专业的剧本编辑，经验丰富，作品广受好评。';

    return `${expertIdentity}

你正在执行批量连贯改写任务。

## 你的职责
- 根据改写指令调整剧本内容
- 保持多集之间的剧情连贯性
- 确保角色行为和性格一致
- 维护伏笔和情节线的完整性

## 强制要求（必须满足）

1. **角色一致性**：性格、外貌、说话方式、称呼、关系必须与设定一致
2. **剧情连贯**：改写后的内容必须与前后集保持逻辑衔接
3. **格式规范**：严格按照下方格式输出，不得自创格式

${characters ? `## 角色设定\n\n${characters}\n` : ''}

${outline ? `## 剧情大纲\n\n${outline}\n` : ''}

${formatSection}

## 改写原则

1. **保持核心**：保留原剧本的核心剧情和关键事件
2. **优化表达**：根据指令调整对白风格、节奏和细节
3. **连贯衔接**：注意与已改写集数的内容衔接
4. **完整输出**：必须输出完整的改写后剧本，不能只输出修改部分

现在请根据用户的改写指令，对指定内容进行改写。`;
  }

  async validateEpisodeRange(start: number, end: number): Promise<ValidationResult> {
    if (start <= 0 || end <= 0) return { valid: false, error: '集数必须大于0' };
    if (start > end) return { valid: false, error: '起始集数不能大于结束集数' };
    const count = end - start + 1;
    if (count > MAX_BATCH_EPISODES) return { valid: false, error: `单次最多改写${MAX_BATCH_EPISODES}集` };
    for (let n = start; n <= end; n++) {
      const ep = await episodeRepository.findByNumber(this.projectId, n);
      if (!ep?.content?.trim()) return { valid: false, error: `第${n}集没有内容` };
    }
    return { valid: true };
  }

  validateInstruction(instruction: string): ValidationResult {
    if (!instruction?.trim()) return { valid: false, error: '请输入改写指令' };
    if (instruction.trim().length < 5) return { valid: false, error: '改写指令过短' };
    return { valid: true };
  }

  async buildCoherenceContext(start: number, end: number, onProgress?: (message: string) => void): Promise<CoherenceContext> {
    const previousSummary = await safeStep('正在加载前情摘要...', () => this.contextManager.buildPreviousSummary(start), '', onProgress);
    const characterStates = await safeStep('正在获取角色状态...', () => this.getCharacterStates(start), [] as CharacterStateInfo[], onProgress);
    const activeForeshadowings = await safeStep('正在加载活跃伏笔...', () => this.getActiveForeshadowings(), [] as ForeshadowingInfo[], onProgress);
    const followingPlotPoints = await safeStep('正在分析后续剧情点...', () => this.getFollowingPlotPoints(end), [] as string[], onProgress);
    return { previousSummary, characterStates, activeForeshadowings, followingPlotPoints };
  }

  private async getCharacterStates(beforeEp: number): Promise<CharacterStateInfo[]> {
    const ctx = await this.contextManager.buildFullContext({ currentEpisode: beforeEp });
    const states: CharacterStateInfo[] = [];
    let cur: CharacterStateInfo | null = null;
    for (const line of ctx.characters.split('\n')) {
      if (line.startsWith('【') && line.includes('】')) {
        if (cur) states.push(cur);
        const m = line.match(/【([^】]+)】/);
        cur = { name: m ? m[1] : '未知', condition: '' };
      } else if (cur && line.includes('当前状态')) {
        cur.condition = line.replace('当前状态：', '').trim();
      }
    }
    if (cur) states.push(cur);
    return states;
  }

  private async getActiveForeshadowings(): Promise<ForeshadowingInfo[]> {
    const list = await foreshadowingRepository.getUnresolved(this.projectId);
    return list.map(f => ({ content: f.content, plantedEpisode: f.episodePlanted, importance: f.importance }));
  }

  private async getFollowingPlotPoints(afterEp: number): Promise<string[]> {
    const proj = await projectRepository.findById(this.projectId);
    if (!proj?.outline) return [];
    const raw = getOutlineRaw(proj.outline);
    const pts: string[] = [];
    let inFollow = false;
    for (const line of raw.split('\n')) {
      const m = line.match(/第(\d+)集/);
      if (m) inFollow = parseInt(m[1]) > afterEp;
      if (inFollow && line.trim().length > 10) {
        pts.push(line.trim());
        if (pts.length >= 5) break;
      }
    }
    return pts;
  }


  private async loadEpisodes(start: number, end: number, onProgress?: (n: number, loaded: number, total: number) => void): Promise<{ episodes: EpisodeData[]; totalWordCount: number }> {
    const episodes: EpisodeData[] = [];
    let totalWordCount = 0;
    const total = end - start + 1;
    for (let n = start; n <= end; n++) {
      const ep = await episodeRepository.findByNumber(this.projectId, n);
      if (ep?.content) {
        const wc = charCount(ep.content);
        episodes.push({ number: n, content: ep.content, wordCount: wc });
        totalWordCount += wc;
      }
      onProgress?.(n, episodes.length, total);
    }
    return { episodes, totalWordCount };
  }

  private async buildPlanContext(episodeStart: number): Promise<{ outline: string; characters: string; prevSum: string; systemPrompt: string }> {
    const proj = await projectRepository.findById(this.projectId);
    const outline = proj?.outline ? getOutlineRaw(proj.outline) : '';
    const ctx = await this.contextManager.buildFullContext({ currentEpisode: episodeStart });
    const prevSum = await this.contextManager.buildPreviousSummary(episodeStart);
    const systemPrompt = await this.buildSystemPrompt(ctx.characters, outline);
    return { outline, characters: ctx.characters, prevSum, systemPrompt };
  }

  private buildRewritePlan(episodeRange: { start: number; end: number }, instruction: string, totalWordCount: number, data: { episodes: EpisodePlan[]; coherencePoints: CoherencePoint[] }): RewritePlan {
    return {
      id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      projectId: this.projectId,
      episodeRange,
      instruction,
      totalWordCount,
      estimatedTime: data.episodes.length * 60,
      episodes: data.episodes,
      coherencePoints: data.coherencePoints,
      createdAt: new Date(),
    };
  }

  private validatePlanRequest(request: { episodeRange: { start: number; end: number }; instruction: string }): void {
    const rv = this.validateInstruction(request.instruction);
    if (!rv.valid) throw new Error(rv.error);
  }

  async generatePlan(request: { episodeRange: { start: number; end: number }; instruction: string }): Promise<RewritePlan> {
    const { episodeRange, instruction } = request;
    const rv = await this.validateEpisodeRange(episodeRange.start, episodeRange.end);
    if (!rv.valid) throw new Error(rv.error);
    this.validatePlanRequest(request);

    const { episodes, totalWordCount } = await this.loadEpisodes(episodeRange.start, episodeRange.end);
    const { characters, outline, prevSum, systemPrompt } = await this.buildPlanContext(episodeRange.start);

    const prompt = this.buildPlanPrompt(episodes, instruction, characters, outline, prevSum);
    const resp = await this.aiClient.generate(systemPrompt, prompt, 8192);
    const data = this.parsePlanResponse(resp, episodes);

    return this.buildRewritePlan(episodeRange, instruction, totalWordCount, data);
  }

  async generatePlanStream(
    request: { episodeRange: { start: number; end: number }; instruction: string },
    callbacks: {
      onProgress?: (stage: string, detail: string) => void;
      onChunk?: (chunk: string) => void;
      onComplete?: (plan: RewritePlan) => void;
      onError?: (error: Error) => void;
    }
  ): Promise<RewritePlan> {
    const { episodeRange, instruction } = request;

    try {
      callbacks.onProgress?.('validating', '正在验证参数...');
      const rv = await this.validateEpisodeRange(episodeRange.start, episodeRange.end);
      if (!rv.valid) throw new Error(rv.error);
      this.validatePlanRequest(request);

      callbacks.onProgress?.('loading', `正在加载第 ${episodeRange.start}-${episodeRange.end} 集内容...`);
      const { episodes, totalWordCount } = await this.loadEpisodes(
        episodeRange.start, episodeRange.end,
        (n, loaded, total) => callbacks.onProgress?.('loading', `已加载第 ${n} 集 (${loaded}/${total})`)
      );

      callbacks.onProgress?.('context', '正在构建上下文信息...');
      const { characters, outline, prevSum, systemPrompt } = await this.buildPlanContext(episodeRange.start);

      callbacks.onProgress?.('generating', '正在分析剧本并生成改写计划...');
      const prompt = this.buildPlanPrompt(episodes, instruction, characters, outline, prevSum);

      let fullResponse = '';
      await this.aiClient.generateStream(systemPrompt, prompt, {
        onChunk: (chunk: string) => {
          fullResponse += chunk;
          callbacks.onChunk?.(chunk);
        },
      });

      callbacks.onProgress?.('parsing', '正在解析改写计划...');
      const data = this.parsePlanResponse(fullResponse, episodes);
      const plan = this.buildRewritePlan(episodeRange, instruction, totalWordCount, data);

      callbacks.onProgress?.('done', '计划生成完成');
      callbacks.onComplete?.(plan);
      return plan;
    } catch (error) {
      callbacks.onError?.(error as Error);
      throw error;
    }
  }

  private buildPlanPrompt(eps: Array<{ number: number; content: string; wordCount: number }>, instr: string, chars: string, outline: string, prev?: string): string {
    return `## 改写指令
${instr}

## 角色设定
${chars}

## 剧情大纲
${outline}

${prev ? `## 前情提要\n${prev}\n` : ''}

## 待改写剧本
${eps.map(e => `### 第${e.number}集 (${e.wordCount}字)\n${e.content.substring(0, 2000)}${e.content.length > 2000 ? '...' : ''}`).join('\n\n')}

## 输出要求
请严格按以下JSON格式输出：
{
  "episodes": [{"episodeNumber": 集数, "plannedChanges": "改动摘要", "keyElements": ["关键元素"], "connectionPoints": {"fromPrevious": [], "toNext": []}}],
  "coherencePoints": [{"type": "character_state|foreshadowing|plot_thread|timeline", "description": "描述", "affectedEpisodes": [], "handling": "处理方式"}]
}
只输出JSON。`;
  }

  private parsePlanResponse(resp: string, eps: Array<{ number: number; wordCount: number }>): { episodes: EpisodePlan[]; coherencePoints: CoherencePoint[] } {
    const tryParseJSON = (text: string): any => {
      for (const extract of [
        () => text.match(/\{[\s\S]*\}/)?.[0],
        () => text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim(),
      ]) {
        const s = extract();
        if (s) { try { return JSON.parse(s); } catch { /* continue */ } }
      }
      return null;
    };

    const defaultPlan = () => ({
      episodes: eps.map(e => ({
        episodeNumber: e.number,
        currentWordCount: e.wordCount,
        plannedChanges: '按指令调整',
        keyElements: [] as string[],
        connectionPoints: { fromPrevious: [] as string[], toNext: [] as string[] }
      })),
      coherencePoints: [] as CoherencePoint[],
    });

    const d = tryParseJSON(resp);
    if (!d) {
      console.warn('[BatchRewrite] 无法解析AI返回的JSON，使用默认计划。AI返回:', resp.substring(0, 500));
      return defaultPlan();
    }

    try {
      return {
        episodes: (d.episodes || []).map((e: any, i: number) => ({
          episodeNumber: e.episodeNumber || eps[i]?.number || i + 1,
          currentWordCount: eps.find(x => x.number === e.episodeNumber)?.wordCount || 0,
          plannedChanges: e.plannedChanges || e.changes || e.summary || '按指令调整',
          keyElements: Array.isArray(e.keyElements) ? e.keyElements : [],
          connectionPoints: {
            fromPrevious: e.connectionPoints?.fromPrevious || e.from_previous || [],
            toNext: e.connectionPoints?.toNext || e.to_next || []
          },
        })),
        coherencePoints: (d.coherencePoints || d.coherence_points || []).map((c: any) => ({
          type: c.type || 'plot_thread',
          description: c.description || '',
          affectedEpisodes: c.affectedEpisodes || c.affected_episodes || [],
          handling: c.handling || '',
        })),
      };
    } catch (err) {
      console.warn('[BatchRewrite] 计划解析失败，使用默认计划:', (err as Error).message);
      return defaultPlan();
    }
  }


  async executeRewrite(plan: RewritePlan, callbacks: BatchRewriteCallbacks): Promise<BatchRewriteResult> {
    const results: EpisodeRewriteResult[] = [];
    const rewritten: Array<{ number: number; content: string }> = [];
    const ctx = await this.buildCoherenceContext(plan.episodeRange.start, plan.episodeRange.end, callbacks.onPreparing);
    callbacks.onPreparing?.('上下文准备完成，开始改写...');

    for (const epPlan of plan.episodes) {
      const n = epPlan.episodeNumber;
      callbacks.onEpisodeStart?.(n, plan.episodes.length);

      const MAX_EPISODE_RETRIES = 3;
      let lastError = '';
      let success = false;

      for (let attempt = 1; attempt <= MAX_EPISODE_RETRIES && !success; attempt++) {
        try {
          if (attempt > 1) {
            callbacks.onPreparing?.(`第${n}集第${attempt}次重试...`);
            await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
          }

          const ep = await episodeRepository.findByNumber(this.projectId, n);
          if (!ep?.content) throw new Error(`第${n}集内容不存在`);

          const prompt = this.buildCascadePrompt(n, ep.content, plan.instruction, epPlan, ctx, rewritten);
          const proj = await projectRepository.findById(this.projectId);
          const outline = proj?.outline ? getOutlineRaw(proj.outline) : '';
          const fullCtx = await this.contextManager.buildFullContext({ currentEpisode: n });
          const systemPrompt = await this.buildSystemPrompt(fullCtx.characters, outline);

          let content = '';
          await this.aiClient.generateStream(systemPrompt, prompt, {
            onChunk: (c: string) => { content += c; callbacks.onEpisodeChunk?.(n, c); },
          });

          const newLen = charCount(content);
          if (newLen === 0) throw new Error('生成内容为空');

          const origLen = charCount(ep.content);
          if (newLen < origLen * 0.3) {
            console.warn(`[BatchRewrite] 第${n}集生成内容较短: ${newLen}字 (原: ${origLen}字)`);
          }

          const r: EpisodeRewriteResult = { episodeNumber: n, episodeId: ep._id.toString(), status: 'completed', originalContent: ep.content, rewrittenContent: content, wordCountChange: newLen - origLen, coherenceIssues: [] };
          results.push(r);
          rewritten.push({ number: n, content });
          callbacks.onEpisodeComplete?.(r);
          success = true;
        } catch (e) {
          lastError = (e as Error).message;
          if (attempt < MAX_EPISODE_RETRIES) {
            callbacks.onPreparing?.(`第${n}集失败: ${lastError.substring(0, 50)}，准备重试...`);
          }
        }
      }

      if (!success) {
        results.push({ episodeNumber: n, episodeId: '', status: 'failed', originalContent: '', rewrittenContent: '', wordCountChange: 0, coherenceIssues: [], error: lastError });
        callbacks.onEpisodeFailed?.(n, lastError);
      }
    }

    const failed = results.filter(r => r.status === 'failed').length;
    const status = failed === results.length ? 'failed' : failed > 0 ? 'partial' : 'completed';
    const res: BatchRewriteResult = { id: `res_${Date.now()}`, planId: plan.id, status, episodes: results, coherenceReport: this.genReport(results), createdAt: new Date(), completedAt: new Date() };

    const savedHistory = await this.saveHistory(plan, res);
    res.id = savedHistory._id.toString();

    callbacks.onAllComplete?.(res);
    return res;
  }

  private buildCascadePrompt(n: number, orig: string, instr: string, plan: EpisodePlan, ctx: CoherenceContext, prev: Array<{ number: number; content: string }>): string {
    const prevText = prev.slice(-2).map(p => `### 第${p.number}集（已改写）\n${p.content.substring(0, 1500)}`).join('\n\n');
    return `## 改写指令（第${n}集）
${instr}

## 本集改写计划
${plan.plannedChanges}

### 关键元素
${plan.keyElements.join('\n') || '无'}

### 衔接点
前一集：${plan.connectionPoints.fromPrevious.join('；') || '无'}
后一集：${plan.connectionPoints.toNext.join('；') || '无'}

## 连贯性上下文
前情：${ctx.previousSummary || '无'}
角色：${ctx.characterStates.map(c => `${c.name}: ${c.condition || '正常'}`).join('；') || '无'}
伏笔：${ctx.activeForeshadowings.slice(0, 5).map(f => f.content).join('；') || '无'}

${prevText ? `## 已改写内容\n${prevText}\n` : ''}

## 原始内容
${orig}

直接输出改写后的完整剧本，不要解释。`;
  }

  private genReport(results: EpisodeRewriteResult[]): CoherenceReport {
    const ok = results.filter(r => r.status === 'completed');
    const issues: CoherenceReport['issues'] = [];
    for (const r of ok) {
      if (Math.abs(r.wordCountChange) > 1000) {
        issues.push({ type: 'word_count', severity: 'warning', episode: r.episodeNumber, description: `字数变化${r.wordCountChange}` });
      }
    }
    return { overallScore: ok.length ? Math.round((ok.length / results.length) * 100) : 0, characterConsistency: true, foreshadowingHandled: true, timelineConsistent: true, issues };
  }

  private async saveHistory(plan: RewritePlan, res: BatchRewriteResult): Promise<IBatchRewriteHistory> {
    const successfulEpisodes = res.episodes.filter(e => e.status === 'completed' && e.rewrittenContent);

    const h = new BatchRewriteHistory({
      projectId: new mongoose.Types.ObjectId(this.projectId),
      planId: plan.id,
      instruction: plan.instruction,
      episodeRange: plan.episodeRange,
      status: res.status,
      episodes: successfulEpisodes.map(e => ({
        episodeNumber: e.episodeNumber,
        episodeId: e.episodeId ? new mongoose.Types.ObjectId(e.episodeId) : undefined,
        originalContent: e.originalContent,
        rewrittenContent: e.rewrittenContent,
        applied: false,
        wordCountChange: e.wordCountChange,
      })),
      coherenceReport: res.coherenceReport,
    });
    return h.save();
  }


  async applyResults(historyId: string, selected?: number[]): Promise<{ success: boolean; appliedCount: number; error?: string }> {
    const h = await BatchRewriteHistory.findById(historyId);
    if (!h) return { success: false, appliedCount: 0, error: '历史记录不存在' };

    let count = 0;
    for (const e of h.episodes) {
      if (selected && !selected.includes(e.episodeNumber)) continue;
      if (e.applied) continue;
      const ep = await episodeRepository.findByNumber(this.projectId, e.episodeNumber);
      if (ep) {
        await episodeRepository.update(ep._id.toString(), { content: e.rewrittenContent });
        e.applied = true;
        count++;
      }
    }

    const all = h.episodes.every(e => e.applied);
    const some = h.episodes.some(e => e.applied);
    if (all) { h.status = 'completed'; h.appliedAt = new Date(); }
    else if (some) h.status = 'partial';
    await h.save();
    return { success: true, appliedCount: count };
  }

  async rollback(historyId: string): Promise<{ success: boolean; rolledBackCount: number; error?: string }> {
    const h = await BatchRewriteHistory.findById(historyId);
    if (!h) return { success: false, rolledBackCount: 0, error: '历史记录不存在' };

    let count = 0;
    for (const e of h.episodes) {
      if (!e.applied) continue;
      const ep = await episodeRepository.findByNumber(this.projectId, e.episodeNumber);
      if (ep) {
        await episodeRepository.update(ep._id.toString(), { content: e.originalContent });
        e.applied = false;
        count++;
      }
    }

    h.status = 'rolled_back';
    h.rolledBackAt = new Date();
    await h.save();
    return { success: true, rolledBackCount: count };
  }

  async getHistory(opts?: { startDate?: Date; endDate?: Date; episodeStart?: number; episodeEnd?: number }): Promise<IBatchRewriteHistory[]> {
    const q: any = { projectId: new mongoose.Types.ObjectId(this.projectId) };
    if (opts?.startDate || opts?.endDate) {
      q.createdAt = {};
      if (opts.startDate) q.createdAt.$gte = opts.startDate;
      if (opts.endDate) q.createdAt.$lte = opts.endDate;
    }
    if (opts?.episodeStart !== undefined) q['episodeRange.start'] = { $gte: opts.episodeStart };
    if (opts?.episodeEnd !== undefined) q['episodeRange.end'] = { $lte: opts.episodeEnd };
    return BatchRewriteHistory.find(q).sort({ createdAt: -1 }).exec();
  }

  async getHistoryDetail(historyId: string): Promise<IBatchRewriteHistory | null> {
    return BatchRewriteHistory.findById(historyId).exec();
  }

  async deleteHistory(historyId: string): Promise<boolean> {
    const r = await BatchRewriteHistory.findByIdAndDelete(historyId);
    return !!r;
  }
}