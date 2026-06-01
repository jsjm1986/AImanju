<template>
  <div class="project-page">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error-state">
      <div class="error-icon">⚠️</div>
      <p>{{ error }}</p>
      <router-link to="/" class="btn btn-primary">返回首页</router-link>
    </div>

    <!-- 主内容 -->
    <template v-else-if="project">
      <!-- Hero 区域 -->
      <section class="hero">
        <div class="hero-bg" :style="{ background: getHeroGradient(project.name) }"></div>
        <div class="hero-content container">
          <div class="hero-info">
            <h1 class="hero-title">{{ project.name }}</h1>
            <p class="hero-desc">{{ project.description || '暂无简介' }}</p>
            <div class="hero-meta">
              <span class="meta-item">
                <span class="meta-icon">📺</span>
                {{ episodes.length }} 集
              </span>
              <span class="meta-item">
                <span class="meta-icon">🎬</span>
                {{ project.genre || '未分类' }}
              </span>
              <span class="meta-item free-badge" v-if="publishConfig.freeEpisodeCount">
                <span class="meta-icon">FREE</span>                前{{ publishConfig.freeEpisodeCount }}集免费
              </span>
              <button 
                v-if="authStore.isAuthenticated"
                class="favorite-btn" 
                :class="{ active: isFavorited }"
                @click="toggleFavorite"
                :disabled="togglingFavorite"
              >
                <span class="fav-icon">{{ isFavorited ? '❤️' : '🤍' }}</span>
                <span class="fav-text">{{ isFavorited ? '已收藏' : '收藏' }}</span>
              </button>
            </div>
          </div>
          <div class="hero-price">
            <div class="price-card">
              <span class="price-label">单集价格</span>
              <span class="price-value">{{ publishConfig.pricePerEpisode || 10 }}</span>
              <span class="price-unit">积分</span>
            </div>
            <!-- 改写服务卡片（仅支持改写的项目显示） -->
            <div v-if="publishConfig.supportsRewrite" class="rewrite-card">
              <div class="rewrite-info">
                <span class="rewrite-icon">改</span>                <span class="rewrite-label">支持改写服务</span>
                <span class="rewrite-price">{{ publishConfig.rewritePrice || 0 }} 积分</span>
              </div>
              <button 
                v-if="hasPurchasedAny"
                class="btn btn-rewrite" 
                @click="openRewriteModal"
              >
                申请改写
              </button>
              <p v-else class="rewrite-note">
                购买剧集后可申请改写
              </p>
              <div class="rewrite-contact">
                <span class="contact-label">💬 客服微信：</span>
                <span class="contact-value">Tom_de</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 标签页导航 -->
      <div class="tabs-wrapper container">
        <nav class="tabs-nav">
          <button 
            v-for="tab in tabs" 
            :key="tab.id"
            class="tab-btn"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <span class="tab-label">{{ tab.label }}</span>
            <span v-if="tab.count" class="tab-count">{{ tab.count }}</span>
          </button>
        </nav>
      </div>

      <!-- 标签页内容 -->
      <div class="tabs-content container">
        <!-- 剧情大纲 -->
        <section v-show="activeTab === 'synopsis'" class="tab-panel">
          <div v-if="!getSynopsis" class="empty-panel">
            <span class="empty-icon">暂无</span>            <p>暂无剧情大纲</p>
          </div>
          <div v-else class="outline-card">
            <div class="outline-content" v-html="formatSynopsis(getSynopsis)"></div>
          </div>
        </section>

        <!-- 分集梗概 -->
        <section v-show="activeTab === 'episodeSummaries'" class="tab-panel">
          <div v-if="!getEpisodeSummaries" class="empty-panel">
            <span class="empty-icon">📝</span>
            <p>暂无分集梗概</p>
          </div>
          <EpisodeSummaryCard
            v-else
            :summary-text="getEpisodeSummaries"
            :free-episode-count="publishConfig.freeEpisodeCount || 0"
            :price-per-episode="publishConfig.pricePerEpisode || 10"
            :purchased-episode-numbers="purchasedEpisodeNumbers"
            :total-episodes="episodes.length"
            @select="handleEpisodeSummaryClick"
          />
        </section>

        <!-- 角色 -->
        <section v-show="activeTab === 'characters'" class="tab-panel">
          <div v-if="characters.length === 0" class="empty-panel">
            <span class="empty-icon">👥</span>
            <p>暂无角色信息</p>
          </div>
          <CharacterDetailCard v-else :characters="characters" />
        </section>

        <!-- 剧集 -->
        <section v-show="activeTab === 'episodes'" class="tab-panel">
          <div v-if="episodes.length === 0" class="empty-panel">
            <span class="empty-icon">📺</span>
            <p>暂无剧集</p>
          </div>
          <EpisodeList 
            v-else
            :episodes="episodes"
            :free-episode-count="publishConfig.freeEpisodeCount || 0"
            :price-per-episode="publishConfig.pricePerEpisode || 10"
            :purchased-episode-ids="purchasedEpisodeIds"
            @select="handleEpisodeSelect"
          />
        </section>
      </div>
    </template>

    <!-- 购买确认弹窗 -->
    <div v-if="purchaseModal.visible" class="modal-overlay" @click.self="purchaseModal.visible = false">
      <div class="modal-content">
        <h3>购买剧集</h3>        <p class="modal-episode">第 {{ purchaseModal.episode?.episodeNumber }} 集</p>
        <p class="modal-price">需要 <strong>{{ publishConfig.pricePerEpisode }}</strong> 积分</p>
        <p class="modal-balance">当前余额：{{ authStore.user?.points || 0 }} 积分</p>
        <div class="modal-actions">
          <button @click="purchaseModal.visible = false" class="btn btn-secondary">取消</button>
          <button 
            @click="confirmPurchase" 
            class="btn btn-primary" 
            :disabled="purchasing || (authStore.user?.points || 0) < publishConfig.pricePerEpisode"
          >
            {{ purchasing ? '处理中...' : '确认购买' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 改写申请弹窗 -->
    <div v-if="rewriteModal.visible" class="modal-overlay" @click.self="rewriteModal.visible = false">
      <div class="modal-content">
        <h3>申请改写服务</h3>        <p class="modal-project">{{ project?.name }}</p>
        
        <div class="modal-info">
          <span class="info-label">服务价格</span>
          <span class="info-value">{{ publishConfig.rewritePrice || 0 }} 积分</span>
        </div>
        <div class="modal-info">
          <span class="info-label">当前余额</span>
          <span class="info-value" :class="{ insufficient: (authStore.user?.points || 0) < (publishConfig.rewritePrice || 0) }">
            {{ authStore.user?.points || 0 }} 积分
          </span>
        </div>
        
        <!-- 价格说明 -->
        <div class="price-notice">
          <p>💡 <strong>{{ publishConfig.rewritePrice || 1000 }} 积分</strong> 为基础改写费用</p>
          <p>根据改写内容和具体需求，实际费用可能有所调整</p>
          <p class="notice-contact">建议先添加客服微信 <strong>Tom_de</strong> 了解详情</p>
        </div>
        
        <div class="form-group">
          <label>改写需求描述 <span class="required">*</span></label>
          <textarea 
            v-model="rewriteModal.requirements" 
            placeholder="请详细描述您的改写需求，至少10个字符..."
            rows="5"
            maxlength="2000"
          ></textarea>
          <div class="char-hint">
            <span class="char-count">{{ rewriteModal.requirements.length }}/2000</span>
            <span v-if="rewriteModal.requirements.length < 10" class="hint-error">
              至少需要10个字符（还差{{ 10 - rewriteModal.requirements.length }}个）
            </span>
          </div>
        </div>
        
        <div class="modal-actions">
          <button @click="rewriteModal.visible = false" class="btn btn-secondary">取消</button>
          <button 
            @click="submitRewriteRequest" 
            class="btn btn-primary"
            :disabled="submittingRewrite || rewriteModal.requirements.length < 10 || (authStore.user?.points || 0) < (publishConfig.rewritePrice || 0)"
          >
            {{ submittingRewrite ? '提交中...' : '确认支付并提交' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import http, { buyerApi } from '@/services/api';
import CharacterDetailCard from '@/components/CharacterDetailCard.vue';
import EpisodeList from '@/components/EpisodeList.vue';
import EpisodeSummaryCard from '@/components/EpisodeSummaryCard.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const projectId = computed(() => route.params.id as string);

// 数据状态
const loading = ref(true);
const error = ref('');
const project = ref<any>(null);
const publishConfig = ref<any>({});
const characters = ref<any[]>([]);
const episodes = ref<any[]>([]);
const purchasedEpisodeIds = ref<string[]>([]);

// 收藏状态
const isFavorited = ref(false);
const togglingFavorite = ref(false);

// 改写请求弹窗
const rewriteModal = reactive({
  visible: false,
  requirements: '',
});
const submittingRewrite = ref(false);

// 是否已购买任意剧集（用于判断是否可申请改写）
const hasPurchasedAny = computed(() => purchasedEpisodeIds.value.length > 0);

// 标签页
const activeTab = ref<'synopsis' | 'episodeSummaries' | 'characters' | 'episodes'>('episodes');
const tabs = computed(() => [
  { id: 'synopsis' as const, label: '剧情大纲', count: null },
  { id: 'episodeSummaries' as const, label: '分集梗概', count: null },
  { id: 'characters' as const, label: '主要角色', count: characters.value.length || null },
  { id: 'episodes' as const, label: '剧集列表', count: episodes.value.length || null },
]);

// 从 outline 对象中提取内容
const getSynopsis = computed(() => {
  const outline = project.value?.outline;
  if (!outline) return '';
  if (typeof outline === 'string') {
    const match = outline.match(/[二、]*剧情大纲[\s\S]*?(?=[三、]*分集梗概|$)/i);
    return match ? match[0].replace(/^[二、]*剧情大纲\s*/i, '').trim() : '';
  }
  return outline.synopsis || '';
});

const getEpisodeSummaries = computed(() => {
  const outline = project.value?.outline;
  if (!outline) return '';
  if (typeof outline === 'string') {
    const match = outline.match(/[三、]*分集梗概[\s\S]*/i);
    return match ? match[0].replace(/^[三、]*分集梗概\s*/i, '').trim() : '';
  }
  return outline.episodeSummaries || '';
});

// 格式化剧情大纲
function formatSynopsis(text: string) {
  if (!text) return '';
  return text
    .split('\n')
    .filter(line => line.trim())
    .map(line => `<p class="synopsis-paragraph">${escapeHtml(line.trim())}</p>`)
    .join('');
}


function escapeHtml(text: string) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 将 purchasedEpisodeIds 转换为 episodeNumber 数组
const purchasedEpisodeNumbers = computed(() => {
  return episodes.value
    .filter(ep => purchasedEpisodeIds.value.includes(ep._id))
    .map(ep => ep.episodeNumber);
});

// 点击分集梗概卡片
function handleEpisodeSummaryClick(episode: { number: number }) {
  const targetEpisode = episodes.value.find(ep => ep.episodeNumber === episode.number);
  if (targetEpisode) {
    handleEpisodeSelect(targetEpisode);
  } else {
    // 如果找不到对应剧集，直接跳转（可能是免费集）
    const isFree = episode.number <= (publishConfig.value.freeEpisodeCount || 0);
    if (isFree) {
      router.push(`/projects/${projectId.value}/read/${episode.number}`);
    }
  }
}

// 购买弹窗
const purchaseModal = reactive({
  visible: false,
  episode: null as any,
});
const purchasing = ref(false);

onMounted(async () => {
  await loadProjectData();
});

async function loadProjectData() {
  loading.value = true;
  error.value = '';
  
  try {
    const response = await buyerApi.getProject(projectId.value) as any;
    project.value = response.project;
    publishConfig.value = response.publishConfig || {};
    characters.value = response.characters || [];
    episodes.value = response.episodes || [];
    purchasedEpisodeIds.value = response.purchasedEpisodeIds || [];

    // 检查收藏状态
    if (authStore.isAuthenticated) {
      try {
        const favRes = await buyerApi.getFavorites() as any;
        const favorites = favRes.favorites || [];
        isFavorited.value = favorites.some((f: any) => f.projectId === projectId.value);
      } catch {
        // 获取收藏状态失败不影响页面
      }
    }
  } catch (err: any) {
    error.value = err.error || '加载项目失败';
  } finally {
    loading.value = false;
  }
}

async function toggleFavorite() {
  if (!authStore.isAuthenticated || togglingFavorite.value) return;
  
  togglingFavorite.value = true;
  try {
    if (isFavorited.value) {
      await buyerApi.removeFavorite(projectId.value);
      isFavorited.value = false;
    } else {
      await buyerApi.addFavorite(projectId.value);
      isFavorited.value = true;
    }
  } catch (err: any) {
    console.error('Toggle favorite failed:', err);
  } finally {
    togglingFavorite.value = false;
  }
}

function getHeroGradient(name: string) {
  const gradients = [
    'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)',
    'linear-gradient(135deg, #0c4a6e, #1e3a8a)',
    'linear-gradient(135deg, #701a75, #581c87)',
    'linear-gradient(135deg, #064e3b, #1e3a5f)',
    'linear-gradient(135deg, #7c2d12, #78350f)',
  ];
  const index = name.charCodeAt(0) % gradients.length;
  return gradients[index];
}

function handleEpisodeSelect(episode: any) {
  const FREE_LIMIT = 5;
  const POINTS_LIMIT = 20;
  const epNum = episode.episodeNumber;
  const isPurchased = purchasedEpisodeIds.value.includes(episode._id);
  
  // 层1：1-5集免费
  if (epNum <= FREE_LIMIT) {
    router.push(`/projects/${projectId.value}/read/${episode.episodeNumber}`);
    return;
  }
  
  // 已购买的直接阅读
  if (isPurchased) {
    router.push(`/projects/${projectId.value}/read/${episode.episodeNumber}`);
    return;
  }
  
  // 未登录需要登录
  if (!authStore.isAuthenticated) {
    router.push({ name: 'Login', query: { redirect: route.fullPath } });
    return;
  }
  
  // 层2：6-20集积分购买
  if (epNum <= POINTS_LIMIT) {
    purchaseModal.episode = episode;
    purchaseModal.visible = true;
    return;
  }
  
  // 层3：21集+需购买整本剧本
  alert(`第${epNum}集及以后需购买完整剧本\n\n请联系客服微信：Tom_de\n\n支持版权购买或合作分成`);
}

async function confirmPurchase() {
  if (!purchaseModal.episode) return;
  
  purchasing.value = true;
  try {
    await buyerApi.purchaseEpisode(purchaseModal.episode._id);
    purchasedEpisodeIds.value.push(purchaseModal.episode._id);
    purchaseModal.visible = false;
    // 跳转阅读
    router.push(`/projects/${projectId.value}/read/${purchaseModal.episode.episodeNumber}`);
  } catch (err: any) {
    alert(err.error || '购买失败');
  } finally {
    purchasing.value = false;
  }
}

// 改写请求功能
function openRewriteModal() {
  if (!authStore.isAuthenticated) {
    router.push({ name: 'Login', query: { redirect: route.fullPath } });
    return;
  }
  rewriteModal.requirements = '';
  rewriteModal.visible = true;
}

async function submitRewriteRequest() {
  if (submittingRewrite.value) return;
  
  submittingRewrite.value = true;
  try {
    const response = await http.post(`/buyer/projects/${projectId.value}/rewrite-request`, {
      requirements: rewriteModal.requirements,
    }) as any;
    
    // 更新用户积分
    if (response.newBalance !== undefined) {
      authStore.updatePoints(response.newBalance);
    }
    
    rewriteModal.visible = false;
    alert('改写请求已提交！您可以在个人中心查看请求状态。');
  } catch (err: any) {
    alert(err.error || '提交失败');
  } finally {
    submittingRewrite.value = false;
  }
}
</script>

<style scoped>
.project-page {
  min-height: calc(100vh - 64px);
}

/* 加载/错误状态 */
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16);
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

.error-icon {
  font-size: 48px;
}

/* Hero 区域 */
.hero {
  position: relative;
  padding: var(--space-12) 0;
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  inset: 0;
  z-index: -1;
}

.hero-bg::before {
  content: '';
  position: absolute;
  inset: 0;
  background: 
    radial-gradient(circle at 20% 50%, rgba(99, 102, 241, 0.3) 0%, transparent 50%),
    radial-gradient(circle at 80% 50%, rgba(236, 72, 153, 0.3) 0%, transparent 50%);
}

.hero-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-8);
}

@media (max-width: 768px) {
  .hero-content {
    flex-direction: column;
  }
}

.hero-info {
  flex: 1;
}

.hero-title {
  font-size: var(--text-3xl);
  font-weight: 700;
  color: white;
  margin-bottom: var(--space-3);
}

@media (min-width: 768px) {
  .hero-title {
    font-size: var(--text-4xl);
  }
}

.hero-desc {
  font-size: var(--text-base);
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.6;
  margin-bottom: var(--space-6);
  max-width: 600px;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  color: white;
}

.meta-item.free-badge {
  background: rgba(16, 185, 129, 0.3);
}

.hero-price {
  flex-shrink: 0;
}

.price-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-5);
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-xl);
  min-width: 120px;
}

.price-label {
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: var(--space-1);
}

.price-value {
  font-size: var(--text-3xl);
  font-weight: 700;
  color: white;
}

.price-unit {
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.7);
}

/* 标签页导航 */
.tabs-wrapper {
  margin-top: calc(-1 * var(--space-6));
  margin-bottom: var(--space-6);
}

.tabs-nav {
  display: flex;
  gap: var(--space-2);
  background: var(--bg-card);
  padding: var(--space-2);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.tab-btn:hover {
  background: var(--bg-hover);
  color: var(--primary);
}

.tab-btn.active {
  background: var(--gradient-primary);
  color: white;
}

.tab-icon {
  font-size: 16px;
}

.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
}

.tab-btn.active .tab-count {
  background: rgba(255, 255, 255, 0.3);
}

/* 标签页内容 */
.tabs-content {
  padding-bottom: var(--space-12);
}

.tab-panel {
  animation: fadeIn var(--duration-normal) var(--ease-out);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.empty-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16);
  color: var(--text-muted);
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: var(--space-4);
}

/* 大纲卡片 */
.outline-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
}

.outline-content :deep(.synopsis-paragraph) {
  font-size: var(--text-base);
  line-height: 1.9;
  color: var(--text-secondary);
  margin-bottom: var(--space-4);
  text-indent: 2em;
}

.outline-content :deep(.episode-title) {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--primary);
  margin: var(--space-6) 0 var(--space-3);
  padding-left: var(--space-3);
  border-left: 3px solid var(--primary);
}

.outline-content :deep(.episode-title:first-child) {
  margin-top: 0;
}

.outline-content :deep(.episode-summary-text) {
  font-size: var(--text-sm);
  line-height: 1.8;
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
  padding-left: var(--space-4);
}

/* 购买弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  width: 90%;
  max-width: 400px;
  border: 1px solid var(--border-color);
}

.modal-content h3 {
  margin-bottom: var(--space-4);
}

.modal-episode {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.modal-price,
.modal-balance {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  margin-bottom: var(--space-2);
}

.modal-price strong {
  color: var(--primary);
}

.modal-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  margin-top: var(--space-6);
}

/* 改写服务卡片 */
.rewrite-card {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.1));
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin-top: var(--space-4);
}

.rewrite-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.rewrite-icon {
  font-size: var(--text-xl);
}

.rewrite-label {
  color: #f59e0b;
  font-weight: 600;
}

.rewrite-price {
  margin-left: auto;
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.btn-rewrite {
  width: 100%;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: white;
  border: none;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--duration-fast);
}

.btn-rewrite:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
}

.btn-rewrite:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.rewrite-note {
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-align: center;
  margin: 0;
}

.rewrite-contact {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px dashed rgba(245, 158, 11, 0.3);
  font-size: var(--text-xs);
  text-align: center;
}

.contact-label {
  color: var(--text-muted);
}

.contact-value {
  color: #f59e0b;
  font-weight: 600;
  user-select: all;
}

/* 改写弹窗样式 */
.modal-project {
  color: var(--text-secondary);
  margin-bottom: var(--space-4);
}

.modal-info {
  display: flex;
  justify-content: space-between;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--border-subtle);
}

.info-label {
  color: var(--text-muted);
}

.info-value {
  color: var(--text-primary);
  font-weight: 500;
}

.info-value.insufficient {
  color: var(--error);
}

.form-group {
  margin-top: var(--space-4);
}

/* 价格说明 */
.price-notice {
  margin: var(--space-4) 0;
  padding: var(--space-3);
  background: rgba(245, 158, 11, 0.1);
  border: 1px dashed rgba(245, 158, 11, 0.3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

.price-notice p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.8;
}

.price-notice strong {
  color: #f59e0b;
}

.notice-contact {
  margin-top: var(--space-2) !important;
  padding-top: var(--space-2);
  border-top: 1px dashed rgba(245, 158, 11, 0.3);
}

.form-group label {
  display: block;
  margin-bottom: var(--space-2);
  font-weight: 500;
}

.form-group .required {
  color: var(--error);
}

.form-group textarea {
  width: 100%;
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-input);
  color: var(--text-primary);
  resize: vertical;
  font-family: inherit;
}

.form-group textarea:focus {
  outline: none;
  border-color: var(--primary);
}

.char-hint {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--space-1);
}

.char-count {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.hint-error {
  font-size: var(--text-xs);
  color: var(--error);
}

/* 收藏按钮 */
.favorite-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  background: var(--glass);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
  margin-left: var(--space-2);
}

.favorite-btn:hover:not(:disabled) {
  border-color: #ef4444;
  color: #ef4444;
}

.favorite-btn.active {
  background: rgba(239, 68, 68, 0.1);
  border-color: #ef4444;
  color: #ef4444;
}

.favorite-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}

.fav-icon {
  font-size: 16px;
}

.fav-text {
  font-weight: 500;
}

/* 移动端优化 */
@media (max-width: 768px) {
  /* Hero区域 */
  .hero {
    padding-top: var(--space-6);
    padding-bottom: var(--space-12);
  }

  .hero-content {
    flex-direction: column;
    gap: var(--space-4);
  }

  .hero-info {
    text-align: center;
  }

  .hero-title {
    font-size: var(--text-xl);
  }

  .hero-desc {
    font-size: var(--text-sm);
  }

  .hero-meta {
    justify-content: center;
    flex-wrap: wrap;
  }

  .meta-item {
    font-size: var(--text-xs);
  }

  .favorite-btn {
    margin-left: 0;
    margin-top: var(--space-2);
  }

  /* 价格卡片 */
  .hero-price {
    display: flex;
    gap: var(--space-3);
    width: 100%;
    flex-direction: column;
  }

  .price-card {
    padding: var(--space-3);
    text-align: center;
  }

  .price-value {
    font-size: var(--text-2xl);
  }

  .rewrite-card {
    padding: var(--space-3);
  }

  .rewrite-info {
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-2);
  }

  .btn-rewrite {
    width: 100%;
    justify-content: center;
  }

  /* 标签页 */
  .tabs-wrapper {
    margin-top: calc(-1 * var(--space-4));
    margin-left: calc(-1 * var(--space-3));
    margin-right: calc(-1 * var(--space-3));
    padding: 0 var(--space-3);
  }

  .tabs-nav {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    gap: var(--space-1);
    padding: var(--space-1);
  }

  .tabs-nav::-webkit-scrollbar {
    display: none;
  }

  .tab-btn {
    flex-shrink: 0;
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-xs);
    gap: var(--space-1);
  }

  /* 移动端显示文字标签 */
  .tab-label {
    display: inline;
    white-space: nowrap;
  }

  /* 内容区域 */
  .tabs-content {
    padding-bottom: var(--space-20);
  }

  .synopsis-content,
  .episode-summaries-content {
    padding: var(--space-4);
    font-size: var(--text-sm);
    line-height: 1.8;
  }

  /* 角色网格 */
  .characters-grid {
    grid-template-columns: 1fr;
    gap: var(--space-3);
  }
}

/* 极小屏幕 */
@media (max-width: 374px) {
  .hero-title {
    font-size: var(--text-lg);
  }

  .price-card,
  .rewrite-card {
    padding: var(--space-2);
  }

  .tab-btn {
    padding: var(--space-2);
  }
}
</style>
