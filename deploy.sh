#!/bin/bash

# 部署脚本 - 动态漫剧本生成系统 V2
# 使用前请修改下方变量为你的实际部署路径

set -e

# ==================== 配置 ====================
DEPLOY_DIR="${DEPLOY_DIR:-/path/to/your/deployment}"
FRONTEND_PORT="${FRONTEND_PORT:-8884}"
BACKEND_PORT="${BACKEND_PORT:-8333}"
APP_BACKEND="${APP_BACKEND:-comic-backend}"
APP_FRONTEND="${APP_FRONTEND:-comic-frontend}"

echo "=========================================="
echo "  动态漫剧本生成系统 V2 部署脚本"
echo "  部署目录: $DEPLOY_DIR"
echo "=========================================="

# 进入项目目录
cd "$DEPLOY_DIR"

echo ""
echo "[1/6] 停止现有服务..."
pm2 stop "$APP_BACKEND" "$APP_FRONTEND" 2>/dev/null || true
pm2 delete "$APP_BACKEND" "$APP_FRONTEND" 2>/dev/null || true

echo ""
echo "[2/6] 安装后端依赖..."
cd backend
npm install --production=false
npm run build
cd ..

echo ""
echo "[3/6] 安装前端依赖..."
cd frontend
npm install
npm run build
cd ..

echo ""
echo "[4/6] 启动 PM2 服务..."
pm2 start ecosystem.config.js

echo ""
echo "[5/6] 保存 PM2 配置..."
pm2 save

echo ""
echo "[6/6] 查看服务状态..."
pm2 status

echo ""
echo "=========================================="
echo "  部署完成!"
echo "=========================================="
echo ""
echo "  前端端口: $FRONTEND_PORT"
echo "  后端端口: $BACKEND_PORT"
echo ""
echo "  查看日志: pm2 logs"
echo "  查看状态: pm2 status"
echo "  重启服务: pm2 restart all"
echo ""
