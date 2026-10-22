import { aiClient, AIStreamCallbacks } from '../ai/AIClient';
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
  onStepDone?: (step: number) => void;
  onBatchProgress?: (step: number, batch: number, totalBatches: number, startEp: number, endEp: number) => void;
  onComplete?: (result: OutlineResult) => void;
  onError?: (error: Error) => void;
}

export interface OutlineResult {
  raw: string;
  characterCards: string;
  synopsis: string;
  episodeSummaries: string;
  storyCore?: string;
  characterFunctions?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class OutlineService {
  async generateOutlineStream(
    params: OutlineParams,
    callbacks: OutlineStreamCallbacks
  ): Promise<OutlineResult> {
    const { totalEpisodes } = params;
    const baseUserMessage = buildOutlineUserPrompt(params);
    const overseas = isOverseasProject(params.genre, params.type);
    const overseasChannel = overseas
      ? (isOverseasFemaleChannel(params.genre, params.type) ? 'female' as const : 'male' as const)
      : undefined;

    console.log('[AI-Stream] 开始流式生成大纲...');
    console.log('[AI-Stream] 用户概念:', params.concept?.substring(0, 100));

    try {
      const characterCards = await this.runStep(
        1, '生成人物卡', '[AI-Stream]',
        getOutlineCharactersPrompt(params.expertIdentity, overseasChannel),
        baseUserMessage, callbacks
      );

      const synopsis = await this.runStep(
        2, '生成剧情大纲', '[AI-Stream]',
        getOutlineSynopsisPrompt(characterCards, params.expertIdentity, overseas),
        baseUserMessage, callbacks
      );

      callbacks.onStepStart?.(3, '生成分集梗概');
      const episodeSummaries = await this.generateBatchEpisodes(
        totalEpisodes, 3, '[AI-Stream]', callbacks,
        (start, end, prevSummary) => ({
          system: getOutlineEpisodesBatchPrompt(
            characterCards, synopsis, start, end, totalEpisodes, prevSummary, params.expertIdentity, overseas
          ),
          user: baseUserMessage,
        })
      );
      callbacks.onStepDone?.(3);

      const raw = `### 一、人物卡\n\n${characterCards}\n\n### 二、剧情大纲\n\n${synopsis}\n\n### 三、分集梗概\n\n${episodeSummaries}`;
      const result: OutlineResult = { raw, characterCards, synopsis, episodeSummaries };

      callbacks.onComplete?.(result);
      console.log('[AI-Stream] 流式大纲生成完成');
      return result;
    } catch (error) {
      console.error('[AI-Stream] 生成大纲错误:', error);
      callbacks.onError?.(error as Error);
      throw error;
    }
  }

  private async streamGenerate(
    systemPrompt: string,
    userMessage: string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    let fullContent = '';

    await aiClient.generateStream(systemPrompt, userMessage, {
      onChunk: (text) => {
        fullContent += text;
        onChunk(text);
      },
      onComplete: () => { },
      onError: (error) => { throw error; },
    });

    return fullContent;
  }

  private async runStep(
    step: number,
    name: string,
    logPrefix: string,
    systemPrompt: string,
    userMessage: string,
    callbacks: OutlineStreamCallbacks
  ): Promise<string> {
    callbacks.onStepStart?.(step, name);

    const content = await this.streamGenerate(
      systemPrompt, userMessage,
      (chunk) => callbacks.onChunk?.(step, chunk)
    );

    callbacks.onStepDone?.(step);
    console.log(`${logPrefix} ${name}完成，长度:`, content.length);
    await sleep(300);

    return content;
  }

  private async generateBatchEpisodes(
    totalEpisodes: number,
    step: number,
    logPrefix: string,
    callbacks: OutlineStreamCallbacks,
    buildMessages: (start: number, end: number, prevSummary: string) => { system: string; user: string }
  ): Promise<string> {
    const BATCH_SIZE = 20;
    const totalBatches = Math.ceil(totalEpisodes / BATCH_SIZE);
    console.log(`${logPrefix} 分集梗概将分 ${totalBatches} 批生成`);

    let episodeSummaries = '';
    let previousBatchSummary = '';

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startEpisode = batchIndex * BATCH_SIZE + 1;
      const endEpisode = Math.min((batchIndex + 1) * BATCH_SIZE, totalEpisodes);
      const isLastBatch = batchIndex === totalBatches - 1;

      console.log(`${logPrefix} 生成第 ${startEpisode}-${endEpisode} 集（批次 ${batchIndex + 1}/${totalBatches}）`);
      callbacks.onBatchProgress?.(step, batchIndex + 1, totalBatches, startEpisode, endEpisode);

      const msgs = buildMessages(startEpisode, endEpisode, previousBatchSummary);
      const batchContent = await this.streamGenerate(
        msgs.system, msgs.user,
        (chunk) => callbacks.onChunk?.(step, chunk)
      );

      if (episodeSummaries && batchContent) {
        episodeSummaries += '\n\n';
      }
      episodeSummaries += batchContent;

      if (!isLastBatch) {
        previousBatchSummary = batchContent.split('\n').slice(-30).join('\n');
      }

      console.log(`${logPrefix} 批次 ${batchIndex + 1} 完成，长度: ${batchContent.length}`);

      if (!isLastBatch) {
        await sleep(500);
      }
    }

    console.log(`${logPrefix} 分集梗概生成完成，总长度:`, episodeSummaries.length);
    return episodeSummaries;
  }

  async generateOutline(
    params: OutlineParams,
    callbacks: AIStreamCallbacks
  ): Promise<string> {
    const result = await this.generateOutlineStream(params, {
      onChunk: (_step, chunk) => callbacks.onChunk?.(chunk),
      onComplete: (r) => callbacks.onComplete?.(r.raw),
      onError: (error) => callbacks.onError?.(error),
    });

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
    callbacks: OutlineStreamCallbacks
  ): Promise<OutlineResult> {
    const { totalEpisodes, storyMode, pacing } = params;

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
      const storyCore = await this.runStep(
        1, '故事内核提炼', LOG,
        defaultIdentity('你是一位资深编剧，专注于故事核心设计。'),
        getStoryCorePrompt(enhancedParams), callbacks
      );

      const characterFunctions = await this.runStep(
        2, '角色功能设计', LOG,
        defaultIdentity('你是一位专业的角色设计师，专注于故事角色功能规划。'),
        getCharacterFunctionsPrompt(enhancedParams, storyCore), callbacks
      );

      const characterCards = await this.runStep(
        3, '生成人物卡', LOG,
        defaultIdentity('你是一位专业的动态漫剧策划编剧，专注于角色外貌和性格设计。'),
        getEnhancedCharacterCardsPrompt(enhancedParams, storyCore, characterFunctions), callbacks
      );

      const synopsis = await this.runStep(
        4, '生成剧情大纲', LOG,
        defaultIdentity('你是一位专业的动态漫剧策划编剧，专注于剧情结构设计。'),
        getEnhancedSynopsisPrompt(enhancedParams, storyCore, characterCards), callbacks
      );

      callbacks.onStepStart?.(5, '生成分集梗概');
      const episodeSummaries = await this.generateBatchEpisodes(
        totalEpisodes, 5, LOG, callbacks,
        (start, end, prevSummary) => ({
          system: defaultIdentity('你是一位专业的动态漫剧策划编剧。'),
          user: getEnhancedEpisodesBatchPrompt(
            enhancedParams, storyCore, characterCards, synopsis,
            start, end, totalEpisodes, prevSummary
          ),
        })
      );
      callbacks.onStepDone?.(5);

      const raw = `## 故事内核\n\n${storyCore}\n\n## 角色功能\n\n${characterFunctions}\n\n## 人物卡\n\n${characterCards}\n\n## 剧情大纲\n\n${synopsis}\n\n## 分集梗概\n\n${episodeSummaries}`;
      const result: OutlineResult = {
        raw, characterCards, synopsis, episodeSummaries, storyCore, characterFunctions,
      };

      callbacks.onComplete?.(result);
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

