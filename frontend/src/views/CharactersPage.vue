<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useCharacterStore } from '@/stores/characterStore';
import { useToast } from '@/composables/useToast';
import { useConfirm } from '@/composables/useConfirm';
import type { Character } from '@/types';
import CharacterEnhancementPanel from '@/components/character/CharacterEnhancementPanel.vue';

const route = useRoute();
const characterStore = useCharacterStore();
const toast = useToast();
const confirmDialog = useConfirm();

const projectId = computed(() => route.params.id as string);
const selectedCharacter = ref<Character | null>(null);
const isEditing = ref(false);
const isCreating = ref(false);
const searchQuery = ref('');
const showEnhancementPanel = ref(false);
const collapsedGroups = ref<Set<string>>(new Set());

const formData = ref({
  name: '',
  role: '',
  type: '',
  gender: '',
  age: '',
  identity: '',
  personality: '',
  background: '',
  abilities: '',
  hairStyle: '',
  hairColor: '',
  faceType: '',
  bodyType: '',
  clothing: '',
  accessories: '',
});

const MAIN_TYPES = ['main', '主角', '男主角', '女主角'];
const EXTRA_TYPES = ['extra', '龙套', '客串', '客串角色'];

const getTypeCategory = (type: string): string => {
  if (MAIN_TYPES.includes(type)) return '主角';
  if (EXTRA_TYPES.includes(type)) return '龙套';
  return '配角';
};

const characterGroups = computed(() => {
  const groups: Record<string, Character[]> = { '主角': [], '配角': [], '龙套': [] };
  const query = searchQuery.value.toLowerCase();

  for (const char of characterStore.characters) {
    if (query && !char.name.toLowerCase().includes(query) && !char.identity?.toLowerCase().includes(query)) continue;
    const cat = getTypeCategory(char.type);
    groups[cat]?.push(char);
  }
  return groups;
});

const hasAppearanceInfo = computed(() => {
  const c = selectedCharacter.value;
  return c && (c.hairStyle || c.hairColor || c.faceType || c.bodyType || c.clothing);
});

const textSections = computed(() => {
  const c = selectedCharacter.value;
  if (!c) return [];
  return [
    { key: 'personality', icon: '💭', label: '性格特征', text: c.personality },
    { key: 'background', icon: '📖', label: '背景故事', text: c.background },
    { key: 'abilities', icon: '⚡', label: '能力/技能', text: c.abilities },
  ].filter(s => s.text);
});

const toggleGroup = (group: string) => {
  const s = collapsedGroups.value;
  s.has(group) ? s.delete(group) : s.add(group);
};

onMounted(() => {
  if (projectId.value) {
    characterStore.fetchCharacters(projectId.value).then(() => {
      if (characterStore.characters.length > 0 && !selectedCharacter.value) {
        selectedCharacter.value = characterStore.characters[0] ?? null;
      }
    });
  }
});

watch(() => characterStore.characters, (chars) => {
  if (chars.length > 0 && !selectedCharacter.value) {
    selectedCharacter.value = chars[0] ?? null;
  } else if (selectedCharacter.value) {
    const updated = chars.find(c => c._id === selectedCharacter.value?._id);
    if (updated) selectedCharacter.value = updated;
  }
}, { deep: true });

const selectCharacter = (character: Character) => {
  if (isEditing.value) {
    toast.warning('请先保存或取消当前编辑');
    return;
  }
  selectedCharacter.value = character;
  isCreating.value = false;
};

const startCreate = () => {
  isCreating.value = true;
  isEditing.value = true;
  selectedCharacter.value = null;
  formData.value = {
    name: '', role: '', type: '配角', gender: '未知', age: '',
    identity: '', personality: '', background: '', abilities: '',
    hairStyle: '', hairColor: '', faceType: '', bodyType: '', clothing: '', accessories: '',
  };
};

const startEdit = () => {
  if (!selectedCharacter.value) return;
  isEditing.value = true;
  const c = selectedCharacter.value;
  formData.value = {
    name: c.name,
    role: c.role || '',
    type: getTypeLabel(c.type),
    gender: getGenderLabel(c.gender),
    age: c.age || '',
    identity: c.identity,
    personality: c.personality,
    background: c.background,
    abilities: c.abilities || '',
    hairStyle: c.hairStyle || '',
    hairColor: c.hairColor || '',
    faceType: c.faceType || '',
    bodyType: c.bodyType || '',
    clothing: c.clothing || '',
    accessories: c.accessories || '',
  };
};

const cancelEdit = () => {
  isEditing.value = false;
  isCreating.value = false;
};

const handleSave = async () => {
  if (!formData.value.name || !formData.value.identity || !formData.value.personality) {
    toast.warning('请填写必填字段');
    return;
  }
  try {
    if (isCreating.value) {
      const newChar = await characterStore.createCharacter({
        ...formData.value,
        projectId: projectId.value,
      });
      selectedCharacter.value = newChar ?? null;
      toast.success('角色创建成功');
    } else if (selectedCharacter.value) {
      await characterStore.updateCharacter(selectedCharacter.value._id, formData.value);
      toast.success('角色已更新');
    }
    isEditing.value = false;
    isCreating.value = false;
  } catch (error) {
    toast.error('保存失败');
  }
};

const handleDelete = async () => {
  if (!selectedCharacter.value) return;
  const confirmed = await confirmDialog.danger(`确定删除 "${selectedCharacter.value.name}"？`);
  if (confirmed) {
    try {
      await characterStore.deleteCharacter(selectedCharacter.value._id);
      selectedCharacter.value = characterStore.characters[0] || null;
      toast.success('已删除');
    } catch (error) {
      toast.error('删除失败');
    }
  }
};

const GENDER_LABELS: Record<string, string> = { male: '男', female: '女', unknown: '未知' };
const TYPE_LABELS: Record<string, string> = { main: '主角', supporting: '重要配角', recurring: '关键角色', guest: '客串角色', extra: '龙套' };
const TYPE_CLASSES: Record<string, string> = {
  main: 'type-main', '主角': 'type-main', '男主角': 'type-main', '女主角': 'type-main',
  supporting: 'type-supporting', '重要配角': 'type-supporting', '配角': 'type-supporting',
  recurring: 'type-recurring', '关键角色': 'type-recurring', '反派': 'type-recurring',
  guest: 'type-guest', '客串角色': 'type-guest', '客串': 'type-guest',
  extra: 'type-extra', '龙套': 'type-extra',
};
const GROUP_ICONS: Record<string, string> = { '主角': '⭐', '配角': '👥', '龙套': '👤' };

const getGenderLabel = (gender: string) => GENDER_LABELS[gender] || gender;
const getTypeLabel = (type: string) => TYPE_LABELS[type] || type || '配角';
const getTypeClass = (type: string) => TYPE_CLASSES[type] || 'type-supporting';
const getGroupIcon = (group: string) => GROUP_ICONS[group] || '👤';
</script>

<template>
  <div class="characters-page">
    <header class="page-toolbar">
      <div class="toolbar-left">
        <h2 class="page-title">角色管理</h2>
        <span class="count-badge">{{ characterStore.characters.length }}</span>
      </div>
      <div class="toolbar-right">
        <div class="search-wrapper">
          <span class="search-icon">🔍</span>
          <input v-model="searchQuery" type="text" placeholder="搜索角色..." class="search-input" />
        </div>
        <button class="btn-primary" @click="startCreate">+ 添加角色</button>
      </div>
    </header>

    <div class="main-content">
      <aside class="character-sidebar">
        <div v-if="characterStore.characters.length === 0" class="empty-state">
          <div class="empty-icon">👥</div>
          <p class="empty-title">暂无角色</p>
          <p class="empty-desc">创建角色来丰富你的故事</p>
          <button class="btn-primary" @click="startCreate">+ 添加角色</button>
        </div>

        <div v-else class="character-groups">
          <div v-for="(chars, group) in characterGroups" :key="group" class="character-group">
            <div v-if="chars.length > 0" class="group-header" @click="toggleGroup(group)">
              <div class="group-left">
                <span class="group-toggle" :class="{ collapsed: collapsedGroups.has(group) }">▼</span>
                <span class="group-icon">{{ getGroupIcon(group) }}</span>
                <span class="group-name">{{ group }}</span>
              </div>
              <span class="group-count">{{ chars.length }}</span>
            </div>
            <div v-if="!collapsedGroups.has(group) && chars.length > 0" class="group-content">
              <div
                v-for="char in chars"
                :key="char._id"
                class="character-card"
                :class="{ active: selectedCharacter?._id === char._id }"
                @click="selectCharacter(char)"
              >
                <div class="card-avatar" :class="getTypeClass(char.type)">
                  <span class="avatar-text">{{ char.name.charAt(0) }}</span>
                </div>
                <div class="card-content">
                  <div class="card-name">{{ char.name }}</div>
                  <div class="card-meta">
                    <span class="card-type" :class="getTypeClass(char.type)">{{ getTypeLabel(char.type) }}</span>
                  </div>
                  <div class="card-desc">{{ char.identity || '暂无描述' }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main class="character-detail">
        <div v-if="isEditing" class="detail-form">
          <div class="form-header">
            <h3 class="form-title">{{ isCreating ? '创建角色' : '编辑角色' }}</h3>
            <div class="form-actions">
              <button class="btn-ghost" @click="cancelEdit">取消</button>
              <button class="btn-primary" @click="handleSave">保存</button>
            </div>
          </div>
          <div class="form-body">
            <div class="info-card">
              <div class="card-header"><span class="card-icon">📋</span><span class="card-label">基本信息</span></div>
              <div class="card-body">
                <div class="form-grid">
                  <div class="form-field">
                    <label class="field-label">名称 *</label>
                    <input v-model="formData.name" type="text" class="field-input" placeholder="角色名称" />
                  </div>
                  <div class="form-field">
                    <label class="field-label">类型</label>
                    <select v-model="formData.type" class="field-select">
                      <option value="主角">主角</option>
                      <option value="重要配角">重要配角</option>
                      <option value="关键角色">关键角色</option>
                      <option value="客串角色">客串角色</option>
                      <option value="龙套">龙套</option>
                    </select>
                  </div>
                  <div class="form-field">
                    <label class="field-label">性别</label>
                    <select v-model="formData.gender" class="field-select">
                      <option value="男">男</option>
                      <option value="女">女</option>
                      <option value="未知">未知</option>
                    </select>
                  </div>
                  <div class="form-field">
                    <label class="field-label">年龄</label>
                    <input v-model="formData.age" type="text" class="field-input" placeholder="如：25岁" />
                  </div>
                </div>
                <div class="form-field full-width">
                  <label class="field-label">身份 *</label>
                  <input v-model="formData.identity" type="text" class="field-input" placeholder="角色身份描述" />
                </div>
              </div>
            </div>
            <div class="info-card">
              <div class="card-header"><span class="card-icon">👤</span><span class="card-label">外貌特征</span></div>
              <div class="card-body">
                <div class="form-grid">
                  <div class="form-field">
                    <label class="field-label">发型</label>
                    <input v-model="formData.hairStyle" type="text" class="field-input" placeholder="如：长发" />
                  </div>
                  <div class="form-field">
                    <label class="field-label">发色</label>
                    <input v-model="formData.hairColor" type="text" class="field-input" placeholder="如：黑色" />
                  </div>
                  <div class="form-field">
                    <label class="field-label">脸型</label>
                    <input v-model="formData.faceType" type="text" class="field-input" placeholder="如：瓜子脸" />
                  </div>
                  <div class="form-field">
                    <label class="field-label">身材</label>
                    <input v-model="formData.bodyType" type="text" class="field-input" placeholder="如：高挑" />
                  </div>
                </div>
                <div class="form-field full-width">
                  <label class="field-label">穿着</label>
                  <input v-model="formData.clothing" type="text" class="field-input" placeholder="常见穿着描述" />
                </div>
                <div class="form-field full-width">
                  <label class="field-label">配饰</label>
                  <input v-model="formData.accessories" type="text" class="field-input" placeholder="特殊配饰" />
                </div>
              </div>
            </div>
            <div class="info-card">
              <div class="card-header"><span class="card-icon">💭</span><span class="card-label">性格与背景</span></div>
              <div class="card-body">
                <div class="form-field full-width">
                  <label class="field-label">性格特征 *</label>
                  <textarea v-model="formData.personality" class="field-textarea" rows="3" placeholder="描述角色的性格特点"></textarea>
                </div>
                <div class="form-field full-width">
                  <label class="field-label">背景故事</label>
                  <textarea v-model="formData.background" class="field-textarea" rows="4" placeholder="角色的背景故事"></textarea>
                </div>
                <div class="form-field full-width">
                  <label class="field-label">能力/技能</label>
                  <textarea v-model="formData.abilities" class="field-textarea" rows="2" placeholder="角色的特殊能力或技能"></textarea>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="selectedCharacter" class="detail-view">
          <div class="detail-header">
            <div class="header-info">
              <div class="detail-avatar" :class="getTypeClass(selectedCharacter.type)">
                <span class="avatar-text">{{ selectedCharacter.name.charAt(0) }}</span>
              </div>
              <div class="header-text">
                <h3 class="detail-name">{{ selectedCharacter.name }}</h3>
                <span class="detail-type" :class="getTypeClass(selectedCharacter.type)">{{ getTypeLabel(selectedCharacter.type) }}</span>
              </div>
            </div>
            <div class="header-actions">
              <button class="btn-ghost" @click="showEnhancementPanel = !showEnhancementPanel">
                {{ showEnhancementPanel ? '📋 基本信息' : '✨ 角色增强' }}
              </button>
              <button class="btn-ghost" @click="handleDelete">🗑️ 删除</button>
              <button class="btn-primary" @click="startEdit">✏️ 编辑</button>
            </div>
          </div>
          <div v-if="!showEnhancementPanel" class="detail-body">
            <div class="info-card">
              <div class="card-header"><span class="card-icon">📋</span><span class="card-label">基本信息</span></div>
              <div class="card-body">
                <div class="info-grid">
                  <div class="info-item"><span class="info-label">性别</span><span class="info-value">{{ getGenderLabel(selectedCharacter.gender) }}</span></div>
                  <div class="info-item"><span class="info-label">年龄</span><span class="info-value">{{ selectedCharacter.age || '未设置' }}</span></div>
                  <div class="info-item"><span class="info-label">类型</span><span class="info-value">{{ getTypeLabel(selectedCharacter.type) }}</span></div>
                  <div class="info-item full-width"><span class="info-label">身份</span><span class="info-value">{{ selectedCharacter.identity }}</span></div>
                </div>
              </div>
            </div>
            <div class="info-card" v-if="hasAppearanceInfo">
              <div class="card-header"><span class="card-icon">👤</span><span class="card-label">外貌特征</span></div>
              <div class="card-body">
                <div class="info-grid">
                  <div class="info-item" v-if="selectedCharacter.hairStyle"><span class="info-label">发型</span><span class="info-value">{{ selectedCharacter.hairStyle }}</span></div>
                  <div class="info-item" v-if="selectedCharacter.hairColor"><span class="info-label">发色</span><span class="info-value">{{ selectedCharacter.hairColor }}</span></div>
                  <div class="info-item" v-if="selectedCharacter.faceType"><span class="info-label">脸型</span><span class="info-value">{{ selectedCharacter.faceType }}</span></div>
                  <div class="info-item" v-if="selectedCharacter.bodyType"><span class="info-label">身材</span><span class="info-value">{{ selectedCharacter.bodyType }}</span></div>
                  <div class="info-item full-width" v-if="selectedCharacter.clothing"><span class="info-label">穿着</span><span class="info-value">{{ selectedCharacter.clothing }}</span></div>
                  <div class="info-item full-width" v-if="selectedCharacter.accessories"><span class="info-label">配饰</span><span class="info-value">{{ selectedCharacter.accessories }}</span></div>
                </div>
              </div>
            </div>
            <div class="info-card" v-for="section in textSections" :key="section.key">
              <div class="card-header"><span class="card-icon">{{ section.icon }}</span><span class="card-label">{{ section.label }}</span></div>
              <div class="card-body"><p class="info-text">{{ section.text }}</p></div>
            </div>
          </div>
          <div v-else class="detail-body">
            <CharacterEnhancementPanel
              :character="selectedCharacter"
              :project-id="projectId"
              :all-characters="characterStore.characters"
            />
          </div>
        </div>

        <div v-else class="detail-empty">
          <div class="empty-icon">👈</div>
          <p class="empty-title">选择一个角色</p>
          <p class="empty-desc">从左侧列表选择角色查看详情</p>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.characters-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--bg-base);
  overflow: hidden;
}

.page-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-5);
  height: var(--toolbar-lg);
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-default);
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.page-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 var(--space-2);
  background: var(--bg-hover);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: var(--space-3);
  font-size: 14px;
  opacity: 0.5;
}

.search-input {
  width: 200px;
  height: 36px;
  padding: 0 var(--space-3) 0 var(--space-8);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.search-input:focus {
  outline: none;
  border-color: var(--primary);
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.character-sidebar {
  width: 280px;
  flex-shrink: 0;
  background: var(--bg-surface);
  border-right: 1px solid var(--border-default);
  overflow-y: auto;
}

.character-groups {
  padding: var(--space-3);
}

.character-group {
  margin-bottom: var(--space-2);
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.group-header:hover {
  background: var(--bg-hover);
}

.group-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.group-toggle {
  font-size: 10px;
  color: var(--text-tertiary);
  transition: transform 0.15s;
}

.group-toggle.collapsed {
  transform: rotate(-90deg);
}

.group-icon {
  font-size: 14px;
}

.group-name {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.group-count {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  background: var(--bg-hover);
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.group-content {
  padding: var(--space-2) 0;
}

.character-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  margin-bottom: var(--space-2);
  background: var(--bg-base);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  cursor: pointer;
}

.character-card:hover {
  border-color: var(--border-hover);
  background: var(--bg-hover);
}

.character-card.active {
  border-color: var(--primary);
  background: var(--primary-muted);
}

.card-avatar {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: var(--bg-hover);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
}

.card-avatar.type-main {
  background: var(--primary-muted);
  color: var(--primary);
}

.card-content {
  flex: 1;
  min-width: 0;
}

.card-name {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: 2px;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.card-type {
  font-size: var(--text-xs);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.card-type.type-main {
  background: var(--primary-muted);
  color: var(--primary);
}

.card-desc {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.character-detail {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-5);
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-5);
}

.header-info {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.detail-avatar {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  background: var(--bg-hover);
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
}

.detail-avatar.type-main {
  background: var(--primary-muted);
  color: var(--primary);
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.detail-name {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.detail-type {
  font-size: var(--text-sm);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-hover);
  color: var(--text-secondary);
  width: fit-content;
}

.detail-type.type-main {
  background: var(--primary-muted);
  color: var(--primary);
}

.header-actions {
  display: flex;
  gap: var(--space-2);
}

.detail-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.info-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.info-card .card-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-default);
}

.card-icon {
  font-size: 16px;
}

.card-label {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.info-card .card-body {
  padding: var(--space-4);
}

.info-card .card-body .form-grid {
  margin-bottom: var(--space-4);
}

.info-card .card-body .form-grid:last-child {
  margin-bottom: 0;
}

.info-card .card-body .form-field.full-width {
  margin-top: var(--space-2);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.info-item.full-width {
  grid-column: 1 / -1;
}

.info-label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.info-text {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
}

.detail-form {
  width: 100%;
}

.form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-5);
}

.form-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.form-actions {
  display: flex;
  gap: var(--space-2);
}

.form-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}

@media (max-width: 1200px) {
  .form-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-field.full-width {
  grid-column: 1 / -1;
}

.field-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.field-input,
.field-select,
.field-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.field-input:focus,
.field-select:focus,
.field-textarea:focus {
  outline: none;
  border-color: var(--primary);
}

.field-textarea {
  resize: vertical;
  min-height: 80px;
  line-height: 1.5;
}

.empty-state,
.detail-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12);
  text-align: center;
  height: 100%;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: var(--space-4);
  opacity: 0.5;
}

.empty-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-2);
}

.empty-desc {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin: 0 0 var(--space-6);
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-on-primary);
  cursor: pointer;
}

.btn-primary:hover {
  background: var(--primary-hover);
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: transparent;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  cursor: pointer;
}

.btn-ghost:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
</style>
