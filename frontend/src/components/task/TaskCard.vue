<script setup lang="ts">
import { computed } from 'vue';
import type { Task } from '@/stores/taskManagerStore';

const props = defineProps<{
  task: Task;
}>();

const emit = defineEmits<{
  pause: [taskId: string];
  resume: [taskId: string];
  stop: [taskId: string];
  delete: [taskId: string];
  select: [taskId: string];
}>();

// 状态图标
const statusIcon = computed(() => {
  const icons: Record<string, string> = {
    pending: '⏳',
    running: '🔄',
    paused: '⏸',
    completed: '✅',
    failed: '❌',
    stopped: '⏹',
  };
  return icons[props.task.status] || '❓';
});

// 状态标签
const statusLabel = computed(() => {
  const labels: Record<string, string> = {
    pending: '等待中',
    running: '运行中',
    paused: '已暂停',
    completed: '已完成',
    failed: '失败',
    stopped: '已停止',
  };
  return labels[props.task.status] || props.task.status;
});

// 进度百分比
const progressPercent = computed(() => {
  const eps = props.task.episodes || [];
  if (eps.length === 0) return 0;
  const completed = new Set(props.task.completed || []).size;
  return Math.round((completed / eps.length) * 100);
});

// 项目名称
const projectName = computed(() => {
  return props.task.projectName || `项目 ${props.task.projectId.slice(-6)}`;
});

// 模型名称（精简显示）
const modelDisplay = computed(() => {
  const name = props.task.modelName || '-';
  // 提取关键部分，如 GLM-4.7 从 GLM-4.7-XXXXXXX
  if (name.includes('-')) {
    const parts = name.split('-');
    if (parts.length >= 2) {
      return parts.slice(0, 2).join('-');
    }
  }
  return name.length > 12 ? name.slice(0, 12) + '...' : name;
});

// 集数范围描述（紧凑）
const episodesDesc = computed(() => {
  const eps = props.task.episodes || [];
  if (eps.length === 0) return '无';
  if (eps.length === 1) return `第${eps[0]}集`;
  
  const isConsecutive = eps.every((e, i) => i === 0 || e === eps[i - 1]! + 1);
  if (isConsecutive) {
    return `第${eps[0]}-${eps[eps.length - 1]}集`;
  }
  return `${eps.length}集`;
});

// 运行时长（紧凑格式）
const duration = computed(() => {
  const start = props.task.startedAt ? new Date(props.task.startedAt) : null;
  const end = props.task.completedAt ? new Date(props.task.completedAt) : new Date();
  if (!start) return '-';
  
  const ms = end.getTime() - start.getTime();
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m${seconds % 60}s`;
  return `${seconds}s`;
});

// 开始时间
const startTime = computed(() => {
  if (!props.task.startedAt) return '-';
  return new Date(props.task.startedAt).toLocaleTimeString('zh-CN', { hour12: false });
});

// 结束时间
const endTime = computed(() => {
  if (!props.task.completedAt) return '-';
  return new Date(props.task.completedAt).toLocaleTimeString('zh-CN', { hour12: false });
});

// 结果统计
const stats = computed(() => {
  const completed = new Set(props.task.completed || []).size;
  const failed = props.task.failed?.length || 0;
  const total = props.task.episodes?.length || 0;
  return { completed, failed, total };
});

// 当前步骤
const currentStep = computed(() => {
  if (props.task.status === 'running') {
    const progress = props.task.currentProgress;
    if (progress?.message) {
      return progress.message.length > 40 
        ? progress.message.slice(0, 40) + '...' 
        : progress.message;
    }
    return `正在生成第 ${props.task.currentEpisode || '?'} 集...`;
  }
  if (props.task.status === 'paused') {
    return `暂停于第 ${props.task.currentEpisode || '?'} 集`;
  }
  return '';
});

// 错误类型分类和友好提示
const getErrorInfo = (errorMsg: string): { type: string; icon: string; suggestion: string } => {
  // 超时相关
  if (errorMsg.includes('超时') || errorMsg.includes('timeout') || errorMsg.includes('Timeout') || errorMsg.includes('TIMEOUT')) {
    return { type: '超时', icon: '⏱️', suggestion: '单集生成时间过长，建议稍后重试' };
  }
  // 配额相关
  if (errorMsg.includes('配额') || errorMsg.includes('试用')) {
    return { type: '配额不足', icon: '💰', suggestion: '请购买配额或联系管理员' };
  }
  // 跳集错误
  if (errorMsg.includes('跳集') || errorMsg.includes('请先生成')) {
    return { type: '跳集错误', icon: '⏭️', suggestion: '请先生成上一集' };
  }
  // 参数错误
  if (errorMsg.includes('项目不存在') || errorMsg.includes('缺少参数')) {
    return { type: '参数错误', icon: '❓', suggestion: '请检查项目是否存在' };
  }
  // API服务商错误（502/503/504等）
  if (errorMsg.includes('502') || errorMsg.includes('503') || errorMsg.includes('504') || errorMsg.includes('Bad Gateway') || errorMsg.includes('Service Unavailable')) {
    return { type: 'API服务异常', icon: '🔧', suggestion: 'AI服务商暂时不可用，请稍后重试' };
  }
  // 速率限制
  if (errorMsg.includes('429') || errorMsg.includes('rate limit') || errorMsg.includes('Rate limit') || errorMsg.includes('too many') || errorMsg.includes('Too Many')) {
    return { type: 'API限流', icon: '🚦', suggestion: 'API调用频率过高，请等待1-2分钟后重试' };
  }
  // 认证错误
  if (errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('Unauthorized') || errorMsg.includes('Forbidden') || errorMsg.includes('API key')) {
    return { type: 'API认证失败', icon: '🔑', suggestion: 'API密钥无效或已过期，请联系管理员' };
  }
  // 网络连接错误
  if (errorMsg.includes('STREAM_ENDED') || errorMsg.includes('连接') || errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ENOTFOUND') || errorMsg.includes('network')) {
    return { type: '连接中断', icon: '🔌', suggestion: '网络连接中断，请检查网络后重试' };
  }
  // 用户取消
  if (errorMsg.includes('cancelled') || errorMsg.includes('取消') || errorMsg.includes('aborted')) {
    return { type: '已取消', icon: '🛑', suggestion: '任务被用户手动取消' };
  }
  // AI解析失败
  if (errorMsg.includes('JSON') || errorMsg.includes('parse') || errorMsg.includes('解析') || errorMsg.includes('unexpected')) {
    return { type: 'AI解析失败', icon: '🤖', suggestion: 'AI返回格式异常，建议重试' };
  }
  // 内容过长
  if (errorMsg.includes('token') || errorMsg.includes('length') || errorMsg.includes('too long') || errorMsg.includes('exceeded')) {
    return { type: '内容过长', icon: '📏', suggestion: '生成内容超出限制，请调整参数后重试' };
  }
  return { type: '生成失败', icon: '⚠️', suggestion: '请查看详细错误信息或联系管理员' };
};

// 最后一次失败的错误信息
const lastFailedError = computed(() => {
  const failed = props.task.failed;
  if (!failed || failed.length === 0) return null;
  const lastFailed = failed[failed.length - 1];
  if (!lastFailed) return null;
  
  const errorMsg = lastFailed.error || '未知错误';
  const errorInfo = getErrorInfo(errorMsg);
  
  return {
    episode: lastFailed.episode,
    error: errorMsg.length > 100 ? errorMsg.slice(0, 100) + '...' : errorMsg,
    attempts: lastFailed.attempts || 0,
    ...errorInfo
  };
});

// 控制按钮
const canPause = computed(() => props.task.status === 'running');
const canResume = computed(() => props.task.status === 'paused');
const canStop = computed(() => ['running', 'pending', 'paused'].includes(props.task.status));
const canDelete = computed(() => ['completed', 'failed', 'stopped', 'paused'].includes(props.task.status));

const handlePause = () => emit('pause', props.task._id);
const handleResume = () => emit('resume', props.task._id);
const handleStop = () => emit('stop', props.task._id);
const handleDelete = () => emit('delete', props.task._id);
const handleSelect = () => emit('select', props.task._id);
</script>

<template>
  <div class="task-card" :class="task.status" @click="handleSelect">
    <!-- 第一行：项目名 + 状态 -->
    <div class="row-1">
      <div class="project-info">
        <span class="status-icon">{{ statusIcon }}</span>
        <span class="project-name">{{ projectName }}</span>
      </div>
      <span class="status-badge" :class="task.status">{{ statusLabel }}</span>
    </div>

    <!-- 第二行：任务信息 -->
    <div class="row-2">
      <span class="tag type">批量生成</span>
      <span class="tag episodes">{{ episodesDesc }}</span>
      <span class="tag model" v-if="task.modelName">🤖 {{ modelDisplay }}</span>
    </div>

    <!-- 第三行：进度条 -->
    <div class="row-3">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${progressPercent}%` }"></div>
      </div>
      <span class="progress-text">{{ progressPercent }}%</span>
    </div>

    <!-- 第四行：当前步骤（仅运行中/暂停时） -->
    <div v-if="currentStep" class="row-4">
      {{ currentStep }}
    </div>

    <!-- 最后失败原因（暂停/失败时显示） -->
    <div v-if="lastFailedError && ['paused', 'failed'].includes(task.status)" class="row-error">
      <div class="error-header">
        <span class="error-type-badge">{{ lastFailedError.icon }} {{ lastFailedError.type }}</span>
        <span class="error-episode">第{{ lastFailedError.episode }}集</span>
      </div>
      <div class="error-message">{{ lastFailedError.error }}</div>
      <div class="error-suggestion">💡 {{ lastFailedError.suggestion }}</div>
    </div>

    <!-- 第五行：时间和统计信息 -->
    <div class="row-5">
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">🕐 开始</span>
          <span class="info-value">{{ startTime }}</span>
        </div>
        <div v-if="task.completedAt" class="info-item">
          <span class="info-label">🏁 结束</span>
          <span class="info-value">{{ endTime }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">⏱ 用时</span>
          <span class="info-value">{{ duration }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">📊 完成</span>
          <span class="info-value">
            <span class="success">{{ stats.completed }}</span>
            <span v-if="stats.failed > 0" class="error"> / {{ stats.failed }}失败</span>
            <span class="total"> / {{ stats.total }}集</span>
          </span>
        </div>
      </div>
    </div>

    <!-- 第六行：操作按钮 -->
    <div class="row-6" @click.stop>
      <button v-if="canPause" class="btn pause" @click="handlePause" title="暂停">⏸ 暂停</button>
      <button v-if="canResume" class="btn resume" @click="handleResume" title="恢复">▶ 恢复</button>
      <button v-if="canStop" class="btn stop" @click="handleStop" title="停止">⏹ 停止</button>
      <button v-if="canDelete" class="btn delete" @click="handleDelete" title="删除">🗑 删除</button>
    </div>
  </div>
</template>

<style scoped>
.task-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.task-card:hover {
  border-color: var(--border-hover);
  background: var(--bg-hover);
}

/* 状态边框 */
.task-card.running { border-left: 3px solid var(--primary); }
.task-card.paused { border-left: 3px solid var(--warning); }
.task-card.completed { border-left: 3px solid var(--success); }
.task-card.failed { border-left: 3px solid var(--error); }
.task-card.stopped { border-left: 3px solid var(--text-tertiary); }

/* 第一行 */
.row-1 {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
}

.project-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

.status-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.project-name {
  font-weight: var(--font-medium);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-badge {
  font-size: var(--text-xs);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  flex-shrink: 0;
}

.status-badge.running { background: var(--primary-muted); color: var(--primary); }
.status-badge.paused { background: var(--warning-muted); color: var(--warning); }
.status-badge.completed { background: var(--success-muted); color: var(--success); }
.status-badge.failed { background: var(--error-muted); color: var(--error); }

/* 第二行 */
.row-2 {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
  flex-wrap: wrap;
}

.tag {
  font-size: var(--text-xs);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  color: var(--text-tertiary);
}

.tag.type {
  background: var(--primary-muted);
  color: var(--primary);
}

.tag.model {
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

/* 第三行 */
.row-3 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.progress-bar {
  flex: 1;
  height: 4px;
  background: var(--bg-elevated);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary);
  transition: width 0.3s ease;
}

.task-card.completed .progress-fill { background: var(--success); }
.task-card.failed .progress-fill { background: var(--error); }

.progress-text {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  min-width: 32px;
  text-align: right;
}

/* 第四行 */
.row-4 {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  padding: var(--space-1) var(--space-2);
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 失败原因行 */
.row-error {
  font-size: var(--text-xs);
  padding: var(--space-2);
  background: var(--error-muted);
  border: 1px solid var(--error);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-2);
}

.error-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.error-type-badge {
  background: var(--error);
  color: white;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-weight: var(--font-medium);
}

.error-episode {
  color: var(--text-secondary);
}

.error-message {
  color: var(--text-primary);
  word-break: break-word;
  margin-bottom: var(--space-1);
}

.error-suggestion {
  color: var(--text-secondary);
  font-style: italic;
}

/* 第五行：时间和统计 */
.row-5 {
  margin-bottom: var(--space-2);
  padding: var(--space-2);
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: var(--space-2);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-label {
  font-size: 10px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.info-value {
  font-size: var(--text-xs);
  color: var(--text-primary);
  font-weight: var(--font-medium);
}

.success { color: var(--success); }
.error { color: var(--error); }
.total { color: var(--text-tertiary); font-weight: normal; }

/* 第六行：操作按钮 */
.row-6 {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
  border-top: 1px solid var(--border-default);
  padding-top: var(--space-2);
}

.btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  cursor: pointer;
  font-size: var(--text-xs);
  transition: all var(--transition-fast);
}

.btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

.btn.pause:hover { background: var(--warning-muted); border-color: var(--warning); color: var(--warning); }
.btn.resume:hover { background: var(--success-muted); border-color: var(--success); color: var(--success); }
.btn.stop:hover, .btn.delete:hover { background: var(--error-muted); border-color: var(--error); color: var(--error); }
</style>
