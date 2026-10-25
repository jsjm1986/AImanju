/**
 * 统一约束管理器
 * 将所有硬编码规则改为 AI 灵活决策
 *
 * 核心理念：
 * - 给 AI 完整上下文（梗概、世界状态、节奏追踪、用户偏好）
 * - AI 一次性输出所有约束决策
 * - 代码只负责解析和格式化
 */

import { IWorldState } from '../../models/WorldState';
import { createLogger, safeStringify } from '../../utils/errorLogger';
import { robustParseJson } from '../../utils/jsonParser';
import { AIClient, aiClient } from '../ai/AIClient';
import { IRhythmControlParams, RhythmPresetType } from '../rhythm/RhythmControl';

const logger = createLogger('UnifiedConstraintManager');

const CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  MAX_TOKENS: 8000,
  MIN_VALID_RESPONSE_LENGTH: 100,
};

// ==================== 类型定义 ====================

export type LogCallback = (message: string, level?: 'info' | 'warn' | 'error') => void;

export interface UnifiedConstraintContext {
  projectId: string;
  projectName: string;
  projectType: string;
  currentEpisode: number;
  totalEpisodes: number;
  episodePlan: string;
  worldState: IWorldState | null;
  rhythmTracking: {
    lastFaceSlap: number;
    lastPlotTwist: number;
    lastBoss: number;
  };
  userPreferences: {
    rhythmPreset: RhythmPresetType;
    rhythmParams: IRhythmControlParams;
  };
  multiHeadInsights?: string[];
}

interface EnhancedRhythmDecision {
  needed: boolean;
  urgency: 'high' | 'medium' | 'low' | 'none';
  reason: string;
  subject?: string;
  object?: string;
  methodology?: string[];
  validationCriteria?: string[];
}

interface EnhancedForeshadowingDecision {
  content: string;
  reason: string;
  priority: number;
  episodePlanted?: number;
  originalHint?: string;
  methodology?: string[];
  validationCriteria?: string[];
}

export interface AIConstraintDecision {
  rhythm: {
    faceSlap: EnhancedRhythmDecision;
    plotTwist: EnhancedRhythmDecision;
    boss: EnhancedRhythmDecision;
    guidanceNotes: string[];
  };
  foreshadowing: {
    mustResolve: EnhancedForeshadowingDecision[];
    canResolve: Array<{ content: string; reason: string }>;
    shouldIgnore: Array<{ content: string; reason: string }>;
  };
  cliffhanger: { mustAddress: boolean; content: string; howToAddress: string } | null;
  characterStates: Array<{ name: string; condition: string; mustShow: boolean; reason: string }>;
  worldConsistency: Array<{ content: string; severity: 'critical' | 'important' | 'normal'; reason: string }>;
  summary: string;
}

const DEFAULT_DECISION: AIConstraintDecision = {
  rhythm: {
    faceSlap: { needed: false, urgency: 'none', reason: '默认值' },
    plotTwist: { needed: false, urgency: 'none', reason: '默认值' },
    boss: { needed: false, urgency: 'none', reason: '默认值' },
    guidanceNotes: [],
  },
  foreshadowing: { mustResolve: [], canResolve: [], shouldIgnore: [] },
  cliffhanger: null,
  characterStates: [],
  worldConsistency: [],
  summary: '使用默认决策',
};

export interface UnifiedConstraint {
  id: string;
  type: 'faceSlapping' | 'plotTwist' | 'boss' | 'foreshadowing' | 'cliffhanger' | 'characterState' | 'continuity' | 'rhythm';
  content: string;
  severity: 'critical' | 'important' | 'normal';
  source: string;
  context?: string;
  category: 'verifiable' | 'guidance';
  subject?: string;
  object?: string;
  methodology?: string[];
  validationCriteria?: string[];
  episodePlanted?: number;
  originalHint?: string;
}

// ==================== 辅助函数 ====================

type Severity = 'critical' | 'important' | 'normal';

function urgencyToSeverity(urgency: string): Severity {
  if (urgency === 'high') return 'critical';
  if (urgency === 'medium') return 'important';
  return 'normal';
}

function priorityToSeverity(priority: number): Severity {
  if (priority >= 80) return 'critical';
  if (priority >= 60) return 'important';
  return 'normal';
}

/** 格式化 methodology + validationCriteria 的共用尾部 */
function formatMethodologyAndCriteria(methodology?: string[], validationCriteria?: string[]): string {
  let out = '';
  if (methodology && methodology.length > 0) {
    out += '\n\n实现方法:';
    methodology.forEach((m, i) => { out += `\n  ${i + 1}. ${m}`; });
  }
  if (validationCriteria && validationCriteria.length > 0) {
    out += '\n\n验证标准:';
    validationCriteria.forEach((v) => { out += `\n  - ${v}`; });
  }
  return out;
}

/** 合并单个节奏决策字段与默认值，兼容 AI 返回的别名字段 */
function mergeRhythmDecision(raw: any, fallback: EnhancedRhythmDecision): EnhancedRhythmDecision {
  if (!raw) return { ...fallback };
  return {
    ...fallback,
    ...raw,
    subject: raw.subject || raw.character || '',
    object: raw.object || raw.target || '',
    methodology: raw.methodology || [],
    validationCriteria: raw.validationCriteria || [],
  };
}

// ==================== 紧凑版 Prompt ====================

const COMPACT_PROMPT = `你是剧本约束分析专家。分析上下文，输出约束决策JSON。

【项目】{projectName} ({projectType}) 第{currentEpisode}/{totalEpisodes}集

【本集梗概】
{episodePlan}

【节奏】打脸@{lastFaceSlap}(已{faceSlapsAgo}集) 反转@{lastPlotTwist}(已{plotTwistsAgo}集) Boss@{lastBoss}(已{bossAgo}集)
【偏好】打脸/{faceSlappingFrequency}集 反转/{plotTwistFrequency}集 Boss/{bossInterval}集

【角色状态】{characterStates}

【未回收伏笔】{foreshadowings}

【前情悬念】{previousCliffhanger}

【多头洞察】{multiHeadInsights}

【近期事件】{recentEvents}

【任务】基于剧情语义判断并输出完整约束决策：
1. 节奏：本集是否需要打脸/反转/Boss，如果需要，必须输出subject(谁)、object(对谁)、methodology(2-3条实现方法)、validationCriteria(2-3条验证标准)
2. 伏笔：哪些必须回收，输出episodePlanted(埋藏集数)、originalHint(原文线索)、methodology、validationCriteria
3. 悬念：如何承接
4. 角色：哪些状态需体现
5. 一致性：能力边界等

【输出格式】严格JSON：
\`\`\`json
{
  "rhythm": {
    "faceSlap": {
      "needed": true,
      "urgency": "high",
      "reason": "简短理由",
      "subject": "主角",
      "object": "对手名",
      "methodology": ["让对手先嘲讽", "主角反击", "对手震惊"],
      "validationCriteria": ["必须有嘲讽对话", "必须有反击描写", "必须有失态反应"]
    },
    "plotTwist": {"needed": false, "urgency": "none", "reason": "理由"},
    "boss": {"needed": false, "urgency": "none", "reason": "理由"},
    "guidanceNotes": []
  },
  "foreshadowing": {
    "mustResolve": [{
      "content": "伏笔内容",
      "reason": "理由",
      "priority": 80,
      "episodePlanted": 5,
      "originalHint": "原文中的线索描述",
      "methodology": ["通过对话引出", "通过场景呼应"],
      "validationCriteria": ["必须提及原文线索", "必须明确回收"]
    }],
    "canResolve": [],
    "shouldIgnore": []
  },
  "cliffhanger": {"mustAddress": true, "content": "悬念内容", "howToAddress": "如何承接"},
  "characterStates": [
    {"name": "角色名", "condition": "状态", "mustShow": true, "reason": "理由"}
  ],
  "worldConsistency": [
    {"content": "约束内容", "severity": "important", "reason": "理由"}
  ],
  "summary": "一句话总结"
}
\`\`\`

【重要】
- methodology 是给生成AI的实现建议，必须具体可执行
- validationCriteria 是验证AI的检查标准，必须明确可判断
- validationCriteria 描述应达成的剧情节拍/语义效果，不得要求逐字复现台词；仅当某句原话本身就是关键伏笔（口令/信物刻字/死亡留言）时才可要求保留原文
- 可验证约束必须是"剧本文本中可判定"的事项（某信息/台词/动作出现或未出现、事件先后、某场景存在）；禁止要求镜头持续时长、秒数、帧数、构图角度等文本无法判定的拍摄层细节
- 约束描述"要什么"（情节结果/信息/情绪效果），不锁死"怎么呈现"（指定道具/指定写法），除非该道具本身是伏笔信物
- 两者必须一致，不能自相矛盾
- 如果节奏项needed=false，可省略subject/object/methodology/validationCriteria
- reason字段限20字内，content字段限50字内`;

// ==================== 节奏约束类型映射 ====================

const RHYTHM_TYPES = [
  { key: 'faceSlap' as const, type: 'faceSlapping' as const, label: '打脸' },
  { key: 'plotTwist' as const, type: 'plotTwist' as const, label: '反转' },
  { key: 'boss' as const, type: 'boss' as const, label: 'Boss' },
];

// ==================== 主服务类 ====================

export class UnifiedConstraintManager {
  private aiClient: AIClient;
  private logCallback?: LogCallback;

  constructor(aiClientInstance?: AIClient, logCallback?: LogCallback) {
    this.aiClient = aiClientInstance || aiClient;
    this.logCallback = logCallback;
  }

  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    logger[level](message);
    this.logCallback?.(message, level);
  }

  async analyzeAndDecide(context: UnifiedConstraintContext): Promise<{
    decision: AIConstraintDecision;
    constraints: UnifiedConstraint[];
  }> {
    if (!context) {
      this.log('analyzeAndDecide: context 参数为空', 'error');
      return { decision: DEFAULT_DECISION, constraints: [] };
    }

    this.log(`===== 开始 AI 约束决策 (第${context.currentEpisode}集) =====`);
    this.log(`项目: ${context.projectName || '未知'} (${context.projectType || '未知'})`);

    const tracking = context.rhythmTracking || { lastFaceSlap: 0, lastPlotTwist: 0, lastBoss: 0 };
    this.log(`节奏追踪: 打脸@${tracking.lastFaceSlap}, 反转@${tracking.lastPlotTwist}, Boss@${tracking.lastBoss}`);

    const prompt = this.buildPrompt(context);
    const { decision, parseSuccess, attempts } = await this.callAIWithRetry(prompt);

    if (!parseSuccess) {
      this.log(`经过 ${attempts} 次尝试仍解析失败，使用默认决策`, 'warn');
    } else {
      this.log(`AI 决策解析成功 (尝试 ${attempts} 次)`);
      this.log(`摘要: ${safeStringify(decision.summary, 100)}`);
    }

    const constraints = this.convertToUnifiedConstraints(decision, context.currentEpisode);

    const MAX_VERIFIABLE = 30;
    const verifiable = constraints.filter(c => c && c.category === 'verifiable');
    const guidance = constraints.filter(c => c && c.category === 'guidance');

    let finalConstraints = constraints;
    if (verifiable.length > MAX_VERIFIABLE) {
      this.log(`可验证约束过多 (${verifiable.length})，截取前 ${MAX_VERIFIABLE} 个`, 'warn');
      finalConstraints = [...verifiable.slice(0, MAX_VERIFIABLE), ...guidance];
    }

    const finalVerifiable = finalConstraints.filter(c => c && c.category === 'verifiable').length;
    const finalGuidance = finalConstraints.filter(c => c && c.category === 'guidance').length;
    this.log(`===== AI 约束决策完成 =====`);
    this.log(`生成约束: ${finalConstraints.length} 个 (可验证: ${finalVerifiable}, 指导性: ${finalGuidance})`);

    return { decision, constraints: finalConstraints };
  }

  private async callAIWithRetry(prompt: string): Promise<{
    decision: AIConstraintDecision;
    parseSuccess: boolean;
    attempts: number;
  }> {
    let lastDecision = DEFAULT_DECISION;
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
      this.log(`AI 调用尝试 ${attempt}/${CONFIG.MAX_RETRIES}...`);
      const startTime = Date.now();

      try {
        const response = await this.aiClient.generate('', prompt, CONFIG.MAX_TOKENS);
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        this.log(`AI 响应: ${response?.length || 0}字符, ${duration}秒`);

        if (!response || response.length < CONFIG.MIN_VALID_RESPONSE_LENGTH) {
          lastError = !response ? '响应为空' : `响应过短 (${response.length}字符)`;
          this.log(`${lastError}，准备重试...`, 'warn');
          if (response) this.log(`响应内容: ${safeStringify(response, 200)}`, 'warn');
          await this.sleep(CONFIG.RETRY_DELAY_MS);
          continue;
        }

        const decision = robustParseJson<AIConstraintDecision>(response, DEFAULT_DECISION);

        if (this.isValidDecision(decision)) {
          return { decision, parseSuccess: true, attempts: attempt };
        }

        lastDecision = this.mergeWithDefault(decision);
        lastError = '解析不完整';
        this.log(`JSON 解析不完整，准备重试...`, 'warn');
        this.log(`解析结果: ${safeStringify(decision, 300)}`, 'warn');

      } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        lastError = (error as Error).message;
        logger.error(`AI 调用失败 (${duration}秒)`, error, {
          method: 'callAIWithRetry',
          additionalInfo: { attempt, maxRetries: CONFIG.MAX_RETRIES },
        });
      }

      if (attempt < CONFIG.MAX_RETRIES) {
        const delay = CONFIG.RETRY_DELAY_MS * attempt;
        this.log(`等待 ${delay}ms 后重试...`);
        await this.sleep(delay);
      }
    }

    this.log(`所有 ${CONFIG.MAX_RETRIES} 次尝试都失败，最后错误: ${lastError}`, 'error');
    return { decision: lastDecision, parseSuccess: false, attempts: CONFIG.MAX_RETRIES };
  }

  private isValidDecision(decision: AIConstraintDecision): boolean {
    if (decision.summary === '使用默认决策' || decision.summary === '默认值') {
      return false;
    }
    const hasRhythm = decision.rhythm.faceSlap.reason !== '默认值' ||
      decision.rhythm.plotTwist.reason !== '默认值' ||
      decision.rhythm.boss.reason !== '默认值';
    return hasRhythm || decision.summary.length > 5;
  }

  private mergeWithDefault(partial: AIConstraintDecision): AIConstraintDecision {
    const p: any = partial;
    return {
      rhythm: {
        faceSlap: mergeRhythmDecision(p.rhythm?.faceSlap, DEFAULT_DECISION.rhythm.faceSlap),
        plotTwist: mergeRhythmDecision(p.rhythm?.plotTwist, DEFAULT_DECISION.rhythm.plotTwist),
        boss: mergeRhythmDecision(p.rhythm?.boss, DEFAULT_DECISION.rhythm.boss),
        guidanceNotes: p.rhythm?.guidanceNotes || [],
      },
      foreshadowing: {
        mustResolve: (p.foreshadowing?.mustResolve || []).map((f: any) => ({
          ...f,
          methodology: f.methodology || [],
          validationCriteria: f.validationCriteria || [],
        })),
        canResolve: p.foreshadowing?.canResolve || [],
        shouldIgnore: p.foreshadowing?.shouldIgnore || [],
      },
      cliffhanger: p.cliffhanger || null,
      characterStates: (partial.characterStates || []).map((cs: any) => ({
        name: cs.name || cs.character || cs.actor || '未知角色',
        condition: cs.condition || cs.state || cs.status || '未知状态',
        mustShow: cs.mustShow !== undefined ? cs.mustShow : true,
        reason: cs.reason || cs.why || '需要体现角色状态',
      })),
      worldConsistency: (partial.worldConsistency || []).map((wc: any) => ({
        content: wc.content || wc.constraint || wc.text || '一致性约束',
        severity: wc.severity || wc.level || 'important',
        reason: wc.reason || wc.why || '维护世界观一致性',
      })),
      summary: partial.summary || '部分解析成功',
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private buildPrompt(context: UnifiedConstraintContext): string {
    let characterStates = '无';
    if (context.worldState?.characters) {
      const chars: string[] = [];
      context.worldState.characters.forEach((c) => {
        if (c.physicalCondition !== '正常' || c.mentalCondition !== '正常') {
          const parts = [c.name];
          if (c.physicalCondition !== '正常') parts.push(`身:${c.physicalCondition}`);
          if (c.mentalCondition !== '正常') parts.push(`心:${c.mentalCondition}`);
          chars.push(parts.join('/'));
        }
      });
      if (chars.length > 0) characterStates = chars.slice(0, 5).join('; ');
    }

    let foreshadowings = '无';
    const planted = context.worldState?.foreshadowings?.planted;
    if (planted && planted.length > 0) {
      foreshadowings = planted.slice(0, 5).map((f, i) => {
        const age = context.currentEpisode - f.episodePlanted;
        return `${i + 1}.第${f.episodePlanted}集埋下(已${age}集) ${f.content.slice(0, 50)}`;
      }).join('\n');
    }

    let previousCliffhanger = '无';
    const cliffhangers = context.worldState?.plotState?.cliffhangers;
    if (cliffhangers) {
      const unresolved = cliffhangers.filter(c => !c.resolved);
      if (unresolved.length > 0) {
        previousCliffhanger = unresolved[unresolved.length - 1].content.slice(0, 50);
      }
    }

    let recentEvents = '无';
    const events = context.worldState?.plotState?.recentEvents;
    if (events && events.length > 0) {
      recentEvents = events.slice(-3).map(e => `${e.episode}集:${e.event.slice(0, 20)}`).join('; ');
    }

    const faceSlapsAgo = context.currentEpisode - context.rhythmTracking.lastFaceSlap;
    const plotTwistsAgo = context.currentEpisode - context.rhythmTracking.lastPlotTwist;
    const bossAgo = context.currentEpisode - context.rhythmTracking.lastBoss;

    return COMPACT_PROMPT
      .replace('{projectName}', context.projectName)
      .replace('{projectType}', context.projectType)
      .replace('{currentEpisode}', String(context.currentEpisode))
      .replace('{totalEpisodes}', String(context.totalEpisodes))
      .replace('{episodePlan}', context.episodePlan.slice(0, 500))
      .replace('{lastFaceSlap}', String(context.rhythmTracking.lastFaceSlap))
      .replace('{faceSlapsAgo}', String(faceSlapsAgo))
      .replace('{lastPlotTwist}', String(context.rhythmTracking.lastPlotTwist))
      .replace('{plotTwistsAgo}', String(plotTwistsAgo))
      .replace('{lastBoss}', String(context.rhythmTracking.lastBoss))
      .replace('{bossAgo}', String(bossAgo))
      .replace('{faceSlappingFrequency}', String(context.userPreferences.rhythmParams.faceSlappingFrequency))
      .replace('{plotTwistFrequency}', String(context.userPreferences.rhythmParams.plotTwistFrequency))
      .replace('{bossInterval}', String(context.userPreferences.rhythmParams.bossInterval))
      .replace('{characterStates}', characterStates)
      .replace('{foreshadowings}', foreshadowings)
      .replace('{previousCliffhanger}', previousCliffhanger)
      .replace('{recentEvents}', recentEvents)
      .replace('{multiHeadInsights}', context.multiHeadInsights && context.multiHeadInsights.length > 0
        ? context.multiHeadInsights.join('; ').slice(0, 500)
        : '无');
  }

  private convertToUnifiedConstraints(decision: AIConstraintDecision, currentEpisode: number): UnifiedConstraint[] {
    const constraints: UnifiedConstraint[] = [];
    let id = 1;
    const ctx = `第${currentEpisode}集`;

    // 节奏约束（打脸、反转、Boss）
    for (const { key, type, label } of RHYTHM_TYPES) {
      const rd = decision.rhythm[key];
      if (!rd.needed) continue;
      constraints.push({
        id: `ucm-${id++}`,
        type,
        content: this.formatRhythmContent(label, rd),
        severity: urgencyToSeverity(rd.urgency),
        source: 'unified-ai',
        context: `${ctx} urgency=${rd.urgency || 'medium'}`,
        category: 'verifiable',
        subject: type === 'faceSlapping' ? (rd.subject || '主角') : rd.subject,
        object: rd.object,
        methodology: rd.methodology || [],
        validationCriteria: rd.validationCriteria || [],
      });
    }

    // 指导性约束
    for (const note of decision.rhythm.guidanceNotes || []) {
      if (!note) continue;
      constraints.push({
        id: `ucm-${id++}`,
        type: 'rhythm',
        content: note,
        severity: 'normal',
        source: 'unified-ai',
        category: 'guidance',
      });
    }

    // 伏笔约束 - mustResolve
    for (const f of decision.foreshadowing.mustResolve || []) {
      if (!f?.content) {
        this.log(`跳过无效的 mustResolve 伏笔: ${safeStringify(f, 50)}`, 'warn');
        continue;
      }
      constraints.push({
        id: `ucm-${id++}`,
        type: 'foreshadowing',
        content: this.formatForeshadowingContent(f),
        severity: priorityToSeverity(f.priority),
        source: 'unified-ai',
        context: `优先级${f.priority || 50}: ${f.reason || '无'}`,
        category: 'verifiable',
        subject: '剧本',
        object: f.content,
        methodology: f.methodology || [],
        validationCriteria: f.validationCriteria || [],
        episodePlanted: f.episodePlanted,
        originalHint: f.originalHint,
      });
    }

    // 伏笔约束 - canResolve
    for (const f of decision.foreshadowing.canResolve || []) {
      if (!f?.content) {
        this.log(`跳过无效的 canResolve 伏笔: ${safeStringify(f, 50)}`, 'warn');
        continue;
      }
      constraints.push({
        id: `ucm-${id++}`,
        type: 'foreshadowing',
        content: `【可选伏笔】${f.content}`,
        severity: 'normal',
        source: 'unified-ai',
        context: f.reason || '无',
        category: 'guidance',
      });
    }

    // 悬念约束
    if (decision.cliffhanger?.mustAddress && decision.cliffhanger.content) {
      constraints.push({
        id: `ucm-${id++}`,
        type: 'cliffhanger',
        content: `【悬念】${decision.cliffhanger.content}`,
        severity: 'critical',
        source: 'unified-ai',
        context: decision.cliffhanger.howToAddress || '需要承接',
        category: 'verifiable',
      });
    }

    // 角色状态约束
    for (const char of decision.characterStates || []) {
      if (!char?.name || !char?.condition) {
        this.log(`跳过无效的角色状态: ${safeStringify(char, 50)}`, 'warn');
        continue;
      }
      if (char.mustShow) {
        constraints.push({
          id: `ucm-${id++}`,
          type: 'characterState',
          content: `【角色】${char.name}:${char.condition}`,
          severity: 'important',
          source: 'unified-ai',
          context: char.reason || '需要体现',
          category: 'verifiable',
        });
      }
    }

    // 世界一致性约束
    for (const w of decision.worldConsistency || []) {
      if (!w?.content) {
        this.log(`跳过无效的一致性约束: ${safeStringify(w, 50)}`, 'warn');
        continue;
      }
      constraints.push({
        id: `ucm-${id++}`,
        type: 'continuity',
        content: w.content,
        severity: w.severity || 'normal',
        source: 'unified-ai',
        context: w.reason || '保持一致性',
        category: 'verifiable',
      });
    }

    return constraints;
  }

  private formatRhythmContent(label: string, decision: EnhancedRhythmDecision): string {
    let content = `【${label}】`;
    if (decision.subject && decision.object) {
      content += `${decision.subject} → ${decision.object}`;
    } else if (decision.subject) {
      content += decision.subject;
    }
    content += `\n原因: ${decision.reason || '需要' + label + '场景'}`;
    content += formatMethodologyAndCriteria(decision.methodology, decision.validationCriteria);
    return content;
  }

  private formatForeshadowingContent(f: EnhancedForeshadowingDecision): string {
    let content = `【伏笔回收】${f.content}`;
    if (f.episodePlanted) content += `\n埋藏于第${f.episodePlanted}集`;
    if (f.originalHint) content += `\n原文线索: ${f.originalHint}`;
    content += `\n原因: ${f.reason || '需要回收'}`;
    content += formatMethodologyAndCriteria(f.methodology, f.validationCriteria);
    return content;
  }
}

export default UnifiedConstraintManager;
