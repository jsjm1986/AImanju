/**
 * 动态上下文预算分配器
 * 根据当前集的实际需求智能分配上下文预算
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import { characterRepository } from '../../repositories/CharacterRepository';
import { characterStateRepository } from '../../repositories/CharacterStateRepository';
import { foreshadowingRepository } from '../../repositories/ForeshadowingRepository';
import { FORESHADOWING_THRESHOLD } from './types';

/**
 * 预算分配结果
 */
export interface IBudgetAllocation {
  previousSummaries: number;    // 前情摘要预算
  characters: number;           // 角色设定预算
  foreshadowing: number;        // 伏笔预算
  characterContinuity: number;  // 角色存续性预算
  stateChanges: number;         // 状态变化预算
  sceneRhythm: number;          // 场景节奏预算
  characterCharm: number;       // 角色魅力预算
  total: number;                // 总预算
}

/**
 * 预算调整原因
 */
export interface IBudgetAdjustmentReason {
  module: string;
  adjustment: number;           // 正数增加，负数减少
  reason: string;
}

/**
 * 当前集需求分析结果
 */
export interface IEpisodeNeeds {
  hasOverdueForeshadowing: boolean;
  overdueCount: number;
  warningCount: number;
  isNewChapter: boolean;
  isClimax: boolean;
  absentMainCharacters: string[];
  relationshipMilestones: string[];
  totalForeshadowingCount: number;
}

/**
 * 动态预算分配器
 */
export class BudgetAllocator {
  private readonly BASE_BUDGET = 12000;
  
  // 默认分配比例
  private readonly DEFAULT_ALLOCATION: IBudgetAllocation = {
    previousSummaries: 2160,    // 18%
    characters: 3360,           // 28%
    foreshadowing: 840,         // 7%
    characterContinuity: 1200,  // 10%
    stateChanges: 1440,         // 12%
    sceneRhythm: 1200,          // 10%
    characterCharm: 1800,       // 15%
    total: 12000
  };

  private projectId: string;
  private adjustmentReasons: IBudgetAdjustmentReason[] = [];

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  /**
   * 分析当前集的需求
   */
  async analyzeNeeds(currentEpisode: number, episodePlan?: string): Promise<IEpisodeNeeds> {
    const needs: IEpisodeNeeds = {
      hasOverdueForeshadowing: false,
      overdueCount: 0,
      warningCount: 0,
      isNewChapter: false,
      isClimax: false,
      absentMainCharacters: [],
      relationshipMilestones: [],
      totalForeshadowingCount: 0,
    };

    // 1. 检查超期伏笔
    const unresolved = await foreshadowingRepository.getUnresolved(this.projectId);
    needs.totalForeshadowingCount = unresolved.length;
    
    for (const f of unresolved) {
      const episodeGap = currentEpisode - f.episodePlanted;
      const importance = f.importance || 'normal';
      const overdueThreshold = FORESHADOWING_THRESHOLD.OVERDUE[importance as keyof typeof FORESHADOWING_THRESHOLD.OVERDUE] || 20;
      const warningThreshold = FORESHADOWING_THRESHOLD.WARNING[importance as keyof typeof FORESHADOWING_THRESHOLD.WARNING] || 10;

      if (episodeGap >= overdueThreshold) {
        needs.overdueCount++;
        needs.hasOverdueForeshadowing = true;
      } else if (episodeGap >= warningThreshold) {
        needs.warningCount++;
      }
    }

    // 2. 检查是否为新篇章开始（通过梗概关键词判断）
    if (episodePlan) {
      const newChapterKeywords = ['新篇章', '第二部', '第三部', '新的开始', '时间跳跃', '数年后', '多年后'];
      needs.isNewChapter = newChapterKeywords.some(kw => episodePlan.includes(kw));
      
      // 检查是否为高潮集
      const climaxKeywords = ['决战', '最终', '大结局', '高潮', '终极', '生死', '对决', '总攻'];
      needs.isClimax = climaxKeywords.some(kw => episodePlan.includes(kw));
    }

    // 3. 检查主角缺席情况
    const allCharacters = await characterRepository.findByProject(this.projectId);
    for (const char of allCharacters) {
      const charType = (char as any).type || 'supporting';
      if (charType !== 'main' && charType !== '主角') continue;

      const stateHistory = await characterStateRepository.getStateHistory(
        this.projectId,
        char._id.toString()
      );

      if (stateHistory.length > 0) {
        const lastAppearance = Math.max(...stateHistory.map(h => h.episodeNumber));
        const absenceGap = currentEpisode - lastAppearance;
        
        // 主角超过5集未出场
        if (absenceGap >= 5) {
          needs.absentMainCharacters.push(char.name);
        }
      }
    }

    return needs;
  }

  /**
   * 根据需求分配预算
   */
  allocate(needs: IEpisodeNeeds): IBudgetAllocation {
    this.adjustmentReasons = [];
    
    // 从默认分配开始
    const allocation = { ...this.DEFAULT_ALLOCATION };
    
    // 计算可调整的预算池（从低优先级模块借用）
    let availablePool = 0;

    // 1. 超期伏笔需要回收 - 增加伏笔预算 (Requirements 3.1)
    if (needs.hasOverdueForeshadowing && needs.overdueCount > 0) {
      const increase = Math.min(needs.overdueCount * 200, 800);
      allocation.foreshadowing += increase;
      availablePool -= increase;
      this.adjustmentReasons.push({
        module: 'foreshadowing',
        adjustment: increase,
        reason: `有${needs.overdueCount}个超期伏笔需要回收`,
      });
    } else if (needs.warningCount > 0) {
      const increase = Math.min(needs.warningCount * 100, 400);
      allocation.foreshadowing += increase;
      availablePool -= increase;
      this.adjustmentReasons.push({
        module: 'foreshadowing',
        adjustment: increase,
        reason: `有${needs.warningCount}个伏笔临近超期`,
      });
    }

    // 2. 新篇章开始 - 增加角色介绍预算 (Requirements 3.2)
    if (needs.isNewChapter) {
      const increase = 600;
      allocation.characters += increase;
      availablePool -= increase;
      this.adjustmentReasons.push({
        module: 'characters',
        adjustment: increase,
        reason: '新篇章开始，需要更多角色介绍',
      });
    }

    // 3. 高潮集 - 增加前情摘要预算 (Requirements 3.3)
    if (needs.isClimax) {
      const increase = 500;
      allocation.previousSummaries += increase;
      availablePool -= increase;
      this.adjustmentReasons.push({
        module: 'previousSummaries',
        adjustment: increase,
        reason: '高潮集需要更多前情回顾',
      });
    }

    // 4. 主角长期缺席 - 增加角色存续性预算 (Requirements 3.4)
    if (needs.absentMainCharacters.length > 0) {
      const increase = Math.min(needs.absentMainCharacters.length * 300, 600);
      allocation.characterContinuity += increase;
      availablePool -= increase;
      this.adjustmentReasons.push({
        module: 'characterContinuity',
        adjustment: increase,
        reason: `${needs.absentMainCharacters.join('、')}长期未出场`,
      });
    }

    // 5. 从低优先级模块借用预算来平衡
    if (availablePool < 0) {
      // 按优先级从低到高借用：sceneRhythm -> characterCharm -> stateChanges
      const borrowOrder = ['sceneRhythm', 'characterCharm', 'stateChanges'];
      let remaining = Math.abs(availablePool);
      
      for (const module of borrowOrder) {
        if (remaining <= 0) break;
        
        const key = module as keyof IBudgetAllocation;
        const maxBorrow = Math.floor(allocation[key] * 0.3); // 最多借用30%
        const borrow = Math.min(maxBorrow, remaining);
        
        if (borrow > 0) {
          allocation[key] -= borrow;
          remaining -= borrow;
          this.adjustmentReasons.push({
            module,
            adjustment: -borrow,
            reason: '为高优先级模块让出预算',
          });
        }
      }
    }

    // 6. 确保总预算不超过限制 (Requirements 3.5)
    const currentTotal = Object.entries(allocation)
      .filter(([key]) => key !== 'total')
      .reduce((sum, [, value]) => sum + (value as number), 0);
    
    if (currentTotal > this.BASE_BUDGET) {
      // 按比例缩减
      const ratio = this.BASE_BUDGET / currentTotal;
      for (const key of Object.keys(allocation) as (keyof IBudgetAllocation)[]) {
        if (key !== 'total') {
          allocation[key] = Math.floor(allocation[key] * ratio);
        }
      }
    }

    // 更新总预算
    allocation.total = Object.entries(allocation)
      .filter(([key]) => key !== 'total')
      .reduce((sum, [, value]) => sum + (value as number), 0);

    return allocation;
  }

  /**
   * 获取调整原因 (Requirements 3.6)
   */
  getAdjustmentReasons(): IBudgetAdjustmentReason[] {
    return [...this.adjustmentReasons];
  }

  /**
   * 获取默认分配
   */
  getDefaultAllocation(): IBudgetAllocation {
    return { ...this.DEFAULT_ALLOCATION };
  }

  /**
   * 格式化预算分配为可读文本
   */
  formatAllocationSummary(allocation: IBudgetAllocation): string {
    const lines = [
      '【上下文预算分配】',
      `总预算: ${allocation.total} 字符`,
      '',
      '各模块分配:',
      `  - 前情摘要: ${allocation.previousSummaries} (${((allocation.previousSummaries / allocation.total) * 100).toFixed(1)}%)`,
      `  - 角色设定: ${allocation.characters} (${((allocation.characters / allocation.total) * 100).toFixed(1)}%)`,
      `  - 伏笔上下文: ${allocation.foreshadowing} (${((allocation.foreshadowing / allocation.total) * 100).toFixed(1)}%)`,
      `  - 角色存续性: ${allocation.characterContinuity} (${((allocation.characterContinuity / allocation.total) * 100).toFixed(1)}%)`,
      `  - 状态变化: ${allocation.stateChanges} (${((allocation.stateChanges / allocation.total) * 100).toFixed(1)}%)`,
      `  - 场景节奏: ${allocation.sceneRhythm} (${((allocation.sceneRhythm / allocation.total) * 100).toFixed(1)}%)`,
      `  - 角色魅力: ${allocation.characterCharm} (${((allocation.characterCharm / allocation.total) * 100).toFixed(1)}%)`,
    ];

    if (this.adjustmentReasons.length > 0) {
      lines.push('');
      lines.push('调整原因:');
      for (const reason of this.adjustmentReasons) {
        const sign = reason.adjustment > 0 ? '+' : '';
        lines.push(`  - ${reason.module}: ${sign}${reason.adjustment} (${reason.reason})`);
      }
    }

    return lines.join('\n');
  }
}
