<template>
  <div class="project-settings">
    <h2>项目设置</h2>
    <div class="settings-sections">
      <!-- 输出格式配置 -->
      <section class="settings-section">
        <OutputFormatConfig 
          v-if="projectId" 
          :projectId="projectId"
          @saved="handleSaved" 
        />
      </section>
    </div>
    <div v-if="saveMessage" class="save-message">{{ saveMessage }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import OutputFormatConfig from '@/components/settings/OutputFormatConfig.vue';

const route = useRoute();
const projectId = computed(() => route.params.id as string);
const saveMessage = ref('');

const handleSaved = () => {
  saveMessage.value = '✓ 设置已保存';
  setTimeout(() => { saveMessage.value = ''; }, 2000);
};
</script>

<style scoped>
.project-settings {
  padding: var(--space-6);
  width: 100%;
}
.project-settings h2 {
  margin-bottom: var(--space-6);
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}
.settings-section {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-4);
}
.save-message {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: var(--success);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
}
</style>
