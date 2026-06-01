import { AIClient, aiClient } from '../ai/AIClient';

export interface EnhanceContext {
  originalPlan: string;
  episodeNumber: number;
  characterConstraints: string[];
  overdueForeShadowings: string[];
  warningForeshadowings: string[];
  previousCliffhanger: string | null;
  rhythmConstraints: string[];
  recentEvents: string[];
}

export interface EnhancedPlan {
  enhancedPlan: string;
  integratedElements: string[];
  hasSignificantChanges: boolean;
}

export class EpisodePlanEnhancer {
  private aiClient: AIClient;

  constructor() {
    this.aiClient = aiClient;
  }

  async enhance(context: EnhanceContext): Promise<EnhancedPlan> {
    const prompt = this.buildPrompt(context);

    try {
      console.log(`[EpisodePlanEnhancer] 开始调整第${context.episodeNumber}集梗概...`);

      const response = await this.aiClient.generate('', prompt, 2000);
      const result = this.parseResponse(response, context.originalPlan);

      console.log(`[EpisodePlanEnhancer] 梗概调整完成`);
      console.log(`  - 原始: ${context.originalPlan.slice(0, 50)}...`);
      console.log(`  - 调整后: ${result.enhancedPlan.slice(0, 50)}...`);
      console.log(`  - 融合元素: ${result.integratedElements.length}个`);

      return result;
    } catch (error) {
      console.error('[EpisodePlanEnhancer] 调整失败，使用原始梗概:', error);
      return this.fallbackPlan(context.originalPlan);
    }
  }

  private buildPrompt(context: EnhanceContext): string {
    const sections: string[] = [];

    sections.push(`你是剧本梗概优化专家。请根据当前上下文，智能调整第${context.episodeNumber}集的梗概。`);
    sections.push('');
    sections.push('## 原始梗概');
    sections.push(context.originalPlan);

    const mustIntegrate: string[] = [];
    if (context.previousCliffhanger) {
      mustIntegrate.push(`【承接悬念】${context.previousCliffhanger}`);
    }
    mustIntegrate.push(...context.overdueForeShadowings.map(f => `【必须回收伏笔】${f}`));

    if (mustIntegrate.length > 0) {
      sections.push('', '## 必须融合的元素（不可忽略）');
      mustIntegrate.forEach(item => sections.push(`- ${item}`));
    }

    const suggestIntegrate = [
      ...context.warningForeshadowings.map(f => `【建议回收伏笔】${f}`),
      ...context.rhythmConstraints.map(r => `【节奏建议】${r}`),
    ];

    if (suggestIntegrate.length > 0) {
      sections.push('', '## 建议融合的元素（尽量包含）');
      suggestIntegrate.forEach(item => sections.push(`- ${item}`));
    }

    if (context.characterConstraints.length > 0) {
      sections.push('', '## 角色状态约束（剧情需体现）');
      context.characterConstraints.forEach(c => sections.push(`- ${c}`));
    }

    if (context.recentEvents.length > 0) {
      sections.push('', '## 近期剧情（保持连贯）');
      context.recentEvents.slice(-3).forEach(e => sections.push(`- ${e}`));
    }

    sections.push('');
    sections.push('## 输出要求');
    sections.push('');
    sections.push('请输出严格的 JSON 格式。注意：');
    sections.push('- 字符串中的双引号必须转义为 \\"');
    sections.push('- 字符串中不能有换行，如需换行请用 \\n');
    sections.push('- 不要在 JSON 外添加任何说明文字');
    sections.push('');
    sections.push('```json');
    sections.push('{');
    sections.push('  "enhancedPlan": "调整后的梗概（150-250字，自然融合上述元素，不要包含换行）",');
    sections.push('  "integratedElements": ["已融合的元素1", "已融合的元素2"],');
    sections.push('  "hasSignificantChanges": true');
    sections.push('}');
    sections.push('```');
    sections.push('');
    sections.push('注意：');
    sections.push('1. 保留原始梗概的核心剧情走向');
    sections.push('2. 自然融合必须元素，不要生硬堆砌');
    sections.push('3. 如果原始梗概已包含相关元素，无需重复');
    sections.push('4. 调整后的梗概应该是连贯的叙述，不是列表');
    sections.push('5. enhancedPlan 必须是单行文本，不要包含换行符');
    sections.push('6. 如果梗概中包含对话，请务必使用单引号（\'）包裹对话内容，避免使用双引号破坏 JSON 结构');

    return sections.join('\n');
  }

  private parseResponse(response: string, fallback: string): EnhancedPlan {
    const jsonStr = this.extractJsonString(response);

    try {
      const parsed = JSON.parse(jsonStr);
      return this.toPlan(parsed, fallback);
    } catch {
      console.log('[EpisodePlanEnhancer] 第一次 JSON 解析失败，尝试修复...');
    }

    try {
      const fixedJson = this.fixJsonString(jsonStr);
      const parsed = JSON.parse(fixedJson);
      return this.toPlan(parsed, fallback);
    } catch {
      console.log('[EpisodePlanEnhancer] 修复后仍解析失败，尝试正则提取...');
    }

    const contextMatch = response.match(/"enhancedPlan"\s*:\s*"([\s\S]*?)"\s*,\s*"integratedElements"/);
    if (contextMatch) {
      console.log('[EpisodePlanEnhancer] 使用结构感知正则提取成功');
      return {
        enhancedPlan: this.unescapeString(contextMatch[1]),
        integratedElements: this.extractIntegratedElements(response),
        hasSignificantChanges: true,
      };
    }

    const strictMatch = response.match(/"enhancedPlan"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (strictMatch) {
      console.log('[EpisodePlanEnhancer] 使用严格正则提取成功');
      return {
        enhancedPlan: this.unescapeString(strictMatch[1]),
        integratedElements: this.extractIntegratedElements(response),
        hasSignificantChanges: true,
      };
    }

    if (!response.includes('{') && response.length > 50) {
      console.log('[EpisodePlanEnhancer] AI 输出非 JSON 格式，使用原始响应作为梗概');
      const cleaned = response
        .replace(/```[\s\S]*?```/g, '')
        .replace(/^#+\s+.*/gm, '')
        .trim();
      if (cleaned.length > 50) {
        return { enhancedPlan: cleaned, integratedElements: [], hasSignificantChanges: true };
      }
    }

    console.error('[EpisodePlanEnhancer] 所有解析方法都失败，使用原始梗概');
    console.error('[EpisodePlanEnhancer] AI 响应前 500 字符:', response.substring(0, 500));
    return this.fallbackPlan(fallback);
  }

  private extractJsonString(response: string): string {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) return jsonMatch[1];

    const objMatch = response.match(/\{[\s\S]*\}/);
    if (objMatch) return objMatch[0];

    return response;
  }

  private toPlan(parsed: Record<string, unknown>, fallback: string): EnhancedPlan {
    return {
      enhancedPlan: (parsed.enhancedPlan as string) || fallback,
      integratedElements: (parsed.integratedElements as string[]) || [],
      hasSignificantChanges: (parsed.hasSignificantChanges as boolean) || false,
    };
  }

  private fallbackPlan(fallback: string): EnhancedPlan {
    return { enhancedPlan: fallback, integratedElements: [], hasSignificantChanges: false };
  }

  private unescapeString(s: string): string {
    return s.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
  }

  private extractIntegratedElements(response: string): string[] {
    const match = response.match(/"integratedElements"\s*:\s*\[([\s\S]*?)\]/);
    if (!match) return [];
    try {
      return JSON.parse(`[${match[1]}]`);
    } catch {
      return [];
    }
  }

  private fixJsonString(jsonStr: string): string {
    let fixed = jsonStr.replace(/^\uFEFF/, '').trim();
    fixed = fixed.replace(/,\s*([}\]])/g, '$1');
    fixed = fixed.replace(/"([^"]*)\n([^"]*)"/g, (_match, p1, p2) => `"${p1}\\n${p2}"`);
    fixed = this.fixUnescapedQuotesInValues(fixed);
    return fixed;
  }

  private fixUnescapedQuotesInValues(jsonStr: string): string {
    let result = '';
    let i = 0;
    let inString = false;
    let afterColon = false;

    while (i < jsonStr.length) {
      const char = jsonStr[i];
      const prevChar = i > 0 ? jsonStr[i - 1] : '';

      if (char === '"' && prevChar !== '\\') {
        if (!inString) {
          inString = true;
        } else {
          inString = false;
          afterColon = false;
        }
      } else if (char === ':' && !inString) {
        afterColon = true;
      } else if ((char === ',' || char === '}' || char === ']') && !inString) {
        afterColon = false;
      }

      result += char;
      i++;
    }

    return result;
  }
}
