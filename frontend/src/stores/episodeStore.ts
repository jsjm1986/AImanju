import { defineStore } from 'pinia';
import { episodeApi } from '@/services/api';
import type { Episode } from '@/types';

interface EpisodeState {
  episodes: Episode[];
  currentEpisode: Episode | null;
  loading: boolean;
  error: string | null;
}

export const useEpisodeStore = defineStore('episode', {
  state: (): EpisodeState => ({
    episodes: [],
    currentEpisode: null,
    loading: false,
    error: null,
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
      this.loading = true;
      this.error = null;
      try {
        const { data } = await episodeApi.getByProject(projectId);
        if (data.success && data.data) {
          this.episodes = data.data;
        }
      } catch (error) {
        this.error = (error as Error).message;
      } finally {
        this.loading = false;
      }
    },

    async fetchEpisodeByNumber(projectId: string, episodeNumber: number) {
      this.loading = true;
      try {
        const { data } = await episodeApi.getByNumber(projectId, episodeNumber);
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
        // 404 表示剧集不存在，这是正常情况，不报错
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 404) {
          this.currentEpisode = null;
          return null;
        }
        this.error = (error as Error).message;
        return null;
      } finally {
        this.loading = false;
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
        this.error = (error as Error).message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    setCurrentEpisode(episode: Episode | null) {
      this.currentEpisode = episode;
    },

    clearEpisodes() {
      this.episodes = [];
      this.currentEpisode = null;
    },
  },
});
