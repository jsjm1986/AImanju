import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { worldStateApi, attentionApi } from '@/services/api';
import type { IAttentionHeadConfig, IProjectAttentionConfig } from '@/services/api';
import type { IAttentionHead, GenreType, AttentionHeadCategory } from '@/types';

const HEAD_NAME_MAP: Record<string, string> = {
  'base-relationships': '角色关系',
  'base-conflicts': '剧情冲突',
  'base-foreshadowing': '伏笔追踪',
  'base-consistency': '世界一致性',
  'mystery-clues': '线索追踪',
  'mystery-logic': '逻辑一致性',
  'mystery-revelation': '谜底管理',
  'horror-atmosphere': '氛围营造',
  'horror-rhythm': '惊吓节奏',
  'horror-unknown': '未知管理',
  'mind-information': '信息差管理',
  'mind-strategy': '策略对弈',
  'mind-twist': '反转铺垫',
  'game-leveling': '等级系统',
  'game-equipment': '装备获取',
  'game-skills': '技能展示',
  'cool-faceslap': '打脸节奏',
  'cool-points': '爽点分布',
  'cool-villain': '反派智商',
  'style-emotions': '情感弧线',
  'style-pacing': '节奏控制',
  'style-humor': '幽默调节',
  'overseas-hook-engine': '双钩引擎',
  'overseas-function-density': '功能密度',
  'overseas-voice-redline': '声口红线',
};

const CATEGORY_NAME_MAP: Record<string, string> = {
  base: '基础',
  mystery: '悬疑',
  horror: '恐怖',
  mind: '智斗',
  game: '系统',
  cool: '爽文',
  style: '风格',
  overseas: '海外',
};

const CATEGORIES: AttentionHeadCategory[] = ['base', 'mystery', 'horror', 'mind', 'game', 'cool', 'style', 'overseas'];

function getHeadCategory(headType: string): AttentionHeadCategory {
  const prefix = headType.split('-')[0];
  return CATEGORIES.includes(prefix as AttentionHeadCategory) ? (prefix as AttentionHeadCategory) : 'base';
}

function enrichHead(head: { type: string; weight: number }): IAttentionHead {
  return {
    ...head,
    category: getHeadCategory(head.type),
    name: HEAD_NAME_MAP[head.type] || head.type,
  };
}

function groupByCategory<T extends { category?: string; type?: string }>(
  items: T[],
  getCat: (item: T) => string
): Map<AttentionHeadCategory, T[]> {
  const groups = new Map<AttentionHeadCategory, T[]>();
  CATEGORIES.forEach((cat) => groups.set(cat, []));
  items.forEach((item) => {
    const category = getCat(item) as AttentionHeadCategory;
    groups.get(category)?.push(item);
  });
  return new Map([...groups].filter(([_, list]) => list.length > 0));
}

export const useAttentionStore = defineStore('attention', () => {
  const enabledHeads = ref<IAttentionHead[]>([]);
  const currentGenre = ref<GenreType>('custom');
  const loading = ref(false);
  const error = ref<string | null>(null);
  const allHeads = ref<IAttentionHeadConfig[]>([]);
  const genreMapping = ref<Record<string, string[]>>({});
  const currentConfig = ref<IProjectAttentionConfig>({ mode: 'auto' });
  const defaultHeads = ref<string[]>([]);
  const aiRecommendation = ref<{
    recommendedHeads: string[];
    reasons: Array<{ head: string; reason: string }>;
    identifiedElements: string[];
    summary?: string;
    analyzedAt?: string;
  } | null>(null);
  const aiRecommending = ref(false);
  const effectiveHeads = ref<string[]>([]);
  const headsSource = ref<'ai' | 'custom' | 'fallback'>('fallback');

  const headsByCategory = computed(() =>
    groupByCategory(
      enabledHeads.value.map((h) => ({ ...h, category: getHeadCategory(h.type), name: HEAD_NAME_MAP[h.type] || h.type })),
      (h) => h.category
    )
  );

  const baseHeads = computed(() => enabledHeads.value.filter((h) => h.type.startsWith('base-')));
  const styleHeads = computed(() => enabledHeads.value.filter((h) => h.type.startsWith('style-')));
  const genreHeads = computed(() =>
    enabledHeads.value.filter((h) => !h.type.startsWith('base-') && !h.type.startsWith('style-'))
  );

  const headWeights = computed(() => {
    const weights = new Map<string, number>();
    enabledHeads.value.forEach((h) => weights.set(h.type, h.weight));
    return weights;
  });

  const allHeadsByCategory = computed(() => {
    const grouped: Record<string, IAttentionHeadConfig[]> = {};
    allHeads.value.forEach((head) => {
      (grouped[head.category] ||= []).push(head);
    });
    return grouped;
  });

  const currentEnabledHeads = computed(() =>
    currentConfig.value.mode === 'auto' ? defaultHeads.value : currentConfig.value.enabledHeads || defaultHeads.value
  );

  async function fetchAttentionHeads(genre?: GenreType) {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await worldStateApi.getAttentionHeads(genre);
      enabledHeads.value = data.heads.map(enrichHead);
      currentGenre.value = (data.genre as GenreType) || 'custom';
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }

  async function fetchAllHeads() {
    try {
      const { data } = await attentionApi.getAllHeads();
      allHeads.value = data.heads;
      genreMapping.value = data.genreMapping;
    } catch (e) {
      error.value = (e as Error).message;
    }
  }

  async function fetchProjectConfig(projectId: string) {
    loading.value = true;
    try {
      const { data } = await attentionApi.getConfig(projectId);
      currentConfig.value = data.config;
      defaultHeads.value = data.fallbackHeads || data.defaultHeads || [];
      currentGenre.value = data.genre as GenreType;
      effectiveHeads.value = data.effectiveHeads || defaultHeads.value;
      headsSource.value = data.headsSource || 'fallback';
      if (data.aiRecommendation) {
        aiRecommendation.value = data.aiRecommendation;
      }
    } catch (e) {
      error.value = (e as Error).message;
      currentConfig.value = { mode: 'auto' };
    } finally {
      loading.value = false;
    }
  }

  async function fetchAiRecommendation(projectId: string, forceRefresh = false) {
    aiRecommending.value = true;
    error.value = null;
    try {
      const { data } = await attentionApi.recommendHeads(projectId, forceRefresh);
      if (data.success && data.recommendation) {
        aiRecommendation.value = data.recommendation;
        if (currentConfig.value.mode === 'auto') {
          effectiveHeads.value = data.recommendation.recommendedHeads;
          headsSource.value = 'ai';
        }
        return data.recommendation;
      }
      return null;
    } catch (e) {
      error.value = (e as Error).message;
      return null;
    } finally {
      aiRecommending.value = false;
    }
  }

  async function saveProjectConfig(projectId: string): Promise<boolean> {
    loading.value = true;
    try {
      const { data } = await attentionApi.saveConfig(projectId, currentConfig.value);
      if (data.success) {
        currentConfig.value = data.config;
        return true;
      }
      return false;
    } catch (e) {
      error.value = (e as Error).message;
      return false;
    } finally {
      loading.value = false;
    }
  }

  function setAutoMode() {
    currentConfig.value = { mode: 'auto' };
  }

  function setCustomMode(enabledHeadsList?: string[]) {
    currentConfig.value = {
      mode: 'custom',
      enabledHeads: enabledHeadsList || [...defaultHeads.value],
    };
  }

  function toggleHead(headType: string) {
    if (currentConfig.value.mode !== 'custom') {
      currentConfig.value = {
        mode: 'custom',
        enabledHeads: [...defaultHeads.value],
      };
    }

    const heads = currentConfig.value.enabledHeads || [];
    const index = heads.indexOf(headType);

    if (index === -1) {
      currentConfig.value.enabledHeads = [...heads, headType];
    } else if (!headType.startsWith('base-')) {
      currentConfig.value.enabledHeads = heads.filter((h) => h !== headType);
    }
  }

  function isHeadEnabled(headType: string): boolean {
    return currentEnabledHeads.value.includes(headType);
  }

  function getHeadName(headType: string): string {
    return HEAD_NAME_MAP[headType] || headType;
  }

  function getCategoryName(category: string): string {
    return CATEGORY_NAME_MAP[category] || category;
  }

  function getHeadWeight(headType: string): number {
    return headWeights.value.get(headType) || 0;
  }

  function reset() {
    enabledHeads.value = [];
    currentGenre.value = 'custom';
    loading.value = false;
    error.value = null;
    currentConfig.value = { mode: 'auto' };
    aiRecommendation.value = null;
    effectiveHeads.value = [];
    headsSource.value = 'fallback';
  }

  return {
    enabledHeads,
    currentGenre,
    loading,
    error,
    allHeads,
    genreMapping,
    currentConfig,
    defaultHeads,
    aiRecommendation,
    aiRecommending,
    effectiveHeads,
    headsSource,
    headsByCategory,
    baseHeads,
    styleHeads,
    genreHeads,
    headWeights,
    allHeadsByCategory,
    currentEnabledHeads,
    fetchAttentionHeads,
    fetchAllHeads,
    fetchProjectConfig,
    fetchAiRecommendation,
    saveProjectConfig,
    setAutoMode,
    setCustomMode,
    toggleHead,
    isHeadEnabled,
    getHeadName,
    getCategoryName,
    getHeadWeight,
    reset,
  };
});
