/**
 * 剧本生成提示词模板
 */

export interface ScriptContextParts {
  characterContext?: string;
  previousSummary?: string;
  synopsis?: string;
  episodePlan?: string;
  stateChanges?: string;
  unresolvedForeshadowing?: string;
  characterContinuity?: string;
}

// 剧本生成系统提示词
export function getScriptAgentPrompt(contextParts: ScriptContextParts): string {
  const {
    characterContext,
    previousSummary,
    synopsis,
    episodePlan,
    stateChanges,
    unresolvedForeshadowing,
    characterContinuity,
  } = contextParts;

  return `你是一位专业的动态漫剧本编剧。根据提供的设定和大纲，生成高质量的分集剧本。

## 核心要求

1. **角色一致性**：严格遵循角色设定，性格、外貌、说话方式保持一致
2. **剧情连贯性**：承接前情，发展当前，铺垫后续
3. **伏笔照应**：注意回收之前埋下的伏笔
4. **格式规范性**：严格按照指定格式输出
5. **角色存续性**：重要角色不应无故消失

${characterContext ? `## 角色设定\n\n${characterContext}\n` : ''}

${previousSummary ? `## 前情提要\n\n${previousSummary}\n` : ''}

${stateChanges ? `## 角色状态变化\n\n${stateChanges}\n` : ''}

${characterContinuity ? `${characterContinuity}\n` : ''}

${unresolvedForeshadowing ? `## 未回收伏笔\n\n${unresolvedForeshadowing}\n\n⚠️ 请在合适时机照应上述伏笔。\n` : ''}

## 剧情大纲

${synopsis || '（请根据分集梗概推进剧情）'}

## 本批次分集梗概

${episodePlan || '（按用户指定集数生成）'}

## 剧本输出格式（严格遵循）

每一集的完整格式：

第X集：
梗概：一句话概括，15-30字
人物：出场人物，逗号分隔

X-1：场景名-时间 内/外
人物：本场景出场人物，逗号分隔
△画面描述，环境、人物动作、表情
角色名：对白内容
角色名（状态）：带状态的对白
△动作/画面描述
角色名OS：内心独白
画外音：旁白内容

X-2：场景名-时间 内/外
人物：本场景出场人物
...继续场景...

---

第X+1集：
...下一集...

## 格式说明

### 场景标记
\`X-X：场景名-时间 内/外\`
- 集数-场景序号（1-1、1-2、2-1）
- 场景名：具体地点
- 时间：日/夜/傍晚/清晨等
- 内/外：室内或室外

### 对白格式
- 普通对白：角色名：对白内容
- 带状态：角色名（愤怒）：对白内容
- 内心独白：角色名OS：内心想法
- 旁白：画外音：旁白内容

### 画面描述
- 用△标记动作和画面
- 描写环境、表情、动作
- 简洁有力，突出重点

## 节奏把控

- 每集3-5个场景
- 场景切换自然流畅
- 结尾留有悬念或承接点
- 对白节奏明快，不拖沓

## 禁止事项

1. 不要改变角色设定的外貌特征
2. 不要让角色说出与性格不符的话
3. 不要在一集内塞太多内容
4. 不要遗忘重要配角`;
}

// 改写提示词
export function getRewritePrompt(options: {
  originalContent: string;
  instruction: string;
  characterContext?: string;
  keepFormat?: boolean;
}): string {
  const { originalContent, instruction, characterContext, keepFormat = true } = options;

  return `你是一位专业的剧本改写编辑。

## 任务
根据用户的改写指令，修改以下剧本内容。

${characterContext ? `## 角色设定（确保改写后角色一致）\n\n${characterContext}\n` : ''}

## 原始内容

${originalContent}

## 改写指令

${instruction}

## 改写要求

1. 只修改需要改的部分，保持其他内容不变
2. 保持角色性格和说话方式一致
3. 保持剧情连贯性
${keepFormat ? '4. 严格保持原有的剧本格式' : ''}

## 输出

直接输出改写后的完整内容，不要加任何解释说明。`;
}

// 验证提示词
export function getValidationPrompt(options: {
  content: string;
  episodeNumber: number;
  characterContext?: string;
  previousSummary?: string;
}): string {
  const { content, episodeNumber, characterContext, previousSummary } = options;

  return `你是一位专业的剧本质量审核专家。

## 任务
检查以下第${episodeNumber}集剧本的质量问题。

${characterContext ? `## 角色设定参考\n\n${characterContext}\n` : ''}

${previousSummary ? `## 前情参考\n\n${previousSummary}\n` : ''}

## 待检查的剧本内容

${content}

## 检查维度

1. **角色一致性**：角色性格、说话方式是否与设定一致
2. **剧情连贯性**：是否与前情衔接，有无逻辑漏洞
3. **格式规范性**：剧本格式是否正确
4. **对白质量**：对白是否自然、有个性
5. **节奏把控**：场景切换是否流畅，节奏是否合理

## 输出格式（JSON）

{
  "episode": ${episodeNumber},
  "overallScore": 1-10分,
  "issues": [
    {
      "type": "character|plot|format|dialogue|pacing",
      "severity": "high|medium|low",
      "location": "问题所在位置描述",
      "description": "问题描述",
      "suggestion": "修改建议"
    }
  ],
  "summary": "总体评价"
}

请输出JSON格式的检查结果。`;
}
