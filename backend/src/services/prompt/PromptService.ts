/**
 * 提示词服务 - 管理和构建各类AI提示词
 */

import { ContextManager } from '../context/ContextManager';
import {
  OUTLINE_CHARACTERS_PROMPT,
  getOutlineSynopsisPrompt,
  getOutlineEpisodesPrompt,
  getOutlineEpisodesBatchPrompt,
} from './outlinePrompts';
import {
  ScriptContextParts,
  getScriptAgentPrompt,
  getRewritePrompt,
  getValidationPrompt,
} from './scriptPrompts';

// 导出提示词模板供直接使用
export {
  OUTLINE_CHARACTERS_PROMPT,
  getOutlineSynopsisPrompt,
  getOutlineEpisodesPrompt,
  getOutlineEpisodesBatchPrompt,
  getScriptAgentPrompt,
  getRewritePrompt,
  getValidationPrompt,
};

export class PromptService {
  private projectId: string;
  private contextManager: ContextManager;

  constructor(projectId: string) {
    this.projectId = projectId;
    this.contextManager = new ContextManager(projectId);
  }

  /**
   * 获取角色生成提示词
   */
  getCharacterGenerationPrompt(): string {
    return OUTLINE_CHARACTERS_PROMPT;
  }

  /**
   * 获取大纲生成提示词
   */
  getSynopsisPrompt(characterCards: string): string {
    return getOutlineSynopsisPrompt(characterCards);
  }

  /**
   * 获取分集梗概生成提示词
   */
  getEpisodesPrompt(
    characterCards: string,
    synopsis: string,
    totalEpisodes: number
  ): string {
    return getOutlineEpisodesPrompt(characterCards, synopsis, totalEpisodes);
  }

  /**
   * 获取批量分集梗概生成提示词（避免超时）
   */
  getEpisodesBatchPrompt(
    characterCards: string,
    synopsis: string,
    startEpisode: number,
    endEpisode: number,
    totalEpisodes: number,
    previousBatchSummary = ''
  ): string {
    return getOutlineEpisodesBatchPrompt(
      characterCards,
      synopsis,
      startEpisode,
      endEpisode,
      totalEpisodes,
      previousBatchSummary
    );
  }

  /**
   * 构建剧本生成上下文（核心方法）
   */
  async buildScriptContext(options: {
    currentEpisode: number;
    synopsis?: string;
    episodePlan?: string;
    sceneCharacters?: string[];
  }): Promise<ScriptContextParts> {
    const { currentEpisode, synopsis, episodePlan, sceneCharacters = [] } = options;

    // 使用ContextManager获取各部分上下文
    const fullContext = await this.contextManager.buildFullContext({
      currentEpisode,
      sceneCharacters,
    });

    return {
      characterContext: fullContext.characters,
      previousSummary: fullContext.previousSummary,
      synopsis,
      episodePlan,
      stateChanges: fullContext.stateChanges,
      unresolvedForeshadowing: fullContext.unresolvedForeshadowing,
      characterContinuity: fullContext.characterContinuity,
    };
  }

  /**
   * 获取完整的剧本生成系统提示词
   */
  async getScriptSystemPrompt(options: {
    currentEpisode: number;
    synopsis?: string;
    episodePlan?: string;
    sceneCharacters?: string[];
  }): Promise<string> {
    const contextParts = await this.buildScriptContext(options);
    return getScriptAgentPrompt(contextParts);
  }

  /**
   * 获取改写提示词
   */
  async getRewriteSystemPrompt(options: {
    originalContent: string;
    instruction: string;
    keepFormat?: boolean;
  }): Promise<string> {
    // 获取角色上下文
    const characterContext = await this.contextManager.buildCharacterContext(1, []);

    return getRewritePrompt({
      originalContent: options.originalContent,
      instruction: options.instruction,
      characterContext,
      keepFormat: options.keepFormat,
    });
  }

  /**
   * 获取验证提示词
   */
  async getValidationPrompt(options: {
    content: string;
    episodeNumber: number;
  }): Promise<string> {
    const { content, episodeNumber } = options;

    // 获取角色和前情上下文
    const characterContext = await this.contextManager.buildCharacterContext(
      episodeNumber,
      []
    );
    const previousSummary = await this.contextManager.buildPreviousSummary(
      episodeNumber,
      1000
    );

    return getValidationPrompt({
      content,
      episodeNumber,
      characterContext,
      previousSummary,
    });
  }

  /**
   * 记录集数摘要（委托给ContextManager）
   */
  async recordEpisodeSummary(
    episode: number,
    data: {
      summary: string;
      keyEvents: string[];
      cliffhanger: string;
      characterChanges: string[];
    }
  ): Promise<void> {
    await this.contextManager.recordEpisodeSummary(episode, data);
  }

  /**
   * 获取ContextManager实例
   */
  getContextManager(): ContextManager {
    return this.contextManager;
  }
}
