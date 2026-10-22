/**
 * 模块化注意力头系统
 * 实现多头注意力机制，支持不同题材的注意力头组合
 */

import { IWorldState } from '../../models/WorldState';
import { robustParseJson } from '../../utils/jsonParser';
import { AIClient } from '../ai/AIClient';

export type AttentionHeadType =
  // 基础头（必选）
  | 'base-relationships'    // H-Base-1: 角色关系头
  | 'base-conflicts'        // H-Base-2: 剧情冲突头
  | 'base-foreshadowing'    // H-Base-3: 伏笔追踪头
  | 'base-consistency'      // H-Base-4: 世界一致性头
  // 悬疑模块
  | 'mystery-clues'         // 线索追踪
  | 'mystery-logic'         // 逻辑一致性
  | 'mystery-revelation'    // 谜底管理
  // 恐怖模块
  | 'horror-atmosphere'     // 氛围营造
  | 'horror-rhythm'         // 惊吓节奏
  | 'horror-unknown'        // 未知管理
  // 智斗模块
  | 'mind-information'      // 信息差管理
  | 'mind-strategy'         // 策略对弈
  | 'mind-twist'            // 反转铺垫
  // 游戏/系统流模块
  | 'game-leveling'         // 等级系统
  | 'game-equipment'        // 装备获取
  | 'game-skills'           // 技能展示
  // 爽文模块
  | 'cool-faceslap'         // 打脸节奏
  | 'cool-points'           // 爽点分布
  | 'cool-villain'          // 反派智商
  // 风格头
  | 'style-emotions'        // 情感弧线
  | 'style-pacing'          // 节奏控制
  | 'style-humor'           // 幽默调节
  | 'style-theme'           // 主题贯穿
  // 海外短剧模块
  | 'overseas-hook-engine'      // 双钩引擎与卡点
  | 'overseas-function-density' // 场景/对话功能密度
  | 'overseas-voice-redline';   // 声口一致性与海外红线

export type GenreType =
  | 'xuanhuan'      // 玄幻/仙侠
  | 'dushi'         // 都市/重生
  | 'xuanyi'        // 悬疑/侦探
  | 'kongbu'        // 恐怖/惊悚
  | 'zhidou'        // 智斗/谋略
  | 'xitong'        // 游戏/系统流
  | 'yanqing'       // 言情/甜宠
  | 'xiju'          // 喜剧/搞笑
  | 'overseas'      // 海外短剧
  | 'custom';       // 自定义

export interface IAttentionHeadConfig {
  type: AttentionHeadType;
  name: string;
  description: string;
  category: 'base' | 'mystery' | 'horror' | 'mind' | 'game' | 'cool' | 'style' | 'overseas';
  prompt: string;
  outputFields: string[];
  weight: number; // 默认权重
}

export interface IHeadAnalysisResult {
  headType: AttentionHeadType;
  insights: string[];
  suggestions: string[];
  constraints: string[];
  warnings: string[];
  relevantElements: Array<{
    element: string;
    weight: number;
    reason: string;
  }>;
}

export interface IStructuredConstraint {
  content: string;
  headType: AttentionHeadType;
  headCategory: 'base' | 'mystery' | 'horror' | 'mind' | 'game' | 'cool' | 'style' | 'overseas';
  headWeight: number;
  category: 'verifiable' | 'guidance';
  severity: 'critical' | 'important' | 'normal';
}

export interface IMultiHeadResult {
  headResults: IHeadAnalysisResult[];
  crossDimensionInsights: string[];
  aggregatedConstraints: IStructuredConstraint[];
  aggregatedSuggestions: string[];
  elementWeights: Map<string, number>;
}

export const BASE_HEADS: IAttentionHeadConfig[] = [
  {
    type: 'base-relationships',
    name: '角色关系头',
    description: '分析角色之间的关系变化和互动',
    category: 'base',
    weight: 1.0,
    outputFields: ['relationshipChanges', 'suggestedInteractions', 'warnings'],
    prompt: `分析本集中角色关系的变化：
1. 哪些角色之间会有互动？
2. 关系会如何变化（敌对/友好/暧昧/合作）？
3. 是否有潜在的关系冲突？
4. 建议哪些角色组合出场？`,
  },
  {
    type: 'base-conflicts',
    name: '剧情冲突头',
    description: '追踪和分析剧情冲突',
    category: 'base',
    weight: 1.0,
    outputFields: ['pendingConflicts', 'newConflicts', 'resolutionSuggestions'],
    prompt: `分析本集的冲突状态：
1. 当前待解决的冲突有哪些？
2. 本集会引入新冲突吗？
3. 哪些冲突可能在本集解决？
4. 冲突的紧张程度如何？`,
  },
  {
    type: 'base-foreshadowing',
    name: '伏笔追踪头',
    description: '管理伏笔的埋设和回收',
    category: 'base',
    weight: 1.0,
    outputFields: ['canResolve', 'shouldPlant', 'overdueWarnings'],
    prompt: `分析本集的伏笔状态：
1. 哪些伏笔可以在本集回收？
2. 是否需要埋设新伏笔？
3. 有无超期伏笔需要处理？
4. 伏笔回收的时机是否合适？`,
  },
  {
    type: 'base-consistency',
    name: '世界一致性头',
    description: '检查设定和能力边界的一致性',
    category: 'base',
    weight: 1.0,
    outputFields: ['settingConstraints', 'abilityLimits', 'violations'],
    prompt: `检查世界观一致性：
1. 角色使用的能力是否在已知范围内？
2. 装备使用是否合理（有没有凭空出现）？
3. 世界设定是否被违反？
4. 角色的身体/精神状态是否需要体现？`,
  },
];

export const MYSTERY_HEADS: IAttentionHeadConfig[] = [
  {
    type: 'mystery-clues',
    name: '线索追踪头',
    description: '管理已出现线索和未解线索',
    category: 'mystery',
    weight: 0.8,
    outputFields: ['existingClues', 'newClues', 'redHerrings'],
    prompt: `分析本集的线索状态：
1. 目前已出现哪些线索？
2. 本集应该揭示什么新线索？
3. 是否需要红鲱鱼误导读者？
4. 线索之间的关联性如何？`,
  },
  {
    type: 'mystery-logic',
    name: '逻辑一致性头',
    description: '检查推理逻辑的自洽性',
    category: 'mystery',
    weight: 0.9,
    outputFields: ['logicChain', 'holes', 'suggestions'],
    prompt: `检查推理逻辑：
1. 当前的推理链是否完整？
2. 有无逻辑漏洞？
3. 读者能否根据已有线索推理？
4. 是否有不合理的巧合？`,
  },
  {
    type: 'mystery-revelation',
    name: '谜底管理头',
    description: '控制谜底揭示的时机和铺垫',
    category: 'mystery',
    weight: 0.8,
    outputFields: ['revelationTiming', 'foreshadowingLevel', 'surpriseLevel'],
    prompt: `分析谜底揭示：
1. 谜底揭示的时机是否合适？
2. 铺垫是否充分？
3. 揭示后读者会感到惊讶还是恍然大悟？
4. 是否需要多层谜底？`,
  },
];

export const HORROR_HEADS: IAttentionHeadConfig[] = [
  {
    type: 'horror-atmosphere',
    name: '氛围营造头',
    description: '管理恐怖元素分布和紧张度',
    category: 'horror',
    weight: 0.9,
    outputFields: ['tensionLevel', 'horrorElements', 'atmosphereSuggestions'],
    prompt: `分析恐怖氛围：
1. 当前紧张度曲线如何？
2. 恐怖元素分布是否合理？
3. 是否有足够的压抑感铺垫？
4. 何时释放紧张感？`,
  },
  {
    type: 'horror-rhythm',
    name: '惊吓节奏头',
    description: '控制 Jump Scare 间隔和松弛度',
    category: 'horror',
    weight: 0.8,
    outputFields: ['scareIntervals', 'releasePoints', 'buildupSuggestions'],
    prompt: `分析惊吓节奏：
1. 上次惊吓点距今多久？
2. 本集是否需要惊吓点？
3. 惊吓前的铺垫是否充分？
4. 松弛点在哪里？`,
  },
  {
    type: 'horror-unknown',
    name: '未知管理头',
    description: '保持神秘感和信息释放节奏',
    category: 'horror',
    weight: 0.8,
    outputFields: ['mysteryLevel', 'revealedInfo', 'hiddenInfo'],
    prompt: `管理未知感：
1. 威胁的真面目揭示多少了？
2. 本集应该揭示什么？
3. 需要保留哪些神秘感？
4. 信息释放节奏是否合适？`,
  },
];

export const MIND_HEADS: IAttentionHeadConfig[] = [
  {
    type: 'mind-information',
    name: '信息差管理头',
    description: '管理角色之间和读者的信息差',
    category: 'mind',
    weight: 0.9,
    outputFields: ['characterKnowledge', 'readerKnowledge', 'infoGaps'],
    prompt: `分析信息差：
1. 各角色分别知道什么？
2. 读者知道什么？
3. 信息差如何制造张力？
4. 何时打破信息差？`,
  },
  {
    type: 'mind-strategy',
    name: '策略对弈头',
    description: '分析攻防节奏和计中计',
    category: 'mind',
    weight: 0.9,
    outputFields: ['currentStrategy', 'counterStrategies', 'layeredPlans'],
    prompt: `分析策略对弈：
1. 当前双方的策略是什么？
2. 是否有计中计？
3. 攻防节奏如何？
4. 读者能预测到多少？`,
  },
  {
    type: 'mind-twist',
    name: '反转铺垫头',
    description: '管理反转的合理性和伏笔',
    category: 'mind',
    weight: 0.8,
    outputFields: ['pendingTwists', 'twistForeshadowing', 'plausibility'],
    prompt: `分析反转铺垫：
1. 即将到来的反转是什么？
2. 铺垫是否充分？
3. 反转后回看是否合理？
4. 反转的冲击力如何？`,
  },
];

export const GAME_HEADS: IAttentionHeadConfig[] = [
  {
    type: 'game-leveling',
    name: '等级系统头',
    description: '管理升级节奏和战力对比',
    category: 'game',
    weight: 0.8,
    outputFields: ['currentLevels', 'powerComparison', 'levelingPace'],
    prompt: `分析等级系统：
1. 主角当前等级/境界？
2. 与对手的战力对比？
3. 升级节奏是否合理？
4. 是否需要升级突破？`,
  },
  {
    type: 'game-equipment',
    name: '装备获取头',
    description: '管理装备稀缺性和升级路径',
    category: 'game',
    weight: 0.7,
    outputFields: ['currentEquipment', 'availableUpgrades', 'dropOpportunities'],
    prompt: `分析装备系统：
1. 当前装备配置如何？
2. 是否需要新装备？
3. 获取途径是否合理？
4. 装备稀缺性平衡？`,
  },
  {
    type: 'game-skills',
    name: '技能展示头',
    description: '管理新技能出场和能力边界',
    category: 'game',
    weight: 0.7,
    outputFields: ['knownSkills', 'newSkillOpportunities', 'abilityLimits'],
    prompt: `分析技能展示：
1. 已展示哪些技能？
2. 是否有新技能出场时机？
3. 技能使用是否合理？
4. 能力边界是否清晰？`,
  },
];

export const COOL_HEADS: IAttentionHeadConfig[] = [
  {
    type: 'cool-faceslap',
    name: '打脸节奏头',
    description: '控制装逼-打脸循环频率',
    category: 'cool',
    weight: 0.8,
    outputFields: ['lastFaceslap', 'pendingSetups', 'suggestedTiming'],
    prompt: `分析打脸节奏：
1. 上次打脸是哪一集？
2. 当前有无装逼铺垫？
3. 本集是否适合打脸？
4. 打脸的爽度如何？`,
  },
  {
    type: 'cool-points',
    name: '爽点分布头',
    description: '管理爽点密度和高潮位置',
    category: 'cool',
    weight: 0.8,
    outputFields: ['coolPointDensity', 'climaxPosition', 'satisfactionLevel'],
    prompt: `分析爽点分布：
1. 本集爽点密度如何？
2. 高潮点在哪里？
3. 读者满足感如何？
4. 是否需要加爽点？`,
  },
  {
    type: 'cool-villain',
    name: '反派智商头',
    description: '检查反派行为的合理性',
    category: 'cool',
    weight: 0.7,
    outputFields: ['villainBehavior', 'plausibility', 'suggestions'],
    prompt: `检查反派智商：
1. 反派行为是否合理？
2. 是否过于送人头？
3. 反派的动机是否清晰？
4. 是否需要提升反派智商？`,
  },
];

export const STYLE_HEADS: IAttentionHeadConfig[] = [
  {
    type: 'style-emotions',
    name: '情感共鸣头',
    description: '分析角色情绪和观众情感体验',
    category: 'style',
    weight: 0.7,
    outputFields: ['emotionalState', 'audienceEmotion', 'resonancePoints', 'emotionalClimaxPosition'],
    prompt: `分析本集的情感设计：
1. 本集想让观众感受到什么情感？（紧张/感动/愤怒/释然/喜悦）
2. 情感高潮点应该在哪里？
3. 观众应该在哪个时刻产生共鸣？
4. 情感转换是否自然？
5. 角色的情感表达是否充分？`,
  },
  {
    type: 'style-pacing',
    name: '节奏控制头',
    description: '控制整体节奏和悬念分布',
    category: 'style',
    weight: 0.6,
    outputFields: ['pacingAnalysis', 'suspenseDistribution', 'suggestions'],
    prompt: `分析整体节奏：
1. 当前节奏是快是慢？
2. 悬念分布是否合理？
3. 是否需要调整节奏？
4. 读者疲劳度如何？`,
  },
  {
    type: 'style-humor',
    name: '幽默调节头',
    description: '管理喜剧元素和吐槽密度',
    category: 'style',
    weight: 0.4,
    outputFields: ['humorDensity', 'comedyTiming', 'suggestions'],
    prompt: `分析幽默元素：
1. 喜剧元素密度如何？
2. 吐槽时机是否恰当？
3. 幽默与正剧的平衡？
4. 是否需要更多笑点？`,
  },
  {
    type: 'style-theme',
    name: '主题贯穿头',
    description: '追踪故事的中心主题和象征元素',
    category: 'style',
    weight: 0.5,
    outputFields: ['themeExpression', 'symbolElements', 'characterGrowthAlignment', 'themeReinforcement'],
    prompt: `分析本集的主题表达：
1. 本集如何呼应故事的中心主题？
2. 有无象征性元素或暗示？
3. 角色的行动是否体现主题？
4. 是否需要加强主题表达？
5. 本集给观众的核心信息是什么？`,
  },
];

export const OVERSEAS_HEADS: IAttentionHeadConfig[] = [
  {
    type: 'overseas-hook-engine',
    name: '双钩引擎头',
    description: '检查单集钩子/主线钩子/零铺垫入戏/付费卡点强度',
    category: 'overseas',
    weight: 0.9,
    outputFields: ['episodeHook', 'mainlineHookProgress', 'openingStrength', 'paywallReadiness', 'warnings'],
    prompt: `你是海外短剧钩子引擎审查员，检查本集的双钩体系：
1. 零铺垫入戏：若为第1集，前3秒是否直接进入最高浓度冲突画面（无日常铺垫/背景交代）？30秒后是否有倒叙展开？
2. 单集钩子：本集结尾是否设置集尾钩子（信息炸弹/行动悬念/情感抉择/背叛揭露/危机升级/身份暗示之一）？能否5秒内被理解？
3. 主线钩子：全剧核心悬念是否在本集有推进（哪怕一个细节/物件/台词）？
4. 付费卡点：若本集为付费卡点集（Ep8-12或大纲标注），卡点集前一集是否达到情绪峰值？卡点钩子是否最强？
5. 上集钩子是否在本集开篇被承接？
输出每个问题的检查结论，未达标项给出具体修正建议。`,
  },
  {
    type: 'overseas-function-density',
    name: '功能密度头',
    description: '检查场景/对话功能覆盖、信息线边界、无功能句',
    category: 'overseas',
    weight: 0.85,
    outputFields: ['sceneFunctions', 'dialogueFunctions', 'infoLineViolations', 'deadSentences', 'suggestions'],
    prompt: `你是剧本功能密度审查员，逐场逐句检查：
1. 场景功能：每个场景必须至少占以下一项——推进冲突/揭示信息/转变关系/制造悬念。只展示日常氛围、重复已知信息、纯群像反应的场景标记删除。
2. 对话功能：每句对白必须至少占一项——传递新信息/执行情绪动作/改变场上关系。日常问候、重复信息、替身式叙述、感叹填充标记删除。
3. 信息线硬边界：禁止用OS/VO独白交代信息、禁止角色自言自语交代信息、禁止文件特写+默读交代信息。信息只能通过道具行为（A类）或高压对白（反问/威胁/试探，B类）传递。
4. 环境刀具率：环境词是否在3秒内被角色使用？只营造气氛的环境描写标记删除。
5. 负性动作：是否存在"没有做什么"式描写（没抬头/没说话/没回答）？
6. 弱动作句式：是否存在"动词+了一下/一拍/一声/两秒"式收笔（收紧了一下/笑了一下/看了一眼/停了一拍）？标记并改为有具体落点的动作。
7. 抽象括号：对白括号内是否存在抽象语气词（低声/压低声/压低声音/轻声/小声/语气平静）？标记并改为可视动作。
8. 道具归属一致性：关键道具（随身物件/信物/文件/武器）的持有者与前文是否一致？物件不得无理由出现在非持有者手上或消失，移交必须有剧情交代。
输出违规清单与每个场景的删减/改写建议。`,
  },
  {
    type: 'overseas-voice-redline',
    name: '声口红线头',
    description: '检查角色声口一致性、地域语体、海外内容红线',
    category: 'overseas',
    weight: 0.85,
    outputFields: ['voiceConsistency', 'localeVoice', 'redlineViolations', 'emotionLabelCoverage', 'warnings'],
    prompt: `你是海外短剧声口与红线审查员：
1. 声口指纹：每个角色的对白是否符合其声口（词汇/句式/节奏/情绪/潜台词五维）？删掉角色名后能否凭台词判断是谁在说话？若可完全通用则标记。
2. 美式口语汉译：台词是否为美式口语汉译口语化（迪士尼译制腔效果）？避免中式书面语与中式英语直译。
3. 地域语体：非母语角色是否有"第二语言感"（停顿/重复确认/词序差异）？
4. 海外内容红线（一票否决）：男主对女主施暴/美化家暴或控制行为/女主降智原谅/强制流产/未成年成人情境/种族刻板/详细虐待描写/狼人强制标记（须双方自愿）。
5. 情绪标签：每个场景是否标注且只呈现单一核心情绪？
6. OS/VO边界：内心独白是否只表达情绪与潜台词？凡用OS/VO交代剧情信息（谁做了什么/发生了什么/推理结论）均标记违规。
7. 格式一致性：集标题是否带多余markdown符号（##）；OS/VO是否紧贴角色名无空格；场标序号与场景名之间是否无空格；角色是否用英文原名而非音译。
输出每项结论，红线项标记为CRITICAL。`,
  },
];

const BASE_HEAD_TYPES = BASE_HEADS.map((h) => h.type);

export const GENRE_HEAD_MAPPING: Record<GenreType, AttentionHeadType[]> = {
  xuanhuan: [
    ...BASE_HEAD_TYPES,
    'game-leveling',
    'game-equipment',
    'game-skills',
    'cool-faceslap',
    'cool-points',
    'cool-villain',
    'style-pacing',
    'style-emotions',
    'style-theme',
  ],
  dushi: [
    ...BASE_HEAD_TYPES,
    'cool-faceslap',
    'cool-points',
    'cool-villain',
    'style-pacing',
    'style-emotions',
    'style-theme',
  ],
  xuanyi: [
    ...BASE_HEAD_TYPES,
    'mystery-clues',
    'mystery-logic',
    'mystery-revelation',
    'style-emotions',
    'style-theme',
  ],
  kongbu: [
    ...BASE_HEAD_TYPES,
    'horror-atmosphere',
    'horror-rhythm',
    'horror-unknown',
    'style-emotions',
    'style-theme',
  ],
  zhidou: [
    ...BASE_HEAD_TYPES,
    'mind-information',
    'mind-strategy',
    'mind-twist',
    'style-emotions',
    'style-theme',
  ],
  xitong: [
    ...BASE_HEAD_TYPES,
    'game-leveling',
    'game-equipment',
    'game-skills',
    'cool-faceslap',
    'cool-points',
    'style-pacing',
    'style-emotions',
    'style-theme',
  ],
  yanqing: [
    ...BASE_HEAD_TYPES,
    'style-emotions',
    'style-theme',
  ],
  xiju: [
    ...BASE_HEAD_TYPES,
    'style-humor',
    'style-emotions',
    'style-theme',
  ],
  overseas: [
    ...BASE_HEAD_TYPES,
    'cool-faceslap',
    'cool-points',
    'cool-villain',
    'style-emotions',
    'style-pacing',
    'style-theme',
    'overseas-hook-engine',
    'overseas-function-density',
    'overseas-voice-redline',
  ],
  custom: [
    ...BASE_HEAD_TYPES,
    'style-emotions',
    'style-theme',
  ],
};

const ALL_HEADS: IAttentionHeadConfig[] = [
  ...BASE_HEADS, ...MYSTERY_HEADS, ...HORROR_HEADS,
  ...MIND_HEADS, ...GAME_HEADS, ...COOL_HEADS, ...STYLE_HEADS,
  ...OVERSEAS_HEADS,
];

export function getAllHeadConfigs(): Map<AttentionHeadType, IAttentionHeadConfig> {
  return new Map(ALL_HEADS.map((h) => [h.type, h]));
}

export class ModularAttentionSystem {
  private aiClient: AIClient;
  private enabledHeads: Set<AttentionHeadType>;
  private headConfigs: Map<AttentionHeadType, IAttentionHeadConfig>;
  private headWeights: Map<AttentionHeadType, number>;

  constructor(aiClient: AIClient, genre: GenreType = 'custom') {
    this.aiClient = aiClient;
    this.headConfigs = getAllHeadConfigs();
    this.headWeights = new Map();
    this.enabledHeads = new Set(GENRE_HEAD_MAPPING[genre]);

    for (const head of this.enabledHeads) {
      const config = this.headConfigs.get(head);
      if (config) {
        this.headWeights.set(head, config.weight);
      }
    }
  }

  enableHead(head: AttentionHeadType): void {
    this.enabledHeads.add(head);
    const config = this.headConfigs.get(head);
    if (config && !this.headWeights.has(head)) {
      this.headWeights.set(head, config.weight);
    }
  }

  disableHead(head: AttentionHeadType): void {
    if (head.startsWith('base-')) {
      console.warn(`[AttentionSystem] 基础头 ${head} 不能禁用`);
      return;
    }
    this.enabledHeads.delete(head);
  }

  setHeadWeight(head: AttentionHeadType, weight: number): void {
    if (this.enabledHeads.has(head)) {
      this.headWeights.set(head, Math.max(0, Math.min(1, weight)));
    }
  }

  adjustWeightsForEpisodeType(
    episodeType: 'battle' | 'romance' | 'reveal' | 'daily' | 'climax'
  ): void {
    const presets: Record<string, Record<string, number>> = {
      battle: {
        'base-relationships': 0.8,
        'base-conflicts': 1.0,
        'base-foreshadowing': 0.5,
        'base-consistency': 0.9,
        'game-leveling': 0.9,
        'cool-faceslap': 0.8,
        'cool-points': 0.9,
        'style-pacing': 0.7,
      },
      romance: {
        'base-relationships': 1.0,
        'base-conflicts': 0.4,
        'base-foreshadowing': 0.6,
        'base-consistency': 0.6,
        'style-emotions': 1.0,
        'style-pacing': 0.5,
      },
      reveal: {
        'base-relationships': 0.7,
        'base-conflicts': 0.6,
        'base-foreshadowing': 1.0,
        'base-consistency': 0.8,
        'mystery-revelation': 1.0,
        'mind-twist': 0.9,
      },
      daily: {
        'base-relationships': 0.8,
        'base-conflicts': 0.3,
        'base-foreshadowing': 0.4,
        'base-consistency': 0.5,
        'style-humor': 0.8,
        'style-pacing': 0.8,
      },
      climax: {
        'base-relationships': 1.0,
        'base-conflicts': 1.0,
        'base-foreshadowing': 0.9,
        'base-consistency': 1.0,
        'cool-faceslap': 1.0,
        'cool-points': 1.0,
        'style-pacing': 1.0,
      },
    };

    const preset = presets[episodeType];
    if (preset) {
      for (const [head, weight] of Object.entries(preset)) {
        if (this.enabledHeads.has(head as AttentionHeadType)) {
          this.headWeights.set(head as AttentionHeadType, weight);
        }
      }
    }
  }

  async analyzeWithMultiHead(
    episodePlan: string,
    worldState: IWorldState,
    previousEpisodeContent?: string
  ): Promise<IMultiHeadResult> {
    const worldStateSummary = this.formatWorldStateSummary(worldState);

    const promises = [...this.enabledHeads]
      .map((headType) => this.headConfigs.get(headType))
      .filter((config): config is IAttentionHeadConfig => !!config)
      .map((config) => this.executeHead(config, episodePlan, worldStateSummary, previousEpisodeContent));

    const headResults = await Promise.all(promises);
    return this.aggregateResults(headResults);
  }

  private async executeHead(
    config: IAttentionHeadConfig,
    episodePlan: string,
    worldStateSummary: string,
    previousEpisodeContent?: string
  ): Promise<IHeadAnalysisResult> {
    const previousEpisodeSection = previousEpisodeContent
      ? `【上一集完整内容】
${previousEpisodeContent}

[分析提示] 请参考上一集内容：
- 检查设定/装备/能力一致性
- 理解情感铺垫和发展
- 追踪人物状态变化
- 确保信息连贯

`
      : '';

    const prompt = `你是剧本分析专家，当前执行【${config.name}】分析。

${previousEpisodeSection}【本集梗概】
${episodePlan}

【当前世界状态】
${worldStateSummary}

【分析任务】
${config.prompt}

【约束输出要求】
在 constraints 中输出的约束需要：
1. 具体：明确指出"谁做什么"或"必须有什么内容"
2. 可验证：生成后的剧本可以根据约束检查是否满足
3. 避免主观词：不要用"充沛"、"感人"、"合理"等无法量化的词
4. 格式建议：
   - "必须有[角色/场景/事件]的描写"
   - "[角色]需要在本集中[做什么/表达什么]"
   - "本集需要交代/解决/铺垫[具体内容]"

请输出 JSON 格式：
\`\`\`json
{
  "insights": ["分析洞察1", "分析洞察2"],
  "suggestions": ["建议1", "建议2"],
  "constraints": ["约束1", "约束2"],
  "warnings": ["警告1"],
  "relevantElements": [
    {"element": "元素名", "weight": 0.8, "reason": "相关原因"}
  ]
}
\`\`\`

JSON格式要求：
- 所有字符串值必须使用英文双引号
- 字符串内部的引号必须转义为 \\"
- reason 字段限制在30字以内
- 数组为空时使用 []`;

    const EMPTY_RESULT: Omit<IHeadAnalysisResult, 'headType'> = {
      insights: [], suggestions: [], constraints: [], warnings: [], relevantElements: [],
    };

    try {
      const response = await this.aiClient.generate('', prompt, 12000);
      const parsed = robustParseJson<Omit<IHeadAnalysisResult, 'headType'>>(response, EMPTY_RESULT);

      return {
        headType: config.type,
        insights: parsed.insights || [],
        suggestions: parsed.suggestions || [],
        constraints: parsed.constraints || [],
        warnings: parsed.warnings || [],
        relevantElements: parsed.relevantElements || [],
      };
    } catch (error) {
      console.warn(`[AttentionSystem] ${config.name} 分析失败，已跳过。错误: ${(error as Error).message?.slice(0, 100)}`);
      return {
        ...EMPTY_RESULT,
        headType: config.type,
        warnings: [`${config.name}分析超时/失败，结果可能不完整`],
      };
    }
  }

  private aggregateResults(headResults: IHeadAnalysisResult[]): IMultiHeadResult {
    const elementWeights = new Map<string, number>();
    const constraintMap = new Map<string, {
      constraint: string;
      weight: number;
      heads: AttentionHeadType[];
      headConfigs: IAttentionHeadConfig[];
    }>();
    const suggestionSet = new Set<string>();

    for (const result of headResults) {
      const headWeight = this.headWeights.get(result.headType) || 1.0;
      const headConfig = this.headConfigs.get(result.headType);

      for (const constraint of result.constraints || []) {
        const existing = constraintMap.get(constraint);
        if (existing) {
          existing.weight += headWeight;
          existing.heads.push(result.headType);
          if (headConfig) existing.headConfigs.push(headConfig);
        } else {
          constraintMap.set(constraint, {
            constraint,
            weight: headWeight,
            heads: [result.headType],
            headConfigs: headConfig ? [headConfig] : [],
          });
        }
      }

      for (const suggestion of result.suggestions || []) {
        suggestionSet.add(suggestion);
      }

      for (const elem of result.relevantElements || []) {
        const current = elementWeights.get(elem.element) || 0;
        elementWeights.set(elem.element, Math.min(current + elem.weight * headWeight, 1.0));
      }
    }

    const crossDimensionInsights = this.discoverCrossDimensionInsights(headResults);

    // 构建结构化约束，按权重降序
    // 可验证约束总量设上限：过多的可验证约束会稀释验证器注意力并拉低首试满足率，
    // 权重尾部降级为 guidance（仍参与生成指导，仅不计入验证评分）
    const MAX_VERIFIABLE_HEAD_CONSTRAINTS = 60;
    const aggregatedConstraints: IStructuredConstraint[] = Array.from(constraintMap.values())
      .sort((a, b) => b.weight - a.weight)
      .map((item, index) => {
        const hasBaseHead = item.heads.some(h => h.startsWith('base-'));
        const primaryHeadType = item.heads[0];
        const primaryConfig = item.headConfigs[0];

        // 基础头=critical, 多头共识的扩展头=important, 单扩展头=normal
        const severity: IStructuredConstraint['severity'] = hasBaseHead
          ? 'critical'
          : item.heads.length >= 2 ? 'important' : 'normal';

        return {
          content: item.constraint,
          headType: primaryHeadType,
          headCategory: primaryConfig?.category || 'base' as const,
          headWeight: this.headWeights.get(primaryHeadType) || 1.0,
          category: (severity === 'critical' || index < MAX_VERIFIABLE_HEAD_CONSTRAINTS ? 'verifiable' : 'guidance') as IStructuredConstraint['category'],
          severity,
        };
      });

    return {
      headResults,
      crossDimensionInsights,
      aggregatedConstraints,
      aggregatedSuggestions: [...suggestionSet],
      elementWeights,
    };
  }

  /** 查找在多个注意力头中都具有高权重的元素 */
  private discoverCrossDimensionInsights(headResults: IHeadAnalysisResult[]): string[] {
    // 单次遍历：按元素名聚合出现的头
    const elementHeads = new Map<string, AttentionHeadType[]>();
    for (const result of headResults) {
      for (const elem of result.relevantElements) {
        if (elem.weight >= 0.7) {
          const heads = elementHeads.get(elem.element) || [];
          heads.push(result.headType);
          elementHeads.set(elem.element, heads);
        }
      }
    }

    const insights: string[] = [];
    for (const [element, heads] of elementHeads) {
      if (heads.length >= 2) {
        const headNames = heads.map((h) => this.headConfigs.get(h)?.name || h);
        insights.push(
          `【跨维度关联】"${element}" 在多个维度（${headNames.join('、')}）中都具有高相关性`
        );
      }
    }
    return insights;
  }

  private formatWorldStateSummary(worldState: IWorldState): string {
    const sections: string[] = [];

    sections.push('【角色列表】');
    for (const [, char] of worldState.characters) {
      if (char.status !== 'active') continue;
      const info = [
        `${char.name}(${char.role})`,
        char.tier,
        char.status,
        char.physicalCondition !== '正常' ? `身体:${char.physicalCondition}` : null,
        char.currentEquipment.length > 0
          ? `装备:${char.currentEquipment.join(',')}`
          : null,
      ]
        .filter(Boolean)
        .join(' | ');
      sections.push(`  • ${info}`);
    }

    sections.push('\n【未回收伏笔】');
    for (const f of worldState.foreshadowings.planted) {
      const age = worldState.episodeNumber - f.episodePlanted;
      sections.push(`  • [第${f.episodePlanted}集埋下, 已${age}集] ${f.content}`);
    }

    sections.push('\n【近期事件】');
    for (const e of worldState.plotState.recentEvents.slice(-5)) {
      sections.push(`  • 第${e.episode}集: ${e.event}`);
    }

    if (worldState.plotState.pendingConflicts.length > 0) {
      sections.push('\n【待解决冲突】');
      for (const c of worldState.plotState.pendingConflicts) {
        sections.push(`  • ${c}`);
      }
    }

    const latestCliffhanger = worldState.plotState.cliffhangers
      .filter((c) => !c.resolved)
      .slice(-1)[0];
    if (latestCliffhanger) {
      sections.push(`\n【上集悬念】\n  ${latestCliffhanger.content}`);
    }

    return sections.join('\n');
  }

  getEnabledHeads(): AttentionHeadType[] {
    return Array.from(this.enabledHeads);
  }

  getHeadWeights(): Map<AttentionHeadType, number> {
    return new Map(this.headWeights);
  }
}
