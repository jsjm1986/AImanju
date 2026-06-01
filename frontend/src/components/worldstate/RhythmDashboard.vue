<template>
  <div class="rhythm-dashboard-premium">
    <!-- Header -->
    <div class="dashboard-header">
      <div class="header-title-group">
        <div class="header-icon-box">
          <span class="icon">🎵</span>
        </div>
        <h3 class="header-title">节奏仪表盘</h3>
      </div>
      <button class="btn-settings-icon" @click="$emit('open-settings')" title="配置参数">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" class="settings-svg">
          <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" fill="currentColor" opacity="0.5"/>
          <path fill-rule="evenodd" clip-rule="evenodd" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.18a1.65 1.65 0 00-1.51-1 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H2a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.9 9.4a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" fill="currentColor"/>
        </svg>
      </button>
    </div>

    <!-- Hero Preset Card -->
    <div class="preset-hero-card">
      <div class="preset-hero-content">
        <span class="preset-hero-icon">{{ currentPresetInfo?.icon || '🎯' }}</span>
        <div class="preset-hero-text">
          <span class="preset-label">当前模式</span>
          <span class="preset-name">{{ currentPresetInfo?.name || '自定义配置' }}</span>
        </div>
      </div>
      <div class="preset-badge" v-if="currentPresetInfo?.description">
        {{ currentPresetInfo.description }}
      </div>
    </div>

    <!-- Tracking Section (Status Cards) -->
    <div class="tracking-grid-v2">
      <!-- Face Slap -->
      <div class="status-card" :class="{ 'status-urgent': shouldFaceSlap }">
        <div class="status-header">
          <span class="status-title">打脸节奏</span>
          <span class="status-value">{{ faceSlappingGap }}/{{ params.faceSlappingFrequency }}集</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: `${faceSlappingProgress}%` }" :class="getFaceSlappingClass"></div>
        </div>
        <div class="status-footer">
          <span class="status-state" v-if="shouldFaceSlap">建议打脸</span>
          <span class="status-state normal" v-else>积蓄中...</span>
        </div>
      </div>

      <!-- Plot Twist -->
      <div class="status-card" :class="{ 'status-urgent': shouldPlotTwist }">
        <div class="status-header">
          <span class="status-title">剧情反转</span>
          <span class="status-value">{{ plotTwistGap }}/{{ params.plotTwistFrequency }}集</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: `${plotTwistProgress}%` }" :class="getPlotTwistClass"></div>
        </div>
        <div class="status-footer">
          <span class="status-state" v-if="shouldPlotTwist">可以反转</span>
          <span class="status-state normal" v-else>铺垫中...</span>
        </div>
      </div>

      <!-- Boss -->
      <div class="status-card" :class="{ 'status-urgent': shouldBossAppear }">
        <div class="status-header">
          <span class="status-title">BOSS战</span>
          <span class="status-value">{{ bossGap }}/{{ params.bossInterval }}集</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: `${bossProgress}%` }" :class="getBossClass"></div>
        </div>
        <div class="status-footer">
          <span class="status-state" v-if="shouldBossAppear">BOSS登场</span>
          <span class="status-state normal" v-else>发育中...</span>
        </div>
      </div>
      
      <!-- Cool Points -->
      <div class="status-card highlight">
        <div class="status-header">
          <span class="status-title">本集爽点</span>
          <span class="status-value">{{ tracking.coolPointsThisEpisode }}/3</span>
        </div>
         <div class="progress-track">
          <div class="progress-fill cool-fill" :style="{ width: `${coolPointsProgress}%` }"></div>
        </div>
        <div class="status-footer">
           <span class="status-state normal">实时统计</span>
        </div>
      </div>
    </div>

    <!-- Read-Only Settings -->
    <div class="params-readout-section">
      <div class="section-label">
         <span>配置详情</span>
         <div class="line"></div>
      </div>
      <div class="params-grid-v2">
        <div class="param-cell">
           <span class="p-label">打脸频率</span>
           <span class="p-val">{{ params.faceSlappingFrequency }}集/次</span>
        </div>
        <div class="param-cell">
           <span class="p-label">爽点密度</span>
           <span class="p-val">{{ params.coolPointDensity }}个/集</span>
        </div>
        <div class="param-cell">
           <span class="p-label">升级速度</span>
           <span class="p-val">{{ getSpeedLabel(params.powerUpSpeed) }}</span>
        </div>
        <div class="param-cell">
           <span class="p-label">反派智商</span>
           <span class="p-val">{{ getIQLabel(params.villainIQ) }}</span>
        </div>
        <div class="param-cell">
           <span class="p-label">Boss间隔</span>
           <span class="p-val">{{ params.bossInterval }}集/次</span>
        </div>
        <div class="param-cell">
           <span class="p-label">悬念强度</span>
           <span class="p-val">{{ getSuspenseLabel(params.suspenseIntensity) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRhythmStore } from '@/stores/rhythmStore';
import { storeToRefs } from 'pinia';

const props = defineProps<{
  projectId: string;
  currentEpisode: number;
}>();

const emit = defineEmits<{
  (e: 'open-settings'): void;
}>();

const rhythmStore = useRhythmStore();
const {
  presets,
  currentPreset,
  params,
  tracking,
  shouldFaceSlap,
  shouldPlotTwist,
  shouldBossAppear,
} = storeToRefs(rhythmStore);

const { fetchPresets, fetchConfig, setCurrentEpisode } = rhythmStore;

onMounted(async () => {
  await fetchPresets();
  if (props.projectId) {
    await fetchConfig(props.projectId);
  }
  setCurrentEpisode(props.currentEpisode);
});

watch(() => props.projectId, async (newId) => {
  if (newId) {
    await fetchConfig(newId);
  }
});

// label helpers
const getSpeedLabel = (val: string) => ({ slow:'缓慢', medium:'适中', fast:'快速', godlike:'逆天' }[val] || val);
const getIQLabel = (val: string) => ({ fodder:'送人头', normal:'普通', smart:'聪明', genius:'天才' }[val] || val);
const getSuspenseLabel = (val: string) => ({ weak:'弱', medium:'中', strong:'强', extreme:'极强' }[val] || val);

// 当前预设信息
const currentPresetInfo = computed(() => {
  return presets.value.find(p => p.type === currentPreset.value);
});

// 计算间隔 - 使用 store 的 currentEpisode（已同步）
const faceSlappingGap = computed(() => {
  return rhythmStore.currentEpisode - tracking.value.lastFaceSlap;
});

const plotTwistGap = computed(() => {
  return rhythmStore.currentEpisode - tracking.value.lastPlotTwist;
});

const bossGap = computed(() => {
  return rhythmStore.currentEpisode - tracking.value.lastBoss;
});

// 进度计算
const faceSlappingProgress = computed(() => {
  const max = params.value.faceSlappingFrequency;
  return Math.min((faceSlappingGap.value / max) * 100, 100);
});

const plotTwistProgress = computed(() => {
  const max = params.value.plotTwistFrequency;
  return Math.min((plotTwistGap.value / max) * 100, 100);
});

const bossProgress = computed(() => {
  const max = params.value.bossInterval;
  return Math.min((bossGap.value / max) * 100, 100);
});

const coolPointsProgress = computed(() => {
  return ((tracking.value.coolPointsThisEpisode ?? 0) / 3) * 100;
});

// 进度条颜色类
const getFaceSlappingClass = computed(() => {
  if (faceSlappingProgress.value >= 100) return 'urgent';
  if (faceSlappingProgress.value >= 75) return 'warning';
  return 'normal';
});

const getPlotTwistClass = computed(() => {
  if (plotTwistProgress.value >= 100) return 'urgent';
  if (plotTwistProgress.value >= 75) return 'warning';
  return 'normal';
});

const getBossClass = computed(() => {
  if (bossProgress.value >= 100) return 'urgent';
  if (bossProgress.value >= 75) return 'warning';
  return 'normal';
});

// 监听集数变化，同步到 store
watch(() => props.currentEpisode, (newEpisode) => {
  setCurrentEpisode(newEpisode);
});
</script>

<style scoped>
.rhythm-dashboard-premium {
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition-normal);
}

.rhythm-dashboard-premium:hover {
  box-shadow: var(--shadow-md);
}

/* Header */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4);
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-subtle);
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.header-icon-box {
  width: 32px;
  height: 32px;
  background: var(--primary-muted);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
  font-size: 16px;
}

.header-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.01em;
}

.btn-settings-icon {
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: var(--radius-full);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.btn-settings-icon:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  transform: rotate(30deg);
}

/* Hero Preset Card */
.preset-hero-card {
  margin: var(--space-4);
  padding: var(--space-4);
  background: linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-surface) 100%);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  position: relative;
  overflow: hidden;
}

.preset-hero-card::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 100px;
  height: 100%;
  background: linear-gradient(90deg, transparent, var(--bg-hover));
  opacity: 0.1;
  transform: skewX(-20deg) translateX(50px);
}

.preset-hero-content {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  position: relative;
  z-index: 1;
}

.preset-hero-icon {
  font-size: 28px;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
}

.preset-hero-text {
  display: flex;
  flex-direction: column;
}

.preset-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
  font-weight: 600;
}

.preset-name {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.2;
}

.preset-badge {
  margin-top: var(--space-2);
  display: inline-block;
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-surface);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  position: relative;
  z-index: 1;
}

/* Tracking Grid V2 */
.tracking-grid-v2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
  padding: 0 var(--space-4) var(--space-4);
}

.status-card {
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  border: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  transition: all var(--transition-fast);
}

.status-card.highlight {
  grid-column: span 2; /* Cool points highlight crosses full width if odd number */
  background: linear-gradient(to right, var(--bg-elevated), var(--bg-surface));
}

.status-card:hover {
  border-color: var(--border-hover);
  transform: translateY(-1px);
}

.status-card.status-urgent {
  border-color: var(--warning);
  background: var(--warning-muted);
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
}

.status-title {
  color: var(--text-secondary);
  font-weight: 600;
}

.status-value {
  color: var(--text-primary);
  font-weight: 700;
  font-family: var(--font-mono);
}

.progress-track {
  height: 4px;
  background: var(--bg-surface);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width var(--transition-normal) ease-out;
  background: var(--success);
}

.progress-fill.normal { background: var(--success); }
.progress-fill.warning { background: var(--warning); }
.progress-fill.urgent { background: var(--error); }
.progress-fill.cool-fill { background: var(--primary); }

.status-footer {
  display: flex;
  justify-content: flex-end;
}

.status-state {
  font-size: 10px;
  font-weight: 700;
  color: var(--warning);
}

.status-state.normal {
  color: var(--text-tertiary);
  font-weight: 500;
}

/* Params Readout */
.params-readout-section {
  padding: 0 var(--space-4) var(--space-4);
}

.section-label {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
  font-size: 11px;
  color: var(--text-tertiary);
  font-weight: 600;
  text-transform: uppercase;
}

.section-label .line {
  flex: 1;
  height: 1px;
  background: var(--border-subtle);
}

.params-grid-v2 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: var(--border-subtle); /* border grid effect */
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.param-cell {
  background: var(--bg-surface);
  padding: var(--space-2) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: center;
}

.param-cell .p-label {
  font-size: 10px;
  color: var(--text-tertiary);
}

.param-cell .p-val {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

@media (max-width: 1400px) {
  .tracking-grid-v2 {
    grid-template-columns: 1fr;
  }
  .status-card.highlight {
    grid-column: span 1;
  }
  .params-grid-v2 {
      grid-template-columns: repeat(2, 1fr);
  }
}
</style>
