import { isOverseasFemaleChannel, isOverseasProject } from '../../constants/overseas';

export type StoryMode = 'complete' | 'open_ended' | 'sequel';
export type PacingStyle = 'fast' | 'standard' | 'slow';

export interface PreviousSeasonContext {
  characters: string;
  finalState: string;
  unresolvedPlots: string[];
}

export interface EnhancedOutlineParams {
  name?: string;
  genre?: string;
  type?: string;
  concept: string;
  requirements?: string;
  totalEpisodes: number;
  storyMode?: StoryMode;
  pacing?: PacingStyle;
  previousSeasonContext?: PreviousSeasonContext;
  expertIdentity?: string;
}

const DEFAULT_OUTLINE_IDENTITY = '你是一位专业的动态漫剧策划编剧，专门为短视频平台创作男频/女频漫剧。';

const STORY_MODE_MAP: Record<StoryMode, string> = {
  complete: `【故事模式 - 完整剧】
本季需要独立完结：
- 主线冲突在本季彻底解决
- 所有重要伏笔收尾
- 角色弧光完成`,
  open_ended: `【故事模式 - 可续集】
本季需要为续集留空间：
- 本季有独立的核心冲突和高潮
- 主角达成阶段性目标
- 大反派或更大危机暂时受挫/部分揭示
- 结尾可留悬念钩子`,
  sequel: `【故事模式 - 承接季】
本季续接前作，需要：
- 自然承接前作结局状态
- 继承核心人物设定（可成长变化）
- 至少回收 1-2 个前作伏笔
- 设计本季独立的核心冲突
- 可引入新角色`,
};

const PACING_MAP: Record<PacingStyle, string> = {
  fast: `【节奏风格 - 快节奏】
竖屏短剧风格：
- 每集开篇10秒内必须出爆点或悬念
- 对白简洁有力，避免冗长铺垫
- 每 3-5 集一个反转
- 情绪切换要快`,
  standard: '',
  slow: `【节奏风格 - 慢热】
长篇网剧风格：
- 允许细腻的情感铺垫
- 多支线并行发展
- 世界观可以逐步展开
- 角色关系慢慢升温`,
};

const CHARACTER_CARD_EXAMPLE = `**格式说明：** 第一行为"序号. 角色真实姓名（角色定位）"，如：

1. 李昂（男主角）
性别：男
年龄：28岁
身份：前特种兵→快递员→地下拳王
发型：黑色短发，利落干练
发色：黑色
脸型：剑眉星目，五官刚毅，下巴线条硬朗
身材：身材高大健硕，肌肉线条分明
穿着：日常穿深色休闲装，战斗时换黑色作战服
配饰：左手腕戴着亡妻遗留的银手链
性格：沉稳、果断、重情重义、不怒自威

2. 林雪（女主角）
性别：女
年龄：25岁
...以此类推...

**必须遵循的格式规则：**
- 第一行必须是：序号. 真实姓名（角色定位），如 "1. 李昂（男主角）"
- 不要写成 "1. 姓名（角色定位）：李昂（男主角）" 这种格式
- 每个字段占一行，字段名后用中文冒号
- 性格用顿号分隔3-5个关键词`;

const CHARACTER_ROLES = '**角色定位：** 男主角/女主角/夏国领队/队友/对手/反派/前女友/恶亲戚/配角';

const PERSONALITY_KEYWORDS = `**性格关键词：**
- 正派：自信、果断、热血、机智、正义、隐忍
- 反派：傲慢、阴险、残忍、贪婪、狡猾
- 搞笑：变态滑稽、无底线、厚颜无耻`;

const SHUANGDIAN_PRINCIPLES = `## 爽点设计原则

1. **打脸**：每3-5集至少一次
2. **升级**：清晰的实力提升线
3. **逆袭**：以弱胜强的名场面
4. **金句**：可传播的台词
5. **伏笔**：前后呼应`;

// ============ 海外短剧专用模块 ============

const OVERSEAS_CHARACTER_CARD_EXAMPLE = `**格式说明：** 第一行为"序号. 角色英文原名（中文译名·角色定位）"，如（以下人名与设定仅为格式示意，实际人物须按本项目题材与人设原创）：

1. Daniel Hart（丹尼尔·哈特·男主角）
英文名：Daniel Hart
性别：男
年龄：30岁
身份背景：小镇出身的急诊医生→医院合伙人；导师因医疗事故蒙冤自杀的创伤是他转投体制的根因
性格特质：冷静、克制、习惯把情绪压在专业判断之下、对认定的事不放手
核心动机：证明导师清白（内心最深的驱动力）
人物弧光：从压抑自我的体制合作者→敢于对抗体制的真相揭露者
关键关系：与女主Emma Collins从互相利用到彼此托付；与院长Dr. Shaw是恩师与嫌疑人的双重关系
渴望：被体制认可的同时守住医者底线（最深渴望，支撑台词潜文本）
反差：表面温和顺从，实际为达目的可以冷血利用规则
软肋：对无力支付医疗费的患者无法袖手旁观
发型：深棕色短发，额前微垂
发色：深棕色
脸型：轮廓分明，灰色眼睛，眼下有长期值班留下的淡青
身材：185cm，肩背挺拔，常年持病历夹的右手有薄茧
穿着：白大褂下永远是熨平的衬衫，袖口卷到小臂
配饰：脖子上挂着一枚旧听诊器（导师遗物）
形态：（狼人/吸血鬼题材必填，如 Alpha狼形态-银色巨狼；人类题材填"无"）

2. Emma Collins（艾玛·柯林斯·女主角）
性别：女
...以此类推...

**必须遵循的格式规则：**
- 角色名必须使用英文原名，禁止中文音译替代（正文台词称呼也用英文名）；中文译名写进第一行括号内（与角色定位一起用·分隔）
- 第一行必须是：序号. 英文原名（中文译名·角色定位），如 "1. Daniel Hart（丹尼尔·哈特·男主角）"
- 人物小传六字段必填：身份背景/性格特质/核心动机/人物弧光/关键关系——这些字段支撑剧情张力、台词潜文本与导演选角
- 潜文本三字段保留：渴望（内心最深的渴望）/反差（表里性格反差）/软肋（可被利用的情感弱点）——为主要角色提供声口指纹与剧情张力依据
- 每个字段占一行，字段名后用中文冒号
- 视觉字段（发型/发色/脸型/身材/穿着/配饰）必须具体可拍，服务于AI仿真人三视图资产一致性
- 性格用顿号分隔3-5个关键词
- 示例中的人名/身份/性格只是格式演示，必须按本项目题材重新设计，不得沿用示例设定`;

function getOverseasPaywallPlan(totalEpisodes: number): string {
  const wall1 = Math.min(Math.max(8, Math.round(totalEpisodes * 0.13)), 12);
  const wall2 = Math.min(Math.max(Math.round(totalEpisodes * 0.33), wall1 + 6), Math.round(totalEpisodes * 0.6));
  return `【付费卡点设计】（必须规划，标注在对应集标题上）
- 一卡：第${wall1}集（卡${wall1}付${wall1 + 1}）——第${wall1}集结尾必须是全剧第一情绪峰值+最强悬念，迫使付费
- 二卡：第${wall2}集（卡${wall2}付${wall2 + 1}）——第二情绪峰值，身份揭露或关系决裂级钩子
- 集数必须严格使用上述计算值（一卡=第${wall1}集、二卡=第${wall2}集），不得自行改为其他集数
- 卡点前2集开始蓄力加码，卡点集钩子必须"5秒内可理解的强画面悬念"
- 集标题标注方式：第${wall1}集（一卡）：`;
}

const OVERSEAS_STRUCTURE = `【三幕七节点结构】（海外短剧标准结构）
- 第一幕·引爆（约前10%集数）：Ep1零铺垫直切最高浓度冲突，E2-3必要倒叙补齐信息差，E4-7关系/利益锁定，E8-10第一高峰=付费卡点
- 第二幕·缠斗（中段）：至少3条阻力线交替施压（事业/情感/悬念错峰），安排至暗时刻，女主不可长期被动挨打
- 第三幕·收束（后10%）：主角主动反击（非被动获救），多重爽点叠加收尾，主线钩子回收闭环`;

const OVERSEAS_DUAL_HOOK = `【双钩引擎】
- 主线钩子：Ep1必须埋设（TA真实身份？谁杀了TA？为什么？能不能活？诅咒如何解除？），大结局揭晓
- 单集钩子：每集梗概结尾必须写出下集钩子（具体的画面悬念，不要"敬请期待"式空话）`;

const OVERSEAS_FEMALE_FORMULA = `【黄金三角人设公式 - 女频】
- 女主：表面弱势/平凡身份 + 隐藏的高贵血统或惊人能力 + 极致反差 + 情感弧线从"错爱/被欺"走向"自我价值+被独宠"
- 男主：绝对权力（黑手党/财阀/Alpha/王室） + 对女主绝对专一 + 隐藏脆弱点 + 禁忌或难以相守的关系设定
- 反派：表面友善→暴露真面目→嫉妒怨恨驱动→自毁式结局；残忍行为由女配/手下执行，男主不可对女主施暴`;

const OVERSEAS_MALE_FORMULA = `【黄金三角人设公式 - 男频】
- 男主：表面平凡/被欺辱 + 隐藏的至强身份（战神/首富/暗夜王者） + 隐忍后爆发式身份揭露
- 女主/女配：可以是助力者、误解者（后期打脸对象）或情感锚点
- 反派：居高临下的欺压者，层级递进（小喽啰→中层→大Boss），智商不可下线到无脑送死`;

const OVERSEAS_VOICE_RULE = `【声口与语体】
- 台词为英文原声（地道美式口语、带潜台词）：短句直接、有情绪动作，避免中式英语直译与书面腔
- 每个角色有声口差异：权势者命令式短句、女主前期隐忍后期锋利、反派阴阳怪气；声口指纹在人设阶段就须设计好
- 母语非英语的角色英文台词保留"第二语言感"（语序痕迹/停顿/重复确认）
- 文化外壳本地化：场景/节日/货币/称呼用欧美语境（不出现彩礼、高考、微信等中式元素）`;

function getOverseasEpisodeRhythm(totalEpisodes: number): string {
  const act1End = Math.max(3, Math.round(totalEpisodes * 0.1));
  const act2End = Math.round(totalEpisodes * 0.85);
  const wall1 = Math.min(Math.max(8, Math.round(totalEpisodes * 0.13)), 12);
  return `【海外分集节奏 - 三幕结构】
- 引爆（1-${act1End}集）：Ep1零铺垫最高浓度冲突开局，${act1End}集内完成主线钩子埋设
- 缠斗（${act1End + 1}-${act2End}集）：多阻力线错峰升级，第${wall1}集为第一情绪峰值（一卡）
- 收束（${act2End + 1}-${totalEpisodes}集）：主动反击、多重叠加收尾、主线钩子回收`;
}

function formatPreviousSeasonContext(ctx: PreviousSeasonContext): string {
  return `
## 前作信息

【前作人物设定】
${ctx.characters}

【前作结局状态】
${ctx.finalState}

【未解决的伏笔】
${ctx.unresolvedPlots.join('\\n- ')}
`;
}

function getBatchPhaseHint(startEpisode: number, endEpisode: number, totalEpisodes: number): string {
  if (startEpisode === 1) {
    return '【本批次是开篇】需要高能开局，建立主角形象和核心冲突。';
  }
  if (endEpisode >= totalEpisodes) {
    return '【本批次是结尾】需要收束剧情，安排终极对决。';
  }
  return '【本批次是中段】需要承上启下，安排小高潮和转折。';
}

export function getEpisodeRhythm(totalEpisodes: number): string {
  const phase1End = Math.max(3, Math.floor(totalEpisodes * 0.1));
  const phase2End = Math.floor(totalEpisodes * 0.7);
  const phase3End = Math.floor(totalEpisodes * 0.9);

  return `- 开篇（1-${phase1End}集）：高能开局，建立主角形象和核心冲突
- 发展（${phase1End + 1}-${phase2End}集）：冲突升级，角色成长，小高潮不断
- 高潮（${phase2End + 1}-${phase3End}集）：终极对决，最大爽点
- 结局（${phase3End + 1}-${totalEpisodes}集）：收束剧情`;
}

export function getStoryModeInstruction(mode: StoryMode = 'complete'): string {
  return STORY_MODE_MAP[mode] ?? '';
}

export function getPacingInstruction(pacing: PacingStyle = 'standard'): string {
  return PACING_MAP[pacing] ?? '';
}

export function getOutlineAgentPrompt(expertIdentity?: string): string {
  return `${expertIdentity || DEFAULT_OUTLINE_IDENTITY}

## 核心任务
根据用户提供的故事概念（可能很简短），生成完整的「人物卡 + 剧情大纲 + 分集梗概」。

## 创意扩展能力

用户可能只提供一句话，你需要：
1. 理解核心创意和爽点方向
2. 自动补充世界观、人物设定、剧情线
3. 设计冲突升级和高潮节奏
4. 确保故事有"钩子"和传播性

## 输出格式（严格遵循）

### 一、人物卡

为每个主要角色生成以下格式（5-8个角色）：

${CHARACTER_CARD_EXAMPLE}

${CHARACTER_ROLES}

**外貌各字段说明：**
- 发型：具体发型样式，包含发色
- 发色：头发颜色
- 脸型：五官和脸部特征
- 身材：身高体型
- 穿着：日常服装风格
- 配饰：标志性饰品或道具

${PERSONALITY_KEYWORDS}

### 二、剧情大纲

大纲：200-400字完整剧情概述，包含开篇背景、核心冲突、高潮、结局。

### 三、分集梗概

**每集格式（必须同时包含梗概和人物）：**

第1集：
梗概：15-30字本集剧情概括
人物：本集出场人物，逗号分隔

第2集：
梗概：15-30字本集剧情概括
人物：本集出场人物，逗号分隔

...以此类推直到目标集数...

**节奏要求：**
- 第1-3集：开篇即高能
- 每5-10集：小高潮（打脸、升级、逆袭）
- 每15-20集：大转折
- 最后5集：终极对决

${SHUANGDIAN_PRINCIPLES}

## 禁止事项

1. 不要慢热，开篇必须有钩子
2. 不要长篇解释世界观，融入剧情
3. 不要让主角长时间弱势
4. 不要有版权争议元素`;
}

export const OUTLINE_AGENT_PROMPT = getOutlineAgentPrompt();

export interface OutlineUserPromptParams {
  name: string;
  genre: string;
  type: string;
  totalEpisodes: number;
  concept: string;
  requirements?: string;
}

export function buildOutlineUserPrompt(params: OutlineUserPromptParams): string {
  const {
    name,
    genre,
    type,
    totalEpisodes,
    concept,
    requirements
  } = params;

  let prompt = `【作品名称】
${name || '（未命名）'}

【基本信息】
题材：${genre || '男频漫剧'}
类型：${type || '玄幻'}
目标集数：${totalEpisodes}集

【故事概念】
${concept || '请自由发挥，创作一个精彩的原创故事'}`;

  if (requirements) {
    prompt += `\n\n【特殊要求】
${requirements}`;
  }

  return prompt;
}

export function getOutlineInputTemplate(): string {
  return `【基本信息】
题材：男频漫剧
类型：（穿越/重生/系统/玄幻/末世/都市）
目标集数：60集

【故事概念】
（描述核心概念，50-200字，也可简单一句话让AI发挥）

【特殊要求】（可选）
- 爽点类型：打脸/升级/逆袭/复仇
- 其他要求：`;
}

export function getOutlineCharactersPrompt(expertIdentity?: string, overseasChannel?: 'female' | 'male'): string {
  const overseas = overseasChannel !== undefined;
  const overseasExtra = overseas
    ? `${overseasChannel === 'female' ? OVERSEAS_FEMALE_FORMULA : OVERSEAS_MALE_FORMULA}\n\n${OVERSEAS_VOICE_RULE}`
    : PERSONALITY_KEYWORDS;
  return `${expertIdentity || DEFAULT_OUTLINE_IDENTITY}

## 核心任务
根据用户提供的故事概念，**只生成人物卡**（5-8个主要角色）。

## 创意扩展能力

用户可能只提供一句话，你需要：
1. 理解核心创意和爽点方向
2. 设计符合故事类型的角色阵容
3. 确保有清晰的主角、配角、反派层次
4. 角色关系要有张力和冲突潜力

## 输出格式（严格遵循）

为每个主要角色生成以下格式（5-8个角色）：

${overseas ? OVERSEAS_CHARACTER_CARD_EXAMPLE : CHARACTER_CARD_EXAMPLE}

${CHARACTER_ROLES}

${overseasExtra}

## 重要提示
- 只输出人物卡内容
- 不要输出剧情大纲
- 不要输出分集梗概
- 确保角色阵容完整，适合后续剧情展开`;
}

export const OUTLINE_CHARACTERS_PROMPT = getOutlineCharactersPrompt();

export function getOutlineSynopsisPrompt(characterCards: string, expertIdentity?: string, overseas?: boolean): string {
  if (overseas) {
    return `${expertIdentity || '你是一位海外短剧首席策划。'}

## 核心任务
根据已设定的人物卡和用户故事概念，**只生成剧情大纲**（600-800字）。

## 已确定的人物设定

${characterCards}

${OVERSEAS_STRUCTURE}

${OVERSEAS_DUAL_HOOK}

## 大纲要求

按以下顺序输出完整剧情包（生产头件 + 大纲正文）：

### 一、生产头件（每字段一行，字段名后中文冒号）
剧名：《中文剧名》
英文名：《English Title》
副剧名1：《备选英文名一》
副剧名2：《备选英文名二》
对标剧：ReelShort/ShortMax已验证的同类型爆款剧名（写最贴近的1部）
一卡：卡N付M（标注卡点集数及卡点钩子类型）
二卡：卡N付M（同上；总集数<20时可填"无二卡"）
简介（中）：50-80字中文剧情简介（投流文案风格，埋钩子不剧透结局）
Synopsis (EN): 2-3 sentences English logline for overseas pitch
人名条：主要角色 英文名（中文译名）对照，顿号分隔
地名条：关键场景地名中英对照（无则填"无"）

### 二、剧情大纲正文（600-800字，连续段落，不加标题序号）
必须覆盖：
1. **Logline**：一句话全剧卖点（主角身份+被迫行动+障碍），隐含"已经发生"的高浓度事件
2. **引爆段**：Ep1零铺垫冲突开局、主线钩子埋设方式
3. **缠斗段**：3-5条阻力线（事业/情感/悬念错峰），至暗时刻；冲突按"摩擦→关系→身份→生死"链每3集升级
4. **收束段**：主角主动反击、多重爽点叠加、主线钩子揭晓
5. **卡点设计**：一卡/二卡位置及卡点集钩子（误会最大/身份最低/危险最近/情感最痛+只给半次释放）

## 海外内容红线
- 男主不得对女主施暴；女主对伤害必须快速清醒+实质反击
- 禁未成年成人情境、美化家暴、种族宗教刻板
- 狼人/ABO：标记与结合必须自愿

## 重要提示
- 头件字段写完后空一行再写大纲正文
- 不要重复人物卡内容
- 不要输出分集梗概
- 确保大纲与人物设定一致`;
  }

  return `${expertIdentity || DEFAULT_OUTLINE_IDENTITY}

## 核心任务
根据已设定的人物卡和用户故事概念，**只生成剧情大纲**（200-400字）。

## 已确定的人物设定

${characterCards}

## 大纲要求

生成200-400字完整剧情概述，必须包含：
1. **开篇背景**：故事起点，主角初始状态
2. **核心冲突**：主要矛盾和对抗
3. **发展脉络**：主要剧情转折点
4. **高潮设计**：终极对决或最大爽点
5. **结局方向**：故事走向（可留悬念）

${SHUANGDIAN_PRINCIPLES}

## 输出格式

直接输出200-400字的剧情大纲，包含开篇背景、核心冲突、高潮、结局。
可以自然分段，但不要加标题或序号。

## 重要提示
- 只输出剧情大纲
- 不要重复人物卡内容
- 不要输出分集梗概
- 确保大纲与人物设定一致`;
}

export function getOutlineEpisodesPrompt(characterCards: string, synopsis: string, totalEpisodes: number, expertIdentity?: string): string {
  return `${expertIdentity || DEFAULT_OUTLINE_IDENTITY}

## 核心任务
根据已设定的人物卡和剧情大纲，**必须生成从第1集到第${totalEpisodes}集的完整分集梗概，共${totalEpisodes}集，一集都不能少**。

## 已确定的人物设定

${characterCards}

## 已确定的剧情大纲

${synopsis}

## 分集梗概格式（必须同时包含梗概和人物）

第1集：
梗概：100-150字本集详细剧情概括，包含主要事件、冲突和结尾悬念
人物：本集出场人物，逗号分隔

第2集：
梗概：100-150字本集详细剧情概括，包含主要事件、冲突和结尾悬念
人物：本集出场人物，逗号分隔

...必须连续输出每一集，直到第${totalEpisodes}集...

第${totalEpisodes}集：
梗概：100-150字本集详细剧情概括，包含主要事件、冲突和结尾悬念
人物：本集出场人物，逗号分隔

## 节奏要求

- 第1-3集：开篇即高能，建立主角形象和核心冲突
- 每5-10集：小高潮（打脸、升级、逆袭）
- 每15-20集：大转折
- 最后5集：终极对决，收束剧情

## 人物分配原则

1. 主角每集必须出场（极少数例外需有充分理由）
2. 重要配角定期出场，保持存在感
3. 反派适时登场，制造冲突
4. 新角色引入要有铺垫

## 重要提示（必须严格遵守）
- **必须输出完整的${totalEpisodes}集，从第1集到第${totalEpisodes}集，不允许省略任何一集**
- 每集必须包含「梗概」和「人物」两行
- 梗概控制在100-150字，内容要详细具体
- 人物用逗号分隔
- 确保与人物设定和大纲一致
- 剧情发展要连贯，有因果关系
- **绝对不要在中途停止，必须输出到第${totalEpisodes}集为止**`;
}

export function getOutlineEpisodesBatchPrompt(
  characterCards: string,
  synopsis: string,
  startEpisode: number,
  endEpisode: number,
  totalEpisodes: number,
  previousBatchSummary: string = '',
  expertIdentity?: string,
  overseas?: boolean
): string {
  const batchCount = endEpisode - startEpisode + 1;
  const phaseHint = getBatchPhaseHint(startEpisode, endEpisode, totalEpisodes);

  let contextSection = '';
  if (previousBatchSummary) {
    contextSection = `
## 前文衔接（上一批次结尾）

${previousBatchSummary}

请确保本批次第${startEpisode}集与上述内容自然衔接。
`;
  }

  const paywallSection = overseas ? `\n${getOverseasPaywallPlan(totalEpisodes)}\n` : '';
  const overseasRules = overseas ? `
## 海外分集硬要求
- 每集梗概结尾写明具体钩子（画面悬念），禁止空话
- 第1集零铺垫直切冲突并埋主线钩子
- 付费卡点集的集标题后追加标注"（一卡）/（二卡）"，该集梗概必须是全剧最强悬念峰值
- 情绪线与信息线每集同时推进
- 人物用英文原名` : '';

  return `${expertIdentity || '你是一位专业的动态漫剧策划编剧。'}

## 核心任务
根据人物卡和剧情大纲，生成第${startEpisode}集到第${endEpisode}集的分集梗概（共${batchCount}集）。
这是全剧${totalEpisodes}集中的一部分。${phaseHint}

## 已确定的人物设定

${characterCards}

## 已确定的剧情大纲

${synopsis}
${contextSection}${paywallSection}
## 分集梗概格式

第${startEpisode}集：
梗概：100-150字本集详细剧情概括
人物：本集出场人物，逗号分隔

第${startEpisode + 1}集：
梗概：100-150字本集详细剧情概括
人物：本集出场人物，逗号分隔

...连续输出到第${endEpisode}集...
${overseasRules}
## 重要提示
- 必须输出从第${startEpisode}集到第${endEpisode}集，共${batchCount}集
- 每集包含「梗概」和「人物」两行
- 梗概100-150字，人物用逗号分隔
- 剧情连贯，有因果关系
- 不要省略任何一集`;
}

export function getStoryCorePrompt(params: EnhancedOutlineParams): string {
  const { concept, requirements, totalEpisodes, storyMode, pacing, previousSeasonContext } = params;
  const overseas = isOverseasProject(params.genre, params.type);

  const modeInstruction = getStoryModeInstruction(storyMode);
  const pacingInstruction = getPacingInstruction(pacing);
  const rhythm = overseas
    ? getOverseasEpisodeRhythm(totalEpisodes)
    : getEpisodeRhythm(totalEpisodes);
  const previousContext = previousSeasonContext
    ? formatPreviousSeasonContext(previousSeasonContext) + '\n请确保本季自然承接前作。\n'
    : '';

  if (overseas) {
    return `${params.expertIdentity || '你是一位海外短剧首席策划，'}请分析故事概念，提炼海外短剧核心要素。

【故事概念】
${concept}

${requirements ? `【特殊要求】\n${requirements}` : ''}

【频道】${params.genre || '海外女频'}　【题材】${params.type || ''}
【总集数】${totalEpisodes} 集

${modeInstruction}

${pacingInstruction}
${previousContext}
${OVERSEAS_STRUCTURE}

${OVERSEAS_DUAL_HOOK}

请输出：

## 一句话卖点（Logline）
用"When…, a … must … before …, but …"公式写一句中文卖点（含主角身份+被迫行动+时限+障碍；隐含一个"已经发生"的高浓度事件制造紧迫感，而非"将要发生"的设定）

## 对标作品
列出1-3部同题材海外爆款短剧作为对标（如 ReelShort/ShortMax 平台剧名）

## 主线钩子
本剧的主线悬念（Ep1埋设、大结局揭晓）：TA的真实身份？谁杀了TA？诅咒如何解除？

## 爆款引擎
从六大引擎中选2-3个本剧主引擎：身份反转/打脸逆袭/情感赌注升级/信息差/复仇/宿命vs自由意志

## 情绪节奏
按故事进程描述压抑-释放的情绪走向：
- 开篇：
- 发展：
- 高潮：
- 结局：

## 整体结构
${rhythm}

${getOverseasPaywallPlan(totalEpisodes)}

## 核心冲突
用一句话描述主角的核心矛盾（外在对抗+内在情感冲突双线）`;
  }

  return `${params.expertIdentity || '你是一位资深编剧，'}请分析故事概念，提炼核心要素。

【故事概念】
${concept}

${requirements ? `【特殊要求】\n${requirements}` : ''}

【总集数】
${totalEpisodes} 集

${modeInstruction}

${pacingInstruction}
${previousContext}
请输出：

## 一句话卖点
（能让观众立刻想看的核心吸引力，20字以内）

## 情绪节奏
按故事进程描述主要情绪走向：
- 开篇：
- 发展：
- 高潮：
- 结局：

## 整体结构
${rhythm}

## 核心冲突
用一句话描述主角的核心矛盾

## 爽点方向
列出 3-5 个主要爽点类型（如打脸、逆袭、升级等）`;
}

export function getCharacterFunctionsPrompt(params: EnhancedOutlineParams, storyCore: string): string {
  const { totalEpisodes, previousSeasonContext } = params;

  let inheritNote = '';
  if (previousSeasonContext) {
    inheritNote = `
## 继承前作角色

【前作人物设定】
${previousSeasonContext.characters}

请在设计时考虑继承这些角色，可以调整其功能定位，但保持角色连贯性。
`;
  }

  const overseasFormula = isOverseasProject(params.genre, params.type)
    ? `\n${isOverseasFemaleChannel(params.genre, params.type) ? OVERSEAS_FEMALE_FORMULA : OVERSEAS_MALE_FORMULA}\n`
    : '';

  return `${params.expertIdentity || '你是一位专业的角色设计师。'}请基于以下故事内核，设计角色功能矩阵。

## 故事内核

${storyCore}

【总集数】${totalEpisodes} 集
${inheritNote}${overseasFormula}
请输出：

## 主角设计
- 核心缺陷：（需要在故事中克服的弱点）
- 成长方向：（故事结束时会变成什么样）
- 驱动力：（为什么行动，核心动机）
- 关键能力：（擅长什么）

## 对手/反派设计
- 类型：（竞争对手/仇敌/黑暗面/Boss）
- 功能：（制造什么类型的压力）
- 层级：（是否需要多层级对手：小怪→中Boss→大Boss）
- 与主角关系：（纯粹敌对/亦敌亦友/暗中观察）

## 助力者设计
- 需要几个助力者：（1-3个）
- 类型分配：
  - 智囊型：（出谋划策）
  - 武力型：（战斗支援）
  - 情感型：（情感支撑）

## 关系网设计
- 核心关系1：（最重要的关系，如 主角-女主）
- 核心关系2：（第二重要，如 主角-反派）
- 潜在冲突：（会产生戏剧冲突的关系）

## 感情线
- 有无感情线：是/否
- 类型：（甜宠/虐恋/暗恋/三角等）
- 发展节奏：（快热/慢热/反转）`;
}

export function getEnhancedCharacterCardsPrompt(
  params: EnhancedOutlineParams,
  storyCore: string,
  characterFunctions: string
): string {
  const overseas = isOverseasProject(params.genre, params.type);
  return `${params.expertIdentity || '你是一位专业的动态漫剧策划编剧。'}请基于故事内核和角色功能需求，生成具体的人物卡。

## 故事内核

${storyCore}

## 角色功能需求

${characterFunctions}

## 输出格式（5-8个角色）

为每个主要角色生成以下格式：

${overseas ? OVERSEAS_CHARACTER_CARD_EXAMPLE : CHARACTER_CARD_EXAMPLE}

**角色定位：** 男主角/女主角/反派/队友/对手/配角${overseas ? '（海外剧可加：家族成员/手下/情敌/盟友/神秘人）' : ''}

## 设计原则
1. 角色必须对应角色功能需求中的定位
2. 性格特征要能支撑其功能（如反派需要有制造压力的性格）
3. 外貌设计要有辨识度${overseas ? '，视觉字段必须具体可拍（AI仿真人需保持一致性）' : ''}
4. 确保角色阵容完整，适合剧情展开${overseas ? '\n5. 所有角色使用英文原名，禁止中文音译；欧美文化语境下的姓名与造型' : ''}`;
}

export function getEnhancedSynopsisPrompt(
  params: EnhancedOutlineParams,
  storyCore: string,
  characterCards: string
): string {
  const { totalEpisodes, storyMode } = params;
  const overseas = isOverseasProject(params.genre, params.type);
  const modeInstruction = getStoryModeInstruction(storyMode);
  const rhythm = overseas
    ? getOverseasEpisodeRhythm(totalEpisodes)
    : getEpisodeRhythm(totalEpisodes);

  if (overseas) {
    return `${params.expertIdentity || '你是一位海外短剧首席策划，'}请基于故事内核和人物设定，生成剧情大纲。

## 故事内核

${storyCore}

## 人物设定

${characterCards}

${modeInstruction}

## 节奏参考
${rhythm}

${OVERSEAS_STRUCTURE}

${OVERSEAS_DUAL_HOOK}

${OVERSEAS_VOICE_RULE}

## 输出要求

生成 600-800 字的剧情大纲，必须包含：

1. **Logline开篇**（一句话概括全剧卖点）
2. **引爆段**（第一幕）：Ep1零铺垫冲突开局、主线钩子如何埋设、E2-3倒叙补信息差的方式
3. **缠斗段**（第二幕）：3-5条阻力线设计（事业/情感/悬念错峰），至暗时刻的位置与内容
4. **收束段**（第三幕）：主角主动反击、多重爽点叠加、主线钩子揭晓方式
5. **付费卡点说明**：一卡/二卡位置及卡点集的钩子设计

## 海外内容红线（必须遵守）
- 男主不得对女主施暴，残忍行为由女配/手下执行
- 女主对伤害必须"快速清醒+实质反击"，不可反复伤心无行动
- 禁未成年成人情境、禁美化家暴/强制流产、禁种族宗教刻板
- 狼人/ABO题材：标记、结合必须建立在自愿基础上

直接输出大纲内容，可分段但不需要标题序号。`;
  }

  return `${params.expertIdentity || '你是一位专业的动态漫剧策划编剧。'}请基于故事内核和人物设定，生成剧情大纲。

## 故事内核

${storyCore}

## 人物设定

${characterCards}

${modeInstruction}

## 节奏参考
${rhythm}

## 输出要求

生成 300-500 字的剧情大纲，必须包含：

1. **开篇背景**（第一幕）：故事起点，主角初始状态，如何被卷入冲突
2. **发展脉络**（第二幕）：主要冲突升级，列出 3-5 个关键转折点
3. **高潮设计**（第三幕）：终极对决，最大爽点如何呈现
4. **结局方向**：如何收束（完整剧）或留钩子（可续集）

## 爽点分布
- 每 5-10 集一个小高潮
- 每 15-20 集一个大转折
- 确保开篇即高能

直接输出大纲内容，可分段但不需要标题序号。`;
}

export function getEnhancedEpisodesBatchPrompt(
  params: EnhancedOutlineParams,
  storyCore: string,
  characterCards: string,
  synopsis: string,
  startEpisode: number,
  endEpisode: number,
  totalEpisodes: number,
  previousBatchSummary: string = ''
): string {
  const pacingInstruction = getPacingInstruction(params.pacing);
  const overseas = isOverseasProject(params.genre, params.type);
  const batchCount = endEpisode - startEpisode + 1;
  const phaseHint = getBatchPhaseHint(startEpisode, endEpisode, totalEpisodes);

  let contextSection = '';
  if (previousBatchSummary) {
    contextSection = `
## 前文衔接

${previousBatchSummary}

请确保第 ${startEpisode} 集与上述内容自然衔接。
`;
  }

  const formatSpec = overseas
    ? `## 输出格式（海外短剧）

第${startEpisode}集：
梗概：100-150字本集详细剧情概括，必须写明：本集核心冲突、情绪释放点、信息揭示、结尾强钩子（具体画面悬念）
人物：本集出场人物（英文原名），逗号分隔

第${startEpisode + 1}集：
梗概：100-150字
人物：出场人物

...连续输出到第${endEpisode}集...

## 海外分集硬要求
- 每集结尾钩子必须具体（如"银刃抵上喉结，他却笑了"），禁止"敬请期待"式空话
- 第1集：零铺垫直切最高浓度冲突，并埋设主线钩子
- 付费卡点集的集标题后追加标注，如"第N集（一卡）：""第N集（二卡）："——卡点集梗概必须是全剧最强悬念峰值
- 情绪线与信息线每集同时推进：观众爽的同时必须获得新信息
- 卡点前2集开始蓄力，冲突密度加码`
    : `## 输出格式

第${startEpisode}集：
梗概：100-150字本集详细剧情概括，包含主要事件、冲突和结尾悬念
人物：本集出场人物，逗号分隔

第${startEpisode + 1}集：
梗概：100-150字
人物：出场人物

...连续输出到第${endEpisode}集...`;

  const paywallSection = overseas ? `\n${getOverseasPaywallPlan(totalEpisodes)}\n` : '';

  return `${params.expertIdentity || '你是一位专业的动态漫剧策划编剧。'}

## 核心任务
生成第 ${startEpisode} 集到第 ${endEpisode} 集的分集梗概（共 ${batchCount} 集）。
这是全剧 ${totalEpisodes} 集中的一部分。${phaseHint}

## 故事内核

${storyCore}

## 人物设定

${characterCards}

## 剧情大纲

${synopsis}

${pacingInstruction}
${contextSection}${paywallSection}
${formatSpec}

## 重要提示
- 必须输出 ${batchCount} 集，从第 ${startEpisode} 集到第 ${endEpisode} 集
- 每集必须包含「梗概」和「人物」两行
- 梗概 100-150 字，内容详细具体
- 剧情连贯，有因果关系
- 不要省略任何一集`;
}

