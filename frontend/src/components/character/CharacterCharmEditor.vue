<script setup lang="ts">
/**
 * 角色魅力特征编辑器
 * 编辑口头禅、小癖好、标志性动作和高光时刻
 * Requirements: 7.5
 */
import { ref, watch } from 'vue';
import type { Character, ICharacterCharm, ImpressiveMomentType } from '@/types';
import { characterEnhancementApi } from '@/services/api';
import { useToast } from '@/composables/useToast';

const props = defineProps<{
  character: Character;
  projectId: string;
  charm?: ICharacterCharm;
}>();

const emit = defineEmits<{
  (e: 'update', charm: ICharacterCharm): void;
}>();

const toast = useToast();

// 编辑状态
const catchphrases = ref<string[]>([]);
const quirks = ref<string[]>([]);
const signatureMoves = ref<string[]>([]);
const newCatchphrase = ref('');
const newQuirk = ref('');
const newSignatureMove = ref('');

// 高光时刻表单
const showMomentForm = ref(false);
const momentForm = ref({
  episode: 1,
  description: '',
  type: 'combat' as ImpressiveMomentType,
});

const momentTypes: { value: ImpressiveMomentType; label: string }[] = [
  { value: 'combat', label: '战斗' },
  { value: 'wisdom', label: '智慧' },
  { value: 'emotional', label: '情感' },
  { value: 'humor', label: '幽默' },
];

// 初始化数据
watch(() => props.charm, (charm) => {
  if (charm) {
    catchphrases.value = [...charm.catchphrases];
    quirks.value = [...charm.quirks];
    signatureMoves.value = [...charm.signatureMoves];
  } else {
    catchphrases.value = [];
    quirks.value = [];
    signatureMoves.value = [];
  }
}, { immediate: true });

const addItem = (list: string[], newItem: { value: string }, _field: string) => {
  const value = newItem.value.trim();
  if (!value) return;
  if (list.includes(value)) {
    toast.warning('已存在相同项');
    return;
  }
  list.push(value);
  newItem.value = '';
  saveCharm();
};

const removeItem = (list: string[], index: number) => {
  list.splice(index, 1);
  saveCharm();
};

const saveCharm = () => {
  const charm: ICharacterCharm = {
    catchphrases: catchphrases.value,
    quirks: quirks.value,
    signatureMoves: signatureMoves.value,
    impressiveMoments: props.charm?.impressiveMoments || [],
  };
  emit('update', charm);
};

const addMoment = async () => {
  if (!momentForm.value.description.trim()) {
    toast.warning('请填写描述');
    return;
  }
  try {
    await characterEnhancementApi.recordImpressiveMoment(props.character._id, {
      projectId: props.projectId,
      characterName: props.character.name,
      episode: momentForm.value.episode,
      description: momentForm.value.description,
      type: momentForm.value.type,
    });
    toast.success('高光时刻已记录');
    showMomentForm.value = false;
    momentForm.value = { episode: 1, description: '', type: 'combat' };
    // 触发父组件刷新
    emit('update', {
      catchphrases: catchphrases.value,
      quirks: quirks.value,
      signatureMoves: signatureMoves.value,
      impressiveMoments: props.charm?.impressiveMoments || [],
    });
  } catch (error) {
    toast.error('记录失败');
  }
};

const getMomentTypeLabel = (type: ImpressiveMomentType) => {
  return momentTypes.find(t => t.value === type)?.label || type;
};
</script>

<template>
  <div class="charm-editor">
    <!-- 口头禅 -->
    <div class="charm-section">
      <div class="section-header">
        <span class="section-icon">💬</span>
        <span class="section-title">口头禅</span>
      </div>
      <div class="tag-list">
        <span v-for="(item, idx) in catchphrases" :key="idx" class="tag">
          "{{ item }}"
          <button class="tag-remove" @click="removeItem(catchphrases, idx)">×</button>
        </span>
        <div class="tag-input-wrapper">
          <input
            v-model="newCatchphrase"
            type="text"
            class="tag-input"
            placeholder="添加口头禅..."
            @keyup.enter="addItem(catchphrases, { value: newCatchphrase }, 'catchphrase'); newCatchphrase = ''"
          />
          <button class="tag-add" @click="addItem(catchphrases, { value: newCatchphrase }, 'catchphrase'); newCatchphrase = ''">+</button>
        </div>
      </div>
    </div>

    <!-- 小癖好 -->
    <div class="charm-section">
      <div class="section-header">
        <span class="section-icon">🎭</span>
        <span class="section-title">小癖好</span>
      </div>
      <div class="tag-list">
        <span v-for="(item, idx) in quirks" :key="idx" class="tag">
          {{ item }}
          <button class="tag-remove" @click="removeItem(quirks, idx)">×</button>
        </span>
        <div class="tag-input-wrapper">
          <input
            v-model="newQuirk"
            type="text"
            class="tag-input"
            placeholder="添加小癖好..."
            @keyup.enter="addItem(quirks, { value: newQuirk }, 'quirk'); newQuirk = ''"
          />
          <button class="tag-add" @click="addItem(quirks, { value: newQuirk }, 'quirk'); newQuirk = ''">+</button>
        </div>
      </div>
    </div>

    <!-- 标志性动作 -->
    <div class="charm-section">
      <div class="section-header">
        <span class="section-icon">⚡</span>
        <span class="section-title">标志性动作</span>
      </div>
      <div class="tag-list">
        <span v-for="(item, idx) in signatureMoves" :key="idx" class="tag">
          {{ item }}
          <button class="tag-remove" @click="removeItem(signatureMoves, idx)">×</button>
        </span>
        <div class="tag-input-wrapper">
          <input
            v-model="newSignatureMove"
            type="text"
            class="tag-input"
            placeholder="添加标志性动作..."
            @keyup.enter="addItem(signatureMoves, { value: newSignatureMove }, 'signatureMove'); newSignatureMove = ''"
          />
          <button class="tag-add" @click="addItem(signatureMoves, { value: newSignatureMove }, 'signatureMove'); newSignatureMove = ''">+</button>
        </div>
      </div>
    </div>

    <!-- 高光时刻 -->
    <div class="charm-section">
      <div class="section-header">
        <span class="section-icon">🌟</span>
        <span class="section-title">高光时刻</span>
        <button class="btn-add-moment" @click="showMomentForm = !showMomentForm">
          {{ showMomentForm ? '取消' : '+ 添加' }}
        </button>
      </div>

      <!-- 添加表单 -->
      <div v-if="showMomentForm" class="moment-form">
        <div class="form-row">
          <div class="form-field">
            <label>集数</label>
            <input v-model.number="momentForm.episode" type="number" min="1" class="field-input" />
          </div>
          <div class="form-field">
            <label>类型</label>
            <select v-model="momentForm.type" class="field-select">
              <option v-for="t in momentTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
          </div>
        </div>
        <div class="form-field full">
          <label>描述</label>
          <textarea v-model="momentForm.description" class="field-textarea" rows="2" placeholder="描述这个高光时刻..."></textarea>
        </div>
        <button class="btn-primary" @click="addMoment">保存</button>
      </div>

      <!-- 高光时刻列表 -->
      <div class="moment-list">
        <div v-if="!charm?.impressiveMoments?.length" class="empty-hint">
          暂无高光时刻记录
        </div>
        <div v-for="(moment, idx) in charm?.impressiveMoments" :key="idx" class="moment-item">
          <div class="moment-meta">
            <span class="moment-episode">第{{ moment.episode }}集</span>
            <span class="moment-type" :class="moment.type">{{ getMomentTypeLabel(moment.type) }}</span>
          </div>
          <div class="moment-desc">{{ moment.description }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.charm-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.charm-section {
  background: var(--bg-base);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.section-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.section-icon {
  font-size: 16px;
}

.section-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  flex: 1;
}

.btn-add-moment {
  padding: var(--space-1) var(--space-2);
  background: var(--primary-muted);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--primary);
  cursor: pointer;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.tag-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  background: transparent;
  border: none;
  border-radius: var(--radius-full);
  font-size: 14px;
  color: var(--text-tertiary);
  cursor: pointer;
}

.tag-remove:hover {
  background: var(--bg-hover);
  color: var(--danger);
}

.tag-input-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.tag-input {
  width: 120px;
  padding: var(--space-1) var(--space-2);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.tag-input:focus {
  outline: none;
  border-color: var(--primary);
}

.tag-add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--primary);
  border: none;
  border-radius: var(--radius-full);
  font-size: 14px;
  color: var(--text-on-primary);
  cursor: pointer;
}

.moment-form {
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  margin-bottom: var(--space-3);
}

.form-row {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-field.full {
  width: 100%;
  margin-bottom: var(--space-3);
}

.form-field label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.field-input,
.field-select,
.field-textarea {
  padding: var(--space-2);
  background: var(--bg-base);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.field-textarea {
  resize: vertical;
}

.btn-primary {
  padding: var(--space-2) var(--space-4);
  background: var(--primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-on-primary);
  cursor: pointer;
}

.moment-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.empty-hint {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  text-align: center;
  padding: var(--space-4);
}

.moment-item {
  padding: var(--space-2);
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
}

.moment-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.moment-episode {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.moment-type {
  font-size: var(--text-xs);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.moment-type.combat { background: #fee2e2; color: var(--error); }
.moment-type.wisdom { background: #dbeafe; color: var(--info); }
.moment-type.emotional { background: #fce7f3; color: #db2777; }
.moment-type.humor { background: var(--warning-muted); color: var(--warning); }

.moment-desc {
  font-size: var(--text-sm);
  color: var(--text-primary);
}
</style>
