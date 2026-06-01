<template>
  <div class="character-grid">
    <div 
      v-for="char in characters" 
      :key="char.name" 
      class="character-card"
    >
      <div 
        class="avatar" 
        :style="{ background: getAvatarGradient(char.name) }"
      >
        {{ char.name.charAt(0) }}
      </div>
      <div class="info">
        <span class="name">{{ char.name }}</span>
        <span class="role">{{ char.role || '角色' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Character {
  name: string;
  role?: string;
  description?: string;
}

defineProps<{
  characters: Character[];
}>();

// 根据名字生成渐变色
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
</script>

<style scoped>
.character-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

@media (min-width: 640px) {
  .character-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1024px) {
  .character-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.character-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  transition: all var(--duration-fast) var(--ease-out);
}

.character-card:hover {
  transform: translateY(-2px);
  border-color: var(--primary);
  box-shadow: var(--shadow-md);
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

.info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.name {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.role {
  font-size: var(--text-sm);
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
