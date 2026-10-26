import { aiClient, AIStreamCallbacks, withModel, createAbortError } from '../ai/AIClient';
import { isOverseasFemaleChannel, isOverseasProject } from '../../constants/overseas';
import {
  getOutlineCharactersPrompt,
  getOutlineSynopsisPrompt,
  getOutlineEpisodesBatchPrompt,
  buildOutlineUserPrompt,
  EnhancedOutlineParams,
  StoryMode,
  PacingStyle,
  PreviousSeasonContext,
  getStoryCorePrompt,
  getCharacterFunctionsPrompt,
  getEnhancedCharacterCardsPrompt,
  getEnhancedSynopsisPrompt,
  getEnhancedEpisodesBatchPrompt,
} from './outlinePrompts';

export interface OutlineParams {
  name: string;
  genre: string;
  type: string;
  totalEpisodes: number;
  concept: string;
  requirements?: string;
  storyMode?: StoryMode;
  pacing?: PacingStyle;
  previousSeasonContext?: PreviousSeasonContext;
  expertIdentity?: string;
}

export interface OutlineStreamCallbacks {
  onStepStart?: (step: number, name: string) => void;
  onChunk?: (step: number, chunk: string) => void;
  /** 步骤完成（含内容）；异步回调会被 await——用于断点持久化 */
  onStepDone?: (step: number, content: string) => void | Promise<void>;
  /** 分集梗概单批完成；异步回调会被 await——用于断点持久化 */
  onBatchDone?: (step: number, batch: { startEpisode: number; endEpisode: number; content: string }) => void | Promise<void>;
  onBatchProgress?: (step: number, batch: number, totalBatches: number, startEp: number, endEp: number) => void;
  onComplete?: (result: OutlineResult) => void | Promise<void>;
  onError?: (error: Error) => void;
}

/** 可恢复的检查点（仅服务端已持久化的连续完成步骤/批次） */
export interface OutlineResumeCheckpoint {
  completedSteps: number[];
  result: Partial<OutlineResult>;
  episodeBatches: Array<{ startEpisode: number; endEpisode: number; content: string }>;
}

export interface OutlineRunOptions {
  resume?: OutlineResumeCheckpoint;
  signal?: AbortSignal;
  /** 显式模型快照（如批量任务指定模型）；不传则取当前选择 */
  modelName?: string;
}

export interface OutlineResult {
  raw: string;
  characterCards: string;
  synopsis: string;
  episodeSummaries: string;
  storyCore?: string;
  characterFunctions?: string;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(createAbortError()); return; }
    const onAbort = () => {
      clearTimeout(timer);
      reject(createAbortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createAbortError();
}

/** 返回 [start,end] 中未在文本里出现「第N集」标题标记的集号（后随冒号/换行，容忍空白与"（一卡）"类标注写法；不匹配"第N集结尾"这类正文引用） */
function findMissingEpisodes(content: string, start: number, end: number): number[] {
  const missing: number[] = [];
  for (let n = start; n <= end; n++) {
    if (!new RegExp(`第\\s*${n}\\s*集\\s*(?:[（(][^()（）]{0,20}[)）]\\s*)?[：:\\n]`).test(content)) missing.push(n);
  }
  return missing;
}

export class OutlineService {

  /** 步骤号 → OutlineResult 字段（标准模式：1人物卡 2大纲 3分集；增强模式：1内核 2功能 3人物卡 4大纲 5分集） */
  private stepField(step: number, enhanced: boolean): keyof Omit<OutlineResult, 'raw'> | null {
    if (enhanced) {
      switch (step) {
        case 1: return 'storyCore';
        case 2: return 'characterFunctions';
        case 3: return 'characterCards';
        case 4: return 'synopsis';
        case 5: return 'episodeSummaries';
        default: return null;
      }
    }
    switch (step) {
      case 1: return 'characterCards';
      case 2: return 'synopsis';
      case 3: return 'episodeSummaries';
      default: return null;
    }
  }

  /**
   * 恢复模式下跳过已持久化的步骤：
   * 仅发 step_start（checkpoint 事件已水合内容），不回放 chunk、不发 LLM 请求、
   * 不重复触发持久化回调（内容已在新运行草稿中拷贝）。
   */
  private async skipStep(
    step: number,
    name: string,
    savedContent: string,
    callbacks: OutlineStreamCallbacks,
    signal?: AbortSignal
  ): Promise<string> {
    throwIfAborted(signal);
    callbacks.onStepStart?.(step, name);
    return savedContent;
  }

  /**
   * 判断步骤是否可直接使用已保存结果：
   * 步骤号必须在 contiguous 完成序列内（从1起无空洞），且草稿中有对应字段
   */
  private stepSavedContent(step: number, enhanced: boolean, resume?: OutlineResumeCheckpoint): string | null {
    if (!resume) return null;
    const contiguous = [...resume.completedSteps].sort((a, b) => a - b);
    let count = 0;
    for (const s of contiguous) {
      if (s === count + 1) count = s; else break;
    }
    if (step > count) return null;
    const field = this.stepField(step, enhanced);
    if (!field) return null;
    const saved = resume.result[field];
    return typeof saved === 'string' && saved ? saved : null;
  }

  async generateOutlineStream(
    params: OutlineParams,
    callbacks: OutlineStreamCallbacks,
    options: OutlineRunOptions = {}
  ): Promise<OutlineResult> {
    return withModel(options.modelName || aiClient.getCurrentModelName(), () =>
      this.runStandard(params, callbacks, options)
    );
  }

  private async runStandard(
    params: OutlineParams,
    callbacks: OutlineStreamCallbacks,
    options: OutlineRunOptions
  ): Promise<OutlineResult> {
    const { totalEpisodes } = params;
    const baseUserMessage = buildOutlineUserPrompt(params);
    const overseas = isOverseasProject(params.genre, params.type);
    const overseasChannel = overseas
      ? (isOverseasFemaleChannel(params.genre, params.type) ? 'female' as const : 'male' as const)
      : undefined;
    const signal = options.signal;

    console.log('[AI-Stream] 开始流式生成大纲...');
    console.log('[AI-Stream] 用户概念:', params.concept?.substring(0, 100));

    try {
      const saved1 = this.stepSavedContent(1, false, options.resume);
      const characterCards = saved1 !== null
        ? await this.skipStep(1, '生成人物卡', saved1, callbacks, signal)
        : await this.runStep(
            1, '生成人物卡', '[AI-Stream]',
            getOutlineCharactersPrompt(params.expertIdentity, overseasChannel),
            baseUserMessage, callbacks, signal
          );

      const saved2 = this.stepSavedContent(2, false, options.resume);
      const synopsis = saved2 !== null
        ? await this.skipStep(2, '生成剧情大纲', saved2, callbacks, signal)
        : await this.runStep(
            2, '生成剧情大纲', '[AI-Stream]',
            getOutlineSynopsisPrompt(characterCards, params.expertIdentity, overseas),
            baseUserMessage, callbacks, signal
          );

      const saved3 = this.stepSavedContent(3, false, options.resume);
      const episodeSummaries = saved3 !== null
        ? await this.skipStep(3, '生成分集梗概', saved3, callbacks, signal)
        : await this.generateBatchEpisodesWithStart(
            3, '生成分集梗概', totalEpisodes, '[AI-Stream]', callbacks, signal,
            (start, end, prevSummary) => ({
              system: getOutlineEpisodesBatchPrompt(
                characterCards, synopsis, start, end, totalEpisodes, prevSummary, params.expertIdentity, overseas
              ),
              user: baseUserMessage,
            }),
            options.resume?.episodeBatches
          );
      if (saved3 === null) await callbacks.onStepDone?.(3, episodeSummaries);

      const raw = `### 一、人物卡\n\n${characterCards}\n\n### 二、剧情大纲\n\n${synopsis}\n\n### 三、分集梗概\n\n${episodeSummaries}`;
      const result: OutlineResult = { raw, characterCards, synopsis, episodeSummaries };

      throwIfAborted(signal);
      await callbacks.onComplete?.(result);
      console.log('[AI-Stream] 流式大纲生成完成');
      return result;
    } catch (error) {
      console.error('[AI-Stream] 生成大纲错误:', error);
      callbacks.onError?.(error as Error);
      throw error;
    }
  }

  private async generateBatchEpisodesWithStart(
    step: number,
    name: string,
    totalEpisodes: number,
    logPrefix: string,
    callbacks: OutlineStreamCallbacks,
    signal: AbortSignal | undefined,
    buildMessages: (start: number, end: number, prevSummary: string) => { system: string; user: string },
    resumeBatches?: Array<{ startEpisode: number; endEpisode: number; content: string }>
  ): Promise<string> {
    throwIfAborted(signal);
    callbacks.onStepStart?.(step, name);
    return this.generateBatchEpisodes(totalEpisodes, step, logPrefix, callbacks, signal, buildMessages, resumeBatches);
  }

  private async streamGenerate(
    systemPrompt: string,
    userMessage: string,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    let fullContent = '';

    await aiClient.generateStream(systemPrompt, userMessage, {
      onChunk: (text) => {
        fullContent += text;
        onChunk(text);
      },
      onComplete: () => { },
      onError: () => { /* 由调用方统一抛出，避免尝试内误报 */ },
    }, undefined, signal);

    return fullContent;
  }

  private async runStep(
    step: number,
    name: string,
    logPrefix: string,
    systemPrompt: string,
    userMessage: string,
    callbacks: OutlineStreamCallbacks,
    signal?: AbortSignal
  ): Promise<string> {
    callbacks.onStepStart?.(step, name);

    const content = await this.streamGenerate(
      systemPrompt, userMessage,
      (chunk) => callbacks.onChunk?.(step, chunk),
      signal
    );

    await callbacks.onStepDone?.(step, content);
    console.log(`${logPrefix} ${name}完成，长度:`, content.length);
    await sleep(300, signal);

    return content;
  }

  private async generateBatchEpisodes(
    totalEpisodes: number,
    step: number,
    logPrefix: string,
    callbacks: OutlineStreamCallbacks,
    signal: AbortSignal | undefined,
    buildMessages: (start: number, end: number, prevSummary: string) => { system: string; user: string },
    resumeBatches?: Array<{ startEpisode: number; endEpisode: number; content: string }>
  ): Promise<string> {
    const BATCH_SIZE = 20;
    const totalBatches = Math.ceil(totalEpisodes / BATCH_SIZE);
    console.log(`${logPrefix} 分集梗概将分 ${totalBatches} 批生成`);

    const resumed = new Map<number, string>();
    for (const b of resumeBatches || []) {
      resumed.set(b.startEpisode, b.content);
    }
    // 仅采信从第一批开始连续的已持久化批次；一旦出现空洞，其后的批次一律重新生成
    let resumeChainIntact = true;

    let episodeSummaries = '';
    let previousBatchSummary = '';

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startEpisode = batchIndex * BATCH_SIZE + 1;
      const endEpisode = Math.min((batchIndex + 1) * BATCH_SIZE, totalEpisodes);
      const isLastBatch = batchIndex === totalBatches - 1;

      callbacks.onBatchProgress?.(step, batchIndex + 1, totalBatches, startEpisode, endEpisode);

      throwIfAborted(signal);
      const savedContent = resumeChainIntact ? resumed.get(startEpisode) : undefined;
      if (savedContent === undefined) resumeChainIntact = false;
      let batchContent: string;
      if (savedContent !== undefined) {
        // 已持久化批次直接复用：不回放 chunk（checkpoint 事件已水合）
        console.log(`${logPrefix} 批次 ${batchIndex + 1} (${startEpisode}-${endEpisode}) 使用已保存检查点`);
        batchContent = savedContent;
      } else {
        console.log(`${logPrefix} 生成第 ${startEpisode}-${endEpisode} 集（批次 ${batchIndex + 1}/${totalBatches}）`);
        // 缺集校验 + 截断拆分：上游 8192 输出上限下 20 集一批可能写不完，
        // 校验缺失先原样重试一次，仍缺则二分拆分保证每集都真实落库
        batchContent = await this.generateEpisodeRange(
          step, buildMessages, startEpisode, endEpisode, previousBatchSummary,
          logPrefix, callbacks, signal
        );
        // 每完成一批即可持久化（异步回调被 await，失败则整个生成中止）
        await callbacks.onBatchDone?.(step, { startEpisode, endEpisode, content: batchContent });
      }

      if (episodeSummaries && batchContent) {
        episodeSummaries += '\n\n';
      }
      episodeSummaries += batchContent;

      if (!isLastBatch) {
        previousBatchSummary = batchContent.split('\n').slice(-30).join('\n');
        await sleep(500, signal);
      }
    }

    console.log(`${logPrefix} 分集梗概生成完成，总长度:`, episodeSummaries.length);
    return episodeSummaries;
  }

  /**
   * 生成一个 [start,end] 集数范围的分集梗概，保证每集都真实出现。
   * 缺集先整段重试一次；仍缺（或上游长度截断）则递归二分拆分；
   * 单集仍缺 => 抛出带集号的明确错误（草稿已持久化，可断点续跑）。
   */
  private async generateEpisodeRange(
    step: number,
    buildMessages: (start: number, end: number, prevSummary: string) => { system: string; user: string },
    start: number,
    end: number,
    prevSummary: string,
    logPrefix: string,
    callbacks: OutlineStreamCallbacks,
    signal: AbortSignal | undefined,
    depth = 0
  ): Promise<string> {
    const msgs = buildMessages(start, end, prevSummary);
    const generate = () => this.streamGenerate(
      msgs.system, msgs.user,
      (chunk) => callbacks.onChunk?.(step, chunk),
      signal
    );

    let content: string;
    try {
      content = await generate();
    } catch (error) {
      const isLengthCut = /长度上限|truncated|finish_reason.?=.?length/i.test((error as Error).message || '');
      if (isLengthCut && end > start && depth < 6) {
        console.warn(`${logPrefix} 第 ${start}-${end} 集被输出长度截断，拆分重试`);
        return this.splitEpisodeRange(step, buildMessages, start, end, prevSummary, logPrefix, callbacks, signal, depth);
      }
      throw error;
    }

    let missing = findMissingEpisodes(content, start, end);
    if (missing.length) {
      console.warn(`${logPrefix} 第 ${start}-${end} 集缺集 [${missing.join(',')}]，整段重试一次`);
      content = await generate();
      missing = findMissingEpisodes(content, start, end);
    }
    if (missing.length) {
      if (end > start && depth < 6) {
        console.warn(`${logPrefix} 第 ${start}-${end} 集重试后仍缺集 [${missing.join(',')}]，拆分重试`);
        return this.splitEpisodeRange(step, buildMessages, start, end, prevSummary, logPrefix, callbacks, signal, depth);
      }
      throw new Error(`分集梗概缺少第${missing.join('、')}集（生成不完整，已保留草稿可续跑）`);
    }
    return content;
  }

  /** 二分拆分生成；后半段衔接前半段尾部 30 行 */
  private async splitEpisodeRange(
    step: number,
    buildMessages: (start: number, end: number, prevSummary: string) => { system: string; user: string },
    start: number,
    end: number,
    prevSummary: string,
    logPrefix: string,
    callbacks: OutlineStreamCallbacks,
    signal: AbortSignal | undefined,
    depth: number
  ): Promise<string> {
    const mid = Math.floor((start + end) / 2);
    const first = await this.generateEpisodeRange(step, buildMessages, start, mid, prevSummary, logPrefix, callbacks, signal, depth + 1);
    const hinge = first.split('\n').slice(-30).join('\n');
    const second = await this.generateEpisodeRange(step, buildMessages, mid + 1, end, hinge, logPrefix, callbacks, signal, depth + 1);
    return `${first}\n\n${second}`;
  }

  async generateOutline(
    params: OutlineParams,
    callbacks: AIStreamCallbacks,
    options: OutlineRunOptions = {}
  ): Promise<string> {
    const result = await this.generateOutlineStream(params, {
      onChunk: (_step, chunk) => callbacks.onChunk?.(chunk),
      onComplete: (r) => callbacks.onComplete?.(r.raw),
      onError: (error) => callbacks.onError?.(error),
    }, options);

    return result.raw;
  }

  parseOutlineResponse(content: string): OutlineResult {
    const characterCards = this.extractSection(content,
      /###?\s*一、人物卡[\s\S]*?(?=###?\s*二、|$)/i, /###?\s*一、人物卡\s*/i,
      /【人物卡】[\s\S]*?(?=【剧情大纲】|$)/, /【人物卡】\s*/
    );
    const synopsis = this.extractSection(content,
      /###?\s*二、剧情大纲[\s\S]*?(?=###?\s*三、|$)/i, /###?\s*二、剧情大纲\s*/i,
      /【剧情大纲】[\s\S]*?(?=【分集梗概】|$)/, /【剧情大纲】\s*/
    );
    const episodeSummaries = this.extractSection(content,
      /###?\s*三、分集梗概[\s\S]*/i, /###?\s*三、分集梗概\s*/i,
      /【分集梗概】[\s\S]*/, /【分集梗概】\s*/
    );

    return { raw: content, characterCards, synopsis, episodeSummaries };
  }

  private extractSection(
    content: string,
    primaryPattern: RegExp, primaryClean: RegExp,
    fallbackPattern: RegExp, fallbackClean: RegExp
  ): string {
    const match = content.match(primaryPattern) || content.match(fallbackPattern);
    if (!match) return '';
    return match[0].replace(primaryClean, '').replace(fallbackClean, '').trim();
  }

  async generateEnhancedOutlineStream(
    params: OutlineParams,
    callbacks: OutlineStreamCallbacks,
    options: OutlineRunOptions = {}
  ): Promise<OutlineResult> {
    return withModel(options.modelName || aiClient.getCurrentModelName(), () =>
      this.runEnhanced(params, callbacks, options)
    );
  }

  private async runEnhanced(
    params: OutlineParams,
    callbacks: OutlineStreamCallbacks,
    options: OutlineRunOptions
  ): Promise<OutlineResult> {
    const { totalEpisodes, storyMode, pacing } = params;
    const signal = options.signal;

    const enhancedParams: EnhancedOutlineParams = {
      name: params.name,
      genre: params.genre,
      type: params.type,
      concept: params.concept,
      requirements: params.requirements,
      totalEpisodes,
      storyMode: storyMode || 'complete',
      pacing: pacing || 'standard',
      previousSeasonContext: params.previousSeasonContext,
      expertIdentity: params.expertIdentity,
    };

    const defaultIdentity = (fallback: string): string =>
      params.expertIdentity || fallback;

    const LOG = '[AI-Stream-v2]';
    console.log(`${LOG} 开始 5 步增强大纲生成...`);
    console.log(`${LOG} 故事模式:`, enhancedParams.storyMode);
    console.log(`${LOG} 节奏风格:`, enhancedParams.pacing);

    try {
      const saved1 = this.stepSavedContent(1, true, options.resume);
      const storyCore = saved1 !== null
        ? await this.skipStep(1, '故事内核提炼', saved1, callbacks, signal)
        : await this.runStep(
            1, '故事内核提炼', LOG,
            defaultIdentity('你是一位资深编剧，专注于故事核心设计。'),
            getStoryCorePrompt(enhancedParams), callbacks, signal
          );

      const saved2 = this.stepSavedContent(2, true, options.resume);
      const characterFunctions = saved2 !== null
        ? await this.skipStep(2, '角色功能设计', saved2, callbacks, signal)
        : await this.runStep(
            2, '角色功能设计', LOG,
            defaultIdentity('你是一位专业的角色设计师，专注于故事角色功能规划。'),
            getCharacterFunctionsPrompt(enhancedParams, storyCore), callbacks, signal
          );

      const saved3 = this.stepSavedContent(3, true, options.resume);
      const characterCards = saved3 !== null
        ? await this.skipStep(3, '生成人物卡', saved3, callbacks, signal)
        : await this.runStep(
            3, '生成人物卡', LOG,
            defaultIdentity('你是一位专业的动态漫剧策划编剧，专注于角色外貌和性格设计。'),
            getEnhancedCharacterCardsPrompt(enhancedParams, storyCore, characterFunctions), callbacks, signal
          );

      const saved4 = this.stepSavedContent(4, true, options.resume);
      const synopsis = saved4 !== null
        ? await this.skipStep(4, '生成剧情大纲', saved4, callbacks, signal)
        : await this.runStep(
            4, '生成剧情大纲', LOG,
            defaultIdentity('你是一位专业的动态漫剧策划编剧，专注于剧情结构设计。'),
            getEnhancedSynopsisPrompt(enhancedParams, storyCore, characterCards), callbacks, signal
          );

      const saved5 = this.stepSavedContent(5, true, options.resume);
      const episodeSummaries = saved5 !== null
        ? await this.skipStep(5, '生成分集梗概', saved5, callbacks, signal)
        : await this.generateBatchEpisodesWithStart(
            5, '生成分集梗概', totalEpisodes, LOG, callbacks, signal,
            (start, end, prevSummary) => ({
              system: defaultIdentity('你是一位专业的动态漫剧策划编剧。'),
              user: getEnhancedEpisodesBatchPrompt(
                enhancedParams, storyCore, characterCards, synopsis,
                start, end, totalEpisodes, prevSummary
              ),
            }),
            options.resume?.episodeBatches
          );
      if (saved5 === null) await callbacks.onStepDone?.(5, episodeSummaries);

      const raw = `## 故事内核\n\n${storyCore}\n\n## 角色功能\n\n${characterFunctions}\n\n## 人物卡\n\n${characterCards}\n\n## 剧情大纲\n\n${synopsis}\n\n## 分集梗概\n\n${episodeSummaries}`;
      const result: OutlineResult = {
        raw, characterCards, synopsis, episodeSummaries, storyCore, characterFunctions,
      };

      throwIfAborted(signal);
      await callbacks.onComplete?.(result);
      console.log(`${LOG} 5 步增强大纲生成完成`);
      return result;
    } catch (error) {
      console.error(`${LOG} 生成错误:`, error);
      callbacks.onError?.(error as Error);
      throw error;
    }
  }
}

export const outlineService = new OutlineService();
