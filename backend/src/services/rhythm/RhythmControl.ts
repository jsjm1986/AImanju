import { GenreType, AttentionHeadType } from '../attention/AttentionModules';

export type PowerUpSpeed = 'slow' | 'medium' | 'fast' | 'godlike';
export type EquipmentDropRate = 'rare' | 'normal' | 'frequent';
export type SuspenseIntensity = 'weak' | 'medium' | 'strong' | 'extreme';
export type RomanceSpeed = 'none' | 'slow' | 'normal' | 'fast' | 'instant';
export type HeartacheLevel = 'none' | 'light' | 'medium' | 'heavy' | 'be';
export type VillainIQ = 'fodder' | 'normal' | 'smart' | 'genius';
export type PressureCurve = 'easy' | 'normal' | 'hard' | 'extreme';

export interface IRhythmControlParams {
  faceSlappingFrequency: number;
  coolPointDensity: number;
  powerUpSpeed: PowerUpSpeed;
  equipmentDropRate: EquipmentDropRate;
  plotTwistFrequency: number;
  suspenseIntensity: SuspenseIntensity;
  romanceSpeed: RomanceSpeed;
  heartacheLevel: HeartacheLevel;
  villainIQ: VillainIQ;
  pressureCurve: PressureCurve;
  bossInterval: number;
  enabledModules: string[];
  enabledStyleHeads: AttentionHeadType[];
}

export const DEFAULT_RHYTHM_PARAMS: IRhythmControlParams = {
  faceSlappingFrequency: 3,
  coolPointDensity: 2,
  powerUpSpeed: 'medium',
  equipmentDropRate: 'normal',
  plotTwistFrequency: 15,
  suspenseIntensity: 'medium',
  romanceSpeed: 'normal',
  heartacheLevel: 'light',
  villainIQ: 'normal',
  pressureCurve: 'normal',
  bossInterval: 20,
  enabledModules: [],
  enabledStyleHeads: [],
};

export type RhythmPresetType =
  | 'extreme-cool'      // 极致爽文
  | 'hot-blood'         // 热血对决
  | 'brain-burn'        // 烧脑悬疑
  | 'horror-thriller'   // 惊悚恐怖
  | 'sweet-romance'     // 甜宠言情
  | 'system-flow'       // 系统流爽文
  | 'mind-game'         // 智斗谋略
  | 'custom';           // 自定义

export interface IRhythmPreset {
  type: RhythmPresetType;
  name: string;
  description: string;
  icon: string;
  params: Partial<IRhythmControlParams>;
  recommendedGenres: GenreType[];
  enabledModules: string[];
  enabledStyleHeads: AttentionHeadType[];
}

export const RHYTHM_PRESETS: Record<RhythmPresetType, IRhythmPreset> = {
  'extreme-cool': {
    type: 'extreme-cool',
    name: '极致爽文',
    description: '高打脸、快升级、弱反派，无脑爽',
    icon: '🔥',
    params: {
      faceSlappingFrequency: 1,
      coolPointDensity: 4,
      powerUpSpeed: 'godlike',
      equipmentDropRate: 'frequent',
      plotTwistFrequency: 20,
      suspenseIntensity: 'weak',
      romanceSpeed: 'fast',
      heartacheLevel: 'none',
      villainIQ: 'fodder',
      pressureCurve: 'easy',
      bossInterval: 10,
    },
    recommendedGenres: ['dushi', 'xuanhuan'],
    enabledModules: ['cool'],
    enabledStyleHeads: ['style-pacing'],
  },

  'hot-blood': {
    type: 'hot-blood',
    name: '热血对决',
    description: '中打脸、稳升级、聪明反派，有来有回',
    icon: '⚔️',
    params: {
      faceSlappingFrequency: 3,
      coolPointDensity: 2,
      powerUpSpeed: 'medium',
      equipmentDropRate: 'normal',
      plotTwistFrequency: 15,
      suspenseIntensity: 'medium',
      romanceSpeed: 'slow',
      heartacheLevel: 'light',
      villainIQ: 'smart',
      pressureCurve: 'normal',
      bossInterval: 20,
    },
    recommendedGenres: ['xuanhuan', 'xitong'],
    enabledModules: ['game', 'cool'],
    enabledStyleHeads: ['style-pacing', 'style-emotions'],
  },

  'brain-burn': {
    type: 'brain-burn',
    name: '烧脑悬疑',
    description: '低打脸、高反转、高智商反派',
    icon: '🔍',
    params: {
      faceSlappingFrequency: 10,
      coolPointDensity: 1,
      powerUpSpeed: 'slow',
      equipmentDropRate: 'rare',
      plotTwistFrequency: 8,
      suspenseIntensity: 'extreme',
      romanceSpeed: 'slow',
      heartacheLevel: 'medium',
      villainIQ: 'genius',
      pressureCurve: 'hard',
      bossInterval: 30,
    },
    recommendedGenres: ['xuanyi'],
    enabledModules: ['mystery'],
    enabledStyleHeads: [],
  },

  'horror-thriller': {
    type: 'horror-thriller',
    name: '惊悚恐怖',
    description: '低爽点、极强悬念、绝境求生',
    icon: '😱',
    params: {
      faceSlappingFrequency: 15,
      coolPointDensity: 1,
      powerUpSpeed: 'slow',
      equipmentDropRate: 'rare',
      plotTwistFrequency: 10,
      suspenseIntensity: 'extreme',
      romanceSpeed: 'none',
      heartacheLevel: 'heavy',
      villainIQ: 'smart',
      pressureCurve: 'extreme',
      bossInterval: 15,
    },
    recommendedGenres: ['kongbu'],
    enabledModules: ['horror'],
    enabledStyleHeads: [],
  },

  'sweet-romance': {
    type: 'sweet-romance',
    name: '甜宠言情',
    description: '无打脸、快感情、轻冲突',
    icon: '💕',
    params: {
      faceSlappingFrequency: 20,
      coolPointDensity: 1,
      powerUpSpeed: 'slow',
      equipmentDropRate: 'normal',
      plotTwistFrequency: 25,
      suspenseIntensity: 'weak',
      romanceSpeed: 'fast',
      heartacheLevel: 'none',
      villainIQ: 'normal',
      pressureCurve: 'easy',
      bossInterval: 40,
    },
    recommendedGenres: ['yanqing'],
    enabledModules: [],
    enabledStyleHeads: ['style-emotions'],
  },

  'system-flow': {
    type: 'system-flow',
    name: '系统流爽文',
    description: '中打脸、快升级、频繁装备、游戏化',
    icon: '🎮',
    params: {
      faceSlappingFrequency: 2,
      coolPointDensity: 3,
      powerUpSpeed: 'fast',
      equipmentDropRate: 'frequent',
      plotTwistFrequency: 15,
      suspenseIntensity: 'medium',
      romanceSpeed: 'normal',
      heartacheLevel: 'light',
      villainIQ: 'normal',
      pressureCurve: 'normal',
      bossInterval: 15,
    },
    recommendedGenres: ['xitong', 'xuanhuan'],
    enabledModules: ['game', 'cool'],
    enabledStyleHeads: ['style-pacing'],
  },

  'mind-game': {
    type: 'mind-game',
    name: '智斗谋略',
    description: '高反转、高智商反派、策略对弈',
    icon: '🧠',
    params: {
      faceSlappingFrequency: 5,
      coolPointDensity: 2,
      powerUpSpeed: 'slow',
      equipmentDropRate: 'rare',
      plotTwistFrequency: 5,
      suspenseIntensity: 'strong',
      romanceSpeed: 'slow',
      heartacheLevel: 'medium',
      villainIQ: 'genius',
      pressureCurve: 'hard',
      bossInterval: 25,
    },
    recommendedGenres: ['zhidou'],
    enabledModules: ['mind'],
    enabledStyleHeads: [],
  },

  custom: {
    type: 'custom',
    name: '自定义',
    description: '用户手动配置所有参数',
    icon: '⚙️',
    params: {},
    recommendedGenres: [],
    enabledModules: [],
    enabledStyleHeads: [],
  },
};

export interface RhythmConstraintResult {
  verifiableConstraints: string[];
  guidanceConstraints: string[];
}

type UrgencyResult = { should: boolean; urgency: 'low' | 'medium' | 'high' };

function checkUrgency(
  episodesSinceLast: number,
  interval: number,
  lowThreshold = 0.7,
): UrgencyResult {
  if (episodesSinceLast >= interval * 1.5) return { should: true, urgency: 'high' };
  if (episodesSinceLast >= interval) return { should: true, urgency: 'medium' };
  if (episodesSinceLast >= interval * lowThreshold) return { should: true, urgency: 'low' };
  return { should: false, urgency: 'low' };
}

const POWER_UP_DESCRIPTIONS: Record<PowerUpSpeed, string> = {
  slow: '主角成长缓慢，每次提升需要大量铺垫和修炼',
  medium: '主角成长稳健，遇到机缘才能提升',
  fast: '主角成长较快，战斗中常有突破',
  godlike: '主角开挂式成长，战力飙升',
};

const VILLAIN_IQ_DESCRIPTIONS: Record<VillainIQ, string> = {
  fodder: '反派智商下线，主动送人头，提供爽点',
  normal: '反派智商正常，有基本策略',
  smart: '反派聪明狡猾，会设陷阱和反击',
  genius: '反派高智商，计中计，极难对付',
};

const PRESSURE_DESCRIPTIONS: Record<PressureCurve, string> = {
  easy: '主角轻松碾压，几乎无压力',
  normal: '主角有压力但能克服，有来有回',
  hard: '主角面临较大压力，需要努力和机缘',
  extreme: '主角绝境求生，危机四伏',
};

const SUSPENSE_DESCRIPTIONS: Record<SuspenseIntensity, string> = {
  weak: '悬念较弱，剧情直白明了',
  medium: '适度悬念，保持吸引力',
  strong: '较强悬念，多处留白和谜团',
  extreme: '极强悬念，层层迷雾，处处伏笔',
};

const ROMANCE_DESCRIPTIONS: Record<RomanceSpeed, string> = {
  none: '',
  slow: '感情线慢热，暗生情愫',
  normal: '感情线正常发展',
  fast: '感情线快速升温，频繁互动',
  instant: '闪恋，一见钟情式发展',
};

const HEARTACHE_DESCRIPTIONS: Record<HeartacheLevel, string> = {
  none: '，无虐心',
  light: '，微虐怡情',
  medium: '，中度虐心',
  heavy: '，大虐特虐',
  be: '，悲剧走向',
};

export class RhythmController {
  private params: IRhythmControlParams;
  private currentPreset: RhythmPresetType;
  private currentEpisode: number;
  private lastFaceSlap: number = 0;
  private lastPlotTwist: number = 0;
  private lastBoss: number = 0;
  private coolPointsThisEpisode: number = 0;

  constructor(preset: RhythmPresetType = 'hot-blood') {
    this.currentPreset = preset;
    this.params = this.applyPreset(preset);
    this.currentEpisode = 0;
  }

  applyPreset(preset: RhythmPresetType): IRhythmControlParams {
    const presetConfig = RHYTHM_PRESETS[preset];
    return {
      ...DEFAULT_RHYTHM_PARAMS,
      ...presetConfig.params,
      enabledModules: presetConfig.enabledModules,
      enabledStyleHeads: presetConfig.enabledStyleHeads,
    };
  }

  setCurrentEpisode(episode: number): void {
    this.currentEpisode = episode;
    this.coolPointsThisEpisode = 0;
  }

  updateTracking(event: {
    faceSlapOccurred?: boolean;
    plotTwistOccurred?: boolean;
    bossEncounter?: boolean;
    coolPointCount?: number;
  }): void {
    if (event.faceSlapOccurred) this.lastFaceSlap = this.currentEpisode;
    if (event.plotTwistOccurred) this.lastPlotTwist = this.currentEpisode;
    if (event.bossEncounter) this.lastBoss = this.currentEpisode;
    if (event.coolPointCount) this.coolPointsThisEpisode += event.coolPointCount;
  }

  getParams(): IRhythmControlParams {
    return { ...this.params };
  }

  setParam<K extends keyof IRhythmControlParams>(
    key: K,
    value: IRhythmControlParams[K]
  ): void {
    this.params[key] = value;
    this.currentPreset = 'custom';
  }

  setParams(params: Partial<IRhythmControlParams>): void {
    let hasChanges = false;
    for (const [key, value] of Object.entries(params)) {
      const k = key as keyof IRhythmControlParams;
      if (JSON.stringify(this.params[k]) !== JSON.stringify(value)) {
        hasChanges = true;
        // @ts-ignore
        this.params[k] = value;
      }
    }
    if (hasChanges) this.currentPreset = 'custom';
  }

  shouldFaceSlap(): UrgencyResult {
    return checkUrgency(this.currentEpisode - this.lastFaceSlap, this.params.faceSlappingFrequency);
  }

  shouldPlotTwist(): UrgencyResult {
    return checkUrgency(this.currentEpisode - this.lastPlotTwist, this.params.plotTwistFrequency);
  }

  shouldBossAppear(): UrgencyResult {
    return checkUrgency(this.currentEpisode - this.lastBoss, this.params.bossInterval, 0.8);
  }

  checkCoolPointDensity(): {
    currentDensity: number;
    targetDensity: number;
    needMore: boolean;
  } {
    return {
      currentDensity: this.coolPointsThisEpisode,
      targetDensity: this.params.coolPointDensity,
      needMore: this.coolPointsThisEpisode < this.params.coolPointDensity,
    };
  }

  generateRhythmConstraints(): RhythmConstraintResult {
    const verifiableConstraints: string[] = [];

    const checks: Array<{
      result: UrgencyResult;
      gap: number;
      label: string;
      highMsg: string;
      mediumMsg: string;
    }> = [
      {
        result: this.shouldFaceSlap(),
        gap: this.currentEpisode - this.lastFaceSlap,
        label: '打脸',
        highMsg: '本集必须安排打脸情节',
        mediumMsg: '建议本集安排打脸情节',
      },
      {
        result: this.shouldPlotTwist(),
        gap: this.currentEpisode - this.lastPlotTwist,
        label: '反转',
        highMsg: '本集必须安排剧情反转',
        mediumMsg: '建议本集安排剧情反转',
      },
      {
        result: this.shouldBossAppear(),
        gap: this.currentEpisode - this.lastBoss,
        label: 'Boss',
        highMsg: '本集必须安排Boss级对手',
        mediumMsg: '建议本集引入强敌',
      },
    ];

    for (const { result, gap, label, highMsg, mediumMsg } of checks) {
      if (!result.should) continue;
      if (result.urgency === 'high') {
        verifiableConstraints.push(`【节奏约束-${label}】已${gap}集未${label === 'Boss' ? '遇Boss' : label}，${highMsg}`);
      } else if (result.urgency === 'medium') {
        verifiableConstraints.push(`【节奏建议-${label}】已${gap}集未${label === 'Boss' ? '遇Boss' : label}，${mediumMsg}`);
      }
    }

    const guidanceConstraints = [
      `【升级节奏】${POWER_UP_DESCRIPTIONS[this.params.powerUpSpeed]}`,
      `【反派智商】${VILLAIN_IQ_DESCRIPTIONS[this.params.villainIQ]}`,
      `【压力曲线】${PRESSURE_DESCRIPTIONS[this.params.pressureCurve]}`,
      `【悬念强度】${SUSPENSE_DESCRIPTIONS[this.params.suspenseIntensity]}`,
    ];

    if (this.params.romanceSpeed !== 'none') {
      guidanceConstraints.push(
        `【感情线】${ROMANCE_DESCRIPTIONS[this.params.romanceSpeed]}${HEARTACHE_DESCRIPTIONS[this.params.heartacheLevel]}`
      );
    }

    return { verifiableConstraints, guidanceConstraints };
  }

  /** @deprecated Use generateRhythmConstraints() instead */
  generateAllConstraints(): string[] {
    const result = this.generateRhythmConstraints();
    return [...result.verifiableConstraints, ...result.guidanceConstraints];
  }

  getCurrentPreset(): RhythmPresetType {
    return this.currentPreset;
  }

  static getAvailablePresets(): IRhythmPreset[] {
    return Object.values(RHYTHM_PRESETS);
  }

  static getRecommendedPresets(genre: GenreType): IRhythmPreset[] {
    return Object.values(RHYTHM_PRESETS).filter(
      (preset) =>
        preset.recommendedGenres.includes(genre) || preset.type === 'custom'
    );
  }

  toJSON(): {
    currentPreset: RhythmPresetType;
    params: IRhythmControlParams;
    tracking: {
      lastFaceSlap: number;
      lastPlotTwist: number;
      lastBoss: number;
    };
  } {
    return {
      currentPreset: this.currentPreset,
      params: this.params,
      tracking: {
        lastFaceSlap: this.lastFaceSlap,
        lastPlotTwist: this.lastPlotTwist,
        lastBoss: this.lastBoss,
      },
    };
  }

  static fromJSON(json: {
    currentPreset: RhythmPresetType;
    params: IRhythmControlParams;
    tracking: {
      lastFaceSlap: number;
      lastPlotTwist: number;
      lastBoss: number;
    };
  }): RhythmController {
    const controller = new RhythmController(json.currentPreset);
    controller.params = json.params;
    controller.lastFaceSlap = json.tracking.lastFaceSlap;
    controller.lastPlotTwist = json.tracking.lastPlotTwist;
    controller.lastBoss = json.tracking.lastBoss;
    return controller;
  }
}
