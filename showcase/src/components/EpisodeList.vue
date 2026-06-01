<template>
  <div class="episode-list">
    <!-- 免费区域标题 -->
    <div class="tier-header tier-free" v-if="hasFreeEpisodes">
      <span class="tier-icon">🎁</span>
      <span class="tier-label">免费试读（1-5集）</span>
    </div>
    
    <div 
      v-for="ep in episodes" 
      :key="ep._id" 
      class="episode-item"
      :class="{ 
        free: isFree(ep.episodeNumber),
        purchased: isPurchased(ep._id),
        locked: !isFree(ep.episodeNumber) && !isPurchased(ep._id),
        'script-required': isScriptRequired(ep.episodeNumber)
      }"
      @click="handleClick(ep)"
    >
      <!-- 积分购买区域分隔 -->
      <template v-if="ep.episodeNumber === 6 && hasPointsEpisodes">
        <div class="tier-separator"></div>
      </template>
      
      <!-- 整本购买区域分隔 -->
      <template v-if="ep.episodeNumber === 21 && hasScriptEpisodes">
        <div class="tier-separator tier-script"></div>
      </template>
      
      <div class="episode-bar"></div>
      <div class="episode-content">
        <div class="episode-header">
          <span class="episode-number">第 {{ ep.episodeNumber }} 集</span>
          <span v-if="ep.summary" class="episode-summary">{{ ep.summary }}</span>
        </div>
        <div class="episode-meta">
          <span v-if="ep.wordCount" class="word-count">{{ formatWordCount(ep.wordCount) }}</span>
        </div>
      </div>
      <div class="episode-status">
        <span v-if="isFree(ep.episodeNumber)" class="badge badge-free">
          免费
        </span>
        <span v-else-if="isPurchased(ep._id)" class="badge badge-purchased">
          已购
        </span>
        <span v-else-if="isScriptRequired(ep.episodeNumber)" class="badge badge-script">
          🔐 需购买整本
        </span>
        <span v-else class="badge badge-price">
          {{ pricePerEpisode }} 积分
        </span>
      </div>
      <span class="arrow">→</span>
    </div>
    
    <!-- 积分区域标题 -->
    <div class="tier-header tier-points" v-if="hasPointsEpisodes && episodes.some(e => e.episodeNumber === 6)">
      <span class="tier-icon">💰</span>
      <span class="tier-label">积分解锁（6-20集）</span>
      <span class="tier-price">{{ pricePerEpisode }}积分/集</span>
    </div>
    
    <!-- 整本购买提示 -->
    <div class="script-purchase-banner" v-if="hasScriptEpisodes">
      <div class="banner-content">
        <div class="banner-icon">📜</div>
        <div class="banner-text">
          <h4>第21集及以后需购买完整剧本</h4>
          <p>支持版权购买或合作分成，请联系客服详询</p>
        </div>
      </div>
      <div class="banner-contact">
        <span class="contact-icon">💬</span>
        <span class="contact-label">微信客服：</span>
        <span class="contact-value">Tom_de</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Episode {
  _id: string;
  episodeNumber: number;
  summary?: string;
  wordCount?: number;
}

const props = defineProps<{
  episodes: Episode[];
  freeEpisodeCount: number;
  pricePerEpisode: number;
  purchasedEpisodeIds: string[];
}>();

const emit = defineEmits<{
  (e: 'select', episode: Episode): void;
}>();

const FREE_LIMIT = 5;      // 平台规则：前5集免费
const POINTS_LIMIT = 20;   // 平台规则：积分可购买到第20集

// 计算是否有各区域的剧集
const hasFreeEpisodes = computed(() => props.episodes.some(e => e.episodeNumber <= FREE_LIMIT));
const hasPointsEpisodes = computed(() => props.episodes.some(e => e.episodeNumber > FREE_LIMIT && e.episodeNumber <= POINTS_LIMIT));
const hasScriptEpisodes = computed(() => props.episodes.some(e => e.episodeNumber > POINTS_LIMIT));

function isFree(episodeNumber: number) {
  return episodeNumber <= FREE_LIMIT;
}

function isScriptRequired(episodeNumber: number) {
  return episodeNumber > POINTS_LIMIT;
}

function isPurchased(episodeId: string) {
  return props.purchasedEpisodeIds.includes(episodeId);
}

function formatWordCount(count: number) {
  if (count >= 10000) {
    return (count / 10000).toFixed(1) + '万字';
  }
  return count + '字';
}

function handleClick(episode: Episode) {
  emit('select', episode);
}
</script>

<style scoped>
.episode-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.episode-item {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.episode-item:hover {
  transform: translateX(4px);
  border-color: var(--primary);
  box-shadow: var(--shadow-sm);
}

.episode-bar {
  width: 4px;
  height: 40px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
  transition: background var(--duration-fast);
}

.episode-item.free .episode-bar {
  background: var(--success);
}

.episode-item.purchased .episode-bar {
  background: var(--primary);
}

.episode-item.locked .episode-bar {
  background: var(--text-muted);
}

.episode-content {
  flex: 1;
  min-width: 0;
}

.episode-header {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  margin-bottom: var(--space-1);
}

.episode-number {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

.episode-summary {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.episode-meta {
  display: flex;
  gap: var(--space-3);
}

.word-count {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.episode-status {
  flex-shrink: 0;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
  font-weight: 600;
  border-radius: var(--radius-full);
}

.badge-free {
  background: rgba(16, 185, 129, 0.15);
  color: var(--success);
}

.badge-purchased {
  background: var(--primary-light);
  color: var(--primary);
}

.badge-price {
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.arrow {
  font-size: var(--text-lg);
  color: var(--text-muted);
  transition: all var(--duration-fast);
}

.episode-item:hover .arrow {
  color: var(--primary);
  transform: translateX(4px);
}

/* 三层访问区域样式 */
.tier-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 600;
  margin-bottom: var(--space-2);
}

.tier-free {
  background: rgba(16, 185, 129, 0.1);
  color: var(--success);
}

.tier-points {
  background: rgba(99, 102, 241, 0.1);
  color: var(--primary);
  margin-top: var(--space-4);
}

.tier-price {
  margin-left: auto;
  font-weight: 500;
  opacity: 0.8;
}

.tier-icon {
  font-size: 16px;
}

/* 整本购买样式 */
.episode-item.script-required {
  opacity: 0.7;
}

.episode-item.script-required .episode-bar {
  background: linear-gradient(180deg, #f59e0b, #d97706);
}

.badge-script {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
  font-size: var(--text-xs);
}

.script-purchase-banner {
  margin-top: var(--space-4);
  padding: var(--space-5);
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.05));
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: var(--radius-lg);
}

.banner-content {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.banner-icon {
  font-size: 36px;
}

.banner-text h4 {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-1);
}

.banner-text p {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.banner-contact {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
}

.contact-icon {
  font-size: 16px;
}

.contact-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.contact-value {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--primary);
}
</style>
