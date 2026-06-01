/**
 * 上下文管理器 - 类型定义和配置
 */

// 上下文预算配置
export const CONTEXT_BUDGET = {
  // 总预算（字符数）- 为动态内容预留空间
  TOTAL: 10000,

  // 各部分分配比例（优化后）
  ALLOCATION: {
    CHARACTERS: 0.25,       // 角色设定 25%（从28%降低）
    PREVIOUS_SUMMARY: 0.18, // 前情提要 18%
    EPISODE_PLAN: 0.15,     // 分集梗概 15%
    STATE_CHANGES: 0.12,    // 状态变化 12%
    CONTINUITY: 0.10,       // 角色存续性 10%
    FORESHADOWING: 0.15,    // 未回收伏笔 15%（从7%提高，伏笔很重要）
    GUIDELINES: 0.05        // 补充指南 5%（格式已在System Prompt中）
  },

  // 单角色最大长度
  MAX_CHAR_LENGTH: {
    main: 600,       // 主角（从800降低）
    supporting: 400, // 配角（从500降低）
    recurring: 250,  // 常驻角色（从300降低）
    guest: 120,      // 客串角色（从150降低）
    extra: 30        // 龙套（从50降低）
  }
};

// 伏笔超期阈值
export const FORESHADOWING_THRESHOLD = {
  OVERDUE: {
    high: 10,
    normal: 20,
    low: 30
  },
  WARNING: {
    high: 5,
    normal: 10,
    low: 15
  }
};

// 类型定义
export interface EpisodeSummaryData {
  summary: string;
  keyEvents: string[];
  cliffhanger: string;
  characterChanges: string[];
}

export interface FullContext {
  characters: string;
  previousSummary: string;
  stateChanges: string;
  characterContinuity: string;
  unresolvedForeshadowing: string;
}

export interface CategorizedCharacters {
  inScene: CharacterInfo[];
  main: CharacterInfo[];
  supporting: CharacterInfo[];
  others: CharacterInfo[];
}

export interface CharacterInfo {
  id: string;
  name: string;
  type?: string;
  role?: string;
  gender?: string;
  age?: string;
  identity?: string;
  appearance?: string;
  personality?: string;
  relationships?: Record<string, string>;
  state?: {
    currentState?: {
      equipment?: string[];
      abilities?: string[];
      condition?: {
        physical?: string;
        mental?: string;
        combat?: string;
      };
      injuries?: string[];
      currentInjury?: string;
      permanentMarks?: { mark: string }[];
    };
    stateHistory?: {
      episode: number;
      description: string;
    }[];
  };
}

export interface ContinuityWarning {
  level: 'critical' | 'warning' | 'info';
  type: string;
  message: string;
  suggestion?: string;
  characters?: { name: string }[];
}

export interface ContinuityWarnings {
  hasWarnings: boolean;
  warnings: ContinuityWarning[];
}
