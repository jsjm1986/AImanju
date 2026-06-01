<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAgentStore } from '@/stores/agentStore';

const router = useRouter();
const agentStore = useAgentStore();

const navItems = [
  { path: '/agent/dashboard', label: '数据概览', icon: '📊' },
  { path: '/agent/creators', label: '创作者管理', icon: '👥' },
  { path: '/agent/invite', label: '邀请码', icon: '🔗' },
  { path: '/agent/allocations', label: '分配记录', icon: '📋' },
  { path: '/agent/profile', label: '个人信息', icon: '⚙️' },
];

const handleLogout = () => {
  agentStore.logout();
  router.push('/agent/login');
};
</script>

<template>
  <div class="agent-layout">
    <aside class="agent-sidebar">
      <div class="sidebar-header">
        <h2>代理后台</h2>
        <span class="agent-name">{{ agentStore.user?.username }}</span>
      </div>

      <nav class="sidebar-nav">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          active-class="active"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <div class="quota-info">
          <span>配额池</span>
          <strong>{{ agentStore.user?.projectsAllocated || 0 }} / {{ agentStore.user?.projectQuota || 0 }}</strong>
        </div>
        <button class="logout-btn" @click="handleLogout">退出登录</button>
      </div>
    </aside>

    <main class="agent-content">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.agent-layout { display: flex; min-height: 100vh; background: var(--bg-base); }
.agent-sidebar {
  width: 240px; background: var(--bg-surface); border-right: 1px solid var(--border-default);
  display: flex; flex-direction: column; padding: 20px 0; flex-shrink: 0;
}
.sidebar-header { padding: 0 20px 20px; border-bottom: 1px solid var(--border-default); }
.sidebar-header h2 { color: var(--text-primary); font-size: 18px; margin: 0 0 4px; }
.agent-name { color: var(--text-tertiary); font-size: 13px; }
.sidebar-nav { flex: 1; padding: 12px 0; display: flex; flex-direction: column; gap: 2px; }
.nav-item {
  display: flex; align-items: center; gap: 10px; padding: 10px 20px; color: var(--text-secondary);
  text-decoration: none; font-size: 14px; transition: all 0.15s; border-left: 3px solid transparent;
}
.nav-item:hover { background: var(--bg-hover); color: var(--text-primary); }
.nav-item.active { background: var(--bg-elevated); color: var(--primary); border-left-color: var(--primary); font-weight: 600; }
.nav-icon { font-size: 16px; width: 20px; text-align: center; }
.sidebar-footer { padding: 16px 20px 0; border-top: 1px solid var(--border-default); }
.quota-info {
  display: flex; justify-content: space-between; align-items: center; padding: 10px 12px;
  background: var(--bg-elevated); border-radius: 8px; margin-bottom: 12px; font-size: 13px; color: var(--text-secondary);
}
.quota-info strong { color: var(--text-primary); }
.logout-btn {
  width: 100%; padding: 8px; border-radius: 8px; border: 1px solid var(--border-default);
  background: transparent; color: var(--text-secondary); font-size: 13px; cursor: pointer; transition: all 0.15s;
}
.logout-btn:hover { background: var(--bg-hover); color: var(--error); border-color: var(--error); }
.agent-content { flex: 1; padding: 24px 32px; overflow-y: auto; }
</style>
