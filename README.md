<div align="center">

# AImanju · AI 动态漫剧本生成系统

**让 AI 替你写出完整的动态漫剧本：从概念到分镜，从角色到伏笔。**

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3.x-42b883.svg)](https://vuejs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7%2B-47A248.svg)](https://www.mongodb.com/)

</div>

---

## ✨ 项目介绍

**AImanju** 是一个面向中文动态漫（短视频/竖屏漫剧）创作场景的 AI 剧本生产工具，把"概念 → 大纲 → 角色卡 → 分集梗概 → 完整剧本 → 状态追踪 → 改写润色"整条工业流水线接到大模型上，由 AI 协同完成。

无论你是：
- 单兵创作者：想用一句话生成 60 集结构化的漫剧剧本
- 工作室主理人：想批量产出多个项目的剧本草稿
- 二创剧组：想保持长剧情中的角色、装备、能力一致性
- AI 工具研究者：想看大模型如何被工程化驱动完成连续创作任务

AImanju 都能为你开箱即用。

---

## 🎯 核心能力

| 能力 | 说明 |
|---|---|
| **🧠 大纲生成** | 输入一句创意，自动产出人物卡 + 剧情大纲 + 分集梗概 |
| **🎬 逐集剧本** | 流式生成剧本（场景标记 / 画面描述 / 对白 / 画外音） |
| **👥 角色一致性** | 自动追踪装备、能力、伤势、形态修改器（永久 / 阶段 / 临时三级持久化） |
| **🌐 世界状态机** | 跨集状态推演与世界规则一致性校验 |
| **🪡 伏笔管理** | 自动埋伏笔、追踪触发，防止"伏笔遗忘" |
| **🔁 智能改写** | 单集 / 跨集级别改写，保持上下文连贯 |
| **🎵 节奏控制** | 钩子、打脸、升级、逆袭等爽点节奏自动设计 |
| **🚦 断点续生** | 任务级进度持久化，支持暂停 / 恢复 / 失败重试 |
| **🤖 多模型支持** | Claude、GPT、Gemini、智谱 GLM、DeepSeek、豆包 Ark、阿里百炼等 |
| **📦 批量产线** | 同时孵化多个项目 + 多集生成的批量任务执行器 |
| **🔐 多角色账号** | 创作者 / 代理 / 买家 / 管理员四类账户与配额管理 |
| **📤 一键导出** | TXT 完整剧本导出，支持范围筛选 |

---

## 🏗️ 技术栈

| 层级 | 技术选型 |
|---|---|
| **前端** | Vue 3 + TypeScript + Pinia + Vue Router + Vite |
| **后端** | Node.js + Express 5 + TypeScript |
| **数据库** | MongoDB (Mongoose) |
| **AI 接入** | Anthropic SDK + OpenAI 兼容协议 |
| **鉴权** | JWT + bcrypt |
| **流式协议** | Server-Sent Events (SSE) |
| **测试** | Vitest + fast-check（属性测试） |
| **运行环境** | PM2（推荐） |

---

## 📁 项目结构

```
AImanju/
├── backend/                      # 后端服务
│   ├── src/
│   │   ├── app.ts                # Express 入口
│   │   ├── controllers/          # 19 个控制器（项目/角色/剧本/AI/创作者/代理/买家...）
│   │   ├── services/             # 18 个业务模块
│   │   │   ├── ai/               # AI 客户端（多模型 + 重试 + 流式）
│   │   │   ├── outline/          # 大纲生成
│   │   │   ├── script/           # 剧本生成
│   │   │   ├── character/        # 角色生命周期
│   │   │   ├── world/            # 世界状态机
│   │   │   ├── state/            # 状态分析器
│   │   │   ├── foreshadowing/    # 伏笔管理
│   │   │   ├── rhythm/           # 节奏控制
│   │   │   ├── attention/        # 注意力调度
│   │   │   ├── constraint/       # 约束求解
│   │   │   ├── context/          # 上下文管理
│   │   │   ├── format/           # 输出格式化
│   │   │   ├── prompt/           # 提示词模板
│   │   │   ├── rewrite/          # 改写引擎
│   │   │   ├── validation/       # 一致性校验
│   │   │   ├── batch/            # 批量任务执行器
│   │   │   ├── episode/          # 单集生成
│   │   │   └── sse/              # SSE 推送
│   │   ├── models/               # Mongoose 数据模型
│   │   ├── repositories/         # 数据仓库层
│   │   ├── middleware/           # JWT 鉴权中间件
│   │   ├── constants/            # 输出格式预设
│   │   ├── types/                # 类型定义
│   │   └── utils/                # 工具函数
│   ├── tests/                    # 属性测试
│   ├── .env.example
│   └── package.json
├── frontend/                     # Vue 3 前端
│   ├── src/
│   │   ├── views/                # 页面组件
│   │   ├── components/           # 通用组件
│   │   ├── stores/               # Pinia 状态管理
│   │   ├── router/               # 路由配置
│   │   └── api/                  # API 封装
│   ├── .env.example
│   └── package.json
├── shared/                       # 前后端共享类型
│   └── types/
├── showcase/                     # 剧本展示页（独立 Vue 应用）
├── landing-page/                 # 营销落地页（纯静态 HTML）
├── upgrade-auth/                 # 可选：前端弱认证升级包
├── ecosystem.config.js           # PM2 配置
├── deploy.js / deploy.sh         # 部署脚本
├── LICENSE                       # GPL-3.0
└── README.md
```

---

## 🚀 快速开始

### 1. 环境要求

- **Node.js** ≥ 18.x
- **MongoDB** ≥ 7.x（本地或远程均可）
- **npm** / **pnpm** / **yarn**（任选其一）
- 一把可用的大模型 API Key（Claude、GPT、智谱 GLM、DeepSeek 任选）

### 2. 克隆项目

```bash
git clone https://github.com/jsjm1986/AImanju.git
cd AImanju
```

### 3. 配置后端

```bash
cd backend
cp .env.example .env
# 编辑 .env，至少填写：
#   - MONGODB_URI（MongoDB 连接串）
#   - JWT_SECRET（强随机字符串，可用：node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"）
#   - 一组 AI 模型的 API Key（如 CLAUDE_API_KEY 或 GLM_API_KEY）

npm install
npm run dev          # 开发模式（热重载）
# 或
npm run build && npm start   # 生产模式
```

后端默认监听 `http://localhost:8333`。

### 4. 配置前端

```bash
cd ../frontend
cp .env.example .env
# 默认 .env 已指向 localhost:8333，无需修改

npm install
npm run dev          # 开发模式
```

前端默认监听 `http://localhost:5173`，浏览器打开即可访问。

### 5. （可选）启动展示页

```bash
cd ../showcase
cp .env.example .env
npm install
npm run dev
```

---

## 🔑 环境变量配置

### 后端关键变量（`backend/.env`）

```ini
# 服务器
PORT=8333
HOST=0.0.0.0
NODE_ENV=development

# 数据库
MONGODB_URI=mongodb://localhost:27017/comic-script

# JWT 鉴权（必须）
JWT_SECRET=请生成强随机密钥

# 默认模型 (claude / openai / glm / dashscope)
DEFAULT_AI_PROVIDER=claude

# Claude API
CLAUDE_API_KEY=sk-...
CLAUDE_API_BASE_URL=https://api.anthropic.com
CLAUDE_MODEL=claude-sonnet-4-5-20250929

# 其他模型按需配置（OpenAI / GLM / Ark / DeepSeek / DashScope）
```

完整变量及示例参考 [`backend/.env.example`](./backend/.env.example)。

### 前端变量（`frontend/.env`）

```ini
VITE_API_BASE=http://localhost:8333/api
```

---

## 🌐 API 概览

| 模块 | 路径前缀 | 说明 |
|---|---|---|
| 项目管理 | `/api/projects` | 项目 CRUD、大纲保存、剧本导出 |
| 角色管理 | `/api/characters` | 角色 CRUD、状态追踪、上下文构建 |
| 角色增强 | `/api/character-enhancement` | 角色卡智能补全 |
| 剧本管理 | `/api/episodes` | 单集 CRUD、批量保存 |
| AI 生成 | `/api/ai` | 大纲生成、逐集生成（流式/非流式）、状态分析 |
| 校验 | `/api/validation` | 一致性校验、矛盾检测 |
| 改写 | `/api/rewrite` | 单集改写、跨集润色 |
| 批量改写 | `/api/batch-rewrite` | 多集批量改写 |
| 伏笔 | `/api/foreshadowing` | 伏笔埋设与追踪 |
| 状态机 | `/api/world-state` | 世界状态查询、批量任务 |
| 任务 | `/api/tasks` | 任务管理与进度 |
| 修复 | `/api/fix` | 自动修复异常剧本 |
| 创作者 | `/api/creator` | 创作者认证与工作台 |
| 代理 | `/api/agent` | 代理认证与代理后台 |
| 买家 | `/api/auth`, `/api/buyer` | 买家认证与购买流程 |
| 管理员 | `/api/admin` | 管理员后台 |
| 发布 | `/api/publish` | 剧本发布配置 |
| 健康检查 | `/health` | 服务存活探测 |

---

## 🎨 使用流程

```
1. 注册账号 → 创建项目
2. 输入故事概念（一句话即可，AI 会扩展世界观）
3. 生成大纲 → 检查人物卡 / 剧情大纲 / 分集梗概
4. 进入剧本生成 → 选定起止集数 → 流式生成
5. 查看自动状态分析（装备/能力/伤势/形态变化）
6. 需要时改写：单集改写 / 跨集润色
7. 校验一致性，AI 自动指出矛盾点
8. 导出 TXT 完整剧本
```

---

## 🚢 部署到生产环境

### 使用 PM2

```bash
# 1. 配置 .env（生产值）
# 2. 一键部署
chmod +x deploy.sh
DEPLOY_DIR=/your/deploy/path ./deploy.sh

# 或手动
cd backend && npm install && npm run build && cd ..
cd frontend && npm install && npm run build && cd ..
pm2 start ecosystem.config.js
pm2 save
```

### 使用 Docker（社区贡献）

欢迎社区贡献 Dockerfile / docker-compose.yml，详见 [Issues](https://github.com/jsjm1986/AImanju/issues)。

---

## 🧪 测试

```bash
cd backend
npm test                # 运行所有测试
npm run test:watch      # 监听模式
npm run test:property   # 仅运行属性测试
```

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
- 相关日志（注意脱敏 API Key）

---

## 📜 许可证

本项目采用 **GNU GPL-3.0** 开源许可证。

简单来说：
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

---

## 🌟 致谢

- **Anthropic** - 提供 Claude 模型
- **Vue.js / Vite** 团队
- **Express / Mongoose** 维护者
- 所有提交 Issue 和 PR 的社区贡献者

---

<div align="center">

**如果 AImanju 对你有帮助，欢迎点亮 Star ⭐**

[GitHub](https://github.com/jsjm1986/AImanju) · [Issues](https://github.com/jsjm1986/AImanju/issues) · [Pull Requests](https://github.com/jsjm1986/AImanju/pulls)

</div>
