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

export function getOutlineCharactersPrompt(expertIdentity?: string): string {
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

${CHARACTER_CARD_EXAMPLE}

${CHARACTER_ROLES}

${PERSONALITY_KEYWORDS}

## 重要提示
- 只输出人物卡内容
- 不要输出剧情大纲
- 不要输出分集梗概
- 确保角色阵容完整，适合后续剧情展开`;
}

export const OUTLINE_CHARACTERS_PROMPT = getOutlineCharactersPrompt();

export function getOutlineSynopsisPrompt(characterCards: string, expertIdentity?: string): string {
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
  expertIdentity?: string
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

  return `${expertIdentity || '你是一位专业的动态漫剧策划编剧。'}

## 核心任务
根据人物卡和剧情大纲，生成第${startEpisode}集到第${endEpisode}集的分集梗概（共${batchCount}集）。
这是全剧${totalEpisodes}集中的一部分。${phaseHint}

## 已确定的人物设定

${characterCards}

## 已确定的剧情大纲

${synopsis}
${contextSection}
## 分集梗概格式

第${startEpisode}集：
梗概：100-150字本集详细剧情概括
人物：本集出场人物，逗号分隔

第${startEpisode + 1}集：
梗概：100-150字本集详细剧情概括
人物：本集出场人物，逗号分隔

...连续输出到第${endEpisode}集...

## 重要提示
- 必须输出从第${startEpisode}集到第${endEpisode}集，共${batchCount}集
- 每集包含「梗概」和「人物」两行
- 梗概100-150字，人物用逗号分隔
- 剧情连贯，有因果关系
- 不要省略任何一集`;
}

export function getStoryCorePrompt(params: EnhancedOutlineParams): string {
  const { concept, requirements, totalEpisodes, storyMode, pacing, previousSeasonContext } = params;

  const modeInstruction = getStoryModeInstruction(storyMode);
  const pacingInstruction = getPacingInstruction(pacing);
  const rhythm = getEpisodeRhythm(totalEpisodes);
  const previousContext = previousSeasonContext
    ? formatPreviousSeasonContext(previousSeasonContext) + '\n请确保本季自然承接前作。\n'
    : '';

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

  return `${params.expertIdentity || '你是一位专业的角色设计师。'}请基于以下故事内核，设计角色功能矩阵。

## 故事内核

${storyCore}

【总集数】${totalEpisodes} 集
${inheritNote}
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
  return `${params.expertIdentity || '你是一位专业的动态漫剧策划编剧。'}请基于故事内核和角色功能需求，生成具体的人物卡。

## 故事内核

${storyCore}

## 角色功能需求

${characterFunctions}

## 输出格式（5-8个角色）

为每个主要角色生成以下格式：

${CHARACTER_CARD_EXAMPLE}

**角色定位：** 男主角/女主角/反派/队友/对手/配角

## 设计原则
1. 角色必须对应角色功能需求中的定位
2. 性格特征要能支撑其功能（如反派需要有制造压力的性格）
3. 外貌设计要有辨识度
4. 确保角色阵容完整，适合剧情展开`;
}

export function getEnhancedSynopsisPrompt(
  params: EnhancedOutlineParams,
  storyCore: string,
  characterCards: string
): string {
  const { totalEpisodes, storyMode } = params;
  const modeInstruction = getStoryModeInstruction(storyMode);
  const rhythm = getEpisodeRhythm(totalEpisodes);

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
${contextSection}
## 输出格式

第${startEpisode}集：
梗概：100-150字本集详细剧情概括，包含主要事件、冲突和结尾悬念
人物：本集出场人物，逗号分隔

第${startEpisode + 1}集：
梗概：100-150字
人物：出场人物

...连续输出到第${endEpisode}集...

## 重要提示
- 必须输出 ${batchCount} 集，从第 ${startEpisode} 集到第 ${endEpisode} 集
- 每集必须包含「梗概」和「人物」两行
- 梗概 100-150 字，内容详细具体
- 剧情连贯，有因果关系
- 不要省略任何一集`;
}

