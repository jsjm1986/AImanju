/**
 * 节奏控制状态管理
 * 管理节奏预设、参数和追踪状态
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { worldStateApi } from '@/services/api';
import type {
  IRhythmPreset,
  IRhythmParams,
  IRhythmTracking,
  RhythmPresetType,
} from '@/types';

// 默认节奏参数
const DEFAULT_RHYTHM_PARAMS: IRhythmParams = {
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
};

export const useRhythmStore = defineStore('rhythm', () => {
  // ===== 状态 =====
  const presets = ref<IRhythmPreset[]>([]);
  const currentPreset = ref<RhythmPresetType>('hot-blood');
  const params = ref<IRhythmParams>({ ...DEFAULT_RHYTHM_PARAMS });
  const tracking = ref<IRhythmTracking>({
    lastFaceSlap: 0,
    lastPlotTwist: 0,
    lastBoss: 0,
    coolPointsThisEpisode: 0,
  });
  const currentEpisode = ref(1);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // ===== 计算属性 =====

  // 是否应该打脸
  const shouldFaceSlap = computed(() => {
    const episodesSinceLast = currentEpisode.value - tracking.value.lastFaceSlap;
    const frequency = params.value.faceSlappingFrequency;

    if (episodesSinceLast >= frequency * 1.5) {
      return { should: true, urgency: 'high' as const, episodes: episodesSinceLast };
    }
    if (episodesSinceLast >= frequency) {
      return { should: true, urgency: 'medium' as const, episodes: episodesSinceLast };
    }
    if (episodesSinceLast >= frequency * 0.7) {
      return { should: true, urgency: 'low' as const, episodes: episodesSinceLast };
    }
    return { should: false, urgency: 'low' as const, episodes: episodesSinceLast };
  });

  // 是否应该反转
  const shouldPlotTwist = computed(() => {
    const episodesSinceLast = currentEpisode.value - tracking.value.lastPlotTwist;
    const frequency = params.value.plotTwistFrequency;

    if (episodesSinceLast >= frequency * 1.5) {
      return { should: true, urgency: 'high' as const, episodes: episodesSinceLast };
    }
    if (episodesSinceLast >= frequency) {
      return { should: true, urgency: 'medium' as const, episodes: episodesSinceLast };
    }
    if (episodesSinceLast >= frequency * 0.7) {
      return { should: true, urgency: 'low' as const, episodes: episodesSinceLast };
    }
    return { should: false, urgency: 'low' as const, episodes: episodesSinceLast };
  });

  // 是否应该出现 Boss
  const shouldBossAppear = computed(() => {
    const episodesSinceLast = currentEpisode.value - tracking.value.lastBoss;
    const interval = params.value.bossInterval;

    if (episodesSinceLast >= interval * 1.5) {
      return { should: true, urgency: 'high' as const, episodes: episodesSinceLast };
    }
    if (episodesSinceLast >= interval) {
      return { should: true, urgency: 'medium' as const, episodes: episodesSinceLast };
    }
    if (episodesSinceLast >= interval * 0.8) {
      return { should: true, urgency: 'low' as const, episodes: episodesSinceLast };
    }
    return { should: false, urgency: 'low' as const, episodes: episodesSinceLast };
  });

  // 打脸进度百分比
  const faceSlappingProgress = computed(() => {
    const episodesSinceLast = currentEpisode.value - tracking.value.lastFaceSlap;
    return Math.min((episodesSinceLast / params.value.faceSlappingFrequency) * 100, 100);
  });

  // 反转进度百分比
  const plotTwistProgress = computed(() => {
    const episodesSinceLast = currentEpisode.value - tracking.value.lastPlotTwist;
    return Math.min((episodesSinceLast / params.value.plotTwistFrequency) * 100, 100);
  });

  // Boss 进度百分比
  const bossProgress = computed(() => {
    const episodesSinceLast = currentEpisode.value - tracking.value.lastBoss;
    return Math.min((episodesSinceLast / params.value.bossInterval) * 100, 100);
  });

  // 当前预设信息
  const currentPresetInfo = computed(() => {
    return presets.value.find((p) => p.type === currentPreset.value);
  });

  // ===== 方法 =====

  // 获取预设列表
  async function fetchPresets() {
    loading.value = true;
    error.value = null;

    try {
      const { data } = await worldStateApi.getRhythmPresets();
      presets.value = data.presets;
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }

  // 获取项目的节奏配置
  async function fetchConfig(projectId: string) {
    loading.value = true;
    error.value = null;

    try {
      const { data } = await worldStateApi.getRhythmConfig(projectId);
      currentPreset.value = data.currentPreset;
      params.value = data.params;
      tracking.value = data.tracking;
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }

  // 保存节奏配置
  async function saveConfig(projectId: string) {
    loading.value = true;
    error.value = null;

    try {
      const { data } = await worldStateApi.saveRhythmConfig(projectId, {
        preset: currentPreset.value,
        params: params.value,
      });
      if (data.success) {
        currentPreset.value = data.currentPreset as RhythmPresetType;
        params.value = data.params;
      }
      return data.success;
    } catch (e) {
      error.value = (e as Error).message;
      return false;
    } finally {
      loading.value = false;
    }
  }

  // 应用预设 - 接受预设类型字符串
  function applyPreset(presetType: string) {
    currentPreset.value = presetType as RhythmPresetType;
    // 注意：实际参数会在 saveConfig 后从后端获取
  }

  // 设置当前集数
  function setCurrentEpisode(episode: number) {
    currentEpisode.value = episode;
  }

  // 重置
  function reset() {
    presets.value = [];
    currentPreset.value = 'hot-blood';
    params.value = { ...DEFAULT_RHYTHM_PARAMS };
    tracking.value = { lastFaceSlap: 0, lastPlotTwist: 0, lastBoss: 0 };
    currentEpisode.value = 1;
    loading.value = false;
    error.value = null;
  }

  return {
    // 状态
    presets,
    currentPreset,
    params,
    tracking,
    currentEpisode,
    loading,
    error,

    // 计算属性
    shouldFaceSlap,
    shouldPlotTwist,
    shouldBossAppear,
    faceSlappingProgress,
    plotTwistProgress,
    bossProgress,
    currentPresetInfo,

    // 方法
    fetchPresets,
    fetchConfig,
    saveConfig,
    applyPreset,
    setCurrentEpisode,
    reset,
  };
});
