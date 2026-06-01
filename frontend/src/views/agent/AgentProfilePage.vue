<script setup lang="ts">
import { ref } from 'vue';
import { useAgentStore } from '@/stores/agentStore';
import { agentAuthApi } from '@/services/agentApi';

const agentStore = useAgentStore();

const email = ref('');
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const saving = ref(false);
const message = ref('');
const errorMsg = ref('');

const resetForm = () => {
  email.value = agentStore.user?.email || '';
  currentPassword.value = '';
  newPassword.value = '';
  confirmPassword.value = '';
  message.value = '';
  errorMsg.value = '';
};

resetForm();

const handleSave = async () => {
  errorMsg.value = '';
  message.value = '';

  const updates: any = {};

  if (email.value && email.value !== agentStore.user?.email) {
    updates.email = email.value;
  }

  if (newPassword.value) {
    if (!currentPassword.value) {
      errorMsg.value = '请输入当前密码';
      return;
    }
    if (newPassword.value.length < 6) {
      errorMsg.value = '新密码长度至少6个字符';
      return;
    }
    if (newPassword.value !== confirmPassword.value) {
      errorMsg.value = '两次输入的密码不一致';
      return;
    }
    updates.currentPassword = currentPassword.value;
    updates.newPassword = newPassword.value;
  }

  if (!Object.keys(updates).length) {
    errorMsg.value = '没有要修改的内容';
    return;
  }

  saving.value = true;
  try {
    await agentAuthApi.updateProfile(updates);
    message.value = '更新成功';
    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
    await agentStore.refreshProfile();
  } catch (err: any) {
    errorMsg.value = err.response?.data?.error || '更新失败';
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div class="profile-page">
    <h1 class="page-title">个人信息</h1>

    <div class="profile-card">
      <div class="info-row">
        <span class="label">用户名</span>
        <span class="value">{{ agentStore.user?.username }}</span>
      </div>
      <div class="info-row">
        <span class="label">状态</span>
        <span class="status-badge active">{{ agentStore.user?.status === 'active' ? '正常' : '冻结' }}</span>
      </div>
      <div class="info-row">
        <span class="label">配额池</span>
        <span class="value">{{ agentStore.user?.projectsAllocated }} / {{ agentStore.user?.projectQuota }} (剩余 {{ agentStore.user?.remainingQuota }})</span>
      </div>
    </div>

    <div class="edit-card">
      <h3>修改信息</h3>

      <form @submit.prevent="handleSave" class="edit-form">
        <div class="form-group">
          <label>邮箱</label>
          <input v-model="email" type="email" placeholder="邮箱地址" />
        </div>

        <hr class="divider" />

        <div class="form-group">
          <label>当前密码</label>
          <input v-model="currentPassword" type="password" placeholder="修改密码时必填" autocomplete="current-password" />
        </div>

        <div class="form-group">
          <label>新密码</label>
          <input v-model="newPassword" type="password" placeholder="至少6个字符" autocomplete="new-password" />
        </div>

        <div class="form-group">
          <label>确认新密码</label>
          <input v-model="confirmPassword" type="password" placeholder="再次输入新密码" autocomplete="new-password" />
        </div>

        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
        <div v-if="message" class="success-msg">{{ message }}</div>

        <button type="submit" class="save-btn" :disabled="saving">
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.profile-page { max-width: 500px; }
.page-title { color: var(--text-primary); font-size: 22px; margin: 0 0 24px; }
.profile-card {
  background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 12px;
  padding: 20px; margin-bottom: 20px;
}
.info-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; }
.info-row + .info-row { border-top: 1px solid var(--border-default); }
.label { color: var(--text-tertiary); font-size: 14px; }
.value { color: var(--text-primary); font-size: 14px; font-weight: 500; }
.status-badge { padding: 2px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; }
.status-badge.active { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
.edit-card {
  background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 12px; padding: 20px;
}
.edit-card h3 { color: var(--text-primary); font-size: 15px; margin: 0 0 16px; }
.edit-form { display: flex; flex-direction: column; gap: 14px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label { color: var(--text-secondary); font-size: 13px; }
.form-group input {
  padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border-default);
  background: var(--bg-elevated); color: var(--text-primary); font-size: 14px;
}
.form-group input:focus { outline: none; border-color: var(--primary); }
.form-group input::placeholder { color: var(--text-muted); }
.divider { border: none; border-top: 1px solid var(--border-default); margin: 4px 0; }
.error-msg { color: var(--error); font-size: 13px; padding: 8px; background: var(--error-muted); border-radius: 6px; }
.success-msg { color: #22c55e; font-size: 13px; padding: 8px; background: rgba(34, 197, 94, 0.1); border-radius: 6px; }
.save-btn {
  padding: 10px; border-radius: 8px; border: none; background: var(--primary);
  color: var(--text-on-primary); font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.15s;
}
.save-btn:hover:not(:disabled) { background: var(--primary-hover); }
.save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
