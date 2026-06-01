<template>
  <article class="project-card" @click="handleClick">
    <!-- 封面区域 -->
    <div class="card-cover" :style="coverStyle">
      <span class="cover-letter">{{ coverLetter }}</span>
      
      <!-- 免费徽章 -->
      <div v-if="project.freeEpisodeCount" class="card-badge free">
        前{{ project.freeEpisodeCount }}集免费
      </div>
      
      <!-- 支持改写徽章 -->
      <div v-if="project.supportsRewrite" class="card-badge rewrite" :class="{ 'badge-left': project.freeEpisodeCount }">
        支持改写
      </div>
      
      <!-- 悬停遮罩 -->
      <div class="cover-overlay">
        <span class="overlay-text">查看详情</span>
      </div>
    </div>
    
    <!-- 内容区域 -->
    <div class="card-body">
      <h3 class="card-title">{{ project.name }}</h3>
      <p class="card-desc">{{ project.description || '暂无简介' }}</p>
      
      <!-- 标签 -->
      <div class="card-tags">
        <span class="tag genre">{{ project.genre || '未分类' }}</span>
        <span class="tag episodes">{{ project.episodeCount || 0 }} 集</span>
      </div>
      
      <!-- 底部信息 -->
      <div class="card-footer">
        <div class="price">
          <span class="price-value">{{ project.pricePerEpisode || 10 }}</span>
          <span class="price-unit">积分/集</span>
        </div>
        <div class="arrow-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Project {
  _id: string;
  name: string;
  description?: string;
  genre?: string;
  episodeCount?: number;
  pricePerEpisode?: number;
  freeEpisodeCount?: number;
  coverImage?: string;
  supportsRewrite?: boolean;
  rewritePrice?: number;
}

const props = defineProps<{
  project: Project;
}>();

const emit = defineEmits<{
  click: [project: Project];
}>();

// 封面字母
const coverLetter = computed(() => props.project.name.charAt(0));

// 封面渐变样式
const coverStyle = computed(() => {
  if (props.project.coverImage) {
    return { backgroundImage: `url(${props.project.coverImage})` };
  }
  
  const gradients = [
    'linear-gradient(135deg, hsl(var(--skin-primary-h), 70%, 55%), hsl(var(--skin-secondary-h), 70%, 50%))',
    'linear-gradient(135deg, #f093fb, #f5576c)',
    'linear-gradient(135deg, #4facfe, #00f2fe)',
    'linear-gradient(135deg, #43e97b, #38f9d7)',
    'linear-gradient(135deg, #fa709a, #fee140)',
    'linear-gradient(135deg, #667eea, #764ba2)',
    'linear-gradient(135deg, #89f7fe, #66a6ff)',
    'linear-gradient(135deg, #a18cd1, #fbc2eb)',
  ];
  const index = props.project.name.charCodeAt(0) % gradients.length;
  return { background: gradients[index] };
});

function handleClick() {
  emit('click', props.project);
}
</script>

<style scoped>
.project-card {
  position: relative;
  background: var(--bg-card);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-default);
  overflow: hidden;
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-spring);
}

.project-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: var(--shadow-lg), var(--shadow-glow);
  border-color: var(--primary);
}

/* 封面 */
.card-cover {
  position: relative;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-size: cover;
  background-position: center;
  overflow: hidden;
}

.card-cover::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.6) 100%);
}

.cover-letter {
  position: relative;
  font-size: 80px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  transform: translateY(-10px);
}

.card-badge {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
  font-weight: 600;
  border-radius: var(--radius-full);
  z-index: 2;
}

.card-badge.free {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.card-badge.rewrite {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: white;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
}

.card-badge.badge-left {
  top: calc(var(--space-3) + 28px);
}

/* 悬停遮罩 */
.cover-overlay {
  position: absolute;
  inset: 0;
  background: hsla(var(--skin-primary-h), 80%, 50%, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--duration-normal);
}

.project-card:hover .cover-overlay {
  opacity: 1;
}

.overlay-text {
  color: white;
  font-size: var(--text-lg);
  font-weight: 600;
  letter-spacing: 0.05em;
}

/* 内容 */
.card-body {
  padding: var(--space-5);
}

.card-title {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
  line-height: 1.3;
}

.card-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: var(--space-4);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-tags {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}

.tag {
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-weight: 500;
}

.tag.genre {
  background: var(--primary-light);
  color: var(--primary);
}

.tag.episodes {
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

/* 底部 */
.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-subtle);
}

.price {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
}

.price-value {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--primary);
}

.price-unit {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.arrow-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-light);
  border-radius: var(--radius-full);
  color: var(--primary);
  transition: all var(--duration-fast) var(--ease-spring);
}

.arrow-btn svg {
  width: 18px;
  height: 18px;
}

.project-card:hover .arrow-btn {
  background: var(--gradient-primary);
  color: white;
  transform: translateX(4px);
}

/* 移动端适配 */
@media (max-width: 640px) {
  .card-cover {
    height: 160px;
  }
  
  .cover-letter {
    font-size: 60px;
  }
}
</style>
