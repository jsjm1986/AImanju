<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import Modal from '@/components/common/Modal.vue';
import { worldStateApi } from '@/services/api';

interface RhythmPreset {
  type: string;
  name: string;
  description: string;
  icon: string;
  recommendedGenres: string[];
}

interface RhythmParams {
  faceSlappingFrequency: number;
  coolPointDensity: number;
  powerUpSpeed: 'slow' | 'medium' | 'fast' | 'godlike';
  equipmentDropRate: 'rare' | 'normal' | 'frequent';
  plotTwistFrequency: number;
  suspenseIntensity: 'weak' | 'medium' | 'strong' | 'extreme';
  romanceSpeed: 'none' | 'slow' | 'normal' | 'fast' | 'instant';
  heartacheLevel: 'none' | 'light' | 'medium' | 'heavy' | 'be';
  villainIQ: 'fodder' | 'normal' | 'smart' | 'genius';
  pressureCurve: 'easy' | 'normal' | 'hard' | 'extreme';
  bossInterval: number;
}

interface Option { value: string; label: string; desc: string }

interface Props {
  visible: boolean;
  projectId: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', params: RhythmParams): void;
}>();

const loading = ref(false);
const presets = ref<RhythmPreset[]>([]);
const selectedPreset = ref('hot-blood');
const showAdvanced = ref(false);

const params = ref<RhythmParams>({
  faceSlappingFrequency: 3,
  coolPointDensity: 2,
  powerUpSpeed: 'medium',
  equipmentDropRate: 'normal',
  plotTwistFrequency: 15,
  suspenseIntensity: 'medium',
  romanceSpeed: 'normal',
  heartacheLevel: 'light',
  villainIQ: 'normal',
  pressureCurve: 'normal',
  bossInterval: 20,
});

type ParamKey = keyof RhythmParams;

interface OptionGroup {
  title: string;
  fields: { label: string; key: ParamKey; options: Option[] }[];
  sliders?: { label: string; key: ParamKey; min: number; max: number; unit: string }[];
}

const optionGroups: OptionGroup[] = [
  {
    title: '爽点控制',
    fields: [],
    sliders: [
      { label: '打脸频率', key: 'faceSlappingFrequency', min: 1, max: 20, unit: '集/次' },
      { label: '爽点密度', key: 'coolPointDensity', min: 1, max: 5, unit: '个/集' },
    ],
  },
  {
    title: '升级控制',
    fields: [
      { label: '升级节奏', key: 'powerUpSpeed', options: [
        { value: 'slow', label: '慢热', desc: '每次提升需大量铺垫' },
        { value: 'medium', label: '稳健', desc: '遇机缘才能提升' },
        { value: 'fast', label: '快速', desc: '战斗中常有突破' },
        { value: 'godlike', label: '开挂', desc: '战力飙升' },
      ]},
      { label: '装备获取', key: 'equipmentDropRate', options: [
        { value: 'rare', label: '稀有', desc: '装备难得' },
        { value: 'normal', label: '正常', desc: '正常获取' },
        { value: 'frequent', label: '频繁', desc: '装备易得' },
      ]},
    ],
  },
  {
    title: '情节控制',
    fields: [
      { label: '悬念强度', key: 'suspenseIntensity', options: [
        { value: 'weak', label: '弱', desc: '剧情直白' },
        { value: 'medium', label: '中', desc: '适度悬念' },
        { value: 'strong', label: '强', desc: '多处留白' },
        { value: 'extreme', label: '极强', desc: '层层迷雾' },
      ]},
    ],
    sliders: [
      { label: '反转频率', key: 'plotTwistFrequency', min: 5, max: 30, unit: '集/次' },
    ],
  },
  {
    title: '感情线控制',
    fields: [
      { label: '感情进度', key: 'romanceSpeed', options: [
        { value: 'none', label: '无', desc: '无感情线' },
        { value: 'slow', label: '慢热', desc: '暗生情愫' },
        { value: 'normal', label: '正常', desc: '正常发展' },
        { value: 'fast', label: '快速', desc: '快速升温' },
        { value: 'instant', label: '闪恋', desc: '一见钟情' },
      ]},
      { label: '虐心程度', key: 'heartacheLevel', options: [
        { value: 'none', label: '无', desc: '纯甜' },
        { value: 'light', label: '微虐', desc: '小虐怡情' },
        { value: 'medium', label: '中虐', desc: '适度虐心' },
        { value: 'heavy', label: '大虐', desc: '虐到心碎' },
        { value: 'be', label: 'BE', desc: '悲剧结局' },
      ]},
    ],
  },
  {
    title: '冲突控制',
    fields: [
      { label: '反派智商', key: 'villainIQ', options: [
        { value: 'fodder', label: '送人头', desc: '智商下线' },
        { value: 'normal', label: '普通', desc: '有基本策略' },
        { value: 'smart', label: '聪明', desc: '会设陷阱' },
        { value: 'genius', label: '高智商', desc: '计中计' },
      ]},
      { label: '压力曲线', key: 'pressureCurve', options: [
        { value: 'easy', label: '轻松', desc: '碾压式' },
        { value: 'normal', label: '正常', desc: '有来有回' },
        { value: 'hard', label: '困难', desc: '压力较大' },
        { value: 'extreme', label: '绝境', desc: '生死存亡' },
      ]},
    ],
    sliders: [
      { label: 'Boss间隔', key: 'bossInterval', min: 10, max: 50, unit: '集/次' },
    ],
  },
];

const presetParams: Record<string, Partial<RhythmParams>> = {
  'extreme-cool': {
    faceSlappingFrequency: 1, coolPointDensity: 4, powerUpSpeed: 'godlike',
    equipmentDropRate: 'frequent', plotTwistFrequency: 20, suspenseIntensity: 'weak',
    romanceSpeed: 'fast', heartacheLevel: 'none', villainIQ: 'fodder',
    pressureCurve: 'easy', bossInterval: 10,
  },
  'hot-blood': {
    faceSlappingFrequency: 3, coolPointDensity: 2, powerUpSpeed: 'medium',
    equipmentDropRate: 'normal', plotTwistFrequency: 15, suspenseIntensity: 'medium',
    romanceSpeed: 'slow', heartacheLevel: 'light', villainIQ: 'smart',
    pressureCurve: 'normal', bossInterval: 20,
  },
  'brain-burn': {
    faceSlappingFrequency: 10, coolPointDensity: 1, powerUpSpeed: 'slow',
    equipmentDropRate: 'rare', plotTwistFrequency: 8, suspenseIntensity: 'extreme',
    romanceSpeed: 'slow', heartacheLevel: 'medium', villainIQ: 'genius',
    pressureCurve: 'hard', bossInterval: 30,
  },
  'horror-thriller': {
    faceSlappingFrequency: 15, coolPointDensity: 1, powerUpSpeed: 'slow',
    equipmentDropRate: 'rare', plotTwistFrequency: 10, suspenseIntensity: 'extreme',
    romanceSpeed: 'none', heartacheLevel: 'heavy', villainIQ: 'smart',
    pressureCurve: 'extreme', bossInterval: 15,
  },
  'sweet-romance': {
    faceSlappingFrequency: 20, coolPointDensity: 1, powerUpSpeed: 'slow',
    equipmentDropRate: 'normal', plotTwistFrequency: 25, suspenseIntensity: 'weak',
    romanceSpeed: 'fast', heartacheLevel: 'none', villainIQ: 'normal',
    pressureCurve: 'easy', bossInterval: 40,
  },
  'system-flow': {
    faceSlappingFrequency: 2, coolPointDensity: 3, powerUpSpeed: 'fast',
    equipmentDropRate: 'frequent', plotTwistFrequency: 15, suspenseIntensity: 'medium',
    romanceSpeed: 'normal', heartacheLevel: 'light', villainIQ: 'normal',
    pressureCurve: 'normal', bossInterval: 15,
  },
  'mind-game': {
    faceSlappingFrequency: 5, coolPointDensity: 2, powerUpSpeed: 'slow',
    equipmentDropRate: 'rare', plotTwistFrequency: 5, suspenseIntensity: 'strong',
    romanceSpeed: 'slow', heartacheLevel: 'medium', villainIQ: 'genius',
    pressureCurve: 'hard', bossInterval: 25,
  },
  'overseas-romance': {
    faceSlappingFrequency: 4, coolPointDensity: 3, powerUpSpeed: 'fast',
    equipmentDropRate: 'normal', plotTwistFrequency: 10, suspenseIntensity: 'strong',
    romanceSpeed: 'fast', heartacheLevel: 'medium', villainIQ: 'smart',
    pressureCurve: 'hard', bossInterval: 15,
  },
  'overseas-revenge': {
    faceSlappingFrequency: 2, coolPointDensity: 3, powerUpSpeed: 'fast',
    equipmentDropRate: 'frequent', plotTwistFrequency: 12, suspenseIntensity: 'medium',
    romanceSpeed: 'slow', heartacheLevel: 'light', villainIQ: 'smart',
    pressureCurve: 'hard', bossInterval: 12,
  },
};

const loadPresets = async () => {
  try {
    const response = await worldStateApi.getRhythmPresets();
    presets.value = response.data.presets || [];
  } catch (error) {
    console.error('加载预设失败:', error);
  }
};

const loadConfig = async () => {
  if (!props.projectId) return;
  loading.value = true;
  try {
    const response = await worldStateApi.getRhythmConfig(props.projectId);
    if (response.data.params) params.value = { ...params.value, ...response.data.params };
    if (response.data.currentPreset) selectedPreset.value = response.data.currentPreset;
  } catch (error) {
    console.error('加载配置失败:', error);
  } finally {
    loading.value = false;
  }
};

const selectPreset = (presetType: string) => {
  selectedPreset.value = presetType;
  if (presetParams[presetType]) {
    params.value = { ...params.value, ...presetParams[presetType] };
  }
};

const setParam = (key: ParamKey, value: string) => {
  (params.value as any)[key] = value;
};

const handleSave = async () => {
  loading.value = true;
  try {
    await worldStateApi.saveRhythmConfig(props.projectId, { preset: selectedPreset.value, params: params.value });
    emit('save', params.value);
    emit('close');
  } catch (error) {
    console.error('保存配置失败:', error);
  } finally {
    loading.value = false;
  }
};

watch(() => props.visible, (v) => { if (v) loadConfig(); });
onMounted(loadPresets);
</script>

<template>
  <Modal :show="visible" title="节奏控制设置" @close="$emit('close')" width="600px">
    <div class="rhythm-panel">
      <div class="section">
        <h3 class="section-title">选择节奏模板</h3>
        <div class="preset-grid">
          <div
            v-for="preset in presets"
            :key="preset.type"
            class="preset-card"
            :class="{ active: selectedPreset === preset.type }"
            @click="selectPreset(preset.type)"
          >
            <span class="preset-icon">{{ preset.icon }}</span>
            <span class="preset-name">{{ preset.name }}</span>
            <span class="preset-desc">{{ preset.description }}</span>
          </div>
        </div>
      </div>

      <div class="advanced-toggle" @click="showAdvanced = !showAdvanced">
        <span>高级选项</span>
        <span class="toggle-icon">{{ showAdvanced ? '▼' : '▶' }}</span>
      </div>

      <div class="advanced-section" v-show="showAdvanced">
        <div v-for="group in optionGroups" :key="group.title" class="param-group">
          <h4 class="group-title">{{ group.title }}</h4>

          <div v-for="s in group.sliders" :key="s.key" class="param-row">
            <label class="param-label">{{ s.label }}</label>
            <div class="param-control">
              <input
                type="range"
                v-model.number="(params as any)[s.key]"
                :min="s.min"
                :max="s.max"
                class="slider"
              />
              <span class="param-value">{{ (params as any)[s.key] }}{{ s.unit }}</span>
            </div>
          </div>

          <div v-for="f in group.fields" :key="f.key" class="param-row">
            <label class="param-label">{{ f.label }}</label>
            <div class="option-buttons">
              <button
                v-for="opt in f.options"
                :key="opt.value"
                class="option-btn"
                :class="{ active: (params as any)[f.key] === opt.value }"
                @click="setParam(f.key, opt.value)"
                :title="opt.desc"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-secondary" @click="$emit('close')">取消</button>
        <button class="btn btn-primary" @click="handleSave" :disabled="loading">
          保存设置
        </button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.rhythm-panel {
  padding: var(--space-2) 0;
}

.section {
  margin-bottom: var(--space-6);
}

.section-title {
  margin: 0 0 var(--space-4);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: var(--space-2);
}

.preset-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-3) var(--space-2);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition-fast);
  text-align: center;
}

.preset-card:hover {
  border-color: var(--border-hover);
  background: var(--bg-hover);
}

.preset-card.active {
  border-color: var(--primary);
  background: var(--primary-muted);
}

.preset-icon {
  font-size: 22px;
  margin-bottom: var(--space-1);
}

.preset-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
}

.preset-desc {
  font-size: 10px;
  color: var(--text-secondary);
  margin-top: var(--space-1);
}

.advanced-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-4);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: var(--space-4);
  transition: var(--transition-fast);
}

.advanced-toggle:hover {
  background: var(--bg-hover);
}

.toggle-icon {
  font-size: 10px;
  color: var(--text-secondary);
}

.advanced-section {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  margin-bottom: var(--space-6);
}

.param-group {
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--border-default);
}

.param-group:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.group-title {
  margin: 0 0 var(--space-2);
  font-size: 12px;
  font-weight: 500;
  color: var(--primary);
}

.param-row {
  display: flex;
  align-items: center;
  margin-bottom: var(--space-2);
}

.param-row:last-child {
  margin-bottom: 0;
}

.param-label {
  width: 80px;
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.param-control {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.slider {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--bg-hover);
  border-radius: 2px;
  outline: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
  transition: var(--transition-fast);
}

.slider::-webkit-slider-thumb:hover {
  background: var(--primary-hover);
  transform: scale(1.1);
}

.param-value {
  width: 70px;
  text-align: right;
  font-size: 12px;
  color: var(--text-primary);
}

.option-buttons {
  flex: 1;
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}

.option-btn {
  padding: var(--space-1) var(--space-2);
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: var(--transition-fast);
}

.option-btn:hover {
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.option-btn.active {
  border-color: var(--primary);
  background: var(--primary);
  color: var(--text-on-primary);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-default);
}
</style>
