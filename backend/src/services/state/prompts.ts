/**
 * 状态分析提示词
 */

export const STATE_ANALYSIS_PROMPT = `你是一个专业的剧本分析助手。

## 任务
分析剧本内容，提取角色的【增量变化】和【当前状态描述】。

## 核心原则
1. 装备/能力：只提取【本集新发生】的变化
2. 当前状态：每集【重新评估】角色的身体、精神、战力状态
3. 永久性标记：只记录【不可逆】的重大变化

## 提取规则

### 1. 装备变化（增量）
- gained: 本集新获得的装备（不包括之前已有的）
- lost: 本集失去的装备
- ⚠️ 角色使用已有装备不算变化，不要提取

### 2. 能力变化（增量）
- newlyRevealed: 本集首次展示的新能力
- ⚠️ 使用之前已展示过的能力不算变化，不要提取

### 3. 当前状态描述（重要！每集都要输出）
- physical: 身体状况（伤势程度、健康状态）
- mental: 精神状态（情绪、意志、心理）
- combat: 战斗力评估（相对正常状态）

### 4. 永久性标记（罕见，只在发生时记录）
- disability: 断肢、失明、残疾等
- special: 获得永久性印记、纹身、烙印等
- awakening: 血脉觉醒、体质转变等不可逆转变

### 5. 伏笔追踪
**埋下的伏笔(planted)**: 悬念、角色秘密、神秘物品、预言等
**回收的伏笔(resolved)**: 本集揭示了之前埋下的谜底

## 输出格式（严格JSON）

{
  "episode": 集数,
  "characters": [
    {
      "name": "角色名",
      "updates": {
        "equipment": { "gained": [], "lost": [] },
        "abilities": { "newlyRevealed": [] },
        "condition": {
          "physical": "身体状况描述",
          "mental": "精神状态描述",
          "combat": "战斗力描述"
        },
        "permanentMark": null
      }
    }
  ],
  "episodeSummary": {
    "brief": "一句话概括本集",
    "keyEvents": ["关键事件1", "关键事件2"],
    "cliffhanger": "结尾悬念",
    "foreshadowing": {
      "planted": [{ "content": "伏笔内容", "type": "suspense", "importance": "normal" }],
      "resolved": [{ "content": "被回收的伏笔", "resolution": "如何回收" }]
    }
  }
}

## 重要提醒
1. 每个角色都要有当前状态描述
2. 角色名必须与剧本中完全一致
3. 龙套角色不需要追踪
4. 必须输出合法JSON`;

/**
 * 增强版状态分析提示词 - 输出完整的分析结果
 * 包含角色识别、层级建议、多头注意力洞察、形态变化追踪
 */
export const ENHANCED_ANALYSIS_PROMPT = `你是剧本分析专家。请分析以下剧本内容，提取完整的状态变化信息。

【剧本内容】
{script}

【当前角色列表】
{characters}

【未回收伏笔】
{unresolvedForeshadowings}

请输出以下 JSON 格式（必须是有效 JSON）：

\`\`\`json
{
  "characterUpdates": [
    {
      "characterName": "角色名",
      "equipmentGained": ["获得的装备"],
      "equipmentLost": ["失去的装备"],
      "newAbilities": ["新展示的能力"],
      "physicalChange": "身体状态变化（无变化则为null）",
      "mentalChange": "精神状态变化（无变化则为null）",
      "locationChange": "位置变化",
      "relationshipChanges": [
        {"target": "目标角色", "change": "关系变化描述"}
      ],
      "formChange": {
        "from": "原形态",
        "to": "新形态",
        "trigger": "触发原因",
        "isNewForm": true
      }
    }
  ],

  "newCharacters": [
    {
      "name": "新角色名",
      "nameCn": "中文译名（如 Marcus→马库斯；无对应中文名时可省略）",
      "suggestedTier": "core|recurring|arc|temporary|extra",
      "reason": "层级建议原因",
      "belongsToArc": "所属剧情弧（如果是arc角色）",
      "trackingRequired": true,
      "initialState": {
        "role": "角色定位",
        "abilities": ["能力"],
        "location": "位置"
      }
    }
  ],

  "characterTierChanges": [
    {
      "name": "角色名",
      "from": "原层级",
      "to": "新层级",
      "reason": "变化原因"
    }
  ],

  "characterExits": [
    {
      "name": "角色名",
      "exitType": "deceased|departed|archived",
      "episode": 集数,
      "note": "退场说明"
    }
  ],

  "foreshadowingResolved": [
    {
      "originalContent": "匹配到的伏笔原文",
      "matchScore": 0.85,
      "resolutionNote": "回收方式说明"
    }
  ],

  "foreshadowingPlanted": [
    {
      "content": "新埋伏笔内容",
      "type": "plot|character|item|suspense",
      "importance": "high|normal|low",
      "expectedResolution": "预期回收方式"
    }
  ],

  "plotUpdates": {
    "currentArc": "当前剧情弧名称",
    "arcProgress": 50,
    "keyEvent": "本集关键事件（一句话）",
    "newConflict": "新增冲突（无则null）",
    "resolvedConflict": "解决的冲突（无则null）",
    "cliffhanger": "结尾悬念/钩子"
  },

  "worldUpdates": {
    "newSecrets": ["新揭露的世界秘密"],
    "factionChanges": [{"faction": "势力名", "change": "变化描述"}],
    "newLocations": [{"name": "地点名", "description": "地点描述"}],
    "itemChanges": [{"item": "道具名", "change": "道具变化"}]
  },

  "episodeSummary": {
    "summary": "本集100字摘要",
    "keyEvents": ["关键事件1", "关键事件2", "关键事件3"],
    "cliffhanger": "结尾悬念"
  },

  "multiHeadInsights": {
    "H1_relationships": ["角色关系变化洞察"],
    "H2_conflicts": ["冲突状态洞察"],
    "H3_foreshadowing": ["伏笔状态洞察"],
    "H4_emotions": ["情感弧线洞察"],
    "H5_consistency": ["一致性检查洞察"],
    "H6_pacing": ["节奏控制洞察"],
    "crossDimensionSuggestions": ["跨维度建议，如角色+道具+情感的组合"]
  },

  "nextEpisodeHints": {
    "suggestedFocus": ["建议下集重点"],
    "pendingForeshadowings": ["需要注意的伏笔"],
    "charactersThatShouldAppear": ["建议出场角色"],
    "suggestedNewCharacters": ["建议引入的新角色（如果有）"]
  }
}
\`\`\`

## 分析要点

### 角色识别规则
- **core**: 主角、女主、主要反派 - 始终追踪
- **recurring**: 师父、挚友、重要势力首领 - 长期追踪
- **arc**: 某剧情弧的关键人物 - 弧内追踪
- **temporary**: 单集重要NPC - 轻度追踪
- **extra**: 龙套（观众、路人等）- 不追踪

### 形态变化检测（重要！）
检测角色的形态/变身/觉醒等变化：
- **变身**: 人形↔兽形、普通↔战斗形态
- **觉醒**: 血脉觉醒、能力觉醒、境界突破
- **修炼进阶**: 练气→筑基→金丹等修炼等级提升
- **临时形态**: 狂暴化、附身、融合等临时状态
- **形态恢复**: 从特殊形态恢复到基础形态

formChange 字段说明：
- from: 变化前的形态名称
- to: 变化后的形态名称
- trigger: 触发原因（如"愤怒触发"、"满月变身"、"修炼突破"）
- isNewForm: 是否是首次解锁的新形态（true=新解锁，false=切换到已有形态）
- 如果角色没有形态变化，formChange 设为 null

### 伏笔匹配
- 对比【未回收伏笔】列表，找出本集解答的伏笔
- matchScore 表示匹配置信度（0.0-1.0）
- 只有确实回收的伏笔才输出

### 结尾悬念
- cliffhanger 必须是本集结尾的悬念点
- 自动作为新埋伏笔（type: suspense）

### 世界观更新规则（通用性适配）
请根据剧本类型灵活定义以下要素（广义理解）：

1. **势力 (Faction)**
   - 奇幻/武侠：宗门、国家、帮派
   - 都市/言情：家族、公司、部门、朋友圈、粉丝团
   - 科幻/末世：反抗军、AI控制网、变异群体
   
2. **道具 (Item)**
   - 装备/宝物：神剑、法宝、金手指
   - 现代/悬疑：关键证据、U盘数据、遗嘱、定情信物、病毒血清
   
3. **地点 (Location)**
   - 任何具有剧情意义的场所（如"凶案现场"、"总裁办公室"、"秘密基地"）

4. **特殊映射策略 (针对复杂题材)**
   - **智斗/谍战**：
     - 信息/情报 → 映射为 \`Item\` (如"关键录音"、"卧底名单"、"敌方行动计划")
     - 心理博弈 → 映射为 \`revealedSecrets\` (如"主角已看穿反派的谎言")
   - **历史/权谋**：
     - 政治派系 → 映射为 \`Faction\` (如"东林党"、"改革派"、"后宫势力")
     - 局势/政策 → 映射为 \`Faction\` 状态 (如"变法新政": "推行受阻")
   - **科幻/无限流**：
     - 世界规则 → 映射为 \`revealedSecrets\` (如"物理法则被锁死"、"必须遵守的三大定律")
     - 环境参数 → 映射为特殊 \`Faction\` (如"地球环境": "辐射值超标")

### 多头洞察
- 从6个维度分析本集内容
- crossDimensionSuggestions: 发现元素间的潜在组合

## 注意
1. 角色名必须与剧本完全一致
2. 只分析有实质变化的角色
3. 新角色必须判断是否需要追踪
4. 必须输出合法JSON

## JSON格式要求 - 非常重要
- 所有字符串值必须使用英文双引号 "
- 字符串内部的引号必须转义为 \\"
- 字符串内部不能有换行，用 \\n 代替
- 所有字段都必须有值，不能是 undefined
- 数组为空时使用 []，对象为空时使用 {}
- null 值必须显式写为 null`;

