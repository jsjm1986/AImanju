/**
 * AI 驱动的注意力头推荐服务
 * 根据项目类型描述智能推荐合适的注意力头
 */

import { AIClient, aiClient } from '../ai/AIClient';
import { robustParseJson } from '../../utils/jsonParser';
import { AttentionHeadType } from './AttentionModules';

export interface IAttentionRecommendation {
  recommendedHeads: AttentionHeadType[];
  reasons: Array<{ head: AttentionHeadType; reason: string }>;
  identifiedElements: string[];
  summary: string;
}

interface HeadInfo {
  type: AttentionHeadType;
  name: string;
  description: string;
  category: string;
  useCases: string[];
}

const AVAILABLE_HEADS: HeadInfo[] = [
  { type: 'base-relationships', name: '角色关系', description: '分析角色之间的关系变化和互动', category: 'base', useCases: ['所有题材都需要'] },
  { type: 'base-conflicts', name: '剧情冲突', description: '追踪和分析剧情冲突', category: 'base', useCases: ['所有题材都需要'] },
  { type: 'base-foreshadowing', name: '伏笔追踪', description: '管理伏笔的埋设和回收', category: 'base', useCases: ['所有题材都需要'] },
  { type: 'base-consistency', name: '世界一致性', description: '检查设定和能力边界的一致性', category: 'base', useCases: ['所有题材都需要'] },
  { type: 'mystery-clues', name: '线索追踪', description: '管理已出现线索和未解线索', category: 'mystery', useCases: ['悬疑', '推理', '侦探', '解谜', '探案'] },
  { type: 'mystery-logic', name: '逻辑一致性', description: '检查推理逻辑的自洽性', category: 'mystery', useCases: ['悬疑', '推理', '智斗', '谋略'] },
  { type: 'mystery-revelation', name: '谜底管理', description: '控制谜底揭示的时机和铺垫', category: 'mystery', useCases: ['悬疑', '推理', '反转', '揭秘'] },
  { type: 'horror-atmosphere', name: '氛围营造', description: '管理恐怖元素分布和紧张度', category: 'horror', useCases: ['恐怖', '惊悚', '灵异', '末世', '黑暗'] },
  { type: 'horror-rhythm', name: '惊吓节奏', description: '控制惊吓点间隔和松弛度', category: 'horror', useCases: ['恐怖', '惊悚', '紧张', '刺激'] },
  { type: 'horror-unknown', name: '未知管理', description: '保持神秘感和信息释放节奏', category: 'horror', useCases: ['恐怖', '悬疑', '神秘', '未知'] },
  { type: 'mind-information', name: '信息差管理', description: '控制各方掌握的信息差异', category: 'mind', useCases: ['智斗', '谋略', '权谋', '商战', '宫斗'] },
  { type: 'mind-strategy', name: '策略对弈', description: '管理策略博弈和计谋', category: 'mind', useCases: ['智斗', '谋略', '战争', '商战', '棋局'] },
  { type: 'mind-twist', name: '反转铺垫', description: '管理剧情反转的铺垫', category: 'mind', useCases: ['智斗', '悬疑', '反转', '意外'] },
  { type: 'game-leveling', name: '等级系统', description: '追踪等级提升和修炼进度', category: 'game', useCases: ['系统流', '游戏', '修仙', '升级', '种田', '经营'] },
  { type: 'game-equipment', name: '装备获取', description: '管理装备、宝物的获取', category: 'game', useCases: ['系统流', '游戏', '玄幻', '奇幻', '寻宝'] },
  { type: 'game-skills', name: '技能展示', description: '展示技能使用和突破', category: 'game', useCases: ['系统流', '游戏', '战斗', '修炼', '玄幻'] },
  { type: 'cool-faceslap', name: '打脸节奏', description: '控制打脸场景的节奏', category: 'cool', useCases: ['爽文', '打脸', '逆袭', '装逼', '都市'] },
  { type: 'cool-points', name: '爽点分布', description: '管理爽点在剧情中的分布', category: 'cool', useCases: ['爽文', '热血', '逆袭', '战斗'] },
  { type: 'cool-villain', name: '反派智商', description: '控制反派的智商表现', category: 'cool', useCases: ['爽文', '打脸', '反派', '对抗'] },
  { type: 'style-emotions', name: '情感弧线', description: '管理情感发展和情感节奏', category: 'style', useCases: ['言情', '感情', '虐恋', '甜宠', '情感'] },
  { type: 'style-pacing', name: '节奏控制', description: '控制叙事节奏快慢', category: 'style', useCases: ['日常', '轻松', '慢节奏', '治愈'] },
  { type: 'style-humor', name: '幽默调节', description: '管理幽默元素和搞笑时机', category: 'style', useCases: ['喜剧', '搞笑', '轻松', '沙雕', '日常'] },
];

const BASE_HEADS: AttentionHeadType[] = AVAILABLE_HEADS
  .filter(h => h.category === 'base')
  .map(h => h.type);

const VALID_HEAD_SET = new Set<string>(AVAILABLE_HEADS.map(h => h.type));

/** 收集去重的注意力头及其理由 */
function collectUniqueHeads(
  existing: AttentionHeadType[],
  entries: Array<{ head: AttentionHeadType; reason: string }>,
): { heads: AttentionHeadType[]; reasons: Array<{ head: AttentionHeadType; reason: string }> } {
  const heads = [...existing];
  const reasons: Array<{ head: AttentionHeadType; reason: string }> = [];
  for (const entry of entries) {
    if (!heads.includes(entry.head)) {
      heads.push(entry.head);
      reasons.push(entry);
    }
  }
  return { heads, reasons };
}

/** 降级方案的关键词匹配规则，提升到模块级避免每次调用重建 */
const FALLBACK_RULES: Array<{
  keywords: string[];
  heads: AttentionHeadType[];
  element: string;
}> = [
  { keywords: ['悬疑', '推理', '侦探', '解谜', '探案'], heads: ['mystery-clues', 'mystery-logic', 'mystery-revelation'], element: '悬疑推理' },
  { keywords: ['恐怖', '惊悚', '灵异', '末世', '黑暗'], heads: ['horror-atmosphere', 'horror-rhythm', 'horror-unknown'], element: '恐怖惊悚' },
  { keywords: ['智斗', '谋略', '权谋', '商战', '宫斗', '计谋'], heads: ['mind-information', 'mind-strategy', 'mind-twist'], element: '智斗谋略' },
  { keywords: ['系统', '游戏', '升级', '种田', '经营', '模拟'], heads: ['game-leveling', 'game-equipment'], element: '系统经营' },
  { keywords: ['玄幻', '奇幻', '修仙', '修炼', '仙侠'], heads: ['game-skills', 'cool-points'], element: '玄幻修仙' },
  { keywords: ['爽文', '打脸', '逆袭', '装逼', '都市'], heads: ['cool-faceslap', 'cool-points', 'cool-villain'], element: '爽文逆袭' },
  { keywords: ['言情', '感情', '甜宠', '恋爱', '爱情'], heads: ['style-emotions'], element: '情感言情' },
  { keywords: ['日常', '轻松', '治愈', '慢节奏'], heads: ['style-pacing'], element: '轻松日常' },
  { keywords: ['喜剧', '搞笑', '沙雕', '幽默'], heads: ['style-humor'], element: '喜剧搞笑' },
];

export class AttentionRecommender {
  private aiClient: AIClient;

  constructor(aiClientInstance?: AIClient) {
    this.aiClient = aiClientInstance || aiClient;
  }

  async recommendHeads(
    typeDescription: string,
    projectName?: string,
    concept?: string
  ): Promise<IAttentionRecommendation> {
    const headsInfo = AVAILABLE_HEADS.filter(h => h.category !== 'base')
      .map(h => `- ${h.type} (${h.name}): ${h.description}。适用场景: ${h.useCases.join('、')}`)
      .join('\n');

    const prompt = `你是一个专业的动态漫剧本分析师。请根据以下项目信息，分析并推荐最合适的"注意力头"模块。

## 项目信息
${projectName ? `- 项目名称: ${projectName}` : ''}
- 类型描述: ${typeDescription}
${concept ? `- 故事概念: ${concept}` : ''}

## 可选的注意力头模块
${headsInfo}

## 分析要求
1. 仔细分析类型描述中的关键词和元素
2. 选择3-6个最相关的注意力头（基础头自动包含，不需要选择）
3. 为每个选择说明理由

## 输出格式（必须是合法的 JSON）
请严格按照以下 JSON 格式输出，不要包含 markdown 代码块标记，不要包含其他文字：
{
  "identifiedElements": ["识别出的题材元素1", "题材元素2"],
  "recommendations": [
    {
      "head": "注意力头ID (必须精确匹配列表中的 type)",
      "reason": "推荐理由"
    }
  ],
  "summary": "一句话总结推荐策略"
}`;

    try {
      console.log(`[AttentionRecommender] Sending prompt for ${projectName || 'project'}...`);
      const response = await this.aiClient.generate(
        '你是一个专业的动态漫剧本分析师。请只输出 JSON 数据，不要包含 markdown 标记或其他解释性文字。',
        prompt,
        2000
      );

      console.log('[AttentionRecommender] Raw AI Response:', response ? response.substring(0, 500) : 'null');

      const result = robustParseJson(response, {
        identifiedElements: [],
        recommendations: [],
        summary: '',
      }) as {
        identifiedElements: string[];
        recommendations: Array<{ head: string; reason: string }>;
        summary: string;
      };

      // 过滤无效头并记录警告
      const validEntries: Array<{ head: AttentionHeadType; reason: string }> = [];
      for (const rec of result.recommendations) {
        if (VALID_HEAD_SET.has(rec.head)) {
          validEntries.push({ head: rec.head as AttentionHeadType, reason: rec.reason });
        } else {
          console.warn(`[AttentionRecommender] Invalid head type returned: ${rec.head}`);
        }
      }

      const { heads: recommendedHeads, reasons } = collectUniqueHeads(BASE_HEADS, validEntries);

      if (recommendedHeads.length === BASE_HEADS.length) {
        console.warn('[AttentionRecommender] AI returned no valid heads, falling back.');
        return this.fallbackRecommend(typeDescription);
      }

      return {
        recommendedHeads,
        reasons,
        identifiedElements: result.identifiedElements || [],
        summary: result.summary || '已根据项目类型智能推荐注意力头',
      };
    } catch (error) {
      console.error('[AttentionRecommender] AI 分析失败，使用降级方案:', error);
      return this.fallbackRecommend(typeDescription);
    }
  }

  private fallbackRecommend(typeDescription: string): IAttentionRecommendation {
    const text = typeDescription.toLowerCase();
    const identifiedElements: string[] = [];
    const allEntries: Array<{ head: AttentionHeadType; reason: string }> = [];

    for (const rule of FALLBACK_RULES) {
      if (rule.keywords.some(kw => text.includes(kw))) {
        identifiedElements.push(rule.element);
        for (const head of rule.heads) {
          allEntries.push({ head, reason: `检测到"${rule.element}"元素` });
        }
      }
    }

    const { heads: recommendedHeads, reasons } = collectUniqueHeads(BASE_HEADS, allEntries);

    return {
      recommendedHeads,
      reasons,
      identifiedElements,
      summary: identifiedElements.length > 0
        ? `识别到: ${identifiedElements.join('、')}`
        : '未识别到特定题材，使用基础配置',
    };
  }

  static getAvailableHeads(): HeadInfo[] {
    return AVAILABLE_HEADS;
  }
}
