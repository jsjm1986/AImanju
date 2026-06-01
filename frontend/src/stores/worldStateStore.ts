/**
 * WorldState 状态管理
 * 管理世界状态快照的获取、初始化和展示
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { worldStateApi } from '@/services/api';
import type {
  IWorldState,
  ICharacterState,
  IPlantedForeshadowing,
  CharacterTier,
} from '@/types';

export const useWorldStateStore = defineStore('worldState', () => {
  // ===== 状态 =====
  const worldState = ref<IWorldState | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const initialized = ref(false);

  // ===== 计算属性 =====

  // 按层级分组角色
  const charactersByTier = computed(() => {
    if (!worldState.value) return new Map<CharacterTier, ICharacterState[]>();

    const groups = new Map<CharacterTier, ICharacterState[]>();
    const tiers: CharacterTier[] = ['core', 'recurring', 'arc', 'temporary', 'extra'];

    tiers.forEach((tier) => groups.set(tier, []));

    Object.values(worldState.value.characters).forEach((char) => {
      const list = groups.get(char.tier) || [];
      list.push(char);
      groups.set(char.tier, list);
    });

    return groups;
  });

  // 角色统计
  const characterStats = computed(() => {
    if (!worldState.value) return { total: 0, active: 0, archived: 0 };

    const characters = Object.values(worldState.value.characters);
    return {
      total: characters.length,
      active: characters.filter((c) => c.status === 'active').length,
      archived: characters.filter((c) => c.status !== 'active').length,
    };
  });

  // 超期伏笔 (超过10集未回收)
  const overdueForeshadowings = computed(() => {
    if (!worldState.value) return [];

    const currentEpisode = worldState.value.episodeNumber;
    return worldState.value.foreshadowings.planted.filter((f) => {
      const age = currentEpisode - f.episodePlanted;
      const threshold = f.importance === 'high' ? 10 : f.importance === 'normal' ? 15 : 20;
      return age > threshold;
    });
  });

  // 即将超期伏笔 (5-10集)
  const upcomingForeshadowings = computed(() => {
    if (!worldState.value) return [];

    const currentEpisode = worldState.value.episodeNumber;
    return worldState.value.foreshadowings.planted.filter((f) => {
      const age = currentEpisode - f.episodePlanted;
      return age >= 5 && age <= 10;
    });
  });

  // 伏笔统计
  const foreshadowingStats = computed(() => {
    if (!worldState.value) {
      return { planted: 0, resolved: 0, overdue: 0 };
    }

    return {
      planted: worldState.value.foreshadowings.planted.length,
      resolved: worldState.value.foreshadowings.recentlyResolved.length,
      overdue: overdueForeshadowings.value.length,
    };
  });

  // 未解决悬念
  const unresolvedCliffhangers = computed(() => {
    if (!worldState.value) return [];
    return worldState.value.plotState.cliffhangers.filter((c) => !c.resolved);
  });

  // 当前剧情弧信息
  const currentArcInfo = computed(() => {
    if (!worldState.value) return null;
    return {
      name: worldState.value.plotState.currentArc,
      progress: worldState.value.plotState.arcProgress,
    };
  });

  // 已埋伏笔列表
  const plantedForeshadowings = computed(() => {
    if (!worldState.value) return [];
    return worldState.value.foreshadowings.planted || [];
  });

  // 已回收伏笔列表
  const resolvedForeshadowings = computed(() => {
    if (!worldState.value) return [];
    return worldState.value.foreshadowings.recentlyResolved || [];
  });

  // ===== 方法 =====

  // 获取 WorldState
  async function fetchWorldState(projectId: string, episode?: number) {
    loading.value = true;
    error.value = null;

    try {
      const { data } = await worldStateApi.get(projectId, episode);
      if (data.exists && data.worldState) {
        worldState.value = data.worldState;
        initialized.value = true;
      } else {
        worldState.value = null;
        initialized.value = false;
      }
    } catch (e) {
      error.value = (e as Error).message;
      worldState.value = null;
    } finally {
      loading.value = false;
    }
  }

  // 初始化 WorldState
  async function initializeWorldState(projectId: string) {
    loading.value = true;
    error.value = null;

    try {
      const { data } = await worldStateApi.initialize(projectId);
      if (data.success) {
        // 重新获取最新状态
        await fetchWorldState(projectId);
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

  // 获取角色详情
  function getCharacter(name: string): ICharacterState | null {
    if (!worldState.value) return null;
    return worldState.value.characters[name] || null;
  }

  // 获取角色关系
  function getCharacterRelationships(name: string): Record<string, string> {
    const char = getCharacter(name);
    return char?.relationships || {};
  }

  // 获取伏笔年龄（已经多少集了）
  function getForeshadowingAge(foreshadowing: IPlantedForeshadowing): number {
    if (!worldState.value) return 0;
    return worldState.value.episodeNumber - foreshadowing.episodePlanted;
  }

  // 重置状态
  function reset() {
    worldState.value = null;
    loading.value = false;
    error.value = null;
    initialized.value = false;
  }

  return {
    // 状态
    worldState,
    loading,
    error,
    initialized,

    // 计算属性
    charactersByTier,
    characterStats,
    overdueForeshadowings,
    upcomingForeshadowings,
    foreshadowingStats,
    unresolvedCliffhangers,
    currentArcInfo,
    plantedForeshadowings,
    resolvedForeshadowings,

    // 方法
    fetchWorldState,
    initializeWorldState,
    getCharacter,
    getCharacterRelationships,
    getForeshadowingAge,
    reset,
  };
});
