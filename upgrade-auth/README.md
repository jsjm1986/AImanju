# 用户认证功能升级包

提供基础的前端访问控制能力（基于 localStorage 的轻量认证），可作为内部测试或小团队使用的简易方案。生产环境建议改用后端 JWT 鉴权。

## 文件清单

### 新增文件
- `frontend/src/stores/authStore.ts` - 认证状态管理
- `frontend/src/views/LoginPage.vue` - 登录页面

### 修改文件
- `frontend/src/router/index.ts` - 路由配置（添加路由守卫）
- `frontend/src/views/ProjectsPage.vue` - 项目列表页（添加退出按钮）
- `frontend/src/views/ProjectDetail.vue` - 项目详情页（添加退出按钮）

## 部署步骤

1. 将 `upgrade-auth/frontend/` 目录下的所有文件复制到 `frontend/` 对应位置
2. 在 `frontend/.env` 中配置访问账号（可选）：
   ```ini
   VITE_AUTH_USERNAME=your-username
   VITE_AUTH_PASSWORD=your-strong-password
   ```
3. 重新构建前端：
   ```bash
   cd frontend
   npm run build
   ```
4. 重启服务（如果使用 pm2）：
   ```bash
   pm2 restart all
   ```

## 功能说明

- 默认账号读取自构建时环境变量 `VITE_AUTH_USERNAME` / `VITE_AUTH_PASSWORD`
- 若未配置，会使用 `admin` / `change-me-please`，**部署前请务必修改**
- 未登录用户只能访问 `/docs` 页面
- 其他页面需要登录后才能访问
- 登录状态保存在 localStorage

## 安全提示

> 此方案为前端弱认证，仅适用于内部低风险场景。  
> 公网部署请改用后端 JWT + bcrypt 密码哈希，参考 `backend/src/middleware/buyerAuth.ts`。
