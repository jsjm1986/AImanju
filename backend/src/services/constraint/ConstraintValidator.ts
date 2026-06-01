import { createLogger, safeGet, safeStringify } from '../../utils/errorLogger';
import { robustParseJson } from '../../utils/jsonParser';
import { AIClient, aiClient } from '../ai/AIClient';

const logger = createLogger('ConstraintValidator');

export type ConstraintType =
  | 'faceSlapping'      // 打脸场景
  | 'plotTwist'         // 剧情反转
  | 'foreshadowing'     // 伏笔回收
  | 'cliffhanger'       // 悬念承接
  | 'characterState'    // 角色状态一致性
  | 'boss'              // Boss/反派出场
  | 'coolPoint'         // 爽点
  | 'rhythm'            // 节奏控制
  | 'continuity'        // 连续性（上集悬念承接等）
  | 'methodology';      // 叙事科学方法论

export type ConstraintSeverity = 'critical' | 'important' | 'normal';

export type ConstraintCategory = 'verifiable' | 'guidance';

export interface Constraint {
  id: string;
  type: ConstraintType;
  content: string;
  severity: ConstraintSeverity;
  source: string;  // 约束来源（如 'rhythm', 'worldState', 'foreshadowing' 等）
  context?: string; // 额外上下文信息
  category: ConstraintCategory; // 约束类别：verifiable（可验证）或 guidance（仅指导）
  // 🆕 结构化字段 - AI生成
  subject?: string;  // 执行者
  object?: string;   // 对象
  methodology?: string[];  // 实现方法
  validationCriteria?: string[];  // 验证标准
  episodePlanted?: number;  // 伏笔埋藏集数
  originalHint?: string;    // 原文线索
}

export interface ConstraintValidationResult {
  constraintId: string;
  constraintType: ConstraintType;
  constraintContent: string;
  fulfilled: boolean;
  confidence: number;  // 0-1.0
  evidence: string | null;  // 剧本中满足约束的具体证据
  reasoning: string;
  severity: ConstraintSeverity;
  suggestions?: string[];  // 如果未满足，给出的改进建议
}

export interface ValidationResponse {
  overallSatisfied: boolean;
  satisfactionRate: number;  // 0-1.0
  criticalViolations: number;
  importantViolations: number;
  normalViolations: number;
  results: ConstraintValidationResult[];
  summary: string;
  improvementSuggestions: string[];
}

const CONSTRAINT_VALIDATION_PROMPT = `你是剧本约束验证专家。请严格验证剧本是否满足给定的约束条件。

【剧本内容】
{scriptContent}

【需要验证的约束】
{constraints}

【验证要求】
1. 对每个约束进行独立验证
2. 必须在剧本中找到具体的文字证据
3. 判断置信度（confidence）：
   - 1.0: 完全确定满足/不满足
   - 0.7-0.9: 高度确信
   - 0.5-0.7: 可能满足
   - <0.5: 不确定或可能不满足
4. 对于 severity 为 critical 的约束要格外严格
5. 如果未满足，必须给出具体的改进建议

【evidence 字段要求 - 非常重要】
- 如果约束**满足**：evidence 应包含剧本中证明满足的具体内容
- 如果约束**未满足**：evidence 必须包含**剧本中使用的错误内容**
  例如：约束要求使用"万象系统"，但剧本使用了"神明降临"
  → evidence 应该是："使用了'神明降临'而非'万象系统'"
- evidence 是供重试时告诉生成AI哪里错了的关键信息

【suggestions 字段要求】
- 如果约束未满足，suggestions 必须给出**具体可执行的修正建议**
- 不要使用模糊的建议如"需要改进"
- 应该是具体的如："将'神明降临'替换为'万象系统激活'"

【JSON格式要求 - 非常重要】
- 所有字符串值必须使用英文双引号 "
- 字符串内部的引号必须转义为 \\"
- 字符串内部不能有换行，用 \\n 代替
- reasoning 字段限制在100字以内
- evidence 字段限制在80字以内（增加长度以包含更多细节）
- suggestions 数组每项限制在80字以内

请输出 JSON 格式：

\`\`\`json
{
  "overallSatisfied": true,
  "satisfactionRate": 0.8,
  "criticalViolations": 0,
  "importantViolations": 0,
  "normalViolations": 0,
  "results": [
    {
      "constraintId": "约束ID",
      "constraintType": "faceSlapping",
      "constraintContent": "约束内容简述",
      "fulfilled": true,
      "confidence": 0.9,
      "evidence": "剧本证据或错误内容（80字内）",
      "reasoning": "判断理由（100字内）",
      "severity": "critical",
      "suggestions": ["具体的修正建议"]
    }
  ],
  "summary": "整体验证总结（100字内）",
  "improvementSuggestions": ["总体改进建议"]
}
\`\`\`

【重要】
- 验证必须基于剧本实际内容，不能假设或推断
- "打脸"需要有明确的被打脸方的失败/尴尬描写
- "反转"需要有与预期相反的剧情发展
- "伏笔回收"需要明确提及之前埋下的线索
- "悬念承接"需要对上集结尾进行延续
- 对于角色状态约束，需要检查角色的装备、能力、伤势等是否一致
- 如果约束中指定了特定术语/名称，必须检查剧本是否使用了该术语
- 输出必须是有效的JSON格式，不要在字符串中使用未转义的引号或换行`;

/**
 * 默认验证响应
 */
function parseRhythmType(content: string): { type: ConstraintType; severity: ConstraintSeverity } {
  if (content.includes('打脸')) return { type: 'faceSlapping', severity: 'important' };
  if (content.includes('反转')) return { type: 'plotTwist', severity: 'important' };
  if (content.includes('Boss') || content.includes('反派')) return { type: 'boss', severity: 'important' };
  if (content.includes('爽点')) return { type: 'coolPoint', severity: 'normal' };
  return { type: 'rhythm', severity: 'important' };
}

const DEFAULT_VALIDATION_RESPONSE: ValidationResponse = {
  overallSatisfied: false,
  satisfactionRate: 0,
  criticalViolations: 0,
  importantViolations: 0,
  normalViolations: 0,
  results: [],
  summary: '验证失败',
  improvementSuggestions: [],
};

/**
 * 约束验证器
 */
export class ConstraintValidator {
  private aiClient: AIClient;
  private maxRetries: number;

  constructor(aiClientInstance?: AIClient, maxRetries: number = 2) {
    this.aiClient = aiClientInstance || aiClient;
    this.maxRetries = maxRetries;
  }

  /**
   * 验证剧本是否满足约束
   * 注意：只验证 category === 'verifiable' 的约束
   */
  async validateConstraints(
    scriptContent: string,
    constraints: Constraint[]
  ): Promise<ValidationResponse> {
    // 输入验证
    if (!scriptContent || scriptContent.trim().length === 0) {
      logger.warn('剧本内容为空，跳过验证');
      return {
        ...DEFAULT_VALIDATION_RESPONSE,
        overallSatisfied: true,
        summary: '剧本内容为空，跳过验证',
      };
    }

    if (!constraints || !Array.isArray(constraints)) {
      logger.warn('约束列表无效', { type: typeof constraints, value: constraints });
      return {
        ...DEFAULT_VALIDATION_RESPONSE,
        overallSatisfied: true,
        summary: '约束列表无效，跳过验证',
      };
    }

    // 过滤有效约束并分类
    const validConstraints = constraints.filter(c => {
      if (!c) {
        logger.warn('发现空约束对象');
        return false;
      }
      if (!c.content) {
        logger.warn('约束缺少 content 字段', { id: c.id, type: c.type });
        return false;
      }
      return true;
    });

    const verifiableConstraints = validConstraints.filter(c => c.category === 'verifiable');
    const guidanceConstraints = validConstraints.filter(c => c.category === 'guidance');

    logger.info('约束统计', {
      总数: constraints.length,
      有效: validConstraints.length,
      可验证: verifiableConstraints.length,
      指导性: guidanceConstraints.length,
    });

    if (verifiableConstraints.length === 0) {
      logger.info('无可验证约束，跳过验证');
      return {
        overallSatisfied: true,
        satisfactionRate: 1.0,
        criticalViolations: 0,
        importantViolations: 0,
        normalViolations: 0,
        results: [],
        summary: '无可验证约束',
        improvementSuggestions: [],
      };
    }

    const constraintsText = verifiableConstraints
      .map((c, i) => {
        const id = safeGet(c, 'id', 'unknown');
        const type = safeGet(c, 'type', 'unknown');
        const severity = safeGet(c, 'severity', 'normal');
        const content = safeGet(c, 'content', '(无内容)');
        const context = safeGet(c, 'context', '');

        let text = `${i + 1}. [${id}] (${type}, ${severity})`;
        if (c.subject && c.object) text += `\n   场景: ${c.subject} → ${c.object}`;
        text += `\n   内容: ${content}`;
        if (context) text += `\n   上下文: ${context}`;
        if (c.validationCriteria?.length) {
          text += `\n   验证标准:`;
          for (const v of c.validationCriteria) text += `\n     - ${v}`;
        }
        return text;
      })
      .join('\n\n');

    const prompt = CONSTRAINT_VALIDATION_PROMPT
      .replace('{scriptContent}', scriptContent)
      .replace('{constraints}', constraintsText);

    try {
      logger.info(`开始验证 ${verifiableConstraints.length} 个可验证约束`);

      // 详细列出要验证的约束
      verifiableConstraints.forEach((c, i) => {
        const content = safeGet(c, 'content', '(无内容)');
        const severity = safeGet(c, 'severity', 'normal');
        const type = safeGet(c, 'type', 'unknown');
        logger.info(`  ${i + 1}. [${severity}] ${type}: ${safeStringify(content, 50)}`);
      });

      const startTime = Date.now();
      const response = await this.aiClient.generate('', prompt, 8000);
      const aiDuration = Date.now() - startTime;

      logger.info(`AI 验证完成`, { 耗时: `${(aiDuration / 1000).toFixed(1)}秒`, 响应长度: response.length });

      // 检查响应是否有效
      if (!response || response.length < 50) {
        logger.warn('AI 响应过短或为空', { 长度: response?.length || 0 });
        return {
          ...DEFAULT_VALIDATION_RESPONSE,
          summary: 'AI 响应无效',
        };
      }

      const result = robustParseJson<ValidationResponse>(response, DEFAULT_VALIDATION_RESPONSE);

      // 验证解析结果
      if (!result.results || !Array.isArray(result.results)) {
        logger.warn('解析结果缺少 results 数组', { result: safeStringify(result, 200) });
        result.results = [];
      }

      // 统计违规和满足率
      const violations: Record<string, number> = { critical: 0, important: 0, normal: 0 };
      let fulfilledCount = 0;
      for (const r of result.results) {
        if (!r) continue;
        if (r.fulfilled) fulfilledCount++;
        else if (r.severity in violations) violations[r.severity]++;
      }
      result.criticalViolations = violations.critical;
      result.importantViolations = violations.important;
      result.normalViolations = violations.normal;
      result.satisfactionRate = verifiableConstraints.length > 0
        ? fulfilledCount / verifiableConstraints.length
        : 1.0;

      const importantResults = result.results.filter((r) => r && r.severity === 'important');
      const importantFulfilled = importantResults.filter((r) => r && r.fulfilled).length;
      const importantRate = importantResults.length > 0
        ? importantFulfilled / importantResults.length
        : 1.0;

      result.overallSatisfied = result.criticalViolations === 0 &&
        (importantResults.length === 0 || importantRate >= 0.5);

      logger.info('验证结果汇总', {
        满足率: `${(result.satisfactionRate * 100).toFixed(1)}%`,
        Critical违规: result.criticalViolations,
        Important违规: result.importantViolations,
        Important满足率: `${(importantRate * 100).toFixed(1)}%`,
        Normal违规: result.normalViolations,
        整体判定: result.overallSatisfied ? '通过' : '未通过',
      });

      // 详细输出每个约束的验证结果
      result.results.forEach((r) => {
        if (!r) return;
        const status = r.fulfilled ? '✓' : '✗';
        const severity = safeGet(r, 'severity', 'normal');
        const type = safeGet(r, 'constraintType', 'unknown');
        logger.info(`  ${status} [${severity}] ${type}: ${r.fulfilled ? '满足' : '未满足'}`);
        if (!r.fulfilled && r.reasoning) {
          logger.info(`    原因: ${safeStringify(r.reasoning, 100)}`);
        }
      });

      return result;
    } catch (error) {
      logger.error('验证过程出错', error, {
        method: 'validateConstraints',
        additionalInfo: {
          约束数量: verifiableConstraints.length,
          剧本长度: scriptContent.length,
        },
      });
      return {
        ...DEFAULT_VALIDATION_RESPONSE,
        summary: `验证过程出错: ${(error as Error).message}`,
      };
    }
  }

  shouldRegenerate(validation: ValidationResponse): {
    shouldRegenerate: boolean;
    reason: string;
    priority: 'forced' | 'recommended' | 'none';
    unfulfilledConstraints: ConstraintValidationResult[];
  } {
    if (!validation) {
      return { shouldRegenerate: true, reason: '验证结果为空，需要重试', priority: 'forced', unfulfilledConstraints: [] };
    }

    const results = validation.results || [];

    // 验证过程出错时强制重试
    if (results.length === 0 && !validation.overallSatisfied) {
      return { shouldRegenerate: true, reason: validation.summary || '验证过程出错，需要重试', priority: 'forced', unfulfilledConstraints: [] };
    }

    const unfulfilled = results.filter((r) => r && !r.fulfilled);

    const severityRate = (severity: ConstraintSeverity) => {
      const group = results.filter((r) => r && r.severity === severity);
      const fulfilled = group.filter((r) => r && r.fulfilled).length;
      return { group, rate: group.length > 0 ? fulfilled / group.length : 1.0 };
    };

    // Critical 约束未满足 → 强制重新生成
    if (validation.criticalViolations > 0) {
      return {
        shouldRegenerate: true,
        reason: `存在 ${validation.criticalViolations} 个关键约束未满足`,
        priority: 'forced',
        unfulfilledConstraints: unfulfilled.filter((r) => r.severity === 'critical'),
      };
    }

    // Important 满足率 < 50% 且数量 >= 2 → 建议重新生成
    const important = severityRate('important');
    if (important.group.length >= 2 && important.rate < 0.5) {
      return {
        shouldRegenerate: true,
        reason: `重要约束满足率过低 (${(important.rate * 100).toFixed(0)}%)`,
        priority: 'recommended',
        unfulfilledConstraints: unfulfilled.filter((r) => r.severity === 'important'),
      };
    }

    // Normal 满足率 < 30% 且数量 >= 3 → 建议重新生成
    const normal = severityRate('normal');
    if (normal.group.length >= 3 && normal.rate < 0.3) {
      return {
        shouldRegenerate: true,
        reason: `普通约束满足率过低 (${(normal.rate * 100).toFixed(0)}%)`,
        priority: 'recommended',
        unfulfilledConstraints: unfulfilled.filter((r) => r.severity === 'normal'),
      };
    }

    return { shouldRegenerate: false, reason: '约束满足度可接受', priority: 'none', unfulfilledConstraints: unfulfilled };
  }

  strengthenConstraints(
    originalConstraints: Constraint[],
    unfulfilledResults: ConstraintValidationResult[]
  ): Constraint[] {
    if (!originalConstraints || !Array.isArray(originalConstraints)) return [];
    if (!unfulfilledResults || !Array.isArray(unfulfilledResults)) return originalConstraints;

    const unfulfilledIds = new Set(
      unfulfilledResults.filter(r => r?.constraintId).map((r) => r.constraintId)
    );

    return originalConstraints.filter(Boolean).map(constraint => {
      if (!unfulfilledIds.has(constraint.id)) return constraint;

      const result = unfulfilledResults.find((r) => r?.constraintId === constraint.id);
      return {
        ...constraint,
        content: this.createStrengthenedConstraint(constraint, result),
        severity: constraint.severity === 'normal' ? 'important' : constraint.severity,
        context: `【首次生成未满足，请务必满足】原因: ${safeGet(result, 'reasoning', '未知')}`,
      };
    });
  }

  /**
   * 约束类型对应的改写方法论建议
   */
  private static readonly CONSTRAINT_METHODOLOGIES: Record<ConstraintType, string[]> = {
    faceSlapping: [
      '可以让反派先嘲讽/轻视主角，然后主角用实力或智慧反击',
      '可以安排一个自大的配角提出挑战，结果被轻松碾压',
      '可以让之前看不起主角的人见证主角实力后震惊',
    ],
    plotTwist: [
      '可以揭示某个角色的隐藏身份或目的',
      '可以让看似失败的情况突然逆转',
      '可以引入意外的盟友或敌人',
    ],
    boss: [
      '可以让Boss级对手首次展示压倒性实力',
      '可以安排强敌发出挑战或威胁',
      '可以让主角遭遇明显高于当前层次的对手',
    ],
    foreshadowing: [
      '可以通过对话或物品自然引出之前埋下的线索',
      '可以让角色无意中提及与伏笔相关的信息',
      '可以通过场景描写呼应之前的伏笔',
    ],
    cliffhanger: [
      '在开头直接承接上集悬念，给出部分解答或新发展',
      '可以用角色反应或对话回顾上集结尾',
      '可以从悬念的直接后果开始叙述',
    ],
    characterState: [
      '通过角色对话或内心独白体现当前状态',
      '通过动作描写反映角色的身体/精神状态',
      '通过其他角色的反应侧面展示',
    ],
    coolPoint: [
      '安排主角展示新能力或突破',
      '设计精彩的对决或智斗场景',
      '创造让读者感到畅快的情节转折',
    ],
    rhythm: [
      '调整场景节奏，增加或减少冲突密度',
      '平衡对话与动作的比例',
    ],
    continuity: [
      '确保与前文设定保持一致',
      '检查角色装备、能力、位置等延续性',
    ],
    methodology: [
      '精简对白，每句控制在15字以内',
      '开场立即制造冲突或悬念',
      '设计多层次的情绪回报点',
    ],
  };

  private createStrengthenedConstraint(
    constraint: Constraint,
    validationResult?: ConstraintValidationResult
  ): string {
    const aiSuggestions = validationResult?.suggestions?.join('; ') || '';
    const methodologies = ConstraintValidator.CONSTRAINT_METHODOLOGIES[constraint.type] || [];
    const selectedMethodology = methodologies.slice(0, 2).join('；');

    const strengthenPrefixes: Record<ConstraintType, string> = {
      faceSlapping: '【必须包含明确的打脸场景】',
      plotTwist: '【必须包含剧情反转】',
      foreshadowing: '【必须明确回收此伏笔】',
      cliffhanger: '【必须承接上集悬念】',
      characterState: '【必须保持角色状态一致】',
      boss: '【必须安排Boss/反派出场】',
      coolPoint: '【必须包含爽点设计】',
      rhythm: '【必须满足节奏要求】',
      continuity: '【必须保持剧情连续性】',
      methodology: '【必须符合叙事科学方法论】',
    };

    let result = `${strengthenPrefixes[constraint.type] || '【必须满足】'} ${constraint.content || '(无内容)'}`;
    if (selectedMethodology) result += `\n   方法论建议：${selectedMethodology}`;
    if (aiSuggestions) result += `\n   AI建议：${aiSuggestions}`;
    return result;
  }

  static collectConstraints(params: {
    rhythmConstraints?: string[];
    worldStateConstraints?: string[];
    foreshadowingConstraints?: Array<{ content: string; importance: string; episodePlanted: number }>;
    previousCliffhanger?: string | null;
    characterStateConstraints?: Array<{ name: string; condition: string }>;
    customConstraints?: string[];
    currentEpisode: number;
  }): Constraint[] {
    const constraints: Constraint[] = [];
    let idCounter = 1;

    if (params.rhythmConstraints) {
      for (const content of params.rhythmConstraints) {
        const { type, severity } = parseRhythmType(content);
        constraints.push({
          id: `rhythm-${idCounter++}`,
          type, content, severity,
          source: 'rhythm',
          category: 'verifiable',
        });
      }
    }

    if (params.foreshadowingConstraints) {
      for (const f of params.foreshadowingConstraints) {
        const age = params.currentEpisode - f.episodePlanted;
        const threshold = f.importance === 'high' ? 10 : f.importance === 'normal' ? 20 : 30;
        const isOverdue = age > threshold;

        constraints.push({
          id: `foreshadowing-${idCounter++}`,
          type: 'foreshadowing',
          content: f.content,
          severity: isOverdue ? 'critical' : (f.importance === 'high' ? 'important' : 'normal'),
          source: 'foreshadowing',
          context: `第${f.episodePlanted}集埋下，已${age}集${isOverdue ? '（已超期！）' : ''}`,
          category: 'verifiable',
        });
      }
    }

    if (params.previousCliffhanger) {
      constraints.push({
        id: `cliffhanger-${idCounter++}`,
        type: 'cliffhanger',
        content: `必须在开头自然承接前情悬念（不要在正文写"上集"等字眼）：${params.previousCliffhanger}`,
        severity: 'critical',
        source: 'continuity',
        context: '前情悬念，本集开头必须延续',
        category: 'verifiable',
      });
    }

    if (params.characterStateConstraints) {
      for (const c of params.characterStateConstraints) {
        constraints.push({
          id: `character-${idCounter++}`,
          type: 'characterState',
          content: `${c.name}的状态必须体现：${c.condition}`,
          severity: 'important',
          source: 'worldState',
          category: 'verifiable',
        });
      }
    }

    if (params.worldStateConstraints) {
      for (const content of params.worldStateConstraints) {
        const isCritical = content.includes('必须') || content.includes('强制');

        constraints.push({
          id: `worldState-${idCounter++}`,
          type: 'continuity',
          content,
          severity: isCritical ? 'critical' : 'important',
          source: 'worldState',
          category: 'verifiable',
        });
      }
    }

    if (params.customConstraints) {
      for (const content of params.customConstraints) {
        constraints.push({
          id: `custom-${idCounter++}`, type: 'rhythm', content,
          severity: 'normal', source: 'custom', category: 'verifiable',
        });
      }
    }

    return constraints;
  }

  static collectConstraintsV2(params: {
    rhythmConstraints?: string[];
    worldStateConstraints?: string[];
    // 优化后的伏笔约束
    optimizedForeshadowings?: {
      verifiable: Array<{
        id: string;
        content: string;
        importance: string;
        episodePlanted: number;
        priority: number;
      }>;
      guidance: Array<{
        id: string;
        content: string;
        importance: string;
      }>;
    };
    previousCliffhanger?: string | null;
    characterStateConstraints?: Array<{ name: string; condition: string }>;
    customConstraints?: string[];
    currentEpisode: number;
    // 配置
    maxVerifiableConstraints?: number;  // 最大可验证约束数，默认30
  }): Constraint[] {
    const constraints: Constraint[] = [];
    let idCounter = 1;
    const maxVerifiable = params.maxVerifiableConstraints || 30;

    // 统计各类约束数量
    let verifiableCount = 0;

    // 1. 悬念承接约束（最高优先级，critical）
    if (params.previousCliffhanger) {
      constraints.push({
        id: `cliffhanger-${idCounter++}`,
        type: 'cliffhanger',
        content: `必须在开头自然承接前情悬念（不要在正文写"上集"等字眼）：${params.previousCliffhanger}`,
        severity: 'critical',
        source: 'continuity',
        context: '前情悬念，本集开头必须延续',
        category: 'verifiable',
      });
      verifiableCount++;
    }

    if (params.rhythmConstraints) {
      for (const content of params.rhythmConstraints) {
        if (verifiableCount >= maxVerifiable) break;
        const { type, severity } = parseRhythmType(content);
        constraints.push({
          id: `rhythm-${idCounter++}`,
          type, content, severity,
          source: 'rhythm',
          category: 'verifiable',
        });
        verifiableCount++;
      }
    }

    // 3. 优化后的伏笔约束（可验证）
    if (params.optimizedForeshadowings?.verifiable) {
      // 按优先级排序
      const sorted = [...params.optimizedForeshadowings.verifiable]
        .sort((a, b) => b.priority - a.priority);

      for (const f of sorted) {
        if (verifiableCount >= maxVerifiable) break;

        const age = params.currentEpisode - f.episodePlanted;
        const severityMap: Record<string, ConstraintSeverity> = {
          critical: 'critical',
          high: 'important',
          normal: 'normal',
          low: 'normal',
        };

        constraints.push({
          id: `foreshadowing-${f.id}`,
          type: 'foreshadowing',
          content: f.content,
          severity: severityMap[f.importance] || 'normal',
          source: 'foreshadowing',
          context: `第${f.episodePlanted}集埋下，已${age}集，优先级:${f.priority}`,
          category: 'verifiable',
        });
        verifiableCount++;
      }
    }

    // 4. 伏笔约束（仅指导性，不验证）
    if (params.optimizedForeshadowings?.guidance) {
      for (const f of params.optimizedForeshadowings.guidance) {
        constraints.push({
          id: `foreshadowing-guidance-${f.id}`,
          type: 'foreshadowing',
          content: f.content,
          severity: 'normal',
          source: 'foreshadowing',
          context: '可选回收，仅供参考',
          category: 'guidance',  // 不验证
        });
      }
    }

    // 辅助：超过 maxVerifiable 时降级为 guidance
    const pushCapped = (base: Omit<Constraint, 'category'>, forceVerifiable = false) => {
      if (verifiableCount >= maxVerifiable && !forceVerifiable) {
        constraints.push({ ...base, severity: 'normal', category: 'guidance' } as Constraint);
      } else {
        constraints.push({ ...base, category: 'verifiable' } as Constraint);
        verifiableCount++;
      }
    };

    if (params.characterStateConstraints) {
      for (const c of params.characterStateConstraints) {
        pushCapped({
          id: `character-${idCounter++}`, type: 'characterState',
          content: `${c.name}的状态必须体现：${c.condition}`,
          severity: 'important', source: 'worldState',
        });
      }
    }

    if (params.worldStateConstraints) {
      for (const content of params.worldStateConstraints) {
        const isCritical = content.includes('必须') || content.includes('强制');
        pushCapped({
          id: `worldState-${idCounter++}`, type: 'continuity', content,
          severity: isCritical ? 'critical' : 'important', source: 'worldState',
        }, isCritical);
      }
    }

    if (params.customConstraints) {
      for (const content of params.customConstraints) {
        pushCapped({
          id: `custom-${idCounter++}`, type: 'rhythm', content,
          severity: 'normal', source: 'custom',
        });
      }
    }

    logger.info('V2约束收集完成', {
      总约束: constraints.length,
      可验证: verifiableCount,
      指导性: constraints.length - verifiableCount,
    });

    return constraints;
  }
}

export default ConstraintValidator;
