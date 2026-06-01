import mongoose from 'mongoose';
import { Foreshadowing, IForeshadowing } from '../../models/Foreshadowing';
import { robustParseJson } from '../../utils/jsonParser';
import { AIClient, aiClient } from '../ai/AIClient';

export interface ForeshadowingContext {
  projectId: string;
  projectName: string;
  projectType: string;
  currentEpisode: number;
  episodePlan: string;
  recentEvents?: string[];
  characterStates?: Array<{ name: string; state: string }>;
  previousCliffhanger?: string;
}

export interface AIDecision {
  constraints: {
    verifiable: Array<{
      id: string;
      content: string;
      reason: string;
      priority: number;
    }>;
    guidance: Array<{
      id: string;
      content: string;
      reason: string;
    }>;
  };
  lifecycle: {
    merge: Array<{
      ids: string[];
      primaryId: string;
      mergedContent: string;
      label: string;
    }>;
    abandon: Array<{ id: string; reason: string }>;
    dormant: Array<{ id: string; reason: string }>;
    awaken: Array<{ id: string; reason: string }>;
  };
  validity: Array<{
    id: string;
    type: 'true_foreshadowing' | 'atmosphere' | 'setup' | 'hook' | 'redundant';
    reason: string;
  }>;
  summary: string;
}

const DEFAULT_DECISION: AIDecision = {
  constraints: { verifiable: [], guidance: [] },
  lifecycle: { merge: [], abandon: [], dormant: [], awaken: [] },
  validity: [],
  summary: '解析失败，使用默认决策',
};

const FORESHADOWING_DECISION_PROMPT = `你是专业的剧本伏笔管理专家。请根据完整上下文，一次性做出所有伏笔相关决策。

=== 项目信息 ===
项目名称：{projectName}
项目类型：{projectType}
当前集数：第 {currentEpisode} 集

=== 本集梗概 ===
{episodePlan}

=== 近期剧情 ===
{recentEvents}

=== 角色状态 ===
{characterStates}

=== 上集悬念 ===
{previousCliffhanger}

=== 所有待处理伏笔 ===
{foreshadowingList}

=== 你的任务 ===

请综合分析以上所有信息，做出以下决策：

1. **约束决策**：本集剧本生成时，哪些伏笔应该作为约束？
   - verifiable（可验证）：必须在剧本中体现，生成后会验证
   - guidance（指导性）：可选参考，不强制验证
   - 建议 verifiable 不超过 10-15 个，避免约束过多

2. **生命周期决策**：
   - merge（合并）：哪些伏笔在描述同一件事，应该合并？
   - abandon（放弃）：哪些不是真正的伏笔，或已过期无意义？
   - dormant（休眠）：哪些与当前剧情无关，暂时不追踪？
   - awaken（唤醒）：哪些休眠伏笔与本集相关，应该唤醒？

3. **有效性判断**：每个伏笔的真实类型
   - true_foreshadowing：真正需要回收的伏笔
   - atmosphere：氛围描写，不需要回收
   - setup：背景铺垫，可选回收
   - hook：悬念钩子，承接即可
   - redundant：与其他伏笔重复

=== 输出格式 ===

请严格输出以下 JSON 格式（不要添加其他内容）：

\`\`\`json
{
  "constraints": {
    "verifiable": [
      { "id": "伏笔ID", "content": "伏笔内容", "reason": "为什么本集必须体现", "priority": 85 }
    ],
    "guidance": [
      { "id": "伏笔ID", "content": "伏笔内容", "reason": "可选参考原因" }
    ]
  },
  "lifecycle": {
    "merge": [
      { "ids": ["id1", "id2"], "primaryId": "保留的主ID", "mergedContent": "合并后的精炼描述", "label": "主题标签如'红绳之谜'" }
    ],
    "abandon": [
      { "id": "伏笔ID", "reason": "放弃原因" }
    ],
    "dormant": [
      { "id": "伏笔ID", "reason": "休眠原因" }
    ],
    "awaken": [
      { "id": "伏笔ID", "reason": "唤醒原因" }
    ]
  },
  "validity": [
    { "id": "伏笔ID", "type": "true_foreshadowing", "reason": "判断理由" }
  ],
  "summary": "一句话总结本次决策要点"
}
\`\`\`

=== 重要原则 ===
1. 约束不是越多越好，要精选与本集最相关的
2. 合并时保留信息最完整的作为主伏笔
3. 超过 20-30 集未回收的伏笔，考虑放弃或休眠
4. 氛围描写（如"远处传来乌鸦叫"）不是真正的伏笔
5. 结尾悬念通常下集承接即可，不一定需要单独回收

=== JSON格式要求 ===
- 所有字符串值必须使用英文双引号 "
- 字符串内部的引号必须转义为 \\"
- 字符串内部不能有换行，用 \\n 代替
- reason 字段限制在50字以内
- content 字段限制在100字以内
- 数组为空时使用 []
- 所有字段都必须有值，不能是 undefined`;

const LOG_FN: Record<string, (...args: unknown[]) => void> = {
  error: console.error,
  warn: console.warn,
  info: console.log,
};

export type LogCallback = (message: string, level?: 'info' | 'warn' | 'error') => void;

export class ForeshadowingManager {
  private projectId: string;
  private aiClient: AIClient;
  private logCallback?: LogCallback;

  constructor(projectId: string, aiClientInstance?: AIClient, logCallback?: LogCallback) {
    this.projectId = projectId;
    this.aiClient = aiClientInstance || aiClient;
    this.logCallback = logCallback;
  }

  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    (LOG_FN[level] ?? console.log)(message);
    this.logCallback?.(message, level);
  }

  async analyzeAndDecide(context: ForeshadowingContext): Promise<{
    decision: AIDecision;
    applied: {
      constraintsSet: number;
      merged: number;
      abandoned: number;
      dormant: number;
      awakened: number;
      validityUpdated: number;
    };
  }> {
    this.log(`[ForeshadowingManager] ===== 开始 AI 决策 (第${context.currentEpisode}集) =====`);

    const foreshadowings = await this.getAllActiveForeshadowings();
    this.log(`[ForeshadowingManager] 待处理伏笔: ${foreshadowings.length} 个`);

    if (foreshadowings.length === 0) {
      this.log(`[ForeshadowingManager] 无待处理伏笔，跳过`);
      return {
        decision: DEFAULT_DECISION,
        applied: { constraintsSet: 0, merged: 0, abandoned: 0, dormant: 0, awakened: 0, validityUpdated: 0 },
      };
    }

    const prompt = this.buildPrompt(context, foreshadowings);
    this.log(`[ForeshadowingManager] 调用 AI 分析...`);
    let decision: AIDecision = DEFAULT_DECISION;
    const MAX_RETRIES = 2;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        this.log(`[ForeshadowingManager] AI 调用尝试 ${attempt}/${MAX_RETRIES}...`);
        const response = await this.aiClient.generate('', prompt, 12000);
        
        if (!response || response.length < 100) {
          this.log(`[ForeshadowingManager] AI 响应过短 (${response?.length || 0}字符)，重试...`, 'warn');
          if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
        }
        
        decision = robustParseJson<AIDecision>(response, DEFAULT_DECISION);
        
        if (this.isValidDecision(decision)) {
          this.log(`[ForeshadowingManager] AI 决策解析成功 (尝试 ${attempt} 次)`);
          this.log(`[ForeshadowingManager] 摘要: ${decision.summary}`);
          break;
        } else if (attempt < MAX_RETRIES) {
          this.log(`[ForeshadowingManager] 解析结果无效，重试...`, 'warn');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        this.log(`[ForeshadowingManager] AI 调用失败 (尝试 ${attempt}): ${(error as Error).message}`, 'error');
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    decision = this.sanitizeDecision(decision);
    const applied = await this.applyDecision(decision, context.currentEpisode);

    this.log(`[ForeshadowingManager] ===== AI 决策完成 =====`);
    this.log(`[ForeshadowingManager] 应用结果: 合并${applied.merged}个, 放弃${applied.abandoned}个, 休眠${applied.dormant}个, 唤醒${applied.awakened}个`);

    return { decision, applied };
  }

  private isValidDecision(decision: AIDecision): boolean {
    if (decision.summary === '解析失败，使用默认决策') return false;
    return decision.summary.length > 5 ||
           decision.constraints.verifiable.length > 0 ||
           decision.constraints.guidance.length > 0 ||
           decision.validity.length > 0;
  }

  private sanitizeDecision(decision: AIDecision): AIDecision {
    return {
      constraints: {
        verifiable: (decision.constraints?.verifiable || []).filter(c => c && c.id && c.content),
        guidance: (decision.constraints?.guidance || []).filter(c => c && c.id && c.content),
      },
      lifecycle: {
        merge: (decision.lifecycle?.merge || []).filter(m => m && m.ids && m.ids.length >= 2),
        abandon: (decision.lifecycle?.abandon || []).filter(a => a && a.id),
        dormant: (decision.lifecycle?.dormant || []).filter(d => d && d.id),
        awaken: (decision.lifecycle?.awaken || []).filter(a => a && a.id),
      },
      validity: (decision.validity || []).filter(v => v && v.id && v.type),
      summary: decision.summary || '决策完成',
    };
  }

  async getConstraints(context: ForeshadowingContext): Promise<{
    verifiable: Array<{ id: string; content: string; priority: number }>;
    guidance: Array<{ id: string; content: string }>;
  }> {
    const { decision } = await this.analyzeAndDecide(context);

    return {
      verifiable: decision.constraints.verifiable.map(c => ({
        id: c.id,
        content: c.content,
        priority: c.priority,
      })),
      guidance: decision.constraints.guidance.map(c => ({
        id: c.id,
        content: c.content,
      })),
    };
  }

  private async getAllActiveForeshadowings(): Promise<IForeshadowing[]> {
    return Foreshadowing.find({
      projectId: new mongoose.Types.ObjectId(this.projectId),
      status: { $in: ['planted', 'dormant'] },
    }).sort({ episodePlanted: 1 }).lean();
  }

  private buildPrompt(context: ForeshadowingContext, foreshadowings: IForeshadowing[]): string {
    const foreshadowingList = foreshadowings.map((f, i) => {
      const age = context.currentEpisode - f.episodePlanted;
      const statusTag = f.status === 'dormant' ? '[休眠]' : '';
      const validityTag = f.validity && f.validity !== 'pending_review' ? `[${f.validity}]` : '';
      return `${i + 1}. [ID: ${f._id}] 第${f.episodePlanted}集埋设 (已${age}集) ${statusTag}${validityTag}
   类型: ${f.type} | 重要性: ${f.importance}
   内容: ${f.content}`;
    }).join('\n\n');

    const recentEvents = context.recentEvents?.length
      ? context.recentEvents.map((e, i) => `${i + 1}. ${e}`).join('\n')
      : '无';

    const characterStates = context.characterStates?.length
      ? context.characterStates.map(c => `- ${c.name}: ${c.state}`).join('\n')
      : '无';

    const previousCliffhanger = context.previousCliffhanger || '无';

    return FORESHADOWING_DECISION_PROMPT
      .replace('{projectName}', context.projectName)
      .replace('{projectType}', context.projectType)
      .replace('{currentEpisode}', String(context.currentEpisode))
      .replace('{episodePlan}', context.episodePlan)
      .replace('{recentEvents}', recentEvents)
      .replace('{characterStates}', characterStates)
      .replace('{previousCliffhanger}', previousCliffhanger)
      .replace('{foreshadowingList}', foreshadowingList);
  }

  private async batchUpdate(
    items: Array<{ id: string; [key: string]: unknown }>,
    updateFn: (item: { id: string; [key: string]: unknown }) => Record<string, unknown>,
    label: string,
  ): Promise<number> {
    let count = 0;
    for (const item of items) {
      try {
        await Foreshadowing.findByIdAndUpdate(item.id, updateFn(item));
        count++;
      } catch (e) {
        console.error(`[ForeshadowingManager] ${label}失败:`, e);
      }
    }
    return count;
  }

  private async applyDecision(decision: AIDecision, currentEpisode: number): Promise<{
    constraintsSet: number;
    merged: number;
    abandoned: number;
    dormant: number;
    awakened: number;
    validityUpdated: number;
  }> {
    const stats = {
      constraintsSet: 0,
      merged: 0,
      abandoned: 0,
      dormant: 0,
      awakened: 0,
      validityUpdated: 0,
    };

    for (const merge of decision.lifecycle.merge) {
      if (merge.ids.length < 2) continue;
      try {
        await Foreshadowing.findByIdAndUpdate(merge.primaryId, {
          content: merge.mergedContent,
          clusterLabel: merge.label,
          clusterGroup: `merged-${Date.now()}`,
          mergedFrom: merge.ids.filter(id => id !== merge.primaryId),
        });
        for (const id of merge.ids) {
          if (id !== merge.primaryId) {
            await Foreshadowing.findByIdAndUpdate(id, {
              status: 'merged',
              mergedInto: merge.primaryId,
            });
            stats.merged++;
          }
        }
      } catch (e) {
        console.error(`[ForeshadowingManager] 合并失败:`, e);
      }
    }

    stats.abandoned = await this.batchUpdate(
      decision.lifecycle.abandon, (i) => ({ status: 'abandoned', resolutionNote: i.reason }), '放弃',
    );
    stats.dormant = await this.batchUpdate(
      decision.lifecycle.dormant, (i) => ({ status: 'dormant', resolutionNote: i.reason }), '休眠',
    );
    stats.awakened = await this.batchUpdate(
      decision.lifecycle.awaken,
      (i) => ({ status: 'planted', resolutionNote: `第${currentEpisode}集唤醒: ${i.reason}` }),
      '唤醒',
    );
    stats.validityUpdated = await this.batchUpdate(
      decision.validity.map(v => ({ id: v.id, type: v.type, reason: v.reason })),
      (i) => ({
        validity: i.type,
        validityReason: i.reason,
        lastReviewedAt: new Date(),
        lastReviewedEpisode: currentEpisode,
        $inc: { reviewCount: 1 },
      }),
      '更新有效性',
    );
    stats.constraintsSet = decision.constraints.verifiable.length + decision.constraints.guidance.length;

    return stats;
  }

  async getStats(): Promise<{
    total: number;
    planted: number;
    dormant: number;
    resolved: number;
    abandoned: number;
    merged: number;
  }> {
    const projectId = new mongoose.Types.ObjectId(this.projectId);

    const result = await Foreshadowing.aggregate([
      { $match: { projectId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const stats = {
      total: 0,
      planted: 0,
      dormant: 0,
      resolved: 0,
      abandoned: 0,
      merged: 0,
    };

    for (const item of result) {
      const status = item._id as keyof typeof stats;
      if (status in stats && status !== 'total') {
        stats[status] = item.count;
      }
      stats.total += item.count;
    }

    return stats;
  }

  async findByIssueType(
    issueType: string,
    sourceEpisode: number
  ): Promise<IForeshadowing[]> {
    const typeMapping: Record<string, string[]> = {
      unresolved: ['planted', 'dormant'],
      foreshadowing: ['planted', 'dormant'],
      character: ['planted'],
      timeline: ['planted'],
      continuity: ['planted'],
    };

    return Foreshadowing.find({
      projectId: new mongoose.Types.ObjectId(this.projectId),
      status: { $in: typeMapping[issueType] || ['planted'] },
      episodePlanted: {
        $gte: Math.max(1, sourceEpisode - 5),
        $lte: sourceEpisode + 5,
      },
    }).sort({ episodePlanted: 1 }).lean();
  }

  async findByEpisodeRange(
    startEpisode: number,
    endEpisode: number,
    options?: {
      status?: string[];
      includeResolved?: boolean;
    }
  ): Promise<IForeshadowing[]> {
    const statusFilter = options?.status || ['planted', 'dormant'];
    if (options?.includeResolved) {
      statusFilter.push('resolved');
    }

    return Foreshadowing.find({
      projectId: new mongoose.Types.ObjectId(this.projectId),
      status: { $in: statusFilter },
      $or: [
        { episodePlanted: { $gte: startEpisode, $lte: endEpisode } },
        { episodeResolved: { $gte: startEpisode, $lte: endEpisode } },
        {
          episodePlanted: { $lt: startEpisode },
          $or: [
            { episodeResolved: { $exists: false } },
            { episodeResolved: { $gt: endEpisode } },
          ],
        },
      ],
    }).sort({ episodePlanted: 1 }).lean();
  }
}

export default ForeshadowingManager;
