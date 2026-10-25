import { characterRepository } from '../../repositories/CharacterRepository';
import { characterStateRepository } from '../../repositories/CharacterStateRepository';
import { foreshadowingRepository } from '../../repositories/ForeshadowingRepository';
import { summaryRepository } from '../../repositories/SummaryRepository';
import { BudgetAllocator, IBudgetAdjustmentReason, IBudgetAllocation } from './BudgetAllocator';
import {
    CategorizedCharacters,
    CharacterInfo,
    CONTEXT_BUDGET,
    EpisodeSummaryData,
    FORESHADOWING_THRESHOLD,
    FullContext,
} from './types';

export interface FullContextWithBudget extends FullContext {
  budgetAllocation?: IBudgetAllocation;
  adjustmentReasons?: IBudgetAdjustmentReason[];
}

const IMPORTANT_KEYWORDS = ['获得', '击败', '觉醒', '死亡', '背叛', '结盟'];
const ACTION_KEYWORDS = ['击败', '获得', '觉醒', '召唤', '死', '逃', '胜', '败'];

const CHAR_TYPE_CATEGORY: Record<string, keyof CategorizedCharacters> = {
  main: 'main',
  supporting: 'supporting',
};

function matchesAnyKeyword(text: string, keywords: string[]): boolean {
  return keywords.some(k => text.includes(k));
}

function sortByPriority(a: { importance: string; episodeGap: number }, b: { importance: string; episodeGap: number }): number {
  const order: Record<string, number> = { high: 0, normal: 1, low: 2 };
  const diff = (order[a.importance] ?? 1) - (order[b.importance] ?? 1);
  return diff !== 0 ? diff : b.episodeGap - a.episodeGap;
}

export class ContextManager {
  private projectId: string;

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  async recordEpisodeSummary(episode: number, data: EpisodeSummaryData): Promise<void> {
    await summaryRepository.save(this.projectId, episode, {
      summary: data.summary || '',
      keyEvents: data.keyEvents || [],
      cliffhanger: data.cliffhanger || '',
      characterChanges: data.characterChanges || [],
    });
  }

  async getAllSummaries() {
    return summaryRepository.getAll(this.projectId);
  }

  async clearSummaries(): Promise<void> {
    await summaryRepository.deleteAll(this.projectId);
  }

  async buildPreviousSummary(currentEpisode: number, maxLength = 2400): Promise<string> {
    if (currentEpisode <= 1) return '';

    const summaryParts: string[] = [];
    let totalLength = 0;

    const recentSummaries = await summaryRepository.getRecent(this.projectId, currentEpisode, 5);
    if (recentSummaries.length === 0) return '';

    const recentCount = 3;

    // 整体剧情走向
    if (recentSummaries.length > recentCount) {
      const earlyEpisodes = recentSummaries.slice(0, recentSummaries.length - recentCount);
      const overallSummary = this.compressEarlyEpisodes(earlyEpisodes);
      if (overallSummary) {
        const firstEp = earlyEpisodes[0].episodeNumber;
        const lastEp = earlyEpisodes[earlyEpisodes.length - 1].episodeNumber;
        summaryParts.push(`【剧情背景（第${firstEp}-${lastEp}集）】\n${overallSummary}`);
        totalLength += summaryParts[0].length;
      }
    }

    // 最近几集详情
    const recentEpisodes = recentSummaries.slice(-recentCount);
    if (recentEpisodes.length > 0) {
      let recentPart = '【近期剧情】\n';
      for (const epData of recentEpisodes) {
        const epSummary = `第${epData.episodeNumber}集：${epData.summary}`;
        if (totalLength + epSummary.length + 50 > maxLength) break;

        recentPart += epSummary + '\n';

        if (epData.keyEvents && epData.keyEvents.length > 0) {
          const events = epData.keyEvents.slice(0, 2).join('；');
          if (totalLength + events.length + 50 < maxLength) {
            recentPart += `  └ 关键：${events}\n`;
          }
        }

        totalLength = recentPart.length + (summaryParts[0]?.length || 0);
      }
      summaryParts.push(recentPart);
    }

    // 上一集悬念
    const lastEpisode = recentSummaries[recentSummaries.length - 1];
    if (lastEpisode?.cliffhanger) {
      summaryParts.push(`【承接点】第${lastEpisode.episodeNumber}集结尾：${lastEpisode.cliffhanger}`);
    }

    return summaryParts.join('\n\n');
  }

  private compressEarlyEpisodes(episodes: { keyEvents?: string[] }[]): string {
    const keyPoints = episodes
      .flatMap(ep => ep.keyEvents ?? [])
      .filter(e => matchesAnyKeyword(e, IMPORTANT_KEYWORDS));

    if (keyPoints.length === 0) return '';
    return [...new Set(keyPoints)].slice(0, 5).join('；');
  }

  async buildCharacterContext(
    episode: number,
    sceneCharacters: string[] = [],
    maxLength = 4200
  ): Promise<string> {
    const allCharacters = await characterRepository.findByProject(this.projectId);
    if (allCharacters.length === 0) {
      return '【暂无角色设定，请根据大纲中的描述创作】\n';
    }

    let context = '【角色设定】\n\n';
    let usedLength = context.length;

    const charInfos: CharacterInfo[] = allCharacters.map(c => ({
      id: c._id.toString(),
      name: c.name,
      role: c.identity,
      type: (c as any).type || 'supporting',
      gender: c.gender,
      age: c.age,
      identity: c.identity,
      personality: c.personality,
      appearance: c.appearance,
      relationships: (c as any).relationships,
      state: (c as any).state,
    }));

    const categorized = this.categorizeCharacters(charInfos, sceneCharacters);

    if (categorized.inScene.length > 0) {
      context += '▶ 本批次出场角色（详细设定）：\n\n';
      for (const char of categorized.inScene) {
        const charText = await this.formatCharacterDetail(char, episode, true);

        if (usedLength + charText.length > maxLength * 0.7) {
          context += `[${char.name}] - 详见角色卡\n`;
        } else {
          context += charText;
          usedLength += charText.length;
        }
      }
    }

    const mainNotInScene = categorized.main.filter(c =>
      !categorized.inScene.find(s => s.id === c.id)
    );
    if (mainNotInScene.length > 0 && usedLength < maxLength * 0.85) {
      context += '\n▶ 其他主要角色（供参考）：\n';
      for (const char of mainNotInScene) {
        const brief = `• ${char.name}（${char.role}）：${char.personality}\n`;
        if (usedLength + brief.length < maxLength) {
          context += brief;
          usedLength += brief.length;
        }
      }
    }

    // 龙套规则
    context += `
▶ 龙套角色规则：
• 观众类："观众甲/乙/丙"，无需固定外貌
• 对白简短，烘托气氛为主
• 同集内命名一致，跨集可复用名称
`;

    return context;
  }

  private categorizeCharacters(
    allCharacters: CharacterInfo[],
    sceneCharacters: string[]
  ): CategorizedCharacters {
    const result: CategorizedCharacters = {
      inScene: [],
      main: [],
      supporting: [],
      others: [],
    };

    for (const char of allCharacters) {
      const isInScene = sceneCharacters.some(name =>
        char.name.includes(name) || name.includes(char.name)
      );
      if (isInScene) result.inScene.push(char);

      const category = CHAR_TYPE_CATEGORY[char.type ?? ''] ?? 'others';
      result[category].push(char);
    }

    if (sceneCharacters.length === 0) {
      result.inScene = result.main;
    }

    return result;
  }

  private async formatCharacterDetail(
    char: CharacterInfo,
    episode: number,
    detailed = true
  ): Promise<string> {
    let text = `【${char.name || '未知'}】（${char.role || '未知身份'}）\n`;

    if (!detailed) {
      text += `${char.gender || '未知'} | ${char.age || '未知'} | ${char.personality || '暂无'}\n\n`;
      return text;
    }

    text += `性别：${char.gender || '未知'} | 年龄：${char.age || '未知'}\n`;
    text += `身份：${char.identity || '未知'}\n`;
    text += `外貌：${this.truncate(char.appearance || '暂无', 150)}\n`;
    text += `性格：${char.personality || '暂无'}\n`;

    const latestState = await characterStateRepository.getLatestState(
      this.projectId,
      char.id
    );

    if (latestState) {
      if (latestState.currentEquipment?.length > 0) {
        text += `当前装备：${latestState.currentEquipment.join('、')}\n`;
      }
      if (latestState.currentAbilities?.length > 0) {
        text += `已展示能力：${latestState.currentAbilities.join('、')}\n`;
      }

      if (latestState.condition) {
        const c = latestState.condition;
        const conditionLines: string[] = [];
        if (c.physical && c.physical !== '状态正常') conditionLines.push(`  └ 身体：${c.physical}`);
        if (c.mental && c.mental !== '状态正常') conditionLines.push(`  └ 精神：${c.mental}`);
        if (c.combat && c.combat !== '战力正常') conditionLines.push(`  └ 战力：${c.combat}`);
        if (conditionLines.length > 0) {
          text += `当前状态：\n${conditionLines.join('\n')}\n`;
        }
      }

      if (latestState.permanentMark?.mark) {
        text += `永久性特征：${latestState.permanentMark.mark}\n`;
      }
    }

    if (char.relationships && Object.keys(char.relationships).length > 0) {
      const rels = Object.entries(char.relationships)
        .slice(0, 3)
        .map(([name, rel]) => `${name}(${rel})`)
        .join('、');
      text += `关系：${rels}\n`;
    }

    text += '\n';
    return text;
  }

  async buildStateChangesContext(startEpisode: number, maxLength = 1800): Promise<string> {
    if (startEpisode <= 1) return '';

    let context = '【近期角色状态变化】\n';
    const allCharacters = await characterRepository.findByProject(this.projectId);

    for (const char of allCharacters) {
      const stateHistory = await characterStateRepository.getStateHistory(
        this.projectId,
        char._id.toString()
      );

      if (!stateHistory || stateHistory.length === 0) continue;

      const recentChanges = stateHistory
        .filter(h => h.episodeNumber >= startEpisode - 5 && h.episodeNumber < startEpisode)
        .slice(-3);

      if (recentChanges.length === 0) continue;

      context += `• ${char.name}：`;
      const changeTexts = recentChanges.map(h =>
        `第${h.episodeNumber}集${h.description || '状态变化'}`
      );
      context += changeTexts.join('；') + '\n';

      if (context.length > maxLength) break;
    }

    return context.length > 30 ? context + '\n' : '';
  }

  async buildCharacterContinuityContext(
    currentEpisode: number,
    sceneCharacters: string[] = []
  ): Promise<string> {
    const allCharacters = await characterRepository.findByProject(this.projectId);
    const warnings: Array<{ level: string; type: string; message: string; suggestion?: string }> = [];

    for (const char of allCharacters) {
      const charType = (char as any).type || 'supporting';
      if (charType !== 'main') continue;

      const stateHistory = await characterStateRepository.getStateHistory(
        this.projectId,
        char._id.toString()
      );

      const lastAppearance = stateHistory?.length
        ? Math.max(...stateHistory.map(h => h.episodeNumber))
        : 0;
      const absenceGap = currentEpisode - lastAppearance;

      if (absenceGap >= 5 && lastAppearance > 0) {
        warnings.push({
          level: 'critical',
          type: 'main_char_absence',
          message: `${char.name}（主角）已${absenceGap}集未出场`,
        });
      } else if (absenceGap >= 2 && !sceneCharacters.includes(char.name)) {
        warnings.push({
          level: 'info',
          type: 'main_char_transition',
          message: `${char.name}上次出场在第${lastAppearance}集`,
          suggestion: '可在开头简短交代，如"此时，某某正在..."',
        });
      }
    }

    if (warnings.length === 0) return '';

    const parts = ['【角色存续性提示】'];
    const criticalWarnings = warnings.filter(w => w.level === 'critical');
    const transitionWarnings = warnings.filter(w => w.type === 'main_char_transition');

    if (criticalWarnings.length > 0) {
      parts.push('\n[注意] 需要关注：');
      for (const w of criticalWarnings) {
        parts.push(`  ${w.message}`);
        parts.push(`  → 建议：安排该角色出场或提及其动向`);
      }
    }

    if (transitionWarnings.length > 0) {
      parts.push('\n[建议] 转场建议：');
      for (const w of transitionWarnings) {
        parts.push(`  ${w.message}`);
        parts.push(`  → ${w.suggestion || '可在开头简短交代'}`);
      }
    }

    if (criticalWarnings.length > 0) {
      parts.push('\n[规则] 存续性规则：');
      parts.push('  • 主角不应无故消失超过5集');
      parts.push('  • 如需角色暂时离场，应交代原因');
    }

    return parts.join('\n') + '\n';
  }

  async buildForeshadowingContext(currentEpisode: number, maxLength = 1200): Promise<string> {
    const unresolved = await foreshadowingRepository.getUnresolved(this.projectId);
    if (unresolved.length === 0) return '';

    const overdueList: Array<{ content: string; episodePlanted: number; importance: string; episodeGap: number }> = [];
    const warningList: Array<{ content: string; episodePlanted: number; importance: string; episodeGap: number }> = [];
    const normalList: Array<{ content: string; episodePlanted: number; importance: string; type: string; episodeGap: number }> = [];

    for (const f of unresolved) {
      const episodeGap = currentEpisode - f.episodePlanted;
      const importance = f.importance || 'normal';
      const overdueThreshold = FORESHADOWING_THRESHOLD.OVERDUE[importance as keyof typeof FORESHADOWING_THRESHOLD.OVERDUE] || 20;
      const warningThreshold = FORESHADOWING_THRESHOLD.WARNING[importance as keyof typeof FORESHADOWING_THRESHOLD.WARNING] || 10;

      const item = { content: f.content, episodePlanted: f.episodePlanted, importance, type: f.type, episodeGap };

      if (episodeGap >= overdueThreshold) {
        overdueList.push(item);
      } else if (episodeGap >= warningThreshold) {
        warningList.push(item);
      } else {
        normalList.push(item);
      }
    }

    overdueList.sort(sortByPriority);
    warningList.sort(sortByPriority);
    normalList.sort(sortByPriority);

    const parts: string[] = [];

    if (overdueList.length > 0) {
      parts.push('[OVERDUE] 超期伏笔 - 本集必须回收');
      parts.push('（以下伏笔已严重超期，必须在本集回收，否则触发重新生成）');
      for (const f of overdueList) {
        const line = `  - 第${f.episodePlanted}集埋下（已过${f.episodeGap}集）：${f.content}`;
        if (parts.join('\n').length + line.length > maxLength * 0.5) break;
        parts.push(line);
      }
      parts.push('');
    }

    if (warningList.length > 0) {
      parts.push('[WARNING] 临近超期 - 强烈建议本集回收');
      parts.push('（以下伏笔即将超期，建议在本集处理）');
      for (const f of warningList) {
        const line = `  - 第${f.episodePlanted}集（已${f.episodeGap}集）：${f.content}`;
        if (parts.join('\n').length + line.length > maxLength * 0.75) break;
        parts.push(line);
      }
      parts.push('');
    }

    if (normalList.length > 0 && parts.join('\n').length < maxLength * 0.8) {
      parts.push('[NORMAL] 待回收伏笔');
      for (const f of normalList) {
        const importanceMark = f.importance === 'high' ? '[重要]' : '';
        const line = `  - ${importanceMark}第${f.episodePlanted}集：${f.content}（${f.type}）`;
        if (parts.join('\n').length + line.length > maxLength) {
          parts.push('  ... 更多伏笔省略');
          break;
        }
        parts.push(line);
      }
    }

    if (overdueList.length > 0 || warningList.length > 0) {
      parts.push('');
      parts.push(`[统计] 超期${overdueList.length}个, 临近超期${warningList.length}个, 正常${normalList.length}个`);
    }

    return parts.join('\n');
  }

  async buildFullContext(options: {
    currentEpisode: number;
    sceneCharacters?: string[];
    totalBudget?: number;
    episodePlan?: string;
    useDynamicBudget?: boolean;
  }): Promise<FullContextWithBudget> {
    const {
      currentEpisode,
      sceneCharacters = [],
      totalBudget = CONTEXT_BUDGET.TOTAL,
      episodePlan,
      useDynamicBudget = true,
    } = options;

    let allocation: IBudgetAllocation | undefined;
    let adjustmentReasons: IBudgetAdjustmentReason[] | undefined;

    if (useDynamicBudget) {
      const budgetAllocator = new BudgetAllocator(this.projectId);
      const needs = await budgetAllocator.analyzeNeeds(currentEpisode, episodePlan);
      allocation = budgetAllocator.allocate(needs);
      adjustmentReasons = budgetAllocator.getAdjustmentReasons();

      if (allocation && adjustmentReasons) {
        console.log(`[ContextManager] 动态预算分配: 总预算=${allocation.total}, 调整项=${adjustmentReasons.length}`);
      }
    }

    const budgets = allocation || {
      previousSummaries: Math.floor(totalBudget * CONTEXT_BUDGET.ALLOCATION.PREVIOUS_SUMMARY),
      characters: Math.floor(totalBudget * CONTEXT_BUDGET.ALLOCATION.CHARACTERS),
      foreshadowing: Math.floor(totalBudget * CONTEXT_BUDGET.ALLOCATION.FORESHADOWING),
      characterContinuity: Math.floor(totalBudget * CONTEXT_BUDGET.ALLOCATION.CONTINUITY),
      stateChanges: Math.floor(totalBudget * CONTEXT_BUDGET.ALLOCATION.STATE_CHANGES),
    };

    return {
      characters: await this.buildCharacterContext(
        currentEpisode,
        sceneCharacters,
        budgets.characters
      ),
      previousSummary: await this.buildPreviousSummary(
        currentEpisode,
        budgets.previousSummaries
      ),
      stateChanges: await this.buildStateChangesContext(
        currentEpisode,
        budgets.stateChanges
      ),
      characterContinuity: await this.buildCharacterContinuityContext(
        currentEpisode,
        sceneCharacters
      ),
      unresolvedForeshadowing: await this.buildForeshadowingContext(
        currentEpisode,
        budgets.foreshadowing
      ),
      budgetAllocation: allocation,
      adjustmentReasons,
    };
  }

  extractEpisodeSummaryFromScript(scriptContent: string, episode: number): EpisodeSummaryData {
    const summaryMatch = scriptContent.match(/梗概[：:]\s*([^\n]+)/);
    const summary = summaryMatch ? summaryMatch[1].trim() : '';

    const keyEvents: string[] = [];
    // 动作行提取：兼容两种格式——△前缀行（标准格式）与纯动作行（海外生产格式）
    for (const raw of scriptContent.split('\n')) {
      const line = raw.trim();
      const isMarkedAction = line.startsWith('△');
      const isPlainAction = !isMarkedAction && line.length >= 20 && line.length <= 80
        && !/[：:（(【{\[]/.test(line) && !/^\d+-\d+/.test(line)
        && !/^第\s*\d+\s*集/.test(line) && !/^(人物|字幕|黑屏)/.test(line)
        && /[\u4e00-\u9fa5]/.test(line);
      if (!isMarkedAction && !isPlainAction) continue;
      const action = (isMarkedAction ? line.slice(1) : line).trim();
      if (matchesAnyKeyword(action, ACTION_KEYWORDS)) {
        keyEvents.push(action.substring(0, 50));
        if (keyEvents.length >= 3) break;
      }
    }

    const lines = scriptContent.split('\n').filter(l => l.trim());
    let cliffhanger = '';
    for (const line of lines.slice(-5).reverse()) {
      if (line.includes('：') && !line.startsWith('△') && line.length > 10) {
        cliffhanger = line.substring(0, 60);
        break;
      }
    }

    return {
      summary,
      keyEvents,
      cliffhanger,
      characterChanges: [],
    };
  }

  private truncate(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
}
