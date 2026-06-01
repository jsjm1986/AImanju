<template>
  <div class="episode-summary-list">
    <div 
      v-for="ep in parsedEpisodes" 
      :key="ep.number" 
      class="episode-summary-card"
      :class="{ 
        free: isFree(ep.number),
        purchased: isPurchased(ep.number),
        locked: !isFree(ep.number) && !isPurchased(ep.number)
      }"
      @click="handleClick(ep)"
    >
      <div class="episode-header">
        <div class="episode-number-badge" :class="getStatusClass(ep.number)">
          {{ ep.number }}
        </div>
        <div class="episode-info">
          <span class="episode-label">第 {{ ep.number }} 集</span>
          <span class="episode-status-tag">
            <template v-if="isFree(ep.number)">免费</template>
            <template v-else-if="isPurchased(ep.number)">✓ 已购</template>
            <template v-else>{{ pricePerEpisode }} 积分</template>
          </span>
        </div>
        <span class="arrow">→</span>
      </div>
      
      <div class="episode-body">
        <p class="episode-summary-text">{{ ep.summary }}</p>
        <div v-if="ep.characters.length" class="episode-characters">
          <span class="char-label">出场人物：</span>
          <span 
            v-for="char in ep.characters.slice(0, 4)" 
            :key="char" 
            class="char-tag"
          >
            {{ char }}
          </span>
          <span v-if="ep.characters.length > 4" class="char-more">
            +{{ ep.characters.length - 4 }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface ParsedEpisode {
  number: number;
  summary: string;
  characters: string[];
}

const props = defineProps<{
  summaryText: string;
  freeEpisodeCount: number;
  pricePerEpisode: number;
  purchasedEpisodeNumbers: number[];
  totalEpisodes: number;
}>();

const emit = defineEmits<{
  (e: 'select', episode: ParsedEpisode): void;
}>();

// 解析分集梗概文本
const parsedEpisodes = computed(() => {
  if (!props.summaryText) return [];
  
  const episodes: ParsedEpisode[] = [];
  const text = props.summaryText;
  
  // 匹配各种格式：## 第1集、第1集：、**第1集**
  const episodePattern = /(?:#{1,2}\s*)?(?:\*\*)?第(\d+)集[：:：]?(?:\*\*)?/gi;
  const matches = [...text.matchAll(episodePattern)];
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    if (!match || !match[1]) continue;
    
    const epNum = parseInt(match[1], 10);
    const startIndex = (match.index ?? 0) + match[0].length;
    const nextMatch = matches[i + 1];
    const endIndex = nextMatch?.index ?? text.length;
    
    let content = text.slice(startIndex, endIndex).trim();
    
    // 提取人物
    const characters: string[] = [];
    const charMatch = content.match(/人物[：:]\s*([^\n]+)/);
    if (charMatch && charMatch[1]) {
      const charNames = charMatch[1].split(/[、,，]/).map(s => s.trim()).filter(Boolean);
      characters.push(...charNames);
      content = content.replace(/人物[：:]\s*[^\n]+\n?/, '').trim();
    }
    
    // 提取梗概
    const summaryMatch = content.match(/梗概[：:]\s*([\s\S]+?)(?=人物[：:]|$)/);
    const summary = summaryMatch && summaryMatch[1]
      ? summaryMatch[1].trim() 
      : content.split('\n')[0]?.trim() || content.slice(0, 200);
    
    episodes.push({
      number: epNum,
      summary: summary.replace(/\n+/g, ' '),
      characters,
    });
  }
  
  return episodes;
});

function isFree(episodeNumber: number) {
  return episodeNumber <= props.freeEpisodeCount;
}

function isPurchased(episodeNumber: number) {
  return props.purchasedEpisodeNumbers.includes(episodeNumber);
}

function getStatusClass(episodeNumber: number) {
  if (isFree(episodeNumber)) return 'free';
  if (isPurchased(episodeNumber)) return 'purchased';
  return 'locked';
}

function handleClick(episode: ParsedEpisode) {
  emit('select', episode);
}
</script>

<style scoped>
.episode-summary-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.episode-summary-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.episode-summary-card:hover {
  transform: translateX(4px);
  border-color: var(--primary);
  box-shadow: var(--shadow-md);
}

.episode-summary-card.free {
  border-left: 4px solid var(--success);
}

.episode-summary-card.purchased {
  border-left: 4px solid var(--primary);
}

.episode-summary-card.locked {
  border-left: 4px solid var(--text-muted);
}

.episode-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.episode-number-badge {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  font-size: var(--text-lg);
  font-weight: 700;
  color: white;
  flex-shrink: 0;
}

.episode-number-badge.free {
  background: var(--success);
}

.episode-number-badge.purchased {
  background: var(--primary);
}

.episode-number-badge.locked {
  background: var(--text-muted);
}

.episode-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.episode-label {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
}

.episode-status-tag {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.arrow {
  font-size: var(--text-lg);
  color: var(--text-muted);
  transition: all var(--duration-fast);
}

.episode-summary-card:hover .arrow {
  color: var(--primary);
  transform: translateX(4px);
}

.episode-body {
  padding-left: calc(40px + var(--space-3));
}

.episode-summary-text {
  font-size: var(--text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
  margin-bottom: var(--space-3);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.episode-characters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.char-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.char-tag {
  padding: var(--space-1) var(--space-2);
  background: var(--primary-light);
  color: var(--primary);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 500;
}

.char-more {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* 响应式 */
@media (max-width: 640px) {
  .episode-body {
    padding-left: 0;
  }
  
  .episode-number-badge {
    width: 36px;
    height: 36px;
    font-size: var(--text-base);
  }
}
</style>
