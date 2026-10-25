function optionalSection(label: string, content?: string): string {
  return content ? `【${label}】\n${content}\n` : '';
}

function formatEpisodeList(episodeContents: { [key: number]: string }): string {
  return Object.entries(episodeContents)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .map(([num, content]) => `【第${num}集剧本】\n${content}`)
    .join('\n\n');
}

export interface RewriteOptions {
  originalContent: string;
  episodeNum: number;
  outline?: string;
  characters?: string;
  characterContext?: string;
  previousSummary?: string;
  stateChanges?: string;
  episodePlan?: string;
}

export function getRewritePrompt(options: RewriteOptions): string {
  const {
    originalContent,
    episodeNum,
    outline,
    characters,
    characterContext,
    previousSummary,
    stateChanges,
    episodePlan
  } = options;

  return `你是一位专业的动态漫剧本编剧，擅长剧本润色和改写。

【任务】
对第${episodeNum}集剧本进行改写，根据用户的改写要求进行调整。

【核心原则】
1. 保持剧情主线和关键事件不变
2. 保持角色性格和说话风格一致
3. 保持场景编号格式（如 ${episodeNum}-1、${episodeNum}-2 等）
4. 保持剧本格式规范（场景标题、画面/动作描写、对白等——沿用原文既有排版符号）
5. 根据用户要求进行针对性改写
6. **重要：保持角色状态的一致性（装备、能力、伤势等）**

${outline ? `【剧情大纲】\n${outline}\n` : ''}

${characterContext ? `【角色设定与当前状态】\n${characterContext}\n` : (characters ? `【人物设定】\n${characters}\n` : '')}

${previousSummary ? `【前情提要】\n${previousSummary}\n` : ''}

${stateChanges ? `【近期状态变化】\n${stateChanges}\n` : ''}

${episodePlan ? `【本集梗概】\n${episodePlan}\n` : ''}

【原剧本内容】
${originalContent}

【输出要求】
直接输出改写后的完整剧本内容，保持原有格式，不要添加任何解释或说明。
注意：改写时需参考角色当前状态，确保装备、能力、伤势等描述与前情一致。`;
}

export interface FixAnalysisOptions {
  issue: {
    type: string;
    severity: string;
    episode: number;
    location?: string;
    description: string;
    evidence?: string;
    suggestion?: string;
  };
  episodeContents: { [key: number]: string };
  characterContext?: string;
  outline?: string;
}

export function getFixAnalysisPrompt(options: FixAnalysisOptions): string {
  const { issue, episodeContents, characterContext, outline } = options;

  const episodeList = formatEpisodeList(episodeContents);

  return `你是一位专业的剧本校对编辑，擅长发现并修复剧本中的问题。

【任务】
分析以下验证问题，判断问题的影响范围，并生成2-3个修复方案供用户选择。

【问题信息】
- 类型：${issue.type}
- 严重程度：${issue.severity}
- 位置：第${issue.episode}集${issue.location ? ` - ${issue.location}` : ''}
- 描述：${issue.description}
${issue.evidence ? `- 证据：${issue.evidence}` : ''}
${issue.suggestion ? `- 建议：${issue.suggestion}` : ''}

${optionalSection('剧情大纲', outline)}
${optionalSection('角色设定与状态', characterContext)}
${episodeList}

【分析要求】
1. **判断问题范围**：仔细分析问题是否只影响单集，还是涉及多集
   - 如果问题涉及伏笔/悬念，检查是否需要在多集中协调修改
   - 如果问题涉及角色状态/设定，检查是否影响其他集数
   - 如果问题涉及时间线/连续性，检查相邻集数是否需要调整
2. **确定影响集数**：在 affectedEpisodes 中列出所有需要修改的集数
3. **生成修复方案**：每个方案的 changes 应包含所有需要修改的集数
4. **说明修改原因**：每个修改点都要说明为什么需要改

【重要判断标准】
- 如果问题类型是 unresolved（悬念未收）、character（角色矛盾）、timeline（时间线）、continuity（连续性），很可能需要跨集修复
- 如果修复需要在多个集数中添加/修改内容来保持一致性，则 affectedEpisodes 应包含多集
- 如果只需要修改单集就能解决问题，affectedEpisodes 只包含该集

【JSON格式要求 - 极其重要】
1. 所有字符串值中的双引号必须转义为 \\"
2. 所有字符串值中的换行符必须转义为 \\n
3. 所有字符串值中的反斜杠必须转义为 \\\\
4. original 和 modified 字段只写关键的一句话（不超过50字），不要写完整段落
5. 确保JSON格式完整，所有括号正确闭合

【输出格式】
请严格按以下JSON格式输出：

\`\`\`json
{
  "analysis": "问题根本原因分析（一段话）",
  "affectedEpisodes": [1, 2],
  "plans": [
    {
      "id": "plan_1",
      "name": "方案名称",
      "description": "详细描述修复方案",
      "confidence": 95,
      "changes": [
        {
          "episode": 1,
          "location": "场景X-X",
          "original": "原文关键句（限50字内）",
          "modified": "修改后关键句（限50字内）",
          "reason": "修改原因"
        }
      ],
      "sideEffects": "可能的副作用",
      "recommended": true
    }
  ]
}
\`\`\`

注意：
- confidence 使用 0-100 的整数，不是小数
- affectedEpisodes 必须包含所有需要修改的集数（可能是1集，也可能是多集）
- 每个 plan 的 changes 中的 episode 必须在 affectedEpisodes 中
只输出JSON代码块，不要其他内容。`;
}

export interface FixExecutionOptions {
  plan: {
    id: string;
    name: string;
    description: string;
    changes: Array<{
      episode: number;
      location: string;
      original: string;
      modified: string;
      reason: string;
    }>;
  };
  episodeNum: number;
  originalContent: string;
  characterContext?: string;
  formatSection?: string;
}

export function getFixExecutionPrompt(options: FixExecutionOptions): string {
  const { plan, episodeNum, originalContent, characterContext, formatSection } = options;

  const changesForEpisode = plan.changes.filter(c => c.episode === episodeNum);
  const changesDesc = changesForEpisode.map((c, i) =>
    `${i + 1}. 位置：${c.location}\n   原文：${c.original}\n   改为：${c.modified}\n   原因：${c.reason}`
  ).join('\n\n');

  return `你是一位专业的剧本编辑，需要执行以下修复操作。

【修复方案】
${plan.name}
${plan.description}

【具体修改】
${changesDesc}

${optionalSection('角色设定与状态', characterContext)}
【第${episodeNum}集原始剧本】
${originalContent}

【执行要求】
1. 严格按照修复方案执行修改
2. 保持剧本格式不变${formatSection ? `，本项目格式规范：\n${formatSection}` : '（场景编号、对白格式等）'}
3. 确保修改后的内容自然流畅
4. 除了指定修改外，不要改动其他内容
5. 保持角色性格和说话风格一致

【输出要求】
直接输出修复后的完整第${episodeNum}集剧本，不要添加任何解释或说明。`;
}

export interface CrossEpisodeFixOptions {
  issue: {
    type: string;
    severity: string;
    episode: number;
    description: string;
    evidence?: string;
    affectedEpisodes?: number[];
    windowRange?: { start: number; end: number };
  };
  episodeContents: { [key: number]: string };
  characterContext?: string;
  outline?: string;
}

export function getCrossEpisodeFixPrompt(options: CrossEpisodeFixOptions): string {
  const { issue, episodeContents, characterContext, outline } = options;

  const episodeList = formatEpisodeList(episodeContents);

  return `你是一位专业的剧本连续性编辑，擅长解决跨集剧情问题。

【任务】
分析以下跨越多集的问题，找出最小改动的修复方案。

【问题信息】
- 类型：${issue.type}
- 严重程度：${issue.severity}
- 涉及集数：${issue.affectedEpisodes?.join('、') || issue.episode}集
- 描述：${issue.description}
${issue.evidence ? `- 证据：${issue.evidence}` : ''}
${issue.windowRange ? `- 窗口范围：第${issue.windowRange.start}-${issue.windowRange.end}集` : ''}

${optionalSection('剧情大纲', outline)}
${optionalSection('角色设定与状态', characterContext)}
${episodeList}

【分析原则】
1. **最小改动原则**：优先选择改动最少的集数/位置
2. **连贯性原则**：修复后前后剧情要自然衔接
3. **一致性原则**：修复后角色状态、设定要保持一致
4. **影响评估**：评估每个修改对后续剧情的影响

【JSON格式要求 - 极其重要】
1. 所有字符串值中的双引号必须转义为 \\"
2. 所有字符串值中的换行符必须转义为 \\n
3. 所有字符串值中的反斜杠必须转义为 \\\\
4. original 和 modified 字段只写关键的一句话（不超过50字），不要写完整段落
5. 确保JSON格式完整，所有括号正确闭合
6. confidence 使用 0-100 的整数，不是小数

【输出格式】
请严格按以下JSON格式输出：

\`\`\`json
{
  "analysis": "问题根本原因分析（一段话描述）",
  "plans": [
    {
      "id": "plan_1",
      "name": "方案名称",
      "description": "详细方案描述",
      "confidence": 90,
      "changes": [
        {
          "episode": 1,
          "location": "场景X-X",
          "original": "原文关键句（限50字内）",
          "modified": "修改后关键句（限50字内）",
          "reason": "修改原因"
        }
      ],
      "recommended": true
    }
  ]
}
\`\`\`

只输出JSON代码块，不要其他内容。`;
}

export interface CoordinatedRewriteOptions {
  episodes: Array<{ number: number; content: string }>;
  outline?: string;
  characters?: string;
  previousContext?: string;
  formatSection?: string;
}

export function getCoordinatedRewritePrompt(options: CoordinatedRewriteOptions): string {
  const { episodes, outline, characters, previousContext, formatSection } = options;

  const wordCountStats = episodes.map(ep => `第${ep.number}集: ${ep.content.length}字`).join('\n');

  const episodeContents = episodes.map(ep => `
========== 第${ep.number}集 (${ep.content.length}字) ==========
${ep.content}
`).join('\n');

  const epNums = episodes.map(ep => ep.number);
  const formatExample = epNums.slice(0, 3).map(num => `<<<第${num}集>>>
（第${num}集改写后的完整内容）
<<<第${num}集结束>>>`).join('\n\n');

  const allEpList = epNums.join('、');

  return `你是一位专业的剧本编辑，需要对多集剧本进行协调改写。

## 你的能力

1. 可以在各集之间自由移动、调整、增删内容
2. 可以重新分配剧情节点和事件顺序
3. 可以调整各集的篇幅和节奏
4. 可以统一或调整写作风格
5. 可以增强或削弱特定元素（悬念、幽默、紧张感等）
6. 可以增加或减少特定角色的戏份
7. 可以调整对话风格和描写密度

## 角色设定

${characters || '（未提供角色设定）'}

## 剧情大纲

${outline || '（未提供剧情大纲）'}

${previousContext ? `## 前情提要\n\n${previousContext}\n` : ''}

## 当前各集字数统计

${wordCountStats}

## 待改写剧本

${episodeContents}

## 输出格式要求（最重要！必须严格遵守！）

【警告】如果不按照以下格式输出，系统将无法正确解析你的改写结果！

你必须为第${allEpList}集各自输出，使用以下精确格式：

${formatExample}

${epNums.length > 3 ? `...依此类推，第${epNums.slice(3).join('、')}集也要按相同格式输出...\n` : ''}
【格式要点】
1. 开始标记：<<<第X集>>> （X是具体集数）
2. 结束标记：<<<第X集结束>>>
3. 每集的内容放在开始和结束标记之间
4. 必须输出全部${epNums.length}集（第${allEpList}集），缺一不可
5. 标记必须单独成行，不要和内容混在一起

## 注意事项

1. **必须输出所有选中的集数**，即使某集无需大改也要完整输出
2. **保持场景编号格式**，如 5-1、5-2、6-1、6-2 等
3. **保持剧情连贯性**，前后集衔接自然
4. **保持角色一致性**，性格、说话风格不变
5. **根据用户需求灵活调整**，可大胆移动、增删内容
6. **保持格式规范**，${formatSection ? `按项目输出格式执行：\n${formatSection}` : '包含场景标题、画面/动作描写、对白等，沿用原文排版符号'}

## 特别说明

- 你有完全的自由度来实现用户的需求
- 如果需求涉及内容迁移，确保迁移后前后衔接自然
- 如果需求涉及篇幅调整，注意保持剧情完整性
- 如果需求涉及风格调整，确保所有选中集风格统一
- 不要省略任何内容，完整输出每一集`;
}

export interface CrossEpisodeAnalysisOptions {
  issue: {
    type: string;
    severity: string;
    episode: number;
    description: string;
    evidence?: string;
    windowRange?: string;
  };
  episodeContents: { [key: number]: string };
  foreshadowings?: Array<{
    id: string;
    content: string;
    episodePlanted: number;
    status: string;
  }>;
  characterContext?: string;
  outline?: string;
}

export function getCrossEpisodeAnalysisPrompt(options: CrossEpisodeAnalysisOptions): string {
  const { issue, episodeContents, foreshadowings, characterContext, outline } = options;

  const foreshadowingList = foreshadowings && foreshadowings.length > 0
    ? foreshadowings.map(f => `- [${f.id}] 第${f.episodePlanted}集埋设，状态：${f.status}\n  内容：${f.content}`).join('\n')
    : '无相关伏笔记录';

  return `你是一位专业的剧本连续性编辑，擅长分析和解决跨集剧情问题。

【任务】
分析以下跨集问题，识别所有相关集数的角色（源头/铺垫/回收），并生成协调一致的修复方案。

【问题信息】
- 类型：${issue.type}
- 严重程度：${issue.severity}
- 源头集数：第${issue.episode}集
- 描述：${issue.description}
${issue.evidence ? `- 证据：${issue.evidence}` : ''}
${issue.windowRange ? `- 检测窗口：第${issue.windowRange}集` : ''}

【相关伏笔记录】
${foreshadowingList}

${optionalSection('剧情大纲', outline)}
${optionalSection('角色设定与状态', characterContext)}
${formatEpisodeList(episodeContents)}

【分析要求】
1. **识别问题链条**：找出问题的完整链条（源头 → 铺垫 → 应回收位置）
2. **确定各集角色**：
   - source（源头）：问题/伏笔最初出现的集数
   - bridge（铺垫）：有相关提及或铺垫的集数
   - resolution（回收）：应该解决/回收问题的集数
3. **生成协调方案**：每个方案包含所有涉及集数的协调修改
4. **说明关联关系**：各集修改之间如何呼应

【JSON格式要求】
1. 所有字符串值中的双引号必须转义为 \\"
2. 所有字符串值中的换行符必须转义为 \\n
3. original 和 modified 字段限50字内
4. confidence 使用 0-100 的整数

【输出格式】
\`\`\`json
{
  "analysis": "问题根本原因分析",
  "affectedEpisodes": [
    {
      "episodeNumber": 6,
      "role": "source",
      "relevance": "伏笔埋设位置，掌柜放狠话"
    },
    {
      "episodeNumber": 8,
      "role": "bridge",
      "relevance": "提到捞出狱，有铺垫"
    },
    {
      "episodeNumber": 9,
      "role": "resolution",
      "relevance": "应安排后续行动"
    }
  ],
  "plans": [
    {
      "id": "plan_1",
      "name": "方案名称",
      "description": "详细方案描述",
      "confidence": 85,
      "recommended": true,
      "sideEffects": "可能的副作用",
      "changes": [
        {
          "episode": 6,
          "role": "source",
          "priority": "optional",
          "location": "场景6-5",
          "original": "原文关键句",
          "modified": "修改后关键句",
          "reason": "加强威胁感",
          "relatedTo": [9]
        },
        {
          "episode": 9,
          "role": "resolution",
          "priority": "required",
          "location": "场景9-2",
          "original": "原文关键句",
          "modified": "修改后关键句",
          "reason": "安排报复行动",
          "relatedTo": [6, 8]
        }
      ],
      "connections": [
        {
          "fromEpisode": 6,
          "toEpisode": 9,
          "type": "foreshadowing",
          "description": "第6集的威胁在第9集得到回应"
        }
      ]
    }
  ]
}
\`\`\`

只输出JSON代码块，不要其他内容。`;
}

export interface TargetedValidationOptions {
  originalIssue: {
    type: string;
    description: string;
    episode: number;
    evidence?: string;
  };
  fixedEpisodeContents: { [key: number]: string };
}

export function getTargetedValidationPrompt(options: TargetedValidationOptions): string {
  const { originalIssue, fixedEpisodeContents } = options;

  return `你是一位专业的剧本审核专家，需要验证一个特定问题是否已被修复。

【原问题信息】
- 类型：${originalIssue.type}
- 描述：${originalIssue.description}
- 原位置：第${originalIssue.episode}集
${originalIssue.evidence ? `- 原证据：${originalIssue.evidence}` : ''}

【修复后的剧本内容】
${formatEpisodeList(fixedEpisodeContents)}

【验证任务】
请判断原问题是否已被解决。

【验证标准】
根据问题类型进行针对性检查：
- unresolved（悬念未收）：检查伏笔是否有推进或回收
- character（角色矛盾）：检查角色状态/行为是否一致
- timeline（时间线错误）：检查时间顺序是否正确
- setting（设定冲突）：检查设定是否一致
- continuity（剧情不连贯）：检查场景衔接是否自然
- logic（逻辑漏洞）：检查因果逻辑是否合理

【重要】
- 只判断原问题是否解决，不要检测其他问题
- 不要扩大验证范围
- 给出具体的验证依据

【输出格式】
\`\`\`json
{
  "passed": true,
  "originalIssueResolved": true,
  "details": "具体说明原问题是否解决，以及如何解决的（引用修复后的内容作为证据）"
}
\`\`\`

只输出JSON代码块，不要其他内容。`;
}

export function parseMultiEpisodeResponse(
  response: string,
  expectedEpisodes: number[]
): Map<number, string> {
  const results = new Map<number, string>();

  console.log('[parseMultiEpisodeResponse] 开始解析:', {
    responseLength: response.length,
    expectedEpisodes,
    responsePreview: response.substring(0, 500),
    responseTail: response.substring(Math.max(0, response.length - 300)),
  });

  const markerFormats = [
    { wrap: (ep: number) => [`<<<第${ep}集>>>`, `<<<第${ep}集结束>>>`], name: '格式1' },
    { wrap: (ep: number) => [`【第${ep}集】`, `【第${ep}集结束】`], name: '格式2' },
    { wrap: (ep: number) => [`---第${ep}集---`, `---第${ep}集结束---`], name: '格式3' },
  ];

  for (const epNum of expectedEpisodes) {
    let content: string | null = null;

    for (const fmt of markerFormats) {
      if (content) break;
      const [startMarker, endMarker] = fmt.wrap(epNum);
      const startIndex = response.indexOf(startMarker);
      const endIndex = response.indexOf(endMarker);
      if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        content = response.substring(startIndex + startMarker.length, endIndex).trim();
        console.log(`[parseMultiEpisodeResponse] 第${epNum}集: ${fmt.name}匹配成功`);
      }
    }

    if (!content) {
      const flexiblePattern = new RegExp(
        `(?:<<<|【|---)?第${epNum}集(?:>>>|】|---)?[\\s\\n]*([\\s\\S]*?)(?:<<<|【|---)?第${epNum}集(?:结束|完|END)(?:>>>|】|---)?`,
        'i'
      );
      const match = response.match(flexiblePattern);
      if (match && match[1]) {
        content = match[1].trim();
        console.log(`[parseMultiEpisodeResponse] 第${epNum}集: 正则匹配成功`);
      }
    }

    if (!content && expectedEpisodes.length === 1) {
      const scenePattern = new RegExp(`${epNum}-\\d+`, 'g');
      if (scenePattern.test(response)) {
        const cleanedResponse = response
          .replace(/^[\s\S]*?(?=\d+-\d+|场景)/m, '')
          .trim();
        if (cleanedResponse.length > 100) {
          content = cleanedResponse;
          console.log(`[parseMultiEpisodeResponse] 第${epNum}集: 单集整体匹配`);
        }
      }
    }

    if (content) {
      results.set(epNum, content);
      console.log(`[parseMultiEpisodeResponse] 第${epNum}集解析成功, 内容长度:`, content.length);
    } else {
      console.log(`[parseMultiEpisodeResponse] 第${epNum}集: 所有格式匹配失败`);
    }
  }

  console.log('[parseMultiEpisodeResponse] 解析完成:', {
    parsedCount: results.size,
    parsedEpisodes: Array.from(results.keys()),
    missingEpisodes: expectedEpisodes.filter(ep => !results.has(ep)),
  });

  if (results.size === 0) {
    console.log('[parseMultiEpisodeResponse] 解析失败! 完整响应内容:');
    console.log('='.repeat(50));
    console.log(response);
    console.log('='.repeat(50));
  }

  return results;
}

export interface MultiEpisodeFixOptions {
  plan: {
    id: string;
    name: string;
    description: string;
    changes: Array<{
      episode: number;
      role?: string;
      priority?: string;
      location: string;
      original: string;
      modified: string;
      reason: string;
      relatedTo?: number[];
    }>;
    connections?: Array<{
      fromEpisode: number;
      toEpisode: number;
      type: string;
      description: string;
    }>;
  };
  episodeContents: { [key: number]: string };
  characterContext?: string;
}

export function getMultiEpisodeFixPrompt(options: MultiEpisodeFixOptions): string {
  const { plan, episodeContents, characterContext } = options;

  const episodeNumbers = Object.keys(episodeContents).map(Number).sort((a, b) => a - b);

  const changesByEpisode = new Map<number, typeof plan.changes>();
  for (const change of plan.changes) {
    if (!changesByEpisode.has(change.episode)) {
      changesByEpisode.set(change.episode, []);
    }
    changesByEpisode.get(change.episode)!.push(change);
  }

  const changesDesc = episodeNumbers.map(epNum => {
    const changes = changesByEpisode.get(epNum) || [];
    if (changes.length === 0) {
      return `【第${epNum}集】无需修改，保持原样输出`;
    }
    const changeList = changes.map((c, i) =>
      `  ${i + 1}. 位置：${c.location}${c.role ? ` [${c.role}]` : ''}${c.priority ? ` (${c.priority})` : ''}
     原文：${c.original}
     改为：${c.modified}
     原因：${c.reason}${c.relatedTo ? `\n     关联：第${c.relatedTo.join('、')}集` : ''}`
    ).join('\n');
    return `【第${epNum}集修改】\n${changeList}`;
  }).join('\n\n');

  const connectionsDesc = plan.connections && plan.connections.length > 0
    ? plan.connections.map(c =>
      `- 第${c.fromEpisode}集 → 第${c.toEpisode}集 (${c.type}): ${c.description}`
    ).join('\n')
    : '无';

  const episodeList = episodeNumbers.map(num =>
    `========== 第${num}集原始内容 ==========\n${episodeContents[num]}`
  ).join('\n\n');

  const formatExample = episodeNumbers.map(num =>
    `<<<第${num}集>>>\n（这里输出第${num}集修复后的完整剧本内容）\n<<<第${num}集结束>>>`
  ).join('\n\n');

  return `你是一位专业的剧本编辑，需要对多集剧本进行协调修复。

【修复方案】
${plan.name}
${plan.description}

【各集修改要求】
${changesDesc}

【修改关联说明】
${connectionsDesc}

${optionalSection('角色设定与状态', characterContext)}
${episodeList}

【执行要求】
1. 严格按照修复方案执行各集修改
2. 确保各集修改之间的呼应关系
3. 保持剧本格式不变（场景编号、对白格式等）
4. 除指定修改外，不要改动其他内容
5. 保持角色性格和说话风格一致
6. 即使某集无需修改，也要完整输出

【输出格式 - 极其重要！必须严格遵守！】

你必须使用以下精确格式输出每集修复后的内容：

${formatExample}

【格式要点】
1. 开始标记必须是：<<<第X集>>>（X是具体集数，如 <<<第${episodeNumbers[0]}集>>>）
2. 结束标记必须是：<<<第X集结束>>>（如 <<<第${episodeNumbers[0]}集结束>>>）
3. 每集的完整剧本内容放在开始和结束标记之间
4. 必须输出全部${episodeNumbers.length}集（第${episodeNumbers.join('、')}集），缺一不可
5. 标记必须单独成行，不要和内容混在一起
6. 不要输出任何解释或说明，只输出标记和剧本内容

【警告】如果不按照上述格式输出，系统将无法解析你的修复结果！`;
}

export interface SequentialFixOptions {
  originalIssue: {
    type: string;
    description: string;
    evidence?: string;
  };
  currentEpisode: number;
  currentContent: string;
  changes: Array<{
    location: string;
    original: string;
    modified: string;
    reason: string;
    relatedTo?: number[];
  }>;
  crossEpisodeContext: {
    previousFixes: Array<{
      episode: number;
      summary: string;
      keyChanges: string[];
    }>;
    upcomingFixes: Array<{
      episode: number;
      plannedChanges: string;
    }>;
  };

  planName: string;
  planDescription: string;
  characterContext?: string;
}

export function getSequentialFixPrompt(options: SequentialFixOptions): string {
  const {
    originalIssue, currentEpisode, currentContent,
    changes, crossEpisodeContext, planName, planDescription, characterContext
  } = options;

  const previousFixesContext = crossEpisodeContext.previousFixes.length > 0
    ? crossEpisodeContext.previousFixes.map(f =>
      `【第${f.episode}集已修复】\n摘要：${f.summary}\n关键改动：${f.keyChanges.join('；')}`
    ).join('\n\n')
    : '（这是第一集修复，无前序内容）';

  const upcomingContext = crossEpisodeContext.upcomingFixes.length > 0
    ? crossEpisodeContext.upcomingFixes.map(f =>
      `第${f.episode}集将修复：${f.plannedChanges}`
    ).join('\n')
    : '（这是最后一集修复）';

  const changesDesc = changes.map((c, i) =>
    `${i + 1}. 位置：${c.location}\n` +
    `   原文：${c.original}\n` +
    `   改为：${c.modified}\n` +
    `   原因：${c.reason}` +
    (c.relatedTo && c.relatedTo.length > 0 ? `\n   呼应：第${c.relatedTo.join('、')}集` : '')
  ).join('\n\n');

  return `你是一位专业的剧本编辑，正在执行跨集协调修复任务。

【核心原则 - 保持原文风格】
你必须严格保持原文的：
1. 写作风格（幽默/严肃/文艺等）
2. 格式规范（场景标题格式、对白格式、描写符号等）
3. 叙述方式（第几人称、视角等）
4. 用词习惯和句式特点
修复后的内容应与原文融为一体，无法分辨哪些是修改的。

【原始问题】
- 类型：${originalIssue.type}
- 描述：${originalIssue.description}
${originalIssue.evidence ? `- 证据：${originalIssue.evidence}` : ''}

【修复方案】
${planName}
${planDescription}

【已完成的修复】
${previousFixesContext}

【后续修复预告】
${upcomingContext}

【本集任务：第${currentEpisode}集】
${changesDesc}

${optionalSection('角色设定与状态', characterContext)}
【第${currentEpisode}集原始剧本】
${currentContent}

【执行要求】
1. 严格按照修复方案执行修改
2. **保持与原文完全一致的风格和格式**
3. 与已修复集的内容保持呼应
4. 为后续修复预留衔接点
5. 除指定修改外，不改动其他内容
6. 确保修改后的内容自然流畅

【输出要求】
直接输出修复后的完整第${currentEpisode}集剧本，不要添加任何解释或说明。
保持原文的所有格式符号与排版约定（沿用原文既有的行型标记，不要混用其他格式规范）。`;
}

