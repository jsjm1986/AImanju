<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { agentDashboardApi } from '@/services/agentApi';

const loading = ref(false);
const stats = ref<any>(null);

const fetchStats = async () => {
  loading.value = true;
  try {
    const response = await agentDashboardApi.getStats();
    stats.value = response.data;
  } catch (err) {
    console.error('获取统计失败:', err);
  } finally {
    loading.value = false;
  }
};

onMounted(fetchStats);
</script>

<template>
  <div class="dashboard-page">
    <h1 class="page-title">数据概览</h1>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else-if="stats" class="stats-grid">
      <div class="stat-card primary">
        <div class="stat-label">配额池使用</div>
        <div class="stat-value">{{ stats.projectsAllocated }} / {{ stats.projectQuota }}</div>
        <div class="stat-sub">剩余 {{ stats.remainingQuota }} 个可分配</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">下级创作者</div>
        <div class="stat-value">{{ stats.totalCreators }}</div>
        <div class="stat-sub">试用 {{ stats.trialCreators }} / 付费 {{ stats.paidCreators }}</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">近7天注册</div>
        <div class="stat-value">{{ stats.recentRegistrations }}</div>
        <div class="stat-sub">新注册创作者</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">本月分配</div>
        <div class="stat-value">{{ stats.monthAllocated }}</div>
        <div class="stat-sub">个项目配额</div>
      </div>
    </div>

    <div v-if="stats" class="quota-bar-section">
      <h3>配额池使用率</h3>
      <div class="quota-bar-container">
        <div class="quota-bar">
          <div
            class="quota-bar-fill"
            :style="{ width: stats.projectQuota ? (stats.projectsAllocated / stats.projectQuota * 100) + '%' : '0%' }"
          ></div>
        </div>
        <span class="quota-bar-text">
          {{ stats.projectQuota ? Math.round(stats.projectsAllocated / stats.projectQuota * 100) : 0 }}%
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-page { max-width: 900px; }
.page-title { color: var(--text-primary); font-size: 22px; margin: 0 0 24px; }
.loading { color: var(--text-tertiary); padding: 40px; text-align: center; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
.stat-card {
  background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 12px;
  padding: 20px; transition: transform 0.15s;
}
.stat-card:hover { transform: translateY(-2px); }
.stat-card.primary { border-color: var(--primary); }
.stat-label { color: var(--text-tertiary); font-size: 13px; margin-bottom: 8px; }
.stat-value { color: var(--text-primary); font-size: 28px; font-weight: 700; margin-bottom: 4px; }
.stat-sub { color: var(--text-muted); font-size: 12px; }
.quota-bar-section { background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 12px; padding: 20px; }
.quota-bar-section h3 { color: var(--text-primary); font-size: 15px; margin: 0 0 12px; }
.quota-bar-container { display: flex; align-items: center; gap: 12px; }
.quota-bar { flex: 1; height: 10px; background: var(--bg-elevated); border-radius: 5px; overflow: hidden; }
.quota-bar-fill { height: 100%; background: var(--primary); border-radius: 5px; transition: width 0.3s; }
.quota-bar-text { color: var(--text-secondary); font-size: 14px; font-weight: 600; min-width: 40px; }
</style>
