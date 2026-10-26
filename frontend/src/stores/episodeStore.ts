import { defineStore } from 'pinia';
import { episodeApi } from '@/services/api';
import { humanizeError } from '@/services/apiConfig';
import type { Episode } from '@/types';

interface EpisodeState {
  episodes: Episode[];
  currentEpisode: Episode | null;
  loading: boolean;
  error: string | null;
  projectId: string | null;
  fetchVersion: number;
}

export const useEpisodeStore = defineStore('episode', {
  state: (): EpisodeState => ({
    episodes: [],
    currentEpisode: null,
    loading: false,
    error: null,
    projectId: null,
    fetchVersion: 0,
  }),

  getters: {
    getEpisodeById: (state) => (id: string) => {
      return state.episodes.find((e) => e._id === id);
    },
    getEpisodeByNumber: (state) => (num: number) => {
      return state.episodes.find((e) => e.episodeNumber === num);
    },
    sortedEpisodes: (state) => {
      return [...state.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber);
    },
    completedCount: (state) => {
      return state.episodes.filter((e) => e.status === 'completed').length;
    },
  },

  actions: {
    async fetchEpisodes(projectId: string) {
      const version = ++this.fetchVersion;
      if (this.projectId !== projectId) {
        this.episodes = [];
        this.currentEpisode = null;
      }
      this.projectId = projectId;
      this.loading = true;
      this.error = null;
      try {
        const { data } = await episodeApi.getByProject(projectId);
        if (version !== this.fetchVersion) return false;
        if (data.success && data.data) {
          this.episodes = data.data;
          return true;
        }
        this.error = data.error || '获取剧集失败';
        return false;
      } catch (error) {
        if (version !== this.fetchVersion) return false;
        this.error = (error as { friendlyMessage?: string })?.friendlyMessage || humanizeError(error);
        return false;
      } finally {
        if (version === this.fetchVersion) this.loading = false;
      }
    },

    async fetchEpisodeByNumber(projectId: string, episodeNumber: number) {
      const version = ++this.fetchVersion;
      if (this.projectId !== projectId) {
        this.episodes = [];
        this.currentEpisode = null;
      }
      this.projectId = projectId;
      this.loading = true;
      this.error = null;
      try {
        const { data } = await episodeApi.getByNumber(projectId, episodeNumber);
        if (version !== this.fetchVersion) return null;
        if (data.success && data.data) {
          this.currentEpisode = data.data;
          // 更新列表中的对应项
          const index = this.episodes.findIndex((e) => e.episodeNumber === episodeNumber);
          if (index !== -1) {
            this.episodes[index] = data.data;
          } else {
            this.episodes.push(data.data);
          }
          return data.data;
        }
        return null;
      } catch (error: unknown) {
        if (version !== this.fetchVersion) return null;
        // 404 表示剧集不存在，这是正常情况，不报错
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 404) {
          this.currentEpisode = null;
          return null;
        }
        this.error = (error as { friendlyMessage?: string })?.friendlyMessage || humanizeError(error);
        return null;
      } finally {
        if (version === this.fetchVersion) this.loading = false;
      }
    },

    async updateEpisode(id: string, episodeData: Partial<Episode>) {
      this.loading = true;
      try {
        const { data } = await episodeApi.update(id, episodeData);
        if (data.success && data.data) {
          const index = this.episodes.findIndex((e) => e._id === id);
          if (index !== -1) {
            this.episodes[index] = data.data;
          }
          if (this.currentEpisode?._id === id) {
            this.currentEpisode = data.data;
          }
          return data.data;
        }
      } catch (error) {
        this.error = (error as { friendlyMessage?: string })?.friendlyMessage || humanizeError(error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    setCurrentEpisode(episode: Episode | null) {
      this.currentEpisode = episode;
    },

    clearEpisodes() {
      this.fetchVersion++;
      this.projectId = null;
      this.episodes = [];
      this.currentEpisode = null;
      this.loading = false;
      this.error = null;
    },
  },
});
