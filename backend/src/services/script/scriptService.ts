
import { IOutputFormatConfig } from '../../types/OutputFormat';
import { createLogger, safeStringify } from '../../utils/errorLogger';
import { aiClient, AIStreamCallbacks } from '../ai/AIClient';
import { SceneRhythmPlanner } from '../rhythm/SceneRhythmPlanner';
import {
  buildCharacterContext,
  buildPreviousSummary,
  buildStateChangesContext,
  getScriptAgentPrompt,
  getWritingStyleGuide,
  ScriptContextParts,
  STATE_ANALYSIS_PROMPT,
  SUMMARY_PROMPT
} from './scriptPrompts';
import { Constraint, ConstraintValidator } from '../constraint/ConstraintValidator';
import { ReflexionPromptFactory } from './ReflexionPromptFactory';

const logger = createLogger('ScriptService');
const sceneRhythmPlanner = new SceneRhythmPlanner();

export interface CharacterInfo {
  name: string;
  identity: string;
  personality: string;
  appearance?: string;
  abilities?: string[];
  equipment?: string[];
  relationships?: { [key: string]: string };
}

export interface EpisodeSummary {
  episode: number;
  summary: string;
  keyEvents?: string[];
}

export interface StateChange {
  characterName: string;
  episode: number;
  changes: Array<{
    type: string;
    detail: string;
  }>;
}

export interface WritingStyleConfig {
  preset: string;
  customDescription?: string;
}

export interface ScriptParams {
  projectName: string;
  genre: string;
  type: string;
  episodeNumber: number;
  totalEpisodes: number;
  outline: string;
  episodePlan?: string;
  previousSummaries?: EpisodeSummary[];
  characters: CharacterInfo[];
  stateChanges?: StateChange[];
  unresolvedForeshadowing?: string;
  characterContinuity?: string;
  worldStateContext?: string;
  constraints?: (string | Constraint)[];
  suggestions?: string[];
  writingStyle?: WritingStyleConfig;
  referenceContent?: string;
  retryMode?: boolean;
  enableInternalReflexion?: boolean;
  sceneRhythm?: string;
  useSceneRhythm?: boolean;
  characterCharm?: string;
  characterArc?: string;
  characterRelationship?: string;
  characterVoice?: string;
  previousEpisodeContent?: string;
  outputFormatConfig?: IOutputFormatConfig;
}

export interface BatchScriptParams extends Omit<ScriptParams, 'episodeNumber'> {
  startEpisode: number;
  endEpisode: number;
}

export class ScriptService {
  /**
   * 构建基础上下文（单集/批量共用）
   */
  private buildBaseContext(params: ScriptParams | BatchScriptParams): ScriptContextParts {
    const characterContext = buildCharacterContext(params.characters);
    const previousSummary = params.previousSummaries
      ? buildPreviousSummary(params.previousSummaries)
      : '';
    const stateChanges = params.stateChanges
      ? buildStateChangesContext(params.stateChanges)
      : '';

    return {
      characterContext,
      previousSummary,
      stateChanges,
      synopsis: params.outline,
      unresolvedForeshadowing: params.unresolvedForeshadowing,
      characterContinuity: params.characterContinuity,
    };
  }

  /**
   * 解析场景节奏：优先使用已格式化的，否则自动规划
   */
  private async resolveSceneRhythm(params: ScriptParams): Promise<string | undefined> {
    if (params.sceneRhythm) {
      return params.sceneRhythm;
    }
    if (!params.useSceneRhythm || !params.episodePlan) {
      return undefined;
    }
    try {
      const rhythmPlan = await sceneRhythmPlanner.planScenes(params.episodePlan);
      logger.info('场景节奏规划完成', {
        场景数: rhythmPlan.scenes.length,
        节奏曲线: rhythmPlan.rhythmCurve,
      });
      return sceneRhythmPlanner.formatForPrompt(rhythmPlan);
    } catch (error) {
      logger.warn('场景节奏规划失败，使用默认规划', { error });
      return sceneRhythmPlanner.formatForPrompt(sceneRhythmPlanner.getDefaultPlan(4));
    }
  }

  /**
   * 将混合类型的约束统一为 Constraint 对象
   */
  private normalizeConstraints(raw: (string | Constraint)[]): Constraint[] {
    return raw.map(c => {
      if (typeof c !== 'string') return c;
      return {
        id: `gen_${Math.random().toString(36).substring(2, 9)}`,
        content: c,
        type: 'continuity',
        severity: 'important',
        category: 'verifiable',
        source: 'script_params',
      } as Constraint;
    });
  }

  /**
   * 构建单集生成的 user prompt
   */
  private buildUserPrompt(params: ScriptParams): string {
    const sections: string[] = [];

    sections.push(`请生成第${params.episodeNumber} 集的完整剧本。

【项目信息】
- 项目名称：${params.projectName}
- 类型：${params.genre} - ${params.type}
- 当前集数：第${params.episodeNumber} 集（共${params.totalEpisodes} 集）`);

    if (params.previousEpisodeContent) {
      sections.push(`【上一集参考】
以下是上一集的完整内容，供你了解前情：
===开始===
${params.previousEpisodeContent}
===结束===

[提示] 上述内容为已发生的事实，用于帮助你保持剧情连贯。请自行判断本集是否涉及相同人物/事件/场景，如涉及请保持信息一致。注意：不要在生成的剧本正文中写出"上集"、"第X集"、"前集"等字眼，要将前情信息自然融入剧情。`);
    }

    if (params.worldStateContext) {
      sections.push(`【世界状态上下文（仅供参考，不要在正文中引用集数编号）】\n${params.worldStateContext}`);
    }

    if (params.constraints && params.constraints.length > 0) {
      // 按优先级分组渲染：约束列表长且平会稀释注意力，
      // 把【关键】置顶、【重要】次之，其余兜底，模型优先满足高优先级
      const critical: string[] = [];
      const important: string[] = [];
      const normal: string[] = [];
      for (const c of params.constraints) {
        const s = typeof c === 'string' ? c : c.content;
        if (/^【关键】/.test(s)) critical.push(s.replace(/^【关键】/, ''));
        else if (/^【重要】/.test(s)) important.push(s.replace(/^【重要】/, ''));
        else normal.push(s);
      }
      const block = (title: string, items: string[]) =>
        items.length ? `\n${title}\n${items.map((s, i) => `${i + 1}. ${s}`).join('\n')}` : '';
      const list =
        block('★ 关键约束（最高优先级，必须全部满足）', critical) +
        block('● 重要约束（应尽量满足）', important) +
        block('○ 一般约束（不得明显违背）', normal);
      sections.push(`【生成约束 - 必须遵守】
以下约束将在生成后自动验证，未满足的约束会触发重新生成：${list}

[重要] 请优先确保 ★关键约束 全部满足，其次 ●重要约束，其余不得明显违背。`);
    }

    if (params.suggestions && params.suggestions.length > 0) {
      sections.push(`【参考建议】（非强制，可酌情采纳）\n${params.suggestions.join('\n')}`);
    }

    if (params.retryMode && params.referenceContent) {
      sections.push(`【改写模式】
这是第二次生成，请基于以下参考内容进行改写，重点满足上述约束：

---参考内容开始---
${params.referenceContent}
---参考内容结束---

请保留原内容的优点（场景结构、基本剧情框架），针对未满足的约束进行调整和改写。`);
    }

    sections.push('请严格按照上方System Prompt中的【输出格式】和【创作规范】输出，确保格式、字数、场景数量均符合要求。结尾必有悬念或爆点。');

    return sections.join('\n\n');
  }

  /**
   * Reflexion 自动反思循环：生成 -> 验证 -> 反思重写
   */
  private async reflexionLoop(
    systemPrompt: string,
    initialUserPrompt: string,
    constraints: Constraint[],
    callbacks: AIStreamCallbacks,
  ): Promise<string> {
    const MAX_RETRIES = 2;
    const validator = new ConstraintValidator(aiClient);
    let userPrompt = initialUserPrompt;
    let currentContent = '';

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        logger.info(`启动反思重写(第${attempt}次尝试)...`);
        callbacks.onLog?.(
          `系统智能优化：上一版存在逻辑瑕疵，正在进行第 ${attempt}/${MAX_RETRIES} 次深度优化...`,
          'warn'
        );
      }

      currentContent = await aiClient.generateStream(systemPrompt, userPrompt, callbacks);

      if (constraints.length === 0) {
        return currentContent;
      }

      logger.info(`正在验证第 ${attempt} 次生成结果...`);
      const validation = await validator.validateConstraints(currentContent, constraints);
      logger.info(`验证结果: 满意度 ${(validation.satisfactionRate * 100).toFixed(1)}%, 关键违规 ${validation.criticalViolations}`);

      // 达标：满意度 >= 80% 且无关键违规
      if (validation.criticalViolations === 0 && validation.satisfactionRate >= 0.8) {
        logger.info('验证通过，生成结束');
        return currentContent;
      }

      if (attempt === MAX_RETRIES) {
        logger.warn('达到最大重试次数，返回最终结果');
        return currentContent;
      }

      userPrompt += `\n\n${ReflexionPromptFactory.createReflexionPrompt(userPrompt, validation, attempt)}`;
    }

    return currentContent;
  }

  /**
   * 生成单集剧本
   */
  async generateScript(
    params: ScriptParams,
    callbacks: AIStreamCallbacks
  ): Promise<string> {
    logger.info('开始生成剧本', {
      项目: params.projectName,
      集数: params.episodeNumber,
      总集数: params.totalEpisodes,
      约束数: params.constraints?.length || 0,
      建议数: params.suggestions?.length || 0,
      重试模式: params.retryMode || false,
      启用场景节奏: params.useSceneRhythm || false,
    });

    const baseContext = this.buildBaseContext(params);
    const sceneRhythm = await this.resolveSceneRhythm(params);

    const writingStyle = params.writingStyle ? {
      preset: params.writingStyle.preset,
      customDescription: params.writingStyle.customDescription,
      styleGuide: getWritingStyleGuide(params.writingStyle.preset, params.writingStyle.customDescription),
    } : undefined;

    const contextParts: ScriptContextParts = {
      ...baseContext,
      episodePlan: params.episodePlan || `第${params.episodeNumber} 集`,
      writingStyle,
      sceneRhythm,
      characterCharm: params.characterCharm,
      characterArc: params.characterArc,
      characterRelationship: params.characterRelationship,
      characterVoice: params.characterVoice,
      outputFormatConfig: params.outputFormatConfig,
    };

    const systemPrompt = getScriptAgentPrompt(contextParts);
    const userPrompt = this.buildUserPrompt(params);

    logger.info('调用 AI 生成', {
      SystemPrompt长度: systemPrompt.length,
      UserPrompt长度: userPrompt.length,
    });

    if (params.enableInternalReflexion === false) {
      logger.info('跳过反思循环，直接生成');
      return aiClient.generateStream(systemPrompt, userPrompt, callbacks);
    }

    const constraints = this.normalizeConstraints(params.constraints || []);
    return this.reflexionLoop(systemPrompt, userPrompt, constraints, callbacks);
  }

  /**
   * 批量生成剧本（多集连续）
   */
  async generateBatchScript(
    params: BatchScriptParams,
    callbacks: AIStreamCallbacks
  ): Promise<string> {
    const contextParts: ScriptContextParts = {
      ...this.buildBaseContext(params),
      episodePlan: params.episodePlan || `第${params.startEpisode}-${params.endEpisode}集`,
    };

    const systemPrompt = getScriptAgentPrompt(contextParts);

    const userPrompt = `请生成第${params.startEpisode}集到第${params.endEpisode}集的完整剧本。

【项目信息】
- 项目名称：${params.projectName}
- 类型：${params.genre} - ${params.type}
- 生成范围：第${params.startEpisode}-${params.endEpisode}集（共${params.totalEpisodes}集）

请严格按照格式要求输出每一集，确保：
1. 每集3-6个场景
2. 每集400-600字
3. 使用△标记画面描述
4. 场景格式：X-X：场景名-时间 内/外
5. 每集结尾必有悬念或爆点
6. 集与集之间用 --- 分隔`;

    return aiClient.generateStream(systemPrompt, userPrompt, callbacks);
  }

  /**
   * 生成剧本摘要
   */
  async generateSummary(content: string): Promise<string> {
    return aiClient.generate(SUMMARY_PROMPT, `请总结以下剧本内容：\n\n${content}`);
  }

  /**
   * 分析剧本中的角色状态变化
   */
  async analyzeStateChanges(
    content: string,
    episodeNumber: number
  ): Promise<{
    episode: number;
    characters: Array<{
      name: string;
      changes: Array<{
        type: string;
        detail: string;
      }>;
    }>;
    summary: {
      brief: string;
      keyEvents: string[];
      cliffhanger: string;
    };
  }> {
    logger.info('开始分析状态变化', { 集数: episodeNumber, 内容长度: content?.length || 0 });

    const result = await aiClient.generate(
      STATE_ANALYSIS_PROMPT,
      `请分析第${episodeNumber}集的剧本内容：\n\n${content}`
    );

    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        logger.info('状态变化分析完成', {
          角色数: parsed.characters?.length || 0,
          关键事件数: parsed.summary?.keyEvents?.length || 0,
        });
        return parsed;
      }
      throw new Error('No JSON found in response');
    } catch (error) {
      logger.error('状态变化分析失败', error as Error, {
        method: 'analyzeStateChanges',
        additionalInfo: {
          集数: episodeNumber,
          响应长度: result?.length || 0,
          响应预览: safeStringify(result, 200),
        },
      });
      return {
        episode: episodeNumber,
        characters: [],
        summary: {
          brief: '解析失败，请手动查看剧本内容',
          keyEvents: [],
          cliffhanger: ''
        }
      };
    }
  }

  /**
   * 验证剧本格式
   */
  validateScriptFormat(content: string): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    const scenePattern = /\d+-\d+：.+-(?:日|夜|黄昏|清晨)\s+(?:内|外)/g;
    const scenes = content.match(scenePattern);
    if (!scenes || scenes.length === 0) {
      issues.push('缺少正确的场景标记（格式：X-X：场景名-时间 内/外）');
    }

    if (!content.includes('△')) {
      issues.push('缺少画面描述标记（应使用△）');
    }

    const dialoguePattern = /^.+[：:].+$/gm;
    const dialogues = content.match(dialoguePattern);
    if (!dialogues || dialogues.length < 5) {
      issues.push('对白数量过少或格式不正确');
    }

    const wordCount = content.replace(/\s/g, '').length;
    if (wordCount < 300) {
      issues.push(`字数过少（当前${wordCount}字，建议400-600字/集）`);
    } else if (wordCount > 800) {
      issues.push(`字数过多（当前${wordCount}字，建议400-600字/集）`);
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

export const scriptService = new ScriptService();
