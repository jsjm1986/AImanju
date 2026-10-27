/**
 * 世界状态增强 AI 控制器
 * 提供 WorldState 驱动的剧本生成 API
 */

import { Request, Response, Router } from 'express';
import { IRhythmTracking, Project } from '../models/Project';
import { CharacterTier } from '../models/WorldState';
import { characterRepository, episodeRepository, generationLogRepository, projectRepository, worldStateRepository } from '../repositories';
import { protectProjectRouter } from '../middleware/projectAccess';
import { getEpisodePlanFromOutline } from '../utils/episodePlan';
import { AIClient, aiClient, withModel, currentRequestSignal, throwIfContextAborted } from '../services/ai/AIClient';
import { GenreType, IStructuredConstraint, ModularAttentionSystem } from '../services/attention/AttentionModules';
import { isOverseasFemaleChannel, OVERSEAS_TYPES } from '../constants/overseas';
import { CharacterLifecycleManager } from '../services/character/CharacterLifecycleManager';
import { CharacterType, parseCharacterCards } from '../services/character/CharacterParser';
import { characterCharmAnalyzer } from '../services/character/CharacterCharmAnalyzer';
import { characterArcTracker } from '../services/character/CharacterArcTracker';
import { characterVoiceProfiler } from '../services/character/CharacterVoiceProfiler';
import { Constraint, ConstraintValidator, ValidationResponse } from '../services/constraint/ConstraintValidator';
import { UnifiedConstraintContext, UnifiedConstraintManager } from '../services/constraint/UnifiedConstraintManager';
import { EnhanceContext, EpisodePlanEnhancer } from '../services/episode/EpisodePlanEnhancer';
import { IRhythmControlParams, RHYTHM_PRESETS, RhythmConstraintResult, RhythmController, RhythmPresetType } from '../services/rhythm/RhythmControl';
import { scriptService } from '../services/script/scriptService';
import { SSEHandler } from '../services/sse/SSEHandler';
import { EnhancedStateAnalyzer } from '../services/state/EnhancedStateAnalyzer';
import { WorldStateManager } from '../services/world/WorldStateManager';
import { normalizeOverseasScript, outputFormatService, scanOverseasScript, OverseasScanViolation } from '../services/format/OutputFormatService';
import { createLogger } from '../utils/errorLogger';
import { getOutlineRaw } from '../utils/outline';
import { WordCountService } from '../utils/wordCount';
import { creatorAuth, optionalCreatorAuth } from '../middleware/creatorMiddleware';
import { Creator } from '../models/Creator';

const router = Router();
protectProjectRouter(router);
const logger = createLogger('WorldStateController');

// ========== 共享常量 ==========

const STYLE_NAMES: Record<string, string> = {
  literary: '文艺风', colloquial: '口语化', humorous: '幽默风', serious: '严肃风',
  poetic: '诗意风', dramatic: '戏剧化', minimalist: '极简风', descriptive: '描写细腻', custom: '自定义',
};

// ========== 通用路由辅助函数 ==========

function handleRouteError(res: Response, error: unknown): void {
  res.status(500).json({ error: (error as Error).message });
}

async function findProjectOrFail(res: Response, projectId: string): Promise<ReturnType<typeof projectRepository.findById> extends Promise<infer T> ? T : never> {
  const project = await projectRepository.findById(projectId);
  if (!project) {
    res.status(404).json({ error: '项目不存在' });
  }
  return project as any;
}

function countConstraintStats(constraints: Constraint[]): {
  criticalCount: number;
  importantCount: number;
  verifiableCount: number;
  guidanceCount: number;
} {
  return {
    criticalCount: constraints.filter((c) => c.severity === 'critical').length,
    importantCount: constraints.filter((c) => c.severity === 'important').length,
    verifiableCount: constraints.filter((c) => c.category === 'verifiable').length,
    guidanceCount: constraints.filter((c) => c.category === 'guidance').length,
  };
}

function logGenerationError(
  message: string,
  error: unknown,
  operation: string,
  context: { projectId: string; episodeNumber: number },
): void {
  logger.error(message, error as Error, {
    method: 'generate-script-enhanced',
    operation,
    additionalInfo: context,
  });
}

interface CharacterEnhancementResult {
  charmContext: string;
  arcContext: string;
  voiceContext: string;
}

async function loadCharacterEnhancements(
  projectId: string,
  sse: SSEHandler,
  addLog: (msg: string) => void,
): Promise<CharacterEnhancementResult> {
  const result: CharacterEnhancementResult = { charmContext: '', arcContext: '', voiceContext: '' };

  try {
    sse.sendProgress(22, 100, '正在加载角色增强数据...');

    const charms = await characterCharmAnalyzer.getProjectCharms(projectId);
    if (charms.length > 0) {
      result.charmContext = characterCharmAnalyzer.formatForPrompt(charms);
      sse.sendLog(`[角色增强] 加载 ${charms.length} 个角色的魅力特征`);
      addLog(`加载角色魅力特征: ${charms.map(c => c.characterName).join(', ')}`);
    }

    const arcs = await characterArcTracker.getProjectArcs(projectId);
    if (arcs.length > 0) {
      result.arcContext = characterArcTracker.formatForPrompt(arcs);
      sse.sendLog(`[角色增强] 加载 ${arcs.length} 个角色的成长弧线`);
      addLog(`加载角色成长弧线: ${arcs.map(a => a.characterName).join(', ')}`);
    }

    const voices = await characterVoiceProfiler.getProjectVoices(projectId);
    if (voices.length > 0) {
      result.voiceContext = characterVoiceProfiler.formatForPrompt(voices);
      sse.sendLog(`[角色增强] 加载 ${voices.length} 个角色的语言风格`);
      addLog(`加载角色语言风格: ${voices.map(v => v.characterName).join(', ')}`);
    }

    if (charms.length === 0 && arcs.length === 0 && voices.length === 0) {
      sse.sendLog(`[角色增强] 暂无增强数据，使用基础角色设定`);
    }
  } catch (enhancementError) {
    logger.warn('获取角色增强数据失败，使用默认设置', {
      error: (enhancementError as Error).message,
      projectId,
    });
    sse.sendLog(`[角色增强] 加载失败，使用基础角色设定`, 'warn');
  }

  return result;
}

// 缓存：项目的节奏控制器
// 使用 LRU 策略，最多缓存 100 个项目的控制器
const MAX_RHYTHM_CACHE_SIZE = 100;
const rhythmControllers = new Map<string, RhythmController>();
const rhythmAccessOrder: string[] = [];  // 记录访问顺序，用于 LRU 淘汰

/**
 * 清理过期的节奏控制器缓存
 */
function cleanupRhythmCache(): void {
  while (rhythmControllers.size > MAX_RHYTHM_CACHE_SIZE && rhythmAccessOrder.length > 0) {
    const oldestProjectId = rhythmAccessOrder.shift();
    if (oldestProjectId) {
      rhythmControllers.delete(oldestProjectId);
      console.log(`[RhythmCache] 淘汰缓存: ${oldestProjectId}`);
    }
  }
}

/**
 * 更新缓存访问顺序
 */
function updateRhythmAccessOrder(projectId: string): void {
  const index = rhythmAccessOrder.indexOf(projectId);
  if (index > -1) {
    rhythmAccessOrder.splice(index, 1);
  }
  rhythmAccessOrder.push(projectId);
}

/**
 * 将角色类型转换为层级
 */
function typeToTier(type: string): CharacterTier {
  const typeMapping: Record<string, CharacterTier> = {
    '主角': 'core',
    '男主角': 'core',
    '女主角': 'core',
    '反派': 'recurring',
    '重要配角': 'recurring',
    '关键角色': 'arc',
    '配角': 'arc',
    '客串角色': 'temporary',
    '客串': 'temporary',
    '龙套': 'extra',
  };
  return typeMapping[type] || 'arc';
}

/**
 * 从大纲中提取初始设定信息
 */
function extractOutlineInfo(outline: unknown): {
  mainPlot?: string;
  arcs?: Array<{ name: string; description: string }>;
  worldBackground?: string;
} {
  if (!outline || typeof outline !== 'object') {
    return {};
  }

  const outlineObj = outline as Record<string, unknown>;

  const result: {
    mainPlot?: string;
    arcs?: Array<{ name: string; description: string }>;
    worldBackground?: string;
  } = {};

  // 提取主线剧情
  if (outlineObj.mainPlot && typeof outlineObj.mainPlot === 'string') {
    result.mainPlot = outlineObj.mainPlot;
  } else if (outlineObj.summary && typeof outlineObj.summary === 'string') {
    result.mainPlot = outlineObj.summary;
  }

  // 提取篇章信息
  if (Array.isArray(outlineObj.arcs)) {
    result.arcs = outlineObj.arcs.map((arc: Record<string, unknown>) => ({
      name: String(arc.name || arc.title || '未知篇章'),
      description: String(arc.description || arc.summary || ''),
    }));
  } else if (Array.isArray(outlineObj.chapters)) {
    result.arcs = outlineObj.chapters.map((ch: Record<string, unknown>) => ({
      name: String(ch.name || ch.title || '未知篇章'),
      description: String(ch.description || ch.summary || ''),
    }));
  }

  // 提取世界观背景
  if (outlineObj.worldBackground && typeof outlineObj.worldBackground === 'string') {
    result.worldBackground = outlineObj.worldBackground;
  } else if (outlineObj.setting && typeof outlineObj.setting === 'string') {
    result.worldBackground = outlineObj.setting;
  }

  return result;
}

/**
 * 获取或创建项目的节奏控制器
 * 注意：此函数现在是同步的，但会在首次调用时使用默认值
 * 调用方应该先调用 initRhythmController 来从数据库加载完整状态
 */
function getRhythmController(projectId: string, preset?: RhythmPresetType): RhythmController {
  updateRhythmAccessOrder(projectId);
  if (!rhythmControllers.has(projectId)) {
    rhythmControllers.set(projectId, new RhythmController(preset || 'hot-blood'));
    cleanupRhythmCache();
  }
  return rhythmControllers.get(projectId)!;
}

/**
 * 异步初始化节奏控制器（从数据库加载追踪数据）
 */
async function initRhythmController(projectId: string): Promise<RhythmController> {
  updateRhythmAccessOrder(projectId);

  // 如果已在缓存中，直接返回
  if (rhythmControllers.has(projectId)) {
    return rhythmControllers.get(projectId)!;
  }

  // 从数据库加载项目的节奏配置和追踪数据
  const project = await Project.findById(projectId).lean();
  if (project) {
    // 默认预设跟随输出格式：海外剧按频道取 overseas-romance/overseas-revenge，否则 hot-blood
    const fallbackPreset = project.outputFormat?.preset === 'overseas_drama'
      ? (isOverseasFemaleChannel(project.genre, project.type) ? 'overseas-romance' : 'overseas-revenge')
      : 'hot-blood';
    const rawPreset = (project.rhythmPreset as string) || fallbackPreset;
    // 非法/未知预设兜底，避免脏数据导致生成崩溃
    const preset = (rawPreset in RHYTHM_PRESETS ? rawPreset : fallbackPreset) as RhythmPresetType;
    const controller = new RhythmController(preset);

    // 如果有自定义参数，应用它们
    if (project.rhythmParams) {
      controller.setParams(project.rhythmParams as Partial<IRhythmControlParams>);
    }

    // 如果有追踪数据，恢复它们（使用 fromJSON 方法）
    if (project.rhythmTracking) {
      const tracking = project.rhythmTracking as IRhythmTracking;
      // 需要构造完整的 JSON 对象来恢复
      const fullState = {
        currentPreset: preset,
        params: controller.getParams(),
        tracking: {
          lastFaceSlap: tracking.lastFaceSlap || 0,
          lastPlotTwist: tracking.lastPlotTwist || 0,
          lastBoss: tracking.lastBoss || 0,
        },
      };
      const restoredController = RhythmController.fromJSON(fullState);
      rhythmControllers.set(projectId, restoredController);
      cleanupRhythmCache();
      return restoredController;
    }

    rhythmControllers.set(projectId, controller);
    cleanupRhythmCache();
    return controller;
  }

  // 如果没有项目记录，使用默认配置
  const controller = new RhythmController('hot-blood');
  rhythmControllers.set(projectId, controller);
  cleanupRhythmCache();
  return controller;
}

/**
 * 保存节奏追踪数据到数据库
 */
async function saveRhythmTracking(projectId: string, controller: RhythmController): Promise<void> {
  try {
    const state = controller.toJSON();
    await Project.findByIdAndUpdate(projectId, {
      rhythmTracking: {
        lastFaceSlap: state.tracking.lastFaceSlap,
        lastPlotTwist: state.tracking.lastPlotTwist,
        lastBoss: state.tracking.lastBoss,
      },
    });
    console.log(`[RhythmTracking] 已保存项目 ${projectId} 的追踪数据`);
  } catch (error) {
    logger.error('保存节奏追踪失败', error as Error, {
      method: 'saveRhythmTracking',
      additionalInfo: { projectId },
    });
  }
}

/**
 * 将项目类型映射到 GenreType
 */
function mapProjectTypeToGenre(type: string): GenreType {
  const mapping: Record<string, GenreType> = {
    // 玄幻系
    '玄幻': 'xuanhuan',
    '仙侠': 'xuanhuan',
    '古风': 'xuanhuan',
    '修仙': 'xuanhuan',
    // 都市系
    '都市': 'dushi',
    '重生': 'dushi',
    '穿越': 'dushi',
    '现代': 'dushi',
    // 悬疑系
    '悬疑': 'xuanyi',
    '侦探': 'xuanyi',
    '推理': 'xuanyi',
    // 恐怖系
    '恐怖': 'kongbu',
    '惊悚': 'kongbu',
    '末世': 'kongbu',
    '灵异': 'kongbu',
    // 智斗系
    '智斗': 'zhidou',
    '谋略': 'zhidou',
    '历史': 'zhidou',
    '权谋': 'zhidou',
    '宫斗': 'zhidou',
    // 系统流
    '系统流': 'xitong',
    '游戏': 'xitong',
    '系统': 'xitong',
    // 言情系
    '言情': 'yanqing',
    '甜宠': 'yanqing',
    '虐恋': 'yanqing',
    '霸总': 'yanqing',
    // 喜剧系
    '喜剧': 'xiju',
    '搞笑': 'xiju',
    '沙雕': 'xiju',
    // 海外短剧系（清单以 constants/overseas.ts 为唯一源，防漂移）
    ...Object.fromEntries(OVERSEAS_TYPES.map((t) => [t, 'overseas' as GenreType])),
    '海外短剧': 'overseas',
    '出海': 'overseas',
  };
  return mapping[type] || 'custom';
}

/**
 * 海外短剧格式审查约束集——全部交由 AI 验证器对剧本全文做语义判定，
 * 替代机械正则；仅在 AI 验证整体失效时才由确定性扫描兜底。
 */
function buildOverseasFormatAuditConstraints(wordLimitMax?: number): Constraint[] {
  const list: Constraint[] = [];
  let n = 0;
  const add = (content: string, severity: Constraint['severity'], validationCriteria?: string[]) => {
    list.push({
      id: `methodology-audit-${++n}`,
      type: 'methodology',
      content,
      severity,
      source: 'narrativeMethodology',
      category: 'verifiable',
      validationCriteria,
    });
  };

  add('开场钩子：开篇无铺垫直切冲突（直接承接上集结尾钩子或以极端画面开局，严禁风景空镜）', 'important');
  add('三钩引擎：本集结尾必须留强钩子（5秒内可理解）；每场内至少一个小悬念/小反转（场钩）；情绪线与信息线同时推进', 'important');
  add('弱动作句式禁止：全文不得出现"动词+了一下/一拍/一声/两秒"式收笔（收紧了一下/笑了一下/看了一眼/停了一拍），动作必须写到具体落点', 'normal');
  add('V.O.边界：内心独白/画外音只表达情绪与潜台词，不得用(V.O.)交代剧情信息或推理结论，单集V.O.不超过4条', 'important');
  add('台词双语合并格式：每句台词为"中文名 英文名(英文情绪/动作)：英文台词"单行结构，冒号后必须是英文原声文案（美式口语），情绪描述为英文可表演状态', 'important',
    ['每行台词均为 中文名+空格+英文名+(英文情绪)+全角冒号+英文台词 结构', '冒号后内容为英文而非中文']);
  add('场景头与人物行：场景头为"集-场 地点 时间 内/外"空格分隔格式（无括号无情绪标签），每个场景头下一行必须有"人物："行列出本场角色', 'important',
    ['所有场景头为 数字-数字 地点 时间 内/外 结构', '每个场景头紧接一行 人物：…']);
  add('内部标记禁止：正文不得出现[HOOK]、【核心情绪】、△、出场人物、OS：/VO：、markdown符号（##等）等内部排版标记；注意花括号镜头指令（如{特写}{升格+特写}{慢镜头}{主观视角}{黑屏}）和方头括号时间标记（【闪回】【闪出】）是合规格式元素，不属于内部标记，不得判为违规', 'important',
    ['全文无△/【核心情绪】/[HOOK]/出场人物行', '台词不出现 角色名OS：/VO： 旧式写法（应为(V.O.)）', '花括号镜头指令与【闪回】【闪出】标记合规，不判为内部标记']);
  add('场景开场：人物行之后应以中文动作描写（可含{镜头指令}花括号行）建立画面，禁止人物行后直接接台词的硬切', 'normal',
    ['逐个场景检查人物行后首行是否为动作描写', '对白直接开场视为硬切（承接上集强钩子的特例除外）']);
  add('动作线克制：动作描写为纯中文独立行（无△前缀），每条只写一个动作或画面（约30字内），不得堆砌多个连续动作', 'normal',
    ['单条动作行包含3个以上连贯动作节拍视为堆砌', '明显超长臃肿的动作行需拆分']);
  add('英文台词精简：单句英文台词约≤80字符（约15词内），长对白拆行', 'normal',
    ['逐行检查冒号后英文台词长度', '明显超长台词需拆分']);
  add('集尾钩子：集尾必须是悬念/危机/揭示而非情绪落定的收尾，钩子落在内容上不写标记', 'important',
    ['剧本最后内容为悬念而非平静收场']);
  if (wordLimitMax) {
    add(`篇幅控制：本集正文应控制在约${wordLimitMax}字以内，明显超篇幅（超出一半以上）需压缩重复信息与弱功能场景`, 'normal',
      [`正文长度约${wordLimitMax}字内`, '超出50%以上视为违规']);
  }
  return list;
}

/**
 * 单集起伏约束（制作方法论：情绪拉扯/黄金开局）——国内海外通用、不受方法论注入开关影响；
 * 由 harness 固定注入（轨道），交 AI 验证器对全文语义判定（判断）。主路径与回退路径共用。
 */
export function buildEpisodeTensionConstraints(currentEpisode: number): Constraint[] {
  const list: Constraint[] = [{
    id: 'tension-1',
    type: 'rhythm',
    content: '单集起伏：本集至少完成一轮"压→扬→新危机"——主角受压后有一次观众看得见的反击、小胜或信息反转，释放后立刻接新的代价或危机，不得整集只压不扬',
    severity: 'important',
    source: 'rhythm',
    category: 'verifiable',
    validationCriteria: [
      '存在主角受压或受困的段落',
      '存在主角主动完成的反击、小胜或信息反转',
      '反转之后出现新的压迫、代价或危机，而非情绪落定收场',
    ],
  }];
  if (currentEpisode === 1) {
    list.push({
      id: 'tension-2',
      type: 'rhythm',
      content: '第1集黄金开局：主角的金手指（核心能力/隐藏身份/关键证据或筹码）在本集以看得见的方式亮相或露出一角，并走出"打压→反转→再打压"的起伏',
      severity: 'important',
      source: 'rhythm',
      category: 'verifiable',
      validationCriteria: [
        '主角的特殊能力、隐藏身份或翻盘筹码在本集有可见呈现（异象、征兆或只让观众看见均可）',
        '本集情绪走向为打压→反转→再打压，而非一路打压',
      ],
    });
  }
  return list;
}

/**
 * 可验证约束预算控制：当约束总量过大时，全量喂给验证器会稀释注意力并加剧输出截断。
 * 保留全部 critical+important，normal 级优先保留格式审查约束，其余按顺序补足预算；
 * 被裁掉的 normal 约束仍参与生成指导，仅本次不参与评分。
 */
function capVerifiableConstraints(constraints: Constraint[], cap = 80): { capped: Constraint[]; dropped: number } {
  const verifiable = constraints.filter(c => c.category === 'verifiable');
  if (verifiable.length <= cap) return { capped: constraints, dropped: 0 };
  const guidance = constraints.filter(c => c.category !== 'verifiable');
  const crit = verifiable.filter(c => c.severity === 'critical');
  const imp = verifiable.filter(c => c.severity === 'important');
  const auditNormals = verifiable.filter(c => c.severity === 'normal' && c.source === 'narrativeMethodology');
  const otherNormals = verifiable.filter(c => c.severity === 'normal' && c.source !== 'narrativeMethodology');
  const slots = Math.max(0, cap - crit.length - imp.length);
  const kept = [...crit, ...imp, ...auditNormals, ...otherNormals].slice(0, crit.length + imp.length + slots);
  return { capped: [...kept, ...guidance], dropped: verifiable.length - kept.length };
}

/**
 * 从生成上下文中收集所有约束
 * 将各种来源的约束转换为统一的 Constraint 格式
 * 区分可验证约束（verifiable）和指导性约束（guidance）
 *
 * V2 更新：支持 ForeshadowingManager 返回的 AI 优化伏笔约束
 */
function collectAllConstraints(params: {
  rhythmVerifiableConstraints: string[];  // 可验证的节奏约束（打脸、反转、Boss）
  rhythmGuidanceConstraints: string[];    // 指导性节奏约束（升级节奏、反派智商等）
  worldStateConstraints: string[];
  // V2: 支持两种伏笔约束来源
  // 旧方式：从 relevantForeshadowings 自动判断
  relevantForeshadowings?: Array<{
    content: string;
    weight: number;
    episodePlanted?: number;
    importance?: string;
  }>;
  // 新方式：使用 ForeshadowingManager 返回的 AI 优化约束
  aiOptimizedForeshadowingConstraints?: {
    verifiable: Array<{ id: string; content: string; priority: number }>;
    guidance: Array<{ id: string; content: string }>;
  };
  previousCliffhanger: string | null;
  characterStateConstraints: Array<{ name: string; condition: string }>;
  currentEpisode: number;
  enableNarrativeMethodology?: boolean;
  outputFormatPreset?: string;
  outputFormatWordLimitMax?: number;
}): Constraint[] {
  const constraints: Constraint[] = [];
  let idCounter = 1;

  // 1. 可验证的节奏约束（打脸、反转、Boss等）
  for (const content of params.rhythmVerifiableConstraints) {
    let type: Constraint['type'] = 'rhythm';
    let severity: Constraint['severity'] = 'important';

    if (content.includes('打脸')) {
      type = 'faceSlapping';
      severity = 'important';
    } else if (content.includes('反转')) {
      type = 'plotTwist';
      severity = 'important';
    } else if (content.includes('Boss') || content.includes('反派')) {
      type = 'boss';
      severity = 'important';
    } else if (content.includes('爽点')) {
      type = 'coolPoint';
      severity = 'normal';
    }

    constraints.push({
      id: `rhythm-${idCounter++}`,
      type,
      content,
      severity,
      source: 'rhythm',
      category: 'verifiable',  // 可验证
    });
  }

  // 2. 指导性节奏约束（升级节奏、反派智商等）- 不参与验证
  for (const content of params.rhythmGuidanceConstraints) {
    constraints.push({
      id: `guidance-${idCounter++}`,
      type: 'rhythm',
      content,
      severity: 'normal',
      source: 'rhythm',
      category: 'guidance',  // 仅指导，不验证
    });
  }

  // 3. 伏笔约束 - V2：优先使用 AI 优化的约束
  if (params.aiOptimizedForeshadowingConstraints) {
    // 使用 ForeshadowingManager 返回的 AI 优化约束
    const { verifiable, guidance } = params.aiOptimizedForeshadowingConstraints;

    // 可验证的伏笔约束（必须在剧本中体现）
    for (const f of verifiable) {
      constraints.push({
        id: `foreshadowing-${f.id || idCounter++}`,
        type: 'foreshadowing',
        content: `回收伏笔：${f.content}`,
        severity: f.priority >= 80 ? 'critical' : (f.priority >= 60 ? 'important' : 'normal'),
        source: 'foreshadowing',
        context: `AI优先级: ${f.priority}`,
        category: 'verifiable',
      });
    }

    // 指导性伏笔约束（参考但不强制验证）
    for (const f of guidance) {
      constraints.push({
        id: `foreshadowing-guidance-${f.id || idCounter++}`,
        type: 'foreshadowing',
        content: `可参考伏笔：${f.content}`,
        severity: 'normal',
        source: 'foreshadowing',
        category: 'guidance',
      });
    }
  } else if (params.relevantForeshadowings) {
    // 回退到旧方式：从 relevantForeshadowings 自动判断
    for (const f of params.relevantForeshadowings) {
      // 只处理高权重的伏笔（weight >= 0.5 表示AI认为应该在本集使用）
      if (f.weight >= 0.5) {
        const age = f.episodePlanted ? params.currentEpisode - f.episodePlanted : 0;
        const threshold = f.importance === 'high' ? 10 : f.importance === 'normal' ? 20 : 30;
        const isOverdue = f.episodePlanted ? age > threshold : false;

        constraints.push({
          id: `foreshadowing-${idCounter++}`,
          type: 'foreshadowing',
          content: `回收伏笔：${f.content}`,
          severity: isOverdue ? 'critical' : (f.importance === 'high' ? 'important' : 'normal'),
          source: 'foreshadowing',
          context: f.episodePlanted
            ? `第${f.episodePlanted}集埋下，已${age}集${isOverdue ? '（已超期！）' : ''}`
            : undefined,
          category: 'verifiable',
        });
      }
    }
  }

  // 4. 悬念承接约束（critical）- 可验证
  if (params.previousCliffhanger) {
    constraints.push({
      id: `cliffhanger-${idCounter++}`,
      type: 'cliffhanger',
      content: `必须承接上集悬念：${params.previousCliffhanger}`,
      severity: 'critical',
      source: 'continuity',
      context: '上集结尾悬念，本集开头必须延续',
      category: 'verifiable',  // 可验证
    });
  }

  // 5. 角色状态约束 - 可验证
  for (const c of params.characterStateConstraints) {
    constraints.push({
      id: `character-${idCounter++}`,
      type: 'characterState',
      content: `${c.name}的状态必须体现：${c.condition}`,
      severity: 'important',
      source: 'worldState',
      category: 'verifiable',  // 可验证
    });
  }

  // 6. WorldState 约束 - 可验证
  for (const content of params.worldStateConstraints) {
    // 识别多头注意力的 [重要] 标记或包含"必须"/"强制"的约束
    const isImportant = content.startsWith('[重要]') || content.includes('必须') || content.includes('强制');
    // 去掉 [重要] 前缀用于显示
    const cleanContent = content.replace(/^\[重要\]\s*/, '');

    constraints.push({
      id: `worldState-${idCounter++}`,
      type: 'continuity',
      content: cleanContent,
      severity: isImportant ? 'critical' : 'important',
      source: 'worldState',
      category: 'verifiable',  // 可验证
    });
  }

  // 6.5 单集起伏约束（制作方法论：情绪拉扯/黄金开局）- 国内海外通用、不受方法论开关影响
  constraints.push(...buildEpisodeTensionConstraints(params.currentEpisode));

  // 7. 叙事科学方法论约束 - 可验证（海外格式默认启用、可在项目设置中关闭；其他格式按开关）
  const methodologyEnabled = params.enableNarrativeMethodology ?? (params.outputFormatPreset === 'overseas_drama');
  if (methodologyEnabled) {
    if (params.outputFormatPreset === 'overseas_drama') {
      constraints.push(...buildOverseasFormatAuditConstraints(params.outputFormatWordLimitMax));
    } else {
      constraints.push({
        id: `methodology-${idCounter++}`,
        type: 'methodology',
        content: '对白长度控制：每句对白不超过15字',
        severity: 'normal',
        source: 'narrativeMethodology',
        category: 'verifiable',
      });

      constraints.push({
        id: `methodology-${idCounter++}`,
        type: 'methodology',
        content: '开场钩子：前3秒必须出现明确冲突（威胁/羞辱/违和/危机）',
        severity: 'important',
        source: 'narrativeMethodology',
        category: 'verifiable',
      });

      constraints.push({
        id: `methodology-${idCounter++}`,
        type: 'methodology',
        content: '爽点密度：3分钟内必须包含4-6个有效回报点（信息/情绪/地位/证据/身份/反转）',
        severity: 'important',
        source: 'narrativeMethodology',
        category: 'verifiable',
      });
    }
  }

  return constraints;
}

/**
 * WorldState 增强版剧本生成 (SSE)
 * 使用 WorldState 构建上下文，生成后自动分析更新
 */
// 同项目增强生成排他（单实例）；进程重启后锁自动释放
const activeEnhancedRuns = new Map<string, string>();

/**
 * 生成入口：预检（认证/归属/参数/模型/前集/配额前置）后再建 SSE；
 * withModel 快照 + 请求级 AbortSignal，断开才取消上游。
 */
router.post('/generate-script-enhanced', creatorAuth, async (req: Request, res: Response) => {
  if (req.aborted || res.destroyed) return;
  const requestId = req.requestId || '';
  const { projectId, modelName } = req.body || {};
  const useWorldState = req.body?.useWorldState === undefined ? true : req.body.useWorldState;
  if (typeof useWorldState !== 'boolean') {
    res.status(400).json({ error: '非法的 useWorldState 参数', requestId: req.requestId }); return;
  }
  if (modelName !== undefined && typeof modelName !== 'string') {
    res.status(400).json({ error: '非法的 modelName 参数', requestId: req.requestId }); return;
  }
  const json = (code: number, msg: string, extra: object = {}) =>
    res.status(code).json({ error: msg, requestId, ...extra });

  try {
    // ---- 全部前置校验在 SSE/配额之前：JSON 错误 ----
    if (typeof projectId !== 'string' || !projectId.trim() || !/^[0-9a-fA-F]{24}$/.test(projectId.trim())) {
      json(400, '无效的项目ID'); return;
    }
    const episodeNumber = req.body?.episodeNumber;
    if (typeof episodeNumber !== 'number' || !Number.isInteger(episodeNumber) || episodeNumber < 1) {
      json(400, '集数必须是正整数'); return;
    }

    const project = await projectRepository.findById(projectId.trim());
    if (!project) { json(404, '项目不存在'); return; }
    const pid = project._id.toString();

    // 归属：绑定创建者的项目仅所有者/管理员；未绑定的历史项目仅管理员（无隐式放行）
    const isAdmin = req.creator?.role === 'admin';
    const ownerId = project.creatorId?.toString();
    if (!isAdmin && (!ownerId || ownerId !== req.creatorId)) {
      json(403, '无权访问此项目'); return;
    }

    if (episodeNumber > (project.totalEpisodes || 500)) {
      json(400, `集数必须在1-${project.totalEpisodes || 500}之间`); return;
    }

    // 前集依赖：第N集需第N-1集已生成（跳集 => 409）
    let prevEpisode: Awaited<ReturnType<typeof episodeRepository.findByNumber>> = null;
    if (episodeNumber > 1) {
      prevEpisode = await episodeRepository.findByNumber(pid, episodeNumber - 1);
      if (!prevEpisode || !prevEpisode.content?.trim()) {
        json(409, `请先生成第${episodeNumber - 1}集，不支持跳集生成`, { code: 'PREVIOUS_EPISODE_REQUIRED' });
        return;
      }
    }

    // 模型：显式指定须已配置；默认须当前已配置模型
    let pinnedModel: string;
    if (typeof modelName === 'string' && modelName && modelName !== 'default') {
      if (!aiClient.isModelConfigured(modelName)) {
        json(503, `模型 ${modelName} 未配置或不存在`, { code: 'MODEL_NOT_CONFIGURED' }); return;
      }
      pinnedModel = modelName;
    } else {
      pinnedModel = aiClient.getCurrentModelName();
      if (!aiClient.isModelConfigured(pinnedModel)) {
        json(503, '当前模型未配置，请先配置 API 密钥', { code: 'MODEL_NOT_CONFIGURED' }); return;
      }
    }

    // 同项目排他：并发同项目生成 => 409（计费与上游调用之前）
    const runId = requestId || `${Date.now()}`;
    if (activeEnhancedRuns.has(pid)) {
      json(409, '该项目已有正在进行的剧本生成', { code: 'RUN_IN_PROGRESS' }); return;
    }
    activeEnhancedRuns.set(pid, runId);

    const abortController = new AbortController();
    const onResClose = () => { if (!res.writableFinished) abortController.abort(); };
    res.on('close', onResClose);
    try {
      if (res.destroyed || req.aborted) return;
      // Reserve trial usage atomically, only after authorization and generation preflight.
      if (project.creatorId) {
        const creator = await Creator.findById(project.creatorId);
        if (abortController.signal.aborted) return;
        if (creator?.tier === 'trial' && creator.role !== 'admin') {
          const trialLimit = parseInt(process.env.TRIAL_EPISODE_LIMIT || '10', 10);
          if (!Number.isFinite(trialLimit) || trialLimit < 0) {
            json(503, '试用配额配置无效，请联系管理员'); return;
          }
          const reserved = await Creator.findOneAndUpdate(
            {
              _id: project.creatorId,
              tier: 'trial',
              $or: [
                { trialEpisodesUsed: { $lt: trialLimit } },
                ...(trialLimit > 0 ? [{ trialEpisodesUsed: { $exists: false } }] : []),
              ],
            },
            { $inc: { trialEpisodesUsed: 1 } },
            { new: true }
          ).exec();
          if (!reserved) {
            json(403, `试用配额已用完（${trialLimit}集），请购买项目配额以解锁无限生成`, { code: 'EPISODE_QUOTA_EXCEEDED' });
            return;
          }
        }
      }
      if (abortController.signal.aborted) return;
      return await withModel(
        pinnedModel,
        () => handleGenerateScriptEnhanced(req, res, pid, project, episodeNumber, useWorldState, prevEpisode?.content || null),
        abortController.signal
      );
    } finally {
      res.removeListener('close', onResClose);
      if (activeEnhancedRuns.get(pid) === runId) activeEnhancedRuns.delete(pid);
    }
  } catch (e) {
    if (!res.headersSent && !res.destroyed) json(500, (e as Error).message);
    else if (!res.writableEnded) res.end();
  }
});

async function handleGenerateScriptEnhanced(
  req: Request, res: Response,
  pid: string,
  project: NonNullable<Awaited<ReturnType<typeof projectRepository.findById>>>,
  episodeNumber: number,
  useWorldState: boolean,
  prevEpisodeContent: string | null
): Promise<void> {
  const sse = new SSEHandler(res);
  const signal = currentRequestSignal();
  const checkAbort = throwIfContextAborted;

  try {
    checkAbort();
    const projectId = pid;

    sse.onClose(() => {
      console.log(`[WorldState] 第${episodeNumber}集生成被中断`);
    });

    sse.sendProgress(0, 100, `开始生成第${episodeNumber}集剧本...`);
    sse.sendLog(`开始生成第${episodeNumber}集剧本...`);

    // 1. 初始化服务（使用共享的 aiClient 单例）
    const worldStateManager = new WorldStateManager(projectId, aiClient);
    const stateAnalyzer = new EnhancedStateAnalyzer(projectId, aiClient);

    // 使用异步初始化，从数据库加载追踪数据
    const rhythmController = await initRhythmController(projectId);
    rhythmController.setCurrentEpisode(episodeNumber);

    // 初始化多头注意力系统和角色生命周期管理器
    const genre = mapProjectTypeToGenre(project.type || '');
    const attentionSystem = new ModularAttentionSystem(aiClient, genre);

    // 检查是否有自定义注意力头配置
    const attentionConfig = project.attentionHeadConfig as { mode: string; enabledHeads?: string[]; headWeights?: Record<string, number> } | undefined;
    if (attentionConfig?.mode === 'custom' && attentionConfig.enabledHeads) {
      // 禁用所有非基础头
      const currentHeads = attentionSystem.getEnabledHeads();
      for (const head of currentHeads) {
        if (!head.startsWith('base-') && !attentionConfig.enabledHeads.includes(head)) {
          attentionSystem.disableHead(head as import('../services/attention/AttentionModules').AttentionHeadType);
        }
      }
      // 启用用户选择的头
      for (const head of attentionConfig.enabledHeads) {
        attentionSystem.enableHead(head as import('../services/attention/AttentionModules').AttentionHeadType);
      }
      // 应用自定义权重
      if (attentionConfig.headWeights) {
        for (const [head, weight] of Object.entries(attentionConfig.headWeights)) {
          attentionSystem.setHeadWeight(head as import('../services/attention/AttentionModules').AttentionHeadType, weight);
        }
      }
      sse.sendLog(`[初始化] 使用自定义注意力头配置`);
    }

    const lifecycleManager = new CharacterLifecycleManager(projectId);
    sse.sendLog(`[初始化] 服务组件加载完成`);
    sse.sendLog(`[初始化] 题材: ${project.type || '自定义'} → 注意力模式: ${attentionConfig?.mode === 'custom' ? '自定义' : genre}`);
    sse.sendLog(`[初始化] 启用注意力头: ${attentionSystem.getEnabledHeads().length}个`);

    // 记录写作风格
    const writingStyleConfig = project.writingStyle as { preset: string; customDescription?: string } | undefined;
    if (writingStyleConfig) {
      const styleName = STYLE_NAMES[writingStyleConfig.preset] || writingStyleConfig.preset;
      sse.sendLog(`[初始化] 写作风格: ${styleName}${writingStyleConfig.preset === 'custom' ? ' - ' + (writingStyleConfig.customDescription?.slice(0, 30) || '') + '...' : ''}`);
    } else {
      sse.sendLog(`[初始化] 写作风格: 口语化（默认）`);
    }

    // 追踪生成时间和日志
    const generationStartTime = Date.now();
    const collectedLogs: Array<{ time: string; message: string; level: 'info' | 'warn' | 'error' }> = [];
    const addLog = (message: string, level: 'info' | 'warn' | 'error' = 'info') => {
      collectedLogs.push({ time: new Date().toISOString(), message, level });
    };
    addLog(`开始生成第${episodeNumber}集剧本`);

    // 用于保存的上下文数据
    let savedEpisodePlan = '';
    let savedMultiHeadAnalysis: Record<string, unknown> | undefined;
    let savedMultiHeadConstraints: IStructuredConstraint[] = [];  // 🆕 保存多头结构化约束
    let savedAnalysisResult: Record<string, unknown> | undefined;
    let savedLifecycleResult: Record<string, unknown> | undefined;
    let savedAIConstraintDecision: Record<string, unknown> | undefined;  // 保存 AI 约束决策
    let savedRelevantCharacters: Array<{
      name: string;
      role: string;
      tier: string;
      weight: number;
      reason: string;
    }> = [];
    let savedRelevantForeshadowings: Array<{
      content: string;
      weight: number;
      reason: string;
      episodePlanted?: number;
      importance?: string;
    }> = [];
    let savedPreviousCliffhanger: string | undefined;

    const savedPreviousEpisodeContent = prevEpisodeContent || undefined;

    // 3. 获取 WorldState（如果启用）
    let generationContext: {
      formattedContext: string;
      episodePlan?: string;
      constraints: string[];
      suggestions: string[];
    } = { formattedContext: '', constraints: [], suggestions: [] };

    if (useWorldState) {
      sse.sendProgress(10, 100, '正在加载世界状态...');
      sse.sendLog(`[WorldState] 获取第${episodeNumber - 1}集状态...`);

      // 获取上一集的 WorldState
      let worldState = await worldStateManager.getWorldState(episodeNumber - 1);

      // 如果没有 WorldState，自动初始化（基于项目大纲和角色）
      if (!worldState) {
        sse.sendLog(`[WorldState] 无前置状态，正在自动初始化...`);
        sse.sendProgress(12, 100, '正在初始化世界状态...');

        try {
          // 获取项目角色
          const characters = await characterRepository.findByProject(projectId);

          // 角色库为空但大纲有人物卡时，从大纲人物卡播种初始角色（避免 ep0 初始化零角色起步）
          const outlineCards = typeof project.outline === 'object' ? project.outline?.characterCards : undefined;
          let initChars: Array<{ name: string; role: string; tier: CharacterTier; abilities?: string[]; equipment?: string[]; identity?: string; personality?: string }>;
          if (characters.length === 0 && outlineCards) {
            const parsed = parseCharacterCards(outlineCards);
            initChars = parsed.map((p) => ({
              name: p.name,
              role: p.role || p.identity || '未知',
              tier: p.type === CharacterType.MAIN ? 'core' : p.type === CharacterType.EXTRA ? 'extra' : 'recurring',
              abilities: p.abilities || [],
              equipment: p.equipment || [],
              identity: p.identity,
              personality: p.personality,
            }));
            if (initChars.length > 0) {
              sse.sendLog(`[WorldState] 角色库为空，从大纲人物卡播种 ${initChars.length} 个初始角色`);
            }
          } else {
            initChars = characters.map((c) => ({
              name: c.name,
              role: c.role || c.type || '未知',
              tier: typeToTier(c.type) as CharacterTier,
              abilities: c.initialAbilities || [],
              equipment: c.initialEquipment || [],
              identity: c.identity,
              personality: c.personality,
            }));
          }

          // 基于大纲提取初始设定
          const outlineInfo = extractOutlineInfo(project.outline);

          // 创建初始 WorldState
          worldState = await worldStateManager.initializeFromProject({
            characters: initChars,
            outline: outlineInfo,
            projectType: project.type,
          });

          sse.sendLog(`[WorldState] 初始化完成，角色数: ${worldState.characters.size}`);
        } catch (initError) {
          logGenerationError('WorldState 初始化失败', initError, '初始化 WorldState', { projectId, episodeNumber });
          sse.sendLog(`[WorldState] 初始化失败: ${(initError as Error).message}`, 'warn');
          // 初始化失败时使用空上下文继续
        }
      }

      if (worldState) {
        sse.sendLog(`[WorldState] 找到前置状态，角色数: ${worldState.characters.size}`);

        // 获取本集梗概
        const originalEpisodePlan = getEpisodePlanFromOutline(project.outline, episodeNumber);
        sse.sendLog(`[WorldState] 原始梗概: ${originalEpisodePlan.slice(0, 50)}...`);
        addLog(`获取原始梗概: ${originalEpisodePlan.slice(0, 50)}...`);

        // 动态调整梗概（融合上下文）
        sse.sendProgress(13, 100, '正在优化本集梗概...');
        sse.sendLog(`[WorldState] 正在根据上下文优化梗概...`);

        const episodePlanEnhancer = new EpisodePlanEnhancer();
        const enhanceContext: EnhanceContext = {
          originalPlan: originalEpisodePlan,
          episodeNumber,
          characterConstraints: [],
          overdueForeShadowings: [],
          warningForeshadowings: [],
          previousCliffhanger: null,
          rhythmConstraints: [],
          recentEvents: [],
        };

        // 收集角色状态约束
        worldState.characters.forEach((char) => {
          if (char.physicalCondition !== '正常' && char.tier !== 'extra') {
            enhanceContext.characterConstraints.push(
              `${char.name}当前${char.physicalCondition}`
            );
          }
        });

        // 收集伏笔信息
        worldState.foreshadowings.planted.forEach((f) => {
          const age = episodeNumber - f.episodePlanted;
          const threshold = f.importance === 'high' ? 10 : f.importance === 'normal' ? 20 : 30;
          if (age > threshold) {
            enhanceContext.overdueForeShadowings.push(f.content);
          } else if (age > threshold * 0.7) {
            enhanceContext.warningForeshadowings.push(f.content);
          }
        });

        // 获取上集悬念
        const unresolvedCliffhangers = worldState.plotState.cliffhangers.filter(c => !c.resolved);
        if (unresolvedCliffhangers.length > 0) {
          enhanceContext.previousCliffhanger = unresolvedCliffhangers[unresolvedCliffhangers.length - 1].content;
        }

        // 收集近期事件
        enhanceContext.recentEvents = worldState.plotState.recentEvents
          .slice(-3)
          .map(e => `第${e.episode}集: ${e.event}`);

        // 调用梗概优化
        let episodePlan = originalEpisodePlan;
        try {
          const enhanced = await episodePlanEnhancer.enhance(enhanceContext);
          episodePlan = enhanced.enhancedPlan;
          if (enhanced.hasSignificantChanges) {
            sse.sendLog(`[WorldState] 梗概已优化，融合${enhanced.integratedElements.length}个元素`);
            addLog(`梗概优化完成，融合元素: ${enhanced.integratedElements.join(', ')}`);
          } else {
            sse.sendLog(`[WorldState] 梗概无需调整`);
          }
        } catch (enhanceError) {
          logGenerationError('梗概优化失败', enhanceError, '优化梗概', { projectId, episodeNumber });
          sse.sendLog(`[WorldState] 梗概优化失败，使用原始梗概`, 'warn');
        }

        savedEpisodePlan = episodePlan;
        sse.sendLog(`[WorldState] 最终梗概: ${episodePlan.slice(0, 80)}...`);

        // 构建生成上下文
        sse.sendLog(`[WorldState] 正在构建生成上下文...`);
        const context = await worldStateManager.buildGenerationContext(worldState, episodePlan);

        // 获取节奏参数
        const rhythmParams = rhythmController.getParams();
        const rhythmConstraintsResult = rhythmController.generateRhythmConstraints();

        const rhythmGuidanceSuggestions = rhythmConstraintsResult.guidanceConstraints.map(
          (c) => `【节奏建议】${c}`
        );

        generationContext = {
          formattedContext: context.formattedContext,
          episodePlan: context.episodePlan,
          constraints: [
            ...context.constraints,
            ...rhythmConstraintsResult.verifiableConstraints,
          ],
          suggestions: [
            ...context.hiddenConnections,
            ...context.suggestedElements,
            ...rhythmGuidanceSuggestions,
          ],
        };

        // 构建详细的角色信息（包含权重和原因，默认权重基于角色层级）
        const relevantCharactersDetailed = (context.relevantCharacters || []).map((char) => {
          // 根据角色层级计算默认权重
          const tierWeights: Record<string, number> = {
            core: 1.0,
            recurring: 0.8,
            arc: 0.6,
            temporary: 0.4,
            extra: 0.2,
          };
          // 转换 relationships Map 为普通对象
          const relationshipsObj: Record<string, string> = {};
          if (char.relationships) {
            char.relationships.forEach((rel, target) => {
              relationshipsObj[target] = rel;
            });
          }
          return {
            name: char.name,
            role: char.role,
            tier: char.tier,
            weight: tierWeights[char.tier] || 0.5,
            reason: char.tier === 'core' ? '核心角色必定参与' : `${char.tier}级角色，可能参与本集剧情`,
            equipment: char.currentEquipment || [],
            abilities: char.currentAbilities || [],
            physicalCondition: char.physicalCondition,
            mentalCondition: char.mentalCondition,
            combatPower: char.combatPower,
            location: char.currentLocation,
            permanentMarks: char.permanentMarks || [],
            relationships: relationshipsObj,
          };
        });

        // 构建剧情状态摘要
        const plotStateSummary = worldState.plotState ? {
          currentArc: worldState.plotState.currentArc || '未知篇章',
          arcProgress: worldState.plotState.arcProgress || 0,
          mainPlotProgress: worldState.plotState.mainPlotProgress,
          pendingConflicts: worldState.plotState.pendingConflicts || [],
          recentEvents: (worldState.plotState.recentEvents || []).slice(-5),
        } : undefined;

        // 构建世界设定摘要
        const worldSettingsSummary = worldState.worldSettings ? {
          revealedSecrets: worldState.worldSettings.revealedSecrets || [],
          factions: Array.from(worldState.worldSettings.factions?.entries() || []).map(([name, f]) => ({
            name,
            status: f.status,
            attitude: f.attitude,
          })),
          locations: Array.from(worldState.worldSettings.locations?.entries() || []).slice(0, 10).map(([name, loc]) => ({
            name,
            description: loc.description,
          })),
          items: Array.from(worldState.worldSettings.items?.entries() || []).map(([name, item]) => ({
            name,
            owner: item.owner,
            status: item.status,
          })),
        } : undefined;

        // 构建相关事件（带集数信息）
        const relevantEventsFormatted = (context.relevantEvents || []).map((e) => ({
          episode: 0, // 默认，如果有具体集数会被覆盖
          content: e.content,
          weight: e.weight,
          reason: e.reason,
        }));

        // 准备并发送完整的上下文信息
        sse.sendContext({
          // 本集梗概（原始 + 优化后）
          originalEpisodePlan,
          episodePlan,
          episodePlanEnhanced: episodePlan !== originalEpisodePlan,
          constraints: generationContext.constraints,
          suggestions: generationContext.suggestions,
          relevantCharacters: relevantCharactersDetailed,
          relevantForeshadowings: context.relevantForeshadowings || [],
          relevantEvents: relevantEventsFormatted,
          hiddenConnections: context.hiddenConnections || [],
          // 剧情状态
          plotState: plotStateSummary,
          // 世界设定
          worldSettings: worldSettingsSummary,
          // 节奏设置
          rhythmSettings: {
            preset: rhythmController.getCurrentPreset(),
            coolPointDensity: rhythmParams.coolPointDensity,
            plotTwistInterval: rhythmParams.plotTwistFrequency,
            faceSlapInterval: rhythmParams.faceSlappingFrequency,
          },
          // 写作风格
          writingStyle: writingStyleConfig ? {
            preset: writingStyleConfig.preset,
            presetName: STYLE_NAMES[writingStyleConfig.preset] || writingStyleConfig.preset,
            customDescription: writingStyleConfig.customDescription,
          } : undefined,
          previousCliffhanger: context.previousCliffhanger,
          // 发送格式化的世界状态信息（完整的上下文文本）
          formattedContext: generationContext.formattedContext,
        });

        // 保存上下文数据用于日志持久化
        savedRelevantCharacters = relevantCharactersDetailed.map(c => ({
          name: c.name,
          role: c.role,
          tier: c.tier,
          weight: c.weight,
          reason: c.reason,
        }));
        savedRelevantForeshadowings = (context.relevantForeshadowings || []).map(f => ({
          content: f.content,
          weight: f.weight,
          reason: (f as { reason?: string }).reason || '',
          episodePlanted: (f as { episodePlanted?: number }).episodePlanted,
          importance: (f as { importance?: string }).importance,
        }));
        savedPreviousCliffhanger = context.previousCliffhanger || undefined;

        sse.sendLog(`[WorldState] 上下文构建完成`);
        sse.sendLog(`  - 约束条数: ${generationContext.constraints.length}`);
        sse.sendLog(`  - 建议条数: ${generationContext.suggestions.length}`);
        sse.sendLog(`  - 相关角色: ${relevantCharactersDetailed.length}个`);
        // 详细记录角色权重
        relevantCharactersDetailed.slice(0, 5).forEach((c) => {
          sse.sendLog(`    · ${c.name}(${c.role}) [${c.tier}] 权重:${c.weight.toFixed(1)}`);
        });
        if (relevantCharactersDetailed.length > 5) {
          sse.sendLog(`    · ...及其他${relevantCharactersDetailed.length - 5}个角色`);
        }
        sse.sendLog(`  - 相关伏笔: ${(context.relevantForeshadowings || []).length}个`);
        // 详细记录伏笔
        (context.relevantForeshadowings || []).slice(0, 3).forEach((f) => {
          sse.sendLog(`    · [权重:${f.weight.toFixed(1)}] ${f.content.slice(0, 30)}...`);
        });
        if ((context.hiddenConnections || []).length > 0) {
          sse.sendLog(`  - 隐藏关联: ${context.hiddenConnections.length}个`);
        }
        // 记录节奏设置
        sse.sendLog(`[节奏设置] 预设: ${rhythmController.getCurrentPreset()}`);
        sse.sendLog(`  - 爽点密度: ${rhythmParams.coolPointDensity}个/集`);
        sse.sendLog(`  - 打脸频率: 每${rhythmParams.faceSlappingFrequency}集`);
        sse.sendLog(`  - 反转频率: 每${rhythmParams.plotTwistFrequency}集`);
        if (context.previousCliffhanger) {
          sse.sendLog(`[上集悬念] ${context.previousCliffhanger.slice(0, 50)}...`);
        }

        console.log(`[WorldState] 第${episodeNumber}集上下文构建完成`);
        console.log(`  - 约束条数: ${generationContext.constraints.length}`);
        console.log(`  - 建议条数: ${generationContext.suggestions.length}`);

        // 2.5 多头注意力分析（可选：增强分析深度）
        sse.sendProgress(15, 100, '正在执行多头注意力分析...');
        sse.sendLog(`[多头注意力] 开始分析...`);
        try {
          const multiHeadResult = await attentionSystem.analyzeWithMultiHead(episodePlan, worldState, savedPreviousEpisodeContent);  // 🆕 传入上一集内容

          // 发送多头分析结果
          sse.sendMultiHeadAnalysis({
            enabledHeads: attentionSystem.getEnabledHeads(),
            headResults: multiHeadResult.headResults.map((r) => ({
              headType: r.headType,
              insights: r.insights.slice(0, 3),
              suggestions: r.suggestions.slice(0, 3),
              constraints: r.constraints,
              warnings: r.warnings,
            })),
            crossDimensionInsights: multiHeadResult.crossDimensionInsights,
            aggregatedConstraints: multiHeadResult.aggregatedConstraints.map(c => c.content),  // 🆕 转换为字符串
            aggregatedSuggestions: multiHeadResult.aggregatedSuggestions,
          });

          // 保存多头注意力分析结果用于日志
          savedMultiHeadAnalysis = {
            enabledHeads: attentionSystem.getEnabledHeads(),
            headResults: multiHeadResult.headResults.map((r) => ({
              headType: r.headType,
              insights: r.insights,
              suggestions: r.suggestions,
              constraints: r.constraints,
              warnings: r.warnings,
            })),
            crossDimensionInsights: multiHeadResult.crossDimensionInsights,
            aggregatedConstraints: multiHeadResult.aggregatedConstraints.map(c => c.content),  // 🆕 转换为字符串
            aggregatedSuggestions: multiHeadResult.aggregatedSuggestions,
          };
          addLog(`多头注意力分析完成，启用${attentionSystem.getEnabledHeads().length}个注意力头`);

          // 🆕 保存多头结构化约束（供后续验证使用）
          savedMultiHeadConstraints = multiHeadResult.aggregatedConstraints;

          // 将多头分析的约束和建议合并到生成上下文（按严重度打标+去重，
          // 让生成模型在长约束列表中优先分配注意力给关键项）
          const sevTag = (s: string) => (s === 'critical' ? '【关键】' : s === 'important' ? '【重要】' : '');
          const seenKeys = new Set(
            generationContext.constraints.map(c => (c || '').replace(/【[^】]*】/g, '').replace(/\s+/g, '').replace(/[，。；：""'']/g, ''))
          );
          const newHeadConstraints = multiHeadResult.aggregatedConstraints
            .filter(c => {
              const key = (c.content || '').replace(/【[^】]*】/g, '').replace(/\s+/g, '').replace(/[，。；：""'']/g, '');
              if (seenKeys.has(key)) return false;
              seenKeys.add(key);
              return true;
            })
            .map(c => `${sevTag(c.severity)}${c.content}`);
          generationContext.constraints = [
            ...generationContext.constraints,
            ...newHeadConstraints,
          ];
          generationContext.suggestions = [
            ...generationContext.suggestions,
            ...multiHeadResult.aggregatedSuggestions,
          ];

          sse.sendLog(`[多头注意力] 分析完成`);
          sse.sendLog(`  - 启用头数: ${attentionSystem.getEnabledHeads().length}`);
          sse.sendLog(`  - 跨维度洞察: ${multiHeadResult.crossDimensionInsights.length}个`);
          sse.sendLog(`  - 新增约束: ${multiHeadResult.aggregatedConstraints.length}个`);
          sse.sendLog(`  - 新增建议: ${multiHeadResult.aggregatedSuggestions.length}个`);

          // 🆕 记录多头约束分类
          const criticalCount = multiHeadResult.aggregatedConstraints.filter(c => c.severity === 'critical').length;
          const verifiableCount = multiHeadResult.aggregatedConstraints.filter(c => c.category === 'verifiable').length;
          sse.sendLog(`  - Critical约束: ${criticalCount}个, 可验证约束: ${verifiableCount}个`);

          // 记录各头的关键警告
          for (const headResult of multiHeadResult.headResults) {
            if (headResult.warnings.length > 0) {
              sse.sendLog(`  ⚠️ [${headResult.headType}] ${headResult.warnings[0]}`, 'warn');
            }
          }
        } catch (multiHeadError) {
          logGenerationError('多头注意力分析失败', multiHeadError, '多头注意力分析', { projectId, episodeNumber });
          sse.sendLog(`[多头注意力] 分析失败，使用基础上下文继续`, 'warn');
        }
      } else {
        sse.sendLog(`[WorldState] 无前置状态，使用默认上下文`, 'warn');
        console.log(`[WorldState] 第${episodeNumber}集无前置状态，使用默认上下文`);
      }
    }

    sse.sendProgress(20, 100, '正在生成剧本...');
    sse.sendLog(`[AI] 开始生成剧本内容...`);

    // 3. 获取角色信息
    const characters = await characterRepository.findByProject(projectId);

    // 3.5 获取角色增强数据
    const { charmContext: characterCharmContext, arcContext: characterArcContext, voiceContext: characterVoiceContext } =
      await loadCharacterEnhancements(projectId, sse, addLog);

    // 初始化约束验证器
    const constraintValidator = new ConstraintValidator(aiClient, 2);

    // 收集所有约束（用于验证）
    let collectedConstraints: Constraint[] = [];

    // 从 context 中收集相关伏笔信息（需要在 useWorldState 块中已构建）
    // 这里在生成前需要获取 context 相关数据
    // 由于 context 在上面的 if(worldState) 中构建，需要保存引用
    interface ForeshadowingForValidation {
      content: string;
      weight: number;
      episodePlanted?: number;
      importance?: string;
    }
    let relevantForeshadowingsForValidation: ForeshadowingForValidation[] = [];
    let previousCliffhangerForValidation: string | null = null;
    let characterStateConstraints: Array<{ name: string; condition: string }> = [];
    let rhythmConstraintResult: RhythmConstraintResult = { verifiableConstraints: [], guidanceConstraints: [] };

    // 如果使用了 WorldState，收集约束信息
    if (useWorldState) {
      // ===== V3: 使用 UnifiedConstraintManager 统一处理所有约束 =====
      // 替代原来分散的硬编码规则，让 AI 基于剧情语义做出灵活决策
      sse.sendProgress(17, 100, '正在执行 AI 约束决策...');
      sse.sendLog(`[UnifiedConstraintManager] 开始 AI 统一约束决策...`);

      try {
        // 获取 worldState 用于构建上下文
        const wsForConstraints = await worldStateManager.getWorldState(episodeNumber - 1);

        // 构建统一约束上下文
        const unifiedConstraintContext: UnifiedConstraintContext = {
          projectId,
          projectName: project.name,
          projectType: project.type || '未知',
          currentEpisode: episodeNumber,
          totalEpisodes: project.totalEpisodes,
          episodePlan: savedEpisodePlan || `第${episodeNumber}集`,
          worldState: wsForConstraints,
          rhythmTracking: {
            lastFaceSlap: rhythmController.toJSON().tracking.lastFaceSlap,
            lastPlotTwist: rhythmController.toJSON().tracking.lastPlotTwist,
            lastBoss: rhythmController.toJSON().tracking.lastBoss,
          },
          userPreferences: {
            rhythmPreset: rhythmController.getCurrentPreset(),
            rhythmParams: rhythmController.getParams(),
          },
          // 传入多头注意力分析的洞察（如果有）
          multiHeadInsights: savedMultiHeadAnalysis
            ? (savedMultiHeadAnalysis.crossDimensionInsights as string[] || [])
            : undefined,
        };

        // 创建统一约束管理器并调用 AI 决策
        const unifiedConstraintManager = new UnifiedConstraintManager(
          aiClient,
          (msg, level) => sse.sendLog(msg, level)
        );

        const { decision, constraints: unifiedConstraints } = await unifiedConstraintManager.analyzeAndDecide(unifiedConstraintContext);

        // 保存 AI 约束决策用于日志持久化
        savedAIConstraintDecision = {
          rhythm: decision.rhythm,
          foreshadowing: {
            mustResolveCount: decision.foreshadowing.mustResolve.length,
            canResolveCount: decision.foreshadowing.canResolve.length,
            shouldIgnoreCount: decision.foreshadowing.shouldIgnore.length,
            mustResolve: decision.foreshadowing.mustResolve,
          },
          cliffhanger: decision.cliffhanger,
          characterStatesCount: decision.characterStates.length,
          worldConsistencyCount: decision.worldConsistency.length,
          summary: decision.summary,
        };

        const statsForSSE = countConstraintStats(unifiedConstraints as Constraint[]);

        // 发送 AI 约束决策到前端
        sse.sendAIConstraintDecision({
          rhythm: {
            ...decision.rhythm,
            guidanceNotes: decision.rhythm.guidanceNotes || [],
          },
          foreshadowing: {
            mustResolveCount: decision.foreshadowing.mustResolve.length,
            canResolveCount: decision.foreshadowing.canResolve.length,
            shouldIgnoreCount: decision.foreshadowing.shouldIgnore.length,
            mustResolve: decision.foreshadowing.mustResolve.map((f, idx) => ({
              id: `fore-${idx}`,
              content: f.content,
              reason: f.reason,
              urgency: f.priority >= 80 ? 'critical' : (f.priority >= 60 ? 'high' : 'medium'),
              // 🆕 新增结构化字段
              episodePlanted: f.episodePlanted,
              originalHint: f.originalHint,
              methodology: f.methodology || [],
              validationCriteria: f.validationCriteria || [],
            })),
            canResolve: decision.foreshadowing.canResolve,
            shouldIgnore: decision.foreshadowing.shouldIgnore,
          },
          cliffhanger: {
            mustContinue: decision.cliffhanger?.mustAddress || false,
            content: decision.cliffhanger?.content || null,
            reason: decision.cliffhanger?.howToAddress || '',
          },
          characterStatesCount: decision.characterStates.length,
          characterStates: decision.characterStates,
          worldConsistencyCount: decision.worldConsistency.length,
          worldConsistency: decision.worldConsistency,
          summary: decision.summary,
          stats: {
            totalConstraints: unifiedConstraints.length,
            verifiableCount: statsForSSE.verifiableCount,
            guidanceCount: statsForSSE.guidanceCount,
            criticalCount: statsForSSE.criticalCount,
            importantCount: statsForSSE.importantCount,
          },
        });

        // 将统一约束转换为 Constraint 格式（供验证器使用）- 🆕 包含结构化字段
        collectedConstraints = unifiedConstraints.map(uc => ({
          id: uc.id,
          type: uc.type as Constraint['type'],
          content: uc.content,
          severity: uc.severity,
          source: uc.source,
          context: uc.context,
          category: uc.category,
          // 🆕 结构化字段
          subject: uc.subject,
          object: uc.object,
          methodology: uc.methodology,
          validationCriteria: uc.validationCriteria,
          episodePlanted: uc.episodePlanted,
          originalHint: uc.originalHint,
        }));

        // 🆕 将多头注意力约束合并到 collectedConstraints（用于验证）
        if (savedMultiHeadConstraints.length > 0) {
          // Harness：文本不可判定的拍摄层要求（镜头秒数/帧数/构图/机位）降级为指导性约束——
          // 保留生成指导价值，但不参与评分，杜绝"镜头须持续两秒"类幻影违规（实测出现）
          // 中文数字/范围同样不可判定（"影子停七秒""特写三秒""1-2镜头"实测漏网）
          const UNVERIFIABLE_RE = /(镜头|画面|特写|慢镜头)(持续|停留|长达|保持)|(?:至少|不少于|超过|持续|停留|长达|约)?\s*[0-9一二三四五六七八九十两]+\s*(?:秒|帧)|[0-9]+\s*[-~～—]\s*[0-9]+\s*镜头|构图|机位|运镜|景别/;
          // 逐字/关键词硬性要求——技术上可判定但几乎不可满足（"含'替我'""三关键词""完全一致"），
          // 降级为指导性：保留意图进生成提示，不作为通过/否决条件
          const VERBATIM_RE = /含['"「『][^'"」』]{1,30}['"」』]|完全一致|逐字|原话复现|关键词/;
          let downgraded = 0;
          const multiHeadConstraintsForValidation: Constraint[] = savedMultiHeadConstraints
            .filter(c => c.category === 'verifiable')  // 只验证 verifiable 类型
            .map((c, idx) => ({
              id: `multihead-${idx + 1}`,
              type: 'continuity' as Constraint['type'],  // 默认类型
              content: c.content,
              severity: c.severity,
              source: `multihead-${c.headType}`,
              context: `来自${c.headCategory}类注意力头 (权重: ${c.headWeight.toFixed(1)})`,
              category: c.category,
            }));
          for (const c of multiHeadConstraintsForValidation) {
            if (UNVERIFIABLE_RE.test(c.content || '') || VERBATIM_RE.test(c.content || '')) {
              c.category = 'guidance';
              downgraded++;
            }
          }
          if (downgraded > 0) {
            sse.sendLog(`[可验证性过滤] ${downgraded} 条拍摄层要求降级为指导性约束（不参与评分）`);
          }
          // 按归一化内容去重（多头约束常与AI决策约束语义重复，重复条目空耗验证预算）
          // 升级版：字面去重 + bigram Jaccard 相似度去重（实测"'替我'要求"同义改写×3穿透字面去重）
          const norm = (s: string) => (s || '').replace(/\s+/g, '').replace(/[，。；：""''『』【】（）()《》]/g, '');
          const bigramsOf = (s: string) => {
            const t = norm(s);
            const set = new Set<string>();
            for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
            return set;
          };
          const jaccard = (a: Set<string>, b: Set<string>) => {
            let inter = 0;
            for (const x of a) if (b.has(x)) inter++;
            return inter / (a.size + b.size - inter || 1);
          };
          const seen = new Set(collectedConstraints.map(c => norm(c.content || '')));
          const seenGrams = collectedConstraints.map(c => bigramsOf(c.content || ''));
          const deduped = multiHeadConstraintsForValidation.filter(c => {
            const key = norm(c.content || '');
            if (seen.has(key)) return false;
            const g = bigramsOf(c.content || '');
            if (g.size > 0 && seenGrams.some(sg => sg.size > 0 && jaccard(g, sg) > 0.55)) return false;
            seen.add(key);
            seenGrams.push(g);
            return true;
          });
          const dupCount = multiHeadConstraintsForValidation.length - deduped.length;

          collectedConstraints = [
            ...collectedConstraints,
            ...deduped,
          ];

          sse.sendLog(`[多头约束] 合并 ${deduped.filter(c => c.category === 'verifiable').length} 个可验证约束到验证队列${dupCount > 0 ? `（去重剔除${dupCount}条重复）` : ''}`);
        }

        // 🆕 海外格式：注入格式审查约束集，由 AI 验证器对全文语义判定（非机械正则）
        const methodologyAuditEnabled = project.outputFormat?.enableNarrativeMethodology
          ?? (project.outputFormat?.preset === 'overseas_drama');
        if (methodologyAuditEnabled && project.outputFormat?.preset === 'overseas_drama') {
          const auditConstraints = buildOverseasFormatAuditConstraints(
            outputFormatService.resolveConfig(project.outputFormat).wordLimit?.max,
          );
          collectedConstraints = [...collectedConstraints, ...auditConstraints];
          sse.sendLog(`[格式审查] 注入 ${auditConstraints.length} 项 AI 审查约束（语义判定）`);
        }

        // 单集起伏约束（国内海外通用，AI 语义判定）——与回退路径共用同一构造
        const tensionConstraints = buildEpisodeTensionConstraints(episodeNumber);
        collectedConstraints = [...collectedConstraints, ...tensionConstraints];
        sse.sendLog(`[单集起伏] 注入 ${tensionConstraints.length} 项 AI 审查约束（语义判定）`);

        // 同时更新 generationContext.constraints 用于剧本生成
        // 将 AI 决策的约束添加到生成上下文中
        const aiConstraintStrings = unifiedConstraints
          .filter(c => c.category === 'verifiable')
          .map(c => `${c.severity === 'critical' ? '【关键】' : c.severity === 'important' ? '【重要】' : ''}${c.content}`);
        const aiGuidanceStrings = unifiedConstraints
          .filter(c => c.category === 'guidance')
          .map(c => c.content);

        // 替换原有的约束（移除旧的节奏约束和伏笔约束），并与已有多头约束去重
        const keptContextConstraints = generationContext.constraints.filter(c =>
          !c.includes('【节奏约束') &&
          !c.includes('【节奏建议') &&
          !c.includes('【伏笔约束') &&
          !c.includes('【悬念约束') &&
          !c.includes('【状态约束')
        );
        const ctxSeenKeys = new Set(
          keptContextConstraints.map(c => (c || '').replace(/【[^】]*】/g, '').replace(/\s+/g, '').replace(/[，。；：""'']/g, ''))
        );
        const dedupedAiConstraints = aiConstraintStrings.filter(s => {
          const key = s.replace(/【[^】]*】/g, '').replace(/\s+/g, '').replace(/[，。；：""'']/g, '');
          if (ctxSeenKeys.has(key)) return false;
          ctxSeenKeys.add(key);
          return true;
        });
        generationContext.constraints = [
          ...keptContextConstraints,
          ...dedupedAiConstraints,
        ];
        generationContext.suggestions = [
          ...generationContext.suggestions,
          ...aiGuidanceStrings.map(c => `【指导性约束】${c}`),
        ];

        sse.sendLog(`[UnifiedConstraintManager] AI 约束决策完成`);
        sse.sendLog(`  - 摘要: ${decision.summary}`);
        const logStats = countConstraintStats(collectedConstraints);
        sse.sendLog(`  - Critical: ${logStats.criticalCount}, Important: ${logStats.importantCount}`);
        sse.sendLog(`  - 可验证: ${logStats.verifiableCount}, 指导性: ${logStats.guidanceCount} (指导性约束不参与验证)`);

        // 记录节奏决策详情
        if (decision.rhythm.faceSlap.needed) {
          sse.sendLog(`  - 打脸: ${decision.rhythm.faceSlap.urgency} - ${decision.rhythm.faceSlap.reason.slice(0, 50)}...`);
        }
        if (decision.rhythm.plotTwist.needed) {
          sse.sendLog(`  - 反转: ${decision.rhythm.plotTwist.urgency} - ${decision.rhythm.plotTwist.reason.slice(0, 50)}...`);
        }
        if (decision.rhythm.boss.needed) {
          sse.sendLog(`  - Boss: ${decision.rhythm.boss.urgency} - ${decision.rhythm.boss.reason.slice(0, 50)}...`);
        }

      } catch (ucmError) {
        logGenerationError('AI 约束决策失败', ucmError, 'UnifiedConstraintManager.analyzeAndDecide', { projectId, episodeNumber });
        sse.sendLog(`[UnifiedConstraintManager] AI 约束决策失败，使用回退方式: ${(ucmError as Error).message}`, 'warn');

        // ===== 回退到旧的约束收集方式 =====
        // 注意：使用外层已声明的变量，不要重复声明
        rhythmConstraintResult = rhythmController.generateRhythmConstraints();
        const allRhythmConstraints = [
          ...rhythmConstraintResult.verifiableConstraints,
          ...rhythmConstraintResult.guidanceConstraints,
        ];
        const worldStateConstraintsForValidation = generationContext.constraints.filter(
          (c) => !allRhythmConstraints.includes(c)
        );

        const wsForValidation = await worldStateManager.getWorldState(episodeNumber - 1);
        // 重置外层变量（不要重新声明）
        previousCliffhangerForValidation = null;
        characterStateConstraints = [];
        relevantForeshadowingsForValidation = [];

        if (wsForValidation) {
          const unresolvedCliffhangers = wsForValidation.plotState?.cliffhangers?.filter(
            (c) => !c.resolved
          ) || [];
          if (unresolvedCliffhangers.length > 0) {
            previousCliffhangerForValidation = unresolvedCliffhangers[unresolvedCliffhangers.length - 1].content;
          }

          wsForValidation.characters.forEach((char) => {
            if (char.physicalCondition !== '正常' && char.tier !== 'extra') {
              characterStateConstraints.push({
                name: char.name,
                condition: char.physicalCondition,
              });
            }
            if (char.mentalCondition !== '正常' && char.tier !== 'extra') {
              characterStateConstraints.push({
                name: char.name,
                condition: `精神状态：${char.mentalCondition}`,
              });
            }
          });

          relevantForeshadowingsForValidation = (wsForValidation.foreshadowings?.planted || []).map((f) => ({
            content: f.content,
            weight: 0.5,
            episodePlanted: f.episodePlanted,
            importance: f.importance,
          }));
        }

        collectedConstraints = collectAllConstraints({
          rhythmVerifiableConstraints: rhythmConstraintResult.verifiableConstraints,
          rhythmGuidanceConstraints: rhythmConstraintResult.guidanceConstraints,
          worldStateConstraints: worldStateConstraintsForValidation,
          relevantForeshadowings: relevantForeshadowingsForValidation,
          previousCliffhanger: previousCliffhangerForValidation,
          characterStateConstraints,
          currentEpisode: episodeNumber,
          enableNarrativeMethodology: project.outputFormat?.enableNarrativeMethodology,
          outputFormatPreset: project.outputFormat?.preset,
          outputFormatWordLimitMax: project.outputFormat?.preset
            ? outputFormatService.resolveConfig(project.outputFormat).wordLimit?.max
            : undefined,
        });

        sse.sendLog(`[约束系统-回退] 收集到 ${collectedConstraints.length} 个约束`);
      }
    }

    // ========== 生成与验证循环 ==========
    // 获取上一集完整内容（用于保持信息一致性）
    const previousEpisodeContent = prevEpisodeContent || '';
    if (previousEpisodeContent) {
      sse.sendLog(`[上下文] 已加载第${episodeNumber - 1}集内容作为事实参考（${previousEpisodeContent.length}字）`);
    }

    // 海外格式启用机械闸门（归一化+确定性扫描），重试反馈更精确，允许 3 次尝试；其他格式保持 2 次
    const isOverseasFmt = project.outputFormat?.preset === 'overseas_drama';
    const MAX_ATTEMPTS = isOverseasFmt ? 3 : 2;
    let currentAttempt = 1;
    let finalContent = '';
    let validationPassed = false;
    let lastValidation: ValidationResponse | null = null;
    let currentConstraints = collectedConstraints;
    let firstGenerationContent = '';  // 保存第一次生成的内容，用于改写模式
    // 历史最优结果：达到最大尝试次数时保留满足率最高的一版，而非最后一次
    let bestContent = '';
    let bestRate = -1;
    let bestValidation: ValidationResponse | null = null;
    // —— Harness 层状态：机械违规（海外格式确定性扫描）——
    let lastMechViolations: OverseasScanViolation[] = [];  // 上一次的机械违规（用于重试反馈）
    const mechScore = (v: OverseasScanViolation[]) => ({
      imp: v.filter(x => x.severity === 'important').length,
      nor: v.length - v.filter(x => x.severity === 'important').length,
    });
    // 双轨裁决：机械违规数（重要→一般）优先，其次语义满足率
    type TrackScore = { imp: number; nor: number; rate: number };
    const isBetterScore = (a: TrackScore, b: TrackScore) =>
      a.imp < b.imp || (a.imp === b.imp && (a.nor < b.nor || (a.nor === b.nor && a.rate > b.rate)));
    let bestScore: TrackScore = { imp: Number.MAX_SAFE_INTEGER, nor: Number.MAX_SAFE_INTEGER, rate: -1 };
    let lastScore: TrackScore = { imp: Number.MAX_SAFE_INTEGER, nor: Number.MAX_SAFE_INTEGER, rate: -1 };

    // 4. 生成剧本（带验证重试）
    const generateWithValidation = async (
      referenceContent?: string,
      retryMode?: boolean
    ): Promise<string> => {
      return scriptService.generateScript(
        {
          projectName: project.name,
          genre: project.genre,
          type: project.type,
          episodeNumber,
          totalEpisodes: project.totalEpisodes,
          outline: getOutlineRaw(project.outline),
          episodePlan: generationContext.episodePlan,
          characters: characters.map((c) => ({
            name: c.name,
            nameCn: c.nameCn,
            identity: c.identity,
            personality: c.personality,
            appearance: c.appearance,
          })),
          worldStateContext: generationContext.formattedContext,
          constraints: generationContext.constraints,
          suggestions: generationContext.suggestions,
          // 写作风格参数
          writingStyle: writingStyleConfig ? {
            preset: writingStyleConfig.preset,
            customDescription: writingStyleConfig.customDescription,
          } : undefined,
          // 🆕 角色增强参数
          characterCharm: characterCharmContext,
          characterArc: characterArcContext,
          characterVoice: characterVoiceContext,
          // 🆕 上一集完整内容（用于保持信息一致性）
          previousEpisodeContent,
          // 重试参数
          referenceContent,
          retryMode,
          // 输出格式配置
          outputFormatConfig: project.outputFormat,
          // 外层已有验证闭环，关闭内部反思循环
          enableInternalReflexion: false,
        },
        {
          onChunk: (text) => {
            if (!sse.isClosed()) {
              sse.sendChunk(text);
            }
          },
          onLog: (message, level) => {
            if (!sse.isClosed()) {
              sse.sendLog(message, level);
            }
          },
        }
      );
    };

    // 主生成循环
    while (currentAttempt <= MAX_ATTEMPTS && !validationPassed) {
      checkAbort();
      if (currentAttempt > 1) {
        sse.sendProgress(25, 100, `正在重新生成剧本（第${currentAttempt}次尝试，改写模式）...`);
        sse.sendLog(`[约束验证] 约束未满足，开始第${currentAttempt}次生成尝试（改写模式）...`, 'warn');

        // 强化未满足的约束 - 增强版：包含详细的修正指令
        if (lastValidation) {
          const severityRank: Record<string, number> = { critical: 0, important: 1, normal: 2 };
          // 实测：20条修正指令会稀释模型注意力导致重试分数随机游走；海外收紧到12条聚焦 critical/important
          const MAX_CORRECTIONS = isOverseasFmt ? 12 : 20;
          const allUnfulfilled = lastValidation.results
            .filter((r) => !r.fulfilled)
            .sort((a, b) => (severityRank[a.severity] ?? 2) - (severityRank[b.severity] ?? 2));
          const unfulfilledResults = allUnfulfilled.slice(0, MAX_CORRECTIONS);
          const omittedCount = allUnfulfilled.length - unfulfilledResults.length;

          // 🆕 构建详细的修正指令，让 AI 明确知道哪里错了、应该怎么改
          const detailedCorrections = unfulfilledResults.map((r, idx) => {
            let correction = `\n【第${idx + 1}个必须修正的问题】`;
            correction += `\n约束内容：${r.constraintContent || '未知约束'}`;
            correction += `\n严重程度：${r.severity === 'critical' ? '🔴 关键（必须修正）' : r.severity === 'important' ? '🟠 重要' : '🟡 一般'}`;

            // 添加错误内容（如果验证器提取到了具体错误）
            if (r.evidence) {
              correction += `\n❌ 错误内容：「${r.evidence}」`;
            }

            // 添加问题分析
            if (r.reasoning) {
              correction += `\n问题分析：${r.reasoning}`;
            }

            // 添加修正建议
            if (r.suggestions && r.suggestions.length > 0) {
              correction += `\n✅ 修正要求：`;
              r.suggestions.forEach((s, i) => {
                correction += `\n   ${i + 1}. ${s}`;
              });
            }

            // 从原始约束中获取验证标准
            const originalConstraint = currentConstraints.find(c => c.id === r.constraintId);
            if (originalConstraint?.validationCriteria && originalConstraint.validationCriteria.length > 0) {
              correction += `\n验证标准（本次生成必须同时满足）：`;
              originalConstraint.validationCriteria.forEach((vc) => {
                correction += `\n   ✓ ${vc}`;
              });
            }

            return correction;
          }).join('\n');

          // 🆕 构建禁止使用列表（基于上次的错误内容）
          const forbiddenContent = unfulfilledResults
            .filter(r => r.evidence)
            .map(r => `- ${r.evidence}`)
            .join('\n');
          const omittedNote = omittedCount > 0
            ? `\n【其余${omittedCount}项低优先级违规】本次暂不逐条列出，生成时一并规避同类问题。`
            : '';

          // 强化约束对象
          currentConstraints = constraintValidator.strengthenConstraints(
            currentConstraints,
            unfulfilledResults
          );

          // 🆕 更新 generationContext 的约束，添加详细修正指令
          generationContext.constraints = [
            ...generationContext.constraints.filter(c => c && !c.includes('【必须修正') && !c.includes('【必须满足】') && !c.includes('===== 修正指令')),
            `\n===== 第${currentAttempt}次尝试：以下问题必须修正 =====${detailedCorrections}${omittedNote}\n${forbiddenContent ? `\n【禁止使用】以下内容导致上次验证失败，本次生成必须避免：\n${forbiddenContent}` : ''}\n===== 修正指令结束 =====\n`,
          ];

          // 记录详细的修正日志
          sse.sendLog(`[约束强化] 构建了 ${unfulfilledResults.length} 个详细修正指令`);
          unfulfilledResults.forEach((r, idx) => {
            sse.sendLog(`  ${idx + 1}. ${r.constraintContent?.slice(0, 50) || '未知'}...`);
            if (r.evidence) {
              sse.sendLog(`     ❌ 错误: ${r.evidence.slice(0, 50)}...`, 'warn');
            }
          });

          // 发送重试通知（增强版）
          sse.sendRetryNotification({
            attemptNumber: currentAttempt,
            maxAttempts: MAX_ATTEMPTS,
            reason: lastValidation.summary,
            strengthenedConstraints: unfulfilledResults.map((r) => r.constraintContent),
          });
        }

        // Harness：机械违规修正指令——独立于语义验证，每次重试都附带具体行号级反馈。
        // 标题含"修正指令"，下次重试时会被上方 filter 一并清除，避免跨轮累积。
        if (lastMechViolations.length > 0) {
          generationContext.constraints = generationContext.constraints.filter(
            c => c && !c.includes('===== 修正指令（机械格式违规')
          );
          generationContext.constraints.push(
            `\n===== 修正指令（机械格式违规，全部必须修正）=====\n` +
            lastMechViolations.map((v, i) =>
              `${i + 1}. 【${v.severity === 'important' ? '重要' : '一般'}】${v.content}\n   命中：${v.evidence}\n   改法：${v.suggestion}`
            ).join('\n') +
            `\n===== 修正指令结束 =====\n`
          );
          sse.sendLog(`[机械闸门] 重试附带 ${lastMechViolations.length} 条格式修正指令`, 'warn');
        }
      }

      try {
        // 生成剧本（重试时传入第一次生成的内容作为参考）
        const isRetry = currentAttempt > 1;
        const rawContent = await generateWithValidation(
          isRetry ? firstGenerationContent : undefined,
          isRetry
        );
        checkAbort();

        // 检测空内容，强制重试
        if (!rawContent || rawContent.trim().length < 100) {
          console.error(`[生成] 第${currentAttempt}次尝试返回空内容或内容过短 (${rawContent?.length || 0}字)`);
          sse.sendLog(`[生成] 内容生成失败或过短，将重试...`, 'warn');
          if (currentAttempt < MAX_ATTEMPTS) {
            currentAttempt++;
            continue;
          } else {
            throw new Error('剧本生成失败：多次尝试后仍无法获取有效内容');
          }
        }

        // —— Harness 层（海外）：先归一化（自动修可修的排版漂移），再对归一化文本跑确定性机械扫描。
        // 验证对象与最终落库文本一致；命中 important 级违规即判本次 attempt 机械失败
        const content = isOverseasFmt ? normalizeOverseasScript(rawContent) : rawContent;
        lastMechViolations = isOverseasFmt
          ? (() => { const f = outputFormatService.resolveConfig(project.outputFormat); return scanOverseasScript(content, f.wordLimit?.max, f.sceneLimit?.max); })()
          : [];
        const mech = mechScore(lastMechViolations);
        const mechFailed = mech.imp > 0;
        if (lastMechViolations.length > 0) {
          sse.sendLog(
            `[机械闸门] 格式扫描命中 ${lastMechViolations.length} 项（重要${mech.imp}/一般${mech.nor}）：` +
            lastMechViolations.slice(0, 3).map(v => v.content.slice(0, 24)).join(' | '),
            mechFailed ? 'warn' : 'info'
          );
        }
        lastScore = { imp: mech.imp, nor: mech.nor, rate: -1 };

        // 保存第一次生成的内容
        if (currentAttempt === 1) {
          firstGenerationContent = content;
        }

        // 验证约束（只有在有约束时才验证）
        if (currentConstraints.length > 0) {
          sse.sendProgress(60, 100, '正在验证约束满足情况...');
          sse.sendLog(`[约束验证] 开始验证 ${currentConstraints.length} 个约束...`);

          // 可验证约束预算控制：防止约束膨胀稀释验证器注意力
          const { capped: validationSet, dropped: droppedNormal } = capVerifiableConstraints(currentConstraints);
          if (droppedNormal > 0) {
            sse.sendLog(`[约束验证] 预算控制：${currentConstraints.length}→${validationSet.length}（${droppedNormal} 条 normal 级超额，仅作生成指导不参与本次评分）`, 'warn');
          }

          const validation = await constraintValidator.validateConstraints(content, validationSet);
          checkAbort();

          // —— Harness：机械违规并入验证结果（污染控制：不计入 satisfactionRate——语义指标保持纯净；
          // 计入违规计数、SSE 与重试修正指令。机械重要违规同时拉低 overallSatisfied 以触发闸门）
          if (lastMechViolations.length > 0) {
            validation.results.push(...lastMechViolations.map((v, i) => ({
              constraintId: `overseas-scan-${i}`,
              constraintType: 'methodology' as const,
              constraintContent: v.content,
              fulfilled: false,
              confidence: 1.0,
              evidence: v.evidence,
              reasoning: '确定性正则扫描命中',
              severity: v.severity,
              suggestions: [v.suggestion],
            })));
            validation.criticalViolations = validation.results.filter(r => !r.fulfilled && r.severity === 'critical').length;
            validation.importantViolations = validation.results.filter(r => !r.fulfilled && r.severity === 'important').length;
            validation.normalViolations = validation.results.filter(r => !r.fulfilled && r.severity === 'normal').length;
            if (mechFailed) validation.overallSatisfied = false;
          }

          lastValidation = validation;
          lastScore.rate = validation.satisfactionRate;

          // 双轨择优：机械违规数（重要→一般）优先，其次语义满足率
          if (isBetterScore(lastScore, bestScore)) {
            bestScore = { ...lastScore };
            bestRate = validation.satisfactionRate;
            bestContent = content;
            bestValidation = validation;
          }

          // 发送验证结果
          sse.sendConstraintValidation({
            ...validation,
            retryInfo: currentAttempt < MAX_ATTEMPTS && !validation.overallSatisfied
              ? {
                attemptNumber: currentAttempt,
                maxAttempts: MAX_ATTEMPTS,
                reason: validation.summary,
              }
              : undefined,
          });

          sse.sendLog(`[约束验证] 验证完成`);
          sse.sendLog(`  - 满足率: ${(validation.satisfactionRate * 100).toFixed(1)}%`);
          sse.sendLog(`  - Critical 违规: ${validation.criticalViolations}`);
          sse.sendLog(`  - Important 违规: ${validation.importantViolations}`);

          // 检查是否需要重新生成（机械闸门：important 级格式违规必须重试，不受 AI 阈值限制）
          const { shouldRegenerate: shouldRegenBase, reason } = constraintValidator.shouldRegenerate(validation);
          const shouldRegenerate = shouldRegenBase || mechFailed;
          const regenReason = mechFailed
            ? `机械闸门命中 ${mech.imp} 项重要格式违规${shouldRegenBase ? `（同时${reason}）` : ''}`
            : reason;

          if (shouldRegenerate && currentAttempt < MAX_ATTEMPTS) {
            sse.sendLog(`[约束验证] ${regenReason}，将进行重试`, 'warn');
            currentAttempt++;
            continue;
          } else if (shouldRegenerate) {
            sse.sendLog(`[约束验证] ${regenReason}，但已达到最大尝试次数，保留双轨最优版本`, 'warn');
          }
        } else if (mechFailed) {
          // 无可验证约束时机械闸门独立生效（海外格式违规必须重试，重试反馈由 lastMechViolations 提供）
          if (currentAttempt < MAX_ATTEMPTS) {
            sse.sendLog(`[机械闸门] 命中 ${mech.imp} 项重要格式违规（无约束验证场景），将进行重试`, 'warn');
            currentAttempt++;
            continue;
          }
          sse.sendLog(`[机械闸门] 命中 ${mech.imp} 项重要格式违规，但已达最大尝试次数`, 'warn');
        } else if (isOverseasFmt) {
          // 无约束场景下也记录双轨分数供 best-of-N 使用
          if (isBetterScore(lastScore, bestScore)) {
            bestScore = { ...lastScore };
            bestContent = content;
          }
        }

        // 验证通过或达到最大尝试次数——双轨裁决：机械违规更少者优先，同级比满足率
        validationPassed = true;
        if (bestContent && isBetterScore(bestScore, lastScore)) {
          sse.sendLog(
            `[约束验证] 保留双轨最优版本（机械违规 重${bestScore.imp}/般${bestScore.nor} 满足率${(bestRate * 100).toFixed(1)}% > 重${lastScore.imp}/般${lastScore.nor} 满足率${(lastScore.rate * 100).toFixed(1)}%）`,
            'warn'
          );
          finalContent = bestContent;
          if (bestValidation) lastValidation = bestValidation;
        } else {
          finalContent = content;
        }
        break;
      } catch (genError) {
        checkAbort();
        const err = genError as Error;
        console.error(`[生成] ❌ 第${currentAttempt}次尝试失败:`);
        console.error(`  错误类型: ${err.name}`);
        console.error(`  错误信息: ${err.message}`);
        sse.sendLog(`[生成] 第${currentAttempt}次尝试失败: ${err.message}`, 'error');

        if (currentAttempt >= MAX_ATTEMPTS) {
          console.error(`[生成] 已达最大尝试次数 ${MAX_ATTEMPTS}，放弃生成`);
          throw genError;
        }
        currentAttempt++;
        sse.sendLog(`[生成] 准备第${currentAttempt}次重试...`, 'warn');
      }
    }

    // 使用 finalContent 继续后续处理
    let fullContent = finalContent;

    // 海外短剧：归一化排版漂移（## 前缀、集标题空格、(VO)变体、中英名粘连、内部标记剥离），分析与保存均用归一化文本
    if (project.outputFormat?.preset === 'overseas_drama' && fullContent) {
      fullContent = normalizeOverseasScript(fullContent);
    }

    // ========== 后续处理：分析、生命周期、保存 ==========
    if (!sse.isClosed() && fullContent) {
      sse.sendProgress(75, 100, '正在分析剧本状态...');
      sse.sendLog(`[分析] 开始分析剧本状态...`);

      // 5. 使用增强版分析器分析剧本
      try {
        const analysisResult = await stateAnalyzer.analyzeEpisode(
          episodeNumber,
          fullContent,
          useWorldState // autoUpdate
        );
        checkAbort();

        // 6. 使用约束验证结果更新节奏追踪（替代原来的关键词匹配）
        // 改进：即使没有约束，也应该检测剧本内容来更新追踪
        let faceSlapDetected = false;
        let plotTwistDetected = false;
        let bossDetected = false;

        // 首先从验证结果中获取（如果有约束被验证）
        if (lastValidation && lastValidation.results.length > 0) {
          const faceSlapResult = lastValidation.results.find(
            (r) => r.constraintType === 'faceSlapping'
          );
          const plotTwistResult = lastValidation.results.find(
            (r) => r.constraintType === 'plotTwist'
          );
          const bossResult = lastValidation.results.find(
            (r) => r.constraintType === 'boss'
          );

          if (faceSlapResult) {
            faceSlapDetected = faceSlapResult.fulfilled;
            sse.sendLog(`  - 打脸场景: ${faceSlapResult.fulfilled ? '✓ 满足' : '✗ 未满足'} (来自约束验证)`);
          }
          if (plotTwistResult) {
            plotTwistDetected = plotTwistResult.fulfilled;
            sse.sendLog(`  - 剧情反转: ${plotTwistResult.fulfilled ? '✓ 满足' : '✗ 未满足'} (来自约束验证)`);
          }
          if (bossResult) {
            bossDetected = bossResult.fulfilled;
          }
        }

        // 如果验证结果中没有相关约束，使用分析结果作为补充检测
        // 这样即使 AI 决定本集不需要打脸，但剧本中实际有打脸，也能正确追踪
        if (!faceSlapDetected && analysisResult.plotUpdates?.keyEvent) {
          faceSlapDetected = analysisResult.plotUpdates.keyEvent.includes('打脸') ||
            analysisResult.plotUpdates.keyEvent.includes('反击') ||
            analysisResult.plotUpdates.keyEvent.includes('碾压');
          if (faceSlapDetected) {
            sse.sendLog(`  - 打脸场景: ✓ 检测到 (来自剧情分析)`);
          }
        }

        if (!plotTwistDetected && analysisResult.plotUpdates?.keyEvent) {
          plotTwistDetected = analysisResult.plotUpdates.keyEvent.includes('反转') ||
            analysisResult.plotUpdates.keyEvent.includes('揭露') ||
            analysisResult.plotUpdates.keyEvent.includes('真相');
          if (plotTwistDetected) {
            sse.sendLog(`  - 剧情反转: ✓ 检测到 (来自剧情分析)`);
          }
        }

        if (!bossDetected) {
          bossDetected = analysisResult.newCharacters?.some(
            (c) => c.suggestedTier === 'arc' || c.suggestedTier === 'recurring'
          ) || false;
        }

        // 更新节奏追踪
        rhythmController.updateTracking({
          faceSlapOccurred: faceSlapDetected,
          plotTwistOccurred: plotTwistDetected,
          bossEncounter: bossDetected,
          coolPointCount: analysisResult.episodeSummary?.keyEvents?.length || 0,
        });

        sse.sendLog(`[节奏追踪] 更新完成`);
        sse.sendLog(`  - 打脸: ${faceSlapDetected ? '✓' : '✗'}, 反转: ${plotTwistDetected ? '✓' : '✗'}, Boss: ${bossDetected ? '✓' : '✗'}`);

        // 保存追踪数据到数据库（持久化）
        await saveRhythmTracking(projectId, rhythmController);

        // 发送分析结果（完整版）
        const analysisForSSE = {
          // 基础统计
          characterUpdates: analysisResult.characterUpdates?.length || 0,
          newCharacters: (analysisResult.newCharacters || [])
            .filter((c) => c.trackingRequired)
            .map((c) => ({
              name: c.name,
              tier: c.suggestedTier || 'temporary',
              role: c.initialState?.role,
            })),
          foreshadowingResolved: analysisResult.foreshadowingResolved?.length || 0,
          foreshadowingPlanted: (analysisResult.foreshadowingPlanted || []).map((f) => ({
            content: f.content || '',
            type: f.type || 'plot',
            importance: f.importance,
          })),
          // 剧情更新
          plotUpdates: analysisResult.plotUpdates ? {
            currentArc: analysisResult.plotUpdates.currentArc,
            arcProgress: analysisResult.plotUpdates.arcProgress,
            keyEvent: analysisResult.plotUpdates.keyEvent,
            newConflict: analysisResult.plotUpdates.newConflict,
            resolvedConflict: analysisResult.plotUpdates.resolvedConflict,
            cliffhanger: analysisResult.plotUpdates.cliffhanger,
          } : undefined,
          // 世界更新
          worldUpdates: analysisResult.worldUpdates ? {
            newSecrets: analysisResult.worldUpdates.newSecrets || [],
            factionChanges: analysisResult.worldUpdates.factionChanges || [],
            newLocations: analysisResult.worldUpdates.newLocations || [],
            itemChanges: analysisResult.worldUpdates.itemChanges || [],
          } : undefined,
          // 本集摘要
          episodeSummary: analysisResult.episodeSummary ? {
            summary: analysisResult.episodeSummary.summary,
            keyEvents: analysisResult.episodeSummary.keyEvents || [],
            cliffhanger: analysisResult.episodeSummary.cliffhanger,
          } : undefined,
          // 下集提示
          nextEpisodeHints: analysisResult.nextEpisodeHints ? {
            suggestedFocus: analysisResult.nextEpisodeHints.suggestedFocus || [],
            pendingForeshadowings: analysisResult.nextEpisodeHints.pendingForeshadowings || [],
            charactersThatShouldAppear: analysisResult.nextEpisodeHints.charactersThatShouldAppear || [],
          } : undefined,
          // 角色退场
          characterExits: (analysisResult.characterExits || []).map((exit) => ({
            name: exit.name,
            exitType: exit.exitType,
            note: exit.note,
          })),
        };
        sse.sendAnalysis(analysisForSSE);

        // 保存分析结果用于日志
        savedAnalysisResult = {
          characterUpdates: analysisForSSE.characterUpdates,
          newCharacters: analysisForSSE.newCharacters,
          foreshadowingResolved: analysisForSSE.foreshadowingResolved,
          foreshadowingPlanted: analysisForSSE.foreshadowingPlanted,
          episodeSummary: analysisResult.episodeSummary?.summary,
        };
        addLog(`分析完成：角色更新${analysisForSSE.characterUpdates}个，伏笔回收${analysisForSSE.foreshadowingResolved}个`);

        sse.sendLog(`[分析] 分析完成`);
        sse.sendLog(`  - 角色更新: ${analysisForSSE.characterUpdates}个`);
        if (analysisForSSE.newCharacters.length > 0) {
          sse.sendLog(`  - 新角色: ${analysisForSSE.newCharacters.map(c => c.name).join(', ')}`);
        }
        sse.sendLog(`  - 伏笔回收: ${analysisForSSE.foreshadowingResolved}个`);
        sse.sendLog(`  - 新埋伏笔: ${analysisForSSE.foreshadowingPlanted.length}个`);
        if (analysisForSSE.foreshadowingPlanted.length > 0) {
          analysisForSSE.foreshadowingPlanted.slice(0, 3).forEach((f, i) => {
            sse.sendLog(`    ${i + 1}. [${f.type}] ${f.content.slice(0, 40)}...`);
          });
        }

        console.log(`[WorldState] 第${episodeNumber}集分析完成`);
        console.log(`  - 角色更新: ${analysisResult.characterUpdates?.length || 0}`);
        console.log(`  - 伏笔回收: ${analysisResult.foreshadowingResolved?.length || 0}`);
        console.log(`  - 新埋伏笔: ${analysisResult.foreshadowingPlanted?.length || 0}`);

        // 6.5 角色生命周期管理 - 自动升降级
        sse.sendProgress(88, 100, '正在处理角色生命周期...');
        sse.sendLog(`[角色生命周期] 开始处理...`);
        try {
          // 获取刚刚分析更新后的最新 WorldState（在 episodeNumber 位置）
          const latestWorldState = await worldStateManager.getWorldState(episodeNumber);
          if (latestWorldState) {
            const existingCharacters = new Map<string, {
              tier: import('../models/WorldState').CharacterTier;
              lastAppearance: number;
              appearanceCount: number;
              consecutiveAppearances: number;
              belongsToArc?: string;
            }>();

            latestWorldState.characters.forEach((char, name) => {
              existingCharacters.set(name, {
                tier: char.tier,
                lastAppearance: char.lastAppearance,
                appearanceCount: char.appearanceCount,
                consecutiveAppearances: char.consecutiveAppearances,
                belongsToArc: char.belongsToArc,
              });
            });

            // 处理角色生命周期
            const lifecycleResult = await lifecycleManager.processEpisodeCharacters(
              episodeNumber,
              analysisResult,
              existingCharacters
            );

            // 发送生命周期变化
            if (lifecycleResult.tierChanges.length > 0 ||
              lifecycleResult.newCharactersToTrack.length > 0 ||
              lifecycleResult.archivedCharacters.length > 0) {
              sse.sendCharacterLifecycle({
                tierChanges: lifecycleResult.tierChanges,
                newCharactersToTrack: lifecycleResult.newCharactersToTrack.map((c) => ({
                  name: c.name,
                  tier: c.suggestedTier || 'temporary',
                })),
                archivedCharacters: lifecycleResult.archivedCharacters,
              });
            }

            // 保存生命周期结果用于日志
            savedLifecycleResult = {
              tierChanges: lifecycleResult.tierChanges,
              newCharactersToTrack: lifecycleResult.newCharactersToTrack.map((c) => ({
                name: c.name,
                tier: c.suggestedTier || 'temporary',
              })),
              archivedCharacters: lifecycleResult.archivedCharacters,
            };

            sse.sendLog(`[角色生命周期] 处理完成`);
            if (lifecycleResult.tierChanges.length > 0) {
              sse.sendLog(`  - 层级变化: ${lifecycleResult.tierChanges.length}个`);
              lifecycleResult.tierChanges.forEach((change) => {
                sse.sendLog(`    · ${change.name}: ${change.from} → ${change.to} (${change.reason})`);
              });
            }
            if (lifecycleResult.newCharactersToTrack.length > 0) {
              sse.sendLog(`  - 新追踪角色: ${lifecycleResult.newCharactersToTrack.map((c) => c.name).join(', ')}`);
            }
            if (lifecycleResult.archivedCharacters.length > 0) {
              sse.sendLog(`  - 归档角色: ${lifecycleResult.archivedCharacters.join(', ')}`);
            }

            // 持久化层级变化和归档状态到 WorldState
            const hasChanges = lifecycleResult.tierChanges.length > 0 ||
              lifecycleResult.archivedCharacters.length > 0;
            if (hasChanges) {
              // 更新角色层级
              for (const change of lifecycleResult.tierChanges) {
                const char = latestWorldState.characters.get(change.name);
                if (char) {
                  char.tier = change.to as import('../models/WorldState').CharacterTier;
                }
              }
              // 更新归档角色状态
              for (const name of lifecycleResult.archivedCharacters) {
                const char = latestWorldState.characters.get(name);
                if (char) {
                  char.status = 'archived' as import('../models/WorldState').CharacterStatus;
                }
              }
              // 保存更新后的 WorldState
              await worldStateRepository.upsertState(
                projectId,
                episodeNumber,
                latestWorldState
              );
              sse.sendLog(`[角色生命周期] 已持久化 ${lifecycleResult.tierChanges.length} 个层级变化`);
            }
          }
        } catch (lifecycleError) {
          checkAbort();
          logGenerationError('角色生命周期处理失败', lifecycleError, '角色生命周期管理', { projectId, episodeNumber });
          sse.sendLog(`[角色生命周期] 处理失败: ${(lifecycleError as Error).message}`, 'warn');
        }

        sse.sendProgress(95, 100, '正在保存剧本...');
        sse.sendLog(`[保存] 正在保存剧本...`);
      } catch (analysisError) {
        checkAbort();
        logGenerationError('剧本分析失败', analysisError, '剧本状态分析', { projectId, episodeNumber });
        sse.sendLog(`[分析] 分析失败: ${(analysisError as Error).message}`, 'error');
        // 分析失败不影响剧本保存
      }

      // 7. 生成摘要并保存
      let summary = '';
      try {
        summary = await scriptService.generateSummary(fullContent);
      } catch (summaryError) {
        checkAbort();
        logGenerationError('摘要生成失败', summaryError, '生成摘要', { projectId, episodeNumber });
        // 摘要生成失败时使用默认摘要
        summary = `第${episodeNumber}集剧本内容 (${fullContent.length}字)`;
      }

      checkAbort();
      await episodeRepository.upsert(projectId, episodeNumber, {
        content: fullContent,
        summary,
        wordCount: WordCountService.countV1(fullContent),  // V1 兼容
        wordCountV2: WordCountService.countV2(fullContent),  // V2 新算法
        wordCountAlgorithm: 'v2',
        status: 'completed',
      });

      sse.sendProgress(100, 100, '剧本生成完成');
      sse.sendLog(`[完成] 第${episodeNumber}集剧本生成完成，共${fullContent.length}字`);

      // 发送验证统计信息（如果有）
      if (lastValidation) {
        sse.sendLog(`[验证统计] 最终满足率: ${(lastValidation.satisfactionRate * 100).toFixed(1)}%`);
        if (currentAttempt > 1) {
          sse.sendLog(`[验证统计] 总尝试次数: ${currentAttempt}`);
        }
      }

      // ========== 持久化生成日志 ==========
      const generationEndTime = Date.now();
      addLog(`生成完成，共${fullContent.length}字，耗时${((generationEndTime - generationStartTime) / 1000).toFixed(1)}秒`);

      try {
        await generationLogRepository.upsert(projectId, episodeNumber, {
          context: {
            episodePlan: savedEpisodePlan,
            formattedContext: generationContext.formattedContext,
            constraints: generationContext.constraints,
            suggestions: generationContext.suggestions,
            relevantCharacters: savedRelevantCharacters,
            relevantForeshadowings: savedRelevantForeshadowings,
            previousCliffhanger: savedPreviousCliffhanger,
            rhythmSettings: {
              preset: rhythmController.getCurrentPreset(),
              params: rhythmController.getParams(),
            },
          },
          multiHeadAnalysis: savedMultiHeadAnalysis,
          aiConstraintDecision: savedAIConstraintDecision,  // 保存 AI 约束决策
          constraintValidation: lastValidation ? {
            overallSatisfied: lastValidation.overallSatisfied,
            satisfactionRate: lastValidation.satisfactionRate,
            criticalViolations: lastValidation.criticalViolations,
            importantViolations: lastValidation.importantViolations,
            normalViolations: lastValidation.normalViolations,
            results: lastValidation.results,
            summary: lastValidation.summary,
            improvementSuggestions: lastValidation.improvementSuggestions,
          } : undefined,
          analysis: savedAnalysisResult,
          characterLifecycle: savedLifecycleResult,
          retryInfo: currentAttempt > 1 ? {
            totalAttempts: currentAttempt,
            retryReasons: [],  // 可以从重试过程中收集
            strengthenedConstraints: [],
          } : undefined,
          logs: collectedLogs,
          status: lastValidation?.overallSatisfied !== false ? 'success' : 'partial_success',
          wordCount: WordCountService.countV1(fullContent),
          wordCountV2: WordCountService.countV2(fullContent),
          wordCountAlgorithm: 'v2',
          generationDuration: generationEndTime - generationStartTime,
        });
        logger.info(`第${episodeNumber}集生成日志已保存`);
      } catch (logError) {
        logGenerationError('保存生成日志失败', logError, '保存生成日志', { projectId, episodeNumber });
        // 日志保存失败不影响主流程
      }

      sse.sendDone({
        projectId,
        episodeNumber,
        wordCount: WordCountService.countV1(fullContent),
        wordCountV2: WordCountService.countV2(fullContent),
        wordCountAlgorithm: 'v2',
        useWorldState,
        validationInfo: lastValidation ? {
          satisfactionRate: lastValidation.satisfactionRate,
          attempts: currentAttempt,
          criticalViolations: lastValidation.criticalViolations,
          importantViolations: lastValidation.importantViolations,
        } : undefined,
      });
    }
  } catch (error) {
    if (signal?.aborted) return;
    const err = error as Error;
    logger.error('生成剧本错误', err, {
      method: 'generate-script-enhanced',
      additionalInfo: {
        projectId: req.body?.projectId,
        episodeNumber: req.body?.episodeNumber,
      },
    });
    if (!sse.isClosed()) {
      sse.sendError(`生成失败: ${err.message}`);
    }
  }
}

/**
 * 获取节奏控制预设列表
 */
router.get('/rhythm-presets', async (req: Request, res: Response) => {
  try {
    const presets = Object.values(RHYTHM_PRESETS).map((preset) => ({
      type: preset.type,
      name: preset.name,
      description: preset.description,
      icon: preset.icon,
      recommendedGenres: preset.recommendedGenres,
    }));

    res.json({ presets });
  } catch (error) {
    handleRouteError(res, error);
  }
});

/**
 * 获取项目的节奏控制配置
 */
router.get('/rhythm-config/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const controller = await initRhythmController(projectId);
    res.json({
      currentPreset: controller.getCurrentPreset(),
      params: controller.getParams(),
      tracking: controller.toJSON().tracking,
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

/**
 * 设置项目的节奏控制配置
 */
router.post('/rhythm-config/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { preset, params } = req.body;

    // 验证预设类型
    const validPresets = ['extreme-cool', 'hot-blood', 'brain-burn', 'horror-thriller', 'sweet-romance', 'system-flow', 'mind-game', 'overseas-romance', 'overseas-revenge', 'custom'];

    // 加载现有控制器（保留追踪数据）
    let controller = await initRhythmController(projectId);
    const existingTracking = controller.toJSON().tracking;

    if (preset && preset !== 'custom') {
      if (!validPresets.includes(preset)) {
        res.status(400).json({ error: `无效的预设类型: ${preset}。有效类型: ${validPresets.join(', ')}` });
        return;
      }
      // 创建新控制器并恢复追踪数据
      controller = RhythmController.fromJSON({
        currentPreset: preset as RhythmPresetType,
        params: new RhythmController(preset as RhythmPresetType).getParams(),
        tracking: existingTracking,
      });
      rhythmControllers.set(projectId, controller);
    }

    if (params) {
      // 应用自定义参数
      controller.setParams(params as Partial<IRhythmControlParams>);
    }

    // 保存到数据库
    await Project.findByIdAndUpdate(projectId, {
      rhythmPreset: controller.getCurrentPreset(),
      rhythmParams: controller.getParams(),
    });

    res.json({
      success: true,
      currentPreset: controller.getCurrentPreset(),
      params: controller.getParams(),
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

/**
 * 手动触发剧本分析（用于已有剧本的补充分析）
 */
router.post('/analyze-episode', async (req: Request, res: Response) => {
  try {
    const { projectId, episodeNumber, autoUpdate = true } = req.body;

    if (!projectId || !episodeNumber) {
      res.status(400).json({ error: '缺少必要参数' });
      return;
    }

    // 获取剧本内容
    const episode = await episodeRepository.findByNumber(projectId, episodeNumber);
    if (!episode || !episode.content) {
      res.status(404).json({ error: '剧本不存在' });
      return;
    }

    const stateAnalyzer = new EnhancedStateAnalyzer(projectId, aiClient);

    const analysisResult = await stateAnalyzer.analyzeEpisode(
      episodeNumber,
      episode.content,
      autoUpdate
    );

    res.json({
      success: true,
      episodeNumber,
      analysis: analysisResult,
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

/**
 * 获取某集的生成日志
 */
router.get('/generation-log/:projectId/:episodeNumber', async (req: Request, res: Response) => {
  try {
    const { projectId, episodeNumber } = req.params;
    const log = await generationLogRepository.getByEpisode(projectId, parseInt(episodeNumber));

    if (!log) {
      res.json({ exists: false, message: '未找到生成记录' });
      return;
    }

    res.json({ exists: true, log });
  } catch (error) {
    handleRouteError(res, error);
  }
});

/**
 * 获取项目的生成历史列表
 */
router.get('/generation-logs/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { page = '1', limit = '20' } = req.query;

    const result = await generationLogRepository.getByProject(
      projectId,
      parseInt(page as string),
      parseInt(limit as string)
    );

    res.json(result);
  } catch (error) {
    handleRouteError(res, error);
  }
});

/**
 * 获取项目的生成统计
 */
router.get('/generation-stats/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const stats = await generationLogRepository.getStats(projectId);
    res.json(stats);
  } catch (error) {
    handleRouteError(res, error);
  }
});

/**
 * 批量分析多集剧本
 */
router.post('/analyze-batch', async (req: Request, res: Response) => {
  try {
    const { projectId, startEpisode, endEpisode } = req.body;

    if (!projectId || !startEpisode || !endEpisode) {
      res.status(400).json({ error: '缺少必要参数' });
      return;
    }

    const stateAnalyzer = new EnhancedStateAnalyzer(projectId, aiClient);

    const episodes: { episode: number; content: string }[] = [];

    for (let i = startEpisode; i <= endEpisode; i++) {
      const episode = await episodeRepository.findByNumber(projectId, i);
      if (episode && episode.content) {
        episodes.push({ episode: i, content: episode.content });
      }
    }

    if (episodes.length === 0) {
      res.status(404).json({ error: '未找到剧本' });
      return;
    }

    const results = await stateAnalyzer.analyzeMultipleEpisodes(episodes);

    res.json({
      success: true,
      analyzed: results.length,
      episodes: results.map((r, i) => ({
        episode: episodes[i].episode,
        characterUpdates: r.characterUpdates.length,
        foreshadowingResolved: r.foreshadowingResolved.length,
        foreshadowingPlanted: r.foreshadowingPlanted.length,
      })),
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

/**
 * 获取注意力头配置
 */
router.get('/attention-heads', async (req: Request, res: Response) => {
  try {
    const { genre } = req.query;

    const attentionSystem = new ModularAttentionSystem(
      aiClient,
      (genre as GenreType) || 'custom'
    );

    const enabledHeads = attentionSystem.getEnabledHeads();
    const weights = attentionSystem.getHeadWeights();

    const headsInfo = enabledHeads.map((head) => ({
      type: head,
      weight: weights.get(head) || 0,
    }));

    res.json({
      genre: genre || 'custom',
      heads: headsInfo,
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

/**
 * AI 分析推荐注意力头
 * 根据项目类型描述智能推荐合适的注意力头
 */
router.post('/attention-recommend/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { forceRefresh = false } = req.body;

    const project = await findProjectOrFail(res, projectId);
    if (!project) return;

    // 检查是否已有 AI 推荐且不需要强制刷新
    const existingConfig = project.attentionHeadConfig as {
      mode: string;
      aiRecommendedHeads?: string[];
      aiRecommendationReasons?: Array<{ head: string; reason: string }>;
      aiIdentifiedElements?: string[];
      aiAnalyzedAt?: Date;
    } | undefined;

    if (!forceRefresh && existingConfig?.aiRecommendedHeads && existingConfig.aiRecommendedHeads.length > 0) {
      // 返回已有推荐
      res.json({
        success: true,
        cached: true,
        recommendation: {
          recommendedHeads: existingConfig.aiRecommendedHeads,
          reasons: existingConfig.aiRecommendationReasons || [],
          identifiedElements: existingConfig.aiIdentifiedElements || [],
          summary: '使用缓存的 AI 推荐结果',
          analyzedAt: existingConfig.aiAnalyzedAt,
        },
      });
      return;
    }

    // 导入推荐服务
    const { AttentionRecommender } = await import('../services/attention/AttentionRecommender');
    const recommender = new AttentionRecommender(aiClient);

    // 执行 AI 分析
    const typeDescription = project.type || '';
    const projectName = project.name;
    const concept = project.concept;

    console.log(`[AttentionRecommend] 开始分析项目 ${projectId}`);
    console.log(`  - 类型描述: ${typeDescription}`);
    console.log(`  - 项目名称: ${projectName}`);

    const recommendation = await recommender.recommendHeads(typeDescription, projectName, concept);

    // 保存推荐结果到项目配置
    const updatedConfig = {
      ...existingConfig,
      mode: (existingConfig?.mode || 'auto') as 'auto' | 'custom',
      aiRecommendedHeads: recommendation.recommendedHeads,
      aiRecommendationReasons: recommendation.reasons,
      aiIdentifiedElements: recommendation.identifiedElements,
      aiAnalyzedAt: new Date(),
    };

    await projectRepository.update(projectId, {
      attentionHeadConfig: updatedConfig,
    });

    console.log(`[AttentionRecommend] 分析完成，推荐 ${recommendation.recommendedHeads.length} 个注意力头`);

    res.json({
      success: true,
      cached: false,
      recommendation: {
        ...recommendation,
        analyzedAt: updatedConfig.aiAnalyzedAt,
      },
    });
  } catch (error) {
    console.error('[AttentionRecommend] 推荐失败:', error);
    handleRouteError(res, error);
  }
});

/**
 * 获取所有可用的注意力头（供前端选择用）
 */
router.get('/attention-heads/all', async (req: Request, res: Response) => {
  try {
    // 导入所有头配置
    const {
      BASE_HEADS,
      MYSTERY_HEADS,
      HORROR_HEADS,
      MIND_HEADS,
      GAME_HEADS,
      COOL_HEADS,
      STYLE_HEADS,
      OVERSEAS_HEADS,
      GENRE_HEAD_MAPPING,
    } = await import('../services/attention/AttentionModules');

    const allHeads = [
      ...BASE_HEADS.map((h) => ({ ...h, required: true })),
      ...MYSTERY_HEADS.map((h) => ({ ...h, required: false })),
      ...HORROR_HEADS.map((h) => ({ ...h, required: false })),
      ...MIND_HEADS.map((h) => ({ ...h, required: false })),
      ...GAME_HEADS.map((h) => ({ ...h, required: false })),
      ...COOL_HEADS.map((h) => ({ ...h, required: false })),
      ...STYLE_HEADS.map((h) => ({ ...h, required: false })),
      ...OVERSEAS_HEADS.map((h) => ({ ...h, required: false })),
    ];

    res.json({
      heads: allHeads,
      genreMapping: GENRE_HEAD_MAPPING,
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

/**
 * 获取项目的注意力头配置
 */
router.get('/attention-config/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const project = await findProjectOrFail(res, projectId);
    if (!project) return;

    // 获取题材对应的默认头（基于关键词匹配的备用方案）
    const genre = mapProjectTypeToGenre(project.type || '');
    const { GENRE_HEAD_MAPPING } = await import('../services/attention/AttentionModules');
    const fallbackHeads = GENRE_HEAD_MAPPING[genre] || GENRE_HEAD_MAPPING['custom'];

    // 获取现有配置
    const existingConfig = project.attentionHeadConfig as {
      mode: string;
      enabledHeads?: string[];
      headWeights?: Record<string, number>;
      aiRecommendedHeads?: string[];
      aiRecommendationReasons?: Array<{ head: string; reason: string }>;
      aiIdentifiedElements?: string[];
      aiAnalyzedAt?: Date;
    } | undefined;

    // 确定实际使用的注意力头
    let effectiveHeads: string[];
    let headsSource: 'ai' | 'custom' | 'fallback';

    if (existingConfig?.mode === 'custom' && existingConfig.enabledHeads) {
      // 自定义模式：使用用户选择的头
      effectiveHeads = existingConfig.enabledHeads;
      headsSource = 'custom';
    } else if (existingConfig?.aiRecommendedHeads && existingConfig.aiRecommendedHeads.length > 0) {
      // 自动模式 + 有 AI 推荐：使用 AI 推荐的头
      effectiveHeads = existingConfig.aiRecommendedHeads;
      headsSource = 'ai';
    } else {
      // 自动模式 + 无 AI 推荐：使用关键词匹配的备用方案
      effectiveHeads = fallbackHeads;
      headsSource = 'fallback';
    }

    res.json({
      projectId,
      projectType: project.type,
      genre,
      config: existingConfig || { mode: 'auto' },
      // 实际生效的注意力头
      effectiveHeads,
      headsSource,
      // 备用方案（关键词匹配）
      fallbackHeads,
      // AI 推荐信息
      aiRecommendation: existingConfig?.aiRecommendedHeads ? {
        recommendedHeads: existingConfig.aiRecommendedHeads,
        reasons: existingConfig.aiRecommendationReasons || [],
        identifiedElements: existingConfig.aiIdentifiedElements || [],
        analyzedAt: existingConfig.aiAnalyzedAt,
      } : null,
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

/**
 * 保存项目的注意力头配置
 */
router.post('/attention-config/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { mode, enabledHeads, headWeights } = req.body;

    const project = await findProjectOrFail(res, projectId);
    if (!project) return;

    // 验证模式
    if (mode !== 'auto' && mode !== 'custom') {
      res.status(400).json({ error: '无效的模式，必须是 auto 或 custom' });
      return;
    }

    // 构建配置对象
    const config: {
      mode: 'auto' | 'custom';
      enabledHeads?: string[];
      headWeights?: Record<string, number>;
    } = { mode };

    if (mode === 'custom') {
      // 验证 enabledHeads
      if (!Array.isArray(enabledHeads) || enabledHeads.length === 0) {
        res.status(400).json({ error: '自定义模式必须指定至少一个注意力头' });
        return;
      }

      // 确保基础头始终包含
      const { BASE_HEADS } = await import('../services/attention/AttentionModules');
      const baseHeadTypes = BASE_HEADS.map((h) => h.type);
      const finalHeads = [...new Set([...baseHeadTypes, ...enabledHeads])];

      config.enabledHeads = finalHeads;
      if (headWeights) {
        config.headWeights = headWeights;
      }
    }

    // 更新项目
    // 保留现有的 AI 推荐数据
    const existingConfig = project.attentionHeadConfig as Record<string, any> || {};

    // 合并配置
    const finalConfig = {
      ...existingConfig,
      mode,
      ...(mode === 'custom' ? { enabledHeads: config.enabledHeads, headWeights: config.headWeights } : {}),
    };

    // 更新项目，保留 AI 推荐
    await projectRepository.update(projectId, {
      attentionHeadConfig: finalConfig,
    });

    res.json({
      success: true,
      config,
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

/**
 * 获取生成上下文预览（用于调试）
 */
router.post('/preview-context', async (req: Request, res: Response) => {
  try {
    const { projectId, episodeNumber } = req.body;

    if (!projectId || !episodeNumber) {
      res.status(400).json({ error: '缺少必要参数' });
      return;
    }

    const project = await findProjectOrFail(res, projectId);
    if (!project) return;

    const worldStateManager = new WorldStateManager(projectId, aiClient);
    const rhythmController = getRhythmController(projectId);
    rhythmController.setCurrentEpisode(episodeNumber);

    // 获取 WorldState
    const worldState = await worldStateManager.getWorldState(episodeNumber - 1);

    if (!worldState) {
      res.json({
        hasWorldState: false,
        message: '无前置 WorldState',
        rhythmConstraints: rhythmController.generateRhythmConstraints(),
      });
      return;
    }

    // 获取本集梗概
    const episodePlan = getEpisodePlanFromOutline(project.outline, episodeNumber);

    // 构建生成上下文
    const context = await worldStateManager.buildGenerationContext(worldState, episodePlan);

    res.json({
      hasWorldState: true,
      episodePlan,
      worldStateEpisode: worldState.episodeNumber,
      characterCount: worldState.characters.size,
      plantedForeshadowings: worldState.foreshadowings.planted.length,
      context: {
        formattedContext: context.formattedContext,
        constraints: context.constraints,
        rhythmConstraints: rhythmController.generateRhythmConstraints(),
        suggestions: [...context.hiddenConnections, ...context.suggestedElements],
      },
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

/**
 * 获取项目的 WorldState
 * 注意：此通配符路由必须放在所有具体路由之后
 */
router.get('/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { episode } = req.query;

    let worldState;
    if (episode) {
      worldState = await worldStateRepository.getStateAtEpisode(
        projectId,
        parseInt(episode as string)
      );
    } else {
      worldState = await worldStateRepository.getLatestState(projectId);
    }

    if (!worldState) {
      res.json({ exists: false, message: '未找到 WorldState' });
      return;
    }

    // 转换 Map 为对象以便 JSON 序列化
    const characters: Record<string, unknown> = {};
    worldState.characters.forEach((char, name) => {
      // 使用 toObject() 正确转换 Mongoose 子文档
      const rawChar = typeof (char as any).toObject === 'function'
        ? (char as any).toObject()
        : char;

      const charObj: Record<string, unknown> = { ...rawChar };

      // 转换 relationships Map
      if (rawChar.relationships instanceof Map) {
        const relationships: Record<string, string> = {};
        rawChar.relationships.forEach((rel: string, target: string) => {
          relationships[target] = rel;
        });
        charObj.relationships = relationships;
      }
      characters[name] = charObj;
    });

    res.json({
      exists: true,
      worldState: {
        ...worldState.toObject(),
        characters,
      },
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

/**
 * 初始化项目的 WorldState
 * 注意：此通配符路由必须放在所有具体路由之后
 */
router.post('/:projectId/initialize', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    const stateAnalyzer = new EnhancedStateAnalyzer(projectId, aiClient);

    const worldState = await stateAnalyzer.initializeWorldState();

    res.json({
      success: true,
      episodeNumber: worldState.episodeNumber,
      characterCount: worldState.characters.size,
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

export default router;
