/**
 * 剧本生成提示词模板
 *
 * 从原版 promptService.js 迁移，保持与原项目一致
 */

import { IOutputFormatConfig } from '../../types/OutputFormat';
import { outputFormatService } from '../format/OutputFormatService';
import { NARRATIVE_METHODOLOGY } from './narrativeMethodology';
import { OVERSEAS_METHODOLOGY } from './overseasMethodology';

export interface ScriptContextParts {
  characterContext?: string;
  previousSummary?: string;
  synopsis?: string;
  episodePlan?: string;
  stateChanges?: string;
  unresolvedForeshadowing?: string;
  characterContinuity?: string;
  writingStyle?: {
    preset: string;
    customDescription?: string;
    styleGuide: string;  // 生成的风格指南
  };
  sceneRhythm?: string;  // 场景节奏规划
  characterCharm?: string;  // 角色魅力特征
  characterArc?: string;  // 角色成长弧线
  characterRelationship?: string;  // 角色关系网络
  characterVoice?: string;  // 角色语言风格
  outputFormatConfig?: IOutputFormatConfig;  // 输出格式配置
}

/**
 * 写作风格预设的详细指南
 */
const WRITING_STYLE_GUIDES: Record<string, string> = {
  literary: `【文艺风格指南】
- 语言优美细腻，注重意境营造
- 善用比喻、拟人等修辞手法
- 画面描写富有诗意和美感
- 对白含蓄内敛，留有余韵
- 情感表达细腻深沉
- 示例对白风格："月色如霜，她的眼眸里倒映着满天星辰。"`,

  colloquial: `【口语化风格指南】
- 语言通俗易懂，贴近日常生活
- 对白简洁有力，节奏明快
- 少用华丽辞藻，多用短句
- 动作描写干脆利落
- 情感表达直接爽快
- 示例对白风格："他一脚踹开门：'就凭你？'"`,

  humorous: `【幽默风格指南】
- 善用反差和意外制造笑点
- 对白机智诙谐，轻松愉快
- 可适当使用夸张手法
- 角色可以有吐槽属性
- 紧张场面也可穿插轻松元素
- 示例对白风格："他一本正经地点头：'放心，我最大的优点就是谦虚。'"`,

  serious: `【严肃风格指南】
- 语言正经庄重，深沉厚重
- 对白字斟句酌，暗藏机锋
- 适合权谋、历史、商战题材
- 情感表达克制内敛
- 注重人物的城府和心机
- 示例对白风格："朝堂之上，暗流涌动。每一个眼神，都是一场无声的博弈。"`,

  poetic: `【诗意风格指南】
- 语言富有诗意，意境深远
- 善用古风词汇和意象
- 画面描写如诗如画
- 适合仙侠、古风题材
- 对白可带有古韵
- 示例对白风格："剑光如虹，划破长空。他立于云端，衣袂飘飘，宛若谪仙。"`,

  dramatic: `【戏剧化风格指南】
- 冲突强烈，情感饱满
- 善用高潮迭起的节奏
- 对白充满张力和情绪
- 画面描写注重冲击力
- 情感表达激烈外放
- 示例对白风格："'不！'她撕心裂肺地喊道，眼睁睁看着他坠入深渊。"`,

  minimalist: `【极简风格指南】
- 语言简洁明快，惜字如金
- 大量使用短句和留白
- 对白精炼，一针见血
- 画面描写点到为止
- 节奏紧凑，不拖泥带水
- 示例对白风格："他来了。她走了。一切，结束了。"`,

  descriptive: `【细腻描写风格指南】
- 细节丰富，画面感极强
- 注重动作分解和特写
- 适合动漫改编，便于分镜
- 对白配合动作和表情
- 环境描写生动具体
- 示例对白风格："他缓缓抬起右手，指尖凝聚着淡蓝色的灵力光芒，周围的空气都开始微微震颤。"`,
};

/**
 * 获取写作风格指南
 */
export function getWritingStyleGuide(preset: string, customDescription?: string): string {
  if (preset === 'custom' && customDescription) {
    return `【自定义风格指南】
${customDescription}

请严格按照上述自定义风格要求进行创作。`;
  }

  return WRITING_STYLE_GUIDES[preset] || WRITING_STYLE_GUIDES['colloquial'];
}

/**
 * 剧本生成Agent的System Prompt
 * 接收动态注入的上下文
 */
export function getScriptAgentPrompt(contextParts: ScriptContextParts): string {
  const {
    characterContext,
    previousSummary,
    synopsis,
    episodePlan,
    stateChanges,
    unresolvedForeshadowing,
    characterContinuity,
    writingStyle,
    sceneRhythm,
    characterCharm,
    characterArc,
    characterRelationship,
    characterVoice
  } = contextParts;

  // 获取专家身份和格式术语（必须在 writingStyleSection 之前）
  const resolvedConfig = outputFormatService.resolveConfig(contextParts.outputFormatConfig);
  const expertIdentity = resolvedConfig.expertIdentity || '你是一位专业的剧本编剧，经验丰富，作品广受好评。';
  const terminology = outputFormatService.getFormatTerminology(resolvedConfig.sourcePreset);

  // 日志：打印实际使用的专家身份
  console.log(`[Prompt] 使用格式预设: ${resolvedConfig.sourcePreset || 'default'}`);
  console.log(`[Prompt] 专家身份: ${expertIdentity.slice(0, 50)}...`);

  // 叙事科学方法论（海外格式默认启用、可在项目设置中关闭；其他格式按开关可选注入）
  const isOverseasFormat = resolvedConfig.sourcePreset === 'overseas_drama';
  const methodologyText = isOverseasFormat
    ? OVERSEAS_METHODOLOGY
    : NARRATIVE_METHODOLOGY;
  const methodologyEnabled = contextParts.outputFormatConfig?.enableNarrativeMethodology ?? isOverseasFormat;
  const narrativeSection = methodologyEnabled
    ? `\n\n## 叙事科学方法论\n\n${methodologyText}\n`
    : '';

  // 写作风格是强制要求
  const writingStyleSection = writingStyle ? `
## 写作风格（强制要求）

**本项目指定风格：${writingStyle.preset === 'custom' ? '自定义风格' : writingStyle.preset}**

${writingStyle.styleGuide}

⚠️ 【重要】写作风格是本项目的核心要求，必须严格遵守：
- 所有对白、${terminology.actionDesc}、旁白都必须符合上述风格
- 风格不一致将触发重新生成
- 不得在生成过程中切换或混用其他风格
` : '';

  return `${expertIdentity}根据提供的设定和大纲，生成高质量的${terminology.contentType}。
${narrativeSection}
## 强制要求（必须满足，违反将触发重新生成）

1. **写作风格**：必须严格遵循项目指定的写作风格（见下方详细说明）
2. **伏笔回收**：标记为[OVERDUE]的伏笔必须在本集回收；[WARNING]的强烈建议回收
3. **角色一致性**：性格、外貌、说话方式、称呼、关系必须与设定一致
4. **格式规范**：严格按照下方格式输出，不得自创格式
5. **禁止元信息泄漏**：剧本正文（包括旁白、对白、动作描写）中绝对不能出现"第X集"、"上集"、"上一集"、"与上集X-X"等引用集数的元信息。下方提供的"前情提要"、"角色状态变化"、"伏笔"、"世界状态"等上下文仅供你理解剧情脉络，必须将其转化为自然的剧情内容，不得在正文中直接引用这些参考信息的原文或集数编号
${writingStyleSection}
## 建议遵循（提升质量）

1. **剧情连贯**：承接前情，发展当前，铺垫后续
2. **角色存续**：重要角色不应无故消失，如不出场需交代去向
3. **节奏把控**：开场有钩子，中段推进，结尾有悬念

${characterContext ? `## 角色设定\n\n${characterContext}\n` : ''}

${characterCharm ? `${characterCharm}\n` : ''}

${characterArc ? `${characterArc}\n` : ''}

${characterRelationship ? `${characterRelationship}\n` : ''}

${characterVoice ? `${characterVoice}\n` : ''}

${previousSummary ? `## 前情提要（仅供理解剧情脉络，不要在正文中出现"第X集"等集数引用）\n\n${previousSummary}\n` : ''}

${stateChanges ? `## 角色状态变化（参考信息，正文中不得引用集数编号）\n\n${stateChanges}\n` : ''}

${characterContinuity ? `${characterContinuity}\n` : ''}

${unresolvedForeshadowing ? `## 伏笔回收要求

${unresolvedForeshadowing}

**处理规则**：
- [OVERDUE] 超期伏笔：本集必须回收，否则触发重新生成
- [WARNING] 临近超期：强烈建议本集回收
- [NORMAL] 普通伏笔：可根据剧情自然安排
- 回收方式：对话揭示、剧情呼应、角色行动
` : ''}

## 剧情大纲

${synopsis || '（请根据分集梗概推进剧情）'}

## 本集梗概

${episodePlan || '（按用户指定集数生成）'}

${sceneRhythm ? `${sceneRhythm}\n` : ''}
${outputFormatService.buildFormatPromptSection(
    outputFormatService.resolveConfig(contextParts.outputFormatConfig),
    contextParts.outputFormatConfig?.customPrompt
  )}

现在请生成指定${terminology.unitName}的完整${terminology.contentType}。`;
}

/**
 * 状态分析提示词
 */
export const STATE_ANALYSIS_PROMPT = `分析剧本，提取角色状态变化。输出JSON格式：

{
  "episode": 集数,
  "characters": [
    {
      "name": "角色名",
      "changes": [
        {"type": "equipment|ability|status|relationship", "detail": "描述"}
      ]
    }
  ],
  "summary": {
    "brief": "一句话总结",
    "keyEvents": ["事件1", "事件2"],
    "cliffhanger": "结尾悬念"
  }
}

只输出JSON，不要其他内容。`;

/**
 * 剧本摘要生成提示词
 */
export const SUMMARY_PROMPT = `你是一位剧本分析专家。请根据提供的剧本内容，生成简洁的剧情摘要。

要求：
1. 摘要字数控制在100字以内
2. 突出关键剧情转折点
3. 记录重要的角色状态变化
4. 标注任何伏笔或悬念`;

/**
 * 构建角色上下文
 */
export function buildCharacterContext(characters: Array<{
  name: string;
  nameCn?: string;
  identity: string;
  personality: string;
  appearance?: string;
  abilities?: string[];
  equipment?: string[];
  relationships?: { [key: string]: string };
}>): string {
  if (!characters || characters.length === 0) {
    return '';
  }

  return characters.map((char, index) => {
    // 海外双语格式：中文名+空格+英文名与台词"中文名 英文名"位对齐
    const displayName = char.nameCn ? `${char.nameCn} ${char.name}` : char.name;
    let context = `${index + 1}. ${displayName}（${char.identity}）\n`;
    context += `性格：${char.personality}\n`;

    if (char.appearance) {
      context += `外貌：${char.appearance}\n`;
    }

    if (char.abilities && char.abilities.length > 0) {
      context += `能力：${char.abilities.join('、')}\n`;
    }

    if (char.equipment && char.equipment.length > 0) {
      context += `装备：${char.equipment.join('、')}\n`;
    }

    if (char.relationships) {
      const relText = Object.entries(char.relationships)
        .map(([name, rel]) => `${name}(${rel})`)
        .join('、');
      context += `关系：${relText}\n`;
    }

    return context;
  }).join('\n');
}

/**
 * 构建前情摘要
 */
export function buildPreviousSummary(summaries: Array<{
  episode: number;
  summary: string;
  keyEvents?: string[];
}>): string {
  if (!summaries || summaries.length === 0) {
    return '';
  }

  // 只取最近5集的摘要
  const recent = summaries.slice(-5);

  return recent.map(s => {
    let text = `第${s.episode}集：${s.summary}`;
    if (s.keyEvents && s.keyEvents.length > 0) {
      text += `\n  关键事件：${s.keyEvents.join('、')}`;
    }
    return text;
  }).join('\n\n');
}

/**
 * 构建状态变化上下文
 */
export function buildStateChangesContext(stateChanges: Array<{
  characterName: string;
  episode: number;
  changes: Array<{
    type: string;
    detail: string;
  }>;
}>): string {
  if (!stateChanges || stateChanges.length === 0) {
    return '';
  }

  const byCharacter: { [name: string]: string[] } = {};

  stateChanges.forEach(sc => {
    if (!byCharacter[sc.characterName]) {
      byCharacter[sc.characterName] = [];
    }
    sc.changes.forEach(c => {
      byCharacter[sc.characterName].push(`第${sc.episode}集-${c.type}：${c.detail}`);
    });
  });

  return Object.entries(byCharacter)
    .map(([name, changes]) => `【${name}】\n${changes.join('\n')}`)
    .join('\n\n');
}
