<template>
  <div class="join-page">
    <!-- Hero 区域 -->
    <div class="join-hero">
      <div class="brand-badge">锦墨工作室</div>
      <h1 class="hero-title">成为签约作者</h1>
      <p class="hero-subtitle">一群热爱创作的人，只打磨值得讲的故事</p>
      
      <!-- 统计数据 -->
      <div class="stats-row">
        <div class="stat-item">
          <span class="stat-number">100+</span>
          <span class="stat-label">签约作者</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-number">专注</span>
          <span class="stat-label">短剧精品</span>
        </div>
      </div>
    </div>

    <!-- 我们的价值观 -->
    <div class="values-section">
      <h2 class="section-title">我们的价值观</h2>
      <div class="values-grid">
        <div class="value-card">
          <div class="value-icon">💎</div>
          <h3 class="value-title">精品至上</h3>
          <p class="value-desc">拒绝滥竽充数，每一个剧本都经过精心打磨</p>
        </div>
        <div class="value-card">
          <div class="value-icon">❤️</div>
          <h3 class="value-title">热爱创作</h3>
          <p class="value-desc">因为热爱，所以专注；因为专注，所以专业</p>
        </div>
        <div class="value-card">
          <div class="value-icon">🎯</div>
          <h3 class="value-title">行业标杆</h3>
          <p class="value-desc">立志成为短剧剧本领域的品质标杆</p>
        </div>
      </div>
    </div>

    <!-- 加入权益 -->
    <div class="benefits-section">
      <h2 class="section-title">签约权益</h2>
      <div class="join-content">
        <div class="benefit-card">
          <div class="benefit-icon">📝</div>
          <h3 class="benefit-title">版权交易</h3>
          <p class="benefit-desc">将你的剧本上架到平台，与行业客户达成版权合作</p>
        </div>

        <div class="benefit-card">
          <div class="benefit-icon">✏️</div>
          <h3 class="benefit-title">改写服务</h3>
          <p class="benefit-desc">提供专业的剧本改写服务，按需定制获得额外收益</p>
        </div>

        <div class="benefit-card">
          <div class="benefit-icon">🌟</div>
          <h3 class="benefit-title">专业平台</h3>
          <p class="benefit-desc">专注剧本，让你的作品被更多行业客户发现</p>
        </div>
      </div>
    </div>

    <!-- 联系我们 -->
    <div class="contact-section">
      <h2 class="contact-title">加入我们</h2>
      <p class="contact-desc">如果你热爱创作，追求品质，欢迎联系我们</p>
      
      <div class="contact-methods">
        <div class="contact-item">
          <span class="contact-icon">💬</span>
          <div class="contact-info">
            <span class="contact-label">微信客服</span>
            <span class="contact-value">Tom_de</span>
          </div>
        </div>
      </div>
    </div>

    <div class="join-footer">
      <p class="footer-text">期待与志同道合的你一起创造精彩 ✨</p>
    </div>
  </div>
</template>

<script setup lang="ts">
// 静态页面，无需逻辑
</script>

<style scoped>
.join-page {
  min-height: 100vh;
  padding: var(--space-4);
  padding-bottom: calc(var(--bottom-nav-height) + var(--safe-area-bottom) + var(--space-8));
}

.join-hero {
  text-align: center;
  padding: var(--space-12) var(--space-4);
  margin-bottom: var(--space-8);
  background: linear-gradient(180deg, rgba(99, 102, 241, 0.1) 0%, transparent 100%);
  border-radius: var(--radius-xl);
}

.brand-badge {
  display: inline-block;
  padding: var(--space-2) var(--space-4);
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--primary);
  letter-spacing: 0.1em;
  margin-bottom: var(--space-4);
}

.hero-title {
  font-size: var(--text-3xl);
  font-weight: 700;
  background: linear-gradient(135deg, var(--primary), #ec4899);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: var(--space-3);
}

.hero-subtitle {
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin-bottom: var(--space-6);
}

.stats-row {
  display: inline-flex;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-4) var(--space-8);
  background: var(--glass);
  backdrop-filter: blur(10px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
}

.stat-item {
  text-align: center;
}

.stat-number {
  display: block;
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--primary);
}

.stat-label {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.stat-divider {
  width: 1px;
  height: 40px;
  background: var(--border-color);
}

/* 价值观区域 */
.values-section {
  margin-bottom: var(--space-8);
}

.section-title {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  margin-bottom: var(--space-5);
}

.values-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
}

@media (min-width: 768px) {
  .values-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.value-card {
  padding: var(--space-5);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(236, 72, 153, 0.08) 100%);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: var(--radius-lg);
  text-align: center;
}

.value-icon {
  font-size: 36px;
  margin-bottom: var(--space-3);
}

.value-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.value-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.6;
}

/* 权益区域 */
.benefits-section {
  margin-bottom: var(--space-8);
}

.join-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.benefit-card {
  padding: var(--space-5);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  text-align: center;
}

.benefit-icon {
  font-size: 40px;
  margin-bottom: var(--space-3);
}

.benefit-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.benefit-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.6;
}

.contact-section {
  padding: var(--space-6);
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: var(--radius-xl);
  margin-bottom: var(--space-6);
}

.contact-title {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  margin-bottom: var(--space-2);
}

.contact-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: var(--space-5);
}

.contact-methods {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.contact-item {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
}

.contact-icon {
  font-size: 28px;
}

.contact-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.contact-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.contact-value {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--primary);
}

.join-footer {
  text-align: center;
  padding: var(--space-4);
}

.footer-text {
  font-size: var(--text-sm);
  color: var(--text-muted);
}
</style>
