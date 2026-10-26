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
import { creatorAuth } from '../middleware/creatorMiddleware';
import { Project, IProject, IOutlineDraft } from '../models/Project';
import {
  acquireOutlineRun,
  releaseOutlineRun,
  computeOutlineInputKey,
  validateResumePrefix,
  buildRunningDraft,
} from '../services/outline/outlineCheckpoint';
import type { OutlineParams } from '../services/outline/OutlineService';
import { randomUUID } from 'crypto';
import type { StateChange, EpisodeSummary, CharacterInfo } from '../services/script/scriptService';

const router = Router();

// 全部 /api/ai 路由要求创作者认证（含模型查询/切换/测试与生成端点）
router.use(creatorAuth);

/**
 * 项目归属校验：仅所有者或管理员可操作；
 * 未绑定创建者的历史项目仅管理员可访问（无隐式放行）。
 * 返回错误消息字符串，通过则返回 null。
 */
function projectAccessError(req: Request, project: IProject): string | null {
  if (req.creator?.role === 'admin') return null;
  const ownerId = project.creatorId?.toString();
  // 未绑定创建者的历史项目不允许任意认证用户访问（无隐式放行）
  if (!ownerId) return '无权访问此项目';
  if (ownerId !== req.creatorId) return '无权访问此项目';
  return null;
}

/** 校验 projectId 归属；出错时已发送响应并返回 null */
async function requireProjectAccess(req: Request, res: Response, projectId: unknown): Promise<IProject | null> {
  if (typeof projectId !== 'string' || !projectId.trim()) {
    errorJson(res, 400, '缺少项目ID');
    return null;
  }
  if (!mongoose.isValidObjectId(projectId.trim())) {
    errorJson(res, 400, '无效的项目ID');
    return null;
  }
  const project = await projectRepository.findById(projectId.trim());
  if (!project) { errorJson(res, 404, '项目不存在'); return null; }
  const accessError = projectAccessError(req, project);
  if (accessError) { errorJson(res, 403, accessError); return null; }
  return project;
}

// ==================== 工具函数 ====================

function errorJson(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

function getModelInfo() {
  const name = aiClient.getCurrentModelName();
  const listed = aiClient.getAvailableModels().find(m => m.name === name);
  if (listed) {
    return {
      name, displayName: listed.displayName, provider: listed.provider,
      model: listed.model, configured: listed.configured,
      unavailableReason: listed.unavailableReason,
    };
  }
  const config = aiClient.getCurrentConfig();
  return {
    name, displayName: config.displayName, provider: config.provider,
    model: config.model, configured: false, unavailableReason: '未知模型',
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
    if (typeof modelName !== 'string' || !modelName.trim()) {
      errorJson(res, 400, '缺少模型名称'); return;
    }

    const success = aiClient.switchModel(modelName);
    if (!success) {
      const known = aiClient.getAvailableModels().find(m => m.name === modelName);
      errorJson(res, 400, known
        ? `${known.displayName} ${known.unavailableReason || '未配置'}，无法切换`
        : `未知模型: ${modelName}`);
      return;
    }

    res.json({ success: true, currentModel: { ...getModelInfo(), name: modelName } });
  } catch (error) {
    errorJson(res, 500, (error as Error).message);
  }
});

router.post('/models/test', async (req: Request, res: Response) => {
  try {
    const { modelName } = req.body;
    if (modelName !== undefined && typeof modelName !== 'string') {
      res.status(400).json({ success: false, message: '非法的模型名称' }); return;
    }
    const result = await aiClient.testModel(modelName);
    console.log(`[REQ ${req.requestId || '-'}] 模型测试 model=${modelName || 'current'} provider=${result.success ? 'ok' : 'fail'}: ${result.message}`);
    res.json(result);
  } catch (error) {
    console.error(`[REQ ${req.requestId || '-'}] 模型测试异常:`, (error as Error).message);
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

/**
 * 从人物卡文本提取角色并保存（按 projectId+name upsert 保留既有ID）。
 * 先解析校验再写入；写失败会向上抛出（调用方据此标记失败而非谎报完成），
 * 陈旧角色只在全部 upsert 成功后清理，保证失败时已有数据不被破坏。
 */
async function extractAndSaveCharacters(projectId: string, characterCardsText: string): Promise<{ count: number; keepIds: Set<string> }> {
  const parsed = parseCharacterCardsSmart(characterCardsText);
  if (parsed.length === 0) {
    if (characterCardsText && characterCardsText.trim()) {
      throw new Error('人物卡内容解析失败：非空内容未提取到任何角色');
    }
    console.log('[AI] 人物卡为空，跳过角色提取');
    return { count: 0, keepIds: new Set() };
  }
  // 同名去重（解析结果内首个为准），防止重复插入
  const seen = new Set<string>();
  const unique = parsed.filter(c => (seen.has(c.name) ? false : (seen.add(c.name), true)));
  parsed.length = 0; parsed.push(...unique);

  console.log(`[AI] 从人物卡中提取到 ${parsed.length} 个角色`);
  const projectOid = new mongoose.Types.ObjectId(projectId);
  const existing = await characterRepository.findByProject(projectId);
  const existingByName = new Map(existing.map(c => [c.name, c]));
  const keepIds = new Set<string>();

  for (const char of parsed) {
    const payload = {
      nameCn: char.nameCn,
      role: char.role,
      type: char.type,
      gender: char.gender || '未知',
      age: char.age,
      identity: char.identity || char.role,
      personality: char.personality || '',
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
    };
    const prev = existingByName.get(char.name);
    if (prev) {
      await characterRepository.update(prev._id.toString(), payload);
      keepIds.add(prev._id.toString());
    } else {
      const created = await characterRepository.create({ projectId: projectOid, name: char.name, background: '', ...payload });
      existingByName.set(char.name, created); // 防同批重名二次插入
      keepIds.add(created._id.toString());
    }
  }

  console.log(`[AI] 成功保存 ${parsed.length} 个角色到数据库`);
  return { count: parsed.length, keepIds };
}

/** 清理不再出现的旧角色（在正式大纲提交成功后调用；失败仅告警不阻断） */
async function cleanupObsoleteCharacters(projectId: string, keepIds: Set<string>): Promise<number> {
  const existing = await characterRepository.findByProject(projectId);
  let removed = 0;
  for (const c of existing) {
    if (!keepIds.has(c._id.toString())) {
      await characterRepository.delete(c._id.toString());
      removed++;
    }
  }
  return removed;
}

// 流式生成大纲 (SSE) - 分步生成：人物卡 → 剧情大纲 → 分集梗概（增强模式 5 步）
// 支持断点续传：每个完成步骤/批次原子持久化 outlineDraft，resume:true 续跑
router.post('/generate-outline-stream', async (req: Request, res: Response) => {
  try {
    await handleGenerateOutlineStream(req, res);
  } catch (error) {
    // 兜底保证异步 handler 异常有响应
    console.error('[AI] 大纲路由未捕获错误:', error);
    if (!res.headersSent) errorJson(res, 500, (error as Error).message);
    else if (!res.writableEnded) res.end();
  }
});

async function handleGenerateOutlineStream(req: Request, res: Response): Promise<void> {
  // ---------- SSE 建立前的校验：一律 JSON 错误 ----------
  const { projectId, concept, requirements, genre, type, totalEpisodes, storyMode, pacing, previousSeasonId, resume } = req.body || {};

  if (typeof concept !== 'string' || !concept.trim()) { errorJson(res, 400, '请填写故事概念'); return; }
  if (concept.length > 10000) { errorJson(res, 400, '故事概念不能超过10000字'); return; }
  if (requirements !== undefined && (typeof requirements !== 'string' || requirements.length > 5000)) {
    errorJson(res, 400, '特殊要求不能超过5000字'); return;
  }
  if (genre !== undefined && (typeof genre !== 'string' || genre.length > 100)) { errorJson(res, 400, '非法的频道参数'); return; }
  if (type !== undefined && (typeof type !== 'string' || type.length > 100)) { errorJson(res, 400, '非法的题材参数'); return; }
  if (storyMode !== undefined && !['complete', 'open_ended', 'sequel'].includes(storyMode)) {
    errorJson(res, 400, '非法的故事模式'); return;
  }
  if (pacing !== undefined && !['fast', 'standard', 'slow'].includes(pacing)) {
    errorJson(res, 400, '非法的节奏风格'); return;
  }
  if (previousSeasonId !== undefined && previousSeasonId !== null
      && !(typeof previousSeasonId === 'string' && mongoose.isValidObjectId(previousSeasonId))) {
    errorJson(res, 400, '非法的前作项目ID'); return;
  }
  if (resume !== undefined && resume !== true && resume !== false) {
    errorJson(res, 400, '非法的 resume 参数'); return;
  }
  let episodeCount: number;
  if (totalEpisodes !== undefined) {
    episodeCount = Number(totalEpisodes);
    if (typeof totalEpisodes === 'boolean' || !Number.isInteger(episodeCount) || episodeCount < 1 || episodeCount > 500) {
      errorJson(res, 400, '总集数必须是1-500之间的整数'); return;
    }
  } else {
    episodeCount = 0;
  }

  const project = await requireProjectAccess(req, res, projectId);
  if (!project) return;
  const pid = project._id.toString(); // 规范 ObjectId：大小写/空格变体不能绕过锁与守卫

  if (storyMode === 'sequel' && previousSeasonId) {
    const prevProject = await requireProjectAccess(req, res, previousSeasonId);
    if (!prevProject) return;
  }
  if (!episodeCount) episodeCount = project.totalEpisodes || 60;
  if (episodeCount < 1 || episodeCount > 500) { errorJson(res, 400, '总集数必须在1-500之间'); return; }

  // 同项目运行排他（单实例进程内）：校验全部通过后取锁，finally 必释放
  const generationId = randomUUID();
  if (!acquireOutlineRun(pid, generationId)) {
    errorJson(res, 409, '该项目已有正在进行的大纲生成，请等待完成或先停止');
    return;
  }

  const requestId = req.requestId || generationId;
  const useEnhancedMode = !!(storyMode || pacing || previousSeasonId);
  const mode: 'standard' | 'enhanced' = useEnhancedMode ? 'enhanced' : 'standard';
  // 模型快照在任何 await 之前捕获，随 options 传入服务层（不全局切换）
  const modelConfig = aiClient.getCurrentConfig();
  const modelName = aiClient.getCurrentModelName();

  try {
    // 前作上下文
    let previousSeasonContext;
    if (storyMode === 'sequel' && previousSeasonId) {
      try {
        const prevProject = await projectRepository.findById(previousSeasonId);
        if (prevProject?.outline) {
          const outline = typeof prevProject.outline === 'string' ? JSON.parse(prevProject.outline) : prevProject.outline;
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

    const outlineParams: OutlineParams = {
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

    const inputKey = computeOutlineInputKey(outlineParams, mode, modelName, modelConfig.model);

    // resume:true → 草稿存在且 inputKey/mode 匹配；恢复内容必须是"连续有效前缀"
    const existingDraft = project.outlineDraft as IOutlineDraft | undefined;
    let resumeCheckpoint;
    if (resume === true) {
      if (!existingDraft || existingDraft.status === 'completed') {
        res.status(409).json({ error: '没有可继续的大纲草稿，请重新开始生成', code: 'RESUME_NOT_FOUND' });
        return;
      }
      if (existingDraft.inputKey !== inputKey || existingDraft.mode !== mode) {
        res.status(409).json({ error: '生成参数与未完成草稿不一致，请重新开始生成', code: 'RESUME_INPUT_MISMATCH' });
        return;
      }
      resumeCheckpoint = validateResumePrefix(existingDraft, mode, episodeCount);
    }

    // 初始化本次运行草稿：续跑拷贝已保存的连续前缀；全新运行从空白开始（已有 outline 不受影响）
    const baseDraft = buildRunningDraft({
      generationId, inputKey, mode,
      modelName, model: modelConfig.model,
      concept,
      requirements: requirements || '',
      generationConfig: useEnhancedMode ? { storyMode, pacing, previousSeasonId } : undefined,
    });
    const initialDraft: IOutlineDraft = resumeCheckpoint
      ? {
          ...baseDraft,
          completedSteps: resumeCheckpoint.completedSteps,
          result: { ...baseDraft.result, ...resumeCheckpoint.result },
          episodeBatches: resumeCheckpoint.episodeBatches,
        }
      : baseDraft;

    // 原子替换：必须匹配上次观察到的 draft.generationId（不存在则要求字段缺失）；null => 并发冲突
    const expectedPrevId = existingDraft?.generationId;
    const initFilter = expectedPrevId
      ? { _id: pid, 'outlineDraft.generationId': expectedPrevId }
      : { _id: pid, 'outlineDraft.generationId': { $exists: false } };
    const initialized = await Project.findOneAndUpdate(
      initFilter, { $set: { outlineDraft: initialDraft } }, { new: true }
    ).exec();
    if (!initialized) {
      res.status(409).json({ error: '草稿初始化冲突：存在并发生成，请稍后重试', code: 'DRAFT_INIT_CONFLICT' });
      return;
    }

    const sse = new SSEHandler(res);
    const abortController = new AbortController();
    let clientDisconnected = false;

    // onClose 只置标记 + 取消上游；断点状态统一由外层 catch 持久化
    sse.onClose(() => {
      clientDisconnected = true;
      abortController.abort();
      console.log(`[REQ ${requestId}] 大纲生成: 客户端断开 projectId=${pid} generationId=${generationId}`);
    });

    // 运行中的草稿状态（回调串行执行，无需每次回库合并）
    const draftState = initialized.outlineDraft as IOutlineDraft;

    /** generationId 原子守卫写：null => 运行已被取代/删除，抛错而非静默 */
    const persistPatch = async (patch: Partial<IOutlineDraft>): Promise<void> => {
      const setDoc: Record<string, unknown> = { 'outlineDraft.updatedAt': new Date().toISOString() };
      for (const [k, v] of Object.entries(patch)) setDoc[`outlineDraft.${k}`] = v;
      const updated = await Project.findOneAndUpdate(
        { _id: pid, 'outlineDraft.generationId': generationId },
        { $set: setDoc }
      ).exec();
      if (!updated) throw new Error('检查点写入冲突：生成运行已被取代或删除');
      Object.assign(draftState, patch);
    };

    const fieldMap: Record<number, string> = useEnhancedMode
      ? { 1: 'storyCore', 2: 'characterFunctions', 3: 'characterCards', 4: 'synopsis', 5: 'episodeSummaries' }
      : { 1: 'characterCards', 2: 'synopsis', 3: 'episodeSummaries' };

    try {
      const totalSteps = useEnhancedMode ? 5 : 3;
      sse.send('start', { totalSteps, enhanced: useEnhancedMode, mode, generationId, resuming: !!resumeCheckpoint });
      // 检查点事件：客户端在续跑前水合已保存内容（服务层跳步不再回放）
      sse.send('checkpoint', resumeCheckpoint
        ? { result: resumeCheckpoint.result, completedSteps: resumeCheckpoint.completedSteps, episodeBatches: resumeCheckpoint.episodeBatches }
        : { result: {}, completedSteps: [], episodeBatches: [] });

      console.log(`[REQ ${requestId}] 大纲生成开始 projectId=${pid} model=${modelName}/${modelConfig.model} mode=${mode} resume=${!!resumeCheckpoint}`);

      const generateFn = useEnhancedMode
        ? outlineService.generateEnhancedOutlineStream.bind(outlineService)
        : outlineService.generateOutlineStream.bind(outlineService);

      const result = await generateFn(outlineParams, {
        onStepStart: (step, name) => {
          console.log(`[REQ ${requestId}] 大纲步骤开始 step=${step} name=${name} projectId=${pid}`);
          sse.send('step_start', { step, name });
        },
        onChunk: (step, chunk) => sse.send('chunk', { step, chunk }),
        onStepDone: async (step, content) => {
          // 先持久化成功，再发 step_done——检查点写失败直接中止且不发送
          const field = fieldMap[step];
          const completedSteps = Array.from(new Set([...(draftState.completedSteps || []), step])).sort((a, b) => a - b);
          await persistPatch({
            completedSteps,
            result: { ...draftState.result, [field]: content } as IOutlineDraft['result'],
          });
          sse.send('step_done', { step });
          console.log(`[REQ ${requestId}] 大纲步骤持久化 step=${step} projectId=${pid}`);
        },
        onBatchDone: async (step, batch) => {
          const episodeBatches = [...(draftState.episodeBatches || []), batch];
          const episodeSummaries = episodeBatches.map(b => b.content).filter(Boolean).join('\n\n');
          await persistPatch({
            episodeBatches,
            result: { ...draftState.result, episodeSummaries } as IOutlineDraft['result'],
          });
          console.log(`[REQ ${requestId}] 分集批次持久化 ${batch.startEpisode}-${batch.endEpisode} projectId=${pid}`);
        },
        onBatchProgress: (step, batch, totalBatches, startEp, endEp) =>
          sse.send('batch_progress', { step, batch, totalBatches, startEpisode: startEp, endEpisode: endEp }),
      }, { resume: resumeCheckpoint, signal: abortController.signal, modelName });

      // ---- 最终化（服务回调之外）：角色先校验/upsert（不写删），再原子提交正式大纲，最后清理旧角色 ----
      const { count: characterCount, keepIds: charSyncKeepIds } = await extractAndSaveCharacters(pid, result.characterCards);

      const committed = await Project.findOneAndUpdate(
        { _id: pid, 'outlineDraft.generationId': generationId },
        {
          $set: {
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
            ...(useEnhancedMode ? { storyMode: storyMode || undefined, pacing: pacing || undefined } : {}),
            'outlineDraft.status': 'completed',
            'outlineDraft.result.raw': result.raw,
            'outlineDraft.updatedAt': new Date().toISOString(),
          },
          $unset: { 'outlineDraft.error': '', ...(useEnhancedMode ? {} : { storyMode: '', pacing: '' }) },
        }
      ).exec();
      if (!committed) throw new Error('最终提交冲突：生成运行已被取代或删除');

      // 正式提交成功后再清理旧角色；清理失败不阻断完成但告警
      let cleanupWarning: string | undefined;
      if (charSyncKeepIds) {
        try { await cleanupObsoleteCharacters(pid, charSyncKeepIds); }
        catch (e) {
          cleanupWarning = `角色清理失败: ${(e as Error).message}`;
          console.warn(`[REQ ${requestId}] ${cleanupWarning}`);
        }
      }

      console.log(`[REQ ${requestId}] 大纲生成完成并持久化 projectId=${pid} characters=${characterCount}`);

      sse.sendDone({
        ...(cleanupWarning ? { warning: cleanupWarning } : {}),
        raw: result.raw,
        characterCards: result.characterCards,
        synopsis: result.synopsis,
        episodeSummaries: result.episodeSummaries,
        storyCore: result.storyCore,
        characterFunctions: result.characterFunctions,
        extractedCharacters: characterCount,
        enhanced: useEnhancedMode,
        generationId,
        requestId,
      });
    } catch (error) {
      const err = error as Error;
      console.error(`[REQ ${requestId}] 大纲生成失败 projectId=${pid}:`, err.message);
      const interrupted = clientDisconnected || err.name === 'AbortError';
      // 唯一的草稿终态写入（onClose 不做竞争性写）
      try {
        await persistPatch({ status: interrupted ? 'interrupted' : 'failed', error: err.message });
      } catch (e2) {
        console.error(`[REQ ${requestId}] 断点终态写入失败:`, (e2 as Error).message);
      }
      if (!sse.isClosed()) {
        sse.send('error', { message: err.message, requestId, resumable: true });
        sse.close();
      }
    }
  } catch (preError) {
    // SSE 建立前的前置失败：JSON 错误（锁由 finally 释放）
    if (!res.headersSent) errorJson(res, 500, (preError as Error).message);
  } finally {
    releaseOutlineRun(pid, generationId);
  }
}

function isAbortError(error: Error): boolean {
  return error?.name === 'AbortError' || error?.message === '请求已取消';
}

// 简易大纲生成 (SSE) - 兼容旧接口；与现代路由共用同项目锁/中止，防止并发覆盖
router.post('/generate-outline', async (req: Request, res: Response) => {
  const { projectId, concept, requirements } = req.body;
  let project: IProject | null = null;
  try {
    project = await requireProjectAccess(req, res, projectId);
  } catch (error) {
    if (!res.headersSent) errorJson(res, 500, (error as Error).message);
    return;
  }
  if (!project) return;
  const pid = project._id.toString();
  const legacyRunId = `legacy-${Date.now()}`;
  if (!acquireOutlineRun(pid, legacyRunId)) {
    errorJson(res, 409, '该项目已有正在进行的大纲生成，请稍后重试');
    return;
  }

  const abortController = new AbortController();
  const sse = new SSEHandler(res);
  try {
    sse.onClose(() => {
      if (!res.writableFinished) abortController.abort();
      console.log('大纲生成: 客户端断开连接');
    });
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
          if (sse.isClosed() || abortController.signal.aborted) return;
          const parsed = outlineService.parseOutlineResponse(text);
          await projectRepository.update(pid, { outline: parsed, status: 'outline_done' });
          sse.sendProgress(100, 100, '大纲生成完成');
          sse.sendDone({ projectId: pid, content: text });
        },
        onError: (error) => sse.sendError(error.message),
      },
      { signal: abortController.signal }
    );
  } catch (error) {
    if (!sse.isClosed()) sse.sendError((error as Error).message);
  } finally {
    releaseOutlineRun(pid, legacyRunId);
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

  const { projectId, episodeNumber, episodePlan } = req.body;
  let project: IProject | null = null;
  try {
    project = await requireProjectAccess(req, res, projectId);
  } catch (error) {
    if (!res.headersSent) errorJson(res, 500, (error as Error).message);
    return;
  }
  if (!project) return;

  const sse = new SSEHandler(res);

  try {
    if (!episodeNumber) { sse.sendError('缺少必要参数'); return; }

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

  const { projectId, startEpisode, endEpisode } = req.body;
  if (!startEpisode || !endEpisode) { errorJson(res, 400, '缺少必要参数'); return; }
  let project: IProject | null = null;
  try {
    project = await requireProjectAccess(req, res, projectId);
  } catch (error) {
    if (!res.headersSent) errorJson(res, 500, (error as Error).message);
    return;
  }
  if (!project) return;

  const sse = new SSEHandler(res);

  try {

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
  const { projectId, episodeNumber, originalContent, instructions } = req.body;
  if (!episodeNumber || !originalContent) { errorJson(res, 400, '缺少必要参数'); return; }
  let project: IProject | null = null;
  try {
    project = await requireProjectAccess(req, res, projectId);
  } catch (error) {
    if (!res.headersSent) errorJson(res, 500, (error as Error).message);
    return;
  }
  if (!project) return;

  const sse = new SSEHandler(res);

  try {

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
  const { projectId, episodeNumbers, instructions } = req.body;
  if (!Array.isArray(episodeNumbers) || episodeNumbers.length === 0) {
    errorJson(res, 400, '缺少必要参数'); return;
  }
  let project: IProject | null = null;
  try {
    project = await requireProjectAccess(req, res, projectId);
  } catch (error) {
    if (!res.headersSent) errorJson(res, 500, (error as Error).message);
    return;
  }
  if (!project) return;

  const sse = new SSEHandler(res);

  try {

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
    if (!issue) { errorJson(res, 400, '缺少必要参数'); return; }
    const project = await requireProjectAccess(req, res, projectId);
    if (!project) return;

    const result = await new RewriteService(projectId).analyzeAndPlanFix(issue);
    res.json(result);
  } catch (error) {
    console.error('[AI] 分析问题失败:', error);
    errorJson(res, 500, (error as Error).message);
  }
});

// 执行修复方案 (SSE)
router.post('/execute-fix', async (req: Request, res: Response) => {
  const { projectId, plan, episodeNumber } = req.body;
  if (!plan || !episodeNumber) { errorJson(res, 400, '缺少必要参数'); return; }
  let project: IProject | null = null;
  try {
    project = await requireProjectAccess(req, res, projectId);
  } catch (error) {
    if (!res.headersSent) errorJson(res, 500, (error as Error).message);
    return;
  }
  if (!project) return;

  const sse = new SSEHandler(res);

  try {

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
