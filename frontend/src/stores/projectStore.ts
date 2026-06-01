import { defineStore } from 'pinia';
import { projectApi } from '@/services/api';
import type { Project } from '@/types';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  error: string | null;
}

export const useProjectStore = defineStore('project', {
  state: (): ProjectState => ({
    projects: [],
    currentProject: null,
    loading: false,
    error: null,
  }),

  getters: {
    getProjectById: (state) => (id: string) => {
      return state.projects.find((p) => p._id === id);
    },
  },

  actions: {
    async fetchProjects() {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await projectApi.getAll();
        if (data.success && data.data) {
          this.projects = data.data;
        }
      } catch (error: any) {
        const status = error.response?.status;
        if (status === 401) {
          // Token 无效，API 拦截器会处理跳转
          this.error = '请重新登录';
          this.projects = [];
        } else if (status === 403) {
          // 权限问题 - 可能是配额相关
          this.error = error.friendlyMessage || error.response?.data?.error || '无权访问';
          this.projects = [];
        } else {
          this.error = error.friendlyMessage || error.response?.data?.error || error.message || '获取项目失败';
        }
      } finally {
        this.loading = false;
      }
    },

    async createProject(projectData: Partial<Project>) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await projectApi.create(projectData);
        if (data.success && data.data) {
          this.projects.unshift(data.data);
          return data.data;
        }
      } catch (error: any) {
        // 保存友好错误消息
        this.error = error.friendlyMessage || error.response?.data?.error || error.message || '创建项目失败';
        // 直接抛出原始错误，保留 response 对象供调用方检查
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async updateProject(id: string, projectData: Partial<Project>) {
      try {
        const { data } = await projectApi.update(id, projectData);
        if (data.success && data.data) {
          const index = this.projects.findIndex(p => p._id === id);
          if (index !== -1) {
            this.projects[index] = data.data;
          }
          return data.data;
        }
      } catch (error) {
        this.error = (error as Error).message;
        throw error;
      }
    },

    async deleteProject(id: string) {
      try {
        await projectApi.delete(id);
        this.projects = this.projects.filter((p) => p._id !== id);
      } catch (error) {
        this.error = (error as Error).message;
        throw error;
      }
    },

    setCurrentProject(project: Project | null) {
      this.currentProject = project;
    },
  },
});
