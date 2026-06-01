<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="handleClose">
      <div class="modal-container">
        <div class="modal-header">
          <h3 class="modal-title">
            <span class="icon">🎵</span>
            节奏设置
          </h3>
          <button class="close-btn" @click="handleClose">&times;</button>
        </div>

        <div class="modal-body">
          <!-- 预设选择 -->
          <div class="section">
            <div class="section-header">节奏预设</div>
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

          <!-- 节奏参数 -->
          <div class="section">
            <div class="section-header">详细参数</div>
            <div class="params-grid">
              <!-- 打脸频率 -->
              <div class="param-item">
                <label>打脸频率</label>
                <div class="slider-row">
                  <input
                    type="range"
                    v-model.number="params.faceSlappingFrequency"
                    min="1"
                    max="20"
                    step="1"
                  />
                  <span class="value">{{ params.faceSlappingFrequency }}集</span>
                </div>
                <span class="hint">每N集安排一次打脸情节</span>
              </div>

              <!-- 爽点密度 -->
              <div class="param-item">
                <label>爽点密度</label>
                <div class="slider-row">
                  <input
                    type="range"
                    v-model.number="params.coolPointDensity"
                    min="1"
                    max="5"
                    step="1"
                  />
                  <span class="value">{{ params.coolPointDensity }}</span>
                </div>
                <span class="hint">每集爽点数量</span>
              </div>

              <!-- 升级速度 -->
              <div class="param-item">
                <label>升级速度</label>
                <select v-model="params.powerUpSpeed">
                  <option value="slow">缓慢 - 需要大量积累</option>
                  <option value="medium">中等 - 稳步提升</option>
                  <option value="fast">快速 - 频繁突破</option>
                  <option value="godlike">神速 - 一路开挂</option>
                </select>
              </div>

              <!-- 装备掉落 -->
              <div class="param-item">
                <label>装备掉落</label>
                <select v-model="params.equipmentDropRate">
                  <option value="rare">稀有 - 重要装备少</option>
                  <option value="normal">正常 - 偶尔获得</option>
                  <option value="frequent">频繁 - 经常获得</option>
                </select>
              </div>

              <!-- 反转频率 -->
              <div class="param-item">
                <label>剧情反转</label>
                <div class="slider-row">
                  <input
                    type="range"
                    v-model.number="params.plotTwistFrequency"
                    min="3"
                    max="30"
                    step="1"
                  />
                  <span class="value">{{ params.plotTwistFrequency }}集</span>
                </div>
                <span class="hint">每N集安排一次剧情反转</span>
              </div>

              <!-- 悬念强度 -->
              <div class="param-item">
                <label>悬念强度</label>
                <select v-model="params.suspenseIntensity">
                  <option value="weak">弱 - 轻松愉快</option>
                  <option value="medium">中等 - 适度紧张</option>
                  <option value="strong">强 - 扣人心弦</option>
                  <option value="extreme">极强 - 高度紧张</option>
                </select>
              </div>

              <!-- 反派智商 -->
              <div class="param-item">
                <label>反派智商</label>
                <select v-model="params.villainIQ">
                  <option value="fodder">炮灰型 - 送人头</option>
                  <option value="normal">普通型 - 正常智商</option>
                  <option value="smart">聪明型 - 有谋略</option>
                  <option value="genius">天才型 - 难对付</option>
                </select>
              </div>

              <!-- Boss间隔 -->
              <div class="param-item">
                <label>Boss间隔</label>
                <div class="slider-row">
                  <input
                    type="range"
                    v-model.number="params.bossInterval"
                    min="5"
                    max="50"
                    step="1"
                  />
                  <span class="value">{{ params.bossInterval }}集</span>
                </div>
                <span class="hint">每N集安排一次Boss战</span>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" @click="resetParams">恢复默认</button>
          <button class="btn-primary" @click="handleSave" :disabled="saving">
            {{ saving ? '保存中...' : '保存设置' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRhythmStore } from '@/stores/rhythmStore';
import { useToast } from '@/composables/useToast';
import type { PowerUpSpeed, EquipmentDropRate, SuspenseIntensity, VillainIQ } from '@/types/worldState';

const props = defineProps<{
  visible: boolean;
  projectId: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const rhythmStore = useRhythmStore();
const toast = useToast();

const saving = ref(false);
const selectedPreset = ref('hot-blood');

// 预设列表 - 与后端 RhythmControl.ts 保持一致的8个预设
const presets = [
  { type: 'extreme-cool', name: '极致爽文', icon: '🔥', description: '高打脸、快升级、弱反派' },
  { type: 'hot-blood', name: '热血对决', icon: '⚔️', description: '中打脸、稳升级、聪明反派' },
  { type: 'brain-burn', name: '烧脑悬疑', icon: '🔍', description: '低打脸、高反转、高智商' },
  { type: 'horror-thriller', name: '惊悚恐怖', icon: '😱', description: '低爽点、极强悬念、绝境' },
  { type: 'sweet-romance', name: '甜宠言情', icon: '💕', description: '无打脸、快感情、轻冲突' },
  { type: 'system-flow', name: '系统流爽文', icon: '🎮', description: '中打脸、快升级、频繁装备' },
  { type: 'mind-game', name: '智斗谋略', icon: '🧠', description: '高反转、高智商反派' },
  { type: 'custom', name: '自定义', icon: '⚙️', description: '手动配置所有参数' },
];

// 默认参数 - 使用明确的类型允许赋值各种值
interface LocalRhythmParams {
  faceSlappingFrequency: number;
  coolPointDensity: number;
  powerUpSpeed: PowerUpSpeed;
  equipmentDropRate: EquipmentDropRate;
  plotTwistFrequency: number;
  suspenseIntensity: SuspenseIntensity;
  villainIQ: VillainIQ;
  bossInterval: number;
}

const defaultParams: LocalRhythmParams = {
  faceSlappingFrequency: 3,
  coolPointDensity: 2,
  powerUpSpeed: 'medium',
  equipmentDropRate: 'normal',
  plotTwistFrequency: 5,
  suspenseIntensity: 'medium',
  villainIQ: 'normal',
  bossInterval: 10,
};

const params = ref<LocalRhythmParams>({ ...defaultParams });

// 选择预设 - 参数与后端 RhythmControl.ts 保持一致
function selectPreset(type: string) {
  selectedPreset.value = type;

  // 根据预设调整参数 - 与后端 RHYTHM_PRESETS 保持一致
  switch (type) {
    case 'extreme-cool':
      params.value = {
        faceSlappingFrequency: 1,
        coolPointDensity: 4,
        powerUpSpeed: 'godlike',
        equipmentDropRate: 'frequent',
        plotTwistFrequency: 20,
        suspenseIntensity: 'weak',
        villainIQ: 'fodder',
        bossInterval: 10,
      };
      break;
    case 'hot-blood':
      params.value = {
        faceSlappingFrequency: 3,
        coolPointDensity: 2,
        powerUpSpeed: 'medium',
        equipmentDropRate: 'normal',
        plotTwistFrequency: 15,
        suspenseIntensity: 'medium',
        villainIQ: 'smart',
        bossInterval: 20,
      };
      break;
    case 'brain-burn':
      params.value = {
        faceSlappingFrequency: 10,
        coolPointDensity: 1,
        powerUpSpeed: 'slow',
        equipmentDropRate: 'rare',
        plotTwistFrequency: 8,
        suspenseIntensity: 'extreme',
        villainIQ: 'genius',
        bossInterval: 30,
      };
      break;
    case 'horror-thriller':
      params.value = {
        faceSlappingFrequency: 15,
        coolPointDensity: 1,
        powerUpSpeed: 'slow',
        equipmentDropRate: 'rare',
        plotTwistFrequency: 10,
        suspenseIntensity: 'extreme',
        villainIQ: 'smart',
        bossInterval: 15,
      };
      break;
    case 'sweet-romance':
      params.value = {
        faceSlappingFrequency: 20,
        coolPointDensity: 1,
        powerUpSpeed: 'slow',
        equipmentDropRate: 'normal',
        plotTwistFrequency: 25,
        suspenseIntensity: 'weak',
        villainIQ: 'normal',
        bossInterval: 40,
      };
      break;
    case 'system-flow':
      params.value = {
        faceSlappingFrequency: 2,
        coolPointDensity: 3,
        powerUpSpeed: 'fast',
        equipmentDropRate: 'frequent',
        plotTwistFrequency: 15,
        suspenseIntensity: 'medium',
        villainIQ: 'normal',
        bossInterval: 15,
      };
      break;
    case 'mind-game':
      params.value = {
        faceSlappingFrequency: 5,
        coolPointDensity: 2,
        powerUpSpeed: 'slow',
        equipmentDropRate: 'rare',
        plotTwistFrequency: 5,
        suspenseIntensity: 'strong',
        villainIQ: 'genius',
        bossInterval: 25,
      };
      break;
    case 'custom':
      // 自定义模式保留当前参数
      break;
  }
}

// 恢复默认
function resetParams() {
  params.value = { ...defaultParams };
  selectedPreset.value = 'hot-blood';
}

// 保存设置
async function handleSave() {
  saving.value = true;
  try {
    // 先更新 store 状态
    rhythmStore.currentPreset = selectedPreset.value as any;
    rhythmStore.params = { ...params.value } as any;

    // 再保存到后端
    const success = await rhythmStore.saveConfig(props.projectId);
    if (success) {
      toast.success('节奏设置已保存');
      emit('close');
    } else {
      toast.error('保存失败');
    }
  } catch (e) {
    toast.error('保存失败: ' + (e as Error).message);
  } finally {
    saving.value = false;
  }
}

// 关闭弹窗
function handleClose() {
  emit('close');
}

// 加载已有配置
watch(() => props.visible, async (visible) => {
  if (visible && props.projectId) {
    try {
      await rhythmStore.fetchConfig(props.projectId);
      if (rhythmStore.currentPreset) {
        selectedPreset.value = rhythmStore.currentPreset;
      }
      if (rhythmStore.params) {
        params.value = { ...rhythmStore.params };
      }
    } catch (e) {
      // 使用默认值
    }
  }
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
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

.modal-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.icon {
  font-size: 20px;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  font-size: 20px;
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
  flex: 1;
  overflow-y: auto;
  padding: var(--space-5);
}

.section {
  margin-bottom: var(--space-6);
}

.section:last-child {
  margin-bottom: 0;
}

.section-header {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: var(--space-3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2);
}

.preset-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
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
}

.preset-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.preset-desc {
  font-size: 10px;
  color: var(--text-tertiary);
  line-height: 1.3;
}

.params-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

.param-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.param-item label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
}

.param-item select {
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: 12px;
  color: var(--text-primary);
  transition: var(--transition-fast);
}

.param-item select:focus {
  outline: none;
  border-color: var(--border-focus);
}

.slider-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.slider-row input[type="range"] {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  background: var(--bg-hover);
  border-radius: 2px;
}

.slider-row input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  background: var(--primary);
  border-radius: 50%;
  cursor: pointer;
  transition: var(--transition-fast);
}

.slider-row input[type="range"]::-webkit-slider-thumb:hover {
  background: var(--primary-hover);
  transform: scale(1.1);
}

.slider-row .value {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
  min-width: 40px;
  text-align: right;
}

.hint {
  font-size: 10px;
  color: var(--text-muted);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--border-default);
}

.btn-primary,
.btn-secondary {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition-fast);
}

.btn-primary {
  background: var(--primary);
  color: var(--text-on-primary);
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--bg-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}

.btn-secondary:hover {
  background: var(--bg-hover);
}

@media (max-width: 700px) {
  .preset-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .params-grid {
    grid-template-columns: 1fr;
  }
}
</style>
