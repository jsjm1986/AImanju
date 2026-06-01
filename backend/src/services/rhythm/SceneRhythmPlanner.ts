/**
 * 场景节奏规划器
 * 将节奏控制粒度从"集"细化到"场景"
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import { AIClient, aiClient } from '../ai/AIClient';

/**
 * 场景类型
 */
export type SceneType = 'action' | 'dialogue' | 'introspection' | 'transition';

/**
 * 节奏曲线类型
 */
export type RhythmCurve = 'rising' | 'falling' | 'wave' | 'plateau';

/**
 * 场景时长
 */
export type SceneDuration = 'short' | 'medium' | 'long';

/**
 * 单个场景规划
 */
export interface IScenePlan {
  sceneNumber: number;
  type: SceneType;
  intensity: number;            // 0-1
  duration: SceneDuration;
  purpose: string;
}

/**
 * 场景节奏规划结果
 */
export interface ISceneRhythmPlan {
  scenes: IScenePlan[];
  rhythmCurve: RhythmCurve;
  peakPosition: number;         // 高潮位置 (0-1)
  overallIntensity: number;     // 整体强度 (0-1)
}

/**
 * 场景节奏规划提示词
 */
const SCENE_RHYTHM_PROMPT = `你是一个专业的剧本节奏规划师。根据本集梗概，规划场景节奏。

请分析梗概内容，输出JSON格式的场景节奏规划：

{
  "scenes": [
    {
      "sceneNumber": 1,
      "type": "dialogue|action|introspection|transition",
      "intensity": 0.3,
      "duration": "short|medium|long",
      "purpose": "场景目的简述"
    }
  ],
  "rhythmCurve": "rising|falling|wave|plateau",
  "peakPosition": 0.7,
  "overallIntensity": 0.6
}

场景类型说明：
- action: 动作/战斗场景，节奏紧张
- dialogue: 对话场景，推进剧情或展示人物
- introspection: 内心独白/回忆场景，节奏舒缓
- transition: 过渡场景，连接前后

节奏曲线说明：
- rising: 逐渐升温，适合铺垫型剧集
- falling: 高开低走，适合收尾型剧集
- wave: 起伏波动，适合常规剧集
- plateau: 持续高强度，适合高潮剧集

规划原则：
1. 每集3-6个场景
2. 场景类型要有变化，避免单调
3. 强度值0-1，0.3以下为舒缓，0.7以上为紧张
4. 高潮位置通常在0.6-0.8之间
5. 结尾场景应留有悬念空间`;

/**
 * 场景节奏规划器
 */
export class SceneRhythmPlanner {
  private aiClient: AIClient;

  constructor(aiClientInstance?: AIClient) {
    this.aiClient = aiClientInstance || aiClient;
  }

  /**
   * 根据梗概规划场景节奏 (Requirements 4.1)
   */
  async planScenes(episodePlan: string, episodeType?: string): Promise<ISceneRhythmPlan> {
    if (!episodePlan || episodePlan.trim().length < 10) {
      // 如果没有梗概，返回默认规划 (Requirements 4.6)
      return this.getDefaultPlan(4);
    }

    try {
      const prompt = `${SCENE_RHYTHM_PROMPT}

本集梗概：
${episodePlan}

${episodeType ? `剧集类型提示：${episodeType}` : ''}

请输出场景节奏规划JSON：`;

      const response = await this.aiClient.generate('', prompt, 2000);
      
      // 解析JSON响应
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as ISceneRhythmPlan;
        return this.validateAndNormalize(parsed);
      }
      
      console.warn('[SceneRhythmPlanner] AI响应解析失败，使用默认规划');
      return this.getDefaultPlan(4);
    } catch (error) {
      console.error('[SceneRhythmPlanner] 规划失败:', error);
      return this.getDefaultPlan(4);
    }
  }

  /**
   * 获取默认节奏规划 (Requirements 4.6)
   */
  getDefaultPlan(sceneCount: number = 4): ISceneRhythmPlan {
    const scenes: IScenePlan[] = [];
    
    // 默认节奏模板：开场 → 发展 → 高潮 → 收尾
    const defaultPatterns: Array<{ type: SceneType; intensity: number; duration: SceneDuration; purpose: string }> = [
      { type: 'dialogue', intensity: 0.3, duration: 'medium', purpose: '开场铺垫，交代背景' },
      { type: 'action', intensity: 0.5, duration: 'medium', purpose: '剧情发展，推进冲突' },
      { type: 'action', intensity: 0.8, duration: 'long', purpose: '高潮场景，核心冲突' },
      { type: 'dialogue', intensity: 0.4, duration: 'short', purpose: '收尾悬念，承接下集' },
      { type: 'introspection', intensity: 0.3, duration: 'short', purpose: '内心转变，角色成长' },
      { type: 'transition', intensity: 0.2, duration: 'short', purpose: '场景过渡，时间推进' },
    ];

    const count = Math.min(Math.max(sceneCount, 3), 6);
    for (let i = 0; i < count; i++) {
      const pattern = defaultPatterns[i % defaultPatterns.length];
      scenes.push({
        sceneNumber: i + 1,
        ...pattern,
      });
    }

    return {
      scenes,
      rhythmCurve: 'wave',
      peakPosition: 0.7,
      overallIntensity: 0.5,
    };
  }

  /**
   * 验证并规范化规划结果
   */
  private validateAndNormalize(plan: ISceneRhythmPlan): ISceneRhythmPlan {
    // 验证场景数量
    if (!plan.scenes || plan.scenes.length < 3) {
      return this.getDefaultPlan(4);
    }

    // 规范化每个场景 (Requirements 4.2, 4.3)
    const validTypes: SceneType[] = ['action', 'dialogue', 'introspection', 'transition'];
    const validDurations: SceneDuration[] = ['short', 'medium', 'long'];
    const validCurves: RhythmCurve[] = ['rising', 'falling', 'wave', 'plateau'];

    plan.scenes = plan.scenes.map((scene, index) => ({
      sceneNumber: index + 1,
      type: validTypes.includes(scene.type) ? scene.type : 'dialogue',
      intensity: Math.max(0, Math.min(1, scene.intensity || 0.5)),
      duration: validDurations.includes(scene.duration) ? scene.duration : 'medium',
      purpose: scene.purpose || `场景${index + 1}`,
    }));

    // 规范化节奏曲线 (Requirements 4.4)
    plan.rhythmCurve = validCurves.includes(plan.rhythmCurve) ? plan.rhythmCurve : 'wave';
    plan.peakPosition = Math.max(0, Math.min(1, plan.peakPosition || 0.7));
    plan.overallIntensity = Math.max(0, Math.min(1, plan.overallIntensity || 0.5));

    return plan;
  }

  /**
   * 格式化为提示词 (Requirements 4.5)
   */
  formatForPrompt(plan: ISceneRhythmPlan): string {
    const lines: string[] = [
      '【场景节奏规划】',
      '',
      `整体节奏：${this.getCurveDescription(plan.rhythmCurve)}`,
      `整体强度：${this.getIntensityDescription(plan.overallIntensity)}`,
      `高潮位置：约${Math.round(plan.peakPosition * 100)}%处`,
      '',
      '场景安排：',
    ];

    for (const scene of plan.scenes) {
      const typeDesc = this.getTypeDescription(scene.type);
      const intensityDesc = this.getIntensityDescription(scene.intensity);
      const durationDesc = this.getDurationDescription(scene.duration);
      
      lines.push(`  ${scene.sceneNumber}. [${typeDesc}] ${scene.purpose}`);
      lines.push(`     强度：${intensityDesc} | 时长：${durationDesc}`);
    }

    lines.push('');
    lines.push('请按照以上节奏规划安排场景，确保节奏变化自然流畅。');

    return lines.join('\n');
  }

  /**
   * 获取场景类型描述
   */
  private getTypeDescription(type: SceneType): string {
    const descriptions: Record<SceneType, string> = {
      action: '动作/战斗',
      dialogue: '对话/剧情',
      introspection: '内心/回忆',
      transition: '过渡/转场',
    };
    return descriptions[type] || type;
  }

  /**
   * 获取强度描述
   */
  private getIntensityDescription(intensity: number): string {
    if (intensity < 0.3) return '舒缓';
    if (intensity < 0.5) return '平稳';
    if (intensity < 0.7) return '紧凑';
    if (intensity < 0.9) return '紧张';
    return '高潮';
  }

  /**
   * 获取时长描述
   */
  private getDurationDescription(duration: SceneDuration): string {
    const descriptions: Record<SceneDuration, string> = {
      short: '简短',
      medium: '适中',
      long: '较长',
    };
    return descriptions[duration] || duration;
  }

  /**
   * 获取节奏曲线描述
   */
  private getCurveDescription(curve: RhythmCurve): string {
    const descriptions: Record<RhythmCurve, string> = {
      rising: '逐渐升温（铺垫型）',
      falling: '高开低走（收尾型）',
      wave: '起伏波动（常规型）',
      plateau: '持续高强度（高潮型）',
    };
    return descriptions[curve] || curve;
  }
}
