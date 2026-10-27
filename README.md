<div align="center">

# AImanju · AI 动态漫剧本生成系统

**让 AI 替你写出完整的动态漫剧本：从一句话概念到成片可拍的剧本、人物图、分镜与视频提示词。**

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3.x-42b883.svg)](https://vuejs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7%2B-47A248.svg)](https://www.mongodb.com/)
[![Express](https://img.shields.io/badge/Express-5.x-000000.svg)](https://expressjs.com/)

[功能总览](#-功能总览) · [核心创新](#-核心创新-不只是简单的-prompt-工程) · [技术栈](#%EF%B8%8F-技术栈) · [快速开始](#-快速开始) · [使用流程](#-完整使用流程) · [API 概览](#-api-概览)

</div>

---

## 📖 项目简介

**AImanju**（AI 漫剧）是一个面向中文动态漫（短视频/竖屏漫剧）创作场景的工业级 AI 剧本生产系统。它把"概念 → 大纲 → 角色卡 → 分集梗概 → 完整剧本 → 状态追踪 → 改写润色 → 一致性校验"整条创作流水线接到大模型上，由多个 AI Agent 协同完成。

**它不是简单的 ChatGPT 套壳**——AImanju 内置了 18 个独立的业务服务模块，包括角色生命周期管理、世界状态机、伏笔追踪、节奏控制器、约束求解器、注意力调度、Reflexion 提示词工厂等，专门解决长剧情 AI 写作中的"角色失忆"、"伏笔遗忘"、"世界观崩坏"、"节奏失控"等真实痛点。

### 🎯 适用人群

| 场景 | AImanju 怎么帮你 |
|---|---|
| **🎬 短视频创作者** | 一句话生成 60+ 集完整剧本，可直接交给配音/分镜团队 |
| **🏢 漫剧工作室** | 批量孵化多个项目，团队协作，多账户分级权限 |
| **✍️ 个人编剧** | AI 协作写作，跨集联动修复，单集精修润色 |
| **🎨 漫画创作者** | 同时输出 AI 绘图提示词（角色立绘+表情包+战斗态） |
| **🎥 视频创作者** | 输出 Runway / Pika / 可灵 等多平台视频生成提示词 |
| **🧪 AI 工具开发者** | 18 个业务模块、29 个数据模型，研究大模型工程化最佳实践 |

---

## ✨ 功能总览

### 🧠 AI 创作能力

| 模块 | 功能 |
|---|---|
| **大纲生成** | 输入一句创意 → 自动产出世界观、人物卡（5-8 个）、剧情大纲（200-400 字）、分集梗概（每集 100-150 字） |
| **角色卡生成** | 自动生成详细角色设定：性别/年龄/身份/外貌/性格/标志性配饰/战斗状态 |
| **逐集剧本生成** | 流式生成完整剧本，包含场景标记、画面描述、对白、内心独白、画外音、系统提示 |
| **分集梗概扩展** | 自动补充每集的钩子、爽点、悬念；按制作方法论规划起伏（国内/海外通用）：第1集黄金开局（打压 → 金手指首秀的小反转 → 再打压 → 结尾钩子）、每集"压→扬→新危机"、每 3-5 集一个小燃点、付费卡点集才是大燃点；剧本阶段由 AI 验证器同步校验单集起伏与第1集金手指亮相 |
| **16 种输出格式** | 标准动态漫、戏剧剧本、有声小说脚本、海外短剧等多种预设可选 |
| **海外短剧品类包** | `overseas_drama` 预设：女频 11 类（霸总契约/黑手党/狼人/ABO/吸血鬼/契约婚姻/禁忌之恋/隐藏身份/重生复仇/神话虐恋/豪门恩怨）+ 男频 6 类（复仇逆袭/黑帮枭雄/都市强者/技术流逆袭/身份揭露/战神归来）；大纲期自动规划付费卡点与集尾强钩，单集字数可配置；剧本按承制方交付格式输出（合并双语台词/行业标准场景头/场景级人物行/英文情绪描述），配套黄金开局/强冲突/情绪拉扯/高燃场面方法论 |
| **多模型自由切换** | Claude / GPT / Gemini / 智谱 GLM / DeepSeek / 豆包 Ark / 阿里百炼，运行时可热切换 |

### 👥 角色一致性引擎

| 模块 | 功能 |
|---|---|
| **角色生命周期管理** | 角色 ID、出场记录、关系网络全生命周期追踪 |
| **角色弧光追踪** | 自动追踪角色成长曲线（CharacterArcTracker） |
| **形态修改器系统** | 装备/能力/伤势分**永久 / 阶段 / 临时**三级持久化，支持优先级与互斥替换 |
| **状态分析器** | 每集生成后 AI 自动提取角色状态变化（装备/能力/伤势/精神/战力） |
| **角色魅力分析** | 自动分析角色吸引力维度（CharacterCharmAnalyzer） |
| **声纹与口头禅** | 维护每个角色的语言风格画像（CharacterVoiceProfiler） |
| **关系图谱** | 角色关系动态构建与可视化（RelationshipTracker） |

### 🌐 世界观与剧情管理

| 模块 | 功能 |
|---|---|
| **世界状态机** | 全局世界状态版本化管理，支持回滚与时间旅行 |
| **伏笔管理** | 自动埋伏笔、追踪触发，防止"伏笔遗忘"（ForeshadowingManager） |
| **剧情线校验** | 多剧情线一致性校验（PlotThreadValidator） |
| **跨集联动修复** | 自动检测跨集矛盾点并 AI 修复（FixSession） |
| **约束求解** | 用户自定义硬约束（如"主角不能提前透露身份"），AI 生成时严格遵守（UnifiedConstraintManager） |
| **注意力调度** | AttentionRecommender 决定 AI 当前应该聚焦哪些角色/伏笔/世界规则 |

### 🎵 创作质量保障

| 模块 | 功能 |
|---|---|
| **节奏控制器** | 钩子 / 打脸 / 升级 / 逆袭 等爽点节奏自动设计（RhythmControl） |
| **场景节奏规划器** | 单集场景级别的节奏分布（SceneRhythmPlanner） |
| **Reflexion 提示词工厂** | 基于 Reflexion 论文的反思式提示词构造，AI 自我审视 |
| **叙事方法论** | 内置经典叙事学规则（三幕结构、英雄之旅等） |
| **上下文预算分配** | 12K 字符智能切片：角色 35% / 前情 20% / 梗概 15% / 状态 15% / 格式 15% |
| **一致性校验** | ScriptValidator 全方位检测剧本格式、角色一致、剧情合理 |

### 🛠️ 工程化能力

| 模块 | 功能 |
|---|---|
| **流式生成（SSE）** | 逐字推送，心跳保活，断线自动暂停，支持恢复 |
| **断点续生** | 任务级进度持久化，可暂停 / 恢复 / 失败重试 / 跳过失败集 |
| **批量任务执行器** | 多项目 + 多集同时生成的产线级调度（BatchTaskExecutor） |
| **多 API Key 轮换** | 单模型多 Key 配置，速率限制时自动轮换 |
| **改写引擎** | 单集改写、多集协同改写（BatchCoherentRewriteService） |
| **改写历史** | 每次改写都有版本记录，可对比、回滚 |
| **级联清理** | 删除项目自动清理全部 21 类关联数据（角色/世界状态/伏笔/日志/改写记录等），不留孤儿记录 |
| **属性测试覆盖** | 6 大模块使用 fast-check 进行属性测试 |

### 🔐 多角色账号体系

| 角色 | 能力 |
|---|---|
| **创作者 (Creator)** | 创建项目、生成剧本、管理配额、试用模式 |
| **代理 (Agent)** | 邀请创作者、分配额度、查看销售数据 |
| **买家 (Buyer)** | 浏览发布的剧本、按集购买、收藏 |
| **管理员 (Admin)** | 全系统管理、审核发布、配额发放、积分管理 |
| **JWT + bcrypt** | 三套独立 JWT 密钥（buyer / creator / agent），密码 bcrypt 哈希 |
| **配额管理** | 项目数量配额、单项目集数配额、试用集数限制、积分充值 |
| **发布与购买** | 创作者可发布项目，买家按集购买，积分系统结算 |

### 🎨 跨模态资产生成

参考 `system_design.md` 与 `agents_final.md`，AImanju 设计上支持完整的多 Agent 流水线，可扩展输出：

- **角色立绘 / 表情包 / 战斗态** AI 绘图提示词
- **分镜表**（景别、角度、光线、时长）
- **视频生成提示词**（Runway Gen-3 / Pika Labs / 可灵 / Stable Video Diffusion / Luma 多平台格式）

---

## 💡 核心创新（不只是简单的 Prompt 工程）

### 1. 形态修改器（Form Modifier）系统

传统 AI 写作中，角色"换装"、"受伤"、"觉醒"这些状态变化经常导致前后矛盾。AImanju 设计了三级持久化的形态修改器：

```
permanent (永久)  → 升级、断肢、血脉觉醒、改名
staged    (阶段)  → 受伤未愈、易容潜入、被诅咒
temporary (临时)  → 中毒一日、限时 buff、一次性变身
```

每个修改器有 `category`（appearance/injury/identity/upgrade）和 `priority`（决定哪个修改器最终生效）。同类型修改器自动互斥替换，临时修改器自动过期。

### 2. Reflexion 提示词工厂

基于 Princeton Reflexion 论文实现的反思式提示词构造器（`ReflexionPromptFactory`）。生成单集前，AI 先反思上一集的不足，再带着改进意图开始当前集创作，显著降低长剧情的质量衰减。

### 3. 上下文预算分配器（BudgetAllocator）

不是把所有信息一股脑塞进 prompt，而是根据当前集的需要动态分配 12K 字符预算：

```
角色设定        35%   ← 主角永远满预算，配角按出场重要性分配
前情提要        20%   ← 最近 3 集详写 + 之前压缩为关键事件
本集梗概        15%
角色状态变化    15%
格式与规范      15%
```

每个角色有独立的最大长度上限（main: 800 / supporting: 500 / recurring: 300 / guest: 150 / extra: 50）。

### 4. 注意力调度器（Attention Recommender）

通过 `AttentionRecommender`，AI 在生成本集前会被告知"当前应该重点关注：A 角色的复仇线、B 伏笔即将触发、世界规则 C 不能违反"，避免 AI 注意力分散导致主线偏离。

### 5. 跨集联动修复（FixSession）

发现第 12 集的剧情与第 8 集的设定矛盾？启动一个 `FixSession`，AI 会跨集分析受影响的集数，给出协同修复方案，生成多集协调一致的修复版本。

### 6. 统一约束管理（UnifiedConstraintManager）

把项目级硬约束（如"主角不能在第 30 集前透露穿越者身份"）统一管理，每次生成前自动注入到提示词，违反时立即报错。

### 7. 多 AI 模型抽象层

统一封装 Anthropic / OpenAI 兼容协议，支持运行时切换：

```typescript
aiClient.switchModel('glm-night');     // 智谱 GLM 夜间通道
aiClient.switchModel('claude-sonnet'); // Claude 主力
aiClient.switchModel('gpt-5');         // GPT 系列
```

支持 **Claude API Key 轮换**，速率限制时自动切换备用 Key。

### 8. Harness-Agent 双层校验架构

剧本质量审查采用**双轨制**：机械轨道管客观格式契约（确定性、零解释空间），AI 轨道管语义判断（连续性/伏笔/情绪/红线）——格式正确性不再依赖 AI 自觉，语义质量不被正则误伤：

```
生成前   多头注意力聚合约束 → 权重排序 Top-N 可验证集，其余降级为指导性；
         不可判定约束（镜头秒数/构图/逐字台词要求）自动降级，不占验证预算
生成时   约束按 ★关键 / ●重要 / ○一般 分组注入 Prompt，关键项永远置顶
每次尝试 先 normalize 归一化排版漂移 → 确定性机械扫描
         （双语台词/场景头/人物行/中文情绪/内部标记/V.O.密度/场景数/字数）
验证时   AI 分批逐条语义判定（40 条/批防截断）+ 机械违规并入结果（不计入满足率）
裁决     双轨 Best-of-N：机械违规数（重要→一般）优先，语义满足率次之
重试时   机械违规带行级证据+改法进修正指令；语义修正聚焦 critical/important
闸门     important 级机械违规强制重试；约束为空时闸门独立生效；
         海外题材最多 3 次尝试，非海外 2 次
```

海外生产交付格式（`overseas_drama`）：`中文名 英文名(英文情绪)：英文台词` 合并双语单行、`集-场 地点 时间 内/外` 行业标准场景头、场景级 `人物：` 行、中文动作线 + `{镜头指令}` 花括号、`(V.O.)` 画外音受控（≤4 条/集）、禁用内部标记（△/【核心情绪】/[HOOK]/出场人物/OS：）；`normalizeOverseasScript` 自动归一常见写法漂移（## 标题、特写：、闪回：、(VO) 变体、撇号断裂等）。

配套机制：世界状态初始化时若角色表为空，自动从大纲人物卡播种核心/常驻/客串三级角色并持久化中文译名（nameCn，含生命周期新增角色）；验证约束对超出上限 1.5 倍的篇幅自动升级为重要级违规。

---

## 🏗️ 技术栈

| 层级 | 技术选型 |
|---|---|
| **前端框架** | Vue 3 + TypeScript + Vite |
| **前端状态管理** | Pinia (17 个 stores) |
| **前端路由** | Vue Router |
| **前端 UI** | 自研设计系统 + CSS 变量主题 |
| **图表与流程图** | Mermaid + Marked |
| **后端框架** | Node.js + Express 5 |
| **后端语言** | TypeScript |
| **数据库** | MongoDB（Mongoose ODM） |
| **AI SDK** | Anthropic SDK + 自研 OpenAI 兼容客户端 |
| **鉴权** | JWT + bcrypt + 多角色 JWT_SECRET |
| **流式协议** | Server-Sent Events (SSE) |
| **参数校验** | Zod |
| **文件上传** | Multer |
| **测试** | Vitest + fast-check（属性测试） |
| **进程管理** | PM2（生产推荐） |

---

## 📁 项目结构

```
AImanju/
├── backend/                        # 后端服务（24 controllers + 18 service modules）
│   ├── src/
│   │   ├── app.ts                  # Express 入口
│   │   ├── controllers/            # 24 个控制器
│   │   │   ├── projectController.ts
│   │   │   ├── characterController.ts
│   │   │   ├── characterEnhancementController.ts
│   │   │   ├── episodeController.ts
│   │   │   ├── aiController.ts                # 大纲/剧本生成
│   │   │   ├── validationController.ts        # 一致性校验
│   │   │   ├── rewriteController.ts           # 单集改写
│   │   │   ├── batchRewriteController.ts      # 多集协同改写
│   │   │   ├── foreshadowingController.ts     # 伏笔管理
│   │   │   ├── stateController.ts             # 角色状态
│   │   │   ├── tagController.ts               # 标签
│   │   │   ├── worldStateController.ts        # 世界状态
│   │   │   ├── batchTaskController.ts         # 批量任务
│   │   │   ├── taskManagerController.ts       # 任务管理
│   │   │   ├── fixController.ts               # 跨集修复
│   │   │   ├── publishController.ts           # 发布配置
│   │   │   ├── docsController.ts              # 文档接口
│   │   │   ├── authController.ts              # 买家认证
│   │   │   ├── adminController.ts             # 管理员
│   │   │   ├── buyerController.ts             # 买家
│   │   │   ├── creatorAuthController.ts       # 创作者认证
│   │   │   ├── creatorAdminController.ts      # 创作者后台
│   │   │   ├── agentAuthController.ts         # 代理认证
│   │   │   └── agentDashboardController.ts    # 代理后台
│   │   ├── services/               # 18 个核心业务模块
│   │   │   ├── ai/                 # 多模型客户端
│   │   │   ├── outline/            # 大纲生成
│   │   │   ├── script/             # 剧本生成 + Reflexion + 叙事学 + 海外方法论
│   │   │   ├── episode/            # 单集计划增强
│   │   │   ├── character/          # 角色生命周期/弧光/魅力/声纹/关系
│   │   │   ├── world/              # 世界状态机
│   │   │   ├── state/              # 状态分析（增强版+基础版）
│   │   │   ├── foreshadowing/      # 伏笔与剧情线校验
│   │   │   ├── rhythm/             # 节奏控制 + 场景规划
│   │   │   ├── attention/          # 注意力调度
│   │   │   ├── constraint/         # 约束求解
│   │   │   ├── context/            # 上下文管理 + 预算分配
│   │   │   ├── format/             # 输出格式服务（15 种预设）
│   │   │   ├── prompt/             # 提示词模板（大纲+剧本+改写）
│   │   │   ├── rewrite/            # 单集/批量改写
│   │   │   ├── validation/         # 剧本校验器
│   │   │   ├── batch/              # 批量任务执行器
│   │   │   └── sse/                # SSE 推送处理
│   │   ├── models/                 # 29 个 Mongoose 模型
│   │   │   ├── Project.ts          # 项目
│   │   │   ├── Character.ts / CharacterState.ts / CharacterEnhancement.ts / CharacterRelationship.ts
│   │   │   ├── Outline.ts          # 大纲
│   │   │   ├── Episode.ts / EpisodeSummary.ts / EpisodePurchase.ts
│   │   │   ├── WorldState.ts       # 世界状态
│   │   │   ├── Foreshadowing.ts    # 伏笔
│   │   │   ├── BatchTask.ts        # 批量任务
│   │   │   ├── RewriteHistory.ts / RewriteRequest.ts / BatchRewriteHistory.ts
│   │   │   ├── ValidationReport.ts # 校验报告
│   │   │   ├── FixSession.ts       # 修复会话
│   │   │   ├── GenerationLog.ts    # 生成日志
│   │   │   ├── Creator.ts / Agent.ts / BuyerUser.ts / AgentAllocation.ts
│   │   │   ├── Tag.ts / CreatorTag.ts
│   │   │   ├── Favorite.ts / PointsTransaction.ts
│   │   │   ├── ProjectPublish.ts / PublishRequest.ts
│   │   │   └── index.ts
│   │   ├── repositories/           # 数据仓库层
│   │   ├── middleware/             # JWT 鉴权（buyer/creator/agent 三套）
│   │   ├── constants/
│   │   │   ├── formatPresets.ts    # 16 种输出格式预设
│   │   │   └── overseas.ts         # 海外短剧品类包（女频/男频题材库）
│   │   ├── types/                  # 类型定义
│   │   └── utils/                  # 工具函数（错误日志、JSON 安全解析等）
│   ├── tests/                      # Vitest + fast-check 属性测试
│   ├── .env.example
│   └── package.json
├── frontend/                       # Vue 3 前端
│   ├── src/
│   │   ├── views/                  # 18 个页面
│   │   │   ├── ProjectsPage.vue              # 项目列表
│   │   │   ├── ProjectDetail.vue             # 项目详情
│   │   │   ├── ProjectSettings.vue           # 项目设置
│   │   │   ├── OutlinePage.vue               # 大纲生成
│   │   │   ├── CharactersPage.vue            # 角色管理
│   │   │   ├── ScriptPage.vue                # 剧本生成
│   │   │   ├── ValidationPage.vue            # 一致性校验
│   │   │   ├── PreviewPage.vue               # 预览导出
│   │   │   ├── TasksPage.vue                 # 任务中心
│   │   │   ├── EngineeringPage.vue           # 工程文档
│   │   │   ├── LoginPage.vue
│   │   │   ├── CreatorAdminPage.vue          # 创作者后台
│   │   │   ├── AgentLayout.vue               # 代理后台主布局
│   │   │   ├── AgentDashboardPage.vue        # 代理仪表盘
│   │   │   ├── AgentCreatorsPage.vue         # 代理-创作者管理
│   │   │   ├── AgentAllocationsPage.vue      # 代理-额度分配
│   │   │   ├── AgentInvitePage.vue           # 代理邀请
│   │   │   └── AgentProfilePage.vue          # 代理-个人资料
│   │   ├── components/             # 9 类组件
│   │   │   ├── character/    (角色卡编辑、关系图、魅力编辑、声纹编辑等)
│   │   │   ├── script/       (批量改写、剧本预览、Diff 对比、回滚、生成进度)
│   │   │   ├── foreshadowing/(伏笔管理界面)
│   │   │   ├── worldstate/   (世界状态查看器)
│   │   │   ├── task/         (任务列表、进度面板)
│   │   │   ├── fix/          (修复会话界面)
│   │   │   ├── project/      (项目卡、设置)
│   │   │   ├── settings/
│   │   │   └── common/       (Drawer、悬浮组件等)
│   │   ├── stores/                 # 17 个 Pinia stores
│   │   │   ├── projectStore / characterStore / episodeStore
│   │   │   ├── generationStore / batchGenerationStore
│   │   │   ├── rewriteStore / batchRewriteStore
│   │   │   ├── validationStore / fixStore
│   │   │   ├── foreshadowingStore / worldStateStore
│   │   │   ├── rhythmStore / attentionStore
│   │   │   ├── tagStore / taskManagerStore
│   │   │   ├── authStore / agentStore
│   │   ├── router/
│   │   ├── services/               # API 封装
│   │   ├── composables/
│   │   ├── design-system/          # 自研设计系统
│   │   ├── styles/                 # CSS 模块化
│   │   └── types/
│   ├── .env.example
│   └── package.json
├── shared/                         # 前后端共享类型
│   └── types/index.ts
├── showcase/                       # 剧本宝盒（独立 Vue 应用 - 公开剧本展示）
├── landing-page/                   # 营销落地页（纯静态 HTML 6 个）
│   ├── index.html
│   ├── features.html
│   ├── workflow.html
│   ├── technology.html
│   ├── cases.html
│   └── changelog.html
├── upgrade-auth/                   # 可选：前端弱认证升级包
├── ecosystem.config.js             # PM2 配置
├── deploy.js / deploy.sh           # 部署脚本
├── LICENSE                         # GPL-3.0
└── README.md
```

---

## 🚀 快速开始

### 1. 环境要求

- **Node.js** ≥ 18.x（推荐 20.x LTS）
- **MongoDB** ≥ 7.x（本地或远程均可）
- **npm** / **pnpm** / **yarn**（任选其一）
- 一把可用的大模型 API Key（Claude / GPT / 智谱 GLM / DeepSeek 任选其一即可）

### 2. 克隆项目

```bash
git clone https://github.com/jsjm1986/AImanju.git
cd AImanju
```

### 3. 启动 MongoDB

```bash
# 本地 Docker 一键启动
docker run -d --name aimanju-mongo -p 27017:27017 mongo:7

# 或使用本地已安装的 MongoDB
mongod --dbpath /your/data/path
```

### 4. 配置后端

```bash
cd backend
cp .env.example .env
```

编辑 `backend/.env`，至少填写：

```ini
# 必填
MONGODB_URI=mongodb://localhost:27017/comic-script
JWT_SECRET=请生成强随机密钥

# 至少一组 AI 配置
DEFAULT_AI_PROVIDER=claude
CLAUDE_API_KEY=sk-...
CLAUDE_API_BASE_URL=https://api.anthropic.com
CLAUDE_MODEL=claude-sonnet-4-5-20250929
```

> 💡 生成强 JWT 密钥：
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

```bash
npm install
npm run dev          # 开发模式（热重载）
# 或
npm run build && npm start   # 生产模式
```

后端默认监听 `http://localhost:8333`，启动后控制台会显示：
```
✅ MongoDB 连接成功
🚀 服务器运行在 http://0.0.0.0:8333
⏱️ 服务器全局超时已设置为 60 分钟
```

### 5. 配置前端

```bash
cd ../frontend
cp .env.example .env
# 默认 .env 已指向 localhost:8333，无需修改

npm install
npm run dev
```

前端默认监听 `http://localhost:5173`，浏览器打开即可。

### 6. （可选）启动展示页

```bash
cd ../showcase
cp .env.example .env
npm install
npm run dev
```

---

## 🔑 完整环境变量配置

### 后端 `backend/.env`

完整变量见 [`backend/.env.example`](./backend/.env.example)，关键变量：

```ini
# ============= 服务器 =============
PORT=8333
HOST=0.0.0.0
NODE_ENV=development

# ============= 数据库 =============
MONGODB_URI=mongodb://localhost:27017/comic-script

# ============= JWT 鉴权 =============
JWT_SECRET=                    # 必填，强随机字符串
JWT_CREATOR_SECRET=            # 可选，创作者独立密钥
JWT_AGENT_SECRET=              # 可选，代理独立密钥

# ============= CORS =============
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8884

# ============= 默认模型 =============
DEFAULT_AI_PROVIDER=claude     # claude / openai / glm / dashscope

# ============= Anthropic Claude =============
CLAUDE_API_KEY=sk-ant-...
CLAUDE_API_KEY_2=              # 可选，多 Key 轮换
CLAUDE_API_KEY_3=
CLAUDE_API_BASE_URL=https://api.anthropic.com
CLAUDE_MODEL=claude-sonnet-4-5-20250929
CLAUDE_THINKING_ENABLED=false  # 是否启用扩展思考
CLAUDE_THINKING_BUDGET=10000

# ============= OpenAI 兼容 =============
OPENAI_API_KEY=sk-...
OPENAI_API_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o

# ============= 智谱 GLM =============
GLM_API_KEY=
GLM_API_BASE_URL=https://open.bigmodel.cn/api/paas/v4
GLM_MODEL=glm-4.5

# ============= 智谱夜间通道（可选） =============
GLM_NIGHT_API_KEY=
GLM_NIGHT_API_BASE_URL=
GLM_NIGHT_MODEL=

# ============= 火山方舟 (豆包) =============
ARK_API_KEY=
ARK_API_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_MODEL=doubao-pro

# ============= DeepSeek =============
DEEPSEEK_API_KEY=
DEEPSEEK_API_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

# ============= 阿里云百炼 =============
DASHSCOPE_API_KEY=
DASHSCOPE_API_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# ============= 自定义 OpenAI 网关（可选） =============
# 用于通过统一网关代理 GPT / Gemini 等模型
CUSTOM_GATEWAY_API_KEY=
CUSTOM_GATEWAY_BASE_URL=

# ============= 速率限制 =============
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
AI_RATE_LIMIT_WINDOW_MS=3600000
AI_RATE_LIMIT_MAX=20

# ============= 管理员账户初始化（可选） =============
ADMIN_USERNAME=admin
ADMIN_PASSWORD=please-change
ADMIN_EMAIL=admin@example.com
```

### 前端 `frontend/.env`

```ini
VITE_API_BASE=http://localhost:8333/api

# 生产环境示例
# VITE_API_BASE=https://your-domain.com/api
```

---

## 🎯 完整使用流程

### 工作流总览

```
1. 注册创作者账号 → 选择套餐（试用/付费）
        ↓
2. 创建项目（标题、题材、类型、目标集数）
        ↓
3. 大纲生成（Outline）
   ├─ 输入故事概念（一句话即可，AI 会扩展世界观）
   ├─ AI 生成人物卡（5-8 个角色）
   ├─ AI 生成剧情大纲（200-400 字）
   └─ AI 生成分集梗概（每集 100-150 字，第1集黄金开局 + 每集"压→扬→新危机"起伏）
        ↓
4. 角色管理（Characters）
   ├─ 检查/编辑 AI 生成的角色卡
   ├─ 调整角色定位、外貌、性格
   ├─ 配置角色间关系（关系图谱）
   └─ 角色增强：声纹画像、魅力维度、口头禅
        ↓
5. 剧本生成（Script）
   ├─ 选定起止集数（推荐每批 5-10 集）
   ├─ 选择 AI 模型 + 输出格式预设
   ├─ 流式生成（SSE 实时推送）
   ├─ AI 自动状态分析（装备/能力/伤势/形态变化）
   ├─ AI 自动伏笔追踪
   └─ AI 自动世界状态更新
        ↓
6. 一致性校验（Validation）
   ├─ 格式校验（场景标记、对白、画面描述）
   ├─ 角色一致性（性格、外貌、能力）
   ├─ 剧情连贯性（前后呼应、伏笔触发）
   └─ 世界规则（不能违反的硬约束）
        ↓
7. 改写润色（Rewrite）
   ├─ 单集改写：针对某集精修
   ├─ 多集协同改写：跨集联动调整
   └─ 跨集修复：发现矛盾时启动 FixSession
        ↓
8. 预览与导出（Preview）
   ├─ 完整剧本浏览
   ├─ 分集筛选导出
   └─ TXT 一键下载
        ↓
9. （可选）发布到市场
   ├─ 配置发布信息（封面、标签、定价）
   ├─ 提交审核
   └─ 上架买家市场，按集售卖
```

### 输入示例

```
【基本信息】
题材：男频漫剧
类型：穿越 + 国战 + 召唤
目标集数：60 集

【故事概念】
现代青年穿越到以英灵对决决定国运的世界，发现华夏历史被抹除，
各国英灵碾压夏国。主角凭借对华夏历史的了解，召唤盘古、关羽、
赵云等华夏英灵，横扫列强，重铸华夏荣光。
```

### 输出示例（节选）

**人物卡：**
```
1. 叶玄（男主角）
性别：男
年龄：20岁左右
身份：夏国英灵学院学生→国运擂台选手（穿越者）
外貌：五官俊朗，修长挺拔，黑色短发略微凌乱...
性格：自信、果断、热血、机智
```

**剧本（标准动态漫格式）：**
```
【第一集】
梗概：国运擂台上，叶玄以破斧引动盘古虚影，震慑全场。
人物：叶玄，龙忠勇，吉川太一

1-1：国运擂台-夜 内
【BGM：紧张史诗感】

△巨大的竞技场，无数聚光灯交汇，观众席上人山人海。

画外音（机械冰冷）：国运之战，最终对决即将开始！

△叶玄缓步走上擂台，手中握着一把破旧的斧子。

观众甲（嘲讽）：夏国完了，派个拿柴刀的上来！

叶玄（冷笑）：井底之蛙，也配妄议圣器？！

△斧子迸发万丈金光，盘古虚影横空出世！
```

---

## 🌐 API 概览

### 业务接口

| 模块 | 路径前缀 | 主要端点 |
|---|---|---|
| **项目管理** | `/api/projects` | CRUD、保存大纲、批量保存剧本、TXT 导出 |
| **角色管理** | `/api/characters` | CRUD、批量导入、状态更新、上下文构建 |
| **角色增强** | `/api/character-enhancement` | 声纹画像、魅力分析、关系图谱 |
| **剧本管理** | `/api/episodes` | 单集 CRUD、批量保存、按范围查询 |
| **AI 生成** | `/api/ai` | 大纲生成、逐集生成（流式/非流式）、状态分析、断点恢复 |
| **校验** | `/api/validation` | 一致性校验、矛盾检测 |
| **改写** | `/api/rewrite` | 单集改写、改写历史、回滚 |
| **批量改写** | `/api/batch-rewrite` | 多集协同改写 |
| **伏笔** | `/api/foreshadowing` | 伏笔 CRUD、触发追踪 |
| **状态** | `/api/state` | 角色状态、世界状态查询 |
| **标签** | `/api/tags` | 项目/章节标签管理 |
| **世界状态** | `/api/world-state` | 世界状态查询、版本回滚 |
| **批量任务** | `/api/world-state` | 批量任务创建、查询、控制 |
| **任务** | `/api/tasks` | 任务管理（需创作者鉴权） |
| **修复** | `/api/fix` | 跨集修复会话 |
| **发布** | `/api/publish` | 项目发布配置 |
| **文档** | `/api/docs` | 工程文档查询 |
| **健康检查** | `/health` | 服务存活探测 |

### 账号体系接口

| 角色 | 路径前缀 | 说明 |
|---|---|---|
| 买家 | `/api/auth`, `/api/buyer` | 注册/登录、个人中心、购买 |
| 创作者 | `/api/creator`, `/api/creator/admin` | 注册/登录、工作台、配额 |
| 代理 | `/api/agent`, `/api/agent/dashboard` | 注册/登录、邀请创作者、分配额度 |
| 管理员 | `/api/admin` | 全系统管理（用户审核、配额发放、积分管理） |

---

## 🚢 部署到生产环境

### 方式 1：使用 PM2

```bash
# 1. 配置生产环境的 backend/.env 与 frontend/.env
# 2. 修改 ecosystem.config.js（端口）
# 3. 一键部署
chmod +x deploy.sh
DEPLOY_DIR=/your/deploy/path FRONTEND_PORT=8884 BACKEND_PORT=8333 ./deploy.sh

# 或手动
cd backend && npm install && npm run build && cd ..
cd frontend && npm install && npm run build && cd ..
pm2 start ecosystem.config.js
pm2 save
pm2 startup    # 配置开机自启
```

### 方式 2：Nginx 反向代理（推荐）

前端 build 后由 Nginx 直接服务静态文件，后端通过 `location /api` 反代到 8333 端口：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    root /your/path/AImanju/frontend/dist;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }

    # 后端 API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:8333/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # SSE 流式支持（重要）
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
    }
}
```

### 方式 3：Docker（社区贡献中）

欢迎社区贡献 Dockerfile / docker-compose.yml，详见 [Issues](https://github.com/jsjm1986/AImanju/issues)。

---

## 🧪 测试

```bash
cd backend
npm test                 # 运行所有测试
npm run test:watch       # 监听模式
npm run test:property    # 仅运行属性测试

# 已有的属性测试覆盖：
# - cross-episode-fix.property.test.ts    跨集修复属性测试
# - fix.property.test.ts                  修复会话属性测试
# - generation-context.property.test.ts   上下文生成属性测试
# - output-format.test.ts                 输出格式测试
# - rewrite-history.property.test.ts      改写历史属性测试
# - validation.property.test.ts           校验器属性测试
```

---

## 🛠️ 常见问题

<details>
<summary><b>Q: 启动后端时报错 "JWT_SECRET environment variable is required"</b></summary>

请在 `backend/.env` 中配置 `JWT_SECRET`，必须是强随机字符串（推荐 64 字节十六进制）：

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
</details>

<details>
<summary><b>Q: AI 生成超时怎么办？</b></summary>

后端默认 30 分钟超时（流式生成），全局 60 分钟超时。如果模型本身慢，可以：
1. 切换到更快的模型（如 GLM-4.5、deepseek-chat）
2. 启用多 Key 轮换（`CLAUDE_API_KEY_2`、`CLAUDE_API_KEY_3`）
3. 减小 `max_tokens`，分段生成
</details>

<details>
<summary><b>Q: 如何选择合适的 AI 模型？</b></summary>

- **质量优先**：Claude Sonnet 4.5 / GPT-5
- **速度优先**：Gemini Flash / GLM-4.5 / deepseek-chat
- **成本优先**：DeepSeek / 智谱 GLM 夜间通道
- **国内合规**：智谱 GLM / 阿里百炼 / 火山方舟（豆包）
</details>

<details>
<summary><b>Q: 部署后 SSE 流式生成断流？</b></summary>

90% 是 Nginx 缓冲导致。请在 `location /api/` 中加：

```nginx
proxy_http_version 1.1;
proxy_set_header Connection '';
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 3600s;
```
</details>

<details>
<summary><b>Q: 角色状态前后不一致怎么办？</b></summary>

1. 检查"一致性校验"页面，AI 会自动指出矛盾点
2. 使用"跨集修复"功能（FixSession）
3. 调整"约束管理器"，添加硬约束规则
4. 角色卡的外貌/性格描述要足够具体（避免模糊词如"很帅"）
</details>

---

## 🤝 贡献指南

欢迎任何形式的贡献！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交修改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 发起 Pull Request

提交 Issue 时请包含：
- 问题复现步骤
- 期望行为 vs 实际行为
- 系统环境（Node 版本、MongoDB 版本、操作系统）
- 相关日志（**注意脱敏 API Key 等敏感信息**）

### 优先欢迎的贡献方向

- 🐳 **Docker 化**：Dockerfile + docker-compose.yml
- 🌍 **国际化**：i18n 支持（英文/日文）
- 🎨 **更多输出格式预设**：电影剧本、广播剧、有声小说
- 🔌 **新模型适配**：Mistral、Cohere、千问等
- 📱 **移动端适配**：响应式优化
- 🧩 **可视化工具**：剧情线路图、角色关系图谱增强
- 🤖 **更多 Agent 模块**：分镜生成 Agent、视频提示词 Agent

---

## 📜 许可证

本项目采用 **GNU GPL-3.0** 开源许可证。

**简单来说：**
- ✅ 你可以自由使用、修改、分发本项目
- ✅ 你可以将其用于商业用途
- ⚠️ 任何基于本项目的衍生作品也必须以 GPL-3.0 开源
- ⚠️ 必须保留原作者版权声明

完整条款请参阅 [LICENSE](./LICENSE) 文件。

---

## ⚠️ 免责声明

- 本项目调用第三方大模型 API，**模型生成内容的版权归属、合规性、敏感词等问题由使用者自行负责**
- AI 生成的剧本内容**不构成专业法律/版权建议**，商业使用前请进行人工审校
- 严禁使用本项目生成违反法律法规、公序良俗的内容
- 涉及真实历史人物、知名 IP 的二次创作请遵循当地版权法规
- 项目开发者不对使用本项目产生的任何后果承担责任

---

## 🌟 致谢

- **Anthropic** - 提供 Claude 模型与 SDK
- **OpenAI** - 提供 OpenAI 兼容协议规范
- **智谱 AI / DeepSeek / 阿里云百炼 / 火山方舟** - 国产大模型支持
- **Vue.js / Vite** 团队
- **Express / Mongoose** 维护者
- **fast-check** - 优秀的属性测试库
- 所有提交 Issue 和 PR 的社区贡献者

设计灵感来源：
- 《国运英灵》《洪荒降临》等优秀动态漫剧本格式参考
- Princeton Reflexion 论文 - 反思式提示词构造
- Anthropic Constitutional AI - 约束式生成

---

<div align="center">

**如果 AImanju 对你有帮助，欢迎点亮 Star ⭐**

[GitHub](https://github.com/jsjm1986/AImanju) · [Issues](https://github.com/jsjm1986/AImanju/issues) · [Pull Requests](https://github.com/jsjm1986/AImanju/pulls)

Built with ❤️ for AI-powered creative writing

</div>
