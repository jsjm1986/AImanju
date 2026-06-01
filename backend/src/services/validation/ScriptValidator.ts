import { AIClient, aiClient } from '../ai/AIClient';
import { episodeRepository } from '../../repositories/EpisodeRepository';
import { characterRepository } from '../../repositories/CharacterRepository';
import { projectRepository } from '../../repositories/ProjectRepository';

export const VALIDATION_CONFIG = {
  windowSize: 10,
  stepSize: 5,
  maxTokens: 20480,
};

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, suggestion: 2 };
const SEVERITY_PENALTY: Record<string, number> = { critical: 1.5, warning: 0.5, suggestion: 0.1 };
const RATING_THRESHOLDS: [number, string][] = [
  [90, '优秀'], [80, '良好'], [70, '一般'], [60, '需改进'],
];

export type IssueSeverity = 'critical' | 'warning' | 'suggestion';

export type IssueType =
  | 'logic'        // 逻辑漏洞
  | 'character'    // 角色矛盾
  | 'timeline'     // 时间线错误
  | 'unresolved'   // 悬念未收
  | 'setting'      // 设定冲突
  | 'continuity'   // 剧情不连贯
  | 'relationship' // 关系问题
  | 'pacing'       // 节奏问题
  | 'dialogue';    // 对话问题

export interface ValidationIssue {
  severity: IssueSeverity;
  type: IssueType;
  episode: number;
  location: string;
  description: string;
  evidence?: string;
  suggestion: string;
  windowIndex?: number;
  windowRange?: string;
  isGlobal?: boolean;
}

interface ValidationWindow {
  index: number | string;
  startEp: number;
  endEp: number;
  startIndex: number;
  endIndex: number;
}

interface WindowValidationResult {
  success: boolean;
  issues: ValidationIssue[];
  summary: string;
  error?: string;
}

export type ValidationProgressCallback = (progress: {
  type: string;
  windowIndex?: number | string;
  totalWindows?: number;
  windowStart?: number;
  windowEnd?: number;
  message: string;
}) => void;

export interface ValidationReport {
  score: number;
  rating: string;
  totalIssues: number;
  summary: {
    critical: number;
    warning: number;
    suggestion: number;
  };
  issues: ValidationIssue[];
  generatedAt: string;
}

interface CharacterWithState {
  name: string;
  role?: string;
  identity?: string;
  personality?: string;
  state?: {
    currentState?: {
      abilities?: string[];
      equipment?: string[];
    };
    appearances?: number[];
  };
}

const VALIDATION_PROMPT = `你是一位专业的剧本审核专家，负责检测剧本中的各类问题。

## 你的任务
仔细阅读提供的剧本内容，检测以下类型的问题：

### 🔴 严重问题（critical）- 必须修复
1. **逻辑漏洞(logic)**：情节发展违反因果逻辑，不合理的事件发展
2. **角色矛盾(character)**：角色行为/能力/性格与角色设定或前文明显矛盾
3. **时间线错误(timeline)**：时间顺序混乱、时间跳跃不合理
4. **悬念未收(unresolved)**：剧情中提出的问题/悬念/冲突在当前窗口内开启但未得到任何推进或解答
   - 角色宣称要做某事但后续无任何行动
   - 发现重要物品/线索但完全被遗忘
   - 开启的支线剧情突然消失
   - 角色提出的疑问从未被回应

### 🟡 一般问题（warning）- 建议修复
5. **设定冲突(setting)**：与世界观或规则设定矛盾
6. **剧情不连贯(continuity)**：场景/情节衔接不自然，缺少过渡
7. **关系问题(relationship)**：人物关系发展不合理、互动违和

### 🟢 优化建议（suggestion）
8. **节奏问题(pacing)**：情节拖沓或过于仓促，高潮安排不当
9. **对话问题(dialogue)**：对话不符合人设、信息重复、表达生硬

## 检测原则
- 只报告明确的问题，不要过度挑剔
- 每个问题必须给出具体位置和原文证据
- 给出可操作的修改建议
- 特别注意：检测"有头无尾"的剧情线索
- 如果没有发现问题，issues数组为空即可

## ⚠️ 输出长度限制
- evidence 字段：最多30个字，只需关键词或短语，不要完整引用
- description 字段：最多50个字，简明扼要
- suggestion 字段：最多50个字，给出核心建议
- 每个窗口最多报告8个最重要的问题

## 输出格式
请严格按照以下JSON格式输出，不要有其他内容：
{
  "issues": [
    {
      "severity": "critical|warning|suggestion",
      "type": "logic|character|timeline|unresolved|setting|continuity|relationship|pacing|dialogue",
      "episode": 15,
      "location": "具体位置描述，如：第15集中段，某某与某某对话时",
      "description": "问题的清晰描述（最多50字）",
      "evidence": "关键词或短语（最多30字）",
      "suggestion": "核心修改建议（最多50字）"
    }
  ],
  "summary": "本检测窗口的整体质量评估（1-2句话）"
}`;

export class ScriptValidator {
  private projectId: string;
  private aiClient: AIClient;
  private projectName: string = '';
  private characters: CharacterWithState[] = [];
  private episodes: Array<{ _id: string; episodeNumber: number; content: string }> = [];
  private allIssues: ValidationIssue[] = [];

  constructor(projectId: string) {
    this.projectId = projectId;
    this.aiClient = aiClient;
  }

  async initialize(): Promise<{ projectName: string; totalEpisodes: number; characterCount: number }> {
    const project = await projectRepository.findById(this.projectId);
    if (!project) {
      throw new Error('项目不存在');
    }
    this.projectName = project.name;

    const characters = await characterRepository.findByProject(this.projectId);
    this.characters = characters.map(c => ({
      name: c.name,
      role: (c as any).role,
      identity: c.identity,
      personality: c.personality,
      state: (c as any).state,
    }));

    const episodes = await episodeRepository.findByProject(this.projectId);
    this.episodes = episodes
      .filter(e => e.content && e.content.length > 0)
      .map(e => ({
        _id: e._id.toString(),
        episodeNumber: e.episodeNumber,
        content: e.content || '',
      }))
      .sort((a, b) => a.episodeNumber - b.episodeNumber);

    if (this.episodes.length === 0) {
      throw new Error('项目没有已生成的剧本');
    }

    return {
      projectName: this.projectName,
      totalEpisodes: this.episodes.length,
      characterCount: this.characters.length,
    };
  }

  calculateWindows(): ValidationWindow[] {
    const { windowSize, stepSize } = VALIDATION_CONFIG;
    const totalEpisodes = this.episodes.length;
    const windows: ValidationWindow[] = [];

    for (let start = 0; start < totalEpisodes; start += stepSize) {
      const end = Math.min(start + windowSize, totalEpisodes);
      windows.push({
        index: windows.length + 1,
        startEp: this.episodes[start].episodeNumber,
        endEp: this.episodes[end - 1].episodeNumber,
        startIndex: start,
        endIndex: end,
      });

      if (end >= totalEpisodes) break;
    }

    return windows;
  }

  private buildCharacterSummary(): string {
    if (this.characters.length === 0) return '无角色信息';

    return this.characters
      .map(char => {
        const state = char.state?.currentState || {};
        const fields: [string, string | undefined][] = [
          ['定位', char.role],
          ['性格', char.personality],
          ['身份', char.identity],
          ['能力', state.abilities?.join('、')],
          ['装备', state.equipment?.join('、')],
        ];
        const parts = fields
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}：${v}`);
        return [`【${char.name}】`, ...parts].join('，');
      })
      .join('\n');
  }

  private buildWindowContent(window: ValidationWindow): string {
    return this.episodes
      .slice(window.startIndex, window.endIndex)
      .map(ep => `===== 第${ep.episodeNumber}集 =====\n${ep.content || '（内容为空）'}`)
      .join('\n\n');
  }

  async validateWindow(
    window: ValidationWindow,
    onProgress?: ValidationProgressCallback
  ): Promise<WindowValidationResult> {
    const characterSummary = this.buildCharacterSummary();
    const scriptContent = this.buildWindowContent(window);

    const userMessage = `## 项目信息
- 项目名称：${this.projectName}
- 检测范围：第${window.startEp}集 - 第${window.endEp}集

## 角色设定
${characterSummary}

## 剧本内容
${scriptContent}

请检测以上剧本内容中的问题。`;

    onProgress?.({
      type: 'window_progress',
      windowIndex: window.index,
      message: '正在调用AI分析...',
    });

    try {
      const response = await this.aiClient.generate(
        VALIDATION_PROMPT,
        userMessage,
        VALIDATION_CONFIG.maxTokens
      );

      return this.parseValidationResponse(response, window);
    } catch (error) {
      console.error(`[Validator] 窗口${window.index}验证失败:`, error);
      return {
        success: false,
        issues: [],
        summary: `窗口验证失败: ${(error as Error).message}`,
        error: (error as Error).message,
      };
    }
  }

  private parseValidationResponse(
    response: string,
    window: ValidationWindow
  ): WindowValidationResult {
    try {
      let jsonStr = response
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      let parsed;
      try {
        jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
        parsed = JSON.parse(jsonStr);
      } catch {
        console.warn('[Validator] JSON解析失败，尝试修复...');
        parsed = this.tryRepairJson(jsonStr);
      }

      const issues: ValidationIssue[] = (parsed.issues || []).map(
        (issue: ValidationIssue) => ({
          ...issue,
          windowIndex: window.index,
          windowRange: `${window.startEp}-${window.endEp}`,
        })
      );

      return { success: true, issues, summary: parsed.summary || '检测完成' };
    } catch (error) {
      console.error('[Validator] 解析验证结果失败:', error);
      console.error('[Validator] 原始响应前200字符:', response?.substring(0, 200));
      return {
        success: false,
        issues: [],
        summary: '解析失败',
        error: (error as Error).message,
      };
    }
  }

  private tryRepairJson(jsonStr: string): { issues: ValidationIssue[]; summary: string } {
    const issues: ValidationIssue[] = [];

    const patterns = [
      /\{\s*"severity"\s*:\s*"(critical|warning|suggestion)"[\s\S]*?"suggestion"\s*:\s*"[^"]*"\s*\}/g,
      /\{\s*"severity"\s*:\s*"(critical|warning|suggestion)"[\s\S]*?"evidence"\s*:\s*"[^"]*"\s*\}/g,
      /\{\s*"severity"\s*:\s*"(critical|warning|suggestion)"[\s\S]*?"description"\s*:\s*"[^"]*"\s*\}/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(jsonStr)) !== null) {
        try {
          const issueObj = JSON.parse(match[0]) as ValidationIssue;
          if (!issues.some(i => i.description === issueObj.description && i.episode === issueObj.episode)) {
            issues.push(issueObj);
          }
        } catch {
          // skip unparseable match
        }
      }
    }

    if (issues.length > 0) {
      console.log(`[Validator] 成功从截断JSON中提取 ${issues.length} 个问题`);
      return { issues, summary: '部分解析成功（JSON被截断）' };
    }

    let repaired = jsonStr;
    const lastCompleteObj = repaired.lastIndexOf('}');
    if (lastCompleteObj > 0) {
      repaired = repaired.substring(0, lastCompleteObj + 1);
    }

    const countChar = (s: string, ch: string): number => (s.match(new RegExp(`\\${ch}`, 'g')) || []).length;
    repaired += ']'.repeat(countChar(repaired, '[') - countChar(repaired, ']'));
    repaired += '}'.repeat(countChar(repaired, '{') - countChar(repaired, '}'));

    try {
      return JSON.parse(repaired);
    } catch {
      console.warn('[Validator] JSON修复失败');
      return { issues: [], summary: 'JSON解析失败' };
    }
  }

  async globalCrossValidation(onProgress?: ValidationProgressCallback): Promise<WindowValidationResult> {
    onProgress?.({ type: 'global_check_start', message: '正在进行全局交叉验证...' });

    const issuesSummary = this.allIssues
      .map(issue => `第${issue.episode || '?'}集: ${issue.type} - ${issue.description}`)
      .join('\n');

    const characterAppearances = this.characters
      .map(char => {
        const appearances = char.state?.appearances || [];
        return `${char.name}: 出场${appearances.length}次 [${appearances.slice(0, 10).join(',')}${appearances.length > 10 ? '...' : ''}]`;
      })
      .join('\n');

    const lastEpNumber = this.episodes[this.episodes.length - 1].episodeNumber;

    const userMessage = `## 全局交叉验证任务

请基于以下信息，检测是否存在跨集的全局性问题：

### 项目基本信息
- 项目：${this.projectName}
- 总集数：${this.episodes.length}集
- 角色数：${this.characters.length}个

### 角色出场统计
${characterAppearances || '无数据'}

### 已发现的局部问题
${issuesSummary || '暂无'}

### 需要检测的全局问题
1. 主要角色是否有长时间消失后突然出现的情况
2. 是否有前后矛盾的剧情线
3. 角色成长/变化是否有断层
4. 整体剧情节奏是否合理

请输出JSON格式的检测结果。`;

    try {
      const response = await this.aiClient.generate(
        VALIDATION_PROMPT,
        userMessage,
        VALIDATION_CONFIG.maxTokens
      );

      const window: ValidationWindow = {
        index: 'global',
        startEp: 1,
        endEp: lastEpNumber,
        startIndex: 0,
        endIndex: this.episodes.length,
      };

      const result = this.parseValidationResponse(response, window);
      result.issues = result.issues.map(issue => ({
        ...issue,
        isGlobal: true,
        windowRange: '全局',
      }));

      return result;
    } catch (error) {
      console.error('[Validator] 全局验证失败:', error);
      return { success: false, issues: [], summary: '全局验证失败', error: (error as Error).message };
    }
  }

  private collectIssues(result: WindowValidationResult): void {
    if (result.success && result.issues.length > 0) {
      this.allIssues.push(...result.issues);
    }
  }

  private deduplicateIssues(issues: ValidationIssue[]): ValidationIssue[] {
    const seen = new Set<string>();
    const unique = issues.filter(issue => {
      const key = `${issue.episode}-${issue.type}-${issue.description?.substring(0, 50)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    unique.sort((a, b) => {
      const severityDiff = (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3);
      return severityDiff !== 0 ? severityDiff : (a.episode || 0) - (b.episode || 0);
    });

    return unique;
  }

  generateReport(): ValidationReport {
    const issues = this.deduplicateIssues(this.allIssues);

    const countBySeverity = (s: IssueSeverity): number => issues.filter(i => i.severity === s).length;
    const summary = {
      critical: countBySeverity('critical'),
      warning: countBySeverity('warning'),
      suggestion: countBySeverity('suggestion'),
    };

    const score = Math.max(0, Math.min(100, Math.round(
      100 - Object.entries(summary).reduce(
        (acc, [sev, count]) => acc + count * (SEVERITY_PENALTY[sev] || 0), 0
      )
    )));

    const rating = RATING_THRESHOLDS.find(([threshold]) => score >= threshold)?.[1] ?? '问题较多';

    return {
      score,
      rating,
      totalIssues: issues.length,
      summary,
      issues,
      generatedAt: new Date().toISOString(),
    };
  }

  async validateAll(onProgress?: ValidationProgressCallback): Promise<{
    success: boolean;
    report: ValidationReport;
    windowResults: WindowValidationResult[];
    summary: string;
  }> {
    const windows = this.calculateWindows();
    this.allIssues = [];
    const windowResults: WindowValidationResult[] = [];

    onProgress?.({
      type: 'start',
      totalWindows: windows.length,
      message: `开始验证，共${windows.length}个窗口`,
    });

    for (const window of windows) {
      onProgress?.({
        type: 'window_start',
        windowIndex: window.index,
        totalWindows: windows.length,
        windowStart: window.startEp,
        windowEnd: window.endEp,
        message: `验证窗口${window.index}/${windows.length} (第${window.startEp}-${window.endEp}集)`,
      });

      const result = await this.validateWindow(window, onProgress);
      windowResults.push(result);
      this.collectIssues(result);

      if (typeof window.index === 'number' && window.index < windows.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    onProgress?.({ type: 'global_start', message: '开始全局交叉验证...' });

    const globalResult = await this.globalCrossValidation(onProgress);
    windowResults.push(globalResult);
    this.collectIssues(globalResult);

    const report = this.generateReport();
    const summary = `验证完成：评分 ${report.score}分（${report.rating}），发现 ${report.summary.critical} 个严重问题，${report.summary.warning} 个一般问题，${report.summary.suggestion} 个优化建议`;

    onProgress?.({ type: 'complete', message: summary });

    return { success: true, report, windowResults, summary };
  }

  async validateRange(
    startEpisode: number,
    endEpisode: number,
    onProgress?: ValidationProgressCallback
  ): Promise<WindowValidationResult> {
    const filteredEpisodes = this.episodes.filter(
      e => e.episodeNumber >= startEpisode && e.episodeNumber <= endEpisode
    );

    if (filteredEpisodes.length === 0) {
      return { success: false, issues: [], summary: '指定范围内没有剧本', error: '范围无效' };
    }

    const window: ValidationWindow = {
      index: 1,
      startEp: startEpisode,
      endEp: endEpisode,
      startIndex: 0,
      endIndex: filteredEpisodes.length,
    };

    const originalEpisodes = this.episodes;
    this.episodes = filteredEpisodes;
    const result = await this.validateWindow(window, onProgress);
    this.episodes = originalEpisodes;

    return result;
  }
}
