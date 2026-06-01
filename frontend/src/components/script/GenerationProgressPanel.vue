<template>
  <div class="generation-progress-panel" :class="{ generating: isGenerating, collapsed: isCollapsed, completed: isCompleted }">
    <div class="panel-header" @click="toggleCollapse">
      <div class="panel-title">
        <span class="collapse-icon">{{ isCollapsed ? '▶' : '▼' }}</span>
        <span class="status-icon">{{ isCompleted ? '✅' : '⚙️' }}</span>
        <span class="title-text">{{ isCompleted ? '生成完成' : '生成进度' }}</span>
        <span v-if="isBatchMode && batchStore.currentTask?.currentEpisode" class="episode-badge">
          第{{ batchStore.currentTask.currentEpisode }}集
        </span>
        <span v-else-if="episodeNumber" class="episode-badge">第{{ episodeNumber }}集</span>
      </div>
      <div class="panel-stats">
        <span v-if="wordCount > 0" class="stat-item"><span class="stat-value">{{ wordCount }}</span> 字</span>
        <span class="stat-item"><span class="stat-value">{{ logs.length }}</span> 条日志</span>
        <span v-if="!isCollapsed" class="stat-item"><span class="stat-value">{{ progressPercent }}%</span></span>
      </div>
      <div class="header-actions" @click.stop>
        <button v-if="isGenerating" class="btn-stop" @click="handleStop">停止</button>
        <button v-if="!isGenerating && hasData" class="btn-clear" @click="handleClear" title="清除记录">🗑️</button>
      </div>
    </div>

    <div v-show="!isCollapsed" class="panel-content">
      <div class="progress-bar-section">
        <div class="progress-bar-container">
          <div class="progress-bar" :class="{ complete: progressPercent >= 100 }" :style="{ width: `${progressPercent}%` }"></div>
        </div>
      </div>

      <div v-if="isBatchMode" class="batch-overview">
        <div class="batch-stats">
          <div class="stat-card">
            <span class="stat-label">总计</span>
            <span class="stat-value">{{ batchStore.progress.total }}</span>
          </div>
          <div class="stat-card success">
            <span class="stat-label">完成</span>
            <span class="stat-value">{{ batchStore.completedCount }}</span>
          </div>
          <div class="stat-card error" v-if="batchStore.failedCount > 0">
            <span class="stat-label">失败</span>
            <span class="stat-value">{{ batchStore.failedCount }}</span>
          </div>
          <div class="stat-card warning" v-if="batchStore.skippedCount > 0">
            <span class="stat-label">超时</span>
            <span class="stat-value">{{ batchStore.skippedCount }}</span>
          </div>
        </div>

        <div class="episode-progress">
          <div
            v-for="ep in batchStore.currentTask?.episodes"
            :key="ep"
            class="ep-dot"
            :class="getEpisodeStatus(ep)"
            :title="getEpisodeTooltipFull(ep)"
          >
            {{ ep }}
          </div>
        </div>

        <div class="current-episode-info" v-if="batchStore.progress.currentEpisode">
          正在生成第 {{ batchStore.progress.currentEpisode }} 集
        </div>
      </div>

      <div class="main-content">
        <div class="log-section-top">
          <div class="log-header">
            <span class="icon">📋</span>
            <span class="log-title">执行日志</span>
            <span class="log-count">({{ logs.length }})</span>
          </div>
          <div class="log-container" ref="logContainer">
            <div v-for="(log, index) in logs" :key="index" class="log-item" :class="log.level">
              <span class="log-time">[{{ log.time }}]</span>
              <span class="log-message">{{ log.message }}</span>
            </div>
            <div v-if="logs.length === 0" class="log-empty">等待生成开始...</div>
          </div>
        </div>

        <div class="tab-area">
          <div class="tab-navigation">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              class="tab-item"
              :class="{ active: activeTab === tab.key, disabled: !tab.hasData() }"
              :disabled="!tab.hasData()"
              @click="activeTab = tab.key"
            >
              <span class="tab-icon">{{ tab.icon }}</span>
              <span class="tab-label">{{ tab.label }}</span>
            </button>
          </div>

          <div class="tab-content">
            <div v-if="activeTab === 'context'" class="tab-pane">
              <template v-if="context">
                <div class="context-stats">
                  <div class="stat-card"><span class="stat-label">相关角色</span><span class="stat-value">{{ context.relevantCharacters?.length || 0 }}</span></div>
                  <div class="stat-card"><span class="stat-label">相关伏笔</span><span class="stat-value">{{ context.relevantForeshadowings?.length || 0 }}</span></div>
                  <div class="stat-card"><span class="stat-label">约束条数</span><span class="stat-value">{{ context.constraints?.length || 0 }}</span></div>
                  <div class="stat-card"><span class="stat-label">建议条数</span><span class="stat-value">{{ context.suggestions?.length || 0 }}</span></div>
                </div>

                <div v-if="context.episodePlan" class="episode-plan">
                  <div class="subsection-header">📝 本集梗概<span v-if="context.episodePlanEnhanced" class="enhanced-badge">已优化</span></div>
                  <div class="episode-plan-content">{{ context.episodePlan }}</div>
                  <div v-if="context.episodePlanEnhanced && context.originalEpisodePlan" class="original-plan">
                    <div class="original-plan-header">📋 原始梗概</div>
                    <div class="original-plan-content">{{ context.originalEpisodePlan }}</div>
                  </div>
                </div>

                <div v-if="context.plotState" class="plot-state">
                  <div class="subsection-header">📖 剧情状态</div>
                  <div class="plot-state-content">
                    <div class="arc-info">
                      <span class="arc-name">{{ context.plotState.currentArc }}</span>
                      <span class="arc-progress">进度 {{ context.plotState.arcProgress }}%</span>
                    </div>
                    <div v-if="context.plotState.mainPlotProgress" class="main-progress">主线: {{ context.plotState.mainPlotProgress }}</div>
                    <div v-if="context.plotState.pendingConflicts?.length > 0" class="pending-conflicts">
                      <div class="mini-header">⚔️ 待解决冲突</div>
                      <ul class="conflict-list"><li v-for="(c, i) in context.plotState.pendingConflicts" :key="i">{{ c }}</li></ul>
                    </div>
                    <div v-if="context.plotState.recentEvents?.length > 0" class="recent-events">
                      <div class="mini-header">📅 近期事件</div>
                      <ul class="event-list"><li v-for="(e, i) in context.plotState.recentEvents.slice(-3)" :key="i">第{{ e.episode }}集: {{ e.event }}</li></ul>
                    </div>
                  </div>
                </div>

                <div v-if="context.worldSettings && hasWorldSettings" class="world-settings">
                  <div class="subsection-header">🌏 世界设定</div>
                  <div class="world-settings-content">
                    <div v-if="context.worldSettings.revealedSecrets?.length > 0" class="secrets">
                      <div class="mini-header">🔮 已揭示秘密</div>
                      <ul class="secret-list"><li v-for="(s, i) in context.worldSettings.revealedSecrets.slice(0, 3)" :key="i">{{ s }}</li></ul>
                    </div>
                    <div v-if="context.worldSettings.factions?.length > 0" class="factions">
                      <div class="mini-header">⚔️ 势力</div>
                      <div class="faction-list"><span v-for="f in context.worldSettings.factions" :key="f.name" class="faction-tag">{{ f.name }} ({{ f.attitude }})</span></div>
                    </div>
                    <div v-if="context.worldSettings.items?.length > 0" class="items">
                      <div class="mini-header">🎁 重要道具</div>
                      <div class="item-list"><span v-for="item in context.worldSettings.items" :key="item.name" class="item-tag">{{ item.name }}: {{ item.owner }}</span></div>
                    </div>
                  </div>
                </div>

                <div v-if="context.rhythmSettings" class="rhythm-settings">
                  <div class="subsection-header">🎵 节奏设置</div>
                  <div class="rhythm-grid">
                    <div class="rhythm-item"><span class="rhythm-label">预设</span><span class="rhythm-value">{{ presetLabel(context.rhythmSettings.preset) }}</span></div>
                    <div class="rhythm-item"><span class="rhythm-label">爽点密度</span><span class="rhythm-value">{{ context.rhythmSettings.coolPointDensity }}个/集</span></div>
                    <div class="rhythm-item"><span class="rhythm-label">打脸频率</span><span class="rhythm-value">每{{ context.rhythmSettings.faceSlapInterval }}集</span></div>
                    <div class="rhythm-item"><span class="rhythm-label">反转频率</span><span class="rhythm-value">每{{ context.rhythmSettings.plotTwistInterval }}集</span></div>
                  </div>
                </div>

                <div v-if="context.writingStyle" class="writing-style">
                  <div class="subsection-header">✍️ 写作风格</div>
                  <div class="writing-style-content">
                    <span class="style-preset">{{ context.writingStyle.presetName }}</span>
                    <span v-if="context.writingStyle.customDescription" class="style-custom">{{ context.writingStyle.customDescription }}</span>
                  </div>
                </div>

                <div v-if="context.previousCliffhanger" class="cliffhanger">
                  <div class="subsection-header">⚡ 上集悬念</div>
                  <div class="cliffhanger-content">{{ context.previousCliffhanger }}</div>
                </div>

                <div v-if="context.relevantCharacters?.length > 0" class="characters-detail">
            <div class="subsection-header">👥 相关角色权重</div>
            <div class="character-weight-list">
              <div
                v-for="char in context.relevantCharacters.slice(0, 6)"
                :key="char.name"
                class="character-weight-item"
                :class="char.tier"
              >
                <div class="char-main">
                  <span class="char-name">{{ char.name }}</span>
                  <span class="char-role">({{ char.role }})</span>
                  <span class="char-tier">[{{ tierLabel(char.tier) }}]</span>
                </div>
                <div class="char-weight">
                  <div class="weight-bar" :style="{ width: `${char.weight * 100}%` }"></div>
                  <span class="weight-value">{{ (char.weight * 100).toFixed(0) }}%</span>
                </div>
                <div v-if="char.equipment && char.equipment.length > 0" class="char-detail">
                  装备: {{ char.equipment.join(', ') }}
                </div>
                <div v-if="char.physicalCondition && char.physicalCondition !== '正常'" class="char-status warn">
                  状态: {{ char.physicalCondition }}
                </div>
              </div>
              <div v-if="context.relevantCharacters.length > 6" class="more-items">
                ...及其他 {{ context.relevantCharacters.length - 6 }} 个角色
              </div>
            </div>
          </div>

          <div v-if="context.relevantForeshadowings?.length > 0" class="foreshadowings-detail">
            <div class="subsection-header">🎭 相关伏笔权重</div>
            <div class="foreshadowing-weight-list">
              <div
                v-for="(f, i) in context.relevantForeshadowings.slice(0, 5)"
                :key="i"
                class="foreshadowing-weight-item"
              >
                <div class="fore-main">
                  <span class="fore-content">{{ f.content }}</span>
                </div>
                <div class="fore-weight">
                  <div class="weight-bar" :style="{ width: `${f.weight * 100}%` }"></div>
                  <span class="weight-value">{{ (f.weight * 100).toFixed(0) }}%</span>
                </div>
                <div class="fore-reason">{{ f.reason }}</div>
              </div>
              <div v-if="context.relevantForeshadowings.length > 5" class="more-items">
                ...及其他 {{ context.relevantForeshadowings.length - 5 }} 个伏笔
              </div>
            </div>
          </div>

          <div v-if="context.hiddenConnections?.length > 0" class="hidden-connections">
            <div class="subsection-header">🔗 隐藏关联</div>
            <ul class="connection-list">
              <li v-for="(conn, i) in context.hiddenConnections" :key="i">
                {{ conn }}
              </li>
            </ul>
          </div>

          <div v-if="context.formattedContext" class="formatted-context">
            <div class="subsection-header" @click="toggleWorldInfo">
              🌍 世界信息
              <span class="section-toggle">{{ isWorldInfoExpanded ? '收起' : '展开' }}</span>
            </div>
            <div v-show="isWorldInfoExpanded" class="world-info-content">
              <pre class="world-info-text">{{ context.formattedContext }}</pre>
            </div>
          </div>
              </template>
              <div v-else class="empty-tab">暂无上下文数据</div>
            </div>

            <div v-if="activeTab === 'attention'" class="tab-pane">
              <template v-if="multiHeadAnalysis">
                <div class="enabled-heads-grouped">
                  <div v-for="group in groupedHeads" :key="group.category" class="head-group">
                    <div class="head-group-label">{{ group.label }}</div>
                    <div class="head-group-tags">
                      <span v-for="head in group.heads" :key="head" class="head-tag" :class="group.category">{{ headLabel(head) }}</span>
                    </div>
                  </div>
                </div>
                <div v-if="multiHeadAnalysis.crossDimensionInsights?.length > 0" class="cross-dimension">
                  <div class="subsection-header">💡 跨维度洞察</div>
                  <ul class="insight-list">
                    <li v-for="(insight, i) in multiHeadAnalysis.crossDimensionInsights.slice(0, 3)" :key="i">{{ insight }}</li>
                  </ul>
                  <div v-if="multiHeadAnalysis.crossDimensionInsights.length > 3" class="more-items">...及其他 {{ multiHeadAnalysis.crossDimensionInsights.length - 3 }} 条洞察</div>
                </div>
                <div v-if="hasWarnings" class="head-warnings">
                  <div class="subsection-header">⚠️ 注意事项</div>
                  <div v-for="headResult in multiHeadAnalysis.headResults.filter(r => r.warnings.length > 0)" :key="headResult.headType" class="warning-item">
                    <span class="warning-head">[{{ headLabel(headResult.headType) }}]</span>
                    <span class="warning-text">{{ headResult.warnings[0] }}</span>
                  </div>
                </div>
                <div class="aggregated-stats">
                  <div class="stat-mini"><span class="stat-label">新增约束</span><span class="stat-value">{{ multiHeadAnalysis.aggregatedConstraints?.length || 0 }}</span></div>
                  <div class="stat-mini"><span class="stat-label">新增建议</span><span class="stat-value">{{ multiHeadAnalysis.aggregatedSuggestions?.length || 0 }}</span></div>
                </div>
                <div v-if="characterLifecycle && hasLifecycleChanges" class="lifecycle-section-inline">
                  <div class="subsection-header">👥 角色生命周期变化</div>
                  <div v-if="characterLifecycle.tierChanges?.length > 0" class="tier-changes">
                    <div v-for="change in characterLifecycle.tierChanges" :key="change.name" class="tier-change-item" :class="getTierChangeClass(change.from, change.to)">
                      <span class="change-name">{{ change.name }}</span>
                      <span class="change-arrow"><span class="tier-from">{{ tierLabel(change.from) }}</span> → <span class="tier-to">{{ tierLabel(change.to) }}</span></span>
                      <span class="change-reason">{{ change.reason }}</span>
                    </div>
                  </div>
                  <div v-if="characterLifecycle.newCharactersToTrack?.length > 0" class="new-tracked">
                    <div class="mini-header">➕ 新追踪角色</div>
                    <div class="tracked-list"><span v-for="char in characterLifecycle.newCharactersToTrack" :key="char.name" class="tracked-tag" :class="char.tier">{{ char.name }} ({{ tierLabel(char.tier) }})</span></div>
                  </div>
                  <div v-if="characterLifecycle.archivedCharacters?.length > 0" class="archived">
                    <div class="mini-header">📦 归档角色</div>
                    <div class="archived-list"><span v-for="name in characterLifecycle.archivedCharacters" :key="name" class="archived-tag">{{ name }}</span></div>
                  </div>
                </div>
              </template>
              <div v-else class="empty-tab">暂无注意力分析数据</div>
            </div>

            <div v-if="activeTab === 'decision'" class="tab-pane">
              <template v-if="aiConstraintDecision">
                <div class="decision-summary">{{ aiConstraintDecision.summary }}</div>
                <div class="decision-stats-grid">
                  <div class="stat-card"><span class="stat-label">可验证</span><span class="stat-value">{{ aiConstraintDecision.stats.verifiableCount }}</span></div>
                  <div class="stat-card"><span class="stat-label">指导性</span><span class="stat-value">{{ aiConstraintDecision.stats.guidanceCount }}</span></div>
                  <div class="stat-card" :class="{ critical: aiConstraintDecision.stats.criticalCount > 0 }"><span class="stat-label">关键 (Critical)</span><span class="stat-value">{{ aiConstraintDecision.stats.criticalCount }}</span></div>
                  <div class="stat-card" :class="{ warning: aiConstraintDecision.stats.importantCount > 0 }"><span class="stat-label">重要 (Important)</span><span class="stat-value">{{ aiConstraintDecision.stats.importantCount }}</span></div>
                </div>
                <div class="rhythm-decisions">
                  <div class="subsection-header">🎵 节奏决策</div>
                  <div class="rhythm-decision-list">
                    <div v-if="aiConstraintDecision.rhythm.faceSlap.needed" class="rhythm-decision-item needed">
                      <div class="decision-header">
                        <span class="decision-type">👊 打脸</span>
                        <span class="decision-urgency" :class="aiConstraintDecision.rhythm.faceSlap.urgency">{{ urgencyLabel(aiConstraintDecision.rhythm.faceSlap.urgency) }}</span>
                      </div>
                      <div class="decision-reason">{{ aiConstraintDecision.rhythm.faceSlap.reason }}</div>
                      <div v-if="aiConstraintDecision.rhythm.faceSlap.subject" class="decision-actors">
                        <span class="actor-subject">{{ aiConstraintDecision.rhythm.faceSlap.subject }}</span>
                        <span class="actor-arrow">→</span>
                        <span class="actor-object">{{ aiConstraintDecision.rhythm.faceSlap.object }}</span>
                      </div>
                      <div v-if="aiConstraintDecision.rhythm.faceSlap.methodology?.length" class="methodology-list">
                        <div class="mini-header">💡 实现方法</div>
                        <ul><li v-for="(m, i) in aiConstraintDecision.rhythm.faceSlap.methodology" :key="i">{{ m }}</li></ul>
                      </div>
                      <div v-if="aiConstraintDecision.rhythm.faceSlap.validationCriteria?.length" class="validation-list">
                        <div class="mini-header">✅ 验证标准</div>
                        <ul><li v-for="(v, i) in aiConstraintDecision.rhythm.faceSlap.validationCriteria" :key="i">{{ v }}</li></ul>
                      </div>
                    </div>
                    <div v-else class="rhythm-decision-item not-needed"><span class="decision-type">👊 打脸</span><span class="decision-status">本集不需要</span></div>
                    
                    <div v-if="aiConstraintDecision.rhythm.plotTwist.needed" class="rhythm-decision-item needed">
                      <div class="decision-header">
                        <span class="decision-type">🔄 反转</span>
                        <span class="decision-urgency" :class="aiConstraintDecision.rhythm.plotTwist.urgency">{{ urgencyLabel(aiConstraintDecision.rhythm.plotTwist.urgency) }}</span>
                      </div>
                      <div class="decision-reason">{{ aiConstraintDecision.rhythm.plotTwist.reason }}</div>
                      <div v-if="aiConstraintDecision.rhythm.plotTwist.subject" class="decision-actors">
                        <span class="actor-subject">{{ aiConstraintDecision.rhythm.plotTwist.subject }}</span>
                        <span v-if="aiConstraintDecision.rhythm.plotTwist.object" class="actor-arrow">→</span>
                        <span v-if="aiConstraintDecision.rhythm.plotTwist.object" class="actor-object">{{ aiConstraintDecision.rhythm.plotTwist.object }}</span>
                      </div>
                      <div v-if="aiConstraintDecision.rhythm.plotTwist.methodology?.length" class="methodology-list">
                        <div class="mini-header">💡 实现方法</div>
                        <ul><li v-for="(m, i) in aiConstraintDecision.rhythm.plotTwist.methodology" :key="i">{{ m }}</li></ul>
                      </div>
                      <div v-if="aiConstraintDecision.rhythm.plotTwist.validationCriteria?.length" class="validation-list">
                        <div class="mini-header">✅ 验证标准</div>
                        <ul><li v-for="(v, i) in aiConstraintDecision.rhythm.plotTwist.validationCriteria" :key="i">{{ v }}</li></ul>
                      </div>
                    </div>
                    <div v-else class="rhythm-decision-item not-needed"><span class="decision-type">🔄 反转</span><span class="decision-status">本集不需要</span></div>
                    
                    <div v-if="aiConstraintDecision.rhythm.boss.needed" class="rhythm-decision-item needed">
                      <div class="decision-header">
                        <span class="decision-type">👹 Boss</span>
                        <span class="decision-urgency" :class="aiConstraintDecision.rhythm.boss.urgency">{{ urgencyLabel(aiConstraintDecision.rhythm.boss.urgency) }}</span>
                      </div>
                      <div class="decision-reason">{{ aiConstraintDecision.rhythm.boss.reason }}</div>
                      <div v-if="aiConstraintDecision.rhythm.boss.subject" class="decision-actors">
                        <span class="actor-subject">{{ aiConstraintDecision.rhythm.boss.subject }}</span>
                        <span v-if="aiConstraintDecision.rhythm.boss.object" class="actor-arrow">→</span>
                        <span v-if="aiConstraintDecision.rhythm.boss.object" class="actor-object">{{ aiConstraintDecision.rhythm.boss.object }}</span>
                      </div>
                      <div v-if="aiConstraintDecision.rhythm.boss.methodology?.length" class="methodology-list">
                        <div class="mini-header">💡 实现方法</div>
                        <ul><li v-for="(m, i) in aiConstraintDecision.rhythm.boss.methodology" :key="i">{{ m }}</li></ul>
                      </div>
                      <div v-if="aiConstraintDecision.rhythm.boss.validationCriteria?.length" class="validation-list">
                        <div class="mini-header">✅ 验证标准</div>
                        <ul><li v-for="(v, i) in aiConstraintDecision.rhythm.boss.validationCriteria" :key="i">{{ v }}</li></ul>
                      </div>
                    </div>
                    <div v-else class="rhythm-decision-item not-needed"><span class="decision-type">👹 Boss</span><span class="decision-status">本集不需要</span></div>
                  </div>
                  <div v-if="aiConstraintDecision.rhythm.guidanceNotes?.length > 0" class="rhythm-guidance">
                    <div class="mini-header">💡 节奏指导</div>
                    <ul class="guidance-list">
                      <li v-for="(note, i) in aiConstraintDecision.rhythm.guidanceNotes" :key="i">{{ note }}</li>
                    </ul>
                  </div>
                </div>
                <div class="foreshadowing-decisions">
                  <div class="subsection-header">🎭 伏笔决策</div>
                  <div class="foreshadowing-stats">
                    <span class="fore-stat must">必须回收: {{ aiConstraintDecision.foreshadowing.mustResolveCount }}</span>
                    <span class="fore-stat can">可以回收: {{ aiConstraintDecision.foreshadowing.canResolveCount }}</span>
                    <span class="fore-stat ignore">暂时忽略: {{ aiConstraintDecision.foreshadowing.shouldIgnoreCount }}</span>
                  </div>
                  <div v-if="aiConstraintDecision.foreshadowing.mustResolve.length > 0" class="must-resolve-list">
                    <div class="mini-header">⚠️ 必须回收的伏笔</div>
                    <div v-for="f in aiConstraintDecision.foreshadowing.mustResolve" :key="f.id" class="must-resolve-item">
                      <div class="fore-header">
                        <span class="fore-content">{{ f.content }}</span>
                        <span class="fore-urgency" :class="f.urgency">{{ urgencyLabel(f.urgency) }}</span>
                      </div>
                      <div class="fore-reason">{{ f.reason }}</div>
                      <div v-if="f.episodePlanted" class="fore-episode">
                        📅 埋藏于第{{ f.episodePlanted }}集
                      </div>
                      <div v-if="f.originalHint" class="fore-hint">
                        📝 原文: {{ f.originalHint }}
                      </div>
                      <div v-if="f.methodology?.length" class="methodology-list">
                        <div class="mini-header">💡 回收方法</div>
                        <ul><li v-for="(m, i) in f.methodology" :key="i">{{ m }}</li></ul>
                      </div>
                      <div v-if="f.validationCriteria?.length" class="validation-list">
                        <div class="mini-header">✅ 验证标准</div>
                        <ul><li v-for="(v, i) in f.validationCriteria" :key="i">{{ v }}</li></ul>
                      </div>
                    </div>
                  </div>
                  <div v-if="aiConstraintDecision.foreshadowing.canResolve?.length > 0" class="can-resolve-list">
                    <div class="mini-header">✅ 可以回收的伏笔</div>
                    <div v-for="(f, i) in aiConstraintDecision.foreshadowing.canResolve" :key="i" class="can-resolve-item">
                      <span class="fore-content">{{ f.content }}</span>
                      <span class="fore-reason">{{ f.reason }}</span>
                    </div>
                  </div>
                  <div v-if="aiConstraintDecision.foreshadowing.shouldIgnore?.length > 0" class="should-ignore-list collapsed-section">
                    <div class="mini-header collapsible" @click="toggleIgnoredForeshadowing">
                      📦 暂时忽略的伏笔 ({{ aiConstraintDecision.foreshadowing.shouldIgnore.length }})
                      <span class="toggle-icon">{{ isIgnoredForeshadowingExpanded ? '▼' : '▶' }}</span>
                    </div>
                    <div v-show="isIgnoredForeshadowingExpanded" class="ignore-list">
                      <div v-for="(f, i) in aiConstraintDecision.foreshadowing.shouldIgnore" :key="i" class="ignore-item">
                        <span class="fore-content">{{ f.content }}</span>
                        <span class="fore-reason">{{ f.reason }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="aiConstraintDecision.cliffhanger.mustContinue" class="cliffhanger-decision">
                  <div class="subsection-header">⚡ 悬念承接</div>
                  <div class="cliffhanger-content">
                    <div class="cliffhanger-text">{{ aiConstraintDecision.cliffhanger.content }}</div>
                    <div class="cliffhanger-reason">{{ aiConstraintDecision.cliffhanger.reason }}</div>
                  </div>
                </div>
                <div v-if="aiConstraintDecision.characterStatesCount > 0" class="character-states-decision">
                  <div class="subsection-header">👥 角色状态约束 ({{ aiConstraintDecision.characterStatesCount }})</div>
                  <div v-if="aiConstraintDecision.characterStates?.length > 0" class="character-states-list">
                    <div v-for="(cs, i) in aiConstraintDecision.characterStates" :key="i" class="character-state-item" :class="{ 'must-show': cs.mustShow }">
                      <div class="cs-header">
                        <span class="cs-name">{{ cs.name }}</span>
                        <span class="cs-condition">{{ cs.condition }}</span>
                        <span v-if="cs.mustShow" class="cs-badge must">必须体现</span>
                      </div>
                      <div class="cs-reason">{{ cs.reason }}</div>
                    </div>
                  </div>
                </div>
                <div v-if="aiConstraintDecision.worldConsistencyCount > 0" class="world-consistency-decision">
                  <div class="subsection-header">🌍 世界一致性约束 ({{ aiConstraintDecision.worldConsistencyCount }})</div>
                  <div v-if="aiConstraintDecision.worldConsistency?.length > 0" class="world-consistency-list">
                    <div v-for="(wc, i) in aiConstraintDecision.worldConsistency" :key="i" class="world-consistency-item" :class="wc.severity">
                      <div class="wc-header">
                        <span class="wc-content">{{ wc.content }}</span>
                        <span class="wc-severity" :class="wc.severity">{{ severityLabel(wc.severity) }}</span>
                      </div>
                      <div class="wc-reason">{{ wc.reason }}</div>
                    </div>
                  </div>
                </div>
              </template>
              <div v-else class="empty-tab">暂无AI决策数据</div>
            </div>

            <div v-if="activeTab === 'validation'" class="tab-pane">
              <template v-if="hasConstraintValidation">
                <div class="validation-header">
                  <span class="validation-badge" :class="{ passed: constraintValidation?.overallSatisfied && hasVerifiableResults, failed: !constraintValidation?.overallSatisfied && hasVerifiableResults, skipped: !hasVerifiableResults }">{{ getValidationStatus() }}</span>
                </div>
                <div v-if="!hasVerifiableResults" class="no-verifiable-constraints">
                  <div class="info-message"><span class="info-icon">ℹ️</span><span>本次生成无可验证约束</span></div>
                  <div v-if="constraintValidation?.summary" class="summary-text">{{ constraintValidation.summary }}</div>
                </div>
                <template v-else>
                  <div class="validation-stats">
                    <div class="stat-card" :class="{ highlight: validationRatePercent < 70 }"><span class="stat-label">满足率</span><span class="stat-value">{{ validationRatePercent }}%</span></div>
                    <div class="stat-card" :class="{ critical: (constraintValidation?.criticalViolations || 0) > 0 }"><span class="stat-label">关键违规 (Critical)</span><span class="stat-value">{{ constraintValidation?.criticalViolations || 0 }}</span></div>
                    <div class="stat-card" :class="{ warning: (constraintValidation?.importantViolations || 0) > 0 }"><span class="stat-label">重要违规 (Important)</span><span class="stat-value">{{ constraintValidation?.importantViolations || 0 }}</span></div>
                    <div class="stat-card"><span class="stat-label">普通违规 (Normal)</span><span class="stat-value">{{ constraintValidation?.normalViolations || 0 }}</span></div>
                  </div>
                  <div v-if="constraintValidation?.summary" class="validation-summary">
                    <div class="subsection-header">📋 验证总结</div>
                    <div class="summary-text">{{ constraintValidation.summary }}</div>
                  </div>
                  <div v-if="unfulfilledConstraints.length > 0" class="unfulfilled-constraints">
                    <div class="subsection-header">⚠️ 未满足约束 ({{ unfulfilledConstraints.length }})</div>
                    <div class="constraint-list">
                      <div v-for="result in unfulfilledConstraints" :key="result.constraintId" class="constraint-item" :class="result.severity">
                        <div class="constraint-header">
                          <span class="constraint-type">{{ constraintTypeLabel(result.constraintType) }}</span>
                          <span class="constraint-severity" :class="result.severity">{{ severityLabel(result.severity) }}</span>
                          <span class="constraint-confidence">置信度 {{ Math.round(result.confidence * 100) }}%</span>
                        </div>
                        <div class="constraint-content">{{ result.constraintContent }}</div>
                        <div class="constraint-reasoning">{{ result.reasoning }}</div>
                      </div>
                    </div>
                  </div>
                  <div v-if="constraintValidation?.improvementSuggestions?.length > 0" class="improvement-suggestions">
                    <div class="subsection-header">💡 改进建议</div>
                    <ul class="suggestion-list"><li v-for="(suggestion, i) in constraintValidation.improvementSuggestions" :key="i">{{ suggestion }}</li></ul>
                  </div>
                </template>
                <div v-if="hasRetryNotifications" class="retry-notifications-inline">
                  <div class="subsection-header">🔄 重试历史</div>
                  <div class="retry-list">
                    <div v-for="(notification, i) in retryNotifications" :key="i" class="retry-notification-item">
                      <div class="retry-header"><span class="retry-attempt">第 {{ notification.attemptNumber }} 次尝试</span><span class="retry-max">(共 {{ notification.maxAttempts }} 次)</span></div>
                      <div class="retry-notification-reason">{{ notification.reason }}</div>
                    </div>
                  </div>
                </div>
              </template>
              <div v-else class="empty-tab">暂无约束验证数据</div>
            </div>

            <div v-if="activeTab === 'analysis'" class="tab-pane">
              <template v-if="analysis">
                <div class="analysis-stats">
                  <div class="stat-card"><span class="stat-label">角色更新</span><span class="stat-value">{{ analysis.characterUpdates }}</span></div>
                  <div class="stat-card"><span class="stat-label">伏笔回收</span><span class="stat-value">{{ analysis.foreshadowingResolved }}</span></div>
                </div>
                <div v-if="analysis.episodeSummary" class="episode-summary-result">
                  <div class="subsection-header">📝 本集摘要</div>
                  <div class="summary-content">{{ analysis.episodeSummary.summary }}</div>
                  <div v-if="analysis.episodeSummary.keyEvents?.length > 0" class="key-events">
                    <div class="mini-header">🎬 关键事件</div>
                    <ul class="event-list"><li v-for="(event, i) in analysis.episodeSummary.keyEvents" :key="i">{{ event }}</li></ul>
                  </div>
                  <div v-if="analysis.episodeSummary.cliffhanger" class="cliffhanger-result">
                    <div class="mini-header">⚡ 本集悬念</div>
                    <div class="cliffhanger-text">{{ analysis.episodeSummary.cliffhanger }}</div>
                  </div>
                </div>
                <div v-if="analysis.plotUpdates" class="plot-updates">
                  <div class="subsection-header">📖 剧情更新</div>
                  <div class="plot-updates-content">
                    <div class="plot-info-row"><span class="plot-label">当前篇章:</span><span class="plot-value">{{ analysis.plotUpdates.currentArc }} ({{ analysis.plotUpdates.arcProgress }}%)</span></div>
                    <div v-if="analysis.plotUpdates.keyEvent" class="plot-info-row"><span class="plot-label">关键事件:</span><span class="plot-value">{{ analysis.plotUpdates.keyEvent }}</span></div>
                    <div v-if="analysis.plotUpdates.newConflict" class="plot-info-row conflict-new"><span class="plot-label">新增冲突:</span><span class="plot-value">{{ analysis.plotUpdates.newConflict }}</span></div>
                    <div v-if="analysis.plotUpdates.resolvedConflict" class="plot-info-row conflict-resolved"><span class="plot-label">解决冲突:</span><span class="plot-value">{{ analysis.plotUpdates.resolvedConflict }}</span></div>
                  </div>
                </div>
                <div v-if="analysis.worldUpdates && hasWorldUpdates" class="world-updates">
                  <div class="subsection-header">🌍 世界更新</div>
                  <div class="world-updates-content">
                    <div v-if="analysis.worldUpdates.newSecrets?.length > 0" class="update-group">
                      <div class="mini-header">🔮 新揭示秘密</div>
                      <ul class="update-list"><li v-for="(secret, i) in analysis.worldUpdates.newSecrets" :key="i">{{ secret }}</li></ul>
                    </div>
                    <div v-if="analysis.worldUpdates.factionChanges?.length > 0" class="update-group">
                      <div class="mini-header">⚔️ 势力变化</div>
                      <ul class="update-list"><li v-for="(change, i) in analysis.worldUpdates.factionChanges" :key="i"><span class="faction-name">{{ change.faction }}</span>: {{ change.change }}</li></ul>
                    </div>
                  </div>
                </div>
                <div v-if="analysis.newCharacters.length > 0" class="new-characters">
                  <div class="subsection-header">👤 新登场角色</div>
                  <div class="character-tags"><span v-for="c in analysis.newCharacters" :key="c.name" class="character-tag" :class="c.tier">{{ c.name }} ({{ tierLabel(c.tier) }})</span></div>
                </div>
                <div v-if="analysis.foreshadowingPlanted.length > 0" class="new-foreshadowings">
                  <div class="subsection-header">🎭 新埋伏笔</div>
                  <ul class="foreshadowing-list"><li v-for="(f, i) in analysis.foreshadowingPlanted" :key="i"><span class="foreshadowing-type">[{{ foreshadowingTypeLabel(f.type) }}]</span> {{ f.content }}</li></ul>
                </div>
                <div v-if="analysis.nextEpisodeHints" class="next-hints">
                  <div class="subsection-header">💡 下集提示</div>
                  <div class="next-hints-content">
                    <div v-if="analysis.nextEpisodeHints.suggestedFocus?.length > 0" class="hint-group">
                      <div class="mini-header">🎯 建议焦点</div>
                      <ul class="hint-list"><li v-for="(focus, i) in analysis.nextEpisodeHints.suggestedFocus" :key="i">{{ focus }}</li></ul>
                    </div>
                    <div v-if="analysis.nextEpisodeHints.pendingForeshadowings?.length > 0" class="hint-group">
                      <div class="mini-header">🎭 待回收伏笔</div>
                      <ul class="hint-list"><li v-for="(f, i) in analysis.nextEpisodeHints.pendingForeshadowings" :key="i">{{ f }}</li></ul>
                    </div>
                  </div>
                </div>
              </template>
              <div v-else class="empty-tab">暂无分析结果</div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="error" class="error-state">
        <span class="error-icon">❌</span>
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useGenerationStore } from '@/stores/generationStore';
import { useBatchGenerationStore } from '@/stores/batchGenerationStore';

const props = defineProps<{
  episodeNumber?: number;
  projectId?: string;
}>();

const emit = defineEmits<{
  (e: 'stop'): void;
}>();

const generationStore = useGenerationStore();
const batchStore = useBatchGenerationStore();

const isBatchMode = computed(() => {
  const task = batchStore.currentTask;
  if (!task) return false;
  if (props.projectId && task.projectId !== props.projectId) return false;
  return task.status === 'running' || task.status === 'pending' || task.status === 'paused';
});

const logs = computed(() => {
  if (isBatchMode.value && batchStore.currentTask) {
    return batchStore.currentTask.logs.map(log => ({
      time: new Date(log.time).toLocaleTimeString('zh-CN', { hour12: false }),
      message: log.message,
      level: log.level as 'info' | 'warn' | 'error'
    }));
  }
  return generationStore.logs;
});

const context = computed(() =>
  isBatchMode.value ? batchStore.currentTask?.lastContext : generationStore.context
);

const analysis = computed(() =>
  isBatchMode.value ? batchStore.currentTask?.lastAnalysis : generationStore.analysis
);

const multiHeadAnalysis = computed(() =>
  isBatchMode.value ? batchStore.currentTask?.lastMultiHeadAnalysis : generationStore.multiHeadAnalysis
);

const constraintValidation = computed(() =>
  isBatchMode.value ? batchStore.currentTask?.lastConstraintValidation : generationStore.constraintValidation
);

const aiConstraintDecision = computed(() =>
  isBatchMode.value ? batchStore.currentTask?.lastAIConstraintDecision : generationStore.aiConstraintDecision
);

const progressPercent = computed(() => {
  if (isBatchMode.value && batchStore.currentTask) {
    return batchStore.currentTask.currentProgress?.percent || 0;
  }
  return generationStore.progressPercent;
});

const wordCount = computed(() => isBatchMode.value ? 0 : generationStore.wordCount);

const isGenerating = computed(() => generationStore.isGenerating);
const characterLifecycle = computed(() => generationStore.characterLifecycle);
const retryNotifications = computed(() => generationStore.retryNotifications);
const error = computed(() => generationStore.error);

const logContainer = ref<HTMLElement | null>(null);

const isCollapsed = ref(false);
const isWorldInfoExpanded = ref(false);
const isIgnoredForeshadowingExpanded = ref(false);

type TabKey = 'context' | 'attention' | 'decision' | 'validation' | 'analysis';
const activeTab = ref<TabKey>('context');

const tabs = computed(() => [
  { key: 'context' as TabKey, label: '上下文', icon: '🎯', hasData: () => !!context.value },
  { key: 'attention' as TabKey, label: '注意力分析', icon: '🧠', hasData: () => !!multiHeadAnalysis.value },
  { key: 'decision' as TabKey, label: 'AI决策', icon: '🤖', hasData: () => !!aiConstraintDecision.value },
  { key: 'validation' as TabKey, label: '约束验证', icon: '🔍', hasData: () => hasConstraintValidation.value },
  { key: 'analysis' as TabKey, label: '分析结果', icon: '📊', hasData: () => !!analysis.value },
]);

const isCompleted = computed(() => {
  return !isGenerating.value && progressPercent.value >= 100 && wordCount.value > 0;
});

const hasData = computed(() => {
  return logs.value.length > 0 || context.value || analysis.value || wordCount.value > 0;
});

const hasWarnings = computed(() => {
  if (!multiHeadAnalysis.value?.headResults) return false;
  return multiHeadAnalysis.value.headResults.some(r => r.warnings.length > 0);
});

function hasAnyLength(...arrays: (unknown[] | undefined | null)[]): boolean {
  return arrays.some(a => (a?.length || 0) > 0);
}

const hasLifecycleChanges = computed(() => {
  if (!characterLifecycle.value) return false;
  const cl = characterLifecycle.value;
  return hasAnyLength(cl.tierChanges, cl.newCharactersToTrack, cl.archivedCharacters);
});

const hasWorldSettings = computed(() => {
  if (!context.value?.worldSettings) return false;
  const ws = context.value.worldSettings;
  return hasAnyLength(ws.revealedSecrets, ws.factions, ws.items);
});

const hasWorldUpdates = computed(() => {
  if (!analysis.value?.worldUpdates) return false;
  const wu = analysis.value.worldUpdates;
  return hasAnyLength(wu.newSecrets, wu.factionChanges, wu.newLocations, wu.itemChanges);
});

const hasConstraintValidation = computed(() => constraintValidation.value !== null);

const hasVerifiableResults = computed(() =>
  !!constraintValidation.value && (constraintValidation.value.results?.length || 0) > 0
);

const validationRatePercent = computed(() => {
  if (!constraintValidation.value) return 100;
  return Math.round(constraintValidation.value.satisfactionRate * 100);
});

const unfulfilledConstraints = computed(() => {
  if (!constraintValidation.value?.results) return [];
  return constraintValidation.value.results.filter(r => !r.fulfilled);
});

const hasRetryNotifications = computed(() => retryNotifications.value.length > 0);

const groupedHeads = computed(() => {
  if (!multiHeadAnalysis.value?.enabledHeads) return [];

  const categories: Record<string, { label: string; category: string; heads: string[] }> = {
    base: { label: '基础', category: 'base', heads: [] },
    mystery: { label: '悬疑', category: 'mystery', heads: [] },
    horror: { label: '恐怖', category: 'horror', heads: [] },
    mind: { label: '智斗', category: 'mind', heads: [] },
    game: { label: '系统', category: 'game', heads: [] },
    cool: { label: '爽文', category: 'cool', heads: [] },
    style: { label: '风格', category: 'style', heads: [] },
  };

  for (const head of multiHeadAnalysis.value.enabledHeads) {
    const category = head.split('-')[0];
    if (categories[category]) {
      categories[category].heads.push(head);
    }
  }

  return Object.values(categories).filter(g => g.heads.length > 0);
});

watch(
  () => logs.value.length,
  () => {
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
      }
    });
  }
);

function handleStop() {
  generationStore.stopGeneration();
  emit('stop');
}

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value;
}

function toggleWorldInfo() {
  isWorldInfoExpanded.value = !isWorldInfoExpanded.value;
}

function toggleIgnoredForeshadowing() {
  isIgnoredForeshadowingExpanded.value = !isIgnoredForeshadowingExpanded.value;
}

function handleClear() {
  generationStore.reset();
  isCollapsed.value = false;
  isWorldInfoExpanded.value = false;
  isIgnoredForeshadowingExpanded.value = false;
}

function labelLookup(labels: Record<string, string>) {
  return (key: string): string => labels[key] || key;
}

const tierLabel = labelLookup({
  core: '核心', main: '主角', arc: '篇章',
  recurring: '常驻', temporary: '临时', extra: '龙套',
});

const presetLabel = labelLookup({
  'extreme-cool': '极限爽文', 'hot-blood': '热血', 'brain-burn': '烧脑',
  'horror-thriller': '恐怖惊悚', 'sweet-romance': '甜宠',
  'system-flow': '系统流', 'mind-game': '智斗', 'custom': '自定义',
});

const headLabel = labelLookup({
  'base-relationships': '角色关系', 'base-conflicts': '剧情冲突',
  'base-foreshadowing': '伏笔追踪', 'base-consistency': '世界一致性',
  'mystery-clues': '线索追踪', 'mystery-logic': '逻辑一致性', 'mystery-revelation': '谜底管理',
  'horror-atmosphere': '氛围营造', 'horror-rhythm': '惊吓节奏', 'horror-unknown': '未知管理',
  'mind-information': '信息差管理', 'mind-strategy': '策略对弈', 'mind-twist': '反转铺垫',
  'game-leveling': '等级系统', 'game-equipment': '装备获取', 'game-skills': '技能展示',
  'cool-faceslap': '打脸节奏', 'cool-points': '爽点分布', 'cool-villain': '反派智商',
  'style-emotions': '情感弧线', 'style-pacing': '节奏控制', 'style-humor': '幽默调节',
});

const constraintTypeLabel = labelLookup({
  faceSlapping: '打脸场景 (Face-Slapping)', plotTwist: '剧情反转 (Plot Twist)',
  foreshadowing: '伏笔回收 (Foreshadowing)', cliffhanger: '悬念承接 (Cliffhanger)',
  characterState: '角色状态 (Character State)', boss: 'Boss出场 (Boss)',
  coolPoint: '爽点 (Cool Point)', rhythm: '节奏控制 (Rhythm)', continuity: '连续性 (Continuity)',
});

const severityLabel = labelLookup({
  critical: '关键 (Critical)', important: '重要 (Important)', normal: '一般 (Normal)',
});

const urgencyLabel = labelLookup({
  critical: '紧急 (Critical)', high: '高 (High)', medium: '中 (Medium)',
  low: '低 (Low)', none: '无 (None)',
});

const foreshadowingTypeLabel = labelLookup({
  suspense: '悬念', item: '物品', plot: '剧情',
  character: '角色', dialogue: '对话', atmosphere: '氛围',
});

function getTierChangeClass(from: string, to: string): string {
  const tierOrder = ['main', 'extra', 'temporary', 'arc', 'recurring', 'core'];
  const fromIndex = tierOrder.indexOf(from);
  const toIndex = tierOrder.indexOf(to);
  if (toIndex > fromIndex) return 'upgrade';
  if (toIndex < fromIndex) return 'downgrade';
  return '';
}

function getEpisodeStatus(ep: number): string {
  const task = batchStore.currentTask;
  if (!task) return 'pending';
  if (task.completed.includes(ep)) return 'completed';
  if (task.currentEpisode === ep) return 'current';
  if (task.failed.some(f => f.episode === ep)) return 'failed';
  if (task.skipped.includes(ep)) return 'skipped';
  return 'pending';
}

const getEpisodeTooltip = labelLookup({
  completed: '已完成', current: '生成中', failed: '失败',
  skipped: '超时跳过', pending: '等待中',
});

function getEpisodeTooltipFull(ep: number): string {
  return `第${ep}集 - ${getEpisodeTooltip(getEpisodeStatus(ep))}`;
}

function getValidationStatus(): string {
  if (!hasVerifiableResults.value) return '- 跳过';
  return constraintValidation.value?.overallSatisfied ? '✓ 通过' : '✗ 未通过';
}
</script>

<style scoped>
.generation-progress-panel {
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  overflow: hidden;
}
.generation-progress-panel.generating {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary);
}
.generation-progress-panel.completed {
  border-color: var(--success);
}
.generation-progress-panel.collapsed .panel-header {
  border-bottom: none;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-default);
  cursor: pointer;
  user-select: none;
  transition: var(--transition-fast);
}
.panel-header:hover {
  background: var(--bg-hover);
}
.collapse-icon {
  font-size: 10px;
  color: var(--text-secondary);
  margin-right: var(--space-1);
  transition: var(--transition-fast);
}
.header-actions {
  display: flex;
  gap: var(--space-2);
}
.btn-clear {
  padding: var(--space-1) var(--space-2);
  font-size: 14px;
  background: transparent;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition-fast);
  color: var(--text-secondary);
}
.btn-clear:hover {
  background: var(--error-muted);
  border-color: var(--error);
  color: var(--error);
}
.section-toggle {
  margin-left: auto;
  font-size: 11px;
  font-weight: 400;
  color: var(--primary);
  cursor: pointer;
}
.section-toggle:hover {
  text-decoration: underline;
}
.panel-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 13px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}
.panel-stats {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: 12px;
  color: var(--text-secondary);
}
.panel-stats .stat-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
.panel-stats .stat-value {
  font-weight: 600;
  color: var(--primary);
}
.icon {
  font-size: 14px;
}
.episode-badge {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-secondary);
  background: var(--bg-hover);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
}
.btn-stop {
  padding: var(--space-2) var(--space-3);
  font-size: 12px;
  background: var(--error);
  color: var(--text-on-primary);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition-fast);
}
.btn-stop:hover {
  background: var(--error);
}
.progress-bar-section {
  padding: var(--space-1) var(--space-3);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-default);
}
.progress-bar-container {
  height: 6px;
  background: var(--bg-hover);
  border-radius: 3px;
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--primary-hover));
  border-radius: 3px;
  transition: width 0.3s ease;
}
.progress-bar.complete {
  background: linear-gradient(90deg, var(--success), var(--success));
}

.main-content {
  display: flex;
  flex-direction: column;
}

.log-section-top {
  max-height: 250px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-default);
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
}

.log-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-default);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.log-header .icon {
  font-size: 14px;
}

.log-title {
  color: var(--text-primary);
}

.tab-area {
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
}

.tab-navigation {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-default);
  overflow-x: auto;
  flex-shrink: 0;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  transition: var(--transition-fast);
}

.tab-item:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.tab-item.active {
  background: var(--primary-muted);
  color: var(--primary);
  font-weight: 600;
}

.tab-item:disabled,
.tab-item.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.tab-icon {
  font-size: 12px;
}

.tab-label {
  font-size: 11px;
}

.tab-content {
  padding: var(--space-3);
}
.empty-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
  color: var(--text-secondary);
  font-size: 12px;
}

.context-stats,
.analysis-stats,
.validation-stats,
.decision-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.stat-card {
  text-align: center;
  padding: var(--space-2);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
}

.stat-card .stat-label {
  display: block;
  font-size: 10px;
  color: var(--text-secondary);
  margin-bottom: var(--space-1);
}

.stat-card .stat-value {
  display: block;
  font-size: 16px;
  font-weight: 600;
  color: var(--primary);
}

.stat-card.critical .stat-value {
  color: var(--error);
}

.stat-card.warning .stat-value {
  color: var(--warning);
}

.stat-card.highlight .stat-value {
  color: var(--error);
}

.aggregated-stats {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.stat-mini {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 11px;
}

.stat-mini .stat-label {
  color: var(--text-secondary);
}

.stat-mini .stat-value {
  font-weight: 600;
  color: var(--primary);
}

.decision-summary {
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--primary);
  font-size: 12px;
  color: var(--text-primary);
  margin-bottom: var(--space-3);
}

.rhythm-decisions,
.foreshadowing-decisions {
  margin-top: var(--space-3);
}

.rhythm-decision-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.rhythm-decision-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  font-size: 11px;
}

.rhythm-decision-item.needed {
  border-left: 3px solid var(--warning);
}

.rhythm-decision-item.not-needed {
  opacity: 0.6;
}

.decision-type {
  font-weight: 600;
  min-width: 60px;
}

.decision-urgency {
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-weight: 500;
}

.decision-urgency.critical {
  background: var(--error-muted);
  color: var(--error);
}

.decision-urgency.high {
  background: var(--warning-muted);
  color: var(--warning);
}

.decision-urgency.medium {
  background: var(--info-muted);
  color: var(--primary);
}

.decision-reason {
  flex: 1;
  color: var(--text-secondary);
}

.decision-status {
  color: var(--text-muted);
  font-style: italic;
}

.foreshadowing-stats {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
  font-size: 11px;
}

.fore-stat {
  padding: 2px 8px;
  border-radius: var(--radius-sm);
}

.fore-stat.must {
  background: var(--error-muted);
  color: var(--error);
}

.fore-stat.can {
  background: var(--success-muted);
  color: var(--success);
}

.fore-stat.ignore {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.must-resolve-list {
  margin-top: var(--space-2);
}

.must-resolve-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2);
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-2);
  font-size: 11px;
}

.fore-urgency {
  display: inline-block;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: 10px;
}

.can-resolve-list {
  margin-top: var(--space-2);
}

.can-resolve-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2);
  background: var(--success-muted);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-2);
  font-size: 11px;
  border-left: 2px solid var(--success);
}

.should-ignore-list {
  margin-top: var(--space-2);
}

.collapsible {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.toggle-icon {
  font-size: 10px;
  color: var(--text-muted);
}

.ignore-list {
  margin-top: var(--space-2);
}

.ignore-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2);
  background: var(--bg-hover);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-2);
  font-size: 11px;
  opacity: 0.7;
}

.rhythm-guidance {
  margin-top: var(--space-2);
  padding: var(--space-2);
  background: var(--info-muted);
  border-radius: var(--radius-sm);
}

.guidance-list {
  margin: var(--space-1) 0 0 0;
  padding-left: 16px;
  font-size: 11px;
  color: var(--text-secondary);
}

.guidance-list li {
  margin-bottom: var(--space-1);
}

.character-states-decision {
  margin-top: var(--space-3);
}

.character-states-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.character-state-item {
  padding: var(--space-2);
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  font-size: 11px;
}

.character-state-item.must-show {
  border-left: 3px solid var(--warning);
}

.cs-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.cs-name {
  font-weight: 600;
  color: var(--text-primary);
}

.cs-condition {
  color: var(--text-secondary);
}

.cs-badge {
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: 10px;
}

.cs-badge.must {
  background: var(--warning-muted);
  color: var(--warning);
}

.cs-reason {
  color: var(--text-muted);
  font-style: italic;
}

.world-consistency-decision {
  margin-top: var(--space-3);
}

.world-consistency-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.world-consistency-item {
  padding: var(--space-2);
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  font-size: 11px;
  border-left: 3px solid var(--border-default);
}

.world-consistency-item.critical {
  border-left-color: var(--error);
}

.world-consistency-item.important {
  border-left-color: var(--warning);
}

.world-consistency-item.normal {
  border-left-color: var(--text-secondary);
}

.wc-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.wc-content {
  flex: 1;
  color: var(--text-primary);
}

.wc-severity {
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: 10px;
}

.wc-severity.critical {
  background: var(--error-muted);
  color: var(--error);
}

.wc-severity.important {
  background: var(--warning-muted);
  color: var(--warning);
}

.wc-severity.normal {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.wc-reason {
  color: var(--text-muted);
  font-style: italic;
}

.cliffhanger-decision {
  margin-top: var(--space-3);
  font-size: 11px;
  color: var(--text-secondary);
}

.validation-header {
  margin-bottom: var(--space-3);
}

.validation-badge {
  display: inline-block;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
}

.validation-badge.passed {
  background: var(--success-muted);
  color: var(--success);
}

.validation-badge.failed {
  background: var(--error-muted);
  color: var(--error);
}

.validation-badge.skipped {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.no-verifiable-constraints {
  padding: var(--space-3);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
}

.info-message {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 12px;
  color: var(--text-secondary);
}

.unfulfilled-constraints {
  margin-top: var(--space-3);
}

.constraint-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.constraint-item {
  padding: var(--space-2);
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--border-default);
  font-size: 11px;
}

.constraint-item.critical {
  border-left-color: var(--error);
}

.constraint-item.important {
  border-left-color: var(--warning);
}

.constraint-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.constraint-type {
  font-weight: 600;
  color: var(--text-primary);
}

.constraint-severity {
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: 10px;
}

.constraint-severity.critical {
  background: var(--error-muted);
  color: var(--error);
}

.constraint-severity.important {
  background: var(--warning-muted);
  color: var(--warning);
}

.constraint-confidence {
  color: var(--text-muted);
  font-size: 10px;
}

.constraint-content {
  color: var(--text-primary);
  margin-bottom: var(--space-1);
}

.constraint-reasoning {
  color: var(--text-secondary);
  font-style: italic;
}

.improvement-suggestions {
  margin-top: var(--space-3);
}

.suggestion-list {
  margin: 0;
  padding-left: 20px;
  font-size: 11px;
  color: var(--text-primary);
}

.suggestion-list li {
  padding: 2px 0;
}

.retry-notifications-inline {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-default);
}

.retry-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.retry-notification-item {
  padding: var(--space-2);
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  font-size: 11px;
}

.retry-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.retry-attempt {
  font-weight: 600;
  color: var(--warning);
}

.retry-max {
  color: var(--text-muted);
}

.retry-notification-reason {
  color: var(--text-secondary);
}

.log-count {
  font-weight: 400;
}
.log-section-top .log-container {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 11px;
  max-height: 220px;
}

.log-container {
  max-height: 200px;
  overflow-y: auto;
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 11px;
}

.log-item {
  padding: var(--space-1) var(--space-2);
  border-bottom: 1px solid var(--border-default);
}

.log-item:last-child {
  border-bottom: none;
}

.log-item.info {
  color: var(--text-primary);
}

.log-item.warn {
  background: var(--warning-muted);
  color: var(--warning);
}

.log-item.error {
  background: var(--error-muted);
  color: var(--error);
}

.log-time {
  color: var(--text-secondary);
  margin-right: var(--space-2);
}

.log-message {
  white-space: pre-wrap;
  word-break: break-all;
}

.log-empty {
  padding: var(--space-4);
  text-align: center;
  color: var(--text-secondary);
}

.subsection-header {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}

.hidden-connections,
.new-characters,
.new-foreshadowings,
.rhythm-settings,
.cliffhanger,
.characters-detail,
.foreshadowings-detail,
.formatted-context {
  margin-top: var(--space-3);
}

.formatted-context .subsection-header {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.formatted-context .subsection-header:hover {
  color: var(--primary);
}

.world-info-content {
  margin-top: var(--space-2);
}

.world-info-text {
  margin: 0;
  padding: var(--space-3);
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 400px;
  overflow-y: auto;
}

.rhythm-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);
}

.rhythm-item {
  display: flex;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-surface);
  border-radius: var(--radius-sm);
  font-size: 11px;
}

.rhythm-label {
  color: var(--text-secondary);
}

.rhythm-value {
  font-weight: 500;
  color: var(--primary);
}

.writing-style {
  margin-top: var(--space-3);
}

.writing-style-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--primary);
}

.style-preset {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
}

.style-custom {
  font-size: 11px;
  color: var(--text-secondary);
  font-style: italic;
}

.cliffhanger-content {
  padding: var(--space-2) var(--space-3);
  background: var(--warning-muted);
  border-left: 3px solid var(--warning);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  font-size: 12px;
  color: var(--warning);
}

.character-weight-list,
.foreshadowing-weight-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.character-weight-item,
.foreshadowing-weight-item {
  padding: var(--space-2) var(--space-3);
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--border-default);
}

.character-weight-item.core {
  border-left-color: var(--primary);
  background: var(--primary-muted);
}

.character-weight-item.recurring {
  border-left-color: var(--success);
}

.character-weight-item.arc {
  border-left-color: var(--warning);
}

.char-main {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 12px;
  margin-bottom: var(--space-1);
}

.char-name {
  font-weight: 600;
  color: var(--text-primary);
}

.char-role {
  color: var(--text-secondary);
}

.char-tier {
  font-size: 10px;
  color: var(--text-muted);
}

.char-weight,
.fore-weight {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: 16px;
}

.weight-bar {
  height: 6px;
  background: linear-gradient(90deg, var(--primary), var(--primary-hover));
  border-radius: 3px;
  min-width: 10px;
}

.weight-value {
  font-size: 10px;
  font-weight: 500;
  color: var(--primary);
  min-width: 32px;
}

.char-detail {
  font-size: 10px;
  color: var(--text-secondary);
  margin-top: var(--space-1);
}

.char-status {
  font-size: 10px;
  margin-top: var(--space-1);
}

.char-status.warn {
  color: var(--warning);
}

.fore-main {
  margin-bottom: var(--space-1);
}

.fore-content {
  font-size: 11px;
  color: var(--text-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.fore-reason {
  font-size: 10px;
  color: var(--text-secondary);
  font-style: italic;
  margin-top: var(--space-1);
}

.more-items {
  font-size: 10px;
  color: var(--text-secondary);
  text-align: center;
  padding: var(--space-1);
}

.connection-list,
.foreshadowing-list {
  margin: 0;
  padding-left: 20px;
  font-size: 11px;
  color: var(--text-primary);
}

.connection-list li,
.foreshadowing-list li {
  padding: 2px 0;
}

.foreshadowing-type {
  font-weight: 500;
  color: var(--primary);
  margin-right: var(--space-1);
}

.character-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.character-tag {
  font-size: 11px;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--bg-hover);
  color: var(--text-primary);
}

.character-tag.main {
  background: var(--primary-muted);
  color: var(--primary);
}

.character-tag.arc {
  background: var(--warning-muted);
  color: var(--warning);
}

.character-tag.recurring {
  background: var(--success-muted);
  color: var(--success);
}

.error-state {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--error-muted);
  color: var(--error);
  font-size: 12px;
}

.enabled-heads-grouped {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.head-group {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

.head-group-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 36px;
  padding-top: 5px;
}

.head-group-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  flex: 1;
}

.head-tag {
  font-size: 11px;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  background: var(--primary-muted);
  color: var(--primary);
  border: 1px solid var(--primary-border);
}

.head-tag.base {
  background: var(--bg-hover);
  color: var(--text-secondary);
  border-color: var(--border-default);
}

.head-tag.mystery {
  background: var(--purple-muted);
  color: var(--primary-hover);
  border-color: var(--purple-border);
}

.head-tag.horror {
  background: var(--error-muted);
  color: var(--error);
  border-color: var(--error-border);
}

.head-tag.mind {
  background: var(--warning-muted);
  color: var(--warning);
  border-color: var(--warning-border);
}

.head-tag.game {
  background: var(--success-muted);
  color: var(--success);
  border-color: var(--success-border);
}

.head-tag.cool {
  background: var(--orange-muted);
  color: var(--orange);
  border-color: var(--orange-border);
}

.head-tag.style {
  background: var(--pink-muted);
  color: var(--pink);
  border-color: var(--pink-border);
}

.cross-dimension {
  margin-top: var(--space-3);
}

.insight-list {
  margin: 0;
  padding-left: 18px;
  font-size: 11px;
  color: var(--text-primary);
}

.insight-list li {
  padding: 3px 0;
  line-height: 1.4;
}

.head-warnings {
  margin-top: var(--space-3);
}

.warning-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--warning-muted);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-1);
  font-size: 11px;
}

.warning-head {
  font-weight: 600;
  color: var(--warning);
  white-space: nowrap;
}

.warning-text {
  color: var(--warning);
}

.tier-changes {
  margin-bottom: var(--space-3);
}

.tier-change-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-2);
  font-size: 12px;
  border-left: 3px solid var(--border-default);
}

.tier-change-item.upgrade {
  border-left-color: var(--success);
  background: var(--success-muted);
}

.tier-change-item.downgrade {
  border-left-color: var(--warning);
  background: var(--warning-muted);
}

.change-name {
  font-weight: 600;
  color: var(--text-primary);
}

.change-arrow {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 11px;
  color: var(--text-secondary);
}

.tier-from {
  text-decoration: line-through;
  opacity: 0.7;
}

.tier-to {
  font-weight: 600;
  color: var(--primary);
}

.change-reason {
  flex: 1;
  font-size: 10px;
  color: var(--text-secondary);
  font-style: italic;
}

.new-tracked,
.archived {
  margin-top: var(--space-3);
}

.tracked-list,
.archived-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.tracked-tag {
  font-size: 11px;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--success-muted);
  color: var(--success);
  border: 1px solid var(--success-border);
}

.tracked-tag.core {
  background: var(--primary-muted);
  color: var(--primary);
  border-color: var(--primary-border);
}

.tracked-tag.recurring {
  background: var(--success-muted);
  color: var(--success);
  border-color: var(--success-border);
}

.tracked-tag.arc {
  background: var(--warning-muted);
  color: var(--warning);
  border-color: var(--warning-border);
}

.tracked-tag.temporary {
  background: var(--bg-hover);
  color: var(--text-secondary);
  border-color: var(--border-default);
}

.archived-tag {
  font-size: 11px;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--bg-hover);
  color: var(--text-muted);
  text-decoration: line-through;
  opacity: 0.8;
}

.episode-plan {
  margin-top: var(--space-3);
}

.episode-plan-content {
  padding: var(--space-3);
  background: var(--primary-muted);
  border-left: 3px solid var(--primary);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-primary);
}

.enhanced-badge {
  margin-left: var(--space-2);
  padding: 2px var(--space-2);
  background: var(--success-muted);
  color: var(--success);
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-weight: 500;
}

.original-plan {
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-hover);
  border-left: 3px solid var(--text-muted);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
}

.original-plan-header {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: var(--space-1);
}

.original-plan-content {
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-muted);
}

.plot-state {
  margin-top: var(--space-3);
}

.plot-state-content {
  padding: var(--space-3);
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
}

.arc-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}

.arc-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--primary);
}

.arc-progress {
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-hover);
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
}

.main-progress {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}

.pending-conflicts,
.recent-events {
  margin-top: var(--space-2);
}

.mini-header {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: var(--space-1);
}

.conflict-list,
.event-list {
  margin: 0;
  padding-left: 18px;
  font-size: 11px;
  color: var(--text-primary);
}

.conflict-list li,
.event-list li {
  padding: 2px 0;
}

.world-settings {
  margin-top: var(--space-3);
}

.world-settings-content {
  padding: var(--space-3);
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
}

.secrets,
.factions,
.items {
  margin-bottom: var(--space-3);
}

.secrets:last-child,
.factions:last-child,
.items:last-child {
  margin-bottom: 0;
}

.secret-list {
  margin: 0;
  padding-left: 18px;
  font-size: 11px;
  color: var(--text-primary);
}

.secret-list li {
  padding: 2px 0;
}

.faction-list,
.item-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.faction-tag,
.item-tag {
  font-size: 10px;
  padding: 3px var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--bg-hover);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}

.episode-summary-result {
  margin-top: var(--space-3);
  padding: var(--space-3);
  background: var(--primary-muted);
  border-radius: var(--radius-md);
  border: 1px solid var(--primary-border);
}

.summary-content {
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.key-events {
  margin-top: var(--space-2);
}

.cliffhanger-result {
  margin-top: var(--space-2);
}

.cliffhanger-text {
  font-size: 11px;
  color: var(--warning);
  background: var(--warning-muted);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
}

.plot-updates {
  margin-top: var(--space-3);
}

.plot-updates-content {
  padding: var(--space-3);
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
}

.plot-info-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-1) 0;
  font-size: 11px;
}

.plot-label {
  font-weight: 500;
  color: var(--text-secondary);
  min-width: 70px;
}

.plot-value {
  color: var(--text-primary);
  flex: 1;
}

.plot-info-row.conflict-new .plot-value {
  color: var(--error);
}

.plot-info-row.conflict-resolved .plot-value {
  color: var(--success);
}

.world-updates {
  margin-top: var(--space-3);
}

.world-updates-content {
  padding: var(--space-3);
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
}

.update-group {
  margin-bottom: var(--space-3);
}

.update-group:last-child {
  margin-bottom: 0;
}

.update-list {
  margin: var(--space-1) 0 0;
  padding-left: 18px;
  font-size: 11px;
  color: var(--text-primary);
}

.update-list li {
  padding: 2px 0;
}

.faction-name,
.location-name,
.item-name {
  font-weight: 500;
  color: var(--primary);
}

.next-hints {
  margin-top: var(--space-3);
}

.next-hints-content {
  padding: var(--space-3);
  background: var(--primary-muted);
  border-radius: var(--radius-md);
  border: 1px solid var(--primary-border);
}

.hint-group {
  margin-bottom: var(--space-3);
}

.hint-group:last-child {
  margin-bottom: 0;
}

.hint-list {
  margin: var(--space-1) 0 0;
  padding-left: 18px;
  font-size: 11px;
  color: var(--text-primary);
}

.hint-list li {
  padding: 2px 0;
}

@media (max-width: 768px) {
  .log-section-top {
    max-height: 100px;
  }
  
  .log-section-top .log-container {
    max-height: 70px;
  }
  
  .context-stats,
  .analysis-stats,
  .validation-stats,
  .decision-stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .tab-navigation {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  
  .panel-stats {
    display: none;
  }
}

.decision-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.decision-actors {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 6px;
  padding: 4px 8px;
  background: var(--bg-surface);
  border-radius: 4px;
}

.actor-subject {
  font-weight: 500;
  color: var(--primary);
}

.actor-arrow {
  color: var(--text-tertiary);
}

.actor-object {
  font-weight: 500;
  color: var(--error, #f44);
}

.methodology-list,
.validation-list {
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--bg-surface);
  border-radius: 4px;
  font-size: 12px;
}

.methodology-list {
  border-left: 3px solid var(--primary);
}

.validation-list {
  border-left: 3px solid var(--success, #4caf50);
}

.methodology-list .mini-header,
.validation-list .mini-header {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.methodology-list ul,
.validation-list ul {
  margin: 0 0 0 16px;
  padding: 0;
}

.methodology-list li,
.validation-list li {
  color: var(--text-primary);
  line-height: 1.5;
}

.fore-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.fore-episode {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 4px;
}

.fore-hint {
  font-size: 11px;
  color: var(--text-muted);
  font-style: italic;
  margin-top: 4px;
  padding: 4px 8px;
  background: var(--bg-surface);
  border-radius: 4px;
  border-left: 2px solid var(--warning, #ff9800);
}

.batch-overview {
  padding: var(--space-4);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  border: 1px solid var(--border-default);
}

.batch-stats {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.batch-stats .stat-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-3);
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
}

.batch-stats .stat-card.success {
  border-color: var(--success);
  background: var(--success-muted);
}

.batch-stats .stat-card.error {
  border-color: var(--error);
  background: var(--error-muted);
}

.batch-stats .stat-card.warning {
  border-color: var(--warning);
  background: var(--warning-muted);
}

.batch-stats .stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
}

.batch-stats .stat-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: var(--space-1);
}

.episode-progress {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-bottom: var(--space-2);
}

.ep-dot {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-hover);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 500;
  color: var(--text-tertiary);
  cursor: help;
  transition: all var(--duration-fast);
}

.ep-dot:hover {
  transform: scale(1.1);
}

.ep-dot.completed {
  background: var(--success-muted);
  border-color: var(--success);
  color: var(--success);
}

.ep-dot.current {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--text-on-primary);
  animation: pulse 1.5s ease-in-out infinite;
}

.ep-dot.failed {
  background: var(--error-muted);
  border-color: var(--error);
  color: var(--error);
}

.ep-dot.skipped {
  background: var(--warning-muted);
  border-color: var(--warning);
  color: var(--warning);
}

.ep-dot.pending {
  opacity: 0.6;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}

.current-episode-info {
  text-align: center;
  font-size: 13px;
  color: var(--primary);
  font-weight: 500;
  padding: var(--space-2);
  background: var(--primary-muted);
  border-radius: var(--radius-sm);
}
</style>
