<template>
  <div class="profile-page">
    <div class="profile-container container">
      <!-- 用户信息卡 -->
      <section class="user-card card">
        <div class="user-header">
          <div class="avatar-wrapper">
            <div class="avatar">{{ authStore.user?.nickname?.charAt(0) || 'U' }}</div>
            <span class="user-role badge" :class="authStore.isAdmin ? 'badge-warning' : ''">
              {{ authStore.isAdmin ? '管理员' : '用户' }}
            </span>
          </div>
          <div class="user-info">
            <h1 class="user-name">{{ authStore.user?.nickname || authStore.user?.username }}</h1>
            <p class="user-username">@{{ authStore.user?.username }}</p>
            <p class="user-email">{{ authStore.user?.email }}</p>
          </div>
        </div>
        
        <div class="points-card">
          <div class="points-header">
            <span class="points-label">积分余额</span>
            <button class="recharge-btn" @click="showRechargeModal = true">
              充值
            </button>
          </div>
          <div class="points-value">{{ authStore.user?.points }}</div>
          <p class="points-hint">积分可用于购买付费剧集</p>
        </div>

        <div class="user-actions">
          <router-link v-if="authStore.isAdmin" to="/admin" class="btn btn-primary">
            管理后台
          </router-link>
          <button @click="openPasswordModal" class="btn btn-secondary">
            修改密码
          </button>
          <button @click="handleLogout" class="btn btn-secondary">
            退出登录
          </button>
        </div>
      </section>

      <!-- 右侧内容区 -->
      <div class="content-area">
        <!-- 购买记录 -->
        <section class="purchases-section card">
          <div class="section-header">
            <h2>我的已购</h2>
          </div>

          <div v-if="loading" class="loading-state">
            <div class="spinner"></div>
            <span>加载中...</span>
          </div>

          <div v-else-if="purchases.length === 0" class="empty-state">
            <div class="empty-icon">📭</div>
            <p>暂无购买记录</p>
            <router-link to="/" class="btn btn-primary btn-sm">去逛逛</router-link>
          </div>

          <div v-else class="purchases-list">
            <div 
              v-for="item in purchases" 
              :key="item._id" 
              class="purchase-item clickable"
              @click="openReadConfirm(item)"
            >
              <div class="purchase-info">
                <span class="purchase-project">{{ item.projectName }}</span>
                <span class="purchase-episode">第 {{ item.episodeNumber }} 集</span>
              </div>
              <div class="purchase-meta">
                <span class="purchase-cost">-{{ item.pointsCost }} 积分</span>
                <span class="purchase-date">{{ formatDate(item.purchasedAt) }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- 改写请求 -->
        <section class="requests-section card">
          <div class="section-header">
            <h2>我的改写请求</h2>
          </div>

          <div v-if="loadingRequests" class="loading-state">
            <div class="spinner"></div>
            <span>加载中...</span>
          </div>

          <div v-else-if="rewriteRequests.length === 0" class="empty-state">
            <div class="empty-icon">📝</div>
            <p>暂无改写请求</p>
          </div>

          <div v-else class="requests-list">
            <div 
              v-for="req in rewriteRequests" 
              :key="req._id" 
              class="request-item"
            >
              <div class="request-info">
                <span class="request-project">{{ req.projectName }}</span>
                <span class="request-status badge" :class="getStatusClass(req.status)">
                  {{ getStatusLabel(req.status) }}
                </span>
              </div>
              <div class="request-requirements">{{ req.requirements }}</div>
              <div class="request-meta">
                <span class="request-price">-{{ req.price }} 积分</span>
                <span class="request-date">{{ formatDate(req.createdAt) }}</span>
              </div>
              <div v-if="req.result" class="request-result">
                <strong>处理结果：</strong>{{ req.result }}
              </div>
            </div>
          </div>

          <!-- 客服联系方式 -->
          <div class="contact-hint">
            <span>辶 如有问题请联系客服微信：</span>
            <strong>Tom_de</strong>
          </div>
        </section>

        <!-- 积分流水 -->
        <section class="transactions-section card">
          <div class="section-header">
            <h2>积分明细</h2>
          </div>

          <div v-if="loadingTransactions" class="loading-state">
            <div class="spinner"></div>
            <span>加载中...</span>
          </div>

          <div v-else-if="transactions.length === 0" class="empty-state">
            <div class="empty-icon">📋</div>
            <p>暂无积分记录</p>
          </div>

          <div v-else class="transactions-list">
            <div 
              v-for="tx in transactions" 
              :key="tx._id" 
              class="transaction-item"
            >
              <div class="tx-icon" :class="tx.type">
                {{ getTypeIcon(tx.type) }}
              </div>
              <div class="tx-info">
                <span class="tx-desc">{{ tx.description }}</span>
                <span class="tx-date">{{ formatDate(tx.createdAt) }}</span>
              </div>
              <div class="tx-amount" :class="tx.amount > 0 ? 'income' : 'expense'">
                {{ tx.amount > 0 ? '+' : '' }}{{ tx.amount }}
              </div>
            </div>
          </div>
        </section>

        <!-- 我的收藏 -->
        <section class="favorites-section card">
          <div class="section-header">
            <h2>⭐ 我的收藏</h2>
          </div>

          <div v-if="loadingFavorites" class="loading-state">
            <div class="spinner"></div>
            <span>加载中...</span>
          </div>

          <div v-else-if="favorites.length === 0" class="empty-state">
            <div class="empty-icon">💫</div>
            <p>暂无收藏</p>
            <router-link to="/" class="btn btn-primary btn-sm">去发现</router-link>
          </div>

          <div v-else class="favorites-list">
            <div 
              v-for="fav in favorites" 
              :key="fav._id" 
              class="favorite-item clickable"
              @click="goToProject(fav.projectId)"
            >
              <div class="fav-info">
                <span class="fav-name">{{ fav.projectName }}</span>
                <span class="fav-desc">{{ fav.projectDescription || '暂无简介' }}</span>
              </div>
              <span class="fav-date">{{ formatDate(fav.createdAt) }}</span>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- 阅读确认弹窗 -->
    <div v-if="showReadModal" class="modal-overlay" @click.self="showReadModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">开始阅读</h3>
          <button class="modal-close" @click="showReadModal = false">×</button>
        </div>
        <div class="modal-body">
          <p class="confirm-text">
            确定要阅读 <strong>{{ selectedPurchase?.projectName }}</strong> 的 
            <strong>第 {{ selectedPurchase?.episodeNumber }} 集</strong> 吗？
          </p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showReadModal = false">取消</button>
          <button class="btn btn-primary" @click="goToRead">开始阅读</button>
        </div>
      </div>
    </div>

    <!-- 修改密码弹窗 -->
    <div v-if="passwordModal.visible" class="modal-overlay" @click.self="passwordModal.visible = false">
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">修改密码</h3>
          <button class="modal-close" @click="passwordModal.visible = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>旧密码</label>
            <input 
              v-model="passwordModal.oldPassword" 
              type="password"
              placeholder="请输入当前密码"
              class="input"
            />
          </div>
          <div class="form-group">
            <label>新密码</label>
            <input 
              v-model="passwordModal.newPassword" 
              type="password"
              placeholder="至少6个字符"
              class="input"
            />
          </div>
          <div class="form-group">
            <label>确认新密码</label>
            <input 
              v-model="passwordModal.confirmPassword" 
              type="password"
              placeholder="再次输入新密码"
              class="input"
            />
          </div>
          <p v-if="passwordModal.error" class="error-message">{{ passwordModal.error }}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="passwordModal.visible = false">取消</button>
          <button 
            class="btn btn-primary" 
            @click="changePassword"
            :disabled="changingPassword"
          >
            {{ changingPassword ? '修改中...' : '确认修改' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 充值弹窗 -->
    <div v-if="showRechargeModal" class="modal-overlay" @click.self="showRechargeModal = false">
      <div class="modal recharge-modal">
        <div class="modal-header">
          <h3 class="modal-title">积分充值</h3>
          <button class="modal-close" @click="showRechargeModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="recharge-info">
            <p class="recharge-desc">充值请联系官方客服，支持微信、支付宝转账</p>
            <div class="contact-card">
              <span class="contact-icon">💬</span>
              <div class="contact-details">
                <span class="contact-label">客服微信</span>
                <span class="contact-wechat">Tom_de</span>
              </div>
            </div>
            <p class="recharge-note">添加微信后，发送您的用户名和充值金额，客服将在24小时内为您处理</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" @click="showRechargeModal = false">我知道了</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import http, { buyerApi } from '@/services/api';

const router = useRouter();
const authStore = useAuthStore();

interface PurchaseItem {
  _id: string;
  projectId: string;
  projectName: string;
  episodeNumber: number;
  pointsCost: number;
  purchasedAt: string;
}

const purchases = ref<PurchaseItem[]>([]);
const loading = ref(true);
const showReadModal = ref(false);
const showRechargeModal = ref(false);
const selectedPurchase = ref<PurchaseItem | null>(null);

// 改写请求
interface RewriteRequestItem {
  _id: string;
  projectId: string;
  projectName: string;
  status: string;
  price: number;
  requirements: string;
  result?: string;
  createdAt: string;
}
const rewriteRequests = ref<RewriteRequestItem[]>([]);
const loadingRequests = ref(true);

// 积分流水
interface TransactionItem {
  _id: string;
  type: string;
  amount: number;
  balance: number;
  description: string;
  createdAt: string;
}
const transactions = ref<TransactionItem[]>([]);
const loadingTransactions = ref(true);

// 收藏
interface FavoriteItem {
  _id: string;
  projectId: string;
  projectName: string;
  projectDescription: string;
  createdAt: string;
}
const favorites = ref<FavoriteItem[]>([]);
const loadingFavorites = ref(true);

// 修改密码
const passwordModal = reactive({
  visible: false,
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
  error: ''
});
const changingPassword = ref(false);

onMounted(async () => {
  // 加载购买记录
  try {
    const response = await buyerApi.getPurchases() as any;
    purchases.value = response.purchases || [];
  } catch (err) {
    console.error('Failed to load purchases:', err);
  } finally {
    loading.value = false;
  }
  
  // 加载改写请求
  try {
    const res = await http.get('/buyer/rewrite-requests') as any;
    rewriteRequests.value = res.requests || [];
  } catch (err) {
    console.error('Failed to load rewrite requests:', err);
  } finally {
    loadingRequests.value = false;
  }

  // 加载积分流水
  try {
    const txRes = await buyerApi.getTransactions({ limit: 50 }) as any;
    transactions.value = txRes.transactions || [];
  } catch (err) {
    console.error('Failed to load transactions:', err);
  } finally {
    loadingTransactions.value = false;
  }

  // 加载收藏列表
  try {
    const favRes = await buyerApi.getFavorites() as any;
    favorites.value = favRes.favorites || [];
  } catch (err) {
    console.error('Failed to load favorites:', err);
  } finally {
    loadingFavorites.value = false;
  }
});

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function handleLogout() {
  authStore.logout();
  router.push('/');
}

function goToProject(projectId: string) {
  router.push(`/projects/${projectId}`);
}

function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    recharge: '💎',
    purchase: '📖',
    rewrite: '✍️',
    refund: '↩️',
    admin_adjust: '⚙️',
  };
  return icons[type] || '💰';
}

function openReadConfirm(item: PurchaseItem) {
  selectedPurchase.value = item;
  showReadModal.value = true;
}

function goToRead() {
  if (selectedPurchase.value) {
    const { projectId, episodeNumber } = selectedPurchase.value;
    showReadModal.value = false;
    router.push(`/projects/${projectId}/read/${episodeNumber}`);
  }
}

function getStatusClass(status: string): string {
  const map: Record<string, string> = {
    'paid': 'badge-warning',
    'processing': 'badge-info',
    'completed': 'badge-success',
    'rejected': 'badge-error',
  };
  return map[status] || '';
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    'pending': '待支付',
    'paid': '已支付',
    'processing': '处理中',
    'completed': '已完成',
    'rejected': '已拒绝',
    'cancelled': '已取消',
  };
  return map[status] || status;
}

// 打开修改密码弹窗
function openPasswordModal() {
  passwordModal.visible = true;
  passwordModal.oldPassword = '';
  passwordModal.newPassword = '';
  passwordModal.confirmPassword = '';
  passwordModal.error = '';
}

// 修改密码
async function changePassword() {
  passwordModal.error = '';

  // 验证输入
  if (!passwordModal.oldPassword || !passwordModal.newPassword || !passwordModal.confirmPassword) {
    passwordModal.error = '请填写所有字段';
    return;
  }

  if (passwordModal.newPassword.length < 6) {
    passwordModal.error = '新密码长度至少6个字符';
    return;
  }

  if (passwordModal.newPassword !== passwordModal.confirmPassword) {
    passwordModal.error = '两次输入的新密码不一致';
    return;
  }

  changingPassword.value = true;
  try {
    await http.put('/auth/me/password', {
      oldPassword: passwordModal.oldPassword,
      newPassword: passwordModal.newPassword
    });

    alert('密码修改成功，请重新登录');
    authStore.logout();
    router.push('/login');
  } catch (error: any) {
    passwordModal.error = error.response?.data?.error || '修改密码失败';
  } finally {
    changingPassword.value = false;
  }
}
</script>

<style scoped>
.profile-page {
  min-height: calc(100vh - 64px);
  padding: var(--space-8) 0;
}

.profile-container {
  display: grid;
  gap: var(--space-6);
  max-width: 900px;
}

@media (min-width: 768px) {
  .profile-container {
    grid-template-columns: 320px 1fr;
    align-items: start;
  }
}

/* 用户信息卡 */
.user-card {
  padding: var(--space-6);
}

.user-header {
  display: flex;
  gap: var(--space-5);
  margin-bottom: var(--space-6);
}

.avatar-wrapper {
  position: relative;
}

.avatar {
  width: 80px;
  height: 80px;
  background: var(--gradient-primary);
  color: white;
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 700;
}

.user-role {
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
}

.user-info {
  flex: 1;
}

.user-name {
  font-size: var(--text-xl);
  font-weight: 700;
  margin-bottom: var(--space-1);
}

.user-username {
  color: var(--text-muted);
  font-size: var(--text-sm);
  margin-bottom: var(--space-1);
}

.user-email {
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

/* 积分卡 */
.points-card {
  background: var(--gradient-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  color: white;
  margin-bottom: var(--space-5);
}

.points-header {
  margin-bottom: var(--space-2);
}

.points-label {
  font-size: var(--text-sm);
  opacity: 0.9;
}

.points-value {
  font-size: var(--text-4xl);
  font-weight: 700;
  margin-bottom: var(--space-2);
}

.points-hint {
  font-size: var(--text-xs);
  opacity: 0.7;
}

.user-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* 购买记录 */
/* 右侧内容区 */
.content-area {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* 内容卡片共用样式 */
.purchases-section,
.requests-section {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  overflow: hidden;
  padding: 0;
}

.section-header {
  padding: var(--space-5);
  border-bottom: 1px solid var(--border-color);
}

.section-header h2 {
  font-size: var(--text-lg);
  font-weight: 600;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12);
  color: var(--text-muted);
  gap: var(--space-4);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon {
  font-size: 48px;
}

.purchases-list {
  display: flex;
  flex-direction: column;
}

.purchase-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-radius: 0;
  border: none;
  border-bottom: 1px solid var(--border-color);
}

.purchase-item:last-child {
  border-bottom: none;
}

.purchase-item:hover {
  transform: none;
  box-shadow: none;
  background: var(--bg-hover);
}

.purchase-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.purchase-project {
  font-weight: 500;
}

.purchase-episode {
  font-size: var(--text-sm);
  color: var(--primary);
}

.purchase-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-1);
}

.purchase-cost {
  font-weight: 600;
  color: var(--error);
}

.purchase-date {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* 可点击样式 */
.purchase-item.clickable {
  cursor: pointer;
  transition: all var(--duration-fast);
}

.purchase-item.clickable:hover {
  background: var(--primary-lighter);
}

/* 确认弹窗文本 */
.confirm-text {
  font-size: var(--text-base);
  color: var(--text-secondary);
  line-height: 1.8;
  text-align: center;
}

.confirm-text strong {
  color: var(--primary);
}

/* 改写请求列表 */
.requests-list {
  display: flex;
  flex-direction: column;
}

.request-item {
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border-color);
}

.request-item:last-child {
  border-bottom: none;
}

.request-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
}

.request-project {
  font-weight: 600;
  color: var(--text-primary);
}

.request-requirements {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  line-height: 1.6;
  margin-bottom: var(--space-2);
  padding: var(--space-2);
  background: var(--bg-subtle);
  border-radius: var(--radius-sm);
}

.request-meta {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-sm);
}

.request-price {
  color: var(--error);
  font-weight: 500;
}

.request-date {
  color: var(--text-muted);
}

.request-result {
  margin-top: var(--space-2);
  padding: var(--space-2);
  background: var(--success-bg);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--success);
}

/* 状态徽章颜色 */
.badge-info {
  background: var(--info);
  color: white;
}

.badge-error {
  background: var(--error);
  color: white;
}

/* 客服联系提示 */
.contact-hint {
  padding: var(--space-3) var(--space-5);
  background: var(--bg-subtle);
  border-top: 1px solid var(--border-color);
  font-size: var(--text-sm);
  color: var(--text-muted);
  text-align: center;
}

.contact-hint strong {
  color: #f59e0b;
  user-select: all;
}

/* 密码弹窗表单 */
.form-group {
  margin-bottom: var(--space-4);
}

.form-group label {
  display: block;
  margin-bottom: var(--space-2);
  font-weight: 500;
  color: var(--text-primary);
}

.form-group .input {
  width: 100%;
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.form-group .input:focus {
  outline: none;
  border-color: var(--primary);
}

.error-message {
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--error);
  border-radius: var(--radius-sm);
  color: var(--error);
  font-size: var(--text-sm);
}

/* 积分流水 */
.transactions-section {
  margin-top: var(--space-4);
}

.transactions-list {
  padding: 0 var(--space-5);
}

.transaction-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border-color);
}

.transaction-item:last-child {
  border-bottom: none;
}

.tx-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  font-size: 18px;
  flex-shrink: 0;
}

.tx-icon.recharge {
  background: rgba(16, 185, 129, 0.1);
}

.tx-icon.purchase {
  background: rgba(59, 130, 246, 0.1);
}

.tx-icon.rewrite {
  background: rgba(168, 85, 247, 0.1);
}

.tx-icon.refund {
  background: rgba(245, 158, 11, 0.1);
}

.tx-icon.admin_adjust {
  background: rgba(107, 114, 128, 0.1);
}

.tx-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.tx-desc {
  font-size: var(--text-sm);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tx-date {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.tx-amount {
  font-weight: 600;
  font-size: var(--text-base);
  flex-shrink: 0;
}

.tx-amount.income {
  color: var(--success);
}

.tx-amount.expense {
  color: var(--error);
}

/* 收藏列表 */
.favorites-section {
  margin-top: var(--space-4);
}

.favorites-list {
  padding: 0 var(--space-5);
}

.favorite-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border-color);
}

.favorite-item:last-child {
  border-bottom: none;
}

.fav-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.fav-name {
  font-weight: 600;
  color: var(--text-primary);
}

.fav-desc {
  font-size: var(--text-xs);
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fav-date {
  font-size: var(--text-xs);
  color: var(--text-muted);
  flex-shrink: 0;
}

/* 充值按钮 */
.recharge-btn {
  padding: var(--space-1) var(--space-3);
  background: linear-gradient(135deg, #8b5cf6, #a855f7);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--duration-fast);
}

.recharge-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

/* 充值弹窗 */
.recharge-modal {
  max-width: 400px;
}

.recharge-info {
  text-align: center;
}

.recharge-desc {
  color: var(--text-secondary);
  margin-bottom: var(--space-4);
}

.contact-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(168, 85, 247, 0.1));
  border: 1px dashed var(--primary);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-4);
}

.contact-icon {
  font-size: 32px;
}

.contact-details {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.contact-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.contact-wechat {
  font-size: var(--text-lg);
  font-weight: 700;
  color: #f59e0b;
  user-select: all;
}

.recharge-note {
  font-size: var(--text-xs);
  color: var(--text-muted);
  line-height: 1.6;
}

/* 移动端优化 - 全面重设计 */
@media (max-width: 768px) {
  .profile-page {
    padding: 0;
    padding-bottom: calc(var(--bottom-nav-height) + var(--space-8));
    background: linear-gradient(180deg, var(--primary) 0%, var(--bg-page) 200px);
  }

  .profile-container {
    display: flex;
    flex-direction: column;
    flex-wrap: wrap;
    padding: 0;
    gap: 0;
  }

  /* 用户卡片 - 顶部个人信息区 */
  .user-card {
    width: 100%;
    max-width: none;
    background: transparent;
    border: none;
    box-shadow: none;
    padding: var(--space-6) var(--space-4) var(--space-4);
  }

  .user-header {
    flex-direction: column;
    text-align: center;
    gap: var(--space-4);
    margin-bottom: var(--space-5);
  }

  .avatar-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 0;
  }

  .avatar {
    width: 88px;
    height: 88px;
    font-size: 36px;
    border-radius: var(--radius-2xl);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    border: 3px solid rgba(255, 255, 255, 0.3);
  }

  .user-role {
    position: static;
    transform: none;
    margin-top: var(--space-2);
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-xs);
    border-radius: var(--radius-full);
  }

  .user-info {
    text-align: center;
    color: white;
  }

  .user-name {
    font-size: var(--text-xl);
    font-weight: 700;
    color: white;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .user-username,
  .user-email {
    color: rgba(255, 255, 255, 0.8);
  }

  /* 积分卡 - 玻璃拟态风格 */
  .points-card {
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: var(--radius-xl);
    padding: var(--space-4);
    margin: 0 var(--space-4) var(--space-4);
  }

  .points-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-3);
  }

  .points-label {
    font-size: var(--text-sm);
    font-weight: 500;
  }

  .recharge-btn {
    background: rgba(255, 255, 255, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.3);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-full);
    font-size: var(--text-sm);
    font-weight: 600;
    transition: all 0.2s;
  }

  .recharge-btn:active {
    transform: scale(0.95);
    background: rgba(255, 255, 255, 0.35);
  }

  .points-value {
    font-size: 48px;
    font-weight: 800;
    letter-spacing: -1px;
    margin-bottom: var(--space-2);
  }

  .points-hint {
    font-size: var(--text-xs);
    opacity: 0.8;
  }

  /* 操作按钮组 - 移动端放到页面底部 */
  .user-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
    padding: var(--space-4);
    margin-top: var(--space-4);
    order: 99; /* 移动到最后 */
    background: var(--bg-card);
    border-radius: var(--radius-xl);
    margin-left: var(--space-4);
    margin-right: var(--space-4);
  }

  .user-actions .btn {
    width: 100%;
    justify-content: center;
    padding: var(--space-3);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
    font-weight: 600;
    background: var(--bg-elevated);
    border: 1px solid var(--border-color);
  }

  .user-actions .btn-primary {
    grid-column: span 2;
    background: var(--gradient-primary);
    border: none;
    color: white;
  }

  /* 内容区域 */
  .content-area {
    width: 100%;
    padding: var(--space-4);
    gap: var(--space-4);
    order: 1; /* 放在用户信息之后 */
  }

  /* 内容卡片 */
  .purchases-section,
  .requests-section,
  .transactions-section,
  .favorites-section {
    border-radius: var(--radius-xl);
    overflow: hidden;
  }

  .section-header {
    padding: var(--space-4);
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border-color);
  }

  .section-header h2 {
    font-size: var(--text-base);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  /* 列表项优化 */
  .purchase-item,
  .request-item,
  .transaction-item,
  .favorite-item {
    padding: var(--space-4);
    border-bottom: 1px solid var(--border-color);
    transition: background 0.15s;
  }

  .purchase-item:last-child,
  .request-item:last-child,
  .transaction-item:last-child,
  .favorite-item:last-child {
    border-bottom: none;
  }

  .purchase-item:active,
  .favorite-item:active {
    background: var(--bg-hover);
  }

  .purchase-info,
  .request-info,
  .tx-info,
  .fav-info {
    font-size: var(--text-sm);
    margin-bottom: var(--space-2);
  }

  .purchase-project,
  .request-project {
    font-weight: 600;
    color: var(--text-primary);
  }

  .purchase-episode {
    color: var(--text-muted);
    margin-left: var(--space-2);
  }

  .purchase-meta,
  .request-meta,
  .tx-meta {
    display: flex;
    justify-content: space-between;
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  .purchase-cost,
  .tx-amount.negative {
    color: var(--error);
    font-weight: 600;
  }

  .tx-amount.positive {
    color: var(--success);
    font-weight: 600;
  }

  /* 空状态 */
  .empty-state {
    padding: var(--space-8);
    text-align: center;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: var(--space-3);
  }

  /* 模态框 */
  .modal {
    width: calc(100vw - var(--space-8));
    max-height: calc(100vh - var(--space-16));
    margin: var(--space-4);
    border-radius: var(--radius-xl);
  }

  .modal-body {
    padding: var(--space-5);
  }
}

/* 极小屏幕 */
@media (max-width: 374px) {
  .profile-container {
    padding: 0;
  }

  .avatar {
    width: 72px;
    height: 72px;
    font-size: 28px;
  }

  .user-name {
    font-size: var(--text-lg);
  }

  .points-value {
    font-size: 36px;
  }

  .points-card {
    margin: 0 var(--space-3) var(--space-3);
    padding: var(--space-3);
  }

  .user-actions {
    padding: 0 var(--space-3);
  }

  .content-area {
    padding: var(--space-3);
  }
}
</style>
