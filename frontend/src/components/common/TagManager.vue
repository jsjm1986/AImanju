<template>
  <div class="tag-manager">
    <!-- 标签管理头部 -->
    <div class="manager-header">
      <h4>标签管理</h4>
      <button class="btn-add" @click="showCreateModal = true">
        + 新建标签
      </button>
    </div>

    <!-- 标签列表 -->
    <div class="tag-list">
      <div v-if="tagStore.loading" class="loading">加载中...</div>

      <div v-else-if="tagStore.sortedTags.length === 0" class="empty">
        暂无标签，点击上方按钮创建
      </div>

      <div
        v-else
        v-for="tag in tagStore.sortedTags"
        :key="tag._id"
        class="tag-item"
      >
        <span class="tag-color" :style="{ background: tag.color }"></span>
        <span class="tag-name">{{ tag.name }}</span>
        <div class="tag-actions">
          <button class="action-btn edit" @click="editTag(tag)">编辑</button>
          <button class="action-btn delete" @click="deleteTag(tag)">删除</button>
        </div>
      </div>
    </div>

    <!-- 项目标签选择器 (如果提供了projectId) -->
    <div v-if="projectId" class="project-tags">
      <h5>项目标签</h5>
      <div class="tag-selector">
        <div
          v-for="tag in tagStore.sortedTags"
          :key="tag._id"
          class="tag-chip"
          :class="{ selected: isTagSelected(tag._id) }"
          :style="{ '--tag-color': tag.color }"
          @click="toggleProjectTag(tag._id)"
        >
          {{ tag.name }}
        </div>
      </div>
    </div>

    <!-- 创建/编辑弹窗 -->
    <Teleport to="body">
      <div v-if="showCreateModal || editingTag" class="modal-overlay" @click.self="closeModal">
        <div class="modal-container small">
          <div class="modal-header">
            <h4>{{ editingTag ? '编辑标签' : '新建标签' }}</h4>
            <button class="close-btn" @click="closeModal">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>标签名称</label>
              <input
                type="text"
                v-model="formData.name"
                placeholder="输入标签名称"
                maxlength="20"
              />
            </div>
            <div class="form-group">
              <label>标签颜色</label>
              <div class="color-picker">
                <div
                  v-for="color in colorOptions"
                  :key="color"
                  class="color-option"
                  :class="{ selected: formData.color === color }"
                  :style="{ background: color }"
                  @click="formData.color = color"
                ></div>
                <input type="color" v-model="formData.color" class="custom-color" />
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn secondary" @click="closeModal">取消</button>
            <button
              class="btn primary"
              @click="handleSubmit"
              :disabled="!formData.name.trim()"
            >
              {{ editingTag ? '保存' : '创建' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue';
import { useTagStore } from '@/stores/tagStore';
import type { Tag } from '@/types';

const props = defineProps<{
  projectId?: string;
  projectTags?: string[];
}>();

const emit = defineEmits<{
  (e: 'update:projectTags', tags: string[]): void;
}>();

const tagStore = useTagStore();

const showCreateModal = ref(false);
const editingTag = ref<Tag | null>(null);

const formData = reactive({
  name: '',
  color: '#1976d2',
});

const colorOptions = [
  '#1976d2', '#2e7d32', '#f57c00', '#c62828',
  '#7b1fa2', '#0097a7', '#5d4037', '#455a64',
];

// 本地项目标签状态
const localProjectTags = ref<string[]>([]);

onMounted(async () => {
  if (tagStore.tags.length === 0) {
    await tagStore.loadTags();
  }
  if (props.projectTags) {
    localProjectTags.value = [...props.projectTags];
  }
});

watch(() => props.projectTags, (newTags) => {
  if (newTags) {
    localProjectTags.value = [...newTags];
  }
}, { immediate: true });

function isTagSelected(tagId: string): boolean {
  return localProjectTags.value.includes(tagId);
}

async function toggleProjectTag(tagId: string) {
  if (!props.projectId) return;

  try {
    if (isTagSelected(tagId)) {
      await tagStore.removeTagFromProject(props.projectId, tagId);
      localProjectTags.value = localProjectTags.value.filter(id => id !== tagId);
    } else {
      await tagStore.addTagToProject(props.projectId, tagId);
      localProjectTags.value.push(tagId);
    }
    emit('update:projectTags', localProjectTags.value);
  } catch (err) {
    console.error('更新项目标签失败:', err);
  }
}

function editTag(tag: Tag) {
  editingTag.value = tag;
  formData.name = tag.name;
  formData.color = tag.color;
}

async function deleteTag(tag: Tag) {
  if (!confirm(`确定要删除标签"${tag.name}"吗？`)) return;

  try {
    await tagStore.deleteTag(tag._id);
  } catch (err) {
    alert('删除失败: ' + (err as Error).message);
  }
}

function closeModal() {
  showCreateModal.value = false;
  editingTag.value = null;
  formData.name = '';
  formData.color = '#1976d2';
}

async function handleSubmit() {
  if (!formData.name.trim()) return;

  try {
    if (editingTag.value) {
      await tagStore.updateTag(editingTag.value._id, {
        name: formData.name,
        color: formData.color,
      });
    } else {
      await tagStore.createTag({
        name: formData.name,
        color: formData.color,
      });
    }
    closeModal();
  } catch (err) {
    alert('操作失败: ' + (err as Error).message);
  }
}
</script>

<style scoped>
.tag-manager {
  padding: var(--space-4);
}

.manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.manager-header h4 {
  margin: 0;
  font-size: 14px;
  color: var(--text-primary);
}

.btn-add {
  padding: var(--space-1) var(--space-3);
  background: var(--primary);
  color: var(--text-on-primary);
  border: none;
  border-radius: var(--radius-sm);
  font-size: 12px;
  cursor: pointer;
  transition: var(--transition-fast);
}

.btn-add:hover {
  background: var(--primary-hover);
}

.tag-list {
  margin-bottom: var(--space-5);
}

.loading, .empty {
  padding: var(--space-5);
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}

.tag-item {
  display: flex;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-2);
}

.tag-color {
  width: 14px;
  height: 14px;
  border-radius: var(--radius-sm);
  margin-right: var(--space-2);
}

.tag-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
}

.tag-actions {
  display: flex;
  gap: var(--space-1);
}

.action-btn {
  padding: var(--space-1) var(--space-2);
  border: none;
  border-radius: var(--radius-sm);
  font-size: 11px;
  cursor: pointer;
  transition: var(--transition-fast);
}

.action-btn.edit {
  background: var(--primary-muted);
  color: var(--primary);
}

.action-btn.edit:hover {
  background: rgba(99, 102, 241, 0.25);
}

.action-btn.delete {
  background: var(--error-muted);
  color: var(--error);
}

.action-btn.delete:hover {
  background: rgba(239, 68, 68, 0.25);
}

.project-tags {
  border-top: 1px solid var(--border-default);
  padding-top: var(--space-4);
}

.project-tags h5 {
  margin: 0 0 var(--space-3);
  font-size: 12px;
  color: var(--text-secondary);
}

.tag-selector {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.tag-chip {
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  font-size: 12px;
  cursor: pointer;
  background: var(--bg-elevated);
  color: var(--text-primary);
  transition: var(--transition-fast);
}

.tag-chip:hover {
  background: var(--bg-hover);
}

.tag-chip.selected {
  background: var(--tag-color);
  color: var(--text-on-primary);
  border-color: var(--tag-color);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container.small {
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 360px;
  border: 1px solid var(--border-default);
  box-shadow: 0 20px 60px var(--overlay-bg);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border-default);
}

.modal-header h4 {
  margin: 0;
  font-size: 15px;
  color: var(--text-primary);
}

.close-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  font-size: 18px;
  cursor: pointer;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  transition: var(--transition-fast);
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.modal-body {
  padding: var(--space-5);
}

.form-group {
  margin-bottom: var(--space-4);
}

.form-group label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: var(--space-2);
  color: var(--text-primary);
}

.form-group input[type="text"] {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--text-primary);
  box-sizing: border-box;
  transition: var(--transition-fast);
}

.form-group input[type="text"]:focus {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px var(--primary-muted);
}

.color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.color-option {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
  cursor: pointer;
  border: 2px solid transparent;
  transition: var(--transition-fast);
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option.selected {
  border-color: var(--text-primary);
}

.custom-color {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  padding: 0;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--border-default);
}

.btn {
  padding: var(--space-2) var(--space-4);
  border: none;
  border-radius: var(--radius-md);
  font-size: 13px;
  cursor: pointer;
  transition: var(--transition-fast);
}

.btn.primary {
  background: var(--primary);
  color: var(--text-on-primary);
}

.btn.primary:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn.secondary {
  background: var(--bg-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}

.btn.secondary:hover {
  background: var(--bg-hover);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
