/**
 * AI 控制器 - 处理大纲生成、剧本生成、改写等AI相关API
 */
import { Request, Response, Router } from 'express';
import mongoose from 'mongoose';
import { characterRepository, characterStateRepository, episodeRepository, projectRepository, summaryRepository } from '../repositories';
import { parseCharacterCardsSmart } from '../services/character/CharacterJsonParser';
import { ContextManager } from '../services/context/ContextManager';
import { outlineService } from '../services/outline/OutlineService';
import { RewriteService } from '../services/rewrite/RewriteService';
import { scriptService } from '../services/script/scriptService';
import { SSEHandler } from '../services/sse/SSEHandler';
import { EnhancedStateAnalyzer } from '../services/state/EnhancedStateAnalyzer';
import { normalizeOverseasScript } from '../services/format/OutputFormatService';
import { getOutlineRaw } from '../utils/outline';
import { WordCountService } from '../utils/wordCount';
import { aiClient } from '../services/ai/AIClient';
import { getPlannerIdentity } from '../constants/formatPresets';
import type { StateChange, EpisodeSummary, CharacterInfo } from '../services/script/scriptService';

const router = Router();

// ==================== 工具函数 ====================

function errorJson(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

function getModelInfo() {
  const config = aiClient.getCurrentConfig();
  return {
    name: aiClient.getCurrentModelName(),
    displayName: config.displayName,
    provider: config.provider,
    model: config.model,
  };
}

/** 获取最近 N 集摘要，映射为 EpisodeSummary[] */
async function fetchPreviousSummaries(
  projectId: string, episodeNumber: number, count = 5
): Promise<EpisodeSummary[]> {
  const recent = await summaryRepository.getRecent(projectId, episodeNumber, count);
  return recent.map(s => ({
    episode: s.episodeNumber,
    summary: s.summary || '',
    keyEvents: s.keyEvents || [],
  }));
}

/** 收集角色近期状态变化 */
async function collectStateChanges(
  projectId: string, characters: { _id: any; name: string }[], episodeNumber: number
): Promise<StateChange[]> {
  const result: StateChange[] = [];

  for (const char of characters) {
    const history = await characterStateRepository.getStateHistory(projectId, char._id.toString());
    const recentStates = history
      .filter(s => s.episodeNumber >= episodeNumber - 5 && s.episodeNumber < episodeNumber)
      .slice(-3);

    for (const state of recentStates) {
      const changes: Array<{ type: string; detail: string }> = [];
      if (state.equipmentGained?.length > 0)
        changes.push({ type: 'equipment_gained', detail: state.equipmentGained.join('、') });
      if (state.equipmentLost?.length > 0)
        changes.push({ type: 'equipment_lost', detail: state.equipmentLost.join('、') });
      if (state.newAbilities?.length > 0)
        changes.push({ type: 'new_ability', detail: state.newAbilities.join('、') });
      if (state.condition && (state.condition.physical !== '状态正常' || state.condition.mental !== '状态正常'))
        changes.push({ type: 'condition', detail: `身体:${state.condition.physical}, 精神:${state.condition.mental}` });
      if (state.permanentMark?.mark)
        changes.push({ type: 'permanent_mark', detail: state.permanentMark.mark });
      if (changes.length > 0)
        result.push({ characterName: char.name, episode: state.episodeNumber, changes });
    }
  }

  return result;
}

/** 将角色列表映射为 CharacterInfo[] */
function toCharacterInfoList(characters: Array<{ name: string; nameCn?: string; identity: string; personality: string; appearance?: string }>): CharacterInfo[] {
  return characters.map(c => ({
    name: c.name,
    nameCn: c.nameCn,
    identity: c.identity,
    personality: c.personality,
    appearance: c.appearance,
  }));
}

// ==================== 模型管理 API ====================

router.get('/models', (_req: Request, res: Response) => {
  try {
    res.json({ models: aiClient.getAvailableModels(), currentModel: aiClient.getCurrentModelName() });
  } catch (error) {
    errorJson(res, 500, (error as Error).message);
  }
});

router.get('/models/current', (_req: Request, res: Response) => {
  try {
    res.json(getModelInfo());
  } catch (error) {
    errorJson(res, 500, (error as Error).message);
  }
});

router.post('/models/switch', (req: Request, res: Response) => {
  try {
    const { modelName } = req.body;
    if (!modelName) { errorJson(res, 400, '缺少模型名称'); return; }

    const success = aiClient.switchModel(modelName);
    if (!success) { errorJson(res, 400, `未知模型: ${modelName}`); return; }

    res.json({ success: true, currentModel: { ...getModelInfo(), name: modelName } });
  } catch (error) {
    errorJson(res, 500, (error as Error).message);
  }
});

router.post('/models/test', async (req: Request, res: Response) => {
  try {
    const { modelName } = req.body;
    res.json(await aiClient.testModel(modelName));
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

/** 从人物卡文本中提取角色并保存到数据库（替换模式） */
async function extractAndSaveCharacters(projectId: string, characterCardsText: string): Promise<number> {
  try {
    const parsed = parseCharacterCardsSmart(characterCardsText);
    if (parsed.length === 0) {
      console.log('[AI] 未能从人物卡中提取角色');
      return 0;
    }

    console.log(`[AI] 从人物卡中提取到 ${parsed.length} 个角色`);
    await characterRepository.deleteByProject(projectId);

    for (const char of parsed) {
      await characterRepository.create({
        projectId: new mongoose.Types.ObjectId(projectId),
        name: char.name,
        nameCn: char.nameCn,
        role: char.role,
        type: char.type,
        gender: char.gender || '未知',
        age: char.age,
        identity: char.identity || char.role,
        personality: char.personality || '',
        background: '',
        abilities: char.abilities?.join('、') || '',
        hairStyle: char.hairStyle,
        hairColor: char.hairColor,
        faceType: char.faceType,
        bodyType: char.bodyType,
        clothing: char.clothing,
        accessories: char.accessories,
        appearance: char.appearance,
        initialEquipment: char.equipment || [],
        initialAbilities: char.abilities || [],
      });
    }

    console.log(`[AI] 成功保存 ${parsed.length} 个角色到数据库`);
    return parsed.length;
  } catch (error) {
    console.error('[AI] 提取/保存角色失败:', error);
    return 0;
  }
}

// 流式生成大纲 (SSE) - 分步生成：人物卡 → 剧情大纲 → 分集梗概
router.post('/generate-outline-stream', async (req: Request, res: Response) => {
  const sse = new SSEHandler(res);

  try {
    const { projectId, concept, requirements, genre, type, totalEpisodes, storyMode, pacing, previousSeasonId } = req.body;

    if (!projectId) {
      sse.sendError('缺少项目ID');
      return;
    }

    if (!concept || !concept.trim()) {
      sse.sendError('请填写故事概念');
      return;
    }

    const project = await projectRepository.findById(projectId);
    if (!project) {
      sse.sendError('项目不存在');
      return;
    }

    // 输入验证
    const episodeCount = parseInt(totalEpisodes) || project.totalEpisodes || 60;
    if (episodeCount < 1 || episodeCount > 500) {
      sse.sendError('总集数必须在1-500之间');
      return;
    }
    if (concept && concept.length > 10000) {
      sse.sendError('故事概念不能超过10000字');
      return;
    }
    if (requirements && requirements.length > 5000) {
      sse.sendError('特殊要求不能超过5000字');
      return;
    }

    sse.onClose(() => {
      console.log('大纲生成: 客户端断开连接');
    });

    // 判断是否使用增强模式
    const useEnhancedMode = storyMode || pacing || previousSeasonId;
    const totalSteps = useEnhancedMode ? 5 : 3;

    // 发送开始信号
    sse.send('start', { totalSteps, enhanced: useEnhancedMode });

    // 如果是承接季，获取前作上下文
    let previousSeasonContext;
    if (storyMode === 'sequel' && previousSeasonId) {
      try {
        const prevProject = await projectRepository.findById(previousSeasonId);
        if (prevProject && prevProject.outline) {
          const outline = typeof prevProject.outline === 'string'
            ? JSON.parse(prevProject.outline)
            : prevProject.outline;
          previousSeasonContext = {
            characters: outline.characterCards || '',
            finalState: '（前作结局状态摘要）',
            unresolvedPlots: [],
          };
        }
      } catch (e) {
        console.warn('获取前作上下文失败:', e);
      }
    }

    // 构建参数
    const outlineParams = {
      name: project.name || '未命名项目',
      genre: genre || project.genre || '男频漫剧',
      type: type || project.type || '玄幻',
      totalEpisodes: episodeCount,
      concept,
      requirements: requirements || '',
      storyMode: storyMode || undefined,
      pacing: pacing || undefined,
      previousSeasonContext,
      expertIdentity: project.outputFormat?.preset
        ? getPlannerIdentity(project.outputFormat.preset)
        : undefined,
    };

    // 选择生成方法
    const generateFn = useEnhancedMode
      ? outlineService.generateEnhancedOutlineStream.bind(outlineService)
      : outlineService.generateOutlineStream.bind(outlineService);

    await generateFn(outlineParams, {
      onStepStart: (step, name) => sse.send('step_start', { step, name }),
      onChunk: (step, chunk) => sse.send('chunk', { step, chunk }),
      onStepDone: (step) => sse.send('step_done', { step }),
      onBatchProgress: (step, batch, totalBatches, startEp, endEp) =>
        sse.send('batch_progress', { step, batch, totalBatches, startEpisode: startEp, endEpisode: endEp }),
      onComplete: async (result) => {
        if (sse.isClosed()) return;

        await projectRepository.update(projectId, {
          outline: {
            raw: result.raw,
            characterCards: result.characterCards,
            synopsis: result.synopsis,
            episodeSummaries: result.episodeSummaries,
            storyCore: result.storyCore,
            characterFunctions: result.characterFunctions,
            generationConfig: useEnhancedMode
              ? { storyMode, pacing, previousSeasonId }
              : undefined,
          },
          concept,
          requirements: requirements || '',
          status: 'outline_done',
          storyMode: storyMode || undefined,
          pacing: pacing || undefined,
        });

        const characterCount = await extractAndSaveCharacters(projectId, result.characterCards);

        sse.sendDone({
          raw: result.raw,
          characterCards: result.characterCards,
          synopsis: result.synopsis,
          episodeSummaries: result.episodeSummaries,
          storyCore: result.storyCore,
          characterFunctions: result.characterFunctions,
          extractedCharacters: characterCount,
          enhanced: useEnhancedMode,
        });
      },
      onError: (error) => sse.sendError(error.message),
    });

  } catch (error) {
    console.error('[AI] 生成大纲错误:', error);
    if (!sse.isClosed()) sse.sendError((error as Error).message);
  }
});

// 简易大纲生成 (SSE) - 兼容旧接口
router.post('/generate-outline', async (req: Request, res: Response) => {
  const sse = new SSEHandler(res);

  try {
    const { projectId, concept, requirements } = req.body;
    if (!projectId) { sse.sendError('缺少项目ID'); return; }

    const project = await projectRepository.findById(projectId);
    if (!project) { sse.sendError('项目不存在'); return; }

    sse.onClose(() => console.log('大纲生成: 客户端断开连接'));
    sse.sendProgress(0, 100, '开始生成大纲...');

    await outlineService.generateOutline(
      {
        name: project.name || '未命名项目',
        genre: project.genre || '男频漫剧',
        type: project.type || '玄幻',
        totalEpisodes: project.totalEpisodes || 60,
        concept: concept || '',
        requirements: requirements || '',
      },
      {
        onChunk: (text) => sse.sendChunk(text),
        onComplete: async (text) => {
          if (sse.isClosed()) return;
          const parsed = outlineService.parseOutlineResponse(text);
          await projectRepository.update(projectId, { outline: parsed, status: 'outline_done' });
          sse.sendProgress(100, 100, '大纲生成完成');
          sse.sendDone({ projectId, content: text });
        },
        onError: (error) => sse.sendError(error.message),
      }
    );
  } catch (error) {
    if (!sse.isClosed()) sse.sendError((error as Error).message);
  }
});

// 生成剧本 (SSE)
router.post('/generate-script', async (req: Request, res: Response) => {
  if (process.env.LEGACY_AI_GENERATE_ENABLED !== 'true') {
    res.status(410);
    new SSEHandler(res).sendError('该接口已废弃，请使用 /api/world-state/generate-script-enhanced 统一生成通道');
    console.warn('[AI] /api/ai/generate-script 已废弃，请迁移到 /api/world-state/generate-script-enhanced');
    return;
  }

  const sse = new SSEHandler(res);

  try {
    const { projectId, episodeNumber, episodePlan } = req.body;
    if (!projectId || !episodeNumber) { sse.sendError('缺少必要参数'); return; }

    const project = await projectRepository.findById(projectId);
    if (!project) { sse.sendError('项目不存在'); return; }

    const stateAnalyzer = new EnhancedStateAnalyzer(projectId);
    sse.onClose(() => console.log(`剧本生成: 第${episodeNumber}集 客户端断开连接`));
    sse.sendProgress(0, 100, `开始生成第${episodeNumber}集剧本...`);

    // 获取生成约束 & 建议
    let constraints: any[] = [];
    let suggestions: string[] = [];
    try {
      const genContext = await stateAnalyzer.getGenerationContext(episodePlan || `第${episodeNumber}集`);
      constraints = genContext.constraints;
      suggestions = genContext.suggestions;
      sse.sendProgress(5, 100, `已分析生成约束 (${constraints.length}条)...`);
    } catch (error) {
      console.warn('获取生成约束失败:', error);
    }

    const contextManager = new ContextManager(projectId);
    const fullContext = await contextManager.buildFullContext({
      currentEpisode: episodeNumber,
      episodePlan,
      useDynamicBudget: true,
    });
    sse.sendProgress(10, 100, '已加载上下文信息');

    if (fullContext.budgetAllocation) {
      sse.send('budgetAllocation', {
        allocation: fullContext.budgetAllocation,
        adjustmentReasons: fullContext.adjustmentReasons || [],
      });
    }

    const previousSummaries = await fetchPreviousSummaries(projectId, episodeNumber);
    sse.sendProgress(12, 100, '已加载前情摘要');

    const characters = await characterRepository.findByProject(projectId);
    const stateChanges = await collectStateChanges(projectId, characters, episodeNumber);
    sse.sendProgress(15, 100, '已加载角色状态变化');
    sse.sendProgress(20, 100, '正在生成剧本...');

    const content = await scriptService.generateScript(
      {
        projectName: project.name,
        genre: project.genre,
        type: project.type,
        episodeNumber,
        totalEpisodes: project.totalEpisodes,
        outline: getOutlineRaw(project.outline),
        previousSummaries,
        stateChanges,
        characters: toCharacterInfoList(characters),
        unresolvedForeshadowing: fullContext.unresolvedForeshadowing,
        characterContinuity: fullContext.characterContinuity,
        constraints,
        suggestions,
        episodePlan,
        outputFormatConfig: project.outputFormat,
      },
      {
        onChunk: (text) => sse.sendChunk(text),
        onLog: (message, level) => sse.sendLog(message, level),
      }
    );

    if (sse.isClosed()) return;

    // 海外短剧：归一化排版漂移（## 前缀、集标题空格、(VO)变体、中英名粘连、内部标记剥离）
    const normalizedContent = project.outputFormat?.preset === 'overseas_drama'
      ? normalizeOverseasScript(content)
      : content;

    let summary = '';
    try {
      summary = await scriptService.generateSummary(normalizedContent);
    } catch (summaryError) {
      console.error('摘要生成失败:', summaryError);
      summary = `第${episodeNumber}集剧本内容 (${normalizedContent.length}字)`;
    }

    try {
      const summaryData = contextManager.extractEpisodeSummaryFromScript(normalizedContent, episodeNumber);
      await contextManager.recordEpisodeSummary(episodeNumber, summaryData);
    } catch (e) {
      console.error('摘要记录失败:', e);
    }

    await episodeRepository.upsert(projectId, episodeNumber, {
      content: normalizedContent, summary, wordCount: normalizedContent.length, status: 'completed',
    });

    // 状态分析失败不阻断剧本保存
    try {
      await new EnhancedStateAnalyzer(projectId).analyzeEpisode(episodeNumber, normalizedContent, true);
      console.log(`[AI] 第${episodeNumber}集状态分析完成`);
    } catch (analysisError) {
      console.error(`[AI] 第${episodeNumber}集状态分析失败:`, analysisError);
    }

    sse.sendProgress(100, 100, '剧本生成完成');
    sse.sendDone({ projectId, episodeNumber, wordCount: normalizedContent.length });

  } catch (error) {
    if (!sse.isClosed()) sse.sendError((error as Error).message);
  }
});

// 批量生成剧本 (SSE)
router.post('/generate-batch', async (req: Request, res: Response) => {
  if (process.env.LEGACY_BATCH_ENABLED !== 'true') {
    res.status(410);
    new SSEHandler(res).sendError('该接口已废弃，请使用 /api/world-state/:projectId/batch-tasks 批量任务通道');
    console.warn('[AI] /api/ai/generate-batch 已废弃，请迁移到 /api/world-state/:projectId/batch-tasks');
    return;
  }

  const sse = new SSEHandler(res);

  try {
    const { projectId, startEpisode, endEpisode } = req.body;
    if (!projectId || !startEpisode || !endEpisode) { sse.sendError('缺少必要参数'); return; }

    const project = await projectRepository.findById(projectId);
    if (!project) { sse.sendError('项目不存在'); return; }

    const total = endEpisode - startEpisode + 1;
    const characters = await characterRepository.findByProject(projectId);
    const contextManager = new ContextManager(projectId);
    const stateAnalyzer = new EnhancedStateAnalyzer(projectId);
    const charInfoList = toCharacterInfoList(characters);

    sse.onClose(() => console.log('批量生成被中断'));

    for (let i = startEpisode; i <= endEpisode; i++) {
      if (sse.isClosed()) break;

      sse.sendProgress(i - startEpisode + 1, total, `正在生成第${i}集...`);

      const fullContext = await contextManager.buildFullContext({
        currentEpisode: i,
        useDynamicBudget: true,
      });

      if (fullContext.budgetAllocation) {
        sse.send('budgetAllocation', {
          episodeNumber: i,
          allocation: fullContext.budgetAllocation,
          adjustmentReasons: fullContext.adjustmentReasons || [],
        });
      }

      const previousSummaries = await fetchPreviousSummaries(projectId, i);
      const stateChanges = await collectStateChanges(projectId, characters, i);
      let episodeContent = '';

      await scriptService.generateScript(
        {
          projectName: project.name,
          genre: project.genre,
          type: project.type,
          episodeNumber: i,
          totalEpisodes: project.totalEpisodes,
          outline: getOutlineRaw(project.outline),
          previousSummaries,
          stateChanges,
          characters: charInfoList,
          unresolvedForeshadowing: fullContext.unresolvedForeshadowing,
          characterContinuity: fullContext.characterContinuity,
          outputFormatConfig: project.outputFormat,
        },
        {
          onChunk: (text) => { episodeContent += text; },
          onComplete: async (content) => {
            const summary = await scriptService.generateSummary(content);
            const summaryData = contextManager.extractEpisodeSummaryFromScript(content, i);
            await contextManager.recordEpisodeSummary(i, summaryData);

            await episodeRepository.upsert(projectId, i, {
              content, summary, wordCount: content.length, status: 'completed',
            });

            try {
              await stateAnalyzer.analyzeEpisode(i, content, true);
              console.log(`[AI] 批量生成: 第${i}集状态分析完成`);
            } catch (analysisError) {
              console.error(`[AI] 批量生成: 第${i}集状态分析失败:`, analysisError);
            }
          },
          onError: (error) => console.error(`第${i}集生成失败:`, error.message),
        }
      );

      sse.send('episode_complete', { episodeNumber: i, wordCount: episodeContent.length });
    }

    sse.sendDone({
      projectId,
      generated: total,
      message: `成功生成 ${startEpisode}-${endEpisode} 集`,
    });

  } catch (error) {
    if (!sse.isClosed()) sse.sendError((error as Error).message);
  }
});

// 改写剧本 (SSE)
router.post('/rewrite', async (req: Request, res: Response) => {
  const sse = new SSEHandler(res);

  try {
    const { projectId, episodeNumber, originalContent, instructions } = req.body;
    if (!projectId || !episodeNumber || !originalContent) { sse.sendError('缺少必要参数'); return; }

    sse.onClose(() => console.log('改写被中断'));
    sse.sendProgress(0, 100, '开始改写...');

    const rewriteService = new RewriteService(projectId);
    const episode = await episodeRepository.findByNumber(projectId, episodeNumber);
    if (!episode) { sse.sendError('剧本不存在'); return; }

    let fullContent = '';

    await rewriteService.rewriteStream(
      {
        projectId,
        episodeId: episode._id.toString(),
        episodeNumber,
        type: 'instruction',
        instruction: instructions || '请改进剧本质量',
      },
      {
        onChunk: (text) => { fullContent += text; sse.sendChunk(text); },
        onComplete: async () => {
          if (sse.isClosed()) return;
          sse.sendProgress(100, 100, '改写完成');
          sse.sendDone({ projectId, episodeNumber, wordCount: fullContent.length });
        },
        onError: (error) => sse.sendError(error.message),
      }
    );
  } catch (error) {
    if (!sse.isClosed()) sse.sendError((error as Error).message);
  }
});

// 协调改写多集 (SSE)
router.post('/coordinated-rewrite', async (req: Request, res: Response) => {
  const sse = new SSEHandler(res);

  try {
    const { projectId, episodeNumbers, instructions } = req.body;
    if (!projectId || !Array.isArray(episodeNumbers) || episodeNumbers.length === 0) {
      sse.sendError('缺少必要参数'); return;
    }

    sse.onClose(() => console.log('协调改写被中断'));
    sse.sendProgress(0, 100, `开始协调改写第${episodeNumbers.join('、')}集...`);

    const rewriteService = new RewriteService(projectId);
    let fullContent = '';

    await rewriteService.coordinatedRewrite(
      episodeNumbers,
      instructions || '请改进剧本质量，保持各集衔接自然',
      {
        onChunk: (text) => { fullContent += text; sse.sendChunk(text); },
        onComplete: async () => {
          if (sse.isClosed()) return;
          const result = rewriteService.parseCoordinatedRewriteResult(fullContent);
          if (result.episodes.length > 0) {
            await rewriteService.saveCoordinatedRewriteResult(result.episodes);
          }
          sse.sendProgress(100, 100, '协调改写完成');
          sse.sendDone({
            projectId, episodeNumbers,
            parsedEpisodes: result.episodes.length,
            totalWordCount: result.totalWordCount,
          });
        },
        onError: (error) => sse.sendError(error.message),
      }
    );
  } catch (error) {
    if (!sse.isClosed()) sse.sendError((error as Error).message);
  }
});

// 分析问题并生成修复方案
router.post('/analyze-fix', async (req: Request, res: Response) => {
  try {
    const { projectId, issue } = req.body;
    if (!projectId || !issue) { errorJson(res, 400, '缺少必要参数'); return; }

    const result = await new RewriteService(projectId).analyzeAndPlanFix(issue);
    res.json(result);
  } catch (error) {
    console.error('[AI] 分析问题失败:', error);
    errorJson(res, 500, (error as Error).message);
  }
});

// 执行修复方案 (SSE)
router.post('/execute-fix', async (req: Request, res: Response) => {
  const sse = new SSEHandler(res);

  try {
    const { projectId, plan, episodeNumber } = req.body;
    if (!projectId || !plan || !episodeNumber) { sse.sendError('缺少必要参数'); return; }

    sse.onClose(() => console.log('修复执行被中断'));
    sse.sendProgress(0, 100, '开始执行修复方案...');

    const rewriteService = new RewriteService(projectId);
    let fullContent = '';

    await rewriteService.executeFix(plan, episodeNumber, {
      onChunk: (text) => { fullContent += text; sse.sendChunk(text); },
      onComplete: async () => {
        if (sse.isClosed()) return;
        await episodeRepository.upsert(projectId, episodeNumber, {
          content: fullContent,
          wordCount: fullContent.replace(/\s/g, '').length,
        });
        sse.sendProgress(100, 100, '修复完成');
        sse.sendDone({ projectId, episodeNumber, wordCount: WordCountService.countV2(fullContent) });
      },
      onError: (error) => sse.sendError(error.message),
    });
  } catch (error) {
    if (!sse.isClosed()) sse.sendError((error as Error).message);
  }
});

export default router;
