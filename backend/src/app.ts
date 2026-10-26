import dotenv from 'dotenv';
// 必须在其他导入之前加载环境变量
dotenv.config();

import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import { creatorAuth } from './middleware/creatorMiddleware';
import { requestLogger } from './middleware/requestLogger';

// 路由
import aiController from './controllers/aiController';
import batchRewriteController from './controllers/batchRewriteController';
import characterController from './controllers/characterController';
import characterEnhancementController from './controllers/characterEnhancementController';
import { getEngineeringDoc, getDocsList, getDocContent } from './controllers/docsController';
import episodeController from './controllers/episodeController';
import fixController from './controllers/fixController';
import foreshadowingController from './controllers/foreshadowingController';
import projectController from './controllers/projectController';
import rewriteController from './controllers/rewriteController';
import stateController from './controllers/stateController';
import tagController from './controllers/tagController';
import validationController from './controllers/validationController';
import worldStateController from './controllers/worldStateController';
import batchTaskController from './controllers/batchTaskController';
import taskManagerController from './controllers/taskManagerController';
import authController from './controllers/authController';
import adminController from './controllers/adminController';
import buyerController from './controllers/buyerController';
import publishController from './controllers/publishController';
import creatorAuthController from './controllers/creatorAuthController';
import creatorAdminController from './controllers/creatorAdminController';
import agentAuthController from './controllers/agentAuthController';
import agentDashboardController from './controllers/agentDashboardController';
import { BatchTaskExecutor } from './services/batch/BatchTaskExecutor';

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';  // 默认监听所有网卡
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/comic-script';

// 中间件
app.use(cors({ exposedHeaders: ['X-Request-ID'] }));
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);

// API 路由
app.use('/api/projects', projectController);
app.use('/api/characters', characterController);
app.use('/api/character-enhancement', characterEnhancementController);
app.use('/api/episodes', episodeController);
app.use('/api/ai', aiController);
app.use('/api/validation', validationController);
app.use('/api/rewrite', rewriteController);
app.use('/api/batch-rewrite', batchRewriteController);
app.use('/api/foreshadowing', foreshadowingController);
app.use('/api/state', stateController);
app.use('/api/tags', tagController);
app.use('/api/world-state', worldStateController);
app.use('/api/world-state', batchTaskController);
app.use('/api/tasks', creatorAuth, taskManagerController);
app.use('/api/fix', fixController);

// 买家端 API
app.use('/api/auth', authController);
app.use('/api/admin', adminController);
app.use('/api/buyer', buyerController);
app.use('/api/publish', publishController);

// 创作者端 API
app.use('/api/creator', creatorAuthController);
app.use('/api/creator/admin', creatorAdminController);

// 代理端 API
app.use('/api/agent', agentAuthController);
app.use('/api/agent/dashboard', agentDashboardController);

console.log('[App] /api/fix 路由已挂载');
console.log('[App] /api/tasks 任务管理路由已挂载');
console.log('[App] /api/auth 认证路由已挂载');
console.log('[App] /api/admin 管理员路由已挂载');
console.log('[App] /api/buyer 买家路由已挂载');
console.log('[App] /api/publish 发布配置路由已挂载');
console.log('[App] /api/creator 创作者认证路由已挂载');
console.log('[App] /api/agent 代理路由已挂载');
console.log('[App] 批量任务路由已挂载');

// 文档API
app.get('/api/docs', getDocsList);                    // 获取文档列表
app.get('/api/docs/:docId', getDocContent);           // 获取指定文档
app.get('/api/docs/engineering', getEngineeringDoc);  // 兼容旧API

// 健康检查（含数据库连通性）
const healthHandler = (req: express.Request, res: express.Response) => {
  const dbReady = mongoose.connection.readyState === 1;
  res.status(dbReady ? 200 : 503).json({
    status: dbReady ? 'ok' : 'degraded',
    db: dbReady ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// 连接 MongoDB 并启动服务器
async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB 连接成功');

    // 恢复未完成的批量任务
    const executor = BatchTaskExecutor.getInstance();
    await executor.recoverPendingTasks();

    const server = app.listen(PORT as number, HOST, () => {
      console.log(`🚀 服务器运行在 http://${HOST}:${PORT}`);
    });

    // 设置全局超时时间为 60 分钟，防止长任务（如批量生成）被服务器中断
    // Node.js 默认超时通常为 2 分钟
    server.timeout = 60 * 60 * 1000;
    server.keepAliveTimeout = 61 * 60 * 1000; // 必须大于 headersTimeout
    server.headersTimeout = 61 * 60 * 1000;   // 必须大于 timeout
    console.log(`⏱️ 服务器全局超时已设置为 60 分钟`);
  } catch (error) {
    console.error('❌ 启动失败:', error);
    process.exit(1);
  }
}

start();

export default app;

