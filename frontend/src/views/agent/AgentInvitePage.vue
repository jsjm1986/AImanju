<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { agentDashboardApi } from '@/services/agentApi';

const inviteCode = ref('');
const inviteLink = ref('');
const loading = ref(false);
const copied = ref(false);

const fetchInvite = async () => {
  try {
    const response = await agentDashboardApi.getInvite();
    inviteCode.value = response.data.inviteCode;
    inviteLink.value = response.data.inviteLink;
  } catch (err) {
    console.error('获取邀请码失败:', err);
  }
};

const refreshCode = async () => {
  if (!confirm('刷新后旧邀请码将立即失效，确认刷新？')) return;
  loading.value = true;
  try {
    const response = await agentDashboardApi.refreshInvite();
    inviteCode.value = response.data.inviteCode;
    inviteLink.value = response.data.inviteLink;
  } catch (err: any) {
    alert(err.response?.data?.error || '刷新失败');
  } finally {
    loading.value = false;
  }
};

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch {
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  }
};

onMounted(fetchInvite);
</script>

<template>
  <div class="invite-page">
    <h1 class="page-title">邀请码管理</h1>

    <div class="invite-card">
      <div class="invite-section">
        <label>邀请码</label>
        <div class="code-display">
          <span class="code-text">{{ inviteCode }}</span>
          <button class="copy-btn" @click="copyToClipboard(inviteCode)">
            {{ copied ? '已复制' : '复制' }}
          </button>
        </div>
      </div>

      <div class="invite-section">
        <label>邀请链接</label>
        <div class="link-display">
          <span class="link-text">{{ inviteLink }}</span>
          <button class="copy-btn" @click="copyToClipboard(inviteLink)">
            {{ copied ? '已复制' : '复制' }}
          </button>
        </div>
      </div>

      <div class="invite-actions">
        <button class="refresh-btn" :disabled="loading" @click="refreshCode">
          {{ loading ? '刷新中...' : '刷新邀请码' }}
        </button>
        <p class="hint">刷新后旧邀请码将立即失效，已通过旧码注册的用户不受影响</p>
      </div>
    </div>

    <div class="usage-info">
      <h3>使用方式</h3>
      <ol>
        <li>将邀请码或邀请链接发送给创作者</li>
        <li>创作者在注册页面输入邀请码即可绑定为您的下级</li>
        <li>创作者注册后将出现在您的"创作者管理"列表中</li>
        <li>您可以为下级创作者开通付费和分配项目配额</li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.invite-page { max-width: 600px; }
.page-title { color: var(--text-primary); font-size: 22px; margin: 0 0 24px; }
.invite-card { background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 12px; padding: 24px; margin-bottom: 24px; }
.invite-section { margin-bottom: 20px; }
.invite-section label { display: block; color: var(--text-tertiary); font-size: 13px; margin-bottom: 8px; }
.code-display, .link-display {
  display: flex; align-items: center; gap: 12px; background: var(--bg-elevated);
  border-radius: 8px; padding: 12px 16px;
}
.code-text { font-size: 24px; font-weight: 700; color: var(--primary); letter-spacing: 3px; font-family: monospace; }
.link-text { flex: 1; font-size: 13px; color: var(--text-secondary); word-break: break-all; font-family: monospace; }
.copy-btn {
  padding: 6px 14px; border-radius: 6px; border: 1px solid var(--primary); background: transparent;
  color: var(--primary); font-size: 13px; cursor: pointer; white-space: nowrap; transition: all 0.15s;
}
.copy-btn:hover { background: var(--primary); color: white; }
.invite-actions { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
.refresh-btn {
  padding: 8px 20px; border-radius: 8px; border: 1px solid var(--border-default); background: transparent;
  color: var(--text-secondary); font-size: 14px; cursor: pointer; transition: all 0.15s;
}
.refresh-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.hint { color: var(--text-muted); font-size: 12px; margin: 0; }
.usage-info { background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 12px; padding: 24px; }
.usage-info h3 { color: var(--text-primary); font-size: 15px; margin: 0 0 12px; }
.usage-info ol { margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.8; }
</style>
