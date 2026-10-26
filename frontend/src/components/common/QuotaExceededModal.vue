<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  visible: boolean;
  type: 'project' | 'episode';
  remainingQuota?: number;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'project',
  remainingQuota: 0,
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'viewDocs'): void;
}>();

const adminWechat = 'agimeme';
const copied = ref(false);

const copyWechat = async () => {
  try {
    // 优先使用 Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(adminWechat);
    } else {
      // 备用方法：使用 textarea 和 execCommand
      const textArea = document.createElement('textarea');
      textArea.value = adminWechat;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (err) {
    console.error('复制失败:', err);
    // 即使失败也尝试备用方法
    try {
      const textArea = document.createElement('textarea');
      textArea.value = adminWechat;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      copied.value = true;
      setTimeout(() => {
        copied.value = false;
      }, 2000);
    } catch {
      alert('复制失败，请手动复制：' + adminWechat);
    }
  }
};

const handleClose = () => {
  emit('close');
};

const handleViewDocs = () => {
  emit('viewDocs');
  emit('close');
};

// 根据类型显示不同的内容
const getContent = () => {
  if (props.type === 'project') {
    return {
      title: '项目配额已用完',
      description: '试用账户仅支持创建 1 个项目。升级后可创建更多项目，享受无限生成服务。',
      icon: '📁',
    };
  } else {
    return {
      title: '生成配额已用完',
      description: '试用账户最多可生成 10 集内容。升级后可解锁无限生成，尽享创作自由。',
      icon: '✨',
    };
  }
};
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="modal-overlay" @click.self="handleClose">
        <div class="modal-container">
          <!-- 头部 -->
          <div class="modal-header">
            <div class="brand">
              <span class="brand-icon">🎬</span>
              <span class="brand-name">剧本生成系统</span>
            </div>
            <button class="close-btn" @click="handleClose" aria-label="关闭">×</button>
          </div>

          <!-- 内容区 -->
          <div class="modal-body">
            <div class="quota-icon">{{ getContent().icon }}</div>
            <h2 class="quota-title">{{ getContent().title }}</h2>
            <p class="quota-desc">{{ getContent().description }}</p>

            <!-- 购买引导 -->
            <div class="upgrade-section">
              <h3>升级专业版</h3>
              <div class="benefits">
                <div class="benefit-item">
                  <span class="check">✓</span>
                  <span>无限项目创建</span>
                </div>
                <div class="benefit-item">
                  <span class="check">✓</span>
                  <span>无限集数生成</span>
                </div>
                <div class="benefit-item">
                  <span class="check">✓</span>
                  <span>优先技术支持</span>
                </div>
                <div class="benefit-item">
                  <span class="check">✓</span>
                  <span>高级功能解锁</span>
                </div>
              </div>
            </div>

            <!-- 联系方式 -->
            <div class="contact-section">
              <p class="contact-label">联系管理员购买配额</p>
              <div class="wechat-box">
                <span class="wechat-icon">💬</span>
                <span class="wechat-label">微信：</span>
                <span class="wechat-id">{{ adminWechat }}</span>
                <button class="copy-btn" @click="copyWechat">
                  {{ copied ? '已复制 ✓' : '复制' }}
                </button>
              </div>
            </div>
          </div>

          <!-- 底部按钮 -->
          <div class="modal-footer">
            <button class="btn-secondary" @click="handleViewDocs">
              查看说明文档
            </button>
            <button class="btn-primary" @click="copyWechat">
              {{ copied ? '微信已复制 ✓' : '复制微信联系' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.modal-container {
  background: linear-gradient(180deg, #1e1e2e 0%, #181825 100%);
  border-radius: 20px;
  width: 90%;
  max-width: 440px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-icon {
  font-size: 20px;
}

.brand-name {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  color: #888;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.modal-body {
  padding: 32px 24px;
  text-align: center;
}

.quota-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.quota-title {
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 12px 0;
}

.quota-desc {
  font-size: 14px;
  color: #a0a0b0;
  line-height: 1.6;
  margin: 0 0 28px 0;
}

.upgrade-section {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
}

.upgrade-section h3 {
  font-size: 14px;
  font-weight: 600;
  color: #a78bfa;
  margin: 0 0 16px 0;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.benefits {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.benefit-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #e0e0e8;
}

.check {
  color: #22c55e;
  font-weight: bold;
}

.contact-section {
  margin-top: 8px;
}

.contact-label {
  font-size: 13px;
  color: #888;
  margin: 0 0 12px 0;
}

.wechat-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.05);
  padding: 14px 20px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.wechat-icon {
  font-size: 18px;
}

.wechat-label {
  color: #888;
  font-size: 14px;
}

.wechat-id {
  color: #fff;
  font-weight: 600;
  font-size: 16px;
}

.copy-btn {
  background: rgba(139, 92, 246, 0.2);
  color: #a78bfa;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.copy-btn:hover {
  background: rgba(139, 92, 246, 0.3);
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.btn-secondary,
.btn-primary {
  flex: 1;
  padding: 14px 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #a0a0b0;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.btn-primary {
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  border: none;
  color: #fff;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px -4px rgba(139, 92, 246, 0.4);
}

/* 动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95) translateY(20px);
  opacity: 0;
}
</style>
