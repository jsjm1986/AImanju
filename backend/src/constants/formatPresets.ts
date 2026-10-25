import {
    IFormatDetails,
    IPresetInfo,
    OutputFormatPreset
} from '../types/OutputFormat';

export const FORMAT_PRESETS: Record<OutputFormatPreset, IFormatDetails> = {
    standard: {
    episodeHeader: {
        format: "第{ep}集：\n梗概：{summary}\n人物：{characters}",
        includeSummary: true,
        includeCharacters: true
    },
    scene: {
        format: "{ep}-{scene}：{location}-{time} {inOut}",
        timeOptions: ["日", "夜", "傍晚", "清晨"],
        inOutOptions: ["内", "外"]
    },
    dialogue: {
        style: 'colon',
        normal: "{name}：{content}",
        withState: "{name}（{state}）：{content}",
        innerThought: "{name}OS：{content}",
        narrator: "画外音：{content}",
        systemPrompt: "【系统：{content}】"
    },
    action: { marker: "△", style: "prefix", actionLabel: "画面" },
    wordLimit: { min: 900, target: 1000, max: 1050, enforceStrict: true },
    sceneLimit: { min: 3, max: 8, recommended: 5 },
    episodeSeparator: "---",
    guidelines: {
        avoidWatering: true,
        showDontTell: true,
        dialogueMaxLength: 20,
        extraNaming: "观众甲/乙、路人",
        customRules: []
    },
    promptTemplate: `## 输出格式（严格遵循）

按照**动态漫画分镜脚本**格式输出，每集包含完整的集头、场景、画面描写和对白。

### 集头格式
第{ep}集：
梗概：（一句话概括本集内容）
人物：（本集出场角色）

### 场景格式
{集数}-{场景序号}：{地点}-{时间} {内/外}
示例：1-1：客厅-日 内

### 画面描写
以"△"开头，简洁描述画面内容，拒绝注水，每个画面描写聚焦一个动作或视觉重点。
示例：△阳光透过窗户洒落，林风推门而入。

### 对白格式
- 普通对白：角色名：对白内容
- 带状态对白：角色名（情绪/动作）：对白内容
- 内心独白：角色名OS：内心内容
- 画外音：画外音：旁白内容
- 系统提示：【系统：提示内容】

### 集分隔
多集之间用 --- 分隔。

### 创作规范
- **字数要求**：每集严格控制在 **{wordMin}-{wordTarget}字**，上限 **{wordMax}字**
- **场景数量**：每集 {sceneMin}-{sceneMax} 个场景，推荐 {sceneRecommended} 个
- **超快节奏（强制）**：
  * 开场20字内必须有冲突/悬念，立即抓住读者
  * 每150-200字必须有一个爆点（反转/打脸/爽点/冲突升级）
  * 中段必须有至少2个反转或高潮
  * 结尾必须留强悬念，让读者迫不及待看下集
- **拒绝注水**：禁止冗长环境描写、心理描写、铺垫过渡，直接进入冲突
- **动作优先**：用动作和对话推进剧情，删除一切不必要的描述
- **对白精简**：单句对白不超过20字，每句话都要推动剧情或制造冲突
- **龙套命名**：观众甲/乙、路人，同集内名称一致`
    },
    novel: {
    episodeHeader: {
        format: "【第{ep}章】\n{summary}",
        includeSummary: true,
        includeCharacters: false
    },
    scene: {
        format: "◇ {location}",
        timeOptions: ["白天", "夜晚", "黄昏", "破晓"],
        inOutOptions: []
    },
    dialogue: {
        style: 'quotes',
        normal: '{name}：\u201c{content}\u201d',
        withState: '{name}{state}：\u201c{content}\u201d',
        innerThought: '{name}心想，{content}',
        narrator: "　　{content}",
        systemPrompt: ""
    },
    action: { marker: "　　", style: "indent", actionLabel: "叙述" },
    wordLimit: { min: 1500, target: 2000, max: 2500, enforceStrict: false },
    sceneLimit: { min: 2, max: 5, recommended: 3 },
    episodeSeparator: "\n\n※※※\n\n",
    guidelines: {
        avoidWatering: false,
        showDontTell: false,
        dialogueMaxLength: 50,
        extraNaming: "某人、路人甲",
        customRules: ["可使用丰富的心理描写", "环境描写可适当展开"]
    },
    promptTemplate: `## 输出格式（严格遵循）

以**完整的散文体小说**形式输出，每章是一个连贯的文学篇章，像正式出版的网络小说一样书写。

### 章节格式
【第{ep}章】
（章节梗概，一句话）

正文从下一行开始，直接进入叙述，不需要任何场景标记或编号。

### 正文写作要求
- 以散文体叙述为主，场景转换通过叙述自然过渡，**不使用任何场景编号或场景标记**
- 段落开头缩进两个全角空格
- 环境描写、动作描写、心理描写自然融入叙述，不加任何前缀标记
- 场景切换时可用空行或"◇"符号分隔，后跟地点提示（如 ◇ 客厅），但不是必须的

### 对话格式
对话内容统一用中文双引号""包裹，说话人和动作通过叙述自然交代：
- 叙述在前：林风皱了皱眉："你确定要这么做？"
- 叙述在后："别过来！"她惊恐地后退了一步。
- 叙述穿插："我知道，"他顿了顿，目光移向窗外，"但我没有选择。"
- 内心独白：融入叙述段落，如：林风心想，这一切未免太巧了。
- 旁白叙述：直接以缩进段落书写，无需标记
- **禁止使用「」括住角色名，禁止用（情绪）标注状态**，情绪通过动作和神态描写传达

### 声音与音效
- 拟声词用引号包裹融入叙述："砰"的一声，大门被撞开了。
- 环境音自然融入描写：远处传来隐约的雷声，雨点敲打着窗户。
- **严禁使用（）括号标注音效**，如（砰！）（脚步声）等格式绝对禁止

### 章节分隔
多章之间用 ※※※ 分隔。

### 创作规范
- **字数要求**：每章 **{wordMin}-{wordTarget}字**，上限 **{wordMax}字**
- **场景数量**：每章包含 {sceneMin}-{sceneMax} 个场景段落
- **文学性**：可使用丰富的心理描写、环境渲染、比喻修辞
- **对话融入叙述**：对话前后应有动作、神态、心理等描写衔接，避免对话列表式排列
- **章末钩子**：每章结尾留有悬念或情感张力，吸引读者继续阅读
- **龙套命名**：某人、路人甲，同章内名称一致`
    },
    screenplay: {
    episodeHeader: {
        format: "第{ep}集\n\n场景列表：{characters}",
        includeSummary: false,
        includeCharacters: true
    },
    scene: {
        format: "{inOut}. {location} - {time}",
        timeOptions: ["DAY", "NIGHT", "CONTINUOUS", "LATER", "DAWN", "DUSK"],
        inOutOptions: ["INT", "EXT", "INT./EXT"]
    },
    dialogue: {
        style: 'screenplay',
        normal: "{name}\n{content}",
        withState: "{name}\n（{state}）\n{content}",
        innerThought: "{name} (V.O.)\n{content}",
        narrator: "NARRATOR (V.O.)\n{content}",
        systemPrompt: "SUPER: {content}"
    },
    action: { marker: "", style: "prefix", actionLabel: "动作" },
    wordLimit: { min: 800, target: 900, max: 1000, enforceStrict: true },
    sceneLimit: { min: 4, max: 10, recommended: 6 },
    episodeSeparator: "\n\nFADE OUT.\n\n================\n\nFADE IN:\n\n",
    guidelines: {
        avoidWatering: true,
        showDontTell: true,
        dialogueMaxLength: 30,
        extraNaming: "EXTRA #1、EXTRA #2",
        customRules: ["使用专业分镜术语", "动作描写无前缀直接叙述"]
    },
    promptTemplate: `## 输出格式（严格遵循）

按照**专业影视剧本**行业标准格式输出，参照好莱坞剧本规范。

### 集头格式
第{ep}集

场景列表：（本集出场角色）

### 场景头（Slug Line）
{内/外}. {地点} - {时间}
时间选项：DAY / NIGHT / CONTINUOUS / LATER / DAWN / DUSK
内外选项：INT / EXT / INT./EXT
示例：INT. 办公室 - DAY

### 动作描写（Action）
直接书写，无任何前缀标记。使用现在时态，简洁有力地描述可见的动作和画面。
不写角色内心想法，只写摄影机能拍到的内容。
示例：
门被猛地推开。李明大步走入，西装上沾满雨水。他将公文包摔在桌上。

### 对白格式
角色名居中大写，对白在角色名下方：
- 普通对白：
  角色名
  对白内容
- 带状态/动作提示（Parenthetical）：
  角色名
  （情绪/动作）
  对白内容
- 画外音：角色名 (V.O.)
- 旁白：NARRATOR (V.O.)
- 字幕叠印：SUPER: 内容

### 集分隔
FADE OUT.

================

FADE IN:

### 创作规范
- **字数要求**：每集 **{wordMin}-{wordTarget}字**，上限 **{wordMax}字**
- **场景数量**：每集 {sceneMin}-{sceneMax} 个场景，推荐 {sceneRecommended} 个
- **动作优先**：Show, Don't Tell，用动作和画面传达情感
- **对白精炼**：单句对白不超过30字，避免说教式台词
- **龙套命名**：EXTRA #1、EXTRA #2，同集内名称一致`
    },
    webtoon: {
    episodeHeader: {
        format: "EP.{ep}",
        includeSummary: false,
        includeCharacters: false
    },
    scene: {
        format: "[{scene}] {location}",
        timeOptions: [],
        inOutOptions: []
    },
    dialogue: {
        style: 'colon',
        normal: "{name}：{content}",
        withState: "{name}（{state}）：{content}",
        innerThought: "{name}（心）：{content}",
        narrator: "【旁白】{content}",
        systemPrompt: "★{content}★"
    },
    action: { marker: "*", style: "wrap", wrapSymbols: ["*", "*"], actionLabel: "画面" },
    wordLimit: { min: 400, target: 500, max: 600, enforceStrict: true },
    sceneLimit: { min: 5, max: 12, recommended: 8 },
    episodeSeparator: "---",
    guidelines: {
        avoidWatering: true,
        showDontTell: true,
        dialogueMaxLength: 15,
        extraNaming: "路人",
        customRules: ["对白简短有力", "每格一个动作"]
    },
    promptTemplate: `## 输出格式（严格遵循）

按照**竖屏条漫分镜脚本**格式输出，适配手机竖屏滑动阅读体验，每格一个画面。

### 集头格式
EP.{ep}

### 场景/分格格式
[{格序号}] {地点}
示例：[1] 教室

### 画面描写
用星号包裹，简洁描述该格的画面内容，每格聚焦一个动作或表情。
示例：*林风猛地站起来，椅子向后滑出*

### 对白格式
- 普通对白：角色名：对白内容
- 带状态对白：角色名（情绪）：对白内容
- 内心独白：角色名（心）：内心内容
- 旁白：【旁白】旁白内容
- 系统提示：★提示内容★

### 集分隔
多集之间用 --- 分隔。

### 创作规范
- **字数要求**：每集 **{wordMin}-{wordTarget}字**，上限 **{wordMax}字**
- **场景数量**：每集 {sceneMin}-{sceneMax} 格，推荐 {sceneRecommended} 格
- **每格一动**：一格只描述一个动作或一个表情特写，不堆叠
- **对白极简**：单句对白不超过15字，适配气泡框
- **滑动钩子**：利用竖屏滑动特性，在关键格制造"翻页悬念"
- **龙套命名**：路人，同集内名称一致`
    },
    audio_drama: {
    episodeHeader: {
        format: "◆ 第{ep}期 ◆\n{summary}",
        includeSummary: true,
        includeCharacters: false
    },
    scene: {
        format: "◆场景{scene}：{location}◆",
        timeOptions: [],
        inOutOptions: []
    },
    dialogue: {
        style: 'brackets',
        normal: "【{name}】{content}",
        withState: "【{name}·{state}】{content}",
        innerThought: "【{name}·内心】{content}",
        narrator: "【旁白】{content}",
        systemPrompt: "【系统音】{content}"
    },
    action: { marker: "（音效：", style: "wrap", wrapSymbols: ["（音效：", "）"], actionLabel: "音效" },
    wordLimit: { min: 600, target: 750, max: 900, enforceStrict: false },
    sceneLimit: { min: 3, max: 6, recommended: 4 },
    episodeSeparator: "\n◇◇◇\n",
    guidelines: {
        avoidWatering: false,
        showDontTell: false,
        dialogueMaxLength: 40,
        extraNaming: "路人声、群众声",
        customRules: ["强调声音描写", "标注BGM时机"]
    },
    promptTemplate: `## 输出格式（严格遵循）

按照**广播剧剧本**格式输出，以声音为核心叙事手段，所有内容必须能通过听觉传达。

### 期头格式
◆ 第{ep}期 ◆
（本期梗概）

### 场景格式
◆场景{序号}：{地点}◆
示例：◆场景1：雨夜的咖啡馆◆

### 音效/环境音描写
用括号包裹，标注音效类型：
示例：（音效：雨声渐强，咖啡杯放下的清脆声）
（BGM：轻柔钢琴曲渐入）
（环境音：嘈杂的街道声渐远）

### 对白格式
- 普通对白：【角色名】对白内容
- 带情绪/语气：【角色名·情绪】对白内容
- 内心独白：【角色名·内心】独白内容
- 旁白：【旁白】旁白内容
- 系统音效：【系统音】内容

### 期分隔
多期之间用 ◇◇◇ 分隔。

### 创作规范
- **字数要求**：每期 **{wordMin}-{wordTarget}字**，上限 **{wordMax}字**
- **场景数量**：每期 {sceneMin}-{sceneMax} 个场景，推荐 {sceneRecommended} 个
- **声音优先**：所有叙事必须能通过声音传达，避免纯视觉描写
- **情绪标注**：对白必须标注语气和情绪，指导配音演员表演
- **BGM节奏**：在情绪转折点标注BGM变化时机
- **对白丰富**：单句对白可达40字，广播剧以对白驱动剧情
- **龙套命名**：路人声、群众声，同期内名称一致`
    },
    game_script: {
    episodeHeader: {
        format: "# Chapter {ep}",
        includeSummary: false,
        includeCharacters: false
    },
    scene: {
        format: "## Scene_{scene}: {location}",
        timeOptions: [],
        inOutOptions: []
    },
    dialogue: {
        style: 'colon',
        normal: "@{name}：{content}",
        withState: "@{name}[{state}]：{content}",
        innerThought: "@{name}[心声]：{content}",
        narrator: "[系统]：{content}",
        systemPrompt: "[SYSTEM] {content}"
    },
    action: { marker: "[CG] ", style: "prefix", actionLabel: "CG指示" },
    wordLimit: { min: 500, target: 700, max: 800, enforceStrict: false },
    sceneLimit: { min: 1, max: 20, recommended: 5 },
    episodeSeparator: "\n---\n",
    guidelines: {
        avoidWatering: true,
        showDontTell: true,
        dialogueMaxLength: 25,
        extraNaming: "NPC_01、路人NPC",
        customRules: ["标注选项分支", "标注CG/立绘时机"]
    },
    promptTemplate: `## 输出格式（严格遵循）

按照**游戏剧情脚本**格式输出，适用于RPG/AVG等游戏引擎的剧情文本，需标注系统指令和演出时机。

### 章节头格式
# Chapter {ep}

### 场景格式
## Scene_{序号}: {地点}
示例：## Scene_1: 王城大殿

### CG/演出指示
以"[CG]"前缀标注画面演出和立绘变化：
示例：[CG] 镜头缓缓拉远，王城全景，夕阳西下
[CG] 立绘切换：艾琳 → 战斗姿态

### 对白格式
- 普通对白：@角色名：对白内容
- 带表情/动作：@角色名[表情]：对白内容
- 内心独白：@角色名[心声]：独白内容
- 系统旁白：[系统]：旁白内容
- 系统指令：[SYSTEM] 指令内容

### 分支选项（如有）
[CHOICE]
A. 选项文本 → 跳转标记
B. 选项文本 → 跳转标记

### 章节分隔
多章之间用 --- 分隔。

### 创作规范
- **字数要求**：每章 **{wordMin}-{wordTarget}字**，上限 **{wordMax}字**
- **场景数量**：每章 {sceneMin}-{sceneMax} 个场景，推荐 {sceneRecommended} 个
- **演出标注**：在情绪高潮处标注CG触发和立绘变化时机
- **对白精炼**：单句对白不超过25字，适配文本框显示
- **系统集成**：需要时标注好感度变化、道具获取等系统事件
- **龙套命名**：NPC_01、路人NPC，同章内名称一致`
    },
    stage_play: {
    episodeHeader: {
        format: "第{ep}幕\n\n【时间】\n【地点】\n【人物】{characters}",
        includeSummary: false,
        includeCharacters: true
    },
    scene: {
        format: "第{scene}场 {location}",
        timeOptions: ["日", "夜", "黄昏", "黎明"],
        inOutOptions: []
    },
    dialogue: {
        style: 'colon',
        normal: "{name}——{content}",
        withState: "{name}（{state}）——{content}",
        innerThought: "{name}（独白）——{content}",
        narrator: "【画外音】{content}",
        systemPrompt: "〔字幕〕{content}"
    },
    action: { marker: "（舞台指示：", style: "wrap", wrapSymbols: ["（舞台指示：", "）"], actionLabel: "舞台指示" },
    wordLimit: { min: 1000, target: 1500, max: 2000, enforceStrict: false },
    sceneLimit: { min: 1, max: 5, recommended: 3 },
    episodeSeparator: "\n\n【幕间】\n\n",
    guidelines: {
        avoidWatering: false,
        showDontTell: false,
        dialogueMaxLength: 60,
        extraNaming: "群众甲、群众乙",
        customRules: ["注重舞台调度", "标注灯光音效"]
    },
    promptTemplate: `## 输出格式（严格遵循）

按照**话剧/舞台剧剧本**格式输出，遵循戏剧文学规范，注重舞台调度和表演指导。

### 幕头格式
第{ep}幕

【时间】
【地点】
【人物】（本幕出场角色）

### 场景格式
第{场序号}场 {地点}
示例：第1场 破旧的书房

### 舞台指示
用括号包裹，描述演员走位、舞台布景变化、灯光音效：
示例：（舞台指示：灯光渐暗，只留一束追光打在王明身上。他缓缓走向舞台中央，背对观众。）
（舞台指示：舞台左侧，一张旧书桌，上面堆满信件。右侧，一扇半开的窗，月光洒入。）

### 对白格式
- 普通对白：角色名——对白内容
- 带状态/动作：角色名（情绪/动作）——对白内容
- 独白：角色名（独白）——独白内容
- 画外音：【画外音】内容
- 字幕投影：〔字幕〕内容

### 幕间分隔
多幕之间用 【幕间】 分隔。

### 创作规范
- **字数要求**：每幕 **{wordMin}-{wordTarget}字**，上限 **{wordMax}字**
- **场景数量**：每幕 {sceneMin}-{sceneMax} 场，推荐 {sceneRecommended} 场
- **舞台调度**：明确标注演员走位、上下场方向
- **灯光音效**：在情绪转折处标注灯光变化和音效提示
- **对白为王**：话剧以对白驱动，单句可达60字，注重台词的文学性和舞台感染力
- **龙套命名**：群众甲、群众乙，同幕内名称一致`
    },
    manga_jp: {
    episodeHeader: {
        format: "第{ep}話",
        includeSummary: false,
        includeCharacters: false
    },
    scene: {
        format: "P{scene} {location}",
        timeOptions: ["昼", "夜", "夕方", "朝"],
        inOutOptions: []
    },
    dialogue: {
        style: 'quotes',
        normal: "{name}「{content}」",
        withState: "{name}（{state}）「{content}」",
        innerThought: "{name}（{content}）",
        narrator: "ナレーション：{content}",
        systemPrompt: "＊{content}＊"
    },
    action: { marker: "効果：", style: "prefix", actionLabel: "効果" },
    wordLimit: { min: 300, target: 450, max: 500, enforceStrict: true },
    sceneLimit: { min: 8, max: 20, recommended: 12 },
    episodeSeparator: "---",
    guidelines: {
        avoidWatering: true,
        showDontTell: true,
        dialogueMaxLength: 12,
        extraNaming: "モブA、モブB",
        customRules: ["每格动作单一", "强调表情特写"]
    },
    promptTemplate: `## 输出格式（严格遵循）

按照**日式漫画分镜脚本**格式输出，遵循日本漫画的分镜叙事节奏，每页多格，强调视觉冲击和情绪表达。

### 話头格式
第{ep}話

### 页/格格式
P{页序号} {地点}
示例：P1 学校屋顶

### 効果/画面描写
以"効果："前缀描述画面效果、速度线、集中线、背景效果等：
示例：効果：背景炸裂，集中线汇聚在拳头上
効果：少女回眸，樱花花瓣飘落，柔光效果

### 对白格式
- 普通对白：角色名「对白内容」
- 带表情/动作：角色名（表情）「对白内容」
- 内心独白：角色名（内心独白内容）
- 旁白：ナレーション：旁白内容
- 拟声词/效果字：＊效果文字＊

### 話分隔
多話之间用 --- 分隔。

### 创作规范
- **字数要求**：每話 **{wordMin}-{wordTarget}字**，上限 **{wordMax}字**
- **格数要求**：每話 {sceneMin}-{sceneMax} 格，推荐 {sceneRecommended} 格
- **每格一动**：一格只描述一个动作或一个表情，动态构图
- **对白极简**：单句对白不超过12字，适配日漫气泡
- **翻页悬念**：利用翻页制造悬念，关键画面放在翻页后第一格
- **表情特写**：情绪高潮处安排大格表情特写
- **龙套命名**：モブA、モブB，同話内名称一致`
    },
    short_video: {
    episodeHeader: {
        format: "EP{ep}",
        includeSummary: false,
        includeCharacters: false
    },
    scene: {
        format: "#{scene} {location}",
        timeOptions: [],
        inOutOptions: []
    },
    dialogue: {
        style: 'colon',
        normal: "{name}：{content}",
        withState: "{name}({state})：{content}",
        innerThought: "{name}(OS)：{content}",
        narrator: "[旁白]{content}",
        systemPrompt: "【字幕】{content}"
    },
    action: { marker: "【画面】", style: "prefix", actionLabel: "画面" },
    wordLimit: { min: 200, target: 350, max: 400, enforceStrict: true },
    sceneLimit: { min: 1, max: 5, recommended: 3 },
    episodeSeparator: "---",
    guidelines: {
        avoidWatering: true,
        showDontTell: true,
        dialogueMaxLength: 10,
        extraNaming: "路人",
        customRules: ["节奏紧凑", "每集一个爆点", "对白极简"]
    },
    promptTemplate: `## 输出格式（严格遵循）

按照**短视频/竖屏短剧脚本**格式输出，适配抖音/快手等平台，每集1-3分钟，节奏极快，开场即冲突。

### 集头格式
EP{ep}

### 场景格式
#{场景序号} {地点}
示例：#1 豪华办公室

### 画面描写
以"【画面】"前缀，极简描述关键画面，只写最有冲击力的视觉信息：
示例：【画面】林风一脚踹开门，所有人回头。

### 对白格式
- 普通对白：角色名：对白内容
- 带状态对白：角色名(情绪)：对白内容
- 内心独白：角色名(OS)：独白内容
- 旁白：[旁白]旁白内容
- 字幕：【字幕】字幕内容

### 集分隔
多集之间用 --- 分隔。

### 创作规范
- **字数要求**：每集 **{wordMin}-{wordTarget}字**，上限 **{wordMax}字**
- **场景数量**：每集 {sceneMin}-{sceneMax} 个场景，推荐 {sceneRecommended} 个
- **开场5秒钩子**：第一句话/第一个画面必须抓住观众
- **每集一个爆点**：反转、打脸、逆袭，一集一个高潮
- **对白极简**：单句对白不超过10字，短平快
- **结尾悬念**：每集结尾必须留悬念，驱动下一集
- **龙套命名**：路人，同集内名称一致`
    },
    interactive: {
    episodeHeader: {
        format: ">>> Chapter {ep}",
        includeSummary: false,
        includeCharacters: false
    },
    scene: {
        format: ">>> SCENE: {location}",
        timeOptions: [],
        inOutOptions: []
    },
    dialogue: {
        style: 'brackets',
        normal: "[{name}] {content}",
        withState: "[{name}·{state}] {content}",
        innerThought: "[{name}·内心] {content}",
        narrator: "[旁白] {content}",
        systemPrompt: "{{SYSTEM: {content}}}"
    },
    action: { marker: "{描述：", style: "wrap", wrapSymbols: ["{描述：", "}"], actionLabel: "场景描述" },
    wordLimit: { min: 400, target: 600, max: 700, enforceStrict: false },
    sceneLimit: { min: 2, max: 8, recommended: 4 },
    episodeSeparator: "\n>>> BRANCH_END\n",
    guidelines: {
        avoidWatering: true,
        showDontTell: true,
        dialogueMaxLength: 30,
        extraNaming: "NPC_A、NPC_B",
        customRules: ["标注选项[CHOICE]", "标注好感度变化", "标注分支结局"]
    },
    promptTemplate: `## 输出格式（严格遵循）

按照**互动剧/AVG剧本**格式输出，支持分支选项和多结局设计，每个选择都影响后续剧情走向。

### 章节头格式
>>> Chapter {ep}

### 场景格式
>>> SCENE: {地点}
示例：>>> SCENE: 废弃医院走廊

### 场景描述
用花括号包裹，描述当前场景的环境和氛围：
示例：{描述：走廊尽头传来若有若无的脚步声，墙壁上的壁灯忽明忽暗}

### 对白格式
- 普通对白：[角色名] 对白内容
- 带状态对白：[角色名·情绪] 对白内容
- 内心独白：[角色名·内心] 独白内容
- 旁白：[旁白] 旁白内容
- 系统指令：{{SYSTEM: 指令内容}}

### 分支选项
在需要玩家做出选择时插入：
[CHOICE]
A. 选项文本 → 结果描述
B. 选项文本 → 结果描述
C. 选项文本 → 结果描述（可选）

### 系统事件标注
{{SYSTEM: 好感度 角色名 +10}}
{{SYSTEM: 获得道具「钥匙」}}
{{SYSTEM: 解锁结局线索}}

### 章节分隔
多章之间用 >>> BRANCH_END 分隔。

### 创作规范
- **字数要求**：每章 **{wordMin}-{wordTarget}字**，上限 **{wordMax}字**
- **场景数量**：每章 {sceneMin}-{sceneMax} 个场景，推荐 {sceneRecommended} 个
- **选项有意义**：每个选项必须导向不同的剧情发展，不做无效选择
- **蝴蝶效应**：早期选择在后续章节产生影响
- **对白精炼**：单句对白不超过30字
- **龙套命名**：NPC_A、NPC_B，同章内名称一致`
    },
    live_action: {
    episodeHeader: {
        format: "第{ep}集 《{summary}》",
        includeSummary: true,
        includeCharacters: false
    },
    scene: {
        format: "场景{scene}：{location} {time} {inOut}",
        timeOptions: ["日", "夜", "傍晚", "清晨", "正午"],
        inOutOptions: ["内景", "外景", "内外"]
    },
    dialogue: {
        style: 'colon',
        normal: "{name}：{content}",
        withState: "{name}（{state}）：{content}",
        innerThought: "{name}（OS）：{content}",
        narrator: "【旁白】：{content}",
        systemPrompt: "【字幕】{content}"
    },
    action: { marker: "【动作】", style: "prefix", actionLabel: "动作" },
    wordLimit: { min: 400, target: 600, max: 800, enforceStrict: true },
    sceneLimit: { min: 3, max: 8, recommended: 5 },
    episodeSeparator: "\n\n━━━━━━━━━━\n\n",
    guidelines: {
        avoidWatering: true,
        showDontTell: true,
        dialogueMaxLength: 15,
        extraNaming: "路人甲、路人乙",
        customRules: ["节奏紧凑", "反转设计", "每集1-2分钟", "竖屏拍摄"]
    },
    promptTemplate: `## 输出格式（严格遵循）

按照**真人竖屏短剧拍摄脚本**格式输出，适配抖音/快手真人短剧拍摄，需包含场景调度和拍摄指导信息。

### 集头格式
第{ep}集 《集标题》

### 场景格式
场景{序号}：{地点} {时间} {内景/外景}
时间选项：日 / 夜 / 傍晚 / 清晨 / 正午
内外选项：内景 / 外景 / 内外
示例：场景1：豪华别墅客厅 夜 内景

### 动作/画面描写
以"【动作】"前缀，描述演员动作和镜头画面：
示例：【动作】林风猛地转身，一把抓住她的手腕。镜头特写两人对视。

### 对白格式
- 普通对白：角色名：对白内容
- 带状态对白：角色名（情绪）：对白内容
- 内心独白：角色名（OS）：独白内容
- 旁白：【旁白】：旁白内容
- 字幕：【字幕】字幕内容

### 集分隔
多集之间用 ━━━━━━━━━━ 分隔。

### 创作规范
- **字数要求**：每集 **{wordMin}-{wordTarget}字**，上限 **{wordMax}字**
- **场景数量**：每集 {sceneMin}-{sceneMax} 个场景，推荐 {sceneRecommended} 个
- **超快节奏（强制）**：
  * 开场20字内必须有冲突/反转，立即抓住观众
  * 每150字必须有一个爆点（打脸/逆袭/反转/冲突升级）
  * 中段必须有至少2-3个反转或高潮
  * 结尾必须留强悬念，让观众迫不及待看下集
- **竖屏思维**：画面构图适配9:16竖屏，多用近景和特写
- **拒绝注水**：禁止铺垫、过渡、环境描写，直接进入冲突
- **对白精简**：单句对白不超过15字，口语化、有冲击力，每句话都要推动剧情
- **龙套命名**：路人甲、路人乙，同集内名称一致`
    },
    ai_avatar: {
    episodeHeader: {
        format: "# 第{ep}集",
        includeSummary: false,
        includeCharacters: false
    },
    scene: {
        format: "[镜头{scene}] {location} | {time}",
        timeOptions: ["日景", "夜景", "黄昏", "黎明", "室内灯光"],
        inOutOptions: ["室内", "室外", "室内外"]
    },
    dialogue: {
        style: 'colon',
        normal: "{name}：{content}",
        withState: "{name}（{state}）：{content}",
        innerThought: "{name}（内心独白）：{content}",
        narrator: "【旁白/配音】{content}",
        systemPrompt: "【AI提示词】{content}"
    },
    action: { marker: "【画面描述】", style: "prefix", actionLabel: "画面描述" },
    wordLimit: { min: 300, target: 450, max: 600, enforceStrict: true },
    sceneLimit: { min: 3, max: 10, recommended: 6 },
    episodeSeparator: "\n\n===== 转场 =====\n\n",
    guidelines: {
        avoidWatering: true,
        showDontTell: true,
        dialogueMaxLength: 15,
        extraNaming: "路人甲、配角A",
        customRules: [
            "画面描述要具体可视化",
            "动作简单，避免复杂特效",
            "每镜头3-6秒时长",
            "标注镜头运动(推/拉/摇/移)"
        ]
    },
    promptTemplate: `## 输出格式（严格遵循）

按照**AI视频生成脚本**格式输出，适配Sora/可灵/Runway等AI视频生成工具，画面描述必须是AI能精准执行的视觉指令。

### 集头格式
# 第{ep}集

### 镜头格式
[镜头{序号}] {地点} | {光线条件}
光线选项：日景 / 夜景 / 黄昏 / 黎明 / 室内灯光
示例：[镜头1] 现代办公室 | 日景

### 画面描述
以"【画面描述】"前缀，用AI视频工具能理解的精确视觉语言描述：
- 描述具体的人物动作、表情、服装
- 标注镜头运动方式（推/拉/摇/移/跟/固定）
- 标注景别（远景/全景/中景/近景/特写）
- 每个镜头3-6秒时长，动作简单可执行

示例：【画面描述】近景，年轻男子穿黑色西装，缓缓抬头，表情从平静变为震惊。镜头固定，背景虚化。

### 对白格式
- 普通对白：角色名：对白内容
- 带状态对白：角色名（情绪）：对白内容
- 内心独白：角色名（内心独白）：独白内容
- 旁白/配音：【旁白/配音】旁白内容
- AI提示词补充：【AI提示词】补充描述

### 集分隔
多集之间用 ===== 转场 ===== 分隔。

### 创作规范
- **字数要求**：每集 **{wordMin}-{wordTarget}字**，上限 **{wordMax}字**
- **镜头数量**：每集 {sceneMin}-{sceneMax} 个镜头，推荐 {sceneRecommended} 个
- **AI可执行**：画面描述必须是AI视频工具能生成的，避免复杂特效和多人交互
- **动作简洁**：每镜头只包含一个简单动作，避免连续复杂动作
- **对白精简**：单句对白不超过15字
- **龙套命名**：路人甲、配角A，同集内名称一致`
    },
    american_comic: {
    episodeHeader: {
        format: "ISSUE #{ep}",
        includeSummary: false,
        includeCharacters: false
    },
    scene: {
        format: "PAGE {scene}",
        timeOptions: ["DAY", "NIGHT", "DUSK", "DAWN"],
        inOutOptions: ["INT", "EXT"]
    },
    dialogue: {
        style: 'brackets',
        normal: "{name}: \"{content}\"",
        withState: "{name} ({state}): \"{content}\"",
        innerThought: "{name} (thought): \"{content}\"",
        narrator: "CAPTION: {content}",
        systemPrompt: "SFX: {content}"
    },
    action: { marker: "", style: "prefix", actionLabel: "Panel描写" },
    wordLimit: { min: 400, target: 600, max: 700, enforceStrict: true },
    sceneLimit: { min: 6, max: 15, recommended: 10 },
    episodeSeparator: "\n\n[PAGE BREAK]\n\n",
    guidelines: {
        avoidWatering: true,
        showDontTell: true,
        dialogueMaxLength: 20,
        extraNaming: "BYSTANDER #1, THUG #2",
        customRules: ["Panel descriptions", "动态构图", "强调动作线"]
    },
    promptTemplate: `## 输出格式（严格遵循）

按照**美式漫画脚本（Full Script）**格式输出，遵循Marvel/DC标准漫画编剧格式，以Page和Panel为基本单位。

### Issue头格式
ISSUE #{ep}

### 页面格式
PAGE {页码}
示例：PAGE 1

### Panel描写
直接描述每个Panel的画面内容，无前缀标记。包含构图、角色位置、动作、表情等视觉信息。
示例：
PANEL 1
Wide shot. 城市天际线，夕阳西下。一个黑色身影站在摩天大楼顶端，披风在风中飘动。

PANEL 2
Close-up. 主角的眼睛，瞳孔中倒映出远处的爆炸火光。

### 对白格式
- 普通对白：角色名: "对白内容"
- 带状态对白：角色名 (情绪): "对白内容"
- 内心独白：角色名 (thought): "独白内容"
- 旁白框：CAPTION: 旁白内容
- 音效字：SFX: 音效描述

### Issue分隔
多期之间用 [PAGE BREAK] 分隔。

### 创作规范
- **字数要求**：每期 **{wordMin}-{wordTarget}字**，上限 **{wordMax}字**
- **Panel数量**：每期 {sceneMin}-{sceneMax} 个Panel，推荐 {sceneRecommended} 个
- **动态构图**：强调动作线、速度感、冲击力，画面要有电影感
- **对白精炼**：单句对白不超过20字，适配气泡框
- **Splash Page**：关键时刻可安排整页大图（Splash Page）增强冲击力
- **龙套命名**：BYSTANDER #1, THUG #2，同期内名称一致`
    },
    chinese_comic: {
    episodeHeader: {
        format: "第{ep}话",
        includeSummary: false,
        includeCharacters: false
    },
    scene: {
        format: "【第{scene}页】{location}",
        timeOptions: ["白天", "夜晚", "黄昏", "清晨"],
        inOutOptions: []
    },
    dialogue: {
        style: 'colon',
        normal: "{name}：\"{content}\"",
        withState: "{name}（{state}）：\"{content}\"",
        innerThought: "{name}（内心）：\"{content}\"",
        narrator: "【旁白】：{content}",
        systemPrompt: "〖{content}〗"
    },
    action: { marker: "△", style: "prefix", actionLabel: "画面" },
    wordLimit: { min: 500, target: 700, max: 900, enforceStrict: true },
    sceneLimit: { min: 5, max: 15, recommended: 10 },
    episodeSeparator: "\n—— 本话完 ——\n",
    guidelines: {
        avoidWatering: true,
        showDontTell: true,
        dialogueMaxLength: 18,
        extraNaming: "路人甲、配角",
        customRules: ["分镜节奏明快", "契合国漫审美", "适当夸张表情"]
    },
    promptTemplate: `## 输出格式（严格遵循）

按照**国漫分镜脚本**格式输出，契合国漫审美风格，以页为单位组织分镜，节奏明快，画面感强。

### 话头格式
第{ep}话

### 页/格格式
【第{页序号}页】{地点}
示例：【第1页】宗门大殿

### 画面描写
以"△"前缀描述每格的画面内容，注重动态感和国漫特有的夸张表现：
示例：△林风双眼猛然睁开，金色灵力从体内爆发，衣袍猎猎作响。
△众人震惊后退，地面出现蛛网状裂纹。

### 对白格式
- 普通对白：角色名："对白内容"
- 带状态对白：角色名（情绪）："对白内容"
- 内心独白：角色名（内心）："独白内容"
- 旁白：【旁白】：旁白内容
- 系统/提示：〖提示内容〗

### 话分隔
多话之间用 —— 本话完 —— 分隔。

### 创作规范
- **字数要求**：每话 **{wordMin}-{wordTarget}字**，上限 **{wordMax}字**
- **格数要求**：每话 {sceneMin}-{sceneMax} 格，推荐 {sceneRecommended} 格
- **分镜节奏**：张弛有度，打斗场面加速，情感场面放慢
- **国漫审美**：适当夸张的表情和动作，契合国漫读者偏好
- **对白精炼**：单句对白不超过18字，适配气泡框
- **龙套命名**：路人甲、配角，同话内名称一致`
    },
    documentary: {
    episodeHeader: {
        format: "【第{ep}期】{summary}",
        includeSummary: true,
        includeCharacters: false
    },
    scene: {
        format: "■ 段落{scene}：{location}",
        timeOptions: [],
        inOutOptions: []
    },
    dialogue: {
        style: 'colon',
        normal: "{name}：{content}",
        withState: "{name}（{state}）：{content}",
        innerThought: "",
        narrator: "【解说】：{content}",
        systemPrompt: "【字幕】{content}"
    },
    action: { marker: "【画面】", style: "prefix", actionLabel: "画面" },
    wordLimit: { min: 800, target: 1200, max: 1500, enforceStrict: false },
    sceneLimit: { min: 3, max: 8, recommended: 5 },
    episodeSeparator: "\n\n◆◆◆\n\n",
    guidelines: {
        avoidWatering: false,
        showDontTell: false,
        dialogueMaxLength: 50,
        extraNaming: "采访对象A、受访者",
        customRules: ["解说词流畅", "信息密度适中", "配合画面节奏"]
    },
    promptTemplate: `## 输出格式（严格遵循）

按照**纪录片/解说视频脚本**格式输出，以解说词为主线，配合画面描述，适用于B站知识区、科普纪录片等内容。

### 期头格式
【第{ep}期】（本期主题概述）

### 段落格式
■ 段落{序号}：{主题/地点}
示例：■ 段落1：深海热泉口

### 画面描述
以"【画面】"前缀，描述与解说词配合的视觉画面：
示例：【画面】航拍镜头缓缓掠过雪山，云雾在山腰缭绕
【画面】微距特写，蚂蚁搬运食物的细节

### 对白/解说格式
- 解说词：【解说】：解说内容（主要叙事手段）
- 采访/对话：角色名：对话内容
- 带身份标注：角色名（身份）：对话内容
- 字幕标注：【字幕】字幕内容

### 期分隔
多期之间用 ◆◆◆ 分隔。

### 创作规范
- **字数要求**：每期 **{wordMin}-{wordTarget}字**，上限 **{wordMax}字**
- **段落数量**：每期 {sceneMin}-{sceneMax} 个段落，推荐 {sceneRecommended} 个
- **解说为主**：以解说词驱动叙事，画面描述配合解说节奏
- **信息密度**：适中，深入浅出，避免堆砌专业术语
- **节奏感**：解说词要有韵律感和节奏感，适合朗读
- **龙套命名**：采访对象A、受访者，同期内名称一致`
    },
    overseas_drama: {
    episodeHeader: {
        format: "第 {ep} 集",
        includeSummary: false,
        includeCharacters: false
    },
    scene: {
        format: "{ep}-{scene} {location} {time} {inOut}",
        timeOptions: ["日", "夜", "清晨", "傍晚", "深夜", "黄昏", "凌晨"],
        inOutOptions: ["内", "外", "内/外", "外/内"]
    },
    dialogue: {
        style: 'colon',
        normal: "{cnName} {ENNAME}：{content}",
        withState: "{cnName} {ENNAME}({emotion})：{content}",
        innerThought: "{cnName} {ENNAME}(V.O.)：{content}",
        narrator: "{cnName} {ENNAME}(V.O.)：{content}",
        systemPrompt: "字幕：{content}"
    },
    action: { marker: "", style: "prefix", actionLabel: "动作" },
    wordLimit: { min: 800, target: 1400, max: 2600, enforceStrict: false },
    sceneLimit: { min: 2, max: 8, recommended: 4 },
    episodeSeparator: "\n\n",
    guidelines: {
        avoidWatering: true,
        showDontTell: true,
        dialogueMaxLength: 80,
        extraNaming: "英文名+身份（如：保镖Ryan、女仆Anna），群像可用描述性称呼（仆人们/守卫们）",
        customRules: [
            "台词为交付级中英双语合并单行：中文名 英文名（英文情绪/动作）：英文台词",
            "英文台词为原声文案（美式口语），单词间正常空格；冒号是下游识别台词的唯一标记",
            "场景头为行业标准格式：集-场 地点-子场景 时间 内/外（空格分隔，无括号无情绪标签）",
            "每个场景头下一行必须有 人物：行，列出本场出场角色",
            "动作行为纯中文可视化描写、独立成行、无△前缀；镜头指令用花括号{升格+特写}",
            "角色名以人物卡为准（英文名必填，中文译名有则用），正文不出现内部标记（[HOOK]/【核心情绪】/△/出场人物）",
            "海外内容红线：男主不得对女主施暴；不美化家暴/控制；无未成年成人情境；狼人标记须双方自愿"
        ]
    },
    promptTemplate: `## 输出格式（严格遵循——生产交付格式）

按照**海外短剧生产剧本**格式输出（对齐批量剧制作交付规范，供下游分镜/资产/配音管线直接消费）。剧本正文只包含：集标题、场景头、人物行、动作描写、台词。**不得出现**任何内部标记（[HOOK]、【核心情绪】、△、出场人物）或剧情梗概/人名条等头件内容。

### 集标题
第 {ep} 集
- 独立一行，集号与"集"之间空格（第 2 集 ✓），不写集名、不加任何 markdown 符号
- 集与集之间空一行分隔，不使用 --- 分隔线

### 场景头（行业标准格式）
{集数}-{场序} {地点}-{子场景} {时间} {内/外}
- 四段以空格分隔：1-5 农场-卧室 日 内（✓） 1-5农场-卧室（日内）【核心情绪：X】（✗）
- 场景头内**不得出现**括号、情绪标签、markdown 符号
- 时间从"日/夜/清晨/凌晨/傍晚/黄昏/深夜"中选；内外从"内、外、内/外、外/内"中选
- 闪回场景：{集数}-{场序} 【闪回】{地点} {时间} {内/外}，闪回结束独立一行写【闪出】
示例：
1-5 农场-卧室 日 内
2-1 农场-马棚 日 内/外
1-2 【闪回】旧宅-走廊 夜 内

### 人物行（场景级，必填）
- 每个场景头**紧接下一行**写：人物：角色A、角色B（顿号分隔，使用与台词中文名一致的角色名）
- 仅列本场上场角色，不写不在场的角色
示例：
人物：Claudia、Giovanni、Ryan

### 动作描写（中文，无标记前缀）
- 纯中文动作/画面描写，独立成行，**不带△、不带任何前缀标记**
- 每条只写一个动作或画面，具体可视、可直接用于文生图/文生视频，一般不超过30字
- 镜头/导演指令用花括号独立成行：{升格+特写}、{Giovanni主观视角}、{慢镜头}
- 禁止"没有+动词"式负性描写（没抬头/没回答）；改为可拍的正向动作
示例：
雨点砸在铁皮屋顶上，Giovanni倒在溪边的泥水里，一动不动。
{升格+特写}
Claudia跪在他身边，双手按住他胸口的伤口，指缝渗出血。

### 台词格式（中英双语合并单行——下游以冒号为唯一识别标记）
中文名 英文名（英文情绪或动作描述）：英文台词
- 中文名+空格+英文名（大写）+（英文情绪/动作，圆括号）+全角冒号：+英文台词
- 英文台词为**英文原声文案**（美式口语、有潜台词），单词间正常空格，不使用中文
- 情绪描述用**英文**写可表演的状态/动作：Smiling brightly、Urgently、Coldly、Gritting his teeth；禁止中文抽象语气词（低声/轻声/语气平静）
- 英文台词每句约≤80字符（≈15词内），长对白拆行
- 台词为**地道美式口语原声**（对标迪士尼影片台词质感），短句直接、有潜台词——说A意味着B；禁止中式英语直译和翻译腔书面语
- 每个角色有声口指纹（词汇/句式/节奏五维），删掉名字仍能辨认谁在说话
示例：
Claudia CLAUDIA(Smiling brightly)：My name is Claudia. I'm the one who saved you!
Giovanni GIOVANNI(Gasping)：You... you saved my life.
Ryan RYAN(Coldly)：Get out. Now.
- 内心独白/画外音：角色名 英文名(V.O.)：英文内容（V.O.仅用于情绪与潜台词，禁止交代剧情信息）
- 字幕/屏幕文字：字幕：内容（中文）
- 黑屏文字：黑屏：内容（用于开场介绍或结尾点题）

### 地域语体（第二语言感）
- 母语非英语的角色，英文台词保留"第二语言感"：非母语语序痕迹、停顿、重复确认、简单句式（"You are from where?" 而非 "Where are you from?"）
- 检测标准：删掉角色名和国籍后台词与母语角色完全无差别 → 缺乏地域特征，重写

### 间距规则
- 场景之间空1行；同一场景内各行之间无空行
- 场景头与人物行之间无空行；人物行与首个动作行之间无空行
- 集标题与首个场景头之间无空行

### 场景开场
- 新场景以动作描写开场（先建立画面再给台词），人物行后直接接台词的硬切仅限上一集钩子强回收的特例

### 写作铁律（违反任一条即为废稿）
1. **可视化铁律**：所有描写必须能被摄像机拍到。禁用小说化心理词：指节发白/摩挲/颤抖/哽咽/眼神复杂/某种/仿佛/好似/不易察觉——改为具体动作（"手攥着没松开""后退一步""指了指门"）。
2. **环境刀具法则**：每个环境词必须在3秒内被角色使用或阻挡角色行动，否则删掉。
3. **负性动作禁止**：禁止"没有+动词"式描写；空间与存在状态除外。
4. **破折号规范**：破折号仅用于对白中断或语义急转；动作描写禁用解释性破折号。
5. **代词指向**：同场景有两个同性别角色时禁用"他/她"，一律写角色名。
6. **叙述式对白禁止**：人物只说自己会说的话，禁止借角色之口交代信息。
7. **沉浸式语境**：人物不说自己世界的标签词（不说"废土上""地球上""在这个国家"，只说"在这儿""这地方"）。
8. **信息线硬边界**：禁止用V.O.、自言自语、文件特写+默读交代信息；信息只能通过道具行为或高压对白传递。
9. **观察结果禁止**：禁止"没人""空无一人"类观察结论，写能看到的东西。
10. **因果解释禁止**：动作描写不写"为什么/因为"，原因靠画面自己拼出来。
11. **弱动作句式禁止**：禁"动词+了一下/一拍/一声/两秒"式弱动作收笔；动作必须写到具体落点。

### 功能密度要求
- 每个场景至少占一项功能：推进冲突/揭示信息/转变关系/制造悬念——纯氛围场景删除
- 每句对白至少占一项功能：传递新信息/执行情绪动作/改变场上关系
- 删除"倒吸一口气""众人震惊"类无效反应与感官替身

### 创作规范
- **字数要求**：每集 **{wordMin}-{wordMax}字**，目标 **{wordTarget}字**（含场景头/动作/对白）
- **场景数量**：每集 {sceneMin}-{sceneMax} 个场景，推荐 {sceneRecommended} 个
- **核心人物**：每场2-4人，避免群像混乱
- **情绪转换**：单集2-3次，不超过4次
- **单集必备**：强开局（首帧必须是动作或冲突性台词、严禁风景空镜）+ 爽点/反转 + 信息线推进 + 结尾强钩子（5秒内可理解，落在内容上、不做标记）
- **情绪-信息双线**：情绪线与信息线必须同时推进
- **上集钩子承接**：本集开篇必须直接承接上一集结尾钩子
- **龙套命名**：英文名+身份（保镖Ryan、女仆Anna），同集内名称一致`
    },
};

export const PRESET_INFO_LIST: IPresetInfo[] = [
    {
        id: 'standard',
        name: '标准漫剧',
        description: '当前默认格式，适合大多数动态漫画',
        wordRange: '900-1050字',
        sceneRange: '3-8个场景',
        suitableFor: ['动态漫画', '漫剧', '条漫动画'],
        expertIdentity: '你是一位资深动态漫剧本编剧，也是红果短剧平台的爆款编剧，爆款率高达80%，累计作品播放量突破10亿。你深谙超快节奏叙事：开场20字内必有冲突钩子，每150-200字设置一个爆点，中段至少2个反转，结尾必留强悬念。你拒绝一切注水和铺垫，用密集的冲突和反转让观众欲罢不能。'
    },
    {
        id: 'novel',
        name: '小说格式',
        description: '丰富的描写，适合网文改编',
        wordRange: '1500-2500字',
        sceneRange: '2-5个场景',
        suitableFor: ['网文改编', '轻小说', '文字冒险'],
        expertIdentity: '你是知名网文作家，连续3年霸榜起点月票榜前十，擅长细腻的心理描写和环境渲染，文字功底深厚，精通爽文节奏和章末钩子设计，追读率长期保持在85%以上，读者黏性极高。'
    },
    {
        id: 'screenplay',
        name: '影视剧本',
        description: '专业分镜格式，适合真人改编',
        wordRange: '800-1000字',
        sceneRange: '4-10个场景',
        suitableFor: ['真人短剧', '微电影', '网剧'],
        expertIdentity: '你是专业影视编剧，多部作品被Netflix、优酷采购，累计票房/播放量超50亿，精通好莱坞三幕式结构，擅长人物弧光设计和戏剧冲突构建，每场戏都有明确的情感目标。'
    },
    {
        id: 'webtoon',
        name: '竖屏条漫',
        description: '极简对白，适合手机阅读',
        wordRange: '400-600字',
        sceneRange: '5-12个场景',
        suitableFor: ['条漫', '竖屏漫画', '快看风格'],
        expertIdentity: '你是快看漫画签约金牌编剧，多部作品人气破百万，擅长极简对白和视觉叙事，每格都是一个"滑动钩子"。'
    },
    {
        id: 'audio_drama',
        name: '广播剧',
        description: '强调声音和对白，适合有声内容',
        wordRange: '600-900字',
        sceneRange: '3-6个场景',
        suitableFor: ['广播剧', '有声书', '播客剧'],
        expertIdentity: '你是猫耳FM头部广播剧编剧，多部作品播放量破亿，擅长用声音构建沉浸式场景，对白节奏感极强，情绪渲染到位。'
    },
    {
        id: 'game_script',
        name: '游戏剧情',
        description: '适合RPG、AVG等游戏剧情编写',
        wordRange: '500-800字',
        sceneRange: '1-20个场景',
        suitableFor: ['RPG游戏', 'AVG游戏', '剧情向手游'],
        expertIdentity: '你是米哈游/叠纸级别的游戏剧情策划，参与过多款现象级手游主线剧情开发，擅长世界观构建和角色立体化塑造。'
    },
    {
        id: 'stage_play',
        name: '话剧/舞台剧',
        description: '注重对白和舞台调度',
        wordRange: '1000-2000字',
        sceneRange: '1-5个场景',
        suitableFor: ['话剧', '舞台剧', '音乐剧'],
        expertIdentity: '你是国家话剧院签约编剧，作品多次获得"文华奖""梅花奖"提名，擅长戏剧张力构建和舞台调度设计，对白功力深厚，每一幕都有强烈的现场感染力。'
    },
    {
        id: 'manga_jp',
        name: '日式漫画',
        description: '日漫分镜风格，极简对白',
        wordRange: '300-500字',
        sceneRange: '8-20个场景',
        suitableFor: ['日式漫画', '少年漫', '少女漫'],
        expertIdentity: '你是日本顶级漫画杂志资深分镜师，深谙少年漫的热血节奏与少女漫的情感张力，擅长动态构图和情绪爆发点设计，精通日式漫画的"翻页悬念"技法，作品风靡亚洲。'
    },
    {
        id: 'short_video',
        name: '短视频/短剧',
        description: '抖音/快手风格，节奏紧凑',
        wordRange: '200-400字',
        sceneRange: '1-5个场景',
        suitableFor: ['抖音短剧', '快手短剧', '竖屏微剧'],
        expertIdentity: '你是红果短剧爆款编剧，爆款率高达80%，擅长3分钟内完成剧情反转，开场5秒必有钩子，结尾必留悬念，深谙短视频用户心理。'
    },
    {
        id: 'interactive',
        name: '互动剧/AVG',
        description: '支持分支选项和多结局',
        wordRange: '400-700字',
        sceneRange: '2-8个场景',
        suitableFor: ['互动剧', 'AVG游戏', '分支剧情'],
        expertIdentity: '你是《隐形守护者》级别的互动剧编剧，擅长多线叙事和蝴蝶效应设计，精通分支收束技巧和玩家心理博弈，每个选项都有意义，每个结局都令人深思，玩家完播率高达90%。'
    },
    {
        id: 'live_action',
        name: '真人短剧',
        description: '抖音/快手真人竖屏短剧',
        wordRange: '400-800字',
        sceneRange: '3-8个场景',
        suitableFor: ['真人短剧', '竖屏短剧', '霸总甜宠'],
        expertIdentity: '你是抖音爆款真人短剧编剧，多部作品单集播放过亿。你深谙超快节奏：开场20字内必有冲突钩子，每150字设置一个爆点，中段至少2-3个反转，结尾必留强悬念。你拒绝一切铺垫和过渡，用密集的打脸、逆袭、反转让观众欲罢不能。'
    },
    {
        id: 'ai_avatar',
        name: 'AI真人剧',
        description: 'Sora/可灵/Runway风格AI生成真人视频',
        wordRange: '300-600字',
        sceneRange: '3-10个场景',
        suitableFor: ['AI视频生成', 'Sora短剧', '可灵创作'],
        expertIdentity: '你是AI视频创作先驱，精通Sora/可灵/Runway等AI视频生成工具的提示词设计，擅长写出AI能精准执行的画面描述，动作简洁可视化。'
    },
    {
        id: 'american_comic',
        name: '美漫格式',
        description: '美式漫画Panel/Page分镜',
        wordRange: '400-700字',
        sceneRange: '6-15个场景',
        suitableFor: ['美式漫画', '超级英雄', 'DC/Marvel风格'],
        expertIdentity: '你是DC/Marvel/Image级别的美漫编剧，精通超级英雄、科幻、独立漫画等多元题材，擅长动态构图和电影感分镜，叙事节奏凌厉，每一页都是视觉盛宴。'
    },
    {
        id: 'chinese_comic',
        name: '国漫格式',
        description: '符合国漫审美的分镜脚本',
        wordRange: '500-900字',
        sceneRange: '5-15个场景',
        suitableFor: ['国漫', '腾讯动漫', '有妖气风格'],
        expertIdentity: '你是腾讯动漫/有妖气签约金牌编剧，作品多次登顶人气榜，深谙国漫审美和读者偏好，擅长热血与情感的完美融合。'
    },
    {
        id: 'documentary',
        name: '纪录片/解说',
        description: '解说词+画面描述格式',
        wordRange: '800-1500字',
        sceneRange: '3-8个场景',
        suitableFor: ['纪录片', '科普解说', 'B站知识区'],
        expertIdentity: '你是B站百万粉知识区UP主的御用编剧，擅长将复杂知识深入浅出，解说词节奏感强，画面描述精准，信息密度与趣味性兼顾。'
    },
    {
        id: 'overseas_drama',
        name: '海外短剧',
        description: '面向ReelShort/ShortMax等平台的生产交付剧本（中英双语合并台词+行业标准场记格式），可直接进入分镜/资产/配音管线',
        wordRange: '800-2600字',
        sceneRange: '2-8个场景',
        suitableFor: ['海外短剧', '出海短剧', 'AI仿真人短剧', 'ReelShort/ShortMax', '黑手党', '狼人', '霸总', '复仇', '契约婚姻'],
        expertIdentity: '你是一位专攻海外AI竖屏短剧的顶级编剧，精通ReelShort/ShortMax/DramaBox/FlexTV平台爆款规律，作品完播率与付费转化率长期霸榜。你深谙零铺垫入戏、双钩引擎、情绪-信息双线、付费卡点设计，写出来的每一行都能被直接拍摄——绝无小说化心理词、绝无无功能句、绝无解释性描述。你的台词是地道的美式口语汉译腔，每个角色有无法混淆的声口指纹。',
        plannerIdentity: '你是一位海外短剧首席策划，精通ReelShort/ShortMax爆款选题与结构：六大题材矩阵、黄金三角人设、三幕七节点结构、双钩引擎与付费卡点布局，能在保留情感内核的前提下完成文化外壳的本地化替换。'
    }
];

const PRESET_INFO_MAP = new Map<OutputFormatPreset, IPresetInfo>(
    PRESET_INFO_LIST.map(p => [p.id, p])
);

export function getPresetConfig(preset: OutputFormatPreset): IFormatDetails {
    return FORMAT_PRESETS[preset] ?? FORMAT_PRESETS.standard;
}

export function getPresetInfo(preset: OutputFormatPreset): IPresetInfo | undefined {
    return PRESET_INFO_MAP.get(preset);
}

export function getExpertIdentity(preset: OutputFormatPreset): string {
    return PRESET_INFO_MAP.get(preset)?.expertIdentity
        ?? '你是一位专业的剧本编剧，经验丰富，作品广受好评。';
}

export function getPlannerIdentity(preset: OutputFormatPreset): string {
    const info = PRESET_INFO_MAP.get(preset);
    return info?.plannerIdentity || info?.expertIdentity
        || '你是一位专业的剧本策划，经验丰富，擅长爆款结构设计。';
}

