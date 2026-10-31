/**
 * 剧本生成提示词模板
 *
 * 从原版 promptService.js 迁移，保持与原项目一致
 */

import { IOutputFormatConfig } from '../../types/OutputFormat';
import { outputFormatService } from '../format/OutputFormatService';
import { NARRATIVE_METHODOLOGY_CORE } from './narrativeMethodology';
import { OVERSEAS_METHODOLOGY } from './overseasMethodology';

export interface ScriptContextParts {
  episodeNumber?: number;  // 本次生成的起始集数（为1时启用第1集黄金开局要求）
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
    characterVoice,
    episodeNumber
  } = contextParts;

  // 制作方法论（情绪拉扯/黄金开局/卡点拉扯）：国内海外通用，不受方法论注入开关影响
  const extraRules: Array<[string, string]> = [];
  if (episodeNumber === 1) {
    extraRules.push(['第1集黄金开局', '前3秒视觉或台词冲击，前10秒冲突爆发，前30秒观众知道主角要干什么；主角的金手指（核心能力/隐藏身份/关键证据或筹码）必须在本集亮相——本集梗概已安排的照梗概写，未安排的以异象、征兆或只让观众看见的方式露出一角，不得与后续剧情矛盾；按"打压→反转→再打压"走出起伏，集尾留必看下集的钩子']);
  }
  // 付费卡点集：梗概标注（一卡）/（二卡）/【付费卡点】时触发卡点拉扯专项
  if (/[（(【](?:一卡|二卡|付费卡点)[）)】]/.test(episodePlan || '')) {
    extraRules.push(['付费卡点集', '本集是付费卡点集——把误会推到最大、把身份压到最低、把危险逼到最近、把情感撕到最痛（至少兑现两项）；主角的翻盘只给半次释放（进行到一半被外力打断、反转或悬置），结尾钩子必须是全阶段最强悬念']);
  }
  const extraRulesText = extraRules
    .map(([title, body], i) => `\n${7 + i}. **${title}**：${body}`)
    .join('');

  // 获取专家身份和格式术语（必须在 writingStyleSection 之前）
  const resolvedConfig = outputFormatService.resolveConfig(contextParts.outputFormatConfig);
  const expertIdentity = resolvedConfig.expertIdentity || '你是一位专业的剧本编剧，经验丰富，作品广受好评。';
  const terminology = outputFormatService.getFormatTerminology(resolvedConfig.sourcePreset);

  // 日志：打印实际使用的专家身份
  console.log(`[Prompt] 使用格式预设: ${resolvedConfig.sourcePreset || 'default'}`);
  console.log(`[Prompt] 专家身份: ${expertIdentity.slice(0, 50)}...`);

  // 叙事科学方法论（海外格式默认启用、国内短剧类格式默认注入提纯版、均可在项目设置中关闭；文学类格式按开关可选）
  const isOverseasFormat = resolvedConfig.sourcePreset === 'overseas_drama';
  const SHORT_DRAMA_PRESETS = new Set(['standard', 'short_video', 'live_action', 'ai_avatar']);
  const isShortDramaPreset = SHORT_DRAMA_PRESETS.has(resolvedConfig.sourcePreset || '');
  const methodologyText = isOverseasFormat
    ? OVERSEAS_METHODOLOGY
    : NARRATIVE_METHODOLOGY_CORE;
  const methodologyEnabled = contextParts.outputFormatConfig?.enableNarrativeMethodology ?? (isOverseasFormat || isShortDramaPreset);
  const narrativeSection = methodologyEnabled
    ? `\n\n## 叙事科学方法论\n\n${methodologyText}\n`
    : '';

  // 短剧节拍硬要求（制作方法论：场钩/功能密度/微奖励——海外格式已有完整规范，文学类格式不适用）
  const shortDramaBeatSection = isShortDramaPreset ? `
## 单集节拍硬要求（短剧节奏）
- 开场首帧必须是动作或冲突性台词，严禁风景空镜；本集开篇直接承接上集结尾钩子，不另起铺垫
- 场钩：每场结尾留一个小悬念或小反转，场景在"半释放"状态结束，答案带进下一场
- 功能密度：每个场景至少占一项功能（推进冲突/揭示信息/转变关系/制造悬念），每句对白至少占一项功能（新信息/情绪动作/改变关系），无功能即删
- 情绪绑定事件：主角的情绪必须挂在具体事件上（被夺走/被误解/被羞辱后的反应），不写无事件支撑的情绪
- 微奖励密度：不许连续大段纯对话或纯过场，每隔一小段给一次小正反馈（俏皮话/意外信息/小动作）
- 集尾张力>集内爽感：本集结尾钩子的悬念强度必须压过前面已兑现的释放——观众带着"更想看下一集"离开，而不是"这集爽完了"
- 慢蓄力快反转：压制蓄力可以铺足，但反转爆发要快（一两场戏内完成打脸/亮证据/身份反转），不把反转拖成半集慢动作
- 为弹幕而写：观众看到会刷"快进"的段落直接重写，会刷"爽""哈哈哈"的保留
- 对白短句：单句对白控制在15字内。信息量大时必须拆拍——先一句短句定性，再用动作或短句补信息，不许一句说完
  错误：周子墨（急报）：赵德海刚才已经向法院申请了对你全部资产的保全令而且案号三天内就能批下来
  正确：周子墨（急报）：资产保全，赵德海递的。△他把手机怼到她眼前。周子墨：案号三天就批。
` : '';

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
6. **单集起伏**：本集至少走完一轮"压→扬→新危机"——主角受压后要有一次观众看得见的反击、小胜或信息反转，释放后立刻接新的代价或危机；禁止整集只压不扬，也不要一集打满；若前情显示主角已被同一对象连续压制两集以上仍无转机，本集必须出现新转折、新能力或新变量打破压制格局${extraRulesText}
${writingStyleSection}${shortDramaBeatSection}
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
${isOverseasFormat ? `
## 交付前预算自检（自检内容不得出现在剧本正文中）
落笔时同步执行以下预算，写完逐条核对后再定稿——只输出剧本本身，不输出本清单：
1. **场景预算**：本集场景数控制在 ${resolvedConfig.sceneLimit?.min ?? 4}-${resolvedConfig.sceneLimit?.max ?? 8} 场。同一地点的连续事件合并为一场；开场直接承接上集钩子，不为铺垫单独建场
2. **字数预算**：全篇（场景头+动作+对白）不超过 ${resolvedConfig.wordLimit?.max ?? 2600} 字。写到 ${Math.round((resolvedConfig.wordLimit?.max ?? 2600) * 0.85)} 字左右就要收束剧情线，不许靠拉长动作描写灌水
3. **台词对照**：每一句台词必须是中英对照同一行"中文名（中文情绪）：中文台词English Name (English Emotion): 英文台词"——群演/配角同样要有英文名槽位（如 镇民群像#2 Townsperson #2），不允许只有中文没有英文对照、或只有英文没有中文的写法。**严禁两种错误变体**：①台词行加▲前缀（▲只用于动作行）；②英文名打头"Name (Emotion): 中文English"（必须是中文名+全角括号中文情绪开头，英文名在中文台词之后）
4. **英文台词纯度**：英文台词栏内不得混入中文字符（行业黑话也须英文化，如"灰石碱"→"greystone alkali"）
5. **动作落点**：全文不得出现"动词+了一下/一拍/一声/两秒"式弱动作收笔——动作必须写到具体落点（错：手抖了一下 / 对：手指扣住杯沿，指节泛白）
` : ''}
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
