<template>
  <div class="home-page">
    <!-- Hero 区域 -->
    <section class="hero">
      <div class="hero-bg"></div>
      <div class="hero-particles"></div>
      <div class="hero-content container">
        <!-- 品牌标识 -->
        <div class="brand-badge animate-slideUp">锦墨工作室</div>
        
        <!-- 主标语 - 两行设计 -->
        <h1 class="hero-title animate-slideUp">
          <span class="title-line">一群热爱创作的人，只做值得推敲的剧本</span>
          <span class="title-line title-line-accent">只打磨值得讲的故事</span>
        </h1>
        
        <!-- 统计数据 -->
        <div class="hero-stats animate-slideUp">
          <div class="stat">
            <span class="stat-value">{{ projects.length }}</span>
            <span class="stat-label">精选剧本</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat">
            <span class="stat-value">∞</span>
            <span class="stat-label">精彩故事</span>
          </div>
        </div>
        
        <!-- 行动按钮 -->
        <router-link to="/register" class="promo-banner animate-slideUp">
          注册认证送积分，立即开启版权交易之旅 →
        </router-link>
      </div>
    </section>

    <!-- 项目列表 -->
    <section class="projects-section container">
      <div class="section-header">
        <h2 class="section-title">全部剧本</h2>
        <!-- 受众分类标签 -->
        <div class="audience-tabs">
          <button 
            v-for="tab in audienceTabs" 
            :key="tab.value"
            class="audience-tab"
            :class="{ active: selectedAudience === tab.value }"
            @click="selectedAudience = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>
      
      <!-- 标签筛选 -->
      <div class="tags-filter">
        <button 
          class="tag-chip"
          :class="{ active: selectedTags.length === 0 && !filterRewrite }"
          @click="selectedTags = []; filterRewrite = false"
        >
          全部
        </button>
        <button 
          class="tag-chip rewrite-chip"
          :class="{ active: filterRewrite }"
          @click="filterRewrite = !filterRewrite"
        >
          支持改写
        </button>
        <button 
          v-for="tag in filteredTags" 
          :key="tag._id"
          class="tag-chip"
          :class="{ active: selectedTags.includes(tag._id) }"
          :style="{ '--tag-color': tag.color }"
          @click="toggleTag(tag._id)"
        >
          {{ tag.name }}
        </button>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <span>加载中...</span>
      </div>

      <!-- 空状态 -->
      <div v-else-if="filteredProjects.length === 0" class="empty-state">
        <p class="empty-text">暂无剧本</p>
        <span class="empty-hint">敬请期待更多精彩内容</span>
      </div>

      <!-- 项目网格 -->
      <div v-else class="projects-grid">
        <ProjectCard 
          v-for="project in filteredProjects" 
          :key="project._id" 
          :project="project"
          @click="goToProject(project._id)"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { buyerApi } from '@/services/api';
import ProjectCard from '@/components/ProjectCard.vue';
import http from '@/services/api';

const router = useRouter();

interface Project {
  _id: string;
  name: string;
  description?: string;
  genre?: string;
  episodeCount?: number;
  pricePerEpisode?: number;
  freeEpisodeCount?: number;
  tags?: string[];
  targetAudience?: string;
  supportsRewrite?: boolean;
}

interface Tag {
  _id: string;
  name: string;
  color: string;
  category: string;
}

const projects = ref<Project[]>([]);
const tags = ref<Tag[]>([]);
const loading = ref(true);
const selectedAudience = ref('all');
const selectedTags = ref<string[]>([]);
const filterRewrite = ref(false);

const audienceTabs = [
  { value: 'all', label: '全部' },
  { value: 'female', label: '女频' },
  { value: 'male', label: '男频' },
];

// 根据受众筛选可用标签
const filteredTags = computed(() => {
  if (selectedAudience.value === 'all') {
    return tags.value;
  }
  return tags.value.filter(t => 
    t.category === selectedAudience.value || t.category === 'common'
  );
});

// 筛选项目
const filteredProjects = computed(() => {
  let result = projects.value;
  
  // 按受众筛选
  if (selectedAudience.value !== 'all') {
    result = result.filter(p => p.targetAudience === selectedAudience.value);
  }
  
  // 按支持改写筛选
  if (filterRewrite.value) {
    result = result.filter(p => p.supportsRewrite);
  }
  
  // 按标签筛选（任意匹配）
  if (selectedTags.value.length > 0) {
    result = result.filter(p => 
      p.tags?.some(tag => selectedTags.value.includes(tag))
    );
  }
  
  return result;
});

function toggleTag(tagId: string) {
  const index = selectedTags.value.indexOf(tagId);
  if (index > -1) {
    selectedTags.value.splice(index, 1);
  } else {
    selectedTags.value.push(tagId);
  }
}

onMounted(async () => {
  try {
    // 并行加载项目和标签
    const [projectsRes, tagsRes] = await Promise.all([
      buyerApi.getProjects(),
      http.get('/buyer/tags'),
    ]);
    projects.value = (projectsRes as any).projects || [];
    tags.value = (tagsRes as any).tags || [];
  } catch (err) {
    console.error('Failed to load data:', err);
  } finally {
    loading.value = false;
  }
});

function goToProject(id: string) {
  router.push(`/projects/${id}`);
}
</script>

<style scoped>
/* Hero 区域 */
.hero {
  position: relative;
  padding: var(--space-20) var(--space-4);
  overflow: hidden;
  z-index: 1;
  min-height: 60vh;
  display: flex;
  align-items: center;
}

.hero-bg {
  position: absolute;
  inset: 0;
  background: var(--gradient-hero);
  z-index: -2;
}

.hero-bg::before {
  content: '';
  position: absolute;
  inset: 0;
  background: 
    radial-gradient(circle at 20% 30%, rgba(99, 102, 241, 0.4) 0%, transparent 40%),
    radial-gradient(circle at 80% 70%, rgba(236, 72, 153, 0.3) 0%, transparent 40%),
    radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.2) 0%, transparent 60%);
  animation: pulseGlow 8s ease-in-out infinite alternate;
}

@keyframes pulseGlow {
  0% { opacity: 0.6; }
  100% { opacity: 1; }
}

.hero-particles {
  position: absolute;
  inset: 0;
  z-index: -1;
  background-image: 
    radial-gradient(2px 2px at 20% 30%, rgba(255,255,255,0.3) 50%, transparent 50%),
    radial-gradient(2px 2px at 40% 70%, rgba(255,255,255,0.2) 50%, transparent 50%),
    radial-gradient(3px 3px at 70% 20%, rgba(255,255,255,0.3) 50%, transparent 50%),
    radial-gradient(2px 2px at 90% 60%, rgba(255,255,255,0.2) 50%, transparent 50%);
  background-size: 250px 250px;
  animation: floatParticles 20s linear infinite;
}

@keyframes floatParticles {
  0% { transform: translateY(0); }
  100% { transform: translateY(-50px); }
}

.hero-content {
  text-align: center;
  width: 100%;
}

/* 品牌标识 */
.brand-badge {
  display: inline-block;
  padding: var(--space-2) var(--space-5);
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 0.1em;
  margin-bottom: var(--space-6);
}

/* 标题样式 */
.hero-title {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-10);
}

.title-line {
  display: block;
  font-size: var(--text-2xl);
  font-weight: 600;
  background: linear-gradient(135deg, #fff 0%, #e0e7ff 50%, #c4b5fd 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1.4;
}

.title-line-accent {
  font-size: var(--text-3xl);
  font-weight: 700;
  background: linear-gradient(135deg, #f0abfc 0%, #c084fc 50%, #818cf8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

@media (min-width: 768px) {
  .title-line {
    font-size: var(--text-3xl);
  }
  .title-line-accent {
    font-size: var(--text-4xl);
  }
}

@media (min-width: 1024px) {
  .title-line {
    font-size: var(--text-4xl);
  }
  .title-line-accent {
    font-size: var(--text-5xl);
  }
}

[data-theme="light"] .title-line {
  background: linear-gradient(135deg, #1e1b4b 0%, #4f46e5 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

[data-theme="light"] .title-line-accent {
  background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

[data-theme="light"] .brand-badge {
  background: rgba(79, 70, 229, 0.1);
  border-color: rgba(79, 70, 229, 0.3);
  color: var(--primary);
}

.hero-stats {
  display: inline-flex;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-4) var(--space-8);
  background: var(--glass);
  backdrop-filter: blur(20px);
  border-radius: var(--radius-xl);
  border: 1px solid var(--glass-border);
  margin-bottom: var(--space-6);
}

.stat {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--primary);
}

.stat-label {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.stat-divider {
  width: 1px;
  height: 40px;
  background: var(--border-color);
}

/* 认证送积分促销横幅 */
.promo-banner {
  display: block;
  margin-top: var(--space-6);
  padding: var(--space-3) var(--space-5);
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(239, 68, 68, 0.15) 100%);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: var(--radius-full);
  color: #fbbf24;
  font-size: var(--text-sm);
  font-weight: 500;
  text-decoration: none;
  transition: all var(--duration-fast);
  cursor: pointer;
}

.promo-banner:hover {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(239, 68, 68, 0.25) 100%);
  color: #fcd34d;
}

/* 项目区域 */
.projects-section {
  position: relative;
  padding: var(--space-12) 0;
  z-index: 10;
  background: var(--bg-page);
}

.section-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-bottom: var(--space-8);
}

@media (min-width: 768px) {
  .section-header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.section-title {
  font-size: var(--text-2xl);
  font-weight: 600;
}

.audience-tabs {
  display: flex;
  gap: var(--space-2);
}

.audience-tab {
  padding: var(--space-2) var(--space-5);
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: 500;
  transition: all var(--duration-fast);
  cursor: pointer;
}

.audience-tab:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.audience-tab.active {
  background: var(--gradient-primary);
  border-color: transparent;
  color: white;
}

/* 标签筛选 */
.tags-filter {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-6);
}

.tag-chip {
  padding: var(--space-1) var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: 500;
  transition: all var(--duration-fast);
  cursor: pointer;
}

.tag-chip:hover {
  border-color: var(--tag-color, var(--primary));
  color: var(--tag-color, var(--primary));
}

.tag-chip.active {
  background: var(--tag-color, var(--primary));
  border-color: transparent;
  color: white;
}

/* 支持改写 - 特殊功能标签 */
.rewrite-chip {
  background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
  border: none;
  color: white;
  font-weight: 600;
  padding: var(--space-1) var(--space-4);
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
}

.rewrite-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
  color: white;
  border-color: transparent;
}

.rewrite-chip.active {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  box-shadow: 0 4px 16px rgba(239, 68, 68, 0.5);
}

/* 加载状态 */
.loading-state {
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

/* 空状态 */
.empty-state {
  text-align: center;
  padding: var(--space-16);
  color: var(--text-muted);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: var(--space-4);
}

.empty-hint {
  font-size: var(--text-sm);
}

/* 项目网格 */
.projects-grid {
  display: grid;
  gap: var(--space-6);
  grid-template-columns: 1fr;
}

@media (min-width: 640px) {
  .projects-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .projects-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1280px) {
  .projects-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* 移动端优化 - 极简文字设计 */
@media (max-width: 768px) {
  /* Hero 区域 - 简化 */
  .hero {
    padding: var(--space-6) var(--space-4);
    background: linear-gradient(180deg, var(--primary) 0%, var(--bg-page) 100%);
  }

  .hero-bg {
    display: none;
  }

  .hero-title {
    font-size: 28px;
    font-weight: 800;
    line-height: 1.2;
    letter-spacing: -0.5px;
  }

  .gradient-text {
    background: linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hero-subtitle {
    font-size: var(--text-sm);
    color: rgba(255, 255, 255, 0.75);
    margin-bottom: var(--space-4);
    font-weight: 400;
  }

  .hero-stats {
    display: inline-flex;
    gap: var(--space-6);
    padding: var(--space-3) var(--space-5);
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-radius: var(--radius-full);
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .stat-divider {
    width: 1px;
    height: 24px;
    background: rgba(255, 255, 255, 0.3);
  }

  .stat-value {
    font-size: var(--text-lg);
    font-weight: 700;
    color: white;
  }

  .stat-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: rgba(255, 255, 255, 0.6);
  }

  /* 项目区域 */
  .projects-section {
    padding: var(--space-5) var(--space-4) var(--space-12);
    position: relative;
    z-index: 10;
    background: var(--bg-page);
    border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
    margin-top: calc(-1 * var(--space-4));
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-4);
    margin-bottom: var(--space-5);
  }

  .section-title {
    font-size: var(--text-xl);
    font-weight: 700;
    letter-spacing: -0.3px;
  }

  /* 受众标签 - 文字为主的设计 */
  .audience-tabs {
    display: flex;
    gap: 0;
    background: var(--bg-elevated);
    border-radius: var(--radius-lg);
    padding: var(--space-1);
    width: 100%;
  }

  .audience-tabs::-webkit-scrollbar {
    display: none;
  }

  .audience-tab {
    flex: 1;
    padding: var(--space-3);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text-muted);
    border-radius: var(--radius-md);
    text-align: center;
    transition: all 0.2s;
    border: none;
    background: transparent;
  }

  .audience-tab:hover {
    color: var(--text-primary);
  }

  .audience-tab.active {
    background: var(--primary);
    color: white;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  }

  /* 标签筛选 - 纯文字胶囊 */
  .tags-filter {
    display: flex;
    gap: var(--space-2);
    overflow-x: auto;
    padding-bottom: var(--space-1);
    margin: 0 calc(-1 * var(--space-4));
    padding-left: var(--space-4);
    padding-right: var(--space-4);
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    margin-bottom: var(--space-5);
  }

  .tags-filter::-webkit-scrollbar {
    display: none;
  }

  .tag-chip {
    flex-shrink: 0;
    padding: var(--space-2) var(--space-4);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-secondary);
    background: transparent;
    border: 1.5px solid var(--border-color);
    border-radius: var(--radius-full);
    transition: all 0.15s;
  }

  .tag-chip:hover {
    border-color: var(--tag-color, var(--primary));
    color: var(--tag-color, var(--primary));
  }

  .tag-chip.active {
    background: var(--tag-color, var(--primary));
    border-color: var(--tag-color, var(--primary));
    color: white;
    font-weight: 600;
  }

  /* 支持改写 - 特殊功能标签 */
  .rewrite-chip {
    background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
    border: none;
    color: white;
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
  }

  .rewrite-chip:hover,
  .rewrite-chip:active {
    color: white;
    border-color: transparent;
  }

  .rewrite-chip.active {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
  }

  /* 项目网格 */
  .projects-grid {
    gap: var(--space-4);
  }

  /* 空状态 */
  .empty-state {
    padding: var(--space-12) var(--space-6);
    text-align: center;
  }

  .empty-text {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: var(--space-2);
  }

  .empty-hint {
    font-size: var(--text-sm);
    color: var(--text-muted);
  }

  /* 加载状态 */
  .loading-state {
    padding: var(--space-12);
    text-align: center;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border-width: 2px;
  }
}

/* 极小屏幕 */
@media (max-width: 374px) {
  .hero-title {
    font-size: 24px;
  }

  .hero-stats {
    gap: var(--space-4);
    padding: var(--space-2) var(--space-4);
  }

  .stat-value {
    font-size: var(--text-base);
  }

  .section-title {
    font-size: var(--text-lg);
  }

  .audience-tab {
    padding: var(--space-2);
    font-size: var(--text-xs);
  }

  .tag-chip {
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-xs);
  }
}
</style>
