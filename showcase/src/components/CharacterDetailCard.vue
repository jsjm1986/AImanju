<template>
  <div class="character-detail-grid">
    <div 
      v-for="char in characters" 
      :key="char._id || char.name" 
      class="character-detail-card"
      @click="selectedCharacter = char"
    >
      <!-- 头像和基础信息 -->
      <div class="card-header">
        <div 
          class="avatar" 
          :style="{ background: getAvatarGradient(char.name) }"
        >
          {{ char.name.charAt(0) }}
        </div>
        <div class="basic-info">
          <h3 class="char-name">{{ char.name }}</h3>
          <div class="char-meta">
            <span v-if="char.role" class="meta-tag role">{{ char.role }}</span>
            <span v-if="char.gender" class="meta-tag">{{ char.gender }}</span>
            <span v-if="char.age" class="meta-tag">{{ char.age }}</span>
          </div>
        </div>
      </div>
      
      <!-- 详细信息预览 -->
      <div class="card-body">
        <div v-if="char.identity" class="info-row">
          <span class="info-label">👤 身份</span>
          <span class="info-value">{{ truncate(char.identity, 50) }}</span>
        </div>
        <div v-if="char.personality" class="info-row">
          <span class="info-label">💭 性格</span>
          <span class="info-value">{{ truncate(char.personality, 50) }}</span>
        </div>
        <div v-if="char.background" class="info-row">
          <span class="info-label">📖 背景</span>
          <span class="info-value">{{ truncate(char.background, 60) }}</span>
        </div>
        <div v-if="char.abilities" class="info-row">
          <span class="info-label">⚡ 能力</span>
          <span class="info-value">{{ truncate(char.abilities, 50) }}</span>
        </div>
        <div v-if="char.appearance" class="info-row">
          <span class="info-label">✨ 外貌</span>
          <span class="info-value">{{ truncate(char.appearance, 50) }}</span>
        </div>
        <div v-if="char.relationships?.length" class="info-row relationships-preview">
          <span class="info-label">🔗 关系</span>
          <span class="info-value">
            {{ char.relationships.slice(0, 2).map(r => `${r.targetName}(${r.relationship})`).join('、') }}
            <span v-if="char.relationships.length > 2">等{{ char.relationships.length }}人</span>
          </span>
        </div>
      </div>
      
      <!-- 展开提示 -->
      <div class="card-footer">
        <span class="expand-hint">点击查看详情 →</span>
      </div>
    </div>
    
    <!-- 详情弹窗 -->
    <div v-if="selectedCharacter" class="modal-overlay" @click.self="selectedCharacter = null">
      <div class="character-modal">
        <button class="close-btn" @click="selectedCharacter = null">×</button>
        
        <!-- 弹窗头部 -->
        <div class="modal-header">
          <div 
            class="modal-avatar" 
            :style="{ background: getAvatarGradient(selectedCharacter.name) }"
          >
            {{ selectedCharacter.name.charAt(0) }}
          </div>
          <div class="modal-title">
            <h2>{{ selectedCharacter.name }}</h2>
            <div class="modal-meta">
              <span v-if="selectedCharacter.role" class="meta-tag role">{{ selectedCharacter.role }}</span>
              <span v-if="selectedCharacter.gender" class="meta-tag">{{ selectedCharacter.gender }}</span>
              <span v-if="selectedCharacter.age" class="meta-tag">{{ selectedCharacter.age }}</span>
            </div>
          </div>
        </div>
        
        <!-- 弹窗内容 -->
        <div class="modal-body">
          <div v-if="selectedCharacter.identity" class="detail-section">
            <h4 class="section-title">👤 身份</h4>
            <p class="section-content">{{ selectedCharacter.identity }}</p>
          </div>
          
          <div v-if="selectedCharacter.personality" class="detail-section">
            <h4 class="section-title">💭 性格</h4>
            <p class="section-content">{{ selectedCharacter.personality }}</p>
          </div>
          
          <div v-if="selectedCharacter.background" class="detail-section">
            <h4 class="section-title">📖 背景</h4>
            <p class="section-content">{{ selectedCharacter.background }}</p>
          </div>
          
          <div v-if="selectedCharacter.abilities" class="detail-section">
            <h4 class="section-title">⚡ 能力</h4>
            <p class="section-content">{{ selectedCharacter.abilities }}</p>
          </div>
          
          <div v-if="selectedCharacter.appearance" class="detail-section">
            <h4 class="section-title">✨ 外貌</h4>
            <p class="section-content">{{ selectedCharacter.appearance }}</p>
          </div>
          
          <!-- 详细外貌字段 -->
          <div v-if="hasDetailedAppearance" class="detail-section">
            <h4 class="section-title">📷 外貌细节</h4>
            <div class="appearance-grid">
              <div v-if="selectedCharacter.hairStyle" class="appearance-item">
                <span class="appearance-label">发型</span>
                <span class="appearance-value">{{ selectedCharacter.hairStyle }}</span>
              </div>
              <div v-if="selectedCharacter.hairColor" class="appearance-item">
                <span class="appearance-label">发色</span>
                <span class="appearance-value">{{ selectedCharacter.hairColor }}</span>
              </div>
              <div v-if="selectedCharacter.faceType" class="appearance-item">
                <span class="appearance-label">脸型</span>
                <span class="appearance-value">{{ selectedCharacter.faceType }}</span>
              </div>
              <div v-if="selectedCharacter.bodyType" class="appearance-item">
                <span class="appearance-label">身材</span>
                <span class="appearance-value">{{ selectedCharacter.bodyType }}</span>
              </div>
              <div v-if="selectedCharacter.clothing" class="appearance-item">
                <span class="appearance-label">穿着</span>
                <span class="appearance-value">{{ selectedCharacter.clothing }}</span>
              </div>
              <div v-if="selectedCharacter.accessories" class="appearance-item">
                <span class="appearance-label">配饰</span>
                <span class="appearance-value">{{ selectedCharacter.accessories }}</span>
              </div>
            </div>
          </div>
          
          <!-- 初始装备和能力 -->
          <div v-if="selectedCharacter.initialEquipment?.length" class="detail-section">
            <h4 class="section-title">🎒 初始装备</h4>
            <div class="tag-list">
              <span v-for="item in selectedCharacter.initialEquipment" :key="item" class="tag">
                {{ item }}
              </span>
            </div>
          </div>
          
          <div v-if="selectedCharacter.initialAbilities?.length" class="detail-section">
            <h4 class="section-title">🌟 初始能力</h4>
            <div class="tag-list">
              <span v-for="item in selectedCharacter.initialAbilities" :key="item" class="tag ability">
                {{ item }}
              </span>
            </div>
          </div>
          
          <div v-if="selectedCharacter.relationships?.length" class="detail-section">
            <h4 class="section-title">🔗 人物关系</h4>
            <div class="relationships">
              <div 
                v-for="rel in selectedCharacter.relationships" 
                :key="rel.targetName"
                class="relationship-item"
              >
                <span class="rel-target">{{ rel.targetName }}</span>
                <span class="rel-type">{{ rel.relationship }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface Relationship {
  targetCharacterId?: string;
  targetName: string;
  relationship: string;
}

interface Character {
  _id?: string;
  name: string;
  role?: string;
  type?: string;
  gender?: string;
  age?: string;
  identity?: string;
  personality?: string;
  background?: string;
  abilities?: string;
  appearance?: string;
  // 详细外貌字段
  hairStyle?: string;
  hairColor?: string;
  faceType?: string;
  bodyType?: string;
  clothing?: string;
  accessories?: string;
  // 初始装备和能力
  initialEquipment?: string[];
  initialAbilities?: string[];
  relationships?: Relationship[];
}

defineProps<{
  characters: Character[];
}>();

const selectedCharacter = ref<Character | null>(null);

// 检查是否有详细外貌字段
const hasDetailedAppearance = computed(() => {
  const char = selectedCharacter.value;
  if (!char) return false;
  return !!(char.hairStyle || char.hairColor || char.faceType || char.bodyType || char.clothing || char.accessories);
});

function getAvatarGradient(name: string) {
  const gradients = [
    'linear-gradient(135deg, #667eea, #764ba2)',
    'linear-gradient(135deg, #f093fb, #f5576c)',
    'linear-gradient(135deg, #4facfe, #00f2fe)',
    'linear-gradient(135deg, #43e97b, #38f9d7)',
    'linear-gradient(135deg, #fa709a, #fee140)',
    'linear-gradient(135deg, #a18cd1, #fbc2eb)',
    'linear-gradient(135deg, #ff9a9e, #fecfef)',
    'linear-gradient(135deg, #89f7fe, #66a6ff)',
    'linear-gradient(135deg, #6366f1, #8b5cf6)',
    'linear-gradient(135deg, #ec4899, #f43f5e)',
  ];
  const index = name.charCodeAt(0) % gradients.length;
  return gradients[index];
}

function truncate(text: string, length: number) {
  if (!text) return '';
  return text.length > length ? text.slice(0, length) + '...' : text;
}
</script>

<style scoped>
.character-detail-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: var(--space-4);
}

@media (min-width: 640px) {
  .character-detail-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .character-detail-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.character-detail-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.character-detail-card:hover {
  transform: translateY(-4px);
  border-color: var(--primary);
  box-shadow: var(--shadow-lg);
}

.card-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border-color);
}

.avatar {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.basic-info {
  flex: 1;
  min-width: 0;
}

.char-name {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--space-1);
}

.char-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.meta-tag {
  padding: 2px 8px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
}

.meta-tag.role {
  background: var(--primary-light);
  color: var(--primary);
  font-weight: 500;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.info-row {
  display: flex;
  gap: var(--space-2);
  font-size: var(--text-sm);
  align-items: flex-start;
}

.info-label {
  color: var(--text-muted);
  flex-shrink: 0;
  width: 60px;
}

.info-value {
  color: var(--text-secondary);
  flex: 1;
  line-height: 1.5;
}

.relationships-preview .info-value {
  white-space: normal;
}

.card-footer {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-color);
  text-align: center;
}

.expand-hint {
  font-size: var(--text-xs);
  color: var(--text-muted);
  transition: color var(--duration-fast);
}

.character-detail-card:hover .expand-hint {
  color: var(--primary);
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}

.character-modal {
  background: var(--bg-card);
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
}

.close-btn {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  width: 32px;
  height: 32px;
  border: none;
  background: var(--bg-elevated);
  border-radius: var(--radius-full);
  font-size: 20px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.close-btn:hover {
  background: var(--primary);
  color: white;
}

.appearance-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

.appearance-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.appearance-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.appearance-value {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.tag.ability {
  background: var(--primary-light);
  border-color: transparent;
  color: var(--primary);
}

.modal-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-6);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-color);
}

.modal-avatar {
  width: 72px;
  height: 72px;
  flex-shrink: 0;
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 700;
  color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.modal-title h2 {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 var(--space-2);
}

.modal-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.modal-body {
  padding: var(--space-6);
}

.detail-section {
  margin-bottom: var(--space-5);
}

.detail-section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--primary);
  margin: 0 0 var(--space-2);
}

.section-content {
  font-size: var(--text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
  margin: 0;
}

.relationships {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.relationship-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

.rel-target {
  color: var(--text-primary);
  font-weight: 500;
}

.rel-type {
  color: var(--text-muted);
}
</style>
