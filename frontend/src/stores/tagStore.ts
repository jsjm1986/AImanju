/**
 * 标签状态管理
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { tagApi } from '@/services/api';
import type { Tag } from '@/types';

export const useTagStore = defineStore('tag', () => {
  // 状态
  const tags = ref<Tag[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 计算属性
  const sortedTags = computed(() =>
    [...tags.value].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
  );

  const tagMap = computed(() => {
    const map: Record<string, Tag> = {};
    for (const tag of tags.value) {
      map[tag._id] = tag;
    }
    return map;
  });

  // 加载所有标签
  async function loadTags() {
    loading.value = true;
    error.value = null;

    try {
      const response = await tagApi.getAll();
      tags.value = response.data.tags;
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // 创建标签
  async function createTag(data: { name: string; color?: string }) {
    loading.value = true;
    error.value = null;

    try {
      const response = await tagApi.create(data);
      tags.value.push(response.data.tag);
      return response.data.tag;
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // 更新标签
  async function updateTag(id: string, data: Partial<Tag>) {
    loading.value = true;
    error.value = null;

    try {
      const response = await tagApi.update(id, data);
      const index = tags.value.findIndex(t => t._id === id);
      if (index !== -1) {
        tags.value[index] = response.data.tag;
      }
      return response.data.tag;
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // 删除标签
  async function deleteTag(id: string) {
    loading.value = true;
    error.value = null;

    try {
      await tagApi.delete(id);
      tags.value = tags.value.filter(t => t._id !== id);
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // 为项目添加标签
  async function addTagToProject(projectId: string, tagId: string) {
    try {
      await tagApi.addToProject(projectId, tagId);
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    }
  }

  // 从项目移除标签
  async function removeTagFromProject(projectId: string, tagId: string) {
    try {
      await tagApi.removeFromProject(projectId, tagId);
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    }
  }

  // 根据ID获取标签
  function getTagById(id: string): Tag | undefined {
    return tagMap.value[id];
  }

  // 根据IDs获取标签列表
  function getTagsByIds(ids: string[]): Tag[] {
    return ids.map(id => tagMap.value[id]).filter(Boolean) as Tag[];
  }

  // 重置状态
  function reset() {
    tags.value = [];
    loading.value = false;
    error.value = null;
  }

  return {
    // 状态
    tags,
    loading,
    error,
    // 计算属性
    sortedTags,
    tagMap,
    // 方法
    loadTags,
    createTag,
    updateTag,
    deleteTag,
    addTagToProject,
    removeTagFromProject,
    getTagById,
    getTagsByIds,
    reset,
  };
});
