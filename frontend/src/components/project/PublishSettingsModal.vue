<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h3>📤 发布设置</h3>
        <button class="close-btn" @click="$emit('close')" aria-label="关闭">×</button>
      </div>
      
      <div v-if="loading" class="loading">加载中...</div>
      <template v-else>
        <div class="modal-body">
          <div class="status-badge" :class="{ published: config.isPublished }">
            {{ config.isPublished ? '✅ 已上架' : '⏸️ 未上架' }}
          </div>

          <div class="rules-card">
            <div class="rules-header">
              <span class="rules-icon">📋</span>
              <span class="rules-title">平台阅读规则</span>
            </div>
            <div class="rules-list">
              <div class="rule-item rule-free">
                <span class="rule-badge">🎁 免费</span>
                <span class="rule-range">第1-5集</span>
                <span class="rule-desc">平台固定规则</span>
              </div>
              <div class="rule-item rule-points">
                <span class="rule-badge">💰 积分</span>
                <span class="rule-range">第6-20集</span>
                <span class="rule-desc">可设置单集价格</span>
              </div>
              <div class="rule-item rule-script">
                <span class="rule-badge">📜 整本</span>
                <span class="rule-range">第21集+</span>
                <span class="rule-desc">需购买完整剧本</span>
              </div>
            </div>
          </div>

          <div class="section-card">
            <div class="section-header">
              <span class="section-icon">💰</span>
              <span class="section-title">积分购买设置（6-20集）</span>
            </div>
            <div class="form-group">
              <label>每集价格（积分）</label>
              <div class="input-with-unit">
                <input
                  v-model.number="config.pricePerEpisode"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="10"
                />
                <span class="unit">积分/集</span>
              </div>
            </div>
          </div>

          <div class="section-card section-script">
            <div class="section-header">
              <span class="section-icon">📜</span>
              <span class="section-title">整本购买设置（21集+）</span>
            </div>
            <div class="form-group">
              <label>整本价格（积分）</label>
              <div class="input-with-unit">
                <input 
                  v-model.number="config.fullScriptPrice" 
                  type="number" 
                  min="0" 
                  step="100"
                  placeholder="0"
                />
                <span class="unit">积分</span>
              </div>
              <span class="hint">设为 0 表示仅支持洽谈合作，不提供积分购买</span>
            </div>
            <div class="contact-info">
              <span class="contact-label">💬 用户将通过客服微信联系购买：</span>
              <span class="contact-value">Tom_de</span>
            </div>
          </div>
          
          <div class="form-group">
            <label>目标受众</label>
            <div class="audience-selector">
              <label class="radio-item">
                <input type="radio" v-model="config.targetAudience" value="female" />
                <span class="radio-label">👩 女频</span>
              </label>
              <label class="radio-item">
                <input type="radio" v-model="config.targetAudience" value="male" />
                <span class="radio-label">👨 男频</span>
              </label>
            </div>
          </div>
          
          <div class="form-group">
            <label>分类标签 <span class="hint-inline">（可多选）</span></label>
            <div v-if="loadingTags" class="tags-loading">加载标签中...</div>
            <div v-else class="tags-grid">
              <label 
                v-for="tag in availableTags" 
                :key="tag._id" 
                class="tag-item"
                :class="{ selected: config.tags.includes(tag._id) }"
                :style="{ '--tag-color': tag.color }"
              >
                <input 
                  type="checkbox" 
                  :value="tag._id" 
                  v-model="config.tags"
                />
                <span class="tag-label">{{ tag.name }}</span>
              </label>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn-secondary" @click="handleSave" :disabled="saving">
            {{ saving ? '保存中...' : '💾 保存设置' }}
          </button>
          <button 
            v-if="!config.isPublished" 
            class="btn-primary" 
            @click="handlePublish" 
            :disabled="saving"
          >
            🚀 立即上架
          </button>
          <button 
            v-else 
            class="btn-danger" 
            @click="handleUnpublish" 
            :disabled="saving"
          >
            ⏸️ 下架
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { publishApi } from '@/services/api';
import http from '@/services/api';
import { useToast } from '@/composables/useToast';

const props = defineProps<{
  projectId: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'updated'): void;
}>();

const toast = useToast();

const loading = ref(true);
const saving = ref(false);
const loadingTags = ref(false);

interface TagItem {
  _id: string;
  name: string;
  color: string;
  category: string;
}
const availableTags = ref<TagItem[]>([]);

const config = ref({
  isPublished: false,
  pricePerEpisode: 10,
  freeEpisodeCount: 5,
  fullScriptPrice: 0,
  targetAudience: 'female' as 'male' | 'female',
  tags: [] as string[],
});

async function withSaving(fn: () => Promise<void>, errorMsg: string) {
  saving.value = true;
  try {
    await fn();
    emit('updated');
  } catch (err) {
    console.error(errorMsg, err);
    toast.error(errorMsg);
  } finally {
    saving.value = false;
  }
}

onMounted(() => Promise.all([loadConfig(), loadTags()]));

async function loadConfig() {
  try {
    const response = await publishApi.getConfig(props.projectId);
    const data = response.data as any;
    config.value = {
      isPublished: data.isPublished,
      pricePerEpisode: data.pricePerEpisode || 10,
      freeEpisodeCount: data.freeEpisodeCount || 5,
      fullScriptPrice: data.fullScriptPrice || 0,
      targetAudience: data.targetAudience || 'female',
      tags: data.tags || [],
    };
  } catch (err) {
    console.error('Load publish config failed:', err);
    toast.error('加载发布配置失败');
  } finally {
    loading.value = false;
  }
}

async function loadTags() {
  loadingTags.value = true;
  try {
    const res = await http.get('/buyer/tags');
    availableTags.value = (res as any).data.tags ?? [];
  } catch (err) {
    console.error('Load tags failed:', err);
  } finally {
    loadingTags.value = false;
  }
}

function handleSave() {
  return withSaving(async () => {
    const { pricePerEpisode, freeEpisodeCount, fullScriptPrice, targetAudience, tags } = config.value;
    await publishApi.updateConfig(props.projectId, {
      pricePerEpisode, freeEpisodeCount, fullScriptPrice, targetAudience, tags,
    });
    toast.success('设置已保存');
  }, '保存失败');
}

function handlePublish() {
  return withSaving(async () => {
    await publishApi.publish(props.projectId);
    config.value.isPublished = true;
    toast.success('项目已上架！');
  }, '上架失败');
}

function handleUnpublish() {
  return withSaving(async () => {
    await publishApi.unpublish(props.projectId);
    config.value.isPublished = false;
    toast.info('项目已下架');
  }, '下架失败');
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--card-bg, white);
  border-radius: 12px;
  width: 90%;
  max-width: 450px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-default);
}

.modal-header h3 {
  margin: 0;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary);
}

.loading {
  padding: 60px;
  text-align: center;
  color: var(--text-tertiary);
}

.modal-body {
  padding: 24px;
}

.status-badge {
  display: inline-block;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 20px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.status-badge.published {
  background: var(--success-muted);
  color: var(--success);
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-primary);
}

.form-group input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  font-size: 14px;
  background: var(--input-bg, white);
  color: var(--text-primary);
}

.form-group input:focus {
  outline: none;
  border-color: var(--primary);
}

.hint {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--border-default);
}

.btn-secondary,
.btn-primary,
.btn-danger {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.btn-secondary {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary) 0%, var(--purple) 100%);
  color: white;
}

.btn-danger {
  background: var(--error);
  color: white;
}

.btn-secondary:disabled,
.btn-primary:disabled,
.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.audience-selector {
  display: flex;
  gap: 16px;
}

.radio-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: var(--bg-elevated);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.radio-item:has(input:checked) {
  background: var(--primary-muted);
  box-shadow: 0 0 0 2px var(--primary-border);
}

.radio-item input {
  display: none;
}

.radio-label {
  font-weight: 500;
}

.tags-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tags-loading {
  padding: 20px;
  text-align: center;
  color: var(--text-tertiary);
}

.tag-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--bg-elevated);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
}

.tag-item input {
  display: none;
}

.tag-item.selected {
  background: var(--primary);
  color: white;
}

.tag-item:not(.selected):hover {
  background: var(--bg-hover);
}

.hint-inline {
  font-weight: normal;
  color: var(--text-tertiary);
  font-size: 12px;
}

.rules-card {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.05));
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
}

.rules-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.rules-icon {
  font-size: 18px;
}

.rules-title {
  font-weight: 600;
  color: var(--text-primary);
}

.rules-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rule-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--bg-elevated);
  border-radius: 8px;
}

.rule-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
}

.rule-free .rule-badge {
  background: rgba(16, 185, 129, 0.15);
  color: var(--success);
}

.rule-points .rule-badge {
  background: rgba(99, 102, 241, 0.15);
  color: var(--primary);
}

.rule-script .rule-badge {
  background: rgba(245, 158, 11, 0.15);
  color: var(--warning);
}

.rule-range {
  font-weight: 500;
  color: var(--text-primary);
  min-width: 80px;
}

.rule-desc {
  font-size: 12px;
  color: var(--text-tertiary);
}

.section-card {
  background: var(--bg-elevated);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.section-card.section-script {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(217, 119, 6, 0.03));
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.section-icon {
  font-size: 18px;
}

.section-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary);
}

.input-with-unit {
  display: flex;
  align-items: center;
  gap: 8px;
}

.input-with-unit input {
  flex: 1;
}

.input-with-unit .unit {
  font-size: 13px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.contact-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--bg-elevated);
  border-radius: 8px;
  margin-top: 12px;
}

.contact-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.contact-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--primary);
}
</style>
