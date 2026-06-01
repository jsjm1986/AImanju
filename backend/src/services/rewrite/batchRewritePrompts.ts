/**
 * 批量连贯改写 Prompts
 */

import { CoherenceContext, EpisodePlan } from './BatchCoherentRewriteService';

export interface PlanGenerationOptions {
  episodes: Array<{ number: number; content: string; wordCount: number }>;
  instruction: string;
  characterContext: string;
  outline: string;
  previousSummary?: string;
}

export interface CascadeRewriteOptions {
  episodeNumber: number;
  originalContent: string;
  instruction: string;
  plan: EpisodePlan;
  coherenceContext: CoherenceContext;
  previousRewrittenEpisodes: Array<{ number: number; content: string }>;
}

/**
 * 生成改写计划的 Prompt
 */
export function getBatchRewritePlanPrompt(options: PlanGenerationOptions): string {
  const { episodes, instruction, characterContext, outline, previousSummary } = options;

  return `你是一位专业的剧本编辑，需要为多集剧本的批量改写制定详细计划。

## 改写指令
${instruction}

## 角色设定
${characterContext}

## 剧情大纲
${outline}

${previousSummary ? `## 前情提要\n${previousSummary}\n` : ''}

## 待改写剧本

${episodes.map(ep => `
### 第${ep.number}集 (${ep.wordCount}字)
${ep.content.substring(0, 2000)}${ep.content.length > 2000 ? '...(内容过长已截断)' : ''}
`).join('\n')}

## 任务
请分析以上剧本，根据改写指令制定详细的改写计划。

## 输出要求
请严格按以下JSON格式输出：

{
  "analysis": "对改写需求的整体分析",
  "episodes": [
    {
      "episodeNumber": 集数,
      "plannedChanges": "该集的改动摘要",
      "keyElements": ["需要保留的关键元素"],
      "connectionPoints": {
        "fromPrevious": ["与前一集的衔接点"],
        "toNext": ["与后一集的衔接点"]
      }
    }
  ],
  "coherencePoints": [
    {
      "type": "character_state|foreshadowing|plot_thread|timeline",
      "description": "连贯性处理点描述",
      "affectedEpisodes": [涉及的集数],
      "handling": "处理方式"
    }
  ],
  "estimatedImpact": "预估改动对整体剧情的影响",
  "warnings": ["需要注意的风险点"]
}

只输出JSON，不要其他内容。`;
}

/**
 * 生成级联改写的 Prompt
 */
export function getCascadeRewritePrompt(options: CascadeRewriteOptions): string {
  const { episodeNumber, originalContent, instruction, plan, coherenceContext, previousRewrittenEpisodes } = options;

  const prevEpisodes = previousRewrittenEpisodes
    .slice(-2)
    .map(ep => `### 第${ep.number}集（已改写）\n${ep.content.substring(0, 1500)}${ep.content.length > 1500 ? '...' : ''}`)
    .join('\n\n');

  return `你是一位专业的剧本编辑，正在执行批量连贯改写的第${episodeNumber}集。

## 改写指令
${instruction}

## 本集改写计划
${plan.plannedChanges}

### 需要保留的关键元素
${plan.keyElements.length > 0 ? plan.keyElements.join('\n') : '无特别要求'}

### 与前一集的衔接点
${plan.connectionPoints.fromPrevious.length > 0 ? plan.connectionPoints.fromPrevious.join('\n') : '无'}

### 与后一集的衔接点
${plan.connectionPoints.toNext.length > 0 ? plan.connectionPoints.toNext.join('\n') : '无'}

## 连贯性上下文

### 前情摘要
${coherenceContext.previousSummary || '无'}

### 角色当前状态
${coherenceContext.characterStates.length > 0 
  ? coherenceContext.characterStates.map(c => `- ${c.name}: ${c.condition || '状态正常'}`).join('\n') 
  : '无角色状态信息'}

### 活跃伏笔
${coherenceContext.activeForeshadowings.length > 0 
  ? coherenceContext.activeForeshadowings.slice(0, 5).map(f => `- ${f.content}`).join('\n') 
  : '无活跃伏笔'}

${prevEpisodes ? `## 前面已改写的集数\n\n${prevEpisodes}\n` : ''}

## 第${episodeNumber}集原始内容

${originalContent}

## 改写要求

1. 严格按照改写计划执行
2. 确保与前面已改写的集数自然衔接
3. 保留标记的关键元素
4. 维护角色状态的一致性
5. 正确处理伏笔的埋设或回收
6. 保持剧本格式规范

## 输出要求
直接输出改写后的完整第${episodeNumber}集剧本，不要添加任何解释或说明。`;
}
