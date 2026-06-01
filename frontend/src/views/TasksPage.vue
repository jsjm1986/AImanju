<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useTaskManagerStore } from '@/stores/taskManagerStore';
import TaskCard from '@/components/task/TaskCard.vue';

const taskStore = useTaskManagerStore();

// 筛选状态：'running' | 'pending' | 'completed'
const activeTab = ref<'running' | 'pending' | 'completed'>('running');

// 生命周期
onMounted(() => {
  taskStore.connectSSE();
});

onUnmounted(() => {
  taskStore.disconnectSSE();
});

// 运行中的任务（pending + running）
const runningTasks = computed(() => 
  taskStore.tasks.filter(t => ['pending', 'running'].includes(t.status))
);

// 待处理的任务（paused - 失败后暂停，需要人工处理）
const pendingTasks = computed(() => 
  taskStore.tasks.filter(t => t.status === 'paused')
);

// 已完成的任务（completed + stopped，不包含 failed 因为 failed 会进入 paused）
const completedTasks = computed(() => 
  taskStore.tasks.filter(t => ['completed', 'stopped'].includes(t.status))
);

// 根据当前 Tab 显示的任务
const displayedTasks = computed(() => {
  switch (activeTab.value) {
    case 'running': return runningTasks.value;
    case 'pending': return pendingTasks.value;
    case 'completed': return completedTasks.value;
  }
});

// 合并所有活跃任务的日志
const allActiveLogs = computed(() => {
  const logs: Array<{ taskId: string; projectName: string; log: any }> = [];
  
  for (const task of runningTasks.value) {
    const taskLogs = task.logs || [];
    for (const log of taskLogs.slice(-10)) {
      logs.push({
        taskId: task._id,
        projectName: task.projectName || task.projectId.slice(-6),
        log,
      });
    }
  }
  
  return logs
    .sort((a, b) => new Date(b.log.time).getTime() - new Date(a.log.time).getTime())
    .slice(0, 30);
});

// 事件处理
const handlePause = async (taskId: string) => {
  try {
    await taskStore.pauseTask(taskId);
  } catch (e: any) {
    alert(e.message);
  }
};

const handleResume = async (taskId: string) => {
  try {
    await taskStore.resumeTask(taskId);
  } catch (e: any) {
    alert(e.message);
  }
};

const handleStop = async (taskId: string) => {
  if (!confirm('确定要停止这个任务吗？')) return;
  try {
    await taskStore.stopTask(taskId);
  } catch (e: any) {
    alert(e.message);
  }
};

const handleDelete = async (taskId: string) => {
  if (!confirm('确定要删除这个任务吗？')) return;
  try {
    await taskStore.deleteTask(taskId);
  } catch (e: any) {
    alert(e.message);
  }
};

const handleSelect = (taskId: string) => {
  taskStore.selectTask(taskId === taskStore.selectedTaskId ? null : taskId);
};

const handleRefresh = () => {
  taskStore.refreshTasks();
};

// 格式化时间
const formatTime = (time: string) => {
  return new Date(time).toLocaleTimeString('zh-CN', { hour12: false });
};
</script>

<template>
  <div class="tasks-page">
    <header class="page-header">
      <div class="header-left">
        <h1 class="page-title">
          <span class="title-icon">⚡</span>
          任务管理
        </h1>
        <span class="connection-status" :class="{ connected: taskStore.isConnected }">
          {{ taskStore.isConnected ? '🟢 已连接' : '🔴 连接中...' }}
        </span>
      </div>
      <button class="refresh-btn" @click="handleRefresh" :disabled="taskStore.isLoading">
        🔄 刷新
      </button>
    </header>

    <!-- 筛选 Tab -->
    <div class="filter-tabs">
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'running' }"
        @click="activeTab = 'running'"
      >
        🔄 运行中 ({{ runningTasks.length }})
      </button>
      <button 
        class="tab-btn pending-tab" 
        :class="{ active: activeTab === 'pending' }"
        @click="activeTab = 'pending'"
      >
        ⚠️ 待处理 ({{ pendingTasks.length }})
        <span v-if="pendingTasks.length > 0" class="pending-badge">!</span>
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'completed' }"
        @click="activeTab = 'completed'"
      >
        ✅ 已完成 ({{ completedTasks.length }})
      </button>
    </div>

    <div class="tasks-content">
      <div class="tasks-list">
        <!-- 任务列表 -->
        <div v-if="displayedTasks.length > 0" class="task-cards">
          <TaskCard
            v-for="task in displayedTasks"
            :key="task._id"
            :task="task"
            @pause="handlePause"
            @resume="handleResume"
            @stop="handleStop"
            @delete="handleDelete"
            @select="handleSelect"
          />
        </div>

        <!-- 空状态 -->
        <div v-else class="empty-state">
          <span class="empty-icon">{{ activeTab === 'running' ? '📭' : activeTab === 'pending' ? '⏸️' : '📋' }}</span>
          <p class="empty-text">
            {{ activeTab === 'running' ? '暂无运行中的任务' : activeTab === 'pending' ? '暂无待处理的任务' : '暂无已完成的任务' }}
          </p>
          <p class="empty-hint">
            {{ activeTab === 'running' ? '批量生成任务后会显示在这里' : activeTab === 'pending' ? '失败后暂停的任务会显示在这里' : '全部成功完成的任务会显示在这里' }}
          </p>
        </div>
      </div>

      <!-- 日志面板 -->
      <aside class="logs-panel">
        <div class="logs-header">
          <h3 class="logs-title">📋 实时日志</h3>
        </div>
        <div class="logs-container">
          <div
            v-for="(item, index) in allActiveLogs"
            :key="index"
            class="log-item"
            :class="item.log.level"
          >
            <span class="log-time">[{{ formatTime(item.log.time) }}]</span>
            <span class="log-project">[{{ item.projectName }}]</span>
            <span class="log-message">{{ item.log.message }}</span>
          </div>
          <div v-if="allActiveLogs.length === 0" class="logs-empty">
            等待任务执行...
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.tasks-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-base);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-6);
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-default);
}

/* 筛选 Tab */
.filter-tabs {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-default);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-base);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tab-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

.tab-btn.active {
  background: var(--primary-muted);
  border-color: var(--primary);
  color: var(--primary);
  font-weight: var(--font-medium);
}

/* 待处理标签特殊样式 */
.tab-btn.pending-tab {
  position: relative;
}

.tab-btn.pending-tab.active {
  background: var(--warning-muted, rgba(245, 158, 11, 0.1));
  border-color: var(--warning);
  color: var(--warning);
}

.pending-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 16px;
  height: 16px;
  background: var(--error);
  color: white;
  border-radius: 50%;
  font-size: 10px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}
.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.page-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.title-icon {
  font-size: 24px;
}

.connection-status {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.connection-status.connected {
  color: var(--success);
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.refresh-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tasks-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.tasks-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
}

.task-section {
  margin-bottom: var(--space-6);
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0 0 var(--space-4) 0;
  font-size: var(--text-lg);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.section-icon {
  font-size: 18px;
}

.section-title.running {
  color: var(--primary);
}

.section-title.paused {
  color: var(--warning);
}

.section-title.completed {
  color: var(--text-secondary);
}

.task-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12);
  color: var(--text-tertiary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: var(--space-4);
}

.empty-text {
  font-size: var(--text-lg);
  margin: 0 0 var(--space-2) 0;
}

.empty-hint {
  font-size: var(--text-sm);
  margin: 0;
}

/* 日志面板 */
.logs-panel {
  width: 400px;
  background: var(--bg-surface);
  border-left: 1px solid var(--border-default);
  display: flex;
  flex-direction: column;
}

.logs-header {
  padding: var(--space-4);
  border-bottom: 1px solid var(--border-default);
}

.logs-title {
  margin: 0;
  font-size: var(--text-md);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.logs-container {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-3);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

.log-item {
  padding: var(--space-1) 0;
  line-height: 1.5;
  border-bottom: 1px solid var(--border-subtle);
}

.log-item.warn {
  color: var(--warning);
}

.log-item.error {
  color: var(--error);
}

.log-time {
  color: var(--text-tertiary);
  margin-right: var(--space-1);
}

.log-project {
  color: var(--primary);
  margin-right: var(--space-1);
}

.log-message {
  color: var(--text-secondary);
}

.logs-empty {
  color: var(--text-tertiary);
  text-align: center;
  padding: var(--space-8);
}
</style>
